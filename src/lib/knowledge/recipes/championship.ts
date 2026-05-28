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
        label: "Pour 1 (acid/sweet phase, 40% — pour A, doubles as bloom)",
        action: "pour",
        waterGramsAtEnd: 50,
        durationSec: 10,
        notes:
          "50 g per Kasuya's published 2016 WBrC routine and his Philocoffea documentation. Smaller first pour = sweeter cup; larger = brighter.",
      },
      { label: "Rest", action: "wait", durationSec: 35 },
      {
        label: "Pour 2 (acid/sweet phase, 40% — pour B)",
        action: "pour",
        waterGramsAtEnd: 120,
        durationSec: 10,
        notes: "70 g pour to bring cumulative to 120 g (= 40% of total).",
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
      { label: "Rest", action: "wait", durationSec: 35 },
      {
        label: "Pour 5 (strength phase — pour 3 of 3)",
        action: "pour",
        waterGramsAtEnd: 300,
        durationSec: 10,
        notes:
          "Pour 5 starts at 3:00; lift the dripper at ~3:30. Fewer phase-2 pours = weaker cup; more = stronger. 3 pours is the published default.",
      },
      { label: "Drawdown / lift", action: "drain", durationSec: 20 },
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
      {
        type: "video",
        citation:
          "European Coffee Trip — \"3 Essential Hario V60 Recipes\" (third-party demo of the 4:6 framework with Comandante 23 clicks)",
        url: "https://www.youtube.com/watch?v=P0mI6Ue8BKc",
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
    dose: { grams: 16 },
    water: { grams: 240, ratio: "1:15" },
    temperature: { celsius: 94 },
    grind: {
      referenceGrinder: "EK43",
      referenceSetting: "medium (~780 µm, ≈ Comandante C40 26 clicks per published transcriptions)",
    },
    pourSequence: [
      {
        label: "Pour 1 (0:00, doubles as bloom)",
        action: "pour",
        waterGramsAtEnd: 60,
        durationSec: 10,
        notes: "60 g pour at ~6 g/s.",
      },
      { label: "Wait", action: "wait", durationSec: 8 },
      {
        label: "Pour 2 (0:18)",
        action: "pour",
        waterGramsAtEnd: 140,
        durationSec: 20,
      },
      { label: "Wait", action: "wait", durationSec: 18 },
      {
        label: "Pour 3 (0:56, → 240 g)",
        action: "pour",
        waterGramsAtEnd: 240,
        durationSec: 20,
      },
      { label: "Drawdown (lift by ~2:00)", action: "drain", durationSec: 34 },
    ],
    totalTimeSec: 110,
    techniques: [
      "custom-mineral-water",
      "lean-ratio",
      "fast-brew",
      "flat-bed-extraction",
    ],
    bestFor: {
      roastLevels: ["very-light", "light"],
      processes: ["washed"],
      varieties: ["Gesha", "Geisha", "SL28"],
      goals: ["high-clarity", "sweetness-forward"],
    },
    teaches:
      "How an extremely fast, lean (1:15) brew on Origami Wave with custom low-mineral water produces clarity-first cups in under 2 minutes. Three pours, no bloom hold — the first pour is the bloom.",
    science:
      "Du's water (4 ppm Ca²⁺, 15 ppm Mg²⁺, ~80 ppm TDS) is heavily magnesium-biased — magnesium binds organic acids and amplifies aromatic complexity, while the low calcium prevents the cup from gaining unwanted body that would mask florals. The low-mineral water provides almost zero buffering against acidity; the fast brew preserves Zone-1 aromatic intensity before extraction can reach Zone 3. The Origami's ribbed walls drain fast despite the wave filter's slower base flow, preventing the puck from stalling.",
    whenToUse:
      "For a Gesha or top-tier washed Ethiopian where you want maximum aromatic intensity in a small cup. Requires either championship water or a careful tap-distilled blend.",
    sources: [
      {
        type: "official-competition",
        citation: "2019 World Brewers Cup Final, Berlin",
        year: 2019,
      },
      {
        type: "video",
        citation:
          "Origami official walkthrough — \"ORIGAMI COFFEE BREWER: Recipe by Du JiaNing, 2019 World Champion (Step-By-Step)\" (YouTube)",
        url: "https://www.youtube.com/watch?v=Fl4fuM5bVQU",
      },
      {
        type: "article",
        citation:
          "Sprudge — Du Jianing of China is the 2019 World Brewers Cup Champion",
        url: "https://sprudge.com/du-jianing-of-china-is-the-2019-world-brewers-cup-champion-142739.html",
      },
    ],
    verified: false,
    notes:
      "Demoted to verified:false during the 2026-05 knowledge-layer audit. Previous codebase parameters (20 g : 240 g = 1:12, 4-pour structure, 195 s total) didn't trace to any Du primary source — multiple aggregator transcriptions consistently report 16 g : 240 g (1:15), 3 pours (60 / 80 / 100 g at 0 / 0:18 / 0:56), brew completing by ~1:46–2:00. The previous 'rich 1:12 ratio' teaching framing was downstream of the wrong dose and has been replaced. Niche degree range dropped (derived, not published by Du). Re-promote to verified:true after the Origami official YouTube walkthrough is reviewed end-to-end.",
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
      referenceSetting: "medium-fine (Hsu is the 1Zpresso ZP6 ambassador)",
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
        citation:
          "World Coffee Events — \"Shih Yuan Hsu Sherry, Taiwan — 2022 World Brewers Cup Finals\" (YouTube)",
        url: "https://www.youtube.com/watch?v=sTroaHo5zsk",
        year: 2022,
      },
    ],
    verified: false,
    notes:
      "Demoted to verified:false during the 2026-05 knowledge-layer audit. The two staging temperatures may be 70 / 95 °C (codebase) OR 75 / 93 °C — search excerpts split on this and the WCE final video was not viewable in-session to settle it. Exact pour sequencing (number of post-bloom pours, intervals) also varies in third-party transcriptions. The two-pour structure is the most commonly cited reconstruction but could be three pours. Niche degree range removed (derived, not from Hsu). Re-promote to verified:true after the WCE final video is reviewed end-to-end and the temperature pair is confirmed.",
  },

  // ── 2023 WBrC ──────────────────────────────────────────────────────────────

  {
    id: "wbrc-2023-medina",
    name: "Medina 2023 — Origami Air S Minimum-Variables",
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
      "Origami Air S with conical paper filter, decanted into a Sensory Cup. Brewista kettle for precise pour control. 65 ppm Ca/Mg water. Coffee: Natural Sidra from Café Granja la Esperanza, Colombia.",
    dose: { grams: 15.5 },
    water: { grams: 250, ratio: "1:16.1" },
    temperature: { celsius: 91, rangeC: [90, 92] },
    grind: {
      referenceGrinder: "EK43",
      referenceSetting: "medium",
    },
    pourSequence: [
      {
        label: "Pour 1 (doubles as bloom, 0:00)",
        action: "pour",
        waterGramsAtEnd: 50,
        durationSec: 8,
        notes: "Circular pour, 50 g.",
      },
      { label: "Wait", action: "wait", durationSec: 22 },
      {
        label: "Pour 2 (0:30)",
        action: "pour",
        waterGramsAtEnd: 100,
        durationSec: 8,
      },
      { label: "Wait", action: "wait", durationSec: 22 },
      {
        label: "Pour 3 (1:00)",
        action: "pour",
        waterGramsAtEnd: 150,
        durationSec: 8,
      },
      { label: "Wait", action: "wait", durationSec: 22 },
      {
        label: "Pour 4 (1:30)",
        action: "pour",
        waterGramsAtEnd: 200,
        durationSec: 8,
      },
      { label: "Wait", action: "wait", durationSec: 22 },
      {
        label: "Pour 5 (2:00)",
        action: "pour",
        waterGramsAtEnd: 250,
        durationSec: 8,
      },
      { label: "Drawdown", action: "drain", durationSec: 32 },
    ],
    totalTimeSec: 160,
    techniques: ["lean-ratio", "moderate-temperature", "minimum-variables"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["natural", "honey"],
      varieties: ["Sidra"],
      goals: ["sweetness-forward", "balanced"],
    },
    teaches:
      "How 5 equal 50 g pours at 30-second intervals strip technique as a variable and let a lean ratio (1:16) at moderate 91 °C do the work. Closer to a Rolf-style minimum-variables routine than a phase-separated 4:6.",
    science:
      "Natural Sidra carries strong tropical-fermentation esters. Above ~94 °C they extract aggressively and can read as winey or volatile in the cup. At 91 °C with a lean ratio and even pour cadence, the brew sits in the sugar/maillard zone of Gagné's solubility sequence for longer relative to the early aromatics, producing rounded sweetness rather than fermentation sharpness. The cleaner, longer drawdown of an Origami cone with conical paper further softens the cup compared to a Wave-style flat bottom.",
    whenToUse:
      "For a Natural Sidra or expressive natural processing where you want the sweet character to lead, not the fermentation. Also a sensible default for honey-process medium-light coffees.",
    sources: [
      {
        type: "official-competition",
        citation: "2023 World Brewers Cup Final, Athens",
        year: 2023,
      },
      {
        type: "video",
        citation:
          "World Coffee Events — \"2023 World Brewers Cup Champion Carlos's Recipe\" (YouTube)",
        url: "https://www.youtube.com/watch?v=XQd8ddPKbXU",
        year: 2023,
      },
      {
        type: "article",
        citation:
          "Slow Pour Supply — Recipe Recap: Carlos Medina's WBrC Championship Recipe",
        url: "https://www.slowpoursupply.co/blogs/brew-recipes/recipe-recap-carlos-medina-s-representing-chile-world-brewers-cup-champion-recipe",
      },
    ],
    verified: false,
    notes:
      "Pour sequence (5 × 50 g at 30 s intervals, 2:40 total) is confirmed by multiple sources quoting the Slow Pour Supply recap. Brewer category (Origami Air S with conical paper + Sensory Cup) replaces the earlier 'generic conical paper' framing. Niche degree range removed (no published source); user must calibrate empirically against the 2:40 drawdown target. Keep verified:false until the WCE finals video is reviewed end-to-end.",
  },

  // ── 2024 WBrC ──────────────────────────────────────────────────────────────

  {
    id: "wbrc-2024-wolfl",
    name: "Wölfl 2024 — Orea V4 Fast",
    shortName: "Wölfl 2024",
    attribution: {
      person: "Martin Wölfl",
      title: "2024 World Brewers Cup Champion (Chicago SCA Expo, April 2024)",
      affiliation: "Wildkaffee Austria, Vienna",
      country: "Austria",
      year: 2024,
    },
    category: "championship",
    brewer: "orea-v4-fast",
    brewerNotes:
      "Orea V4 with the Fast bottom (predecessor to the Wide bottom — same fast-draining geometry). Sibarist FAST filter paper. Coffee: natural anaerobic Geisha from Finca Maya, Panama (Lost Origin Coffee Labs).",
    dose: { grams: 17 },
    water: { grams: 270, ratio: "1:15.9" },
    temperature: { celsius: 93 },
    grind: {
      referenceGrinder: "Mazzer ZM",
      referenceSetting: "630 microns",
    },
    pourSequence: [
      {
        label: "Bloom (0:00, → 60 g)",
        action: "pour",
        waterGramsAtEnd: 60,
        durationSec: 10,
      },
      { label: "Bloom rest", action: "wait", durationSec: 30 },
      {
        label: "Pour 2 (0:40, → 120 g)",
        action: "pour",
        waterGramsAtEnd: 120,
        durationSec: 10,
      },
      { label: "Wait", action: "wait", durationSec: 30 },
      {
        label: "Pour 3 (1:20, → 170 g)",
        action: "pour",
        waterGramsAtEnd: 170,
        durationSec: 10,
      },
      { label: "Wait", action: "wait", durationSec: 30 },
      {
        label: "Pour 4 (2:00, → 270 g)",
        action: "pour",
        waterGramsAtEnd: 270,
        durationSec: 20,
      },
      { label: "Drawdown", action: "drain", durationSec: 0 },
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
      "How fast-flowing geometry combined with evenly-cadenced pours can deliver clarity on a natural-anaerobic Geisha — the paradox of agitation producing a clean cup.",
    science:
      "The Orea V4 Fast geometry drains rapidly: the puck never stalls in extended contact. Combined with the four 40-second-spaced pours, total bed-contact time stays in the Zone 1–2 window (organic acids and sugars) and rarely reaches Zone 3 (bitters, phenolics). The result is clarity on a coffee — a natural-anaerobic Panama Geisha — that would muddy under a slower, gentler approach because the fermentation esters never get extended contact time to over-extract. The 1:15.9 ratio is conventional; the technique and the brewer's drain speed are doing the work.",
    whenToUse:
      "For a complex Natural or anaerobic lot where you want clarity rather than fermentation amplification. Excellent on naturals with strong tropical character that would otherwise read as too winey.",
    sources: [
      {
        type: "official-competition",
        citation:
          "2024 World Brewers Cup Final (Chicago SCA Expo, April 2024)",
        year: 2024,
      },
      {
        type: "article",
        citation:
          "European Coffee Trip — Winning Pour Over Recipe from Martin Wölfl",
        url: "https://europeancoffeetrip.com/winning-pour-over-recipe-martin-woelfl/",
      },
      {
        type: "video",
        citation:
          "European Coffee Trip — \"Winning POUR OVER Recipe from World Brewers Cup Champion (Martin Wölfl, Wildkaffee Austria)\" (YouTube)",
        url: "https://www.youtube.com/watch?v=3SIFFaT1MFU",
      },
      {
        type: "article",
        citation: "Sprudge — Martin Wölfl wins the 2024 World Brewers Cup",
        url: "https://sprudge.com/martin-wolfl-wins-the-2024-world-brewers-cup-championship-239423.html",
      },
    ],
    verified: true,
    notes:
      "Pour cadence (bloom 60 g at 0:00 / +60 g at 0:40 / +50 g at 1:20 / +100 g at 2:00) per ECT writeup. Mazzer ZM 630 microns is the published grind; Comandante / Niche translations were unsourced derivations and have been removed. City is Chicago, not Copenhagen (a long-standing codebase error). Coffee is natural anaerobic Geisha, not 'double fermentation' as previously noted.",
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
      "Solo dripper (PCTG plastic, 40° cone angle). Melodrip used over the cone to control agitation on the final pour. Coffee: 94.5-point natural Gesha from Mt Totumas, Panama, prepared at three different roast levels — 5 g of each (light + medium-light + medium of the same green), layered in the brewer. Water: 40 ppm low-mineral.",
    dose: { grams: 15 },
    water: { grams: 210, ratio: "1:14 (excluding the 80 ml preheat which is discarded)" },
    temperature: {
      staged: [
        { pourIndex: 0, celsius: 96, label: "preheat (discarded)" },
        { pourIndex: 1, celsius: 96, label: "pour 1 (hot)" },
        { pourIndex: 2, celsius: 96, label: "pour 2 (hot)" },
        { pourIndex: 3, celsius: 80, label: "pour 3 (cool, via Melodrip)" },
      ],
      rangeC: [80, 96],
    },
    grind: {
      referenceGrinder: "Comandante C40 / EK43 equivalent",
      referenceSetting: "800 microns (medium-coarse)",
    },
    pourSequence: [
      {
        label: "Layer three roasts in the brewer",
        action: "agitate-bed",
        durationSec: 0,
        notes:
          "5 g light, 5 g medium-light, 5 g medium of the same Mt Totumas Panama Gesha. Order of layering is part of the routine.",
      },
      {
        label: "Preheat the dripper (80 ml @ 96 °C, discarded)",
        action: "pour",
        waterGramsAtEnd: 0,
        durationSec: 0,
        notes:
          "80 ml of 96 °C water is poured through the dripper before brewing and discarded. The brewing water count starts after this preheat.",
      },
      {
        label: "Pour 1 (0:00, 30 g @ 96 °C)",
        action: "pour",
        waterGramsAtEnd: 30,
        durationSec: 6,
        temperatureC: 96,
        notes:
          "Three counter-clockwise circles over ~6 s, hitting all three roast layers.",
      },
      {
        label: "Wait",
        action: "wait",
        durationSec: 24,
      },
      {
        label: "Pour 2 (0:30, +90 g → 120 g @ 96 °C)",
        action: "pour",
        waterGramsAtEnd: 120,
        durationSec: 10,
        temperatureC: 96,
      },
      {
        label: "Wait",
        action: "wait",
        durationSec: 30,
      },
      {
        label: "Pour 3 (1:10, +90 g → 210 g @ 80 °C, via Melodrip)",
        action: "melodrip",
        waterGramsAtEnd: 210,
        durationSec: 15,
        temperatureC: 80,
        notes:
          "Cool final pour through Melodrip preserves the fragile Zone 1 aromatics that would dissipate at 96 °C.",
      },
      { label: "Drawdown (lift by ~1:45)", action: "drain", durationSec: 20 },
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
      processes: ["washed", "natural"],
      varieties: ["Gesha", "Geisha"],
      goals: ["high-clarity", "explore"],
    },
    teaches:
      "How to compose a cup as a sequence — different roast levels extract different compounds at different rates, and a hot/hot/cool temperature progression with Melodrip-controlled agitation on the final pour isolates which extraction phase contributes which character.",
    science:
      "Light roast contributes the most acidic, aromatic compounds (Zone 1 dominant). Medium-light contributes sugars and balance. Medium contributes body and roundness. By layering them and using two hot pours followed by a cool final Melodrip pour, Peng compresses what would normally be three separate brews into one. The Melodrip (a perforated disc that diffuses pour flow) eliminates turbulence on the final pour — the three layers stay compositionally distinct rather than mixing late in the brew. 40 ppm low-mineral water provides almost zero buffering against acidity. The cup is served at ~50 °C where retronasal aroma perception is at its peak.",
    whenToUse:
      "Demonstration brewing. Not a daily-driver recipe. Requires three roast levels of the same coffee — impractical for most home setups — but the principles (staged temperature, controlled agitation via Melodrip on a final cool pour, low-mineral water) transfer to single-roast brews.",
    sources: [
      {
        type: "official-competition",
        citation: "2025 World Brewers Cup Final, Jakarta",
        year: 2025,
      },
      {
        type: "article",
        citation:
          "Slow Pour Supply — George Peng's Solo Dripper Recipe (2025 World Brewers Cup Champion)",
        url: "https://www.slowpoursupply.co/blogs/journal/2025-world-brewers-cup-champion-george-pengs-solo-dripper-recipe",
      },
      {
        type: "article",
        citation:
          "Sprudge — How to Brew Coffee Like the 2025 World Brewers Cup Champion",
        url: "https://sprudge.com/how-to-brew-coffee-like-the-2025-world-brewers-cup-champion-338576.html",
      },
      {
        type: "video",
        citation:
          "Solo Dripper YouTube — \"RESEP SOLO DRIPPER JUARA DUNIA WBRC 2025\" (Peng routine walkthrough)",
        url: "https://www.youtube.com/watch?v=2YFEbyoQvuY",
      },
    ],
    verified: false,
    notes:
      "Demoted to verified:false during the 2026-05 knowledge-layer audit. Previous codebase parameters were materially wrong on multiple axes: the '1:4 ratio (60 g water)' interpretation was a misread of the 3-roast layering — actual brewing water is 210 g total (1:14, not 1:4); temperature staging was '96 → 88 → 80 °C' but the actual published recipe is hot/hot/cool (96 / 96 / 80) with no 88 °C middle stage; grind was 'medium-fine' but published value is 800 µm medium-coarse; total time was 2:00 but Slow Pour Supply states ~1:45. The 80 ml preheat-and-discard step was entirely missing. Niche degree range removed (derived). Re-promote to verified:true after the Solo Dripper YouTube routine walkthrough is reviewed end-to-end.",
  },

  // ── 2024 World AeroPress Championship ─────────────────────────────────────

  {
    id: "wac-2024-stanica",
    name: "Stanica 2024 — Inverted AeroPress + Bypass",
    shortName: "Stanica 2024",
    attribution: {
      person: "George Stanica",
      title:
        "2024 World AeroPress Champion (championship held in Lisbon; Stanica is from Bucharest, café Boyo)",
      country: "Romania",
      year: 2024,
    },
    category: "championship",
    brewer: "aeropress",
    brewerNotes:
      "Inverted AeroPress with single rinsed Aesir paper filter. Aquacode mineral water diluted to ~85–90 ppm TDS for extraction; room-temperature 0 ppm water used for the final dilution. Coffee: Ethiopian Guji washed (Arsosala station), roasted by Olisipo, sourced via Cafe Imports.",
    dose: { grams: 18 },
    water: { grams: 100, ratio: "1:5.6 (extraction; diluted to ~1:8.3 in cup)" },
    temperature: { celsius: 96 },
    grind: {
      referenceGrinder: "Comandante C40 Mk4 Red Clix",
      referenceSetting: "58 clicks (≈ 870 µm)",
      description:
        "Medium-coarse. Red Clix has ~50 clicks per turn vs. standard ~30, so 58 Red Clix clicks ≈ 35 standard clicks. The 870 µm figure is what the routine itself specifies; the Comandante click count is the published reference setting.",
    },
    pourSequence: [
      {
        label: "Invert and load",
        action: "invert",
        durationSec: 0,
        notes:
          "Inverted orientation throughout the brew. 18 g dose. Single rinsed Aesir paper in the cap (set aside until press).",
      },
      {
        label: "Pour 1 (0:00, 50 g @ 96 °C)",
        action: "pour",
        waterGramsAtEnd: 50,
        durationSec: 10,
        temperatureC: 96,
      },
      { label: "Bloom rest", action: "wait", durationSec: 20 },
      {
        label: "Pour 2 (0:30, +50 g → 100 g @ 96 °C)",
        action: "pour",
        waterGramsAtEnd: 100,
        durationSec: 10,
        temperatureC: 96,
      },
      {
        label: "NSEW stir (0:42–0:52)",
        action: "stir",
        durationSec: 10,
        notes:
          "Light north-south-east-west stir, not a vortex swirl — keeps the puck uniform without channeling.",
      },
      { label: "Steep", action: "wait", durationSec: 28 },
      {
        label: "Cap and de-air (1:20)",
        action: "agitate-bed",
        durationSec: 15,
        notes:
          "Seat the cap (with rinsed Aesir filter) and gently de-air. No flip — the AeroPress is already inverted.",
      },
      {
        label: "Press (~1:35, slow press over 30–40 s)",
        action: "press",
        durationSec: 35,
        notes:
          "Slow press from the already-inverted position. The press yields ~76–79 g of concentrate.",
      },
      {
        label: "Dilute with warm water (~30–40 g)",
        action: "bypass",
        waterGramsAtEnd: 115,
        durationSec: 5,
        notes:
          "Warm water dilution brings the cup from concentrate strength toward drinking strength.",
      },
      {
        label: "Final dilution with room-temp 0 ppm water (~30 g)",
        action: "bypass",
        waterGramsAtEnd: 145,
        durationSec: 5,
        notes:
          "Final ~30 g of room-temperature 0 ppm water lands the cup at ~150 g served. The two-step dilution (warm then cool) lets Stanica tune both temperature and concentration independently.",
      },
    ],
    totalTimeSec: 135,
    techniques: [
      "inverted-aeropress",
      "concentrate-and-bypass",
      "high-temperature-extraction",
      "mid-mineral-water",
      "two-step-dilution",
    ],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed", "natural", "honey"],
      goals: ["high-clarity", "balanced", "explore"],
    },
    teaches:
      "How concentrate-and-bypass separates extraction from dilution. Over-pull a tight, intense concentrate at the extraction stage, then dial the cup back to drinking strength and temperature with two-step dilution (warm water + 0 ppm water).",
    science:
      "At 1:5.6 extraction the AeroPress extracts deeply into Zone 2 (sugars, maillard) without the diluted, watery cup that a 1:16 brew would produce. The bypass water then adjusts cup weight and temperature — adding water doesn't extract anything (the puck is already pressed), it only changes concentration. 85–90 ppm mineral water is in the SCA sweet spot for clarity-with-body. Aesir paper retains more oils than standard AeroPress paper, pushing the cup toward filter-cup clarity rather than the typical AeroPress mouthfeel.",
    whenToUse:
      "For an AeroPress brew where you want filter-style clarity at the strength of a concentrated extraction. Excellent for competition-grade light roasts where standard AeroPress recipes feel under-extracted.",
    sources: [
      {
        type: "official-competition",
        citation: "2024 World AeroPress Championship, Lisbon",
        year: 2024,
      },
      {
        type: "article",
        citation:
          "aeropress.com — 1st place 2024 World AeroPress Championship recipe (George Stanica, Romania)",
        url: "https://aeropress.com/blogs/w-a-c-aeropress-recipes/1st-george-stanica-romania-2024",
      },
      {
        type: "article",
        citation:
          "World AeroPress Championship — 1st place George Stanica 2024",
        url: "https://worldaeropresschampionship.com/pages/1st-george-stanica-romania-2024",
      },
      {
        type: "video",
        citation:
          "World AeroPress Championship — \"1st Place 2024 World AeroPress Championship Recipe\" (YouTube)",
        url: "https://www.youtube.com/watch?v=1qgL4IWr3-k",
      },
    ],
    verified: false,
    notes:
      "Demoted to verified:false during the 2026-05 knowledge-layer audit. Previous codebase parameters were materially wrong: location was 'Bucharest' but WAC 2024 was held in Lisbon (Stanica's café Boyo is in Bucharest); water structure was '120 g extraction + 80 g bypass = 200 g' but the published recipe is 50 g + 50 g = 100 g extraction water, diluted in two stages to ~150 g final drink; pour sequence said 'cap, flip, and press' but the brewer is already inverted — there is no flip. Aesir filter is single rinsed (not 'off'). Niche degree range removed (derived from the Red Clix translation, not from Stanica). Re-promote to verified:true after the WAC official YouTube recipe is reviewed end-to-end.",
  },
];
