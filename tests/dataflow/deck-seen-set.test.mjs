// The crafting deck's order and memory (src/lib/insights/deckQueue.ts).
//
//   node --test tests/dataflow/deck-seen-set.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = process.cwd();
const out = path.join(ROOT, "node_modules/.cache/deck-queue/bundle.mjs");
await build({
  stdin: { contents: `export * from ${JSON.stringify(path.join(ROOT, "src/lib/insights/deckQueue.ts"))};`, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const Q = await import(pathToFileURL(out).href);

const POOL = Array.from({ length: 20 }, (_, i) => `Pool fact number ${i} about coffee.`);
const BREW = ["Pink Bourbon is prized for its floral cup.", "Kasuya's 4:6 is today's V60 recipe."];

test("the brew's own lines come first, in order; then the pool", () => {
  const { queue } = Q.buildDeckQueue(BREW, POOL, new Set(), 1);
  assert.deepEqual(queue.slice(0, 2), BREW);
  assert.equal(queue.length, Q.DECK_QUEUE_LENGTH);
  assert.ok(queue.slice(2).every((l) => POOL.includes(l)));
});

test("unseen pool lines are shown before seen ones; the queue never runs short", () => {
  const seen = new Set(POOL.slice(0, 15).map(Q.deckKey));
  const { queue, resetPool } = Q.buildDeckQueue([], POOL, seen, 7);
  assert.equal(resetPool, false);
  const unseen = POOL.slice(15);
  assert.deepEqual([...queue.slice(0, 5)].sort(), [...unseen].sort(), "the five unseen lines lead");
  assert.equal(queue.length, Q.DECK_QUEUE_LENGTH, "padded with seen lines, never short");
  assert.equal(new Set(queue).size, queue.length, "no line twice");
});

test("when every pool line has been seen, the memory resets and the pool starts over", () => {
  const seen = new Set(POOL.map(Q.deckKey));
  const r = Q.buildDeckQueue([], POOL, seen, 3);
  assert.equal(r.resetPool, true);
  assert.equal(r.seen.size, 0);
  assert.equal(r.queue.length, Q.DECK_QUEUE_LENGTH);
});

test("markSeen remembers pool lines by their normalised key and never the brew's own lines", () => {
  let seen = new Set();
  seen = Q.markSeen(seen, "  Pool Fact Number 3 About Coffee. ", BREW);
  assert.ok(seen.has(Q.deckKey(POOL[3])));
  const same = Q.markSeen(seen, BREW[0], BREW);
  assert.equal(same, seen, "a brew line is not recorded");
  assert.equal(same.size, 1);
});

test("the seen-set round-trips through localStorage as JSON, and garbage reads as empty", () => {
  const seen = new Set([Q.deckKey(POOL[0]), Q.deckKey(POOL[1])]);
  const back = Q.readSeen(Q.writeSeen(seen));
  assert.deepEqual([...back].sort(), [...seen].sort());
  assert.equal(Q.readSeen("not json").size, 0);
  assert.equal(Q.readSeen(null).size, 0);
  assert.equal(Q.SEEN_KEY, "brewlog.deck.seen.v1");
});

test("a pool line that duplicates a brew line is not shown twice", () => {
  const { queue } = Q.buildDeckQueue([POOL[0]], POOL, new Set(), 1);
  assert.equal(queue.filter((l) => l === POOL[0]).length, 1);
  assert.equal(queue[0], POOL[0]);
});
