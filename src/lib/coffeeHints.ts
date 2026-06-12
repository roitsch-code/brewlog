// Coffee insights — shown big (Fraunces 40, like the welcome haiku) while Claude
// generates your brew recipe. Deliberately SHORT so the headline-sized format
// always fits: each is one punchy, accurate line. BTTS voice — a knowledgeable
// friend, editorial, no hype, no exclamation marks. Refreshed June 2026.
//
// Accuracy rule: these are general, well-established coffee facts. Do NOT add
// fabricated specifics (championship winners/years, exact ppm/degrees attributed
// to a person) — keep claims safe and verifiable. See CLAUDE.md "never fabricate".

export const COFFEE_HINTS: string[] = [
  // Origins
  "Coffee is a fruit — the bean is its seed.",
  "Ethiopia is where coffee began, and it still grows wild there.",
  "Almost everything you drink as specialty coffee is Arabica.",
  "Robusta carries more caffeine, and more bitterness, than Arabica.",
  "The higher coffee grows, the slower it ripens — and the sweeter it gets.",
  "Geisha started in an Ethiopian forest and made its name in Panama.",
  "Brazil grows more coffee than anywhere else on earth.",
  "A coffee cherry usually holds two seeds, flat sides together.",
  "A peaberry is the lone round seed of a cherry that grew just one.",
  "Mocha is named after Yemen's old coffee port, not the chocolate.",
  "Coffees from one farm taste different washed versus natural.",

  // Processing
  "Washed coffees drink clean and clear — the fruit comes off before drying.",
  "Naturals dry inside the whole cherry, so they taste fruitier and heavier.",
  "Honey process leaves some fruit on the bean: more body, more sweetness.",
  "How a coffee is processed can shape the cup more than where it grew.",

  // Roast & freshness
  "Light roasts keep the origin's character; dark roasts taste of the roast.",
  "Beans give off CO2 for days after roasting — that's what makes them bloom.",
  "Coffee isn't best the day it's roasted; most peak a week or two later.",
  "Rest a fresh bag a few days before chasing its best cup.",
  "Old beans barely bloom; a big, lively rise means they're fresh.",
  "Oxygen, light, heat and moisture stale coffee — keep all four out.",
  "Sealed in the freezer, whole beans stay fresh far longer.",
  "Grind right before you brew — coffee stales fastest once it's ground.",

  // Water
  "A cup of coffee is about 98% water, so the water matters.",
  "Hard, chalky water mutes flavour — filter it.",
  "Magnesium in your water pulls out sweetness and fruit.",
  "Distilled water alone extracts poorly; coffee needs some minerals.",
  "The cleaner the water, the more of the coffee you actually taste.",

  // Grind & extraction
  "Grind finer to extract more, coarser to extract less.",
  "Sour and thin means under-extracted — grind finer.",
  "Harsh and bitter means over-extracted — grind coarser.",
  "Fix a brew's timing with the grind, never the temperature.",
  "An even grind matters more than the exact number on the dial.",
  "The same beans can taste sour or bitter — grind is often the only difference.",

  // Brewing
  "Bloom first: wet the grounds, wait, and let the gas escape.",
  "Swirl the slurry instead of stirring — it levels the bed without churning fines.",
  "More pours build body; fewer pours keep the cup clean.",
  "Keep the bed flat and level and the water runs through evenly.",
  "Immersion brewing is forgiving — every ground steeps for the same time.",
  "Pour count is a flavour dial, not a rule — two pours or ten.",
  "Brew water is usually best just off the boil, around 90–96°C.",
  "Around 60 grams of coffee per litre of water is a safe place to start.",

  // Sensory
  "Most of what you call taste is actually smell.",
  "Slurp — spraying coffee across your palate is how pros taste it.",
  "Acidity in coffee is brightness, not a fault.",
  "New flavours appear as the cup cools, so don't drink it scalding.",
  "Body is how a coffee feels in the mouth, not how it tastes.",
  "Tasting notes point to what's already there — nothing was added.",

  // Kit
  "A gooseneck kettle exists for one thing: control over the pour.",
  "A better grinder improves your cup more than a new dripper will.",
  "Brew by weight, not by scoops — a scale is the cheapest upgrade.",
  "Burr grinders crush evenly; blade grinders just chop.",

  // Good to know
  "Espresso is a brewing method, not a kind of bean.",
  "Decaf still holds a trace of caffeine — most, not all, is removed.",
  "Cold brew is low in acid because it never gets hot.",
  "A drip bag is a real brew — a tiny pour-over in a sachet.",

  // The BTTS way
  "There's no single right recipe — only the one that tastes right to you.",
  "Chasing perfect every time is the fast way to enjoy coffee less.",
  "Write down what you changed — that's how a good brew becomes repeatable.",
];

/** Returns a shuffled subset of insights for a single loading session. */
export function getLoadingHints(count = 6): string[] {
  const shuffled = [...COFFEE_HINTS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
