// "Better / same / worse than last time" (2026-10-03). The post-brew log asked
// for a star and nothing else; the summary showed only the cup just brewed;
// /api/brew-insight had always been called with recentSessions: [] so the
// history-based insight never once ran. This suite pins the pure previous-brew
// selection AND, source-level, every consumer — the field must survive the
// sessions POST schema (the strip bug class of #556), reach the coach line, and
// the summary must show the pair.
//
//   node --test tests/dataflow/vs-previous.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "vsprev-"));
const out = join(dir, "b.mjs");
await build({
  stdin: {
    contents: `export * from ${JSON.stringify(path.join(ROOT, "src/lib/brew/previousBrew.ts"))};`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const P = await import(pathToFileURL(out).href);

const recipe = { doseGrams: 22, waterGrams: 352, waterTempC: 97, grindSize: "378°", targetTimeSec: 210 };
const mk = (id, iso, rating, coffee, extra = {}) => ({
  id, type: "coffee", mode: "home", createdAt: iso, createdAtMs: Date.parse(iso),
  coffee: { roaster: "Santa Domenica", name: "Beshasha", roastLevel: "Light", aiExtracted: false, ...coffee },
  recommendation: { primaryMethod: "V60", primaryRecipe: recipe, candidates: [{ method: "V60", role: "anchor", title: "Rao brew", basedOn: "Rao Vortex V60", recipe, whyChosen: "", confidence: "high" }], reasoning: "" },
  brew: { methodUsed: "V60", selectedCandidateIdx: 0, actualTimeSec: 203, grindSettingUsed: "380°", actualTempC: 96 },
  result: rating == null ? undefined : { rating, flavorNotes: ["citrus"], body: "medium", acidity: "bright", freeNotes: "a touch sharp" },
  ...extra,
});

test("pickPreviousBrew: newest home brew of the SAME coffee, logged grind/temp preferred, last 5 ratings newest first", () => {
  const sessions = [
    mk("a", "2026-09-29T05:00:00Z", 4, { coffeeId: "sd__beshasha" }),
    mk("b", "2026-10-01T06:00:00Z", 4.5, { coffeeId: "sd__beshasha" }),
    mk("other", "2026-10-02T06:00:00Z", 5, { coffeeId: "x__other", name: "Other" }),
    mk("cafe", "2026-10-02T07:00:00Z", 2, { coffeeId: "sd__beshasha" }, { mode: "external" }),
  ];
  const r = P.pickPreviousBrew(sessions, { coffeeId: "sd__beshasha" });
  assert.equal(r.previous.id, "b");
  assert.equal(r.previous.rating, 4.5);
  assert.equal(r.previous.grindSize, "380°");
  assert.equal(r.previous.waterTempC, 96);
  assert.equal(r.previous.basedOn, "Rao Vortex V60");
  assert.deepEqual(r.ratings, [4.5, 4]);
  assert.equal(r.count, 2);
  // roaster+name fallback when the draft has no coffeeId
  assert.equal(P.pickPreviousBrew(sessions, { roaster: "santa domenica", name: "BESHASHA" }).previous.id, "b");
  // unknown coffee → nothing
  assert.equal(P.pickPreviousBrew(sessions, { coffeeId: "nope" }).previous, null);
});

test("WIRING — the field exists on the type, survives the sessions POST schema, and reaches the coach line", async () => {
  const types = await readFile(path.join(ROOT, "src/lib/types/session.ts"), "utf8");
  assert.match(types, /vsPrevious\?: "better" \| "same" \| "worse";/);
  assert.match(types, /previousRating\?: number;/);
  const route = await readFile(path.join(ROOT, "src/app/api/sessions/route.ts"), "utf8");
  assert.match(route, /vsPrevious: z\.enum\(\["better", "same", "worse"\]\)\.optional\(\)/, "zod strips unknown keys silently — the field must be in the schema");
  assert.match(route, /previousRating: z\.number\(\)/);
  const coach = await readFile(path.join(ROOT, "src/lib/claude/insights.ts"), "utf8");
  assert.match(coach, /quality\.push\(`vs=\$\{r\.vsPrevious\}\$\{pair\}`\)/, "the comparison must reach the coach line");
});

test("WIRING — the log fetches the previous brew, offers the tap, sends the rating-drop signal; the summary shows the pair", async () => {
  const log = await readFile(path.join(ROOT, "src/components/flow/LightStepLog.tsx"), "utf8");
  assert.match(log, /fetch\(`\/api\/sessions\/previous\?/);
  assert.match(log, /Last time with this coffee/);
  assert.match(log, /\(\["better", "same", "worse"\] as const\)\.map/);
  assert.match(log, /vsPrevious,\s*previousSessionId: previous\.previous\.id,/, "the tap must land in the saved result");
  assert.match(log, /\.\.\.\(ratingDropVsAvg != null \? \{ ratingDropVsAvg \} : \{\}\)/, "the rating-drop signal must be sent");
  const summary = await readFile(path.join(ROOT, "src/components/flow/LightStepSummary.tsx"), "utf8");
  assert.match(summary, /Last time \{result\.previousRating\}★ → now \{result\.rating\}★/);
});

test("WIRING — /api/brew-insight loads history server-side when the client sends none", async () => {
  const src = await readFile(path.join(ROOT, "src/app/api/brew-insight/route.ts"), "utf8");
  assert.match(src, /await loadRecentSessions\(60\)/);
  const prev = await readFile(path.join(ROOT, "src/app/api/sessions/previous/route.ts"), "utf8");
  assert.match(prev, /requireAuth\(req\)/);
  assert.match(prev, /pickPreviousBrew\(sessions, \{ coffeeId, roaster, name \}\)/);
});
