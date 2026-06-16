import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/requireAuth";
import { setStoredWatchToken } from "@/lib/native/watchToken";

export const dynamic = "force-dynamic";

/**
 * The iOS shell relays the watch's APNs device token here (the watch registers
 * for remote notifications, hands its token to the phone over WatchConnectivity,
 * the phone POSTs it). Stored in the preferences key-value table — no migration.
 */
export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  try {
    const { token } = (await req.json()) as { token?: string };
    if (!token || typeof token !== "string" || token.length < 16) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }
    await setStoredWatchToken(token);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("watch register-token error:", err);
    return NextResponse.json({ error: "Failed to store token" }, { status: 500 });
  }
}
