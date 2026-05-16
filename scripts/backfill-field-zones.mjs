// Field v1.1 Phase 5 — backfill coffees.field_zones for existing rows.
//
// Reads each coffee row where field_zones IS NULL, finds the latest
// session that scanned the bag with non-empty tastingNotesFromBag,
// runs the same Haiku mapping the live /api/analyze-bag pipeline runs,
// writes the result back to coffees.field_zones. Coffees with no
// notes in any session are skipped — Phase 4 variety fallback will
// pick them up later.
//
// IMPORTANT: the production Docker image is a Next.js standalone build
// — @anthropic-ai/sdk is bundled into the compiled API routes but is
// NOT present as a top-level node_modules entry that an external
// script can import. This file therefore calls the Anthropic Messages
// API over plain fetch — no SDK dependency, only `pg` (which IS in
// the standalone node_modules thanks to Drizzle's tracer).
//
// Run from the VPS (where DATABASE_URL + ANTHROPIC_API_KEY are set):
//   docker cp scripts brewlog-app-1:/app/ \
//     && docker compose exec app node scripts/backfill-field-zones.mjs
//
// Cost: ~$0.0001 per coffee, one-shot. With ~21 rows, ~$0.002 total.

import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY env var missing");
  process.exit(1);
}

const VALID_ZONE_IDS = new Set([
  "fruity-bright",
  "fruity-deep",
  "floral",
  "nutty-cocoa",
  "spice-earth",
  "sweet-caramel",
]);

// Verbatim from src/lib/field/mapNotesToZones.ts so the backfill
// produces the exact same compositions a fresh scan would.
const SYSTEM_PROMPT = `You are a perceptual aroma-to-color mapper for a specialty coffee app. Given an array of tasting notes (English or German), you return a JSON object specifying which BrewLog Field Zones the notes map to, with weights, plus optional saturation/lightness modifiers from texture descriptors. Return JSON only, no prose.

Available Field Zones (id : exemplar aromas):
- fruity-bright : citrus, lemon, orange, grapefruit, mandarin, berry, blueberry, raspberry, cherry, cranberry, peach, apricot, currant, pomegranate
- fruity-deep : dried fruit, date, raisin, fig, prune, plum, red grape, port, wine, fermented fruit, dark cherry
- floral : jasmine, rose, hibiscus, bergamot, chamomile, tea, lavender, elderflower, white flowers, floral, perfume
- nutty-cocoa : chocolate, cocoa, milk chocolate, dark chocolate, nut, almond, hazelnut, walnut, pecan, peanut, roasted, malt
- spice-earth : cinnamon, clove, cardamom, tobacco, leather, earth, herbs, savoury, spice, woody, cedar, smoke
- sweet-caramel : caramel, honey, brown sugar, maple, vanilla, butter, toffee, syrup, molasses, custard, marzipan

Texture/quality modifiers (NOT zones — adjust saturation and lightness instead):
- juicy / vibrant / lively / bright → saturation +5 to +10
- elegant / delicate / refined → lightness +5 to +10, saturation -5
- clean / crisp / pristine → lightness +5, saturation -5
- complex / deep / intense → no shift, allow 3 zones
- balanced / harmonic / silky → no shift
- creamy / velvety / rich → lightness -5, saturation +5
- dense / heavy / full-bodied → lightness -10, saturation +5

Rules:
- Output 1-3 zones. Most coffees are 2-3 zones.
- Zone weights are floats in [0, 1] summing to exactly 1.0.
- modifier.saturation and modifier.lightness are integers in [-15, +15].
- If a note is unfamiliar or non-aromatic (e.g. "rare", "delightful"), ignore it.
- If ALL notes are unfamiliar, return {"zones": [], "modifiers": {"saturation": 0, "lightness": 0}}.
  The caller will treat empty zones as "fall back to default".
- German notes are valid input: pflaumig → prune (fruity-deep), nussig → nutty-cocoa, zitronig → citrus (fruity-bright), schokoladig → chocolate (nutty-cocoa).`;

