// /recommend VARIETY simulation — measures the repetition the owner reports.
//
//   node scripts/recommend-variety-sim.mjs            # offline: selection only
//   ANTHROPIC_API_KEY=... node scripts/recommend-variety-sim.mjs --live
//
// WHY THIS EXISTS
// The owner's standing complaint is "the recipes repeat — same brewer, same
// numbers, every brew". Three rounds of fixes (#480 / #483 / #486 / #523)
// targeted the MENU — which recipes get injected — and #523 genuinely fixed it
// (measured 19/20 distinct menus). The complaint did not move. That means the
// repetition lives DOWNSTREAM of the menu, and nothing in the repo measures
// downstream. `tests/dataflow/recipe-menu-variety.test.mjs` stops at the menu,
// and it calls selectRecipes WITHOUT `demoteBrewers` / `recentReferenceNames`,
// so it measures a shape production never runs.
//
// This harness closes both gaps:
//
//   1. THE FEEDBACK LOOP. Production is a loop: today's candidates become
//      tomorrow's `recentReferenceNames`, `demoteBrewers` (via buildMethodRecency)
//      and own-references. Every existing test runs ONE isolated call. Here each
//      simulated brew is fed back as a synthetic Session, so the selector is
//      exercised in the state it actually reaches on brew 12.
//
//   2. CANDIDATE-LEVEL METRICS (--live). The menu varying is worthless if the
//      model answers with the same recipe anyway — it can, because the cached
//      SYSTEM_PROMPT carries its own fixed recipe menu. Live mode counts
//      distinct (method, basedOn) pairs and distinct headline number tuples
//      across the candidates the model actually returns, plus how often the
//      fidelity guard snapped a candidate back onto a published recipe and how
//      often `basedOn` named something that was NOT in the injected menu.
//
// Faithfulness: SYSTEM_PROMPT, the selector, the guards and the corpus are the
// REAL production artifacts, bundled from src/ with esbuild — not reconstructed.
// The per-brew user message mirrors recommend.ts's assembly for the blocks that
// drive variety (menu, own references, method recency, recent recipes,
// diversity, session arc, amount guide).
//
// Output: markdown to stdout AND spike-output/recommend-variety.md.
// Runs in CI via .github/workflows/recommend-variety.yml.

import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

const LIVE = process.argv.includes("--live");
const ROOT = process.cwd();
const BREWS = 20;

// ── Bundle the REAL selection + prompt + guards ──────────────────────────────
const entry = `
export { SYSTEM_PROMPT } from ${q("src/lib/claude/recommendPrompt.ts")};
export {
  selectRecipes, formatRecipesForPrompt, brewersAvailableFromEquipment,
  CANONICAL_EQUIPMENT, brewersFromMethod, normaliseRoastLevel,
  normaliseProcess, normaliseGoal,
} from ${q("src/lib/knowledge/recipes/index.ts")};
export { ALL_RECIPES } from ${q("src/lib/knowledge/recipes/index.ts")};
export { buildMethodRecency } from ${q("src/lib/claude/methodRotation.ts")};
export { buildOwnReferences, formatOwnReferencesForPrompt } from ${q("src/lib/claude/ownReferenceRecipes.ts")};
export { getVarietyPriorsForBag, formatVarietyPriorsForPrompt } from ${q("src/lib/knowledge/varieties/index.ts")};
export { TECHNIQUES } from ${q("src/lib/knowledge/techniques/index.ts")};
export { getRoasterPrior, formatRoasterPriorForPrompt } from ${q("src/lib/roasters/priors.ts")};
export { reconcileToReference } from ${q("src/lib/claude/recipeFidelity.ts")};
export { parseClaudeJson, z } from ${q("src/lib/claude/parseJson.ts")};
`;
function q(rel) {
  return JSON.stringify(path.join(ROOT, rel));
}

const dir = await mkdtemp(join(tmpdir(), "variety-sim-"));
const bundlePath = join(dir, "bundle.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: bundlePath,
  logLevel: "silent",
});
const K = await import(pathToFileURL(bundlePath).href);
const { SYSTEM_PROMPT, z } = K;

