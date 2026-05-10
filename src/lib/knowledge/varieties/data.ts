import type { VarietyPrior } from "./types";

/**
 * Genetic / agronomic facts (parentage, identification year, origin region)
 * are sourced from the World Coffee Research Arabica Coffee Varieties
 * Catalog (https://varieties.worldcoffeeresearch.org). Cup descriptions
 * synthesise specialty-coffee industry consensus from Royal Coffee / The
 * Crown's *Green Coffee Book*, Sucafina origin reports, and well-attested
 * trade publications.
 *
 * Honest disclaimer: WCR is conservative about cup claims because cup
 * outcomes depend heavily on terroir, processing, and roast — variables
 * that swamp the genetic contribution. The cup descriptions here describe
 * how the variety *typically* presents in specialty-grade lots; an
 * individual coffee can differ.
 */

const WCR_CATALOG = {
  type: "wcr-catalog" as const,
  citation:
    "World Coffee Research — Arabica Coffee Varieties Catalog (varieties.worldcoffeeresearch.org)",
  url: "https://varieties.worldcoffeeresearch.org",
};

const ROYAL_GREEN_BOOK = {
  type: "trade-publication" as const,
  citation:
    "Kornman, C. — *The Green Coffee Book* (Royal Coffee / The Crown, Oakland)",
};

const WCR_2024_INNOVEA = {
  type: "research-paper" as const,
  citation:
    "World Coffee Research — 2024 Innovea Arabica Breeding Network annual report",
  year: 2024,
};

