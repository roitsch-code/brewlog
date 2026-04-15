export interface RoasterPrior {
  name: string;
  region?: string;
  styleSummary: string;
  roastTendency: "very-light" | "light" | "light-medium" | "medium" | "varied";
  solubilityBias: "high" | "moderate" | "low" | "varied";
  clarityVsSweetnessBias: "clarity" | "sweetness" | "balanced" | "varied";
  agitationTolerance: "sensitive" | "moderate" | "robust";
  // high = 96–99°C, standard = 93–96°C, low = 88–93°C
  tempBias: "high" | "standard" | "low";
  // lean = 1:16+, standard = 1:15, rich = 1:14–
  ratioBias: "lean" | "standard" | "rich";
  methodAffinities: string[];
  extractionRisks: string[];
  notes: string;
  confidence: "curated" | "inferred" | "fallback" | "user";
  disclaimer: string;
}

const DISCLAIMER =
  "This is a probabilistic style prior based on the roaster's known body of work. It is not a rule. User brew history always overrides it when present. Individual coffees vary — roast level, process, and lot character matter more than roaster identity alone.";

const FALLBACK_DISCLAIMER =
  "No curated profile exists for this roaster. These are safe, conservative defaults. Treat with low confidence and defer to coffee properties and user history.";

export const ROASTER_PRIORS: RoasterPrior[] = [
  // ── Nordic / clarity-first cluster ──────────────────────────────────────

  {
    name: "Tim Wendelboe",
    region: "Oslo, Norway",
    styleSummary:
      "Pioneer of Nordic light roasting. Very light, terroir-driven, almost exclusively washed. Coffees are roasted for maximum clarity and sweetness, often with high density and strong solubility.",
    roastTendency: "very-light",
    solubilityBias: "high",
    clarityVsSweetnessBias: "clarity",
    agitationTolerance: "moderate",
    tempBias: "high",
    ratioBias: "lean",
    methodAffinities: ["V60", "Orea Apex", "Kalita Wave"],
    extractionRisks: [
      "Under-extraction if temperature drops or technique is passive",
      "Sour finish on older stock if ratio is too lean",
    ],
    notes:
      "Efficient percolation is the right lens here. These coffees reward clean water (diluted preferred), high bloom temp, and controlled agitation. Washed Ethiopians and Kenyans are the typical anchors. Naturals appear occasionally but are roasted with restraint.",
    confidence: "curated",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Supreme Roastworks",
    region: "Oslo, Norway",
    styleSummary:
      "Competition-influenced Nordic roaster. Very light, precision-focused, high-clarity aesthetic. Often features unusual origins and varieties roasted with surgical precision.",
    roastTendency: "very-light",
    solubilityBias: "high",
    clarityVsSweetnessBias: "clarity",
    agitationTolerance: "sensitive",
    tempBias: "high",
    ratioBias: "lean",
    methodAffinities: ["Orea Apex", "V60 no Assist", "Wölfl"],
    extractionRisks: [
      "Sour and thin if underextracted — these coffees need efficient technique",
      "Loses complexity if over-agitated",
    ],
    notes:
      "Low agitation tolerance is the key signal here. Orea Apex or V60 without the Drip Assist is ideal — the Drip Assist adds turbulence that can muddy the clarity profile. Championship water (55–75 ppm) is worth considering for competition lots.",
    confidence: "curated",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Fuglen Coffee Roasters",
    region: "Oslo, Norway",
    styleSummary:
      "Tokyo-Oslo crossover brand. Light, often washed Ethiopian- and Kenyan-focused, clarity-forward with some sweetness expression. Approachable but precise.",
    roastTendency: "light",
    solubilityBias: "high",
    clarityVsSweetnessBias: "clarity",
    agitationTolerance: "moderate",
    tempBias: "high",
    ratioBias: "lean",
    methodAffinities: ["V60", "Orea Apex", "Orea Classic"],
    extractionRisks: [
      "Under-extraction at standard temps — these need 97–99°C",
      "Flat cup if water mineral content is too high",
    ],
    notes:
      "Similar to Tim Wendelboe in philosophy. Diluted water preferred. Washed Ethiopian lots tend to be the benchmark coffees. Orea Apex rewards the clarity bias; Orea Classic works for naturals if they appear.",
    confidence: "curated",
    disclaimer: DISCLAIMER,
  },

  {
    name: "April Coffee Roasters",
    region: "Copenhagen, Denmark",
    styleSummary:
      "Extremely light, precision-roasted for maximum clarity and transparency. Competition-adjacent profile, often minimal tasting notes from the bag — the coffee speaks in the cup. Washed-dominant.",
    roastTendency: "very-light",
    solubilityBias: "high",
    clarityVsSweetnessBias: "clarity",
    agitationTolerance: "sensitive",
    tempBias: "high",
    ratioBias: "lean",
    methodAffinities: ["V60 no Assist", "Orea Apex", "Wölfl"],
    extractionRisks: [
      "Sour and underwhelming if technique is passive or temp drops",
      "Body becomes too thin with very lean ratios",
      "Agitation-sensitive — swirl rather than stir on bloom",
    ],
    notes:
      "April sits at the very edge of light roasting. These coffees demand active technique. Championship water (55–75 ppm) can be transformative. The Wölfl method or Orea Apex without the Drip Assist is the natural home. Avoid Clever or long immersion — extraction clarity is the whole point.",
    confidence: "curated",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Coffee Collective",
    region: "Copenhagen, Denmark",
    styleSummary:
      "Terroir-expressive, clarity and sweetness both valued. Light to light-medium depending on origin. One of the founding voices of Nordic specialty. Consistent quality across washed and natural lots.",
    roastTendency: "light",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "balanced",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Kalita Wave", "Orea Classic"],
    extractionRisks: [
      "Naturals can become jammy with excessive immersion",
      "Washed lots flat if under-extracted",
    ],
    notes:
      "A well-calibrated all-rounder. Standard approach works well — no extreme adjustments needed unless the specific lot is very fresh or very light. Kalita Wave suits the sweetness bias in their naturals.",
    confidence: "curated",
    disclaimer: DISCLAIMER,
  },

  {
    name: "La Cabra",
    region: "Aarhus, Denmark",
    styleSummary:
      "Very light, clarity-first, Scandinavian competition-adjacent. Often features high-altitude washed coffees with floral, citrus, and tea-like character. Low agitation philosophy.",
    roastTendency: "very-light",
    solubilityBias: "high",
    clarityVsSweetnessBias: "clarity",
    agitationTolerance: "sensitive",
    tempBias: "high",
    ratioBias: "lean",
    methodAffinities: ["Orea Apex", "V60 no Assist", "Kasuya 4:6"],
    extractionRisks: [
      "Under-extraction at 93–95°C — 97–99°C needed",
      "Fines migration risk with aggressive stir — use light swirl on bloom",
      "Too thin at 1:17+ ratios",
    ],
    notes:
      "Clarity is the product. Orea Apex or V60 without Drip Assist. Minimal agitation. Diluted or championship water to protect delicate floral notes from mineral interference. Kasuya 4:6 can work well if the user wants to tune acid/sweetness balance across phases.",
    confidence: "curated",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Prolog",
    region: "Copenhagen, Denmark",
    styleSummary:
      "Light, clarity-dominant, minimalist aesthetic. Often seasonal, single-origin focused. Transparent cup over sweetness-forward.",
    roastTendency: "light",
    solubilityBias: "high",
    clarityVsSweetnessBias: "clarity",
    agitationTolerance: "sensitive",
    tempBias: "high",
    ratioBias: "lean",
    methodAffinities: ["V60", "Orea Apex"],
    extractionRisks: [
      "Under-extraction with lower temps",
      "Loses top notes with over-agitation",
    ],
    notes:
      "Similar DNA to April and La Cabra. High temp, lean ratio, minimal agitation. Diluted water preferred.",
    confidence: "curated",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Koppi",
    region: "Helsingborg, Sweden",
    styleSummary:
      "Light, naturals and washed, sweetness and clarity balanced. One of the earliest Nordic specialty voices. Fruit-forward with restraint — not extreme, always clean.",
    roastTendency: "light",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "balanced",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Orea Classic", "Clever Dripper"],
    extractionRisks: [
      "Naturals become muddy with excessive agitation",
      "Honey lots can taste jammy in full immersion",
    ],
    notes:
      "Naturals from Koppi can tolerate Orea Classic or Clever Dripper with a light touch. Washed lots suit V60. Swirl-only on bloom for naturals — never stir.",
    confidence: "curated",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Drop Coffee",
    region: "Stockholm, Sweden",
    styleSummary:
      "Light, transparency-focused, washed-leaning. Clean and precise. Award-winning program with a clear high-clarity philosophy.",
    roastTendency: "light",
    solubilityBias: "high",
    clarityVsSweetnessBias: "clarity",
    agitationTolerance: "moderate",
    tempBias: "high",
    ratioBias: "lean",
    methodAffinities: ["V60", "Orea Apex"],
    extractionRisks: [
      "Sour on older stock with lean ratios",
      "Flat without high bloom temp",
    ],
    notes:
      "Washed Ethiopian and Kenyan are typical. High temp, lean ratio. Diluted water preferred. V60 or Orea Apex.",
    confidence: "curated",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Morgon Coffee Roasters",
    region: "Gothenburg, Sweden",
    styleSummary:
      "Light to light-medium, terroir-expressive with a range of origins. Both washed and natural lots, roasted with intention and restraint. Sweetness and clarity both present.",
    roastTendency: "light",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "balanced",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Orea Classic", "Orea Apex"],
    extractionRisks: [
      "Naturals can be over-extracted in long immersion",
    ],
    notes:
      "Good all-round approach. Choose Orea Apex for washed clarity focus, Orea Classic for natural sweetness. Standard ratio and temp works as baseline.",
    confidence: "curated",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Frukt Coffee Roasters",
    region: "Gothenburg, Sweden",
    styleSummary:
      "Light, fruit-forward by design, naturals and washed. Flavour identity built on clean, expressive fruit character — not fermentation noise.",
    roastTendency: "light",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "sweetness",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Orea Classic"],
    extractionRisks: [
      "Fermentation notes amplified if over-extracted or over-agitated on naturals",
      "Sweetness muted at very high ratios",
    ],
    notes:
      "Naturals are likely sweeter and more body-forward. Orea Classic or V60 with 5-pour pour sequence on naturals. Stir only on washed lots; swirl on naturals.",
    confidence: "inferred",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Fjord Coffee",
    region: "Bergen, Norway",
    styleSummary:
      "Light, Scandinavian aesthetic, terroir-focused. Clean cup, clarity-leaning.",
    roastTendency: "light",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "clarity",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Orea"],
    extractionRisks: ["Under-extraction at lower temps"],
    notes:
      "Nordic clarity aesthetic. Standard V60 approach works well. High temp for washed.",
    confidence: "inferred",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Nordbeans",
    region: "Norway",
    styleSummary:
      "Light to light-medium, clean cup focus. Quality Nordic specialty.",
    roastTendency: "light",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "clarity",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Clever Dripper"],
    extractionRisks: ["Flat if under-extracted"],
    notes: "Standard Nordic light roast approach.",
    confidence: "inferred",
    disclaimer: DISCLAIMER,
  },

  // ── UK / Ireland cluster ─────────────────────────────────────────────────

  {
    name: "Square Mile Coffee Roasters",
    region: "London, UK",
    styleSummary:
      "Light to light-medium, balanced and terroir-expressive. Founded by World Barista Champions. Sweetness-forward bias with strong clarity. Naturals and washed both excellent.",
    roastTendency: "light",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "sweetness",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Clever Dripper", "AeroPress"],
    extractionRisks: [
      "Washed lots flat at lower temps",
      "Naturals can be over-extracted in Clever with long steep",
    ],
    notes:
      "A benchmark roaster. Sweetness is the consistent signal. Clever Dripper works well with their naturals — Hoffmann method, moderate temp. V60 for their washed lots.",
    confidence: "curated",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Workshop Coffee",
    region: "London, UK",
    styleSummary:
      "Light-medium, sweetness and clarity both valued. Consistent, well-calibrated program. London specialty institution.",
    roastTendency: "light-medium",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "balanced",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Clever Dripper"],
    extractionRisks: ["Bitter if pushed too hot on medium-light lots"],
    notes:
      "Reliable, accessible approach. Standard V60 or Clever Dripper. No extreme adjustments needed.",
    confidence: "curated",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Origin Coffee Roasters",
    region: "Cornwall, UK",
    styleSummary:
      "Light-medium, terroir focus, often fruit-forward. Wide origin range. Clean and expressive.",
    roastTendency: "light-medium",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "balanced",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Clever Dripper"],
    extractionRisks: ["Naturals benefit from gentler agitation"],
    notes: "Standard approach works well. Good all-rounder.",
    confidence: "curated",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Ozone Coffee",
    region: "London / New Zealand",
    styleSummary:
      "Light-medium, balanced, sweetness-leaning. Accessible specialty with a clean cup.",
    roastTendency: "light-medium",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "sweetness",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Clever Dripper"],
    extractionRisks: ["Straightforward — few notable risks"],
    notes: "Accessible, sweet-leaning profile. Standard approach.",
    confidence: "inferred",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Hasbean",
    region: "Stafford, UK",
    styleSummary:
      "Wide range from light to medium, varied origins and processes. Educational brand, extensive catalog. Not a single aesthetic — varies significantly by lot.",
    roastTendency: "varied",
    solubilityBias: "varied",
    clarityVsSweetnessBias: "varied",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "AeroPress", "Clever Dripper"],
    extractionRisks: [
      "Roast level and process vary widely — check bag notes carefully",
    ],
    notes:
      "Read this coffee individually — do not rely on roaster prior heavily. Process and roast level from bag are the key signals.",
    confidence: "inferred",
    disclaimer: DISCLAIMER,
  },

  {
    name: "3FE Coffee",
    region: "Dublin, Ireland",
    styleSummary:
      "Light-medium, balance and sweetness focus. One of Europe's best roasters. Naturals and washed both excellent. Approachable elegance.",
    roastTendency: "light-medium",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "sweetness",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Clever Dripper"],
    extractionRisks: ["Bitter if over-extracted with dark-end lots"],
    notes:
      "Sweetness is the house style. Clever Dripper works well with naturals; V60 for washed. Standard temp.",
    confidence: "curated",
    disclaimer: DISCLAIMER,
  },

  // ── Amsterdam / Benelux cluster ──────────────────────────────────────────

  {
    name: "Friedhats",
    region: "Amsterdam, Netherlands",
    styleSummary:
      "One of Amsterdam's most acclaimed specialty roasters. Competition-pedigree sourcing — high-altitude micro-lots, unusual varieties, direct relationships. Roasted very light for maximum clarity and origin expression. Cups are bright, precise, and reward careful brewing.",
    roastTendency: "light",
    solubilityBias: "high",
    clarityVsSweetnessBias: "clarity",
    agitationTolerance: "sensitive",
    tempBias: "high",
    ratioBias: "lean",
    methodAffinities: ["Orea V4", "V60", "V60 + Drip Assist"],
    extractionRisks: [
      "Sour and thin if under-extracted — roasts are light so full extraction is essential",
      "Loses nuance and clarity with heavy agitation or turbulence",
    ],
    notes:
      "High temp (96–98°C), lean ratio (1:16–1:17), minimal agitation. Long bloom (45s+). Championship water worth trying on premium lots. Give it time — these coffees open up as they cool.",
    confidence: "curated",
    disclaimer: DISCLAIMER,
  },

  {
    name: "White Label Coffee",
    region: "Amsterdam, Netherlands",
    styleSummary:
      "Light to light-medium, clean cup, terroir-expressive. Clarity-leaning with some sweetness in naturals. Consistent quality.",
    roastTendency: "light",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "clarity",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Orea"],
    extractionRisks: ["Under-extraction at lower temps on lighter lots"],
    notes: "Standard light roast approach. V60 or Orea depending on cup goal.",
    confidence: "curated",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Uncommon Amsterdam",
    region: "Amsterdam, Netherlands",
    styleSummary:
      "Light, clarity and sweetness both valued, often washed. Boutique Amsterdam specialty.",
    roastTendency: "light",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "balanced",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Orea Apex"],
    extractionRisks: ["Standard light roast risks"],
    notes: "Standard approach. Orea Apex for clarity focus.",
    confidence: "inferred",
    disclaimer: DISCLAIMER,
  },

  {
    name: "OR Coffee Roasters",
    region: "Ghent, Belgium",
    styleSummary:
      "Light-medium, clarity-leaning, well-crafted. Belgian specialty pioneer.",
    roastTendency: "light-medium",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "clarity",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Clever Dripper"],
    extractionRisks: ["Straightforward light-medium approach"],
    notes: "Standard approach. Clean cup.",
    confidence: "inferred",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Manhattan Coffee Roasters",
    region: "Rotterdam, Netherlands",
    styleSummary:
      "Light, clarity and sweetness, competition-adjacent. Often features high-scoring lots with transparency as the aesthetic goal.",
    roastTendency: "light",
    solubilityBias: "high",
    clarityVsSweetnessBias: "clarity",
    agitationTolerance: "sensitive",
    tempBias: "high",
    ratioBias: "lean",
    methodAffinities: ["Orea Apex", "V60"],
    extractionRisks: [
      "Under-extraction if technique is too passive",
      "Agitation-sensitive on premium clarity lots",
    ],
    notes:
      "Competition-level clarity aesthetic. Orea Apex preferred. High temp, lean ratio, minimal agitation on clarity lots.",
    confidence: "curated",
    disclaimer: DISCLAIMER,
  },

  // ── German cluster ───────────────────────────────────────────────────────

  {
    name: "The Barn",
    region: "Berlin, Germany",
    styleSummary:
      "Very light, ultra-clarity, minimal intervention. One of Germany's most influential specialty roasters. Coffees are roasted at the edge of solubility — dense, complex, very clean.",
    roastTendency: "very-light",
    solubilityBias: "high",
    clarityVsSweetnessBias: "clarity",
    agitationTolerance: "sensitive",
    tempBias: "high",
    ratioBias: "lean",
    methodAffinities: ["Orea Apex", "V60 no Assist", "Kasuya 4:6"],
    extractionRisks: [
      "Under-extraction risk is significant — passive technique will disappoint",
      "Aggressive stir at bloom can cause agitation bitterness on very light lots",
      "Drip Assist turbulence can muddy the clarity aesthetic",
    ],
    notes:
      "Do not use Drip Assist with The Barn coffees unless you want a more forgiving experience at the cost of transparency. Orea Apex or bare V60. High temp mandatory. Championship water opens up complexity. Kasuya 4:6 is excellent for exploring acid/sweet balance.",
    confidence: "curated",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Five Elephant",
    region: "Berlin, Germany",
    styleSummary:
      "Light, sweetness and clarity, naturals and washed. Berlin specialty institution. Coffees tend to be approachable with genuine sweetness and clean body.",
    roastTendency: "light",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "sweetness",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Orea Classic"],
    extractionRisks: [
      "Naturals can taste jammy in extended Clever steep",
      "Washed lots flat below 93°C",
    ],
    notes:
      "Sweetness is the through-line. Orea Classic brings out the best of their naturals. V60 + Drip Assist works well for washed lots. Standard ratio and temp.",
    confidence: "curated",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Bonanza Coffee",
    region: "Berlin, Germany",
    styleSummary:
      "Light-medium, approachable clarity, sweetness bias. Well-established Berlin specialty roaster with a broad, accessible range.",
    roastTendency: "light-medium",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "sweetness",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Clever Dripper"],
    extractionRisks: ["Bitter if pushed past 97°C on medium-light lots"],
    notes:
      "Reliable and approachable. Standard V60 or Clever Dripper. No extreme adjustments needed.",
    confidence: "curated",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Neues Schwarz",
    region: "Dortmund, Germany",
    styleSummary:
      "Quality-focused Dortmund specialty roaster with championship success. Light, clean, clarity and sweetness balanced. Strong competition pedigree for a relatively young roaster.",
    roastTendency: "light",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "balanced",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Clever Dripper"],
    extractionRisks: ["Standard light roast risks"],
    notes: "Dortmund-based roaster with competition success. Clean and well-calibrated — standard percolation approach works well.",
    confidence: "inferred",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Man vs Machine",
    region: "Munich, Germany",
    styleSummary:
      "Light-medium, quality-focused, varied origins. Munich specialty pioneer with a broad aesthetic range.",
    roastTendency: "light-medium",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "balanced",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Clever Dripper"],
    extractionRisks: ["Varies by lot — read coffee individually"],
    notes: "Good all-rounder. Standard approach.",
    confidence: "inferred",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Hoppenworth & Ploch",
    region: "Frankfurt, Germany",
    styleSummary:
      "Light-medium, terroir focus, sweetness-leaning. Well-crafted Frankfurt specialty roaster.",
    roastTendency: "light-medium",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "sweetness",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Clever Dripper"],
    extractionRisks: ["Standard light-medium risks"],
    notes: "Sweetness-forward approach. Standard V60 or Clever.",
    confidence: "inferred",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Playground",
    region: "Hamburg, Germany",
    styleSummary:
      "Light, experimental, often unusual origins and processing. Creative Hamburg project with an emphasis on discovery.",
    roastTendency: "light",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "varied",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Orea"],
    extractionRisks: [
      "Unusual lots may behave differently — read bag notes carefully",
      "Experimental processing can mean unpredictable extraction",
    ],
    notes:
      "Treat each coffee as an individual. Bag notes and process are better guides than roaster prior here.",
    confidence: "inferred",
    disclaimer: DISCLAIMER,
  },

  // ── French cluster ───────────────────────────────────────────────────────

  {
    name: "Terres de Café",
    region: "Paris, France",
    styleSummary:
      "Light-medium, terroir philosophy, sweetness and clarity. French specialty pioneer, consistent quality.",
    roastTendency: "light-medium",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "balanced",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Clever Dripper"],
    extractionRisks: ["Standard light-medium risks"],
    notes: "Quality French specialty. Standard approach.",
    confidence: "curated",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Coutume",
    region: "Paris, France",
    styleSummary:
      "Light-medium, clarity and sweetness, French specialty institution. Broad origin range, consistent and approachable.",
    roastTendency: "light-medium",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "balanced",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Clever Dripper"],
    extractionRisks: ["Standard risks"],
    notes: "Reliable and consistent. Standard approach.",
    confidence: "curated",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Tanat",
    region: "Paris, France",
    styleSummary:
      "Renowned Paris specialty roaster, formerly known as Kawa Coffee Roasters. Founded 2016. Named Europe's best independent coffee shop in 2024. Precise roasting, high-quality traceable beans, light-medium clarity-forward with elegant terroir expression.",
    roastTendency: "light-medium",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "clarity",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Clever Dripper"],
    extractionRisks: ["Under-extraction if brew technique is passive"],
    notes: "One of Europe's most celebrated specialty roasters. Clarity-forward with high attention to sourcing and traceability. Standard percolation with moderate agitation is the right approach.",
    confidence: "curated",
    disclaimer: DISCLAIMER,
  },

  // ── Spanish / Catalan cluster ────────────────────────────────────────────

  {
    name: "Nomad Coffee",
    region: "Barcelona, Spain",
    styleSummary:
      "Light-medium, sweetness and clarity, terroir philosophy. World Barista Championship-connected. Wide origin range with excellent quality control.",
    roastTendency: "light-medium",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "balanced",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Clever Dripper", "Kalita Wave"],
    extractionRisks: ["Naturals can be jammy with heavy immersion"],
    notes:
      "Consistent, high-quality. Kalita Wave suits their sweeter naturals. V60 for washed.",
    confidence: "curated",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Right Side Coffee",
    region: "Barcelona, Spain",
    styleSummary:
      "Light-medium, balanced, clarity-leaning. Quality Barcelona specialty.",
    roastTendency: "light-medium",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "clarity",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Orea"],
    extractionRisks: ["Standard risks"],
    notes: "Quality Barcelona specialty. Standard approach.",
    confidence: "inferred",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Three Marks Coffee",
    region: "Barcelona, Spain",
    styleSummary: "Light-medium, terroir-expressive, balanced. Barcelona specialty.",
    roastTendency: "light-medium",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "balanced",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Clever Dripper"],
    extractionRisks: ["Standard risks"],
    notes: "Standard approach.",
    confidence: "inferred",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Gota Coffee Experts",
    region: "Seville, Spain",
    styleSummary:
      "Light-medium, terroir focus, Southern European specialty. Well-regarded Spanish roaster.",
    roastTendency: "light-medium",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "balanced",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Clever Dripper"],
    extractionRisks: ["Standard risks"],
    notes: "Quality Southern European specialty. Standard approach.",
    confidence: "inferred",
    disclaimer: DISCLAIMER,
  },

  // ── Italian cluster ──────────────────────────────────────────────────────

  {
    name: "Gardelli Specialty Coffees",
    region: "Forlì, Italy",
    styleSummary:
      "Light, competition-level, terroir purity. Multiple World Brewing Championship finalist. Coffees are meticulously sourced and roasted for maximum expression. Often unusual varieties.",
    roastTendency: "light",
    solubilityBias: "high",
    clarityVsSweetnessBias: "clarity",
    agitationTolerance: "sensitive",
    tempBias: "high",
    ratioBias: "lean",
    methodAffinities: ["V60 no Assist", "Orea Apex", "Kasuya 4:6"],
    extractionRisks: [
      "Under-extraction is the primary risk — these need active technique",
      "Fines migration can muddy clarity on aggressive agitation",
    ],
    notes:
      "Championship-grade coffees. Orea Apex or V60 without Drip Assist. Championship water can reveal additional complexity. Kasuya 4:6 is excellent for phase-by-phase exploration of these coffees.",
    confidence: "curated",
    disclaimer: DISCLAIMER,
  },

  // ── Norwegian competition cluster ────────────────────────────────────────

  {
    name: "Keen Coffee",
    region: "Norway",
    styleSummary: "Light, quality-focused, Nordic aesthetic.",
    roastTendency: "light",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "clarity",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Orea"],
    extractionRisks: ["Standard light roast risks"],
    notes: "Nordic quality. Standard-to-high temp approach.",
    confidence: "inferred",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Hart Roasters",
    region: "Norway",
    styleSummary: "Light-medium, balanced, clarity and sweetness. Quality Nordic specialty.",
    roastTendency: "light-medium",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "balanced",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Clever Dripper"],
    extractionRisks: ["Standard risks"],
    notes: "Balanced Nordic approach.",
    confidence: "inferred",
    disclaimer: DISCLAIMER,
  },

  // ── Eastern European cluster ─────────────────────────────────────────────

  {
    name: "Hard Beans",
    region: "Opole, Poland",
    styleSummary:
      "Light to light-medium, competition-focused, clarity and sweetness. Award-winning Polish roaster with strong competition pedigree.",
    roastTendency: "light",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "balanced",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Orea"],
    extractionRisks: ["Standard light roast risks"],
    notes:
      "Competition-quality lots. Standard-to-high temp. V60 or Orea depending on clarity/sweetness goal.",
    confidence: "inferred",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Hayb Coffee",
    region: "Warsaw, Poland",
    styleSummary: "Light-medium, terroir-expressive, balanced. Well-regarded Polish specialty.",
    roastTendency: "light-medium",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "balanced",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Clever Dripper"],
    extractionRisks: ["Standard risks"],
    notes: "Standard approach.",
    confidence: "inferred",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Coffee Lab",
    region: "Poland",
    styleSummary: "Light-medium, educational brand, varied range. Polish specialty.",
    roastTendency: "light-medium",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "varied",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "AeroPress"],
    extractionRisks: ["Varies by lot"],
    notes: "Educational focus — range is varied. Read coffee individually.",
    confidence: "inferred",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Doubleshot",
    region: "Prague, Czech Republic",
    styleSummary:
      "Light-medium, clarity-leaning, terroir focus. One of Central Europe's best-established specialty roasters.",
    roastTendency: "light-medium",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "clarity",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Clever Dripper"],
    extractionRisks: ["Standard risks"],
    notes: "Reliable quality. Standard approach.",
    confidence: "inferred",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Jonas Reindl Coffee Roasters",
    region: "Vienna, Austria",
    styleSummary:
      "Light-medium, balanced, terroir-expressive. Vienna specialty roaster with a clean, consistent approach.",
    roastTendency: "light-medium",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "balanced",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Clever Dripper"],
    extractionRisks: ["Standard risks"],
    notes: "Balanced Vienna specialty. Standard approach.",
    confidence: "inferred",
    disclaimer: DISCLAIMER,
  },

  {
    name: "KB Coffee Roasters",
    region: "Bratislava, Slovakia",
    styleSummary: "Light-medium, clarity focus, well-crafted. Central European specialty.",
    roastTendency: "light-medium",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "clarity",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Clever Dripper"],
    extractionRisks: ["Standard risks"],
    notes: "Quality Slovak specialty. Standard approach.",
    confidence: "inferred",
    disclaimer: DISCLAIMER,
  },

  // ── Other European ───────────────────────────────────────────────────────

  {
    name: "Wide Awake Coffee",
    region: "Europe",
    styleSummary: "Light-medium, balanced specialty.",
    roastTendency: "light-medium",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "balanced",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60"],
    extractionRisks: ["Standard risks"],
    notes: "Limited information. Conservative defaults.",
    confidence: "fallback",
    disclaimer: FALLBACK_DISCLAIMER,
  },

  {
    name: "Senzu Coffee Roasters",
    region: "Europe",
    styleSummary: "Light-medium specialty.",
    roastTendency: "light-medium",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "balanced",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60"],
    extractionRisks: ["Standard risks"],
    notes: "Limited information. Conservative defaults.",
    confidence: "fallback",
    disclaimer: FALLBACK_DISCLAIMER,
  },

  {
    name: "7g Roaster",
    region: "Europe",
    styleSummary: "Light-medium specialty.",
    roastTendency: "light-medium",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "balanced",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60"],
    extractionRisks: ["Standard risks"],
    notes: "Limited information. Conservative defaults.",
    confidence: "fallback",
    disclaimer: FALLBACK_DISCLAIMER,
  },

  {
    name: "The Brick Coffee Roastery",
    region: "Europe",
    styleSummary: "Light-medium balanced specialty.",
    roastTendency: "light-medium",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "balanced",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60"],
    extractionRisks: ["Standard risks"],
    notes: "Limited information. Conservative defaults.",
    confidence: "fallback",
    disclaimer: FALLBACK_DISCLAIMER,
  },

  // ── Düsseldorf locals ────────────────────────────────────────────────────

  {
    name: "Lightroast",
    region: "Düsseldorf, Germany",
    styleSummary:
      "Düsseldorf specialty roaster. Light, sweetness and fruit-forward. Both naturals and washed, accessible fruit character with clean body.",
    roastTendency: "light",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "sweetness",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "V60 + Drip Assist", "Clever Dripper"],
    extractionRisks: ["Naturals can over-extract if agitated too much"],
    notes:
      "Local Düsseldorf roaster. Sweetness-forward light roast with fruit-forward character. Naturals and washed both represented.",
    confidence: "inferred",
    disclaimer:
      "Profile based on owner knowledge. Your brew data will refine this over time.",
  },

  {
    name: "RVTC",
    region: "Düsseldorf, Germany",
    styleSummary:
      "Düsseldorf specialty roaster. Light-medium, varied range covering both naturals and washed. Accessible and approachable specialty.",
    roastTendency: "light-medium",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "balanced",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "Clever Dripper"],
    extractionRisks: [
      "Varied range means no single extraction approach works for all coffees — read bag notes",
    ],
    notes:
      "Local Düsseldorf roaster. Broad, accessible range of naturals and washed.",
    confidence: "inferred",
    disclaimer:
      "Profile based on owner knowledge. Your brew data will refine this over time.",
  },

  {
    name: "SEY",
    region: "Brooklyn, New York, USA",
    styleSummary:
      "One of the most technically rigorous roasters in the US. Extremely light, bordering on under-roasted to untrained palates — but intentionally so for maximum origin expression. Sourcing is meticulous; lots are often unique and challenging.",
    roastTendency: "very-light",
    solubilityBias: "high",
    clarityVsSweetnessBias: "clarity",
    agitationTolerance: "sensitive",
    tempBias: "high",
    ratioBias: "lean",
    methodAffinities: ["V60", "Orea V4", "V60 + Drip Assist"],
    extractionRisks: [
      "Very easy to under-extract — roast is deliberately light",
      "Loses nuance fast with heavy agitation",
    ],
    notes:
      "High temp (96–98°C), lean ratio (1:16–1:17), minimal agitation. Needs full extraction to avoid sourness. Their coffees reward patience and precision.",
    confidence: "curated",
    disclaimer: DISCLAIMER,
  },

  {
    name: "The Roosters",
    region: "Ilisia / Vrilissia, Athens, Greece",
    styleSummary:
      "Athenian high-end coffee laboratory focused on slow coffee and hand-brewing. Minimalist approach, specialty-first, refined slow-experience atmosphere. Light roasts chosen for clarity and origin expression.",
    roastTendency: "light",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "clarity",
    agitationTolerance: "sensitive",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "V60 + Drip Assist", "Orea V4"],
    extractionRisks: ["Light roasts can read sour if under-extracted — ensure full bloom and even saturation"],
    notes:
      "Treat as a precision light-roast lab coffee. 94–96°C, 1:15–1:16, gentle agitation. Give the bloom time.",
    confidence: "inferred",
    disclaimer: DISCLAIMER,
  },

  {
    name: "Schvarz",
    region: "Düsseldorf, Germany",
    styleSummary:
      "Düsseldorf specialty roaster. Light-medium, sweetness-focused. Despite the dark-sounding name, a specialty-first roaster with accessible sweet cups.",
    roastTendency: "light-medium",
    solubilityBias: "moderate",
    clarityVsSweetnessBias: "sweetness",
    agitationTolerance: "moderate",
    tempBias: "standard",
    ratioBias: "standard",
    methodAffinities: ["V60", "V60 + Drip Assist", "Clever Dripper"],
    extractionRisks: ["Sweetness-forward profile can tip bitter if over-extracted"],
    notes:
      "Local Düsseldorf roaster. Sweetness bias, approachable specialty.",
    confidence: "inferred",
    disclaimer:
      "Profile based on owner knowledge. Your brew data will refine this over time.",
  },
];

