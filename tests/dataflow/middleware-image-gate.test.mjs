// The image optimizer (/_next/image) must sit behind the session cookie.
//
// Until 2026-10-10 src/middleware.ts waved the whole `/_next` prefix through
// AND excluded `_next/image` from its matcher, so the optimizer answered
// unauthenticated requests from the public internet. Next 14.2.x carries
// unpatched optimizer advisories (incl. GHSA-2xp9-vwfh-vxw4, unauthenticated
// RCE via AVIF input, fixed only in 15.5.24+); gating the route is the
// mitigation until the Next 15 migration. This pins the source so a tidy-up
// that "restores" the shorter prefix fails CI.
//
// Also pins next.config.mjs: the `*.your-objectstorage.com` wildcard (every
// Hetzner bucket of every customer) may only be the fallback when the real
// bucket host is unknown.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const middleware = readFileSync(new URL("../../src/middleware.ts", import.meta.url), "utf8");
const nextConfig = readFileSync(new URL("../../next.config.mjs", import.meta.url), "utf8");

test("middleware STATIC_PATHS allows /_next/static only, never the bare /_next prefix", () => {
  const m = middleware.match(/const STATIC_PATHS = \[([^\]]*)\]/);
  assert.ok(m, "STATIC_PATHS array not found");
  const entries = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  assert.ok(entries.includes("/_next/static"), "/_next/static must stay exempt (chunks, fonts)");
  assert.ok(!entries.includes("/_next"), "the bare /_next prefix exempts /_next/image — not allowed");
  assert.ok(!entries.some((e) => e.startsWith("/_next/image")), "/_next/image must not be exempt");
});

test("middleware matcher does not exclude _next/image", () => {
  const m = middleware.match(/matcher:\s*\[\s*"([^"]+)"/);
  assert.ok(m, "matcher not found");
  assert.ok(m[1].includes("_next/static"), "matcher must still skip _next/static");
  assert.ok(!m[1].includes("_next/image"), "matcher must run the middleware for _next/image");
});

test("next.config allows the object-storage wildcard only as the fallback for an unknown bucket host", () => {
  const block = nextConfig.slice(nextConfig.indexOf("remotePatterns"), nextConfig.indexOf("firebasestorage"));
  assert.ok(block.includes("s3Hostname"), "remotePatterns must key off the configured bucket host");
  // The wildcard must sit in the else-branch of the s3Hostname ternary, not as an unconditional entry.
  assert.match(block, /s3Hostname\s*\?\s*\[[^\]]*s3Hostname[^\]]*\]\s*:\s*\[[^\]]*your-objectstorage\.com/s,
    "wildcard must be the fallback branch, never unconditional");
});
