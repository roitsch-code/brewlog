import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { pendingBrews } from "@/lib/db/schema";
import type { DraftSession } from "@/lib/types/session";
import type { FieldZones } from "@/lib/field/types";
import type { PendingBrewDetail } from "@/lib/types/pendingBrew";

export const dynamic = "force-dynamic";

const ID = /^[A-Za-z0-9-]{8,64}$/;

// The draft is stored as-is: it is re-validated field by field by the real
// sessions POST schema when the brew is rated, so only its outer shape and size
// are checked here.
const PutSchema = z.object({
  createdAt: z.string().refine((s) => Number.isFinite(Date.parse(s)), "createdAt must be an ISO date"),
  draft: z
    .object({ type: z.enum(["coffee", "wine"]), mode: z.enum(["home", "external"]) })
    .passthrough(),
  fieldZones: z.record(z.string(), z.unknown()).nullable().optional(),
});

const PatchSchema = z.object({ dismissed: z.boolean() });

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  if (!ID.test(params.id)) return NextResponse.json(null, { status: 400 });
  const rows = await db.select().from(pendingBrews).where(eq(pendingBrews.id, params.id)).limit(1);
  const r = rows[0];
  if (!r) return NextResponse.json(null, { status: 404 });
  const out: PendingBrewDetail = {
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    dismissedAt: r.dismissedAt ? r.dismissedAt.toISOString() : null,
    draft: r.draft as unknown as DraftSession,
    fieldZones: (r.fieldZones as FieldZones | null) ?? null,
  };
  return NextResponse.json(out);
}

/** Upsert — the Log screen calls it with a client-made id, so a retry after a
 * dropped response never duplicates the brew. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!ID.test(params.id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const raw = await req.text();
  if (raw.length > 500_000) return NextResponse.json({ error: "Draft too large" }, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = PutSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid pending brew", details: parsed.error.flatten() }, { status: 400 });
  }
  const createdAt = new Date(parsed.data.createdAt);
  const values = {
    draft: parsed.data.draft as Record<string, unknown>,
    fieldZones: parsed.data.fieldZones ?? null,
  };
  await db
    .insert(pendingBrews)
    .values({ id: params.id, createdAt, createdAtMs: createdAt.getTime(), ...values })
    .onConflictDoUpdate({ target: pendingBrews.id, set: values });
  return NextResponse.json({ id: params.id });
}

/** { dismissed: true } stops the Home reminder; false brings it back. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!ID.test(params.id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  await db
    .update(pendingBrews)
    .set({ dismissedAt: parsed.data.dismissed ? new Date() : null })
    .where(eq(pendingBrews.id, params.id));
  return NextResponse.json({ success: true });
}
