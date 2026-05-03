import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { knowledge } from "@/lib/db/schema";

const KIND = "hints";

export const FALLBACK_HINTS: string[] = [
  // Origins & terroir
  "Ethiopia is considered the birthplace of coffee — wild coffee plants still grow in the Kaffa forest.",
  "Yirgacheffe's altitude of 1,700–2,200 m creates the slow cherry ripening that builds its famous floral notes.",
  "Kenyan AA grade refers to bean screen size (18+), not quality — but high altitude tends to correlate with both.",
  "Gesha variety was discovered in the Gesha forest of Ethiopia and brought to Panama, where it became legendary.",
  "Brazil is the world's largest coffee producer, but its flat terrain means most coffee is dried naturally.",
  "Colombia's geography — two Andes ranges — creates micro-climates that allow harvesting nearly year-round.",
  "Sumatra's 'wet-hulled' Giling Basah process creates the distinctive earthy, low-acid profile of Mandheling coffees.",
  "Rwanda's volcanic Lake Kivu soils produce coffees with a distinctive winey complexity.",
  "Burundi and Rwanda share nearly identical altitude and terroir — tiny regional variations define their character.",
  "Yemen's ancient mocha port gave espresso its first name — 'mocha' referred to the coffee, not the drink.",
  "Costa Rican 'honey' processing was pioneered partly because water for washed processing is scarce in dry season.",
  "Panama's Boquete region benefits from cold 'Bajareque' mist that slows ripening, concentrating sugars.",
  "Guatemala's Antigua coffees come from volcanic soil enriched by three nearby volcanoes.",

  // Processing
  "Natural (dry) processing: the whole cherry is dried on raised beds for 3–6 weeks before milling.",
  "Washed (wet) processing removes the fruit before drying — this highlights terroir and variety clarity.",
  "Honey processing is a hybrid: some mucilage remains on the bean. Yellow < Red < Black = more sweetness.",
  "Anaerobic fermentation happens in sealed tanks — CO₂ builds pressure, altering flavor dramatically.",
  "Extended fermentation is the driver behind 'winy' flavor notes — not the cherry itself.",
  "Thermal shock drying (rapid temp change) can stress the bean and reduce shelf life.",
  "Raised drying beds allow airflow under the coffee — ground drying raises contamination risk.",
  "Sorting after drying is critical: one fermented bean in a sack can taint an entire lot.",
  "The longer a coffee dries, the more sugars caramelize into the bean — up to a point.",

  // Roasting
  "First crack is when water vapor and CO₂ escape the bean — the sound resembles popcorn.",
  "Second crack breaks down the bean's cell structure — most specialty roasters stop well before this.",
  "Light roast preserves the most origin character but demands precision brewing — low room for error.",
  "Roast date matters more than most brewing variables. Peak flavor window: 5–21 days post-roast for most methods.",
  "Degassing: freshly roasted coffee releases CO₂ for days. This is why immediate brewing often tastes flat.",
  "Development time ratio (DTR) — time after first crack as % of total roast — shapes sweetness vs. acidity.",
  "Dark roast hides origin character under roast flavor. The coffee's source matters much less.",
  "Nordic-style light roasts often taste 'sour' to those expecting darker profiles — it's extraction, not defect.",

  // Water chemistry
  "Magnesium ions extract flavor compounds more efficiently than calcium — the key mineral for taste.",
  "Total Dissolved Solids (TDS) of 75–150 ppm is the SCA-recommended range for brewing water.",
  "Chlorine in tap water kills subtle aromatics. Even a small amount degrades specialty coffee.",
  "Distilled water produces flat, lifeless coffee — it needs some minerals to conduct extraction properly.",
  "Bicarbonate (KH) acts as a buffer, neutralizing acids — too much makes coffee taste flat and dull.",
  "Hard water forms limescale in kettles. A Brita + remineralizing approach preserves both equipment and taste.",
  "Championship water often targets 44–55 ppm — low enough for clarity, high enough for extraction.",
  "The SCA 'ideal' water recipe: 75–150 ppm TDS, magnesium ~10 ppm, bicarbonate ~40 ppm.",

  // Extraction science
  "Coffee is about 30% soluble — only 20–22% should end up in your cup for balanced extraction.",
  "Under-extracted coffee tastes sour and thin. Over-extracted tastes bitter and drying.",
  "The bloom (pre-infusion) allows CO₂ to escape, preventing uneven extraction channels.",
  "Grind size affects surface area: finer = more surface = faster extraction = risk of over-extraction.",
  "Water temperature affects extraction speed — lower temps can highlight acidity, higher temps extract more.",
  "Pour speed creates agitation — faster pours stir the bed, boosting extraction but risking channeling.",
  "Channeling occurs when water finds a path of least resistance through the coffee bed — rinse and reset.",
  "Turbulence during bloom helps saturate all grounds evenly — a gentle stir at 10 seconds is proven.",
  "Total brew yield weight (not just recipe volume) determines your actual TDS.",
  "A lower brew ratio (1:12) makes a stronger but not necessarily better cup — balance matters more.",

  // Equipment
  "The V60's large opening and angled ribs encourage fast, even drawdown — it rewards technique.",
  "Hario's 'Drip Assist' divides the pour into 8 slow streams — it mimics machine consistency.",
  "The Orea V4's modular base system changes flow rate dramatically — Apex bottom is the most restrictive.",
  "AeroPress uses pressure + immersion — it's the most forgiving brewer for imperfect grind or water.",
  "AeroPress inverted method eliminates dripping during steep — same result, more control.",
  "The Clever Dripper combines immersion steep with a V60-style filter — James Hoffmann's method is definitive.",
  "Kalita Wave's flat bed and three holes promote even extraction — it's more forgiving than V60.",
  "Moccamaster's gold standard: fixed 92–96°C water, 6-minute brew cycle, SCAA certified.",
  "The Niche Zero is a zero-retention conical grinder — what you grind in comes out, instantly.",
  "Comandante C40 uses high-nitrogen hardened steel burrs — remarkably consistent for a hand grinder.",
  "Fellow Stagg EKG Pro's PID holds temperature within ±0.5°C — critical for washed high-acidity coffees.",
  "Scale precision matters: 0.1g resolution is important for espresso; 1g is fine for pour-over.",

  // Brew methods deep-dives
  "Tetsu Kasuya's 4:6 Method separates flavor from strength — the first 40% controls acidity/sweetness.",
  "The 4:6 Method's genius: you can adjust two variables independently without changing dose or ratio.",
  "Peng Jiajun's 2025 WBC recipe uses temperature staging — 96°C bloom, then 80°C final pour.",
  "Temperature staging reduces late-extraction bitterness while preserving early bloom aromatics.",
  "James Hoffmann's V60 technique: one continuous pour after bloom — simplicity enables consistency.",
  "Tim Wendelboe's method uses a relatively coarse grind and high temp — maximizing clarity and brightness.",
  "The 'rao allonge' is a high-ratio (1:8+) espresso variant used as a base for pour-over-like clarity.",
  "Cold brew uses time instead of heat — extraction happens over 12–24 hours at room temperature.",
  "Flash-chilled iced coffee (hot brew over ice) preserves acidity and aromatics better than cold brew.",

  // Sensory & tasting
  "The Specialty Coffee Association flavor wheel has 110 flavor descriptors across 9 categories.",
  "Retronasal olfaction (aromatics reaching your nose while drinking) drives 80%+ of flavor perception.",
  "Brightness and acidity are often the same thing — perceived differently depending on context and culture.",
  "Body is determined by the oils and fine particles remaining in the cup — metal filters allow more through.",
  "Sweetness in coffee isn't added sugar — it's sucrose and other compounds surviving the roast.",
  "A 'clean cup' in SCA terms means no flavor defects — it's a quality baseline, not a style preference.",
  "Bitterness isn't inherently bad — caffeine and chlorogenic acids in balance add depth and length.",
  "'Finish' or 'aftertaste' duration indicates coffee quality — longer pleasant finish = better extraction.",
  "Cupping protocol uses 93°C water, 8.25g per 150ml, 4-minute steep — standardized for fair comparison.",
  "A cupping score of 80+ qualifies as 'specialty grade' by SCA standards.",

  // History & culture
  "Coffee was first consumed as a food in Ethiopia — the beans were mixed with animal fat for energy.",
  "The first European coffeehouse opened in Oxford in 1650. They were called 'penny universities'.",
  "The French press was patented in 1929 by Milanese designer Attilio Calimani.",
  "Espresso machines use pressure, not high heat — the goal is 9 bar, not boiling water.",
  "The Vienna Philharmonic gift shop reportedly inspired James Hoffmann to enter the coffee world.",
  "World Barista Championship was first held in Monte Carlo in 2000. The format: 4 espresso, 4 milk, 4 signature.",
  "Blue Bottle Coffee (founded 2002) pioneered the third-wave model of transparent sourcing in the US.",
  "Specialty coffee's 'third wave' began as a consumer movement caring about origin, process, and roaster craft.",
  "Stumptown, Intelligentsia, and Counter Culture were instrumental in bringing direct-trade sourcing to scale.",
  "The coffee cherry is actually a fruit — each cherry typically contains two beans (seeds) facing each other.",

  // Practical tips
  "Freezing whole beans in an airtight bag and grinding from frozen is a proven way to extend peak freshness.",
  "Coffee goes stale from oxygen, moisture, light, and heat — in that order of impact.",
  "Storing coffee in its original bag (with one-way valve) in a cool, dark cupboard works well for 2–3 weeks.",
  "A one-way valve lets CO₂ out but keeps oxygen from entering — essential for fresh-roast packaging.",
  "Pre-wetting your paper filter removes papery taste and preheats your brewer.",
  "Weighing water instead of measuring by volume accounts for density and temperature variance.",
  "Your kettle cools roughly 1°C every 30 seconds in open air — track this for multi-pour recipes.",
  "The Niche Zero's grind retention of <0.1g means virtually no old grounds mixed into your dose.",
  "Lightly tapping the portafilter or brewer mid-pour can help reset a channeling bed.",
  "If your V60 drains too fast, check grind size first — then look at bloom technique and pour rate.",
];

export async function getHints(): Promise<string[]> {
  try {
    const rows = await db.select().from(knowledge).where(eq(knowledge.kind, KIND)).limit(1);
    const data = rows[0]?.data as { hints?: string[] } | undefined;
    if (data && Array.isArray(data.hints) && data.hints.length > 0) {
      return data.hints;
    }
  } catch (err) {
    console.error("getHints: db error:", err);
  }
  return FALLBACK_HINTS;
}

export async function saveHints(hints: string[]): Promise<void> {
  const data = { hints, updatedAt: new Date().toISOString() };
  await db
    .insert(knowledge)
    .values({ kind: KIND, data })
    .onConflictDoUpdate({ target: knowledge.kind, set: { data } });
}
