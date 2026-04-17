import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase/admin";
import type { Session } from "@/lib/types/session";

// Strip null values recursively before Zod — AI extraction returns null for
// unknown fields, but Zod .optional() expects absence (undefined), not null.
// Firestore also rejects undefined, so we sanitise at both ends.
function deepStripNulls(val: unknown): unknown {
  if (val === null) return undefined;
  if (Array.isArray(val)) return val.map(deepStripNulls).filter(v => v !== undefined);
  if (val && typeof val === "object") {
    return Object.fromEntries(
      Object.entries(val as Record<string, unknown>)
        .map(([k, v]) => [k, deepStripNulls(v)])
        .filter(([, v]) => v !== undefined)
    );
  }
  return val;
}

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
  brew: z.record(z.string(), z.unknown()).optional(),
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

    // Count-only mode — one aggregate read, no data transfer
    if (url.searchParams.get("count") === "true") {
      const db = getAdminDb();
      const snap = await db.collection("sessions").count().get();
      return NextResponse.json({ total: snap.data().count });
    }

    // IDs mode — fetch specific sessions by ID (used by coffee detail page)
    const idsParam = url.searchParams.get("ids");
    if (idsParam) {
      const ids = idsParam.split(",").map(s => s.trim()).filter(Boolean).slice(0, 300);
      const db = getAdminDb();
      const docs = await Promise.all(ids.map(id => db.collection("sessions").doc(id).get()));
      const sessions: Session[] = docs
        .filter(d => d.exists)
        .map(d => ({ id: d.id, ...d.data() } as Session));
      return NextResponse.json(sessions);
    }

    const rawLimit = Number(url.searchParams.get("limit") || "50");
    const limit = Math.min(Math.max(1, rawLimit), 300);
    const db = getAdminDb();
    // Two-query strategy: fetch newest sessions via createdAtMs index (all post-fix sessions),
    // then fall back to a larger unordered fetch to catch legacy sessions (no createdAtMs).
    // This guarantees the most recent sessions always appear regardless of collection size.
    const [newSnap, legacySnap] = await Promise.all([
      db.collection("sessions").orderBy("createdAtMs", "desc").limit(limit).get(),
      db.collection("sessions").limit(limit * 3).get(),
    ]);
    const seen = new Set<string>();
    const allDocs = [...newSnap.docs, ...legacySnap.docs].filter(d => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });
    const sessions: Session[] = allDocs
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
    const rawBody = await req.json();
    // Strip nulls before Zod (AI returns null for unknown fields; Zod .optional() wants absence)
    const body = deepStripNulls(rawBody);
    const parsed = SessionPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid session data", details: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data as Omit<Session, "id">;
    const db = getAdminDb();
    // Sanitise via JSON round-trip: removes any undefined values Firestore would reject
    const firestoreData = JSON.parse(JSON.stringify({ ...data, createdAtMs: Date.now() }));
    const ref = await db.collection("sessions").add(firestoreData);
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
          fermentationStyle: data.coffee.fermentationStyle || null,
          cuppingScore: data.coffee.cuppingScore ?? null,
          firstSeenAt: data.createdAt,
          sessionCount: 1,
          sessionIds: [sessionId],
          bagPhotoUrl: data.coffee.bagPhotoUrl || null,
          latestRoastDate: data.coffee.roastDate || null,
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
        // Always update roast date so the most recent session's date wins
        if (data.coffee.roastDate) {
          updateData.latestRoastDate = data.coffee.roastDate;
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
