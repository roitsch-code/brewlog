import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import type { Coffee } from "@/lib/types/coffee";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getAdminDb();
    const snap = await db.collection("coffees").get();
    const coffees: Coffee[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Coffee));
    return NextResponse.json(coffees);
  } catch (err) {
    console.error("coffees GET error:", err);
    return NextResponse.json({ error: "Failed to load coffees" }, { status: 500 });
  }
}
