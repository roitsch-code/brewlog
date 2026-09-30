// Facts in the /recommend and chat prompts must agree with the verified corpus.
//
//   node --test tests/dataflow/prompt-facts.test.mjs
//
// Found in the 2026-09-30 review, each one a contradiction the model had to
// resolve by chance:
// - "Clever (Hoffmann) … NEVER stir" while his own verified recipe stirs twice
//   (a little stir when the coffee goes on, one to break the crust at 2:00).
// - Kettle "Fellow Corvo EKG" (not a gooseneck); the owner brews on a Stagg EKG.
// - Wölfl's 2024 title given as WAC; he won the World Brewers Cup (the WAC 2024
//   champion is Stanica, also in the library).
// - A "Hoffmann AeroPress Bypass (1:7)" recipe that exists nowhere in the corpus.
// - Chemex listed under IMMERSION, and "no agitation on subsequent pours" while
//   Hoffmann's verified Chemex swirls after the final pour.
// - "Clarity pulls input DOWN" next to "clarity: 4–5 pours — more input", and an
//   unsourced "more/earlier pours = brighter" against the verified Kasuya text.
// - Iced ratio: the prompt said 1:10–1:12 hot "dilutes to 1:15–1:16" (it does
//   not at a 40% ice split), and the custom-iced user message dosed 1:15 against
//   the HOT portion (~1:25 in the glass). Hoffmann's verified Japanese iced is
//   65 g per litre of FINAL drink.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const read = (p) => readFile(path.join(process.cwd(), p), "utf8");
const prompt = await read("src/lib/claude/recommendPrompt.ts");
const chat = await read("src/lib/chat/agentPrompt.ts");
const recommend = await read("src/lib/claude/recommend.ts");

test("removed claims stay removed", () => {
  for (const [src, label] of [[prompt, "recommend"], [chat, "chat"]]) {
    assert.doesNotMatch(src, /Corvo/, `${label}: wrong kettle`);
    assert.doesNotMatch(src, /Wölfl 2024 \(WAC\)|Wölfl 2024 WAC/, `${label}: wrong Wölfl title`);
    assert.doesNotMatch(src, /Hoffmann AeroPress Bypass/, `${label}: phantom recipe`);
  }
  assert.doesNotMatch(prompt, /Clever Dripper \(Hoffmann\)[^\n]*NEVER stir/);
  assert.doesNotMatch(prompt, /more\/earlier pours = brighter/);
  assert.doesNotMatch(prompt, /clarity goal: 4–5 pours — more input/);
  assert.doesNotMatch(prompt, /1:10–1:12 hot-water concentration/);
  assert.doesNotMatch(recommend, /1:15 against the HOT brew portion/);
});

test("Chemex is a percolation brewer in the agitation rules", () => {
  const perc = prompt.indexOf("\nPERCOLATION:");
  const imm = prompt.indexOf("\nIMMERSION:");
  const chemex = prompt.indexOf("- Chemex (a pour-over");
  assert.ok(perc >= 0 && imm > perc && chemex > perc && chemex < imm, "Chemex must sit under PERCOLATION");
});

test("the corrected facts are stated", () => {
  assert.match(prompt, /Fellow Stagg EKG/);
  assert.match(prompt, /break the crust with one gentle stir at 2:00/);
  assert.match(prompt, /65 g per litre of final drink/);
  assert.match(recommend, /1:15 against the FINAL drink/);
});
