// Live Activity push tests (iOS shell G3 push backend). Bundles the REAL
// liveActivity.ts (schedule math) + liveActivityPush.ts (APNs auth) with
// esbuild so the asserted behaviour is what the server/app actually run.
//
//   node --test tests/dataflow/live-activity-push.test.mjs
//
// What's locked down: (1) brewActivityState emits epoch SECONDS that match the
// Swift ContentState fields, with the right current/next step at each elapsed;
// (2) buildBrewSchedule produces one push per boundary at its absolute fire
// time; (3) the APNs provider JWT is a well-formed ES256 token (header.kid,
// payload.iss/iat) — a regression here would silently break every push.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const entry = `
export { brewActivityState, buildBrewSchedule } from ${JSON.stringify(
  path.join(ROOT, "src/lib/native/liveActivity.ts"),
)};
export { signProviderJwt } from ${JSON.stringify(
  path.join(ROOT, "src/lib/native/liveActivityPush.ts"),
)};
`;
const dir = await mkdtemp(join(tmpdir(), "la-push-"));
const out = join(dir, "b.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { brewActivityState, buildBrewSchedule, signProviderJwt } = await import(
  pathToFileURL(out).href
);

// A small brew: bloom(0) implicit, then two pours.
const boundaries = [
  { atSec: 45, label: "Pour 2", cumulativeGrams: 180 },
  { atSec: 90, label: "Pour 3", cumulativeGrams: 270 },
];
const START_MS = 1_700_000_000_000; // fixed epoch ms
const TARGET = 150;

test("brewActivityState: before the first boundary → Bloom now, Pour 2 next", () => {
  const s = brewActivityState(boundaries, 10, START_MS, TARGET);
  assert.equal(s.currentStep, "Bloom");
  assert.equal(s.nextStep, "Pour 2");
  // epoch SECONDS, matching the Swift ContentState Double fields
  assert.equal(s.stepStartEpoch, START_MS / 1000 + 0);
  assert.equal(s.nextStepEpoch, START_MS / 1000 + 45);
  assert.equal(s.stepCount, 2);
});

test("brewActivityState: at a boundary → that step is NOW (with total g)", () => {
  const s = brewActivityState(boundaries, 45, START_MS, TARGET);
  assert.equal(s.currentStep, "Pour 2 → 180g"); // formatNowStep uses the arrow + total
  assert.equal(s.nextStep, "Pour 3"); // formatNextStep is the bare name
  assert.equal(s.stepStartEpoch, START_MS / 1000 + 45);
  assert.equal(s.nextStepEpoch, START_MS / 1000 + 90);
});

test("brewActivityState: after the last boundary → Drawdown next at target", () => {
  const s = brewActivityState(boundaries, 90, START_MS, TARGET);
  assert.equal(s.currentStep, "Pour 3 → 270g");
  assert.equal(s.nextStep, "Drawdown");
  assert.equal(s.nextStepEpoch, START_MS / 1000 + TARGET);
});

test("buildBrewSchedule: one push per boundary at its absolute fire time", () => {
  const sched = buildBrewSchedule(boundaries, START_MS, TARGET);
  assert.equal(sched.length, 2);
  assert.equal(sched[0].fireEpochMs, START_MS + 45 * 1000);
  assert.equal(sched[1].fireEpochMs, START_MS + 90 * 1000);
  assert.equal(sched[0].state.currentStep, "Pour 2 → 180g");
  assert.equal(sched[1].state.nextStep, "Drawdown");
});

test("signProviderJwt: well-formed ES256 token with kid/iss/iat", () => {
  // Throwaway P-256 key in PEM — just to exercise the signer.
  const { privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" });
  const jwt = signProviderJwt(pem, "KEYID12345", "TEAMID6789", 1_700_000_000);
  const [h, p, sig] = jwt.split(".");
  assert.ok(h && p && sig, "three dot-separated segments");
  const header = JSON.parse(Buffer.from(h, "base64url").toString());
  const payload = JSON.parse(Buffer.from(p, "base64url").toString());
  assert.equal(header.alg, "ES256");
  assert.equal(header.kid, "KEYID12345");
  assert.equal(payload.iss, "TEAMID6789");
  assert.equal(payload.iat, 1_700_000_000);
  // ieee-p1363 ES256 signature is 64 bytes.
  assert.equal(Buffer.from(sig, "base64url").length, 64);
});
