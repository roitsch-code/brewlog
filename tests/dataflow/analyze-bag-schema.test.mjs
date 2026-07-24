// Regression guard for the scan-data-export bug (PR #498 → this fix).
//
// The blend feature added `components` to the bag-analysis schema but as a
// plain `.optional()`, while the prompt tells the model to return
// `"components": null` for a SINGLE-ORIGIN bag. `.optional()` rejects null, so
// parseClaudeJson failed on every single-origin scan → the whole extraction
// came back empty and the app "couldn't pull any data".
//
// This bundles the REAL BagAnalysisSchema + the REAL parseClaudeJson and proves
// a normal single-origin model response (with components:null) parses and keeps
// its fields. If someone drops the `.nullable()` again, this goes red.
//
//   node --test tests/dataflow/analyze-bag-schema.test.mjs

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
export { BagAnalysisSchema } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/analyzeBag.ts"))};
export { parseClaudeJson } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/parseJson.ts"))};
`;
const dir = await mkdtemp(join(tmpdir(), "analyzebag-"));
const out = join(dir, "b.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { BagAnalysisSchema, parseClaudeJson } = await import(pathToFileURL(out).href);

// Exactly what the model returns for a normal single-origin bag: the prompt
// instructs "For a SINGLE-ORIGIN coffee, set components to null".
const singleOrigin = JSON.stringify({
  extracted: {
    roaster: "HIGHER.",
    name: "Rwanda - Gakenke",
    origin: "Rwanda",
    region: "Gakenke",
    process: "Natural",
    roastLevel: "Medium",
    cuppingScore: 87,
    tastingNotesFromBag: ["Currant", "Cacao Nib", "Red Apple"],
    components: null,
  },
  confidence: { roaster: "bag" },
  clarifications: [],
  isCoffeeBag: true,
});

test("single-origin bag with components:null parses (does not fall back to empty)", () => {
  const parsed = parseClaudeJson(singleOrigin, BagAnalysisSchema);
  assert.ok(parsed, "parseClaudeJson must NOT return null for a single-origin bag");
  assert.equal(parsed.extracted.roaster, "HIGHER.");
  assert.equal(parsed.extracted.name, "Rwanda - Gakenke");
  assert.equal(parsed.extracted.origin, "Rwanda");
});

test("a real blend (2+ components) still parses", () => {
  const blend = JSON.stringify({
    extracted: {
      roaster: "La Cabra",
      name: "Terra",
      origin: "Brazil, Ethiopia",
      process: "Natural",
      components: [
        { origin: "Brazil", process: "Natural" },
        { origin: "Ethiopia", process: "Natural" },
      ],
    },
    isCoffeeBag: true,
  });
  const parsed = parseClaudeJson(blend, BagAnalysisSchema);
  assert.ok(parsed, "a blend must parse");
  assert.equal(parsed.extracted.components.length, 2);
});
