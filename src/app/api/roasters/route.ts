import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/auth/requireAuth";
import { getRoasterPrior } from "@/lib/roasters/priors";
import type { RoasterPrior } from "@/lib/roasters/priors";

export const dynamic = "force-dynamic";

function toSlug(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, "-");
}

export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const name = req.nextUrl.searchParams.get("name");
  if (!name) return NextResponse.json(null, { status: 400 });

  try {
    const db = getAdminDb();
    const snap = await db.collection("roasters").doc(toSlug(name)).get();
    if (snap.exists) return NextResponse.json(snap.data() as RoasterPrior);

    // Fall back to curated static prior (fuzzy: "Friedhats Coffee Roasters" → "Friedhats")
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
    await db.collection("roasters").doc(toSlug(name)).delete();
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
    const prior: RoasterPrior = await req.json();
    if (!prior.name) return NextResponse.json({ error: "name required" }, { status: 400 });

    const slug = toSlug(prior.name);
    const db = getAdminDb();
    await db.collection("roasters").doc(slug).set(
      { ...prior, confidence: "user", savedAt: new Date().toISOString() },
      { merge: true }
    );
    return NextResponse.json({ ok: true, slug });
  } catch (err) {
    console.error("roasters POST error:", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
