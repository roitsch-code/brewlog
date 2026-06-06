import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/requireAuth";
import { db } from "@/lib/db/client";
import {
  coffees,
  sessions,
  places,
  preferences,
  insights,
} from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/**
 * Read-only admin lookup endpoint — single-user project (see CLAUDE.md).
 *
 * Gated by the normal session cookie (requireAuth) — same auth as the rest
 * of the app, no static bypass secret. Meant to be opened in the owner's
 * logged-in browser to inspect specific live rows without SSHing into the VPS.
 *
 * SAFETY: this is NOT an arbitrary-SQL endpoint. Only the named lookups in
 * LOOKUPS run, each a fixed, parameterised read. Adding a lookup is a one-line
 * change here. (For Claude's own diagnostic reads there is a separate SSH
 * read-only-SQL GitHub Action — .github/workflows/db-read.yml — so this public
 * endpoint never needs a machine-callable secret.)
 *
 * Usage:  GET /api/admin/lookup?q=preferences
 *         GET /api/admin/lookup?q=coffee&roaster=Friedhats&name=Quiquira
 */
const ALLOWED = [
  "preferences",
  "counts",
  "rotation",
  "coffees",
  "coffee",
] as const;
type LookupName = (typeof ALLOWED)[number];

async function runLookup(
  q: LookupName,
  params: URLSearchParams,
): Promise<unknown> {
  switch (q) {
    case "preferences": {
      const rows = await db
        .select()
        .from(preferences)
        .where(eq(preferences.key, "default"))
        .limit(1);
      return rows[0]?.data ?? null;
    }

    case "counts": {
      const [c, s, p, i] = await Promise.all([
        db.select({ n: sql<number>`count(*)::int` }).from(coffees),
        db.select({ n: sql<number>`count(*)::int` }).from(sessions),
        db.select({ n: sql<number>`count(*)::int` }).from(places),
        db
          .select({ status: insights.status, n: sql<number>`count(*)::int` })
          .from(insights)
          .groupBy(insights.status),
      ]);
      return {
        coffees: c[0]?.n ?? 0,
        sessions: s[0]?.n ?? 0,
        places: p[0]?.n ?? 0,
        insightsByStatus: i,
      };
    }

    case "rotation": {
      return db
        .select({
          id: coffees.id,
          roaster: coffees.roaster,
          name: coffees.name,
          inRotation: coffees.inRotation,
          sessionCount: coffees.sessionCount,
          latestRoastDate: coffees.latestRoastDate,
        })
        .from(coffees)
        .where(eq(coffees.inRotation, true))
        .orderBy(desc(coffees.firstSeenAt));
    }

    case "coffees": {
      return db
        .select({
          id: coffees.id,
          roaster: coffees.roaster,
          name: coffees.name,
          inRotation: coffees.inRotation,
          sessionCount: coffees.sessionCount,
        })
        .from(coffees)
        .orderBy(desc(coffees.firstSeenAt))
        .limit(100);
    }

    case "coffee": {
      const id = params.get("id");
      const roaster = params.get("roaster");
      const name = params.get("name");
      if (id) {
        const rows = await db.select().from(coffees).where(eq(coffees.id, id)).limit(1);
        return rows[0] ?? null;
      }
      if (roaster && name) {
        const rows = await db
          .select()
          .from(coffees)
          .where(and(eq(coffees.roaster, roaster), eq(coffees.name, name)))
          .limit(1);
        return rows[0] ?? null;
      }
      throw new Error("coffee lookup needs ?id= OR ?roaster=&name=");
    }
  }
}

export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const params = req.nextUrl.searchParams;
  const q = params.get("q");

  if (!q || !ALLOWED.includes(q as LookupName)) {
    return NextResponse.json(
      { error: "Unknown lookup", allowed: ALLOWED },
      { status: 400 },
    );
  }

  try {
    const result = await runLookup(q as LookupName, params);
    return NextResponse.json({ q, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lookup failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
