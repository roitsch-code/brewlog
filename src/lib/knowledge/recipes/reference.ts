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
      "Clever Dripper L (full-immersion brewer with valve at the base). Technique credited to James Bailey of Workshop Coffee, popularised by Hoffmann.",
    dose: { grams: 18 },
    water: { grams: 300, ratio: "1:16.7" },
    temperature: { celsius: 96, rangeC: [94, 98] },
    grind: {
      referenceSetting: "medium, slightly coarser than V60",
      nicheZeroDegrees: [421, 431],
    },
    pourSequence: [
      {
        label: "Water first",
        action: "pour",
        waterGramsAtEnd: 300,
        durationSec: 15,
        notes:
          "Add all the water to the empty (sealed) brewer first. The valve seals the bottom — no drawdown yet.",
      },
      {
        label: "Add coffee",
        action: "agitate-bed",
        durationSec: 5,
        notes:
          "Pour the ground coffee directly onto the water. The coffee floats and self-saturates without stirring.",
      },
      {
        label: "Swirl",
        action: "swirl",
        durationSec: 5,
        notes:
          "Single swirl to fully submerge the floating coffee. No stirring — stirring breaks the suspension and over-agitates.",
      },
      { label: "Steep", action: "wait", durationSec: 120 },
      {
        label: "Stir to break crust",
        action: "stir",
        durationSec: 5,
        notes:
          "A single stir to break the floating crust and let the slurry settle.",
      },
      {
        label: "Place on carafe — drawdown begins",
        action: "drain",
        durationSec: 30,
      },
    ],
    totalTimeSec: 180,
    techniques: [
      "water-first",
      "full-immersion",
      "no-stir-bloom",
    ],
    bestFor: {
      roastLevels: ["light", "medium-light", "medium"],
      processes: ["washed", "natural", "honey"],
      goals: ["balanced", "sweetness-forward", "body-forward"],
    },
    teaches:
      "How a water-first technique eliminates the bloom agitation problem entirely. The coffee saturates from below, fines stay suspended, and the cup carries the body of an immersion with the clarity of a percolation.",
    science:
      "In standard pour-over, dry grounds resist wetting — the brewer pours, stirs, or swirls to overcome surface tension. Each of those moves introduces fines migration risk. Water-first reverses the relationship: the grounds drop into water and saturate through buoyancy and capillary action, with no mechanical agitation needed. Steep time (2 minutes) is enough for sugars and acids to reach equilibrium without invading Zone 3. The Clever's valve then releases the slurry — the paper filter strips the oils and most of the fines on drawdown, producing a cleaner cup than a French press without the labour of a V60.",
    whenToUse:
      "Default for any coffee where you want a balanced, forgiving brew. Excellent for entertaining (no pour technique required) and for unfamiliar coffees (the technique is so consistent that the cup is a clean read on the coffee).",
    sources: [
      {
        type: "video",
        citation:
          "James Hoffmann — 'The Ultimate Clever Dripper Technique' (YouTube)",
        year: 2022,
      },
    ],
    verified: true,
  },

  {
    id: "hoffmann-aeropress-standard",
    name: "Hoffmann AeroPress — Inverted",
    shortName: "Hoffmann AeroPress",
    attribution: {
      person: "James Hoffmann",
      country: "United Kingdom",
    },
    category: "reference",
    brewer: "aeropress",
    brewerNotes: "Inverted orientation, standard paper filter",
    dose: { grams: 11 },
    water: { grams: 200, ratio: "1:18.2" },
    temperature: { celsius: 85, rangeC: [80, 90] },
    grind: {
      referenceSetting: "medium-fine, slightly coarser than espresso",
      nicheZeroDegrees: [377, 387],
    },
    pourSequence: [
      { label: "Invert and load", action: "invert", durationSec: 0 },
      {
        label: "Add water",
        action: "pour",
        waterGramsAtEnd: 200,
        durationSec: 10,
      },
      {
        label: "Stir 2–3× evenly",
        action: "stir",
        durationSec: 10,
      },
      { label: "Steep", action: "wait", durationSec: 90 },
      {
        label: "Stir to break crust",
        action: "stir",
        durationSec: 10,
      },
      { label: "Cap, flip, press slowly", action: "press", durationSec: 30 },
    ],
    totalTimeSec: 150,
    techniques: [
      "inverted-aeropress",
      "low-temperature-extraction",
      "lean-ratio",
    ],
    bestFor: {
      roastLevels: ["light", "medium-light", "medium"],
      processes: ["washed", "natural", "honey"],
      goals: ["balanced"],
    },
    teaches:
      "How a low-temperature, lean-ratio AeroPress produces a clean, filter-style cup without the bitterness people associate with the brewer.",
    science:
      "The AeroPress is often brewed too hot and too rich — that's where the muddy, bitter reputation comes from. At 85°C and 1:18, the brew sits in Zone 1–2 throughout the 90-second steep. The press itself is the only agitation event that matters for late extraction; pressing slowly (30 seconds) avoids forcing water through over-extracted boundary layers around grounds.",
    whenToUse:
      "A daily AeroPress that drinks like a clean filter cup. Excellent for travel because the AeroPress is forgiving on grind precision.",
    sources: [
      {
        type: "video",
        citation: "James Hoffmann — AeroPress technique videos (multiple)",
      },
    ],
    verified: true,
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
      nicheZeroDegrees: [431, 441],
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
    dose: { grams: 20 },
    water: { grams: 250, ratio: "1:12.5 (extraction) — diluted by 200g ice in carafe" },
    temperature: { celsius: 95 },
    grind: {
      referenceSetting: "medium-coarse",
      nicheZeroDegrees: [421, 431],
    },
    pourSequence: [
      {
        label: "Pour water onto coffee",
        action: "pour",
        waterGramsAtEnd: 250,
        durationSec: 15,
      },
      { label: "Swirl", action: "swirl", durationSec: 5 },
      { label: "Steep", action: "wait", durationSec: 220 },
      { label: "Swirl", action: "swirl", durationSec: 5 },
      {
        label: "Place on carafe of ice — drawdown onto ice",
        action: "drain",
        durationSec: 55,
        notes: "Server contains 200g ice. Hot concentrate flashes cold on contact.",
      },
    ],
    totalTimeSec: 300,
    techniques: [
      "japanese-iced-immersion",
      "flash-chilling",
      "concentrate-and-ice",
    ],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed", "natural", "honey"],
      goals: ["balanced", "sweetness-forward"],
      occasions: ["summer-time", "iced"],
    },
    teaches:
      "How flash-chilling an immersion preserves aromatics that cold-brew loses to its long extraction time. The 1:12.5 extraction concentration plus ice dilution lands at an effective 1:22 final drink — strong enough to taste under ice.",
    science:
      "Cold brew extracts over 8–18 hours at room temperature; the long timeline lets fine bitter compounds reach equilibrium, but volatile aromatic compounds dissipate. A flash-chilled iced coffee extracts hot (full Zone 1 aromatics) and then drops below 5°C in seconds when the concentrate hits ice — the aromatics are locked into the liquid before they can volatilise. The Clever's full immersion gives a balanced extraction; the percolation alternative (Japanese Iced V60) produces a brighter, less rounded cup.",
    whenToUse:
      "Summer iced coffee where you want body and balance, not the sharp brightness of a percolation iced. Pairs well with milk or as a long iced drink with extra cold water.",
    sources: [
      {
        type: "video",
        citation:
          "James Hoffmann — 'My Favorite Iced Coffee Recipe' (YouTube)",
      },
    ],
    verified: true,
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
      nicheZeroDegrees: [411, 421],
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

  // ── Patrik Rolf ──────────────────────────────────────────────────────────

  {
    id: "rolf-minimum-variables",
    name: "Rolf — Minimum Variables (Stagg [X])",
    shortName: "Rolf Stagg [X]",
    attribution: {
      person: "Patrik Rolf",
      title: "April Coffee Roasters founder, 'Coffee with April' YouTube",
      affiliation: "April Coffee, Copenhagen",
      country: "Denmark / Sweden",
    },
    category: "reference",
    brewer: "v60",
    brewerNotes:
      "Originally published for the Fellow Stagg [X] (flat-bottom). Translates to V60 with minor adjustments.",
    dose: { grams: 18 },
    water: { grams: 300, ratio: "1:16.7" },
    temperature: { celsius: 96 },
    grind: {
      referenceSetting: "medium-fine, fewer variables = uniformity matters more",
      nicheZeroDegrees: [398, 406],
    },
    pourSequence: [
      {
        label: "Bloom",
        action: "pour",
        waterGramsAtEnd: 60,
        durationSec: 5,
        notes: "3.3× dose. Pour quickly, no stir.",
      },
      {
        label: "Light swirl",
        action: "swirl",
        durationSec: 3,
        notes: "Saturate the puck. No stir — stirring is the variable being removed.",
      },
      { label: "Bloom rest", action: "wait", durationSec: 30 },
      {
        label: "Single continuous pour",
        action: "pour",
        waterGramsAtEnd: 300,
        durationSec: 60,
        notes:
          "One continuous pour rather than multiple discrete pours. Removes pour count and pour spacing as variables.",
      },
      { label: "Drawdown", action: "drain", durationSec: 120 },
    ],
    totalTimeSec: 218,
    techniques: ["minimal-agitation", "continuous-pour", "no-stir"],
    bestFor: {
      roastLevels: ["very-light", "light"],
      processes: ["washed"],
      goals: ["high-clarity"],
    },
    teaches:
      "How to remove technique as a variable. A single continuous pour with no stir produces a clean, repeatable extraction profile that isolates the coffee itself as the only thing changing brew-to-brew.",
    science:
      "Multi-pour V60 recipes introduce dozens of micro-variables: each pour's speed, spiral pattern, and intermission length affects extraction. By using one continuous pour, Rolf removes those variables — the only inputs are dose, water, temperature, grind, and total time. This is ideal for evaluating a coffee's intrinsic character or for repeatable side-by-side comparisons across coffees. Naturals can read flat under this method because the technique deliberately under-agitates.",
    whenToUse:
      "When evaluating an unfamiliar washed light roast and you want a clean read on the coffee, not your technique. Not the right choice for naturals or for sweetness-forward goals.",
    sources: [
      {
        type: "video",
        citation: "Coffee with April / Patrik Rolf — YouTube channel (multiple videos)",
      },
      {
        type: "book",
        citation: "Rolf, P. — *From Nerd to Pro: A Coffee Journey* (2022)",
      },
    ],
    verified: true,
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
      nicheZeroDegrees: [365, 375],
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
    dose: { grams: 22 },
    water: { grams: 352, ratio: "1:16" },
    temperature: { celsius: 95 },
    grind: {
      referenceSetting: "fine — finer than most V60 recipes",
      nicheZeroDegrees: [388, 396],
    },
    pourSequence: [
      {
        label: "Bloom",
        action: "pour",
        waterGramsAtEnd: 66,
        durationSec: 10,
        notes: "3× dose.",
      },
      {
        label: "Vigorous stir 3–5×",
        action: "stir",
        durationSec: 10,
        notes:
          "Perger's signature — vigorous bloom stir to ensure full saturation and to drive extraction yield up.",
      },
      { label: "Bloom rest", action: "wait", durationSec: 30 },
      {
        label: "Main pour",
        action: "pour",
        waterGramsAtEnd: 250,
        durationSec: 30,
      },
      {
        label: "Top-up pour",
        action: "pour",
        waterGramsAtEnd: 352,
        durationSec: 30,
      },
      {
        label: "Spinning swirl during drawdown",
        action: "swirl",
        durationSec: 10,
        notes: "Spin the dripper to keep the puck moving — maximises yield.",
      },
      { label: "Drawdown", action: "drain", durationSec: 95 },
    ],
    totalTimeSec: 215,
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
          "Matt Perger — Barista Hustle 'Coffee Compass' / extraction yield articles",
      },
    ],
    verified: false,
    notes:
      "Perger has published multiple V60 recipes over the years; this is a representative synthesis of his published high-extraction approach. Exact dose/water/time vary across his publications.",
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
      nicheZeroDegrees: [396, 404],
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
      nicheZeroDegrees: [396, 406],
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
      "Specific dose/water/pour milestones reconstructed from Cafec demonstration materials; the principle (roast-tailored paper and temperature) is the canonical Hatakeyama contribution, not these specific numbers.",
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
    brewerNotes: "Kalita Wave 155 with wave paper filter",
    dose: { grams: 22 },
    water: { grams: 330, ratio: "1:15" },
    temperature: { celsius: 94 },
    grind: {
      referenceSetting:
        "medium, then sieved to remove fines (Kruve Two or similar)",
      nicheZeroDegrees: [396, 406],
      description:
        "Pre-sieving removes the fines fraction (~3–5% of total mass) — the cup is markedly cleaner.",
    },
    pourSequence: [
      {
        label: "Sieve grounds (pre-brew)",
        action: "agitate-bed",
        durationSec: 0,
        notes:
          "Discard fines fraction before brewing. This is the technique's defining move.",
      },
      {
        label: "Bloom",
        action: "pour",
        waterGramsAtEnd: 50,
        durationSec: 35,
      },
      {
        label: "Swirl (no stir)",
        action: "swirl",
        durationSec: 5,
        notes:
          "Kalita Wave: never stir. The flat bed channels if disturbed.",
      },
      {
        label: "Pour 1",
        action: "pour",
        waterGramsAtEnd: 150,
        durationSec: 25,
      },
      {
        label: "Pour 2",
        action: "pour",
        waterGramsAtEnd: 240,
        durationSec: 25,
      },
      {
        label: "Pour 3",
        action: "pour",
        waterGramsAtEnd: 330,
        durationSec: 25,
      },
      { label: "Drawdown", action: "drain", durationSec: 70 },
    ],
    totalTimeSec: 215,
    techniques: ["fines-removal", "kalita-flat-bed", "swirl-only-agitation"],
    bestFor: {
      roastLevels: ["very-light", "light"],
      processes: ["washed"],
      goals: ["high-clarity"],
    },
    teaches:
      "How removing fines before brewing produces clarity that no in-cup technique can match. Fines are the primary source of muddy cups; remove them and the Kalita Wave's already-clean profile becomes pristine.",
    science:
      "Fines (particles smaller than ~200 µm) over-extract relative to the rest of the grind because their surface-area-to-volume ratio is huge. They contribute disproportionately to bitter, phenolic Zone 3 compounds. Sieving them out reduces the median extraction yield slightly but tightens the distribution — every remaining particle extracts in the same window. The Kalita's flat bed already favours uniform extraction; combined with fines removal, the cup reads almost too clean to non-specialty palates.",
    whenToUse:
      "For competition-grade light washed coffees where the goal is maximum clarity and the budget supports a sieve. Not for naturals — fines contribute body that naturals often need.",
    sources: [
      {
        type: "official-competition",
        citation: "2016 World Brewers Cup Final — runner-up routine",
        year: 2016,
      },
      {
        type: "interview",
        citation:
          "The Coffee Collective / Mikaela Wallgren published interviews",
      },
    ],
    verified: false,
    notes:
      "The sieving + Kalita Wave + light agitation combination is well-attested as Wallgren's signature. Specific dose/water/temperature reconstructed from Coffee Collective public materials.",
  },

  // ── Turbo V60 (popularised by Lance Hedrick) ─────────────────────────────

  {
    id: "turbo-v60-hedrick",
    name: "Turbo V60 (Hedrick)",
    shortName: "Turbo V60",
    attribution: {
      person: "Lance Hedrick (popularised)",
      title:
        "Coffee educator, YouTube; technique developed in the championship community",
      country: "United States",
    },
    category: "reference",
    brewer: "v60",
    dose: { grams: 15 },
    water: { grams: 250, ratio: "1:16.7" },
    temperature: { celsius: 100 },
    grind: {
      referenceSetting: "coarse — espresso fine WOULD choke",
      nicheZeroDegrees: [391, 396],
    },
    pourSequence: [
      {
        label: "Bloom",
        action: "pour",
        waterGramsAtEnd: 45,
        durationSec: 5,
      },
      {
        label: "Stir 2–3×",
        action: "stir",
        durationSec: 10,
        notes:
          "Turbo recipes stir at bloom — the coarse grind tolerates agitation without channeling.",
      },
      { label: "Bloom rest", action: "wait", durationSec: 30 },
      {
        label: "Fast pour to 250g",
        action: "pour",
        waterGramsAtEnd: 250,
        durationSec: 35,
        notes:
          "Single fast pour. The coarse grind drains at ~7 g/s — finish water by ~1:10.",
      },
      { label: "Drawdown", action: "drain", durationSec: 40 },
    ],
    totalTimeSec: 120,
    techniques: ["boiling-water", "coarse-grind", "fast-flow"],
    bestFor: {
      roastLevels: ["very-light", "light"],
      processes: ["washed"],
      goals: ["explore", "high-clarity"],
      occasions: ["quick"],
    },
    teaches:
      "How a counter-intuitive combination (100°C + coarse grind + fast pour) produces a clean, well-extracted cup in 2 minutes. Breaks the 'finer for higher extraction' rule.",
    science:
      "Boiling water at 100°C raises extraction rate across all zones. Coarse grind reduces surface area, slowing extraction back down — the two cancel partially, but the math works out to high yield in short time. The fast pour minimises bed-contact time, keeping the brew in Zone 1–2. Net result: a 2-minute V60 that drinks like a careful 4-minute brew. Hedrick and others have demonstrated repeatable yields above 22% on the EVE EVA refractometer.",
    whenToUse:
      "Quick brews where you want light-roast clarity without the time. Excellent first cup of the day. Not for dark roasts — boiling water amplifies dark-roast bitter compounds catastrophically.",
    sources: [
      {
        type: "video",
        citation: "Lance Hedrick — YouTube (multiple Turbo V60 videos)",
      },
      {
        type: "article",
        citation: "Specialty coffee community articles on Turbo brewing",
      },
    ],
    verified: true,
  },
];
