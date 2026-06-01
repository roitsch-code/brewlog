/**
 * BTTS Lessons — distilled, durable memory per (level, scope).
 *
 * Pipeline:
 *   1. A brew is saved (POST /api/sessions).
 *   2. distillLessonsForSession() identifies the four scopes touched by
 *      that brew (coffee, roaster, method-style, process-roast).
 *   3. For each scope, we load all relevant past sessions + the
 *      existing lesson row (if any) and ask Haiku to produce an updated
 *      one-line directive.
 *   4. We upsert the result back into the lessons table.
 *
 * Lessons are written ONLY for high-signal brews (rating ≤2 OR ≥4 OR
 * freeNotes present). Mediocre middle-of-the-road brews do not move the
 * needle; running Haiku on every brew is wasteful.
 *
 * Each call to Haiku is wrapped in try/catch — distillation failure
 * NEVER fails the underlying save. Worst case the lesson is updated on
 * the next strong-signal brew or by the backfill script.
 */
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { lessons, sessions } from "@/lib/db/schema";
import { rowToSession } from "@/lib/db/helpers";
import type {
  LessonAnswer,
  LessonLevel,
  LessonQuestion,
  LessonRow,
  LessonSource,
} from "@/lib/db/schema";
import type { Session } from "@/lib/types/session";
import { resolveBrewedRecipe, brewedRecipeName } from "@/lib/utils/resolveRecipe";
// Knowledge layer — same one /recommend reads from, so the distiller
// reasons with the named-expert vocabulary instead of inventing
// coaching-speak.
import {
  getRoasterPrior,
  formatRoasterPriorForPrompt,
} from "../roasters/priors";
import {
  getVarietyPriorsForBag,
  formatVarietyPriorsForPrompt,
} from "../knowledge/varieties";
import { TECHNIQUES } from "../knowledge/techniques";
import { ALL_RECIPES, findRecipesByPerson } from "../knowledge/recipes/helpers";
import { formatScaFoundationsForPrompt } from "../knowledge/sca";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface DistillScope {
  level: LessonLevel;
  scope: string;
  /** Human-readable label for the prompt header. */
  label: string;
}

/**
 * Compute the four (level, scope) keys this session contributes to.
 * Returns only the scopes the session can actually inform — e.g. no
 * method-style key if we can't resolve a method+basedOn pair.
 */
export function scopesForSession(session: Session): DistillScope[] {
  const out: DistillScope[] = [];
  const coffee = session.coffee;
  const result = session.result;
  if (!coffee || !result) return out;

  // Coffee level — use the coffeeId reference if present (canonical),
  // fall back to the same roaster+name key the save path computes so
  // identity stays consistent.
  const coffeeKey =
    coffee.coffeeId ??
    (coffee.roaster && coffee.name
      ? `${coffee.roaster}__${coffee.name}`.toLowerCase().replace(/[^a-z0-9]/g, "_")
      : null);
  if (coffeeKey) {
    out.push({
      level: "coffee",
      scope: coffeeKey,
      label: `${coffee.roaster ?? "unknown roaster"} — ${coffee.name ?? "unknown coffee"}`,
    });
  }

  if (coffee.roaster) {
    out.push({
      level: "roaster",
      scope: coffee.roaster.toLowerCase().trim(),
      label: coffee.roaster,
    });
  }

  const { candidate, method } = resolveBrewedRecipe(session);
  const basedOn = candidate?.basedOn?.trim();
  const usedMethod = (session.brew?.methodUsed || method || "").trim();
  if (usedMethod && basedOn && basedOn.toLowerCase() !== "own recipe") {
    out.push({
      level: "method-style",
      scope: `${usedMethod} · ${basedOn}`.toLowerCase(),
      label: `${usedMethod} · ${basedOn}`,
    });
  }

  if (coffee.process && coffee.roastLevel) {
    const scope = `${coffee.process} × ${coffee.roastLevel}`.toLowerCase().trim();
    out.push({
      level: "process-roast",
      scope,
      label: `${coffee.process} × ${coffee.roastLevel}`,
    });
  }

  return out;
}

