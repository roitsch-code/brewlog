// Widget deep-link parse tests (iOS shell G2). Bundles the REAL
// widgetDeepLinks.ts with esbuild so the asserted parsing is the one the app
// actually runs when a home-screen widget tile is tapped.
//
//   node --test tests/dataflow/widget-deeplinks.test.mjs
//
// What's locked down: the `btts://` scheme maps to the right action, the
// brew action extracts coffeeId, and anything that isn't ours returns null
// (so a stray universal-link / http URL can never seed a brew). A typo here
// would send a widget tap to the wrong screen — or nowhere.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

// widgetDeepLinks.ts imports the flow store (zustand persist → localStorage at
// module load). Stub localStorage so the bundle imports cleanly under node.
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const ROOT = process.cwd();
const entry = `export { parseWidgetUrl } from ${JSON.stringify(
  path.join(ROOT, "src/lib/native/widgetDeepLinks.ts"),
)};`;
const dir = await mkdtemp(join(tmpdir(), "widgetdl-"));
const out = join(dir, "b.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { parseWidgetUrl } = await import(pathToFileURL(out).href);

test("scan link → scan action", () => {
  assert.deepEqual(parseWidgetUrl("btts://scan"), { kind: "scan" });
});

test("brew link extracts coffeeId", () => {
  assert.deepEqual(parseWidgetUrl("btts://brew?coffeeId=abc123"), {
    kind: "brew",
    coffeeId: "abc123",
  });
});

test("brew link with no coffeeId → null id (handler falls back to library)", () => {
  assert.deepEqual(parseWidgetUrl("btts://brew"), { kind: "brew", coffeeId: null });
});

test("action match is case-insensitive", () => {
  assert.deepEqual(parseWidgetUrl("btts://SCAN"), { kind: "scan" });
  assert.equal(parseWidgetUrl("btts://Brew?coffeeId=x").kind, "brew");
});

test("triple-slash host-less form still parses", () => {
  assert.deepEqual(parseWidgetUrl("btts:///scan"), { kind: "scan" });
});

test("non-btts schemes return null", () => {
  assert.equal(parseWidgetUrl("https://bettertastethansorry.com/brew?coffeeId=x"), null);
  assert.equal(parseWidgetUrl("http://evil.example/brew"), null);
});

test("unknown btts action returns null", () => {
  assert.equal(parseWidgetUrl("btts://settings"), null);
});

test("garbage / empty input returns null", () => {
  assert.equal(parseWidgetUrl("not a url"), null);
  assert.equal(parseWidgetUrl(""), null);
});
