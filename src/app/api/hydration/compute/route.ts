import { NextRequest, NextResponse } from "next/server";
import { ensureTodayCheckin } from "@/lib/hydration/service";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Recompute today's adaptive hydration target from live heat + movement data
 * and upsert the row (answer fields preserved). Called by Ofelia cron in the
 * morning, and again in the afternoon once more activity has accumulated.
 *
 * Auth: Bearer CRON_SECRET (same pattern as /api/research).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const row = await ensureTodayCheckin();
    return NextResponse.json({
      ok: true,
      day: row.day,
      zielMl: row.zielMl,
      hitzeMl: row.hitzeAufschlagMl,
      bewegungMl: row.bewegungsAufschlagMl,
      heatDataMissing: row.heatDataMissing,
      activityDataMissing: row.activityDataMissing,
    });
  } catch (err) {
    console.error("hydration compute error:", err);
    return NextResponse.json({ error: "compute failed" }, { status: 500 });
  }
}