/**
 * Pattern gate. Different from the old isHighSignal — we no longer
 * trigger on individual extreme ratings. Lessons emerge only when
 * there's enough DATA in a scope to see a pattern, not when one brew
 * was hot or cold.
 *
 * Per-level thresholds:
 *   coffee         ≥3 rated brews of this bag
 *   roaster        ≥3 rated brews AND ≥2 different coffees from this roaster
 *   method-style   ≥3 rated brews using this recipe family
 *   process-roast  ≥3 rated brews AND ≥2 different coffees
 *
 * Below the gate: no lesson, no questions, nothing. A single brew of a
 * new roaster does NOT generate a roaster-level lesson. Two brews of
 * one coffee from a new roaster do NOT generate a roaster-level lesson
 * either — that's pattern-matching one bag's quirks onto a whole
 * brand. The threshold protects against that.
 *
 * All ratings count (3, 3.5, etc.) — the gate is sample size, not
 * extremity. A coffee that consistently lands at 3.5 IS a pattern
 * worth noting once we have ≥3 brews of it.
 */
export function meetsPatternThreshold(
  scope: DistillScope,
  sessionList: Session[],
): boolean {
  const rated = sessionList.filter((s) => typeof s.result?.rating === "number");
  if (rated.length < 3) return false;

  if (scope.level === "roaster" || scope.level === "process-roast") {
    const uniqueCoffees = new Set(
      rated
        .map((s) => {
          const c = s.coffee;
          if (!c) return null;
          return (
            c.coffeeId ??
            (c.roaster && c.name
              ? `${c.roaster}__${c.name}`.toLowerCase()
              : null)
          );
        })
        .filter((x): x is string => x !== null),
    );
    if (uniqueCoffees.size < 2) return false;
  }

  return true;
}

/**
 * Pull every session that contributes to a given (level, scope).
 * Used both online (post-brew distillation) and by the backfill script.
 */
export async function loadSessionsForScope(
  scope: DistillScope,
  limit = 30,
): Promise<Session[]> {
  const rows = await db.select().from(sessions);
  const all: Session[] = rows.map(rowToSession);
  const filtered = all.filter((s) => {
    const sScopes = scopesForSession(s);
    return sScopes.some(
      (x) => x.level === scope.level && x.scope === scope.scope,
    );
  });
  filtered.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return filtered.slice(0, limit);
}

const SYSTEM_PROMPT = `You are BTTS's memory writer — an SCA-trained barista coach distilling the user's brew history into ONE durable directive per scope.

You ground every diagnosis in the SCA Brewing Foundations block injected with each turn (Gold Cup extraction 18–22%, TDS 1.15–1.45%, Golden Ratio 55–75 g/L, 90–96°C water, grind-follows-the-brewer, paper-vs-metal-filter cup profile, washed vs natural processing signatures, light-vs-dark roast chemistry, the 5 basic tastes, the Flavor Wheel families). These are canonical ground truth — quote the numbers and frames when relevant, never contradict them.

You sound like a coach, not a data analyst. Diagnoses reference mechanism (what's over- or under-extracted per the Brewing Control Chart, what aromatic phase, what physical cause). Recommendations cite recipes by NAME (their title plus the originator: "Hoffmann Water-First Clever", "Kasuya 4:6", "Peng three-roast staged-temperature"). Techniques get cited by their atomic name from the vocabulary below ("swirl-not-stir", "Rao spin", "phase-separated-pouring", "low-temp-long-steep") rather than re-described.

COFFEE IS MULTIVARIATE. Before assigning blame to a recipe, consider:
- Bag age — <7d too fresh, heavy CO₂; 7–21d peak window; 22–35d slightly past; 35–60d past peak, aromatics softening; 60+ stale, body collapses
- Recipe family — Hoffmann (swirl, water-first), Kasuya (4:6 phase-separated), Wölfl (Orea Fast, turbulent), Peng (staged-temp, melodrip), Rao (rule-of-thirds, spin), Perger (high agitation, high extraction), Gagné (low-temp long steep) — each is different physics
- Water source — clarity blend (~73 ppm, low buffering) sharpens aromatic & acid expression on delicate washed coffees; filtered tap (~220 ppm) gives more body and balance but mutes high florals
- Grind drift — burr seasoning + calibration shifts over months; a "same recipe" can flow differently across weeks
- Pour technique — agitation level, pulse timing, drawdown geometry
- Roast inconsistency at the source — some bags are simply uneven, not the brewer's fault
- Palate fluctuation day to day

ONE TOOL PER TURN.

write_lesson when the evidence is clean: 3+ rated brews, a consistent pattern, ONE variable clearly standing out. Be a coach issuing a directive: name the mechanism, cite the technique vocabulary, reference the specific recipe family. Paraphrase freeNotes into the directive without quoting.

ask_for_clarification when multiple plausible causes could explain the pattern. Draft = your best guess as if you'd called write_lesson; questions = how you'd want to be wrong. Questions must be SPECIFIC — name the brews, the dates, the recipes, the candidate causes. Options must be PLAUSIBLE — each one a real explanation written in the user's voice, not a placeholder. NO generic "Was it the recipe?" — name the recipes. NO generic "Was it the age?" — name the day count and what shifts in that window per the freshness curve above.

Every scope you see has already passed a sample-size gate (≥3 brews, and ≥2 different coffees for roaster / process-roast). Below-threshold scopes never reach you. So you do NOT need to caveat that a single brew is too small to call — by the time you're asked, the data is there.

Metric units. No emojis. No quotation marks anywhere in your output. Output prose, not bullet lists.`;

