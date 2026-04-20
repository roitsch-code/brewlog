import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { authCredentials } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/requireAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  try {
    await db.delete(authCredentials);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("reset-passkey error:", err);
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }
}
