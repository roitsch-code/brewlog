import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { cafeVisits } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await db.delete(cafeVisits).where(eq(cafeVisits.id, params.id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("cafe-visits DELETE error:", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