const FINALISE_PROMPT = `You previously drafted a lesson and asked the user clarifying questions about this scope. The user has now answered. Incorporate their answers and commit the final directive via write_lesson.

Preserve what was right in the draft. Adjust what the answers contradict. If their answer fundamentally changes your diagnosis (you blamed the recipe but they blame the age), rewrite cleanly to match their understanding — their answer is ground truth.

Same constraints as before: 1–3 short sentences, plain prose, no quotation marks, no emojis, metric units only, reference recipe NAMES.`;

/** Live distiller output: either a confident lesson or an uncertain
 * draft that needs clarification. upsertLesson() branches on `kind`. */
export type DistillOutput =
  | { kind: "confident"; content: string; confidenceN: number }
  | { kind: "uncertain"; draft: string; confidenceN: number; questions: LessonQuestion[] };

interface DistillResult {
  content: string;
  confidence_n: number;
}

function formatSessionsForPrompt(sessionList: Session[]): string {
  return sessionList
    .map((s) => {
      const { recipe, candidate, method } = resolveBrewedRecipe(s);
      const recipeName = brewedRecipeName(candidate);
      const date = new Date(s.createdAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const rating = s.result?.rating != null ? `${s.result.rating}★` : "unrated";
      const dose = s.brew?.doseGrams ?? recipe?.doseGrams;
      const water = s.brew?.waterGrams ?? recipe?.waterGrams;
      const grind = s.brew?.grindSettingUsed ?? recipe?.grindSize;
      const temp = s.brew?.actualTempC ?? recipe?.waterTempC;
      const flavors = s.result?.flavorNotes?.slice(0, 4).join(", ") || "";
      const free = s.result?.freeNotes
        ? ` freeNote="${s.result.freeNotes.replace(/\n/g, " ").slice(0, 400)}"`
        : "";
      const attr = s.result?.attribution
        ? ` attribution=${s.result.attribution}`
        : "";
      const fit = s.result?.fit ? ` fit=${s.result.fit}` : "";
      const recipeLine = recipeName
        ? `${method} "${recipeName}"`
        : method;
      const recipeParams: string[] = [];
      if (dose != null) recipeParams.push(`${dose}g`);
      if (water != null) recipeParams.push(`${water}g`);
      if (grind != null && grind !== "") {
        recipeParams.push(typeof grind === "number" ? `${grind}°` : `${grind}`);
      }
      if (temp != null) recipeParams.push(`${temp}°C`);
      return `- ${date} · ${rating} · ${recipeLine} · ${recipeParams.join("/")} · [${flavors}]${free}${attr}${fit}`;
    })
    .join("\n");
}

/** Compact technique vocabulary — every distill turn gets this so
 * Haiku can cite techniques by id rather than re-invent coaching-speak. */
function formatTechniqueVocabulary(): string {
  return (
    "TECHNIQUE VOCABULARY (cite by id, do not re-describe):\n" +
    TECHNIQUES.map((t) => `  - ${t.id}: ${t.description}`).join("\n")
  );
}

/** Pick recipes most likely relevant for a given scope so the lesson
 * can name them directly. Different rules per level — see comments. */
function selectKnowledgeRecipes(
  scope: DistillScope,
  sessionList: Session[],
): string[] {
  const lines: string[] = [];

  if (scope.level === "method-style") {
    const parts = scope.scope.split("·").map((s) => s.trim());
    const basedOn = parts[1] ?? "";
    const match = ALL_RECIPES.find(
      (r) =>
        r.name.toLowerCase() === basedOn.toLowerCase() ||
        r.shortName.toLowerCase() === basedOn.toLowerCase() ||
        r.id.toLowerCase().includes(basedOn.toLowerCase().replace(/\s+/g, "-")),
    );
    if (match) {
      const temp =
        match.temperature.celsius ??
        (match.temperature.rangeC ? match.temperature.rangeC[0] : null);
      lines.push(
        `Reference recipe — ${match.name} by ${match.attribution.person}: dose ${match.dose.grams}g, water ${match.water.grams}g (${match.water.ratio}), ${temp != null ? `temperature ${temp}°C, ` : ""}total ${match.totalTimeSec}s, brewer ${match.brewer}.`,
      );
      lines.push(`Teaches: ${match.teaches}`);
      lines.push(`Mechanism: ${match.science}`);
      if (match.techniques.length > 0) {
        lines.push(`Techniques used: ${match.techniques.join(", ")}`);
      }
    }
  }

  if (scope.level === "process-roast") {
    const parts = scope.scope.split("×").map((s) => s.trim());
    const process = parts[0] ?? "";
    const matches = ALL_RECIPES.filter((r) =>
      r.bestFor.processes?.some(
        (p) => p.toLowerCase() === process.toLowerCase(),
      ),
    ).slice(0, 3);
    for (const r of matches) {
      lines.push(
        `- ${r.shortName} (${r.attribution.person}): ${r.teaches}`,
      );
    }
  }

  // Pull recipes authored by people referenced in this scope's brews —
  // surfaces the originator's actual numbers as ground truth when the
  // user has been brewing e.g. Kasuya 4:6 or Hoffmann Better 1 Cup.
  const seenAuthors = new Set<string>();
  for (const s of sessionList.slice(0, 5)) {
    const { candidate } = resolveBrewedRecipe(s);
    const basedOn = candidate?.basedOn?.trim();
    if (!basedOn || basedOn.toLowerCase() === "own recipe") continue;
    if (seenAuthors.has(basedOn)) continue;
    seenAuthors.add(basedOn);
    const recipes = findRecipesByPerson(basedOn);
    if (recipes.length > 0) {
      const r = recipes[0];
      const temp =
        r.temperature.celsius ??
        (r.temperature.rangeC ? r.temperature.rangeC[0] : null);
      lines.push(
        `- ${r.shortName} (${r.attribution.person}): ${r.dose.grams}g/${r.water.grams}g${temp != null ? ` @ ${temp}°C` : ""}, ${r.totalTimeSec}s. ${r.teaches}`,
      );
    }
  }

  return lines;
}

// SCA Brewing Foundations — always-injected ground truth.
// Computed once at module load (the corpus doesn't change between
// turns), so every Haiku call gets the same block without re-rendering.
const SCA_BLOCK = formatScaFoundationsForPrompt();

/** Per-scope knowledge block injected into Haiku's user message. */
function buildKnowledgeBlock(scope: DistillScope, sessionList: Session[]): string {
  const lines: string[] = [SCA_BLOCK];

  // Roaster prior — for coffee + roaster scopes
  if (scope.level === "coffee" || scope.level === "roaster") {
    const roaster = sessionList[0]?.coffee?.roaster;
    if (roaster) {
      const prior = getRoasterPrior(roaster);
      if (prior.confidence !== "fallback") {
        lines.push(formatRoasterPriorForPrompt(prior));
      }
    }
  }

  // Variety priors — for coffee scope when the bag has a variety
  if (scope.level === "coffee") {
    const variety = sessionList[0]?.coffee?.variety;
    if (variety) {
      const priors = getVarietyPriorsForBag(variety);
      if (priors.length > 0) {
        lines.push(formatVarietyPriorsForPrompt(priors));
      }
    }
  }

  // Recipe context — method-style cites a specific reference; others
  // cite recipes by authors the user has actually been brewing.
  const recipeLines = selectKnowledgeRecipes(scope, sessionList);
  if (recipeLines.length > 0) {
    lines.push(
      "RELEVANT REFERENCE RECIPES (the originator's actual numbers — use as ground truth):\n" +
        recipeLines.join("\n"),
    );
  }

  // Technique vocabulary — always
  lines.push(formatTechniqueVocabulary());

  return lines.join("\n\n");
}

/** The two-tool array passed to the Haiku distillation call. Shared with
 * the backfill script (mirrored there in JS — keep in sync). */
const DISTILL_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "write_lesson",
    description:
      "Use when the evidence is clean: 3+ rated brews, consistent pattern, one variable clearly standing out as the cause. Be a coach issuing a directive. Never call this AND ask_for_clarification in the same turn.",
    input_schema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description:
            "1–3 short sentences, plain prose, no quotation marks. A directive — prefer X / avoid Y / remember Z. Reference recipe NAMES (title plus based-on). Paraphrase freeNotes; never quote them.",
        },
        confidence_n: {
          type: "integer",
          description: "Number of rated brews backing this lesson.",
        },
      },
      required: ["content", "confidence_n"],
    },
  },
  {
    name: "ask_for_clarification",
    description:
      "Use when multiple plausible causes could explain the pattern and you genuinely need the user's input to disambiguate. Examples: a single bad brew on a 42-day-old bag (recipe vs age?); a method change coinciding with a water source change; inconsistent ratings on the same recipe across weeks. Never call this AND write_lesson in the same turn.",
    input_schema: {
      type: "object",
      properties: {
        draft: {
          type: "string",
          description:
            "Your tentative directive — what you'd commit if your best guess were correct. The user reads this alongside the questions. Same constraints as write_lesson.content.",
        },
        confidence_n: {
          type: "integer",
          description: "Number of rated brews backing this draft.",
        },
        questions: {
          type: "array",
          minItems: 1,
          maxItems: 2,
          items: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description:
                  "ONE concrete question naming the actual ambiguity. Reference the specific brews, recipe names, and dates. Not generic.",
              },
              options: {
                type: "array",
                minItems: 2,
                maxItems: 4,
                items: { type: "string" },
                description:
                  "Plausible explanations the user can tap, written in the user's voice. Each option is a real candidate explanation, not a hedge.",
              },
            },
            required: ["prompt", "options"],
          },
        },
      },
      required: ["draft", "confidence_n", "questions"],
    },
  },
];

