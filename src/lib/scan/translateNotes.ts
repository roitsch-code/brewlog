import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Translate coffee tasting-note descriptors to English. Already-English notes
 * come back unchanged. This backs the retroactive backfill for bags scanned
 * BEFORE the scan paths started translating at extraction time (PR #471).
 *
 * Never invents, merges, splits, reorders, or drops a note: the result is the
 * same length + order as the (non-empty) input, or — on ANY model / parse
 * failure or a length mismatch — the original array verbatim. It's a display
 * nicety, so it must never lose or fabricate data (the never-fabricate rule).
 */
export async function translateNotesToEnglish(notes: string[]): Promise<string[]> {
  const clean = notes.filter((n) => typeof n === "string" && n.trim().length > 0);
  if (clean.length === 0) return clean;
  try {
    const resp = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `Translate each of these coffee tasting notes to its standard English specialty-coffee descriptor (e.g. "Groseille" → "Redcurrant", "Cassis" → "Blackcurrant", "Rhabarber" → "Rhubarb", "Agrumes" → "Citrus", "Myrtille" → "Blueberry", "Noisette" → "Hazelnut"). If a note is ALREADY English, return it unchanged. Do NOT invent, merge, split, reorder, or drop any note. Return ONLY a JSON array of strings — the SAME length and order as the input.

Input: ${JSON.stringify(clean)}`,
        },
      ],
    });
    const text = resp.content[0].type === "text" ? resp.content[0].text : "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return clean;
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed) || parsed.length !== clean.length) return clean;
    const out = parsed.map((v) => (typeof v === "string" ? v.trim() : ""));
    if (out.some((s) => s.length === 0)) return clean; // any blank → don't trust it
    return out;
  } catch {
    return clean;
  }
}