// Candidate schema — mirrors recommend.ts (not exported). Kept permissive so a
// prompt change that adds/removes a prose field doesn't fail the measurement.
const ResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        method: z.string(),
        title: z.string(),
        basedOn: z.string().optional(),
        role: z.string().optional(),
        whyChosen: z.string().optional(),
        experiment: z.string().optional(),
        recipe: z.record(z.string(), z.unknown()),
      }),
    )
    .min(1),
  reasoning: z.string().optional(),
});

// ── Scenarios ────────────────────────────────────────────────────────────────
// Two unrelated coffees, each brewed BREWS times in a row. Same coffee every
// iteration on purpose: that is the owner's actual pattern (a bag stays in
// rotation for weeks) and the case where repetition is most visible.
const SCENARIOS = [
  {
    label: "Washed Kenyan SL28 · morning ritual · balanced · 350ml",
    coffee: {
      roaster: "Cloud Picker", name: "Kiriga (sim)", origin: "Kenya", region: "Nyeri",
      variety: "SL28", process: "Washed", roastLevel: "Light",
      tastingNotesFromBag: ["blackcurrant", "tomato", "red wine"],
    },
    context: {
      occasion: "morning-ritual", amount: "small", timeAvailable: "normal",
      grinder: "Niche Zero", waterSource: "tap", intent: "balanced",
    },
  },
  {
    label: "Natural Ethiopian heirloom · deep focus · high-clarity · 350ml",
    coffee: {
      roaster: "Friedhats", name: "Guji (sim)", origin: "Ethiopia", region: "Guji",
      variety: "Heirloom", process: "Natural", roastLevel: "Light",
      tastingNotesFromBag: ["blueberry", "strawberry", "milk chocolate"],
    },
    context: {
      occasion: "focus", amount: "small", timeAvailable: "normal",
      grinder: "Niche Zero", waterSource: "championship", intent: "high-clarity",
    },
  },
];

const PREFS = {
  equipment: ["V60", "Orea V4", "Origami Air M", "Clever Dripper", "Kalita Wave", "AeroPress", "Moccamaster", "Chemex"],
  grinder: "Niche Zero",
  tasteProfile: { preferredBodyLevel: "medium", preferredAcidityLevel: "medium-high" },
};

// Brews are one day apart — the same degenerate spacing recipe-menu-variety
// uses, because a ms timestamp modulo a small group size is degenerate at
// exactly that spacing (86_400_000 divides 2,3,4,5,6,8,9,10). If variety
// survives here it survives anywhere.
const START_MS = Date.parse("2026-06-01T07:30:00.000Z");
const DAY = 86_400_000;

// ── Production-faithful selection for one iteration ──────────────────────────
// Mirrors recommend.ts: same inputs, same order, same seed derivation.
function selectionFor(scenario, pastSessions) {
  const { coffee, context } = scenario;
  const targetWaterMl = context.amount === "big" ? 520 : 350;

  const methodRecency = K.buildMethodRecency(pastSessions, {
    lockedMethod: undefined,
    occasion: context.occasion,
  });

  const brewersAvailable = K.brewersAvailableFromEquipment([
    ...PREFS.equipment,
    ...K.CANONICAL_EQUIPMENT,
  ]);

  const input = {
    brewersAvailable,
    lockedBrewers: new Set(),
    excludeLongWaits: false,
    roastLevel: K.normaliseRoastLevel(coffee.roastLevel),
    process: K.normaliseProcess(coffee.process),
    processes: [],
    variety: coffee.variety,
    goal: K.normaliseGoal(context.intent),
    occasion: context.occasion,
    maxWaterMl: targetWaterMl,
    serveVolumeMl: targetWaterMl,
    // recommend.ts: the LATEST logged session's timestamp.
    rotationSeed:
      pastSessions.reduce((m, s) => {
        const t = Date.parse(s.createdAt ?? "");
        return Number.isFinite(t) ? Math.max(m, t) : m;
      }, 0) || pastSessions.length,
    recentReferenceNames: recentReferenceNames(pastSessions),
    demoteBrewers: methodRecency.recentBrewers,
  };

  return { selected: K.selectRecipes(input, 4), methodRecency, targetWaterMl };
}

