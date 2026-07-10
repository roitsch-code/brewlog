import type { Session } from "../types/session";
import { resolveBrewedRecipe, brewedRecipeName } from "../utils/resolveRecipe";

/**
 * Computes per-method average timing delta (actualTimeSec - targetTimeSec) across past sessions.
 * Only includes sessions where both timing fields are present and the method is percolation-based.
 * Returns an empty object if there is insufficient data.
 */
export function buildTimingStats(
  pastSessions: Session[],
  isPercolation: (method?: string) => boolean
): Record<string, { delta: number; count: number }> {
  const acc: Record<string, { sum: number; count: number }> = {};

  for (const s of pastSessions) {
    const actual = s.brew?.actualTimeSec;
    const target = resolveBrewedRecipe(s).recipe?.targetTimeSec;
    const method = s.brew?.methodUsed || s.recommendation?.primaryMethod;
    if (!actual || !target || !isPercolation(method)) continue;
    const key = (method ?? "unknown").toLowerCase().trim();
    if (!acc[key]) acc[key] = { sum: 0, count: 0 };
    acc[key].sum += actual - target;
    acc[key].count += 1;
  }

  const result: Record<string, { delta: number; count: number }> = {};
  for (const [key, { sum, count }] of Object.entries(acc)) {
    result[key] = { delta: Math.round(sum / count), count };
  }
  return result;
}

/**
 * MEASURED timing calibration for one specific method + batch size: the median
 * (actualTimeSec − targetTimeSec) across past sessions of the SAME method at a
 * SIMILAR water volume (±20% or ±60g, whichever is wider). This is the app's
 * own recorded data — no invented "X s per 100ml" scaling slope (Hard Rule).
 *
 * Why volume-bucketed: the per-method average in buildTimingStats mixes single
 * cups with large batches, so a 450ml brew that reliably runs +40s over its
 * reference clock averages out against on-time 250ml brews and the promised
 * time stays mathematically impossible for the batch ("die Zeit ist off").
 *
 * Returns null under 2 matching samples — never extrapolates from one brew.
 */
export function measuredTimeDelta(
  pastSessions: Session[],
  method: string | undefined,
  waterGrams: number | undefined,
  isPercolation: (method?: string) => boolean,
): { deltaSec: number; count: number } | null {
  if (!method || !isPercolation(method)) return null;
  if (typeof waterGrams !== "number" || !(waterGrams > 0)) return null;
  const key = method.toLowerCase().trim();
  const tol = Math.max(60, waterGrams * 0.2);

  const deltas: number[] = [];
  for (const s of pastSessions) {
    const actual = s.brew?.actualTimeSec;
    const recipe = resolveBrewedRecipe(s).recipe;
    const target = recipe?.targetTimeSec;
    const water = recipe?.waterGrams;
    const m = (s.brew?.methodUsed || s.recommendation?.primaryMethod || "").toLowerCase().trim();
    if (!actual || !target || m !== key) continue;
    if (typeof water !== "number" || Math.abs(water - waterGrams) > tol) continue;
    deltas.push(actual - target);
  }
  if (deltas.length < 2) return null;
  deltas.sort((a, b) => a - b);
  const mid = Math.floor(deltas.length / 2);
  const deltaSec =
    deltas.length % 2 === 1 ? deltas[mid] : Math.round((deltas[mid - 1] + deltas[mid]) / 2);
  return { deltaSec, count: deltas.length };
}

/**
 * Builds a sensory preference signal string from extended TasteResult fields.
 * Only included when ≥3 sessions have at least one sensory field filled.
 */
function buildSensoryPatterns(sessions: Session[]): string {
  const sensoryData = sessions.filter(
    (s) => s.result?.clarity || s.result?.sweetness || s.result?.bitterness
  );
  if (sensoryData.length < 3) return "";

  const groups: Record<string, number[]> = {};
  for (const s of sensoryData) {
    const r = s.result;
    if (!r) continue;
    if (r.clarity) {
      const key = `clarity:${r.clarity}`;
      groups[key] = groups[key] ?? [];
      groups[key].push(r.rating);
    }
    if (r.sweetness) {
      const key = `sweetness:${r.sweetness}`;
      groups[key] = groups[key] ?? [];
      groups[key].push(r.rating);
    }
    if (r.bitterness) {
      const key = `bitterness:${r.bitterness}`;
      groups[key] = groups[key] ?? [];
      groups[key].push(r.rating);
    }
    if (r.finish) {
      const key = `finish:${r.finish}`;
      groups[key] = groups[key] ?? [];
      groups[key].push(r.rating);
    }
    if (r.balance) {
      const key = `balance:${r.balance}`;
      groups[key] = groups[key] ?? [];
      groups[key].push(r.rating);
    }
  }

  const lines: string[] = [];
  for (const [key, ratings] of Object.entries(groups)) {
    if (ratings.length < 2) continue;
    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    lines.push(`  ${key}: avg ${avg.toFixed(1)}★ (${ratings.length} sessions)`);
  }

  // Cooling and intention signals
  const coolingPositive = sessions.filter(
    (s) => s.result?.improvedWhileCooling === true
  );
  if (coolingPositive.length >= 2) {
    const avg =
      coolingPositive.reduce((a, s) => a + (s.result?.rating ?? 0), 0) /
      coolingPositive.length;
    lines.push(
      `  improved-while-cooling: avg ${avg.toFixed(1)}★ (${coolingPositive.length} sessions) — user regularly notices cooling improvement`
    );
  }

  const intentionMatched = sessions.filter(
    (s) => s.result?.matchedIntention === true
  );
  if (intentionMatched.length >= 2) {
    const avg =
      intentionMatched.reduce((a, s) => a + (s.result?.rating ?? 0), 0) /
      intentionMatched.length;
    lines.push(
      `  matched-intention: avg ${avg.toFixed(1)}★ (${intentionMatched.length} sessions) — cups matching the goal score higher`
    );
  }

  return lines.length
    ? `== Sensory preference signals ==\n${lines.join("\n")}\n\n`
    : "";
}

