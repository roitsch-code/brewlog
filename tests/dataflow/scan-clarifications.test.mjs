// Post-scan clarification tests. Bundles the REAL clarifications.ts and asserts
// that questions target only empty fields, answers land on the right field, and
// tasting notes merge (don't replace) + skip answers write nothing.
//
//   node --test tests/dataflow/scan-clarifications.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const entry = `export * from ${JSON.stringify(path.join(ROOT, "src/lib/scan/clarifications.ts"))};`;
const dir = await mkdtemp(join(tmpdir(), "clar-"));
const out = join(dir, "c.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { buildClarifications, applyClarificationAnswer, isFieldEmpty, normalizeProcess } =
  await import(pathToFileURL(out).href);

test("only asks about fields the scan left empty", () => {
  // Full scan → nothing to ask.
  const full = {
    origin: "Ethiopia",
    region: "Guji",
    variety: "Heirloom",
    process: "Washed",
    tastingNotesFromBag: ["Jasmine", "Peach"],
  };
  assert.equal(buildClarifications(full).length, 0);

  // Missing variety + notes → exactly those two, in priority order.
  const partial = { origin: "Ethiopia", region: "Guji", process: "Washed" };
  const qs = buildClarifications(partial);
  assert.deepEqual(qs.map((q) => q.field), ["variety", "tastingNotesFromBag"]);
});

test("never asks region without a country; caps at 2", () => {
  const bare = {}; // nothing extracted
  const qs = buildClarifications(bare);
  assert.equal(qs.length, 2);
  assert.ok(!qs.some((q) => q.field === "region")); // no origin yet → no region Q
});

test("region question carries origin-specific chips", () => {
  const q = buildClarifications({ origin: "Kenya", variety: "SL28", process: "Washed" });
  const region = q.find((x) => x.field === "region");
  assert.ok(region);
  assert.ok(region.chips.includes("Nyeri"));
  assert.match(region.question, /Kenya/);
});

test('"Other" process is treated as empty (worth asking)', () => {
  assert.equal(isFieldEmpty({ process: "Other" }, "process"), true);
  assert.equal(isFieldEmpty({ process: "Washed" }, "process"), false);
});

test("answers land on the right field; process normalizes", () => {
  assert.deepEqual(applyClarificationAnswer("variety", "Pink Bourbon", {}), {
    variety: "Pink Bourbon",
  });
  assert.deepEqual(applyClarificationAnswer("process", "fully washed", {}), {
    process: "Washed",
  });
  assert.equal(normalizeProcess("carbonic maceration 72h"), "Anaerobic");
});

test("tasting notes MERGE with the scan's, deduped, never replace", () => {
  const patch = applyClarificationAnswer(
    "tastingNotesFromBag",
    "Cherry, jasmine, Plum",
    { tastingNotesFromBag: ["Jasmine"] },
  );
  assert.deepEqual(patch.tastingNotesFromBag, ["Jasmine", "Cherry", "Plum"]);
});

test('a "Not sure" answer writes nothing', () => {
  assert.equal(applyClarificationAnswer("variety", "Not sure", {}), null);
  assert.equal(applyClarificationAnswer("tastingNotesFromBag", "skip", {}), null);
});
