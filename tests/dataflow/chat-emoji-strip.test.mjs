// The chat's streamed output carries no emoji.
//
//   node --test tests/dataflow/chat-emoji-strip.test.mjs
//
// The brand forbids emoji in AI replies and the chat's prompt says so; one
// reached the user anyway ("Ha, völlig berechtigt! [emoji]"). The chat was the
// only one of seven AI surfaces with no output-side check — loadingInsightLint
// has enforced the identical rule in code, with a CI test, for months.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";
import { readFileSync } from "node:fs";

const ROOT = process.cwd();
const entry = `export { stripEmoji, createEmojiStripper } from ${JSON.stringify(
  path.join(ROOT, "src/lib/chat/stripEmoji.ts"),
)};`;
const dir = await mkdtemp(join(tmpdir(), "emoji-"));
const out = join(dir, "b.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { stripEmoji, createEmojiStripper } = await import(pathToFileURL(out).href);

test("the reply that prompted this is cleaned", () => {
  assert.equal(stripEmoji("Ha, völlig berechtigt! \u{1F604}").trimEnd(), "Ha, völlig berechtigt!");
});

test("astral emoji, BMP emoji and joined sequences all go", () => {
  assert.equal(stripEmoji("nice \u{1F60A} cup"), "nice  cup");
  assert.equal(stripEmoji("coffee ☕ time"), "coffee  time");
  assert.equal(stripEmoji("❤️"), "");
  assert.equal(stripEmoji("\u{1F468}‍\u{1F373}"), "");
});

test("ordinary text is untouched, accents and umlauts included", () => {
  const s = "Grind 26 clicks, 94°C, 3:30 — Röstdatum 18.05., ~1:15.9 · Café";
  assert.equal(stripEmoji(s), s);
});

test("a surrogate pair split across two chunks never leaks half a glyph", () => {
  const s = createEmojiStripper();
  const smile = "\u{1F604}";
  const first = s.push("Perfekt " + smile[0]);
  const second = s.push(smile[1] + " weiter");
  const all = first + second;
  assert.equal(all, "Perfekt  weiter");
  // The half-glyph must never have been emitted on its own.
  assert.ok(!/[\uD800-\uDBFF]|[\uDC00-\uDFFF]/.test(all), "no lone surrogate may reach the client");
});

test("streaming plain text is passed through unchanged and in order", () => {
  const s = createEmojiStripper();
  const chunks = ["Nimm ", "den Orea ", "Classic."];
  assert.equal(chunks.map((c) => s.push(c)).join(""), "Nimm den Orea Classic.");
});

test("the route actually strips before sending", () => {
  const route = readFileSync("src/app/api/explore-agent/route.ts", "utf8");
  assert.match(route, /createEmojiStripper/, "the route must import the stripper");
  assert.match(route, /const text = emoji\.push\(event\.delta\.text\)/);
  assert.match(route, /send\("delta", \{ text \}\)/, "the SENT text must be the stripped text");
});
