// Visual smoke test — drives the running app with a headless mobile
// browser, logs in via the PIN path, and screenshots every key screen so
// a human (or Claude) can eyeball layout regressions on a PR without
// installing or running anything. Screenshots land in OUT_DIR and are
// uploaded as a CI artifact.
//
// It is also a crude liveness check: any screen that returns a 5xx (a real
// server crash, not an AI key being absent) fails the job. Pages that call
// AI endpoints still render their shell on an empty DB / missing key, so
// they screenshot fine — only the AI content area is empty.
//
// Run against a server already listening on BASE_URL:
//   BASE_URL=http://localhost:3000 AUTH_PIN=1234 node tests/smoke/screenshot.mjs
//
// Playwright is installed ad-hoc in CI (not a committed dependency) to keep
// local installs lean — see .github/workflows/ci.yml.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const PIN = process.env.AUTH_PIN || "1234";
const OUT = process.env.OUT_DIR || "screenshots";

// Static routes that render on an empty database (lists show empty states,
// forms show their first step). `(light)` is URL-invisible. Dynamic
// [id]/[slug] routes are screenshotted opportunistically below if the
// seeded/empty DB happens to have a row.
const STATIC_ROUTES = [
  ["login", "/login"],
  ["home", "/"],
  ["coffees", "/coffees"],
  ["coffee-drip-new", "/coffees/drip/new"],
  ["brew-new", "/brew/new"],
  ["cafes", "/cafes"],
  ["cafes-map", "/cafes/map"],
  ["taste", "/taste"],
  ["past-conversations", "/past-conversations"],
  ["onboarding", "/onboarding"],
  ["offline", "/offline"],
];

async function settle(page) {
  // Client components fetch after mount; networkidle is unreliable on the
  // home chat (it streams/polls), so give a fixed settle window instead.
  await page.waitForTimeout(2500);
}

async function shoot(page, name, path, failures) {
  const url = `${BASE}${path}`;
  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    const status = res ? res.status() : 0;
    await settle(page);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    const flag = status >= 500 ? " ❌ 5xx" : status === 0 ? " ⚠️ no-response" : "";
    console.log(`  ${String(status).padEnd(3)} ${path} → ${name}.png${flag}`);
    if (status >= 500) failures.push(`${path} returned ${status}`);
  } catch (err) {
    console.log(`  ERR ${path} → ${err.message}`);
    failures.push(`${path} threw: ${err.message}`);
  }
}

async function firstId(ctx, apiPath, key = "id") {
  try {
    const res = await ctx.request.get(`${BASE}${apiPath}`);
    if (!res.ok()) return null;
    const data = await res.json();
    const arr = Array.isArray(data) ? data : data.coffees || data.sessions || data.dripBags || data.items || [];
    return arr.length ? arr[0][key] : null;
  } catch {
    return null;
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  // iPhone-ish viewport — this is a phone-first PWA.
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  // Authenticate via the PIN path; the cf_session cookie lands in the
  // context jar shared with every page.
  const login = await ctx.request.post(`${BASE}/api/auth/login`, {
    data: { type: "pin", pin: PIN },
  });
  if (!login.ok()) {
    console.error(`PIN login failed: ${login.status()} ${await login.text()}`);
    process.exit(1);
  }
  console.log("Logged in via PIN. Capturing screens:");

  const page = await ctx.newPage();
  const failures = [];

  for (const [name, path] of STATIC_ROUTES) {
    await shoot(page, name, path, failures);
  }

  // Opportunistic dynamic routes — only fire if the DB has a row.
  const coffeeId = await firstId(ctx, "/api/coffees");
  if (coffeeId) await shoot(page, "coffee-detail", `/coffees/${coffeeId}`, failures);
  const sessionId = await firstId(ctx, "/api/sessions");
  if (sessionId) await shoot(page, "brew-detail", `/brew/${sessionId}`, failures);
  const dripId = await firstId(ctx, "/api/drip-bags");
  if (dripId) await shoot(page, "drip-detail", `/coffees/drip/${dripId}`, failures);

  await browser.close();

  if (failures.length) {
    console.error(`\n${failures.length} screen(s) failed:`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log("\nAll screens rendered without server errors.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
