import { NextRequest, NextResponse } from "next/server";
import { desc, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { pendingBrews } from "@/lib/db/schema";
import type { PendingBrewSummary } from "@/lib/types/pendingBrew";

export const dynamic = "force-dynamic";

/**
 * Brews that finished the timer but are not rated yet (migration 0025).
 * GET            → the open ones (what the Home card counts)
 * GET ?all=true  → open + dismissed (the /brew/unrated list)
 * Rows are written by PUT /api/pending-brews/[id] and removed by the sessions
 * POST when the brew is finally rated.
 */
export async function GET(req: NextRequest) {
  try {
    const all = new URL(req.url).searchParams.get("all") === "true";
    const base = db.select().from(pendingBrews).orderBy(desc(pendingBrews.createdAtMs)).limit(100);
    const rows = all ? await base : await base.where(isNull(pendingBrews.dismissedAt));
    const out: PendingBrewSummary[] = rows.map((r) => {
      const draft = r.draft as {
        coffee?: { name?: string; roaster?: string; bagPhotoUrl?: string };
        brew?: { methodUsed?: string };
      };
      return {
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        dismissedAt: r.dismissedAt ? r.dismissedAt.toISOString() : null,
        coffeeName: draft.coffee?.name ?? "",
        roaster: draft.coffee?.roaster ?? "",
        method: draft.brew?.methodUsed ?? null,
        bagPhotoUrl: draft.coffee?.bagPhotoUrl || null,
      };
    });
    return NextResponse.json(out);
  } catch (err) {
    console.error("pending-brews GET error:", err);
    return NextResponse.json([], { status: 500 });
  }
}
