// The /recommend prompt contradicted itself (audit 2026-10-03): "Do not quote a
// total time" vs "always reference the TOTAL brew time"; "neither candidate is
// primary, order arbitrary" vs the convergence rule that candidate 1 is the
// best-fit / reproduction answer; Origami "stir at bloom only" vs "same as
// V60 — stir 3–5×"; a block called "REFERENCE RECIPE LIBRARY" that is actually
// headed "RELEVANT REFERENCE RECIPES"; a dose rule "do NOT default to 23g" next
// to "23g:350ml" fallbacks; and the chat telling the model "the Orea has one
// entry" when it has eleven. This suite keeps each one resolved.
//
//   node --test tests/dataflow/prompt-contradictions.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const prompt = await readFile(path.join(ROOT, "src/lib/claude/recommendPrompt.ts"), "utf8");
const rec = await readFile(path.join(ROOT, "src/lib/claude/recommend.ts"), "utf8");
const rot = await readFile(path.join(ROOT, "src/lib/claude/methodRotation.ts"), "utf8");
const rg = await readFile(path.join(ROOT, "src/lib/claude/repeatGuard.ts"), "utf8");
const chat = await readFile(path.join(ROOT, "src/lib/chat/agentContext.ts"), "utf8");

test("total time: one rule, not two", () => {
  assert.doesNotMatch(prompt, /Do not quote a total time/);
  assert.match(prompt, /TIME IN PROSE: the app shows the real clock/);
});

test("candidate order is NOT arbitrary — candidate 1 is best-fit/convergence, candidate 2 explores", () => {
  for (const src of [prompt, rec]) {
    assert.doesNotMatch(src, /neither is primary/);
    assert.doesNotMatch(src, /Order in the array is arbitrary/);
    assert.doesNotMatch(src, /hypothesis-A \/ hypothesis-B/);
  }
  assert.match(prompt, /candidate 1 is the best-fit \/ convergence answer, candidate 2 is the exploration slot/);
});

test("Origami agitation: cone like a V60, wave swirl-only — stated once, no 'bloom only' twin", () => {
  assert.match(prompt, /Origami \(cone filter\): same as V60 at bloom/);
  assert.match(prompt, /Origami \(wave filter\): SWIRL ONLY at bloom/);
  assert.doesNotMatch(prompt, /Origami Dripper: light stir 1–2× at bloom only/);
});

test("every mention of the per-turn recipe block uses its real heading", () => {
  for (const src of [prompt, rec, rot, rg]) assert.doesNotMatch(src, /REFERENCE RECIPE LIBRARY/);
  for (const src of [rec, rot]) assert.doesNotMatch(src, /library above/);
  assert.match(rec, /"RELEVANT REFERENCE RECIPES"/, "the heading itself");
});

test("no fixed-dose fallback contradicts the 'do NOT default to a fixed 23g' rule", () => {
  assert.doesNotMatch(rec, /23g dose/);
  assert.doesNotMatch(rec, /23g:350ml/);
  assert.match(rec, /do NOT default to a fixed 23g/);
});

test("the chat's corpus header counts the Orea entries instead of asserting 'one'", () => {
  assert.doesNotMatch(chat, /the Orea has one entry/);
  assert.match(chat, /\/orea\/i\.test\(b\)/);
});

test("no change-history prose in the system prompt", () => {
  assert.doesNotMatch(prompt, /It used to carry a fixed list/);
  assert.doesNotMatch(prompt, /they were removed in Aug 2026/);
});
