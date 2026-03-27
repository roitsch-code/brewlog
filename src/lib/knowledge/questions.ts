import { getAdminDb } from "@/lib/firebase/admin";

const COLLECTION = "knowledge";
const DOC = "starterQuestions";

export const FALLBACK_QUESTIONS: string[] = [
  // Brewing techniques
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

  // Water & extraction
  "What's the ideal water TDS for light roasts?",
  "How do I mix Brita and distilled for championship water?",
  "Why does magnesium matter in brew water?",
  "What happens if I brew with distilled water?",
  "How does water hardness affect sweetness vs bitterness?",

  // Origins & terroir
  "What makes Kenyan AA taste like blackcurrant?",
  "Why do Ethiopian washed coffees taste so floral?",
  "What's special about Panama Geisha?",
  "How does altitude affect coffee flavor?",
  "What defines a Brazil Cerrado natural?",
  "Why is Yemen Mocha so unusual?",
  "What makes Yirgacheffe different from Guji?",
  "Is Sidama the same as Sidamo?",

  // Processing & science
  "Natural vs washed — what actually changes?",
  "What is honey processing and why does it matter?",
  "How does anaerobic fermentation change flavor?",
  "Why does phosphoric acid taste different from citric?",
  "What causes the winey notes in natural coffees?",

  // Roasting
  "What is development time ratio in roasting?",
  "At what temperature does first crack happen?",
  "Why does Tim Wendelboe stop at first crack?",
  "What makes a light roast taste flat if under-extracted?",
  "How does roast date affect CO₂ in the bloom?",

  // Equipment & grinders
  "Why does grind distribution matter more than grind size?",
  "What's the difference between flat and conical burrs?",
  "How do I calibrate my Niche Zero for a new coffee?",
  "Why do fines cause bitterness in the cup?",
  "When should I go finer vs coarser on the Niche?",

  // Championships & experts
  "What brewing method won the 2024 WBC?",
  "Who is Peng Jian and what is his technique?",
  "What did Scott Rao discover about water chemistry?",
  "What is Matt Perger's philosophy on grind distribution?",
  "What makes James Hoffmann's April Coffee stand out?",
  "What is Lance Hedrick known for in filter coffee?",

  // Taste & sensory
  "What does 'clean cup' actually mean?",
  "How do I train my palate for acidity vs sourness?",
  "What flavor notes are typical for washed Ethiopian?",
  "Why does the same coffee taste different on different days?",
  "What causes metallic aftertaste in espresso?",

  // User-specific
  "Best brew method for a Kenya AA washed?",
  "Recommend a recipe for a fruity Ethiopian natural",
  "How should I brew a Costa Rica honey with my V60?",
  "What Niche° setting for a new washed light roast?",
  "Should I use Drip Assist for a delicate Geisha?",
];

export async function getQuestions(): Promise<string[]> {
  try {
    const db = getAdminDb();
    const doc = await db.collection(COLLECTION).doc(DOC).get();
    if (doc.exists) {
      const data = doc.data();
      if (Array.isArray(data?.items) && data.items.length > 0) {
        return data.items as string[];
      }
    }
  } catch (err) {
    console.error("getQuestions error:", err);
  }
  return FALLBACK_QUESTIONS;
}

export async function saveQuestions(questions: string[]): Promise<void> {
  const db = getAdminDb();
  await db.collection(COLLECTION).doc(DOC).set({
    items: questions,
    updatedAt: new Date().toISOString(),
  });
}
