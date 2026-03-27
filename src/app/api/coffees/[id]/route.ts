import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import type { Coffee } from "@/lib/types/coffee";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getAdminDb();
    const doc = await db.collection("coffees").doc(params.id).get();
    if (!doc.exists) return NextResponse.json(null, { status: 404 });
    return NextResponse.json({ id: doc.id, ...doc.data() } as Coffee);
  } catch (err) {
    console.error("coffee GET error:", err);
    return NextResponse.json(null, { status: 500 });
  }
}
