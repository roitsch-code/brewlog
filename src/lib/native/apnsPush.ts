/**
 * APNs push sender (server-only) — wakes the Apple Watch app with a buzz at a
 * brew step, even when the watch app is CLOSED. This is the path that gets the
 * wrist cue synced to the phone without the user opening the watch app: the
 * phone fires a step → it POSTs here → APNs delivers an alert to the watch's
 * push token → the watch buzzes.
 *
 * Auth is a JWT (ES256) signed with an APNs `.p8` key, sent over HTTP/2 to
 * Apple. Everything is gated on env config (`apnsConfigured()`) — with no key
 * set, the senders no-op cleanly, so this is harmless until the owner adds the
 * APNs secrets on the VPS.
 *
 * Required env (set on the VPS):
 *   APNS_KEY_P8     the .p8 key contents (PEM, "\n" escapes tolerated)
 *   APNS_KEY_ID     the APNs key id (Apple Developer → Keys)
 *   APNS_TEAM_ID    the Developer Program team id (same as APPLE_TEAM_ID)
 *   APNS_BUNDLE_ID  the WATCH app bundle id (apns-topic), e.g. com.roitsch.btts.watchkitapp
 *   APNS_PRODUCTION "false" only for a dev build; TestFlight uses production (default)
 */
import http2 from "node:http2";
import crypto from "node:crypto";

interface ApnsEnv {
  keyP8: string;
  keyId: string;
  teamId: string;
  bundleId: string;
  production: boolean;
}

function readEnv(): ApnsEnv | null {
  const keyP8 = process.env.APNS_KEY_P8;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const bundleId = process.env.APNS_BUNDLE_ID;
  if (!keyP8 || !keyId || !teamId || !bundleId) return null;
  return {
    keyP8: keyP8.includes("\\n") ? keyP8.replace(/\\n/g, "\n") : keyP8,
    keyId,
    teamId,
    bundleId,
    production: process.env.APNS_PRODUCTION !== "false",
  };
}

/** True when the APNs secrets are present, so the push path is live. */
export function apnsConfigured(): boolean {
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

export interface ApnsResult {
  ok: boolean;
  status?: number;
  reason?: string;
}

/**
 * Send a single alert push to a watch push token. Resolves (never throws) with
 * the APNs status. A 410 / "BadDeviceToken" means the token is stale and should
 * be cleared by the caller.
 */
export function sendWatchPush(
  deviceToken: string,
  alert: { title: string; body: string },
): Promise<ApnsResult> {
  const env = readEnv();
  if (!env) return Promise.resolve({ ok: false, reason: "apns-not-configured" });

  const jwt = providerToken(env);
  const host = env.production
    ? "https://api.push.apple.com"
    : "https://api.sandbox.push.apple.com";
  const body = JSON.stringify({
    aps: {
      alert,
      sound: "default",
      "interruption-level": "time-sensitive",
    },
  });

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
    // Safety timeout so a hung connection never stalls the request handler.
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
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": env.bundleId,
      "apns-push-type": "alert",
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
