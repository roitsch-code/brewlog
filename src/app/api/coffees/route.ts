import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { coffees, roasters } from "@/lib/db/schema";
import { rowToCoffee } from "@/lib/db/helpers";
import { getRoasterPrior } from "@/lib/roasters/priors";
import { coffeeKeyFor } from "@/lib/coffee/coffeeKey";
import { guardRoastYear } from "@/lib/coffee/roastDate";
import { deriveIdentitySummary } from "@/lib/coffee/blend";
import { mapNotesToZones } from "@/lib/field/mapNotesToZones";

export const dynamic = "force-dynamic";

export interface RoasterSummary {
  region?: string;
  styleSummary?: string;
  confidence: string;
}

export async function GET(req: NextRequest) {
  try {
    const rows = await db.select().from(coffees);
    const all = rows.map(rowToCoffee);

    if (req.nextUrl.searchParams.get("roasters") === "true") {
      const names = Array.from(new Set(all.map(c => c.roaster).filter(Boolean))).sort((a, b) => a.localeCompare(b));
      return NextResponse.json(names);
    }

    if (req.nextUrl.searchParams.get("roasterSummaries") === "true") {
      const roasterNames = Array.from(new Set(all.map(c => c.roaster).filter(Boolean)));
      const summaries: Record<string, RoasterSummary> = {};

      // Load every matching roaster row in a single query (was one query per
      // roaster — an N+1 that grew with the library).
      const slugByName = new Map(
        roasterNames.map(name => [name, name.toLowerCase().trim().replace(/\s+/g, "-")])
      );
      const slugs = Array.from(new Set(slugByName.values()));
      const savedRows = slugs.length > 0
        ? await db.select().from(roasters).where(inArray(roasters.slug, slugs))
        : [];
      const savedBySlug = new Map(savedRows.map(r => [r.slug, r]));

      for (const name of roasterNames) {
        const saved = savedBySlug.get(slugByName.get(name)!);
        if (saved) {
          summaries[name] = {
            region: saved.region ?? undefined,
            styleSummary: saved.styleSummary ?? undefined,
            confidence: saved.confidence ?? "user",
          };
          continue;
        }

        const prior = getRoasterPrior(name);
        if (prior.confidence !== "fallback") {
          summaries[name] = { region: prior.region, styleSummary: prior.styleSummary, confidence: prior.confidence };
        }
      }

      return NextResponse.json(summaries);
    }

    if (req.nextUrl.searchParams.get("match") === "true") {
      const name = (req.nextUrl.searchParams.get("name") || "").toLowerCase().trim();
      const roaster = (req.nextUrl.searchParams.get("roaster") || "").toLowerCase().trim();
      if (!name && !roaster) return NextResponse.json(null);
      const match = all.find(c =>
        (name ? c.name?.toLowerCase().trim() === name : true) &&
        (roaster ? c.roaster?.toLowerCase().trim() === roaster : true)
      ) ?? null;
      return NextResponse.json(match);
    }

    return NextResponse.json(all);
  } catch (err) {
    console.error("coffees GET error:", err);
    return NextResponse.json({ error: "Failed to load coffees" }, { status: 500 });
  }
}

/**
 * Create a coffee WITHOUT a brew session.
 *
 * Until this existed, a `coffees` row could only be born as a side effect of
 * saving a brew (POST /api/sessions) — so the home chat, which can read a bag
 * off a photo perfectly well, had no way to put it in the library and had to
 * tell the user to go type it into the scan form by hand.
 *
 * Field constraints mirror the `coffee` sub-object of SessionPostSchema so the
 * two creators accept the same shapes.
 */
const CoffeePostSchema = z.object({
  roaster: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  origin: z.string().max(200).optional().default(""),
  region: z.string().max(200).optional(),
  variety: z.string().max(200).optional(),
  process: z.string().max(100).optional().default(""),
  components: z
    .array(
      z.object({
        origin: z.string().max(200),
        region: z.string().max(200).optional(),
        variety: z.string().max(200).optional(),
        process: z.string().max(100).optional(),
        ratio: z.number().min(0).max(100).optional(),
      }),
    )
    .max(8)
    .optional(),
  fermentationStyle: z.string().max(200).optional(),
  roastLevel: z.string().max(100).optional(),
  roastDate: z.string().max(40).optional(),
  // Same numeric-string tolerance as the sessions route.
  cuppingScore: z.preprocess((v) => {
    if (v == null || v === "") return undefined;
    if (typeof v === "string") {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    }
    return v;
  }, z.number().min(0).max(100).optional()),
  bagPhotoUrl: z.string().url().optional().or(z.literal("")),
  tastingNotesFromBag: z.array(z.string().max(100)).max(20).optional(),
  /** New bags default to ★ in rotation — you add one because you just bought it. */
  inRotation: z.boolean().optional().default(true),
});

/** Trimmed value, or undefined when the field carries nothing usable. */
function clean(v: string | undefined | null): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