async function callHaikuForDistillation(
  scope: DistillScope,
  sessionList: Session[],
  existing: LessonRow | null,
): Promise<DistillOutput | null> {
  const ratedCount = sessionList.filter((s) => s.result?.rating != null).length;
  if (ratedCount === 0) return null;

  const knowledgeBlock = buildKnowledgeBlock(scope, sessionList);
  const userMessage = `Level: ${scope.level}
Scope: ${scope.label}

${knowledgeBlock}

${existing?.content ? `Existing lesson (revise if the new evidence changes it; keep what still holds): ${existing.content}\n\n` : ""}Brews backing this scope (most recent first, max 30):
${formatSessionsForPrompt(sessionList)}

Choose ONE tool — write_lesson if the signal is clean, ask_for_clarification if it isn't.`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: DISTILL_TOOLS,
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: userMessage }],
    });

    const toolBlock = msg.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
    );
    if (!toolBlock) return null;

    if (toolBlock.name === "write_lesson") {
      const input = toolBlock.input as {
        content?: unknown;
        confidence_n?: unknown;
      };
      const content =
        typeof input.content === "string" ? input.content.trim() : "";
      const confidenceN =
        typeof input.confidence_n === "number"
          ? Math.max(0, Math.floor(input.confidence_n))
          : ratedCount;
      if (!content) return null;
      return { kind: "confident", content, confidenceN };
    }

    if (toolBlock.name === "ask_for_clarification") {
      const input = toolBlock.input as {
        draft?: unknown;
        confidence_n?: unknown;
        questions?: unknown;
      };
      const draft = typeof input.draft === "string" ? input.draft.trim() : "";
      const confidenceN =
        typeof input.confidence_n === "number"
          ? Math.max(0, Math.floor(input.confidence_n))
          : ratedCount;
      const rawQs = Array.isArray(input.questions) ? input.questions : [];
      const questions: LessonQuestion[] = rawQs.flatMap((q): LessonQuestion[] => {
        if (!q || typeof q !== "object") return [];
        const obj = q as { prompt?: unknown; options?: unknown };
        const prompt = typeof obj.prompt === "string" ? obj.prompt.trim() : "";
        const options = Array.isArray(obj.options)
          ? obj.options
              .filter((o): o is string => typeof o === "string" && o.trim().length > 0)
              .map((o) => o.trim())
              .slice(0, 4)
          : [];
        if (!prompt || options.length < 2) return [];
        const lq: LessonQuestion = { id: randomUUID(), prompt, options };
        return [lq];
      });
      if (!draft || questions.length === 0) return null;
      return { kind: "uncertain", draft, confidenceN, questions };
    }

    return null;
  } catch (err) {
    console.error(`distillLesson(${scope.level}:${scope.scope}) error:`, err);
    return null;
  }
}

