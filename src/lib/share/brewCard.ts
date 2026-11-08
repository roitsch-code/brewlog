/**
 * The shareable brew card — the DATA of one brew as a recipient without BTTS
 * needs it (owner, 2026-11-08: "wenn jemand den gleichen Kaffee hat … das
 * Rezept für den Brew, den man richtig passend fand, teilen").
 *
 * Pure: a saved Session in, a flat `BrewCardData` out. The canvas painter
 * (`renderBrewCard.ts`, client) draws exactly this; nothing on the card is
 * computed anywhere else. Server-side on purpose: the grind description may
 * quote the reference recipe's own words, and that needs the corpus, which
 * never ships to the client bundle.
 *
 * What is measured and what is not:
 *  - every number is the brew's own (the brewed candidate via
 *    `resolveBrewedRecipe`, the grind he logged, the composed timeline);
 *  - the grind DESCRIPTION is either the reference author's published words
 *    (when the brewed recipe is based on a corpus recipe on the same brewer
 *    within its batch window) or a relative line off the owner's MEASURED V60
 *    anchor (380° at 250 g, +20°/doubling, `grindSettings.ts`). The wording
 *    bands ("a touch", "clearly") are a UI choice, the degrees are not.
 */

import type { Session } from "@/lib/types/session";
import { resolveBrewedRecipe, brewedRecipeName } from "@/lib/utils/resolveRecipe";
import { buildBrewTimeline } from "@/lib/brew/timeline";
import { formatSeconds, formatDuration, formatDate } from "@/lib/utils/formatTime";
import { isComandante, nicheToClicks, clicksToNiche } from "@/lib/utils/grindUnit";
import { NICHE_GRIND_SETTINGS, batchGrindDeltaDeg } from "@/lib/constants/grindSettings";
import { resolveReference, brewerMatchesReference, referenceAppliesAtBatch } from "@/lib/claude/recipeFidelity";

export interface BrewCardStep {
  /** Clock position, "M:SS". */
  at: string;
  label: string;
  /** "+60 g → 60 g", "→ 230 g", "35 s", or "" for an agitation. */
  detail: string;
}

export interface BrewCardGrind {
  /** "392°" or "27 clicks". */
  value: string;
  /** "Niche Zero" or "Comandante C40". */
  grinder: string;
  /** The same setting on the other grinder — only inside the owner's measured
   * 23–29 click span, never extrapolated. */
  alsoOn?: string;
  /** One line a stranger can grind to. */
  description?: string;
  /** Where the description comes from — shown small on the card. */
  descriptionSource?: "author" | "measured-anchor";
}

export interface BrewCardData {
  roaster: string;
  name: string;
  /** "Ethiopia · Washed · Light" — whatever the bag states. */
  originLine: string;
  method: string;
  recipeName?: string;
  doseG: number;
  waterG: number;
  iceG?: number;
  /** "1:15.5" */
  ratio: string;
  tempC: number;
  grind: BrewCardGrind;
  steps: BrewCardStep[];
  /** The composed clock's end, "M:SS" (or "12h" for a steep). */
  finish: string;
  /** His actual time, when the timer ran. */
  actualTime?: string;
  rating?: number;
  date: string;
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

/** The relative line off the measured V60 anchor, in the owner's own degrees. */
export function describeGrindFromAnchor(deg: number, waterG: number): string {
  const anchor = V60_ANCHOR.niche.min + batchGrindDeltaDeg(V60_ANCHOR_WATER_G, waterG > 0 ? waterG : V60_ANCHOR_WATER_G);
  const delta = Math.round(deg - anchor);
  const abs = Math.abs(delta);
  const dir = delta > 0 ? "coarser" : "finer";
  if (abs <= 4) return "a standard V60 pour-over grind";
  if (abs <= 14) return `a touch ${dir} than a V60 pour-over grind`;
  return `clearly ${dir} than a V60 pour-over grind`;
}

export function buildCardGrind(args: {
  grindSize: string | undefined;
  grinder: string | undefined;
  waterG: number;
  method: string;
  basedOn: string | undefined;
}): BrewCardGrind {
  const raw = (args.grindSize ?? "").trim();
  const n = parseNumber(raw);
  const clicksUnit = isComandante(args.grinder) || /click/i.test(raw);

  let deg: number | null = null;
  let clicks: number | null = null;
  let value = raw || "—";
  let grinder = clicksUnit ? "Comandante C40" : "Niche Zero";
  let alsoOn: string | undefined;

  if (n != null && clicksUnit) {
    clicks = Math.round(n);
    value = `${clicks} clicks`;
    if (clicks >= MEASURED_CLICKS[0] && clicks <= MEASURED_CLICKS[1]) {
      deg = clicksToNiche(clicks);
      alsoOn = `${deg}° on a Niche Zero`;
    }
  } else if (n != null) {
    deg = Math.round(n);
    value = `${deg}°`;
    const c = nicheToClicks(deg);
    if (c >= MEASURED_CLICKS[0] && c <= MEASURED_CLICKS[1]) {
      clicks = c;
      alsoOn = `${c} clicks on a Comandante C40`;
    }
  } else if (!raw) {
    grinder = "";
  }

  // The reference author's own words, when the brew really is that recipe on
  // that brewer at that size — otherwise the owner's measured anchor.
  let description: string | undefined;
  let descriptionSource: BrewCardGrind["descriptionSource"];
  const ref = resolveReference(args.basedOn);
  const authorWords = ref?.grind?.description?.trim();
  if (
    ref &&
    authorWords &&
    brewerMatchesReference(args.method, ref) &&
    referenceAppliesAtBatch(ref, args.waterG)
  ) {
    description = authorWords;
    descriptionSource = "author";
  } else if (deg != null) {
    description = describeGrindFromAnchor(deg, args.waterG);
    descriptionSource = "measured-anchor";
  }

  return { value, grinder, alsoOn, description, descriptionSource };
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

  const originParts = [coffee?.origin, coffee?.process, coffee?.roastLevel ? `${coffee.roastLevel} roast` : undefined]
    .map((p) => (p ?? "").trim())
    .filter(Boolean);

  const timeline = buildBrewTimeline(recipe, coffee?.roastDate, now, method);
  const steps: BrewCardStep[] = [];
  if (timeline.shape === "percolation" && timeline.pourSteps) {
    for (const s of timeline.pourSteps) {
      const isWater = s.action === "bloom" || s.action === "pour" || s.action === "final";
      steps.push({
        at: formatSeconds(Math.round(s.startTimeSec)),
        label: stepLabel(s.label, s.action),
        detail: isWater && s.pourGrams > 0 ? `+${Math.round(s.pourGrams)} g → ${Math.round(s.cumulativeGrams)} g` : "",
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
          ? `→ ${Math.round(grams)} g`
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
    method,
    basedOn: candidate?.basedOn,
  });

  return {
    roaster: (coffee?.roaster ?? "").trim(),
    name: (coffee?.name ?? "").trim() || "Coffee",
    originLine: originParts.join(" · "),
    method,
    recipeName: brewedRecipeName(candidate),
    doseG,
    waterG,
    iceG: recipe.iceGrams && recipe.iceGrams > 0 ? recipe.iceGrams : undefined,
    ratio: formatRatio(doseG, waterG),
    tempC,
    grind,
    steps,
    finish: formatDuration(Math.round(timeline.finishSec)),
    actualTime: brew?.actualTimeSec ? formatDuration(Math.round(brew.actualTimeSec)) : undefined,
    rating: typeof session.result?.rating === "number" ? session.result.rating : undefined,
    date: formatDate(session.createdAt),
  };
}
