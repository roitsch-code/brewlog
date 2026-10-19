import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gt } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/requireAuth";
import { db } from "@/lib/db/client";
import { coffees, insights } from "@/lib/db/schema";
import type { CoffeeCoachInsight } from "@/lib/db/schema";
import { ALL_RECIPES } from "@/lib/knowledge/recipes";
import { freshRecipes, type FreshItem } from "@/lib/fresh/freshItems";

export const dynamic = "force-dynamic";

/**
 * GET /api/fresh?since=<ms>&coffeeId=&waterMl=
 *
 * What is new since `since` (2026-10-19): recipes the scout added to the
 * corpus (on a brewer that serves the amount), the newest general coach
 * insight the coach wrote, and a new per-coffee card for the bag on the
 * counter. Read by the Context step's Fresh strip and by nothing on Home —
 * the owner keeps Home clean. Every failure path returns `[]`.
 */
export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const url = new URL(req.url);
  const sinceRaw = Number(url.searchParams.get("since"));
  const since = Number.isFinite(sinceRaw) && sinceRaw > 0 ? sinceRaw : undefined;
  const coffeeId = url.searchParams.get("coffeeId")?.trim() || undefined;
  const waterRaw = Number(url.searchParams.get("waterMl"));
  const waterMl = Number.isFinite(waterRaw) && waterRaw > 0 ? waterRaw : undefined;

  const items: FreshItem[] = freshRecipes(ALL_RECIPES, { since, waterMl });

  try {
    const rows = await db
      .select({ id: insights.id, observation: insights.observation, suggestion: insights.suggestion, createdAt: insights.createdAt })
      .from(insights)
      .where(since ? and(eq(insights.source, "opus"), eq(insights.status, "new"), gt(insights.createdAt, new Date(since))) : and(eq(insights.source, "opus"), eq(insights.status, "new")))
      .orderBy(desc(insights.createdAt))
      .limit(1);
    const row = rows[0];
    if (row) {
      items.push({
        key: `coach:${row.id}`,
        kind: "coach",
        title: "New from the coach",
        body: row.observation,
        href: "/taste",
        at: row.createdAt.toISOString(),
      });
    }
  } catch (err) {
    console.error("[fresh] insights read failed:", err);
  }

  if (coffeeId) {
    try {
      const rows = await db.select({ id: coffees.id, name: coffees.name, coachInsight: coffees.coachInsight }).from(coffees).where(eq(coffees.id, coffeeId)).limit(1);
      const card = rows[0]?.coachInsight as CoffeeCoachInsight | null | undefined;
      const at = card?.generatedAt ? Date.parse(card.generatedAt) : NaN;
      if (card && card.status === "new" && Number.isFinite(at) && (since === undefined || at > since)) {
        items.push({
          key: `coffee-card:${coffeeId}:${card.generatedAt}`,
          kind: "coffee-card",
          title: `New for ${rows[0].name}`,
          body: card.observation,
          href: `/coffees/${encodeURIComponent(coffeeId)}`,
          at: new Date(at).toISOString(),
        });
      }
    } catch (err) {
      console.error("[fresh] coffee card read failed:", err);
    }
  }

  return NextResponse.json({ items });
}