export const FALLBACK_PRIOR: RoasterPrior = {
  name: "Unknown Roaster",
  styleSummary:
    "No curated profile available. Defaulting to conservative light-medium specialty assumptions.",
  roastTendency: "light-medium",
  solubilityBias: "moderate",
  clarityVsSweetnessBias: "balanced",
  agitationTolerance: "moderate",
  tempBias: "standard",
  ratioBias: "standard",
  methodAffinities: ["V60"],
  extractionRisks: [
    "Unknown roast level — read bag carefully",
    "Unknown process — treat as moderate solubility until confirmed",
  ],
  notes:
    "Rely on coffee properties (process, roast level, freshness, bag notes) over this prior. This is a safe starting point only.",
  confidence: "fallback",
  disclaimer: FALLBACK_DISCLAIMER,
};

/**
 * Look up a roaster prior by name (case-insensitive, trimmed).
 * Returns FALLBACK_PRIOR when the roaster is not in the curated list.
 */
export function getRoasterPrior(roasterName: string): RoasterPrior {
  const normalised = roasterName.toLowerCase().trim();
  return (
    // Exact match first
    ROASTER_PRIORS.find((r) => r.name.toLowerCase() === normalised) ??
    // Fuzzy: stored name contains prior name or vice versa (e.g. "Friedhats Coffee Roasters" → "Friedhats")
    ROASTER_PRIORS.find((r) => {
      const n = r.name.toLowerCase();
      return normalised.includes(n) || n.includes(normalised);
    }) ??
    FALLBACK_PRIOR
  );
}

/**
 * Returns a compact roaster prior suitable for injecting into a Claude prompt.
 * Omits the full disclaimer (too verbose for prompt injection).
 */
export function formatRoasterPriorForPrompt(prior: RoasterPrior): string {
  return `ROASTER STYLE PRIOR — ${prior.name}${prior.region ? ` (${prior.region})` : ""}:
Style: ${prior.styleSummary}
Roast tendency: ${prior.roastTendency} | Solubility: ${prior.solubilityBias} | Clarity vs sweetness: ${prior.clarityVsSweetnessBias}
Agitation tolerance: ${prior.agitationTolerance} | Temp bias: ${prior.tempBias} | Ratio bias: ${prior.ratioBias}
Method affinities: ${prior.methodAffinities.join(", ")}
Extraction risks: ${prior.extractionRisks.join("; ")}
Notes: ${prior.notes}
Confidence: ${prior.confidence}
⚠ This is a prior — user brew history overrides it when present. Individual coffees vary.`;
}
