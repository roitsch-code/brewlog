import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/auth/requireAuth";
import { getRoasterPrior, canonicalRoasterSlug } from "@/lib/roasters/priors";
import type { RoasterPrior } from "@/lib/roasters/priors";

export const dynamic = "force-dynamic";

async function findStoredRoaster(name: string): Promise<RoasterPrior | null> {
  const db = getAdminDb();
  const slug = canonicalRoasterSlug(name);

  const direct = await db.collection("roasters").doc(slug).get();
  if (direct.exists) return direct.data() as RoasterPrior;

  // Fall back to alias search — single where() is enough; duplicates unlikely
  const aliasSnap = await db
    .collection("roasters")
    .where("aliases", "array-contains", slug)
    .limit(1)
    .get();
  if (!aliasSnap.empty) return aliasSnap.docs[0].data() as RoasterPrior;

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

    // Fall back to curated static prior (handles name variants via canonical slug)
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
    const db = getAdminDb();
    await db.collection("roasters").doc(canonicalRoasterSlug(name)).delete();
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
    const db = getAdminDb();

    // If the name the user scanned differs from the stored name, track it as an alias
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
    // Firestore rejects undefined, and so does merge:true when the field is explicitly undefined
    const clean = JSON.parse(JSON.stringify(toSave));
    await db.collection("roasters").doc(slug).set(clean, { merge: true });
    return NextResponse.json({ ok: true, slug });
  } catch (err) {
    console.error("roasters POST error:", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
