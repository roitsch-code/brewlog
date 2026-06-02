import { NextRequest, NextResponse } from "next/server";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { coffees, sessions } from "@/lib/db/schema";
import type { CoffeeCoachInsight } from "@/lib/db/schema";
import { rowToCoffee, rowToSession } from "@/lib/db/helpers";
import { generateCoffeeInsight } from "@/lib/claude/coffeeInsight";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5min — enough room for 5–10 coffees × ~8s Opus each.

/**
 * One-shot pre-warm: generate a per-coffee insight for every coffee
 * currently in rotation. Hit this once after migration 0015 lands (or
 * after a fresh batch of coffees gets added to rotation) so the
 * /coffees/[id] cards appear instantly instead of waiting 5–8s for
 * Opus on first open.
 *
 * Status preservation: insights with `status='trying'` or `'confirmed'`
 * are NOT touched. The user is mid-act-on-them; replacing the text
 * would yank the rug.
 *
 * Auth: same CRON_SECRET bearer pattern as /api/research,
 * /api/coffees/compact, /api/conversations/cleanup. Lives under
 * /api/admin/ which the middleware already lets through PUBLIC_PATHS,
 * so the bearer check here is the only gate.
 *
 * Trigger:
 *   docker compose exec -T app node -e "
 *     fetch('http://localhost:3000/api/admin/prewarm-coffee-insights', {
 *       method: 'POST',
 *       headers: { Authorization: 'Bearer ' + process.env.CRON_SECRET }
 *     }).then(r => r.text()).then(t => console.log(t))
 *   "
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rotation = await db
      .select()
      .from(coffees)
      .where(eq(coffees.inRotation, true));

    const results: Array<{
      id: string;
      name: string;
      status: "generated" | "skipped" | "failed";
      reason?: string;
    }> = [];

    for (const row of rotation) {
      const coffee = rowToCoffee(row);
      const cached = (row.coachInsight ?? null) as CoffeeCoachInsight | null;

      // Preserve any insight the user is acting on.
      if (cached?.status === "trying" || cached?.status === "confirmed") {
        results.push({
          id: coffee.id,
          name: coffee.name,
          status: "skipped",
          reason: `user is ${cached.status}`,
        });
        continue;
      }

      const sessionRows = await db
        .select()
        .from(sessions)
        .where(sql`${sessions.coffee}->>'coffeeId' = ${coffee.id}`)
        .orderBy(desc(sessions.createdAtMs))
        .limit(30);
      const sessionList = sessionRows.map(rowToSession);
      const latestSessionMs = sessionRows[0]?.createdAtMs ?? 0;

      // Skip when the cached insight is still fresh.
      if (cached && cached.generatedAtSessionMs >= latestSessionMs) {
        results.push({
          id: coffee.id,
          name: coffee.name,
          status: "skipped",
          reason: "fresh",
        });
        continue;
      }

      const generated = await generateCoffeeInsight(coffee, sessionList);
      if (!generated) {
        results.push({
          id: coffee.id,
          name: coffee.name,
          status: "failed",
          reason: "opus call returned null",
        });
        continue;
      }

      const next: CoffeeCoachInsight = {
        observation: generated.observation,
        suggestion: generated.suggestion,
        status: "new",
        generatedAtSessionMs: latestSessionMs,
        generatedAt: new Date().toISOString(),
      };
      await db
        .update(coffees)
        .set({ coachInsight: next })
        .where(eq(coffees.id, coffee.id));
      results.push({ id: coffee.id, name: coffee.name, status: "generated" });
    }

    const summary = {
      total: rotation.length,
      generated: results.filter((r) => r.status === "generated").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    };
    return NextResponse.json(summary);
  } catch (err) {
    console.error("prewarm-coffee-insights error:", err);
    return NextResponse.json(
      { error: "Pre-warm failed", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
