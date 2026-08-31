import type { Recipe } from "./types";

/**
 * OREA V4 WIDE recipe set — the content fix for Orea under-representation.
 *
 * WHY THIS FILE EXISTS. The corpus held exactly ONE Orea recipe
 * (`wbrc-2024-wolfl`, orea-v4-fast), so the selector could never surface the
 * Orea across its four bottoms — measured 0 Orea appearances over 40 brews.
 * These are real, named, sourced OREA recipes (OREA's own guides + named
 * champions/authors) with full pour sequences, one primary bottom each, so the
 * owner's Orea V4 Wide finally has a menu across Apex / Classic / Open / Fast.
 *
 * PROVENANCE. Every entry names its recipe and source (orea.uk/guides-v4 and the
 * named authors — Mordy, Dara, Matteo D'Ottavio, plus the Kasuya-4:6 adaptation).
 * They ship `verified: false` — NOT a blocker: the entries are fully selectable,
 * and `verified: false` deliberately keeps `reconcileToReference` from snapping
 * their numbers onto a "canonical" version (there is no in-session primary-source
 * byte-check, and the fidelity guard must not overwrite these). Sourced from an
 * owner-commissioned research pass (2026-08-31).
 *
 * GRIND. OREA publishes grind ONLY in Comandante C40 clicks / microns — no Niche
 * value exists for the Orea anywhere (confirmed across every source). So the real
 * clicks live in `referenceSetting`, and `nicheZeroDegrees` is DERIVED via the
 * app's own anchored conversion (grindUnit: 380° = 23 clicks, ~3.33°/click) — a
 * documented map, not a fabricated per-recipe number. Calibrate empirically.
 *
 * BOTTOM ROLES (OREA): Apex = clarity/silky, Classic = balance, Open =
 * body/sweetness (central pours), Fast = fast/clean, esp. naturals + fine grinds.
 */