export const VARIETY_PRIORS: VarietyPrior[] = [
  // ── Bourbon family ───────────────────────────────────────────────────────

  {
    name: "Bourbon",
    aliases: ["Red Bourbon", "Bourbon Vermelho"],
    geneticFamily: "Bourbon",
    parentage: "Spontaneous mutation of Typica on Île Bourbon (Réunion)",
    origin: "Réunion (Île Bourbon), 1700s",
    identifiedYear: 1715,
    cupSignature:
      "Sweet, balanced, classic specialty profile. Caramel, milk chocolate, soft red fruit, gentle citric acidity. The reference cup against which other varieties are often compared.",
    acidity: "moderate",
    body: "medium",
    aromatics: "moderate",
    density: "moderate",
    solubility: "moderate",
    brewingTendencies:
      "Forgiving across methods. Standard 1:15–1:16 at 92–95°C is reliable. Has enough body that an immersion brew (Clever, AeroPress) is rewarding; has enough acidity that a clean V60 is also good.",
    commonProcessings: ["washed", "natural", "honey"],
    pairsWellWithRecipes: [
      "rao-rule-of-thirds",
      "hoffmann-v60-better-one-cup",
      "hoffmann-clever-ultimate",
      "kasuya-4-6-standard",
    ],
    extractionRisks: [
      "Under-extraction reads as flat/cardboardy — Bourbon's body needs full development",
      "Over-roasted Bourbons collapse to generic 'coffee' — provenance matters",
    ],
    notes:
      "Genetic ancestor of Caturra, Catuai, Mundo Novo, Pacas. Most specialty-grade Latin American coffees you'll see are in the Bourbon-Typica family.",
    confidence: "wcr-curated",
    sources: [WCR_CATALOG, ROYAL_GREEN_BOOK],
  },

  {
    name: "Yellow Bourbon",
    aliases: ["Bourbon Amarelo"],
    geneticFamily: "Bourbon",
    parentage: "Natural mutation of Bourbon producing yellow cherries",
    origin: "Brazil, early 1900s",
    cupSignature:
      "Sweeter and more delicate than Red Bourbon. Honey, peach, soft floral notes. Often slightly more aromatic.",
    acidity: "moderate",
    body: "medium",
    aromatics: "moderate",
    density: "moderate",
    solubility: "moderate",
    brewingTendencies:
      "As Bourbon, but lean slightly toward sweetness-forward methods. The yellow-cherry mutation correlates with marginally higher sugar content at maturity.",
    commonProcessings: ["natural", "honey", "washed"],
    pairsWellWithRecipes: [
      "hoffmann-clever-ultimate",
      "kasuya-4-6-standard",
      "hoffmann-v60-better-one-cup",
    ],
    extractionRisks: [
      "Yellow cherries can be picked under-ripe (yellow ≠ ripe for this variety) → grassy notes",
    ],
    notes:
      "Common in Brazilian specialty (Daterra, Fazenda Ambiental Fortaleza). Also grown in Costa Rica and El Salvador.",
    confidence: "wcr-curated",
    sources: [WCR_CATALOG],
  },

  {
    name: "Caturra",
    geneticFamily: "Bourbon",
    parentage: "Single-gene dwarf mutation of Bourbon",
    origin: "Minas Gerais, Brazil, 1937",
    identifiedYear: 1937,
    cupSignature:
      "Brighter and more citric than Bourbon, with lighter body. Lemon, white grape, herbal notes. Backbone of Colombian specialty for decades.",
    acidity: "high",
    body: "light",
    aromatics: "moderate",
    density: "moderate",
    solubility: "moderate",
    brewingTendencies:
      "Rewards clarity-forward methods. V60 or Orea Apex over Clever. Standard 1:15 at 93–95°C. Caturra wants its acidity expressed, not muted — diluted water (~150 ppm) preferred over hard tap.",
    commonProcessings: ["washed", "honey", "natural"],
    pairsWellWithRecipes: [
      "hoffmann-v60-better-one-cup",
      "rao-rule-of-thirds",
      "rolf-minimum-variables",
      "wbrc-2016-kasuya",
    ],
    extractionRisks: [
      "Easy to over-extract into harshness — high acidity at low extraction reads great; same coffee at high extraction can taste papery",
      "Naturals can lose Caturra's defining citric clarity",
    ],
    notes:
      "Dwarfism makes Caturra easier to harvest; high yield made it Latin America's workhorse variety.",
    confidence: "wcr-curated",
    sources: [WCR_CATALOG, ROYAL_GREEN_BOOK],
  },

  {
    name: "Catuai",
    aliases: ["Catuaí", "Red Catuai", "Yellow Catuai"],
    geneticFamily: "Bourbon",
    parentage: "Mundo Novo × Caturra",
    origin: "Brazil, 1949",
    identifiedYear: 1949,
    cupSignature:
      "Sweet, mild, balanced. Less acidity than Caturra, more body. Caramel, hazelnut, mild citrus. A workhorse cup — pleasant rather than distinctive.",
    acidity: "moderate",
    body: "medium",
    aromatics: "moderate",
    density: "moderate",
    solubility: "moderate",
    brewingTendencies:
      "Forgiving. Suits batch brewers (Moccamaster) and immersion methods. Light roasts can read flat — medium-light tends to develop Catuai's sweetness better.",
    commonProcessings: ["washed", "natural", "honey", "any"],
    pairsWellWithRecipes: [
      "hoffmann-moccamaster",
      "hoffmann-clever-ultimate",
      "rao-rule-of-thirds",
    ],
    extractionRisks: [
      "Often under-roasted by Nordic-style roasters → grassy, vegetal",
    ],
    notes:
      "Very widely planted in Brazil and Central America. Reliable rather than transcendent.",
    confidence: "wcr-curated",
    sources: [WCR_CATALOG],
  },

  {
    name: "Mundo Novo",
    geneticFamily: "Bourbon",
    parentage: "Natural cross — Sumatra (Typica) × Red Bourbon",
    origin: "Brazil, 1940s",
    identifiedYear: 1943,
    cupSignature:
      "Heavy body, sweet, low acidity. Chocolate, nut, baked sugar. The classic Brazilian espresso-blend cup, but specialty-grade lots can be remarkable in immersion.",
    acidity: "low",
    body: "full",
    aromatics: "moderate",
    density: "moderate",
    solubility: "high",
    brewingTendencies:
      "Body-forward. Excellent in Clever or AeroPress. V60 can read flat without extra agitation — Perger-style high-extraction technique helps.",
    commonProcessings: ["natural", "washed", "honey"],
    pairsWellWithRecipes: [
      "hoffmann-clever-ultimate",
      "hoffmann-aeropress-standard",
      "perger-high-extraction-v60",
    ],
    extractionRisks: [
      "Low acidity means under-extraction is masked — easy to leave flavour in the puck",
    ],
    notes:
      "Parent of Catuai. Mundo Novo is what gives Brazilian specialty its body-first reputation.",
    confidence: "wcr-curated",
    sources: [WCR_CATALOG],
  },

  {
    name: "Pacas",
    geneticFamily: "Bourbon",
    parentage: "Single-gene dwarf mutation of Bourbon",
    origin: "Santa Ana, El Salvador, 1949",
    identifiedYear: 1949,
    cupSignature:
      "Similar to Bourbon — sweet, balanced, classic. Slightly more pronounced citric acidity. Often more aromatic than Bourbon at the same altitude.",
    acidity: "moderate",
    body: "medium",
    aromatics: "moderate",
    density: "moderate",
    solubility: "moderate",
    brewingTendencies:
      "Behaves like Bourbon. Forgiving across methods.",
    commonProcessings: ["washed", "natural", "honey"],
    pairsWellWithRecipes: [
      "rao-rule-of-thirds",
      "hoffmann-v60-better-one-cup",
      "kasuya-4-6-standard",
    ],
    extractionRisks: [
      "Standard Bourbon-family risks",
    ],
    notes:
      "Salvadoran cousin of Caturra. One parent of Pacamara.",
    confidence: "wcr-curated",
    sources: [WCR_CATALOG],
  },

  {
    name: "Pink Bourbon",
    geneticFamily: "Other",
    parentage:
      "Recent (WCR 2024) genetic analysis indicates Pink Bourbon is NOT a Bourbon mutation — it sits genetically closer to Ethiopian landraces than to true Bourbon. Origin remains under research.",
    origin: "Huila, Colombia, mid-1900s",
    cupSignature:
      "Floral, jasmine, peach, lemon-pith. Very high aromatic intensity, delicate body, bright citric acidity. One of the most expressive Colombian profiles.",
    acidity: "high",
    body: "light",
    aromatics: "intense",
    density: "high",
    solubility: "high",
    brewingTendencies:
      "Treat like a Gesha or top Ethiopian — clarity methods, championship water, careful temperature. Aromatic compounds dissipate above 96°C; cap temperature at 94–95°C unless using Hsu-style staged temp.",
    commonProcessings: ["washed", "honey", "natural"],
    pairsWellWithRecipes: [
      "wbrc-2022-hsu",
      "rolf-minimum-variables",
      "hoffmann-v60-better-one-cup",
      "wbrc-2019-du",
    ],
    extractionRisks: [
      "High temperature (>96°C) drives off the defining florals",
      "Hard tap water (>250 ppm) buffers the cup into flatness",
      "Heavy agitation muddies the delicate body",
    ],
    notes:
      "Important nuance: Pink Bourbon was long marketed as a Bourbon mutation but WCR's 2024 genetic work showed it is genetically distinct. Marketing materials still call it a Bourbon — the cup behaviour suggests the genetics are right and the historical attribution is wrong.",
    confidence: "wcr-curated",
    sources: [WCR_CATALOG, WCR_2024_INNOVEA],
  },

  // ── Typica family ────────────────────────────────────────────────────────

  {
    name: "Typica",
    geneticFamily: "Typica",
    parentage: "Original Yemen-derived Arabica that left the Mocha port",
    origin: "Yemen → Indonesia (1696) → Caribbean and Latin America",
    cupSignature:
      "Clean, sweet, balanced, low acidity. The 'classical' coffee profile. Honey, soft chocolate, gentle stone fruit.",
    acidity: "low",
    body: "medium",
    aromatics: "moderate",
    density: "moderate",
    solubility: "moderate",
    brewingTendencies:
      "Forgiving. Default settings work. Body-forward methods (Clever, AeroPress) suit Typica's sweetness; clarity methods can read flat.",
    commonProcessings: ["washed", "natural", "honey"],
    pairsWellWithRecipes: [
      "hoffmann-clever-ultimate",
      "hoffmann-v60-better-one-cup",
      "rao-rule-of-thirds",
    ],
    extractionRisks: [
      "Low acidity = harder to spot under-extraction",
    ],
    notes:
      "Genetic ancestor of nearly every Latin American Arabica via Bourbon. Pure Typica is rare in modern specialty — most claims of 'Typica' are descendants.",
    confidence: "wcr-curated",
    sources: [WCR_CATALOG],
  },

  {
    name: "Java",
    geneticFamily: "Typica",
    parentage: "Indonesian Typica selection",
    origin: "Java, Indonesia",
    cupSignature:
      "Clean, citric, often more lively than generic Typica. Lemon, herbal, sometimes spicy.",
    acidity: "moderate",
    body: "medium",
    aromatics: "moderate",
    density: "moderate",
    solubility: "moderate",
    brewingTendencies:
      "Standard Typica approach. Clarity methods bring out the citric character.",
    commonProcessings: ["washed", "natural"],
    pairsWellWithRecipes: [
      "hoffmann-v60-better-one-cup",
      "rao-rule-of-thirds",
    ],
    extractionRisks: [
      "Indonesian-grown Java sometimes carries earthy/wet-hulled character that masks variety",
    ],
    notes:
      "Now grown in Cameroon, Ethiopia (interestingly — at high altitude), and parts of Latin America.",
    confidence: "wcr-curated",
    sources: [WCR_CATALOG],
  },

  {
    name: "Maragogype",
    aliases: ["Maragogipe", "Elephant Bean"],
    geneticFamily: "Typica",
    parentage: "Spontaneous giant-bean mutation of Typica",
    origin: "Bahia, Brazil, 1870",
    identifiedYear: 1870,
    cupSignature:
      "Soft, low acidity, full body, classical sweetness. Big beans extract slowly — cup often reads gentle and rounded.",
    acidity: "low",
    body: "full",
    aromatics: "moderate",
    density: "low",
    solubility: "moderate",
    brewingTendencies:
      "The giant beans need a coarser grind than typical to avoid over-extraction — the surface area per gram is lower than standard varieties. Immersion methods suit the body-forward profile.",
    commonProcessings: ["washed", "natural"],
    pairsWellWithRecipes: [
      "hoffmann-clever-ultimate",
      "hoffmann-aeropress-standard",
    ],
    extractionRisks: [
      "Standard grind often runs too fine — go 2–3° coarser on Niche than usual",
    ],
    notes:
      "Pure Maragogype is rare in modern specialty. Its main legacy is Pacamara (Pacas × Maragogype).",
    confidence: "wcr-curated",
    sources: [WCR_CATALOG],
  },

  // ── Ethiopian landrace + heirloom ────────────────────────────────────────

  {
    name: "Ethiopian Heirloom",
    aliases: ["Ethiopia Heirloom", "Heirloom", "Ethiopia Landrace"],
    geneticFamily: "Ethiopia landrace",
    parentage:
      "Wild Arabica genetic diversity — thousands of distinct landraces, generally not formally identified at the variety level",
    origin: "Ethiopia (Yirgacheffe, Sidamo, Guji, Limu, Harrar, Kaffa)",
    cupSignature:
      "Region-defined. Yirgacheffe washed: jasmine, bergamot, lemon, tea-like. Guji natural: blueberry, strawberry, fruit punch. Sidamo: floral with tropical fruit. Harrar natural: blueberry, wine, sometimes wild fermentation notes.",
    acidity: "high",
    body: "light",
    aromatics: "intense",
    density: "high",
    solubility: "high",
    brewingTendencies:
      "Treat as the gold-standard clarity coffee. V60, Orea Apex, or championship-style brewing. Cap temperature at 94–95°C for washed Yirgacheffe (florals dissipate higher); 93°C for naturals (manage fermentation esters). Diluted or low-mineral water meaningfully improves the cup.",
    commonProcessings: ["washed", "natural", "honey"],
    pairsWellWithRecipes: [
      "wbrc-2022-hsu",
      "wbrc-2019-du",
      "hoffmann-v60-better-one-cup",
      "rolf-minimum-variables",
      "rao-rule-of-thirds",
    ],
    extractionRisks: [
      "High solubility = easy to over-extract into astringency",
      "Hard tap water buffers the entire cup into 'fine but flat'",
      "Vigorous agitation on naturals amplifies fermentation toward vinegar",
    ],
    notes:
      "Ethiopia is the genetic origin point of all Arabica. 'Heirloom' is an umbrella term used because formal landrace identification is rare. Specific named landraces (Wush Wush, Geisha, Dega, Wolisho) sometimes appear on bags — those are individuated within the landrace umbrella.",
    confidence: "industry-canonical",
    sources: [ROYAL_GREEN_BOOK],
  },

  {
    name: "Wush Wush",
    aliases: ["Wushwush"],
    geneticFamily: "Ethiopia landrace",
    parentage: "Distinct named landrace from the Wushwush region of Ethiopia",
    origin: "Wushwush, Kaffa, Ethiopia",
    cupSignature:
      "Floral, jasmine, tea-like, cinnamon, often with a savoury depth. Distinct from generic Yirgacheffe — more tea than citrus, more spice than fruit.",
    acidity: "moderate",
    body: "light",
    aromatics: "intense",
    density: "high",
    solubility: "high",
    brewingTendencies:
      "Like a Gesha — wants clarity-forward technique, championship water if available, cap at 94–95°C. The aromatic complexity is the entire point; methods that flatten it (immersion at high temp) lose the variety.",
    commonProcessings: ["washed", "natural"],
    pairsWellWithRecipes: [
      "wbrc-2022-hsu",
      "rolf-minimum-variables",
      "hoffmann-v60-better-one-cup",
      "wbrc-2019-du",
    ],
    extractionRisks: [
      "Same as Ethiopian Heirloom — temp ceiling, water quality, agitation control",
    ],
    notes:
      "Now grown in Colombia (Inmaculada, Las Mercedes, Finca El Diviso) at very high altitude — 1900m+. Colombian Wush Wush has slightly more body than Ethiopian.",
    confidence: "industry-canonical",
    sources: [ROYAL_GREEN_BOOK],
  },

  {
    name: "Chiroso",
    aliases: ["Caturra Chiroso"],
    geneticFamily: "Ethiopia landrace",
    parentage:
      "Long marketed as a Caturra variant; recent genetic work suggests Ethiopian landrace ancestry. WCR has not formally classified it.",
    origin: "Antioquia, Colombia",
    cupSignature:
      "Floral, lemongrass, white tea, lemon zest, sometimes herbaceous. Very expressive with strong clarity.",
    acidity: "high",
    body: "light",
    aromatics: "intense",
    density: "high",
    solubility: "high",
    brewingTendencies:
      "Treat like Wush Wush — clarity methods, careful temperature. The lemongrass aromatic is fragile and dissipates above 95°C.",
    commonProcessings: ["washed", "honey", "natural"],
    pairsWellWithRecipes: [
      "wbrc-2022-hsu",
      "rolf-minimum-variables",
      "hoffmann-v60-better-one-cup",
    ],
    extractionRisks: [
      "Standard delicate-coffee risks — temperature, water, agitation",
    ],
    notes:
      "Often sold as 'Caturra Chiroso' for marketing reasons; the cup behaves nothing like Caturra. La Palma y El Tucán in Colombia is one of the better-known sources.",
    confidence: "inferred",
    sources: [ROYAL_GREEN_BOOK],
  },

  {
    name: "Sidra",
    geneticFamily: "Other",
    parentage:
      "Disputed. Long claimed as a natural Bourbon × Typica cross. Some Ecuadorian sources name it as a mutation; WCR notes the origin is unclear and not formally documented.",
    origin: "Ecuador / Colombia (debated)",
    cupSignature:
      "Floral, fruity, sometimes wild — tropical, jasmine, pineapple, lychee. Naturals lean heavily into tropical fermentation; washed lots are more delicate.",
    acidity: "high",
    body: "light",
    aromatics: "intense",
    density: "high",
    solubility: "high",
    brewingTendencies:
      "Clarity methods. Naturals need temperature restraint (93°C) to avoid fermentation amplification. Washed Sidra suits Hsu-style staged temp or Du-style rich-ratio technique.",
    commonProcessings: ["washed", "natural", "honey", "anaerobic"],
    pairsWellWithRecipes: [
      "wbrc-2023-medina",
      "wbrc-2022-hsu",
      "wbrc-2019-du",
      "rolf-minimum-variables",
    ],
    extractionRisks: [
      "Naturals over-extract into volatile/winey at high temperatures",
      "Anaerobic Sidra is intensely fermented — not for clarity goals",
    ],
    notes:
      "Carlos Medina won the 2023 WBrC with a Natural Sidra. Hacienda La Papaya (Ecuador) is the most famous source.",
    confidence: "inferred",
    sources: [ROYAL_GREEN_BOOK],
  },

  // ── Geisha family ────────────────────────────────────────────────────────

  {
    name: "Geisha",
    aliases: ["Geisha (Panama)", "Panamanian Geisha"],
    geneticFamily: "Geisha",
    parentage:
      "Wild Arabica from Gesha forest, Ethiopia, collected 1936 — moved to Costa Rica (CATIE) and onward to Panama (Hacienda La Esmeralda, 1960s)",
    origin: "Gesha forest, Ethiopia → Boquete, Panama",
    identifiedYear: 1936,
    cupSignature:
      "Jasmine, bergamot, white peach, lemon zest, tea-like. Aromatic complexity that no other variety matches in specialty. Acidity is bright but elegant; body is delicate.",
    acidity: "high",
    body: "light",
    aromatics: "intense",
    density: "high",
    solubility: "high",
    brewingTendencies:
      "The reference clarity coffee. Championship-style brewing rewards every variable: low-mineral water (<80 ppm), staged temperature, minimal agitation, lean ratio (1:16+). The variety has the highest aromatic ceiling — match the technique to the coffee.",
    commonProcessings: ["washed", "natural", "honey"],
    pairsWellWithRecipes: [
      "wbrc-2025-peng",
      "wbrc-2022-hsu",
      "wbrc-2019-du",
      "rolf-minimum-variables",
      "hoffmann-v60-better-one-cup",
    ],
    extractionRisks: [
      "Heat above 96°C destroys the defining florals before they reach the cup",
      "Tap water at 300 ppm buffers Geisha's brightness into oblivion — water quality is a hard ceiling",
      "Heavy-bodied methods (Clever, AeroPress) erase what makes Geisha worth the price",
    ],
    notes:
      "Now grown across Colombia, Costa Rica, Honduras, El Salvador, Hawaii. Top auction lots from Hacienda La Esmeralda (Panama) and Ninety Plus (Panama, Ethiopia, Colombia) are among the most expensive coffees in the world.",
    confidence: "wcr-curated",
    sources: [WCR_CATALOG, ROYAL_GREEN_BOOK],
  },

  // ── SL series (Kenya) ────────────────────────────────────────────────────

  {
    name: "SL28",
    geneticFamily: "SL series",
    parentage:
      "Selection from a Tanganyika Drought Resistant population at Scott Agricultural Laboratories, Kenya. Bourbon-derived ancestry (likely French Mission Bourbon).",
    origin: "Scott Labs, Kenya, 1930s",
    identifiedYear: 1935,
    cupSignature:
      "Blackcurrant, tomato, red wine, savoury depth. Intense, structured, complex. The most distinctive Kenyan profile.",
    acidity: "high",
    body: "full",
    aromatics: "intense",
    density: "high",
    solubility: "high",
    brewingTendencies:
      "Can handle higher temperatures than other delicate varieties — 96–98°C is fine, often desirable. Slower extraction at the same grind compared to Ethiopian — may need a finer grind than expected. Diluted water mandatory at this user's tap profile (300 ppm tap mutes blackcurrant).",
    commonProcessings: ["washed"],
    pairsWellWithRecipes: [
      "perger-high-extraction-v60",
      "rao-rule-of-thirds",
      "hoffmann-v60-better-one-cup",
      "wbrc-2016-kasuya",
    ],
    extractionRisks: [
      "Under-extraction reads as sour/tomato-skin without the savoury depth",
      "Tap water suppresses blackcurrant — diluted water is a meaningful upgrade",
    ],
    notes:
      "Drought-resistant; deep-rooted; low yield. Often interplanted with SL34. Most Kenyan AA / AB lots are SL28/SL34 blends.",
    confidence: "wcr-curated",
    sources: [WCR_CATALOG, ROYAL_GREEN_BOOK],
  },

  {
    name: "SL34",
    geneticFamily: "SL series",
    parentage: "Scott Labs selection from a French Mission ancestry tree",
    origin: "Scott Labs, Kenya, 1930s",
    identifiedYear: 1939,
    cupSignature:
      "Similar to SL28 but slightly less intense. Blackcurrant, citrus, more balance, less savoury depth. More approachable.",
    acidity: "high",
    body: "medium",
    aromatics: "intense",
    density: "high",
    solubility: "high",
    brewingTendencies:
      "As SL28, but slightly more forgiving. Standard 1:15 at 95–96°C is reliable.",
    commonProcessings: ["washed"],
    pairsWellWithRecipes: [
      "rao-rule-of-thirds",
      "hoffmann-v60-better-one-cup",
      "wbrc-2016-kasuya",
    ],
    extractionRisks: [
      "Same as SL28; less risk of running flat than SL28",
    ],
    notes:
      "Better suited to lower-altitude sites than SL28. Blended in most Kenyan AA lots.",
    confidence: "wcr-curated",
    sources: [WCR_CATALOG],
  },

  {
    name: "Ruiru 11",
    geneticFamily: "Catimor / Sarchimor",
    parentage:
      "Kenyan composite — multiple lines crossing SL28/SL34 and other commercials with disease-resistant Catimor backgrounds (Hibrido de Timor derivative)",
    origin: "Ruiru, Kenya, 1985",
    identifiedYear: 1985,
    cupSignature:
      "Less complex than SL28/SL34 but still good Kenyan profile. Citric, less of the blackcurrant signature, milder body.",
    acidity: "moderate",
    body: "medium",
    aromatics: "moderate",
    density: "moderate",
    solubility: "moderate",
    brewingTendencies:
      "Forgiving. Standard Kenyan approach (1:15, 94–96°C) works.",
    commonProcessings: ["washed"],
    pairsWellWithRecipes: [
      "rao-rule-of-thirds",
      "hoffmann-v60-better-one-cup",
    ],
    extractionRisks: [
      "Catimor ancestry can show as 'green/grassy' in under-developed roasts",
    ],
    notes:
      "Disease-resistant — saved Kenyan production from Coffee Berry Disease devastation.",
    confidence: "wcr-curated",
    sources: [WCR_CATALOG],
  },

  {
    name: "Batian",
    geneticFamily: "SL series",
    parentage: "Multi-line cross: SL28 / SL34 / Rume Sudan / SL4 / N39 / K7",
    origin: "Coffee Research Institute, Kenya, 2010",
    identifiedYear: 2010,
    cupSignature:
      "Closer to SL28's complexity than Ruiru 11 — preserves blackcurrant and structure while adding disease resistance.",
    acidity: "high",
    body: "medium",
    aromatics: "intense",
    density: "high",
    solubility: "high",
    brewingTendencies:
      "Treat as SL28 — same temperature window, same water priorities, same extraction approach.",
    commonProcessings: ["washed"],
    pairsWellWithRecipes: [
      "perger-high-extraction-v60",
      "rao-rule-of-thirds",
      "hoffmann-v60-better-one-cup",
    ],
    extractionRisks: [
      "Standard Kenyan-coffee risks",
    ],
    notes:
      "Newer release; gradually replacing Ruiru 11 in disease-pressured Kenyan farms while preserving cup quality.",
    confidence: "wcr-curated",
    sources: [WCR_CATALOG],
  },

  // ── F1 hybrids and Colombia disease-resistant ────────────────────────────

  {
    name: "Castillo",
    geneticFamily: "Catimor / Sarchimor",
    parentage:
      "Caturra × Hibrido de Timor (a Robusta-Arabica natural cross from East Timor that confers leaf-rust resistance)",
    origin: "Cenicafé, Colombia, 2005 release",
    identifiedYear: 2005,
    cupSignature:
      "Variable — quality depends heavily on lot, altitude, and processing. Best lots: balanced, sweet, soft acidity, approachable. Lower-altitude or under-developed: green, grassy, vegetal.",
    acidity: "moderate",
    body: "medium",
    aromatics: "moderate",
    density: "moderate",
    solubility: "moderate",
    brewingTendencies:
      "Lot-dependent. Read the bag and the roast carefully. Specialty-grade Castillo at 1700m+ behaves like Caturra; lower-grade Castillo can need extra agitation to overcome the green/Catimor character.",
    commonProcessings: ["washed", "honey", "natural"],
    pairsWellWithRecipes: [
      "rao-rule-of-thirds",
      "hoffmann-v60-better-one-cup",
      "perger-high-extraction-v60",
    ],
    extractionRisks: [
      "Catimor heritage can read as harsh/green at low extraction; needs full development",
    ],
    notes:
      "The current backbone of Colombian coffee production. Specialty-grade Castillo is now beating Caturra in many cuppings — the cup-quality penalty has shrunk substantially since the 2005 release.",
    confidence: "wcr-curated",
    sources: [WCR_CATALOG, ROYAL_GREEN_BOOK],
  },

  {
    name: "Tabi",
    geneticFamily: "Catimor / Sarchimor",
    parentage: "Bourbon × Typica × Hibrido de Timor",
    origin: "Cenicafé, Colombia, 2002",
    identifiedYear: 2002,
    cupSignature:
      "Similar to Bourbon — sweet, balanced, classical specialty profile. Less of the Catimor green character than Castillo. Good lots are excellent.",
    acidity: "moderate",
    body: "medium",
    aromatics: "moderate",
    density: "moderate",
    solubility: "moderate",
    brewingTendencies:
      "Forgiving like Bourbon. Standard 1:15 at 93–95°C.",
    commonProcessings: ["washed", "natural", "honey"],
    pairsWellWithRecipes: [
      "rao-rule-of-thirds",
      "hoffmann-v60-better-one-cup",
      "kasuya-4-6-standard",
    ],
    extractionRisks: [
      "Bourbon-family risks",
    ],
    notes:
      "Less common than Castillo in Colombian production; grown more often by specialty-focused farms.",
    confidence: "wcr-curated",
    sources: [WCR_CATALOG],
  },

  {
    name: "Centroamericano",
    aliases: ["H1", "H1 Hybrid"],
    geneticFamily: "F1 hybrid",
    parentage: "Sarchimor T5296 × Rume Sudan",
    origin: "CIRAD / ICAFE / Promecafe, 2010 release",
    identifiedYear: 2010,
    cupSignature:
      "F1 hybrid — high vigour, high yield, high cup quality. Sweet, complex, often with floral notes. The first commercially successful F1 hybrid in coffee.",
    acidity: "moderate",
    body: "medium",
    aromatics: "intense",
    density: "high",
    solubility: "high",
    brewingTendencies:
      "Treat like a high-quality Bourbon-family with extra aromatic complexity. Standard 1:15 at 94°C; clarity methods bring out the floral side.",
    commonProcessings: ["washed", "honey", "natural"],
    pairsWellWithRecipes: [
      "rao-rule-of-thirds",
      "hoffmann-v60-better-one-cup",
      "wbrc-2016-kasuya",
    ],
    extractionRisks: [
      "Standard care",
    ],
    notes:
      "F1 hybrids are bred for vigour by crossing two genetically-distant parents. Higher yields than any traditional variety, with cup quality matching or exceeding Bourbon. Other F1 lines: Marsellesa, Starmaya, Mundo Maya.",
    confidence: "wcr-curated",
    sources: [WCR_CATALOG, WCR_2024_INNOVEA],
  },

  // ── Pacamara ─────────────────────────────────────────────────────────────

  {
    name: "Pacamara",
    geneticFamily: "Pacamara",
    parentage: "Pacas × Maragogype",
    origin: "El Salvador, 1958",
    identifiedYear: 1958,
    cupSignature:
      "Distinctive — complex, savoury, often herbal. Tomato, basil, dark chocolate, sometimes tropical fruit. Big bean, low density, slow extraction.",
    acidity: "moderate",
    body: "full",
    aromatics: "intense",
    density: "low",
    solubility: "moderate",
    brewingTendencies:
      "Like Maragogype — coarser grind than expected. The big-bean low-density combination means standard grind settings over-extract. Niche +3–5° from typical V60. Body-forward methods suit the savoury profile.",
    commonProcessings: ["washed", "natural", "honey", "anaerobic"],
    pairsWellWithRecipes: [
      "hoffmann-clever-ultimate",
      "perger-high-extraction-v60",
      "rao-rule-of-thirds",
    ],
    extractionRisks: [
      "Standard grind setting will over-extract — go coarser",
      "Anaerobic Pacamaras are intensely processed, often divisive",
    ],
    notes:
      "Common at El Salvador and Honduras competition farms (Cup of Excellence regulars).",
    confidence: "wcr-curated",
    sources: [WCR_CATALOG, ROYAL_GREEN_BOOK],
  },

  // ── Mokka ────────────────────────────────────────────────────────────────

  {
    name: "Mokka",
    aliases: ["Mocha", "Mokha", "Mocca"],
    geneticFamily: "Mokka",
    parentage:
      "Yemeni heirloom — small-bean Typica derivative; not the Mocha port (which is a name, not a variety)",
    origin: "Yemen / Ethiopia",
    cupSignature:
      "Wine, dark chocolate, dried fruit, sometimes intense. Small beans, low yield, distinctive cup.",
    acidity: "moderate",
    body: "full",
    aromatics: "intense",
    density: "high",
    solubility: "moderate",
    brewingTendencies:
      "Tiny beans — finer grind than typical (-2 to -3° on Niche). Naturals from Yemen are often sun-dried in unusual conditions; treat as a fermentation-forward coffee even when nominally washed.",
    commonProcessings: ["natural", "washed"],
    pairsWellWithRecipes: [
      "hoffmann-clever-ultimate",
      "hoffmann-aeropress-standard",
    ],
    extractionRisks: [
      "Small beans grind differently — recalibrate from your usual setting",
    ],
    notes:
      "Distinct from 'Mocha' as a coffee + chocolate drink. Yemeni Mokka is rare in modern specialty; Indian Mocha and Hawaiian Mocha are descended Typica selections.",
    confidence: "industry-canonical",
    sources: [ROYAL_GREEN_BOOK],
  },

  // ── Sumatra (regional) ───────────────────────────────────────────────────

  {
    name: "Sumatra",
    aliases: ["Sumatra Lintong", "Mandheling", "Sumatra Typica"],
    geneticFamily: "Typica",
    parentage:
      "Indonesian Typica selections (Bergendal, Sidikalang, Tim Tim, Ateng), often blended at the farm level",
    origin: "Sumatra, Indonesia",
    cupSignature:
      "Earthy, herbal, low acidity, full body, often spicy. Cedar, leather, dark chocolate. Distinctive enough that 'Sumatra' is often used as a flavour descriptor.",
    acidity: "low",
    body: "full",
    aromatics: "moderate",
    density: "moderate",
    solubility: "moderate",
    brewingTendencies:
      "The earthy character comes mostly from wet-hulling (Giling Basah) processing, not the variety. Treat as a low-acid, body-forward coffee — Clever, Moccamaster, AeroPress all work.",
    commonProcessings: ["washed", "natural"],
    pairsWellWithRecipes: [
      "hoffmann-clever-ultimate",
      "hoffmann-moccamaster",
      "hoffmann-aeropress-standard",
    ],
    extractionRisks: [
      "High temp (>95°C) amplifies the earthy/cedar notes — for some palates that's the point, for others it's too much",
    ],
    notes:
      "Almost always wet-hulled (Giling Basah) — coffee dried with parchment partially removed. The processing mostly defines the cup; specialty-grade washed Sumatra is much closer to a clean Indonesian Typica.",
    confidence: "industry-canonical",
    sources: [ROYAL_GREEN_BOOK],
  },
];
