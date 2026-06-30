// /recommend model-comparison spike — Phase 1 of the "souveräne KI / Mistral" evaluation.
//
//   ANTHROPIC_API_KEY=... MISTRAL_API_KEY=... node scripts/recommend-model-spike.mjs
//   node scripts/recommend-model-spike.mjs --dry-run     # print the prompt, call nothing
//
// WHY: the brewing bill is 57–63 % Opus, almost all of it /recommend. The only
// change that materially cuts cost is moving /recommend off Opus — but that is
// also the most quality-critical call (the "never fabricate recipe parameters"
// Hard Rule). This spike fires the REAL recommend prompt at three models so the
// owner can judge recipe quality side by side BEFORE any migration:
//   - claude-opus-4-7   (status quo)
//   - mistral-large-latest (the sovereign / cheap candidate, EU-hosted)
//   - claude-sonnet-4-6 (the "stay on Claude, pay less" fallback)
//
// Faithfulness: the static SYSTEM_PROMPT and the injected knowledge corpus
// (reference recipes, variety priors, techniques, roaster prior) are the REAL
// production artifacts, bundled from src/ with esbuild — NOT reconstructed. The
// per-bean user message mirrors recommend.ts's assembly for a first brew (no DB
// history). All three models get the BYTE-IDENTICAL prompt, so the comparison is
// apples-to-apples. recipeFidelity.reconcileToReference() runs on every returned
// candidate as an OBJECTIVE fabrication detector: it reports when a model's
// grind / temperature / total time drifted from the verified recipe it claims to
// adapt.
//
// Output: a markdown report to stdout AND to spike-output/recommend-comparison.md
// (the GitHub Actions artifact the owner opens on their phone).
//
// Runs in CI via .github/workflows/recommend-spike.yml (workflow_dispatch).

import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

const DRY_RUN = process.argv.includes("--dry-run");
const ROOT = process.cwd();

// ── Bundle the REAL prompt + knowledge corpus (graph-free, no DB) ─────────────
const entry = `
export { SYSTEM_PROMPT } from ${q("src/lib/claude/recommendPrompt.ts")};
export {
  selectRecipes, formatRecipesForPrompt, brewersAvailableFromEquipment,
  CANONICAL_EQUIPMENT, brewersFromMethod, normaliseRoastLevel,
  normaliseProcess, normaliseGoal,
} from ${q("src/lib/knowledge/recipes/index.ts")};
export { getVarietyPriorsForBag, formatVarietyPriorsForPrompt } from ${q("src/lib/knowledge/varieties/index.ts")};
export { TECHNIQUES } from ${q("src/lib/knowledge/techniques/index.ts")};
export { getRoasterPrior, formatRoasterPriorForPrompt } from ${q("src/lib/roasters/priors.ts")};
export { reconcileToReference } from ${q("src/lib/claude/recipeFidelity.ts")};
export { parseClaudeJson, z } from ${q("src/lib/claude/parseJson.ts")};
`;
function q(rel) {
  return JSON.stringify(path.join(ROOT, rel));
}

