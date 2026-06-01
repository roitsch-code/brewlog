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
import type { LessonLevel, LessonRow, LessonSource } from "@/lib/db/schema";
import type { Session } from "@/lib/types/session";
import { resolveBrewedRecipe, brewedRecipeName } from "@/lib/utils/resolveRecipe";

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
 * High-signal heuristic. Only brews carrying useful information move the
 * lessons forward — running Haiku on every neutral 3★ no-note brew is
 * waste.
 */
export function isHighSignal(session: Session): boolean {
  const r = session.result;
  if (!r) return false;
  if (typeof r.rating === "number" && (r.rating <= 2 || r.rating >= 4)) return true;
  if (r.freeNotes && r.freeNotes.trim().length > 8) return true;
  return false;
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

const SYSTEM_PROMPT = `You are BTTS's memory writer. You distill a user's brew history into ONE durable directive — a single short paragraph that a recommendation prompt can quote verbatim months from now.

Output exactly this JSON shape, nothing else:

{
  "content": "ONE paragraph, 1–3 short sentences. A concrete, actionable directive — what to prefer, what to avoid, what to remember. Reference real numbers (ratings, recipe names, methods). If two recipes diverge in outcome, name both. If freeNotes flag a meta-fact about the coffee/roaster (e.g. roasted for espresso, fermented hot, stale), surface it. Plain prose, no bullets, no JSON-in-JSON, no emojis. Metric units only.",
  "confidence_n": <integer count of rated brews backing this lesson>
}

Constraints:
- One paragraph only. If you can't be concrete, return empty content "".
- Prefer "Avoid X for this coffee" / "Prefer Y" over generic "experiment more".
- Cite recipe NAMES (the title + based-on), not just methods, when distinguishing what worked.
- Where freeNotes contain a meta-observation the user typed (e.g. "this is an espresso roast"), include it verbatim as a quoted phrase.
- No hedging. The user wants a directive, not advice.`;

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

async function callHaikuForDistillation(
  scope: DistillScope,
  sessionList: Session[],
  existing: LessonRow | null,
): Promise<DistillResult | null> {
  const ratedCount = sessionList.filter((s) => s.result?.rating != null).length;
  if (ratedCount === 0) return null;

  const userMessage = `Level: ${scope.level}
Scope: ${scope.label}

${existing?.content ? `Existing lesson (revise if the new evidence changes it; keep what still holds):\n"${existing.content}"\n\n` : ""}Brews backing this scope (most recent first, max 30):
${formatSessionsForPrompt(sessionList)}

Write the updated directive now.`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });
    const rawText = (msg.content[0] as { type: string; text: string })?.text?.trim();
    if (!rawText) return null;
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
    const content = typeof parsed.content === "string" ? parsed.content.trim() : "";
    const confidence_n =
      typeof parsed.confidence_n === "number"
        ? Math.max(0, Math.floor(parsed.confidence_n))
        : ratedCount;
    if (!content) return null;
    return { content, confidence_n };
  } catch (err) {
    console.error(`distillLesson(${scope.level}:${scope.scope}) error:`, err);
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
  result: DistillResult,
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
  if (existing.length === 0) {
    await db.insert(lessons).values({
      id: randomUUID(),
      level: scope.level,
      scope: scope.scope,
      content: result.content,
      confidenceN: result.confidence_n,
      evidenceSessionIds: evidence,
      source,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  } else {
    const row = existing[0];
    await db
      .update(lessons)
      .set({
        content: result.content,
        confidenceN: result.confidence_n,
        evidenceSessionIds: evidence,
        // Only escalate source on explicit user edits — leave auto-on-auto alone.
        source: row.source === "user-edited" ? row.source : source,
        updatedAt: now,
      })
      .where(eq(lessons.id, row.id));
  }
}

/**
 * Distill all four scopes for a single session. Called from POST
 * /api/sessions in a fire-and-forget after the response is sent — never
 * blocks the save. Returns the number of lessons upserted.
 */
export async function distillLessonsForSession(session: Session): Promise<number> {
  if (!isHighSignal(session)) return 0;
  const scopes = scopesForSession(session);
  if (scopes.length === 0) return 0;

  const results = await Promise.allSettled(
    scopes.map(async (scope) => {
      const sessionList = await loadSessionsForScope(scope);
      if (sessionList.length === 0) return false;
      const existingRows = await db
        .select()
        .from(lessons)
        .where(and(eq(lessons.level, scope.level), eq(lessons.scope, scope.scope)))
        .limit(1);
      const existing = existingRows[0] ?? null;
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
  if (sessionList.length === 0) return false;
  const existingRows = await db
    .select()
    .from(lessons)
    .where(and(eq(lessons.level, scope.level), eq(lessons.scope, scope.scope)))
    .limit(1);
  const existing = existingRows[0] ?? null;
  const distillation = await callHaikuForDistillation(scope, sessionList, existing);
  if (!distillation) return false;
  await upsertLesson(scope, distillation, sessionList, source);
  return true;
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