/**
 * Builds per-roaster brewing outcome summary.
 * Only included when ≥2 sessions share a roaster.
 */
function buildRoasterHistory(sessions: Session[]): string {
  const acc: Record<string, { sum: number; count: number; methods: string[] }> =
    {};
  for (const s of sessions) {
    const roaster = s.coffee?.roaster;
    const method = s.brew?.methodUsed || s.recommendation?.primaryMethod;
    const rating = s.result?.rating;
    if (!roaster || !method || rating == null) continue;
    const key = roaster.trim();
    acc[key] = acc[key] ?? { sum: 0, count: 0, methods: [] };
    acc[key].sum += rating;
    acc[key].count += 1;
    if (!acc[key].methods.includes(method)) acc[key].methods.push(method);
  }
  const lines = Object.entries(acc)
    .filter(([, v]) => v.count >= 2)
    .sort(([, a], [, b]) => b.count - a.count)
    .map(
      ([r, v]) =>
        `  ${r}: avg ${(v.sum / v.count).toFixed(1)}★ (${v.count} sessions, methods: ${v.methods.join(", ")})`
    );
  return lines.length
    ? `== Roaster-specific outcomes ==\n${lines.join("\n")}\n\n`
    : "";
}

/**
 * Builds a concise brew history summary string for injection into Claude prompts.
 * Used by both the recommendation engine and the explore chat.
 */
export function buildHistorySummary(pastSessions: Session[], limit = 8): string {
  if (!pastSessions.length) return "No previous sessions yet — this is the user's first brew.";

  // Build method × process rankings (combos with ≥2 rated sessions only)
  const comboAcc: Record<string, { sum: number; count: number }> = {};
  for (const s of pastSessions) {
    const method = s.brew?.methodUsed || s.recommendation?.primaryMethod;
    const process = s.coffee?.process;
    const rating = s.result?.rating;
    if (!method || !process || rating == null) continue;
    const key = `${method} × ${process}`;
    if (!comboAcc[key]) comboAcc[key] = { sum: 0, count: 0 };
    comboAcc[key].sum += rating;
    comboAcc[key].count += 1;
  }
  const rankedCombos = Object.entries(comboAcc)
    .filter(([, v]) => v.count >= 2)
    .map(([k, v]) => ({ key: k, avg: v.sum / v.count, count: v.count }))
    .sort((a, b) => b.avg - a.avg);

  const rankingBlock = rankedCombos.length
    ? `== Method × Process rankings (empirical — weight above stated preferences) ==\n` +
      rankedCombos
        .map((c) => `${c.key}: ${c.avg.toFixed(1)}★ (${c.count} sessions)`)
        .join("\n") +
      "\n\n"
    : "";

  // Sensory patterns (new)
  const sensoryBlock = buildSensoryPatterns(pastSessions);

  // Roaster-specific outcomes (new)
  const roasterBlock = buildRoasterHistory(pastSessions);

  const lines = pastSessions.slice(0, limit).map((s) => {
    const method =
      s.brew?.methodUsed || s.recommendation?.primaryMethod || "unknown";
    const rating =
      s.result?.rating != null ? `${s.result.rating}★` : "unrated";
    const coffee = s.coffee?.name
      ? `${s.coffee.name} (${s.coffee.origin || "?"}, ${s.coffee.process || "?"})`
      : "unknown coffee";
    const notes = s.result?.flavorNotes?.slice(0, 4).join(", ") || "";
    const body = s.result?.body || "";
    const acidity = s.result?.acidity || "";
    const freeNote = s.result?.freeNotes ? ` · "${s.result.freeNotes}"` : "";
    // Support both new field name (wouldBrewAgain) and legacy stored name (wouldUseMethodAgain)
    type ResultCompat = typeof s.result & { wouldUseMethodAgain?: boolean };
    const wouldBrewAgainVal =
      (s.result as ResultCompat | undefined)?.wouldBrewAgain ??
      (s.result as ResultCompat | undefined)?.wouldUseMethodAgain;
    const wouldBrewAgain =
      wouldBrewAgainVal === false ? " · would NOT brew this setup again" :
      wouldBrewAgainVal === true  ? " · would brew this setup again" : "";
    const occasion = s.context?.occasion ? ` · occasion: ${s.context.occasion}` : "";
    const flow = s.brew?.flow ? ` · flow: ${s.brew.flow}` : "";
    const mods = s.brew?.modifications
      ? ` · modified: ${s.brew.modifications}`
      : "";
    const attribution = s.result?.attribution
      ? ` · low-rated due to: ${s.result.attribution}`
      : "";
    const craft = s.result?.craft ? ` · craft: ${s.result.craft}` : "";
    const fit = s.result?.fit ? ` · fit: ${s.result.fit}` : "";
    // Extended sensory signals
    const clarity = s.result?.clarity ? ` · clarity: ${s.result.clarity}` : "";
    const sweetness = s.result?.sweetness
      ? ` · sweetness: ${s.result.sweetness}`
      : "";
    const bitterness = s.result?.bitterness
      ? ` · bitterness: ${s.result.bitterness}`
      : "";
    const finish = s.result?.finish ? ` · finish: ${s.result.finish}` : "";
    // Bag-notes vs actual flavors drift signal
    const bagNotes = s.coffee?.tastingNotesFromBag?.slice(0, 4);
    const actualNotes = s.result?.flavorNotes?.slice(0, 4);
    const drift =
      bagNotes?.length && actualNotes?.length
        ? ` · bag promised: [${bagNotes.join(", ")}] → actually tasted: [${actualNotes.join(", ")}]`
        : "";
    return `${method} with ${coffee}: ${rating}${notes ? ` [${notes}]` : ""}${body ? ` body:${body}` : ""}${acidity ? ` acidity:${acidity}` : ""}${clarity}${sweetness}${bitterness}${finish}${flow}${mods}${wouldBrewAgain}${freeNote}${attribution}${craft}${fit}${occasion}${drift}`;
  });

  return rankingBlock + sensoryBlock + roasterBlock + lines.join("\n");
}

