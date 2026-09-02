import type { CoffeeIdentity, Session } from "../types/session";
import { resolveBrewedRecipe } from "../utils/resolveRecipe";
import { brewMethodKey } from "../utils/brewMethodKey";

/**
 * The user's OWN well-rated brews, offered to the recommender as reference
 * recipes alongside the published corpus.
 *
 * Until now the 136 documented recipes were the only things a candidate could
 * be `basedOn`; the user's own brews reached the prompt as loose "recent
 * recipes" context, so the single most relevant fact available — "this exact
 * bag scored 4.5 on the Orea Classic six weeks ago, here is the pour plan" —
 * was never something the model could actually build on. With 184 logged brews
 * that is the most valuable reference material in the app, because unlike a
 * published recipe it was measured on this kit, this water and this palate.
 *
 * What it deliberately does NOT do:
 *   - promote a mediocre brew. Only MIN_RATING and above, so "what I did last
 *     time" never becomes the default when last time was unremarkable.
 *   - resurrect a one-off. A brew has to carry a real pour plan and the
 *     numbers to reproduce it, or it is not a recipe, it is a note.
 *   - drown the corpus. At most MAX_REFERENCES, ranked by how much they
 *     actually tell us about the coffee in hand: same bag first, then same
 *     origin+process, then merely the same brewer.
 * The fidelity guard (reconcileToReference) only ever snaps candidates back to
 * VERIFIED corpus recipes, and these names never match one, so an own-reference
 * candidate is left exactly as the model wrote it — intentional: there is no
 * published source to snap to, and the user's own numbers are not a drift.
 */

export const MIN_RATING = 4;
export const MAX_REFERENCES = 3;

/**
 * Immersion vs pour-over are separate brewing CATEGORIES, not interchangeable
 * "brewer variety" — a Clever (immersion) is never a like-for-like swap for a
 * V60 (pour-over). Own-references are varied WITHIN a category and never
 * cross-substituted (owner rule). Keyed on the brewer family via brewMethodKey,
 * which collapses "AeroPress" / "AeroPress (Prismo)" → "aeropress" and any
 * "Clever …" → "clever".
 */
export type BrewCategory = "immersion" | "pour-over";
const IMMERSION_FAMILIES: ReadonlySet<string> = new Set(["clever", "aeropress"]);
export function ownRefCategory(method: string): BrewCategory {
  return IMMERSION_FAMILIES.has(brewMethodKey(method)) ? "immersion" : "pour-over";
}

export interface OwnReference {
  /** Stable, quotable name — this is what `basedOn` has to echo. */
  name: string;
  rating: number;
  method: string;
  coffee: string;
  dateLabel: string;
  doseGrams: number;
  waterGrams: number;
  waterTempC?: number;
  grindSize?: string;
  targetTimeSec?: number;
  actualTimeSec?: number;
  pourPlan?: string;
  notes?: string;
  /** 3 = same bag, 2 = same origin+process, 1 = same brewer. */
  relevance: number;
  /** Immersion (Clever/AeroPress) vs pour-over — never mixed as "variety". */
  category: BrewCategory;
}

function shortDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function mmss(sec: number | undefined): string {
  if (typeof sec !== "number" || !(sec > 0)) return "";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Cumulative-grams milestone string, from structured steps or the legacy field. */
function pourPlanOf(recipe: {
  pourSteps?: { action: string; waterGramsAtEnd?: number; label?: string }[];
  pourSequence?: string;
}): string | undefined {
  const steps = recipe.pourSteps;
  if (Array.isArray(steps) && steps.length > 0) {
    const grams = steps
      .map((s) => s.waterGramsAtEnd)
      .filter((g): g is number => typeof g === "number" && g > 0);
    if (grams.length >= 2) return grams.join(" – ");
  }
  return recipe.pourSequence?.trim() || undefined;
}

function sameBag(s: Session, coffee: CoffeeIdentity): boolean {
  if (coffee.coffeeId && s.coffee?.coffeeId) return s.coffee.coffeeId === coffee.coffeeId;
  const a = `${s.coffee?.roaster ?? ""}|${s.coffee?.name ?? ""}`.toLowerCase().trim();
  const b = `${coffee.roaster ?? ""}|${coffee.name ?? ""}`.toLowerCase().trim();
  return a.length > 1 && a === b;
}

function sameOriginProcess(s: Session, coffee: CoffeeIdentity): boolean {
  const o = (s.coffee?.origin ?? "").toLowerCase().trim();
  const p = (s.coffee?.process ?? "").toLowerCase().trim();
  const co = (coffee.origin ?? "").toLowerCase().trim();
  const cp = (coffee.process ?? "").toLowerCase().trim();
  return !!o && o === co && !!p && p === cp;
}

/**
 * Pick the user's most relevant well-rated brews for the coffee in hand.
 * `brewersAvailable` is the canonical brewer-key set the recommendation is
 * allowed to use (a locked method narrows it); a brew on a brewer that is out
 * of scope for this session is not a useful reference.
 */
export function buildOwnReferences(
  pastSessions: Session[],
  coffee: CoffeeIdentity,
  allowedMethodKeys?: Set<string>,
): OwnReference[] {
  const candidates: OwnReference[] = [];

  for (const s of pastSessions) {
    const rating = s.result?.rating;
    if (typeof rating !== "number" || rating < MIN_RATING) continue;

    const { recipe } = resolveBrewedRecipe(s);
    if (!recipe) continue;
    const dose = recipe.doseGrams;
    const water = recipe.waterGrams;
    if (!(typeof dose === "number" && dose > 0)) continue;
    if (!(typeof water === "number" && water > 0)) continue;

    const method = s.brew?.methodUsed || s.recommendation?.primaryMethod || "";
    if (!method) continue;
    if (allowedMethodKeys && allowedMethodKeys.size > 0) {
      if (!allowedMethodKeys.has(brewMethodKey(method))) continue;
    }

    const pourPlan = pourPlanOf(recipe);
    // No pour plan means it can't be reproduced step by step — the one thing a
    // reference recipe has to provide.
    if (!pourPlan) continue;

    const relevance = sameBag(s, coffee) ? 3 : sameOriginProcess(s, coffee) ? 2 : 1;
    const coffeeName = [s.coffee?.roaster, s.coffee?.name].filter(Boolean).join(" ").trim();
    const dateLabel = shortDate(s.createdAt);

    candidates.push({
      name: `Your ${method} — ${coffeeName || "own brew"}${dateLabel ? ` (${dateLabel})` : ""}`,
      rating,
      method,
      coffee: coffeeName,
      dateLabel,
      doseGrams: dose,
      waterGrams: water,
      waterTempC: recipe.waterTempC,
      grindSize: recipe.grindSize,
      targetTimeSec: recipe.targetTimeSec,
      actualTimeSec: s.brew?.actualTimeSec,
      pourPlan,
      notes: s.result?.freeNotes?.trim() || undefined,
      relevance,
      category: ownRefCategory(method),
    });
  }

  // One entry per (bag × brewer): repeating the same pairing three times would
  // spend the whole budget saying one thing. Best-rated wins, then most recent
  // (the array arrives newest-first, so the first hit is the newer one).
  const bestPerPairing = new Map<string, OwnReference>();
  for (const c of candidates) {
    const key = `${c.coffee.toLowerCase()}|${brewMethodKey(c.method)}`;
    const held = bestPerPairing.get(key);
    if (!held || c.rating > held.rating) bestPerPairing.set(key, c);
  }

  // Spread the budget across distinct APPROACHES (brewer families) so the block
  // never says one thing three times (e.g. 3× Clever water-first) — the
  // self-reinforcing loop that made the recommender repeat the owner's beloved
  // Clever every turn. This is WITHIN-category variety only: it just avoids
  // near-identical entries, it never drops the user's own immersion brew to
  // insert a pour-over (or vice versa) — it only ever cites brews the user
  // actually logged, in relevance order.
  const sorted = Array.from(bestPerPairing.values()).sort(
    (a, b) => b.relevance - a.relevance || b.rating - a.rating,
  );
  const picked: OwnReference[] = [];
  const usedKeys = new Set<string>();
  // Pass 1: one per approach-key — but a same-bag (relevance 3) reference is the
  // single most relevant fact in the prompt, so it is kept UNCONDITIONALLY.
  for (const c of sorted) {
    if (picked.length >= MAX_REFERENCES) break;
    const key = brewMethodKey(c.method);
    if (c.relevance === 3) {
      picked.push(c);
      usedKeys.add(key);
      continue;
    }
    if (usedKeys.has(key)) continue;
    picked.push(c);
    usedKeys.add(key);
  }
  // Pass 2: if variety left slots empty (e.g. the owner only brews Clever),
  // backfill with the next-best remaining brews — distinct bags carry different
  // numbers/pour-plans, so it stays varied immersion, never a fabricated swap.
  if (picked.length < MAX_REFERENCES) {
    for (const c of sorted) {
      if (picked.length >= MAX_REFERENCES) break;
      if (picked.includes(c)) continue;
      picked.push(c);
    }
  }
  return picked;
}

/**
 * Format the own-reference block.
 *
 * `recentlyRecommended` — reference names that already appeared in the last few
 * sessions' candidates. An entry that matches gets an explicit "you have just
 * been served this, vary from it" marker. Without that, this block and the
 * RECENTLY RECOMMENDED note in the same user message pull in opposite
 * directions: one said "repeating a result they already loved is usually the
 * right answer" while the other asked for different references — and the
 * instruction carrying concrete numbers wins that argument every time.
 *
 * `dominantFamilies` — brewer-family keys (brewMethodKey form) that have led the
 * recent recommendation sets. A reference on a dominant family gets a WITHIN-
 * category "you have brewed this a lot lately, vary the recipe/technique" nudge
 * — never a cross-category "switch to a pour-over" push (immersion and pour-over
 * are not interchangeable). Fit still decides the category.
 */
export function formatOwnReferencesForPrompt(
  refs: OwnReference[],
  recentlyRecommended: string[] = [],
  dominantFamilies: Set<string> = new Set(),
): string {
  if (refs.length === 0) return "";
  const seenRecently = (name: string): boolean =>
    recentlyRecommended.some((r) => {
      const a = r.toLowerCase().trim();
      const b = name.toLowerCase().trim();
      if (!a || !b) return false;
      return a === b || (a.length >= 6 && b.includes(a)) || (b.length >= 6 && a.includes(b));
    });
  const lines = refs.map((r, i) => {
    const timing = [
      r.targetTimeSec ? `target ${mmss(r.targetTimeSec)}` : "",
      r.actualTimeSec ? `actual ${mmss(r.actualTimeSec)}` : "",
    ]
      .filter(Boolean)
      .join(", ");
    const scope =
      r.relevance === 3
        ? "THIS BAG"
        : r.relevance === 2
          ? "same origin + process"
          : "same brewer, different coffee";
    const familyDominant = dominantFamilies.has(brewMethodKey(r.method));
    const staleness = seenRecently(r.name)
      ? " — ALREADY RECOMMENDED RECENTLY: build on it, don't re-serve it"
      : familyDominant
        ? r.category === "immersion"
          ? " — YOU HAVE BREWED THIS IMMERSION APPROACH A LOT LATELY: if the bean still calls for immersion, vary the recipe/technique (bloom-first vs water-first, dose, grind) rather than re-serving this identical one. Do NOT switch to a pour-over just to be different — let fit decide the category."
          : " — YOU HAVE BREWED THIS POUR-OVER A LOT LATELY: if the bean still calls for pour-over, vary the recipe/technique rather than re-serving this identical one. Do NOT switch to immersion just to be different — let fit decide the category."
        : "";
    return [
      `${i + 1}. ${r.name} — ${r.rating}★ (${scope})${staleness}`,
      `   ${r.doseGrams}g : ${r.waterGrams}g${r.waterTempC ? ` at ${r.waterTempC}°C` : ""}${r.grindSize ? ` · grind ${r.grindSize}` : ""}${timing ? ` · ${timing}` : ""}`,
      `   Pours: ${r.pourPlan}`,
      r.notes ? `   You wrote: "${r.notes.slice(0, 160)}"` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });

  return `\nYOUR OWN BREWS THAT SCORED WELL (${refs.length}) — the user's real logged brews on their own kit, water and palate, rated ${MIN_RATING}★ or better. They rank alongside the documented recipes above, not below them: a documented recipe is evidence about coffee in general, one of these is evidence about THIS user.

Treat one as a BASELINE TO BUILD ON, not a recipe to re-serve. A 4.5★ brew is the most informative thing in this prompt precisely because it already worked — so the useful question is "what is still missing from a 5★?", and the answer is a deliberate, named change to ONE variable, with the rest held steady so the comparison means something. Say what you changed and why.
Re-serve one essentially unchanged only when the user asked to repeat it, or when this is the same bag in the same context AND the entry is not marked as recently recommended. You may name it in basedOn exactly as written.
Do NOT copy one whose rating merely tied with a better-matching documented recipe, and never present it as authoritative on technique — it is one brew, not a published method.\n\n${lines.join("\n\n")}`;
}