function extractJson(text) {
  if (!text) return null;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [];
  if (fence && fence[1]) candidates.push(fence[1].trim());
  const greedy = text.match(/\{[\s\S]*\}/);
  if (greedy && greedy[0]) candidates.push(greedy[0]);
  candidates.push(text.trim());
  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {}
  }
  return null;
}

function validateResponse(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  if (!Array.isArray(parsed.zones) || parsed.zones.length > 3) return null;
  for (const z of parsed.zones) {
    if (!z || !VALID_ZONE_IDS.has(z.id)) return null;
    if (typeof z.weight !== "number" || z.weight < 0 || z.weight > 1) return null;
  }
  const m = parsed.modifiers;
  if (!m || typeof m.saturation !== "number" || typeof m.lightness !== "number") return null;
  if (m.saturation < -15 || m.saturation > 15 || m.lightness < -15 || m.lightness > 15) return null;
  return parsed;
}

async function callAnthropic(notes) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Notes: ${JSON.stringify(notes)}` }],
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${errBody.slice(0, 200)}`);
  }
  const data = await res.json();
  const block = Array.isArray(data?.content) ? data.content.find((b) => b.type === "text") : null;
  return block?.text ?? null;
}

async function mapNotes(notes) {
  const text = await callAnthropic(notes);
  if (!text) return null;
  const parsed = validateResponse(extractJson(text));
  if (!parsed || parsed.zones.length === 0) return null;

  // Normalise weights to sum 1.0 (mirrors mapNotesToZones.ts).
  const total = parsed.zones.reduce((s, z) => s + z.weight, 0);
  const zones =
    total > 0 ? parsed.zones.map((z) => ({ id: z.id, weight: z.weight / total })) : parsed.zones;

  return {
    version: 1,
    zones,
    modifiers: parsed.modifiers,
    source: "tasting-notes",
    computedAt: new Date().toISOString(),
  };
}

async function main() {
  const { rows: coffees } = await pool.query(
    `SELECT id, roaster, name FROM coffees WHERE field_zones IS NULL ORDER BY first_seen_at`,
  );
  console.log(`Found ${coffees.length} coffees without field_zones`);

  let mapped = 0;
  let skippedNoNotes = 0;
  let skippedEmptyZones = 0;
  let failed = 0;

  for (const c of coffees) {
    // Find the most recent session for this coffee where the scanned
    // bag listed non-empty tastingNotesFromBag.
    const { rows: sessions } = await pool.query(
      `SELECT coffee->'tastingNotesFromBag' AS notes
       FROM sessions
       WHERE coffee->>'roaster' = $1
         AND coffee->>'name' = $2
         AND coffee->'tastingNotesFromBag' IS NOT NULL
         AND jsonb_array_length(coffee->'tastingNotesFromBag') > 0
       ORDER BY created_at_ms DESC
       LIMIT 1`,
      [c.roaster, c.name],
    );

    if (sessions.length === 0) {
      console.log(`  [skip-no-notes] ${c.roaster} / ${c.name}`);
      skippedNoNotes++;
      continue;
    }

    const notes = sessions[0].notes;
    if (!Array.isArray(notes) || notes.length === 0) {
      console.log(`  [skip-no-notes] ${c.roaster} / ${c.name}`);
      skippedNoNotes++;
      continue;
    }

    process.stdout.write(`  [map]  ${c.roaster} / ${c.name} — [${notes.join(", ")}] → `);
    try {
      const fieldZones = await mapNotes(notes);
      if (!fieldZones) {
        console.log("empty zones, skipped");
        skippedEmptyZones++;
        continue;
      }
      await pool.query(`UPDATE coffees SET field_zones = $1 WHERE id = $2`, [
        JSON.stringify(fieldZones),
        c.id,
      ]);
      console.log(
        `${fieldZones.zones.map((z) => `${z.id}(${z.weight.toFixed(2)})`).join(" + ")}`,
      );
      mapped++;
    } catch (err) {
      console.log(`error: ${err.message}`);
      failed++;
    }
  }

  console.log("");
  console.log(`Summary:`);
  console.log(`  mapped:               ${mapped}`);
  console.log(`  skipped (no notes):   ${skippedNoNotes}`);
  console.log(`  skipped (empty zones):${skippedEmptyZones}`);
  console.log(`  failed:               ${failed}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
