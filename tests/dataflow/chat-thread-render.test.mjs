// ChatThread renders what the model actually emits.
//
//   node --test tests/dataflow/chat-thread-render.test.mjs
//
// Bundles the REAL component with esbuild and renders it to static markup, so
// this asserts the rendered output rather than the source. The chat used to
// understand exactly two constructs — bold and italic — and printed everything
// else literally: the owner was shown "| | |" and "|---|---|" as prose in the
// middle of an answer, because the model had reached for a markdown table (the
// system prompt demonstrates one).

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const entry = `
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import ChatThread from ${JSON.stringify(path.join(ROOT, "src/components/ui/light/ChatThread.tsx"))};
export function render(content) {
  return renderToStaticMarkup(
    React.createElement(ChatThread, {
      messages: [{ role: "assistant", content }],
      loading: false,
    }),
  );
}`;
// Bundled INSIDE the repo: react-dom stays external (bundling it into ESM hits
// CJS interop), so the output has to sit where node can resolve node_modules.
const dir = join(ROOT, "node_modules/.cache/brewlog-tests");
await mkdir(dir, { recursive: true });
const out = join(dir, "chat-thread.cjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "tsx" },
  bundle: true,
  // CJS, because lucide-react ships CommonJS and dynamically requires react —
  // an ESM bundle with react external cannot satisfy that.
  format: "cjs",
  platform: "node",
  outfile: out,
  jsx: "automatic",
  external: ["react", "react-dom"],
  logLevel: "silent",
});
const { render } = createRequire(import.meta.url)(out);

test("a markdown table renders as a table, not as pipes", () => {
  const html = render(
    "Here they are:\n\n| Bottom | Flow |\n|---|---|\n| Apex | slowest |\n| Classic | middle |",
  );
  assert.match(html, /<table/, "must render a real table");
  assert.match(html, /Apex/);
  assert.match(html, /slowest/);
  assert.ok(!html.includes("|---|"), "the separator row must never reach the user");
  assert.ok(!html.includes("| Apex |"), "raw pipe rows must not survive");
});

test("a wide table gets its own horizontal scroller", () => {
  // PR #505: anything that extends past the viewport becomes draggable, so a
  // table has to scroll inside itself rather than widening the page.
  const html = render("| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |");
  assert.match(html, /overflow-x-auto/, "the table needs its own overflow-x container");
});

test("bullet and numbered lists render as lists", () => {
  const bullets = render("- Apex\n- Classic\n- Open");
  assert.match(bullets, /<ul/);
  assert.equal((bullets.match(/<li/g) || []).length, 3);
  assert.ok(!bullets.includes("- Apex"), "the bullet marker must not be printed as text");

  const numbers = render("1. Bloom\n2. Pour\n3. Drain");
  assert.match(numbers, /<ol/);
  assert.equal((numbers.match(/<li/g) || []).length, 3);
});

test("ordinary prose is unchanged", () => {
  const html = render("Grind a touch coarser and pour gently.");
  assert.match(html, /Grind a touch coarser and pour gently\./);
  assert.ok(!html.includes("<table"));
  assert.ok(!html.includes("<ul"));
});

test("bold still works and snake_case is no longer italicised", () => {
  const html = render("Use **26 clicks** with brew_again and coffee_library.");
  assert.match(html, /<strong[^>]*>26 clicks<\/strong>/);
  assert.ok(!html.includes("<em"), "underscores in tool names must not pair into italics");
  assert.match(html, /brew_again and coffee_library/);
});

test("real italics still render", () => {
  const html = render("That was *deliberate*.");
  assert.match(html, /<em[^>]*>deliberate<\/em>/);
});
