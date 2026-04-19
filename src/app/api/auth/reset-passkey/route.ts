import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/auth/requireAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  try {
    const db = getAdminDb();
    await db.collection("auth").doc("credential").delete();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("reset-passkey error:", err);
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }
}