const dir = await mkdtemp(join(tmpdir(), "recommend-spike-"));
const out = join(dir, "bundle.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const K = await import(pathToFileURL(out).href);
const { SYSTEM_PROMPT, z } = K;

// Recommendation schema — copied from recommend.ts (it isn't exported). Used to
// report whether each model produced schema-valid structured output.
const CandidateSchema = z.object({
  method: z.string(),
  role: z.string(),
  title: z.string(),
  basedOn: z.string().optional(),
  recipe: z.record(z.string(), z.unknown()),
  whyChosen: z.string(),
  hypothesis: z.string(),
  predictedCupProfile: z.string(),
  primaryVariable: z.string(),
  whatToObserve: z.string(),
  confidence: z.string(),
  confidenceReason: z.string(),
  learningValue: z.string(),
  brewingLesson: z.string().optional(),
});
const ResponseSchema = z.object({
  candidates: z.array(CandidateSchema).min(1),
  reasoning: z.string().optional(),
  sessionObjective: z.string().optional(),
  coffeeAssessment: z.string().optional(),
});

// ── Test beans (representative archetypes, not real-product claims) ───────────
// Three profiles that exercise different reasoning paths: a delicate washed
// light (clarity), a soluble natural (don't over-sweeten), a structured Kenyan
// (body). Roasters chosen to also exercise the roaster-prior injection.
const BEANS = [
  {
    label: "Washed Ethiopian, light, very fresh — goal high-clarity",
    coffee: {
      roaster: "Friedhats", name: "Yirga (test)", origin: "Ethiopia", region: "Yirgacheffe",
      variety: "Heirloom", process: "Washed", roastLevel: "Light",
      roastDate: daysAgo(9), tastingNotesFromBag: ["jasmine", "bergamot", "lemon", "black tea"],
      aiExtracted: true,
    },
    context: ctx({ occasion: "morning-ritual", intent: "high-clarity", waterSource: "championship" }),
  },
  {
    label: "Natural Brazil, medium-light, mid-age — goal balanced",
    coffee: {
      roaster: "April", name: "Daterra (test)", origin: "Brazil", region: "Cerrado",
      variety: "Yellow Bourbon", process: "Natural", roastLevel: "Medium-Light",
      roastDate: daysAgo(24), tastingNotesFromBag: ["milk chocolate", "peach", "hazelnut"],
      aiExtracted: true,
    },
    context: ctx({ occasion: "focus", intent: "balanced", waterSource: "tap" }),
  },
  {
    label: "Washed Kenyan SL28, light, fresh — goal body-forward",
    coffee: {
      roaster: "Cloud Picker", name: "Kiriga (test)", origin: "Kenya", region: "Nyeri",
      variety: "SL28", process: "Washed", roastLevel: "Light",
      roastDate: daysAgo(12), tastingNotesFromBag: ["blackcurrant", "tomato", "red wine"],
      aiExtracted: true,
    },
    context: ctx({ occasion: "experiment", intent: "body-forward", waterSource: "tap" }),
  },
];

function ctx(over) {
  return {
    occasion: "morning-ritual", amount: "small", timeAvailable: "normal",
    moodPreference: "balanced", grinder: "Niche Zero", waterSource: "tap",
    intent: "balanced", ...over,
  };
}
function daysAgo(n) {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

const PREFS = {
  equipment: ["V60", "Orea V4", "Origami Air M", "Clever Dripper", "Kalita Wave", "AeroPress", "Moccamaster", "Chemex"],
  grinder: "Niche Zero",
  tasteProfile: { preferredBodyLevel: "medium", preferredAcidityLevel: "medium-high" },
};

// ── Build the per-bean user message (faithful to recommend.ts, first-brew) ────
function buildUserMessage(coffee, context, preferences) {
  const daysOld = coffee.roastDate
    ? Math.floor((Date.now() - new Date(coffee.roastDate).getTime()) / 86_400_000)
    : null;
  const freshnessNote =
    daysOld === null ? "" :
    daysOld < 5 ? "too fresh — heavy CO₂, channeling risk, bloom 50s+" :
    daysOld < 7 ? "very fresh — bloom 50s recommended" :
    daysOld < 22 ? "peak window — ideal" :
    daysOld < 35 ? "slightly past peak" :
    daysOld < 60 ? "past peak, flavors softening" : "likely stale";

  const guide = "target ~350g water / 23g dose (1:15.2). Suitable: V60, Orea, Clever, Kalita, Chemex, Origami Air M. NOT AeroPress (max 230ml). NOT Moccamaster (batch only).";
  const sessionGrinder = context.grinder || preferences.grinder || "Niche Zero";
  const grinderNote = `Grinder: ${sessionGrinder} → grindSize must be ONE specific Niche° value (e.g. "406°"). NO ranges. NEVER clicks.`;
  const waterNote =
    context.waterSource === "championship"
      ? "Clarity blend (1:2 BWT-filtered + distilled = ~73ppm TDS, KH ~1.3°dH) — near-zero buffering, ideal for washed florals & championship methods"
      : "BWT-filtered daily water (~220ppm TDS, GH 5–6°dH, KH 4°dH) — moderate buffering; for delicate washed coffees note the clarity blend would lift brightness";

  const roasterPrior = K.getRoasterPrior(coffee.roaster || "");
  const roasterBlock = roasterPrior.confidence !== "fallback" ? `\n${K.formatRoasterPriorForPrompt(roasterPrior)}` : "";

  const varietyPriors = K.getVarietyPriorsForBag(coffee.variety);
  const varietyBlock = varietyPriors.length ? `\n${K.formatVarietyPriorsForPrompt(varietyPriors)}` : "";

  const brewersAvailable = K.brewersAvailableFromEquipment([...(preferences.equipment ?? []), ...K.CANONICAL_EQUIPMENT]);
  const selectedRecipes = K.selectRecipes({
    brewersAvailable,
    lockedBrewers: K.brewersFromMethod(context.preferredMethod),
    roastLevel: K.normaliseRoastLevel(coffee.roastLevel),
    process: K.normaliseProcess(coffee.process),
    variety: coffee.variety,
    goal: K.normaliseGoal(context.intent),
    occasion: context.occasion,
    maxWaterMl: 350,
  }, 4);
  const recipesBlock = selectedRecipes.length ? `\n${K.formatRecipesForPrompt(selectedRecipes)}` : "";

  const techniquesBlock =
    "\nAVAILABLE TECHNIQUES (atomic moves you can compose with — cite by id when adapting a recipe):\n" +
    K.TECHNIQUES.map((t) => `  - ${t.id}: ${t.description}`).join("\n");

  const goalNote = `\nGOAL: "${context.intent || "balanced"}" — the user's stated taste direction for this brew. The only user-stated bias allowed; everything else is science. See GOAL VOCABULARY in LAYER 1.`;
  const sessionArcNote = "\nSESSION ARC: First brew of this coffee. Goal: characterize extraction behavior and establish a baseline. Pair two methods with genuinely different extraction physics so the cup comparison is informative.";

  // Mirrors recommend.ts lines ~444-511. History/insights/terrain/timing omitted
  // (first-brew, no DB) — identical across all three models, so a fair comparison.
  return `Coffee: ${coffee.name} by ${coffee.roaster}
Origin: ${coffee.origin}${coffee.region ? `, ${coffee.region}` : ""}${coffee.variety ? ` · Variety: ${coffee.variety}` : ""}
Process: ${coffee.process} | Roast: ${coffee.roastLevel}
Roast date: ${coffee.roastDate ?? "unknown"}${daysOld !== null ? ` (${daysOld} days — ${freshnessNote})` : ""}
Bag tasting notes: ${coffee.tastingNotesFromBag?.join(", ") || "none listed"}
${roasterBlock}
Context:
- Occasion: ${context.occasion}
- Amount: ${context.amount} (${guide})
- Time available: ${context.timeAvailable}
- Grinder: ${sessionGrinder}
- Water: ${waterNote}${goalNote}

Equipment available: ${preferences.equipment.join(", ")}
${grinderNote}
Taste preferences: body=${preferences.tasteProfile.preferredBodyLevel}, acidity=${preferences.tasteProfile.preferredAcidityLevel}

No previous sessions — first brew ever logged. Reason from coffee properties and roaster prior only.
${sessionArcNote}

${varietyBlock}${recipesBlock}${techniquesBlock}

Pour sequence format: CUMULATIVE weight milestones separated by " – " for percolation (e.g. "50 – 180 – 320 – 500").
For immersion methods (AeroPress, Clever, Moccamaster), use prose description instead.

pourSteps — ALSO emit this structured array on every recipe. It is what the in-app timer advances through step by step, so it must be complete and ordered.
- One object per physical step the brewer performs, in order.
- action: one of bloom | pour | final | stir | swirl | wait | press | invert | flip | drain | bypass | melodrip | agitate-bed
- waterGramsAtEnd: cumulative water in the brewer after a POUR step (omit on non-pour steps). These MUST match pourSequence.
- durationSec: how long the step takes. Immersion / AeroPress: durations are MANDATORY and the timed (non-setup) steps MUST sum to targetTimeSec.
- temperatureC: omit on every step. BrewLog brews at ONE constant temperature (the recipe's waterTempC) — never stage or ramp temperature across pours.
- notes: one short, step-relevant hint. Optional.

basedOn — name the documented recipe this candidate adapts, using its name from the Reference Recipe Library above (e.g. "Kasuya 4:6", "Hoffmann AeroPress", "April House V60"). If the candidate isn't based on any documented recipe, set "Own recipe". Always present.

RECIPE FIELD CONSISTENCY — doseGrams / waterGrams / waterTempC / grindSize / targetTimeSec are the recipe you are actually instructing. When you adapt a reference recipe, put the ADAPTED numbers here — NEVER leave the reference recipe's published dose/water/temp in these fields while the pourSteps and prose describe a different brew. waterGrams MUST equal the final cumulative waterGramsAtEnd of your last water-adding pour. doseGrams and waterGrams must match any ratio you state.

CANDIDATE TITLES must be DISTINCT across the candidates. Return valid JSON only.`;
}

// ── Model callers ────────────────────────────────────────────────────────────
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 120_000 })
  : null;

