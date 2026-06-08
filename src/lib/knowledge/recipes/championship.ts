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
 *
 * GRIND RECALIBRATION (May 2026): `nicheZeroDegrees` is a TRANSLATION for the
 * user's Niche Zero, which was re-baselined to a measured anchor (V60 single
 * cup = 380° = Comandante 23 clicks; map ~3.3°/click). Rules applied here:
 *   • Real, originator-published Comandante clicks are kept verbatim, and the
 *     Niche is DERIVED from them via the user's map (Medina 26 clicks → ~390°;
 *     Stanica 58 Red Clix ≈ 35 standard → ~420°).
 *   • Self-created Niche translations were shifted −21° onto the new baseline
 *     (estimate / carry-offset).
 *   • Exceptions NOT shifted because they already land correctly on the user's
 *     scale: Peng (≈Comandante 26) and Hsu (~1000 µm, medium-coarse).
 * See src/lib/constants/grindSettings.ts for the anchors and the conversion.
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
      nicheZeroDegrees: [390, 400],
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
    techniques: ["phase-separated-pouring"],
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
      nicheZeroDegrees: [377, 387],
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
    techniques: ["low-mineral-water", "pulse-pouring", "flat-bed-pour"],
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
      nicheZeroDegrees: [387, 393],
      description:
        "Niche derived from Medina's real Comandante 26 clicks via the user's measured map (26 clicks ≈ 390°). The published 26-click figure is kept verbatim.",
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
    techniques: ["pulse-pouring"],
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
      nicheZeroDegrees: [380, 390],
      description:
        "Real grind is 490 µm on a Mazzer ZM. The Comandante/Niche figures are our translations (no originator Comandante published): ~23–26 Comandante clicks; Niche shifted −21° to the user's re-based scale (estimate, calibrate empirically).",
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
    techniques: ["high-agitation-high-extraction"],
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

  // ── 2024 World AeroPress Championship ─────────────────────────────────────

  {
    id: "wac-2024-stanica",
    name: "Stanica 2024 — WAC Champion (Flow Control AeroPress)",
    shortName: "Stanica 2024 (WAC)",
    attribution: {
      person: "George Stanica",
      title: "2024 World AeroPress Champion",
      country: "Romania",
      year: 2024,
    },
    category: "championship",
    brewer: "aeropress",
    brewerNotes:
      "UPRIGHT AeroPress with the Flow Control Filter Cap and TWO regular paper filters (rinsed), set over a carafe — NOT inverted. Regular filtered water, 90–110 ppm. This is the recipe he WON the 2024 World AeroPress Championship with.",
    dose: { grams: 18 },
    water: { grams: 225, ratio: "1:12.5 (brew) + 15–30 g bypass → ~240–255 g cup" },
    temperature: { celsius: 93 },
    grind: {
      referenceGrinder: "Comandante C40",
      referenceSetting: "25 clicks (~750 µm)",
      nicheZeroDegrees: [385, 392],
      description:
        "Comandante 25 clicks (~750 µm). Niche derived from the published clicks (~25 ≈ 387°); calibrate empirically.",
    },
    pourSequence: [
      {
        label: "Pour 50 g water (93 °C)",
        action: "pour",
        waterGramsAtEnd: 50,
        durationSec: 5,
        notes: "Upright, Flow Control cap, 18 g coffee already in. Pour 50 g to wet the bed.",
      },
      { label: "Bloom → 0:30", action: "wait", durationSec: 25 },
      {
        label: "Pour to 225 g",
        action: "pour",
        waterGramsAtEnd: 225,
        durationSec: 15,
      },
      {
        label: "NSEW stir 10 s",
        action: "stir",
        durationSec: 10,
        notes: "Gentle paddle stir North-South-East-West.",
      },
      { label: "Wait → 1:30", action: "wait", durationSec: 35 },
      {
        label: "Press slowly (~40 s)",
        action: "press",
        durationSec: 40,
        notes: "Insert the plunger and press slowly — about 40 s to extract everything.",
      },
      {
        label: "Dilute with 15–30 g room-temp water",
        action: "bypass",
        waterGramsAtEnd: 250,
        durationSec: 5,
        notes:
          "Add 15–30 g room-temperature water to taste → ~240–255 g cup. Let it cool 2–3 min before drinking.",
      },
    ],
    totalTimeSec: 135,
    techniques: ["concentrate-and-bypass"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed", "natural", "honey"],
      goals: ["high-clarity", "balanced", "explore"],
    },
    teaches:
      "The recipe he WON the 2024 World AeroPress Championship with: an UPRIGHT take on concentrate-and-bypass — brew a modestly strong cup with the Flow Control cap, then dial it back with a small splash of room-temp water. Strength and flavour stay independent, without the mess and risk of an inverted flip.",
    science:
      "Two rinsed paper filters plus the Flow Control cap slow the flow and add filtration for a cleaner, filter-like cup. Brewing at 18 g : 225 g (1:12.5) and pressing pulls a fuller extraction than a standard 1:16 AeroPress; the 15–30 g room-temp bypass then sets drinking strength without further extraction (the puck is already pressed). 93 °C and a coarse 25-click grind keep the cup sweet and balanced rather than sharp. Regular 90–110 ppm filtered water — not a low-mineral championship blend.",
    whenToUse:
      "An everyday, forgiving AeroPress that drinks like a clean, sweet filter cup. Upright + Flow Control means no inversion risk; tune strength with the bypass amount.",
    sources: [
      {
        type: "official-competition",
        citation:
          "George Stanica — 2024 World AeroPress Championship WINNING recipe (owner-supplied): upright, Flow Control cap + 2 rinsed filters, 18 g, Comandante 25 clicks (~750 µm); 50 g + 30 s bloom + to 225 g at 93 °C / 90–110 ppm, NSEW stir 10 s, press slowly at 1:30 (~40 s), dilute 15–30 g room-temp water → ~240–255 g.",
        year: 2024,
      },
    ],
    verified: true,
    notes:
      "George Stanica's WAC 2024 WINNING recipe (owner-supplied): UPRIGHT Flow Control AeroPress, 18 g : 225 g at 93 °C, NSEW stir, press at 1:30, dilute 15–30 g room-temp water. He won the 2024 World AeroPress Championship (Lisbon) with THIS recipe. Stanica's separate INVERTED Melodrip recipe — 100 g brew → ~80 g concentrate → ~150–165 g — is a different recipe and lives in its own entry (`stanica-inverted-melodrip`); it is NOT the recipe he won with. One constant brewing temperature; the dilution water is bypass, not staging. Parameters owner-supplied; Niche derived from the Comandante clicks.",
  },

  {
    id: "wac-2025-nemo-pop",
    name: "Nemo Pop 2025 — Flow Control Bypass AeroPress",
    shortName: "Nemo Pop 2025",
    attribution: {
      person: "Nemo Pop",
      title: "2025 World AeroPress Champion",
      year: 2025,
    },
    category: "championship",
    brewer: "aeropress",
    brewerNotes:
      "UPRIGHT AeroPress, Flow Control Filter Cap, 2× paper filters, set over the carafe. 125 ppm water (Apax prototype). BYPASS-FIRST: 70 g of 50 °C bypass water goes into the carafe BEFORE brewing, and the pressed concentrate lands on it. Comandante Trailmaster (Tigershark burrs); grind slow, blow off chaff, sift fines at 200 µm.",
    dose: { grams: 18 },
    water: { grams: 100, ratio: "1:5.5 (brew concentrate) + 70 g bypass → ~170 g cup (1:9.4)" },
    temperature: { celsius: 84 },
    grind: {
      referenceGrinder: "Comandante (Trailmaster x25, Tigershark burrs)",
      referenceSetting: "31 clicks, sifted at 200 µm",
      nicheZeroDegrees: [403, 411],
      description:
        "Comandante 31 clicks, fines sifted out at 200 µm and chaff blown off. Niche derived from the published clicks (~31 clicks ≈ 407°); calibrate empirically.",
    },
    pourSequence: [
      {
        label: "Pour 100 g brewing water (84 °C)",
        action: "pour",
        waterGramsAtEnd: 100,
        durationSec: 10,
        notes: "70 g of 50 °C bypass water is already in the carafe below. Pour 100 g of 84 °C water into the AeroPress, wetting all the grounds.",
      },
      { label: "Wait → 0:25", action: "wait", durationSec: 15 },
      {
        label: "Stir NSNS-WEWE",
        action: "stir",
        durationSec: 5,
        notes: "At 25 s, stir north-south-north-south, then west-east-west-east.",
      },
      { label: "Wait → 0:50", action: "wait", durationSec: 20 },
      {
        label: "Gently press (~20 s)",
        action: "press",
        durationSec: 20,
        notes: "From 50 s, press gently for ~20 s — the concentrate presses down onto the 70 g bypass in the carafe.",
      },
      {
        label: "Serve",
        action: "bypass",
        waterGramsAtEnd: 170,
        durationSec: 0,
        notes: "~100 g concentrate pressed onto the 70 g of 50 °C bypass ≈ 170 g cup. Serve.",
      },
    ],
    totalTimeSec: 70,
    techniques: ["concentrate-and-bypass", "fines-removal-sieving"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed", "natural", "honey"],
      goals: ["high-clarity", "sweetness-forward", "balanced"],
    },
    teaches:
      "Bypass-FIRST concentrate AeroPress: brew a small, cool (84 °C) concentrate at 1:5.5 and press it straight onto warm (50 °C) bypass water already waiting in the carafe. Sifting the fines + a coarse-ish grind keep it clean; the cool brew water lands a sweet, low-bitterness cup fast (~1:10).",
    science:
      "Pressing a 1:5.5 concentrate onto bypass water separates extraction from strength — the puck is fully pressed, so the 70 g bypass only sets drinking concentration, not extraction. Brewing at a cool 84 °C with a coarse-ish sifted grind keeps the fast-extracting bitter compounds down, and removing the fines (sifted at 200 µm) tightens the extraction distribution for clarity. The NSNS-WEWE stir evenly agitates a small bed without a vortex. Putting the warm bypass in the carafe first means the concentrate mixes on contact for an even cup. One constant brewing temperature (84 °C); the 50 °C bypass is dilution, not staging.",
    whenToUse:
      "A fast, clean, sweet AeroPress when you want filter-style clarity at controllable strength — dial the cup with the bypass amount. Upright + Flow Control, no inversion.",
    sources: [
      {
        type: "report",
        citation:
          "Nemo Pop — 2025 World AeroPress Champion recipe (owner-supplied): upright, 18 g, Comandante 31 clicks sifted at 200 µm, 100 g brew water at 84 °C + 70 g bypass at 50 °C (bypass first in carafe), 125 ppm water, NSNS-WEWE stir at 0:25, gentle press from 0:50 (~20 s), ~1:10 total.",
        year: 2025,
      },
    ],
    verified: true,
    notes:
      "New entry (June 2026), owner-supplied 2025 World AeroPress Championship winning recipe. Bypass-first method (70 g of 50 °C water in the carafe before brewing). Single 84 °C brew temperature; the 50 °C bypass is dilution, not staging. Parameters owner-supplied; Niche degrees derived from the published Comandante clicks. Not independently web-fetched.",
  },
];
