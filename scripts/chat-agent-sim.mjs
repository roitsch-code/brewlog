/**
 * Live measurement of the home chat's recipe quality.
 *
 *   node scripts/chat-agent-sim.mjs --live      # needs ANTHROPIC_API_KEY
 *
 * PR #544 gave the chat a validator, so a broken recipe can no longer reach the
 * brew timer. What it did NOT answer is the question the owner actually cares
 * about: how often does the model write a brewable recipe in the FIRST place?
 * A validator that fires on every turn is a wait, not a fix.
 *
 * Everything here is the real thing — the real system prompt, the real tool
 * definitions, the real corpus block, the real profile block, the real context
 * builders and the real validator. Nothing is reimplemented, because a
 * reimplemented copy drifts and then the numbers describe nothing.
 */
import Anthropic from "@anthropic-ai/sdk";
import { build } from "esbuild";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const LIVE = process.argv.includes("--live");
const RUNS = Number(process.env.RUNS || 5);
const q = (rel) => JSON.stringify(path.join(ROOT, rel));

const entry = `
export { AGENT_SYSTEM_PROMPT, TOOLS } from ${q("src/lib/chat/agentPrompt.ts")};
export { recipeLibraryBlock, formatLibraryForAgent, cleanChatRecipe, grinderFromConversation }
  from ${q("src/lib/chat/agentContext.ts")};
export { formatProfileForPrompt } from ${q("src/lib/claude/userProfile.ts")};
export { validateRecipe, formatProblemsForModel } from ${q("src/lib/recipe/validateRecipe.ts")};
`;
const dir = await mkdtemp(join(tmpdir(), "chat-sim-"));
const bundle = join(dir, "b.mjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true, format: "esm", platform: "node", outfile: bundle, logLevel: "silent",
  // formatProfileForPrompt is pure, but it lives beside the DB loader, so the
  // bundle drags `pg` in — CommonJS, which an ESM bundle cannot `require`.
  // The banner gives it one. Nothing here ever opens a connection: the db
  // export is a lazy Proxy that only connects on property access.
  banner: {
    js:
      "import { createRequire as __cr } from 'node:module';\n" +
      "const require = __cr(import.meta.url);\n" +
      `const __dirname = ${JSON.stringify(dir)};\n` +
      `const __filename = ${JSON.stringify(bundle)};`,
  },
});
const K = await import(pathToFileURL(bundle).href);

// esbuild silently drops a re-export the module does not actually export: the
// build succeeds, the symbol is undefined, and the harness would fire an EMPTY
// prompt at the model and report confident nonsense. Verified behaviour — so
// every load-bearing import is asserted before a single call is made.
function must(name, cond) {
  if (!cond) { console.error(`FATAL: ${name} did not load — the harness would measure nothing.`); process.exit(1); }
}
must("AGENT_SYSTEM_PROMPT", typeof K.AGENT_SYSTEM_PROMPT === "string" && K.AGENT_SYSTEM_PROMPT.length > 20000);
must("TOOLS", Array.isArray(K.TOOLS) && K.TOOLS.some((t) => t.name === "start_brew"));
must("recipeLibraryBlock", typeof K.recipeLibraryBlock === "function" && K.recipeLibraryBlock().length > 20000);
must("validateRecipe", typeof K.validateRecipe === "function");
must("cleanChatRecipe", typeof K.cleanChatRecipe === "function");
must("formatLibraryForAgent", typeof K.formatLibraryForAgent === "function");

const LIBRARY = [
  { id: "dak__lush_lemons", roaster: "DAK", name: "Lush Lemons", origin: "Colombia",
    process: "Washed", variety: "Pink Bourbon", sessionCount: 4, avgRating: 4.3, inRotation: true },
  { id: "friedhats__guji", roaster: "Friedhats", name: "Guji", origin: "Ethiopia",
    process: "Natural", variety: "Heirloom", sessionCount: 7, avgRating: 4.1, inRotation: true },
];

// The owner's real situations. #1 is verbatim what produced the broken recipe.
const SCENARIOS = [
  { key: "travel-no-gooseneck", ask:
    "Lush Lemons Rezept bitte. 450ml. Unterwegs kein Gooseneck kettle. Comandante.",
    expectDisc: true, excluded: [] },
  { key: "narrowed-to-orea", ask:
    "Lush Lemons Rezept, 450ml. Kein Gooseneck, Comandante. Ich habe NUR den Orea dabei, keinen Clever und keine AeroPress.",
    expectDisc: true, excluded: ["clever", "aeropress"] },
  { key: "home-standard", ask:
    "Wie soll ich die Friedhats Guji heute brühen? 350ml, Niche.",
    expectDisc: false, excluded: [] },
  { key: "big-batch", ask:
    "Ich brauche 600ml von der Lush Lemons für zwei Tassen. Zuhause, Niche, Gooseneck da.",
    expectDisc: false, excluded: [] },
];

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 180_000 })
  : null;
