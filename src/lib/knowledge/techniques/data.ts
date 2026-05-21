import type { Technique } from "./types";

/**
 * Atomic brewing techniques. Most recipes are compositions of 3–6 of these.
 *
 * Each entry's `exemplifiedBy` field points to recipe IDs from the recipes
 * module that demonstrate the technique in context — the brain can cite the
 * technique by mechanism and the recipe as a worked example.
 */

export const TECHNIQUES: Technique[] = [
  // ── Temperature ──────────────────────────────────────────────────────────

  {
    id: "staged-temperature",
    name: "Staged Temperature",
    shortName: "Hsu / Peng staging",
    attribution: {
      person: "Sherry Hsu (popularised at WBrC 2022); George Peng (extended in WBrC 2025)",
      year: 2022,
    },
    category: "temperature",
    manipulates: ["aromatic preservation", "extraction phase isolation"],
    description:
      "Pour at two or more distinct temperatures during a single brew. The early pour(s) are cool to preserve volatile aromatics; later pours are hot to drive extraction.",
    mechanism:
      "Volatile aromatic compounds (linalool, geraniol, jasmine lactones, terpenes) volatilise above ~90°C — a standard 95°C bloom drives them into the steam before they reach the cup. Pouring the bloom at 70–80°C keeps these compounds in the liquid phase, where they dissolve into the water as it heats from puck contact. The subsequent hot pours then handle the bulk extraction work for sugars and balancing acids — by then the fragile aromatics are already in solution and protected.",
    whenToUse:
      "Delicate washed coffees where the entire point is aromatic preservation: Geisha, top Ethiopian Yirgacheffe / Guji washed, Pink Bourbon, Wush Wush.",
    contraindications: [
      "Body-forward goals — the technique sacrifices some extraction efficiency",
      "Naturals — fermentation esters benefit from consistent moderate temps, not staging",
      "Dark or medium roasts — there's nothing fragile to protect at the cool end",
    ],
    requiredEquipment: [
      "A kettle that can hold two temperatures, OR a pre-cooled pour vessel for the cool stage",
    ],
    compatibleBrewers: ["v60", "orea-apex", "origami-cone", "solo-dripper"],
    exemplifiedBy: ["wbrc-2022-hsu", "wbrc-2025-peng"],
    sources: [
      {
        type: "official-competition",
        citation: "2022 WBrC Final (Hsu); 2025 WBrC Final (Peng)",
      },
    ],
    verified: true,
  },

  {
    id: "boiling-water-coarse-grind",
    name: "Boiling Water + Coarse Grind (Turbo)",
    shortName: "Turbo brewing",
    attribution: {
      person: "Lance Hedrick (popularised); developed in the championship community",
    },
    category: "temperature",
    manipulates: ["extraction rate", "total brew time"],
    description:
      "Brew with 100°C water and a coarser-than-standard grind. Counter-intuitively produces a clean, well-extracted cup in 2 minutes.",
    mechanism:
      "Boiling water raises extraction rate across all solubility zones — every soluble compound extracts faster. Coarse grind reduces surface area, slowing extraction back down. The two effects partially cancel, but the math works out to high extraction yield in short total contact time. Net result: a 2-minute brew that drinks like a careful 4-minute one. Multiple specialty practitioners have demonstrated repeatable yields above 22% on refractometer.",
    whenToUse:
      "Quick brews on light washed coffees where you want clarity without time. Excellent first cup of the day.",
    contraindications: [
      "Dark or medium-dark roasts — boiling water amplifies dark-roast bitter compounds catastrophically",
      "Naturals — boiling water amplifies fermentation character toward harsh",
    ],
    compatibleBrewers: ["v60", "orea-v4-fast"],
    exemplifiedBy: ["turbo-v60-hedrick"],
    sources: [
      {
        type: "video",
        citation: "Lance Hedrick — multiple Turbo V60 YouTube videos",
      },
    ],
    verified: true,
  },

  {
    id: "low-temp-long-steep",
    name: "Low-Temperature Long Steep",
    shortName: "Gagné second sweet spot",
    attribution: {
      person: "Jonathan Gagné",
      title: "*The Physics of Filter Coffee* (2021); coffeeadastra.com",
    },
    category: "temperature",
    manipulates: ["zone-2 saturation", "zone-3 suppression"],
    description:
      "Brew at low temperature (78–82°C) with a fine grind and a long steep (4–6 minutes). Lands in a unique extraction zone Gagné calls the 'second sweet spot.'",
    mechanism:
      "The bitter, phenolic Zone 3 compounds have steep temperature dependencies — at 80°C they extract orders of magnitude more slowly than at 95°C. So a fine grind (high surface area) at 80°C (low Zone 3 extraction rate) over 5 minutes (full Zone 2 saturation) lands in a uniquely sweet, dense, and clean part of the extraction space. The long steep is doing the work the heat would normally do, but only for the soluble fractions you want.",
    whenToUse:
      "AeroPress with a Prismo or equivalent valve — when you want a body-forward but extremely clean cup. Particularly good on washed coffees where high-temp brews read sharp.",
    contraindications: [
      "Standard AeroPress without valve — the slow steep drips through the paper and ruins the timing",
      "Goals that need bright Zone-1 expression — this technique deliberately suppresses early-stage volatiles",
    ],
    requiredEquipment: ["Fellow Prismo or equivalent valved AeroPress cap"],
    compatibleBrewers: ["aeropress-prismo"],
    exemplifiedBy: ["gagne-long-aeropress"],
    sources: [
      {
        type: "blog",
        citation: "Jonathan Gagné — coffeeadastra.com",
      },
      {
        type: "book",
        citation: "Gagné, J. — *The Physics of Filter Coffee* (2021)",
      },
    ],
    verified: true,
  },

  // ── Agitation ────────────────────────────────────────────────────────────

  {
    id: "rao-spin",
    name: "Rao Spin",
    attribution: {
      person: "Scott Rao",
    },
    category: "agitation",
    manipulates: ["bed saturation", "fines distribution"],
    description:
      "Vigorous swirl of the dripper during bloom — a vortex motion that drags water down through the puck centre rather than wall-first.",
    mechanism:
      "Standard pour-over channels along the filter wall because water seeks the path of least resistance. The Rao spin's vortex motion creates a rotating slurry that drags water toward the centre, counteracting the channeling tendency. It also achieves saturation through bulk-puck motion rather than grain-on-grain agitation, keeping fines distributed evenly rather than concentrated where the spoon went.",
    whenToUse:
      "V60 (and other conical drippers) at bloom. Single move; not repeated.",
    contraindications: [
      "Kalita Wave — the flat bed channels if disturbed, even by a swirl",
      "Chemex — the thick filter collapses against the ribs under a hard swirl",
    ],
    compatibleBrewers: ["v60", "origami-cone", "orea-apex", "orea-classic"],
    exemplifiedBy: ["rao-rule-of-thirds"],
    sources: [
      {
        type: "book",
        citation:
          "Rao, S. — *The Professional Barista's Handbook* (multiple editions)",
      },
    ],
    verified: true,
  },

  {
    id: "swirl-not-stir",
    name: "Swirl Not Stir",
    attribution: {
      person: "James Hoffmann (popularised in modern V60 technique)",
    },
    category: "agitation",
    manipulates: ["bed agitation", "fines migration"],
    description:
      "Use a swirl rather than a spoon stir for bloom and post-pour saturation moves.",
    mechanism:
      "Stirring agitates fines (particles <200µm) into the slurry, where they migrate to the filter walls during drawdown and create flow restrictions. Uneven flow then produces uneven extraction. A swirl achieves saturation through bulk-puck motion rather than grain-on-grain agitation, leaving fines distributed evenly throughout the bed and the drawdown clean.",
    whenToUse:
      "V60 by default. Most pour-overs benefit unless the recipe specifically calls for a stir (Perger high-extraction, Wölfl, Peng).",
    contraindications: [
      "Recipes that specifically want high agitation for higher extraction yield",
      "Kalita Wave — even a swirl is disruptive, only swirl at bloom not later",
    ],
    compatibleBrewers: [
      "v60",
      "origami-cone",
      "orea-apex",
      "orea-classic",
      "orea-open",
    ],
    exemplifiedBy: [
      "hoffmann-v60-better-one-cup",
      "rolf-minimum-variables",
      "rao-rule-of-thirds",
    ],
    sources: [
      {
        type: "video",
        citation:
          "James Hoffmann — 'A Better 1 Cup V60 Technique' and related YouTube",
      },
    ],
    verified: true,
  },

  {
    id: "high-agitation-high-extraction",
    name: "High Agitation, High Extraction",
    attribution: {
      person: "Matt Perger",
      title: "Coffee Compass / Barista Hustle",
    },
    category: "agitation",
    manipulates: ["extraction yield", "soluble-mass transfer"],
    description:
      "Vigorous bloom stir + fine grind + spinning swirl during drawdown — drive extraction yield above 22% by maximising water/grounds contact.",
    mechanism:
      "Extraction yield correlates with cup development up to ~22–23%; below that the cup is sour and thin, above that it turns bitter. Most home brewers under-extract because they fear bitterness — but bitterness comes from over-extracting the wrong compounds, not high yield itself. Vigorous agitation increases turbulence at the grain surface, accelerating the rate-limiting diffusion step; combined with fine grind (more surface area) and a long-ish pour, this drives total yield up while staying in the sweet-and-balanced zone.",
    whenToUse:
      "Competition-grade washed coffees where previous brews have been sour, thin, or flat — symptoms of under-extraction.",
    contraindications: [
      "Naturals — high agitation amplifies fermentation character into vinegar/winey",
      "Delicate aromatic coffees (Geisha, Wush Wush) — the technique sacrifices clarity for yield",
    ],
    compatibleBrewers: ["v60", "orea-classic", "kalita-wave"],
    exemplifiedBy: ["perger-high-extraction-v60"],
    sources: [
      {
        type: "article",
        citation: "Matt Perger — Barista Hustle 'Coffee Compass' articles",
      },
    ],
    verified: true,
  },

  {
    id: "minimal-agitation",
    name: "Minimal Agitation",
    attribution: {
      person: "Patrik Rolf (April Coffee)",
    },
    category: "agitation",
    manipulates: ["technique repeatability", "extraction variance"],
    description:
      "Remove agitation as a variable. Single continuous pour with no stir, minimal swirl. Used to isolate the coffee itself as the only variable across brews.",
    mechanism:
      "Multi-pour V60 recipes introduce dozens of micro-variables: each pour's speed, spiral pattern, intermission length, and stir count affects extraction. By using one continuous pour with no stir, the only inputs are dose, water, temperature, grind, and total time. Run-to-run extraction variance drops; cup comparisons across coffees become reliable.",
    whenToUse:
      "Evaluating an unfamiliar washed light coffee. Side-by-side coffee comparisons. When you want a clean read on the coffee, not your technique.",
    contraindications: [
      "Naturals can read flat under this technique (deliberate under-agitation)",
      "Sweetness-forward goals — the technique trades sweetness development for clarity",
    ],
    compatibleBrewers: ["v60", "orea-apex", "origami-cone"],
    exemplifiedBy: ["rolf-minimum-variables"],
    sources: [
      {
        type: "video",
        citation: "Coffee with April / Patrik Rolf — YouTube channel",
      },
    ],
    verified: true,
  },

  {
    id: "melodrip-controlled-pouring",
    name: "Melodrip-Controlled Pouring",
    shortName: "Melodrip",
    attribution: {
      person: "George Peng (used to win WBrC 2025)",
      year: 2025,
    },
    category: "agitation",
    manipulates: ["pour turbulence", "bed disturbance"],
    description:
      "Pour through a Melodrip (perforated disc held above the brewer) to break the pour into many fine streams. Eliminates pour-induced turbulence at the bed surface.",
    mechanism:
      "A standard pour from a kettle creates a stream that punches into the puck — even a gentle pour disturbs the top layer enough to migrate fines and create channels. The Melodrip's perforated disc breaks the stream into many tiny droplets that hit the bed simultaneously across the whole surface. The bed stays compositionally intact; if you've layered multiple roasts (Peng) or want pristine clarity (delicate Geisha), the technique preserves the structure.",
    whenToUse:
      "Demonstration brewing with layered roasts. Top-shelf delicate coffees where any agitation flattens the cup.",
    contraindications: [
      "Body-forward goals — eliminates the agitation that develops body",
      "Naturals — usually want some agitation to develop sweetness",
      "Standard daily brewing — the setup overhead isn't worth it for everyday cups",
    ],
    requiredEquipment: ["Melodrip (or equivalent perforated diffuser)"],
    compatibleBrewers: [
      "v60",
      "solo-dripper",
      "origami-cone",
      "orea-apex",
    ],
    exemplifiedBy: ["wbrc-2025-peng"],
    sources: [
      {
        type: "official-competition",
        citation: "2025 WBrC Final routine",
      },
    ],
    verified: true,
  },

  {
    id: "water-first",
    name: "Water-First",
    attribution: {
      person:
        "James Bailey (originated, Workshop Coffee); James Hoffmann (popularised)",
    },
    category: "agitation",
    manipulates: ["bloom agitation", "saturation evenness"],
    description:
      "Pour all the water into the empty (sealed) Clever Dripper first; then add the coffee on top. Coffee floats and self-saturates without stirring.",
    mechanism:
      "In standard pour-over, dry grounds resist wetting and require pouring, stirring, or swirling to overcome surface tension — each move introduces fines migration risk. Water-first reverses the relationship: the grounds drop into water and saturate through buoyancy and capillary action, with no mechanical agitation needed. A single swirl submerges any floating grounds; from then on the steep runs undisturbed.",
    whenToUse:
      "Clever Dripper as the default daily-driver method. Excellent for unfamiliar coffees because the technique is so consistent that the cup is a clean read on the coffee.",
    contraindications: [
      "Other brewers — the valve system of the Clever is what makes this work",
    ],
    requiredEquipment: ["Clever Dripper (or equivalent valved immersion brewer)"],
    compatibleBrewers: ["clever"],
    exemplifiedBy: ["hoffmann-clever-ultimate"],
    sources: [
      {
        type: "video",
        citation:
          "James Hoffmann — 'The Ultimate Clever Dripper Technique' (YouTube)",
      },
    ],
    verified: true,
  },

  // ── Pour pattern ─────────────────────────────────────────────────────────

  {
    id: "phase-separated-pouring",
    name: "Phase-Separated Pouring (4:6)",
    shortName: "Kasuya 4:6",
    attribution: {
      person: "Tetsu Kasuya",
      year: 2016,
    },
    category: "pour-pattern",
    manipulates: ["acid/sweet axis", "strength axis"],
    description:
      "Split the total water into a 40% phase and a 60% phase. The first 40% (two pours) controls the acid/sweet balance; the last 60% (3+ pours) controls strength. Each axis dialled independently of the other.",
    mechanism:
      "By holding dose, total water, temperature, and grind constant, only the pour distribution varies. Phase 1 establishes the extraction's brightness ceiling — early-soluble organic acids dominate. Phase 2 then determines how much sweetness and body extracts into the cup; more, smaller pours = more agitation cycles, higher final extraction, stronger cup. The lack of a distinct bloom is deliberate: Kasuya treats the first pour as the bloom.",
    whenToUse:
      "Teaching brews. When you want to dial in a coffee by varying one axis at a time. Daily V60 when you want to experiment systematically.",
    contraindications: [
      "Goals that need a separate, longer bloom (very fresh coffee with heavy CO₂)",
    ],
    compatibleBrewers: ["v60", "orea-classic", "origami-cone"],
    exemplifiedBy: ["wbrc-2016-kasuya", "kasuya-4-6-standard"],
    sources: [
      {
        type: "book",
        citation: "Tetsu Kasuya — published 4:6 method documentation",
      },
    ],
    verified: true,
  },

  {
    id: "rule-of-thirds",
    name: "Rule of Thirds",
    shortName: "1/3 1/3 1/3",
    attribution: {
      person: "Scott Rao",
    },
    category: "pour-pattern",
    manipulates: ["pour evenness", "extraction uniformity"],
    description:
      "Equal-volume pours after the bloom. Each pour adds the same gram count.",
    mechanism:
      "Equal-volume pours produce a more uniform total extraction time per ground-water contact unit than weighted pour distributions. With a known bloom + 3 equal pours + drawdown, the only timing variable is pour-to-pour spacing — every other variable is fixed. Run-to-run variance drops; troubleshooting becomes possible because there are fewer things that could have gone wrong.",
    whenToUse:
      "V60 daily-driver when you want consistency you can troubleshoot from. Default pour pattern unless a recipe specifies otherwise.",
    compatibleBrewers: ["v60", "origami-cone", "orea-classic"],
    exemplifiedBy: ["rao-rule-of-thirds"],
    sources: [
      {
        type: "book",
        citation: "Rao, S. — *The Professional Barista's Handbook*",
      },
    ],
    verified: true,
  },

  // ── Pre-brew / grind ─────────────────────────────────────────────────────

  {
    id: "fines-removal-sieving",
    name: "Fines Removal (Sieving)",
    shortName: "Sieve fines",
    attribution: {
      person: "Mikaela Wallgren (used in WBrC 2016)",
      year: 2016,
    },
    category: "pre-brew",
    manipulates: ["particle size distribution", "extraction uniformity"],
    description:
      "Sieve the grind before brewing to remove the fines fraction (~3–5% of mass, particles <200µm). The remaining coffee extracts more uniformly.",
    mechanism:
      "Fines extract massively faster than the rest of the grind because their surface-area-to-volume ratio is huge. They contribute disproportionately to bitter, phenolic Zone 3 compounds. Sieving them out reduces median extraction yield slightly but tightens the distribution — every remaining particle extracts in the same window. The cup loses some body (fines contribute to mouthfeel) but gains startling clarity.",
    whenToUse:
      "Competition-grade light washed coffees where the goal is maximum clarity. Pairs especially well with the Kalita Wave's flat bed.",
    contraindications: [
      "Naturals — fines contribute body that naturals often need to balance fermentation character",
      "Daily brewing — the time/equipment overhead is non-trivial",
    ],
    requiredEquipment: ["Kruve Two, Kruve Sifter, or equivalent particle-size sieve"],
    compatibleBrewers: ["kalita-wave", "v60", "origami-cone", "orea-apex"],
    exemplifiedBy: ["wallgren-kalita-sieved"],
    sources: [
      {
        type: "interview",
        citation:
          "The Coffee Collective / Mikaela Wallgren published interviews",
      },
    ],
    verified: true,
  },

  {
    id: "three-roast-layering",
    name: "Three-Roast Layering",
    attribution: {
      person: "George Peng (WBrC 2025)",
      year: 2025,
    },
    category: "pre-brew",
    manipulates: ["compositional structure of the cup"],
    description:
      "Layer multiple roast levels of the same green coffee in the brewer. Each roast contributes different compounds; the cup is composed as a sequence rather than blended at the end.",
    mechanism:
      "Light roast contributes the most acidic, aromatic compounds (Zone 1 dominant). Medium-light contributes sugars and balance. Medium contributes body and roundness. By layering them and using staged temperatures with controlled (Melodrip) agitation, three separate extractions happen in place — the layers don't homogenise. The cup's flavour evolves in the brewer rather than being a single average.",
    whenToUse:
      "Demonstration brewing. Not a daily-driver. Requires three different roasts of the same green — impractical at home unless you home-roast.",
    contraindications: [
      "Practical daily brewing",
      "Any goal where simplicity and repeatability matter",
    ],
    compatibleBrewers: ["solo-dripper", "v60", "origami-cone"],
    exemplifiedBy: ["wbrc-2025-peng"],
    sources: [
      {
        type: "official-competition",
        citation: "2025 WBrC Final routine",
      },
    ],
    verified: true,
  },

  {
    id: "roast-tailored-filter",
    name: "Roast-Tailored Filter Paper",
    attribution: {
      person: "Daiki Hatakeyama (Cafec Ambassador)",
    },
    category: "vessel-specific",
    manipulates: ["filter flow rate", "contact time"],
    description:
      "Match filter paper thickness to roast level. Light roast → thin paper (faster flow, more contact-time tolerance). Dark roast → thick paper (slower flow, less contact needed).",
    mechanism:
      "Lighter roasts have lower solubility and need more aggressive extraction (more contact, higher temperature). Darker roasts have higher solubility and over-extract easily (less contact, lower temperature). The Cafec Flower Dripper's six tall ribs make drawdown fast regardless of paper, so paper thickness becomes the timing variable: a thicker Dark Roast paper slows flow precisely where the darker coffee needs less contact. Hatakeyama systematises what most brewers do haphazardly.",
    whenToUse:
      "When you have multiple paper thicknesses (Cafec ecosystem most easily) and brew across roast levels. The principle generalises: a Sibarist Fast filter on a V60 has a similar effect for light roasts; a stock V60 paper for medium.",
    contraindications: [
      "Single-paper setups — without thickness variation, the technique can't be applied",
    ],
    requiredEquipment: [
      "Multiple Cafec papers (Light Roast / Medium Roast / Dark Roast / Abaca) OR equivalent flow-rate-varied papers from another brand",
    ],
    compatibleBrewers: ["cafec-flower", "v60"],
    exemplifiedBy: ["hatakeyama-cafec-flower"],
    sources: [
      {
        type: "interview",
        citation:
          "Cafec / Sanyo Sangyo published Hatakeyama brewing demonstrations",
      },
    ],
    verified: false,
    notes:
      "Principle is canonical Hatakeyama; specific paper-thickness recommendations come from Cafec demonstration materials.",
  },

  // ── Post-brew ────────────────────────────────────────────────────────────

  {
    id: "concentrate-and-bypass",
    name: "Concentrate and Bypass",
    attribution: {
      person: "James Hoffmann; George Stanica (WAC 2024)",
    },
    category: "post-brew",
    manipulates: ["extraction strength", "drink concentration"],
    description:
      "Brew a concentrated extraction (1:6 to 1:11), then dilute the cup with cool bypass water to drinking strength. Separates extraction from final concentration.",
    mechanism:
      "At a tight ratio (1:6–1:11), the brew extracts deeply into Zone 2 — sugars and maillard compounds — without the diluted, watery cup that a 1:16 brew would produce. The bypass water is added after the press, so it doesn't extract anything; it only adjusts cup weight. Cup flavour profile and cup strength become independent controls. Often pairs with the inverted AeroPress orientation.",
    whenToUse:
      "AeroPress brews where you want filter-style clarity at a strength that standard 1:16 recipes can't reach. Excellent on competition-grade light roasts that feel under-extracted at conventional ratios.",
    contraindications: [
      "Goals where dilution-after-extraction reads diluted (some tasters can detect bypass water)",
    ],
    compatibleBrewers: ["aeropress", "aeropress-prismo"],
    exemplifiedBy: ["wac-2024-stanica"],
    sources: [
      {
        type: "official-competition",
        citation: "2024 WAC Final (Stanica)",
      },
    ],
    verified: true,
  },

  {
    id: "flash-chilling",
    name: "Flash Chilling",
    attribution: {
      person: "Japanese iced-coffee tradition; popularised in specialty by James Hoffmann",
    },
    category: "post-brew",
    manipulates: ["aromatic preservation in iced coffee"],
    description:
      "Brew hot, drain or pour directly onto ice. The hot concentrate drops below 5°C in seconds, locking aromatics into the liquid before they volatilise.",
    mechanism:
      "Cold brew extracts over 8–18 hours at room temperature; the long timeline lets fine bitter compounds reach equilibrium, but volatile aromatic compounds dissipate. A flash-chilled iced coffee extracts hot — full Zone 1 aromatics — and then drops below 5°C in seconds when the concentrate hits ice. The aromatics are locked into the liquid before they can volatilise. Total drink water = brew water + ice melt; brew at 1:10–1:12 to land at effective 1:15–1:16 after ice dilution.",
    whenToUse:
      "Summer iced coffee. When you want bright aromatic expression in an iced cup, not the rounded, flat profile of cold brew.",
    contraindications: [
      "Cold-brew aesthetics — flash-chilled is brighter and less rounded than cold brew",
    ],
    compatibleBrewers: ["v60", "kalita-wave", "clever", "aeropress", "chemex"],
    exemplifiedBy: ["hoffmann-immersion-iced-clever"],
    sources: [
      {
        type: "video",
        citation:
          "James Hoffmann — 'My Favorite Iced Coffee Recipe' (YouTube)",
      },
    ],
    verified: true,
  },

  // ── Vessel-specific ─────────────────────────────────────────────────────

  {
    id: "aeropress-inversion",
    name: "Inverted AeroPress",
    attribution: {
      person: "AeroPress competition community (popularised c. 2010)",
    },
    category: "vessel-specific",
    manipulates: ["steep duration", "drip prevention"],
    description:
      "Flip the AeroPress upside-down before brewing. The plunger is below, the cap is on top. Coffee can steep without dripping until you flip back and press.",
    mechanism:
      "A standard upright AeroPress drips through the paper filter during steep — the drip rate is non-zero even before pressing. For short steeps that's negligible; for longer steeps (60s+) the drip changes the in-brewer ratio mid-extraction. Inverting holds all the water until you cap, flip, and press, giving exact control of total contact time.",
    whenToUse:
      "Any AeroPress recipe with a steep longer than 60 seconds. Most championship AeroPress routines use inversion.",
    contraindications: [
      "Quick AeroPress recipes (<45s steep) — inversion adds steps without changing the cup meaningfully",
      "First-time users — there's a real risk of spilling water during the flip",
    ],
    compatibleBrewers: ["aeropress"],
    exemplifiedBy: [
      "hoffmann-aeropress-standard",
      "wac-2024-stanica",
      "gagne-long-aeropress",
    ],
    sources: [
      {
        type: "article",
        citation:
          "AeroPress Championship community / coffee press write-ups",
      },
    ],
    verified: true,
  },

  // ── Water ────────────────────────────────────────────────────────────────

  {
    id: "low-mineral-water",
    name: "Low-Mineral Water",
    shortName: "Championship water",
    attribution: {
      person:
        "Christopher Hendon (water chemistry foundation); George Peng / Jia Ning Du (championship application)",
    },
    category: "water",
    manipulates: ["aromatic clarity", "acid expression"],
    description:
      "Brew with water in the 40–80 ppm TDS range — well below SCA's 75–250 ppm window. Aromatic and acid expression sharpens dramatically.",
    mechanism:
      "Bicarbonate (HCO₃⁻) buffers acidity — at 300 ppm tap water, it actively mutes brightness. Magnesium (Mg²⁺) enhances extraction of organic acids and aromatics; calcium (Ca²⁺) adds body. Championship water targets very low bicarbonate (no buffering) with magnesium-biased mineral content (aromatic enhancement). Result: delicate florals become prominent; the coffee's acid profile reads sharper. Du's WBrC 2019 water at 4 ppm Ca / 15 ppm Mg / 80 ppm TDS is a textbook example.",
    whenToUse:
      "Top-shelf delicate coffees: Geisha, top Ethiopian, Pink Bourbon, Wush Wush. Particularly worthwhile when paying €20+ per 100g — water buffering is the single biggest preventable thing flattening the cup.",
    contraindications: [
      "Body-forward goals on heavier coffees — low minerals reduce body",
      "Espresso and dark roast — championship water on dark roasts can read thin and sharp",
    ],
    requiredEquipment: [
      "Distilled water + mineral salts (Lotus, Aquacode, Third Wave Water packets) OR a 1:1+ tap-distilled blend that lands ~150 ppm minimum",
    ],
    compatibleBrewers: ["v60", "orea-apex", "origami-cone", "kalita-wave"],
    exemplifiedBy: ["wbrc-2019-du", "wbrc-2025-peng"],
    sources: [
      {
        type: "book",
        citation:
          "Hendon, C. & Colonna-Dashwood, M. — *Water for Coffee* (2015; 2nd ed. forthcoming)",
      },
    ],
    verified: true,
  },
];
