/**
 * The shareable brew card — the DATA of one brew as a recipient without BTTS
 * needs it (owner, 2026-11-08: "wenn jemand den gleichen Kaffee hat … das
 * Rezept für den Brew, den man richtig passend fand, teilen").
 *
 * Pure: a saved Session in, a flat `BrewCardData` out. The canvas painter
 * (`renderBrewCard.ts`, client) draws exactly this; nothing on the card is
 * computed anywhere else. The card carries LITTLE on purpose (owner,
 * 2026-11-08: "so viel scheiss infos … alles viel zu voll"): the coffee, the
 * brewer, the four numbers, the grind as a WORD plus an everyday comparison,
 * the steps. No grinder numbers, no footnotes, no rating.
 *
 * The grind word is anchored on the owner's MEASURED V60 setting (380° at
 * 250 g, 400° at 500 g, `grindSettings.ts`): a V60 pour-over grind is
 * "Medium — like sand" on Verena Street's grind chart (verenastreet.com,
 * "Coffee Grind Size Chart", read 2026-11-08), whose comparisons the five
 * words carry: flour / table salt / sand / sea salt / crushed peppercorns.
 * The degree bands between the words are a UI choice — no source publishes a
 * Niche° scale — and a Comandante setting is converted only inside the
 * measured 23–29 click span.
 */

import type { Session } from "@/lib/types/session";
import { resolveBrewedRecipe } from "@/lib/utils/resolveRecipe";
import { buildBrewTimeline } from "@/lib/brew/timeline";
import { formatSeconds, formatDuration } from "@/lib/utils/formatTime";
import { isComandante, clicksToNiche } from "@/lib/utils/grindUnit";
import { NICHE_GRIND_SETTINGS, batchGrindDeltaDeg } from "@/lib/constants/grindSettings";
import { basedOnReference } from "@/lib/utils/resolveRecipe";

export interface BrewCardStep {
  /** Clock position, "M:SS". */
  at: string;
  label: string;
  /** "+60g → 60g", "→ 230g", "2:30" for a steep, or "" for an agitation. */
  detail: string;
}

export interface BrewCardGrind {
  /** "Very fine" | "Fine" | "Medium" | "Coarse" | "Very coarse". */
  word: string;
  /** "like sand" — the chart's everyday comparison for that word. */
  like: string;
}

export interface BrewCardData {
  roaster: string;
  name: string;
  method: string;
  /** Always a line under the brewer: "After Kasuya 4:6" when the brew follows a
   * reference, else the name the model gave this brew. */
  subtitle?: string;
  doseG: number;
  waterG: number;
  iceG?: number;
  /** "1:15.5" */
  ratio: string;
  tempC: number;
  /** Absent when the logged setting cannot be placed (clicks outside the measured span). */
  grind?: BrewCardGrind;
  steps: BrewCardStep[];
  /** The composed clock's end, "M:SS" (or "12h" for a steep). */
  finish: string;
}

/** The owner's measured V60 single-cup anchor (380° at 250 g). */
const V60_ANCHOR = NICHE_GRIND_SETTINGS.find((s) => s.method === "V60")!;
const V60_ANCHOR_WATER_G = 250;
/** Comandante clicks the owner has measured against the Niche (23 = 380°, 29 = 400°). */
const MEASURED_CLICKS: [number, number] = [23, 29];

