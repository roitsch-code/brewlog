import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import type { Session } from "@/lib/types/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const limit = Number(new URL(req.url).searchParams.get("limit") || "50");
    const db = getAdminDb();
    // No orderBy — avoids issues with mixed createdAt field types (string vs Timestamp)
    // Client sorts after receiving
    const snap = await db.collection("sessions").limit(limit).get();
    const sessions: Session[] = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Session))
      .sort((a, b) => {
        const ta = typeof a.createdAt === "string" ? a.createdAt : "";
        const tb = typeof b.createdAt === "string" ? b.createdAt : "";
        return tb.localeCompare(ta);
      });
    return NextResponse.json(sessions);
  } catch (err) {
    console.error("sessions GET error:", err);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json() as Omit<Session, "id">;
    const db = getAdminDb();
    const ref = await db.collection("sessions").add(data);
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
