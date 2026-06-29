/**
 * Generative Field v1.1 — Haiku tasting-notes → Field Zone mapping.
 *
 * Single Anthropic call that perceptually maps a list of tasting notes
 * (English or German) to a weighted Zone composition + optional
 * saturation/lightness modifiers. See spec §3 + Appendix A for the
 * full prompt and rationale.
 *
 * Per-coffee call cost is roughly $0.0001 (Haiku, short structured
 * output). Mapping runs **once per coffee** and is persisted in
 * coffees.field_zones — never at render time. The "single mapping
 * layer in the system" guarantee comes from both the tasting-notes
 * path and the variety-implied path feeding through this helper
 * (spec §5.2).
 *
 * Temperature 0 + the strict Zod schema make this deterministic-ish
 * — Haiku still has some variance at temp=0, but the schema either
 * accepts a valid output or we return null and the caller falls back
 * to DEFAULT_FIELD_ZONES.
 */

import Anthropic from "@anthropic-ai/sdk";
import { parseClaudeJson, z } from "../claude/parseJson";
import type { FieldZones, FieldZonesSource } from "./types";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 30_000,
});

const FieldZonesResponseSchema = z.object({
  zones: z
    .array(
      z.object({
        id: z.enum([
          "fruity-bright",
          "fruity-deep",
          "floral",
          "nutty-cocoa",
          "spice-earth",
          "sweet-caramel",
          "cool-berry",
        ]),
        weight: z.number().min(0).max(1),
      }),
    )
    .max(3),
  modifiers: z.object({
    saturation: z.number().int().min(-15).max(15),
    lightness: z.number().int().min(-15).max(15),
  }),
});

const SYSTEM_PROMPT = `You are a perceptual aroma-to-color mapper for a specialty coffee app. Given an array of tasting notes (English or German), you return a JSON object specifying which BrewLog Field Zones the notes map to, with weights, plus optional saturation/lightness modifiers from texture descriptors. Return JSON only, no prose.

Available Field Zones (id : exemplar aromas):
- fruity-bright : citrus, lemon, orange, grapefruit, mandarin, berry, raspberry, cherry, cranberry, strawberry, redcurrant, peach, apricot, pomegranate
- fruity-deep : dried fruit, date, raisin, fig, prune, plum, red grape, port, wine, fermented fruit, dark cherry
- cool-berry : blueberry, blackberry, blackcurrant, cassis, bilberry, huckleberry, boysenberry, dark/wild berry, jammy blue-purple fruit
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
- German notes are valid input: pflaumig → prune (fruity-deep), nussig → nutty-cocoa, zitronig → citrus (fruity-bright), schokoladig → chocolate (nutty-cocoa), heidelbeere/blaubeere → blueberry (cool-berry), cassis/schwarze johannisbeere → blackcurrant (cool-berry), brombeere → blackberry (cool-berry).`;

/**
 * Run the mapping on a list of notes and return a FieldZones object,
 * or null if the model returned no usable zones (caller should fall
 * back to DEFAULT_FIELD_ZONES). Errors are swallowed and surface as
 * null — Field rendering must never block a brew flow on an AI call.
 *
 * `source` describes the origin path so debug tools can later show
 * "this Field came from tasting notes" vs "from variety implication".
 */
export async function mapNotesToZones(
  notes: string[],
  source: FieldZonesSource = "tasting-notes",
): Promise<FieldZones | null> {
  if (!notes || notes.length === 0) return null;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Notes: ${JSON.stringify(notes)}`,
        },
      ],
    });

    const block = response.content[0];
    if (!block || block.type !== "text") return null;

    const parsed = parseClaudeJson(block.text, FieldZonesResponseSchema);
    if (!parsed || parsed.zones.length === 0) return null;

    // Normalise weights to exactly 1.0 — Haiku is usually within 0.01
    // but the algorithm sorts and composes assuming weights are a real
    // probability distribution.
    const totalWeight = parsed.zones.reduce((sum, z) => sum + z.weight, 0);
    const zones =
      totalWeight > 0
        ? parsed.zones.map((z) => ({ id: z.id, weight: z.weight / totalWeight }))
        : parsed.zones;

    return {
      version: 1,
      zones,
      modifiers: parsed.modifiers,
      source,
      computedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("mapNotesToZones error:", err);
    return null;
  }
}
