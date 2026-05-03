import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { knowledge } from "@/lib/db/schema";

const KIND = "starterQuestions";

export const FALLBACK_QUESTIONS: string[] = [
  // Brewing techniques — V60 & pour-over
  "What makes the 4:6 method so effective?",
  "Explain Kasuya's 4:6 pour logic",
  "How does the Peng 2025 temperature-staging work?",
  "When should I use the Orea Fast vs Orea Classic?",
  "What's the ideal bloom ratio and why?",
  "How does the Clever Dripper differ from a V60?",
  "Inverted vs standard AeroPress — what's the real difference?",
  "What grind setting should I try for a sour V60?",
  "Why does my pour-over taste bitter near the end?",
  "How do I adjust if my drawdown is too fast?",
  "What is the Hoffmann V60 technique and why does it work?",
  "How does a single continuous pour compare to pulse pouring?",
  "What does the Drip Assist actually do differently from hand pouring?",
  "Should I stir during the bloom or let it sit?",
  "What does 'flat bed at the end' mean and does it matter?",
  "Why does my V60 channeling happen at the edges?",
  "How does Orea V4 + Pulsar change the extraction compared to V60?",
  "What's the logic behind a 3-pour vs 5-pour recipe?",
  "How do I fix uneven saturation in a V60 bloom?",
  "What ratio does Hoffmann use for his V60 recipe?",

  // AeroPress
  "What's the best AeroPress recipe for a floral Ethiopian?",
  "Why does AeroPress produce less acidity than V60?",
  "What pressure does AeroPress actually apply?",
  "Can I use AeroPress to make espresso-style concentrate?",
  "What filters work best in AeroPress — paper, metal, or cloth?",
  "How long should I steep in AeroPress for a washed light roast?",
  "What's the AWAC-winning recipe approach for 2024?",
  "How fine should I grind for AeroPress pressure resistance?",

  // Clever Dripper & immersion
  "What's the James Hoffmann Clever Dripper method?",
  "How does immersion extraction differ from percolation scientifically?",
  "Does steep time or grind size matter more in immersion brewing?",
  "What's the ideal steep time for a Clever Dripper with light roast?",

  // Moccamaster & batch
  "How do I dial in my Moccamaster for a specific coffee?",
  "What grind size should I use for Moccamaster?",
  "Can Moccamaster brew specialty-grade coffee well?",
  "How does batch brew differ from pour-over in extraction dynamics?",

  // Water & extraction science
  "What's the ideal water TDS for light roasts?",
  "How do I mix Brita and distilled for championship water?",
  "Why does magnesium matter in brew water?",
  "What happens if I brew with distilled water?",
  "How does water hardness affect sweetness vs bitterness?",
  "What is bicarbonate and how does it affect acidity in the cup?",
  "How much does water chemistry actually change the cup?",
  "What is the Third Wave Water recipe targeting?",
  "How does sodium in brew water affect sweetness perception?",
  "What pH should my brew water be?",
  "Why does my tap water produce flat, dull coffee?",
  "What is RO water and why does it need remineralizing for coffee?",
  "How does altitude affect brew temperature and extraction?",
  "What is titratable acidity and how does it differ from pH?",
  "How does chloramine in tap water affect coffee differently from chlorine?",

  // Grind & grinders
  "Why does grind distribution matter more than grind size?",
  "What's the difference between flat and conical burrs?",
  "How do I calibrate my Niche Zero for a new coffee?",
  "Why do fines cause bitterness in the cup?",
  "When should I go finer vs coarser on the Niche?",
  "What is WDT and should I use it for pour-over?",
  "How does grind retention affect the cup?",
  "What does bimodal grind distribution mean for extraction?",
  "Why does grinding from frozen beans improve consistency?",
  "How often should I clean my Niche burrs?",
  "What's the difference between the Niche Zero and a flat-burr grinder for filter?",
  "How does the Comandante Red Clix upgrade improve dialing in?",
  "What causes clumping in freshly roasted beans when grinding?",
  "How do I know if my grinder is aligned?",
  "What's the best grind size for a 20g dose in V60?",

  // Extraction yield & TDS
  "What extraction yield % should I target for V60?",
  "How do I use a refractometer to measure TDS?",
  "What does 'bypassing' mean in filter coffee?",
  "How does EY% differ from TDS as a measure of extraction?",
  "Why does Lance Hedrick push extraction yield so high?",
  "What is the SCA extraction and strength matrix?",
  "Can I over-extract a V60 without it tasting bitter?",

  // Origins & terroir
  "What makes Kenyan AA taste like blackcurrant?",
  "Why do Ethiopian washed coffees taste so floral?",
  "What's special about Panama Geisha?",
  "How does altitude affect coffee flavor?",
  "What defines a Brazil Cerrado natural?",
  "Why is Yemen Mocha so unusual?",
  "What makes Yirgacheffe different from Guji?",
  "Is Sidama the same as Sidamo?",
  "What makes Colombian Pink Bourbon special?",
  "Why are Kenyan coffees processed differently from Ethiopian?",
  "What is the 'Bajareque' mist in Panama Boquete?",
  "How does Sumatra wet-hulled processing change the flavor profile?",
  "What's the difference between Burundi and Rwanda coffees?",
  "What makes Costa Rican honey coffees so approachable?",
  "Why is Gesha so disproportionately expensive?",
  "What is 'terroir' in coffee — what factors does it include?",
  "What's special about Peruvian Cajamarca coffees?",
  "How do Indian monsooned coffees get their unique flavor?",
  "What makes Flores (Indonesia) different from Sumatra?",
  "Why are Bolivia's coffees so rare despite high altitude?",

  // Processing & fermentation
  "Natural vs washed — what actually changes?",
  "What is honey processing and why does it matter?",
  "How does anaerobic fermentation change flavor?",
  "Why does phosphoric acid taste different from citric?",
  "What causes the winey notes in natural coffees?",
  "What is carbonic maceration and who popularized it?",
  "What's the difference between Yellow, Red, and Black Honey?",
  "How does double fermentation work in Kenyan-style processing?",
  "What is lacto-fermentation in coffee?",
  "What is 'turbo washed' processing?",
  "How long can washed coffee ferment before it becomes a defect?",
  "What does 'extended fermentation' mean and is it always good?",
  "Why do raised drying beds matter compared to ground drying?",
  "What is Giling Basah and why does it create earthy flavors?",
  "How does Ninety Plus use controlled fermentation to create distinct lots?",

  // Roasting
  "What is development time ratio in roasting?",
  "At what temperature does first crack happen?",
  "Why does Tim Wendelboe stop at first crack?",
  "What makes a light roast taste flat if under-extracted?",
  "How does roast date affect CO₂ in the bloom?",
  "What is Rate of Rise (RoR) and why does it matter?",
  "What are Maillard reactions and when do they happen in a roast?",
  "Why do Nordic roasters use such short development times?",
  "What is a 'baked' coffee and what causes it?",
  "How do charge temperature and drum speed affect a roast?",
  "What does 'crashing RoR' mean and why is it bad?",
  "What is Strecker degradation and what aromas does it produce?",
  "Why does dark roast mask origin character?",
  "How does degassing time vary between roast levels?",
  "What's the peak flavor window for a light roast after roasting?",

  // Variety science
  "What is SL28 and why does it taste like blackcurrant?",
  "What makes Gesha variety produce such different flavors?",
  "What is Pink Bourbon and where does it come from?",
  "What are Ethiopian Heirloom varieties?",
  "What is Pacamara and what does it taste like?",
  "Why is Laurina coffee naturally low in caffeine?",
  "What is the difference between Bourbon and Typica?",
  "What is a Timor hybrid and how does it affect breeding?",
  "What is Sidra variety and what makes it unusual?",
  "What is Wush Wush coffee and why is it rare?",
  "Why do F1 hybrid coffees matter for the future of the crop?",
  "What is C. eugenioides and can you drink it?",
  "How does peaberry form and does it really taste different?",
  "What is Caturra and why is it so widely planted?",
  "Why does variety matter as much as processing for flavor?",

  // Championships & experts
  "What brewing method won the 2024 WBC?",
  "Who is Peng Jian and what is his technique?",
  "What did Scott Rao discover about water chemistry?",
  "What is Matt Perger's philosophy on grind distribution?",
  "What makes James Hoffmann's April Coffee stand out?",
  "What is Lance Hedrick known for in filter coffee?",
  "What did Erna Knutsen mean when she coined 'specialty coffee'?",
  "What was Sasa Sestic's 2015 WBC signature drink?",
  "What was Hugh Kelly's 2023 WBC approach?",
  "What does the World Brewers Cup judge specifically?",
  "What was Tetsu Kasuya's winning 2016 WBrC approach?",
  "Who is Charles Babinski and what is the 'lentil pour'?",
  "What was Klaus Thomsen's 2006 WBC signature drink?",
  "What does a WBC signature drink need to achieve?",

  // Taste & sensory
  "What does 'clean cup' actually mean?",
  "How do I train my palate for acidity vs sourness?",
  "What flavor notes are typical for washed Ethiopian?",
  "Why does the same coffee taste different on different days?",
  "What causes metallic aftertaste in espresso?",
  "What is phosphoric acid in coffee and how does it taste?",
  "What is malic acid and what coffees express it?",
  "How does retronasal olfaction work when drinking coffee?",
  "What causes astringency in over-extracted coffee?",
  "What does 'body' mean vs 'mouthfeel'?",
  "Why does a metal filter produce more body than paper?",
  "What makes a long aftertaste a quality indicator?",
  "How does the SCA cupping form score 10 attributes?",
  "What is a Cup of Excellence and what score qualifies?",
  "Why does blind cupping remove bias in scoring?",
  "How does Maillard reaction affect flavor vs caramelization?",
  "What are pyrazines in coffee and what do they smell like?",
  "Why does lactic fermentation create 'creamy' texture notes?",

  // Roasters & sourcing
  "What makes April Coffee different from other Nordic roasters?",
  "Why does Tim Wendelboe's roasting philosophy stand out?",
  "What is 'direct trade' and how does it benefit farmers?",
  "How does Onyx Coffee Lab approach recipe development?",
  "What is Ninety Plus Coffee known for?",
  "What is a Cup of Excellence auction and how does it work?",
  "What makes Hacienda La Esmeralda historically important?",
  "What is 'fourth wave' coffee focused on?",
  "How does traceability from farm to roaster actually work?",
  "What does 'micro-lot' coffee mean?",

  // Science & chemistry
  "What is caffeine and why do coffee plants produce it?",
  "How many aroma compounds does coffee contain?",
  "What are chlorogenic acids and do they cause bitterness?",
  "What is trigonelline and what does it become during roasting?",
  "Does cold brew really have less acidity than hot brew?",
  "Why does CO₂ affect bloom activity in fresh beans?",
  "How does bean density relate to altitude?",
  "What is acrylamide in coffee and is it a concern?",
  "Why does a paper filter remove oils but not caffeine?",

  // Practical & user-specific
  "Best brew method for a Kenya AA washed?",
  "Recommend a recipe for a fruity Ethiopian natural",
  "How should I brew a Costa Rica honey with my V60?",
  "What Niche° setting for a new washed light roast?",
  "Should I use Drip Assist for a delicate Geisha?",
  "What's the best way to store beans I open today?",
  "How do I adjust my recipe for a very fresh (3-day) roast?",
  "What's the best V60 recipe for a high-altitude Colombian?",
  "How should I approach a dense Ethiopia Guji natural?",
  "When should I use the Clever Dripper instead of V60?",
  "What's a good starting recipe for a new Orea V4 coffee?",
  "How do I get more sweetness out of my washed Ethiopian?",
  "What should I try to make a natural Ethiopia less boozy?",
  "How do I preserve the floral notes in a Gesha?",
  "Is it worth adjusting water for a Kenya AA vs a Brazil?",
];

export async function getQuestions(): Promise<string[]> {
  try {
    const rows = await db.select().from(knowledge).where(eq(knowledge.kind, KIND)).limit(1);
    const data = rows[0]?.data as { items?: string[] } | undefined;
    if (data && Array.isArray(data.items) && data.items.length > 0) {
      return data.items;
    }
  } catch (err) {
    console.error("getQuestions error:", err);
  }
  return FALLBACK_QUESTIONS;
}

export async function saveQuestions(questions: string[]): Promise<void> {
  const data = { items: questions, updatedAt: new Date().toISOString() };
  await db
    .insert(knowledge)
    .values({ kind: KIND, data })
    .onConflictDoUpdate({ target: knowledge.kind, set: { data } });
}
