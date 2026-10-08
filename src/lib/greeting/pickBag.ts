/**
 * Which rotation bag today's greeting names — chosen in CODE, not by the model.
 *
 * Why (Oct 2026): with several bags starred, the greeting named Vanilla Gorilla
 * every time. Every input leaned the same way: rotation is listed newest-first
 * (so the newest bag is line one), the "Recent brews" block was that same bag
 * three times over, and the MEASURED CONTRAST rule told the model to prefer
 * whichever bag a finding covered. Asked to "pick one", Haiku took the most
 * salient line on near-identical input five times a day.
 *
 * So the pick rotates here: a hash of the day + time slot walks the starred
 * bags, skipping the bag brewed last when there is a choice (yesterday's cup is
 * the least useful suggestion). The model only writes the sentence for it.
 */

export interface PickableBag {
  roaster: string;
  name: string;
}

function norm(s: string | undefined): string {
  return (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** FNV-1a — stable, cheap, and spreads consecutive day strings well. */
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function pickGreetingBag<T extends PickableBag>(
  rotation: T[],
  lastBrewed: PickableBag | null | undefined,
  seedKey: string,
): T | null {
  if (rotation.length === 0) return null;
  // Order-independent: sort by identity so a re-ordered query can't shift the pick.
  const sorted = [...rotation].sort((a, b) =>
    `${norm(a.roaster)}|${norm(a.name)}`.localeCompare(`${norm(b.roaster)}|${norm(b.name)}`),
  );
  const isLast = (b: PickableBag) =>
    !!lastBrewed &&
    norm(b.roaster) === norm(lastBrewed.roaster) &&
    norm(b.name) === norm(lastBrewed.name);
  const pool = sorted.length > 1 ? sorted.filter((b) => !isLast(b)) : sorted;
  const candidates = pool.length > 0 ? pool : sorted;
  return candidates[hashString(seedKey) % candidates.length];
}
