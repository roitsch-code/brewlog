import { NextRequest, NextResponse } from "next/server";
import { getInsights, saveInsights } from "@/lib/knowledge/insights";
import type { InsightItem } from "@/lib/knowledge/insights";

export const dynamic = "force-dynamic";

const SEED_INSIGHTS: Omit<InsightItem, "id">[] = [
  {
    title: "Tetsu Kasuya's 4:6 Method: Sweetness Before Strength",
    summary: "In the 4:6 method, the first 40% of water (split into two pours) controls sweetness and acidity — a larger first pour increases sweetness, a larger second increases acidity. The remaining 60% (split into 2–3 pours) controls strength. Kasuya won the 2016 WBC with this recipe, which remains one of the most teachable frameworks in filter coffee.",
    source: "World Barista Championship 2016",
    url: "https://www.youtube.com/watch?v=wmCW8xSWXZo",
    tags: ["brewing", "v60", "technique", "championship"],
    savedAt: new Date("2025-03-01").toISOString(),
  },
  {
    title: "Why Kenyan AA Tastes Like Blackcurrant: Phosphoric Acid",
    summary: "The distinctive blackcurrant and tomato notes in Kenyan coffees — especially SL28 and SL34 varietals — come largely from elevated phosphoric acid levels. Phosphoric acid creates a bright, clean acidity unlike the harsher citric or malic acids found in other origins. This is amplified by Kenya's high-altitude red volcanic soils and the traditional double-washing wet process.",
    source: "Coffee Research",
    tags: ["origin", "kenya", "science", "acidity", "varietal"],
    savedAt: new Date("2025-03-05").toISOString(),
  },
  {
    title: "Water at 55 ppm TDS: The Specialty Sweet Spot",
    summary: "Scott Rao and Maxwell Colonna-Dashwood's research found that ~50–75 ppm TDS with a magnesium-heavy mineral profile extracts the most sweetness and clarity from light roasts. Pure distilled water extracts poorly; overly hard water above 150 ppm suppresses aromatics and increases perceived bitterness. Brita-filtered water diluted 1:3 with distilled hits ~55 ppm — close to ideal.",
    source: "The Coffee Lover's Guide to Water",
    url: "https://www.scottrao.com",
    tags: ["water", "science", "extraction", "minerals"],
    savedAt: new Date("2025-03-08").toISOString(),
  },
  {
    title: "Bloom Ratio: Why 2–3× Dose Is the Standard",
    summary: "During the bloom phase, CO₂ trapped in freshly roasted coffee degasses and prevents even water absorption. Using 2–3× the dose in water saturates the bed without channeling, while a 30–45 second wait allows full CO₂ release. Coffee roasted under 2 weeks benefits most; older coffee requires almost no bloom as CO₂ has already dissipated.",
    source: "Specialty Coffee Association",
    tags: ["brewing", "bloom", "technique", "freshness"],
    savedAt: new Date("2025-03-10").toISOString(),
  },
  {
    title: "Geisha: From Ethiopian Forest to Panamanian Legend",
    summary: "The Geisha varietal was discovered in the Gori Gesha forest in Ethiopia in the 1930s, brought to CATIE research station in Costa Rica in the 1950s, and planted in Panama by the Peterson family at Hacienda La Esmeralda in the early 2000s. When it won the 2004 Best of Panama competition, it redefined specialty coffee value. True Geisha is defined by its jasmine, bergamot, and peach aromatics from the varietal genetics.",
    source: "World Coffee Research",
    tags: ["varietal", "origin", "geisha", "panama", "history"],
    savedAt: new Date("2025-03-12").toISOString(),
  },
  {
    title: "Temperature Staging: Extract Sweetness Then Body",
    summary: "Peng Jian's 2025 championship technique uses two temperatures in one brew: 96°C for the bloom and early pours to develop aromatics and sweetness, then dropping to 80°C for the final pour to suppress bitter phenolic extraction while adding body. The technique exploits the fact that different flavor compounds extract optimally at different temperatures.",
    source: "World Barista Championship 2025",
    tags: ["technique", "temperature", "championship", "extraction"],
    savedAt: new Date("2025-03-15").toISOString(),
  },
  {
    title: "The Washed vs. Natural Divide Is About Fermentation Time",
    summary: "Washed coffees have the fruit mucilage removed before drying, limiting fermentation to 24–72 hours and producing clean, terroir-transparent cups. Natural coffees dry with the full fruit intact for 3–6 weeks, generating the fruity, winey notes. Honey process is the middle ground: varying amounts of mucilage left on during drying, with yellow/red/black honey indicating progressively more fruit contact.",
    source: "Coffee Processing Science",
    tags: ["processing", "natural", "washed", "honey", "fermentation"],
    savedAt: new Date("2025-03-17").toISOString(),
  },
  {
    title: "Grind Distribution Matters More Than Average Grind Size",
    summary: "A burr grinder with a narrow particle size distribution extracts more evenly than one with a wide distribution at the same average grind size. This is why flat burrs like the Niche Zero's 63mm Italmill burrs tend to produce cleaner, more controllable cups. Fines over-extract causing bitterness; boulders under-extract causing sourness — both in the same cup.",
    source: "Grinder Research / Matt Perger",
    tags: ["grinder", "extraction", "science", "niche-zero"],
    savedAt: new Date("2025-03-19").toISOString(),
  },
  {
    title: "Tim Wendelboe's Light Roast Philosophy: Stop at First Crack",
    summary: "Tim Wendelboe argues that stopping development shortly after first crack preserves the most origin-specific flavor compounds. Further development caramelizes sugars and creates generic roasty notes that mask terroir. His Oslo roastery consistently hits 8–10% development time ratio — a reference point for what light roast actually means technically.",
    source: "Tim Wendelboe",
    url: "https://www.timwendelboe.no",
    tags: ["roasting", "light-roast", "tim-wendelboe", "terroir"],
    savedAt: new Date("2025-03-21").toISOString(),
  },
  {
    title: "AeroPress Inverted Method: Why It Works",
    summary: "The inverted AeroPress method prevents water from draining prematurely, allowing full immersion for a consistent steep time. This was popularized at early World AeroPress Championships. The key trade-off: inverted gives more control over steep time, while standard method allows continuous flow-through which can layer flavors differently. Most 2024–2025 championship recipes use inverted with a 1–2 minute steep.",
    source: "World AeroPress Championship",
    url: "https://www.worldaeropresschampionship.com",
    tags: ["aeropress", "technique", "championship", "immersion"],
    savedAt: new Date("2025-03-24").toISOString(),
  },
];

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const existing = await getInsights();
    const existingTitles = new Set(existing.map(i => i.title.toLowerCase()));

    const toAdd: InsightItem[] = SEED_INSIGHTS
      .filter(i => !existingTitles.has(i.title.toLowerCase()))
      .map(i => ({
        ...i,
        id: `insight_seed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      }));

    if (toAdd.length > 0) {
      await saveInsights([...toAdd, ...existing]);
    }

    return NextResponse.json({ seeded: toAdd.length, alreadyPresent: existing.length });
  } catch (err) {
    console.error("admin/seed error:", err);
    return NextResponse.json({ error: "Seed failed" }, { status: 500 });
  }
}
