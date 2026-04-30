import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sessions, coffees } from "@/lib/db/schema";
import { rowToSession } from "@/lib/db/helpers";
import type { Session } from "@/lib/types/session";

const SessionPostSchema = z.object({
  type: z.enum(["coffee", "wine"]),
  mode: z.enum(["home", "external"]),
  createdAt: z.string(),
  coffee: z.object({
    roaster: z.string().max(200).optional().default(""),
    name: z.string().max(200).optional().default(""),
    origin: z.string().max(200).optional().default(""),
    region: z.string().max(200).optional(),
    variety: z.string().max(200).optional(),
    process: z.string().max(100).optional().default(""),
    fermentationStyle: z.string().max(200).optional(),
    roastLevel: z.string().max(100).optional().default(""),
    roastDate: z.string().optional(),
    cuppingScore: z.number().min(0).max(100).optional(),
    bagPhotoUrl: z.string().url().optional().or(z.literal("")),
    bagPhotoPath: z.string().max(500).optional(),
    aiExtracted: z.boolean().default(false),
    tastingNotesFromBag: z.array(z.string().max(100)).max(20).optional(),
    coffeeId: z.string().optional(),
  }).optional(),
  place: z.object({
    name: z.string().max(200),
    location: z.string().max(300).optional(),
    methodServed: z.string().max(100).optional(),
  }).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  recommendation: z.record(z.string(), z.unknown()).optional(),
  brew: z.object({
    methodUsed: z.string().max(100).optional(),
    doseGrams: z.number().min(0).max(500).optional(),
    waterGrams: z.number().min(0).max(2000).optional(),
    dripAssist: z.boolean().optional(),
    followedRecipe: z.boolean().optional(),
    modifications: z.string().max(1000).optional(),
    actualTimeSec: z.number().min(0).max(3600).optional(),
    flow: z.enum(["too-fast", "perfect", "too-slow", "na"]).optional(),
    timing: z.enum(["as-expected", "faster", "slower"]).optional(),
    grindSettingUsed: z.string().max(100).optional(),
    actualTempC: z.number().min(0).max(120).optional(),
    followedAgitation: z.enum(["yes", "partially", "no"]).optional(),
    agitationNote: z.string().max(500).optional(),
  }).optional(),
  result: z.object({
    rating: z.number().min(0).max(5),
    flavorNotes: z.array(z.string().max(100)).max(30).optional().default([]),
    body: z.string().max(50).optional().default(""),
    acidity: z.string().max(50).optional().default(""),
    freeNotes: z.string().max(2000).optional(),
    wouldBrewAgain: z.boolean().optional(),
    attribution: z.enum(["brew", "bean", "roaster"]).optional(),
    craft: z.enum(["off", "solid", "exceptional"]).optional(),
    fit: z.enum(["not-my-style", "neutral", "my-kind"]).optional(),
  }).optional(),
});

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const modeParam = url.searchParams.get("mode");
    const modeFilter = modeParam === "home" || modeParam === "external"
      ? eq(sessions.mode, modeParam)
      : undefined;

    if (url.searchParams.get("count") === "true") {
      const base = db.select({ count: sql<number>`count(*)::int` }).from(sessions);
      const [{ count }] = modeFilter ? await base.where(modeFilter) : await base;
      return NextResponse.json({ total: count });
    }

    const idsParam = url.searchParams.get("ids");
    if (idsParam) {
      const ids = idsParam.split(",").map(s => s.trim()).filter(Boolean).slice(0, 300);
      if (ids.length === 0) return NextResponse.json([]);
      const rows = await db.select().from(sessions).where(inArray(sessions.id, ids));
      return NextResponse.json(rows.map(rowToSession));
    }

    const rawLimit = Number(url.searchParams.get("limit") || "50");
    const limit = Math.min(Math.max(1, rawLimit), 300);
    const base = db.select().from(sessions).orderBy(desc(sessions.createdAtMs)).limit(limit);
    const rows = modeFilter ? await base.where(modeFilter) : await base;
    return NextResponse.json(rows.map(rowToSession));
  } catch (err) {
    console.error("sessions GET error:", err);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parsed = SessionPostSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid session data", details: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data as Omit<Session, "id">;
    const sessionId = randomUUID();
    const createdAtMs = Date.now();
    const createdAt = new Date(data.createdAt);

    await db.insert(sessions).values({
      id: sessionId,
      type: data.type,
      mode: data.mode,
      createdAt,
      createdAtMs,
      coffee: data.coffee,
      place: data.place,
      context: data.context,
      recommendation: data.recommendation,
      brew: data.brew,
      result: data.result,
    });

    if (data.coffee?.name) {
      const coffeeKey = `${data.coffee.roaster}__${data.coffee.name}`
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_");

      const newRating = data.result?.rating;
      const hasRating = typeof newRating === "number";

      const existingRows = await db
        .select()
        .from(coffees)
        .where(sql`${coffees.id} = ${coffeeKey}`)
        .limit(1);
      const existing = existingRows[0];

      if (!existing) {
        await db.insert(coffees).values({
          id: coffeeKey,
          roaster: data.coffee.roaster,
          name: data.coffee.name,
          origin: data.coffee.origin || "",
          process: data.coffee.process || "",
          fermentationStyle: data.coffee.fermentationStyle,
          cuppingScore: data.coffee.cuppingScore != null ? String(data.coffee.cuppingScore) : undefined,
          firstSeenAt: data.createdAt,
          sessionCount: 1,
          sessionIds: [sessionId],
          bagPhotoUrl: data.coffee.bagPhotoUrl || undefined,
          latestRoastDate: data.coffee.roastDate,
          ratingSum: hasRating ? String(newRating) : "0",
          ratingCount: hasRating ? 1 : 0,
          avgRating: hasRating ? String(newRating) : undefined,
        });
      } else {
        const sessionIds = [...(existing.sessionIds ?? []), sessionId];
        const prevSum = Number(existing.ratingSum ?? 0);
        const prevCount = existing.ratingCount ?? 0;
        const ratingSum = prevSum + (hasRating ? newRating! : 0);
        const ratingCount = prevCount + (hasRating ? 1 : 0);
        const avgRating = ratingCount > 0 ? ratingSum / ratingCount : null;

        await db
          .update(coffees)
          .set({
            sessionCount: sessionIds.length,
            sessionIds,
            ratingSum: String(ratingSum),
            ratingCount,
            avgRating: avgRating != null ? String(avgRating) : null,
            bagPhotoUrl: existing.bagPhotoUrl ?? data.coffee.bagPhotoUrl ?? null,
            latestRoastDate: data.coffee.roastDate ?? existing.latestRoastDate,
          })
          .where(sql`${coffees.id} = ${coffeeKey}`);
      }
    }

    return NextResponse.json({ id: sessionId });
  } catch (err) {
    console.error("sessions POST error:", err);
    return NextResponse.json({ error: "Failed to save session" }, { status: 500 });
  }
}
