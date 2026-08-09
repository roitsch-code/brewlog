// The home chat can put a bag INTO the Coffee Library itself (POST /api/coffees
// via the add_coffee action pill). Before this, a coffee row could only be born
// as a side effect of saving a brew session, so the chat — which reads a bag off
// a photo perfectly well — had to tell the user to go type it into the scan form
// by hand and come back.
//
//   node --test tests/dataflow/chat-add-coffee.test.mjs
//
// WHAT THIS LOCKS, and why each one is silent when it breaks:
//
//  1. coffeeKeyFor() must reproduce the slug POST /api/sessions has always used
//     inline. The id is derived, not random, which is what lets a chat-added bag
//     MERGE with the brew you log for it weeks later. If the two derivations
//     ever drift you get two rows for the same bag and no error anywhere.
//  2. buildNewCoffeePayload() must carry every field through and take the bag
//     photo from the turn's attachment rather than the model. A dropped field
//     just means a bag quietly missing its variety.
//  3. coachNoteFrom() must require BOTH halves — a lone observation would write
//     a note with no advice in it that the recommender then carries forever.

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const entry = `
export { coffeeKeyFor } from ${JSON.stringify(path.join(ROOT, "src/lib/coffee/coffeeKey.ts"))};
export { guardRoastYear } from ${JSON.stringify(path.join(ROOT, "src/lib/coffee/roastDate.ts"))};
export { buildNewCoffeePayload, coachNoteFrom, lastAttachedPhoto } from ${JSON.stringify(
  path.join(ROOT, "src/lib/chat/addCoffee.ts"),
)};
`;
const dir = await mkdtemp(join(tmpdir(), "addcoffee-"));
const out = join(dir, "m.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { coffeeKeyFor, guardRoastYear, buildNewCoffeePayload, coachNoteFrom, lastAttachedPhoto } =
  await import(pathToFileURL(out).href);

// The expression POST /api/sessions used inline before it was extracted. If
// coffeeKeyFor ever stops matching this, chat-added bags fork duplicate rows.
const legacySessionsSlug = (roaster, name) =>
  `${roaster}__${name}`.toLowerCase().replace(/[^a-z0-9]/g, "_");

test("coffeeKeyFor reproduces the sessions-route slug exactly", () => {
  const cases = [
    ["DAK Coffee Roasters", "Berry Swirl"],
    ["Rösterei Vier / The Commonage", "Süßhang"],
    ["April", "Rolf's 4:6"],
    ["Friedhats", "Quiquira — Lot #3"],
    ["La Cabra", "Terra"],
    ["", ""],
  ];
  for (const [roaster, name] of cases) {
    assert.equal(
      coffeeKeyFor(roaster, name),
      legacySessionsSlug(roaster, name),
      `slug drifted for ${roaster} / ${name}`,
    );
  }
});

test("coffeeKeyFor is stable for the same bag added twice", () => {
  // The merge in POST /api/coffees and POST /api/sessions both hinge on this.
  assert.equal(
    coffeeKeyFor("DAK Coffee Roasters", "Berry Swirl"),
    coffeeKeyFor("DAK Coffee Roasters", "Berry Swirl"),
  );
  assert.equal(coffeeKeyFor("DAK Coffee Roasters", "Berry Swirl"), "dak_coffee_roasters__berry_swirl");
});

test("different bags never collapse onto one id", () => {
  assert.notEqual(
    coffeeKeyFor("DAK Coffee Roasters", "Berry Swirl"),
    coffeeKeyFor("DAK Coffee Roasters", "Currant Mood"),
  );
});

test("buildNewCoffeePayload carries every field the chat read", () => {
  const payload = buildNewCoffeePayload(
    {
      roaster: "DAK Coffee Roasters",
      name: "Currant Mood",
      origin: "Kenya",
      region: "Nyeri",
      variety: "SL28, SL34",
      process: "Natural",
      roastLevel: "Light",
      roastDate: "2026-07-28",
      fermentationStyle: "Spontaneous Anaerobic",
      cuppingScore: 88.5,
      tastingNotes: ["Blackcurrant", "Jam", "Black Tea"],
    },
    "https://cdn.example.com/uploads/chat-1.jpg",
  );

  assert.equal(payload.roaster, "DAK Coffee Roasters");
  assert.equal(payload.name, "Currant Mood");
  assert.equal(payload.origin, "Kenya");
  assert.equal(payload.region, "Nyeri");
  assert.equal(payload.variety, "SL28, SL34");
  assert.equal(payload.process, "Natural");
  assert.equal(payload.roastLevel, "Light");
  assert.equal(payload.roastDate, "2026-07-28");
  assert.equal(payload.fermentationStyle, "Spontaneous Anaerobic");
  assert.equal(payload.cuppingScore, 88.5);
  assert.deepEqual(payload.tastingNotesFromBag, ["Blackcurrant", "Jam", "Black Tea"]);
  // The bag photo comes from the turn's attachment, never from the model.
  assert.equal(payload.bagPhotoUrl, "https://cdn.example.com/uploads/chat-1.jpg");
});

test("a bag with only roaster and name is still addable", () => {
  // "Just add it" with nothing else known must work — omitted beats guessed.
  const payload = buildNewCoffeePayload({ roaster: "DAK", name: "Berry Swirl" });
  assert.equal(payload.roaster, "DAK");
  assert.equal(payload.name, "Berry Swirl");
  for (const field of [
    "origin",
    "region",
    "variety",
    "process",
    "roastLevel",
    "roastDate",
    "fermentationStyle",
    "cuppingScore",
    "tastingNotesFromBag",
    "bagPhotoUrl",
  ]) {
    assert.equal(payload[field], undefined, `${field} should be omitted, not empty`);
  }
});

test("blank and whitespace-only fields become undefined, never empty strings", () => {
  // An empty string would overwrite a real value on the merge path.
  const payload = buildNewCoffeePayload({
    roaster: "  DAK  ",
    name: "  Berry Swirl  ",
    variety: "   ",
    origin: "",
    tastingNotes: ["  ", ""],
  });
  assert.equal(payload.roaster, "DAK");
  assert.equal(payload.name, "Berry Swirl");
  assert.equal(payload.variety, undefined);
  assert.equal(payload.origin, undefined);
  assert.equal(payload.tastingNotesFromBag, undefined);
});

test("no attached photo means no bag photo, not a broken one", () => {
  assert.equal(buildNewCoffeePayload({ roaster: "DAK", name: "X" }, null).bagPhotoUrl, undefined);
  assert.equal(buildNewCoffeePayload({ roaster: "DAK", name: "X" }).bagPhotoUrl, undefined);
});

test("coachNoteFrom requires both halves", () => {
  assert.equal(coachNoteFrom("Observation only.", undefined, []), null);
  assert.equal(coachNoteFrom(undefined, "Suggestion only.", []), null);
  assert.equal(coachNoteFrom("   ", "Suggestion.", []), null);
  assert.equal(coachNoteFrom("Observation.", "   ", []), null);

  const note = coachNoteFrom("Currant Mood is a Kenyan natural.", "Brew at 92–93°C.", [
    "origin",
    "process",
  ]);
  assert.equal(note.observation, "Currant Mood is a Kenyan natural.");
  assert.equal(note.suggestion, "Brew at 92–93°C.");
  assert.deepEqual(note.citationFields, ["origin", "process"]);
});

// The bag photo is attached a turn or two BEFORE the add, because the chat is
// told to ask for the roast date first. The first shipped version only used the
// current turn's attachment, so a real add landed in the library with no photo.
test("lastAttachedPhoto finds the bag photo from an earlier turn", () => {
  const thread = [
    { role: "user", content: "What do you think of this DAK?", imageUrl: "https://cdn/bag.jpg" },
    { role: "assistant", content: "DAK Coffee Roasters — Currant Mood…" },
    { role: "user", content: "Roasted 30 July. Add it." },
    { role: "assistant", content: "Ready to add." },
  ];
  assert.equal(lastAttachedPhoto(thread), "https://cdn/bag.jpg");
});

test("lastAttachedPhoto takes the MOST RECENT photo, not the first", () => {
  const thread = [
    { role: "user", content: "this one?", imageUrl: "https://cdn/old.jpg" },
    { role: "assistant", content: "…" },
    { role: "user", content: "and this one", imageUrl: "https://cdn/new.jpg" },
  ];
  assert.equal(lastAttachedPhoto(thread), "https://cdn/new.jpg");
});

test("lastAttachedPhoto ignores assistant messages and empty threads", () => {
  assert.equal(lastAttachedPhoto([]), undefined);
  assert.equal(lastAttachedPhoto([{ role: "user", content: "no photo here" }]), undefined);
  // An assistant message carrying an image must never become the bag photo.
  assert.equal(
    lastAttachedPhoto([{ role: "assistant", content: "x", imageUrl: "https://cdn/nope.jpg" }]),
    undefined,
  );
});

test("guardRoastYear pulls an ambiguous month/day stamp into the current year", () => {
  // A bag prints "18.05" with no year; a reader resolving it to LAST year makes
  // a two-week-old bag look 14 months old (PR #216).
  const now = new Date();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const iso = twoWeeksAgo.toISOString().slice(0, 10);
  const lastYear = new Date(twoWeeksAgo);
  lastYear.setUTCFullYear(lastYear.getUTCFullYear() - 1);

  assert.equal(guardRoastYear(lastYear.toISOString().slice(0, 10)), iso);
  // A genuinely recent date is returned untouched.
  assert.equal(guardRoastYear(iso), iso);
});

test("guardRoastYear leaves a genuinely old bag alone", () => {
  // Bumping this forward would land in the future, so it must stay put.
  const now = new Date();
  const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const iso = threeMonthsAgo.toISOString().slice(0, 10);
  assert.equal(guardRoastYear(iso), iso);
});
