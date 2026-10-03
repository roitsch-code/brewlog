import type { BrewLog, TasteResult } from "@/lib/types/session";

/**
 * Identity of a post-brew insight request (2026-10-03, speed round).
 *
 * The Log screen fires /api/brew-insight the moment the user taps Save — in
 * parallel with the coach question — and parks the answer in the flow store;
 * the Summary uses it only when the brew it describes is the brew being saved.
 * The key covers EXACTLY the fields the route reads (computeAdjustment + the
 * Haiku fallback prompt): rating, flavour notes, the sensory fields, the free
 * notes, flow and timing. `coachAnswer` and `vsPrevious` are left out on
 * purpose — the route never reads them, so an answer given after the prefetch
 * fired does not invalidate it.
 */
export function insightRequestKey(result: TasteResult | undefined, brew: BrewLog | undefined): string {
  if (!result) return "";
  return JSON.stringify([
    result.rating,
    result.flavorNotes ?? [],
    result.clarity ?? null,
    result.sweetness ?? null,
    result.bitterness ?? null,
    result.finish ?? null,
    result.craft ?? null,
    result.fit ?? null,
    result.roastQuality ?? null,
    result.attribution ?? null,
    result.freeNotes ?? "",
    brew?.flow ?? null,
    brew?.timing ?? null,
    brew?.grindSettingUsed ?? null,
    brew?.followedAgitation ?? null,
    brew?.selectedCandidateIdx ?? null,
  ]);
}
