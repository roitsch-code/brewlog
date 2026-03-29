import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getAdminDb();
    const snap = await db.collection("auth").doc("credential").get();
    return NextResponse.json({ registered: snap.exists });
  } catch {
    return NextResponse.json({ registered: false });
  }
}
