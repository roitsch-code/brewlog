/**
 * APNs Live-Activity push sender (server-only) — pushes each brew step's update
 * to the iPhone's Live Activity so it ADVANCES + re-counts-down while the phone
 * is LOCKED. A suspended/locked app can't update its own activity; only an APNs
 * push (or the system-rendered countdown) moves it, so the Hetzner server drives
 * the step changes on a schedule it received at brew start.
 *
 * Auth is the SAME APNs `.p8` key the watch infra used (a push key is
 * account-wide, not push-type-specific) — reuses `APNS_KEY_P8/_KEY_ID/_TEAM_ID`
 * already on the VPS. The topic is the Live-Activity topic of the MAIN app
 * bundle (NOT the watch bundle in APNS_BUNDLE_ID).
 *
 * Everything is gated on env (`liveActivityPushConfigured()`); with no key set
 * the sender no-ops, so this is harmless until the secrets are present.
 */
import http2 from "node:http2";
import crypto from "node:crypto";

const LIVE_ACTIVITY_TOPIC = "com.roitsch.btts.push-type.liveactivity";

interface ApnsEnv {
  keyP8: string;
  keyId: string;
  teamId: string;
  production: boolean;
}

function readEnv(): ApnsEnv | null {
  const keyP8 = process.env.APNS_KEY_P8;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  if (!keyP8 || !keyId || !teamId) return null;
  return {
    keyP8: keyP8.includes("\\n") ? keyP8.replace(/\\n/g, "\n") : keyP8,
    keyId,
    teamId,
    production: process.env.APNS_PRODUCTION !== "false",
  };
}

/** True when the APNs secrets are present, so the LA push path is live. */
export function liveActivityPushConfigured(): boolean {
  return readEnv() !== null;
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

/** Sign an APNs provider JWT (ES256). Pure — exported for unit testing. */
export function signProviderJwt(
  keyP8: string,
  keyId: string,
  teamId: string,
  iatSec: number,
): string {
  const header = b64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const payload = b64url(JSON.stringify({ iss: teamId, iat: iatSec }));
  const signingInput = `${header}.${payload}`;
  const sig = crypto.sign("SHA256", Buffer.from(signingInput), {
    key: keyP8,
    dsaEncoding: "ieee-p1363",
  });
  return `${signingInput}.${b64url(sig)}`;
}

let cachedJwt: { token: string; iat: number } | null = null;

/** APNs provider JWT — valid up to 1 h, reused (Apple rejects too-frequent regen). */
function providerToken(env: ApnsEnv): string {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && now - cachedJwt.iat < 3000) return cachedJwt.token;
  const token = signProviderJwt(env.keyP8, env.keyId, env.teamId, now);
  cachedJwt = { token, iat: now };
  return token;
}

/** The Live Activity content-state — mirrors BrewAttributes.ContentState (Swift). */
export interface LiveActivityState {
  currentStep: string;
  nextStep: string;
  nextStepEpoch: number;
  stepStartEpoch: number;
  stepIndex: number;
  stepCount: number;
}

export interface ApnsResult {
  ok: boolean;
  status?: number;
  reason?: string;
}

/**
 * Push one Live Activity update (or end) to the activity's push token. Resolves
 * (never throws) with the APNs status. A 410 / "BadDeviceToken" means the token
 * is stale. `event: "update"` advances a step; `event: "end"` tears it down.
 */
export function sendLiveActivityPush(
  pushToken: string,
  state: LiveActivityState | null,
  opts: { event: "update" | "end"; staleEpochSec?: number; dismissalEpochSec?: number } = {
    event: "update",
  },
): Promise<ApnsResult> {
  const env = readEnv();
  if (!env) return Promise.resolve({ ok: false, reason: "apns-not-configured" });

  const jwt = providerToken(env);
  const host = env.production
    ? "https://api.push.apple.com"
    : "https://api.sandbox.push.apple.com";

  const aps: Record<string, unknown> = {
    timestamp: Math.floor(Date.now() / 1000),
    event: opts.event,
  };
  if (state) aps["content-state"] = state;
  if (opts.staleEpochSec) aps["stale-date"] = opts.staleEpochSec;
  if (opts.dismissalEpochSec) aps["dismissal-date"] = opts.dismissalEpochSec;
  const body = JSON.stringify({ aps });

  return new Promise<ApnsResult>((resolve) => {
    let settled = false;
    const done = (r: ApnsResult) => {
      if (!settled) {
        settled = true;
        resolve(r);
      }
    };
    let client: http2.ClientHttp2Session;
    try {
      client = http2.connect(host);
    } catch {
      return done({ ok: false, reason: "connect-throw" });
    }
    client.on("error", () => done({ ok: false, reason: "connect-error" }));
    const timer = setTimeout(() => {
      try {
        client.destroy();
      } catch {
        /* noop */
      }
      done({ ok: false, reason: "timeout" });
    }, 5000);

    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${pushToken}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": LIVE_ACTIVITY_TOPIC,
      "apns-push-type": "liveactivity",
      "apns-priority": "10",
      "content-type": "application/json",
    });
    let status = 0;
    let data = "";
    req.on("response", (h) => {
      status = Number(h[":status"]) || 0;
    });
    req.setEncoding("utf8");
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      clearTimeout(timer);
      client.close();
      done({ ok: status === 200, status, reason: data || undefined });
    });
    req.on("error", () => {
      clearTimeout(timer);
      try {
        client.close();
      } catch {
        /* noop */
      }
      done({ ok: false, reason: "request-error" });
    });
    req.write(body);
    req.end();
  });
}
