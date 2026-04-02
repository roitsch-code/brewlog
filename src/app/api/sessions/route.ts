import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase/admin";
import type { Session } from "@/lib/types/session";

const SessionPostSchema = z.object({
  type: z.enum(["coffee", "wine"]),
  mode: z.enum(["home", "external"]),
  createdAt: z.string(),
  coffee: z.object({
    roaster: z.string().max(200),
    name: z.string().max(200),
    origin: z.string().max(200).optional().default(""),
    region: z.string().max(200).optional(),
    variety: z.string().max(200).optional(),
    process: z.string().max(100).optional().default(""),
    roastLevel: z.string().max(100).optional().default(""),
    roastDate: z.string().optional(),
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
  brew: z.record(z.string(), z.unknown()).optional(),
  result: z.object({
    rating: z.number().min(0).max(5),
    flavorNotes: z.array(z.string().max(100)).max(30).optional().default([]),
    body: z.string().max(50).optional().default(""),
    acidity: z.string().max(50).optional().default(""),
    freeNotes: z.string().max(2000).optional(),
    wouldUseMethodAgain: z.boolean().optional(),
    attribution: z.enum(["brew", "bean", "roaster"]).optional(),
    craft: z.enum(["off", "solid", "exceptional"]).optional(),
    fit: z.enum(["not-my-style", "neutral", "my-kind"]).optional(),
  }).optional(),
});

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const rawLimit = Number(new URL(req.url).searchParams.get("limit") || "50");
    const limit = Math.min(Math.max(1, rawLimit), 100);
    const db = getAdminDb();
    // Fetch without orderBy to include both old sessions (no createdAtMs) and new ones,
    // then sort client-side. createdAtMs is a Unix ms integer added to new sessions;
    // legacy sessions use createdAt (ISO string). For old sessions without either, fall back to 0.
    const snap = await db.collection("sessions").limit(limit * 3).get();
    const sessions: Session[] = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Session))
      .sort((a, b) => {
        const getMs = (s: Session & { createdAtMs?: number }) => {
          if (s.createdAtMs) return s.createdAtMs;
          if (s.createdAt) return new Date(s.createdAt).getTime();
          return 0;
        };
        return getMs(b) - getMs(a);
      })
      .slice(0, limit);
    return NextResponse.json(sessions);
  } catch (err) {
    console.error("sessions GET error:", err);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = SessionPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid session data", details: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data as Omit<Session, "id">;
    const db = getAdminDb();
    // Add createdAtMs for reliable orderBy (avoids mixed createdAt type issue)
    const ref = await db.collection("sessions").add({ ...data, createdAtMs: Date.now() });
    const sessionId = ref.id;

    // Upsert coffee library entry
    if (data.coffee?.name && data.coffee?.roaster) {
      const coffeeKey = `${data.coffee.roaster}__${data.coffee.name}`
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_");

      const coffeeRef = db.collection("coffees").doc(coffeeKey);
      const coffeeSnap = await coffeeRef.get();

      const newRating = data.result?.rating;
      const hasRating = typeof newRating === "number";

      if (!coffeeSnap.exists) {
        await coffeeRef.set({
          roaster: data.coffee.roaster,
          name: data.coffee.name,
          origin: data.coffee.origin || "",
          process: data.coffee.process || "",
          firstSeenAt: data.createdAt,
          sessionCount: 1,
          sessionIds: [sessionId],
          bagPhotoUrl: data.coffee.bagPhotoUrl || null,
          ratingSum: hasRating ? newRating : 0,
          ratingCount: hasRating ? 1 : 0,
          avgRating: hasRating ? newRating : null,
        });
      } else {
        const existing = coffeeSnap.data()!;
        const sessionIds: string[] = existing.sessionIds || [];
        sessionIds.push(sessionId);

        const ratingSum = (existing.ratingSum || 0) + (hasRating ? newRating! : 0);
        const ratingCount = (existing.ratingCount || 0) + (hasRating ? 1 : 0);
        const avgRating = ratingCount > 0 ? ratingSum / ratingCount : null;

        const updateData: Record<string, unknown> = {
          sessionCount: sessionIds.length,
          sessionIds,
          ratingSum,
          ratingCount,
          avgRating,
        };

        // Store photo if we don't have one yet
        if (!existing.bagPhotoUrl && data.coffee.bagPhotoUrl) {
          updateData.bagPhotoUrl = data.coffee.bagPhotoUrl;
        }

        await coffeeRef.update(updateData);
      }
    }

    return NextResponse.json({ id: sessionId });
  } catch (err) {
    console.error("sessions POST error:", err);
    return NextResponse.json({ error: "Failed to save session" }, { status: 500 });
  }
}