function formatMSS(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatRelativeDate(iso: string): string {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "unknown date";
  const days = Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

/**
 * Builds a compact "what you brewed and how" block for explore-style chats.
 * Shows the actual recipe parameters (dose/water/grind/temp/timing/water source)
 * for the most recent sessions so the AI can comment on real brews instead of
 * generic guidance. Returns an empty string when there are no sessions.
 */
export function buildRecentRecipes(pastSessions: Session[], limit = 5): string {
  if (!pastSessions.length) return "";
  const lines = pastSessions.slice(0, limit).map((s) => {
    const date = formatRelativeDate(s.createdAt);
    // Read the recipe the user ACTUALLY brewed (selected candidate), not the
    // primary — reading primary is what made the chat report a wrong grind.
    const { recipe: brewed, candidate } = resolveBrewedRecipe(s);
    const method = s.brew?.methodUsed || s.recommendation?.primaryMethod || "?";
    const recipeName = brewedRecipeName(candidate);
    const coffee =
      s.coffee?.roaster && s.coffee?.name
        ? `${s.coffee.roaster} — ${s.coffee.name}`
        : s.coffee?.name || "unknown coffee";

    const dose = s.brew?.doseGrams ?? brewed?.doseGrams;
    const water = s.brew?.waterGrams ?? brewed?.waterGrams;
    const ratio = dose && water ? `1:${(water / dose).toFixed(1)}` : null;
    const grind = s.brew?.grindSettingUsed ?? brewed?.grindSize;
    const temp = s.brew?.actualTempC ?? brewed?.waterTempC;
    const target = brewed?.targetTimeSec;
    const actual = s.brew?.actualTimeSec;
    const flow = s.brew?.flow && s.brew.flow !== "na" ? s.brew.flow : null;
    const waterSource = s.context?.waterSource;
    const rating = s.result?.rating;
    const flavors = s.result?.flavorNotes?.slice(0, 3).join(", ");

    const parts: string[] = [date, method, coffee];
    if (recipeName) parts.push(`recipe: ${recipeName}`);

    const doseWater = [dose ? `${dose}g` : null, water ? `${water}g` : null]
      .filter(Boolean)
      .join("/");
    if (doseWater) parts.push(`${doseWater}${ratio ? ` (${ratio})` : ""}`);
    else if (ratio) parts.push(ratio);

    if (grind != null && grind !== "") {
      parts.push(typeof grind === "number" ? `${grind}°` : `${grind}`);
    }
    if (temp != null) parts.push(`${temp}°C`);

    if (target || actual) {
      const t = target ? formatMSS(target) : "?";
      const a = actual ? formatMSS(actual) : "?";
      parts.push(`target ${t} actual ${a}${flow ? ` (${flow})` : ""}`);
    } else if (flow) {
      parts.push(`(${flow})`);
    }

    if (waterSource) parts.push(`water:${waterSource}`);
    if (rating != null) parts.push(`${rating}★`);
    if (flavors) parts.push(`[${flavors}]`);

    return `- ${parts.join(" · ")}`;
  });
  return lines.join("\n");
}
