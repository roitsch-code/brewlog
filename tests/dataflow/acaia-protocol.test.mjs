// Acaia protocol-port tests. Bundles the REAL ported decoder.ts + acaia.ts with
// esbuild and asserts the reverse-engineered byte math is intact — so a future
// edit that "tidies" a shift or checksum is caught here, not on the scale.
//
//   node --test tests/dataflow/acaia-protocol.test.mjs
//
// Locked down: a WEIGHT notification frame decodes to the right grams (unit
// divisor + sign bit), the command encoders emit the right magic header +
// split checksum, and the decoder reassembles a frame split across two BLE
// notifications (the streaming case).

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
export { Decoder } from ${JSON.stringify(path.join(ROOT, "src/lib/native/acaia/decoder.ts"))};
export { encode } from ${JSON.stringify(path.join(ROOT, "src/lib/native/acaia/acaia.ts"))};
export { MAGIC1, MAGIC2 } from ${JSON.stringify(path.join(ROOT, "src/lib/native/acaia/constants.ts"))};
`;
const dir = await mkdtemp(join(tmpdir(), "acaia-"));
const out = join(dir, "a.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { Decoder, encode, MAGIC1, MAGIC2 } = await import(pathToFileURL(out).href);

const bytes = (arr) => new Uint8Array(arr).buffer;

// Build a WEIGHT event frame (cmd 12, msgType 5) carrying a 6-byte weight
// payload [lo, hi, _, _, unitDivisor, signFlags].
function weightFrame(payload) {
  const len = payload.length; // length byte = payload size (messageEnd = start + len + 5)
  return [MAGIC1, MAGIC2, 0x0c, len, 0x05, ...payload];
}

test("decodes a positive weight (unit divisor 1 → tenths of a gram)", () => {
  // 185 / 10 = 18.5 g.  185 = 0x00B9 → lo=0xB9 hi=0x00, unit=1, sign=0.
  const frame = weightFrame([0xb9, 0x00, 0x00, 0x00, 0x01, 0x00]);
  const result = new Decoder().process(bytes(frame));
  assert.ok(result, "expected a decode result");
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].weight, 18.5);
});

test("decodes a negative weight (sign bit set)", () => {
  // sign flag bit 2 set → negate.  120/10 = 12.0 → -12.0
  const frame = weightFrame([0x78, 0x00, 0x00, 0x00, 0x01, 0x02]);
  const result = new Decoder().process(bytes(frame));
  assert.equal(result.data[0].weight, -12.0);
});

test("decodes a hundredths-gram weight (unit divisor 2)", () => {
  // 1234 / 100 = 12.34 g. 1234 = 0x04D2 → lo=0xD2 hi=0x04, unit=2.
  const frame = weightFrame([0xd2, 0x04, 0x00, 0x00, 0x02, 0x00]);
  const result = new Decoder().process(bytes(frame));
  assert.equal(result.data[0].weight, 12.34);
});

test("encode() emits the magic header + split (even/odd) checksum", () => {
  // encodeHeartbeat is encode(0, [2, 0]).
  const buf = new Uint8Array(encode(0, [2, 0]));
  // [MAGIC1, MAGIC2, msgType=0, 2, 0, cksum1, cksum2]
  // cksum1 = sum of even-index payload bytes = 2; cksum2 = odd-index = 0.
  assert.deepEqual([...buf], [MAGIC1, MAGIC2, 0x00, 0x02, 0x00, 0x02, 0x00]);
});

test("encode() checksum sums even and odd payload indices separately", () => {
  // payload [10, 1, 4] → cksum1 = 10+4 = 14, cksum2 = 1.
  const buf = new Uint8Array(encode(4, [10, 1, 4]));
  assert.deepEqual([...buf], [MAGIC1, MAGIC2, 0x04, 10, 1, 4, 14, 1]);
});

test("reassembles a frame split across two notifications (streaming)", () => {
  const frame = weightFrame([0xb9, 0x00, 0x00, 0x00, 0x01, 0x00]);
  const dec = new Decoder();
  // First half: incomplete → no message yet.
  assert.equal(dec.process(bytes(frame.slice(0, 4))), null);
  // Second half completes the frame → weight emerges.
  const result = dec.process(bytes(frame.slice(4)));
  assert.ok(result);
  assert.equal(result.data[0].weight, 18.5);
});

test("ignores leading junk bytes before the magic header", () => {
  const frame = weightFrame([0xb9, 0x00, 0x00, 0x00, 0x01, 0x00]);
  const result = new Decoder().process(bytes([0x00, 0xaa, 0xff, ...frame]));
  assert.ok(result);
  assert.equal(result.data[0].weight, 18.5);
});
