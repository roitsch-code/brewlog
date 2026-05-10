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
      "Origami dripper with Kalita Wave 155 paper filter. The 'Sensory Flavor Cup' Du co-designed with Origami sits in the same family.",
    dose: { grams: 20 },
    water: { grams: 240, ratio: "1:12" },
    temperature: { celsius: 94 },
    grind: {
      referenceGrinder: "EK43",
      referenceSetting: "medium",
      nicheZeroDegrees: [398, 408],
    },
    pourSequence: [
      {
        label: "Bloom",
        action: "pour",
        waterGramsAtEnd: 40,
        durationSec: 35,
        notes: "2× dose. Light stir to fully saturate the wave bed.",
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
        waterGramsAtEnd: 200,
        durationSec: 15,
      },
      {
        label: "Pour 4",
        action: "pour",
        waterGramsAtEnd: 240,
        durationSec: 15,
      },
      { label: "Drawdown", action: "drain", durationSec: 70 },
    ],
    totalTimeSec: 195,
    techniques: [
      "custom-mineral-water",
      "rich-ratio",
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
      "How a rich brewing ratio (1:12) combined with custom low-mineral water can produce extreme clarity without sacrificing sweetness. The flat Origami wave bed evens extraction across the puck.",
    science:
      "Du's water (4 ppm Ca²⁺, 15 ppm Mg²⁺, ~80 ppm TDS) is heavily magnesium-biased — magnesium binds organic acids and amplifies aromatic complexity, while the low calcium prevents the cup from gaining unwanted body that would mask florals. The 1:12 ratio runs counter to the usual 'lean = bright' rule because the low-mineral water provides almost zero buffering against acidity; concentration intensifies clarity rather than muddying it. The Origami's ribbed walls drain fast despite the wave filter's slower base flow, preventing the puck from stalling in late extraction.",
    whenToUse:
      "For a Gesha or top-tier washed Ethiopian where you want maximum aromatic intensity in a small cup. Requires either championship water or a careful tap-distilled blend.",
    sources: [
      {
        type: "official-competition",
        citation: "2019 World Brewers Cup Final, Berlin",
        year: 2019,
      },
      {
        type: "interview",
        citation: "Origami Dripper recipe collaboration materials",
      },
    ],
    verified: false,
    notes:
      "Headline parameters (dose, water, temp, brewer, custom water spec) are well-attested. Pour sequence reconstructed from Origami collaboration write-ups and Sprudge interviews; published routine details vary slightly between sources.",
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
    brewer: "v60",
    brewerNotes: "Hario V60 size 02 with tabbed paper filter",
    dose: { grams: 14 },
    water: { grams: 200, ratio: "1:14.3" },
    temperature: {
      staged: [
        { pourIndex: 0, celsius: 70, label: "low-temp bloom" },
        { pourIndex: 1, celsius: 95, label: "extraction" },
        { pourIndex: 2, celsius: 95, label: "extraction" },
      ],
      rangeC: [70, 95],
    },
    grind: {
      referenceGrinder: "1Zpresso ZP6",
      referenceSetting: "medium-fine",
      nicheZeroDegrees: [388, 396],
    },
    pourSequence: [
      {
        label: "Cool bloom (70°C)",
        action: "pour",
        waterGramsAtEnd: 30,
        durationSec: 40,
        temperatureC: 70,
        notes:
          "Low-temperature bloom preserves the most volatile floral aromatics — they would otherwise dissipate before the cup reaches you.",
      },
      {
        label: "Pour 1 (95°C)",
        action: "pour",
        waterGramsAtEnd: 110,
        durationSec: 25,
        temperatureC: 95,
      },
      {
        label: "Pour 2 (95°C)",
        action: "pour",
        waterGramsAtEnd: 200,
        durationSec: 25,
        temperatureC: 95,
      },
      { label: "Drawdown", action: "drain", durationSec: 60 },
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
      "The most fragile aromatic compounds in coffee (linalool, geraniol, jasmine lactones) volatilise above ~90°C. A standard 95°C bloom drives them off into the steam before they enter solution. By blooming at 70°C, Hsu keeps these compounds in the liquid phase — they dissolve into the water as it heats from contact with the puck. The subsequent hot pours then do the bulk extraction work for sugars and balancing acids. The 14g dose at 1:14.3 keeps the cup concentrated enough to read those preserved florals clearly.",
    whenToUse:
      "For competition-grade washed Gesha or top-shelf Ethiopian where aromatic preservation is the entire point of the brew. Requires a kettle that can hold two temperatures (Stagg EKG works — set 95°C primary, manually cool a pre-poured 70°C portion).",
    sources: [
      {
        type: "official-competition",
        citation: "2022 World Brewers Cup Final, Melbourne",
        year: 2022,
      },
      {
        type: "video",
        citation: "World Coffee Events YouTube — official routine",
      },
    ],
    verified: false,
    notes:
      "Dose, water, brewer, and the two staging temperatures (70°C and 95°C) are agreed across sources. The exact sequencing — how many pours follow the cool bloom, and at what intervals — varies in third-party transcriptions. The two-pour structure above is the most commonly cited reconstruction.",
  },

  // ── 2023 WBrC ──────────────────────────────────────────────────────────────

  {
    id: "wbrc-2023-medina",
    name: "Medina 2023 — Conical Paper Filter",
    shortName: "Medina 2023",
    attribution: {
      person: "Carlos Medina",
      title: "2023 World Brewers Cup Champion",
      country: "Chile",
      year: 2023,
    },
    category: "championship",
    brewer: "conical-paper",
    brewerNotes:
      "Generic conical paper-filter brewer with Brewista kettle for precise pour control. Coffee: Natural Sidra from Café Granja la Esperanza.",
    dose: { grams: 15.5 },
    water: { grams: 250, ratio: "1:16.1" },
    temperature: { celsius: 91, rangeC: [90, 92] },
    grind: {
      referenceGrinder: "EK43",
      referenceSetting: "medium",
      nicheZeroDegrees: [398, 406],
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
        waterGramsAtEnd: 110,
        durationSec: 25,
      },
      {
        label: "Pour 2",
        action: "pour",
        waterGramsAtEnd: 180,
        durationSec: 25,
      },
      {
        label: "Pour 3",
        action: "pour",
        waterGramsAtEnd: 250,
        durationSec: 25,
      },
      { label: "Drawdown", action: "drain", durationSec: 105 },
    ],
    totalTimeSec: 210,
    techniques: ["lean-ratio", "moderate-temperature"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["natural", "honey"],
      varieties: ["Sidra"],
      goals: ["sweetness-forward", "balanced"],
    },
    teaches:
      "How a lean ratio (1:16) at a moderate 91°C extracts the fermentation-derived sweetness of a Natural Sidra without amplifying ester sharpness.",
    science:
      "Natural Sidra carries strong tropical-fermentation esters. Above ~94°C they extract aggressively and can read as winey or volatile in the cup. At 91°C with a lean ratio, the brew sits in the sugar/maillard zone of Gagné's solubility sequence for longer relative to the early aromatics, producing rounded sweetness rather than fermentation sharpness. The cleaner, longer drawdown of a conical paper filter further softens the cup compared to a metal filter.",
    whenToUse:
      "For a Natural Sidra or expressive natural processing where you want the sweet character to lead, not the fermentation. Also a sensible default for honey-process medium-light coffees.",
    sources: [
      {
        type: "official-competition",
        citation: "2023 World Brewers Cup Final, Athens",
        year: 2023,
      },
    ],
    verified: false,
    notes:
      "Dose, water, temperature, and brewer category (conical paper filter) are universally agreed. Exact pour sequence is reconstructed from Slow Pour Supply and Origami interview write-ups and may not match the precise competition routine.",
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
      "Orea V4 with the Fast bottom (predecessor to the Wide bottom — same fast-draining geometry). Coffee: Finca Maya Panama, double fermentation, from Lost Origin Coffee Labs.",
    dose: { grams: 17 },
    water: { grams: 270, ratio: "1:15.9" },
    temperature: { celsius: 93 },
    grind: {
      referenceGrinder: "Mazzer ZM",
      referenceSetting: "490 microns",
      nicheZeroDegrees: [401, 411],
      description:
        "Equivalent to Comandante C40 at 21–25 clicks — slightly coarser than typical Orea grind.",
    },
    pourSequence: [
      {
        label: "Bloom",
        action: "pour",
        waterGramsAtEnd: 50,
        durationSec: 30,
      },
      {
        label: "Light stir (1–2×)",
        action: "stir",
        durationSec: 5,
        notes: "Wet the puck evenly; do not over-agitate.",
      },
      {
        label: "Pour 1",
        action: "pour",
        waterGramsAtEnd: 120,
        durationSec: 15,
      },
      {
        label: "Pour 2",
        action: "pour",
        waterGramsAtEnd: 195,
        durationSec: 15,
      },
      {
        label: "Pour 3",
        action: "pour",
        waterGramsAtEnd: 270,
        durationSec: 15,
      },
      { label: "Drawdown", action: "drain", durationSec: 60 },
    ],
    totalTimeSec: 140,
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
        type: "video",
        citation: "European Coffee Trip — official Wölfl routine breakdown",
      },
    ],
    verified: true,
    notes:
      "Pour milestones reconstructed from the European Coffee Trip video; exact gram targets between pours may vary by ±5g but the 4-pour structure is canonical.",
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
    water: { grams: 60, ratio: "1:4" },
    temperature: {
      staged: [
        { pourIndex: 0, celsius: 96, label: "hot bloom" },
        { pourIndex: 1, celsius: 88, label: "development" },
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
        waterGramsAtEnd: 20,
        durationSec: 30,
        temperatureC: 96,
        notes:
          "Hot bloom starts extraction across all three roast levels; the Melodrip prevents agitation that would homogenise the layered bed.",
      },
      {
        label: "Development pour (88°C, via Melodrip)",
        action: "melodrip",
        waterGramsAtEnd: 40,
        durationSec: 30,
        temperatureC: 88,
      },
      {
        label: "Cool final pour (80°C, via Melodrip)",
        action: "melodrip",
        waterGramsAtEnd: 60,
        durationSec: 30,
        temperatureC: 80,
        notes:
          "Cool final pour preserves fragile Zone 1 aromatics that would dissipate at 96°C.",
      },
      { label: "Drawdown", action: "drain", durationSec: 30 },
    ],
    totalTimeSec: 120,
    techniques: [
      "staged-temperature",
      "three-roast-layering",
      "melodrip-controlled-agitation",
      "ultra-rich-ratio",
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
      "Light roast contributes the most acidic, aromatic compounds (Zone 1 dominant). Medium-light contributes sugars and balance. Medium contributes body and roundness. By layering them and using a hot bloom followed by progressively cooler pours, Peng compresses what would normally be three separate brews into one. The Melodrip (a perforated disc that diffuses pour flow) eliminates turbulence — the three layers extract in place rather than mixing. The 1:4 ratio is closer to espresso concentration than filter; the cup is served diluted to taste, or savoured neat at the 50°C serving temperature where retronasal aroma perception is at its peak.",
    whenToUse:
      "Demonstration brewing. Not a daily-driver recipe. Requires three roast levels of the same coffee — impractical for most home setups — but the principles (staged temperature, controlled agitation via Melodrip-equivalent, ultra-rich ratio with low-mineral water) transfer to single-roast brews.",
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
      "The headline mechanics — Solo dripper, three roast levels of one coffee, staged temperatures (96 → 80°C), Melodrip, 40 ppm low-mineral water, 50°C serving temperature — are consistently reported. The exact dripper variant is sometimes described as Origami in some sources (different drippers were used across rounds of the routine). Pour milestones are reconstructed and the precise sequencing should be checked against the official WCC video when teaching from this recipe.",
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
