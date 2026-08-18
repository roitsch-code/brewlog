// Acaia PAIRING handshake test — the regression PR #408 introduced and this
// change fixes.
//
//   node --test tests/dataflow/acaia-handshake.test.mjs
//
// On the iOS "V2" path (the owner's Lunar/Pearl) connecting is a two-step
// handshake: the scale is first identified (encodeId, msgType 11), and only
// AFTER the first inbound notification does the next ident() send the
// encodeNotificationRequest (msgType 12) that makes the scale actually STREAM
// weight. That second packet is sent by the heartbeat monitor's per-tick
// re-ident. PR #408 dropped the per-tick re-ident (kept it only behind a 3 s
// stall, itself gated on already receiving notifications) → the request was
// never sent on connect → the scale paired but no weight ever arrived.
//
// This test drives the REAL AcaiaScale through connect + a first notification
// with a fake transport + fake timers, and asserts the weight-stream request
// goes out promptly — WITHOUT the 3 s stall path. It fails on the #408 monitor
// and passes on the restored one.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const entry = `
export { AcaiaScale } from ${JSON.stringify(path.join(ROOT, "src/lib/native/acaia/acaia.ts"))};
export { SCALE_SERVICE_UUID, SCALE_CHARACTERISTIC_UUID } from ${JSON.stringify(
  path.join(ROOT, "src/lib/native/acaia/constants.ts"),
)};
`;
const dir = await mkdtemp(join(tmpdir(), "acaia-hs-"));
const out = join(dir, "a.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { AcaiaScale, SCALE_SERVICE_UUID, SCALE_CHARACTERISTIC_UUID } = await import(
  pathToFileURL(out).href
);

// The three command packets are distinguishable by their msgType byte (index 2):
// encodeHeartbeat = 0, encodeId = 11 (0x0b), encodeNotificationRequest = 12 (0x0c).
const NOTIFICATION_REQUEST_MSGTYPE = 0x0c;
const ID_MSGTYPE = 0x0b;

function fakeTransport() {
  const writes = [];
  let notify = null;
  const transport = {
    platform: "ios",
    async write(_service, _characteristic, data) {
      writes.push(new Uint8Array(data));
    },
    async startNotifications(_service, _characteristic, callback) {
      notify = callback;
    },
  };
  return {
    transport,
    writes,
    // Deliver an inbound notification frame to the scale (contents irrelevant
    // here — a junk frame the decoder discards is enough to flip the "receiving
    // notifications" flag that gates the second handshake step).
    pushNotification: () => notify?.(new Uint8Array([0x00]).buffer),
  };
}

const CHARS = [{ service: SCALE_SERVICE_UUID, characteristic: SCALE_CHARACTERISTIC_UUID }];

test("connect sends the weight-stream request after the first notification (pairing)", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  const { transport, writes, pushNotification } = fakeTransport();

  const scale = new AcaiaScale("dev-1", CHARS, transport);
  const connectP = scale.connect(() => {});

  // connect() awaits a load-bearing 150 ms sleep before it identifies the scale.
  t.mock.timers.tick(150);
  await connectP;
  await Promise.resolve(); // flush the floating encodeId write

  // Step 1 of the handshake happened: the scale was identified, the stream
  // request has NOT gone out yet (the scale hasn't sent a notification).
  assert.ok(
    writes.some((w) => w[2] === ID_MSGTYPE),
    "encodeId (identify) should be written on connect",
  );
  assert.ok(
    !writes.some((w) => w[2] === NOTIFICATION_REQUEST_MSGTYPE),
    "the weight-stream request must NOT be sent before the scale answers",
  );

  // The scale answers → this flips the flag that gates step 2.
  pushNotification();

  // One monitor tick (1 s) must now re-ident and schedule the request; the
  // request itself is written 100 ms later. Crucially this happens WITHOUT the
  // 3 s stall path — that is the whole point.
  t.mock.timers.tick(1000);
  t.mock.timers.tick(100);
  await Promise.resolve(); // flush the floating request write

  assert.ok(
    writes.some((w) => w[2] === NOTIFICATION_REQUEST_MSGTYPE),
    "the weight-stream request must be sent once the scale is receiving notifications",
  );

  await scale.disconnect();
});
