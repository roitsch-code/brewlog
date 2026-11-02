import type { Recipe } from "./types";

/**
 * Relayed recipes — handed to the owner directly by their authors.
 *
 * Not scouted, not scraped, not reconstructed from a third party: the
 * author told the owner the recipe, the owner typed it into the project
 * verbatim. The only "publication" is that message, so `sources` is of type
 * "interview" (personal communication) and `notes` names the date it
 * arrived. `verified: true` here means the pour sequence is the author's
 * own words, not a transcription that may diverge; the per-pour SECONDS
 * (an author gives clock marks, rarely pour durations) are the house timing
 * and say so in the step notes.
 *
 * `addedAt` is set so the entry wears "[NEW this month]" on the menu and
 * reaches the Context step's Fresh strip for 30 days.
 */
export const RELAYED_RECIPES: Recipe[] = [
  {
    id: "cupsight-arthur-aeropress-upright-75c",
    name: "Arthur (Cupsight) — Upright AeroPress at 75 °C",
    shortName: "Cupsight AP 75°",
    attribution: {
      person: "Arthur",
      affiliation: "Cupsight",
      year: 2026,
    },
    category: "reference",
    brewer: "aeropress",
    brewerNotes:
      "AeroPress upright (standard orientation, NOT inverted). 230 ml is the device's full chamber — the owner-measured AeroPress cap. Light roast.",
    dose: { grams: 15 },
    water: { grams: 230, ratio: "1:15.3" },
    temperature: { celsius: 75 },
    grind: {
      referenceGrinder: "Comandante C40",
      referenceSetting: "30 clicks (coarse)",
      description: "coarse — Comandante 30 clicks as given by the author",
      // No Niche° number: 30 clicks sits OUTSIDE the owner's measured 23–29
      // click span (380° = 23, 400° = 29), so a conversion would be an
      // extrapolation (owner rule 2026-10-18: no estimated grind numbers).
      // On the Comandante the recipe is brewed at the author's 30 clicks.
    },
    pourSequence: [
      {
        label: "Bloom 45 g",
        action: "pour",
        waterGramsAtEnd: 45,
        durationSec: 10,
        notes: "45 ml at 75 °C onto 15 g. (10 s is the house pour timing; Arthur gives the clock marks, not the pour seconds.)",
      },
      { label: "Short swirl", action: "swirl", durationSec: 5, notes: "A short swirl of the chamber — not a stir." },
      { label: "Wait → 1:00", action: "wait", durationSec: 45, notes: "Let the bloom rest until the clock reads 1:00." },
      {
        label: "Pour the rest to 230 g",
        action: "pour",
        waterGramsAtEnd: 230,
        durationSec: 20,
        notes: "Fill to 230 ml. (20 s is the house pour timing for the fill.)",
      },
      { label: "Rest → 2:00", action: "wait", durationSec: 40, notes: "Let it rest until the clock reads 2:00. No plunger yet." },
      {
        label: "Very gentle press → 3:00",
        action: "press",
        durationSec: 60,
        notes: "From 2:00, press very gently for a full minute; finish at 3:00.",
      },
    ],
    totalTimeSec: 180,
    techniques: ["bloom", "swirl-not-stir", "immersion-steep"],
    bestFor: {
      roastLevels: ["very-light", "light"],
      processes: ["any"],
      goals: ["high-clarity", "aromatic"],
    },
    teaches:
      "A cool 75 °C upright AeroPress with a coarse grind, a swirled bloom, a two-minute total steep and a one-minute press. Arthur's words for the result: very delicate, very soft.",
    science:
      "Three choices all pull the same way — toward a soft, gentle cup: 75 °C water extracts the harsher, slower compounds far less than near-boiling water does, the coarse 30-click grind offers little surface for them, and the minute-long press keeps pressure (and with it astringency) low. The swirled bloom and the one-minute rest let the coarse bed wet evenly so the short steep still extracts the sweet, aromatic fractions.",
    whenToUse:
      "A light roast you want to taste soft and delicate rather than bright or dense — a single cup at the AeroPress's full 230 ml. Not for a cup that should read full-bodied.",
    sources: [
      {
        type: "interview",
        citation:
          "Arthur (Cupsight), personal communication to the owner — relayed verbatim into the project on 2026-11-02: \"Aeropress upright, 15 g (coarse — 30 clicks on Comandante), 230 ml at 75 °C (light roast). 45 ml blooming, short swirl, wait for 1:00. Then pour the rest to 230 ml, let it rest until 2:00. Then very gentle press until 3:00. The result will be very delicate, very soft.\"",
        year: 2026,
      },
    ],
    verified: true,
    notes:
      "Relayed by the owner from Arthur directly (2026-11-02, marked \"validated\" by the owner). Not published anywhere we could read on 2026-11-02 — a web search found no Cupsight page carrying it. The clock marks (1:00 / 2:00 / 3:00), dose, water, temperature and clicks are Arthur's; the per-pour seconds (10 s bloom, 20 s fill) are house timing inside those marks. Grind only in Comandante clicks — on the Niche a first brew is a measurement, not a number.",
    addedAt: "2026-11-02",
  },
];
