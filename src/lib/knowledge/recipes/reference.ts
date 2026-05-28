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
    techniques: [
      "swirl-not-stir",
      "pulsed-pours-50g-blocks",
      "preheat-via-hot-tap",
    ],
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
      "Hoffmann does not publish a Niche Zero degree number — Niche degrees must be calibrated empirically by the user against this recipe's ~3:00 drawdown target. Rescue moves Hoffmann published in the 2024 follow-up video: if grind too fine, pour the full 250 g on schedule but pull the cup at usual brew time and top up with hot water to ~215–220 g final; if grind slightly too coarse, expand 5 pours to 7 with more turbulent pouring and full drainage between each, optionally adding a +50 mL final pour (mild dilution cost). Visual diagnostics: muddy/soupy bloom = grind too fine; bloom dries out fast = grind too coarse or beans very fresh.",
  },

  {
    id: "hoffmann-clever-ultimate",
    name: "Hoffmann Ultimate Clever",
    shortName: "Hoffmann Clever",
    attribution: {
      person: "James Hoffmann",
      country: "United Kingdom",
      year: 2020,
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
          "James Hoffmann — \"The Ultimate Clever Dripper Technique\" (YouTube)",
        url: "https://www.youtube.com/watch?v=RpOdennxP24",
        year: 2020,
      },
    ],
    verified: true,
    notes:
      "Temperature '96 °C' is a defensible numeric pinning of Hoffmann's 'just off-boil' wording. Technique itself is attributed by Hoffmann to James Bailey of Workshop Coffee London; Hoffmann is the populariser. Niche degree range is user-empirical, not from Hoffmann.",
  },

  {
    id: "hoffmann-aeropress-standard",
    name: "Hoffmann Ultimate AeroPress — Standard",
    shortName: "Hoffmann AeroPress",
    attribution: {
      person: "James Hoffmann",
      country: "United Kingdom",
      year: 2021,
    },
    category: "reference",
    brewer: "aeropress",
    brewerNotes:
      "STANDARD orientation (not inverted). Paper filter not rinsed; brewer not preheated. Hoffmann's signature move is to seat the plunger ~1 cm into the chamber immediately after pouring — this creates an air seal that stops water from dripping through during the steep.",
    dose: { grams: 11 },
    water: { grams: 200, ratio: "1:18.2" },
    temperature: { celsius: 95, rangeC: [85, 100] },
    grind: {
      referenceSetting: "medium-fine, finer end of medium",
    },
    pourSequence: [
      {
        label: "Load (standard orientation)",
        action: "agitate-bed",
        durationSec: 0,
        notes:
          "Cap with rinsed paper, set on the cup standard-orientation. Add the dose. No preheat.",
      },
      {
        label: "Pour all water",
        action: "pour",
        waterGramsAtEnd: 200,
        durationSec: 15,
        notes:
          "Pour 200 g aiming to wet all grounds. No stir — saturation by pour alone.",
      },
      {
        label: "Seat the plunger",
        action: "agitate-bed",
        durationSec: 5,
        notes:
          "Immediately seat the plunger ~1 cm into the chamber to create an air seal — this stops water from dripping through during the steep.",
      },
      { label: "Steep", action: "wait", durationSec: 120 },
      {
        label: "Swirl",
        action: "swirl",
        durationSec: 5,
        notes: "Gentle swirl at 2:00 to settle the slurry before pressing.",
      },
      { label: "Wait", action: "wait", durationSec: 30 },
      {
        label: "Press slowly",
        action: "press",
        durationSec: 30,
        notes: "Slow press from 2:30 to ~3:00.",
      },
    ],
    totalTimeSec: 180,
    techniques: ["standard-aeropress-plunger-seal", "lean-ratio"],
    bestFor: {
      roastLevels: ["light", "medium-light", "medium"],
      processes: ["washed", "natural", "honey"],
      goals: ["balanced"],
    },
    teaches:
      "How a lean ratio (1:18) AeroPress produces a clean, filter-style cup at default light-roast temperature (~95 °C). The standard-orientation plunger-seal trick eliminates inversion entirely — simpler to teach, fewer ways to fail.",
    science:
      "Inversion exists to prevent drip-through during the steep, but it adds a flip step that introduces variance. Hoffmann's plunger-seal achieves the same result without the flip: seating the plunger 1 cm creates a small air pocket that holds the water against the paper via atmospheric pressure. The lean 1:18 ratio sits in Zone 1–2 throughout the 2-minute steep — most of the AeroPress's bitter reputation comes from over-rich recipes (1:12 to 1:14), not the brewer itself. Hoffmann's roast staircase: 95 °C for light roasts (default), descend to 85 °C for dark — codebase previously had 85 °C as the headline, which is his dark-roast value.",
    whenToUse:
      "Daily AeroPress that drinks like a clean filter cup. Excellent for travel. Roast staircase: 95 °C default (light/medium-light), 90 °C medium, 85 °C dark.",
    sources: [
      {
        type: "video",
        citation:
          "James Hoffmann — \"The Ultimate AeroPress Technique (Episode #3)\" (YouTube, 2021)",
        url: "https://www.youtube.com/watch?v=j6VlT_jUVPc",
        year: 2021,
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
      "The Moccamaster heats water in a tube, then releases it in pulses through a perforated showerhead — each pulse approximates a small V60 pour. The flat-bottomed paper filter sits in a Kalita-like basket: even bed, slow drawdown, well-extracted cup. The medium-coarse grind compensates for the longer total brew time (~8 minutes for 750 g).",
    whenToUse:
      "When brewing for two or more people, or when you want filter coffee without the labour. Not for single-cup brewing — the showerhead doesn't saturate properly below ~500 ml.",
    sources: [
      {
        type: "video",
        citation:
          "James Hoffmann — \"The Perfect Moccamaster Brew Recipe\" (YouTube, Feb 2023)",
        url: "https://www.youtube.com/watch?v=xwFvlapyVl4",
        year: 2023,
      },
      {
        type: "book",
        citation:
          "Hoffmann, J. — *How to Make the Best Coffee at Home* (Octopus, 2022)",
      },
    ],
    verified: false,
    notes:
      "Demoted to verified:false during the 2026-05 knowledge-layer audit. The codebase headline 1:15 (50 g : 750 g) ratio is plausible but no aggregator transcript pinned it to Hoffmann's specific Moccamaster video; multiple aggregators consistently report 1:16 / 1:16.5 as his stated ratio. Brew temperature is determined by the machine (~92–96 °C), not the user. Niche degree range is user-empirical (the grinder doesn't matter much for a Moccamaster — the machine pulses define agitation, not the user's grind). Re-verify against the 2023 video before promoting back to verified:true.",
  },

  {
    id: "hoffmann-immersion-iced-clever",
    name: "Hoffmann Immersion Iced (Clever, two-cup)",
    shortName: "Hoffmann Iced",
    attribution: {
      person: "James Hoffmann",
      country: "United Kingdom",
      year: 2023,
    },
    category: "reference",
    brewer: "clever",
    brewerNotes:
      "Two-cup variant of Hoffmann's 2023 Immersion Iced Coffee. A single-cup variant also exists (19 g : 165 g water + 85 g ice) per Hoffmann's Facebook post.",
    dose: { grams: 37.5 },
    water: { grams: 500, ratio: "1:13.3 (extraction), +170 g ice in server" },
    temperature: { celsius: 95 },
    grind: {
      referenceSetting: "medium-fine, finer than pour-over but not espresso",
    },
    pourSequence: [
      {
        label: "Pour water onto coffee",
        action: "pour",
        waterGramsAtEnd: 500,
        durationSec: 20,
      },
      { label: "Swirl to saturate", action: "swirl", durationSec: 10 },
      { label: "Steep", action: "wait", durationSec: 240 },
      { label: "Swirl to settle", action: "swirl", durationSec: 5 },
      {
        label: "Place on carafe of ice — drawdown onto ice",
        action: "drain",
        durationSec: 120,
        notes:
          "Server contains 170 g ice. Hot concentrate flashes cold on contact. Total brew time ~6:35.",
      },
    ],
    totalTimeSec: 395,
    techniques: ["full-immersion", "flash-chilling"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed", "natural", "honey"],
      goals: ["balanced", "sweetness-forward"],
      occasions: ["summer-time", "iced"],
    },
    teaches:
      "How flash-chilling an immersion preserves aromatics that cold-brew loses to its long extraction time. The hot extraction lands the full Zone 1 aromatics; the ice drop locks them in before they volatilise.",
    science:
      "Cold brew extracts over 8–18 hours at room temperature; the long timeline lets fine bitter compounds reach equilibrium, but volatile aromatic compounds dissipate. A flash-chilled iced coffee extracts hot (full Zone 1 aromatics) and then drops below 5 °C in seconds when the concentrate hits ice — the aromatics are locked into the liquid before they can volatilise. The Clever's full immersion gives a balanced extraction; the percolation alternative (Japanese Iced V60) produces a brighter, less rounded cup.",
    whenToUse:
      "Summer iced coffee where you want body and balance, not the sharp brightness of a percolation iced. Pairs well with milk or as a long iced drink with extra cold water. Scales down to a single-cup at 19 g : 165 g + 85 g ice for solo brewing.",
    sources: [
      {
        type: "video",
        citation:
          "James Hoffmann — \"Immersion Iced Coffee: A Better & Easier Technique\" (YouTube, 2023)",
        url: "https://www.youtube.com/watch?v=8uGGeV8A-BM",
        year: 2023,
      },
      {
        type: "article",
        citation:
          "James Hoffmann — Facebook post documenting the single-cup variant (19 g : 165 g + ~85 g ice)",
        url: "https://www.facebook.com/jameshoffmanncoffee/posts/with-spring-in-full-swing-heres-my-recipe-for-the-perfect-iced-coffee-using-imme/1179893270442583/",
      },
    ],
    verified: true,
    notes:
      "Hoffmann teaches a 2/3 hot : 1/3 ice ratio rule in the video, but his published two-cup numbers (500 + 170 = ~75/25) and single-cup numbers (165 + 85 = ~66/34) bracket that rule rather than hit it exactly. Pick whichever scale-point matches your drink size; both are Hoffmann-attested. Niche degree omitted because Hoffmann doesn't publish one for this recipe.",
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
      { label: "Wait", action: "wait", durationSec: 35 },
      {
        label: "Pour 5 (60% phase, 3 of 3)",
        action: "pour",
        waterGramsAtEnd: 300,
        durationSec: 10,
      },
      { label: "Drawdown", action: "drain", durationSec: 20 },
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
        citation:
          "Kasuya, T. — *Anyone Can Make Great Coffee: The World's Best 4:6 Method* (Philocoffea)",
        url: "https://en.philocoffea.com/products/signed-book-by-tetsu-kasuya-anyone-can-make-great-coffee-the-worlds-best-4-6-method-for-getting-addicted-to-good-coffee",
      },
      {
        type: "article",
        citation: "Hario Europe — V60 Ambassador Q&A with Tetsu Kasuya",
        url: "https://www.hario-europe.com/blogs/hario-community/v60-ambassadors-tetsu-kasuya",
      },
      {
        type: "video",
        citation:
          "European Coffee Trip — \"3 Essential Hario V60 Recipes\" (third-party demo of an 18:300 sweet-leaning variant with Comandante 23 clicks; not primary)",
        url: "https://www.youtube.com/watch?v=P0mI6Ue8BKc",
      },
    ],
    verified: true,
    notes:
      "Canonical pour cadence is 45-second intervals between pour starts (10 s pour + 35 s wait), with Pour 5 starting at 3:00 and lift/drawdown finishing ~3:30. The 60-60-60-60-60 'balanced' split shown is one of multiple Kasuya-documented variants — Hario's published interview also describes a 50+70 first-40% split for sweetness/acidity dial; both are legitimate. Niche degree range is user-empirical, not from Kasuya.",
  },

  // ── Patrik Rolf ──────────────────────────────────────────────────────────

  {
    id: "rolf-minimum-variables",
    name: "Single-Pour V60 (Rolf-style minimum-variables philosophy)",
    shortName: "Single-Pour V60",
    attribution: {
      person: "Inspired by Patrik Rolf's published minimum-variables philosophy; specific numbers below are not traceable to a Rolf primary publication",
      title: "April Coffee Roasters founder, 'Coffee with April' YouTube",
      affiliation: "April Coffee, Copenhagen",
      country: "Denmark / Sweden",
    },
    category: "reference",
    brewer: "v60",
    brewerNotes:
      "Generic single-pour V60 recipe in the spirit of Rolf's minimum-variables philosophy. NOT Rolf's published recipe — his documented WBrC final and April Brewer recipes use different parameters.",
    dose: { grams: 18 },
    water: { grams: 300, ratio: "1:16.7" },
    temperature: { celsius: 96 },
    grind: {
      referenceSetting: "medium-fine, fewer variables = uniformity matters more",
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
        citation: "Coffee with April / Patrik Rolf — YouTube channel",
        url: "https://www.youtube.com/channel/UCPlsOYZ8ZEam57EUCf3DKjg",
      },
      {
        type: "book",
        citation:
          "Rolf, P. — *From Nerd to Pro: A Coffee Journey* (2022, April Coffee Roasters)",
        url: "https://www.aprilcoffeeroasters.com/pages/fromnerdtopro",
      },
      {
        type: "article",
        citation:
          "Patrik Rolf — WBrC final-round recipe write-up (April Coffee blog)",
        url: "https://www.aprilcoffeoasters.com/blogs/news/world-brewers-cup-recipe-final-round-patrik-rolf",
      },
    ],
    verified: false,
    notes:
      "Renamed and demoted to verified:false during the 2026-05 knowledge-layer audit. The previous entry attributed the specific 18 g : 300 g / 96 °C / 218 s / Stagg [X] parameters to Rolf, but those numbers don't trace to any Rolf primary publication. Rolf's documented recipes (the 2018 WBrC final routine and the April Brewer recipes) use different parameters. The technique itself — single continuous pour, swirl-not-stir, minimum variables — is Rolf's published philosophy and remains correctly attributed. Niche degree range removed (derived). If you want Rolf's actual WBrC routine, follow the April Coffee blog URL above; the numbers below are a generic single-pour V60 in his style.",
  },

  // ── Jonathan Gagné ───────────────────────────────────────────────────────

  {
    id: "gagne-long-aeropress",
    name: "Gagné — Fuller Flavor Profiles AeroPress + Prismo",
    shortName: "Gagné AeroPress",
    attribution: {
      person: "Jonathan Gagné",
      title:
        "Astrophysicist, *The Physics of Filter Coffee* author, coffeeadastra.com",
      country: "Canada",
      year: 2021,
    },
    category: "reference",
    brewer: "aeropress-prismo",
    brewerNotes:
      "Upright AeroPress with a Fellow Prismo metal valve (acts like espresso portafilter — no drip until pressed). Reaches ~23.5% extraction yield per Gagné's own measurements.",
    dose: { grams: 18 },
    water: { grams: 260, ratio: "1:14.4" },
    temperature: { celsius: 100, rangeC: [99, 100] },
    grind: {
      referenceSetting: "fine, espresso-adjacent",
    },
    pourSequence: [
      {
        label: "Add water (boiling, ~100 °C)",
        action: "pour",
        waterGramsAtEnd: 260,
        durationSec: 15,
      },
      {
        label: "Back-and-forth stir",
        action: "stir",
        durationSec: 10,
        notes:
          "Back-and-forth motion (NOT circular swirl) to saturate the puck evenly.",
      },
      {
        label: "Steep",
        action: "wait",
        durationSec: 295,
      },
      {
        label: "Swirl at 5:00",
        action: "swirl",
        durationSec: 5,
        notes:
          "Brief swirl at the 5-minute mark to redistribute the slurry mid-steep.",
      },
      {
        label: "Continue steep to 9:00",
        action: "wait",
        durationSec: 235,
        notes: "Total steep is ~9 minutes before press start.",
      },
      {
        label: "Slow press (~9:00 to ~10:00)",
        action: "press",
        durationSec: 60,
        notes:
          "Press lasts ~1 minute. The Prismo valve has held the slurry the entire ~9 minutes; press is the only flow-through event.",
      },
    ],
    totalTimeSec: 620,
    techniques: [
      "long-steep",
      "high-temperature-extraction",
      "fine-grind",
      "valved-aeropress",
    ],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed"],
      goals: ["high-clarity"],
    },
    teaches:
      "How a long-steep AeroPress at boiling temperature with a fine grind and the Prismo valve reaches ~23.5% extraction yield in a uniquely clean cup. The Prismo lets the steep run without drip, so extraction time is purely contact time.",
    science:
      "Gagné's published measurements show this recipe reaches ~23.5% extraction yield — at the high end of what's normally considered 'good extraction.' He runs the brew HOT (boiling), not cool: at 100 °C, even the bitter Zone 3 compounds extract fast — but the fine grind and Prismo-held immersion let the cup reach equilibrium across Zones 1, 2, and 3 without channeling. The mid-steep swirl at 5 minutes redistributes the slurry once. The result, per Gagné, is 'fuller flavor profiles' — a body-forward but extremely clean cup that's difficult to reach with conventional pour-over.",
    whenToUse:
      "When you have a precise washed coffee and want a body-forward but extremely clean cup. Requires a Prismo or equivalent — standard AeroPress drips through the paper filter and ruins the timing.",
    sources: [
      {
        type: "blog",
        citation:
          "Jonathan Gagné — \"Reaching Fuller Flavor Profiles with the AeroPress\" (coffeeadastra.com, 2021)",
        url: "https://coffeeadastra.com/2021/09/07/reaching-fuller-flavor-profiles-with-the-aeropress/",
        year: 2021,
      },
      {
        type: "book",
        citation: "Gagné, J. — *The Physics of Filter Coffee* (2021)",
      },
    ],
    verified: false,
    notes:
      "Demoted to verified:false during the 2026-05 knowledge-layer audit. Previous codebase parameters were materially wrong on every headline axis: dose 20 g (actual 18 g), water 200 g (actual ~260 g), temperature 80 °C (actual 100 °C — boiling), total time 6:25 (actual ~10:00 with ~9-minute steep + ~1-minute press), and stir was 'circular' (actual back-and-forth). The previous 'low-temperature long-steep / second sweet spot' framing was COMPLETELY WRONG — Gagné publishes HOT + long, not cool + long. The article is titled \"Reaching Fuller Flavor Profiles with the AeroPress,\" not 'Second Sweet Spot.' Niche degree range removed (derived). Re-verify after reading the Coffee ad Astra article end-to-end.",
  },

  // ── Matt Perger ──────────────────────────────────────────────────────────

  {
    id: "perger-high-extraction-v60",
    name: "Perger — Barista Hustle V60",
    shortName: "Perger V60",
    attribution: {
      person: "Matt Perger",
      title: "2013 World Brewers Cup Champion, founder of Barista Hustle",
      country: "Australia",
    },
    category: "reference",
    brewer: "v60",
    dose: { grams: 12 },
    water: { grams: 200, ratio: "1:16.7" },
    temperature: { celsius: 97 },
    grind: {
      referenceSetting: "fine — finer than typical V60 recipes",
    },
    pourSequence: [
      {
        label: "Bloom (0:00, → 50 g)",
        action: "pour",
        waterGramsAtEnd: 50,
        durationSec: 5,
      },
      {
        label: "Vigorous stir",
        action: "stir",
        durationSec: 10,
        notes:
          "Perger's signature — vigorous bloom stir to ensure full saturation and to drive extraction yield up.",
      },
      { label: "Bloom rest", action: "wait", durationSec: 15 },
      {
        label: "Pour 1 (0:30, +50 g → 100 g)",
        action: "pour",
        waterGramsAtEnd: 100,
        durationSec: 10,
      },
      { label: "Wait", action: "wait", durationSec: 20 },
      {
        label: "Pour 2 (1:00, +100 g → 200 g)",
        action: "pour",
        waterGramsAtEnd: 200,
        durationSec: 15,
      },
      { label: "Drawdown (lift by ~2:20)", action: "drain", durationSec: 65 },
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
      "Perger's Coffee Compass / 80:20 method applied: more agitation + finer grind = higher extraction yield = more flavour development. The opposite philosophy from Rolf — agitation as a feature, not a variable to remove.",
    science:
      "Extraction yield (percentage of soluble mass that ends up in the cup) correlates with cup development up to around 22–23% for most coffees. Below that the cup is sour and thin; above ~23% it turns bitter. Perger argues most home brewers under-extract because they fear bitterness — but bitterness comes from over-extraction *of the wrong compounds*, not high yield itself. Vigorous bloom agitation + fine grind drives yield up while staying in the sweet-and-balanced zone if grind and time are right.",
    whenToUse:
      "On a competition-grade washed coffee where you suspect previous brews have been under-extracted (sour, thin, flat). Not for naturals — high agitation amplifies fermentation character.",
    sources: [
      {
        type: "article",
        citation:
          "Matt Perger — \"The 80:20 Method for Coffee Brewing\" (Barista Hustle, Medium)",
        url: "https://medium.com/barista-hustle/80-20-method-for-coffee-brewing-3e394c8b81b2",
      },
      {
        type: "article",
        citation: "Barista Hustle — Coffee Extraction & the 80:20 Method",
        url: "https://www.baristahustle.com/coffee-extraction-the-80-20-method/",
      },
      {
        type: "article",
        citation: "Barista Hustle — The Espresso Compass (Perger framework)",
        url: "https://www.baristahustle.com/the-espresso-compass/",
      },
    ],
    verified: false,
    notes:
      "Demoted to verified:false during the 2026-05 knowledge-layer audit. Previous codebase parameters disagreed with Perger's published Barista Hustle V60 recipe on every headline axis: dose 22 g (actual 12 g), water 352 g (actual 200 g), temperature 95 °C (actual 97 °C), total time 3:35 (actual ~2:20), and a 'spinning swirl during drawdown' step that is Rao's technique, not Perger's. The teaching narrative (high extraction yield 22%+ is achievable and tasty if you avoid the bitter compounds) is genuinely Perger's thesis — only the numbers were off. Niche degree range removed (derived). Re-verify against the BH V60 brew guide video before promoting to verified:true.",
  },

  // ── Scott Rao ────────────────────────────────────────────────────────────

  {
    id: "rao-rule-of-thirds",
    name: "Rao V60 — Two-Pour with Rao Spin",
    shortName: "Rao V60 (two-pour)",
    attribution: {
      person: "Scott Rao",
      title: "*The Professional Barista's Handbook* author; Hario V60 Ambassador",
      country: "United States",
    },
    category: "reference",
    brewer: "v60",
    dose: { grams: 20 },
    water: { grams: 340, ratio: "1:17" },
    temperature: { celsius: 100, rangeC: [95, 100] },
    grind: {
      referenceSetting: "medium-fine",
    },
    pourSequence: [
      {
        label: "Bloom (0:00, → 60 g)",
        action: "pour",
        waterGramsAtEnd: 60,
        durationSec: 5,
        notes: "3× dose bloom.",
      },
      {
        label: "Aggressive Rao spin",
        action: "swirl",
        durationSec: 5,
        notes:
          "Rao's signature — a vigorous vortex swirl during the bloom that saturates evenly without stirring.",
      },
      { label: "Bloom rest", action: "wait", durationSec: 30 },
      {
        label: "Pour 1 (0:40, → 200 g)",
        action: "pour",
        waterGramsAtEnd: 200,
        durationSec: 30,
      },
      {
        label: "Gentle Rao spin",
        action: "swirl",
        durationSec: 5,
        notes:
          "Rao explicitly uses gentle spins on subsequent pours — only the bloom spin is aggressive.",
      },
      {
        label: "Wait to ~70% drawdown",
        action: "wait",
        durationSec: 60,
      },
      {
        label: "Pour 2 (→ 340 g)",
        action: "pour",
        waterGramsAtEnd: 340,
        durationSec: 25,
      },
      {
        label: "Final gentle Rao spin",
        action: "swirl",
        durationSec: 5,
        notes: "Flatten the bed; encourage an even drawdown.",
      },
      { label: "Drawdown (lift by 4:00–4:30)", action: "drain", durationSec: 95 },
    ],
    totalTimeSec: 260,
    techniques: ["rao-spin", "two-pour-v60"],
    bestFor: {
      roastLevels: ["light", "medium-light", "medium"],
      processes: ["washed", "natural", "honey"],
      goals: ["balanced"],
    },
    teaches:
      "Two-pour V60 with the Rao spin: aggressive vortex swirl on the bloom, gentle spins after. Rao opposes three-pour V60 publicly — fewer, larger pours give predictable, repeatable extraction.",
    science:
      "Rao's published reasoning: he is 'wary of breaking up the pour into more than two parts.' Two pours produce a more uniform total extraction time per ground-water contact unit than three-pour patterns. The Rao spin's vortex motion drags water down through the puck centre-first rather than wall-first, counteracting the V60's tendency to channel along the filter walls. The aggressive bloom spin ensures full saturation; gentle subsequent spins keep the bed intact without re-agitating settled fines.",
    whenToUse:
      "Default V60 daily-driver when you want consistency you can troubleshoot from. Pair with a known coffee to isolate technique drift; pair with an unknown coffee for a baseline read.",
    sources: [
      {
        type: "blog",
        citation: "Scott Rao — \"V60 Video\" (scottrao.com, 2017)",
        url: "https://www.scottrao.com/blog/2017/9/14/v60-video",
        year: 2017,
      },
      {
        type: "blog",
        citation: "Scott Rao — \"Why Spin the Slurry\" (scottrao.com, 2019)",
        url: "https://www.scottrao.com/blog/2019/1/8/why-spin-the-slurry",
        year: 2019,
      },
      {
        type: "article",
        citation:
          "Hario UK — V60 Recipe Interview with Hario Ambassador Scott Rao",
        url: "https://www.hario.co.uk/blogs/hario-ambassadors/hario-v60-recipe-interview-with-hario-ambassador-scott-rao",
      },
      {
        type: "book",
        citation:
          "Rao, S. — *The Professional Barista's Handbook* (multiple editions)",
      },
    ],
    verified: false,
    notes:
      "Renamed and demoted to verified:false during the 2026-05 knowledge-layer audit. Previous codebase parameters disagreed with Rao's published V60 recipe on every headline axis: dose 22 g (actual 20 g), water 352 g (actual 340 g), ratio 1:16 (actual 1:17), total time 3:25 (actual 4:00–4:30), pour count 3 (actual 2). The 'Rule of Thirds' name was an external coining — Rao publicly opposes three-pour V60 patterns and writes that he is 'wary of breaking up the pour into more than two parts.' The Rao spin IS genuinely his technique but is deployed differently than the previous entry showed (aggressive on bloom only, gentle on subsequent pours). Niche degree range removed (derived). Re-verify after watching the V60 video referenced from scottrao.com end-to-end.",
  },

  // ── Daiki Hatakeyama ─────────────────────────────────────────────────────

  {
    id: "hatakeyama-cafec-flower",
    name: "Cafec Flower Dripper Standard (Hatakeyama-popularised roast-tailored paper principle)",
    shortName: "Cafec Flower",
    attribution: {
      person:
        "Cafec / Sanyo Sangyo (recipe); Daiki Hatakeyama popularised the roast-tailored paper principle",
      title:
        "Hatakeyama: 2× Japan Brewers Cup Champion, 2nd at WBrC 2021, Cafec Ambassador",
      country: "Japan",
    },
    category: "reference",
    brewer: "cafec-flower",
    brewerNotes:
      "Cafec Flower Dripper (six tall ribs, cup-shaped) with roast-tailored Cafec paper (Light Roast / Medium Roast / Dark Roast / Abaca variants). The roast-tailored paper principle is Hatakeyama's contribution; the specific numbers below are Cafec's standardised brewing guide recipe, NOT Hatakeyama's WBrC competition routine.",
    dose: { grams: 15 },
    water: { grams: 240, ratio: "1:16" },
    temperature: {
      celsius: 92,
      rangeC: [88, 95],
    },
    grind: {
      referenceSetting: "medium",
    },
    pourSequence: [
      {
        label: "Bloom (→ 30 g)",
        action: "pour",
        waterGramsAtEnd: 30,
        durationSec: 5,
      },
      { label: "Bloom rest", action: "wait", durationSec: 35 },
      {
        label: "Pour 1 (→ 125 g)",
        action: "pour",
        waterGramsAtEnd: 125,
        durationSec: 30,
      },
      { label: "Wait", action: "wait", durationSec: 15 },
      {
        label: "Pour 2 (→ 240 g)",
        action: "pour",
        waterGramsAtEnd: 240,
        durationSec: 35,
      },
      { label: "Drawdown (lift by ~2:40)", action: "drain", durationSec: 40 },
    ],
    totalTimeSec: 160,
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
      "How filter paper choice and water temperature should change with roast level — a dimension most pour-over recipes ignore. Light roast → high temp (95 °C) + thinner Light Roast Cafec paper. Dark roast → lower temp (88 °C) + thicker Dark Roast Cafec paper.",
    science:
      "Lighter roasts have lower solubility and need more aggressive extraction (high temperature, more contact). Darker roasts have higher solubility and over-extract easily (lower temperature, less contact). The Flower Dripper's six tall ribs create air channels along the entire filter height — drawdown is fast regardless of paper. So paper thickness becomes the timing variable: a thicker Dark Roast paper slows flow precisely where the darker coffee needs less contact. The principle is Hatakeyama's published contribution; Cafec systematised it into the four-paper product line.",
    whenToUse:
      "When you want a single dripper that handles a range of roast levels well, and you're willing to keep multiple papers on hand. The principles (match paper to roast, match temperature to roast) transfer to any dripper if you have papers of varying thickness.",
    sources: [
      {
        type: "interview",
        citation: "Cafec Official — Hatakeyama interview",
        url: "https://cafec-jp.com/interview/",
      },
      {
        type: "interview",
        citation: "Cafec — Hatakeyama distributor page",
        url: "https://cafec-jp.com/distributor/hatakeyama.html",
      },
      {
        type: "video",
        citation:
          "Daiki Hatakeyama, Japan — 2021 World Brewers Cup: Round One (YouTube)",
        url: "https://www.youtube.com/watch?v=jl2igAtIeJw",
      },
      {
        type: "article",
        citation: "Project Barista — Cafec Flower Dripper recipe",
        url: "https://projectbarista.com/what-is-pour-over-coffee/cafec-flower-dripper-recipe/",
      },
    ],
    verified: false,
    notes:
      "Renamed during the 2026-05 knowledge-layer audit. The previous entry attributed specific dose/water/pour milestones to Hatakeyama personally, but those numbers don't trace to a Hatakeyama publication — they're the Cafec brand's standardised brewing guide. Hatakeyama's actual 2021 WBrC routine used two different temperatures and is described as 'difficult to replicate' (Project Barista). The current numbers reflect the Cafec standard recipe (15 g : 240 g, 92 °C, ~2:40); the roast-tailored paper principle remains correctly attributed to Hatakeyama. Niche degree range removed (derived). Re-promote to verified:true after the 2021 WBrC Round One video is reviewed end-to-end and the actual Hatakeyama routine is captured.",
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
    dose: { grams: 15 },
    water: { grams: 250, ratio: "1:16.7" },
    temperature: { celsius: 96 },
    grind: {
      referenceSetting:
        "medium, then sieved to remove fines (Wallgren famously used a cake mould + frying pan cover)",
      description:
        "Pre-sieving removes the fines fraction — the cup is markedly cleaner. Niche degree omitted because Wallgren doesn't publish one.",
    },
    pourSequence: [
      {
        label: "Sieve grounds (pre-brew)",
        action: "agitate-bed",
        durationSec: 0,
        notes:
          "Discard fines fraction before brewing. Wallgren's signature move.",
      },
      {
        label: "Bloom (→ 60 g)",
        action: "pour",
        waterGramsAtEnd: 60,
        durationSec: 10,
      },
      {
        label: "Swirl (no stir)",
        action: "swirl",
        durationSec: 5,
        notes:
          "Kalita Wave: never stir. The flat bed channels if disturbed.",
      },
      { label: "Bloom rest", action: "wait", durationSec: 15 },
      {
        label: "Pour 1 (→ 125 g)",
        action: "pour",
        waterGramsAtEnd: 125,
        durationSec: 15,
      },
      { label: "Wait", action: "wait", durationSec: 15 },
      {
        label: "Pour 2 (→ 190 g)",
        action: "pour",
        waterGramsAtEnd: 190,
        durationSec: 15,
      },
      { label: "Wait", action: "wait", durationSec: 15 },
      {
        label: "Pour 3 (→ 250 g, finished by 1:45)",
        action: "pour",
        waterGramsAtEnd: 250,
        durationSec: 15,
      },
      { label: "Drawdown (lift at ~2:35)", action: "drain", durationSec: 50 },
    ],
    totalTimeSec: 155,
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
        citation: "2016 World Brewers Cup Final, Dublin — runner-up routine",
        year: 2016,
      },
      {
        type: "article",
        citation:
          "Barista Magazine — Brewing Experiments: Mikaela Wallgren's 2016 World Brewers Cup Championship Recipe",
        url: "https://www.baristamagazine.com/brewing-experiments-mikaela-wallgrens-2016-world-brewers-cup-championship-recipe/",
      },
      {
        type: "article",
        citation: "Fresh Cup — Wallgren WBrC 2016 profile",
        url: "https://www.freshcup.com/world-brewers-cup-mikaela-wallgren-copenhagen/",
      },
      {
        type: "video",
        citation:
          "2016 World Brewers Cup Final, runner-up routine (YouTube)",
        url: "https://www.youtube.com/watch?v=k__bfjcAsVQ",
      },
    ],
    verified: false,
    notes:
      "Codebase previously had 22 g : 330 g (1:15), 94 °C, 3:35 total — those numbers don't trace to any Wallgren publication and appear to have been scaled up assuming a 1:15 default. Audit-corrected parameters per Barista Magazine and the YouTube runner-up routine: 15 g : 250 g (1:16.7), 96 °C (reverse-osmosis water from Copenhagen), 2:35 total brew with the pour finished by 1:45. Pour milestones between bloom and 1:45 are reconstructed from search excerpts that quote the Barista Magazine piece; keep verified:false until the WBrC 2016 final video is reviewed frame-by-frame. Wallgren's sieve famously was a homemade cake mould + frying pan cover.",
  },

  // ── Turbo V60 (popularised by Lance Hedrick) ─────────────────────────────

  {
    id: "turbo-v60-hedrick",
    name: "Turbo V60 (community-derived, Hedrick-popularised)",
    shortName: "Turbo V60",
    attribution: {
      person: "Lance Hedrick (popularised); technique developed in the broader championship community",
      title: "Coffee educator, YouTube",
      country: "United States",
    },
    category: "reference",
    brewer: "v60",
    dose: { grams: 15 },
    water: { grams: 250, ratio: "1:16.7" },
    temperature: { celsius: 100, rangeC: [95, 100] },
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
        citation: "Lance Hedrick — Turbo V60 videos on his YouTube channel (no single canonical URL identified — multiple videos cover the technique)",
        url: "https://www.youtube.com/@LanceHedrick",
      },
      {
        type: "video",
        citation:
          "Lance Hedrick — \"Pourover Lesson for Advanced Brewers\" (2024; Hedrick explicitly retracts his older 'brew off boiling for light roasts' stance and now teaches ≤95 °C on V60)",
        url: "https://www.youtube.com/watch?v=2mrLiE4ilXw",
        year: 2024,
      },
    ],
    verified: true,
    notes:
      "The 100 °C / coarse / fast / ~2:00 mechanic is canonical Turbo-brewing doctrine, popularised by Hedrick but not exclusively his. Hedrick's CURRENT V60 teaching (2024 framework, see `hedrick-v60-framework`) caps at 95 °C — the 100 °C entry here represents the Turbo doctrine's original framing, not Hedrick's current personal default. If you want Hedrick's current daily-driver V60, use `hedrick-v60-framework` instead. Niche degree range is user-empirical, not from Hedrick.",
  },

  {
    id: "hedrick-v60-framework",
    name: "Hedrick V60 — Lazy 80% Framework",
    shortName: "Hedrick framework",
    attribution: {
      person: "Lance Hedrick",
      country: "United States",
      year: 2024,
    },
    category: "reference",
    brewer: "v60",
    brewerNotes:
      "Hario V60 (any size). Hedrick himself describes his approach as a framework — a baseline to tune rather than a fixed recipe. Coffee-dependent variables (bloom time, pour type) are expected to be adjusted on the fly.",
    dose: { grams: 18 },
    water: { grams: 306, ratio: "1:17" },
    temperature: { celsius: 95, rangeC: [85, 95] },
    grind: {
      referenceGrinder: "Various",
      referenceSetting:
        "coarse — 'River Rocks, bigger than table sugar' per Hedrick",
    },
    pourSequence: [
      {
        label: "Bloom (3× dose, ~54 g)",
        action: "pour",
        waterGramsAtEnd: 54,
        durationSec: 10,
        notes:
          "Slow controlled pour — saturate the bed without water passing through. ~3× dose by weight.",
      },
      {
        label: "Bloom rest",
        action: "wait",
        durationSec: 35,
        notes:
          "Hedrick varies bloom 30 s – 2 min depending on coffee gas content, freshness, and roast. 45 s is a reasonable default. If grounds float 'high and dry' at the end, extend by 30 s.",
      },
      {
        label: "Main pour (laminar or turbulent, → 306 g)",
        action: "pour",
        waterGramsAtEnd: 306,
        durationSec: 60,
        notes:
          "One continuous pour at ~5 g/s in a small centre circle. Turbulent (stream just below break-up point) for maximum bed agitation; switch to laminar if drawdown is dragging.",
      },
      {
        label: "Slight shake",
        action: "swirl",
        durationSec: 5,
        notes: "Brief shake to flatten the bed. Skip for decaf.",
      },
      { label: "Drawdown", action: "drain", durationSec: 70 },
    ],
    totalTimeSec: 180,
    techniques: [
      "bloom-time-tuning",
      "laminar-vs-turbulent-pour",
      "minimal-agitation",
    ],
    bestFor: {
      roastLevels: ["light", "medium-light", "medium"],
      processes: ["washed", "natural", "honey", "any"],
      goals: ["balanced", "explore"],
    },
    teaches:
      "Framework over fixed recipe. Hedrick's central thesis: find a baseline you can brew reliably, then tune in big steps — water → grind → ratio → temperature (3–6 °C, not 1–2) → bloom time → grinder. Micro-adjustments are below perception threshold. Aim for 80% of a coffee's potential fast, then iterate.",
    science:
      "CO2 inhibits extraction by getting trapped in interstitial water and creating upward channels through the bed. Bloom time is coffee-dependent — gas content varies with freshness, roast, and density. Fewer, more controlled pours reduce fines migration through the filter paper, preserving cup clarity. Pour-type physics: a turbulent stream just below the break-up point creates maximum bed agitation; an above-break-up droplet stream dissipates energy before hitting the bed and produces minimal agitation.",
    whenToUse:
      "Daily-driver V60 framework. Entry-point recipe when starting on a new coffee. Roast staircase per Hedrick: light/medium-light 95 °C max (he retracts his older 'brew off boiling' stance), medium 92, dark 85–88, decaf 89 max with shortened bloom (CO2 already released by decaffeination).",
    sources: [
      {
        type: "video",
        citation:
          "Lance Hedrick — \"Pourover Lesson for Advanced Brewers\" (YouTube)",
        url: "https://www.youtube.com/watch?v=2mrLiE4ilXw",
        year: 2024,
      },
    ],
    verified: true,
    notes:
      "Hedrick does not publish a Niche Zero degree — coarse grind is the only specification, calibrated by drawdown time and taste. For old coffee (low CO2) ratio shifts to 1:15. Hedrick explicitly rejects 'this pour controls sweetness, this pour controls acidity'-style claims as unsupported.",
  },
];
