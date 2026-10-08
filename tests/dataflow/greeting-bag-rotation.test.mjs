// Greeting bag rotation. Bundles the REAL pickGreetingBag() and pins that the
// welcome line's bag rotates across the starred bags instead of naming the same
// one forever (the Oct 2026 "always Vanilla Gorilla" report), skips the bag
// brewed last when there is a choice, and that the ROUTE actually uses it.
//
//   node --test tests/dataflow/greeting-bag-rotation.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const entry = `export { pickGreetingBag } from ${JSON.stringify(
  path.join(ROOT, "src/lib/greeting/pickBag.ts"),
)};`;
const dir = await mkdtemp(join(tmpdir(), "greetbag-"));
const out = join(dir, "g.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { pickGreetingBag } = await import(pathToFileURL(out).href);

const rotation = [
  { roaster: "Friedhats", name: "Vanilla Gorilla" },
  { roaster: "DAK", name: "Berry Swirl" },
  { roaster: "Friedhats", name: "Quiquira" },
  { roaster: "La Cabra", name: "Terra" },
];
const slots = ["morning", "midday", "afternoon", "evening", "late-night"];

test("empty rotation → no bag", () => {
  assert.equal(pickGreetingBag([], null, "2026-10-08|morning"), null);
});

test("one starred bag is always that bag, even if it was brewed last", () => {
  const only = [rotation[0]];
  assert.equal(pickGreetingBag(only, rotation[0], "x").name, "Vanilla Gorilla");
});

test("several starred bags: a week of slots names more than one bag", () => {
  const named = new Set();
  for (let d = 1; d <= 7; d++) {
    for (const s of slots) {
      named.add(pickGreetingBag(rotation, null, `2026-10-0${d}|${s}`).name);
    }
  }
  assert.ok(named.size >= 3, `only ${[...named].join(", ")} across 35 slots`);
});

test("the bag brewed last is skipped when there is a choice", () => {
  for (let d = 1; d <= 9; d++) {
    for (const s of slots) {
      const pick = pickGreetingBag(rotation, { roaster: "friedhats ", name: "VANILLA gorilla" }, `2026-10-0${d}|${s}`);
      assert.notEqual(pick.name, "Vanilla Gorilla");
    }
  }
});

test("stable within a slot and independent of query order", () => {
  const a = pickGreetingBag(rotation, null, "2026-10-08|morning");
  const b = pickGreetingBag([...rotation].reverse(), null, "2026-10-08|morning");
  assert.equal(a.name, b.name);
});

test("the greeting route picks the bag in code and narrows the contrast to it", async () => {
  const src = await readFile(join(ROOT, "src/app/api/greeting/route.ts"), "utf8");
  assert.match(src, /import \{ pickGreetingBag \} from "@\/lib\/greeting\/pickBag"/);
  assert.match(src, /pickGreetingBag\(library, lastBrewed,/);
  assert.match(src, /TODAY'S BAG \(name this one\)/);
  assert.match(src, /formatContextFindingsForGreeting\(buildContextInsights\(corpus\)\.insights, \[todaysBag\]\)/);
});
