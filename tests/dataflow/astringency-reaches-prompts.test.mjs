// Astringency was collected on EVERY tasting and read by no prompt builder.
//
//   node --test tests/dataflow/astringency-reaches-prompts.test.mjs
//
// It matters more than its size suggests: astringency is the clearest
// over-extraction marker the log collects — the dry, puckering finish of a
// grind too fine, water too hot, or contact too long. Without it a "3 stars,
// bitter=harsh" line reaches the coach with the one signal that separates
// over-extraction from a dark-roast bitterness the brew cannot fix stripped
// out of it, and the coach guesses.
//
// Both readers are covered: serialiseSessionForCoach (the line the coach model
// literally reads, feeding insight rows and through them /recommend) and
// buildSensoryPatterns via buildHistorySummary (the loading-insight agent).

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, mkdir } from "node:fs/promises";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
// The bundle must live INSIDE the project: insights.ts reaches the DB client
// through its module graph, and the driver is kept external (below) rather than
// bundled — so Node has to be able to resolve it from the bundle's own
// location. node_modules/.cache is already ignored by git.
const CACHE = join(ROOT, "node_modules", ".cache", "brewlog-tests");
await mkdir(CACHE, { recursive: true });

async function load(rel, names) {
  const entry = `export { ${names.join(", ")} } from ${JSON.stringify(path.join(ROOT, rel))};`;
  const dir = await mkdtemp(join(CACHE, "astr-"));
  const out = join(dir, "b.mjs");
  await build({
    stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
    bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "silent",
    // insights.ts reaches the DB client through its module graph. The functions
    // under test are pure and never touch it, so keep the driver out of the
    // bundle rather than trying to make `pg` work as ESM.
    external: ["pg", "pg-native", "drizzle-orm", "drizzle-orm/*"],
  });
  return import(pathToFileURL(out).href);
}

const { serialiseSessionForCoach } = await load("src/lib/claude/insights.ts", ["serialiseSessionForCoach"]);
const { buildHistorySummary } = await load("src/lib/claude/historyUtils.ts", ["buildHistorySummary"]);

let seq = 0;
function session({ rating = 3, astringency, bitterness = "harsh", clarity = "clean" } = {}) {
  seq += 1;
  return {
    id: `s${seq}`,
    createdAt: new Date(1735689600000 + seq * 86400000).toISOString(),
    coffee: { roaster: "Friedhats", name: "Guji", origin: "Ethiopia", process: "Natural", roastLevel: "Light" },
    brew: { methodUsed: "V60", actualTimeSec: 230, grindSettingUsed: "380°", actualTempC: 96 },
    result: {
      rating, flavorNotes: ["citrus"], body: "medium", acidity: "high",
      bitterness, clarity, ...(astringency ? { astringency } : {}),
    },
    recommendation: {
      primaryMethod: "V60",
      primaryRecipe: { doseGrams: 15, waterGrams: 250, waterTempC: 94, grindSize: "390°", targetTimeSec: 210 },
    },
  };
}

test("the coach's session line carries the sensory reading AT ALL", () => {
  // Found while wiring astringency: `tasteBits` was assembled and then joined
  // into nothing — it was never placed in the line's parts array, so NONE of
  // body/acidity/sweetness/bitterness/finish/clarity ever reached the coach
  // (git log -S 'tasteBits.join' returns no commit). The coach was inferring
  // taste from the flavour-note list and the star rating alone.
  const line = serialiseSessionForCoach(session({ rating: 2.5, astringency: "notable" }));
  for (const token of ["body=medium", "acid=high", "bitter=harsh", "clarity=clean"]) {
    assert.match(line, new RegExp(token.replace("=", "=")), `the coach must see ${token}`);
  }
});

test("the coach's own session line carries astringency", () => {
  const line = serialiseSessionForCoach(session({ rating: 2.5, astringency: "notable" }));
  assert.match(line, /astringent=notable/, "the coach must see the over-extraction marker");
  // And it sits with the other taste fields, not bolted somewhere unreadable.
  assert.match(line, /bitter=harsh/);
});

test("a tasting that recorded no astringency does not invent one", () => {
  const line = serialiseSessionForCoach(session({ astringency: undefined }));
  assert.doesNotMatch(line, /astringent=/);
});

test("all three levels survive the trip", () => {
  for (const level of ["none", "light", "notable"]) {
    assert.match(serialiseSessionForCoach(session({ astringency: level })), new RegExp(`astringent=${level}`));
  }
});

test("the sensory pattern block groups astringency against rating", () => {
  // Three puckering brews rated low, three clean ones rated high: exactly the
  // pattern the coach should be able to name.
  const sessions = [
    ...Array.from({ length: 3 }, () => session({ rating: 2.5, astringency: "notable" })),
    ...Array.from({ length: 3 }, () => session({ rating: 5, astringency: "none" })),
  ];
  const summary = buildHistorySummary(sessions);
  assert.match(summary, /astringency:notable/, "the block must report the astringent group");
  assert.match(summary, /astringency:none/, "and the clean one, so the contrast is visible");
});

test("astringency ALONE is enough to open the sensory block", () => {
  // The block used to require clarity/sweetness/bitterness to be present, so a
  // tasting where astringency was the only thing recorded contributed nothing.
  const sessions = Array.from({ length: 3 }, () =>
    session({ rating: 3, astringency: "light", bitterness: undefined, clarity: undefined }),
  );
  assert.match(buildHistorySummary(sessions), /astringency:light/);
});