/** Second-turn Haiku call: given a pending draft + the user's answers,
 * finalise the lesson via write_lesson. Used by POST /api/lessons/[id]/answer. */
async function callHaikuToFinalise(
  scope: DistillScope,
  sessionList: Session[],
  draft: string,
  questions: LessonQuestion[],
  answers: LessonAnswer[],
): Promise<DistillResult | null> {
  const ratedCount = sessionList.filter((s) => s.result?.rating != null).length;

  const qAndA = questions
    .map((q) => {
      const a = answers.find((ans) => ans.questionId === q.id);
      const answerText = a
        ? [a.selected, a.freeText].filter(Boolean).join(" — ")
        : "(no answer)";
      return `Q: ${q.prompt}\nA: ${answerText}`;
    })
    .join("\n\n");

  const knowledgeBlock = buildKnowledgeBlock(scope, sessionList);
  const userMessage = `Level: ${scope.level}
Scope: ${scope.label}

${knowledgeBlock}

Draft you wrote earlier: ${draft}

Brews backing this scope (most recent first, max 30):
${formatSessionsForPrompt(sessionList)}

User's answers to your clarifying questions:
${qAndA}

Now commit the final directive via write_lesson.`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 600,
      system: FINALISE_PROMPT,
      tools: [DISTILL_TOOLS[0]],
      tool_choice: { type: "tool", name: "write_lesson" },
      messages: [{ role: "user", content: userMessage }],
    });
    const toolBlock = msg.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
    );
    if (!toolBlock) return null;
    const input = toolBlock.input as { content?: unknown; confidence_n?: unknown };
    const content =
      typeof input.content === "string" ? input.content.trim() : "";
    const confidence_n =
      typeof input.confidence_n === "number"
        ? Math.max(0, Math.floor(input.confidence_n))
        : ratedCount;
    if (!content) return null;
    return { content, confidence_n };
  } catch (err) {
    console.error(`finaliseLesson(${scope.level}:${scope.scope}) error:`, err);
    return null;
  }
}

