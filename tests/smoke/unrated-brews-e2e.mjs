// End-to-end: a brew that reaches the taste log but is not rated is never lost.
//
//   BASE_URL=http://localhost:3000 AUTH_PIN=1234 node tests/smoke/unrated-brews-e2e.mjs
//
// Needs the app running against a Postgres with every migration applied
// (the CI screenshots job). Drives the REAL routes in headless Chromium:
//   1. a finished brew lands on the Log screen → it is parked in pending_brews
//   2. the phone's draft is wiped (what New Session / Brew Again used to do)
//   3. Home shows "Rate your <coffee>" → tap → Log → 4 stars → Save → Save Brew
//   4. the session exists, dated to when it was BREWED, and the pending row is gone
//   5. Dismiss on /brew/unrated hides the Home card but keeps the brew ratable
// A producer-only test would not catch a broken wire between these — this does.

import { chromium } from "playwright";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const PIN = process.env.AUTH_PIN || "1234";

function seedDraft(name, step = "log") {
  return JSON.stringify({
    state: {
      step,
      skipScan: true,
      draft: {
        type: "coffee",
        mode: "home",
        coffee: { roaster: "E2E Roastery", name, origin: "Kenya", process: "Washed", roastLevel: "Light", aiExtracted: false },
        brew: { methodUsed: "V60", actualTimeSec: 185, followedRecipe: true },
      },
    },
    version: 0,
  });
}

async function json(ctx, path) {
  const r = await ctx.request.get(`${BASE}${path}`);
  assert.ok(r.ok(), `${path} → ${r.status()}`);
  return r.json();
}

async function parkBrew(page, name) {
  await page.goto(`${BASE}/offline`, { waitUntil: "domcontentloaded" });
  await page.evaluate((v) => localStorage.setItem("brew-flow", v), seedDraft(name));
  const put = page.waitForResponse(
    (r) => r.url().includes("/api/pending-brews/") && r.request().method() === "PUT",
    { timeout: 60000 },
  );
  await page.goto(`${BASE}/brew/new`, { waitUntil: "domcontentloaded" });
  const res = await put;
  assert.equal(res.status(), 200, "pending-brews PUT failed");
  return JSON.parse(res.request().postData()).createdAt;
}

async function main() {
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  );
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const login = await ctx.request.post(`${BASE}/api/auth/login`, { data: { type: "pin", pin: PIN } });
  assert.ok(login.ok(), `PIN login failed: ${login.status()}`);
  const page = await ctx.newPage();

  // 0. App-start rescue: a brewed draft left on the phone (timer finished,
  //    never saved, from before the Log screen parked on open) is parked the
  //    moment the app opens on Home — no visit to the brew flow needed.
  await page.goto(`${BASE}/offline`, { waitUntil: "domcontentloaded" });
  await page.evaluate((v) => localStorage.setItem("brew-flow", v), seedDraft("E2E Rescued", "summary"));
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Rate your E2E Rescued/ }).waitFor({ timeout: 60000 });
  const rescued = (await json(ctx, "/api/pending-brews")).find((r) => r.coffeeName === "E2E Rescued");
  assert.ok(rescued, "orphaned draft was not rescued");
  await ctx.request.patch(`${BASE}/api/pending-brews/${rescued.id}`, { data: { dismissed: true } });
  await page.evaluate(() => localStorage.removeItem("brew-flow"));
  console.log("  ✓ App start rescued an unsaved brewed draft onto the Home card");

  // 1. Park.
  const brewedAt = await parkBrew(page, "E2E Kiambu");
  let open = await json(ctx, "/api/pending-brews");
  const mine = open.find((r) => r.coffeeName === "E2E Kiambu");
  assert.ok(mine, "brew was not parked server-side");
  assert.equal(mine.method, "V60");
  console.log("  ✓ Log screen parked the brew in pending_brews");

  // 2. Wipe the phone's draft — the old loss path.
  await page.evaluate(() => localStorage.removeItem("brew-flow"));

  // 3. Home card → Log → rate → save.
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const card = page.getByRole("button", { name: /Rate your E2E Kiambu/ });
  await card.waitFor({ timeout: 60000 });
  console.log("  ✓ Home shows the reminder card");
  await card.click();
  await page.waitForURL(/\/brew\/new$/, { timeout: 30000 });
  await page.getByRole("button", { name: "4 star" }).first().click({ timeout: 60000 });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const post = page.waitForResponse(
    (r) => r.url().endsWith("/api/sessions") && r.request().method() === "POST",
    { timeout: 60000 },
  );
  await page.getByRole("button", { name: "Save Brew" }).click({ timeout: 60000 });
  const postRes = await post;
  assert.equal(postRes.status(), 200, `sessions POST → ${postRes.status()}`);
  const body = JSON.parse(postRes.request().postData());
  assert.equal(body.pendingBrewId, mine.id, "save did not carry the pending id");
  console.log("  ✓ Rated from the card and saved");

  // 4. Session dated to the brew; pending row gone.
  const sessions = await json(ctx, "/api/sessions?limit=20");
  const saved = sessions.find((s) => s.coffee?.name === "E2E Kiambu");
  assert.ok(saved, "session not saved");
  assert.equal(saved.result?.rating, 4);
  assert.equal(new Date(saved.createdAt).getTime(), new Date(brewedAt).getTime(), "createdAt is not the brew time");
  open = await json(ctx, "/api/pending-brews?all=true");
  assert.ok(!open.some((r) => r.id === mine.id), "pending row survived the save");
  console.log("  ✓ Session dated to the brew, pending row removed");

  // 5. Dismiss keeps the brew but drops the reminder.
  await parkBrew(page, "E2E Gesha");
  await page.goto(`${BASE}/brew/unrated`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Dismiss" }).first().click({ timeout: 60000 });
  await page.getByText("Dismissed", { exact: true }).waitFor({ timeout: 15000 });
  open = await json(ctx, "/api/pending-brews");
  assert.ok(!open.some((r) => r.coffeeName === "E2E Gesha"), "dismissed brew still counted on Home");
  const all = await json(ctx, "/api/pending-brews?all=true");
  const g = all.find((r) => r.coffeeName === "E2E Gesha");
  assert.ok(g && g.dismissedAt, "dismissed brew was not kept");
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  assert.equal(await page.getByRole("button", { name: /Rate your|waiting for a rating/ }).count(), 0, "card shown for a dismissed brew");
  console.log("  ✓ Dismiss hides the card, keeps the brew on /brew/unrated");

  await browser.close();
  console.log("\nUnrated-brews flow verified end to end.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
