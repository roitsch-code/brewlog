import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { coffees } from "@/lib/db/schema";
import { mapNotesToZones } from "@/lib/field/mapNotesToZones";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5min — ~25 coffees × ~1–2s Haiku each, huge headroom.

/**
 * One-shot re-map: recompute coffees.field_zones for EVERY coffee that has
 * printed bag notes, overwriting the existing composition.
 *
 * Why this exists: the "Big-Sur" intensity pass applies to every coffee
 * instantly (it's pure render math), but the new `cool-berry` blue zone only
 * shows once a coffee's notes are re-run through mapNotesToZones — existing
 * rows were mapped before the zone existed, so a blueberry bag stays orange-red
 * until re-mapped. Hit this once after deploy and the blue lands on the bags
 * that earned it.
 *
 * Notes source: the first-class `bagFlavors` column (the flavours printed on the
 * bag — exactly what the Field was always derived from), falling back to
 * `commonNotes` (what the user has tasted) when a coffee has no bag flavours.
 * Coffees with neither are skipped; their Field stays as-is.
 *
 * Unlike the prewarm-coffee-insights route this does NOT preserve any per-row
 * state — field_zones is a derived visual, not a user-acted card, so a clean
 * overwrite is correct. A coffee whose notes map to nothing usable keeps its
 * old composition (we only write on a successful mapping, never null it out).
 *
 * Auth: same CRON_SECRET bearer pattern as the other /api/admin routes
 * (middleware lets /api/admin through PUBLIC_PATHS, so this bearer is the gate).
 *
 * Trigger: the `field-zones-remap` GitHub Action (SSH → docker compose exec →
 * curl with the container's own CRON_SECRET). Never run by hand.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await db.select().from(coffees);

    const results: Array<{
      id: string;
      name: string;
      status: "remapped" | "skipped" | "failed";
      reason?: string;
      zones?: string;
    }> = [];

    for (const row of rows) {
      const bag = (row.bagFlavors ?? []).filter((n): n is string => typeof n === "string" && n.trim().length > 0);
      const common = (row.commonNotes ?? []).filter((n): n is string => typeof n === "string" && n.trim().length > 0);
      const notes = bag.length > 0 ? bag : common;

      if (notes.length === 0) {
        results.push({ id: row.id, name: row.name, status: "skipped", reason: "no notes" });
        continue;
      }

      const fieldZones = await mapNotesToZones(notes, "tasting-notes");
      if (!fieldZones) {
        // Mapping returned nothing usable — leave the existing Field untouched.
        results.push({ id: row.id, name: row.name, status: "failed", reason: "no usable zones" });
        continue;
      }

      await db.update(coffees).set({ fieldZones }).where(eq(coffees.id, row.id));
      results.push({
        id: row.id,
        name: row.name,
        status: "remapped",
        zones: fieldZones.zones.map((z) => `${z.id}(${z.weight.toFixed(2)})`).join(" + "),
      });
    }

    const summary = {
      total: rows.length,
      remapped: results.filter((r) => r.status === "remapped").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    };
    return NextResponse.json(summary);
  } catch (err) {
    console.error("remap-field-zones error:", err);
    return NextResponse.json(
      { error: "Re-map failed", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
