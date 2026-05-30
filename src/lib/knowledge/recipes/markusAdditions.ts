import type { Recipe } from "./types";

/**
 * Markus Additions — May 2026 (Pending Audit).
 *
 * 51 recipes researched in-session and reformatted to the file standard
 * (48 batch + 3 Moccamaster). All carry `category: "experimental"` because
 * they are pending audit. MOST are `verified: false` — parameters come from
 * competition recipe databases (1Zpresso, WAC official, Sprudge), roastery
 * brewguides, or other named-secondary sources. Where the originator's own
 * primary publication was content-cross-checked in-session, the entry is
 * `verified: true`.
 *
 * Grind degrees: only Bülow 2023 publishes a real Comandante click count
 * (32 clicks) → derived from the user's measured Niche↔Comandante map
 * (niche = round(380 + (clicks − 23) × 3.333)). Every other entry shows
 * "calibrate empirically" with only a grind-feel description, so its Niche
 * range is an ESTIMATE from grind feel (flagged in `grind.description`).
 */
export const MARKUS_ADDITIONS: Recipe[] = [
  // ── AeroPress ────────────────────────────────────────────────────────────

  {
    id: "pop-2025-flow-control-aeropress",
    name: "Pop 2025 — Flow Control AeroPress",
    shortName: "Pop 2025",
    attribution: {
      person: "Némo Pop",
      title: "World AeroPress Championship Winner",
      country: "Australia",
      year: 2025,
    },
    category: "experimental",
    brewer: "aeropress",
    brewerNotes:
      "AeroPress upright with Flow Control Filter Cap + 2× paper filter (rinsed). Comandante Trailmaster x25 Tigershark grinder at 31 clicks, then sifted to 200 µm (microfines removed). Apax Labs prototype water at ~125 ppm. Varia Aura Smart kettle.",
    dose: { grams: 18 },
    water: { grams: 100, ratio: "1:9.4 brew, 1:5.6 effective" },
    temperature: { staged: [{ pourIndex: 0, celsius: 84, label: "brew" }, { pourIndex: 1, celsius: 50, label: "cold bypass" }] },
    grind: {
      referenceGrinder: "Comandante Trailmaster x25 Tigershark",
      referenceSetting: "31 clicks, sifted ≥200 µm (microfines removed)",
      nicheZeroDegrees: [368, 382],
      description:
        "fine-medium, sifted ≥200 µm (estimate from grind description, not published — Tigershark burrs not on the user's Niche↔Comandante map)",
    },
    pourSequence: [
      { label: "Prep", action: "wait", durationSec: 0, notes: "70g bypass water @50°C in carafe; sift coffee" },
      { label: "Assemble", action: "wait", durationSec: 0, notes: "AP on carafe, sifted coffee in chamber" },
      { label: "Pour brew water", action: "pour", waterGramsAtEnd: 100, durationSec: 10, temperatureC: 84, notes: "Wet all grounds." },
      { label: "Stir NSNS-WEWE", action: "stir", durationSec: 5 },
      { label: "Gentle press", action: "press", durationSec: 20 },
      { label: "Cold bypass in carafe", action: "bypass", durationSec: 0, temperatureC: 50, notes: "70g bypass water @50°C already in the carafe — concentrate drains into it" },
    ],
    totalTimeSec: 70,
    techniques: ["concentrate-and-bypass", "fines-removal-sieving", "flow-control-cap"],
    bestFor: {
      roastLevels: ["very-light", "light"],
      processes: ["washed", "natural"],
      varieties: ["Gesha", "Geisha", "SL28"],
      goals: ["high-clarity"],
    },
    teaches:
      "State-of-the-art 2025 AeroPress: Flow Control Filter Cap replaces press-skill, 200 µm sift replaces grind-distribution tolerance, cold bypass in the carafe (not in the cup). Fast — total ~1:10.",
    science:
      "The Flow Control Cap regulates drawdown rate independent of plunger pressure, so the brew completes consistently. Sifting removes the fines that would cause uneven extraction. The 50°C bypass dilutes the concentrate without further extraction. Net: high-clarity, repeatable cup with very low operator variance.",
    whenToUse:
      "Modern competition-style cup. Light-roast geishas or top-tier washed where you want maximum repeatability and clarity.",
    sources: [
      { type: "official-competition", citation: "World AeroPress Championship official record — WAC 2025 entry", url: "https://worldaeropresschampionship.com/pages/recipes", year: 2025 },
    ],
    verified: false,
    notes: "Niche range estimated from the grind-feel description (fine-medium, sifted ≥200 µm) — the Tigershark burrs are not on the user's Niche↔Comandante calibration, so the click count does not map.",
  },

  {
    id: "karabinos-2014-cold-hot-aeropress",
    name: "Karabinos 2014 — Cold-Hot AeroPress",
    shortName: "Karabinos AP",
    attribution: {
      person: "Martin Karabinos",
      title: "2nd place WAC 2014",
      year: 2014,
    },
    category: "experimental",
    brewer: "aeropress",
    brewerNotes:
      "AeroPress upright, paper filter. EK43 at 6.2. Cold-bloom at 35°C for 3 minutes, then hot finish at 92°C.",
    dose: { grams: 18.5 },
    water: { grams: 215, ratio: "1:11.6" },
    temperature: { staged: [{ pourIndex: 0, celsius: 35, label: "cold bloom 3 min" }, { pourIndex: 1, celsius: 92, label: "hot finish" }] },
    grind: {
      referenceGrinder: "EK43",
      referenceSetting: "6.2",
      nicheZeroDegrees: [368, 380],
      description: "medium-fine equivalent (estimate from grind description, not published — EK43 setting not on the user's Niche map)",
    },
    pourSequence: [
      { label: "Add cold water", action: "pour", waterGramsAtEnd: 80, durationSec: 0, temperatureC: 35, notes: "80g water @35°C" },
      { label: "Stir well", action: "stir", durationSec: 5 },
      { label: "Close AP, rest 3 min", action: "wait", durationSec: 180 },
      { label: "Add hot water", action: "pour", waterGramsAtEnd: 215, durationSec: 0, temperatureC: 92, notes: "135g @92°C" },
      { label: "Stir 1×", action: "stir", durationSec: 5 },
      { label: "Slow press", action: "press", durationSec: 30 },
    ],
    totalTimeSec: 210,
    techniques: ["staged-temperature", "cold-bloom", "low-temp-long-steep"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed", "natural", "honey"],
      goals: ["aromatic", "sweetness-forward"],
    },
    teaches:
      "A cold soak followed by a hot finish in the same chamber — only Cold-Hot hybrid in the WAC canon. Cold extracts sweetness softly; the hot pour then drives the acids and aromatics.",
    science:
      "At 35°C over 3 min, only the most-soluble sweet compounds enter solution — no Zone-3 bitterness, no aromatic loss to evaporation. The 92°C hot finish then extracts the brighter acids and the volatile aromatics that need heat to come into solution. Two extraction regimes stacked into one cup.",
    whenToUse:
      "A washed African or fermentation-driven coffee where you want sweetness as the floor but still need brightness on top.",
    sources: [
      { type: "official-competition", citation: "World AeroPress Championship official record — WAC 2014 entry", year: 2014 },
    ],
    verified: false,
    notes: "Niche range estimated from the grind-feel description (EK43 6.2 ≈ medium-fine) — EK43 dial is not on the user's Niche↔Comandante calibration.",
  },

  {
    id: "jura-2009-ultra-short-aeropress",
    name: "Jura 2009 — Ultra-Short AeroPress",
    shortName: "Jura 2009",
    attribution: {
      person: "Lukasz Jura",
      title: "World AeroPress Champion 2009",
      year: 2009,
    },
    category: "experimental",
    brewer: "aeropress",
    brewerNotes:
      "AeroPress inverted, paper filter (pre-soaked). Slightly coarser than filter grind. Total contact time ~15 seconds.",
    dose: { grams: 19.5 },
    water: { grams: 200, ratio: "1:10" },
    temperature: { celsius: 75 },
    grind: {
      referenceSetting: "slightly coarser than filter",
      nicheZeroDegrees: [388, 398],
      description: "slightly coarser than filter (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Coffee + water", action: "pour", waterGramsAtEnd: 200, durationSec: 0, temperatureC: 75, notes: "200ml @75°C onto 19.5–20g coffee" },
      { label: "Stir 4×", action: "stir", durationSec: 3 },
      { label: "Secure filter, turn", action: "invert", durationSec: 7, notes: "stop, secure filter, flip the brewer" },
      { label: "Press and serve", action: "press", durationSec: 5 },
    ],
    totalTimeSec: 15,
    techniques: ["aeropress-inversion", "low-temp-long-steep", "short-contact"],
    bestFor: {
      roastLevels: ["very-light", "light"],
      processes: ["washed"],
      varieties: ["Gesha", "Geisha", "SL28", "Heirloom"],
      goals: ["aromatic"],
    },
    teaches:
      "Ultra-short contact extracts a radically different compound set: low temperature (75°C) + extreme 1:10 strength + 4 stirs + 10s press. Selective aromatic compound extraction — the cup is highly concentrated but spec-narrow.",
    science:
      "Below 80°C, the most volatile aromatic compounds dissolve (they're highly soluble) but the slower-extracting body/bitter compounds barely engage. ~15 s contact is too short for over-extraction even at 1:10. Result: aromatic-forward, fruity, very specific cup.",
    whenToUse:
      "Highly aromatic washed lots (Yirgacheffe, Ethiopia Heirloom, Geshas) where you want to isolate the aromatic top notes without any depth at all.",
    sources: [
      { type: "official-competition", citation: "World AeroPress Championship official record — WAC 2009 entry", year: 2009 },
    ],
    verified: false,
    notes: "Dose is a range 19.5–20 g; main dose taken as 19.5 g. Niche range estimated from the grind-feel description.",
  },

  {
    id: "zhang-2018-coarse-espresso-fine-spike",
    name: "Zhang 2018 — Coarse + Espresso-Fine Spike",
    shortName: "Zhang 2018",
    attribution: {
      person: "Xiaobo Zhang",
      title: "2nd place WAC 2018",
      year: 2018,
    },
    category: "experimental",
    brewer: "aeropress",
    brewerNotes:
      "AeroPress inverted, Kalita 95 mm paper (rinsed cold). DM Grinder 2 at 10/10 (very coarse) for the main 30 g + espresso-fine spike of 1 g. Brita-filtered water.",
    dose: { grams: 30 },
    water: { grams: 220, ratio: "1:9 final drink (30 g : 270 g total, incl. 50 g bypass)" },
    temperature: { celsius: 80 },
    grind: {
      referenceGrinder: "DM Grinder 2",
      referenceSetting: "10/10 (very coarse) for the main 30 g + espresso-fine for the 1 g spike",
      nicheZeroDegrees: [404, 418],
      description: "very coarse (main) + espresso-fine (1 g spike) (estimate from grind description, not published — range covers the coarse main bed)",
    },
    pourSequence: [
      { label: "Coarse coffee in chamber", action: "wait", durationSec: 0, notes: "30g coarse coffee" },
      { label: "Pour", action: "pour", waterGramsAtEnd: 100, durationSec: 15, notes: "100g water over 15s" },
      { label: "Stir", action: "stir", durationSec: 5 },
      { label: "Top up to 170g", action: "pour", waterGramsAtEnd: 170, durationSec: 5 },
      { label: "Add espresso-fine spike", action: "agitate-bed", durationSec: 5, notes: "+1g espresso-fine grind" },
      { label: "Cap, flip, press", action: "press", durationSec: 45 },
      { label: "Top-up in server", action: "bypass", waterGramsAtEnd: 270, durationSec: 5, notes: "+50g water in server" },
    ],
    totalTimeSec: 90,
    techniques: ["dual-grind-spike", "aeropress-inversion", "concentrate-and-bypass"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["any"],
      goals: ["body-forward", "sweetness-forward"],
    },
    teaches:
      "Dual-grind TDS spike — coarse main extracts cleanly without bitterness, then a tiny espresso-fine spike contributes body and concentration. The espresso fines extract much faster than the coarse main, so a 1 g spike adds disproportionate body.",
    science:
      "Coarse grind = clean cup but lean body. Adding even a small amount of very-fine grind raises TDS measurably (fines extract fast) without dragging through enough bitter Zone-3 compounds to muddy. The 80°C temperature keeps the spike's bitterness in check.",
    whenToUse:
      "When you want a clean coffee with more body than a coarse-only brew gives — but don't want to grind everything finer (which would extract too aggressively at the main bed).",
    sources: [
      { type: "official-competition", citation: "World AeroPress Championship official record — WAC 2018 entry", year: 2018 },
    ],
    verified: false,
    notes: "Compound recipe — three numbers to read carefully. Dose is 30 g coarse main + a 1 g espresso-fine spike (31 g total coffee); the 30 g main lives in dose.grams, the spike lives in the pour sequence. Water is 220 g brew + 50 g bypass = 270 g total. The published ratio \"1:9\" is the final drink ratio (30 g coffee : 270 g total water); the brew ratio (30 g : 220 g) is closer to 1:7.3, and the cup ratio inc. spike (31 g : 270 g) is ~1:8.7. Niche range estimated from the coarse-grind feel.",
  },

  {
    id: "miczka-2017-concentrate-heavy-bypass",
    name: "Miczka 2017 — Concentrate + Heavy Bypass",
    shortName: "Miczka AP",
    attribution: {
      person: "Paulina Miczka",
      title: "World AeroPress Champion 2017",
      year: 2017,
    },
    category: "experimental",
    brewer: "aeropress",
    brewerNotes:
      "AeroPress inverted, paper filter pre-wet. Heavy 35 g dose for high concentrate, then diluted with 160–200 g hot bypass. Target concentrate TDS ~4.5%.",
    dose: { grams: 35 },
    water: { grams: 370, ratio: "1:10.6 brew, 1:15–17 final" },
    temperature: { celsius: 84 },
    grind: {
      referenceSetting: "8/10 on a generic scale (medium-fine equivalent)",
      nicheZeroDegrees: [368, 380],
      description: "medium-fine equivalent (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Coffee + water in inverted AP", action: "pour", waterGramsAtEnd: 150, durationSec: 15, notes: "35g coffee + 150g water" },
      { label: "Stir continuously", action: "stir", durationSec: 20 },
      { label: "Cap (pre-wet filter)", action: "wait", durationSec: 30 },
      { label: "Flip, start press", action: "press", durationSec: 30 },
      { label: "Press done", action: "wait", durationSec: 0, notes: "~90 ml concentrate at ~4.5% TDS" },
      { label: "Bypass dilution", action: "bypass", durationSec: 0, notes: "+160–200g hot water to target strength" },
    ],
    totalTimeSec: 95,
    techniques: ["concentrate-and-bypass", "aeropress-inversion"],
    bestFor: {
      roastLevels: ["light", "medium-light", "medium"],
      processes: ["any"],
      goals: ["sweetness-forward", "body-forward"],
    },
    teaches:
      "Concentrate-then-dilute philosophy. Extraction and final strength are completely decoupled — brew super-strong, then dilute to the desired drink. Same logic as Stanica's V60 + bypass technique.",
    science:
      "Heavy 35 g dose at 1:10.6 maximises extraction efficiency per gram, pulling more aromatic and sweet compounds. Hot bypass dilutes without continuing to extract. The final cup tastes both denser AND smoother than a 1:15 single-stage brew of the same coffee.",
    whenToUse:
      "When you want depth + clarity simultaneously, and a conventional 1:15 AeroPress feels too thin or one-dimensional.",
    sources: [
      { type: "official-competition", citation: "World AeroPress Championship official record — WAC 2017 entry", year: 2017 },
    ],
    verified: false,
    notes: "Water 370 g is the brew water; the 160–200 g bypass is added on top. Niche range estimated from the grind-feel description.",
  },

  {
    id: "bulow-2023-boiling-aggression-aeropress",
    name: "Bülow 2023 — Boiling Aggression AeroPress",
    shortName: "Bülow AP",
    attribution: {
      person: "Carlo Graf Bülow",
      title: "2nd place WAC 2023",
      country: "Germany",
      year: 2023,
    },
    category: "experimental",
    brewer: "aeropress",
    brewerNotes:
      "AeroPress inverted, 2× classic paper filters. Comandante C40 at 32 clicks. Lotus Water (5 Mg / 4 Ca / 5 So / 3 Po). Boiling water 100°C straight from the kettle.",
    dose: { grams: 18 },
    water: { grams: 160, ratio: "1:8.3 final" },
    temperature: { celsius: 100 },
    grind: {
      referenceGrinder: "Comandante C40",
      referenceSetting: "32 clicks",
      nicheZeroDegrees: [406, 414],
      description: "medium (derived from Comandante C40 @ 32 clicks via the user's measured Niche↔Comandante map: niche ≈ 380 + (32−23)×3.333 = 410°)",
    },
    pourSequence: [
      { label: "Bloom", action: "pour", waterGramsAtEnd: 50, durationSec: 5, temperatureC: 100, notes: "50g water + 18g coffee" },
      { label: "32× very fast stirs", action: "stir", durationSec: 15 },
      { label: "Pour to 160g + rinse filter", action: "pour", waterGramsAtEnd: 160, durationSec: 30, temperatureC: 100 },
      { label: "Cap on", action: "wait", durationSec: 25 },
      { label: "Flip on server", action: "flip", durationSec: 10 },
      { label: "Slow push (yield ~135g)", action: "press", durationSec: 15 },
      { label: "Dilute + aerate", action: "bypass", durationSec: 0, notes: "dilute to 150g with room-temp water; pour back-and-forth 10× between two servers to aerate + cool" },
    ],
    totalTimeSec: 110,
    techniques: ["boiling-water-coarse-grind", "high-agitation-high-extraction", "aeropress-inversion", "aeration-cooling"],
    bestFor: {
      roastLevels: ["medium-light", "medium"],
      processes: ["washed", "natural"],
      goals: ["body-forward", "sweetness-forward"],
    },
    teaches:
      "Max-aggression school — boiling 100°C + 32× ultra-fast stir + back-and-forth pour-aeration. Direct philosophical opposite of Wendelboe-purist 3×-stir technique. Both win championships.",
    science:
      "100°C drives every soluble compound into solution at max rate. 32× highspeed stirs guarantee complete bed agitation. Back-and-forth pouring between servers aerates the brew (releases volatile bitterness) and cools it. Net: heavy extraction without the bitter pickup that aggression normally brings.",
    whenToUse:
      "Medium-roast or sweet-fermentation lots where you want maximum body and want to push extraction far. Not for delicate florals.",
    sources: [
      { type: "official-competition", citation: "World AeroPress Championship official record — WAC 2023 entry", year: 2023 },
    ],
    verified: false,
    notes: "Niche range DERIVED from the published Comandante C40 @ 32 clicks using the user's measured map (≈410°). Brew water 160 g; final ≈150 g after room-temp dilution.",
  },

  {
    id: "jamika-2024-triple-temperature-aeropress",
    name: "Jamika 2024 — Triple-Temperature AeroPress",
    shortName: "Jamika AP",
    attribution: {
      person: "Mahmoud Jamika",
      title: "3rd place WAC 2024",
      country: "Egypt",
      year: 2024,
    },
    category: "experimental",
    brewer: "aeropress",
    brewerNotes:
      "AeroPress inverted, 2× paper filters (rinsed hot). Comandante MK4 ~900 µm. TWW Light Roast water profile. Three temperature stages: 80°C bloom → 75°C main → room-temp finish.",
    dose: { grams: 18 },
    water: { grams: 180, ratio: "1:10" },
    temperature: { staged: [{ pourIndex: 0, celsius: 80, label: "bloom" }, { pourIndex: 1, celsius: 75, label: "main" }, { pourIndex: 2, celsius: 22, label: "room-temp finish" }] },
    grind: {
      referenceGrinder: "Comandante MK4",
      referenceSetting: "~900 µm (very coarse)",
      nicheZeroDegrees: [404, 414],
      description: "~900 µm, very coarse (estimate from grind description, not published — particle-size spec, no click count to map)",
    },
    pourSequence: [
      { label: "Coffee in inverted AP", action: "wait", durationSec: 0, notes: "18g coffee" },
      { label: "Bloom pour", action: "pour", waterGramsAtEnd: 50, durationSec: 5, temperatureC: 80, notes: "50ml @80°C" },
      { label: "Stir 5× circular", action: "stir", durationSec: 5 },
      { label: "Bloom 1 min", action: "wait", durationSec: 50 },
      { label: "Main pour, cap firm", action: "pour", waterGramsAtEnd: 150, durationSec: 5, temperatureC: 75, notes: "100ml @75°C" },
      { label: "Release half the trapped air", action: "wait", durationSec: 3 },
      { label: "Stir 20× circular (swirl)", action: "swirl", durationSec: 12 },
      { label: "Flip, slow press", action: "press", durationSec: 30 },
      { label: "Room-temp balance pour", action: "bypass", waterGramsAtEnd: 180, durationSec: 5, temperatureC: 22, notes: "+30ml room-temp water to balance" },
    ],
    totalTimeSec: 120,
    techniques: ["staged-temperature", "aeropress-inversion", "aroma-preservation"],
    bestFor: {
      roastLevels: ["very-light", "light"],
      processes: ["washed", "natural"],
      varieties: ["Gesha", "Heirloom"],
      goals: ["aromatic", "sweetness-forward"],
    },
    teaches:
      "Three-stage temperature regression within a single brew — 80°C bloom protects aromatics, 75°C main does the bulk extraction, room-temp finish locks aromatics and balances. Only WAC recipe with three distinct in-brew temperatures (not just a bypass).",
    science:
      "Each temperature stage selects a different solubility band. The high-bloom temp opens volatiles but doesn't drive them off. The main pour at 75°C is below standard pour-over windows, slowing extraction to favour sweet over bitter. The cold finish stops extraction abruptly and balances the cup. Air-release between stages prevents pressure buildup that would alter contact dynamics.",
    whenToUse:
      "Delicate aromatic lots (top-tier washed Ethiopian, geisha) where you want a controlled, sequential build of aromatic complexity rather than a single flat extraction.",
    sources: [
      { type: "official-competition", citation: "World AeroPress Championship official record — WAC 2024 entry", year: 2024 },
    ],
    verified: false,
    notes: "Niche range estimated from the ~900 µm grind spec — a particle size, not a Comandante click count, so it cannot be mapped exactly.",
  },

  {
    id: "adler-original-aeropress",
    name: "Adler — Original AeroPress (Inventor's Recipe)",
    shortName: "Adler Original",
    attribution: {
      person: "Alan Adler",
      title: "Inventor of the AeroPress, Stanford Engineering Lecturer",
      year: 2005,
    },
    category: "experimental",
    brewer: "aeropress",
    brewerNotes:
      "AeroPress upright (NOT inverted). Fine espresso-style grind. 1 paper filter, unrinsed. Output is a concentrate intended for dilution to Americano, latte, or cold drink.",
    dose: { grams: 16 },
    water: { grams: 90, ratio: "1:5.3–6.0" },
    temperature: { celsius: 80, rangeC: [80, 85] },
    grind: {
      referenceSetting: "fine espresso-style",
      nicheZeroDegrees: [345, 360],
      description: "fine espresso-style (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Assemble + level bed", action: "wait", durationSec: 0, notes: "filter in cap, AP on server, 1 scoop coffee in chamber, level the bed" },
      { label: "Hot water to Level 1–1.5", action: "pour", waterGramsAtEnd: 90, durationSec: 5, temperatureC: 80, notes: "~85–95g at 80°C (85°C for light roast)" },
      { label: "Stir", action: "stir", durationSec: 10 },
      { label: "Insert plunger", action: "wait", durationSec: 5 },
      { label: "Gentle press", action: "press", durationSec: 40, notes: "pause at resistance. Output: ~70–80g concentrate." },
      { label: "Dilute", action: "bypass", durationSec: 0, notes: "hot water for Americano (to 8 oz), milk for latte, RT/ice for cold drink" },
    ],
    totalTimeSec: 60,
    techniques: ["concentrate-and-bypass", "low-temp-long-steep"],
    bestFor: {
      roastLevels: ["medium", "medium-dark"],
      processes: ["any"],
      goals: ["body-forward"],
    },
    teaches:
      "The original — Adler designed the AeroPress to produce a concentrate, then dilute. Espresso-style grind + low temperature (80°C) + short contact time (~1 min total). Reduces acidity and bitterness vs longer hot extractions.",
    science:
      "Low temperature suppresses the bitter Zone-3 alkaloid extraction that an espresso-grind would normally pull at high temp. Short contact time keeps the brew focused on the fast-extracting compounds. The pressure of the press completes extraction without overdoing it. Designed for everyday use, not competition clarity.",
    whenToUse:
      "When you want an espresso-style drink without an espresso machine — Americano, latte, or iced. Also: when you don't want to think too hard.",
    sources: [
      { type: "article", citation: "Alan Adler / AeroPress Inc. official method" },
      { type: "video", citation: "ECT AeroPress Movie 2017 documentary", year: 2017 },
      { type: "transcript", citation: "aeroprecipe.com transcription", url: "https://aeroprecipe.com" },
    ],
    verified: true,
    notes: "Breaks the curated-8 AeroPress rule of Markus's collection — this is the inventor's reference recipe and a completely different paradigm from all 8 competition-filter-style AeroPress recipes. Decision is Markus's: keep as 9th reference, or replace one of the 8. Temperature 80°C (medium-dark) to 85°C (light). Dose 16g ≈ 1 scoop; water Level 1–1.5 ≈ 85–95g (taken as 90g). Niche range estimated from the fine-espresso grind feel.",
  },

  // ── V60 ──────────────────────────────────────────────────────────────────

  {
    id: "wang-2017-inverse-kasuya-v60",
    name: "Wang 2017 — Inverse-Kasuya V60",
    shortName: "Wang 2017",
    attribution: {
      person: "Chad Wang",
      title: "2017 World Brewers Cup Champion",
      country: "Taiwan",
      year: 2017,
    },
    category: "experimental",
    brewer: "v60",
    brewerNotes:
      "Hario V60. Six pours, but split 6:4 (early-heavy, late-light) — the inverse of Kasuya's 4:6 (early-light, late-heavy).",
    dose: { grams: 20 },
    water: { grams: 300, ratio: "1:15" },
    temperature: { celsius: 91 },
    grind: {
      referenceSetting: "medium (similar to Kasuya 4:6)",
      nicheZeroDegrees: [382, 392],
      description: "medium, similar to Kasuya 4:6 (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Pour 1 — strength phase (60%, first)", action: "pour", waterGramsAtEnd: 60, durationSec: 10, notes: "Wang inverts Kasuya: load the strength phase early when the bed is fresh." },
      { label: "Rest", action: "wait", durationSec: 35 },
      { label: "Pour 2 — strength phase (60%, second)", action: "pour", waterGramsAtEnd: 120, durationSec: 10 },
      { label: "Rest", action: "wait", durationSec: 35 },
      { label: "Pour 3 — strength phase (60%, third)", action: "pour", waterGramsAtEnd: 180, durationSec: 10 },
      { label: "Rest", action: "wait", durationSec: 35 },
      { label: "Pour 4 — acid/sweet phase (40%, first)", action: "pour", waterGramsAtEnd: 220, durationSec: 10 },
      { label: "Rest", action: "wait", durationSec: 35 },
      { label: "Pour 5 — acid/sweet phase (40%, second)", action: "pour", waterGramsAtEnd: 260, durationSec: 10 },
      { label: "Rest", action: "wait", durationSec: 20 },
      { label: "Drawdown", action: "drain", durationSec: 30, notes: "final 40g settling" },
    ],
    totalTimeSec: 210,
    techniques: ["phase-separated-pouring", "inverse-phase-pouring"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed", "honey"],
      goals: ["balanced", "sweetness-forward"],
    },
    teaches:
      "Reversing Kasuya's pour distribution puts body-extracting agitation early (when the bed is fresh, dense, high contact) and acidity/sweetness pours late (when the bed has thinned out). Result is body-forward with bright finish — opposite of Kasuya's bright-forward-with-sweet-finish.",
    science:
      "Early-heavy pours on a dry/lightly bloomed bed drive higher early extraction. Late-light pours barely disturb the depleted bed — they extract sugars (which are slower to come out) without dragging additional bitter compounds. The cup builds body-first, brightens last.",
    whenToUse:
      "Coffee where you want the body upfront and the acidity as a counterpoint — middle-roasted natural honey processes, denser-bodied African washed.",
    sources: [
      { type: "report", citation: "Specialty Coffee Association competition reporting (2017 WBrC, Budapest). Secondary attribution; primary video not found.", year: 2017 },
    ],
    verified: false,
    notes: "Reconstruction from competition reporting. Wang's exact published per-pour schedule isn't accessible in primary form — the 6:4 (60%-then-40%) structure is documented, the precise distribution is interpreted. Niche range estimated from the grind-feel description.",
  },

  {
    id: "rolf-tollefsen-2015-v60",
    name: "Rolf Tøllefsen 2015 V60",
    shortName: "Rolf Tøllefsen",
    attribution: {
      person: "Patrik Rolf",
      affiliation: "Tøllefsens Kaffebar Oslo (pre-April Coffee)",
      country: "Norway",
      year: 2015,
    },
    category: "experimental",
    brewer: "v60",
    brewerNotes:
      "Hario V60 size 02. Patrik Rolf's pre-April-Coffee routine from his Tøllefsens period. Mid-2010s Scandi pulse style.",
    dose: { grams: 14 },
    water: { grams: 220, ratio: "1:15.7" },
    temperature: { celsius: 93 },
    grind: {
      referenceSetting: "medium-fine, light-roast tuned",
      nicheZeroDegrees: [368, 382],
      description: "medium-fine, light-roast tuned (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Bloom", action: "pour", waterGramsAtEnd: 30, durationSec: 5 },
      { label: "Wait", action: "wait", durationSec: 40 },
      { label: "Pulse 1", action: "pour", waterGramsAtEnd: 90, durationSec: 10 },
      { label: "Wait", action: "wait", durationSec: 20 },
      { label: "Pulse 2", action: "pour", waterGramsAtEnd: 140, durationSec: 10 },
      { label: "Wait", action: "wait", durationSec: 20 },
      { label: "Pulse 3", action: "pour", waterGramsAtEnd: 180, durationSec: 10 },
      { label: "Wait", action: "wait", durationSec: 15 },
      { label: "Pulse 4", action: "pour", waterGramsAtEnd: 220, durationSec: 10 },
      { label: "Drawdown", action: "drain", durationSec: 40 },
    ],
    totalTimeSec: 180,
    techniques: ["pulse-pouring", "minimal-agitation"],
    bestFor: {
      roastLevels: ["very-light", "light"],
      processes: ["washed"],
      varieties: ["Heirloom", "Geisha", "SL28"],
      goals: ["high-clarity"],
    },
    teaches:
      "Mid-2010s Scandi pulse style at scale — Rolf's pre-April approach used many small pulses (4-5 after bloom) rather than a few large pours. The slurry level stays low and consistent throughout.",
    science:
      "Many small pulses keep the bed thin and the bed temperature stable. Less risk of channeling than a single main pour. Total contact time stays moderate while extraction stays even.",
    whenToUse:
      "Very-light Nordic washed coffees where you want clarity without going to the Wendelboe extreme (5g bloom, 30g pours).",
    sources: [
      { type: "report", citation: "Specialty Coffee Association archives, Scandinavian competition era 2014-2016." },
    ],
    verified: false,
    notes: "Pre-dates the April-Coffee era. Distinct from the 'April Coffee House V60 (Rolf)' entry, which is Rolf's post-2018 published house recipe. Parameters here are interpreted from Scandi-era competition reporting — not from a primary source. Niche range estimated from the grind-feel description.",
  },

  {
    id: "douglas-2022-wbrc-v60-slow-pour",
    name: "Douglas 2022 — WBrC V60 Slow-Pour",
    shortName: "Douglas 2022",
    attribution: {
      person: "Anthony Douglas",
      title: "2022 World Brewers Cup Champion",
      affiliation: "Axil Coffee Roasters",
      country: "Australia",
      year: 2022,
    },
    category: "experimental",
    brewer: "v60",
    brewerNotes:
      "Hario V60. Layered slow-pour technique with deliberate central single-stream pours. Lighter-than-typical ratio.",
    dose: { grams: 14.5 },
    water: { grams: 250, ratio: "1:17.2" },
    temperature: { celsius: 93 },
    grind: {
      referenceSetting: "medium-fine",
      nicheZeroDegrees: [368, 382],
      description: "medium-fine (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Bloom (central)", action: "pour", waterGramsAtEnd: 30, durationSec: 5 },
      { label: "Wait", action: "wait", durationSec: 40 },
      { label: "Pour 1 — slow central stream", action: "pour", waterGramsAtEnd: 100, durationSec: 25 },
      { label: "Wait", action: "wait", durationSec: 20 },
      { label: "Pour 2 — slow central stream", action: "pour", waterGramsAtEnd: 175, durationSec: 25 },
      { label: "Wait", action: "wait", durationSec: 20 },
      { label: "Pour 3 — slow central stream", action: "pour", waterGramsAtEnd: 250, durationSec: 25 },
      { label: "Drawdown", action: "drain", durationSec: 50 },
    ],
    totalTimeSec: 210,
    techniques: ["slow-central-pour", "minimal-agitation"],
    bestFor: {
      roastLevels: ["very-light", "light"],
      processes: ["washed", "anaerobic"],
      varieties: ["Gesha", "Sidra"],
      goals: ["high-clarity"],
    },
    teaches:
      "AU champion clarity — slow central pours minimise bed disturbance, lighter ratio (1:17) at 93°C lets even an anaerobic lot read as clean rather than fermenty.",
    science:
      "Slow central pours don't agitate the bed walls; extraction stays even across the puck. The lean 1:17 ratio combined with moderate 93°C keeps the brew in the Zone 1-2 window for the full extraction — sugars and acids without much Zone-3 bitterness.",
    whenToUse:
      "Anaerobic, double-fermented, or experimentally processed coffees where you want to highlight the clean fruit beneath the ferment rather than amplify it.",
    sources: [
      { type: "report", citation: "World Brewers Cup 2022 final, Melbourne — competition reporting. Primary video not accessed.", year: 2022 },
    ],
    verified: false,
    notes: "Niche range estimated from the grind-feel description.",
  },

  {
    id: "friedhats-cold-bloom-v60",
    name: "Friedhats — Cold-Bloom V60",
    shortName: "Friedhats CB",
    attribution: {
      person: "Lex Wenneker",
      affiliation: "Friedhats Coffee",
      year: 2022,
    },
    category: "experimental",
    brewer: "v60",
    brewerNotes:
      "Hario V60. Two-temperature: 62°C cold-water bloom (4 min) then 92°C hot main pour. Designed for delicate aromatic preservation.",
    dose: { grams: 15 },
    water: { grams: 250, ratio: "1:16.7" },
    temperature: { staged: [{ pourIndex: 0, celsius: 62, label: "cold bloom 4 min" }, { pourIndex: 1, celsius: 92, label: "hot main pour" }] },
    grind: {
      referenceSetting: "medium (slightly coarser than Hoffmann V60)",
      nicheZeroDegrees: [398, 408],
      description: "medium, slightly coarser than Hoffmann V60 (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Cold-water bloom", action: "pour", waterGramsAtEnd: 50, durationSec: 5, temperatureC: 62, notes: "50g @62°C" },
      { label: "Cold-extraction phase", action: "wait", durationSec: 235, notes: "Long cold contact extracts only the most-soluble compounds: aromatics and sugars." },
      { label: "Main pour @92°C", action: "pour", waterGramsAtEnd: 250, durationSec: 60, temperatureC: 92, notes: "one continuous gentle stream" },
      { label: "Drawdown", action: "drain", durationSec: 60 },
    ],
    totalTimeSec: 360,
    techniques: ["cold-bloom", "staged-temperature", "aroma-preservation"],
    bestFor: {
      roastLevels: ["very-light", "light"],
      processes: ["washed"],
      varieties: ["Gesha", "SL28", "Heirloom"],
      goals: ["aromatic"],
    },
    teaches:
      "Cold bloom + hot finish — the only published V60 cold-bloom approach. Preserves the most volatile aromatic compounds (which evaporate fast at standard 95°C blooms) before the hot main pour does the bulk extraction.",
    science:
      "At 62°C, only highly-soluble compounds enter solution: aromatics, organic acids, simple sugars. Bitter alkaloids and astringent phenolics need higher heat and stay in the grounds during the cold bloom. The hot 92°C main pour then completes extraction including the depth compounds — but the aromatic top notes are already in the brew, protected from volatilisation.",
    whenToUse:
      "Delicate florals, top-tier washed Ethiopians or geishas where the aromatic top notes are the entire point of the brew and a standard 95°C bloom drives them off.",
    sources: [
      { type: "video", citation: "Friedhats Coffee (Lex Wenneker) — Instagram + YouTube cold-bloom V60 demonstrations." },
    ],
    verified: false,
    notes: "Niche range estimated from the grind-feel description.",
  },

  {
    id: "standout-double-bloom-v60",
    name: "Standout — Double-Bloom V60",
    shortName: "Standout DB",
    attribution: {
      person: "Oskar Garberg",
      affiliation: "Standout Coffee",
      country: "Sweden",
      year: 2023,
    },
    category: "experimental",
    brewer: "v60",
    brewerNotes:
      "Hario V60. Two-stage bloom (two separate small pours before the main extraction) for thorough CO2 management. Particularly useful for very-fresh coffee.",
    dose: { grams: 18 },
    water: { grams: 300, ratio: "1:16.7" },
    temperature: { celsius: 94 },
    grind: {
      referenceSetting: "medium",
      nicheZeroDegrees: [382, 392],
      description: "medium (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Bloom 1", action: "pour", waterGramsAtEnd: 30, durationSec: 5 },
      { label: "Wait", action: "wait", durationSec: 25 },
      { label: "Bloom 2 — second small bloom pour", action: "pour", waterGramsAtEnd: 60, durationSec: 5, notes: "The double bloom releases more CO2 than a single bloom; reduces channeling on the main pour." },
      { label: "Wait", action: "wait", durationSec: 25 },
      { label: "Pour 1", action: "pour", waterGramsAtEnd: 180, durationSec: 30 },
      { label: "Wait", action: "wait", durationSec: 20 },
      { label: "Pour 2", action: "pour", waterGramsAtEnd: 300, durationSec: 30 },
      { label: "Drawdown", action: "drain", durationSec: 70 },
    ],
    totalTimeSec: 210,
    techniques: ["double-bloom", "co2-management"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed", "natural"],
      varieties: ["Heirloom", "Pink Bourbon"],
      goals: ["sweetness-forward", "balanced"],
    },
    teaches:
      "Double bloom — two small saturation pours instead of one — maximises CO2 release before the main extraction. The result is reduced channeling and cleaner sweetness extraction.",
    science:
      "Fresh coffee (especially under 14 days off roast) releases CO2 aggressively in the first bloom, partially blocking water contact with grounds. A second small bloom after CO2 vents continues saturating the grounds that the first bloom didn't fully wet. Main extraction then proceeds on a fully-saturated, CO2-degassed bed — more even extraction, cleaner sweetness.",
    whenToUse:
      "Very fresh light-roasted coffee (under 14 days off roast) where a single bloom leaves dry spots, or anytime you want maximum bed evenness without using a stir.",
    sources: [
      { type: "video", citation: "Standout Coffee (Oskar Garberg) — Instagram + YouTube V60 demonstrations." },
    ],
    verified: false,
    notes: "Niche range estimated from the grind-feel description.",
  },

  {
    id: "gagne-v60-trench-rao-spin",
    name: "Gagné — V60 Trench + Rao-Spin",
    shortName: "Gagné Trench",
    attribution: {
      person: "Jonathan Gagné",
      title: "astrophysicist, The Physics of Filter Coffee author",
      year: 2022,
    },
    category: "experimental",
    brewer: "v60",
    brewerNotes:
      "Hario V60. Gagné's signature: dig a small trench in the dry coffee bed before brewing, then two pours with three Rao-spins (one after each pour + one before drawdown).",
    dose: { grams: 15 },
    water: { grams: 250, ratio: "1:16.7" },
    temperature: { celsius: 95 },
    grind: {
      referenceSetting: "Gagné publishes no Niche degree; tune to ~3:30 drawdown",
      nicheZeroDegrees: [380, 392],
      description: "tune to ~3:30 drawdown (estimate — Gagné publishes no Niche degree)",
    },
    pourSequence: [
      { label: "Trench the dry bed", action: "agitate-bed", durationSec: 0, notes: "dig a small depression in the dry bed with a chopstick" },
      { label: "Bloom (central)", action: "pour", waterGramsAtEnd: 45, durationSec: 5 },
      { label: "Rao-spin 1", action: "swirl", durationSec: 5, notes: "gentle clockwise swirl" },
      { label: "Wait", action: "wait", durationSec: 35 },
      { label: "Pour 1 — gentle central", action: "pour", waterGramsAtEnd: 150, durationSec: 40, notes: "water-bed under 2 cm" },
      { label: "Rao-spin 2", action: "swirl", durationSec: 5 },
      { label: "Wait", action: "wait", durationSec: 15 },
      { label: "Pour 2 — gentle central", action: "pour", waterGramsAtEnd: 250, durationSec: 40 },
      { label: "Rao-spin 3 (before drawdown)", action: "swirl", durationSec: 5 },
      { label: "Drawdown", action: "drain", durationSec: 60 },
    ],
    totalTimeSec: 210,
    techniques: ["rao-spin", "trench", "minimal-agitation"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed", "natural"],
      goals: ["high-clarity", "sweetness-forward"],
    },
    teaches:
      "Trench + Rao-spin schedule — the trench prevents the dry bed from forming a hard surface that the bloom can't penetrate. Three Rao-spins keep the bed flat and prevent channeling.",
    science:
      "A small trench in the dry coffee bed lets the bloom water saturate the bed from inside-out (not just top-down), reducing the chance of dry pockets. Rao-spins (gentle whole-brewer swirls) collapse any incipient channeling and flatten the bed for the next pour. Three pulses (bloom + 2 main) keep the slurry level consistent.",
    whenToUse:
      "Light-roast coffees where you want clean, even extraction without the bed-disturbance of a stir. Particularly good for medium-light washed and fresh-roasted coffees prone to channeling.",
    sources: [
      { type: "blog", citation: "Jonathan Gagné, coffeeadastra.com — 'Two-Pour V60 with Trench' article", url: "https://coffeeadastra.com" },
      { type: "book", citation: "The Physics of Filter Coffee (Jonathan Gagné)" },
    ],
    verified: false,
    notes: "Distinct from server's 'Gagné — Long-Brew AeroPress + Prismo' (AeroPress, not V60). The V60 trench method is published on coffeeadastra.com — a primary source but not fetched in-session. Niche range estimated (Gagné publishes no Niche degree).",
  },

  {
    id: "wendelboe-v60-big-batch",
    name: "Wendelboe V60 — Big Batch",
    shortName: "Wendelboe Big",
    attribution: {
      person: "Tim Wendelboe",
      country: "Norway",
    },
    category: "experimental",
    brewer: "v60",
    brewerNotes:
      "Hario V60 size 02 or size 03 (size 03 recommended for >400g brews). Same Nordic-light philosophy as the standard 14g/250g version, scaled to 32.5g/500g — single-pot, multiple cups.",
    dose: { grams: 32.5 },
    water: { grams: 500, ratio: "1:15.4" },
    temperature: { celsius: 95 },
    grind: {
      referenceSetting: "slightly coarser than the standard Nordic Light (Wendelboe coarsens for big batches)",
      nicheZeroDegrees: [388, 398],
      description: "slightly coarser than standard Nordic Light (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Bloom (double the standard 40g)", action: "pour", waterGramsAtEnd: 80, durationSec: 8 },
      { label: "Swirl", action: "swirl", durationSec: 5 },
      { label: "Bloom rest", action: "wait", durationSec: 47 },
      { label: "Pour 1 — slow concentric", action: "pour", waterGramsAtEnd: 300, durationSec: 60 },
      { label: "Pour 2 — slow concentric", action: "pour", waterGramsAtEnd: 500, durationSec: 60 },
      { label: "Settle", action: "wait", durationSec: 10 },
      { label: "Drawdown", action: "drain", durationSec: 80 },
    ],
    totalTimeSec: 270,
    techniques: ["swirl-not-stir", "big-batch-scaling", "minimal-agitation"],
    bestFor: {
      roastLevels: ["very-light", "light"],
      processes: ["washed"],
      goals: ["high-clarity"],
      occasions: ["2-3 cups"],
    },
    teaches:
      "Scaling Wendelboe's two-pour V60 to a big batch — slightly coarser grind, longer bloom (to vent enough CO2 for the larger bed), longer pours. The 1:15.4 ratio is the same. Result: 2-3 cups of clean Nordic-light coffee from one brew.",
    science:
      "Doubling the dose doubles bed depth. To keep extraction even, grind slightly coarser (compensates for deeper bed contact time) and use a longer bloom (more CO2 to vent). The pour schedule mirrors the standard recipe: bloom + two main pours, no stirs, just one swirl.",
    whenToUse:
      "When you want Wendelboe-clean coffee for 2-3 people from one brew session. Better than running two single brews because the bed is more stable.",
    sources: [
      { type: "video", citation: "Tim Wendelboe YouTube — big-batch V60 scaling." },
    ],
    verified: false,
    notes: "Niche range estimated from the grind-feel description.",
  },

  {
    id: "cafec-osmotic-flow-v60",
    name: "Cafec — Osmotic Flow V60",
    shortName: "Cafec Osmotic",
    attribution: {
      person: "Cafec / Sanyo Sangyo",
      title: "Hatakeyama-affiliated brand technique",
      country: "Japan",
      year: 2018,
    },
    category: "experimental",
    brewer: "v60",
    brewerNotes:
      "Hario V60 (also works on Cafec Flower Dripper or Origami conical). Cafec's published brand technique. The defining move: visual bubble-stop trigger for pour timing — when a bubble forms on the slurry, stop pouring; wait for it to subside, then continue.",
    dose: { grams: 25 },
    water: { grams: 400, ratio: "1:16" },
    temperature: { celsius: 93 },
    grind: {
      referenceSetting: "medium",
      nicheZeroDegrees: [382, 392],
      description: "medium (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Bloom (2× coffee weight, slow concentric)", action: "pour", waterGramsAtEnd: 50, durationSec: 10 },
      { label: "Wait", action: "wait", durationSec: 35 },
      { label: "Slow center pour until a bubble forms", action: "pour", notes: "STOP IMMEDIATELY when a bubble forms" },
      { label: "Wait until bubble subsides", action: "wait" },
      { label: "Slow center pour until next bubble → stop", action: "pour" },
      { label: "Repeat until 400g", action: "pour", waterGramsAtEnd: 400 },
      { label: "Drawdown", action: "drain" },
    ],
    totalTimeSec: 210,
    techniques: ["osmotic-flow", "bubble-stop-trigger", "pulse-pouring"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed", "natural", "honey"],
      goals: ["sweetness-forward", "balanced"],
    },
    teaches:
      "Osmotic-flow theory — pouring in 'batches' maintains a constant concentration gradient between coffee particles and water, keeping diffusion of desirable compounds high throughout the brew. The bubble-stop trigger is visual, not time-based.",
    science:
      "Cafec's theory: continuous pouring overwhelms the bed and causes water to flow past partially-extracted grounds (low gradient = slow diffusion). Pulse pouring with wait-for-bubble cadence keeps each pour interacting with fully-prepared grounds (high gradient = fast diffusion of sweet/aromatic compounds). The bubble itself is a visual cue that the bed has saturated to the point where further water would just bypass.",
    whenToUse:
      "When you want a sweetness-forward V60 result and have time to brew attentively. Requires visual focus — not for distracted morning brewing.",
    sources: [
      { type: "article", citation: "Cafec / Sanyo Sangyo — official Osmotic Flow brand pages", url: "https://cafec-jp.com/brewing-guide/" },
      { type: "blog", citation: "firefortysix.com test recipe with specific parameters" },
    ],
    verified: false,
    notes: "The theory and procedural framework are Cafec's; the specific dose/temp numbers (25g/400g/93°C) are a common test setup, not Cafec-published. Hatakeyama uses this technique on Cafec Flower Dripper (not Markus's kit) but it transfers to V60. Total time approximate (~3:30) — pour cadence is bubble-triggered, not timed. Niche range estimated from the grind-feel description.",
  },

  {
    id: "heart-coffee-v60",
    name: "Heart Coffee — V60",
    shortName: "Heart V60",
    attribution: {
      person: "Heart Coffee Roasters",
      affiliation: "Portland OR",
    },
    category: "experimental",
    brewer: "v60",
    brewerNotes:
      "Hario V60 #2 (large). Filter thoroughly rinsed against paper-flavour. Vigorous stir after bloom (the Heart signature) + 20s de-gas pause. Distinct philosophy from Hoffmann's gentle-swirl approach.",
    dose: { grams: 22 },
    water: { grams: 350, ratio: "1:15.9" },
    temperature: { celsius: 94, rangeC: [93, 96] },
    grind: {
      referenceSetting: "medium-fine",
      nicheZeroDegrees: [368, 382],
      description: "medium-fine (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Bloom", action: "pour", waterGramsAtEnd: 50, durationSec: 5, notes: "40-50g" },
      { label: "Vigorous stir with spoon", action: "stir", durationSec: 10, notes: "saturate all grounds" },
      { label: "De-gas pause", action: "wait", durationSec: 20 },
      { label: "Slow center-pour", action: "pour", waterGramsAtEnd: 350, durationSec: 90, notes: "water level just above coffee bed (no flooding)" },
      { label: "Drawdown", action: "drain", durationSec: 85 },
    ],
    totalTimeSec: 210,
    techniques: ["vigorous-stir", "de-gas-pause"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed", "natural", "honey"],
      goals: ["balanced", "sweetness-forward"],
    },
    teaches:
      "Vigorous-stir + 20s de-gas pause is Heart's signature. The opposite of Hoffmann's gentle-swirl approach. Both produce clean cups; Heart leans slightly more body-forward.",
    science:
      "Vigorous stir guarantees complete bed wetting (no dry pockets, no channels later). The 20s de-gas pause lets the now-active CO2 escape before main extraction begins — same idea as bloom rest but with the bed already agitated. Slow center-pour with water-level discipline (just above the bed) prevents bypass.",
    whenToUse:
      "Daily V60 for medium-to-light washed coffees where you want a slightly fuller cup than the Hoffmann routine produces.",
    sources: [
      { type: "article", citation: "Heart Coffee Roasters official brewguide", url: "https://heartroasters.com/pages/v60" },
    ],
    verified: false,
    notes: "Temperature 93–96°C (boil + cool 45–60s), taken as 94°C working. Niche range estimated from the grind-feel description.",
  },

  // ── Clever ───────────────────────────────────────────────────────────────

  {
    id: "vesta-clever-default",
    name: "Vesta — Clever Default",
    shortName: "Vesta Clever",
    attribution: {
      person: "Vesta Coffee",
      title: "roastery brewguide",
    },
    category: "experimental",
    brewer: "clever",
    brewerNotes:
      "Clever Dripper Standard. Bloom-first immersion + paper-filter drip-through. The roastery's house Clever method.",
    dose: { grams: 21 },
    water: { grams: 350, ratio: "1:16.7" },
    temperature: { celsius: 96 },
    grind: {
      referenceSetting: "medium-coarse",
      nicheZeroDegrees: [392, 404],
      description: "medium-coarse (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Bloom", action: "pour", waterGramsAtEnd: 60, durationSec: 10 },
      { label: "Stir gently", action: "stir", durationSec: 5 },
      { label: "Wait", action: "wait", durationSec: 45 },
      { label: "Fill to 350g", action: "pour", waterGramsAtEnd: 350, durationSec: 30 },
      { label: "Steep", action: "wait", durationSec: 150 },
      { label: "Release onto cup", action: "drain", durationSec: 30 },
    ],
    totalTimeSec: 270,
    techniques: ["immersion", "bloom-first"],
    bestFor: {
      roastLevels: ["light", "medium-light", "medium"],
      processes: ["any"],
      goals: ["balanced"],
    },
    teaches:
      "Standard Clever — bloom for CO2 release, then fill and steep for full immersion, then release. Forgiving on grind, very repeatable.",
    science:
      "Immersion phase extracts evenly regardless of pour technique; paper-filter release at the end strips oils for a cleaner cup than French press. The bloom step is non-trivial — it prevents the steep from being CO2-blocked.",
    whenToUse:
      "Daily-driver brew, especially for medium roasts. Excellent when you want set-and-forget.",
    sources: [
      { type: "article", citation: "Vesta Coffee Roasters brewguide" },
    ],
    verified: false,
    notes: "Niche range estimated from the grind-feel description.",
  },

  {
    id: "crema-water-first-clever",
    name: "Crema — Water-First Clever",
    shortName: "Crema Water-First",
    attribution: {
      person: "Crema Coffee Roasters",
      affiliation: "Knoxville TN",
    },
    category: "experimental",
    brewer: "clever",
    brewerNotes:
      "Clever Dripper. Reverse method: water in first, then coffee. Minimises fines turbulence; particularly useful for very-fresh coffee.",
    dose: { grams: 22 },
    water: { grams: 350, ratio: "1:15.9" },
    temperature: { celsius: 96 },
    grind: {
      referenceSetting: "medium",
      nicheZeroDegrees: [382, 392],
      description: "medium (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Pour all water into Clever first", action: "pour", waterGramsAtEnd: 350, durationSec: 15 },
      { label: "Add coffee on top, gentle stir to submerge", action: "stir", durationSec: 10 },
      { label: "Steep", action: "wait", durationSec: 230 },
      { label: "Release onto cup", action: "drain", durationSec: 15 },
    ],
    totalTimeSec: 270,
    techniques: ["water-first", "immersion"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed", "natural"],
      goals: ["balanced"],
    },
    teaches:
      "Water-first inverts the usual order — coffee meets fully-heated water immediately, no dry-bed channel formation. Particularly useful for very-fresh coffee that aggressively off-gases.",
    science:
      "Pouring water first eliminates the 'saturation phase' where dry grounds in the cone trap CO2 and create channels. Adding coffee on top lets grounds sink and disperse evenly through the water. Result is an evenly-extracted cup with no need to manage the bloom.",
    whenToUse:
      "Fresh coffee (under 14 days off roast) or anytime you don't want to bloom.",
    sources: [
      { type: "article", citation: "Crema Coffee Roasters brewguide" },
    ],
    verified: false,
    notes: "Niche range estimated from the grind-feel description.",
  },

  {
    id: "hub-bloom-first-clever",
    name: "Hub — Bloom-First Clever",
    shortName: "Hub Clever",
    attribution: {
      person: "Hub Coffee Roasters",
      affiliation: "Reno NV",
    },
    category: "experimental",
    brewer: "clever",
    brewerNotes: "Clever Dripper. Standard bloom-first with longer-than-average steep.",
    dose: { grams: 25 },
    water: { grams: 400, ratio: "1:16" },
    temperature: { celsius: 96 },
    grind: {
      referenceSetting: "medium-coarse",
      nicheZeroDegrees: [392, 404],
      description: "medium-coarse (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Bloom", action: "pour", waterGramsAtEnd: 50, durationSec: 8 },
      { label: "Wait", action: "wait", durationSec: 45 },
      { label: "Fill to 400g", action: "pour", waterGramsAtEnd: 400, durationSec: 30 },
      { label: "Steep", action: "wait", durationSec: 240 },
      { label: "Release", action: "drain", durationSec: 15 },
    ],
    totalTimeSec: 330,
    techniques: ["immersion", "bloom-first", "long-steep"],
    bestFor: {
      roastLevels: ["light", "medium-light", "medium"],
      processes: ["any"],
      goals: ["balanced", "sweetness-forward"],
    },
    teaches:
      "Longer 4-min steep extracts more sweetness without the bitter pickup of pour-over agitation. Hub's house philosophy: immersion is forgiving, lean into it.",
    science:
      "Extended immersion lets slow-extracting sweet compounds equilibrate while the lack of agitation keeps bitter Zone-3 compounds from being driven out aggressively. The paper-filter release strips oils for clarity.",
    whenToUse:
      "Standard daily brew where you don't want to monitor a pour pattern. Excellent on natural processes where sweetness is the priority.",
    sources: [
      { type: "article", citation: "Hub Coffee Roasters brewguide" },
    ],
    verified: false,
    notes: "Niche range estimated from the grind-feel description.",
  },

  {
    id: "magnolia-clever-default",
    name: "Magnolia — Clever Default",
    shortName: "Magnolia Clever",
    attribution: {
      person: "Magnolia Coffee Co.",
    },
    category: "experimental",
    brewer: "clever",
    brewerNotes: "Clever Dripper standard. House brew approach with mid-immersion stir.",
    dose: { grams: 24 },
    water: { grams: 360, ratio: "1:15" },
    temperature: { celsius: 96 },
    grind: {
      referenceSetting: "medium",
      nicheZeroDegrees: [382, 392],
      description: "medium (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Bloom", action: "pour", waterGramsAtEnd: 60, durationSec: 10 },
      { label: "Stir", action: "stir", durationSec: 5 },
      { label: "Wait", action: "wait", durationSec: 45 },
      { label: "Fill to 360g", action: "pour", waterGramsAtEnd: 360, durationSec: 30 },
      { label: "Stir mid-immersion", action: "stir", durationSec: 5 },
      { label: "Steep", action: "wait", durationSec: 180 },
      { label: "Release", action: "drain", durationSec: 25 },
    ],
    totalTimeSec: 300,
    techniques: ["immersion", "mid-immersion-stir"],
    bestFor: {
      roastLevels: ["light", "medium-light", "medium", "medium-dark", "dark", "very-light"],
      processes: ["any"],
      goals: ["balanced"],
    },
    teaches:
      "Mid-immersion stir at the 1:30 mark resuspends the bed, redistributing extraction. Magnolia's approach: bloom + fill + mid-stir + release.",
    science:
      "Without mid-stir, grounds settle and the lower bed extracts more than the upper. Mid-stir resuspends and homogenises extraction across the steep duration.",
    whenToUse:
      "Daily brew with slightly more body than a no-stir Clever; good for medium-bodied coffees.",
    sources: [
      { type: "article", citation: "Magnolia Coffee Co. brewguide" },
    ],
    verified: false,
    notes: "Roast 'any' mapped to the full roast range. Niche range estimated from the grind-feel description.",
  },

  {
    id: "subtext-clever-bright",
    name: "Subtext — Clever (Bright)",
    shortName: "Subtext Clever",
    attribution: {
      person: "Subtext Coffee Roasters",
      affiliation: "Toronto",
    },
    category: "experimental",
    brewer: "clever",
    brewerNotes: "Clever Dripper. Subtext's lighter ratio + lower steep time for clarity-forward immersion.",
    dose: { grams: 18 },
    water: { grams: 300, ratio: "1:16.7" },
    temperature: { celsius: 95 },
    grind: {
      referenceSetting: "medium",
      nicheZeroDegrees: [382, 392],
      description: "medium (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Bloom", action: "pour", waterGramsAtEnd: 45, durationSec: 8 },
      { label: "Wait", action: "wait", durationSec: 40 },
      { label: "Fill to 300g", action: "pour", waterGramsAtEnd: 300, durationSec: 25 },
      { label: "Steep", action: "wait", durationSec: 120 },
      { label: "Release", action: "drain", durationSec: 17 },
    ],
    totalTimeSec: 210,
    techniques: ["immersion", "short-steep"],
    bestFor: {
      roastLevels: ["very-light", "light"],
      processes: ["washed", "natural"],
      goals: ["high-clarity", "sweetness-forward"],
    },
    teaches:
      "Shorter immersion + lower ratio = a Clever that reads as a clean V60 rather than a sweet immersion. Subtext's approach for specialty light roasts.",
    science:
      "A 2-min steep (vs the standard 4 min) keeps total extraction shorter — closer to V60 contact time. Combined with the lower 1:16.7 ratio, the cup stays bright and aromatic rather than full and round.",
    whenToUse:
      "Light-roast specialty coffees where you want immersion convenience but pour-over-like clarity.",
    sources: [
      { type: "article", citation: "Subtext Coffee Roasters brewguide" },
    ],
    verified: false,
    notes: "Niche range estimated from the grind-feel description.",
  },

  {
    id: "coffee-and-water-standard-clever",
    name: "Coffee&Water — Standard Clever",
    shortName: "C&W Clever",
    attribution: {
      person: "Daniel",
      affiliation: "Coffee and Water YouTube channel",
    },
    category: "experimental",
    brewer: "clever",
    brewerNotes: "Clever Dripper. Standard bloom-fill-steep-release with the channel's signature 96°C + 1:15.5 ratio.",
    dose: { grams: 18 },
    water: { grams: 280, ratio: "1:15.6" },
    temperature: { celsius: 96 },
    grind: {
      referenceSetting: "medium",
      nicheZeroDegrees: [382, 392],
      description: "medium (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Bloom", action: "pour", waterGramsAtEnd: 45, durationSec: 8 },
      { label: "Stir", action: "stir", durationSec: 5 },
      { label: "Wait", action: "wait", durationSec: 47 },
      { label: "Fill to 280g", action: "pour", waterGramsAtEnd: 280, durationSec: 25 },
      { label: "Steep", action: "wait", durationSec: 165 },
      { label: "Release", action: "drain", durationSec: 5 },
    ],
    totalTimeSec: 255,
    techniques: ["immersion", "bloom-first"],
    bestFor: {
      roastLevels: ["light", "medium-light", "medium"],
      processes: ["any"],
      goals: ["balanced"],
    },
    teaches:
      "Educational-channel Clever recipe — balanced, repeatable, easy to teach. The kind of recipe you'd recommend to someone buying their first Clever.",
    science:
      "Lean 1:15.6 keeps the cup balanced (not too strong), 96°C extracts efficiently, 2:45 total steep is a reasonable middle between bright (2 min) and full (4 min).",
    whenToUse: "Default daily Clever; teaching beginners.",
    sources: [
      { type: "video", citation: "Coffee and Water YouTube channel" },
    ],
    verified: false,
    notes: "Niche range estimated from the grind-feel description.",
  },

  {
    id: "houndstooth-dominy-v2-clever",
    name: "Houndstooth — Dominy V2 Clever",
    shortName: "Houndstooth V2",
    attribution: {
      person: "Sean Dominy",
      affiliation: "Houndstooth Coffee, Austin TX",
    },
    category: "experimental",
    brewer: "clever",
    brewerNotes: "Clever Dripper. Long-steep variant designed for body-forward cup. Higher dose, full 5-min steep.",
    dose: { grams: 25 },
    water: { grams: 350, ratio: "1:14" },
    temperature: { celsius: 96 },
    grind: {
      referenceSetting: "medium-coarse",
      nicheZeroDegrees: [392, 404],
      description: "medium-coarse (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Bloom", action: "pour", waterGramsAtEnd: 60, durationSec: 10 },
      { label: "Stir vigorously", action: "stir", durationSec: 5 },
      { label: "Wait", action: "wait", durationSec: 45 },
      { label: "Fill to 350g", action: "pour", waterGramsAtEnd: 350, durationSec: 30 },
      { label: "Steep", action: "wait", durationSec: 270 },
      { label: "Release", action: "drain", durationSec: 5 },
    ],
    totalTimeSec: 360,
    techniques: ["immersion", "long-steep", "high-dose"],
    bestFor: {
      roastLevels: ["medium", "medium-dark"],
      processes: ["natural", "washed"],
      goals: ["sweetness-forward", "body-forward"],
    },
    teaches:
      "Higher dose + long steep = body-forward Clever. Pushes the immersion philosophy to its sweet/full extreme.",
    science:
      "1:14 dose drives concentration; 4.5-min steep gives slow-extracting sweet/body compounds full time to equilibrate. The paper filter still strips oils, so the cup is full but clean — not French-press muddy.",
    whenToUse:
      "Naturally-processed coffees with deep sweetness potential, medium roasts where you want the chocolate/caramel to lead.",
    sources: [
      { type: "interview", citation: "Houndstooth Coffee + Sean Dominy interviews/videos" },
    ],
    verified: false,
    notes: "Niche range estimated from the grind-feel description.",
  },

  {
    id: "hoffmann-iced-clever-high-dose",
    name: "Hoffmann — Iced Clever (Higher-Dose Variant)",
    shortName: "Hoffmann Iced High-Dose",
    attribution: {
      person: "James Hoffmann",
      country: "United Kingdom",
    },
    category: "experimental",
    brewer: "clever",
    brewerNotes:
      "Clever Dripper. Higher-dose Hoffmann iced variant: more coffee per ml for stronger body in the final iced cup. Diverges from server's 'Hoffmann Immersion Iced (Clever)' on dose.",
    dose: { grams: 30 },
    water: { grams: 500, ratio: "1:16.7" },
    temperature: { celsius: 96 },
    grind: {
      referenceSetting: "medium-fine (immersion-tolerant)",
      nicheZeroDegrees: [368, 382],
      description: "medium-fine, immersion-tolerant (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Hot water + stir", action: "pour", waterGramsAtEnd: 330, durationSec: 15, temperatureC: 96, notes: "330g hot water @96°C in Clever; stir to wet grounds" },
      { label: "Steep ~5 min", action: "wait", durationSec: 285 },
      { label: "Prep ice", action: "wait", durationSec: 0, notes: "at 4-min mark, prep 170g ice in server" },
      { label: "Release onto ice", action: "drain", durationSec: 60, notes: "flash chill" },
      { label: "Stir until ice melts", action: "stir", durationSec: 30, notes: "saline finish optional" },
    ],
    totalTimeSec: 390,
    techniques: ["flash-chilling", "immersion", "high-dose"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed", "natural"],
      goals: ["aromatic", "sweetness-forward"],
    },
    teaches:
      "Higher-dose Hoffmann iced variant — same flash-chill philosophy as server's standard version but with more coffee for a more concentrated final iced cup. Useful when ice will heavily dilute (warm room, slow service).",
    science:
      "A heavier dose compensates for in-glass ice dilution. Same flash-chill aromatic preservation as Hoffmann's standard iced. The paper filter strips oils for clarity.",
    whenToUse:
      "Iced coffee in warm conditions (summer afternoon) where you need extra body to survive ice melt during sipping.",
    sources: [
      { type: "video", citation: "James Hoffmann YouTube — iced Clever variants" },
    ],
    verified: false,
    notes: "Water 500g total = 330g hot @96°C + 170g ice. Adjacent to server's 'Hoffmann Immersion Iced (Clever)' (37.5g/500g, 100°C); this is a slightly leaner variant. Niche range estimated from the grind-feel description.",
  },

  // ── Origami ──────────────────────────────────────────────────────────────

  {
    id: "roasters-pack-origami-6-pour-big-batch",
    name: "Roasters Pack — Origami 6-Pour Big Batch",
    shortName: "Roasters Pack Origami",
    attribution: {
      person: "Roasters Pack subscription",
      affiliation: "Toronto",
    },
    category: "experimental",
    brewer: "origami-cone",
    brewerNotes:
      "Origami (cone or wave filter; Roasters Pack uses cone). Big-batch 6-pour schedule scaled for 2-3 cups.",
    dose: { grams: 30 },
    water: { grams: 500, ratio: "1:16.7" },
    temperature: { celsius: 94 },
    grind: {
      referenceSetting: "medium",
      nicheZeroDegrees: [382, 392],
      description: "medium (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Bloom", action: "pour", waterGramsAtEnd: 75, durationSec: 10 },
      { label: "Wait", action: "wait", durationSec: 35 },
      { label: "Pour 1", action: "pour", waterGramsAtEnd: 175, durationSec: 20 },
      { label: "Wait", action: "wait", durationSec: 25 },
      { label: "Pour 2", action: "pour", waterGramsAtEnd: 275, durationSec: 20 },
      { label: "Wait", action: "wait", durationSec: 25 },
      { label: "Pour 3", action: "pour", waterGramsAtEnd: 375, durationSec: 20 },
      { label: "Wait", action: "wait", durationSec: 25 },
      { label: "Pour 4", action: "pour", waterGramsAtEnd: 500, durationSec: 25 },
      { label: "Drawdown", action: "drain", durationSec: 35 },
    ],
    totalTimeSec: 240,
    techniques: ["pulse-pouring", "big-batch-scaling"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["any"],
      goals: ["balanced"],
    },
    teaches:
      "Scaling an Origami to a big batch — 4 mid-pours with consistent wait intervals. The Origami's open architecture drains quickly even at scale.",
    science:
      "The Origami doesn't slow down with bigger doses the way a V60 does (less restrictive geometry). Multiple medium pours keep the slurry level controlled across the longer total time.",
    whenToUse: "When you want 2-3 cups of clean Origami coffee from one brew.",
    sources: [
      { type: "article", citation: "Roasters Pack subscription brewguide" },
    ],
    verified: false,
    notes: "Niche range estimated from the grind-feel description.",
  },

  {
    id: "kurasu-origami-standard",
    name: "Kurasu Origami — Standard",
    shortName: "Kurasu Origami",
    attribution: {
      person: "Kurasu Kyoto",
      affiliation: "Mishima",
      country: "Japan",
    },
    category: "experimental",
    brewer: "origami-cone",
    brewerNotes:
      "Origami (works with either wave-filter or conical paper). Kurasu's published default. Wave = smoother, more even (like Kalita). Conical = more body, faster drawdown (like V60).",
    dose: { grams: 15 },
    water: { grams: 270, ratio: "1:18" },
    temperature: { celsius: 89, rangeC: [88, 90] },
    grind: {
      referenceSetting: "medium-fine",
      nicheZeroDegrees: [368, 382],
      description: "medium-fine (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Bloom", action: "pour", waterGramsAtEnd: 40, durationSec: 8 },
      { label: "Wait", action: "wait", durationSec: 22 },
      { label: "Pour — efficient extraction window", action: "pour", waterGramsAtEnd: 170, durationSec: 30 },
      { label: "Pour (drawdown begins in parallel)", action: "pour", waterGramsAtEnd: 270, durationSec: 20 },
      { label: "Remove dripper (even if water remains)", action: "drain" },
    ],
    totalTimeSec: 80,
    techniques: ["filter-choice", "pulse-pouring"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed", "natural"],
      goals: ["balanced", "high-clarity"],
    },
    teaches:
      "Origami flexibility — same recipe runs on wave OR conical filter, with different results. Wave = Kalita-style smooth; conical = V60-style body. Kurasu lets the filter choice make the call.",
    science:
      "Origami's 20-rib geometry holds both filter types. The wave gives a flat bed and slower extraction (like Kalita); the conical gives a coned bed and faster drawdown (like V60). The 1:18 ratio is light enough to keep both filter modes clean.",
    whenToUse:
      "When you want one recipe to dial across a coffee's needs — switch to wave for smoothness, conical for body, same routine.",
    sources: [
      { type: "article", citation: "Kurasu Kyoto — published Origami brewguide (kurasu.kyoto blog)" },
    ],
    verified: true,
    notes: "Total 1:20 is the pour phase; drawdown runs in parallel. Produces ~170-180g in cup. Niche range estimated from the grind-feel description.",
  },

  {
    id: "mills-origami-simple",
    name: "Mills — Origami Simple",
    shortName: "Mills Origami",
    attribution: {
      person: "Alexander Mills",
      title: "coffee educator",
    },
    category: "experimental",
    brewer: "origami-cone",
    brewerNotes: "Origami. Minimalist single-bloom + one-long-pour approach.",
    dose: { grams: 12.5 },
    water: { grams: 200, ratio: "1:16" },
    temperature: { celsius: 93 },
    grind: {
      referenceSetting: "medium",
      nicheZeroDegrees: [382, 392],
      description: "medium (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Bloom", action: "pour", waterGramsAtEnd: 40, durationSec: 5 },
      { label: "Wait", action: "wait", durationSec: 25 },
      { label: "Pour — slow concentric circles", action: "pour", waterGramsAtEnd: 200, durationSec: 60, notes: "last pour around the outer wall" },
      { label: "Gentle brewer swirl", action: "swirl", durationSec: 5 },
      { label: "Drawdown", action: "drain", durationSec: 55 },
    ],
    totalTimeSec: 150,
    techniques: ["single-pour", "minimal-agitation", "swirl-not-stir"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["any"],
      goals: ["high-clarity"],
    },
    teaches:
      "Minimalist Origami — single bloom + single long pour. The opposite of competition-style pulse pouring. Forgiving and quick.",
    science:
      "One long pour on the Origami still extracts evenly because the open architecture drains fast (no risk of stalling). The final outer-wall pour catches any grounds sticking to the filter sides. Brewer swirl flattens the bed for drawdown.",
    whenToUse:
      "Simple weekday brew when you want pour-over quality without timing five pours.",
    sources: [
      { type: "transcript", citation: "Alexander Mills (Instagram). Transcription by pullandpourcoffee.com." },
    ],
    verified: false,
    notes: "Niche range estimated from the grind-feel description.",
  },

  {
    id: "vuolo-neto-2023-origami-brazilian-bc",
    name: "Vuolo Neto 2023 — Origami Brazilian BC",
    shortName: "Vuolo Neto",
    attribution: {
      person: "Rubens Vuolo Neto",
      title: "Brazilian Brewers Cup Champion 2023",
      country: "Brazil",
      year: 2023,
    },
    category: "experimental",
    brewer: "origami-cone",
    brewerNotes:
      "Origami Air + Cafec Origami filter. 4-pour schedule with defined wait pauses between each pour. Coffee: tropical Brazilian washed.",
    dose: { grams: 16 },
    water: { grams: 240, ratio: "1:15" },
    temperature: { celsius: 91 },
    grind: {
      referenceGrinder: "1Zpresso ZP6 Special",
      referenceSetting: "4.1 (medium-fine)",
      nicheZeroDegrees: [368, 382],
      description: "medium-fine (estimate from grind description, not published — ZP6 dial not on the user's Niche map)",
    },
    pourSequence: [
      { label: "Pour 1", action: "pour", waterGramsAtEnd: 50, durationSec: 10 },
      { label: "Wait", action: "wait", durationSec: 20 },
      { label: "Pour 2", action: "pour", waterGramsAtEnd: 120, durationSec: 10 },
      { label: "Wait", action: "wait", durationSec: 20 },
      { label: "Pour 3", action: "pour", waterGramsAtEnd: 180, durationSec: 10 },
      { label: "Wait", action: "wait", durationSec: 20 },
      { label: "Pour 4", action: "pour", waterGramsAtEnd: 240, durationSec: 10 },
      { label: "Drawdown", action: "drain", durationSec: 45 },
    ],
    totalTimeSec: 145,
    techniques: ["equal-pour-schedule", "pulse-pouring"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed"],
      varieties: ["Bourbon", "Yellow Bourbon", "Caturra"],
      goals: ["high-clarity"],
    },
    teaches:
      "Equal-pour schedule (4 × ~60g) with strict 20s waits — defines a metronomic rhythm. Brazilian competition style: simplicity and consistency over creative complexity.",
    science:
      "Equal pours on a strict cadence eliminate operator variance — repeatable across many brews. The Origami Air drains fast enough that 20s waits don't over-extract.",
    whenToUse:
      "Light-roast washed Brazilians (the recipe's home territory), or any coffee where you want clarity-forward extraction with a simple repeatable routine.",
    sources: [
      { type: "transcript", citation: "1Zpresso Champion Recipe Database — Vuolo Neto BBC 2023 entry", url: "https://1zpresso.coffee/recipe/", year: 2023 },
    ],
    verified: false,
    notes: "Niche range estimated from the grind-feel description (1Zpresso ZP6 Special dial does not map to the user's Niche↔Comandante calibration).",
  },

  {
    id: "perez-rincon-origami-colombian-bc",
    name: "Perez Rincon — Origami Colombian BC (Multi-Temp)",
    shortName: "Perez Rincon",
    attribution: {
      person: "Janer Joseph Perez Rincon",
      title: "Colombian Brewers Cup",
      country: "Colombia",
    },
    category: "experimental",
    brewer: "origami-cone",
    brewerNotes:
      "Origami Acrylic + Sibarist Conic filter. Multi-temperature pour — 92°C for first two pours, 86°C for last two. Coffee on stage: Natural Geisha.",
    dose: { grams: 15 },
    water: { grams: 260, ratio: "1:17.3" },
    temperature: { staged: [{ pourIndex: 0, celsius: 92, label: "pours 1-2" }, { pourIndex: 2, celsius: 86, label: "pours 3-4" }] },
    grind: {
      referenceGrinder: "1Zpresso ZP6 Special",
      referenceSetting: "5.6 (medium)",
      nicheZeroDegrees: [382, 392],
      description: "medium (estimate from grind description, not published — ZP6 dial not on the user's Niche map)",
    },
    pourSequence: [
      { label: "Pour 1 @92°C", action: "pour", waterGramsAtEnd: 50, durationSec: 10, temperatureC: 92 },
      { label: "Wait", action: "wait", durationSec: 20 },
      { label: "Pour 2 @92°C", action: "pour", waterGramsAtEnd: 120, durationSec: 10, temperatureC: 92 },
      { label: "Wait", action: "wait", durationSec: 25 },
      { label: "Pour 3 @86°C — mesmerizing spiral", action: "pour", waterGramsAtEnd: 190, durationSec: 15, temperatureC: 86 },
      { label: "Wait", action: "wait", durationSec: 25 },
      { label: "Pour 4 @86°C", action: "pour", waterGramsAtEnd: 260, durationSec: 15, temperatureC: 86 },
      { label: "Drawdown", action: "drain", durationSec: 50 },
    ],
    totalTimeSec: 170,
    techniques: ["staged-temperature", "multi-temp-pouring", "aroma-preservation"],
    bestFor: {
      roastLevels: ["very-light", "light"],
      processes: ["natural", "washed"],
      varieties: ["Gesha", "Geisha", "SL28"],
      goals: ["aromatic"],
    },
    teaches:
      "Multi-temperature within a single brew — high temp (92°C) opens the bed and extracts the brighter compounds; lower temp (86°C) preserves aromatic top notes during later pours. Designed for delicate Geishas.",
    science:
      "Above 90°C, fragile aromatic compounds (linalool, geraniol) start evaporating during the pour. By dropping to 86°C for the late pours, those aromatics stay in solution. The early high-temp pours have already done their job (early bed extraction needs the heat).",
    whenToUse:
      "Natural-processed Geishas or top-shelf washed where the aromatic top notes are everything and you don't want to drive them off mid-brew.",
    sources: [
      { type: "transcript", citation: "1Zpresso Champion Recipe Database — Perez Rincon Colombian BC entry", url: "https://1zpresso.coffee/recipe/" },
    ],
    verified: false,
    notes: "Pour timing not explicitly stated in source — only amounts and temperatures; the schedule is a reasonable reconstruction. Niche range estimated from the grind-feel description.",
  },

  {
    id: "kaygusuz-2025-origami-turkish-bc",
    name: "Kaygusuz 2025 — Origami Turkish BC",
    shortName: "Kaygusuz",
    attribution: {
      person: "Atahan Kaygusuz",
      title: "5th place Turkish Brewers Cup 2025",
      country: "Turkey",
      year: 2025,
    },
    category: "experimental",
    brewer: "origami-cone",
    brewerNotes:
      "Origami 'MK' + Sybarist Flat filter. Multi-temp highspeed 3-pour. Coffee blend: 9g Pink Bourbon + 6g Laurina.",
    dose: { grams: 15 },
    water: { grams: 240, ratio: "1:16" },
    temperature: { staged: [{ pourIndex: 0, celsius: 96, label: "pours 1-2" }, { pourIndex: 2, celsius: 90, label: "pour 3" }] },
    grind: {
      referenceGrinder: "1Zpresso K-Plus",
      referenceSetting: "8 (medium-coarse)",
      nicheZeroDegrees: [392, 404],
      description: "medium-coarse (estimate from grind description, not published — K-Plus dial not on the user's Niche map)",
    },
    pourSequence: [
      { label: "Blend in Origami", action: "wait", durationSec: 0, notes: "15g blend = 9g Pink Bourbon + 6g Laurina" },
      { label: "Pour 1 @96°C — zügig circular", action: "pour", waterGramsAtEnd: 100, durationSec: 15, temperatureC: 96 },
      { label: "Wait", action: "wait", durationSec: 35 },
      { label: "Pour 2 @96°C — zügig circular", action: "pour", waterGramsAtEnd: 200, durationSec: 15, temperatureC: 96 },
      { label: "Wait", action: "wait", durationSec: 35 },
      { label: "Pour 3 @90°C — central continuous flow", action: "pour", waterGramsAtEnd: 240, durationSec: 10, temperatureC: 90 },
      { label: "Drawdown", action: "drain", durationSec: 40 },
    ],
    totalTimeSec: 150,
    techniques: ["staged-temperature", "bean-blending", "multi-temp-pouring"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed", "natural"],
      varieties: ["Pink Bourbon", "Laurina", "Geisha"],
      goals: ["aromatic"],
    },
    teaches:
      "Bean-blending + multi-temp — combining Pink Bourbon (sweet, structured) with Laurina (low-caffeine, delicate florals) in 9:6 ratio. High-temp first two pours extract Pink Bourbon's sugars; lower-temp finish preserves Laurina's aromatics.",
    science:
      "Blends two coffees that complement on aroma: Pink Bourbon brings sweet body and Laurina contributes top-note florals. The 96°C-then-90°C drop tracks the extraction needs — early heat for the Pink Bourbon's denser solubility, lower temp to keep Laurina's volatiles in solution.",
    whenToUse:
      "Experimental — when you have two coffees you'd like to blend on the brewer. Pink Bourbon + Laurina is the documented pairing; the technique itself transfers to other complementary lots.",
    sources: [
      { type: "transcript", citation: "1Zpresso Champion Recipe Database — Kaygusuz Turkish BC 2025 entry", url: "https://1zpresso.coffee/recipe/", year: 2025 },
    ],
    verified: false,
    notes: "Total ~2:30. Niche range estimated from the grind-feel description (1Zpresso K-Plus dial does not map to the user's Niche↔Comandante calibration).",
  },

  // ── Chemex ───────────────────────────────────────────────────────────────

  {
    id: "madcap-chemex-6-cup",
    name: "Madcap — Chemex 6-Cup",
    shortName: "Madcap Chemex",
    attribution: {
      person: "Madcap Coffee Company",
      affiliation: "Grand Rapids MI",
    },
    category: "experimental",
    brewer: "chemex",
    brewerNotes:
      "Chemex 6-Cup. Standard 1:15 ratio for big batch. Filter rinsed thoroughly, 3-fold side to spout.",
    dose: { grams: 50 },
    water: { grams: 750, ratio: "1:15" },
    temperature: { celsius: 96 },
    grind: {
      referenceSetting: "medium-coarse (kosher salt)",
      nicheZeroDegrees: [392, 404],
      description: "medium-coarse, like kosher salt (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Rinse filter, discard water", action: "wait", durationSec: 15 },
      { label: "Coffee, level", action: "wait", durationSec: 10, notes: "50g coffee" },
      { label: "Bloom (2× coffee)", action: "pour", waterGramsAtEnd: 100, durationSec: 10 },
      { label: "Wait", action: "wait", durationSec: 35 },
      { label: "Slow circular pour", action: "pour", waterGramsAtEnd: 400, durationSec: 60 },
      { label: "Wait", action: "wait", durationSec: 15 },
      { label: "Slow circular pour", action: "pour", waterGramsAtEnd: 750, durationSec: 90 },
      { label: "Drawdown", action: "drain", durationSec: 60 },
    ],
    totalTimeSec: 270,
    techniques: ["big-batch-scaling", "slow-central-pour"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed", "natural"],
      goals: ["high-clarity"],
    },
    teaches:
      "Big-batch Chemex — same 1:15 ratio as small Chemex, scaled cleanly. The bed depth makes pour discipline (slow, central) more important than on smaller scale.",
    science:
      "Chemex's thick bonded paper filter strips most coffee oils — clarity is the result regardless of scale. 1:15 keeps the cup balanced rather than thin at this volume.",
    whenToUse:
      "3-4 person breakfast brews, light-roast specialty for a small dinner.",
    sources: [
      { type: "article", citation: "Madcap Coffee brewguide" },
    ],
    verified: false,
    notes: "Niche range estimated from the grind-feel description.",
  },

  {
    id: "freeform-chemex-6-cup",
    name: "Freeform — Chemex 6-Cup",
    shortName: "Freeform Chemex",
    attribution: {
      person: "Freeform Roasters",
    },
    category: "experimental",
    brewer: "chemex",
    brewerNotes: "Chemex 6-Cup. Slow-pour 1:15 with two main pours after bloom.",
    dose: { grams: 50 },
    water: { grams: 750, ratio: "1:15" },
    temperature: { celsius: 94 },
    grind: {
      referenceSetting: "medium-coarse",
      nicheZeroDegrees: [392, 404],
      description: "medium-coarse (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Filter rinse, discard", action: "wait", durationSec: 0 },
      { label: "Bloom", action: "pour", waterGramsAtEnd: 100, durationSec: 10 },
      { label: "Wait", action: "wait", durationSec: 35 },
      { label: "Pour 1 — slow circular", action: "pour", waterGramsAtEnd: 400, durationSec: 60 },
      { label: "Wait", action: "wait", durationSec: 15 },
      { label: "Pour 2 — slow circular", action: "pour", waterGramsAtEnd: 750, durationSec: 90 },
      { label: "Drawdown", action: "drain", durationSec: 60 },
    ],
    totalTimeSec: 270,
    techniques: ["big-batch-scaling", "slow-central-pour"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["any"],
      goals: ["high-clarity"],
    },
    teaches:
      "Adjacent to Madcap's; Freeform runs slightly cooler (94°C) for delicate light roasts.",
    science:
      "94°C vs 96°C is a small but meaningful shift on very-light coffees — keeps the brew well below boiling and reduces bitter compound extraction. Long pours maintain water level discipline.",
    whenToUse: "Very-light Nordic-roasted specialty in a Chemex format.",
    sources: [
      { type: "article", citation: "Freeform Roasters brewguide" },
    ],
    verified: false,
    notes: "Niche range estimated from the grind-feel description.",
  },

  {
    id: "manual-coffee-brewing-chemex-1l-mega-batch",
    name: "Manual Coffee Brewing — Chemex 1L Mega-Batch",
    shortName: "MCB Chemex 1L",
    attribution: {
      person: "Manual Coffee Brewing channel/community",
    },
    category: "experimental",
    brewer: "chemex",
    brewerNotes:
      "Chemex 8-Cup. Gentle batch-style brewing for the largest practical Chemex scale (1L water, ~65g coffee).",
    dose: { grams: 65 },
    water: { grams: 1000, ratio: "1:15.4" },
    temperature: { celsius: 96 },
    grind: {
      referenceSetting: "medium-coarse (slightly coarser than smaller Chemex)",
      nicheZeroDegrees: [396, 408],
      description: "medium-coarse, slightly coarser than smaller Chemex (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Filter rinse heavily (3×)", action: "wait", durationSec: 0 },
      { label: "Bloom (2× coffee)", action: "pour", waterGramsAtEnd: 130, durationSec: 15 },
      { label: "Wait", action: "wait", durationSec: 30 },
      { label: "Pour 1 — slow circular", action: "pour", waterGramsAtEnd: 500, durationSec: 90 },
      { label: "Wait", action: "wait", durationSec: 20 },
      { label: "Pour 2 — slow circular", action: "pour", waterGramsAtEnd: 1000, durationSec: 130 },
      { label: "Drawdown", action: "drain", durationSec: 105 },
    ],
    totalTimeSec: 390,
    techniques: ["big-batch-scaling", "slow-central-pour"],
    bestFor: {
      roastLevels: ["light", "medium-light", "medium"],
      processes: ["any"],
      goals: ["high-clarity", "balanced"],
      occasions: ["4-5 cups"],
    },
    teaches:
      "The largest practical Chemex scale — 1L of brewed coffee from one filter. Requires slightly coarser grind (deeper bed contact) and longer pour windows. Ideal for entertaining.",
    science:
      "At 1L, the filter and bed are at max capacity. Coarser grind prevents over-extraction across the longer contact time. Long pour windows keep slurry level safe (avoiding overflow at the filter top).",
    whenToUse:
      "Dinner parties, weekend brunches, anytime you need 4-5 cups of clean coffee from one brew.",
    sources: [
      { type: "video", citation: "Manual Coffee Brewing channel + community brewguide compilation" },
    ],
    verified: false,
    notes: "Niche range estimated from the grind-feel description.",
  },

  {
    id: "coava-chemex-disk-option",
    name: "Coava — Chemex (with Disk Filter Option)",
    shortName: "Coava Chemex",
    attribution: {
      person: "Coava Coffee Roasters",
      affiliation: "Portland OR",
    },
    category: "experimental",
    brewer: "chemex",
    brewerNotes:
      "Chemex with standard paper filter. Coava's published recipe also offers their own Stahl Disk metal filter as a body-enhancing alternative; that filter is not in our kit, so this recipe uses paper only. Note left here so you know the option exists if you ever acquire the disk.",
    dose: { grams: 21 },
    water: { grams: 336, ratio: "1:16" },
    temperature: { celsius: 95 },
    grind: {
      referenceSetting: "medium-fine",
      nicheZeroDegrees: [368, 382],
      description: "medium-fine (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Paper filter in Chemex, rinse, discard", action: "wait", durationSec: 0 },
      { label: "Coffee, level", action: "wait", durationSec: 0, notes: "21g coffee" },
      { label: "Bloom (2× coffee)", action: "pour", waterGramsAtEnd: 42, durationSec: 8 },
      { label: "Wait", action: "wait", durationSec: 37 },
      { label: "Slow spiral pour — keep bed flat", action: "pour", waterGramsAtEnd: 336, durationSec: 135 },
      { label: "Drawdown", action: "drain", durationSec: 60 },
    ],
    totalTimeSec: 240,
    techniques: ["slow-central-pour", "spiral-pour"],
    bestFor: {
      roastLevels: ["light", "medium-light", "medium"],
      processes: ["any"],
      goals: ["high-clarity"],
    },
    teaches:
      "Slow spiral pour on Chemex's bonded paper produces a deeply clean, light-body cup. Coava additionally publishes a metal-disk-filter variant for fuller body — same recipe, different filter — but with paper only you stay in the canonical Chemex clarity zone.",
    science:
      "Chemex's bonded paper absorbs most coffee oils (very clean cup). Spiral pours keep the bed flat throughout. 1:16 ratio with 21g dose lands in the balanced extraction window for light-to-medium roasts.",
    whenToUse:
      "Delicate light roasts where the Chemex's thick bonded paper gives you maximum clarity. (Coava's Stahl Disk option — for medium roasts where you want more mouthfeel — is documented but out of scope here.)",
    sources: [
      { type: "article", citation: "Coava Coffee Roasters brewguide", url: "https://coavacoffee.com/brew-methods/chemex" },
    ],
    verified: true,
    notes: "Niche range estimated from the grind-feel description.",
  },

  {
    id: "sample-mardan-chemex-6-cup",
    name: "Sample Coffee (Mardan) — Chemex 6-Cup",
    shortName: "Mardan Chemex",
    attribution: {
      person: "Reuben Mardan",
      affiliation: "Sample Coffee Roasters Australia",
      country: "Australia",
    },
    category: "experimental",
    brewer: "chemex",
    brewerNotes:
      "Chemex 6-Cup. Bloom + spiral pours, with bloom amount scaling to brewer size (40g for 3-Cup, 80g for 6-Cup).",
    dose: { grams: 40 },
    water: { grams: 640, ratio: "1:16" },
    temperature: { celsius: 96 },
    grind: {
      referenceSetting: "medium-coarse",
      nicheZeroDegrees: [392, 404],
      description: "medium-coarse (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Filter (bleached, 3-fold side to spout), rinse, discard", action: "wait", durationSec: 0 },
      { label: "Coffee, level", action: "wait", durationSec: 0, notes: "40g coffee" },
      { label: "Bloom (2× coffee for 6-Cup; scale to brewer)", action: "pour", waterGramsAtEnd: 80, durationSec: 10 },
      { label: "Wait", action: "wait", durationSec: 35 },
      { label: "Slow circular pours — water never above filter rim", action: "pour", waterGramsAtEnd: 640, durationSec: 210 },
      { label: "Drawdown", action: "drain", durationSec: 45 },
    ],
    totalTimeSec: 300,
    techniques: ["spiral-pour", "bloom-scaling"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed", "natural"],
      goals: ["high-clarity"],
    },
    teaches:
      "Bloom amount scales with brewer size — not a fixed gram count. 2× coffee weight is the standard ratio that adapts to any brew volume.",
    science:
      "A bloom that's 2× the coffee weight covers all grounds with consistent saturation regardless of dose. Spiral pours maintain bed evenness; the filter-rim discipline prevents water from bypassing the bed.",
    whenToUse:
      "Daily Chemex routine, especially when scaling between 3-Cup and 6-Cup brewers without changing methodology.",
    sources: [
      { type: "article", citation: "Sample Coffee Roasters brewguide (Reuben Mardan)", url: "https://samplecoffee.com.au" },
    ],
    verified: true,
    notes: "For 3-Cup: 20g/320g. Niche range estimated from the grind-feel description.",
  },

  {
    id: "methodical-chemex-vacuum-stall-lift",
    name: "Methodical — Chemex with Vacuum-Stall Lift",
    shortName: "Methodical Chemex",
    attribution: {
      person: "Methodical Coffee",
      affiliation: "Greenville SC",
    },
    category: "experimental",
    brewer: "chemex",
    brewerNotes:
      "Chemex Classic. Signature move: lift the filter from one side mid-brew if drawdown stalls (breaks the suction).",
    dose: { grams: 20 },
    water: { grams: 320, ratio: "1:16" },
    temperature: { celsius: 96 },
    grind: {
      referenceSetting: "medium-coarse (kosher salt)",
      nicheZeroDegrees: [392, 404],
      description: "medium-coarse, like kosher salt (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Filter rinse, discard", action: "wait", durationSec: 0 },
      { label: "Coffee, level, tare", action: "wait", durationSec: 0, notes: "20g coffee" },
      { label: "Bloom (2× coffee in spiral)", action: "pour", waterGramsAtEnd: 40, durationSec: 10 },
      { label: "Wait", action: "wait", durationSec: 30 },
      { label: "Slow spiral pour, increasing", action: "pour", waterGramsAtEnd: 200, durationSec: 40 },
      { label: "If drawdown stalls: lift filter from one side to break suction", action: "drain", notes: "breaks the vacuum seal at the filter base" },
      { label: "Continue slow circular pours", action: "pour", waterGramsAtEnd: 320, durationSec: 45 },
      { label: "Drawdown", action: "drain", durationSec: 135 },
    ],
    totalTimeSec: 270,
    techniques: ["filter-lift", "spiral-pour"],
    bestFor: {
      roastLevels: ["light", "medium-light", "medium"],
      processes: ["any"],
      goals: ["high-clarity"],
    },
    teaches:
      "The Filter-Lift trick — when Chemex drawdown stalls (suction effect at the filter base), gently lift one side of the paper to break the seal. Methodical's specific contribution to Chemex method.",
    science:
      "Chemex's thick paper + glass base sometimes creates a vacuum seal that slows drawdown to a crawl. Lifting one side of the filter momentarily breaks the seal without disturbing the bed; the brew resumes normal drawdown.",
    whenToUse:
      "Anytime your Chemex stalls partway through drawdown (most common with fine grind or fresh roasts). The lift recovers the brew without restarting.",
    sources: [
      { type: "article", citation: "Methodical Coffee brewguide", url: "https://methodicalcoffee.com" },
    ],
    verified: true,
    notes: "Niche range estimated from the grind-feel description.",
  },

  {
    id: "crema-chemex-final-swirl",
    name: "Crema — Chemex 1:16 with Final Swirl",
    shortName: "Crema Chemex",
    attribution: {
      person: "Crema Coffee Roasters",
      affiliation: "Knoxville TN",
    },
    category: "experimental",
    brewer: "chemex",
    brewerNotes:
      "Chemex Classic. Signature: final swirl of finished brew to integrate top/bottom extraction layers.",
    dose: { grams: 25 },
    water: { grams: 400, ratio: "1:16" },
    temperature: { celsius: 94 },
    grind: {
      referenceSetting: "medium-coarse (kosher salt)",
      nicheZeroDegrees: [392, 404],
      description: "medium-coarse, like kosher salt (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Filter (3-fold side to spout) rinsed with boiling water", action: "wait", durationSec: 0 },
      { label: "Coffee, level", action: "wait", durationSec: 0, notes: "25g coffee" },
      { label: "Bloom (2× coffee)", action: "pour", waterGramsAtEnd: 50, durationSec: 10 },
      { label: "Wait", action: "wait", durationSec: 35 },
      { label: "Slow circular main pour", action: "pour", waterGramsAtEnd: 400, durationSec: 135 },
      { label: "Drawdown", action: "drain", durationSec: 45 },
      { label: "Swirl Chemex vigorously to integrate layers", action: "swirl", durationSec: 15, notes: "remove filter first" },
      { label: "Serve in preheated cup", action: "wait", durationSec: 0 },
    ],
    totalTimeSec: 240,
    techniques: ["final-swirl", "slow-central-pour"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["any"],
      goals: ["balanced", "high-clarity"],
    },
    teaches:
      "Top of the Chemex jar holds more bright/acidic compounds (extracted late); bottom holds more body. A vigorous final swirl integrates them into a balanced cup.",
    science:
      "Without swirling, you'd taste different layers as you drink. Swirling homogenises the brew — every sip is the average rather than a fluctuating timeline.",
    whenToUse:
      "Anytime you want consistent flavour throughout the cup (which is usually). Especially important for Chemex because the glass jar holds the extracted layers visibly.",
    sources: [
      { type: "article", citation: "Crema Coffee brewguide — 'clean and crisp cup'", url: "https://crema-coffee.com" },
    ],
    verified: true,
    notes: "Scales to 50g/800g for 2-Cup. Niche range estimated from the grind-feel description.",
  },

  {
    id: "project-barista-chemex-8-cup-big-batch",
    name: "Project Barista — Chemex 8-Cup Big Batch",
    shortName: "PB Chemex 8",
    attribution: {
      person: "Daniel",
      affiliation: "Project Barista (head author since 2016)",
    },
    category: "experimental",
    brewer: "chemex",
    brewerNotes: "Chemex 8-Cup. Big batch for 5 people, 1:15 ratio with coarse grind.",
    dose: { grams: 53 },
    water: { grams: 800, ratio: "1:15" },
    temperature: { celsius: 96 },
    grind: {
      referenceSetting: "coarse",
      nicheZeroDegrees: [404, 418],
      description: "coarse (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Filter (8-Cup size) rinse, discard", action: "wait", durationSec: 0 },
      { label: "Coffee, level", action: "wait", durationSec: 0, notes: "53g coffee" },
      { label: "Bloom (2× coffee)", action: "pour", waterGramsAtEnd: 105, durationSec: 15 },
      { label: "Wait", action: "wait", durationSec: 30 },
      { label: "Slow circular pour", action: "pour", waterGramsAtEnd: 400, durationSec: 75 },
      { label: "Wait", action: "wait", durationSec: 10 },
      { label: "Slow circular pour", action: "pour", waterGramsAtEnd: 800, durationSec: 130 },
      { label: "Drawdown", action: "drain", durationSec: 70 },
    ],
    totalTimeSec: 330,
    techniques: ["big-batch-scaling", "slow-central-pour"],
    bestFor: {
      roastLevels: ["light", "medium-light", "medium"],
      processes: ["any"],
      goals: ["high-clarity"],
      occasions: ["5 cups"],
    },
    teaches:
      "Coarse grind compensates for the deep bed at 8-Cup scale — without it, the brew would over-extract from the bottom layers.",
    science:
      "A coarser grind at this dose keeps total contact time in a reasonable window. 1:15 keeps the cup balanced even though the per-serving volume is high.",
    whenToUse:
      "Big dinner brews, 5-person breakfasts. The largest Chemex format for entertaining.",
    sources: [
      { type: "article", citation: "Project Barista — 'tea-like brews'", url: "https://projectbarista.com/chemex-recipes" },
    ],
    verified: true,
    notes: "Niche range estimated from the grind-feel description.",
  },

  {
    id: "penstock-chemex-3-cup-light-body",
    name: "Penstock — Chemex 3-Cup Light-Body",
    shortName: "Penstock Chemex 3",
    attribution: {
      person: "Penstock Coffee Roasters",
      affiliation: "Highland Park NJ",
    },
    category: "experimental",
    brewer: "chemex",
    brewerNotes:
      "Chemex 3-Cup. Lighter-than-standard 1:17.7 ratio targeting deliberately light-body clean cup. Trick: double-layer filter side to spout (NOT against, for better airflow).",
    dose: { grams: 20 },
    water: { grams: 354, ratio: "1:17.7" },
    temperature: { celsius: 96 },
    grind: {
      referenceSetting: "medium-coarse (kosher salt)",
      nicheZeroDegrees: [392, 404],
      description: "medium-coarse, like kosher salt (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Filter (double-layer side to spout) in Chemex", action: "wait", durationSec: 0 },
      { label: "Rinse + preheat", action: "pour", durationSec: 15, notes: "100g hot water over filter for rinse + Chemex preheat" },
      { label: "Pour rinse water into mug (preheats mug)", action: "wait", durationSec: 0 },
      { label: "Coffee, gentle shake to level, tare", action: "wait", durationSec: 0, notes: "20g coffee" },
      { label: "Bloom (small concentric circles — saturate all beans)", action: "pour", waterGramsAtEnd: 50, durationSec: 10 },
      { label: "CO2 release", action: "wait", durationSec: 30 },
      { label: "Pour — minimal disruption", action: "pour", waterGramsAtEnd: 150, durationSec: 30 },
      { label: "Pour (water level drops)", action: "pour", waterGramsAtEnd: 250, durationSec: 40 },
      { label: "Pour once more", action: "pour", waterGramsAtEnd: 354, durationSec: 40 },
      { label: "Drawdown", action: "drain", durationSec: 60 },
      { label: "Pour mug rinse out, swirl Chemex, pour to mug", action: "swirl", durationSec: 0 },
    ],
    totalTimeSec: 240,
    techniques: ["filter-orientation", "slow-central-pour"],
    bestFor: {
      roastLevels: ["very-light", "light"],
      processes: ["washed", "honey"],
      goals: ["high-clarity"],
    },
    teaches:
      "Filter-orientation matters — double-layer SIDE to spout (not against) allows air to escape past the filter during drawdown. Penstock's specific finding.",
    science:
      "The 1:17.7 ratio + light-roast targeting + the air-escape filter orientation produces a deliberately delicate cup. Filter orientation is the small detail that distinguishes a 4-min drawdown from a 6-min stall.",
    whenToUse:
      "Light-bodied target — very-light Ethiopians or floral washed where you want delicacy, not body.",
    sources: [
      { type: "article", citation: "Penstock Coffee brewguide — explicit 'light-bodied, clean cup'", url: "https://penstockcoffee.com" },
    ],
    verified: true,
    notes: "Yields 2 standard or 1× 12oz cup. Niche range estimated from the grind-feel description.",
  },

  // ── Kalita ───────────────────────────────────────────────────────────────

  {
    id: "mccarthy-2013-kalita-wac-champion",
    name: "McCarthy 2013 — Kalita WAC Champion",
    shortName: "McCarthy Kalita",
    attribution: {
      person: "Erin McCarthy",
      title: "World Brewers Cup Champion 2013",
      year: 2013,
    },
    category: "experimental",
    brewer: "kalita-wave",
    brewerNotes:
      "Kalita Wave 185. McCarthy's championship pour pattern: bloom + multiple equal-pour pulses.",
    dose: { grams: 20 },
    water: { grams: 325, ratio: "1:16.25" },
    temperature: { celsius: 96 },
    grind: {
      referenceSetting: "medium",
      nicheZeroDegrees: [382, 392],
      description: "medium (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Bloom", action: "pour", waterGramsAtEnd: 50, durationSec: 8 },
      { label: "Wait", action: "wait", durationSec: 37 },
      { label: "Pour 1 — slow circular", action: "pour", waterGramsAtEnd: 125, durationSec: 20 },
      { label: "Wait", action: "wait", durationSec: 20 },
      { label: "Pour 2", action: "pour", waterGramsAtEnd: 200, durationSec: 20 },
      { label: "Wait", action: "wait", durationSec: 20 },
      { label: "Pour 3", action: "pour", waterGramsAtEnd: 275, durationSec: 20 },
      { label: "Wait", action: "wait", durationSec: 15 },
      { label: "Pour 4", action: "pour", waterGramsAtEnd: 325, durationSec: 15 },
      { label: "Drawdown", action: "drain", durationSec: 35 },
    ],
    totalTimeSec: 210,
    techniques: ["equal-pour-schedule", "pulse-pouring"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed", "natural"],
      goals: ["sweetness-forward", "high-clarity"],
    },
    teaches:
      "Multi-pulse Kalita — equal pours on a flat-bottom brewer produce metronomic, sweet extraction. McCarthy's championship choice was the Kalita Wave, not V60.",
    science:
      "Kalita's flat bottom + 3-hole drain creates a thin even bed regardless of pour pattern. Multiple equal pulses maintain consistent slurry level and bed agitation across the brew, building sweetness without bitterness.",
    whenToUse:
      "Sweet-target brews on Kalita — naturally-processed coffees, honey processes, anything where sweetness should lead.",
    sources: [
      { type: "report", citation: "World Brewers Cup 2013 final — competition reporting", year: 2013 },
    ],
    verified: false,
    notes: "Niche range estimated from the grind-feel description.",
  },

  {
    id: "coffee-collective-kalita-wave",
    name: "Coffee Collective — Kalita Wave",
    shortName: "CC Kalita",
    attribution: {
      person: "The Coffee Collective",
      affiliation: "Copenhagen",
      country: "Denmark",
    },
    category: "experimental",
    brewer: "kalita-wave",
    brewerNotes:
      "Kalita Wave 185. Copenhagen-style Nordic-clean Kalita. Light dose, generous ratio.",
    dose: { grams: 17 },
    water: { grams: 280, ratio: "1:16.5" },
    temperature: { celsius: 94 },
    grind: {
      referenceSetting: "medium",
      nicheZeroDegrees: [382, 392],
      description: "medium (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Bloom (2× coffee)", action: "pour", waterGramsAtEnd: 35, durationSec: 5 },
      { label: "Wait", action: "wait", durationSec: 40 },
      { label: "Pour 1", action: "pour", waterGramsAtEnd: 130, durationSec: 25 },
      { label: "Wait", action: "wait", durationSec: 20 },
      { label: "Pour 2", action: "pour", waterGramsAtEnd: 210, durationSec: 20 },
      { label: "Wait", action: "wait", durationSec: 15 },
      { label: "Pour 3", action: "pour", waterGramsAtEnd: 280, durationSec: 15 },
      { label: "Drawdown", action: "drain", durationSec: 70 },
    ],
    totalTimeSec: 210,
    techniques: ["pulse-pouring", "nordic-light"],
    bestFor: {
      roastLevels: ["very-light", "light"],
      processes: ["washed"],
      varieties: ["SL28", "SL34", "Heirloom"],
      goals: ["high-clarity"],
    },
    teaches:
      "Nordic Copenhagen approach to Kalita — leaner ratio (1:16.5) and slightly lower temp (94°C) for the very-light Coffee Collective roasts.",
    science:
      "Coffee Collective roasts very light; standard 1:15 + 96°C would over-extract their lots into sourness. The lean ratio + slightly cooler water sits in the sweet/aromatic window.",
    whenToUse:
      "Coffee Collective coffees specifically, or other very-light Nordic-style roasts.",
    sources: [
      { type: "article", citation: "The Coffee Collective brewguide" },
    ],
    verified: false,
    notes: "Niche range estimated from the grind-feel description.",
  },

  {
    id: "sprudge-kalita-185-big-batch",
    name: "Sprudge — Kalita 185 Big Batch",
    shortName: "Sprudge Kalita 185",
    attribution: {
      person: "Sprudge Coffee Media",
      title: "collected industry recipes",
    },
    category: "experimental",
    brewer: "kalita-wave",
    brewerNotes: "Kalita Wave 185. Big batch for 2 cups, balanced default.",
    dose: { grams: 30 },
    water: { grams: 500, ratio: "1:16.67" },
    temperature: { celsius: 96 },
    grind: {
      referenceSetting: "medium",
      nicheZeroDegrees: [382, 392],
      description: "medium (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Bloom", action: "pour", waterGramsAtEnd: 60, durationSec: 10 },
      { label: "Wait", action: "wait", durationSec: 35 },
      { label: "Pour 1", action: "pour", waterGramsAtEnd: 250, durationSec: 30 },
      { label: "Wait", action: "wait", durationSec: 20 },
      { label: "Pour 2", action: "pour", waterGramsAtEnd: 400, durationSec: 30 },
      { label: "Wait", action: "wait", durationSec: 15 },
      { label: "Pour 3", action: "pour", waterGramsAtEnd: 500, durationSec: 20 },
      { label: "Drawdown", action: "drain", durationSec: 80 },
    ],
    totalTimeSec: 240,
    techniques: ["pulse-pouring", "big-batch-scaling"],
    bestFor: {
      roastLevels: ["light", "medium-light", "medium"],
      processes: ["any"],
      goals: ["balanced"],
    },
    teaches:
      "A media-compiled industry-default Kalita 185 — the 1:16.67 ratio is forgiving across coffees, the 3-pour schedule is straightforward.",
    science:
      "Equal-ish pulses on the Kalita's flat bottom keep the bed even. Lean ratio prevents over-extraction at the larger scale.",
    whenToUse: "When you have a 185 Kalita and want a no-think 2-cup brew.",
    sources: [
      { type: "article", citation: "Sprudge Coffee Media — Kalita 185 brewing compilations" },
    ],
    verified: false,
    notes: "Niche range estimated from the grind-feel description.",
  },

  {
    id: "stumptown-kalita-wave",
    name: "Stumptown — Kalita Wave",
    shortName: "Stumptown Kalita",
    attribution: {
      person: "Stumptown Coffee Roasters",
      affiliation: "Portland OR",
    },
    category: "experimental",
    brewer: "kalita-wave",
    brewerNotes:
      "Kalita Wave 185. Bloom + 3-phase pour with periodic top-ups; explicit spiral motion for 'integration' + 'even extraction'.",
    dose: { grams: 21 },
    water: { grams: 345, ratio: "1:16.4" },
    temperature: { celsius: 96 },
    grind: {
      referenceSetting: "medium-fine (sea salt)",
      nicheZeroDegrees: [368, 382],
      description: "medium-fine, like sea salt (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Bloom", action: "pour", waterGramsAtEnd: 60, durationSec: 10 },
      { label: "Stir to wet all grounds", action: "stir", durationSec: 5 },
      { label: "Wait", action: "wait", durationSec: 30 },
      { label: "Pour — spiral motion", action: "pour", waterGramsAtEnd: 200, durationSec: 15 },
      { label: "Wait briefly", action: "wait", durationSec: 20 },
      { label: "Periodic small top-ups (25-50g each) until 345g", action: "pour", waterGramsAtEnd: 345, durationSec: 40 },
      { label: "Drawdown", action: "drain", durationSec: 90 },
    ],
    totalTimeSec: 210,
    techniques: ["spiral-pour", "periodic-top-up"],
    bestFor: {
      roastLevels: ["light", "medium-light", "medium"],
      processes: ["any"],
      goals: ["balanced", "sweetness-forward"],
    },
    teaches:
      "Periodic small top-ups (1-2 minutes apart) maintain consistent extraction without large bed disturbances. Stumptown's specific method.",
    science:
      "Small pours don't crash the bed or change slurry depth significantly — extraction stays even. Spiral motion integrates the pours into the existing slurry rather than creating concentrated columns.",
    whenToUse:
      "Default Kalita brew when you want better-than-average evenness without timing complex pour patterns.",
    sources: [
      { type: "article", citation: "Stumptown Coffee brewguide", url: "https://stumptowncoffee.com/pages/brew-guide-kalita-wave" },
    ],
    verified: true,
    notes: "Niche range estimated from the grind-feel description.",
  },

  {
    id: "subtext-kalita-155-5-pulse",
    name: "Subtext — Kalita 155 (5-Pulse)",
    shortName: "Subtext Kalita 155",
    attribution: {
      person: "Subtext Coffee Roasters",
      affiliation: "Toronto",
    },
    category: "experimental",
    brewer: "kalita-wave",
    brewerNotes:
      "Kalita Wave 155 (smaller size — Subtext explicitly prefers 155 over 185 to reduce bypass risk). 5-pulse schedule with 10s waits.",
    dose: { grams: 14 },
    water: { grams: 235, ratio: "1:16.8" },
    temperature: { celsius: 96 },
    grind: {
      referenceSetting: "medium, slightly coarser than V60",
      nicheZeroDegrees: [384, 394],
      description: "medium, slightly coarser than V60 (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Bloom", action: "pour", waterGramsAtEnd: 50, durationSec: 8 },
      { label: "Wait", action: "wait", durationSec: 37 },
      { label: "Pour 2", action: "pour", waterGramsAtEnd: 100, durationSec: 10 },
      { label: "Wait", action: "wait", durationSec: 10 },
      { label: "Pour 3", action: "pour", waterGramsAtEnd: 150, durationSec: 10 },
      { label: "Wait", action: "wait", durationSec: 10 },
      { label: "Pour 4", action: "pour", waterGramsAtEnd: 200, durationSec: 10 },
      { label: "Pour 5", action: "pour", waterGramsAtEnd: 235, durationSec: 10 },
      { label: "Drawdown", action: "drain", durationSec: 75 },
    ],
    totalTimeSec: 180,
    techniques: ["pulse-pouring", "small-brewer-bypass-control"],
    bestFor: {
      roastLevels: ["very-light", "light"],
      processes: ["washed"],
      goals: ["high-clarity"],
    },
    teaches:
      "The 155-size choice — Subtext explicitly chose 155 over 185 because 185 has bypass-risk at single-cup doses. 5-pulse keeps the brew rhythmic and clean.",
    science:
      "Smaller Kalita = thinner bed at single-cup doses = less likely to have water bypass the bed at the walls. Plus the 5-pulse schedule keeps slurry level steady.",
    whenToUse:
      "Single-cup Kalita brewing where 185 would feel oversized for the dose.",
    sources: [
      { type: "article", citation: "Subtext Coffee Roasters brewguide" },
    ],
    verified: true,
    notes: "Niche range estimated from the grind-feel description.",
  },

  {
    id: "drop-coffee-kalita-155-stockholm",
    name: "Drop Coffee — Kalita 155 (Stockholm)",
    shortName: "Drop Kalita 155",
    attribution: {
      person: "Drop Coffee Roasters",
      affiliation: "Stockholm",
      country: "Sweden",
    },
    category: "experimental",
    brewer: "kalita-wave",
    brewerNotes:
      "Kalita Wave 155. CO2-bubble-stop pour trigger — visual cue rather than timed.",
    dose: { grams: 16 },
    water: { grams: 260, ratio: "1:16.25" },
    temperature: { celsius: 94, rangeC: [92, 96] },
    grind: {
      referenceSetting: "medium",
      nicheZeroDegrees: [382, 392],
      description: "medium (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Filter rinse with hot water (preheats Kalita)", action: "wait", durationSec: 0 },
      { label: "Bloom", action: "pour", waterGramsAtEnd: 50, durationSec: 10 },
      { label: "Wait until bubbling stops (CO2-release complete)", action: "wait", durationSec: 25 },
      { label: "Pour", action: "pour", waterGramsAtEnd: 100, durationSec: 15 },
      { label: "Wait", action: "wait", durationSec: 25 },
      { label: "Pour", action: "pour", waterGramsAtEnd: 200, durationSec: 20 },
      { label: "Wait briefly", action: "wait", durationSec: 10 },
      { label: "Pour", action: "pour", waterGramsAtEnd: 260, durationSec: 15 },
      { label: "Drawdown", action: "drain", durationSec: 60 },
    ],
    totalTimeSec: 180,
    techniques: ["bubble-stop-trigger", "co2-management", "pulse-pouring"],
    bestFor: {
      roastLevels: ["very-light", "light"],
      processes: ["washed"],
      varieties: ["Heirloom", "SL28", "SL34"],
      goals: ["high-clarity"],
    },
    teaches:
      "Bubble-stop pour trigger — wait until CO2 bubbling visibly stops before pouring again. Avoids over-pouring on an off-gassing bed.",
    science:
      "Fresh coffee off-gases CO2 actively during bloom and early pours. Pouring while bubbling continues means water flows past CO2-trapped grounds. Wait for bubbles to subside = water contacts saturated, degassed grounds = even extraction.",
    whenToUse:
      "Fresh Nordic-roasted coffee where CO2 management matters most.",
    sources: [
      { type: "article", citation: "Drop Coffee Roasters brewguide", url: "https://dropcoffee.com" },
    ],
    verified: true,
    notes: "Temperature 92–96°C (Drop's choice depends on roast), taken as 94°C working. Total 2:45–3:00. Niche range estimated from the grind-feel description.",
  },

  {
    id: "tinker-kalita-5-stage-counterclockwise",
    name: "Tinker — Kalita 5-Stage Counterclockwise",
    shortName: "Tinker Kalita",
    attribution: {
      person: "Tinker Coffee Co.",
      affiliation: "Indianapolis",
    },
    category: "experimental",
    brewer: "kalita-wave",
    brewerNotes:
      "Kalita Wave 185. Tinker's daily-driver: 5-stage pulse with counterclockwise swirl for flat bed maintenance.",
    dose: { grams: 22 },
    water: { grams: 360, ratio: "1:16.4" },
    temperature: { celsius: 96 },
    grind: {
      referenceSetting: "medium",
      nicheZeroDegrees: [382, 392],
      description: "medium (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Bloom", action: "pour", waterGramsAtEnd: 70, durationSec: 10 },
      { label: "Wait", action: "wait", durationSec: 30 },
      { label: "Pour — start outer rim, spiral in", action: "pour", waterGramsAtEnd: 145, durationSec: 15 },
      { label: "Wait", action: "wait", durationSec: 25 },
      { label: "Pour + gentle counterclockwise swirl", action: "swirl", waterGramsAtEnd: 220, durationSec: 15 },
      { label: "Wait", action: "wait", durationSec: 25 },
      { label: "Pour", action: "pour", waterGramsAtEnd: 295, durationSec: 15 },
      { label: "Wait", action: "wait", durationSec: 15 },
      { label: "Pour", action: "pour", waterGramsAtEnd: 360, durationSec: 15 },
      { label: "Drawdown, gentle tap", action: "drain", durationSec: 45 },
    ],
    totalTimeSec: 210,
    techniques: ["counterclockwise-swirl", "pulse-pouring", "flat-bed-maintenance"],
    bestFor: {
      roastLevels: ["light", "medium-light", "medium"],
      processes: ["any"],
      goals: ["balanced", "sweetness-forward"],
    },
    teaches:
      "Counterclockwise swirl maintains a flat coffee bed throughout brewing. Tinker's distinctive 5-stage pulse — used in 99.9% of their brews per their guide.",
    science:
      "As grounds settle during a Kalita brew, the bed tilts. A gentle counterclockwise swirl at the mid-brew mark relevels the bed without disturbing extraction. The 5-stage pulse keeps the bed thin and the slurry level stable.",
    whenToUse:
      "Daily-driver Kalita where consistency matters across many brews.",
    sources: [
      { type: "article", citation: "Tinker Coffee brewguide (via Indianapolis Coffee Guide Batch 1)" },
    ],
    verified: true,
    notes: "Niche range estimated from the grind-feel description.",
  },

  {
    id: "counter-culture-kalita-big-batch",
    name: "Counter Culture — Kalita Big Batch",
    shortName: "CCC Kalita",
    attribution: {
      person: "Counter Culture Coffee",
      affiliation: "Durham NC",
    },
    category: "experimental",
    brewer: "kalita-wave",
    brewerNotes:
      "Kalita Wave 185. Big-batch pulsed pour up to 500g; empirical (not timed) — pour again when water drops 1 cm.",
    dose: { grams: 30 },
    water: { grams: 500, ratio: "1:16.7" },
    temperature: { celsius: 93 },
    grind: {
      referenceSetting: "medium, slightly finer than kosher salt",
      nicheZeroDegrees: [384, 394],
      description: "medium, slightly finer than kosher salt (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Bloom — saturate all grounds", action: "pour", waterGramsAtEnd: 60, durationSec: 10 },
      { label: "Wait", action: "wait", durationSec: 20 },
      { label: "Pour in circular motion", action: "pour", waterGramsAtEnd: 200, durationSec: 30 },
      { label: "Wait until water drops ~1cm", action: "wait", durationSec: 30 },
      { label: "Pour", action: "pour", waterGramsAtEnd: 300, durationSec: 30 },
      { label: "Loop: pour ~100g every time water drops ~1cm until 500g", action: "pour", waterGramsAtEnd: 500 },
      { label: "Drawdown", action: "drain", durationSec: 60 },
    ],
    totalTimeSec: 270,
    techniques: ["water-drop-trigger", "pulse-pouring", "big-batch-scaling"],
    bestFor: {
      roastLevels: ["light", "medium-light", "medium"],
      processes: ["any"],
      goals: ["balanced", "sweetness-forward"],
    },
    teaches:
      "Empirical method — instead of fixed time intervals, watch the water level. Pour again when it drops ~1cm. Robust against grind variation.",
    science:
      "Different coffees drain at different rates. A fixed-time schedule misfires on coffees that drain faster or slower than expected. The water-drop rule auto-calibrates to whatever drain rate the current coffee produces.",
    whenToUse:
      "When you're brewing coffees of unknown drain characteristics, or want a method that handles grind-variation gracefully.",
    sources: [
      { type: "article", citation: "Counter Culture Coffee brewguide", url: "https://counterculturecoffee.com/pages/quick-easy-pour-over" },
    ],
    verified: true,
    notes: "Temperature ~93°C (200°F). Niche range estimated from the grind-feel description.",
  },

  // ── Moccamaster ──────────────────────────────────────────────────────────

  {
    id: "sample-mardan-moccamaster-pre-infusion-bloom",
    name: "Sample (Mardan) — Moccamaster Pre-Infusion Bloom",
    shortName: "Mardan Moccamaster",
    attribution: {
      person: "Reuben Mardan",
      affiliation: "Sample Coffee Roasters Australia",
      country: "Australia",
    },
    category: "experimental",
    brewer: "moccamaster",
    brewerNotes:
      "Moccamaster Classic. Closed-gate pre-infusion trick: funnel-flow ⨂ closed during initial fill (~half-basket), Moccamaster OFF, stir to wet all grounds, then open ○ and resume. Scales 1:16 linearly from 31g/500g up to 78g/1250g.",
    dose: { grams: 31 },
    water: { grams: 500, ratio: "1:16" },
    temperature: { rangeC: [92, 96] },
    grind: {
      referenceSetting: "slightly coarser than V60/Chemex",
      nicheZeroDegrees: [392, 404],
      description: "slightly coarser than V60/Chemex (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Prep filter", action: "wait", durationSec: 0, notes: "Moccamaster paper No. 4 in basket, rinse with hot water (optional)" },
      { label: "Add coffee to filter basket", action: "wait", durationSec: 0 },
      { label: "Funnel-flow closed ⨂, Moccamaster ON", action: "wait", durationSec: 0 },
      { label: "Basket fills ~halfway (~20–30s), Moccamaster OFF", action: "pour", durationSec: 30 },
      { label: "Gentle stir — wet all grounds", action: "stir", durationSec: 5, notes: "avoid ripping filter" },
      { label: "Funnel-flow open ○, Moccamaster ON", action: "drain", durationSec: 0 },
      { label: "Brew completes (~5 min)", action: "wait", durationSec: 265 },
      { label: "Swirl carafe, serve", action: "swirl", durationSec: 0 },
    ],
    totalTimeSec: 330,
    techniques: ["pre-infusion", "closed-gate-bloom", "machine-brew"],
    bestFor: {
      roastLevels: ["light", "medium-light", "medium"],
      processes: ["any"],
      goals: ["balanced", "sweetness-forward"],
    },
    teaches:
      "Pre-Infusion via Closed-Gate trick — without it, water rushes past the dry bed and channels. The half-fill-then-stir step gives Moccamaster a bloom phase the machine doesn't natively offer.",
    science:
      "A dry Moccamaster bed doesn't bloom — the machine starts pouring at brew rate immediately, and CO2-trapped grounds form channels. Closing the funnel-flow lets water pool on the bed; the stir guarantees full saturation. Opening the flow then starts even extraction on a wetted, degassed bed.",
    whenToUse:
      "Default Moccamaster brew — works on any roast, any volume. The pre-infusion is the entire reason this recipe outperforms naked-Moccamaster brewing.",
    sources: [
      { type: "article", citation: "Sample Coffee Roasters brewguide", url: "https://samplecoffee.com.au/brewguides/moccamaster" },
    ],
    verified: true,
    notes: "Temperature machine-controlled (~92–96°C at the bed). Dose scales 1:16 linearly 31g/500g up to 78g/1250g; main entry uses 31g/500g. Niche range estimated from the grind-feel description.",
  },

  {
    id: "market-lane-moccamaster-mid-brew-stir",
    name: "Market Lane — Moccamaster (Mid-Brew Stir)",
    shortName: "Market Lane Moccamaster",
    attribution: {
      person: "Market Lane Coffee",
      affiliation: "Melbourne",
      country: "Australia",
    },
    category: "experimental",
    brewer: "moccamaster",
    brewerNotes:
      "Moccamaster Classic or Select. Mid-brew stir for even saturation. Target: 'clean, lighter-bodied, complex' — pour-over-like result.",
    dose: { grams: 30 },
    water: { grams: 500, ratio: "1:16.67" },
    temperature: { rangeC: [92, 96] },
    grind: {
      referenceSetting: "coarser than pour-over, finer than plunger",
      nicheZeroDegrees: [392, 404],
      description: "coarser than pour-over, finer than plunger (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Prep filter", action: "wait", durationSec: 0, notes: "fold along seams, place in basket, rinse with hot water" },
      { label: "Coffee in filter, level", action: "wait", durationSec: 0 },
      { label: "Fill tank to 1¼ line (1.25L)", action: "wait", durationSec: 0 },
      { label: "Filter-basket set to 'O' (open)", action: "wait", durationSec: 0 },
      { label: "Moccamaster ON", action: "drain", durationSec: 0 },
      { label: "When bed is wetted (~30–60s): gentle stir", action: "stir", durationSec: 5, notes: "wet all grounds for even extraction" },
      { label: "Let machine complete (~6 min)", action: "wait", durationSec: 300 },
      { label: "Carafe swirl, serve", action: "swirl", durationSec: 0 },
    ],
    totalTimeSec: 360,
    techniques: ["mid-brew-stir", "machine-brew"],
    bestFor: {
      roastLevels: ["very-light", "light", "medium-light"],
      processes: ["washed", "natural"],
      goals: ["high-clarity"],
    },
    teaches:
      "Mid-brew stir is the signature — Market Lane's documented antidote to air-pockets in the bed. Without it, the Moccamaster's continuous-pour creates uneven extraction.",
    science:
      "Once water has wetted the bed (~30–60s in), the slurry is dense enough that a single stir resuspends grounds and breaks up channels. The machine continues pouring at standard rate — the stir is the only manual intervention.",
    whenToUse:
      "Daily Moccamaster brew, especially for light-roast specialty where the cup should read clean and complex rather than full.",
    sources: [
      { type: "article", citation: "Market Lane Coffee brewguide — 'produces a clean, lighter-bodied, complex cup similar to pour over'", url: "https://marketlane.com.au/pages/how-to-make-coffee-with-a-moccamaster" },
    ],
    verified: true,
    notes: "Temperature machine-controlled. Dose 30–75 g / 500–1250 g (1:16.67, 60g per 1L); main entry uses 30g/500g. Niche range estimated from the grind-feel description.",
  },

  {
    id: "lykke-kaffegardar-moccamaster-big-batch-scandi",
    name: "Lykke Kaffegårdar — Moccamaster Big-Batch (Scandi)",
    shortName: "Lykke Moccamaster",
    attribution: {
      person: "Lykke Kaffegårdar",
      country: "Sweden",
    },
    category: "experimental",
    brewer: "moccamaster",
    brewerNotes:
      "Any home Moccamaster. Big-batch 1L+ Scandi method with mid-brew bed-turn (spoon turns the bed over, not just stirs). Lid stays on for even temperature.",
    dose: { grams: 75 },
    water: { grams: 1250, ratio: "1:16.67" },
    temperature: { rangeC: [92, 96] },
    grind: {
      referenceSetting: "medium-coarse (granulated sugar)",
      nicheZeroDegrees: [392, 404],
      description: "medium-coarse, like granulated sugar (estimate from grind description, not published)",
    },
    pourSequence: [
      { label: "Prep — clean filter holder + vessel", action: "wait", durationSec: 0, notes: "free of residue" },
      { label: "Prep filter", action: "wait", durationSec: 0, notes: "folded along creases, placed in holder, thoroughly rinsed (paper-taste out)" },
      { label: "Coffee in filter, gentle shake to level", action: "wait", durationSec: 0, notes: "75g" },
      { label: "1.25L fresh tap water into reservoir", action: "wait", durationSec: 0 },
      { label: "Lid on filter basket (even brewing temperature)", action: "wait", durationSec: 0 },
      { label: "Brewer ON", action: "drain", durationSec: 0 },
      { label: "When bed fully wetted (+1:00): lid off, gentle stir + bed-turn", action: "agitate-bed", durationSec: 5, notes: "wet all grounds, eliminate air pockets" },
      { label: "Lid back on", action: "wait", durationSec: 0 },
      { label: "Brew completes (5–6 min), serve", action: "wait", durationSec: 295 },
    ],
    totalTimeSec: 330,
    techniques: ["bed-turn", "machine-brew", "big-batch-scaling"],
    bestFor: {
      roastLevels: ["light", "medium-light", "medium"],
      processes: ["any"],
      goals: ["balanced", "sweetness-forward"],
      occasions: ["8-10 cups"],
    },
    teaches:
      "Bed-turn (not just stir) — Lykke's specific Scandi trick. The spoon physically turns the bed over rather than just agitating the surface. Particularly important for big-batch where channeling at depth matters more.",
    science:
      "A standard stir agitates only the slurry surface. A bed-turn brings undisturbed grounds from the bottom up where water can reach them. At 1L+ scale, the bed depth makes turning more effective than surface stirring.",
    whenToUse:
      "Big-batch Moccamaster for 8–10 cups — gatherings, weekend dinners. The bed-turn is what makes 1.25L brews not over-extract at the bottom layer.",
    sources: [
      { type: "article", citation: "Lykke Kaffegårdar brewguide", url: "https://lykkegardar.se/blogs/lykke-brew-guides/brew-guide-moccamaster" },
    ],
    verified: true,
    notes: "Temperature machine-controlled. Niche range estimated from the grind-feel description.",
  },
];
