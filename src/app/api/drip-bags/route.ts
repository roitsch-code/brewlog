import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { dripBags } from "@/lib/db/schema";
import type { DripBag } from "@/lib/types/dripBag";

export const dynamic = "force-dynamic";

const DripBagSchema = z.object({
  roaster: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  origin: z.string().max(200).optional(),
  region: z.string().max(200).optional(),
  variety: z.string().max(200).optional(),
  process: z.string().max(120).optional(),
  roastLevel: z.string().max(60).optional(),
  bagNotes: z.array(z.string().max(120)).max(40).default([]),
  flavorNotes: z.array(z.string().max(120)).max(60).default([]),
  rating: z.number().min(0).max(5),
  freeNotes: z.string().max(2000).optional(),
  bagPhotoUrl: z.string().max(2000).optional(),
  bagPhotoPath: z.string().max(2000).optional(),
  // Generative Field composition is computed server-side at scan time
  // (analyze-bag) and passed straight through — kept loose here.
  fieldZones: z.any().optional(),
  aiExtracted: z.boolean().default(false),
});

function rowToDripBag(r: typeof dripBags.$inferSelect): DripBag {
  return {
    id: r.id,
    roaster: r.roaster,
    name: r.name,
    origin: r.origin ?? undefined,
    region: r.region ?? undefined,
    variety: r.variety ?? undefined,
    process: r.process ?? undefined,
    roastLevel: r.roastLevel ?? undefined,
    bagNotes: r.bagNotes ?? [],
    flavorNotes: r.flavorNotes ?? [],
    rating: r.rating != null ? Number(r.rating) : 0,
    freeNotes: r.freeNotes ?? undefined,
    bagPhotoUrl: r.bagPhotoUrl ?? undefined,
    bagPhotoPath: r.bagPhotoPath ?? undefined,
    fieldZones: (r.fieldZones as DripBag["fieldZones"]) ?? null,
    aiExtracted: r.aiExtracted,
    createdAt: r.createdAt.toISOString(),
    createdAtMs: r.createdAtMs,
  };
}

export async function GET() {
  try {
    const rows = await db.select().from(dripBags).orderBy(desc(dripBags.createdAtMs)).limit(200);
    return NextResponse.json(rows.map(rowToDripBag));
  } catch (err) {
    console.error("drip-bags GET error:", err);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = DripBagSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
    }
    const d = parsed.data;
    const now = new Date();
    const id = randomUUID();
    await db.insert(dripBags).values({
      id,
      roaster: d.roaster,
      name: d.name,
      origin: d.origin,
      region: d.region,
      variety: d.variety,
      process: d.process,
      roastLevel: d.roastLevel,
      bagNotes: d.bagNotes,
      flavorNotes: d.flavorNotes,
      // numeric columns take a string per the project convention
      rating: String(d.rating),
      freeNotes: d.freeNotes,
      bagPhotoUrl: d.bagPhotoUrl,
      bagPhotoPath: d.bagPhotoPath,
      fieldZones: d.fieldZones ?? null,
      aiExtracted: d.aiExtracted,
      createdAt: now,
      createdAtMs: now.getTime(),
    });
    return NextResponse.json(
      {
        id,
        roaster: d.roaster,
        name: d.name,
        origin: d.origin,
        region: d.region,
        variety: d.variety,
        process: d.process,
        roastLevel: d.roastLevel,
        bagNotes: d.bagNotes,
        flavorNotes: d.flavorNotes,
        rating: d.rating,
        freeNotes: d.freeNotes,
        bagPhotoUrl: d.bagPhotoUrl,
        bagPhotoPath: d.bagPhotoPath,
        fieldZones: d.fieldZones ?? null,
        aiExtracted: d.aiExtracted,
        createdAt: now.toISOString(),
        createdAtMs: now.getTime(),
      } satisfies DripBag,
      { status: 201 }
    );
  } catch (err) {
    console.error("drip-bags POST error:", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
