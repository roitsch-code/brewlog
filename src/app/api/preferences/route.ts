import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { preferences } from "@/lib/db/schema";
import type { UserPreferences } from "@/lib/types/preferences";

export const dynamic = "force-dynamic";

const KEY = "default";

export async function GET() {
  try {
    const rows = await db.select().from(preferences).where(eq(preferences.key, KEY)).limit(1);
    if (rows.length === 0) return NextResponse.json(null);
    return NextResponse.json(rows[0].data as UserPreferences);
  } catch (err) {
    console.error("preferences GET error:", err);
    return NextResponse.json(null);
  }
}

export async function POST(req: NextRequest) {
  try {
    const incoming: Partial<UserPreferences> = await req.json();
    const existingRows = await db.select().from(preferences).where(eq(preferences.key, KEY)).limit(1);
    const existing = (existingRows[0]?.data ?? {}) as UserPreferences;
    const merged: UserPreferences = { ...existing, ...incoming } as UserPreferences;
    await db
      .insert(preferences)
      .values({ key: KEY, data: merged })
      .onConflictDoUpdate({ target: preferences.key, set: { data: merged } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("preferences POST error:", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
