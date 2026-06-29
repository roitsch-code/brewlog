// Living-Field gradient tests. Bundles the REAL composeGradient.ts with esbuild
// (recipe-fidelity / brew-notifications pattern) so the asserted behaviour is
// the code the app actually runs — not a re-declared copy.
//
//   node --test tests/dataflow/field-gradient.test.mjs
//
// What's locked down: the Field refactor must keep composeFieldGradient PURE +
// deterministic (same coffee → same Field, the invariant that makes a coffee's
// background stable across devices and re-opens) and fieldBlobColors must hand
// the motion layer four blobs that each carry an explicit, in-range alpha. The
// alpha ceiling tracks the BLOB_ALPHA dial — the old "≤0.7 keep-cream" cap was
// deliberately relaxed for the Big-Sur punch (owner-requested).

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
export { CURATED_FIELDS } from ${JSON.stringify(
  path.join(ROOT, "src/lib/field/curatedFields.ts"),
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
const { composeFieldGradient, fieldBlobColors, DEFAULT_FIELD_ZONES, CURATED_FIELDS } = await import(
  pathToFileURL(out).href
);

test("composeFieldGradient: directional string (1 linear base + 3 radials), pure + deterministic", () => {
  const a = composeFieldGradient(DEFAULT_FIELD_ZONES, 0);
  const b = composeFieldGradient(DEFAULT_FIELD_ZONES, 0);
  assert.equal(typeof a, "string");
  assert.equal(a, b); // same input → identical output
  // Round-2 directional rework: a diagonal linear base + two corner masses + a
  // pale light-ribbon (was 5 scattered radial hotspots).
  assert.equal((a.match(/radial-gradient/g) || []).length, 3);
  assert.equal((a.match(/linear-gradient/g) || []).length, 1);
});

test("composeFieldGradient: rotation changes the output (the per-step shift still works)", () => {
  assert.notEqual(
    composeFieldGradient(DEFAULT_FIELD_ZONES, 0),
    composeFieldGradient(DEFAULT_FIELD_ZONES, 25),
  );
});

test("fieldBlobColors: four blobs, valid hsl, explicit in-range alpha, pure", () => {
  const blobs = fieldBlobColors(DEFAULT_FIELD_ZONES);
  assert.equal(blobs.length, 4);
  assert.deepEqual(blobs, fieldBlobColors(DEFAULT_FIELD_ZONES)); // deterministic
  for (const b of blobs) {
    assert.match(b.color, /^hsl\(/);
    assert.equal(typeof b.cx, "number");
    assert.equal(typeof b.cy, "number");
    const m = b.color.match(/\/\s*([0-9.]+)\s*\)/); // explicit alpha
    assert.ok(m, `blob colour should carry an alpha: ${b.color}`);
    // Blobs stay translucent (< 1) so the base + grain still read through, but
    // the old 0.7 cream-cap was relaxed for the Big-Sur punch.
    assert.ok(Number(m[1]) > 0 && Number(m[1]) < 1, `alpha ${m?.[1]} should be in (0, 1)`);
  }
});

test("cool-berry renders a real BLUE hue (berries are blue, not purple)", () => {
  const blue = {
    version: 1,
    zones: [{ id: "cool-berry", weight: 1 }],
    modifiers: { saturation: 0, lightness: 0 },
    source: "tasting-notes",
    computedAt: "1970-01-01T00:00:00.000Z",
  };
  const css = composeFieldGradient(blue, 0);
  // Every colour stop should sit in the blue 210–244° band (+ small hue offsets
  // some layers/blobs add) — proves berries read blue, not the old purple 250+.
  const hues = [...css.matchAll(/hsl\((\d+)\s/g)].map((m) => Number(m[1]));
  assert.ok(hues.length > 0, "expected hsl() stops in the gradient");
  for (const h of hues) {
    assert.ok(h >= 206 && h <= 246, `hue ${h}° should be blue (cool-berry)`);
  }
  // And its blobs carry the same blue hue.
  for (const b of fieldBlobColors(blue)) {
    const h = Number(b.color.match(/hsl\((\d+)\s/)[1]);
    assert.ok(h >= 206 && h <= 246, `blob hue ${h}° should be blue`);
  }
});

test("CURATED_FIELDS: each is a valid 2–3-zone combo that composes deterministically", () => {
  assert.ok(CURATED_FIELDS.length >= 4, "expected several curated combos");
  for (const f of CURATED_FIELDS) {
    assert.ok(f.zones.length >= 2 && f.zones.length <= 3, "2–3 zones (elegant, not all-colours)");
    const sum = f.zones.reduce((a, z) => a + z.weight, 0);
    assert.ok(Math.abs(sum - 1) < 0.001, `weights sum to 1 (got ${sum})`);
    const css = composeFieldGradient(f, 0);
    assert.equal(typeof css, "string");
    assert.equal(css, composeFieldGradient(f, 0)); // deterministic
    assert.equal((css.match(/radial-gradient/g) || []).length, 3);
    assert.equal((css.match(/linear-gradient/g) || []).length, 1);
  }
});

test("fieldBlobColors: empty zones → no blobs (caller falls back to the default Field)", () => {
  const empty = { ...DEFAULT_FIELD_ZONES, zones: [] };
  assert.deepEqual(fieldBlobColors(empty), []);
});
