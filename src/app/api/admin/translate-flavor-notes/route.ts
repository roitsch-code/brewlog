import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { coffees, dripBags } from "@/lib/db/schema";
import { translateNotesToEnglish } from "@/lib/scan/translateNotes";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5min — ~50 coffees × ~1s Haiku each, big headroom.

/**
 * One-shot retroactive translation: rewrite existing scanned flavour notes to
 * English for bags scanned BEFORE PR #471 made the scan paths translate at
 * extraction time. Covers the two first-class scanned-flavour fields:
 *   - coffees.bag_flavors   (the library's printed-bag flavours)
 *   - drip_bags.bag_notes   (AI-extracted drip-bag flavours)
 *
 * Does NOT touch commonNotes (the user's OWN tasted words) or drip flavorNotes
 * (picked from the English taxonomy) — only the machine-scanned bag flavours the
 * fix was about. Writes a row ONLY when translation actually changed it, targeted
 * by id (never a broad update, never a wipe). Idempotent: re-running an
 * already-English library translates English→English → no writes.
 *
 * Auth: CRON_SECRET bearer, same as the other /api/admin routes.
 * Trigger: the `translate-flavor-notes` GitHub Action (SSH → docker compose exec
 * → curl with the container's own CRON_SECRET). Never run by hand.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const changed = (a: string[], b: string[]) => JSON.stringify(a) !== JSON.stringify(b);

  try {
    const results: Array<{
      table: "coffees" | "drip_bags";
      id: string;
      name: string;
      status: "translated" | "unchanged" | "empty";
      from?: string;
      to?: string;
    }> = [];

    // Library coffees — bag_flavors.
    const coffeeRows = await db.select().from(coffees);
    for (const row of coffeeRows) {
      const notes = (row.bagFlavors ?? []).filter(
        (n): n is string => typeof n === "string" && n.trim().length > 0,
      );
      if (notes.length === 0) {
        results.push({ table: "coffees", id: row.id, name: row.name, status: "empty" });
        continue;
      }
      const translated = await translateNotesToEnglish(notes);
      if (changed(notes, translated)) {
        await db.update(coffees).set({ bagFlavors: translated }).where(eq(coffees.id, row.id));
        results.push({ table: "coffees", id: row.id, name: row.name, status: "translated", from: notes.join(", "), to: translated.join(", ") });
      } else {
        results.push({ table: "coffees", id: row.id, name: row.name, status: "unchanged" });
      }
    }

    // Drip bags — bag_notes (AI-extracted); flavor_notes stay (taxonomy = English).
    const dripRows = await db.select().from(dripBags);
    for (const row of dripRows) {
      const notes = (row.bagNotes ?? []).filter(
        (n): n is string => typeof n === "string" && n.trim().length > 0,
      );
      if (notes.length === 0) {
        results.push({ table: "drip_bags", id: row.id, name: row.name, status: "empty" });
        continue;
      }
      const translated = await translateNotesToEnglish(notes);
      if (changed(notes, translated)) {
        await db.update(dripBags).set({ bagNotes: translated }).where(eq(dripBags.id, row.id));
        results.push({ table: "drip_bags", id: row.id, name: row.name, status: "translated", from: notes.join(", "), to: translated.join(", ") });
      } else {
        results.push({ table: "drip_bags", id: row.id, name: row.name, status: "unchanged" });
      }
    }

    const summary = {
      total: results.length,
      translated: results.filter((r) => r.status === "translated").length,
      unchanged: results.filter((r) => r.status === "unchanged").length,
      empty: results.filter((r) => r.status === "empty").length,
      results,
    };
    return NextResponse.json(summary);
  } catch (err) {
    console.error("translate-flavor-notes error:", err);
    return NextResponse.json(
      { error: "Translate failed", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
