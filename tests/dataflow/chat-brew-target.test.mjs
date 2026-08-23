// The chat's Brew pill must point at something the tap can actually brew.
//
//   node --test tests/dataflow/chat-brew-target.test.mjs
//
// Anchor case (2026-08-23): the owner photographed DAK Cassis — a bag NOT in
// the library — and asked for a recipe. The model invented the id
// "dak_coffee_roasters__cassis" (plausible, because ids are coffeeKeyFor slugs
// — a guess can be byte-identical to the id the bag WOULD get), the pill's
// fetch found no row, and the tap discarded a fully validated recipe and
// navigated to a blank brew flow. Every earlier pill carried a real library id,
// which is why the button "suddenly" died on the first-ever new-bag recipe.
//
// Two halves, both covered here, both pinned at the CONSUMER (the #530/#535
// lesson — a helper that works but is called by nothing has shipped twice):
//   - server: resolveStartBrewTarget bounces an unknown id back to the model
//     unless roaster+name make the pill brewable without a row;
//   - client: chatBrewIdentity synthesises the identity the timer needs from
//     roaster+name, so a bag with no library row still brews (and the session
//     save creates the row on the same derived slug).

import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

const ROOT = process.cwd();
const dir = await mkdtemp(join(tmpdir(), "brewtarget-"));
const out = join(dir, "t.mjs");
await build({
  stdin: {
    contents: `export { resolveStartBrewTarget, chatBrewIdentity } from ${JSON.stringify(
      path.join(ROOT, "src/lib/chat/chatBrewTarget.ts"),
    )};
export { coffeeKeyFor } from ${JSON.stringify(path.join(ROOT, "src/lib/coffee/coffeeKey.ts"))};`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "silent",
});
const { resolveStartBrewTarget, chatBrewIdentity, coffeeKeyFor } = await import(
  pathToFileURL(out).href
);

const LIBRARY = new Set(["sprout__lush_lemons", "mokxa__taba", "dak_coffee_roasters__berry_swirl"]);

// ── resolveStartBrewTarget (the server gate) ────────────────────────────────

test("ANCHOR: the real dead pill — invented id, no names — is rejected", () => {
  // Byte-for-byte the payload the production DB showed for the 08:33 pill.
  const r = resolveStartBrewTarget({ id: "dak_coffee_roasters__cassis" }, LIBRARY);
  assert.equal(r.ok, false);
  assert.match(r.problem, /dak_coffee_roasters__cassis/);
  assert.match(r.problem, /roaster and name/i);
});

test("a known library id passes untouched", () => {
  const r = resolveStartBrewTarget({ id: "sprout__lush_lemons" }, LIBRARY);
  assert.deepEqual(r, { ok: true, id: "sprout__lush_lemons" });
});

test("unknown id + roaster/name → ok with the guessed id STRIPPED", () => {
  const r = resolveStartBrewTarget(
    { id: "dak_coffee_roasters__cassis", roaster: "DAK Coffee Roasters", name: "Cassis" },
    LIBRARY,
  );
  assert.equal(r.ok, true);
  assert.equal(r.id, undefined, "a guessed id must not survive to cost the client a doomed fetch");
});

test("no id + roaster/name → ok (the new-bag path)", () => {
  const r = resolveStartBrewTarget({ roaster: "DAK Coffee Roasters", name: "Cassis" }, LIBRARY);
  assert.equal(r.ok, true);
  assert.equal(r.id, undefined);
});

test("names that ARE a library bag resolve to its real id", () => {
  // The model named a library bag without copying its id — the derived slug
  // finds the row, so the tap gets the real photo/Field/roast date.
  const r = resolveStartBrewTarget({ roaster: "Sprout", name: "Lush Lemons" }, LIBRARY);
  assert.deepEqual(r, { ok: true, id: "sprout__lush_lemons" });
});

test("nothing to brew from — no id, no names — is rejected", () => {
  const r = resolveStartBrewTarget({}, LIBRARY);
  assert.equal(r.ok, false);
  assert.match(r.problem, /roaster and name/i);
});

// ── chatBrewIdentity (the client fallback) ──────────────────────────────────

test("identity synthesised from roaster+name, coffeeId on the derived slug", () => {
  const id = chatBrewIdentity({
    roaster: "DAK Coffee Roasters",
    name: "Cassis",
    origin: "Kenya",
    process: "Washed",
  });
  assert.ok(id);
  assert.equal(id.roaster, "DAK Coffee Roasters");
  assert.equal(id.name, "Cassis");
  assert.equal(id.origin, "Kenya");
  assert.equal(id.process, "Washed");
  // The slug the session save will create/merge the coffee row on — and,
  // pointedly, exactly the id the model guessed for the dead pill.
  assert.equal(id.coffeeId, "dak_coffee_roasters__cassis");
  assert.equal(id.coffeeId, coffeeKeyFor("DAK Coffee Roasters", "Cassis"));
  assert.equal(id.aiExtracted, false);
});

test("no identity without both names", () => {
  assert.equal(chatBrewIdentity({ roaster: "DAK Coffee Roasters" }), null);
  assert.equal(chatBrewIdentity({ name: "Cassis" }), null);
  assert.equal(chatBrewIdentity({}), null);
  assert.equal(chatBrewIdentity({ roaster: "  ", name: "Cassis" }), null);
});

test("missing origin/process get honest defaults, not fabrications", () => {
  const id = chatBrewIdentity({ roaster: "DAK Coffee Roasters", name: "Cassis" });
  assert.equal(id.origin, "");
  assert.equal(id.process, "Other");
});

// ── Consumer pinning (source-level) ─────────────────────────────────────────
// A working helper called by nothing has shipped twice in this repo (#530,
// #535). These assert the two surfaces actually run the helpers.

test("the route gates start_brew through resolveStartBrewTarget with the turn's ids", async () => {
  const src = await readFile(
    path.join(ROOT, "src/app/api/explore-agent/route.ts"),
    "utf8",
  );
  assert.match(src, /import \{ resolveStartBrewTarget \} from "@\/lib\/chat\/chatBrewTarget"/);
  assert.match(src, /resolveStartBrewTarget\(action, knownCoffeeIds\)/);
  // knownCoffeeIds must be built from the SAME library the prompt context uses.
  assert.match(src, /knownCoffeeIds[\s\S]{0,200}library\.map\(\(c\) => c\.id\)/);
});

test("the pill falls back to chatBrewIdentity instead of requiring a library row", async () => {
  const src = await readFile(
    path.join(ROOT, "src/components/ui/light/ActionPill.tsx"),
    "utf8",
  );
  assert.match(src, /import \{ chatBrewIdentity \} from "@\/lib\/chat\/chatBrewTarget"/);
  assert.match(src, /chatBrewIdentity\(action\)/);
  // The old guard required an id before doing ANYTHING — that is the exact
  // line that discarded the DAK Cassis recipe. It must not come back.
  assert.doesNotMatch(
    src,
    /\(action\.destination === "brew_again" \|\| action\.destination === "start_brew"\) && action\.id\)/,
    "the brew branch must run even without an id — the id-less start_brew is the whole fix",
  );
});

test("the tool schema offers roaster+name for not-yet-added bags", async () => {
  const src = await readFile(path.join(ROOT, "src/lib/chat/agentPrompt.ts"), "utf8");
  const schema = src.slice(src.indexOf('name: "start_brew"'), src.indexOf('name: "remember_advice"'));
  assert.match(schema, /roaster: \{ type: "string"/);
  assert.match(schema, /name: \{ type: "string"/);
  assert.match(schema, /NEVER invent an id/i);
});