/**
 * Upsert one lesson row. Preserves user-touched fields:
 *   - status === 'dismissed' is NEVER reset to active by auto distillation.
 *   - source becomes 'user-edited' only if the user explicitly edits;
 *     auto runs stay 'auto'.
 *   - user_note is never overwritten.
 */
async function upsertLesson(
  scope: DistillScope,
  output: DistillOutput,
  sessionList: Session[],
  source: LessonSource = "auto",
): Promise<void> {
  const evidence = sessionList.slice(0, 12).map((s) => s.id);
  const existing = await db
    .select()
    .from(lessons)
    .where(and(eq(lessons.level, scope.level), eq(lessons.scope, scope.scope)))
    .limit(1);
  const now = new Date();

  // Decide what content/status to write based on which tool Haiku chose.
  const content =
    output.kind === "confident" ? output.content : output.draft;
  const status: "active" | "pending" =
    output.kind === "confident" ? "active" : "pending";
  const questions: LessonQuestion[] | null =
    output.kind === "uncertain" ? output.questions : null;

  if (existing.length === 0) {
    await db.insert(lessons).values({
      id: randomUUID(),
      level: scope.level,
      scope: scope.scope,
      content,
      confidenceN: output.confidenceN,
      evidenceSessionIds: evidence,
      source,
      status,
      questions,
      answers: null,
      createdAt: now,
      updatedAt: now,
    });
    return;
  }

  const row = existing[0];
  // User-edited rows are sacred — the user explicitly rewrote this
  // lesson. Auto distillation MUST NOT overwrite their text. Skip
  // entirely. Only an explicit user-edited source coming back in
  // (the PATCH route) can change the row's content from here on.
  if (row.source === "user-edited" && source !== "user-edited") return;

  await db
    .update(lessons)
    .set({
      content,
      confidenceN: output.confidenceN,
      evidenceSessionIds: evidence,
      // Only escalate source on explicit user edits — leave auto-on-auto alone.
      source: row.source === "user-edited" ? row.source : source,
      status,
      questions,
      // Going from pending → confident means the answers are now stale —
      // null them out. Going confident → confident keeps answers as null.
      // Going pending → pending replaces with new questions, so old
      // answers are invalid: null them out too.
      answers: null,
      updatedAt: now,
    })
    .where(eq(lessons.id, row.id));
}

