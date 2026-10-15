// End-to-end: a bag photo can be added AFTER the fact on the coffee detail page
// (a bag added from the chat often has none).
//
//   BASE_URL=http://localhost:3000 AUTH_PIN=1234 \
//   NEXT_PUBLIC_S3_PUBLIC_URL_PREFIX=http://localhost:3000/ci-s3 node tests/smoke/bag-photo-e2e.mjs
//
// Needs the app running against a Postgres with every migration applied (the
// CI screenshots job). CI has no S3, so ONLY /api/upload is stubbed — it
// answers with a URL under the bucket prefix exactly like putObject() does.
// Everything after that is real: the detail page's file input → PATCH
// /api/coffees/[id] → the coffees row → a reload shows the photo.
//   1. a photo-less coffee shows "Add bag photo"
//   2. picking a file stores the URL on the coffee row and renders it
//   3. after a reload the photo is still there (it reached the DB)
//   4. PATCH refuses a URL outside our bucket's bags/ prefix

import { chromium } from "playwright";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const PIN = process.env.AUTH_PIN || "1234";
const PREFIX = process.env.NEXT_PUBLIC_S3_PUBLIC_URL_PREFIX;

// 1×1 transparent PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

async function main() {
  assert.ok(PREFIX, "NEXT_PUBLIC_S3_PUBLIC_URL_PREFIX must be set (same value as the app's)");
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  );
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const login = await ctx.request.post(`${BASE}/api/auth/login`, { data: { type: "pin", pin: PIN } });
  assert.ok(login.ok(), `PIN login failed: ${login.status()}`);

  // A bag as the chat adds it: no photo.
  const add = await ctx.request.post(`${BASE}/api/coffees`, {
    data: { roaster: "E2E Photo Roastery", name: "E2E No Photo", origin: "Colombia", process: "Washed" },
  });
  assert.ok(add.ok(), `POST /api/coffees → ${add.status()}`);
  const { id } = await add.json();

  // 4. foreign URLs are refused before anything is written.
  const foreign = await ctx.request.patch(`${BASE}/api/coffees/${id}`, {
    data: { bagPhotoUrl: "https://example.com/bags/x.jpg" },
  });
  assert.equal(foreign.status(), 400, "PATCH accepted a URL outside the bucket");
  const traversal = await ctx.request.patch(`${BASE}/api/coffees/${id}`, {
    data: { bagPhotoUrl: `${PREFIX}/bags/../uploads/x.jpg` },
  });
  assert.equal(traversal.status(), 400, "PATCH accepted a path traversal");
  console.log("  ✓ PATCH refuses photo URLs outside bags/ in our bucket");

  const page = await ctx.newPage();
  const photoUrl = `${PREFIX}/bags/e2e-${Date.now()}.png`;
  let uploadPath = null;
  await page.route("**/api/upload", async (route) => {
    const body = route.request().postDataBuffer()?.toString("latin1") ?? "";
    uploadPath = /name="path"\r\n\r\n([^\r]+)/.exec(body)?.[1] ?? null;
    await route.fulfill({ json: { url: photoUrl, storagePath: uploadPath } });
  });

  // 1.
  await page.goto(`${BASE}/coffees/${id}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Add bag photo" }).waitFor({ timeout: 60000 });
  console.log("  ✓ a photo-less coffee offers \"Add bag photo\"");

  // 2.
  const patched = page.waitForResponse(
    (r) => r.url().endsWith(`/api/coffees/${id}`) && r.request().method() === "PATCH",
  );
  await page.getByTestId("bag-photo-input").setInputFiles({ name: "bag.png", mimeType: "image/png", buffer: PNG });
  const res = await patched;
  assert.ok(res.ok(), `PATCH → ${res.status()}`);
  assert.ok(uploadPath?.startsWith("bags/"), `upload path not under bags/: ${uploadPath}`);
  await page.locator(`img[src="${photoUrl}"]`).waitFor({ timeout: 15000 });
  console.log("  ✓ picking a file uploads under bags/ and shows the photo");

  // 3.
  const row = await (await ctx.request.get(`${BASE}/api/coffees/${id}`)).json();
  assert.equal(row.bagPhotoUrl, photoUrl, "photo URL did not reach the coffees row");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(`img[src="${photoUrl}"]`).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Change bag photo" }).waitFor({ timeout: 5000 });
  console.log("  ✓ after a reload the photo is still there, with \"Change bag photo\"");

  await browser.close();
  console.log("\nBag photo add-after-the-fact verified end to end.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
