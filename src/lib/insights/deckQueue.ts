/**
 * The order the crafting screen shows its insight lines in (2026-10-19).
 *
 * Before: 12 random lines from the whole pool, re-shuffled on every open, no
 * memory — the same seed facts over and over, nothing about the brew. Now:
 * the lines written for THIS brew lead (src/lib/recommend/brewDeck.ts),
 * then the pool, UNSEEN lines first; a line counts as seen once it has been
 * shown, remembered per device under SEEN_KEY. When every pool line has been
 * seen the memory is cleared and the pool starts over — the deck never runs
 * dry. Pure; the component owns localStorage.
 */
import { normalizeForDedupe } from "./loadingInsightLint";

export const SEEN_KEY = "brewlog.deck.seen.v1";
/** How many lines one wait shows at most (a 60-second wait reads ~5). */
export const DECK_QUEUE_LENGTH = 12;

export function deckKey(text: string): string {
  return normalizeForDedupe(text);
}

/** Deterministic shuffle so a test can pin the order; the component seeds it with Date.now(). */
function shuffle<T>(xs: T[], seed: number): T[] {
  const out = [...xs];
  let s = seed >>> 0 || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface DeckQueueResult {
  queue: string[];
  /** The seen-set to persist: reset to empty when the pool had been exhausted. */
  seen: Set<string>;
  resetPool: boolean;
}

/**
 * @param brewLines lines about this brew — always first, in order, never counted as pool
 * @param pool the static seed + the refreshed pool
 * @param seen keys (deckKey) of pool lines already shown on this device
 */
export function buildDeckQueue(brewLines: string[], pool: string[], seen: Set<string>, seed: number = Date.now(), length: number = DECK_QUEUE_LENGTH): DeckQueueResult {
  const dedup = new Map<string, string>();
  for (const p of pool) {
    const k = deckKey(p);
    if (!dedup.has(k)) dedup.set(k, p);
  }
  const brewKeys = new Set(brewLines.map(deckKey));
  const poolLines = Array.from(dedup.values()).filter((p) => !brewKeys.has(deckKey(p)));
  let unseen = poolLines.filter((p) => !seen.has(deckKey(p)));
  let nextSeen = new Set(seen);
  let resetPool = false;
  if (unseen.length === 0 && poolLines.length > 0) {
    unseen = poolLines;
    nextSeen = new Set();
    resetPool = true;
  }
  const queue = [...brewLines, ...shuffle(unseen, seed)].slice(0, length);
  if (queue.length < length) {
    // Fewer unseen lines than the queue wants: pad with seen ones, never leave the deck short.
    const padding = shuffle(poolLines.filter((p) => !queue.includes(p)), seed + 1);
    queue.push(...padding.slice(0, length - queue.length));
  }
  return { queue, seen: nextSeen, resetPool };
}

/** Mark a shown pool line as seen; brew lines are never recorded (they belong to one brew). */
export function markSeen(seen: Set<string>, line: string, brewLines: string[]): Set<string> {
  if (brewLines.some((b) => deckKey(b) === deckKey(line))) return seen;
  const next = new Set(seen);
  next.add(deckKey(line));
  return next;
}

export function readSeen(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const v: unknown = JSON.parse(raw);
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function writeSeen(seen: Set<string>): string {
  return JSON.stringify(Array.from(seen));
}
