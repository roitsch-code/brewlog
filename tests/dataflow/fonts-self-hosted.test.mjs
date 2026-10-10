// The production build must not fetch fonts from the network.
//
//   node --test tests/dataflow/fonts-self-hosted.test.mjs
//
// next/font/google downloads CSS + font files from Google on every `next build`.
// Four deploys failed on it in Oct 2026 (#609, #611, #612, #613 — a Google
// response the loader could not parse). The fonts are now vendored by
// scripts/vendor-google-fonts.mjs into src/app/fonts/ + src/app/fonts.css.
// This pins that: no next/font/google anywhere, every file the CSS references
// exists, and every CSS variable Tailwind reads is defined.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (/\.(tsx?|jsx?|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

test("no source file imports next/font/google", async () => {
  const offenders = [];
  for (const f of await walk(join(ROOT, "src"))) {
    if (/from\s+["']next\/font\/google["']/.test(await readFile(f, "utf8"))) offenders.push(f);
  }
  assert.deepEqual(offenders, [], "next/font/google fetches from Google at build time — use the vendored fonts");
});

test("the root layout loads the vendored font CSS", async () => {
  const layout = await readFile(join(ROOT, "src/app/layout.tsx"), "utf8");
  assert.match(layout, /import\s+["']\.\/fonts\.css["']/);
});

test("every font file fonts.css references exists and is a real woff2", async () => {
  const css = await readFile(join(ROOT, "src/app/fonts.css"), "utf8");
  const urls = [...css.matchAll(/url\((\.\/fonts\/[^)]+)\)/g)].map((m) => m[1]);
  assert.ok(urls.length >= 10, `expected the vendored faces, found ${urls.length}`);
  assert.ok(![...css.matchAll(/url\(([^)]+)\)/g)].some((m) => /^https?:/.test(m[1])), "no remote font URLs");
  for (const u of new Set(urls)) {
    const p = join(ROOT, "src/app", u);
    const buf = await readFile(p);
    assert.ok((await stat(p)).size > 1000, `${u} too small`);
    assert.equal(buf.subarray(0, 4).toString("latin1"), "wOF2", `${u} is not woff2`);
  }
});

test("every font variable Tailwind reads is defined by fonts.css or Geist", async () => {
  const css = await readFile(join(ROOT, "src/app/fonts.css"), "utf8");
  const tw = await readFile(join(ROOT, "tailwind.config.ts"), "utf8");
  const used = new Set([...tw.matchAll(/var\((--font-[a-z-]+)\)/g)].map((m) => m[1]));
  const geist = new Set(["--font-geist-sans", "--font-geist-mono"]);
  for (const v of used) {
    if (geist.has(v)) continue;
    assert.match(css, new RegExp(`${v}:\\s*'__btts_`), `${v} not defined in fonts.css`);
  }
});