/**
 * Distill all four scopes for a single session. Called from POST
 * /api/sessions in a fire-and-forget after the response is sent — never
 * blocks the save. Returns the number of lessons upserted.
 *
 * Skips per scope:
 *   - below the pattern threshold (see meetsPatternThreshold)
 *   - user-edited rows (the user's text is the truth)
 *   - pending rows (the user is mid-answer; don't yank the questions
 *     out from under them with a new auto run)
 *
 * The OLD per-session "is this rating extreme enough to count" gate is
 * gone. Lessons emerge from sample-size now, not from any single brew
 * being hot or cold. A 3.5★ brew counts the same as a 5★ once the
 * threshold is met.
 */
export async function distillLessonsForSession(session: Session): Promise<number> {
  const scopes = scopesForSession(session);
  if (scopes.length === 0) return 0;

  const results = await Promise.allSettled(
    scopes.map(async (scope) => {
      const sessionList = await loadSessionsForScope(scope);
      if (!meetsPatternThreshold(scope, sessionList)) return false;
      const existingRows = await db
        .select()
        .from(lessons)
        .where(and(eq(lessons.level, scope.level), eq(lessons.scope, scope.scope)))
        .limit(1);
      const existing = existingRows[0] ?? null;
      if (existing?.source === "user-edited") return false;
      if (existing?.status === "pending") return false;
      const distillation = await callHaikuForDistillation(
        scope,
        sessionList,
        existing,
      );
      if (!distillation) return false;
      await upsertLesson(scope, distillation, sessionList);
      return true;
    }),
  );

  return results.filter(
    (r) => r.status === "fulfilled" && r.value === true,
  ).length;
}

/**
 * Distill a single explicit scope (used by the backfill script).
 * Returns true if a lesson was upserted.
 */
export async function distillLessonForScope(
  scope: DistillScope,
  source: LessonSource = "backfill",
): Promise<boolean> {
  const sessionList = await loadSessionsForScope(scope);
  if (!meetsPatternThreshold(scope, sessionList)) return false;
  const existingRows = await db
    .select()
    .from(lessons)
    .where(and(eq(lessons.level, scope.level), eq(lessons.scope, scope.scope)))
    .limit(1);
  const existing = existingRows[0] ?? null;
  if (existing?.source === "user-edited") return false;
  if (existing?.status === "pending") return false;
  const distillation = await callHaikuForDistillation(scope, sessionList, existing);
  if (!distillation) return false;
  await upsertLesson(scope, distillation, sessionList, source);
  return true;
}

