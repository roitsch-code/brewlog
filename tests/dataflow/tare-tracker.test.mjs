// Tare-tracker tests. Bundles the REAL tareTracker.ts and locks that "water
// poured" is zeroed at start and immune to vessel handling (placing the carafe,
// lifting the dripper to swirl, taring) while still counting gradual pours.
//
//   node --test tests/dataflow/tare-tracker.test.mjs

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
export { createTareState, netWaterPoured, MAX_POUR_RATE_GPS, MIN_STEP_G }
  from ${JSON.stringify(path.join(ROOT, "src/lib/brew/tareTracker.ts"))};
`;
const dir = await mkdtemp(join(tmpdir(), "tare-"));
const out = join(dir, "t.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { createTareState, netWaterPoured } = await import(pathToFileURL(out).href);

/** Feed a [grams, atMs] sequence, return the net after each reading. */
function run(seq) {
  const st = createTareState();
  return seq.map(([g, ms]) => netWaterPoured(st, g, ms));
}

test("first reading seeds the baseline → net 0 (zero at start)", () => {
  const st = createTareState();
  assert.equal(netWaterPoured(st, 412, 0), 0); // full vessel already on the scale
});

test("a gradual pour is counted as water", () => {
  // Vessel 400 g, then pour ~4 g every 200 ms (20 g/s) up to +60 g.
  const seq = [[400, 0]];
  for (let i = 1; i <= 15; i++) seq.push([400 + i * 4, i * 200]);
  const net = run(seq);
  assert.equal(net[0], 0);
  assert.equal(net[net.length - 1], 60); // all 60 g of water counted
});

test("placing the carafe AFTER start is absorbed, not read as water", () => {
  // Start with a light dripper only (150 g), then drop the carafe on (+250 g in
  // one 100 ms sample = 2500 g/s), then pour 40 g gradually.
  const seq = [[150, 0], [400, 100]];
  for (let i = 1; i <= 10; i++) seq.push([400 + i * 4, 100 + i * 200]);
  const net = run(seq);
  assert.equal(net[0], 0);
  assert.equal(net[1], 0); // the +250 g carafe is NOT water
  assert.equal(net[net.length - 1], 40); // only the 40 g pour counts
});

test("lifting the dripper to swirl and putting it back nets out", () => {
  // Vessel+water at 480, lift the dripper (−180 in 200 ms), swirl, put it back.
  const seq = [
    [480, 0],
    [300, 200], // lifted
    [300, 900], // swirling
    [480, 1100], // back on
    [480, 1300],
  ];
  const net = run(seq);
  assert.equal(net[0], 0);
  assert.equal(net[1], 0); // the lift is absorbed
  assert.equal(net[3], 0); // …and so is putting it back — continuous, no phantom pour
});

test("taring the physical scale mid-brew keeps net continuous", () => {
  // 430 on the scale, user taps Tare → raw drops to 0 (a −430 step), keeps pouring.
  const seq = [[430, 0], [0, 150], [10, 350], [20, 550]];
  const net = run(seq);
  assert.equal(net[0], 0);
  assert.equal(net[1], 0); // the tare is absorbed
  assert.equal(net[3], 20); // subsequent pouring still counts from where it was
});

test("a slow reconnect gap during a real pour is NOT mistaken for handling", () => {
  // BLE stalls 2 s while the user pours 30 g (15 g/s) — big step, but a pour rate.
  const seq = [[400, 0], [430, 2000]];
  const net = run(seq);
  assert.equal(net[1], 30); // counted as water, not absorbed
});