export const OREA_WIDE_RECIPES: Recipe[] = [
  // ── APEX ───────────────────────────────────────────────────────────────────
  {
    id: "orea-wide-so-soft",
    name: "The SO Soft — Orea Wide Apex",
    shortName: "SO Soft",
    attribution: {
      person: "Mordy",
      title: "OREA recipe (native V4 Wide + Apex)",
      country: "UK",
    },
    category: "reference",
    brewer: "orea-apex",
    brewerNotes:
      "V4 WIDE body + APEX (conical) bottom, Sibarist Fast Cone for V4 WIDE (a conical paper folded to the Wide geometry; NEVER a Wave paper on Apex). One of only two natively-Wide OREA recipes.",
    dose: { grams: 16 },
    water: { grams: 250, ratio: "1:15.6" },
    temperature: { celsius: 92, rangeC: [90, 93] },
    grind: {
      referenceGrinder: "Comandante C40",
      referenceSetting: "26–28 clicks (coarse)",
      nicheZeroDegrees: [390, 397],
      description:
        "Coarse: 26–28 Comandante clicks. Niche degrees derived via the app's anchored conversion (no OREA Niche value is published) — calibrate to the 2:20–2:40 finish.",
    },
    pourSequence: [
      { label: "Bloom", action: "pour", waterGramsAtEnd: 50, durationSec: 30, notes: "First 10 g circular, remaining 40 g central." },
      { label: "Pour 2", action: "pour", waterGramsAtEnd: 100, durationSec: 30, notes: "Circular." },
      { label: "Pour 3", action: "pour", waterGramsAtEnd: 200, durationSec: 30, notes: "Circular." },
      { label: "Final pour", action: "pour", waterGramsAtEnd: 250, durationSec: 15, notes: "Central." },
      { label: "Drawdown", action: "drain", durationSec: 45 },
    ],
    totalTimeSec: 150,
    techniques: ["bloom", "central-pour", "pulse-pouring"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed", "honey"],
      goals: ["high-clarity", "aromatic", "balanced"],
    },
    teaches:
      "How the Apex's conical restriction plus centre-weighted pours delivers a very soft, clean, silky cup from light washed coffees.",
    science:
      "The Apex's narrow conical tip lengthens contact time versus the flat bottoms, and centre-weighted pouring keeps water off the wall so bypass stays low. On a coarse grind the fines that would over-extract drop out, and the extra contact recovers yield — the result is high clarity with a rounded, soft body rather than sharp acidity.",
    whenToUse:
      "The owner's best starting point for a silky/balanced character on a bright washed coffee (Ethiopia washed, Kenya AA). Too light/sour → grind a touch finer; clogging → coarser + Melodrip.",
    sources: [
      { type: "blog", citation: "OREA recipe 'The SO Soft' by Mordy — native V4 Wide + Apex, orea.uk guides", url: "https://orea.uk" },
    ],
    verified: false,
    notes:
      "One of only two OREA-official recipes built natively for the V4 WIDE. Alternative filter: Sibarist Flat with a Wide Negotiator + Apex tip for a sweeter profile.",
  },

  // ── CLASSIC ──────────────────────────────────────────────────────────────
  {
    id: "orea-wide-og-base",
    name: "The OG Base #2 — Orea Wide Classic",
    shortName: "OG Base (Classic)",
    attribution: { person: "OREA", title: "V4 base recipe", country: "UK" },
    category: "reference",
    brewer: "orea-classic",
    brewerNotes:
      "V4 WIDE body + CLASSIC bottom (the neutral, most forgiving bottom), OREA Wave paper. Published as a Narrow recipe with the standard 'for Wide, grind a little coarser' note — grind values below already shifted coarser for the Wide.",
    dose: { grams: 18 },
    water: { grams: 300, ratio: "1:16.7" },
    temperature: { celsius: 96, rangeC: [94, 96] },
    grind: {
      referenceGrinder: "Comandante C40",
      referenceSetting: "20–24 clicks (medium, coarsened for Wide)",
      nicheZeroDegrees: [370, 383],
      description:
        "Medium, 20–24 Comandante clicks (already a touch coarser for the Wide). Niche derived via the anchored conversion — calibrate to a 2:30–3:00 finish.",
    },
    pourSequence: [
      { label: "Bloom", action: "pour", waterGramsAtEnd: 60, durationSec: 30, notes: "Circular." },
      { label: "Pour 2", action: "pour", waterGramsAtEnd: 140, durationSec: 40 },
      { label: "Pour 3", action: "pour", waterGramsAtEnd: 220, durationSec: 40 },
      { label: "Final pour", action: "pour", waterGramsAtEnd: 300, durationSec: 20 },
      { label: "Drawdown", action: "drain", durationSec: 35 },
    ],
    totalTimeSec: 165,
    techniques: ["bloom", "pulse-pouring", "spiral-pour"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed", "honey"],
      goals: ["balanced"],
    },
    teaches:
      "The Classic bottom as the general-purpose Orea target — a balance of flow and resistance that forgives pour inconsistency.",
    science:
      "The Classic bottom's mid-range restriction keeps the bed neither stalled nor rushing, so four even circular pours build a uniform extraction without needing precise technique. At 1:16.7 the ratio is lean enough for clarity but full enough to keep body — a dependable equilibrium cup.",
    whenToUse:
      "The everyday, maximum-forgiveness Orea recipe for a washed coffee when you want balance and don't want to fuss. Flexible base to shift toward clarity (finer) or body (coarser + more central).",
    sources: [
      { type: "blog", citation: "OREA base recipe 'The OG Base #2' — V4 Classic, orea.uk guides", url: "https://orea.uk" },
    ],
    verified: false,
  },
  {
    id: "orea-wide-easy-does-it",
    name: "Easy Does It — Orea Wide Classic",
    shortName: "Easy Does It",
    attribution: { person: "OREA", title: "V4 base recipe", country: "UK" },
    category: "reference",
    brewer: "orea-classic",
    brewerNotes:
      "V4 WIDE body + CLASSIC bottom. OREA's best all-round starting recipe for light washed coffees; published on Fast, run here on Classic with a coarser grind for the Wide.",
    dose: { grams: 16 },
    water: { grams: 260, ratio: "1:16.3" },
    temperature: { celsius: 94, rangeC: [92, 95] },
    grind: {
      referenceGrinder: "Comandante C40",
      referenceSetting: "22–26 clicks (medium-coarse, coarsened for Wide)",
      nicheZeroDegrees: [377, 390],
      description:
        "Medium-coarse, 22–26 Comandante clicks. Niche derived via the anchored conversion — aim for a 2:30–3:00 finish.",
    },
    pourSequence: [
      { label: "Bloom", action: "pour", waterGramsAtEnd: 60, durationSec: 40 },
      { label: "Pour 2", action: "pour", waterGramsAtEnd: 110, durationSec: 35 },
      { label: "Pour 3", action: "pour", waterGramsAtEnd: 160, durationSec: 30 },
      { label: "Pour 4", action: "pour", waterGramsAtEnd: 210, durationSec: 30 },
      { label: "Final pour", action: "pour", waterGramsAtEnd: 260, durationSec: 15 },
      { label: "Drawdown", action: "drain", durationSec: 15 },
    ],
    totalTimeSec: 165,
    techniques: ["bloom", "pulse-pouring"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed"],
      goals: ["balanced", "sweetness-forward"],
    },
    teaches:
      "Five small even pulses on a forgiving bottom — the low-variance way to a sweet, balanced cup from a light washed coffee.",
    science:
      "Frequent small pours keep the bed level and the water table shallow, so extraction is even across the puck and no single pour channels. The gentle, repeated replenishment favours the Zone-2 sugars, pulling sweetness forward without pushing into astringency.",
    whenToUse:
      "The go-to when you want a reliable, sweet, balanced result and minimal risk. Best all-round Orea recipe for bright washed coffees.",
    sources: [
      { type: "blog", citation: "OREA base recipe 'Easy Does It' — V4, orea.uk guides", url: "https://orea.uk" },
    ],
    verified: false,
  },

  // ── OPEN ─────────────────────────────────────────────────────────────────
  {
    id: "orea-wide-the-dara",
    name: "The Dara — Orea Wide Open",
    shortName: "The Dara",
    attribution: { person: "Dara", title: "OREA recipe", affiliation: "Madrid", country: "Spain" },
    category: "reference",
    brewer: "orea-open",
    brewerNotes:
      "V4 WIDE body + OPEN bottom (fast, open bed — drive extraction with central pours). Published on Narrow; grind coarsened for the Wide.",
    dose: { grams: 12 },
    water: { grams: 200, ratio: "1:16.7" },
    temperature: { celsius: 92, rangeC: [90, 93] },
    grind: {
      referenceGrinder: "Comandante C40",
      referenceSetting: "20–24 clicks (medium, coarsened for Wide)",
      nicheZeroDegrees: [370, 383],
      description:
        "Medium, 20–24 Comandante clicks. Niche derived via the anchored conversion — 2:30–3:00 finish.",
    },
    pourSequence: [
      { label: "Bloom", action: "pour", waterGramsAtEnd: 40, durationSec: 40 },
      { label: "Pour 2", action: "pour", waterGramsAtEnd: 90, durationSec: 40 },
      { label: "Pour 3", action: "pour", waterGramsAtEnd: 150, durationSec: 40, notes: "Increasingly central." },
      { label: "Final pour", action: "pour", waterGramsAtEnd: 200, durationSec: 15, notes: "Central." },
      { label: "Drawdown", action: "drain", durationSec: 30 },
    ],
    totalTimeSec: 165,
    techniques: ["bloom", "pulse-pouring", "central-pour"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed", "honey"],
      goals: ["balanced", "sweetness-forward", "body-forward"],
    },
    teaches:
      "How the Open bottom plus central pouring drives water down the middle of the bed to build body and sweetness while staying silky.",
    science:
      "The Open bottom drains fast, so on its own it under-extracts; pouring centrally rebuilds a taller water column through the middle of the bed, lengthening the path water takes and lifting extraction. The result is more body and sweetness than a wall-hugging pour, with the smooth, rounded texture the owner favours.",
    whenToUse:
      "A silky, balanced everyday cup with a touch more body — a strong match for the owner's taste on a light washed coffee.",
    sources: [
      { type: "blog", citation: "OREA recipe 'The Dara' by Dara (Madrid) — V4 Open, orea.uk guides", url: "https://orea.uk" },
    ],
    verified: false,
  },
  {
    id: "orea-wide-dara-for-two",
    name: "Dara for Two — Orea Wide Open",
    shortName: "Dara for Two",
    attribution: { person: "Dara", title: "OREA recipe (two-cup scale)", affiliation: "Madrid", country: "Spain" },
    category: "reference",
    brewer: "orea-open",
    brewerNotes:
      "V4 WIDE body + OPEN bottom, scaled to two cups (400 ml — within the Wide's ~600 ml ceiling). Published on Narrow; grind coarsened for the Wide.",
    dose: { grams: 24 },
    water: { grams: 400, ratio: "1:16.7" },
    temperature: { celsius: 92, rangeC: [90, 93] },
    grind: {
      referenceGrinder: "Comandante C40",
      referenceSetting: "22–26 clicks (medium-coarse, coarsened for Wide + batch)",
      nicheZeroDegrees: [377, 390],
      description:
        "Medium-coarse, 22–26 Comandante clicks — a deeper two-cup bed wants a touch coarser. Niche derived via the anchored conversion — 2:50–3:30 finish.",
    },
    pourSequence: [
      { label: "Bloom", action: "pour", waterGramsAtEnd: 80, durationSec: 40 },
      { label: "Pour 2", action: "pour", waterGramsAtEnd: 180, durationSec: 50 },
      { label: "Pour 3", action: "pour", waterGramsAtEnd: 300, durationSec: 50, notes: "Increasingly central." },
      { label: "Final pour", action: "pour", waterGramsAtEnd: 400, durationSec: 20, notes: "Central." },
      { label: "Drawdown", action: "drain", durationSec: 30 },
    ],
    totalTimeSec: 190,
    techniques: ["bloom", "pulse-pouring", "central-pour"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed", "honey"],
      goals: ["balanced", "body-forward"],
    },
    teaches:
      "Scaling the Dara's central-pour Open method to a two-cup 400 ml batch on the Wide body without stalling the deeper bed.",
    science:
      "A doubled dose builds a deeper bed with more flow resistance, so the grind coarsens to keep the drawdown on schedule; the Open bottom's fast drain offsets the deeper bed, and central pours keep extraction even top-to-bottom. The Wide body's extra volume is what makes 400 ml comfortable here.",
    whenToUse:
      "When you want two silky cups of a washed coffee from one brew — the Dara profile at batch scale.",
    sources: [
      { type: "blog", citation: "OREA recipe 'Dara for Two' — V4 Open, orea.uk guides", url: "https://orea.uk" },
    ],
    verified: false,
  },
  {
    id: "orea-wide-the-bypass",
    name: "The Bypass — Orea Wide Open",
    shortName: "The Bypass",
    attribution: { person: "Matteo D'Ottavio", title: "UK Brewing Champion — OREA recipe", country: "UK" },
    category: "reference",
    brewer: "orea-open",
    brewerNotes:
      "V4 WIDE body + OPEN bottom, OREA Wave paper. A concentrate-and-bypass method: brew a tight 260 ml, then add 15–30 g of water to the carafe after drawdown to dial the final strength. Published on Narrow; grind coarsened for the Wide.",
    dose: { grams: 18 },
    water: { grams: 260, ratio: "1:14.4 + 15–30 g bypass" },
    temperature: { celsius: 96, rangeC: [94, 96] },
    grind: {
      referenceGrinder: "Comandante C40",
      referenceSetting: "20–24 clicks (medium-coarse, coarsened for Wide)",
      nicheZeroDegrees: [370, 383],
      description:
        "Medium-coarse, 20–24 Comandante clicks. Niche derived via the anchored conversion. The brewer only ever sees 260 g; the bypass goes to the carafe.",
    },
    pourSequence: [
      { label: "Bloom", action: "pour", waterGramsAtEnd: 60, durationSec: 40, notes: "Circular into central." },
      { label: "Pour 2", action: "pour", waterGramsAtEnd: 160, durationSec: 50, notes: "Circular into central, ~4 g/s." },
      { label: "Final pour", action: "pour", waterGramsAtEnd: 260, durationSec: 25, notes: "Circular into central, ~4 g/s." },
      { label: "Drawdown", action: "drain", durationSec: 40 },
      { label: "Bypass", action: "bypass", durationSec: 10, notes: "After the cup has drawn down, add 15–30 g water to the carafe. Less = more intense, more = cleaner/smoother." },
    ],
    totalTimeSec: 165,
    techniques: ["bloom", "pulse-pouring", "concentrate-and-bypass"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed"],
      goals: ["high-clarity", "balanced"],
    },
    teaches:
      "Concentrate-and-bypass on the Orea: brew tight, then tune the final concentration with post-brew water instead of chasing it during the pour.",
    science:
      "Brewing at a lean 1:14.4 extracts a concentrated, high-clarity liquor; adding 15–30 g of clean water afterwards drops the strength without changing what was extracted. Because the dilution happens in the carafe, the extraction itself stays fixed and repeatable — the bypass is a pure concentration dial, not an extraction one.",
    whenToUse:
      "When you want repeatable clarity and the ability to fine-tune strength cup-to-cup: less bypass for intensity, more for a cleaner, smoother cup.",
    sources: [
      { type: "blog", citation: "OREA recipe 'The Bypass' by Matteo D'Ottavio (UK Brewing Champion) — V4 Open, orea.uk guides", url: "https://orea.uk" },
    ],
    verified: false,
  },
  {
    id: "orea-wide-the-techno",
    name: "The Techno — Orea Wide Open",
    shortName: "The Techno",
    attribution: { person: "Mordy", title: "OREA recipe", country: "UK" },
    category: "reference",
    brewer: "orea-open",
    brewerNotes:
      "V4 WIDE body + OPEN bottom, OREA Flat + Negotiator. A progressive, increasingly-central pour build. Published on Narrow; grind coarsened for the Wide.",
    dose: { grams: 12.4 },
    water: { grams: 200, ratio: "1:16.1" },
    temperature: { celsius: 94, rangeC: [92, 95] },
    grind: {
      referenceGrinder: "Comandante C40",
      referenceSetting: "23–26 clicks (medium-coarse, coarsened for Wide)",
      nicheZeroDegrees: [380, 390],
      description:
        "Medium-coarse, 23–26 Comandante clicks. Niche derived via the anchored conversion — 2:30–3:00 finish.",
    },
    pourSequence: [
      { label: "Bloom", action: "pour", waterGramsAtEnd: 40, durationSec: 30 },
      { label: "Pour 2", action: "pour", waterGramsAtEnd: 120, durationSec: 50, notes: "Progressive, moving toward centre." },
      { label: "Pour 3", action: "pour", waterGramsAtEnd: 160, durationSec: 25, notes: "More central." },
      { label: "Final pour", action: "pour", waterGramsAtEnd: 200, durationSec: 15, notes: "Central." },
      { label: "Drawdown", action: "drain", durationSec: 45 },
    ],
    totalTimeSec: 165,
    techniques: ["bloom", "pulse-pouring", "central-pour"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed", "honey", "natural"],
      goals: ["body-forward", "sweetness-forward"],
    },
    teaches:
      "A progressively-centralising pour on the Open bottom to build sweetness and body while keeping the cup clean.",
    science:
      "Starting wide and moving central over the brew wets the whole bed early for even saturation, then concentrates flow through the middle to deepen the extraction column late — a build that recovers body on the fast-draining Open bottom without dragging the whole brew slow.",
    whenToUse:
      "For a fuller, sweeter cup on the Open bottom when a plain even pour reads a touch thin. Works on washed and lighter naturals.",
    sources: [
      { type: "blog", citation: "OREA recipe 'The Techno' by Mordy — V4 Open, orea.uk guides", url: "https://orea.uk" },
    ],
    verified: false,
  },

  // ── FAST ─────────────────────────────────────────────────────────────────
  {
    id: "orea-wide-four-six",
    name: "The Four Six — Orea Wide Fast",
    shortName: "The Four Six (Orea)",
    attribution: { person: "OREA", title: "Kasuya 4:6 adaptation (native V4 Wide + Fast)", country: "UK" },
    category: "reference",
    brewer: "orea-v4-fast",
    brewerNotes:
      "V4 WIDE body + FAST bottom, OREA Flat paper + Negotiator (on Wave/Sibarist grind a touch finer). OREA's native-Wide adaptation of Tetsu Kasuya's 4:6 method. One of only two natively-Wide OREA recipes.",
    dose: { grams: 20 },
    water: { grams: 300, ratio: "1:15" },
    temperature: { celsius: 92, rangeC: [90, 93] },
    grind: {
      referenceGrinder: "Comandante C40",
      referenceSetting: "25–28 clicks (coarse)",
      nicheZeroDegrees: [387, 397],
      description:
        "Coarse, 25–28 Comandante clicks. Niche derived via the anchored conversion — 2:30–3:20 finish. On Wave/Sibarist paper grind a touch finer.",
    },
    pourSequence: [
      { label: "Bloom", action: "pour", waterGramsAtEnd: 70, durationSec: 40, notes: "Circular." },
      { label: "Pour 2", action: "pour", waterGramsAtEnd: 120, durationSec: 40, notes: "Circular. (First 40% sets sweetness/acidity.)" },
      { label: "Pour 3", action: "pour", waterGramsAtEnd: 210, durationSec: 40, notes: "Circular. (Last 60% sets strength.)" },
      { label: "Final pour", action: "pour", waterGramsAtEnd: 300, durationSec: 20, notes: "Circular." },
      { label: "Drawdown", action: "drain", durationSec: 35 },
    ],
    totalTimeSec: 175,
    techniques: ["phase-separated-pouring", "bloom", "pulse-pouring"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed", "natural"],
      goals: ["balanced", "sweetness-forward", "high-clarity"],
    },
    teaches:
      "Kasuya's 4:6 dialled onto the Orea Fast bottom — the first 40 % of water controls the acid/sweet axis, the last 60 % controls strength, independently of grind or temperature.",
    science:
      "Splitting the pour into a 40 % phase and a 60 % phase decouples two variables: the early water sets how much acidity vs. sweetness the cup leans (bloom-heavy = sweeter), while the later water sets concentration. The Fast bottom's quick drain keeps each phase from stalling, so the two controls stay clean and repeatable.",
    whenToUse:
      "When you want to steer sweetness vs. strength deliberately on the Orea. Sweeter → swap the first two pour amounts; stronger → split the last three into 60/60/60 g.",
    sources: [
      { type: "blog", citation: "OREA recipe 'The Four Six' — native V4 Wide + Fast, Kasuya 4:6 adaptation, orea.uk guides", url: "https://orea.uk" },
      { type: "interview", citation: "Tetsu Kasuya 4:6 method (World Brewers Cup 2016, Dublin) — the method this adapts", year: 2016 },
    ],
    verified: false,
    notes:
      "The parent 4:6 method (Kasuya, WBrC 2016) is in the corpus for the V60 as `kasuya-4-6-standard`; this is OREA's Orea-Fast adaptation, not the V60 recipe.",
  },
  {
    id: "orea-wide-the-fine",
    name: "The Fine — Orea Wide Fast",
    shortName: "The Fine",
    attribution: { person: "OREA", title: "V4 recipe", country: "UK" },
    category: "reference",
    brewer: "orea-v4-fast",
    brewerNotes:
      "V4 WIDE body + FAST bottom, OREA Wave paper. A fine-grind, near-continuous single pour — the Fast bottom is the 'unclogging' design that tolerates a fine grind. Published on Narrow; grind coarsened for the Wide.",
    dose: { grams: 16 },
    water: { grams: 260, ratio: "1:16.3" },
    temperature: { celsius: 90, rangeC: [88, 91] },
    grind: {
      referenceGrinder: "Comandante C40",
      referenceSetting: "17–20 clicks (fine)",
      nicheZeroDegrees: [360, 370],
      description:
        "Fine, 17–20 Comandante clicks — the finest Orea recipe here; the Fast bottom keeps it from clogging. Niche derived via the anchored conversion — 2:30–3:00 finish.",
    },
    pourSequence: [
      { label: "Bloom", action: "pour", waterGramsAtEnd: 60, durationSec: 40 },
      { label: "Slow continuous pour", action: "pour", waterGramsAtEnd: 260, durationSec: 50, notes: "One slow, steady ~4 g/s stream to 260 g." },
      { label: "Drawdown", action: "drain", durationSec: 75 },
    ],
    totalTimeSec: 165,
    techniques: ["bloom", "continuous-pour"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["washed"],
      goals: ["sweetness-forward", "high-clarity"],
    },
    teaches:
      "How a fine grind on the fast-draining Fast bottom lifts extraction into a juicy, sweet cup on light washed coffees without clogging.",
    science:
      "A fine grind exposes more surface area and would stall a slower bottom, but the Fast bottom's open drain keeps flow moving, so the higher extraction lands as sweetness and juiciness rather than a choked, muddy brew. A single slow continuous pour keeps agitation low so the fine bed doesn't compact.",
    whenToUse:
      "For a juicy, sweet cup from a bright washed coffee. Not ideal for naturals — a fine grind flattens their character.",
    sources: [
      { type: "blog", citation: "OREA recipe 'The Fine' — V4 Fast, orea.uk guides", url: "https://orea.uk" },
    ],
    verified: false,
  },
  {
    id: "orea-wide-the-aussie",
    name: "The Aussie — Orea Wide Fast",
    shortName: "The Aussie",
    attribution: { person: "OREA", title: "V4 recipe (Australian Brewers Cup style)", country: "UK" },
    category: "reference",
    brewer: "orea-v4-fast",
    brewerNotes:
      "V4 WIDE body + FAST bottom. A coarse, hot, pulsed pour inspired by Australian Brewers Cup competitors — pour the next dose only when the bed surface looks dry. Published on Narrow; grind coarsened for the Wide.",
    dose: { grams: 18 },
    water: { grams: 250, ratio: "1:13.9" },
    temperature: { celsius: 97, rangeC: [96, 98] },
    grind: {
      referenceGrinder: "Comandante C40",
      referenceSetting: "26–30 clicks (coarse)",
      nicheZeroDegrees: [390, 403],
      description:
        "Coarse, 26–30 Comandante clicks. Niche derived via the anchored conversion — 2:30–3:00 finish. Pour each pulse only when the bed looks dry.",
    },
    pourSequence: [
      { label: "Bloom", action: "pour", waterGramsAtEnd: 50, durationSec: 30 },
      { label: "Pour 2", action: "pour", waterGramsAtEnd: 100, durationSec: 30, notes: "Pour when the bed looks dry." },
      { label: "Pour 3", action: "pour", waterGramsAtEnd: 150, durationSec: 30, notes: "Pour when the bed looks dry." },
      { label: "Pour 4", action: "pour", waterGramsAtEnd: 200, durationSec: 30, notes: "Pour when the bed looks dry." },
      { label: "Final pour", action: "pour", waterGramsAtEnd: 250, durationSec: 15 },
      { label: "Drawdown", action: "drain", durationSec: 30 },
    ],
    totalTimeSec: 165,
    techniques: ["bloom", "pulse-pouring"],
    bestFor: {
      roastLevels: ["light", "medium-light"],
      processes: ["natural", "anaerobic", "experimental"],
      goals: ["body-forward", "explore"],
    },
    teaches:
      "A coarse, hot, dry-surface pulse method that tames boozy fermented coffees into a clean, tea-like cup with body.",
    science:
      "Waiting for the bed to look dry between pulses means each pour re-saturates a settled bed, extending contact without extended submersion; the coarse grind and hot water push yield up but the pulse rhythm keeps fermentation esters from over-extracting into a boozy, muddy cup. The result is a tea-like body that reins in the loudest naturals.",
    whenToUse:
      "For a fermented or natural coffee whose boozy notes you want to tame into a cleaner, tea-like cup with structure.",
    sources: [
      { type: "blog", citation: "OREA recipe 'The Aussie' — V4 Fast, orea.uk guides", url: "https://orea.uk" },
    ],
    verified: false,
  },
];
