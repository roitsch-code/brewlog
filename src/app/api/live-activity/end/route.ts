import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/requireAuth";
import { endBrew } from "@/lib/native/liveActivitySchedule";

export const dynamic = "force-dynamic";

/** Cancel a brew's pending Live Activity pushes + end the activity remotely. */
export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  endBrew(true);
  return NextResponse.json({ ok: true });
}
