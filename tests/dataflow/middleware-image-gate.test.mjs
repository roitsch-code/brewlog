// The image optimizer (/_next/image) must be DEAD, not merely gated.
//
// 2026-10-10, first attempt (#627): /_next/image was moved inside the auth
// middleware's matcher. Verified against a local production build AND live
// after the deploy: Next 14.2.x answers /_next/image BEFORE the middleware
// runs (x-nextjs-cache: HIT, 200, no cookie) while /coffees redirects to
// /login — the matcher is irrelevant for that route. Next 14 carries unpatched
// optimizer advisories (incl. GHSA-2xp9-vwfh-vxw4, unauthenticated RCE via
// AVIF input, fixed only in 15.5.24+), so the second attempt removes the
// surface: `images.unoptimized: true` (next/image renders a plain <img>; the
// only consumer is the scan preview) and the Caddyfile answers /_next/image*
// with 404 at the edge. These pins keep both in place until the Next 15
// migration, and keep the middleware from re-exempting the bare /_next prefix.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const middleware = readFileSync(new URL("../../src/middleware.ts", import.meta.url), "utf8");
const nextConfig = readFileSync(new URL("../../next.config.mjs", import.meta.url), "utf8");
const caddyfile = readFileSync(new URL("../../Caddyfile", import.meta.url), "utf8");

test("next.config turns the image optimizer off", () => {
  const images = nextConfig.slice(nextConfig.indexOf("images:"), nextConfig.indexOf("remotePatterns"));
  assert.match(images, /unoptimized:\s*true/, "images.unoptimized must be true (Next 14 serves /_next/image past the middleware)");
});

test("Caddy answers /_next/image at the edge before the app sees it", () => {
  const site = caddyfile.slice(caddyfile.indexOf("bettertastethansorry.com"), caddyfile.indexOf("auth.markus-reuter.com"));
  assert.match(site, /@imgopt\s+path\s+\/_next\/image\*/, "named matcher for /_next/image* missing in the BrewLog site block");
  assert.match(site, /handle\s+@imgopt\s*\{\s*respond\s+404\s*\}/s, "the /_next/image* handler must respond 404");
  assert.match(site, /handle\s*\{\s*reverse_proxy\s+brewlog-app:3000\s*\}/s, "the catch-all handle must still proxy to brewlog-app");
});

test("middleware STATIC_PATHS allows /_next/static only, never the bare /_next prefix", () => {
  const m = middleware.match(/const STATIC_PATHS = \[([^\]]*)\]/);
  assert.ok(m, "STATIC_PATHS array not found");
  const entries = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  assert.ok(entries.includes("/_next/static"), "/_next/static must stay exempt (chunks, fonts)");
  assert.ok(!entries.includes("/_next"), "the bare /_next prefix must not come back");
});

test("next.config allows the object-storage wildcard only as the fallback for an unknown bucket host", () => {
  const block = nextConfig.slice(nextConfig.indexOf("remotePatterns"), nextConfig.indexOf("firebasestorage"));
  assert.match(block, /s3Hostname\s*\?\s*\[[^\]]*s3Hostname[^\]]*\]\s*:\s*\[[^\]]*your-objectstorage\.com/s,
    "wildcard must be the fallback branch, never unconditional");
});
