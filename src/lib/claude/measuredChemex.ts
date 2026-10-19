/**
 * CHEMEX grind — measured brews only (2026-10-18).
 *
 * Replaces the batch-scaled Chemex floor of #644, which carried the owner's
 * V60 dose law onto a brewer with different (bonded, "20-30% thicker") paper.
 * The research for a sourced number came back empty: no publisher gives a
 * Niche° value for a Chemex at 750 g, the only Chemex recipes with a measurable
 * grind (Comandante clicks) stop at 34 g / 550 g, and no source gives seconds
 * per degree. So the only numbers this block hands the model are the owner's
 * own logged Chemex brews at this batch, plus the one rule Chemex itself
 * publishes:
 *   chemexcoffeemaker.com/pages/faq — "Use a medium coarse grind." and, when
 *   the coffee is "filtering slowly", "Use a coarser grind."
 *
 * Since 2026-10-19 this is information only — the repair that sent a candidate
 * back for grinding at or finer than a slow setting was dropped with the
 * other orchestration guards. The model reads the measurements and the
 * published direction and decides.
 */
import type { Session } from "../types/session";
import { resolveBrewedRecipe } from "../utils/resolveRecipe";
import { brewersFromMethod } from "../knowledge/recipes/helpers";
import { batchWithinWindow } from "../recipe/batchWindow";
import { grindStringToDegrees } from "./measuredGrind";
import { grindInUnit } from "../knowledge/recipes/helpers";

export const CHEMEX_FAQ_URL = "https://www.chemexcoffeemaker.com/pages/faq";
/** A logged total this far over its planned clock counts as "filtering slowly". */
export const OVERRUN_FRACTION = 0.1;

export interface ChemexMeasurement {
  date: string;
  grind: string;
  grindDeg: number | null;
  doseGrams?: number;
  waterGrams: number;
  actualSec: number;
  plannedSec?: number;
  rating?: number;
}

export function isChemex(method: string | undefined): boolean {
  return brewersFromMethod(method).has("chemex");
}

/** The owner's Chemex brews within the ±20 % batch window, newest first. */
export function measuredChemexAtBatch(sessions: Session[], waterGrams: number): ChemexMeasurement[] {
  const out: ChemexMeasurement[] = [];
  for (const s of sessions) {
    const brewed = resolveBrewedRecipe(s);
    const method = s.brew?.methodUsed ?? brewed.method;
    if (!isChemex(method)) continue;
    const recipe = brewed.recipe;
    const water = recipe?.waterGrams;
    const actual = s.brew?.actualTimeSec;
    const grind = s.brew?.grindSettingUsed ?? recipe?.grindSize;
    if (!(typeof water === "number" && water > 0) || !batchWithinWindow(water, waterGrams)) continue;
    if (!(typeof actual === "number" && actual > 0) || !grind) continue;
    out.push({
      date: (s.createdAt ?? "").slice(0, 10),
      grind,
      grindDeg: grindStringToDegrees(grind),
      doseGrams: recipe?.doseGrams,
      waterGrams: water,
      actualSec: actual,
      plannedSec: recipe?.targetTimeSec,
      rating: s.result?.rating,
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export function ranOver(m: ChemexMeasurement): boolean {
  return typeof m.plannedSec === "number" && m.plannedSec > 0 && m.actualSec > m.plannedSec * (1 + OVERRUN_FRACTION);
}

/** The coarsest measured setting that still ran over its plan — a Chemex
 * candidate must be coarser than this (Chemex FAQ). Null when none ran over. */
export function slowestFloorDeg(ms: ChemexMeasurement[]): number | null {
  const over = ms.filter((m) => ranOver(m) && m.grindDeg !== null).map((m) => m.grindDeg as number);
  return over.length ? Math.max(...over) : null;
}

export function formatMeasuredChemexBlock(ms: ChemexMeasurement[], waterGrams: number, grinder?: string): string {
  const head = `\nCHEMEX AT THIS BATCH (${waterGrams} g) — the owner's MEASURED Chemex brews only. No published source gives a Niche° value for a Chemex at this batch (the Chemex recipes that publish a measurable grind stop at 34 g / 550 g), and no source gives seconds per degree, so do NOT take a Chemex grind from the NICHE° table or scale one from the V60. Chemex's own rule (${CHEMEX_FAQ_URL}): "Use a medium coarse grind"; when the coffee is filtering slowly, "Use a coarser grind."`;
  if (!ms.length) {
    return `${head}\n- No measured Chemex brew at this batch yet. A Chemex candidate's grind is a MEASUREMENT BREW: say so in whyChosen ("measurement brew — first logged Chemex at ${waterGrams} g").`;
  }
  const lines = ms.slice(0, 5).map((m) => {
    const plan = m.plannedSec ? ` vs planned ${m.plannedSec} s (${m.actualSec > m.plannedSec ? "+" : ""}${Math.round(m.actualSec - m.plannedSec)} s)` : "";
    return `- ${m.date}: ${m.grindDeg !== null ? grindInUnit(Math.round(m.grindDeg), grinder) : m.grind}, ${m.doseGrams ?? "?"} g / ${Math.round(m.waterGrams)} g, logged total ${Math.round(m.actualSec)} s${plan}${m.rating ? `, ${m.rating}★` : ""}${ranOver(m) ? " — RAN SLOW" : ""}`;
  });
  const floor = slowestFloorDeg(ms);
  const rule = floor !== null
    ? `\n${grindInUnit(Math.round(floor), grinder)} ran slow at this batch; Chemex's published direction for that is coarser. How much coarser is not published anywhere — a move is a MEASUREMENT BREW: name the measured brew it moves from and say "measurement brew" in whyChosen.`
    : `\nA Chemex candidate starts from these measured settings; if it moves the grind, say "measurement brew" in whyChosen and name the brew it moves from.`;
  return `${head}\n${lines.join("\n")}${rule}`;
}
