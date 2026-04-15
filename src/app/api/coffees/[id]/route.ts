import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase/admin";
import type { Coffee } from "@/lib/types/coffee";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getAdminDb();
    const doc = await db.collection("coffees").doc(params.id).get();
    if (!doc.exists) return NextResponse.json(null, { status: 404 });
    return NextResponse.json({ id: doc.id, ...doc.data() } as Coffee);
  } catch (err) {
    console.error("coffee GET error:", err);
    return NextResponse.json(null, { status: 500 });
  }
}

const PatchSchema = z.object({
  personalNotes: z.string().max(5000),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const db = getAdminDb();
    const ref = db.collection("coffees").doc(params.id);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json(null, { status: 404 });
    await ref.update({ personalNotes: parsed.data.personalNotes });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("coffee PATCH error:", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
