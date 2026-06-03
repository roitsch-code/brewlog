import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { dripBags } from "@/lib/db/schema";
import type { DripBag } from "@/lib/types/dripBag";

export const dynamic = "force-dynamic";

function rowToDripBag(r: typeof dripBags.$inferSelect): DripBag {
  return {
    id: r.id,
    roaster: r.roaster,
    name: r.name,
    origin: r.origin ?? undefined,
    region: r.region ?? undefined,
    variety: r.variety ?? undefined,
    process: r.process ?? undefined,
    roastLevel: r.roastLevel ?? undefined,
    bagNotes: r.bagNotes ?? [],
    flavorNotes: r.flavorNotes ?? [],
    rating: r.rating != null ? Number(r.rating) : 0,
    freeNotes: r.freeNotes ?? undefined,
    bagPhotoUrl: r.bagPhotoUrl ?? undefined,
    bagPhotoPath: r.bagPhotoPath ?? undefined,
    fieldZones: (r.fieldZones as DripBag["fieldZones"]) ?? null,
    aiExtracted: r.aiExtracted,
    createdAt: r.createdAt.toISOString(),
    createdAtMs: r.createdAtMs,
  };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const rows = await db.select().from(dripBags).where(eq(dripBags.id, params.id)).limit(1);
    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(rowToDripBag(rows[0]));
  } catch (err) {
    console.error("drip-bags [id] GET error:", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await db.delete(dripBags).where(eq(dripBags.id, params.id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("drip-bags [id] DELETE error:", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
