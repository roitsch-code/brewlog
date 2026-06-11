// Living-Field gradient tests. Bundles the REAL composeGradient.ts with esbuild
// (recipe-fidelity / brew-notifications pattern) so the asserted behaviour is
// the code the app actually runs — not a re-declared copy.
//
//   node --test tests/dataflow/field-gradient.test.mjs
//
// What's locked down: the "warm but richer" refactor must keep
// composeFieldGradient PURE + deterministic (same coffee → same Field, the
// invariant that makes a coffee's background stable across devices and
// re-opens) and the new fieldBlobColors must hand the motion layer four
// blobs whose alpha stays under the cream-preserving cap.

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
export { composeFieldGradient, fieldBlobColors } from ${JSON.stringify(
  path.join(ROOT, "src/lib/field/composeGradient.ts"),
)};
export { DEFAULT_FIELD_ZONES } from ${JSON.stringify(
  path.join(ROOT, "src/lib/field/defaultZones.ts"),
)};
`;
const dir = await mkdtemp(join(tmpdir(), "field-"));
const out = join(dir, "f.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { composeFieldGradient, fieldBlobColors, DEFAULT_FIELD_ZONES } = await import(
  pathToFileURL(out).href
);

test("composeFieldGradient: 6-layer string, pure + deterministic", () => {
  const a = composeFieldGradient(DEFAULT_FIELD_ZONES, 0);
  const b = composeFieldGradient(DEFAULT_FIELD_ZONES, 0);
  assert.equal(typeof a, "string");
  assert.equal(a, b); // same input → identical output
  assert.equal((a.match(/radial-gradient/g) || []).length, 5);
  assert.equal((a.match(/linear-gradient/g) || []).length, 1);
});

test("composeFieldGradient: rotation changes the output (the per-step shift still works)", () => {
  assert.notEqual(
    composeFieldGradient(DEFAULT_FIELD_ZONES, 0),
    composeFieldGradient(DEFAULT_FIELD_ZONES, 25),
  );
});

test("fieldBlobColors: four blobs, valid hsl, alpha under the cream-preserving cap, pure", () => {
  const blobs = fieldBlobColors(DEFAULT_FIELD_ZONES);
  assert.equal(blobs.length, 4);
  assert.deepEqual(blobs, fieldBlobColors(DEFAULT_FIELD_ZONES)); // deterministic
  for (const b of blobs) {
    assert.match(b.color, /^hsl\(/);
    assert.equal(typeof b.cx, "number");
    assert.equal(typeof b.cy, "number");
    const m = b.color.match(/\/\s*([0-9.]+)\s*\)/); // explicit alpha
    assert.ok(m, `blob colour should carry an alpha: ${b.color}`);
    assert.ok(Number(m[1]) <= 0.6, `alpha ${m?.[1]} should stay ≤ 0.6`);
  }
});

test("fieldBlobColors: empty zones → no blobs (caller falls back to the default Field)", () => {
  const empty = { ...DEFAULT_FIELD_ZONES, zones: [] };
  assert.deepEqual(fieldBlobColors(empty), []);
});
