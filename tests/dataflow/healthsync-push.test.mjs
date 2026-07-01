// HealthSync caffeine-push payload tests — bundles the REAL
// src/lib/health/healthsyncPush.ts with esbuild so the test tracks the actual
// builder. This is the one-way bridge: BrewLog forwards ONLY caffeine (drink
// volume in ml + timestamp + drink:"coffee"), never other health data.
//
//   node --test tests/dataflow/healthsync-push.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const entry = `export { buildCaffeinePayload } from ${JSON.stringify(
  path.join(ROOT, "src/lib/health/healthsyncPush.ts"),
)};`;

async function load() {
  const dir = await mkdtemp(join(tmpdir(), "healthsync-"));
  const entryFile = join(dir, "entry.ts");
  await writeFile(entryFile, entry);
  const outFile = join(dir, "out.mjs");
  await build({
    entryPoints: [entryFile],
    outfile: outFile,
    bundle: true,
    format: "esm",
    platform: "node",
    logLevel: "silent",
  });
  return import(pathToFileURL(outFile).href);
}

const { buildCaffeinePayload } = await load();

test("coffee with waterGrams → caffeine_ml + ts + drink", () => {
  const p = buildCaffeinePayload({
    type: "coffee",
    createdAt: "2026-07-01T08:30:00.000Z",
    brew: { waterGrams: 250 },
  });
  assert.deepEqual(p, {
    ts: "2026-07-01T08:30:00.000Z",
    drink: "coffee",
    caffeine_ml: 250,
  });
});

test("never forwards mg (BrewLog doesn't measure it)", () => {
  const p = buildCaffeinePayload({
    type: "coffee",
    createdAt: "2026-07-01T08:30:00.000Z",
    brew: { waterGrams: 250 },
  });
  assert.equal("caffeine_mg" in p, false);
});

test("coffee without a water figure → caffeine_ml omitted, still pushes", () => {
  const p = buildCaffeinePayload({
    type: "coffee",
    createdAt: "2026-07-01T08:30:00.000Z",
    brew: undefined,
  });
  assert.deepEqual(p, { ts: "2026-07-01T08:30:00.000Z", drink: "coffee" });
});

test("zero / non-finite water is not sent", () => {
  for (const waterGrams of [0, -10, NaN]) {
    const p = buildCaffeinePayload({
      type: "coffee",
      createdAt: "2026-07-01T08:30:00.000Z",
      brew: { waterGrams },
    });
    assert.equal("caffeine_ml" in p, false, `waterGrams=${waterGrams}`);
  }
});

test("non-coffee (wine) → null, nothing forwarded", () => {
  const p = buildCaffeinePayload({
    type: "wine",
    createdAt: "2026-07-01T20:00:00.000Z",
    brew: { waterGrams: 150 },
  });
  assert.equal(p, null);
});

test("missing createdAt falls back to a valid ISO timestamp", () => {
  const p = buildCaffeinePayload({ type: "coffee", createdAt: "", brew: { waterGrams: 200 } });
  assert.ok(p);
  assert.ok(!Number.isNaN(Date.parse(p.ts)));
  assert.equal(p.drink, "coffee");
});