async function callClaude(model, userMessage) {
  const t0 = Date.now();
  const res = await anthropic.messages.create({
    model, max_tokens: 5000,
    system: [{ type: "text", text: SYSTEM_PROMPT }],
    messages: [{ role: "user", content: userMessage }],
  });
  const text = res.content[0]?.type === "text" ? res.content[0].text : "{}";
  return { text, ms: Date.now() - t0, inTok: res.usage.input_tokens, outTok: res.usage.output_tokens };
}

async function callMistral(model, userMessage) {
  const t0 = Date.now();
  const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model, max_tokens: 5000,
      response_format: { type: "json_object" }, // production would do the same
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    }),
  });
  if (!r.ok) throw new Error(`Mistral HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  return {
    text: j.choices?.[0]?.message?.content ?? "{}",
    ms: Date.now() - t0,
    inTok: j.usage?.prompt_tokens ?? 0, outTok: j.usage?.completion_tokens ?? 0,
  };
}

const MODELS = [
  { id: "claude-opus-4-7", label: "Opus 4-7 (status quo)", run: (m, u) => callClaude(m, u), need: "ANTHROPIC_API_KEY" },
  { id: "mistral-large-latest", label: "Mistral Large 3 (sovereign)", run: (m, u) => callMistral(m, u), need: "MISTRAL_API_KEY" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4-6 (cheaper Claude)", run: (m, u) => callClaude(m, u), need: "ANTHROPIC_API_KEY" },
];

// ── Per-candidate quality probes ─────────────────────────────────────────────
function num(x) { return typeof x === "number" && isFinite(x) ? x : null; }

function probeCandidate(c) {
  const r = c.recipe || {};
  const dose = num(r.doseGrams), water = num(r.waterGrams);
  const ratio = dose && water ? (water / dose).toFixed(1) : "?";
  const steps = Array.isArray(r.pourSteps) ? r.pourSteps : [];

  // Staged-temperature check (forbidden): more than one distinct per-step temp,
  // or a per-step temp that differs from the recipe's single waterTempC.
  const stepTemps = steps.map((s) => num(s?.temperatureC)).filter((t) => t !== null);
  const distinct = [...new Set(stepTemps)];
  const baseTemp = num(r.waterTempC);
  const staged = distinct.length > 1 || (distinct.length === 1 && baseTemp !== null && distinct[0] !== baseTemp);

  // Objective fabrication detector: did grind/temp/total-time drift from the
  // verified reference this candidate claims to adapt?
  let drift = null;
  try {
    const res = K.reconcileToReference(r, c.basedOn);
    if (res?.changed) drift = { reference: res.reference, reasons: res.reasons };
  } catch { /* non-verified ref or unscalable — no signal */ }

  return {
    title: c.title, method: c.method, basedOn: c.basedOn || "—",
    dose, water, ratio, temp: baseTemp, grind: r.grindSize ?? "?",
    targetTimeSec: num(r.targetTimeSec), nSteps: steps.length,
    staged, drift,
  };
}

// ── Run ──────────────────────────────────────────────────────────────────────
const lines = [];
const log = (s = "") => { lines.push(s); console.log(s); };

log(`# /recommend — Modellvergleich (Spike)`);
log(`Generiert: ${new Date().toISOString()}`);
log(`\nGleicher echter Prompt (SYSTEM_PROMPT + injizierter Korpus) an alle Modelle. \`drift\` = objektiver Fabrikations-Detektor (reconcileToReference): das Modell wich beim \`basedOn\`-Referenzrezept in Grind/Temp/Zeit ab. \`staged-temp\` = verbotene Mehrtemperatur.\n`);

if (DRY_RUN) {
  log(`\n> DRY RUN — kein API-Call. Beispiel-Prompt für Bohne 1:\n`);
  log("```");
  log(`SYSTEM_PROMPT: ${SYSTEM_PROMPT.length} Zeichen (gebündelt aus recommendPrompt.ts)`);
  log("");
  log(buildUserMessage(BEANS[0].coffee, BEANS[0].context, PREFS));
  log("```");
} else {
  for (const bean of BEANS) {
    log(`\n---\n\n## ${bean.label}`);
    const userMessage = buildUserMessage(bean.coffee, bean.context, PREFS);
    for (const M of MODELS) {
      log(`\n### ${M.label} — \`${M.id}\``);
      if (!process.env[M.need]) { log(`_übersprungen — ${M.need} nicht gesetzt._`); continue; }
      try {
        const { text, ms, inTok, outTok } = await M.run(M.id, userMessage);
        const parsed = K.parseClaudeJson(text, ResponseSchema);
        log(`Latenz ${(ms / 1000).toFixed(1)}s · Tokens in/out ${inTok}/${outTok} · Schema-valid: **${parsed ? "ja" : "NEIN"}**`);
        if (!parsed) {
          log("```");
          log(text.slice(0, 600));
          log("```");
          continue;
        }
        const cands = parsed.candidates.map(probeCandidate);
        log("");
        log("| Kandidat | Methode | basedOn | Dose | Water | Ratio | Temp | Grind | Zeit | Steps | staged-temp | drift |");
        log("|---|---|---|---|---|---|---|---|---|---|---|---|");
        for (const c of cands) {
          const t = c.targetTimeSec ? `${Math.floor(c.targetTimeSec / 60)}:${String(c.targetTimeSec % 60).padStart(2, "0")}` : "?";
          const driftCell = c.drift ? `⚠️ vs ${c.drift.reference}: ${c.drift.reasons.join("; ")}` : "—";
          log(`| ${c.title} | ${c.method} | ${c.basedOn} | ${c.dose ?? "?"}g | ${c.water ?? "?"}g | 1:${c.ratio} | ${c.temp ?? "?"}°C | ${c.grind} | ${t} | ${c.nSteps} | ${c.staged ? "⚠️ JA" : "nein"} | ${driftCell} |`);
        }
        if (parsed.reasoning) log(`\n_Reasoning:_ ${parsed.reasoning.slice(0, 400)}`);
      } catch (e) {
        log(`**FEHLER:** ${String(e.message || e).slice(0, 400)}`);
      }
    }
  }
}

await mkdir(join(ROOT, "spike-output"), { recursive: true });
await writeFile(join(ROOT, "spike-output", "recommend-comparison.md"), lines.join("\n"), "utf8");
console.error(`\n→ geschrieben: spike-output/recommend-comparison.md`);