// Ported verbatim from recommend.ts (not exported).
function recentReferenceNames(sessions) {
  const names = new Set();
  for (const s of sessions.slice(0, 6)) {
    for (const c of s.recommendation?.candidates ?? []) {
      const b = c.basedOn?.trim();
      if (b && b.toLowerCase() !== "own recipe") names.add(b);
    }
  }
  return Array.from(names);
}

function buildRecentRecipesNote(sessions) {
  const names = recentReferenceNames(sessions);
  if (!names.length) return "";
  return `\nRECENTLY RECOMMENDED — across your last ${Math.min(sessions.length, 6)} sessions you have leaned on these reference recipes: ${names.join(", ")}. Unless this coffee genuinely calls for one of them again, base your two candidates on DIFFERENT reference recipes and/or brewers, so the portfolio doesn't repeat itself brew after brew. Varying the reference is not a licence to fabricate — pick a different documented recipe from the library above that fits, don't invent one.`;
}

function buildDiversityNote(sessions) {
  const recent = sessions.slice(0, 8);
  const anchors = {};
  for (const s of recent) {
    const m = s.recommendation?.primaryMethod;
    if (m) anchors[m] = (anchors[m] ?? 0) + 1;
  }
  const sorted = Object.entries(anchors).sort((a, b) => b[1] - a[1]);
  if (!sorted.length || sorted[0][1] < 3) return "";
  return `\nPORTFOLIO DIVERSITY — anchor methods in last ${recent.length} sessions: ${sorted.map(([m, n]) => `${m} ×${n}`).join(", ")}. Vary deliberately unless the coffee or terrain genuinely demands the same approach.`;
}

function sessionArcNote(n) {
  if (n === 0) return "\nSESSION ARC: First brew of this coffee. Goal: characterize extraction behavior and establish a baseline. Pair two methods with genuinely different extraction physics so the cup comparison is informative.";
  if (n < 3) return `\nSESSION ARC: Session ${n + 1} with this coffee. Building on the baseline. Use what the earlier sessions suggested to refine, and push one variable further.`;
  if (n < 8) return `\nSESSION ARC: Session ${n + 1} with this coffee. The character is understood. This portfolio should test something genuinely new — an unexplored method, an untested variable. Don't recycle what worked; push the boundary.`;
  return `\nSESSION ARC: Session ${n + 1} with this coffee. Expert territory. Find the ceiling: what does this coffee do that no other has?`;
}

