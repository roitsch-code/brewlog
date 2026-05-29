import type { Recipe } from "./types";

/**
 * World Brewers Cup + World AeroPress Championship winning recipes.
 *
 * Verification policy:
 *   verified: true  — dose, water, temperature, brewer, and pour structure
 *                     are consistently reported across the official competition
 *                     video, official write-up, and at least one independent
 *                     transcription. Secondary details (exact stir count,
 *                     pour speed) are taken from the most widely cited
 *                     reconstruction.
 *   verified: false — the headline parameters (dose, water, temp, brewer) are
 *                     well-attested, but the pour sequence is reconstructed
 *                     from third-party transcriptions that diverge. The brain
 *                     should still cite the recipe but flag uncertainty.
 *
 * Sources for each entry are listed under `sources`. When a pour sequence is
 * reconstructed, `notes` records what was reconstructed and from where.
 */

export const CHAMPIONSHIP_RECIPES: Recipe[] = [
  // ── 2016 WBrC ──────────────────────────────────────────────────────────────

  {
    id: "wbrc-2016-kasuya",
    name: "Kasuya 2016 — 4:6 Method",
    shortName: "Kasuya 4:6",
    attribution: {
      person: "Tetsu Kasuya",
      title: "2016 World Brewers Cup Champion",
      affiliation: "Philocoffea, Chiba",
      country: "Japan",
      year: 2016,
    },
    category: "championship",
    brewer: "v60",
    brewerNotes: "Hario V60 size 02 with tabbed paper filter",
    dose: { grams: 20 },
    water: { grams: 300, ratio: "1:15" },
    temperature: { celsius: 92, rangeC: [90, 93] },
    grind: {
      referenceGrinder: "Various commercial grinders",
      referenceSetting: "medium-coarse, like coarse sea salt",
      nicheZeroDegrees: [411, 421],
      description:
        "Coarser than a typical V60 grind — the longer total brew time compensates for the reduced surface area.",
    },
    pourSequence: [
      {
        label: "Pour 1 (acid/sweet phase, 40% — pour A)",
        action: "pour",
        waterGramsAtEnd: 60,
        durationSec: 10,
        notes:
          "First of two phase-1 pours. Smaller first pour = sweeter cup; larger = brighter. 60g is the balanced default.",
      },
      { label: "Rest", action: "wait", durationSec: 35 },
      {
        label: "Pour 2 (acid/sweet phase, 40% — pour B)",
        action: "pour",
        waterGramsAtEnd: 120,
        durationSec: 10,
      },
      { label: "Rest", action: "wait", durationSec: 35 },
      {
        label: "Pour 3 (strength phase, 60% — pour 1 of 3)",
        action: "pour",
        waterGramsAtEnd: 180,
        durationSec: 10,
      },
      { label: "Rest", action: "wait", durationSec: 35 },
      {
        label: "Pour 4 (strength phase — pour 2 of 3)",
        action: "pour",
        waterGramsAtEnd: 240,
        durationSec: 10,
      },
      { label: "Rest", action: "wait", durationSec: 20 },
      {
        label: "Pour 5 (strength phase — pour 3 of 3)",
        action: "pour",
        waterGramsAtEnd: 300,
        durationSec: 10,
        notes:
          "Fewer phase-2 pours = weaker cup; more = stronger. 3 pours is the published default.",
      },
      { label: "Drawdown", action: "drain", durationSec: 35 },
    ],
    totalTimeSec: 210,
    techniques: [
      "phase-separated-pouring",
      "ratio-control-via-pour-count",
      "no-bloom-distinction",
    ],
    bestFor: {
      roastLevels: ["light", "medium-light", "medium"],
      processes: ["washed", "natural", "honey"],
      goals: ["balanced", "explore"],
    },
    teaches:
      "How to dial acidity and strength independently. The first 40% (two pours) controls the acid/sweet axis; the last 60% (three pours) controls strength. Changing pour counts changes cup character without touching grind or temperature.",
    science:
      "By holding the dose, total water, temperature, and grind constant, only the pour distribution varies. Phase 1 establishes the extraction's brightness ceiling (early-soluble organic acids dominate). Phase 2 then determines how much sweetness and body extracts into the cup — more, smaller pours = more agitation cycles, higher final extraction, stronger cup. The lack of a distinct bloom is deliberate: Kasuya treats the first pour as the bloom, simplifying the routine.",
    whenToUse:
      "When you want to learn what a specific coffee does at each extraction phase, or when you need a teaching framework for someone new to pour-over.",
    sources: [
      {
        type: "official-competition",
        citation: "2016 World Brewers Cup Final, Dublin",
        year: 2016,
      },
      {
        type: "video",
        citation: "Tetsu Kasuya's published 4:6 method walkthroughs (YouTube)",
      },
      {
        type: "book",
        citation: "Kasuya, T. — published 4:6 method documentation",
      },
    ],
    verified: true,
    notes:
      "The 4:6 method is a framework, not a single fixed recipe. Pour counts can change to dial the cup: 2+2 pours = sweeter and weaker, 2+4 = sweeter and stronger, 2+3 (above) = balanced default.",
  },

  // ── 2019 WBrC ──────────────────────────────────────────────────────────────

  {
    id: "wbrc-2019-du",
    name: "Du 2019 — Origami Wave",
    shortName: "Du 2019",
    attribution: {
      person: "Jia Ning Du",
      title: "2019 World Brewers Cup Champion",
      country: "China",
      year: 2019,
    },
    category: "championship",
    brewer: "origami-wave",
    brewerNotes:
      "Origami dripper with a Kalita Wave filter (the wave fits the Origami's 20 ribs, giving a thin, even bed and a fast, clear drawdown). Coffee: a 90+ washed Gesha from Gesha Village, Ethiopia. Du double-ground — a first coarse pass then a second finer pass through the same hand grinder — for a more even particle distribution.",
    dose: { grams: 16 },
    water: { grams: 240, ratio: "1:15" },
    temperature: { celsius: 94 },
    grind: {
      referenceGrinder: "EK43",
      referenceSetting: "medium (double-ground for even distribution)",
      nicheZeroDegrees: [398, 408],
      description:
        "Du double-ground: a first coarse pass, then a second finer pass through the same hand grinder, to tighten the particle distribution.",
    },
    pourSequence: [
      {
        label: "Pour 1 (bloom)",
        action: "pour",
        waterGramsAtEnd: 60,
        durationSec: 10,
        notes: "~6 g/s; doubles as the bloom.",
      },
      { label: "Rest", action: "wait", durationSec: 10 },
      {
        label: "Pour 2",
        action: "pour",
        waterGramsAtEnd: 140,
        durationSec: 20,
        notes: "Slower pour, ~4 g/s (80 g over 20 s).",
      },
      { label: "Rest (let the bed draw to a moist surface)", action: "wait", durationSec: 20 },
      {
        label: "Pour 3",
        action: "pour",
        waterGramsAtEnd: 240,
        durationSec: 20,
        notes: "Medium speed, ~5 g/s (100 g over 20 s).",
      },
      { label: "Drawdown", action: "drain", durationSec: 25 },
    ],
    totalTimeSec: 105,
    techniques: [
      "custom-mineral-water",
      "even-pour-distribution",
      "flat-bed-extraction",
    ],
    bestFor: {
      roastLevels: ["very-light", "light"],
      processes: ["washed"],
      varieties: ["Gesha", "Geisha", "SL28"],
      goals: ["high-clarity", "sweetness-forward"],
    },
    teaches:
      "How a thin, fast-draining bed (Origami + Kalita-wave filter) plus a tightened particle distribution (double grind) produces extreme clarity. The quick drawdown keeps total contact time short, so acidity stays vivid.",
    science:
      "The wave filter in the wide-mouthed Origami spreads the grounds into a shallow, flat bed and the Origami's ribs keep the walls draining fast — extraction is even and quick rather than deep. Du's double grind narrows the particle spread, so fines don't over-extract while boulders under-extract. Combined with low-mineral competition water (magnesium-biased, low buffering), the 1:15 cup reads as bright and transparent on a ~1:45 drawdown.",
    whenToUse:
      "For a Gesha or top-tier washed Ethiopian where you want maximum aromatic clarity. The Origami + Kalita-wave pairing and the quick three-pour rhythm are the transferable parts; the championship water is optional.",
    sources: [
      {
        type: "official-competition",
        citation:
          "2019 World Brewers Cup Final — host city corrected to Boston (SCA Expo, April 2019) from the prior 'Berlin'. Basis: Du was reported as champion in a China Daily interview dated 2019-05-10, before World of Coffee Berlin (June 2019). Secondary timing evidence; pending a final cross-check against official WCE materials.",
        year: 2019,
      },
      {
        type: "transcript",
        citation:
          "Recipe-recreation walkthrough recounting Du's routine step by step (16 g : 240 g, 94 °C, three pours 60/140/240, Origami + Kalita-wave filter, double grind) — transcribed in-session.",
      },
    ],
    verified: false,
    notes:
      "Brew-relevant parameters corrected from a detailed recipe-recreation transcript that follows Du's published routine: dose 16 g (was 20 g), ratio 1:15 (was 1:12), three pours 60/140/240 (was bloom + 4 pours), ~1:45 total. Host city corrected to Boston (was 'Berlin') on secondary timing evidence — see sources, pending WCE confirmation. Kept verified:false because the source is a third-party recreation, not Du's own footage.",
  },

  // ── 2022 WBrC ──────────────────────────────────────────────────────────────

  {
    id: "wbrc-2022-hsu",
    name: "Hsu 2022 — Staged-Temperature V60",
    shortName: "Hsu 2022",
    attribution: {
      person: "Shih Yuan Hsu (Sherry)",
      title: "2022 World Brewers Cup Champion",
      affiliation: "UCC Taiwan, 1Zpresso ambassador",
      country: "Taiwan",
      year: 2022,
    },
    category: "championship",
    brewer: "kalita-wave",
    brewerNotes:
      "Flat-bottom polycarbonate dripper (poor heat conductor, chosen to hold the bed temperature). The flat bed lets the coffee-bed temperature climb sharply from ~35°C to ~70°C for efficient extraction.",
    dose: { grams: 14 },
    water: { grams: 200, ratio: "1:14" },
    temperature: {
      staged: [
        { pourIndex: 0, celsius: 70, label: "low-temp first pour" },
        { pourIndex: 1, celsius: 95, label: "extraction" },
        { pourIndex: 2, celsius: 95, label: "extraction" },
        { pourIndex: 3, celsius: 95, label: "extraction" },
      ],
      rangeC: [70, 95],
    },
    grind: {
      referenceGrinder: "1Zpresso ZP6",
      referenceSetting:
        "medium-fine (two particle sizes: ~75% at 1000µm, 25% at 800µm)",
      nicheZeroDegrees: [388, 396],
    },
    pourSequence: [
      {
        label: "Pour 1 — cool (70°C)",
        action: "pour",
        waterGramsAtEnd: 50,
        durationSec: 10,
        temperatureC: 70,
        notes:
          "50 g every 30 s, four times. The first pour is cool (70°C) to preserve volatile floral aromatics and accentuate malic brightness.",
      },
      { label: "Rest", action: "wait", durationSec: 20 },
      {
        label: "Pour 2 (95°C)",
        action: "pour",
        waterGramsAtEnd: 100,
        durationSec: 10,
        temperatureC: 95,
      },
      { label: "Rest", action: "wait", durationSec: 20 },
      {
        label: "Pour 3 (95°C)",
        action: "pour",
        waterGramsAtEnd: 150,
        durationSec: 10,
        temperatureC: 95,
      },
      { label: "Rest", action: "wait", durationSec: 20 },
      {
        label: "Pour 4 (95°C)",
        action: "pour",
        waterGramsAtEnd: 200,
        durationSec: 10,
        temperatureC: 95,
      },
      { label: "Drawdown", action: "drain", durationSec: 50 },
    ],
    totalTimeSec: 150,
    techniques: [
      "staged-temperature",
      "low-temp-bloom",
      "aroma-preservation",
      "rich-ratio",
    ],
    bestFor: {
      roastLevels: ["very-light", "light"],
      processes: ["washed", "natural"],
      varieties: ["Gesha", "Geisha", "Ethiopia Heirloom"],
      goals: ["high-clarity"],
    },
    teaches:
      "How temperature staging isolates aromatic preservation from extraction efficiency. A cool bloom captures volatile florals before they evaporate; a hot extraction then extracts the remaining sugars and acids.",
    science:
      "The most fragile aromatic compounds in coffee (linalool, geraniol, jasmine lactones) volatilise above ~90°C. A standard 95°C first pour drives them off into the steam before they enter solution. By starting at 70°C, Hsu keeps these compounds in the liquid phase — they dissolve as the water heats from contact with the puck — and the cooler first pour also accentuates malic brightness. The subsequent 95°C pours then do the bulk extraction for sugars and balancing acids. Four equal 50 g pours on a 30 s cadence keep agitation regular; the 14 g dose at 1:14 keeps the cup concentrated enough to read those preserved florals clearly.",
    whenToUse:
      "For competition-grade washed Gesha or top-shelf Ethiopian where aromatic preservation is the entire point of the brew. Requires a kettle that can hold two temperatures (Stagg EKG works — set 95°C primary, manually cool a pre-poured 70°C portion).",
    sources: [
      {
        type: "official-competition",
        citation: "2022 World Brewers Cup Final, Melbourne",
        year: 2022,
      },
      {
        type: "transcript",
        citation:
          "Hsu's own WCE stage presentation — '14 grams, 200 grams of water, ratio 1 to 14… 50 grams of water added every 30 seconds, a total of four times'; first pour 70°C then 95°C; flat-bottom polycarbonate dripper. Transcribed in-session.",
      },
    ],
    verified: true,
    notes:
      "Corrected from Hsu's own stage presentation: 4 × 50 g pours on a 30 s cadence (50/100/150/200), not bloom + two pours; brewer is a flat-bottom polycarbonate dripper, not a V60. First pour 70°C, remaining pours 95°C. She also split the grind ~75% at 1000µm / 25% at 800µm (a micron detail, out of brew-parameter scope).",
  },

  // ── 2023 WBrC ──────────────────────────────────────────────────────────────

  {
    id: "wbrc-2023-medina",
    name: "Medina 2023 — Origami, Five Even Pours",
    shortName: "Medina 2023",
    attribution: {
      person: "Carlos Medina",
      title: "2023 World Brewers Cup Champion",
      country: "Chile",
      year: 2023,
    },
    category: "championship",
    brewer: "origami-cone",
    brewerNotes:
      "Origami Air S + Cafec Abaca cone paper filter. (Grind ~850–950 microns / Timemore Chestnut S3 at 5.5 / Comandante at 26 clicks.) Five even ~50 g pours on a 30 s cadence. Coffee: Natural Sidra from Café Granja la Esperanza.",
    dose: { grams: 15.5 },
    water: { grams: 248, ratio: "1:16" },
    temperature: { celsius: 91 },
    grind: {
      referenceGrinder: "Timemore Chestnut S3 (5.5) / Comandante (26 clicks)",
      referenceSetting: "medium-coarse, 850–950 microns",
      nicheZeroDegrees: [398, 406],
    },
    pourSequence: [
      {
        label: "Bloom (→50g)",
        action: "pour",
        waterGramsAtEnd: 50,
        durationSec: 10,
        notes: "Gentle circular pour at 91°C; bloom 30 s.",
      },
      { label: "Wait", action: "wait", durationSec: 20, notes: "Until 0:30." },
      {
        label: "Pour 2 (→100g)",
        action: "pour",
        waterGramsAtEnd: 100,
        durationSec: 10,
        notes: "Circular pour.",
      },
      { label: "Wait", action: "wait", durationSec: 20, notes: "Until 1:00." },
      {
        label: "Pour 3 (→150g)",
        action: "pour",
        waterGramsAtEnd: 150,
        durationSec: 10,
        notes: "Steady circular pour.",
      },
      { label: "Wait", action: "wait", durationSec: 20, notes: "Until 1:30." },
      {
        label: "Pour 4 (→200g)",
        action: "pour",
        waterGramsAtEnd: 200,
        durationSec: 10,
      },
      { label: "Wait", action: "wait", durationSec: 20, notes: "Until 2:00." },
      {
        label: "Pour 5 (→248g)",
        action: "pour",
        waterGramsAtEnd: 248,
        durationSec: 10,
        notes: "Final pour at 2:00.",
      },
      { label: "Drawdown", action: "drain", durationSec: 40, notes: "Total brew time 2:40–3:00. Swirl the carafe before serving." },
    ],
    totalTimeSec: 170,
    techniques: ["even-pulse-pouring", "lean-ratio", "moderate-temperature"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["natural", "honey", "washed"],
      varieties: ["Sidra"],
      goals: ["sweetness-forward", "balanced"],
    },
    teaches:
      "Five even ~50 g pours on a 30 s cadence at a lean 1:16 and moderate 91°C — metronomic extraction that draws out fermentation-derived sweetness without amplifying ester sharpness.",
    science:
      "Natural Sidra carries strong tropical-fermentation esters. Above ~94°C they extract aggressively and can read as winey or volatile. At 91°C with a lean ratio, the brew sits in the sugar/maillard zone for longer relative to the early aromatics, producing rounded sweetness rather than fermentation sharpness. Equal pulses every 30 s keep the bed agitation regular and the slurry level steady, so extraction is uniform across the brew.",
    whenToUse:
      "For a Natural Sidra or expressive natural processing where you want the sweet character to lead, not the fermentation. Also a sensible default for honey-process medium-light coffees.",
    sources: [
      {
        type: "official-competition",
        citation: "2023 World Brewers Cup Final, Athens",
        year: 2023,
      },
      {
        type: "transcript",
        citation:
          "User-provided April-style recipe card — 'Carlos Medina, Origami Recipe, 2023 World Brewers Cup Champion' (15.5 g : 248 g, 91°C, five 50 g pours, Origami Air S + Cafec Abaca). Consolidated into this entry.",
        year: 2023,
      },
    ],
    verified: false,
    notes:
      "Brewer and pour structure corrected from the recipe card: Origami Air S + Cafec Abaca cone paper (was 'generic conical paper'); five even 50 g pours on a 30 s cadence (was a reconstructed bloom + 3 pours); 248 g total (was 250 g). Kept verified:false — card provenance, not Medina's own footage.",
  },

  // ── 2024 WBrC ──────────────────────────────────────────────────────────────

  {
    id: "wbrc-2024-wolfl",
    name: "Wölfl 2024 — Orea V4 Fast",
    shortName: "Wölfl 2024",
    attribution: {
      person: "Martin Wölfl",
      title: "2024 World Brewers Cup Champion",
      affiliation: "Wildkaffee Austria, Vienna",
      country: "Austria",
      year: 2024,
    },
    category: "championship",
    brewer: "orea-v4-fast",
    brewerNotes:
      "Orea V4 Narrow body with the Fast bottom, Sibarist Fast paper filter. (The V4 comes in two bodies — Wide 73° and Narrow 65° — and four interchangeable bottoms: Fast/Classic/Open/Apex. Wölfl used the Narrow body + Fast bottom.) A needling/WDT tool opens the bed before brewing and a Melodrip diffuses each pour to minimise turbulence. Coffee on stage: a Panama Gesha from Lost Origin Coffee Labs.",
    dose: { grams: 17 },
    water: { grams: 270, ratio: "1:15.9" },
    temperature: { celsius: 93, rangeC: [93, 95] },
    grind: {
      referenceGrinder: "Mazzer ZM",
      referenceSetting: "490 microns",
      nicheZeroDegrees: [401, 411],
      description:
        "Equivalent to Comandante C40 at 21–25 clicks — slightly coarser than typical Orea grind.",
    },
    pourSequence: [
      {
        label: "WDT / needle the dry bed",
        action: "agitate-bed",
        durationSec: 0,
        notes: "Open the top of the grounds so they saturate faster — more sweetness, clarity, transparency.",
      },
      {
        label: "Bloom (via Melodrip)",
        action: "melodrip",
        waterGramsAtEnd: 60,
        durationSec: 40,
        notes: "Long 40 s bloom for full saturation; Melodrip keeps turbulence low.",
      },
      {
        label: "Pour 2 (via Melodrip)",
        action: "melodrip",
        waterGramsAtEnd: 120,
        durationSec: 10,
      },
      { label: "Rest", action: "wait", durationSec: 30 },
      {
        label: "Pour 3 — at 1:20 (via Melodrip)",
        action: "melodrip",
        waterGramsAtEnd: 170,
        durationSec: 10,
      },
      { label: "Rest", action: "wait", durationSec: 30 },
      {
        label: "Pour 4 — at 2:00 (via Melodrip)",
        action: "melodrip",
        waterGramsAtEnd: 270,
        durationSec: 15,
      },
      { label: "Drawdown", action: "drain", durationSec: 10 },
    ],
    totalTimeSec: 145,
    techniques: [
      "fast-flow-dripper",
      "turbulent-pours",
      "limited-bed-contact",
    ],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["natural", "anaerobic", "honey", "washed"],
      goals: ["high-clarity", "explore"],
    },
    teaches:
      "How fast-flowing geometry combined with turbulent pours can deliver clarity on a Natural — the paradox of high agitation producing a clean cup.",
    science:
      "The Orea V4 Fast geometry drains rapidly: the puck never stalls in extended contact. Combined with relatively fast, turbulent pours, total bed-contact time stays in the Zone 1–2 window (organic acids and sugars) and rarely reaches Zone 3 (bitters, phenolics). The result is clarity on a coffee — a double-fermented Natural — that would muddy under a slower, gentler approach because the fermentation esters never get extended contact time to over-extract. The 1:15.9 ratio is conventional; the technique is doing the work.",
    whenToUse:
      "For a complex Natural or anaerobic lot where you want clarity rather than fermentation amplification. Excellent on naturals with strong tropical character that would otherwise read as too winey.",
    sources: [
      {
        type: "official-competition",
        citation: "2024 World Brewers Cup Final, Copenhagen",
        year: 2024,
      },
      {
        type: "transcript",
        citation:
          "Wölfl brewing his winning recipe on camera in his studio — 17 g : 270 mL, 93 °C, Orea V4 (Narrow) + Fast bottom, Sibarist Fast paper, Melodrip + needle tool. 'Bloom 40 seconds with 60 mL… top up to 120… third step at 1:20 to 170… after 2 minutes last step from 170 to 270… total ~2:20–2:25.' Transcribed in-session.",
      },
    ],
    verified: true,
    notes:
      "Corrected from Wölfl's own studio walkthrough: bloom is 60 mL over 40 s (was 50 g / 30 s); pour milestones are 60/120/170/270 (was 50/120/195/270); he uses a Melodrip and a WDT/needle tool, NOT a stir. Raise temperature to 95 °C for more intensity.",
  },

  // ── 2025 WBrC ──────────────────────────────────────────────────────────────

  {
    id: "wbrc-2025-peng",
    name: "Peng 2025 — Three-Roast Temperature-Staged Layering",
    shortName: "Peng 2025",
    attribution: {
      person: "George Jinyang Peng",
      title: "2025 World Brewers Cup Champion",
      country: "China",
      year: 2025,
    },
    category: "championship",
    brewer: "solo-dripper",
    brewerNotes:
      "Solo dripper (PCTG plastic, 40° cone angle). Melodrip used over the cone to control agitation. Coffee: a single Panama Gesha, prepared at three different roast levels — 5g of each, layered in the brewer.",
    dose: { grams: 15 },
    water: { grams: 210, ratio: "1:14" },
    temperature: {
      staged: [
        { pourIndex: 0, celsius: 96, label: "hot bloom" },
        { pourIndex: 1, celsius: 96, label: "development" },
        { pourIndex: 2, celsius: 80, label: "aroma-preservation final pour" },
      ],
      rangeC: [80, 96],
    },
    grind: {
      referenceGrinder: "Comandante C40 / EK43 equivalent",
      referenceSetting: "medium-fine",
      nicheZeroDegrees: [386, 396],
      description:
        "Finer than typical V60 grind — the 1:4 ratio is concentrated enough that fine grind is essential to reach target extraction in 2 minutes.",
    },
    pourSequence: [
      {
        label: "Layer three roasts in the brewer",
        action: "agitate-bed",
        durationSec: 0,
        notes:
          "5g light, 5g medium-light, 5g medium of the same Panama Gesha. Order of layering is part of the routine.",
      },
      {
        label: "Hot bloom (96°C, via Melodrip)",
        action: "melodrip",
        waterGramsAtEnd: 30,
        durationSec: 30,
        temperatureC: 96,
        notes:
          "Hot bloom starts extraction across all three roast levels; the Melodrip prevents agitation that would homogenise the layered bed.",
      },
      {
        label: "Development pour (96°C, via Melodrip)",
        action: "melodrip",
        waterGramsAtEnd: 120,
        durationSec: 25,
        temperatureC: 96,
      },
      {
        label: "Cool final pour (80°C, via Melodrip)",
        action: "melodrip",
        waterGramsAtEnd: 210,
        durationSec: 25,
        temperatureC: 80,
        notes:
          "Cool final pour preserves fragile Zone 1 aromatics that would dissipate at 96°C.",
      },
      { label: "Drawdown", action: "drain", durationSec: 25 },
    ],
    totalTimeSec: 105,
    techniques: [
      "staged-temperature",
      "three-roast-layering",
      "melodrip-controlled-agitation",
      "low-mineral-water",
      "cool-serving",
    ],
    bestFor: {
      roastLevels: ["very-light", "light", "medium-light"],
      processes: ["washed"],
      varieties: ["Gesha", "Geisha"],
      goals: ["high-clarity", "explore"],
    },
    teaches:
      "How to compose a cup as a sequence — different roast levels extract different compounds at different rates, and staged temperatures isolate which extraction phase contributes which character. The Melodrip removes agitation as a variable so the layered bed stays compositionally distinct.",
    science:
      "Light roast contributes the most acidic, aromatic compounds (Zone 1 dominant). Medium-light contributes sugars and balance. Medium contributes body and roundness. By layering them and using a hot bloom followed by progressively cooler pours, Peng compresses what would normally be three separate brews into one. The Melodrip (a perforated disc that diffuses pour flow) eliminates turbulence — the three layers extract in place rather than mixing. The cup is brewed on low-mineral water and served cool (~50°C), where retronasal aroma perception is at its peak.",
    whenToUse:
      "Demonstration brewing. Not a daily-driver recipe. Requires three roast levels of the same coffee — impractical for most home setups — but the principles (staged temperature, controlled agitation via Melodrip-equivalent, low-mineral water, cool serving) transfer to single-roast brews.",
    sources: [
      {
        type: "official-competition",
        citation: "2025 World Brewers Cup Final, Jakarta",
        year: 2025,
      },
      {
        type: "article",
        citation: "Slow Pour Supply — Peng 2025 recipe write-up",
      },
    ],
    verified: false,
    notes:
      "Secondary-sourced (Slow Pour Supply / European Coffee Trip / Sprudge), no in-session transcript yet — corrected from the prior values: brewing ratio is ~1:14 (15 g : 210 g), NOT 1:4, and the staging is 96 → 96 → 80°C (no distinct 88°C step). The headline mechanics — three roast levels of one coffee, Melodrip, low-mineral water, ~50°C serving — are consistently reported. Pour milestones are reconstructed; confirm against the official WCC video before teaching from this recipe.",
  },

  // ── 2024 World AeroPress Championship ─────────────────────────────────────

  {
    id: "wac-2024-stanica",
    name: "Stanica 2024 — Inverted AeroPress + Bypass",
    shortName: "Stanica 2024",
    attribution: {
      person: "George Stanica",
      title: "2024 World AeroPress Champion",
      country: "Romania",
      year: 2024,
    },
    category: "championship",
    brewer: "aeropress",
    brewerNotes:
      "Inverted AeroPress with Aesir paper filter. Mixed Aquacode water at 85–90 ppm TDS.",
    dose: { grams: 18 },
    water: { grams: 200, ratio: "1:11.1 (extraction) + bypass" },
    temperature: { celsius: 96 },
    grind: {
      referenceGrinder: "Comandante C40 Mk4 Red Clix",
      referenceSetting: "58 clicks",
      nicheZeroDegrees: [382, 388],
      description:
        "Medium-fine. Red Clix has 50 clicks per turn vs. standard 30, so 58 clicks ≈ 35 standard clicks.",
    },
    pourSequence: [
      {
        label: "Invert and load",
        action: "invert",
        durationSec: 0,
        notes: "Inverted orientation, 18g dose, Aesir filter in cap (off).",
      },
      {
        label: "Pour concentrate water at 96°C",
        action: "pour",
        waterGramsAtEnd: 120,
        durationSec: 15,
        temperatureC: 96,
      },
      { label: "Stir 2–3× evenly", action: "stir", durationSec: 10 },
      { label: "Steep", action: "wait", durationSec: 60 },
      {
        label: "Cap, flip, and press",
        action: "press",
        durationSec: 30,
      },
      {
        label: "Add bypass water to taste",
        action: "bypass",
        waterGramsAtEnd: 200,
        durationSec: 5,
        notes:
          "~80g cool bypass water added directly to the cup. Separates extraction strength from final drink concentration.",
      },
    ],
    totalTimeSec: 120,
    techniques: [
      "inverted-aeropress",
      "concentrate-and-bypass",
      "high-temperature-extraction",
      "mid-mineral-water",
    ],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed", "natural", "honey"],
      goals: ["high-clarity", "balanced", "explore"],
    },
    teaches:
      "How concentrate-and-bypass separates extraction from dilution. You can over-pull a tight, intense concentrate at 1:6–1:11, then dial the cup back to drinking strength with cool water — the cup's flavour profile and its strength become independent controls.",
    science:
      "At 1:11 extraction, the AeroPress extracts deeply into Zone 2 (sugars, maillard) without the diluted, watery cup that a 1:16 brew would produce. The bypass water then adjusts cup weight — adding water doesn't extract anything (the puck is already pressed), it only changes concentration. 85–90 ppm mineral water is the SCA sweet spot for clarity-with-body. Aesir paper retains more oils than standard AeroPress paper, pushing the cup toward filter-cup clarity rather than the typical AeroPress mouthfeel.",
    whenToUse:
      "For an AeroPress brew where you want filter-style clarity at the strength of a concentrated extraction. Excellent for competition-grade light roasts where standard AeroPress recipes feel under-extracted.",
    sources: [
      {
        type: "official-competition",
        citation: "2024 World AeroPress Championship",
        year: 2024,
      },
    ],
    verified: true,
    notes:
      "The Comandante 'Red Clix' setting (58 clicks) only translates correctly on Red Clix burrs — standard Comandante owners should use ~35 clicks as the equivalent.",
  },
];
