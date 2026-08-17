// A "V60 + Drip Assist" recipe has to actually be a Drip Assist recipe.
//
//   node --test tests/dataflow/drip-assist-grind.test.mjs
//
// The report: "Drip Assist war drin aber Rezept nicht angepasst, Temperatur
// oder Mahlgrad — also völlig nutzlos." The disc was named in the method and
// not one number moved with it, which makes the label decoration.
//
// Two ways that happened, both covered here. (1) The grind offset was asked for
// in the prompt and nowhere enforced — a soft POSITIVE instruction leaks the
// same way the soft negative did, which is why stripProactiveDripAssist had to
// exist. (2) Worse and quieter: the fidelity guard rewrites grind whenever
// total time OR temperature drifted, and it rewrote it to the BARE published
// number — so a wrong clock silently undid a right grind.
//
// The offset itself is deliberately conservative: +5° is the delta both
// in-repo tables agree on, and the guard only moves a grind that is clearly not
// carrying the disc at all (>4° under target), so ordinary variation passes.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "discgrind-"));
const out = join(dir, "f.mjs");
await build({
  stdin: {
    contents: `export { reconcileToReference } from ${JSON.stringify(path.join(ROOT, "src/lib/claude/recipeFidelity.ts"))};`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  outfile: out,
  platform: "neutral",
  logLevel: "silent",
});
const { reconcileToReference } = await import(pathToFileURL(out).href);

// Verified corpus recipe: Kasuya 4:6 Standard — 20g:300g, Niche 390–400 (mid
// 395), 93°C, 210s. At the reference batch the scaled mid is the plain mid.
const REF = "Kasuya 4:6 (standard)";
const PLAIN_MID = 395;
const WITH_DISC = 400;

/** The reference recipe, faithfully, with whatever the model got wrong. */
function candidate(overrides = {}) {
  return {
    doseGrams: 20,
    waterGrams: 300,
    waterTempC: 93,
    grindSize: `${PLAIN_MID}°`,
    targetTimeSec: 210,
    ...overrides,
  };
}

const grindOf = (r) => Number(/(\d{2,3})/.exec(r.grindSize)[1]);

test("a disc brew carrying the bare-V60 grind gets the disc offset", () => {
  const { recipe, changed, reasons } = reconcileToReference(
    candidate(),
    REF,
    "V60 + Drip Assist",
  );
  assert.equal(changed, true, "the disc recipe was left on the bare-V60 grind");
  assert.equal(grindOf(recipe), WITH_DISC);
  assert.match(reasons.join(" "), /Drip Assist/);
  // Only the flow lever moves. Stretching the clock instead would mean longer
  // contact, i.e. over-extraction — the standing rule in this repo.
  assert.equal(recipe.targetTimeSec, 210, "the clock must not be stretched");
  assert.equal(recipe.waterTempC, 93, "temperature is not a flow lever");
});

test("the same recipe WITHOUT the disc is left alone", () => {
  const { recipe, changed } = reconcileToReference(candidate(), REF, "V60");
  assert.equal(changed, false);
  assert.equal(grindOf(recipe), PLAIN_MID);
});

test("a disc brew that already carries the offset is not nudged further", () => {
  const { changed } = reconcileToReference(
    candidate({ grindSize: `${WITH_DISC}°` }),
    REF,
    "V60 + Drip Assist",
  );
  assert.equal(changed, false, "an already-correct grind must not drift upward");
});

test("a snap-back caused by a wrong clock must not wipe the disc offset", () => {
  // The coupled failure: the model got the TIME wrong, which trips the guard,
  // which then replaces the whole mechanical signature — including a grind that
  // may have been right. The replacement has to know about the disc too.
  const { recipe, changed } = reconcileToReference(
    candidate({ targetTimeSec: 330, grindSize: `${WITH_DISC}°` }),
    REF,
    "V60 + Drip Assist",
  );
  assert.equal(changed, true, "sanity: a 330s clock on a 210s recipe is drift");
  assert.equal(recipe.targetTimeSec, 210, "sanity: the clock is snapped back");
  assert.equal(
    grindOf(recipe),
    WITH_DISC,
    "the snap-back reset the disc grind to the bare reference number",
  );
});

test("the same snap-back without the disc still lands on the bare reference", () => {
  const { recipe, changed } = reconcileToReference(
    candidate({ targetTimeSec: 330 }),
    REF,
    "V60",
  );
  assert.equal(changed, true);
  assert.equal(grindOf(recipe), PLAIN_MID);
});

test("no method given behaves exactly as before", () => {
  // reconcileToReference is called from other paths; the disc is opt-in.
  const { recipe, changed } = reconcileToReference(candidate({ targetTimeSec: 330 }), REF);
  assert.equal(changed, true);
  assert.equal(grindOf(recipe), PLAIN_MID);
});