// ── User message (variety-relevant blocks, faithful to recommend.ts) ─────────
function buildUserMessage(scenario, pastSessions, sel) {
  const { coffee, context } = scenario;
  const roasterPrior = K.getRoasterPrior(coffee.roaster || "");
  const roasterBlock =
    roasterPrior.confidence !== "fallback" ? `\n${K.formatRoasterPriorForPrompt(roasterPrior)}` : "";
  const varietyPriors = K.getVarietyPriorsForBag(coffee.variety);
  const varietyBlock = varietyPriors.length ? `\n${K.formatVarietyPriorsForPrompt(varietyPriors)}` : "";
  const recipesBlock = sel.selected.length ? `\n${K.formatRecipesForPrompt(sel.selected)}` : "";
  const ownReferenceBlock = K.formatOwnReferencesForPrompt(
    K.buildOwnReferences(pastSessions, coffee, undefined),
  );
  const techniquesBlock =
    "\nAVAILABLE TECHNIQUES (atomic moves you can compose with — cite by id when adapting a recipe):\n" +
    K.TECHNIQUES.map((t) => `  - ${t.id}: ${t.description}`).join("\n");

  const guide =
    context.amount === "big"
      ? "target ~520g water / 34g dose (1:15.3)."
      : "target ~350g water / 23g dose (1:15.2). Suitable: V60, Orea, Clever Dripper, Kalita, Chemex, Origami Air M. NOT AeroPress (max 230ml). NOT Moccamaster (batch only).";
  const waterNote =
    context.waterSource === "championship"
      ? "Clarity blend (~73ppm TDS, KH ~1.3°dH) — near-zero buffering, ideal for washed florals & championship methods"
      : "BWT-filtered daily water (~220ppm TDS, GH 5–6°dH, KH 4°dH) — moderate buffering";

  const historyLine = pastSessions.length
    ? `Previous sessions with this coffee: ${pastSessions.length}. Most recent brews: ${pastSessions
        .slice(0, 5)
        .map((s) => `${s.recommendation?.primaryMethod ?? "?"} (${s.result?.rating ?? "?"}★)`)
        .join(", ")}.`
    : "No previous sessions — first brew ever logged. Reason from coffee properties and roaster prior only.";

  return `Coffee: ${coffee.name} by ${coffee.roaster}
Origin: ${coffee.origin}, ${coffee.region} · Variety: ${coffee.variety}
Process: ${coffee.process} | Roast: ${coffee.roastLevel}
Bag tasting notes: ${coffee.tastingNotesFromBag.join(", ")}
${roasterBlock}
Context:
- Occasion: ${context.occasion}
- Amount: ${context.amount} (${guide})
- Time available: ${context.timeAvailable}
- Grinder: ${context.grinder}
- Water: ${waterNote}${sel.methodRecency.note ?? ""}
GOAL: "${context.intent}" — the user's stated taste direction for this brew.

Equipment available: ${PREFS.equipment.join(", ")}
Grinder: ${context.grinder} → grindSize must be ONE specific Niche° value (e.g. "406°"). NO ranges. NEVER clicks.
Taste preferences: body=${PREFS.tasteProfile.preferredBodyLevel}, acidity=${PREFS.tasteProfile.preferredAcidityLevel}

${historyLine}
${sessionArcNote(pastSessions.length)}${buildDiversityNote(pastSessions)}${buildRecentRecipesNote(pastSessions)}

${varietyBlock}${recipesBlock}${ownReferenceBlock}${techniquesBlock}

pourSteps — emit the structured array on every recipe (action: bloom | pour | final | stir | swirl | wait | press | invert | flip | drain | bypass | melodrip | agitate-bed; waterGramsAtEnd cumulative on pours; durationSec; omit temperatureC).

basedOn — name the documented recipe this candidate adapts, using its name from the Reference Recipe Library above. If the candidate isn't based on any documented recipe, set "Own recipe". Always present.

CANDIDATE TITLES must be DISTINCT across the candidates. Return valid JSON only.`;
}

// ── Feedback: turn a brew's candidates into the next iteration's Session ─────
// Shaped so recentReferenceNames / buildMethodRecency / buildOwnReferences all
// read it exactly as they read a real logged session.
function synthSession(scenario, candidates, iso, rating) {
  const cands = candidates.map((c) => ({
    method: c.method,
    title: c.title,
    basedOn: c.basedOn,
    role: c.role ?? "anchor",
    recipe: c.recipe,
    whyChosen: c.whyChosen ?? "",
  }));
  return {
    id: `sim-${iso}`,
    createdAt: iso,
    createdAtMs: Date.parse(iso),
    coffee: { ...scenario.coffee },
    // The user brewed candidate 0 — the pattern the app records.
    brew: { methodUsed: cands[0]?.method, selectedCandidateIdx: 0, actualTimeSec: 200 },
    recommendation: {
      candidates: cands,
      primaryMethod: cands[0]?.method,
      alternativeMethod: cands[1]?.method,
      primaryRecipe: cands[0]?.recipe,
    },
    result: { rating },
  };
}

