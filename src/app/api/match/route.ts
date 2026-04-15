import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/auth/requireAuth";
import type { Session } from "@/lib/types/session";
import type { UserPreferences } from "@/lib/types/preferences";

/** Fetch a product page URL and extract meaningful text for Claude */
async function fetchPageText(url: string): Promise<string> {
  // Only allow HTTPS URLs to prevent SSRF against internal resources
  if (!url.startsWith("https://")) {
    return "[Only HTTPS URLs are supported]";
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BrewLog/1.0)",
        "Accept": "text/html",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return `[Could not fetch page: HTTP ${res.status}]`;

    const html = await res.text();

    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? "";
    const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim()
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)?.[1]?.trim() ?? "";
    const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim() ?? "";
    const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim() ?? "";

    const bodyClean = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<svg[\s\S]*?<\/svg>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "");

    const textParts: string[] = Array.from(
      bodyClean.matchAll(/<(h[1-3]|p|li|td|th)[^>]*>([\s\S]*?)<\/\1>/gi)
    )
      .map(m => m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
      .filter(t => t.length > 10 && t.length < 600);

    const combined = [
      title && `Title: ${title}`,
      ogTitle && ogTitle !== title && `OG Title: ${ogTitle}`,
      metaDesc && `Description: ${metaDesc}`,
      ogDesc && ogDesc !== metaDesc && `OG Description: ${ogDesc}`,
      textParts.length > 0 && `Page content:\n${textParts.slice(0, 40).join("\n")}`,
    ].filter(Boolean).join("\n");

    return combined.slice(0, 4000);
  } catch {
    clearTimeout(timeout);
    return "[Could not fetch or parse the page]";
  }
}

/** Calculate roast freshness status */
function getRoastFreshness(roastDate: string): string {
  const days = Math.floor((Date.now() - new Date(roastDate).getTime()) / 86400000);
  if (days < 0) return `Roasted in the future? Check date.`;
  if (days < 5) return `Roasted ${days} days ago — too fresh, needs rest (min 7 days for filter). Underdeveloped CO2 may cause sourness.`;
  if (days <= 21) return `Roasted ${days} days ago — in peak window (7–21 days for filter). Ideal now.`;
  if (days <= 35) return `Roasted ${days} days ago — slightly past peak, still good but flavors may be softening.`;
  if (days <= 60) return `Roasted ${days} days ago — past peak. Expect flatter, less vibrant cup.`;
  return `Roasted ${days} days ago — likely stale. Oxidation probable; flavors dull.`;
}

