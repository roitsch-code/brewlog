import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { roasters } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/requireAuth";
import { getRoasterPrior, canonicalRoasterSlug } from "@/lib/roasters/priors";
import type { RoasterPrior } from "@/lib/roasters/priors";

export const dynamic = "force-dynamic";

async function findStoredRoaster(name: string): Promise<RoasterPrior | null> {
  const slug = canonicalRoasterSlug(name);

  const direct = await db.select().from(roasters).where(eq(roasters.slug, slug)).limit(1);
  if (direct.length > 0) return direct[0].data as RoasterPrior;

  const viaAlias = await db
    .select()
    .from(roasters)
    .where(sql`${roasters.aliases} @> ${JSON.stringify([slug])}::jsonb`)
    .limit(1);
  if (viaAlias.length > 0) return viaAlias[0].data as RoasterPrior;

  return null;
}

export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const name = req.nextUrl.searchParams.get("name");
  if (!name) return NextResponse.json(null, { status: 400 });

  try {
    const stored = await findStoredRoaster(name);
    if (stored) return NextResponse.json(stored);

    const prior = getRoasterPrior(name);
    if (prior.confidence !== "fallback") return NextResponse.json(prior);

    return NextResponse.json(null, { status: 404 });
  } catch (err) {
    console.error("roasters GET error:", err);
    return NextResponse.json(null, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const name = req.nextUrl.searchParams.get("name");
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  try {
    await db.delete(roasters).where(eq(roasters.slug, canonicalRoasterSlug(name)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("roasters DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  try {
    const body: RoasterPrior & { originalName?: string } = await req.json();
    if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });

    const slug = canonicalRoasterSlug(body.name);

    const aliases = new Set<string>(body.aliases ?? []);
    if (body.originalName) {
      const otherSlug = canonicalRoasterSlug(body.originalName);
      if (otherSlug && otherSlug !== slug) aliases.add(otherSlug);
    }

    const toSave: RoasterPrior = {
      ...body,
      aliases: aliases.size > 0 ? Array.from(aliases) : undefined,
      confidence: "user",
      savedAt: new Date().toISOString(),
    };

    const existingRows = await db.select().from(roasters).where(eq(roasters.slug, slug)).limit(1);
    const existing = existingRows[0];
    const mergedData = existing ? { ...(existing.data as RoasterPrior), ...toSave } : toSave;
    const mergedAliases = Array.from(new Set([...(existing?.aliases ?? []), ...Array.from(aliases)]));

    await db
      .insert(roasters)
      .values({
        slug,
        name: body.name,
        region: body.region,
        styleSummary: body.styleSummary,
        confidence: "user",
        aliases: mergedAliases,
        data: mergedData,
      })
      .onConflictDoUpdate({
        target: roasters.slug,
        set: {
          name: body.name,
          region: body.region,
          styleSummary: body.styleSummary,
          confidence: "user",
          aliases: mergedAliases,
          data: mergedData,
          savedAt: new Date(),
        },
      });

    return NextResponse.json({ ok: true, slug });
  } catch (err) {
    console.error("roasters POST error:", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