// A menu-respecting stand-in for the model: takes the top menu entry and the
// best entry on a DIFFERENT brewer (what the prompt's pairing rule asks for).
// Offline this is the optimistic case — it shows the variety the selector makes
// AVAILABLE. The real model can only do worse, which is what --live measures.
function menuFollowingCandidates(sel) {
  const picks = [];
  for (const s of sel.selected) {
    if (picks.length === 0) { picks.push(s); continue; }
    if (s.recipe.brewer !== picks[0].recipe.brewer) { picks.push(s); break; }
  }
  if (picks.length === 1 && sel.selected[1]) picks.push(sel.selected[1]);
  return picks.map((s) => ({
    method: s.recipe.brewerLabel ?? s.recipe.brewer,
    title: s.recipe.name,
    basedOn: s.recipe.name,
    recipe: {
      doseGrams: s.recipe.dose?.grams,
      waterGrams: s.recipe.water?.grams,
      waterTempC: s.recipe.temperature?.celsius,
      grindSize: s.recipe.grind?.nicheZeroDegrees ?? s.recipe.grind?.description,
      targetTimeSec: s.recipe.totalTimeSec,
      pourSequence: "sim",
    },
  }));
}

// ── Live model call ──────────────────────────────────────────────────────────
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 180_000 })
  : null;

async function callOpus(userMessage) {
  const res = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 5000,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMessage }],
  });
  const text = res.content[0]?.type === "text" ? res.content[0].text : "{}";
  return { text, inTok: res.usage.input_tokens, outTok: res.usage.output_tokens };
}

// ── Metrics ──────────────────────────────────────────────────────────────────
function headlineTuple(r) {
  return [r?.doseGrams, r?.waterGrams, r?.waterTempC, r?.grindSize, r?.targetTimeSec]
    .map((v) => (v == null ? "?" : String(v)))
    .join("/");
}

function menuNamesOf(sel) {
  const out = [];
  for (const s of sel.selected) {
    out.push(s.recipe.name);
    if (s.recipe.shortName) out.push(s.recipe.shortName);
  }
  return out;
}

// Same containment matching resolveReference uses (6-char specificity floor),
// so a model's short form ("Kasuya 4:6") matches the corpus's long name.
function inMenu(basedOn, names) {
  const b = (basedOn ?? "").toLowerCase().trim();
  if (!b || b === "own recipe" || b.startsWith("your ")) return true; // own recipe / own reference
  return names.some((n) => {
    const x = n.toLowerCase().trim();
    if (x === b) return true;
    if (b.length >= 6 && x.includes(b)) return true;
    if (x.length >= 6 && b.includes(x)) return true;
    return false;
  });
}

async function runScenario(scenario) {
  const past = [];
  const menus = new Set();
  const leads = new Set();
  const menuFollowPairs = new Set();
  const livePairs = new Set();
  const liveTuples = new Set();
  const liveMethods = new Set();
  let snapped = 0;
  let outOfMenu = 0;
  let liveCandidates = 0;
  let inTok = 0;
  let outTok = 0;
  const rows = [];

  for (let i = 0; i < BREWS; i++) {
    const iso = new Date(START_MS + i * DAY).toISOString();
    const sel = selectionFor(scenario, past);
    menus.add(sel.selected.map((s) => s.recipe.id).join("|"));
    if (sel.selected[0]) leads.add(sel.selected[0].recipe.id);

    let candidates;
    if (LIVE) {
      const userMessage = buildUserMessage(scenario, past, sel);
      try {
        const { text, inTok: it, outTok: ot } = await callOpus(userMessage);
        inTok += it; outTok += ot;
        const parsed = K.parseClaudeJson(text, ResponseSchema);
        candidates = parsed.candidates;
      } catch (err) {
        rows.push(`| ${i + 1} | — | ERROR: ${String(err).slice(0, 90)} |`);
        candidates = menuFollowingCandidates(sel);
      }
      const names = menuNamesOf(sel);
      for (const c of candidates) {
        liveCandidates++;
        liveMethods.add((c.method ?? "?").toLowerCase());
        livePairs.add(`${(c.method ?? "?").toLowerCase()}::${(c.basedOn ?? "—").toLowerCase()}`);
        liveTuples.add(headlineTuple(c.recipe));
        if (!inMenu(c.basedOn, names)) outOfMenu++;
        try {
          const res = K.reconcileToReference(c.recipe, c.basedOn, c.method);
          if (res?.changed) snapped++;
        } catch { /* unresolvable reference — no signal */ }
      }
      rows.push(
        `| ${i + 1} | ${sel.selected.map((s) => s.recipe.id).join(", ")} | ${candidates
          .map((c) => `${c.method} ← ${c.basedOn ?? "—"}`)
          .join(" ⟂ ")} |`,
      );
    } else {
      candidates = menuFollowingCandidates(sel);
      for (const c of candidates) {
        menuFollowPairs.add(`${(c.method ?? "?").toLowerCase()}::${(c.basedOn ?? "—").toLowerCase()}`);
      }
      rows.push(
        `| ${i + 1} | ${sel.selected.map((s) => s.recipe.id).join(", ")} | ${candidates
          .map((c) => c.basedOn)
          .join(" ⟂ ")} |`,
      );
    }

    // Feed it back — this is the loop no existing test runs.
    past.unshift(synthSession(scenario, candidates, iso, 4));
  }

  return {
    label: scenario.label,
    menus: menus.size, leads: leads.size,
    menuFollowPairs: menuFollowPairs.size,
    livePairs: livePairs.size, liveTuples: liveTuples.size,
    liveMethods: liveMethods.size, liveCandidates,
    snapped, outOfMenu, inTok, outTok, rows,
  };
}

