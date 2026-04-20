import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authCredentials } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(authCredentials);
    return NextResponse.json({ registered: count > 0 });
  } catch {
    return NextResponse.json({ registered: false });
  }
}
