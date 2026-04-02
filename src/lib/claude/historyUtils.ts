import type { Session } from "../types/session";

/**
 * Builds a concise brew history summary string for injection into Claude prompts.
 * Used by both the recommendation engine and the explore chat.
 */
export function buildHistorySummary(pastSessions: Session[], limit = 8): string {
  if (!pastSessions.length) return "No previous sessions yet — this is the user's first brew.";

  const lines = pastSessions.slice(0, limit).map(s => {
    const method = s.brew?.methodUsed || s.recommendation?.primaryMethod || "unknown";
    const rating = s.result?.rating != null ? `${s.result.rating}★` : "unrated";
    const coffee = s.coffee?.name ? `${s.coffee.name} (${s.coffee.origin || "?"}, ${s.coffee.process || "?"})` : "unknown coffee";
    const notes = s.result?.flavorNotes?.slice(0, 4).join(", ") || "";
    const body = s.result?.body || "";
    const acidity = s.result?.acidity || "";
    const freeNote = s.result?.freeNotes ? ` · "${s.result.freeNotes}"` : "";
    const wouldRepeat = s.result?.wouldUseMethodAgain === false ? " · would NOT repeat this method" : "";
    const flow = s.brew?.flow ? ` · flow: ${s.brew.flow}` : "";
    const mods = s.brew?.modifications ? ` · modified: ${s.brew.modifications}` : "";
    const attribution = s.result?.attribution ? ` · low-rated due to: ${s.result.attribution}` : "";
    const craft = s.result?.craft ? ` · craft: ${s.result.craft}` : "";
    const fit = s.result?.fit ? ` · fit: ${s.result.fit}` : "";
    // Bag-notes vs actual flavors drift signal
    const bagNotes = s.coffee?.tastingNotesFromBag?.slice(0, 4);
    const actualNotes = s.result?.flavorNotes?.slice(0, 4);
    const drift = (bagNotes?.length && actualNotes?.length)
      ? ` · bag promised: [${bagNotes.join(", ")}] → actually tasted: [${actualNotes.join(", ")}]`
      : "";
    return `${method} with ${coffee}: ${rating}${notes ? ` [${notes}]` : ""}${body ? ` body:${body}` : ""}${acidity ? ` acidity:${acidity}` : ""}${flow}${mods}${wouldRepeat}${freeNote}${attribution}${craft}${fit}${drift}`;
  });

  return lines.join("\n");
}