// ── Run ──────────────────────────────────────────────────────────────────────
if (LIVE && !anthropic) {
  console.error("--live needs ANTHROPIC_API_KEY");
  process.exit(1);
}

const results = [];
for (const s of SCENARIOS) results.push(await runScenario(s));

const lines = [];
lines.push(`# /recommend variety — ${LIVE ? "LIVE (Opus)" : "offline (selection only)"}`);
lines.push("");
lines.push(`${BREWS} consecutive brews per scenario, one day apart, each brew fed back as a logged session (so recentReferenceNames, demoteBrewers and own-references evolve exactly as in production).`);
lines.push("");
if (!LIVE) {
  lines.push("Offline mode measures what the SELECTOR makes available — the optimistic ceiling. A model that ignores the menu can only do worse; run with `--live` to measure what actually comes back.");
  lines.push("");
}

lines.push("## Summary");
lines.push("");
lines.push(
  LIVE
    ? "| scenario | distinct menus | distinct leads | distinct (method←basedOn) | distinct headline numbers | distinct methods | candidates | fidelity snaps | out-of-menu basedOn |"
    : "| scenario | distinct menus | distinct leads | distinct (method←basedOn) if menu-following |",
);
lines.push(LIVE ? "|---|---|---|---|---|---|---|---|---|" : "|---|---|---|---|");
for (const r of results) {
  lines.push(
    LIVE
      ? `| ${r.label} | ${r.menus}/${BREWS} | ${r.leads} | **${r.livePairs}** | **${r.liveTuples}** | ${r.liveMethods} | ${r.liveCandidates} | ${r.snapped} | ${r.outOfMenu} |`
      : `| ${r.label} | ${r.menus}/${BREWS} | ${r.leads} | ${r.menuFollowPairs} |`,
  );
}
lines.push("");
lines.push("**The number that matches the complaint** is *distinct (method←basedOn)* and *distinct headline numbers* across all candidates — not the menu count. A high menu count with a low pair count is exactly the failure this harness exists to expose.");
lines.push("");

for (const r of results) {
  lines.push(`## ${r.label}`);
  lines.push("");
  lines.push(LIVE ? "| brew | injected menu | candidates |" : "| brew | injected menu | menu-following picks |");
  lines.push("|---|---|---|");
  lines.push(...r.rows);
  lines.push("");
  if (LIVE) lines.push(`Tokens: ${r.inTok} in / ${r.outTok} out.`);
  lines.push("");
}

const report = lines.join("\n");
console.log(report);
await mkdir(join(ROOT, "spike-output"), { recursive: true });
await writeFile(join(ROOT, "spike-output", "recommend-variety.md"), report, "utf8");