/**
 * Finalise a pending lesson now that the user has answered the
 * clarifying questions. Called from POST /api/lessons/[id]/answer.
 *
 * Runs a second Haiku turn (single-tool, write_lesson forced) with the
 * draft + questions + user's answers. Updates the row in place:
 *   - content = final directive from the second turn
 *   - status  = 'active'
 *   - answers = stored (kept for audit, surfaced on the page)
 *   - questions kept (so the page can show "you answered X to Y")
 *
 * Returns the updated row, or null if Haiku couldn't produce a final
 * content (caller can re-prompt or surface the error).
 */
export async function finaliseLessonWithAnswers(
  lessonId: string,
  answers: LessonAnswer[],
): Promise<LessonRow | null> {
  const existingRows = await db
    .select()
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);
  const row = existingRows[0];
  if (!row) return null;
  if (row.status !== "pending") return null;
  if (!row.questions || row.questions.length === 0) return null;

  const scope: DistillScope = {
    level: row.level,
    scope: row.scope,
    label: row.scope, // best we can do without re-resolving — Haiku still sees full session detail
  };
  const sessionList = await loadSessionsForScope(scope);

  const finalised = await callHaikuToFinalise(
    scope,
    sessionList,
    row.content,
    row.questions,
    answers,
  );
  if (!finalised) return null;

  const now = new Date();
  await db
    .update(lessons)
    .set({
      content: finalised.content,
      confidenceN: finalised.confidence_n,
      status: "active",
      answers,
      // questions preserved for audit. source stays whatever it was
      // (typically 'auto' or 'backfill'); the user didn't write the
      // content themselves, they just answered.
      updatedAt: now,
    })
    .where(eq(lessons.id, lessonId));

  const refreshed = await db
    .select()
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);
  return refreshed[0] ?? null;
}

/**
 * Read active lessons relevant to a recommend turn — used by Phase 4.
 * Returns rows shaped for prompt injection.
 */
export async function loadLessonsForRecommend(opts: {
  coffeeId?: string | null;
  roaster?: string | null;
  process?: string | null;
  roastLevel?: string | null;
}): Promise<LessonRow[]> {
  const scopes: { level: LessonLevel; scope: string }[] = [];
  if (opts.coffeeId) scopes.push({ level: "coffee", scope: opts.coffeeId });
  if (opts.roaster)
    scopes.push({ level: "roaster", scope: opts.roaster.toLowerCase().trim() });
  if (opts.process && opts.roastLevel) {
    scopes.push({
      level: "process-roast",
      scope: `${opts.process} × ${opts.roastLevel}`.toLowerCase().trim(),
    });
  }
  if (scopes.length === 0) return [];

  // One predicate per scope, OR'd together via Drizzle's inArray-style trick:
  // we do four cheap point lookups in parallel.
  const results = await Promise.all(
    scopes.map((s) =>
      db
        .select()
        .from(lessons)
        .where(
          and(
            eq(lessons.level, s.level),
            eq(lessons.scope, s.scope),
            eq(lessons.status, "active"),
          ),
        )
        .limit(1),
    ),
  );
  return results.flat();
}

/**
 * Load every active method-style lesson — recipe-family directives are
 * inherently cross-cutting (Hoffmann-style is a property of the recipe,
 * not the coffee), so /recommend pulls them all when picking candidates.
 * Capped to keep the prompt tight.
 */
export async function loadMethodStyleLessons(limit = 8): Promise<LessonRow[]> {
  const rows = await db
    .select()
    .from(lessons)
    .where(and(eq(lessons.level, "method-style"), eq(lessons.status, "active")));
  return rows.slice(0, limit);
}

// Re-export helpers the backfill script needs.
export type { LessonRow };
export { lessons as lessonsTable, sessions as sessionsTable };
export { inArray };