if (LIVE && !anthropic) { console.error("--live needs ANTHROPIC_API_KEY"); process.exit(1); }
if (!LIVE) { console.log("Offline: nothing to measure here (the model IS the subject). Pass --live."); process.exit(0); }

const systemBlocks = [
  { type: "text", text: K.AGENT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
  { type: "text", text: K.formatProfileForPrompt(null), cache_control: { type: "ephemeral" } },
  { type: "text", text: K.recipeLibraryBlock(), cache_control: { type: "ephemeral" } },
];

function contextBlock() {
  return `\n## Your Coffee Library — your owned bags, each with its [id:…]\n` +
    `Every bag here is brewable and linkable by its id.\n` + K.formatLibraryForAgent(LIBRARY);
}

const EMOJI = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[←-⇿⌀-➿⬀-⯿]/;

async function oneTurn(scenario) {
  const messages = [{ role: "user", content: scenario.ask + "\n" + contextBlock() }];
  let repaired = false;
  let text = "";

  for (let round = 0; round < 2; round++) {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 2500,
      system: systemBlocks, tools: K.TOOLS, messages,
    });
    text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    const call = res.content.find((b) => b.type === "tool_use" && b.name === "start_brew");
    if (!call) return { scenario, text, brew: null, repaired, tokens: res.usage };

    const recipe = K.cleanChatRecipe(call.input.recipe);
    const problems = K.validateRecipe(recipe, {
      method: call.input.method, basedOn: call.input.basedOn,
      grinder: K.grinderFromConversation([{ role: "user", content: scenario.ask }]),
    });
    if (problems.length === 0 || repaired) {
      return { scenario, text, brew: { ...call.input, recipe }, problems, repaired, tokens: res.usage };
    }
    // Exactly the route's repair round.
    repaired = true;
    messages.push({ role: "assistant", content: res.content });
    messages.push({ role: "user", content: [
      { type: "tool_result", tool_use_id: call.id, content: K.formatProblemsForModel(problems), is_error: true },
    ] });
  }
  return { scenario, text, brew: null, repaired, tokens: null };
}

const lines = ["# Chat recipe quality — live", "",
  `${SCENARIOS.length} scenarios x ${RUNS} runs, model claude-sonnet-4-6, real prompt + real tools + real validator.`,
  "", "**First-try** = the model's first recipe passed the validator with no repair round.", ""];
const rows = [];

for (const sc of SCENARIOS) {
  const res = [];
  for (let i = 0; i < RUNS; i++) {
    try { res.push(await oneTurn(sc)); }
    catch (e) { console.error(`  ${sc.key} run ${i}: ${e.message}`); res.push({ scenario: sc, error: e.message, text: "" }); }
  }
  const ok = res.filter((r) => r.brew && !r.repaired).length;
  const repaired = res.filter((r) => r.brew && r.repaired).length;
  const none = res.filter((r) => !r.brew).length;
  const emoji = res.filter((r) => EMOJI.test(r.text || "")).length;
  const leaked = res.filter((r) => sc.excluded.some((b) => new RegExp(b, "i").test(r.text || ""))).length;
  const disc = res.filter((r) => /drip assist/i.test(r.brew?.method || "")).length;
  const asked = res.filter((r) => !r.brew && /\?/.test(r.text || "")).length;
  const pairs = new Set(res.filter((r) => r.brew).map((r) => `${r.brew.method}<-${r.brew.basedOn}`));
  const codes = res.flatMap((r) => (r.problems || []).map((p) => p.code));

  rows.push({ key: sc.key, ok, repaired, none, emoji, leaked, disc, asked, distinct: pairs.size, codes });
  console.log(`${sc.key}: first-try ${ok}/${RUNS}, repaired ${repaired}, none ${none}, emoji ${emoji}, excluded-leak ${leaked}`);
  for (const r of res.slice(0, 1)) lines.push(`<details><summary>${sc.key} — sample reply</summary>\n\n${(r.text || "").slice(0, 1200)}\n\n</details>\n`);
}

lines.push("| scenario | first-try OK | needed repair | no recipe | emoji | excluded brewer re-offered | disc used | distinct method←basedOn |", "|---|---|---|---|---|---|---|---|");
for (const r of rows) {
  lines.push(`| ${r.key} | **${r.ok}/${RUNS}** | ${r.repaired} | ${r.none} | ${r.emoji} | ${r.leaked} | ${r.disc}/${RUNS} | ${r.distinct} |`);
}
const allCodes = rows.flatMap((r) => r.codes);
const tally = {};
for (const c of allCodes) tally[c] = (tally[c] || 0) + 1;
lines.push("", `Validator findings across all runs: ${Object.keys(tally).length === 0 ? "none" : JSON.stringify(tally)}`);
lines.push("", "Emoji and excluded-brewer counts must be 0. A high repair count is a wait, not a bad brew — but it means the prompt rules are not landing.");

const report = lines.join("\n");
console.log("\n" + report);
await mkdir(join(ROOT, "spike-output"), { recursive: true });
await writeFile(join(ROOT, "spike-output", "chat-agent.md"), report, "utf8");
