import type { ScaTopic } from "./types";

/**
 * SCA Brewing Foundations corpus — distilled from the SCA Introduction
 * to Coffee + SCA Coffee Brewing Foundation course transcripts.
 *
 * One topic per concept. Each topic has a concise `body` plus a list
 * of `facts` (concrete numbers / thresholds). Verified topics carry
 * SCA-canonical content; unverified ones carry the instructor's
 * pedagogical framing of SCA material.
 */
const SCA_CANON = "SCA Brewing Control Chart / Gold Cup standard";
const SCA_COURSE =
  "SCA Introduction to Coffee + SCA Coffee Brewing Foundation, taught by AST Adam";

export const SCA_FOUNDATIONS: ScaTopic[] = [
  // ── Extraction fundamentals ─────────────────────────────────────────
  {
    id: "extraction-fundamentals",
    title: "Extraction & strength — the Gold Cup standard",
    body: "The SCA Brewing Control Chart (Gold Cup standard) plots two independent dimensions: extraction yield (the % of dry coffee mass that has been dissolved into the brewed liquid) on the X-axis, and strength / soluble concentration (% TDS — the share of the cup that is dissolved solids vs water) on the Y-axis. Oblique brew-ratio diagonals (55, 60, 65, 70, 75 grams coffee per litre water) cross the chart. The Gold Cup target zone is the intersection where all three line up.",
    facts: [
      { label: "Extraction yield target", value: "18–22%" },
      { label: "Strength / TDS target", value: "1.15%–1.45%" },
      { label: "Golden Ratio band (coffee per litre water)", value: "55–75 g/L (equivalent to 1:13.3 – 1:18)" },
      { label: "Maximum possible extraction", value: "~30% of dry coffee mass (everything above 22% is undesirable bitterness)" },
      { label: "Cup composition", value: "~98–99% water, ~1.2–1.45% dissolved coffee solids" },
    ],
    verified: true,
    source: SCA_CANON,
  },

  {
    id: "extraction-vs-strength",
    title: "Extraction is not strength — two different levers",
    body: "Extraction is how much soluble matter is pulled out of the grounds — controlled by grind, time, temperature, agitation. Strength is how concentrated the cup is — controlled by the brew ratio (how much water you added). The two are independent. A weak brew can be over-extracted (too coarse, too long, watery AND bitter); a strong brew can be under-extracted (too short, fine grind not given time, concentrated AND sour).",
    facts: [
      { label: "Extraction levers", value: "grind size, contact time, water temperature, agitation" },
      { label: "Strength levers", value: "brew ratio (coffee dose per water mass)" },
    ],
    verified: true,
    source: SCA_CANON,
  },

  {
    id: "under-over-extracted-descriptors",
    title: "What under- and over-extracted cups taste like",
    body: "Under-extraction: acidic / sour, weak, low body, light-coloured brew, fast drawdown. Cause is usually too coarse a grind for the brewer, or too-short contact time, or too-low temperature. Over-extraction: bitter, harsh, unbalanced, dark / muddy in colour, long drawdown, harsh aftertaste. Cause is usually too fine a grind for the brewer (also fines passing through metal filters as gritty particles), or too-long contact time, or too-high temperature. A balanced extraction tastes sweet-and-sour-and-bitter in proportion, with body in balance and a long lingering aftertaste.",
    facts: [
      { label: "Under-extracted cues", value: "sour, weak, low body, fast drawdown, light colour" },
      { label: "Over-extracted cues", value: "bitter, harsh, muddy, slow drawdown, dark colour" },
      { label: "Balanced cues", value: "sweetness present, acidity clean not sour, bitterness in proportion, body in balance, long aftertaste" },
    ],
    verified: true,
    source: SCA_CANON,
  },

  // ── Brewing control variables ───────────────────────────────────────
  {
    id: "brewing-control-variables",
    title: "The six SCA brewing essentials",
    body: "SCA framework for brewing: (1) brew formula / ratio, (2) water temperature, (3) water quality, (4) grind size, (5) brewing equipment, (6) the brewing process itself. The grind size is determined FIRST by the brewing device — the device's filter material and bed geometry set the resistance, and grind only changes when the FILTER changes (paper ↔ metal ↔ cloth).",
    facts: [
      { label: "SCA water temperature range", value: "90–96°C (just off the boil)" },
      { label: "Cupping temperature", value: "93–95°C" },
      { label: "Pour-over (filter / drip) brew time target", value: "2–4 minutes, aim for ~3:00 mid-range" },
      { label: "French press (immersion) steep time", value: "4 minutes canonical (4±1 by taste)" },
      { label: "Cupping crust break", value: "4 minutes steep, then break; second 4-minute window for cooling before slurping" },
    ],
    verified: true,
    source: SCA_CANON,
  },

  {
    id: "grind-follows-the-brewer",
    title: "Grind follows the brewer — not the other way around",
    body: "The brewing device sets the grind window. Coarse grinds (immersion / metal filters) match long contact times where fines would cloud the cup and pass through. Medium-coarse grinds (cupping, flat-bottom drippers, conical pour-overs) match the 2–4 minute filter window. Fine grinds (espresso, Moka, Turkish) match high-pressure or very-short contact methods. A recipe that doesn't flow correctly is fixed by GRIND, not by temperature — temperature is for extraction chemistry, grind is for flow.",
    facts: [
      { label: "Coarse grinds — match", value: "French press, all immersion with metal filters" },
      { label: "Medium-coarse grinds — match", value: "cupping, Melitta / Kalita flat-bottom drippers, V60 conical" },
      { label: "Fine grinds — match", value: "espresso, Moka, Turkish / ibrik" },
      { label: "Hard rule", value: "Use grind to fix flow timing; use temperature for extraction chemistry. Never the reverse." },
    ],
    verified: true,
    source: SCA_CANON,
  },

  // ── Water quality ───────────────────────────────────────────────────
  {
    id: "water-quality-foundations",
    title: "Water is the dominant variable",
    body: "Coffee is ~98–99% water by mass. Bad water guarantees bad coffee; good water gives you a chance at a good cup. Filtered water is the professional default. Common off-flavours that disqualify water: chlorine, fluoride, sulphur, old-metal-pipe taste. The qualitative SCA-foundation test for home water: drink it cold, lukewarm, and hot — if it tastes pleasant at all three temperatures and has no off smell, it is likely fine for brewing. Visible kettle scale signals dissolved calcium that will both build up on equipment and influence buffering.",
    facts: [
      { label: "Cup composition", value: "98–99% water by mass" },
      { label: "Filtered water", value: "professional default" },
      { label: "Qualitative water test", value: "taste cold + lukewarm + hot — must be pleasant at all three with no off smell" },
      { label: "Disqualifying off-flavours", value: "chlorine, fluoride, sulphur, old metal pipes" },
      { label: "Hard quantitative SCA Water Handbook targets", value: "NOT in this transcript corpus — must come from the published handbook (calcium hardness, total alkalinity, magnesium, sodium, pH, TDS targets)" },
    ],
    verified: true,
    source: SCA_CANON + " (qualitative); quantitative targets require SCA Water Quality Handbook",
  },

  // ── Brew methods ────────────────────────────────────────────────────
  {
    id: "brew-method-taxonomy",
    title: "Brew method taxonomy by mechanism",
    body: "Filter / drip / gravity: V60, Kalita / Melitta flat-bottoms, Chemex, Vietnamese phin, cold drip. Immersion: French press, cupping bowl, Turkish ibrik, Toddy. Hybrid: AeroPress (immersion + piston press), Moka (pressure + vacuum percolation). Pressure: espresso. Vacuum: siphon. Cold brew: long immersion or slow drip. The mechanism dictates the grind window and the time window.",
    facts: [
      { label: "Filter / drip examples", value: "V60, Kalita, Melitta, Chemex" },
      { label: "Immersion examples", value: "French press, cupping bowl, Turkish, Toddy" },
      { label: "Hybrid examples", value: "AeroPress (immersion + press), Moka (pressure + vacuum)" },
      { label: "Pressure", value: "espresso" },
      { label: "Vacuum", value: "siphon" },
      { label: "Cold extraction", value: "cold brew immersion (~12–24h) or slow drip" },
    ],
    verified: true,
    source: SCA_COURSE,
  },

  {
    id: "filter-vs-immersion-cup-profile",
    title: "Paper filter vs metal mesh — what the filter does to the cup",
    body: "Paper filters retain oils and most fines — cleaner cup, lighter body, more transparent flavour. Metal mesh lets oils through — bigger body, mouthfeel-forward, but less forgiving of fines and over-extraction. The same grind, ratio, and temperature on different filters produces meaningfully different cups; switch filter → re-dial grind.",
    facts: [
      { label: "Paper filter effect", value: "retains oils + most fines; lighter body, cleaner / brighter cup" },
      { label: "Metal mesh effect", value: "lets oils through; bigger body, more mouthfeel, less forgiving of fines" },
      { label: "Rule", value: "Re-dial grind when filter material changes; never assume one grind transfers between filters" },
    ],
    verified: true,
    source: SCA_COURSE,
  },

  // ── Processing ──────────────────────────────────────────────────────
  {
    id: "processing-washed",
    title: "Washed (wet) processing — cup signature",
    body: "Cherries are float-sorted in water (ripe sinks, defects float and are removed), then mucilage is fermented off the seed in tanks for 24–48 hours before drying. The seed is exposed to water; sugars from the cherry do NOT migrate into the bean. Cup signature: clean, bright, high acidity, floral aromas, lighter body, citrus and citrus-like character (lemon-lime, herbal). The processing choice for clarity-seekers.",
    facts: [
      { label: "Mechanism", value: "float-sort, then 24–48h fermentation, then dry" },
      { label: "Cup signature", value: "clean, bright, high acidity, floral, citrus, lighter body" },
      { label: "Best for tasters who want", value: "origin clarity, aromatic florals, transparency" },
    ],
    verified: true,
    source: SCA_COURSE,
  },

  {
    id: "processing-natural",
    title: "Natural (dry) processing — cup signature",
    body: "Cherry is dried whole on raised beds with sun, air, and wind. As the cherry dehydrates, sugars and aromatic compounds migrate from the fruit INTO the seed. The cup is to washed what raisin is to grape: sweeter, syrupier, deeper, with strong dried-fruit / berry / strawberry / cranberry character. Can lean funky / fermented if the drying is not pristine. Big body, sticky mouthfeel.",
    facts: [
      { label: "Mechanism", value: "dry the whole cherry with sun + air + wind; sugars migrate into the seed" },
      { label: "Cup signature", value: "syrupy body, dried fruit (strawberry, raspberry, cranberry, yellow raisin), heavier sweetness, can be funky" },
      { label: "Best for tasters who want", value: "body, sweetness, dried-fruit character" },
    ],
    verified: true,
    source: SCA_COURSE,
  },

  // ── Roasting ────────────────────────────────────────────────────────
  {
    id: "roasting-chemistry-phases",
    title: "Roast chemistry — caramelisation, first crack, pyrolysis",
    body: "Coffee's sugars start to melt and caramelise as the bean reaches about 185°C (~380–390°F). The audible first crack coincides with this — the bean expanding as moisture flashes off and the structure breaks. Light roasts stop near first crack. Pushing past, acids burn off and bitterness rises through pyrolysis (carbonisation of sugars and fibres). Dark roasts push deep into pyrolysis, where origin character is lost and roast character dominates.",
    facts: [
      { label: "Sugar melt / caramelisation onset", value: "~185°C (~380–390°F) — coincides with first crack" },
      { label: "Light roast region", value: "stop near first crack — origin character preserved" },
      { label: "Dark roast region", value: "deep into pyrolysis — acids burned off, bitterness rises, origin character lost" },
    ],
    verified: true,
    source: SCA_COURSE,
  },

  {
    id: "roast-level-cup-profile",
    title: "Roast level — what each one tastes like",
    body: "Light roast: preserves origin character. High acidity, clean sweetness, enzymatic florals and fruits. Salivation on the sides of the tongue is the acidity signal. Medium roast: silver skin gone, beans uniformly brown; acids partly burned, bitterness rising, caramel-and-nut dominance with sweet-and-bitter balance. Dark roast: dry-distillation territory — burnt sugar, maple syrup, malt, clove, smoke. Loses origin character (the roast IS the flavour). Bitterness from carbonised sugars + caffeine. Some coffees roast darker well; many do not.",
    facts: [
      { label: "Light roast cup", value: "high acidity, enzymatic florals & fruits, clean sweetness, origin-driven" },
      { label: "Medium roast cup", value: "acid+bitter balance, caramel and nut, lower acidity than light" },
      { label: "Dark roast cup", value: "burnt sugar / maple / smoke / clove, body-forward, origin lost" },
      { label: "Blind cupping identification", value: "acidity is the major light-vs-dark indicator — look for salivation response" },
    ],
    verified: true,
    source: SCA_COURSE,
  },

  // ── Sensory ─────────────────────────────────────────────────────────
  {
    id: "sensory-five-tastes",
    title: "The five basic tastes in coffee",
    body: "Gustation (the tongue) translates five basic tastes. Sweet — perceived first, front of tongue; a non-negotiable specialty marker. Salt — perceived further back; should NOT be present in arabica (suspect processing defect or compromised water). Sour / acidity — sides of the tongue with salivation; positive when from clean fruit acids (citric, malic), negative when from spoilage acids (butyric, phosphoric). Bitter — most sensitive at the back; acceptable in balance, failure mode if dominant. Umami — rarely perceived in coffee. Flavour beyond these five is olfaction, not gustation.",
    facts: [
      { label: "Sweet", value: "front of tongue, fastest perceived, specialty marker" },
      { label: "Salt", value: "should NOT be present in arabica; if present, suspect processing defect or water" },
      { label: "Sour positive (specialty)", value: "citric, malic, lactic — clean fruit acidity" },
      { label: "Sour negative", value: "butyric, phosphoric — spoilage / over-fermentation" },
      { label: "Bitter", value: "from caffeine + dark-roast carbonisation; OK in balance, failure mode if dominant" },
      { label: "Umami", value: "seldom perceived in coffee" },
    ],
    verified: true,
    source: SCA_COURSE,
  },

  {
    id: "sensory-flavor-wheel",
    title: "The SCA Flavor Wheel — structure",
    body: "The SCA Flavor Wheel divides aromatic descriptors into three families that map to roast level: Enzymatic (yellow — floral, fruity, herbal — light-roast / origin territory), Sugar Browning (red-brown — nutty, caramelised, sweet — medium roast), and Dry Distillation (purple — pungent, medicinal, spice, smoke — dark roast). Use the wheel from the centre outward: general to specific. Start with 'fruity', then narrow to 'berry', then narrow to 'blueberry'. Descriptors are memory triggers from chemical compounds shared between coffee and other foods — not flavourings added to the bean.",
    facts: [
      { label: "Enzymatic family (yellow)", value: "florals, fruits, herbals — preserved in light roasts" },
      { label: "Sugar browning family (red-brown)", value: "nutty, caramelised, sweet — medium-roast territory" },
      { label: "Dry distillation family (purple)", value: "pungent, medicinal, spice, smoke — dark-roast territory" },
      { label: "Wheel use rule", value: "centre outward — general first, then narrow" },
    ],
    verified: true,
    source: SCA_COURSE,
  },

  {
    id: "sensory-evaluation-protocol",
    title: "How to evaluate a cup — SCA protocol cues",
    body: "Slurp / aspirate to spray coffee across the tongue with airflow — activates retronasal olfaction and surfaces nuance. Cool the cup 4 minutes after the crust break — hot coffee triggers a thermal pain response that masks flavour, and cooler brews reveal sweetness and nuance. Compare in pairs (A/B) — pairwise tasting is where descriptor vocabulary gets earned. Evaluate under red light or with red glasses so colour does not bias the nose. Strong, bold, weak are ambiguous descriptors that mix concentration, bitterness, and extraction — avoid them when describing a cup.",
    facts: [
      { label: "Slurp purpose", value: "airflow → retronasal olfaction → more flavour" },
      { label: "Cool the cup", value: "4 minutes after crust break; thermal pain otherwise masks flavour" },
      { label: "Compare in pairs", value: "A/B tasting is how descriptors are learned" },
      { label: "Red light / red glasses", value: "removes visual colour bias for the nose" },
      { label: "Ambiguous words to avoid", value: "strong, bold, weak — they conflate concentration, bitterness, and extraction" },
    ],
    verified: true,
    source: SCA_COURSE,
  },

  // ── General principles ─────────────────────────────────────────────
  {
    id: "general-make-every-bean-shine",
    title: "The mission — make every bean shine",
    body: "The instructor's repeated framing: brewing is about coaxing the best from whatever coffee you have, not about chasing exotic beans. The art of perfect extraction beats expensive sourcing. AST pedagogy, not SCA spec — but a useful coaching framing.",
    facts: [
      { label: "Mission", value: "Nail extraction technique rather than chase exotic sourcing" },
    ],
    verified: false,
    source: SCA_COURSE + " (AST pedagogy)",
  },

  {
    id: "general-bean-storage",
    title: "Bean storage — the seven adversaries",
    body: "Oxygen accelerates oxidation — keep beans whole as long as possible. Grinding exposes the bean's interior to oxygen — grind as close to brew as possible. Heat accelerates oxidation — store cool and steady. Sunlight (UVA penetrates glass and plastic) degrades aromatics — clear display jars are a mistake. Moisture initiates extraction and accelerates all other variables — dry is better. Coffee oils go rancid — clean equipment between sessions. Refrigeration is the urban-legend trap: moving cold to warm condenses moisture into the beans.",
    facts: [
      { label: "Adversaries", value: "oxygen, grinding-too-early, heat, sunlight (UVA), moisture, rancid oils, refrigeration-condensation" },
      { label: "Refrigeration / freezing", value: "urban legend trap — temperature cycling condenses moisture into the beans" },
    ],
    verified: true,
    source: SCA_COURSE,
  },

  {
    id: "general-adjusting-off-target-brews",
    title: "Adjusting a brew that landed off-target on the Brewing Control Chart",
    body: "Strong AND under-extracted (concentrated + sour) → use less coffee and extend time, or pour more water through. Weak AND over-extracted (watery + bitter) → grind coarser, or shorten brew, or use more coffee but less water relative. The goal is always to move toward the centre of the Brewing Control Chart — the Gold Cup zone where extraction yield is 18–22% and TDS is 1.15–1.45%.",
    facts: [
      { label: "Strong + sour fix", value: "less coffee + extend time, OR pour more water through" },
      { label: "Weak + bitter fix", value: "grind coarser, OR shorten brew, OR more coffee for less water" },
      { label: "Goal", value: "move toward the centre of the Brewing Control Chart" },
    ],
    verified: true,
    source: SCA_CANON,
  },

  {
    id: "general-strength-at-the-cup",
    title: "Adjust strength at the cup, not at the recipe",
    body: "When brewing for someone who wants it less strong, brew the same recipe and dilute the served cup with hot water. The brew ratio of the cup-as-poured becomes the new effective ratio — same extraction, different concentration. This is the SCA-aligned framing of the bypass technique, taught here as serving dilution.",
    facts: [
      { label: "Serving dilution", value: "brew the recipe you trust; add hot water to the cup to back off concentration" },
    ],
    verified: true,
    source: SCA_COURSE,
  },

  {
    id: "specialty-cut-off",
    title: "Specialty vs commercial — the 80-point cut-off",
    body: "On the SCA cupping form, the boundary between commercial-grade and specialty-grade coffee is 80 points. Below 80 is commercial; 80 and above is specialty. Specialty positives: sweetness, clean acidity, complexity / layers, body in balance, long lingering aftertaste. Specialty defects: astringency / dryness on the tongue, flatness (no layers), salt in arabica, bitterness without sweetness, short or unpleasant aftertaste.",
    facts: [
      { label: "Specialty-grade cut-off", value: "80 points on the SCA cupping form" },
      { label: "Specialty positives", value: "sweetness, clean acidity, complexity, balanced body, long aftertaste" },
      { label: "Specialty defects", value: "astringency, flatness, salt in arabica, bitter-without-sweet, short / unpleasant aftertaste" },
    ],
    verified: true,
    source: SCA_CANON,
  },
];
