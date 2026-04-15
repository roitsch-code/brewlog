import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import type { UserPreferences } from "@/lib/types/preferences";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getAdminDb();
    const snap = await db.collection("preferences").doc("default").get();
    if (!snap.exists) return NextResponse.json(null);
    return NextResponse.json(snap.data() as UserPreferences);
  } catch (err) {
    console.error("preferences GET error:", err);
    return NextResponse.json(null);
  }
}

export async function POST(req: NextRequest) {
  try {
    const prefs: UserPreferences = await req.json();
    const db = getAdminDb();
    await db.collection("preferences").doc("default").set(prefs, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("preferences POST error:", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
