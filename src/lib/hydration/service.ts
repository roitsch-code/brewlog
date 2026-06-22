// Adaptive hydration check-in — shared service logic used by both the cron
// route (/api/hydration/compute) and the user route (/api/hydration).
//
// ensureTodayCheckin() computes today's adaptive target from live heat +
// movement data and upserts the row WITHOUT touching the answer fields, so
// recomputing during the day never clobbers an already-given assessment.

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { hydrationCheckin } from "@/lib/db/schema";
import { computeTarget } from "./computeTarget";
import { hydrationConfig } from "./config";
import { fetchApparentTempMax } from "./weather";
import { fetchActiveCalories } from "./ouraActivity";

export type HydrationRow = typeof hydrationCheckin.$inferSelect;

/** Today's date as YYYY-MM-DD in Europe/Berlin (the app's wall clock). */
export function berlinDay(d: Date = new Date()): string {
  // en-CA renders ISO-style YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Compute today's target from live data and upsert the row. Target + context
 * columns are refreshed; the answer (self_assessment, notiz, …) and the
 * anti-spam marker (anhebung_gemeldet_ml) are preserved on conflict.
 */
export async function ensureTodayCheckin(): Promise<HydrationRow> {
  const day = berlinDay();
  const [heat, activity] = await Promise.all([
    fetchApparentTempMax(),
    fetchActiveCalories(day),
  ]);

  const t = computeTarget({
    apparentTempMax: heat.apparentTempMax,
    activeCalories: activity.activeCalories,
  });
  const heatMissing = heat.apparentTempMax == null;
  const activityMissing = activity.activeCalories == null;

  const context = {
    basisMl: t.basisMl,
    hitzeAufschlagMl: t.hitzeMl,
    bewegungsAufschlagMl: t.bewegungMl,
    zielMl: t.zielMl,
    apparentTempMaxC: heat.apparentTempMax != null ? String(heat.apparentTempMax) : null,
    activeCalories: activity.activeCalories,
    heatDataMissing: heatMissing,
    activityDataMissing: activityMissing,
  };

  await db
    .insert(hydrationCheckin)
    .values({ day, ...context })
    .onConflictDoUpdate({
      target: hydrationCheckin.day,
      set: { ...context, updatedAt: new Date() },
    });

  const rows = await db
    .select()
    .from(hydrationCheckin)
    .where(eq(hydrationCheckin.day, day))
    .limit(1);
  return rows[0];
}

/** Load today's row without recomputing (null if none yet). */
export async function loadTodayCheckin(): Promise<HydrationRow | null> {
  const rows = await db
    .select()
    .from(hydrationCheckin)
    .where(eq(hydrationCheckin.day, berlinDay()))
    .limit(1);
  return rows[0] ?? null;
}

/** Should the "target raised" banner be shown? (spec §5 anti-spam.) */
export function shouldAnnounceRaise(row: HydrationRow): boolean {
  if (row.zielMl <= row.basisMl) return false;
  const last = row.anhebungGemeldetMl;
  if (last == null) return true;
  return row.zielMl - last >= hydrationConfig().meldeDeltaMl;
}

/** Reason clause(s) behind a raised target, e.g. "gefühlt 31 °C + aktiver Tag". */
export function raiseReason(row: HydrationRow): string {
  const parts: string[] = [];
  if (row.hitzeAufschlagMl > 0 && row.apparentTempMaxC != null) {
    parts.push(`☀️ gefühlt ${Math.round(Number(row.apparentTempMaxC))} °C`);
  } else if (row.hitzeAufschlagMl > 0) {
    parts.push("☀️ Hitze");
  }
  if (row.bewegungsAufschlagMl > 0) {
    parts.push("🚲 aktiver Tag");
  }
  return parts.join(" + ");
}

/** ml → "≈ 3,7 l" (German decimal comma). */
export function formatLiters(ml: number): string {
  return `≈ ${(ml / 1000).toFixed(1).replace(".", ",")} l`;
}

// 1..5 ordinal → midpoint fraction of target, for an OPTIONAL derived estimate
// (spec §4). The user never sees/enters a number; this is for later analysis.
const LEVEL_FRACTION: Record<number, number> = {
  1: 0.4, // < 50 %
  2: 0.65, // 50–80 %
  3: 0.95, // 80–110 %
  4: 1.22, // 110–135 %
  5: 1.45, // > 135 %
};

export function estimateMl(level: number, zielMl: number): number | null {
  const f = LEVEL_FRACTION[level];
  return f == null ? null : Math.round(zielMl * f);
}
