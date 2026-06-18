import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/requireAuth";
import { scheduleBrew } from "@/lib/native/liveActivitySchedule";

export const dynamic = "force-dynamic";

const StateSchema = z.object({
  currentStep: z.string().max(120),
  nextStep: z.string().max(120),
  nextStepEpoch: z.number(),
  stepStartEpoch: z.number(),
  stepIndex: z.number().int(),
  stepCount: z.number().int(),
});

const BodySchema = z.object({
  token: z.string().min(16).max(512),
  schedule: z
    .array(z.object({ fireEpochMs: z.number(), state: StateSchema }))
    .max(64),
});

/**
 * Register a brew's Live Activity push token + step schedule. The server arms
 * one APNs push per step so the activity advances while the phone is locked.
 */
export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  let parsed;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const scheduled = scheduleBrew(parsed.token, parsed.schedule);
  return NextResponse.json({ ok: true, scheduled });
}
