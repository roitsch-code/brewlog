import type { Recipe } from "./types";

/**
 * Canonical reference recipes from named experts in the specialty coffee canon.
 *
 * These are recipes the experts themselves publish (in books, videos, blog
 * posts, competition-adjacent demonstrations). They are not competition-winning
 * routines — those live in `championship.ts`.
 *
 * Same verification policy as championship.ts:
 *   verified: true  — mechanics directly attested by the expert's own video
 *                     or written publication.
 *   verified: false — mechanics reconstructed from third-party transcriptions
 *                     or older revisions of the recipe.
 *
 * GRIND RECALIBRATION (May 2026): `nicheZeroDegrees` is a TRANSLATION for the
 * user's Niche Zero, re-baselined to a measured anchor (V60 single cup = 380°
 * = Comandante 23 clicks; map ~3.3°/click). Self-created Niche translations
 * here were shifted −21° onto the new baseline (estimate / carry-offset);
 * real originator-published clicks (where any) are kept and the Niche derived
 * from them. See src/lib/constants/grindSettings.ts for the anchors + map.
 */

export const REFERENCE_RECIPES: Recipe[] = [
  // ── James Hoffmann ────────────────────────────────────────────────────────

  {
    id: "hoffmann-v60-better-one-cup",
    name: "Hoffmann V60 — Better 1 Cup",
    shortName: "Hoffmann V60 (1 cup)",
    attribution: {
      person: "James Hoffmann",
      title: "World Barista Champion 2007, *World Atlas of Coffee* author",
      country: "United Kingdom",
      year: 2023,
    },
    category: "reference",
    brewer: "v60",
    brewerNotes:
      "Hario V60 size 02, paper filter rinsed. Plastic V60 preferred per Hoffmann for thermal retention. Dripper preheated with very hot tap water — not boiling (Hoffmann calls boiling-water preheat wasteful). Expected liquid out: ~215–220 g from 250 g poured.",
    dose: { grams: 15 },
    water: { grams: 250, ratio: "1:16.7" },
    temperature: { celsius: 100, rangeC: [80, 100] },
    grind: {
      referenceGrinder: "Various",
      referenceSetting:
        "medium-fine — finer than most people expect, but not super fine; for light roasts you want this fine",
    },
    pourSequence: [
      {
        label: "Bloom (→ 50 g)",
        action: "pour",
        waterGramsAtEnd: 50,
        durationSec: 5,
        notes:
          "~5 g/s circular pour, spout held low (a high pour breaks the stream and dissipates energy before it hits the bed — less agitation, not more).",
      },
      {
        label: "Gentle swirl",
        action: "swirl",
        durationSec: 5,
        notes:
          "Even saturation through bulk-puck motion. Don't push grounds up the wall.",
      },
      { label: "Bloom rest", action: "wait", durationSec: 35 },
      {
        label: "Pulse 1 (→ 100 g)",
        action: "pour",
        waterGramsAtEnd: 100,
        durationSec: 15,
        notes: "Circular pour, ~5 g/s, low spout.",
      },
      { label: "Pause", action: "wait", durationSec: 10 },
      {
        label: "Pulse 2 (→ 150 g)",
        action: "pour",
        waterGramsAtEnd: 150,
        durationSec: 10,
      },
      { label: "Pause", action: "wait", durationSec: 10 },
      {
        label: "Pulse 3 (→ 200 g)",
        action: "pour",
        waterGramsAtEnd: 200,
        durationSec: 10,
      },
      { label: "Pause", action: "wait", durationSec: 10 },
      {
        label: "Pulse 4 (→ 250 g)",
        action: "pour",
        waterGramsAtEnd: 250,
        durationSec: 10,
      },
      {
        label: "Gentle swirl",
        action: "swirl",
        durationSec: 5,
        notes: "Final settle before drawdown.",
      },
      { label: "Drawdown", action: "drain", durationSec: 55 },
    ],
    totalTimeSec: 180,
    techniques: ["swirl-not-stir", "pulsed-pours-50g-blocks", "preheat-via-hot-tap"],
    bestFor: {
      roastLevels: ["light", "medium-light", "medium"],
      processes: ["washed", "natural", "honey"],
      goals: ["balanced"],
    },
    teaches:
      "Swirl rather than stir for bloom saturation; pulsed 50 g pours every 10 s for controlled extraction. Two counter-intuitive findings: (i) preheating doesn't change measurable extraction but materially changes taste — without preheat the bloom cools and the cup loses sweetness and gains acidity; (ii) a low spout produces MORE agitation than a high spout, because a high pour stream breaks before reaching the bed and dissipates its energy.",
    science:
      "Bloom saturation via bulk-puck motion (swirl) keeps fines distributed evenly instead of dragging them to the filter walls where they form flow restrictions. The 4× 50 g pulse structure gives controlled alternation of agitation (pour) and bed-settling (10 s pause), so each pour drives a moment of extraction without accumulated turbulence. Per Hoffmann's measurement work, a ~5 g/s pour rate with a low spout produces the bed agitation needed for high extraction without channeling.",
    whenToUse:
      "Default single-cup V60. Roast-temperature staircase per Hoffmann: light at freshly boiled (100 °C), medium 90–95, dark 80–85 (up to 90). Plastic V60-02 preferred for thermal retention; preheat with very hot tap water, not boiling.",
    sources: [
      {
        type: "video",
        citation: "James Hoffmann — \"A Better 1 Cup V60 Technique\" (YouTube)",
        url: "https://www.youtube.com/watch?v=1oB1oDrDkHM",
        year: 2023,
      },
      {
        type: "video",
        citation: "James Hoffmann — \"How To Avoid A Bad Pour Over Brew\" (YouTube)",
        url: "https://www.youtube.com/watch?v=mMwscUNKbPk",
        year: 2024,
      },
    ],
    verified: true,
    notes:
      "Hoffmann does not publish a Niche Zero degree number — Niche degrees must be calibrated empirically by the user against this recipe's ~3:00 drawdown target. The previous codebase value (Niche 396–406°) had no Hoffmann source behind it and has been removed per the third Hard Rule. Rescue moves Hoffmann published in the 2024 follow-up video: if grind too fine, pour the full 250 g on schedule but pull the cup at usual brew time and top up with hot water to ~215–220 g final; if grind slightly too coarse, expand 5 pours to 7 with more turbulent pouring and full drainage between each, optionally adding a +50 mL final pour (mild dilution cost). Visual diagnostics: muddy/soupy bloom = grind too fine; bloom dries out fast = grind too coarse or beans very fresh.",
  },

  {
    id: "hoffmann-clever-ultimate",
    name: "Hoffmann Ultimate Clever",
    shortName: "Hoffmann Clever",
    attribution: {
      person: "James Hoffmann",
      country: "United Kingdom",
      year: 2022,
    },
    category: "reference",
    brewer: "clever",
    brewerNotes:
      "Clever Dripper (full-immersion brewer with valve at the base), Melitta-style #4 paper, rinsed. Water-first technique credited to Workshop Coffee (London), popularised by Hoffmann. Demo brew was 15 g : 250 g; Hoffmann's stated preference is ~60–65 g/L, so 18 g : 300 g sits in the same band.",
    dose: { grams: 18 },
    water: { grams: 300, ratio: "1:16.7" },
    temperature: { celsius: 100, rangeC: [96, 100] },
    grind: {
      referenceSetting:
        "medium-fine — finer than most expect for a steep brewer, close to a 2-cup V60",
      nicheZeroDegrees: [400, 410],
    },
    pourSequence: [
      {
        label: "Water first (off the boil)",
        action: "pour",
        waterGramsAtEnd: 300,
        durationSec: 15,
        notes:
          "Rinse the paper, then pour all the water — straight off the boil — into the sealed brewer first. The valve holds it; no drawdown yet.",
      },
      {
        label: "Add coffee + stir to mix",
        action: "stir",
        durationSec: 5,
        notes:
          "Drop the ground coffee onto the water and give it a little stir so there are no dry pockets — don't overdo it.",
      },
      { label: "Steep", action: "wait", durationSec: 120, notes: "2-minute steep. Forgiving — 30 s to 2 min longer is fine." },
      {
        label: "Break the crust",
        action: "stir",
        durationSec: 5,
        notes:
          "At 2 min, break the crust with a gentle stir (or a little shake) so the grounds fall and form a flat bed.",
      },
      { label: "Let grounds settle", action: "wait", durationSec: 30 },
      {
        label: "Place on carafe — drawdown",
        action: "drain",
        durationSec: 65,
        notes: "Drawdown is roughly a minute (faster on a high-end grinder).",
      },
    ],
    totalTimeSec: 210,
    techniques: [
      "water-first",
      "full-immersion",
    ],
    bestFor: {
      roastLevels: ["light", "medium-light", "medium"],
      processes: ["washed", "natural", "honey"],
      goals: ["balanced", "sweetness-forward", "body-forward"],
    },
    teaches:
      "How a water-first technique gives a fast, even drawdown. Pouring water before the coffee roughly halves the drawdown time versus coffee-first, because coffee-first clogs the paper. The cup carries immersion body with paper-filter clarity.",
    science:
      "Going water-first (a Workshop Coffee discovery) avoids the clogging that coffee-first causes on the paper, so drawdown is about twice as fast. Hoffmann pours straight off the boil; a gentle stir to mix and a single crust-break are the only agitation. A 2-minute steep reaches sugar/acid equilibrium without invading bitter Zone 3, and the technique is tolerant — a longer steep does no harm. The Clever's valve then releases the slurry through the paper, which strips oils and most fines for a cleaner cup than a French press.",
    whenToUse:
      "Default for any coffee where you want a balanced, forgiving brew. Excellent for entertaining (no pour technique required) and for unfamiliar coffees. If the cup tastes hollow, grind finer; if harsh/bitter, back off a touch.",
    sources: [
      {
        type: "transcript",
        citation:
          "James Hoffmann — 'The Ultimate Clever Dripper Technique' (2020). Rinse paper; water first straight off the boil; add coffee + little stir; steep 2 min; break crust; wait ~30 s; drawdown ~1 min. Demo 15 g : 250 g, prefers 60–65 g/L. Transcribed in-session.",
        year: 2020,
      },
    ],
    verified: true,
    notes:
      "Corrected from Hoffmann's own video: water is poured straight off the boil (was 96°C); he DOES give a little stir to mix the coffee and a crust-break stir at 2 min (the previous 'no-stir' framing was wrong); ~30 s settle + ~1 min drawdown puts total near 3:30 (was 3:00). Dose/ratio kept at 18 g : 300 g — within his stated 60–65 g/L preference; his on-camera demo used 15 g : 250 g at the same ratio band.",
  },

  {
    id: "hoffmann-aeropress-standard",
    name: "Hoffmann AeroPress — Recommended Technique",
    shortName: "Hoffmann AeroPress",
    attribution: {
      person: "James Hoffmann",
      country: "United Kingdom",
      year: 2021,
    },
    category: "reference",
    brewer: "aeropress",
    brewerNotes:
      "Upright (standard) orientation — NOT inverted. Paper filter in the cap, no rinse needed, set on a sturdy mug or carafe.",
    dose: { grams: 11 },
    water: { grams: 200, ratio: "1:18.2" },
    temperature: { celsius: 100, rangeC: [85, 100] },
    grind: {
      referenceSetting:
        "fine — finer than a pour-over, getting close to the espresso range (for light roasts)",
      nicheZeroDegrees: [356, 366],
    },
    pourSequence: [
      {
        label: "Add water",
        action: "pour",
        waterGramsAtEnd: 200,
        durationSec: 10,
        notes:
          "Get the coffee wet as quickly as you can, then pour to 200 g. No need for a gooseneck kettle.",
      },
      { label: "Steep", action: "wait", durationSec: 120, notes: "Two-minute steep. No stir." },
      {
        label: "Gentle swirl",
        action: "swirl",
        durationSec: 5,
        notes:
          "Hold both piston and base; a gentle swirl knocks the grounds down — not a vortex.",
      },
      { label: "Settle", action: "wait", durationSec: 30 },
      {
        label: "Press gently",
        action: "press",
        durationSec: 30,
        notes: "Press gently and evenly — comfortably, not leaning in. ~30 s for this grind.",
      },
    ],
    totalTimeSec: 215,
    techniques: [
      "swirl-not-stir",
      "lean-ratio",
    ],
    bestFor: {
      roastLevels: ["light", "medium-light", "medium"],
      processes: ["washed", "natural", "honey"],
      goals: ["balanced"],
    },
    teaches:
      "How the least-fuss AeroPress technique — upright, lean ratio, two-minute steep, a single swirl, gentle press — reliably makes a clean, filter-style cup. Hoffmann's deliberate default, not the inverted/stirred ritual.",
    science:
      "A lean 1:18 ratio with a fine grind keeps the cup clean rather than muddy. For light roasts Hoffmann pours fully boiling water; for medium roasts drop to ~90–95°C and for dark roasts ~85°C, because darker coffees over-extract bitter compounds at high temperature. A two-minute steep does the extraction; the only late agitation is one gentle swirl to settle the bed, and a gentle ~30 s press avoids forcing water through over-extracted boundary layers.",
    whenToUse:
      "A daily AeroPress that drinks like a clean filter cup. Excellent for travel — forgiving on grind precision. If too bitter, grind coarser / cooler; if sour, go hotter and finer.",
    sources: [
      {
        type: "transcript",
        citation:
          "James Hoffmann — 'My Recommended AeroPress Technique' (2021). Upright, 11 g : 200 g, fine grind, boiling water for light roasts (90–95 medium, 85 dark), 2-minute steep, gentle swirl, wait 30 s, gentle ~30 s press. Transcribed in-session.",
        year: 2021,
      },
    ],
    verified: true,
    notes:
      "Corrected from Hoffmann's own 2021 'recommended technique' video: upright, NOT inverted; water is freshly boiled for light roasts (the old 85°C value applies only to dark roasts); a single gentle SWIRL replaces the 2–3× stir; 2-minute steep then 30 s wait then gentle press. Hoffmann notes he has other AeroPress recipes — this entry captures his recommended default, kept internally consistent.",
  },

  {
    id: "hoffmann-moccamaster",
    name: "Hoffmann Moccamaster Method",
    shortName: "Hoffmann Moccamaster",
    attribution: {
      person: "James Hoffmann",
      country: "United Kingdom",
    },
    category: "reference",
    brewer: "moccamaster",
    brewerNotes: "Technivorm Moccamaster KBGV / KBG Select",
    dose: { grams: 50 },
    water: { grams: 750, ratio: "1:15" },
    temperature: { celsius: 96 },
    grind: {
      referenceSetting: "medium-coarse",
      nicheZeroDegrees: [410, 420],
    },
    pourSequence: [
      {
        label: "Fill water tank",
        action: "pour",
        waterGramsAtEnd: 750,
        durationSec: 30,
      },
      {
        label: "Auto-brew (machine does the work)",
        action: "wait",
        durationSec: 450,
        notes:
          "Moccamaster pulses water through the showerhead. No user agitation needed or possible.",
      },
    ],
    totalTimeSec: 480,
    techniques: ["batch-brewing", "showerhead-pulse"],
    bestFor: {
      roastLevels: ["medium-light", "medium"],
      processes: ["washed", "natural", "honey"],
      goals: ["balanced", "body-forward"],
      occasions: ["multiple cups", "guests", "morning batch"],
    },
    teaches:
      "How a well-designed batch brewer can produce filter-quality coffee at scale. The Moccamaster's pulsing showerhead approximates a multi-pour V60 without operator skill.",
    science:
      "The Moccamaster heats water in a tube, then releases it in pulses through a perforated showerhead — each pulse approximates a small V60 pour. The flat-bottomed paper filter sits in a Kalita-like basket: even bed, slow drawdown, well-extracted cup. The 1:15 ratio is conventional; the medium-coarse grind compensates for the longer total brew time (~8 minutes for 750g).",
    whenToUse:
      "When brewing for two or more people, or when you want filter coffee without the labour. Not for single-cup brewing — the showerhead doesn't saturate properly below ~500ml.",
    sources: [
      {
        type: "video",
        citation:
          "James Hoffmann — 'How to Make the Best Coffee at Home' Moccamaster chapter",
        year: 2022,
      },
      {
        type: "book",
        citation:
          "Hoffmann, J. — *How to Make the Best Coffee at Home* (Octopus, 2022)",
      },
    ],
    verified: true,
  },

  {
    id: "hoffmann-immersion-iced-clever",
    name: "Hoffmann Immersion Iced (Clever)",
    shortName: "Hoffmann Iced",
    attribution: {
      person: "James Hoffmann",
      country: "United Kingdom",
    },
    category: "reference",
    brewer: "clever",
    brewerNotes:
      "Clever (or any immersion/steep-and-release brewer — Hario Switch, AeroPress also work). Dose is 75 g per litre of TOTAL water; total water is split ~2/3 hot brew water + 1/3 ice. Add a few drops of saline (≈20% salt solution) to the finished cup to cut perceived bitterness.",
    dose: { grams: 37.5 },
    water: { grams: 500, ratio: "1:13.3 (75 g/L of total water: ~330 g hot + ~170 g ice)" },
    temperature: { celsius: 100, rangeC: [96, 100] },
    grind: {
      referenceSetting:
        "fairly fine — closer to a 2-cup pour-over than espresso; immersion tolerates it without channeling",
      nicheZeroDegrees: [400, 410],
    },
    pourSequence: [
      {
        label: "Hot water onto coffee (~330 g, off the boil)",
        action: "pour",
        waterGramsAtEnd: 330,
        durationSec: 15,
        notes:
          "Brew as hot as you can — 2/3 of the total water (~330 g of 500 g). Preheat the brewer.",
      },
      { label: "Mix", action: "stir", durationSec: 5, notes: "Stir/distribute to wet all the grounds." },
      { label: "Steep", action: "wait", durationSec: 290, notes: "~5-minute steep. Tolerant: 4–7 min is fine. Fetch the ice at the 4-minute mark so it's as cold as possible." },
      {
        label: "Drain onto ~170 g ice",
        action: "drain",
        durationSec: 50,
        notes:
          "Server holds ~170 g ice (1/3 of total water). Hot brew flash-chills on contact; stir until the ice is gone.",
      },
      { label: "Add saline + serve", action: "bypass", durationSec: 5, notes: "2–4 drops of 20% saline to taste; ice your glass and pour." },
    ],
    totalTimeSec: 365,
    techniques: [
      "japanese-iced-immersion",
      "flash-chilling",
      "saline-finish",
    ],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed", "natural", "honey"],
      goals: ["balanced", "sweetness-forward"],
      occasions: ["summer-time", "iced"],
    },
    teaches:
      "How flash-chilling an immersion preserves aromatics that cold-brew loses to its long extraction time. Brew hot at 75 g/L of total water, split 2/3 hot + 1/3 ice, with a heavier dose to survive in-glass dilution; a few drops of saline tame the higher perceived bitterness of cold coffee.",
    science:
      "Cold brew extracts over 8–18 hours; the long timeline lets bitter compounds equilibrate but lets volatile aromatics dissipate. A flash-chilled iced coffee extracts hot (full Zone 1 aromatics) then drops below 5°C in seconds when it hits ice — aromatics lock into the liquid before volatilising. A longer immersion steep runs the brew water cooler by the time it meets the ice, so less ice is needed and more of the total water does extraction work. The heavier 75 g/L dose compensates for the immersion's slightly weaker extraction and for in-glass dilution; saline suppresses the bitterness that cold amplifies.",
    whenToUse:
      "Summer iced coffee where you want body and balance, not the sharp brightness of a percolation iced. Use lighter, fruitier, juicier coffees (washed Kenyan / Ethiopian shine).",
    sources: [
      {
        type: "transcript",
        citation:
          "James Hoffmann — 'A Better Way To Make Iced Filter Coffee' (2023). 75 g/L of total water, ~2/3 hot + 1/3 ice (demo 37.5 g : 330 g hot + ~170 g ice), ~5-min immersion steep, brew as hot as possible, 2–4 drops saline. Transcribed in-session.",
        year: 2023,
      },
    ],
    verified: true,
    notes:
      "Corrected from Hoffmann's 2023 iced video: dose is 75 g/L of TOTAL water (~37.5 g for a 500 g drink, was 20 g), water split is ~2/3 hot + 1/3 ice (~330 g + ~170 g, was 250 g + 200 g), steep ~5 min (was 3:40), brewed as hot as possible (was 95°C), plus a saline finish. The earlier '1:12.5 + 200 g ice' figures were a different reconstruction.",
  },

  // ── Tetsu Kasuya (standalone 4:6, separate from his 2016 routine) ────────

  {
    id: "kasuya-4-6-standard",
    name: "Kasuya 4:6 Method — Standard",
    shortName: "Kasuya 4:6 (standard)",
    attribution: {
      person: "Tetsu Kasuya",
      affiliation: "Philocoffea, Chiba",
      country: "Japan",
    },
    category: "reference",
    brewer: "v60",
    dose: { grams: 20 },
    water: { grams: 300, ratio: "1:15" },
    temperature: { celsius: 92 },
    grind: {
      referenceSetting: "medium-coarse",
      nicheZeroDegrees: [390, 400],
    },
    pourSequence: [
      {
        label: "Pour 1 (40% phase, A)",
        action: "pour",
        waterGramsAtEnd: 60,
        durationSec: 10,
      },
      { label: "Wait", action: "wait", durationSec: 35 },
      {
        label: "Pour 2 (40% phase, B)",
        action: "pour",
        waterGramsAtEnd: 120,
        durationSec: 10,
      },
      { label: "Wait", action: "wait", durationSec: 35 },
      {
        label: "Pour 3 (60% phase, 1 of 3)",
        action: "pour",
        waterGramsAtEnd: 180,
        durationSec: 10,
      },
      { label: "Wait", action: "wait", durationSec: 35 },
      {
        label: "Pour 4 (60% phase, 2 of 3)",
        action: "pour",
        waterGramsAtEnd: 240,
        durationSec: 10,
      },
      { label: "Wait", action: "wait", durationSec: 20 },
      {
        label: "Pour 5 (60% phase, 3 of 3)",
        action: "pour",
        waterGramsAtEnd: 300,
        durationSec: 10,
      },
      { label: "Drawdown", action: "drain", durationSec: 35 },
    ],
    totalTimeSec: 210,
    techniques: ["phase-separated-pouring", "ratio-control-via-pour-count"],
    bestFor: {
      roastLevels: ["light", "medium-light", "medium"],
      processes: ["washed", "natural", "honey"],
      goals: ["balanced", "explore"],
    },
    teaches:
      "Same teaching framework as the 2016 competition routine, packaged as a daily-use recipe. The 'standard' configuration (60-60 / 60-60-60) is the balanced default; dial sweet or strong by changing pour counts.",
    science:
      "See wbrc-2016-kasuya. Same mechanism; this entry exists separately because Kasuya teaches the 4:6 method as a framework to adapt, not a single fixed routine.",
    whenToUse:
      "As a teaching brew for anyone learning to dial in pour-over. As a daily V60 when you want to experiment with the acid/sweet vs. strength axes independently.",
    sources: [
      {
        type: "book",
        citation: "Kasuya, T. — 4:6 Method documentation",
      },
      {
        type: "video",
        citation: "Multiple Tetsu Kasuya / Philocoffea instructional videos",
      },
    ],
    verified: true,
  },

  // ── Patrik Rolf / April Coffee ────────────────────────────────────────────

  {
    id: "rolf-april-v60",
    name: "April Coffee House V60 (Rolf)",
    shortName: "April V60",
    attribution: {
      person: "Patrik Rolf",
      title: "April Coffee Roasters founder, 'Coffee with April' YouTube",
      affiliation: "April Coffee, Copenhagen",
      country: "Denmark / Sweden",
      year: 2018,
    },
    category: "reference",
    brewer: "v60",
    brewerNotes:
      "Hario V60 (paper filter not specified on the source page). April's published house V60 — an agitation-forward, all-rounder recipe. Water 90–110 ppm. Coffee rested at least 7 days off roast.",
    dose: { grams: 20 },
    water: { grams: 300, ratio: "1:15" },
    temperature: { celsius: 92 },
    grind: {
      referenceSetting:
        "coarse (April's word) — calibrate the Niche empirically against the ~3:20–3:30 drawdown; April publishes no degree number",
    },
    pourSequence: [
      {
        label: "Pour 1 (→50 g) @ 0:00",
        action: "pour",
        waterGramsAtEnd: 50,
        durationSec: 10,
        notes:
          "Circular pour, deliberately aggressive 'so that you agitate the grounds'. This first pour doubles as the bloom — there is no separate bloom in April's house recipe.",
      },
      { label: "Wait → 0:40", action: "wait", durationSec: 30 },
      {
        label: "Pour 2 (→100 g) @ 0:40",
        action: "pour",
        waterGramsAtEnd: 100,
        durationSec: 10,
        notes: "Aggressive circular pour.",
      },
      { label: "Wait → 1:10", action: "wait", durationSec: 20 },
      {
        label: "Pour 3 (→150 g) @ 1:10",
        action: "pour",
        waterGramsAtEnd: 150,
        durationSec: 10,
        notes: "Aggressive circular pour.",
      },
      { label: "Wait → 1:40", action: "wait", durationSec: 20 },
      {
        label: "Pour 4 (→200 g) @ 1:40",
        action: "pour",
        waterGramsAtEnd: 200,
        durationSec: 10,
        notes: "Aggressive circular pour.",
      },
      { label: "Wait → 2:10", action: "wait", durationSec: 20 },
      {
        label: "Pour 5 (→250 g) @ 2:10",
        action: "pour",
        waterGramsAtEnd: 250,
        durationSec: 10,
        notes: "Aggressive circular pour.",
      },
      { label: "Wait → 2:40", action: "wait", durationSec: 20 },
      {
        label: "Pour 6 (→300 g) @ 2:40",
        action: "pour",
        waterGramsAtEnd: 300,
        durationSec: 10,
        notes:
          "Final water poured slowly in a circle in the centre — no water on the edges.",
      },
      {
        label: "Stir once at the end",
        action: "stir",
        durationSec: 5,
        notes: "April's recipe finishes with one stir before drawdown.",
      },
      { label: "Drawdown", action: "drain", durationSec: 30 },
    ],
    totalTimeSec: 205,
    techniques: ["aggressive-circular-agitation", "even-interval-pulse-pouring"],
    bestFor: {
      roastLevels: ["light", "medium-light", "medium"],
      processes: ["washed", "natural", "honey"],
      goals: ["balanced", "explore"],
    },
    teaches:
      "April's everyday house V60 — the opposite philosophy from a minimal-agitation brew. Six even 50 g pours on a steady ~30 s cadence, each poured deliberately aggressively to agitate the bed, finished with a single stir. Agitation is treated as a feature, not a variable to remove.",
    science:
      "Six evenly spaced 50 g pours keep the slurry level and the bed agitation regular across the whole brew. The deliberately aggressive circular pour drives turbulence at the bed for higher, more even extraction; finishing with one stir flattens the bed before drawdown. The 1:15 ratio at 92 °C on 90–110 ppm water is a balanced all-rounder rather than a clarity-maximising routine.",
    whenToUse:
      "A reliable daily V60 for washed, honey, or natural light-to-medium coffees. Because it is agitation-forward, it is NOT the right pick for the most delicate, clarity-first coffees (Geisha, Pink Bourbon) where heavy agitation muddies the cup — use a staged-temperature or fines-sieved clarity recipe there instead.",
    sources: [
      {
        type: "blog",
        citation:
          "Patrik Rolf / April Coffee — 'How we Brew Coffee with a V60' (April Coffee blog). 20 g : 300 g, 92 °C, 90–110 ppm water, six 50 g pours at 0:00/0:40/1:10/1:40/2:10/2:40 poured aggressively in a circle, one stir at the end, total 3:20–3:30, coffee ≥7 days off roast. Read verbatim during web research.",
        url: "https://www.aprilcoffeeroasters.com/blogs/news/how-to-brew-coffee-with-a-v60",
        year: 2018,
      },
    ],
    verified: true,
    notes:
      "Replaces the prior 'Rolf — Minimum Variables (Stagg [X])' entry, which was a misattribution: no such single-continuous-pour / no-stir Rolf recipe could be found in any primary source, and that 'minimum variables' style is stylistically Scott Rao's, not Rolf's. April's actual published house V60 is the opposite — agitation-forward with six aggressive pours and a finishing stir. Headline parameters (20 g / 300 g / 92 °C / V60 / six pours) are from April's own blog, read verbatim. Caveat: the source page is internally inconsistent on total time, stating both '2:20–3:00' (general guideline) and '3:20–3:30' (the specific recipe) — the 3:20–3:30 figure is used here. Separately, Rolf's own WBrC final recipe (Coffee with April Ep. 77, 2019) is on a custom brewer, not a V60, and its exact parameters live only in the unfetchable video — not captured here.",
  },

  // ── Jonathan Gagné ───────────────────────────────────────────────────────

  {
    id: "gagne-long-aeropress",
    name: "Gagné — Long-Brew AeroPress + Prismo",
    shortName: "Gagné AeroPress",
    attribution: {
      person: "Jonathan Gagné",
      title:
        "Astrophysicist, *The Physics of Filter Coffee* author, coffeeadastra.com",
      country: "Canada",
    },
    category: "reference",
    brewer: "aeropress-prismo",
    brewerNotes:
      "Upright AeroPress with a Fellow Prismo metal valve (acts like espresso portafilter — no drip until pressed).",
    dose: { grams: 20 },
    water: { grams: 200, ratio: "1:10" },
    temperature: { celsius: 80, rangeC: [78, 82] },
    grind: {
      referenceSetting: "fine, espresso-adjacent",
      nicheZeroDegrees: [344, 354],
    },
    pourSequence: [
      {
        label: "Add water",
        action: "pour",
        waterGramsAtEnd: 200,
        durationSec: 15,
      },
      {
        label: "Stir thoroughly",
        action: "stir",
        durationSec: 10,
      },
      {
        label: "Long steep",
        action: "wait",
        durationSec: 300,
        notes: "5-minute steep — Gagné's PSD analyses show this lets fines fully saturate without channeling.",
      },
      {
        label: "Slow press",
        action: "press",
        durationSec: 60,
        notes: "60-second press — slow enough that the puck doesn't tear.",
      },
    ],
    totalTimeSec: 385,
    techniques: [
      "long-steep",
      "low-temperature-extraction",
      "fine-grind",
      "valved-aeropress",
    ],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed"],
      goals: ["high-clarity"],
    },
    teaches:
      "How a long, low-temperature steep with a fine grind extracts deeply into Zone 2 without invading Zone 3. The Prismo valve lets the steep run without drip, so extraction time is purely contact time.",
    science:
      "Conventional wisdom says 'fine grind + long time = bitter.' Gagné's PSD analyses show that's only true at high temperatures — the bitter, phenolic Zone 3 compounds have steep temperature dependencies. At 80°C they extract orders of magnitude more slowly than at 95°C. So a fine grind (high surface area) at 80°C (low Zone 3 extraction rate) over 5 minutes (full Zone 2 saturation) lands in a uniquely sweet, dense, and clean part of the extraction space — what Gagné calls the 'second sweet spot.'",
    whenToUse:
      "When you have a precise washed coffee and want a body-forward but extremely clean cup. Requires a Prismo or equivalent — standard AeroPress drips through the paper filter and ruins the timing.",
    sources: [
      {
        type: "blog",
        citation: "Jonathan Gagné — coffeeadastra.com (Prismo / long-brew posts)",
      },
      {
        type: "book",
        citation: "Gagné, J. — *The Physics of Filter Coffee* (2021)",
      },
    ],
    verified: true,
  },

  // ── Matt Perger ──────────────────────────────────────────────────────────

  {
    id: "perger-high-extraction-v60",
    name: "Perger — High-Extraction V60",
    shortName: "Perger V60",
    attribution: {
      person: "Matt Perger",
      title: "2012 World Brewers Cup Champion, founder of Barista Hustle",
      country: "Australia",
    },
    category: "reference",
    brewer: "v60",
    dose: { grams: 12 },
    water: { grams: 200, ratio: "1:16.7" },
    temperature: { celsius: 97 },
    grind: {
      referenceSetting:
        "medium-fine — Perger's reference is 'like table salt'. He publishes no Niche number; calibrate empirically against the ~2:20 drawdown.",
    },
    pourSequence: [
      {
        label: "Bloom (→50 g)",
        action: "pour",
        waterGramsAtEnd: 50,
        durationSec: 10,
        notes: "~4× dose.",
      },
      {
        label: "Vigorous stir 3–5×",
        action: "stir",
        durationSec: 10,
        notes:
          "Perger's signature — vigorous bloom stir to ensure full saturation and to drive extraction yield up.",
      },
      { label: "Bloom rest → 0:30", action: "wait", durationSec: 10 },
      {
        label: "Pour 2 (→100 g) @ 0:30",
        action: "pour",
        waterGramsAtEnd: 100,
        durationSec: 10,
      },
      { label: "Wait → 1:00", action: "wait", durationSec: 20 },
      {
        label: "Pour 3 (→200 g) @ 1:00",
        action: "pour",
        waterGramsAtEnd: 200,
        durationSec: 15,
      },
      { label: "Drawdown", action: "drain", durationSec: 65 },
    ],
    totalTimeSec: 140,
    techniques: [
      "high-agitation",
      "fine-grind",
      "high-extraction-yield",
    ],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed"],
      goals: ["high-clarity", "explore"],
    },
    teaches:
      "Perger's Coffee Compass thesis applied: more agitation + finer grind = higher extraction yield = more flavour development. The opposite philosophy from Rolf — agitation as a feature, not a variable to remove.",
    science:
      "Extraction yield (percentage of soluble mass that ends up in the cup) correlates with cup development up to around 22–23% for most coffees. Below that the cup is sour and thin; above ~23% it turns bitter. Perger argues most home brewers under-extract because they fear bitterness — but bitterness comes from over-extraction *of the wrong compounds*, not high yield itself. Vigorous agitation + fine grind + a long-ish pour drives yield up while staying in the sweet-and-balanced zone if grind and time are right.",
    whenToUse:
      "On a competition-grade washed coffee where you suspect previous brews have been under-extracted (sour, thin, flat). Not for naturals — high agitation amplifies fermentation character.",
    sources: [
      {
        type: "article",
        citation:
          "Matt Perger — Barista Hustle 'Coffee Compass' / extraction-yield articles, plus his documented V60 routine (12 g : 200 g, 97 °C, medium-fine 'table salt', bloom 50 g + vigorous stir, +50 g at 0:30, +100 g at 1:00, ~2:20). Secondary transcriptions of his video/Barista Hustle write-up — not fetched verbatim.",
      },
    ],
    verified: false,
    notes:
      "Corrected from the prior 22 g : 352 g / 95 °C / ~3:35 values, which could not be sourced to Perger and closely match a different recipe (a 22 g : 375 g / 98 °C method attributed in a coffeeadastra comment to Alessandro Galtieri, explicitly NOT Perger) — i.e. a likely misattribution. Perger's documented headline recipe is 12 g : 200 g at 97 °C with a vigorous bloom stir. Kept verified:false: the numbers come from secondary transcriptions of his video / Barista Hustle article, not a verbatim-fetched primary source. The old fabricated Niche degree range was removed per the Hard Rule.",
  },

  // ── Scott Rao ────────────────────────────────────────────────────────────

  {
    id: "rao-rule-of-thirds",
    name: "Rao — Rule of Thirds Pour Pattern",
    shortName: "Rao 1/3 1/3 1/3",
    attribution: {
      person: "Scott Rao",
      title: "*The Professional Barista's Handbook* author",
      country: "United States",
    },
    category: "reference",
    brewer: "v60",
    dose: { grams: 22 },
    water: { grams: 352, ratio: "1:16" },
    temperature: { celsius: 96 },
    grind: {
      referenceSetting: "medium-fine",
      nicheZeroDegrees: [375, 383],
    },
    pourSequence: [
      {
        label: "Bloom",
        action: "pour",
        waterGramsAtEnd: 66,
        durationSec: 10,
      },
      {
        label: "Rao spin",
        action: "swirl",
        durationSec: 5,
        notes:
          "Rao's signature — a vigorous swirl during the bloom that spins the slurry like a vortex. Saturates evenly without stirring.",
      },
      { label: "Bloom rest", action: "wait", durationSec: 30 },
      {
        label: "Pour 1 (one-third)",
        action: "pour",
        waterGramsAtEnd: 162,
        durationSec: 20,
      },
      {
        label: "Pour 2 (one-third)",
        action: "pour",
        waterGramsAtEnd: 257,
        durationSec: 20,
      },
      {
        label: "Pour 3 (one-third)",
        action: "pour",
        waterGramsAtEnd: 352,
        durationSec: 20,
      },
      {
        label: "Final Rao spin",
        action: "swirl",
        durationSec: 5,
        notes: "Flatten the bed; encourage an even drawdown.",
      },
      { label: "Drawdown", action: "drain", durationSec: 95 },
    ],
    totalTimeSec: 205,
    techniques: ["rule-of-thirds", "rao-spin", "even-distribution"],
    bestFor: {
      roastLevels: ["light", "medium-light", "medium"],
      processes: ["washed", "natural", "honey"],
      goals: ["balanced"],
    },
    teaches:
      "Equal-volume thirds + swirl-not-stir agitation = predictable, repeatable extraction. The Rao spin is its own technique — a vortex swirl that distributes water evenly without disturbing the bed.",
    science:
      "Equal-volume pours produce a more uniform total extraction time per ground-water contact unit than weighted pour distributions. The Rao spin's vortex motion drags water down through the puck centre-first rather than wall-first, counteracting the V60's tendency to channel along the filter walls. Combined effect: lower extraction variance run-to-run, easier diagnosis when things go wrong.",
    whenToUse:
      "Default V60 daily-driver when you want consistency you can troubleshoot from. Pair with a known coffee to isolate technique drift; pair with an unknown coffee for a baseline read.",
    sources: [
      {
        type: "book",
        citation:
          "Rao, S. — *The Professional Barista's Handbook* (multiple editions)",
      },
      {
        type: "video",
        citation: "Scott Rao — published V60 technique videos",
      },
    ],
    verified: true,
  },

  // ── Daiki Hatakeyama ─────────────────────────────────────────────────────

  {
    id: "hatakeyama-cafec-flower",
    name: "Hatakeyama — Cafec Flower Dripper, Roast-Tailored",
    shortName: "Hatakeyama Cafec",
    attribution: {
      person: "Daiki Hatakeyama",
      title:
        "2× Japan Brewers Cup Champion, 2nd at WBrC 2021, Cafec Ambassador",
      country: "Japan",
    },
    category: "reference",
    brewer: "cafec-flower",
    brewerNotes:
      "Cafec Flower Dripper (six tall ribs, cup-shaped) with roast-tailored Cafec paper (Light Roast / Medium Roast / Dark Roast / Abaca variants). The technique is to match paper to roast level.",
    dose: { grams: 15 },
    water: { grams: 225, ratio: "1:15" },
    temperature: {
      rangeC: [88, 95],
      celsius: 92,
    },
    grind: {
      referenceSetting: "medium",
      nicheZeroDegrees: [375, 385],
    },
    pourSequence: [
      {
        label: "Bloom",
        action: "pour",
        waterGramsAtEnd: 40,
        durationSec: 30,
      },
      {
        label: "Pour 1",
        action: "pour",
        waterGramsAtEnd: 100,
        durationSec: 20,
      },
      {
        label: "Pour 2",
        action: "pour",
        waterGramsAtEnd: 160,
        durationSec: 20,
      },
      {
        label: "Pour 3",
        action: "pour",
        waterGramsAtEnd: 225,
        durationSec: 20,
      },
      { label: "Drawdown", action: "drain", durationSec: 80 },
    ],
    totalTimeSec: 190,
    techniques: [
      "roast-tailored-filter",
      "flower-dripper-geometry",
      "temperature-by-roast",
    ],
    bestFor: {
      roastLevels: ["light", "medium-light", "medium", "medium-dark"],
      processes: ["washed", "natural", "honey"],
      goals: ["balanced", "explore"],
    },
    teaches:
      "How filter paper choice and water temperature should change with roast level — a dimension most pour-over recipes ignore. Light roast → high temp (95°C) + thinner paper (Light Roast Cafec). Dark roast → lower temp (88°C) + thicker paper (Dark Roast Cafec).",
    science:
      "Lighter roasts have lower solubility and need more aggressive extraction (high temperature, more contact). Darker roasts have higher solubility and over-extract easily (lower temperature, less contact). The Flower Dripper's six tall ribs create air channels along the entire filter height — drawdown is fast regardless of paper. So paper thickness becomes the timing variable: a thicker Dark Roast paper slows flow precisely where the darker coffee needs less contact. Hatakeyama systematises what most brewers do haphazardly.",
    whenToUse:
      "When you want a single dripper that handles a range of roast levels well, and you're willing to keep multiple papers on hand. The principles (match paper to roast, match temperature to roast) transfer to any dripper if you have papers of varying thickness.",
    sources: [
      {
        type: "interview",
        citation: "Cafec Ambassador materials — Hatakeyama published interviews",
      },
      {
        type: "video",
        citation:
          "Cafec / Sanyo Sangyo published brewing demonstrations (Japanese, with English subtitles on some)",
      },
    ],
    verified: false,
    notes:
      "Two honesty flags from web research. (1) The specific numbers here (15 g : 225 g, 88–95 °C, ~3:10) could NOT be sourced to any publication, primary or secondary — treat them as an unverified reconstruction, not Hatakeyama's recipe. (2) The 'roast-tailored filter' framing is a Cafec PRODUCT concept that Hatakeyama promotes as a Cafec brand ambassador (Cafec sells roast-specific papers: Light / Medium-Dark T-90 / Dark T-83) — it is not documented as his WBrC-winning method. His actual WBrC 2021 routine (Milan; he placed 2nd / runner-up, champion was Matt Winton — he was NOT world champion) is reported, secondary-tier only, as: Cafec Flower Dripper + Abaca filter, 20 g : 260 g (~1:13), KRUVE-sieved to remove microfines, staged temperature ~90 °C (pours 1–3) dropping to ~60 °C (late pours), target ~3:00, brewed on a Colombia/Bolivia Geisha blend. The exact per-pour schedule and bloom time are NOT reliably documented. This entry is kept as a roast-tailored teaching demo and stays verified:false until a primary source can be fetched.",
  },

  // ── Mikaela Wallgren ─────────────────────────────────────────────────────

  {
    id: "wallgren-kalita-sieved",
    name: "Wallgren — Kalita Wave with Sieved Fines",
    shortName: "Wallgren Kalita",
    attribution: {
      person: "Mikaela Wallgren",
      title: "2016 World Brewers Cup runner-up",
      affiliation: "The Coffee Collective, Copenhagen",
      country: "Finland / Denmark",
      year: 2016,
    },
    category: "reference",
    brewer: "kalita-wave",
    brewerNotes:
      "Kalita Wave with wave paper filter. Coffee: a washed Kenya Kieni (SL28 / SL34), rested ~16 days off roast. RO water with low ppm / low carbonate. She brews one cup at a time, gently agitating with a continuous pour, and uses kettle flow restrictors for a steady stream.",
    dose: { grams: 15 },
    water: { grams: 250, ratio: "1:16.7" },
    temperature: { celsius: 96 },
    grind: {
      referenceSetting:
        "her everyday Kalita grind, then sieved to remove fines",
      nicheZeroDegrees: [375, 385],
      description:
        "The only change from her daily bar routine is sieving off the fines so they can't over-extract.",
    },
    pourSequence: [
      {
        label: "Sieve grounds (pre-brew)",
        action: "agitate-bed",
        durationSec: 0,
        notes:
          "Sieve off the fines before brewing — less bitterness because the fines can't over-extract.",
      },
      {
        label: "Bloom",
        action: "pour",
        waterGramsAtEnd: 50,
        durationSec: 30,
        notes: "30 s bloom.",
      },
      {
        label: "Continuous circular pour to 250 g",
        action: "pour",
        waterGramsAtEnd: 250,
        durationSec: 75,
        notes:
          "One continuous pour in circles, all the way to 1:45 — gentle, even agitation of the whole bed the entire pour. Flow restrictors on the kettle keep the stream steady and controlled.",
      },
      { label: "Drawdown", action: "drain", durationSec: 50 },
    ],
    totalTimeSec: 155,
    techniques: ["fines-removal", "kalita-flat-bed", "continuous-pour"],
    bestFor: {
      roastLevels: ["very-light", "light"],
      processes: ["washed"],
      goals: ["high-clarity", "sweetness-forward"],
    },
    teaches:
      "How removing fines before brewing produces clarity that no in-cup technique can match — paired with a single continuous circular pour for even, gentle agitation throughout the brew.",
    science:
      "Fines (particles smaller than ~200 µm) over-extract relative to the rest of the grind because their surface-area-to-volume ratio is huge. They contribute disproportionately to bitter, phenolic Zone 3 compounds. Sieving them out tightens the extraction distribution so every remaining particle extracts in the same window. Brewing one cup at a time with a continuous circular pour keeps the whole bed gently agitated, which Wallgren credits for an even extraction and a sweeter cup; the Kalita's flat bed reinforces the uniformity.",
    whenToUse:
      "For competition-grade light washed coffees where the goal is maximum clarity and sweetness and the budget supports a sieve. Not for naturals — fines contribute body that naturals often need.",
    sources: [
      {
        type: "official-competition",
        citation: "2016 World Brewers Cup Final — runner-up routine",
        year: 2016,
      },
      {
        type: "transcript",
        citation:
          "Wallgren's own WBrC 2016 stage presentation (The Coffee Collective, Kenya Kieni SL28/SL34) — '15 grams of coffee, 250 mils of water… 30 second bloom, then continue pouring continued circles all the way to 1 minute 45… total brew time 2 minutes 35… 96 degrees… I sieved off the fines.' Transcribed in-session.",
        year: 2016,
      },
    ],
    verified: true,
    notes:
      "Corrected from Wallgren's own stage presentation: dose 15 g (was 22 g), water 250 g / 1:16.7 (was 330 g / 1:15), 96°C (was 94°C), bloom 30 s + one continuous circular pour to 1:45, total 2:35 (was bloom + 3 discrete pours, 3:35). Fines-sieving confirmed.",
  },

  // Turbo V60 (formerly attributed to Lance Hedrick) was removed: "turbo" is an
  // espresso technique (originating in Cameron, Hendon et al., *Matter*, 2020;
  // popularised by Hedrick ~2021), and no primary source documents a Hedrick
  // *filter* recipe with the parameters this entry carried. The boiling-water +
  // coarse-grind mechanism survives as a technique (see techniques/data.ts:
  // "boiling-water-coarse-grind"), now correctly de-attributed.
];
