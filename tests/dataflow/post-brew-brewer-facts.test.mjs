// 2026-10-27: the post-brew insight called the Orea Apex "an immersion brewer".
// The Haiku prompt carried only the bare name "Orea Apex" — nothing said what
// the brewer is — and the background mentioned his Clever ratings. Both
// post-brew prompts (brew-insight, coach-question) now carry the brewer's style
// and role from knowledge/brewers.ts. This test pins the line and its delivery.
//
//   node --test tests/dataflow/post-brew-brewer-facts.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const entry = `export { formatMethodForPrompt, brewerRoleForMethod } from ${JSON.stringify(path.join(ROOT, "src/lib/knowledge/brewers.ts"))};`;
const dir = await mkdtemp(join(tmpdir(), "pbf-"));
const out = join(dir, "m.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
  alias: { "@": path.join(ROOT, "src") },
});
const M = await import(pathToFileURL(out).href);

test("every Orea bottom reaches the prompt as percolation, under its own bottom", () => {
  for (const [method, key] of [
    ["Orea Apex", "orea-apex"],
    ["Orea Classic", "orea-classic"],
    ["Orea V4 Fast", "orea-fast"],
    ["Orea Open", "orea-open"],
    ["Orea Classic + Drip Assist", "orea-classic"],
  ]) {
    const line = M.formatMethodForPrompt(method);
    assert.equal(M.brewerRoleForMethod(method)?.key, key, method);
    assert.match(line, /^Orea .*\(percolation — /, line);
    assert.doesNotMatch(line, /immersion/, line);
  }
});

test("immersion brewers say immersion; cones and flat beds say percolation", () => {
  assert.match(M.formatMethodForPrompt("Clever Dripper"), /\(immersion — /);
  assert.match(M.formatMethodForPrompt("AeroPress"), /\(immersion — /);
  for (const m of ["V60", "V60 + Drip Assist", "Kalita Wave", "Origami (cone)", "Origami (wave)", "Origami Air M", "Chemex"]) {
    assert.match(M.formatMethodForPrompt(m), /\(percolation — /, m);
  }
});

test("an unknown brewer passes through by name; no method stays 'unknown'", () => {
  assert.equal(M.formatMethodForPrompt("Siphon"), "Siphon");
  assert.equal(M.formatMethodForPrompt(undefined), "unknown");
});

test("both post-brew prompts deliver the line, not the bare name", async () => {
  const insight = await readFile(path.join(ROOT, "src/app/api/brew-insight/route.ts"), "utf8");
  assert.match(insight, /- Method: \$\{formatMethodForPrompt\(brewedMethod\)\}/);
  assert.match(insight, /never call a percolation brewer immersion/);
  const question = await readFile(path.join(ROOT, "src/app/api/coach-question/route.ts"), "utf8");
  assert.match(question, /Method: \$\{formatMethodForPrompt\(context\.methodUsed\)\}/);
});