export async function POST(req: NextRequest) {
  try {
    const parsed = CoffeePostSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid coffee", issues: parsed.error.issues.slice(0, 5) },
        { status: 400 },
      );
    }
    const input = parsed.data;

    // Blend (2+ components): the scalar origin/region/variety/process become a
    // comma-joined summary, exactly as the sessions route does it, so every
    // blend-unaware consumer keeps reading the scalar unchanged.
    const components = input.components && input.components.length >= 2 ? input.components : undefined;
    const summary = components ? deriveIdentitySummary(components) : null;

    const origin = clean(summary?.origin ?? input.origin) ?? "";
    const process = clean(summary?.process ?? input.process) ?? "";
    const region = clean(summary?.region ?? input.region);
    const variety = clean(summary?.variety ?? input.variety);
    const roastLevel = clean(input.roastLevel);
    const fermentationStyle = clean(input.fermentationStyle);
    const bagPhotoUrl = clean(input.bagPhotoUrl);
    // Ambiguous month/day stamps ("18.05") resolve to the current year, not
    // last year — the same guard the bag scanner applies (PR #216).
    const rawRoastDate = clean(input.roastDate);
    const roastDate = rawRoastDate ? guardRoastYear(rawRoastDate) : undefined;
    const bagFlavors = (input.tastingNotesFromBag ?? [])
      .map((f) => f?.trim())
      .filter((f): f is string => !!f);

    // Same derivation as POST /api/sessions, so a bag added here and scanned +
    // brewed later merges onto this row instead of forking a duplicate.
    const id = coffeeKeyFor(input.roaster, input.name);

    const existingRows = await db.select().from(coffees).where(eq(coffees.id, id)).limit(1);
    const existing = existingRows[0];

    if (existing) {
      // MERGE, never error. The pill that calls this keeps its "added" state in
      // local component state, which is lost on reload — so a re-tap must be
      // harmless. Only fills what is currently empty; nothing already known
      // about this coffee is overwritten.
      const updates: Record<string, unknown> = {};
      if (!existing.origin && origin) updates.origin = origin;
      if (!existing.process && process) updates.process = process;
      if (!existing.region && region) updates.region = region;
      if (!existing.variety && variety) updates.variety = variety;
      if (!existing.roastLevel && roastLevel) updates.roastLevel = roastLevel;
      if (!existing.fermentationStyle && fermentationStyle) updates.fermentationStyle = fermentationStyle;
      if (!existing.bagPhotoUrl && bagPhotoUrl) updates.bagPhotoUrl = bagPhotoUrl;
      if (!existing.latestRoastDate && roastDate) updates.latestRoastDate = roastDate;
      if (!existing.cuppingScore && input.cuppingScore != null) {
        updates.cuppingScore = String(input.cuppingScore);
      }
      if ((existing.bagFlavors?.length ?? 0) === 0 && bagFlavors.length > 0) {
        updates.bagFlavors = bagFlavors;
      }
      if (!existing.components && components) updates.components = components;
      // Re-adding a bag you already own is how you put it back in rotation.
      if (input.inRotation && !existing.inRotation) updates.inRotation = true;

      // Only map zones when this coffee has none — a Field already computed for
      // it stays put (same policy as the sessions route).
      if (existing.fieldZones == null && bagFlavors.length > 0) {
        const zones = await mapNotesToZones(bagFlavors).catch(() => null);
        if (zones) updates.fieldZones = zones;
      }

      if (Object.keys(updates).length > 0) {
        await db.update(coffees).set(updates).where(eq(coffees.id, id));
      }
      return NextResponse.json({ id, created: false });
    }

    // Field composition from the bag's own notes — the same helper
    // /api/analyze-bag and /api/drip-bags use. Returns null on any failure and
    // must never be fatal: render falls back to the default Field.
    const fieldZones = bagFlavors.length > 0 ? await mapNotesToZones(bagFlavors).catch(() => null) : null;

    // onConflictDoNothing: the pill locks itself while saving, but a slow
    // request plus a reload (which resets that local state) can put two creates
    // in flight for the same bag. The id is deterministic, so the loser would
    // hit a primary-key violation and surface as a 500 on a tap that actually
    // succeeded. An empty `returning` means the other write won — that's the
    // merge case, not an error.
    const inserted = await db.insert(coffees).values({
      id,
      roaster: input.roaster.trim(),
      name: input.name.trim(),
      origin,
      process,
      components,
      variety,
      region,
      roastLevel,
      fermentationStyle,
      cuppingScore: input.cuppingScore != null ? String(input.cuppingScore) : undefined,
      firstSeenAt: new Date().toISOString(),
      // No brew yet. The library card hides the brew count at 0 and the detail
      // page has an explicit no-sessions fallback.
      sessionCount: 0,
      sessionIds: [],
      bagPhotoUrl,
      latestRoastDate: roastDate,
      ratingSum: "0",
      ratingCount: 0,
      fieldZones: fieldZones ?? undefined,
      bagFlavors: bagFlavors.length > 0 ? bagFlavors : undefined,
      inRotation: input.inRotation,
    }).onConflictDoNothing().returning({ id: coffees.id });

    return NextResponse.json({ id, created: inserted.length > 0 });
  } catch (err) {
    console.error("coffees POST error:", err);
    return NextResponse.json({ error: "Failed to add coffee" }, { status: 500 });
  }
}
