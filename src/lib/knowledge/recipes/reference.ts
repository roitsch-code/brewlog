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
    temperature: { celsius: 100, rangeC: [90, 100] },
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
    techniques: ["swirl-not-stir", "pulse-pouring"],
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
      "Default single-cup V60. Roast-temperature staircase as Hoffmann states it IN THIS video: light = freshly boiled (100 °C), medium = 96 °C, darkest roasts down to 90 °C. Plastic V60-02 preferred for thermal retention; preheat with very hot tap water, not boiling.",
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
      "Clever Dripper (full-immersion brewer with valve at the base), Melitta-style #4 paper (Filtropa or Melitta), rinsed — hot tap water is fine, no need to re-boil. Max practical ~400 ml (500 at a push). The Clever's lid gives no taste benefit (Hoffmann skips it). Water-first technique credited to Workshop Coffee (London), popularised by Hoffmann. Demo brew was 15 g : 250 g; Hoffmann's stated preference is ~60–65 g/L (down from 75), so 18 g : 300 g sits in the same band.",
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
    // Pour 15s + add/stir 5s + steep 120s + crust 5s + settle 30s + drawdown
    // 65s = 240s. Verified against Hoffmann's own Clever video (2-min steep,
    // 30s settle, ~1-min drawdown). Was 210s, which contradicted these steps.
    totalTimeSec: 240,
    techniques: ["water-first", "immersion-steep"],
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
      "Re-verified against Hoffmann's own Clever video (transcript, 2025): every parameter matches — water-first off the boil, add coffee + little stir, 2-min steep, break crust (stir or shake), ~30 s settle, ~1 min drawdown (45 s–1:15 by grinder) → ~3:30–4:00 total. Medium-fine ~2-cup V60 grind ('finer than most expect'). Dose/ratio 18 g : 300 g sits in his stated 60–65 g/L preference (down from 75 g/L); his on-camera demo used 15 g : 250 g at the same ratio band. Rinse can be hot tap water; max ~400 ml; lid gives no benefit.",
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
      { label: "Steep", action: "wait", durationSec: 110, notes: "Steep to the 2:00 mark (timer starts when the water goes in). No stir." },
      {
        label: "Gentle swirl",
        action: "swirl",
        durationSec: 5,
        notes:
          "At 2:00, hold both piston and base; a gentle swirl knocks the grounds down — not a vortex.",
      },
      { label: "Settle", action: "wait", durationSec: 25 },
      {
        label: "Press gently",
        action: "press",
        durationSec: 30,
        notes: "From ~2:30, press gently and evenly — comfortably, not leaning in. ~30 s for this grind; finish ~3:00.",
      },
    ],
    totalTimeSec: 180,
    techniques: ["swirl-not-stir"],
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
    brewerNotes: "Standard Technivorm Moccamaster (KBGV / KBG Select) — NOT a special edition. Hoffmann's 3.5-min / 97–98 °C measurement is from this regular machine in his 6-brewer comparison. Flow-rate switch (community/creator tip, Coffee House): use the HALF-pot setting (slower flow) for a small dose so the bed saturates properly, and the FULL-pot setting (faster flow) for a full ~1 L batch. A full 1 L pot runs ~5–6 min; the ~3:30 here is for the 750 g batch.",
    dose: { grams: 50 },
    water: { grams: 750, ratio: "1:15" },
    temperature: { celsius: 96, rangeC: [92, 98] },
    grind: {
      referenceSetting: "medium-coarse",
      nicheZeroDegrees: [410, 420],
    },
    pourSequence: [
      {
        label: "Fill tank (750 g water), add 50 g coffee leveled",
        action: "pour",
        waterGramsAtEnd: 750,
        durationSec: 20,
        notes: "Fill the reservoir; level the bed in the flat-bottom basket, then switch on.",
      },
      {
        label: "Machine brews",
        action: "wait",
        durationSec: 190,
        notes:
          "The Moccamaster brews ~750 g in about 3:30 at 92–98 °C; the showerhead flow self-agitates enough for a high, even extraction. Hoffmann's optional hack: once the first water hits, let it bloom briefly and give ONE stir, plus a tiny stir near the end — not required, the machine is built to not need it.",
      },
    ],
    totalTimeSec: 210,
    techniques: ["machine-drip-brew"],
    bestFor: {
      roastLevels: ["medium-light", "medium"],
      processes: ["washed", "natural", "honey"],
      goals: ["balanced", "body-forward"],
      occasions: ["multiple cups", "guests", "morning batch"],
    },
    teaches:
      "How a well-designed batch brewer can produce filter-quality coffee at scale. The Moccamaster's pulsing showerhead approximates a multi-pour V60 without operator skill.",
    science:
      "The Moccamaster heats water in a tube, then releases it over the bed through a perforated showerhead with enough force to self-agitate the slurry — which is why Hoffmann measured it extracting HIGH in his 6-brewer comparison. It brews ~750 g in about 3:30 (Hoffmann's measured time) with exit water at 97–98 °C, sitting in his stated 'good brewing range' of 92–96 °C once up to temperature. The flat-bottomed paper filter sits in a Kalita-like basket: even bed, well-extracted cup. The 1:15 ratio and medium-coarse grind are conventional Moccamaster figures.",
    whenToUse:
      "When brewing for two or more people, or when you want filter coffee without the labour. Not for single-cup brewing — the showerhead doesn't saturate properly below ~500ml.",
    sources: [
      {
        type: "video",
        citation:
          "James Hoffmann — batch-brewer comparison (6 home filter machines): measured the Technivorm Moccamaster at ~3.5 min brew time for 750 g, exit water 97–98 °C, high extraction from showerhead self-agitation. Transcribed in-session.",
      },
      {
        type: "video",
        citation:
          "James Hoffmann — Moccamaster Jubilee 68 review: Technivorm temp range 'kind of 92 to 96 °C'; his optional technique = bloom + one stir at the start, a tiny stir at the end (explicitly not required). Transcribed in-session.",
      },
      {
        type: "video",
        citation:
          "Coffee House (Luke) — Moccamaster recipe tutorial (community/creator, NOT a named-expert canon source): half pot 33 g : 500 g (1:15), full pot 60 g : 1 L (1:16.7, ~5–6 min), grind coarser for the bigger pot, sift fines (~200 µm) for clarity, rinse the paper, stir the bloom, half/full flow-rate switch. Used only for the flow-switch + full-litre timing note above. Transcribed in-session.",
      },
    ],
    verified: true,
    notes:
      "Brew time CORRECTED June 2026 from 8:00 to ~3:30 (480 → 210 s). In Hoffmann's own 6-brewer comparison the Technivorm brews 750 g in 3.5 minutes with exit water at 97–98 °C; the prior 8-minute figure was unsourced and ~2× too long. Temperature range 92–98 °C set from his measurements (exit 97–98, 'good range' 92–96). Dose/ratio (50 g : 750 g, 1:15) and grind are standard Moccamaster figures — Hoffmann does not state a ratio in these two videos. The stir hack is his, but optional (the machine is designed to not need agitation).",
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
        label: "Pour hot water FIRST (~330 g, off the boil)",
        action: "pour",
        waterGramsAtEnd: 330,
        durationSec: 15,
        notes:
          "Water-first (the Clever benefits from it): pour 2/3 of the total water (~330 g of 500 g) as hot as you can into the preheated brewer, THEN add the coffee.",
      },
      { label: "Add coffee + stir to mix", action: "stir", durationSec: 5, notes: "Drop the coffee on, stir/distribute to wet all the grounds (a needle distributor helps but isn't essential)." },
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
    techniques: ["flash-chilling"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed", "natural", "honey"],
      goals: ["aromatic", "sweetness-forward"],
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

  {
    id: "hoffmann-iced-v60-pourover",
    name: "Hoffmann Japanese Iced V60 (pour-over)",
    shortName: "Hoffmann Iced V60",
    attribution: {
      person: "James Hoffmann",
      country: "United Kingdom",
    },
    category: "reference",
    brewer: "v60",
    brewerNotes:
      "V60 pour-over with the server holding ~200 g ice (40% of the total water). The hot brew drips straight onto the ice to flash-chill. 60% hot brew water / 40% ice by weight; finish onto fresh ice in the glass.",
    dose: { grams: 32.5 },
    water: { grams: 500, ratio: "1:15.4 (65 g/L total: ~300 g hot brew + ~200 g ice)" },
    temperature: { celsius: 99, rangeC: [96, 100] },
    grind: {
      referenceSetting:
        "slightly finer than a standard V60 — the smaller hot-brew-water volume needs help extracting",
    },
    pourSequence: [
      {
        label: "Bloom (→65 g) @ 0:00",
        action: "pour",
        waterGramsAtEnd: 65,
        durationSec: 10,
        notes: "2× dose, off the boil, onto the GROUNDS (the ~200 g ice is in the server below). Bloom at least 45 s.",
      },
      { label: "Bloom rest (≥45 s)", action: "wait", durationSec: 45 },
      { label: "Pour 2 (→150 g)", action: "pour", waterGramsAtEnd: 150, durationSec: 15 },
      { label: "Pour 3 (→225 g)", action: "pour", waterGramsAtEnd: 225, durationSec: 15 },
      { label: "Final pour (→300 g)", action: "pour", waterGramsAtEnd: 300, durationSec: 15 },
      {
        label: "Stir circular, then opposite",
        action: "stir",
        durationSec: 5,
        notes: "At the end: one circular stir one way, then once the opposite direction — then let it draw down.",
      },
      {
        label: "Drawdown onto ice — then swirl the decanter",
        action: "drain",
        durationSec: 60,
        notes: "Drains onto the ~200 g ice and flash-chills. Swirl the decanter to melt any leftover ice, then pour onto fresh ice in the glass.",
      },
    ],
    totalTimeSec: 165,
    techniques: ["flash-chilling", "pulse-pouring"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed", "natural", "honey"],
      goals: ["high-clarity", "aromatic", "sweetness-forward"],
      occasions: ["summer-time", "iced"],
    },
    teaches:
      "Japanese-style iced: brew HOT over ice so the cup keeps the origin character (florals, fruit, acidity) that cold brew flattens. 65 g/L with 40% of the water as ice, a slightly finer grind and a long-ish bloom recover the extraction the reduced hot-water volume gives up.",
    science:
      "Cold brew loses origin character — it reads chocolatey and low-acid. Brewing HOT extracts the volatile aromatics and acids; the brewed coffee then drips straight onto ice and flash-chills, locking those aromatics in before they volatilise. Because only ~60% of the total water is hot brew water, Hoffmann doses ~5 g/L heavier than usual and grinds a touch finer + blooms longer (≥45 s) to keep extraction up; the closing two-direction stir levels the bed for an even finish. Rule of thumb: use as much brew water (and as little ice) as you can while still chilling it — more brew water means a better extraction.",
    whenToUse:
      "A hot day and a light, fruity, juicy coffee (washed Kenyan / Ethiopian shine). When you want the cup to taste like the coffee you paid for, not generic cold-brew chocolate.",
    sources: [
      {
        type: "transcript",
        citation:
          "James Hoffmann — pour-over 'Japanese-style' iced filter coffee (owner-supplied transcript). 65 g/L, 40% ice / 60% hot, grind a touch finer, bloom 2–3× for ≥45 s, brew 2:30–3:00 onto ice, finish with a circular stir then the opposite direction, swirl the decanter, pour onto fresh ice.",
      },
    ],
    verified: true,
    notes:
      "New entry (June 2026) from Hoffmann's pour-over Japanese-style iced video (owner-supplied transcript) — the PERCOLATION iced, distinct from his immersion (Clever) iced. Temperature: he says only 'off the boil' in this video (no number published), so the 99 °C is his standard off-the-boil, not a fabricated figure. Bloom 65 g = 2× dose (he says 2–3×). ~200 g ice sits in the server; the brew drips onto it to flash-chill. One constant brewing temperature (the ice dilutes/chills; it is not staging).",
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
    temperature: { celsius: 93, rangeC: [83, 93] },
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
    techniques: ["phase-separated-pouring"],
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

  // ── Kasuya Super Coarse 10-Pour (2026) ────────────────────────────────────

  {
    id: "kasuya-super-coarse-10-pour",
    name: "Kasuya Super Coarse 10-Pour",
    shortName: "Kasuya Super Coarse",
    attribution: {
      person: "Tetsu Kasuya",
      title: "2016 World Brewers Cup Champion",
      affiliation: "Philocoffea, Chiba",
      country: "Japan",
      year: 2026,
    },
    category: "reference",
    brewer: "v60",
    brewerNotes:
      "Hario V60 or the Hario 'Neo' dripper, size 02 — Kasuya designed it with the Neo in mind (water tracks the ribs, distributing the small 30 g pours evenly) but stresses you absolutely don't need one and personally brews it on a V60. Flat-bottom brewers were untested as of the 2026 video. His 2026 routine to 'maximize the charm of light roast through full extraction': a very coarse grind, high water temperature, and ten even 30 g pours.",
    dose: { grams: 20 },
    water: { grams: 300, ratio: "1:15" },
    temperature: { celsius: 96, rangeC: [95, 96] },
    grind: {
      referenceGrinder: "Comandante C40",
      referenceSetting: "40–45 clicks (super coarse)",
      nicheZeroDegrees: [435, 455],
      description:
        "Super coarse — Comandante C40 at 40–45 clicks. In the 2026 video Kasuya calls 40 clicks the dependable default ('pretty hard to fail') and 45 'extreme' — it can come out thin/pale depending on the coffee (his own 45-click demo looked a little light). If the cup is too weak, go a notch finer (fewer clicks) or gently agitate the server during the brew. The Niche degree range here is DERIVED from the project's click→degree conversion (grind-settings.md, ~3.3°/click) and extrapolated well beyond the measured 23–29-click anchors, so calibrate it empirically against the ~3:30 finish rather than trusting the number.",
    },
    pourSequence: [
      {
        label: "Pour 1 (bloom) @ 0:00",
        action: "pour",
        waterGramsAtEnd: 30,
        durationSec: 5,
        notes: "30 g — doubles as the bloom.",
      },
      { label: "Bloom rest → 0:30", action: "wait", durationSec: 25 },
      {
        label: "Pour 2 (→60 g) @ 0:30",
        action: "pour",
        waterGramsAtEnd: 60,
        durationSec: 5,
        notes: "From here, add 30 g every 15 s — wait ~10 s between each pour.",
      },
      { label: "Wait → 0:45", action: "wait", durationSec: 10 },
      {
        label: "Pour 3 (→90 g) @ 0:45",
        action: "pour",
        waterGramsAtEnd: 90,
        durationSec: 5,
      },
      { label: "Wait → 1:00", action: "wait", durationSec: 10 },
      {
        label: "Pour 4 (→120 g) @ 1:00",
        action: "pour",
        waterGramsAtEnd: 120,
        durationSec: 5,
        notes: "Keep the water moving — don't let it pool in the dripper; let each pour flow straight through.",
      },
      { label: "Wait → 1:15", action: "wait", durationSec: 10 },
      {
        label: "Pour 5 (→150 g) @ 1:15",
        action: "pour",
        waterGramsAtEnd: 150,
        durationSec: 5,
      },
      { label: "Wait → 1:30", action: "wait", durationSec: 10 },
      {
        label: "Pour 6 (→180 g) @ 1:30",
        action: "pour",
        waterGramsAtEnd: 180,
        durationSec: 5,
      },
      { label: "Wait → 1:45", action: "wait", durationSec: 10 },
      {
        label: "Pour 7 (→210 g) @ 1:45",
        action: "pour",
        waterGramsAtEnd: 210,
        durationSec: 5,
      },
      { label: "Wait → 2:00", action: "wait", durationSec: 10 },
      {
        label: "Pour 8 (→240 g) @ 2:00",
        action: "pour",
        waterGramsAtEnd: 240,
        durationSec: 5,
      },
      { label: "Wait → 2:15", action: "wait", durationSec: 10 },
      {
        label: "Pour 9 (→270 g) @ 2:15",
        action: "pour",
        waterGramsAtEnd: 270,
        durationSec: 5,
        notes: "Around here the bed clogs a little and flow slows — surprising at this coarse a grind, but expected as fines settle.",
      },
      { label: "Wait → 2:30", action: "wait", durationSec: 10 },
      {
        label: "Pour 10 (→300 g, finish) @ 2:30",
        action: "pour",
        waterGramsAtEnd: 300,
        durationSec: 5,
        notes: "Final pour — completes the 300 g.",
      },
      { label: "Drawdown → ~3:30", action: "drain", durationSec: 55 },
    ],
    totalTimeSec: 210,
    techniques: ["bloom", "pulse-pouring"],
    bestFor: {
      roastLevels: ["very-light", "light", "medium-light"],
      processes: ["washed", "natural", "honey"],
      goals: ["sweetness-forward", "body-forward", "balanced"],
    },
    teaches:
      "How to reach full extraction on a light roast without bitterness by grinding very coarse and compensating with many even pours and near-boiling water. The coarse grind removes the fines that would over-extract; the ten 30 g pulses and 95–96 °C restore the yield the coarse grind gives up.",
    science:
      "A super-coarse grind (Comandante 40–45 clicks) shrinks the fines fraction — the particles that over-extract first and carry most of the harsh, astringent compounds — which lowers the extraction ceiling. At a 1:15 ratio a grind this coarse would normally land under 1% TDS; Kasuya pushes the yield back up to ~1.3% two ways: near-boiling water (95–96 °C raises the extraction rate across all compound classes) and TEN discrete 30 g pours. His central claim is that the NUMBER of percolation cycles is what builds mouthfeel — each pour passes water through the bed again, dissolving more body- and texture-forming compounds, so ten pours yield a thick, almost syrupy body you can't get from a 2–3 pour brew (he notes 7–8 pours already help noticeably). Early pours drain straight through; the bed clogs slightly near the end (~2:00–2:15). The deliberate trade-off: the dominant sweetness tones the acidity down, so this is not the method for an acidity-forward cup.",
    whenToUse:
      "A light, delicate, expensive coffee where you want maximum sweetness and a thick, syrupy body while keeping the cup clean — and you have a grinder that holds a tight particle distribution at a very coarse setting. Skip it if you specifically want to showcase bright acidity, which this method deliberately softens. Kasuya rates it especially for light roasts (the high 95–96 °C is not ideal for dark).",
    sources: [
      {
        type: "video",
        citation:
          "Tetsu Kasuya (Philocoffea) — 2026 YouTube video, his 10th-anniversary 'Multi-Pour Recipe' (also floated as 'Neo Brew' / 'Click 45'). Parameters transcribed directly from the video demonstration.",
        year: 2026,
      },
    ],
    verified: true,
    notes:
      "Transcribed directly from Kasuya's 2026 YouTube video (Philocoffea's internal name: the 'Multi-Pour Recipe'). Headline parameters (20 g : 300 g = 1:15, 95–96 °C, super-coarse Comandante 40–45 clicks with 40 the dependable default, ten 30 g pours, bloom 30 s then a pour every 15 s, finishing ~3:30, reaching ~1.3% TDS) are as Kasuya states them in the demonstration. He recommends 20 g specifically because the alternative 15 g : 225 g makes awkward 22.5 g pours that are hard to count; 7–8 pours also work if ten is too many. Positioned as an evolution of the 4:6 method — the over-extended late-pour segmentation he dismissed in 2016. The only non-published value is the Niche Zero degree range, derived from the project's click→degree conversion and extrapolated beyond its measured anchors — calibrate empirically. One constant temperature (no staging).",
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
    techniques: ["high-agitation-high-extraction", "pulse-pouring"],
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
      "A reliable daily V60 for washed, honey, or natural light-to-medium coffees. Because it is agitation-forward, it is NOT the right pick for the most delicate, clarity-first coffees (Geisha, Pink Bourbon) where heavy agitation muddies the cup — use a gentle, minimal-agitation or fines-sieved clarity recipe there instead.",
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
    dose: { grams: 18 },
    water: { grams: 260, ratio: "1:14.4" },
    temperature: { celsius: 100, rangeC: [99, 100] },
    grind: {
      referenceSetting:
        "fine — fine enough for high extraction, but not so fine the press is hard (a hard press is what brings astringency)",
    },
    pourSequence: [
      {
        label: "Add 18 g, pour 100 °C water to fill (~260 g)",
        action: "pour",
        waterGramsAtEnd: 260,
        durationSec: 15,
        notes: "Fill the chamber off the boil; start the timer.",
      },
      {
        label: "Stir back-and-forth",
        action: "stir",
        durationSec: 10,
        notes: "Bottom-to-top, NOT circular (Gagné is explicit — avoid a vortex). Then rest the plunger slightly in the chamber to pull a partial vacuum.",
      },
      { label: "Steep to 5:00", action: "wait", durationSec: 275 },
      {
        label: "Vigorous swirl",
        action: "swirl",
        durationSec: 5,
        notes: "At the 5-minute mark, swirl to level the bed.",
      },
      { label: "Steep to 9:00", action: "wait", durationSec: 235 },
      {
        label: "Gentle press",
        action: "press",
        durationSec: 60,
        notes: "From ~9:00, press as gently as you can — a bit over a minute to the bottom. Gentleness is what keeps it clean.",
      },
    ],
    totalTimeSec: 600,
    techniques: ["immersion-steep"],
    bestFor: {
      roastLevels: ["light", "medium-light", "medium"],
      processes: ["washed", "natural", "honey"],
      goals: ["body-forward", "sweetness-forward"],
    },
    teaches:
      "How a long (~10-minute) HOT steep with a no-drip valve (Prismo) and a very gentle press reaches high extraction (~23.5%) on a fine grind without astringency — contact time and gentleness do the work, not a low temperature.",
    science:
      "Gagné fills with 100 °C water and steeps ~10 minutes; the Prismo valve means that whole time is pure steep, not drip. A back-and-forth (non-circular) stir plus one mid-steep swirl keep the bed even. Because the final press is very gentle and the grind isn't pushed espresso-fine, the long hot steep climbs to ~23.5 % extraction — full, sweet, dense — without dragging in the harsh, astringent compounds a hard press or over-fine grind would. (The earlier codebase entry attributed an 80 °C 'second sweet spot' LOW-temperature steep to Gagné — that was an error; his published AeroPress recipe is HOT. Corrected against his own blog, coffeeadastra.com 2021.)",
    whenToUse:
      "When you want a full, sweet, very clean AeroPress cup and own a Prismo (a standard AeroPress drips through the paper and ruins the long-steep timing). Patience required — it's a ~10-minute brew.",
    sources: [
      {
        type: "blog",
        citation:
          "Jonathan Gagné — 'Reaching Fuller Flavor Profiles with the AeroPress', coffeeadastra.com (2021-09-07). Verified in-session.",
        url: "https://coffeeadastra.com/2021/09/07/reaching-fuller-flavor-profiles-with-the-aeropress/",
        year: 2021,
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
        label: "Vigorous stir ('stir like a bandit')",
        action: "stir",
        durationSec: 10,
        notes:
          "Perger's signature — a vigorous bloom stir for full saturation, driving extraction yield up.",
      },
      { label: "Bloom rest → 0:30", action: "wait", durationSec: 10 },
      {
        label: "Pour 2 (→100 g) @ 0:30 — outward spiral",
        action: "pour",
        waterGramsAtEnd: 100,
        durationSec: 10,
        notes: "Outward spiral pour; finish around the edges to wash grounds back down.",
      },
      { label: "Wait → 1:00", action: "wait", durationSec: 20 },
      {
        label: "Pour 3 (→200 g) @ 1:00 — outward spiral",
        action: "pour",
        waterGramsAtEnd: 200,
        durationSec: 15,
        notes: "Outward spiral — the spiral pour itself creates the Rao-spin vortex, so no separate spin is needed. Finish around the edges.",
      },
      {
        label: "Tap to level the bed",
        action: "agitate-bed",
        durationSec: 3,
        notes: "AFTER the final pour, tap the dripper so the bed sits flat — even bed, even extraction. Water should disappear across the whole bed at once.",
      },
      { label: "Drawdown", action: "drain", durationSec: 62 },
    ],
    totalTimeSec: 140,
    techniques: ["high-agitation-high-extraction", "spiral-pour", "rao-spin"],
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
      "12 g : 200 g, 97 °C, 2:20, confirmed against a demonstration of the recipe (measured 1.40% TDS / 20.8% extraction): bloom 50 g + a vigorous 'stir like a bandit', then OUTWARD-SPIRAL pours to 100 g @ 0:30 and 200 g @ 1:00 — the spiral pour itself supplies the Rao-spin (there is no separate spin step). TAP the dripper to level the bed AFTER the final pour, not after the bloom. Finish each pour around the edges to wash grounds down; aim for the water disappearing across the whole bed simultaneously. Kept verified:false: the source is a recipe demonstration, not Perger's own verbatim publication. (Prior 22 g : 352 g / 95 °C / 3:35 was a misattribution — removed.)",
  },

  // ── George Stanica (alternative inverted recipe; NOT his WAC winner) ──────

  {
    id: "stanica-inverted-melodrip",
    name: "Stanica — Inverted AeroPress + Melodrip + Bypass",
    shortName: "Stanica Inverted",
    attribution: {
      person: "George Stanica",
      title: "2024 World AeroPress Champion",
      country: "Romania",
    },
    category: "reference",
    brewer: "aeropress",
    brewerNotes:
      "INVERTED AeroPress, plunger at the 4th mark, standard paper filter (rinsed). Pours go through a Melodrip. A SEPARATE Stanica recipe — NOT the one he won the WAC with (that's the upright Flow Control recipe). Brew water 88–93 °C; dilution = warm kettle water + room-temp water.",
    dose: { grams: 18 },
    water: { grams: 100, ratio: "1:5.5 (extraction) + bypass → ~150–165 g cup" },
    temperature: { celsius: 90, rangeC: [88, 93] },
    grind: {
      referenceGrinder: "Comandante C40",
      referenceSetting: "medium / medium-coarse (~800 µm, ~26 clicks)",
      nicheZeroDegrees: [388, 396],
      description:
        "Medium/medium-coarse, ~800 µm (~26 Comandante clicks). Niche derived from the clicks (~26 ≈ 392°); calibrate empirically.",
    },
    pourSequence: [
      {
        label: "Invert (plunger 4th mark), 18 g coffee",
        action: "invert",
        durationSec: 0,
        notes: "Inverted, plunger set at the 4th mark; add 18 g coffee.",
      },
      {
        label: "First pour 50 g via Melodrip",
        action: "melodrip",
        waterGramsAtEnd: 50,
        durationSec: 6,
        notes: "Pour 50 g of 88–93 °C water through a Melodrip (~5–6 s).",
      },
      { label: "Bloom → 0:30", action: "wait", durationSec: 24 },
      {
        label: "Second pour 50 g via Melodrip (→100 g)",
        action: "melodrip",
        waterGramsAtEnd: 100,
        durationSec: 6,
      },
      {
        label: "NSEW stir 10 s",
        action: "stir",
        durationSec: 10,
        notes: "Light paddle stir North-South-East-West. Rinse the cap filter and crack the kettle lid to cool the dilution water.",
      },
      { label: "Wait → 1:20", action: "wait", durationSec: 34 },
      {
        label: "Press out air (inverted, ~10 s)",
        action: "press",
        durationSec: 10,
        notes: "At 1:20, cap on, gently press while inverted just to push the air out.",
      },
      {
        label: "Swirl, then flip onto the server",
        action: "flip",
        durationSec: 3,
        notes: "Gently swirl inverted, then flip onto your server.",
      },
      { label: "Wait → 1:35", action: "wait", durationSec: 2 },
      {
        label: "Press slowly 30–40 s → ~80 g concentrate",
        action: "press",
        durationSec: 35,
        notes: "From 1:35, press slowly until you have ~80 g of concentrate.",
      },
      {
        label: "Dilute → ~150–165 g cup",
        action: "bypass",
        waterGramsAtEnd: 160,
        durationSec: 5,
        notes: "Add warm kettle water to bring the ~80 g concentrate to 130–135 g, then add 20–30 g room-temp (25 °C) water.",
      },
    ],
    totalTimeSec: 135,
    techniques: ["aeropress-inversion", "concentrate-and-bypass"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed", "natural", "honey"],
      goals: ["high-clarity", "balanced", "explore"],
    },
    teaches:
      "An inverted concentrate-and-bypass routine: over-extract a tight ~1:5.5 concentrate with gentle Melodrip pours, press to ~80 g, then rebuild the cup with warm + room-temp bypass water. Extraction strength and drink strength become independent controls.",
    science:
      "Pulling a small 1:5.5 concentrate at 88–93 °C extracts deeply into Zone 2 (sugars, body) without the watery cup a 1:16 brew gives; the Melodrip breaks the pour into many fine streams so the small bed saturates with almost no turbulence. Pressing fully means the bypass water only sets concentration, not extraction — warm water to 130–135 g rebuilds body, and a final 20–30 g of room-temp water cools and lengthens it. The NSEW stir agitates the small bed evenly without a vortex.",
    whenToUse:
      "When you want filter-style clarity at the intensity of a concentrate, with full control over final strength — and you don't mind the inverted flip + a Melodrip.",
    sources: [
      {
        type: "report",
        citation:
          "George Stanica — inverted Melodrip AeroPress recipe with dilution (owner-supplied): inverted, plunger 4th mark, 18 g, ~800 µm; 100 g brew water at 88–93 °C via Melodrip (50 g + 30 s bloom + 50 g), NSEW stir 10 s, press out air at 1:20, flip, press to ~80 g concentrate at 1:35, dilute with warm water to 130–135 g + 20–30 g room-temp.",
      },
    ],
    verified: true,
    notes:
      "A SEPARATE Stanica recipe (owner-supplied), NOT the one he won the 2024 World AeroPress Championship with — that's the upright Flow Control recipe in `wac-2024-stanica`. Inverted + Melodrip; 100 g brew → ~80 g concentrate → ~150–165 g cup. One constant brewing temperature (88–93 °C); the warm/room-temp dilution water is bypass, not staging. Parameters owner-supplied; Niche derived from the Comandante clicks.",
  },

  // ── Scott Rao ────────────────────────────────────────────────────────────

  {
    id: "rao-rule-of-thirds",
    name: "Rao — V60 Spin Method",
    shortName: "Rao V60 (spin)",
    attribution: {
      person: "Scott Rao",
      title: "*The Professional Barista's Handbook* author",
      country: "United States",
    },
    category: "reference",
    brewer: "v60",
    dose: { grams: 20 },
    water: { grams: 330, ratio: "1:16.5" },
    temperature: { celsius: 97 },
    grind: {
      referenceSetting:
        "medium-fine — fine enough to reach 22–24.5% extraction; Rao does not recommend brewing a V60 with much less than 20–22 g",
    },
    pourSequence: [
      {
        label: "Bloom (→ 60 g)",
        action: "pour",
        waterGramsAtEnd: 60,
        durationSec: 8,
      },
      {
        label: "Aggressive Rao spin",
        action: "swirl",
        durationSec: 5,
        notes:
          "Spin the bloom AGGRESSIVELY — the vortex saturates the bed evenly without stirring fines to the walls.",
      },
      { label: "Bloom rest", action: "wait", durationSec: 47 },
      {
        label: "Pour to 200 g",
        action: "pour",
        waterGramsAtEnd: 200,
        durationSec: 20,
        notes: "Low, steady, near-vertical stream; move the kettle around the whole slurry.",
      },
      {
        label: "Gentle spin",
        action: "swirl",
        durationSec: 2,
        notes: "A very gentle spin (<1 s of motion) — just enough to fill in the ribbed channels.",
      },
      { label: "Wait until ~70% drained", action: "wait", durationSec: 58 },
      {
        label: "Pour to 330 g",
        action: "pour",
        waterGramsAtEnd: 330,
        durationSec: 15,
      },
      {
        label: "Gentle spin",
        action: "swirl",
        durationSec: 2,
        notes: "Another brief gentle spin to settle the bed.",
      },
      { label: "Drawdown", action: "drain", durationSec: 98 },
    ],
    totalTimeSec: 255,
    techniques: ["rao-spin", "pulse-pouring"],
    bestFor: {
      roastLevels: ["light", "medium-light", "medium"],
      processes: ["washed", "natural", "honey"],
      goals: ["balanced"],
    },
    teaches:
      "The Rao Spin: one AGGRESSIVE bloom spin to saturate evenly, then a brief GENTLE spin after each of the two main pours to refill the ribbed channels. Rao deliberately uses FEW pours — he argues against breaking a V60 into many parts because it drops the average extraction temperature.",
    science:
      "The bloom spin's vortex drags water down through the puck centre-first rather than wall-first, counteracting the V60's tendency to channel along the filter walls. Keeping to two main pours (not many pulses) holds a higher average extraction temperature, which Rao prefers for reaching 22–24.5% extraction. The post-pour gentle spins re-wet the ribs without dropping fresh fines, so the bed stays even and the run-to-run variance stays low.",
    whenToUse:
      "Default V60 daily-driver when you want consistency you can troubleshoot from, and you have the time for a ~4:00–4:30 brew. Not for someone who wants a fast, many-pulse routine — that's the opposite of Rao's approach.",
    sources: [
      {
        type: "article",
        citation:
          "Scott Rao — V60 recipe as published by Hario UK (he is their ambassador): 20 g : 330 g, 97 °C, aggressive bloom spin + two pours (to 200 g, to 330 g) each with a gentle spin, 4:00–4:30. Verified in-session.",
        url: "https://www.hario.co.uk/blogs/hario-ambassadors/hario-v60-recipe-interview-with-hario-ambassador-scott-rao",
      },
      {
        type: "blog",
        citation:
          "scottrao.com — Rao's stated position against breaking the pour into more than two parts (lowers average extraction temperature).",
        url: "https://www.scottrao.com",
      },
    ],
    verified: true,
    notes:
      "Corrected June 2026 against Rao's own published recipe (Hario UK ambassador page) + his blog. The prior entry called this 'Rule of Thirds' with three EQUAL pours (22 g : 352 g, 96 °C) — a misattribution: Rao explicitly opposes breaking a V60 into more than two parts and does not publish equal thirds. His actual recipe is 20 g : 330 g / 97 °C, an aggressive bloom spin then two pours (to 200 g, to 330 g) each followed by a gentle spin, finishing 4:00–4:30. Renamed from 'Rule of Thirds' accordingly; the generic 'rule-of-thirds' technique tag was removed from this recipe.",
  },

  // ── Daiki Hatakeyama ─────────────────────────────────────────────────────

  {
    id: "hatakeyama-cafec-flower",
    name: "Hatakeyama 2024 Japan Brewers Cup — Origami",
    shortName: "Hatakeyama 2024",
    attribution: {
      person: "Daiki Hatakeyama",
      title:
        "2× Japan Brewers Cup Champion, 2nd at WBrC 2021, Cafec Ambassador",
      country: "Japan",
    },
    category: "reference",
    brewer: "origami-air-m",
    brewerNotes:
      "Origami Air M (the owner's dripper) with Cafec Abaca paper. Hatakeyama brewed it on an Origami Air S; his recipe notes it 'should be' the Cafec Flower Dripper. Single 85 °C water — notably cool — and a coarse grind.",
    dose: { grams: 15 },
    water: { grams: 240, ratio: "1:16" },
    temperature: { celsius: 85 },
    grind: {
      referenceGrinder: "Comandante C40",
      referenceSetting: "coarse — Comandante 25–27 clicks",
      nicheZeroDegrees: [387, 397],
      description:
        "Coarse — he states ~900–1000 µm / Comandante 25–27 clicks. Niche derived from the published Comandante clicks via the owner's map (~26 clicks ≈ 392°); calibrate empirically.",
    },
    pourSequence: [
      {
        label: "Bloom (→30 g) @ 0:00",
        action: "pour",
        waterGramsAtEnd: 30,
        durationSec: 10,
        notes: "Circular pour, saturate the bed evenly; bloom 30 s.",
      },
      { label: "Bloom rest → 0:30", action: "wait", durationSec: 20 },
      {
        label: "Pour 2 (→120 g)",
        action: "pour",
        waterGramsAtEnd: 120,
        durationSec: 15,
        notes: "Circular pour from the centre out, then back to the centre; wait until 1:00.",
      },
      { label: "Wait → 1:00", action: "wait", durationSec: 15 },
      {
        label: "Pour 3 (→160 g) @ 1:00",
        action: "pour",
        waterGramsAtEnd: 160,
        durationSec: 10,
        notes: "Circular pour; wait until 1:20.",
      },
      { label: "Wait → 1:20", action: "wait", durationSec: 10 },
      {
        label: "Pour 4 (→200 g) @ 1:20",
        action: "pour",
        waterGramsAtEnd: 200,
        durationSec: 10,
        notes: "Circular pour; wait until 1:40.",
      },
      { label: "Wait → 1:40", action: "wait", durationSec: 10 },
      {
        label: "Pour 5 (→240 g) @ 1:40",
        action: "pour",
        waterGramsAtEnd: 240,
        durationSec: 10,
        notes: "Final circular pour.",
      },
      { label: "Drawdown (~2:20) — then swirl the carafe", action: "drain", durationSec: 30 },
    ],
    totalTimeSec: 140,
    techniques: ["pulse-pouring", "spiral-pour"],
    bestFor: {
      roastLevels: ["light", "medium-light", "medium"],
      processes: ["washed", "natural", "honey"],
      goals: ["balanced", "sweetness-forward", "high-clarity"],
    },
    teaches:
      "A counter-intuitive championship combination: a COARSE grind with notably COOL water (85 °C) and a long-ish set of gentle circular pours. Coarse + cool would normally under-extract, but five even pours over a deep-ish bed and a 1:16 ratio pull a balanced, sweet, clean cup with soft acidity.",
    science:
      "A coarse grind (Comandante 25–27 clicks) shrinks the fines fraction that drives harsh over-extraction, and 85 °C keeps the fast-extracting bitter compounds in check. Hatakeyama recovers the yield the coarse/cool setup gives up through pour COUNT — five even circular pours (each from the centre out and back), each a fresh agitation/percolation cycle — landing a high, even extraction that reads as sweetness and clarity rather than astringency. The single constant temperature keeps it everyday-practical (no staging).",
    whenToUse:
      "A delicate, sweetness-forward cup from a clean coffee where you want softness and clarity over punchy acidity — and you can grind coarse and pour patiently. The single 85 °C / coarse-grind combination is the signature.",
    sources: [
      {
        type: "report",
        citation:
          "Daiki Hatakeyama — 2024 Japan Brewers Cup champion recipe (owner-supplied). 15 g : 240 g at 85 °C, Comandante 25–27 clicks, Origami Air S + Cafec Abaca paper; bloom 30 mL/30 s, then circular pours to 120 g (by 1:00) / 160 g (1:20) / 200 g (1:40) / 240 g, swirl the carafe, total ~2:20.",
        year: 2024,
      },
    ],
    verified: true,
    notes:
      "Replaced (June 2026) with Hatakeyama's actual 2024 Japan Brewers Cup champion recipe, supplied by the owner: 15 g : 240 g, single 85 °C (no staircase), coarse Comandante 25–27 clicks, five even circular pours (30 → 120 → 160 → 200 → 240) finishing ~2:20, swirl the carafe. The previous entry was an unsourced 'roast-tailored Cafec filter' reconstruction (15 g : 225 g, 88–95 °C staircase) and has been removed. Brewer set to Origami Air M (the owner's dripper; Hatakeyama used Air S, and his recipe notes the Cafec Flower Dripper as the intended dripper). Owner-supplied — not independently web-fetched; Niche degrees derived from the published Comandante clicks.",
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
        label: "Bloom — spiral pour 30 g in 10 s",
        action: "pour",
        waterGramsAtEnd: 30,
        durationSec: 10,
        notes: "Shake the brewer to level the bed first, then spiral-pour 30 g in 10 s.",
      },
      { label: "Bloom rest → 0:30", action: "wait", durationSec: 20 },
      {
        label: "Continuous spiral pour to 250 g (by 1:45)",
        action: "pour",
        waterGramsAtEnd: 250,
        durationSec: 75,
        notes:
          "From 0:30, one slow continuous spiral pour with pacing to reach 250 g at 1:45 — gentle, even agitation of the whole bed the entire pour. A flow restrictor on the kettle keeps the stream steady.",
      },
      { label: "Drawdown — remove brewer at 2:35", action: "drain", durationSec: 50 },
    ],
    totalTimeSec: 155,
    techniques: ["fines-removal-sieving", "flat-bed-pour", "continuous-pour"],
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
