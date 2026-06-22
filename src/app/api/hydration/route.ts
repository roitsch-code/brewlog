import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { hydrationCheckin } from "@/lib/db/schema";
import {
  berlinDay,
  ensureTodayCheckin,
  loadTodayCheckin,
  shouldAnnounceRaise,
  raiseReason,
  formatLiters,
  estimateMl,
} from "@/lib/hydration/service";
import { checkinTime } from "@/lib/hydration/config";

export const dynamic = "force-dynamic";

/**
 * Today's hydration check-in for the home surface.
 *
 * Lazily computes the row if cron hasn't run yet (so the feature works
 * immediately), otherwise returns the stored row — home loads don't hammer
 * the weather/Oura APIs on every open. Includes the "target raised" banner
 * payload + whether it should be shown (anti-spam, spec §5).
 */
export async function GET() {
  try {
    const row = (await loadTodayCheckin()) ?? (await ensureTodayCheckin());
    return NextResponse.json({
      day: row.day,
      basisMl: row.basisMl,
      basisLabel: formatLiters(row.basisMl),
      hitzeMl: row.hitzeAufschlagMl,
      bewegungMl: row.bewegungsAufschlagMl,
      zielMl: row.zielMl,
      zielLabel: formatLiters(row.zielMl),
      reason: raiseReason(row),
      heatDataMissing: row.heatDataMissing,
      activityDataMissing: row.activityDataMissing,
      selfAssessment: row.selfAssessment,
      assessedAt: row.assessedAt,
      notiz: row.notiz,
      checkinTime: checkinTime(),
      raise: {
        show: shouldAnnounceRaise(row),
        basisLabel: formatLiters(row.basisMl),
        zielLabel: formatLiters(row.zielMl),
        reason: raiseReason(row),
      },
    });
  } catch (err) {
    console.error("hydration GET error:", err);
    return NextResponse.json({ error: "load failed" }, { status: 500 });
  }
}

/**
 * Two actions:
 *  - { action: "assess", level: 1..5, notiz? } → store the evening answer.
 *  - { action: "ackRaise" }                    → mark the raise banner as shown
 *                                                (so it won't re-appear unless
 *                                                the target climbs ≥ MELDE_DELTA).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const action = body.action;
    const day = berlinDay();

    if (action === "ackRaise") {
      const row = await loadTodayCheckin();
      if (row) {
        await db
          .update(hydrationCheckin)
          .set({ anhebungGemeldetMl: row.zielMl, updatedAt: new Date() })
          .where(eq(hydrationCheckin.day, day));
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "assess") {
      const level = Number(body.level);
      if (!Number.isInteger(level) || level < 1 || level > 5) {
        return NextResponse.json({ error: "level must be 1..5" }, { status: 400 });
      }
      const row = (await loadTodayCheckin()) ?? (await ensureTodayCheckin());
      const note =
        typeof body.notiz === "string" && body.notiz.trim()
          ? body.notiz.trim().slice(0, 500)
          : null;
      await db
        .update(hydrationCheckin)
        .set({
          selfAssessment: level,
          assessedAt: new Date(),
          geschaetzteMengeMl: estimateMl(level, row.zielMl),
          notiz: note,
          updatedAt: new Date(),
        })
        .where(eq(hydrationCheckin.day, day));
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (err) {
    console.error("hydration POST error:", err);
    return NextResponse.json({ error: "save failed" }, { status: 500 });
  }
}
