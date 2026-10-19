// The Gota import's pure parts (scripts/gota-import.mjs, 2026-10-19): the
// page parser on a saved fixture, the filters the owner asked for ("Ja,
// gefiltert"), and the entry mapping that keeps the published clock and
// drops Gota's own pour seconds.
//
//   node --test tests/dataflow/gota-import.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const G = await import(pathToFileURL(path.join(ROOT, "scripts/gota-import.mjs")).href);
const html = await readFile(path.join(ROOT, "tests/fixtures/gota-orea-v4-wide-std.html"), "utf8");
const URL = "https://gota.cafe/en/recipes/orea-v4-wide/orea-v4-wide-std";
const page = () => G.parseGotaPage(html, URL);

test("parser: the fixture page gives dose, water, temperature, total, author, originator and the step clock — Gota's pour seconds are not in the result", () => {
  const p = page();
  assert.equal(p.name, "Standard");
  assert.equal(p.category, "Orea V4 Wide");
  assert.equal(p.author, "Orea");
  assert.deepEqual([p.dose, p.water, p.tempC, p.totalSec], [20, 320, 96, 200]);
  assert.equal(p.grindWord, "medium");
  assert.deepEqual(p.originator, { by: "Orea", url: "https://www.orea.uk/pages/brew-guides", host: "orea.uk" });
  assert.deepEqual(
    p.steps.map((s) => [s.label, s.startSec, s.windowSec, s.cumGrams]),
    [["Bloom", 0, 40, 60], ["Pour", 40, 40, 180], ["Pour", 80, 26, 320], ["Swirl", 106, 94, null], ["Done", 200, null, null]],
  );
  assert.ok(!JSON.stringify(p).includes("g/s"), "Gota's rate chips never enter");
  assert.equal(p.steps[0].tempC, 96, "the first step's chip temperature equals the base");
});

test("mapping: category → his brewer; Origami needs the filter named in the text; foreign drippers are null", () => {
  assert.equal(G.mapCategory({ category: "V60 02", steps: [] }).brewer, "v60");
  assert.equal(G.mapCategory({ category: "Chemex 6 Cup", steps: [] }).brewer, "chemex");
  assert.equal(G.mapCategory({ category: "NextLevel Pulsar", steps: [] }), null);
  assert.equal(G.mapCategory({ category: "Origami Air S", description: "cone paper", steps: [] }).brewer, "origami-cone");
  assert.equal(G.mapCategory({ category: "Origami Air S", description: "wave filter", steps: [] }).brewer, "origami-wave");
  assert.equal(G.mapCategory({ category: "Origami Air S", description: "cone or wave", steps: [] }), null, "both named = not stated");
});

test("filters: Gota Team, no originator, staged temperature, cap, non-reaching plan are dropped; the fixture passes", () => {
  const p = page();
  const map = G.mapCategory(p);
  assert.equal(G.dropReason(p, map), null);
  assert.match(G.dropReason({ ...p, author: "Gota Team" }, map), /Gota Team/);
  assert.match(G.dropReason({ ...p, originator: null }, map), /no originator/);
  assert.match(G.dropReason({ ...p, originator: { host: "gota.cafe", url: "", by: "" } }, map), /no originator/);
  assert.match(G.dropReason({ ...p, steps: p.steps.map((s, i) => (i === 1 ? { ...s, tempC: 80 } : s)) }, map), /staged temperature/);
  assert.match(G.dropReason({ ...p, water: 300 }, map), /does not reach/);
  assert.match(G.dropReason(p, { brewer: "aeropress" }), /over the aeropress cap/);
  assert.match(G.dropReason(p, null), /not his brewer/);
  assert.match(G.dropReason({ ...p, tempC: 50 }, map), /temperature/);
});

test("clones: one copy per family, the higher-priority category wins", () => {
  const p = page();
  const a = { ...p, category: "V60 01" };
  const b = { ...p, category: "V60 02" };
  const c = { ...p, name: "Other" };
  const kept = G.dedupeClones([a, b, c]);
  assert.equal(kept.length, 2);
  assert.ok(kept.includes(b) && kept.includes(c) && !kept.includes(a));
});

test("corpus dedup: same person + brewer + water ±10 %, or the same name by the same person", () => {
  const p = page();
  const existing = [{ id: "x", name: "Something", attribution: { person: "Orea" }, brewer: "orea-v4-wide", water: { grams: 300 } }];
  assert.equal(G.corpusDuplicate(p, "orea-v4-wide", existing), "x");
  assert.equal(G.corpusDuplicate(p, "orea-v4-wide", [{ ...existing[0], water: { grams: 250 } }]), null);
  assert.equal(G.corpusDuplicate(p, "orea-v4-wide", [{ ...existing[0], name: "Standard", water: { grams: 100 } }]), "x");
});

test("entry: the published clock as step windows, the last pour untimed, the rest a drain, no addedAt, verified false, Gota and the host named", () => {
  const p = page();
  const r = G.toGotaRecipe(p, G.mapCategory(p), "2026-10-19T20:00:00.000Z");
  assert.equal(r.id, "gota-orea-v4-wide-orea-v4-wide-std");
  assert.equal(r.brewer, "orea-v4-wide");
  assert.deepEqual(r.pourSequence.map((s) => [s.action, s.waterGramsAtEnd ?? null, s.durationSec ?? null]), [
    ["pour", 60, 40],
    ["pour", 180, 40],
    ["pour", 320, null],
    ["swirl", null, null],
    ["drain", null, 94],
  ]);
  assert.equal(r.totalTimeSec, 200);
  assert.equal(r.verified, false);
  assert.equal(r.addedAt, undefined, "a bulk import never wears NEW this month");
  assert.equal(r.attribution.affiliation, "via Gota");
  assert.match(r.notes, /gota\.cafe/);
  assert.match(r.notes, /orea\.uk/);
  assert.match(r.notes, /NOT cross-checked/);
  assert.equal(r.sources[0].url, URL);
  assert.equal(r.sources[1].url, "https://www.orea.uk/pages/brew-guides");
  assert.ok(!("nicheZeroDegrees" in r.grind), "never a Niche number");
  assert.deepEqual(r.techniques, ["bloom", "pulse-pouring", "spiral-pour", "swirl-not-stir"]);
  assert.deepEqual(r.bestFor, { roastLevels: ["medium", "light"], goals: ["balanced", "sweetness-forward"] });
  assert.match(G.renderGotaFile([r]), /^\/\/ GENERATED by scripts\/gota-import\.mjs/);
});

test("WIRING: GOTA_RECIPES is in ALL_RECIPES; the caps the script uses equal VESSEL_CAPS", async () => {
  const helpers = await readFile(path.join(ROOT, "src/lib/knowledge/recipes/helpers.ts"), "utf8");
  assert.match(helpers, /\.\.\.GOTA_RECIPES,\n\];/);
  const caps = await readFile(path.join(ROOT, "src/lib/utils/vesselCapacity.ts"), "utf8");
  for (const [word, key] of [["aeropress", "aeropress"], ["clever", "clever"], ["origami", "origami-cone"], ["chemex", "chemex"], ["kalita", "kalita-wave"], ["orea", "orea-v4-wide"], ["v60", "v60"]]) {
    const m = new RegExp(`match: /${word}/,[^\\n]*maxMl: (\\d+)`).exec(caps);
    assert.ok(m, `VESSEL_CAPS row for ${key}`);
    assert.equal(G.CAPS[key], Number(m[1]), `cap for ${key}`);
  }
});