function parseNumber(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function formatRatio(doseG: number, waterG: number): string {
  if (!(doseG > 0) || !(waterG > 0)) return "";
  const r = waterG / doseG;
  const rounded = Math.round(r * 10) / 10;
  return `1:${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}`;
}

/** The five words and their comparisons (Verena Street grind chart). */
const GRIND_WORDS: Record<"very-fine" | "fine" | "medium" | "coarse" | "very-coarse", BrewCardGrind> = {
  "very-fine": { word: "Very fine", like: "like flour" },
  fine: { word: "Fine", like: "like table salt" },
  medium: { word: "Medium", like: "like sand" },
  coarse: { word: "Coarse", like: "like sea salt" },
  "very-coarse": { word: "Very coarse", like: "like crushed peppercorns" },
};

/** Degrees from the measured V60 anchor at which the word changes — a UI
 * choice, not a published scale. The anchor itself (±14°) stays "Medium". */
const GRIND_BAND_DEG = 15;

/** The grind word off the measured V60 anchor, in the owner's own degrees. */
export function grindWordsFromAnchor(deg: number, waterG: number): BrewCardGrind {
  const anchor = V60_ANCHOR.niche.min + batchGrindDeltaDeg(V60_ANCHOR_WATER_G, waterG > 0 ? waterG : V60_ANCHOR_WATER_G);
  const delta = Math.round(deg - anchor);
  if (delta >= GRIND_BAND_DEG * 3) return GRIND_WORDS["very-coarse"];
  if (delta >= GRIND_BAND_DEG) return GRIND_WORDS.coarse;
  if (delta <= -GRIND_BAND_DEG * 3) return GRIND_WORDS["very-fine"];
  if (delta <= -GRIND_BAND_DEG) return GRIND_WORDS.fine;
  return GRIND_WORDS.medium;
}

/** The logged setting as Niche degrees: degrees as they are, Comandante
 * clicks only inside the measured 23–29 span. Null when it cannot be placed. */
export function nicheDegreesOf(grindSize: string | undefined, grinder: string | undefined): number | null {
  const raw = (grindSize ?? "").trim();
  const n = parseNumber(raw);
  if (n == null) return null;
  const clicksUnit = isComandante(grinder) || /click/i.test(raw);
  if (!clicksUnit) return Math.round(n);
  const clicks = Math.round(n);
  if (clicks < MEASURED_CLICKS[0] || clicks > MEASURED_CLICKS[1]) return null;
  return clicksToNiche(clicks);
}

export function buildCardGrind(args: { grindSize: string | undefined; grinder: string | undefined; waterG: number }): BrewCardGrind | undefined {
  const deg = nicheDegreesOf(args.grindSize, args.grinder);
  return deg == null ? undefined : grindWordsFromAnchor(deg, args.waterG);
}

function stepLabel(label: string, action: string): string {
  const l = label.trim();
  if (l) return l;
  return action.charAt(0).toUpperCase() + action.slice(1);
}

export function buildBrewCardData(session: Session, now: number = Date.now()): BrewCardData | null {
  const { recipe, candidate, method } = resolveBrewedRecipe(session);
  if (!recipe) return null;
  const coffee = session.coffee;
  const brew = session.brew;

  const doseG = brew?.doseGrams ?? recipe.doseGrams;
  const waterG = brew?.waterGrams ?? recipe.waterGrams;
  const tempC = brew?.actualTempC ?? recipe.waterTempC;

  const timeline = buildBrewTimeline(recipe, coffee?.roastDate, now, method);
  const steps: BrewCardStep[] = [];
  if (timeline.shape === "percolation" && timeline.pourSteps) {
    for (const s of timeline.pourSteps) {
      const isWater = s.action === "bloom" || s.action === "pour" || s.action === "final";
      steps.push({
        at: formatSeconds(Math.round(s.startTimeSec)),
        label: stepLabel(s.label, s.action),
        detail: isWater && s.pourGrams > 0 ? `+${Math.round(s.pourGrams)}g → ${Math.round(s.cumulativeGrams)}g` : "",
      });
    }
    if (timeline.drawdownSec > 0) {
      steps.push({ at: formatSeconds(Math.round(timeline.pourPhaseEndSec)), label: "Drawdown", detail: "" });
    }
  } else if (timeline.shape === "immersion") {
    for (const s of [...timeline.setupSteps, ...timeline.steps]) {
      const grams = s.targetCumulativeGrams;
      const dur = s.endSec - s.startSec;
      const detail =
        typeof grams === "number" && grams > 0
          ? `→ ${Math.round(grams)}g`
          : s.action === "wait" && dur > 0
            ? formatDuration(Math.round(dur))
            : "";
      steps.push({
        at: s.isSetup ? "" : formatSeconds(Math.round(s.startSec)),
        label: stepLabel(s.label, s.action),
        detail,
      });
    }
  } else if (timeline.proseSequence) {
    steps.push({ at: "", label: timeline.proseSequence, detail: "" });
  }

  const grind = buildCardGrind({
    grindSize: brew?.grindSettingUsed || recipe.grindSize,
    grinder: session.context?.grinder,
    waterG,
  });

  return {
    roaster: (coffee?.roaster ?? "").trim(),
    name: (coffee?.name ?? "").trim() || "Coffee",
    method,
    subtitle: (() => {
      const ref = basedOnReference(candidate?.basedOn, candidate?.title);
      if (ref) return `After ${ref}`;
      const title = candidate?.title?.trim();
      return title || undefined;
    })(),
    doseG,
    waterG,
    iceG: recipe.iceGrams && recipe.iceGrams > 0 ? recipe.iceGrams : undefined,
    ratio: formatRatio(doseG, waterG),
    tempC,
    grind,
    steps,
    finish: formatDuration(Math.round(timeline.finishSec)),
  };
}
