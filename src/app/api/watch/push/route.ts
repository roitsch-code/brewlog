import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/requireAuth";
import { apnsConfigured, sendWatchPush } from "@/lib/native/apnsPush";
import { clearStoredWatchToken, getStoredWatchToken } from "@/lib/native/watchToken";

export const dynamic = "force-dynamic";

/**
 * Fire a single buzz to the watch RIGHT NOW. The phone calls this at each brew
 * step (the same instant it buzzes itself), so the watch cue is driven off the
 * phone's own timer and lands together — and works with the watch app CLOSED
 * (APNs wakes it). No-op + 200 when APNs isn't configured or no token is stored,
 * so a brew never fails on a missing push setup.
 */
export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  try {
    if (!apnsConfigured()) return NextResponse.json({ ok: false, reason: "not-configured" });
    const token = await getStoredWatchToken();
    if (!token) return NextResponse.json({ ok: false, reason: "no-token" });

    const { title, body } = (await req.json().catch(() => ({}))) as {
      title?: string;
      body?: string;
    };
    const result = await sendWatchPush(token, {
      title: (title || "Next step").slice(0, 60),
      body: (body || "Pour now").slice(0, 80),
    });

    // A stale token (uninstalled / re-registered) → drop it so we stop trying.
    if (result.status === 410 || (result.reason && /BadDeviceToken/i.test(result.reason))) {
      await clearStoredWatchToken().catch(() => {});
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("watch push error:", err);
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }
}
