import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getAdminDb();
    const snap = await db.collection("sessions").doc(params.id).get();
    if (!snap.exists) return NextResponse.json(null, { status: 404 });
    return NextResponse.json({ id: snap.id, ...snap.data() });
  } catch (err) {
    console.error("session GET error:", err);
    return NextResponse.json(null, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const data = await req.json();
  const db = getAdminDb();
  await db.collection("sessions").doc(params.id).update(data);
  return NextResponse.json({ success: true });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const db = getAdminDb();

  // Get session before deleting (need coffee info + rating)
  const sessionSnap = await db.collection("sessions").doc(id).get();
  if (!sessionSnap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = sessionSnap.data()!;
  await db.collection("sessions").doc(id).delete();

  // Cascade: update or delete the coffee doc
  if (session.coffee?.name && session.coffee?.roaster) {
    const coffeeKey = `${session.coffee.roaster}__${session.coffee.name}`
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_");

    const coffeeRef = db.collection("coffees").doc(coffeeKey);
    const coffeeSnap = await coffeeRef.get();

    if (coffeeSnap.exists) {
      const existing = coffeeSnap.data()!;
      const sessionIds: string[] = (existing.sessionIds || []).filter((sid: string) => sid !== id);

      if (sessionIds.length === 0) {
        // No more sessions → delete the coffee entry
        await coffeeRef.delete();
      } else {
        // Recalculate rating by subtracting the deleted session's rating
        const deletedRating = session.result?.rating;
        const hasRating = typeof deletedRating === "number";
        const ratingSum = Math.max(0, (existing.ratingSum || 0) - (hasRating ? deletedRating : 0));
        const ratingCount = Math.max(0, (existing.ratingCount || 0) - (hasRating ? 1 : 0));
        const avgRating = ratingCount > 0 ? ratingSum / ratingCount : null;

        await coffeeRef.update({
          sessionIds,
          sessionCount: sessionIds.length,
          ratingSum,
          ratingCount,
          avgRating,
        });
      }
    }
  }

  return NextResponse.json({ success: true });
}
