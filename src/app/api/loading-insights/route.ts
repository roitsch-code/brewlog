import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/requireAuth";
import { db } from "@/lib/db/client";
import { loadingInsights } from "@/lib/db/schema";
import { MAX_CHARS, MAX_WORDS, wordCount } from "@/lib/insights/loadingInsightLint";

export const dynamic = "force-dynamic";

/**
 * GET — live loading-screen insights for the recipe-creation wait.
 *
 * Returns `{ insights: string[] }`. The screen merges these with the static
 * COFFEE_HINTS seed, so this endpoint is purely additive: returning [] (incl.
 * before the migration has run, or on any DB error) just means the screen
 * shows the seed. It must NEVER throw the screen into an error state — every
 * failure path returns an empty list.
 */
export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  try {
    const rows = await db
      .select({ text: loadingInsights.text })
      .from(loadingInsights)
      .where(eq(loadingInsights.status, "live"));

    // Defensive: a stored row must never break the 40px headline layout, even
    // if it somehow got in past the gate. Cheap to re-check here.
    const insights = rows
      .map((r) => r.text)
      .filter((t) => t.length <= MAX_CHARS && wordCount(t) <= MAX_WORDS);

    const res = NextResponse.json({ insights });
    // Short private cache — the pool changes ~monthly; the screen re-fetches
    // on each mount but doesn't need a fresh DB hit every time.
    res.headers.set("Cache-Control", "private, max-age=300");
    return res;
  } catch {
    return NextResponse.json({ insights: [] });
  }
}