/** Derive taste patterns from rated sessions */
function analyzeHistory(rated: Session[]) {
  const high = rated.filter(s => (s.result?.rating ?? 0) >= 4);
  const mid = rated.filter(s => { const r = s.result?.rating ?? 0; return r >= 3 && r < 4; });
  const low = rated.filter(s => (s.result?.rating ?? 0) < 3);

  const avgRatingByKey = (key: "origin" | "process" | "roastLevel") => {
    const sums: Record<string, { sum: number; count: number }> = {};
    for (const s of rated) {
      // Exclude brew errors from taste-profile calculations — the cup was bad, not the bean
      if (s.result?.attribution === "brew") continue;
      const val = s.coffee?.[key];
      const r = s.result?.rating;
      if (val && r) {
        if (!sums[val]) sums[val] = { sum: 0, count: 0 };
        sums[val].sum += r;
        sums[val].count++;
      }
    }
    return Object.entries(sums)
      .filter(([, v]) => v.count >= 1)
      .map(([k, v]) => ({ name: k, avg: Math.round(v.sum / v.count * 10) / 10, count: v.count }))
      .sort((a, b) => b.avg - a.avg);
  };

  const topFlavorNotes = (() => {
    const counts: Record<string, number> = {};
    for (const s of high) {
      for (const n of s.result?.flavorNotes ?? []) {
        counts[n] = (counts[n] || 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k);
  })();

  // Roaster craft reliability: avg craft score per roaster (off=1, solid=2, exceptional=3)
  const roasterCraftMap: Record<string, { sum: number; count: number; exceptional: number; off: number }> = {};
  for (const s of rated) {
    const roaster = s.coffee?.roaster;
    const craft = s.result?.craft;
    if (!roaster || !craft) continue;
    if (!roasterCraftMap[roaster]) roasterCraftMap[roaster] = { sum: 0, count: 0, exceptional: 0, off: 0 };
    roasterCraftMap[roaster].sum += craft === "exceptional" ? 3 : craft === "solid" ? 2 : 1;
    roasterCraftMap[roaster].count++;
    if (craft === "exceptional") roasterCraftMap[roaster].exceptional++;
    if (craft === "off") roasterCraftMap[roaster].off++;
  }
  const roasterCraft = Object.entries(roasterCraftMap)
    .map(([name, v]) => ({ name, avgCraft: Math.round(v.sum / v.count * 10) / 10, count: v.count, exceptional: v.exceptional, off: v.off }))
    .sort((a, b) => b.avgCraft - a.avgCraft);

  // Fit by process: how often each process feels like "my kind of cup" vs "not my style"
  const fitByProcess: Record<string, { myKind: number; neutral: number; notMyStyle: number }> = {};
  for (const s of rated) {
    const process = s.coffee?.process;
    const fit = s.result?.fit;
    if (!process || !fit) continue;
    if (!fitByProcess[process]) fitByProcess[process] = { myKind: 0, neutral: 0, notMyStyle: 0 };
    if (fit === "my-kind") fitByProcess[process].myKind++;
    else if (fit === "neutral") fitByProcess[process].neutral++;
    else if (fit === "not-my-style") fitByProcess[process].notMyStyle++;
  }

  return {
    totalRated: rated.length,
    highCount: high.length,
    midCount: mid.length,
    lowCount: low.length,
    originRatings: avgRatingByKey("origin"),
    processRatings: avgRatingByKey("process"),
    roastLevelRatings: avgRatingByKey("roastLevel"),
    topFlavorNotes,
    roasterCraft,
    fitByProcess,
  };
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface MatchResult {
  matchLevel: "great" | "good" | "maybe" | "avoid";
  score: number; // 0–100
  headline: string;
  reasons: string[];
  expect: string;
  caution?: string;
  freshnessNote?: string; // returned if roast date was provided
}

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { coffee, imageBase64, mimeType, url } = body;

    const db = getAdminDb();

    // Load user preferences and sessions in parallel
    const [prefResult, sessionsSnap] = await Promise.all([
      db.collection("preferences").doc("default").get().catch(() => null),
      db.collection("sessions").orderBy("createdAt", "desc").limit(100).get(),
    ]);

    const preferences: UserPreferences | null = prefResult?.exists
      ? (prefResult.data() as UserPreferences)
      : null;

    const sessions = sessionsSnap.docs.map(d => d.data() as Session);
    const rated = sessions.filter(s => s.result?.rating);

    // Pattern analysis
    const patterns = analyzeHistory(rated);

    // Build taste profile section from actual data + prefs
    const tasteProfileLines: string[] = [];

    if (preferences?.tasteProfile) {
      const tp = preferences.tasteProfile;
      if (tp.likedOrigins?.length) tasteProfileLines.push(`Stated liked origins: ${tp.likedOrigins.join(", ")}`);
      if (tp.likedProcesses?.length) tasteProfileLines.push(`Stated liked processes: ${tp.likedProcesses.join(", ")}`);
      if (tp.avoidProcesses?.length) tasteProfileLines.push(`Stated avoid processes: ${tp.avoidProcesses.join(", ")}`);
      if (tp.preferredBodyLevel) tasteProfileLines.push(`Preferred body: ${tp.preferredBodyLevel}`);
      if (tp.preferredAcidityLevel) tasteProfileLines.push(`Preferred acidity: ${tp.preferredAcidityLevel}`);
    }

    // Actual ratings by origin/process (the real signal)
    const originSummary = patterns.originRatings.length > 0
      ? patterns.originRatings.slice(0, 8).map(o => `  ${o.name}: avg ${o.avg}★ (${o.count} sessions)`).join("\n")
      : "  (no origin data yet)";

    const processSummary = patterns.processRatings.length > 0
      ? patterns.processRatings.map(p => `  ${p.name}: avg ${p.avg}★ (${p.count} sessions)`).join("\n")
      : "  (no process data yet)";

    const roastLevelSummary = patterns.roastLevelRatings.length > 0
      ? patterns.roastLevelRatings.map(r => `  ${r.name}: avg ${r.avg}★ (${r.count} sessions)`).join("\n")
      : "  (no roast level data yet)";

    const flavorAffinities = patterns.topFlavorNotes.length > 0
      ? `Top recurring flavors in 4★+ sessions: ${patterns.topFlavorNotes.join(", ")}`
      : "";

    // Recent sessions (last 12 rated)
    const recentHistory = rated.slice(0, 12).map(s => {
      const attr = s.result?.attribution ? ` | attributed to: ${s.result.attribution}` : "";
      const craft = s.result?.craft ? ` | craft: ${s.result.craft}` : "";
      const fit = s.result?.fit ? ` | fit: ${s.result.fit}` : "";
      return `- ${s.coffee?.name ?? "?"} by ${s.coffee?.roaster ?? "?"}: ${s.coffee?.origin ?? "?"} ${s.coffee?.process ?? ""} ${s.coffee?.roastLevel ?? ""} | ${s.result?.rating}/5 | ${s.result?.flavorNotes?.join(", ") || "no notes"} | body: ${s.result?.body ?? "?"} | acidity: ${s.result?.acidity ?? "?"}${attr}${craft}${fit}`;
    }).join("\n");

    // Roaster craft summary
    const roasterCraftSummary = patterns.roasterCraft.length > 0
      ? patterns.roasterCraft.map(r => `  ${r.name}: avg craft ${r.avgCraft}/3 (${r.count} sessions, ${r.exceptional} exceptional, ${r.off} off)`).join("\n")
      : "  (no craft data yet)";

    // Fit by process summary
    const fitProcessSummary = Object.keys(patterns.fitByProcess).length > 0
      ? Object.entries(patterns.fitByProcess).map(([p, v]) => `  ${p}: ${v.myKind} my-kind / ${v.neutral} neutral / ${v.notMyStyle} not-my-style`).join("\n")
      : "  (no fit data yet)";

    // Roast freshness
    let freshnessNote = "";
    if (coffee?.roastDate) {
      freshnessNote = getRoastFreshness(coffee.roastDate);
    }

    // Build coffee summary
    const contentParts: Anthropic.MessageParam["content"] = [];

    if (imageBase64 && mimeType) {
      contentParts.push({
        type: "image",
        source: { type: "base64", media_type: mimeType as "image/jpeg" | "image/png" | "image/webp", data: imageBase64 },
      });
    }

    let coffeeSummary = "";
    if (coffee) {
      const fields = [
        coffee.name && `Name: ${coffee.name}`,
        coffee.roaster && `Roaster: ${coffee.roaster}`,
        coffee.origin && `Origin: ${coffee.origin}`,
        coffee.region && `Region: ${coffee.region}`,
        coffee.variety && `Variety: ${coffee.variety}`,
        coffee.process && `Process: ${coffee.process}`,
        coffee.roastLevel && `Roast level: ${coffee.roastLevel}`,
        coffee.roastDate && `Roast date: ${coffee.roastDate}`,
        freshnessNote && `Freshness: ${freshnessNote}`,
        coffee.tastingNotes && `Bag notes: ${coffee.tastingNotes}`,
      ].filter(Boolean);
      coffeeSummary = fields.join("\n");
    }
    if (url) {
      const pageText = await fetchPageText(url);
      coffeeSummary += `\n\n<product_page url="${url}">\n${pageText}\n</product_page>`;
    }

    const userPrompt = [
      coffeeSummary && `COFFEE TO ASSESS:\n${coffeeSummary}`,
      imageBase64 && "Analyze the coffee shown in the image above. Extract all visible details: name, roaster, origin, process, roast level, roast date, bag tasting notes.",
      `\nUSER TASTE PROFILE (from onboarding):\n${tasteProfileLines.length ? tasteProfileLines.join("\n") : "Not set yet — use brew history as primary signal."}`,
      `\nACTUAL RATINGS BY ORIGIN:\n${originSummary}`,
      `\nACTUAL RATINGS BY PROCESS:\n${processSummary}`,
      `\nACTUAL RATINGS BY ROAST LEVEL:\n${roastLevelSummary}`,
      flavorAffinities && `\n${flavorAffinities}`,
      `\nROASTER CRAFT RELIABILITY:\n${roasterCraftSummary}`,
      `\nSTYLE FIT BY PROCESS:\n${fitProcessSummary}`,
      rated.length > 0 && `\nRECENT SESSION HISTORY (${patterns.totalRated} rated total — ${patterns.highCount} high, ${patterns.midCount} mid, ${patterns.lowCount} low):\n${recentHistory}`,
      !rated.length && "\nNo brew history yet — rely on stated preferences.",
      `\nAssess how well this coffee suits the user. The actual ratings by origin/process/roast level are the strongest signal. Stated preferences are secondary.${freshnessNote ? " The freshness note is important — factor it into the caution field if relevant." : ""}

Return JSON only:
{
  "matchLevel": "great" | "good" | "maybe" | "avoid",
  "score": number (0-100),
  "headline": string (max 8 words, punchy and direct),
  "reasons": string[] (2-3 specific reasons referencing actual data, each max 14 words),
  "expect": string (what to expect in the cup — flavors, body, acidity — max 20 words),
  "caution": string | null (one specific concern — freshness, process mismatch, etc. — max 14 words, or null),
  "freshnessNote": ${freshnessNote ? `"${freshnessNote}"` : "null"}
}`,
    ].filter(Boolean).join("\n");

    contentParts.push({ type: "text", text: userPrompt });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system: `You are a personal coffee match advisor. Your job is to assess how well a given coffee suits this specific user based on their documented taste history and preferences.

BASELINE PROFILE (treat as prior — actual session ratings override this):
- Likes: silky, creamy, balanced; slightly sweet, floral, fruity; light roast single origins
- Avoids: anaerobic/extreme fermentation, infused, heavy/dark roasts, "fruit bombs"
- Starting origins: Brazil Natural, Ethiopia Washed, Kenya AA Washed, Costa Rica Honey
- Budget: max 20 €/250g
- Drinks filter coffee (V60, AeroPress, Clever Dripper, Moccamaster) — not espresso

ANALYSIS RULES:
1. Actual session ratings are ground truth. If the user rated a "disliked" process 4+ stars → it's a real preference now.
2. Pattern wins over single data points. 3× high-rated Naturals > one bad Natural session.
3. Roast freshness matters. Coffee older than 35 days post-roast is past peak for filter — flag it.
4. Coffee in the 5–21 day post-roast window is ideal. Under 5 days is too fresh.
5. Be direct and specific. "Matches your Kenya Washed pattern (avg 4.2★)" beats generic statements.
6. Score calibration: 85–100 = great, 65–84 = good, 45–64 = maybe, 0–44 = avoid.
7. Craft vs fit: low rating + craft="exceptional" + fit="not-my-style" = style mismatch, not quality failure. Don't penalise the roaster — flag the style gap instead.
8. Roaster craft scores are independent of taste fit. A roaster can execute exceptionally on a style the user doesn't prefer — note both signals separately.

Return valid JSON only. No markdown, no explanation outside the JSON.`,
      messages: [{ role: "user", content: contentParts }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result: MatchResult = jsonMatch
      ? JSON.parse(jsonMatch[0])
      : { matchLevel: "maybe", score: 50, headline: "Unable to assess", reasons: [], expect: "Could not analyze.", freshnessNote: freshnessNote || undefined };

    // Always include server-computed freshness note if roast date was provided
    if (freshnessNote && !result.freshnessNote) {
      result.freshnessNote = freshnessNote;
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("match error:", err);
    return NextResponse.json({ error: "Match analysis failed" }, { status: 500 });
  }
}
