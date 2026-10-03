/**
 * The previous brew of THIS coffee — the comparison the post-brew log never
 * offered (2026-10-03). The log asked for a star and nothing else, and the
 * summary showed only the cup just brewed, so "better or worse than last
 * time?" — the most direct learning signal a single-user app can collect —
 * was never asked and never stored. Pure selection so it can be tested.
 */

import type { Session } from "../types/session";
import { resolveBrewedRecipe } from "../utils/resolveRecipe";

export interface PreviousBrew {
  id: string;
  createdAt: string;
  rating?: number;
  method: string;
  basedOn?: string;
  title?: string;
  doseGrams?: number;
  waterGrams?: number;
  waterTempC?: number;
  grindSize?: string;
  targetTimeSec?: number;
  actualTimeSec?: number;
  flavorNotes?: string[];
  freeNotes?: string;
}

export interface PreviousBrewSummary {
  previous: PreviousBrew | null;
  /** Rated home brews of this coffee, newest first (≤ 5). */
  ratings: number[];
  count: number;
}

export function sameCoffee(
  s: Session,
  coffee: { coffeeId?: string; roaster?: string; name?: string },
): boolean {
  if (coffee.coffeeId && s.coffee?.coffeeId) return s.coffee.coffeeId === coffee.coffeeId;
  const a = `${s.coffee?.roaster ?? ""}|${s.coffee?.name ?? ""}`.toLowerCase().trim();
  const b = `${coffee.roaster ?? ""}|${coffee.name ?? ""}`.toLowerCase().trim();
  return a.length > 1 && a === b;
}

function timeOf(s: Session): number {
  const ms = (s as { createdAtMs?: number }).createdAtMs;
  if (typeof ms === "number" && Number.isFinite(ms)) return ms;
  const t = Date.parse(s.createdAt ?? "");
  return Number.isFinite(t) ? t : 0;
}

export function pickPreviousBrew(
  sessions: Session[],
  coffee: { coffeeId?: string; roaster?: string; name?: string },
): PreviousBrewSummary {
  const mine = sessions
    .filter((s) => s.mode === "home" && sameCoffee(s, coffee))
    .sort((a, b) => timeOf(b) - timeOf(a));
  const count = mine.length;
  const ratings = mine
    .map((s) => s.result?.rating)
    .filter((r): r is number => typeof r === "number" && Number.isFinite(r))
    .slice(0, 5);
  const last = mine[0];
  if (!last) return { previous: null, ratings, count };
  const { recipe, method } = resolveBrewedRecipe(last);
  const cand = resolveBrewedRecipe(last).candidate;
  return {
    previous: {
      id: last.id,
      createdAt: last.createdAt,
      rating: last.result?.rating,
      method: last.brew?.methodUsed || method || "",
      basedOn: cand?.basedOn?.trim() || undefined,
      title: cand?.title?.trim() || undefined,
      doseGrams: recipe?.doseGrams,
      waterGrams: recipe?.waterGrams,
      waterTempC: last.brew?.actualTempC ?? recipe?.waterTempC,
      grindSize: last.brew?.grindSettingUsed || recipe?.grindSize,
      targetTimeSec: recipe?.targetTimeSec,
      actualTimeSec: last.brew?.actualTimeSec,
      flavorNotes: last.result?.flavorNotes?.slice(0, 6),
      freeNotes: last.result?.freeNotes?.slice(0, 160),
    },
    ratings,
    count,
  };
}
