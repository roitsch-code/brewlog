// Candidate-level repetition guard — "Hoffmann Water-First Clever every other
// brew" (2026-10-03). The anchor is the REAL production sequence pulled by
// recommend-logs.yml: Beshasha, 3 brews in a row, each with an "Own
// experiment" Clever Dripper written as water-first immersion, while every
// menu-level rotation lever was green.
//
// Asserts the guard (1) catches that exact candidate, (2) leaves menu recipes
// and own references alone even on a crowded brewer, (3) does nothing on a
// fresh brewer, and (4) is actually wired into recommend.ts — a producer-only
// test is what let #530/#535 ship unwired.
//
//   node --test tests/dataflow/repeat-guard.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "repeatguard-"));
const out = join(dir, "b.mjs");
await build({
  stdin: {
    contents: `export * from ${JSON.stringify(path.join(ROOT, "src/lib/claude/repeatGuard.ts"))};`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const G = await import(pathToFileURL(out).href);

const rec = (...methods) => ({ recommendation: { candidates: methods.map((method) => ({ method })) } });

// Newest first — the four recommendations before the 10-03 10:56 Beshasha brew.
const HISTORY = [
  rec("Orea Open", "Orea Open"), // 10-03 10:27 Vanilla Gorilla (locked)
  rec("V60", "Origami (wave)"), // 10-02 08:56
  rec("V60", "Clever Dripper"), // 10-01 08:07 Beshasha — Own experiment Clever
  rec("Origami (wave)", "Clever Dripper"), // 09-30 09:44 Beshasha — Own experiment Clever
  rec("Clever Dripper", "Orea Classic"), // older — outside the window
];

const MENU = [
  "Gagné — V60 Trench + Rao-Spin",
  "Hoffmann Ultimate Clever",
  "The Techno — Orea Wide Open",
];

test("counts each brewer family once per recommendation, last 4 only", () => {
  const offered = G.recentlyOfferedFamilies(HISTORY);
  assert.equal(offered.get("clever"), 2);
  assert.equal(offered.get("v60"), 2);
  assert.equal(offered.get("orea"), 1, "the locked Orea Open pair counts once, the older Orea is outside the window");
});

test("catches the real 10-03 'Own experiment' water-first Clever", () => {
  const offered = G.recentlyOfferedFamilies(HISTORY);
  const offenders = G.findRepeatOffenders(
    [
      { method: "Clever Dripper", basedOn: "Own experiment", title: "Water-First Clever Immersion" },
      { method: "V60", basedOn: "Gagné — V60 Trench + Rao-Spin — Jonathan Gagné", title: "Gagné Trench + Rao-Spin" },
    ],
    MENU,
    offered,
  );
  assert.equal(offenders.length, 1);
  assert.equal(offenders[0].index, 0);
  assert.equal(offenders[0].family, "clever");
  const repair = G.formatRepeatRepair(offenders, offered);
  assert.match(repair, /Water-First Clever Immersion/);
  assert.match(repair, /clever/);
  assert.match(repair, /keep any other candidate exactly/);
});

test("a menu recipe on a crowded brewer is NOT touched — best fit still decides", () => {
  const offered = G.recentlyOfferedFamilies(HISTORY);
  const offenders = G.findRepeatOffenders(
    [
      { method: "Clever Dripper", basedOn: "Hoffmann Ultimate Clever", title: "Ultimate" },
      { method: "V60", basedOn: "Your V60 — Beshasha (1 Oct 2026)", title: "Own ref" },
    ],
    MENU,
    offered,
  );
  assert.deepEqual(offenders, []);
});

test("unsourced names and missing basedOn count as free-form", () => {
  const offered = G.recentlyOfferedFamilies(HISTORY);
  const offenders = G.findRepeatOffenders(
    [
      { method: "Clever Dripper", basedOn: "Hoffmann Water-First Clever", title: "WF" },
      { method: "V60", title: "No basedOn" },
    ],
    MENU,
    offered,
  );
  assert.deepEqual(offenders.map((o) => o.index), [0, 1]);
});

test("a free-form experiment on a fresh brewer passes", () => {
  const offered = G.recentlyOfferedFamilies(HISTORY);
  const offenders = G.findRepeatOffenders(
    [{ method: "Kalita Wave", basedOn: "Own experiment", title: "Sieved Kalita" }],
    MENU,
    offered,
  );
  assert.deepEqual(offenders, []);
});

test("the rule is stated up front, named by crowded family; empty when nothing is crowded", () => {
  const offered = G.recentlyOfferedFamilies(HISTORY);
  const note = G.formatRepeatRuleUpfront(offered);
  assert.match(note, /clever \(\d of the last 4\)/);
  assert.match(note, /RELEVANT REFERENCE RECIPES/);
  assert.doesNotMatch(note, /REFERENCE RECIPE LIBRARY/);
  assert.equal(G.formatRepeatRuleUpfront(new Map()), "");
  assert.equal(G.formatRepeatRuleUpfront(new Map([["kalita", 1]])), "", "below the threshold is not crowded");
});

test("recommend.ts states the rule up front, runs the guard on the FIRST answer and merges its repair with the convergence repair into ONE second call", async () => {
  const src = await readFile(path.join(ROOT, "src/lib/claude/recommend.ts"), "utf8");
  assert.match(src, /from "\.\/repeatGuard"/);
  assert.match(src, /\$\{repeatRuleNote\}/, "the up-front rule must be interpolated into the user message");
  assert.match(src, /const repeatRuleNote = repeatGuardActive \? formatRepeatRuleUpfront\(offered\) : ""/);
  assert.match(src, /findRepeatOffenders\(raw\.candidates, menuNames, offered\)/);
  assert.match(src, /repairs\.push\(formatRepeatRepair\(offenders, offered\)\)/);
  assert.match(src, /callRecommendModel\(\s*userMessage \+ repairs\.join\(/, "one merged repair call");
  assert.doesNotMatch(src, /callRecommendModel\(\s*userMessage \+ formatRepeatRepair/, "no standalone repeat-repair call");
  assert.match(src, /raw = repaired;/);
  // first call + exactly one merged repair call — never a third generation.
  assert.equal((src.match(/await callRecommendModel\(/g) ?? []).length, 2);
});
