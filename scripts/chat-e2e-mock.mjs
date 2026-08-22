/**
 * End-to-end test of the REAL /api/explore-agent route with a scripted model.
 *
 *   node scripts/chat-e2e-mock.mjs
 *
 * Why this exists: PR #544 added a validator, a repair round and an emoji strip
 * to the chat. Unit tests prove each PIECE works and a source-level test proves
 * the route MENTIONS them. Neither proves the chain actually runs — and this
 * repo has twice shipped a function that was written, tested and documented as
 * wired while nothing called it (#530, #535).
 *
 * The Anthropic SDK resolves its base URL from ANTHROPIC_BASE_URL when the
 * client doesn't pass one, and explore-agent's client passes only apiKey. So
 * pointing that variable at this process puts a scripted model behind the
 * REAL route: real validator, real repair loop, real SSE stream, real strip.
 * No API key, no cost, deterministic.
 *
 * The mock also RECORDS every request the server sends it, which is the only
 * way to prove the repair tool_result genuinely goes back to the model with the
 * problems named — rather than trusting that the code path looks right.
 *
 * Usage (the app must already point at the mock):
 *   node scripts/chat-e2e-mock.mjs &            # or let CI start it
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:9911 npm run dev -- -p 3000
 */
import { createServer } from "node:http";

const MOCK_PORT = Number(process.env.MOCK_PORT || 9911);
const BASE = process.env.BASE_URL || "http://localhost:3000";
const PIN = process.env.AUTH_PIN || "1234";

// ── The recipe the owner was actually handed, to the gram ────────────────────
// Orea V4 Classic + Drip Assist, 450 ml: the final pour is 225 g — half the
// water — in the 15 s the clock has left, after a 2-minute hole.
const BROKEN_RECIPE = {
  doseGrams: 28,
  waterGrams: 450,
  waterTempC: 94,
  grindSize: "26 clicks",
  targetTimeSec: 210,
  pourSteps: [
    { label: "Bloom", action: "bloom", waterGramsAtEnd: 90, durationSec: 45 },
    { label: "Pour 2", action: "pour", waterGramsAtEnd: 225, durationSec: 30 },
    { label: "Final pour", action: "final", waterGramsAtEnd: 450, durationSec: 30 },
  ],
};

// Same brewer, same volume, same bag — five pours, so every pour has room.
const GOOD_RECIPE = {
  doseGrams: 28,
  waterGrams: 450,
  waterTempC: 94,
  grindSize: "27 clicks",
  targetTimeSec: 240,
  pourSteps: [
    { label: "Bloom", action: "bloom", waterGramsAtEnd: 60, durationSec: 15 },
    { label: "Pour 2", action: "pour", waterGramsAtEnd: 160, durationSec: 25 },
    { label: "Pour 3", action: "pour", waterGramsAtEnd: 260, durationSec: 25 },
    { label: "Pour 4", action: "pour", waterGramsAtEnd: 360, durationSec: 25 },
    { label: "Final pour", action: "final", waterGramsAtEnd: 450, durationSec: 25 },
  ],
};

const startBrewBlock = (recipe, note) => ({
  kind: "tool_use",
  text: `Hier ist das Rezept${note ? ` (${note})` : ""}.`,
  tool: {
    id: `toolu_${Math.abs(hash(JSON.stringify(recipe) + (note || "")))}`,
    name: "start_brew",
    input: {
      label: "Brew Lush Lemons — Orea Classic + Drip Assist",
      id: "dak__lush_lemons",
      method: "Orea V4 Classic + Drip Assist",
      title: "Lush Lemons (450 ml)",
      basedOn: "Own experiment",
      recipe,
    },
  },
});

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

// ── Scenarios: an ordered script of model turns per scenario ────────────────
const SCENARIOS = {
  "repair-then-accept": [startBrewBlock(BROKEN_RECIPE), startBrewBlock(GOOD_RECIPE, "korrigiert")],
  "twice-broken": [startBrewBlock(BROKEN_RECIPE), startBrewBlock(BROKEN_RECIPE, "immer noch kaputt")],
  "good-first-try": [startBrewBlock(GOOD_RECIPE)],
  // An emoji whose surrogate pair is deliberately split across two deltas.
  emoji: [{ kind: "text", chunks: ["Ha, völlig berechtigt", "! \ud83d", "\ude04 Nimm den Orea."] }],
};

let state = { scenario: null, call: 0, received: [] };

// ── Anthropic SSE ────────────────────────────────────────────────────────────
function sse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function streamTurn(res, turn) {
  sse(res, "message_start", {
    type: "message_start",
    message: {
      id: "msg_mock", type: "message", role: "assistant", model: "claude-sonnet-4-6",
      content: [], stop_reason: null, stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 1 },
    },
  });

  const textChunks = turn.kind === "text" ? turn.chunks : [turn.text];
  sse(res, "content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } });
  for (const t of textChunks) {
    sse(res, "content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: t } });
  }
  sse(res, "content_block_stop", { type: "content_block_stop", index: 0 });

  if (turn.kind === "tool_use") {
    sse(res, "content_block_start", {
      type: "content_block_start", index: 1,
      content_block: { type: "tool_use", id: turn.tool.id, name: turn.tool.name, input: {} },
    });
    // Real streams split the JSON; do the same so the SDK's accumulator is exercised.
    const json = JSON.stringify(turn.tool.input);
    for (let i = 0; i < json.length; i += 120) {
      sse(res, "content_block_delta", {
        type: "content_block_delta", index: 1,
        delta: { type: "input_json_delta", partial_json: json.slice(i, i + 120) },
      });
    }
    sse(res, "content_block_stop", { type: "content_block_stop", index: 1 });
  }

  sse(res, "message_delta", {
    type: "message_delta",
    delta: { stop_reason: turn.kind === "tool_use" ? "tool_use" : "end_turn", stop_sequence: null },
    usage: { output_tokens: 50 },
  });
  sse(res, "message_stop", { type: "message_stop" });
  res.end();
}

const server = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    // Control plane: the driver selects a scenario and reads back what the
    // server sent us.
    if (req.url.startsWith("/__control")) {
      const u = new URL(req.url, "http://x");
      if (u.searchParams.has("scenario")) {
        state = { scenario: u.searchParams.get("scenario"), call: 0, received: [] };
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ ok: true, scenario: state.scenario }));
      }
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ scenario: state.scenario, calls: state.call, received: state.received }));
    }

    let parsed = null;
    try { parsed = JSON.parse(body); } catch { /* ignore */ }
    state.received.push(parsed);

    const script = SCENARIOS[state.scenario];
    if (!script) {
      res.writeHead(400, { "content-type": "application/json" });
      return res.end(JSON.stringify({ error: `no scenario selected (got ${state.scenario})` }));
    }
    const turn = script[Math.min(state.call, script.length - 1)];
    state.call += 1;

    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
    streamTurn(res, turn);
  });
});

// ── Driver ───────────────────────────────────────────────────────────────────
async function login() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "pin", pin: PIN }),
  });
  if (!r.ok) throw new Error(`PIN login failed: ${r.status} ${await r.text()}`);
  const cookie = r.headers.getSetCookie?.().join("; ") ?? r.headers.get("set-cookie");
  if (!cookie) throw new Error("no session cookie returned");
  return cookie;
}

async function chat(cookie, scenario, userText) {
  await fetch(`http://127.0.0.1:${MOCK_PORT}/__control?scenario=${scenario}`);
  const r = await fetch(`${BASE}/api/explore-agent`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ messages: [{ role: "user", content: userText }] }),
  });
  const raw = await r.text();
  const events = [];
  for (const chunk of raw.split("\n\n")) {
    const ev = /^event: (.+)$/m.exec(chunk);
    const da = /^data: (.+)$/m.exec(chunk);
    if (ev && da) { try { events.push({ event: ev[1], data: JSON.parse(da[1]) }); } catch { /* skip */ } }
  }
  const text = events.filter((e) => e.event === "delta").map((e) => e.data.text).join("");
  const done = events.find((e) => e.event === "done");
  const retracted = events.some((e) => e.event === "retract");
  const control = await (await fetch(`http://127.0.0.1:${MOCK_PORT}/__control`)).json();
  return { status: r.status, text, actions: done?.data?.actions ?? [], retracted, control, events };
}

const results = [];
function check(name, cond, detail) {
  results.push({ name, ok: !!cond, detail });
  console.log(`${cond ? "  PASS" : "  FAIL"}  ${name}${detail ? `\n        ${detail}` : ""}`);
}

await new Promise((r) => server.listen(MOCK_PORT, "127.0.0.1", r));
console.log(`mock model listening on :${MOCK_PORT}`);

try {
  const cookie = await login();
  console.log(`logged in\n`);

  // ── 1. A broken recipe is rejected, and the model is told why ──────────────
  console.log("SCENARIO repair-then-accept — the reported recipe, then a fixed one");
  {
    const r = await chat(cookie, "repair-then-accept", "Lush Lemons Rezept bitte. 450ml. Unterwegs kein Gooseneck kettle. Comandante.");
    check("the route called the model twice (one repair round)", r.control.calls === 2, `calls=${r.control.calls}`);

    // The second request is the proof: it must carry an error tool_result naming the problems.
    const second = r.control.received[1];
    const toolResults = (second?.messages ?? []).flatMap((m) =>
      Array.isArray(m.content) ? m.content.filter((b) => b.type === "tool_result") : []);
    const errored = toolResults.filter((t) => t.is_error);
    check("the repair went back as an ERROR tool_result", errored.length === 1, `error tool_results=${errored.length}`);
    const msg = errored[0]?.content ?? "";
    check("it names the unpourable final pour", /225g/.test(msg) && /g\/s/.test(msg), msg.split("\n")[2]?.slice(0, 110));
    check("it names the dead gap", /stalled brew|Nothing happens/.test(msg), msg.split("\n")[3]?.slice(0, 110));
    check("the stale bubble was retracted before the rewrite", r.retracted);

    const brew = r.actions.find((a) => a.destination === "start_brew");
    check("a Brew button IS offered after the repair", !!brew);
    check("and it carries the CORRECTED recipe, not the broken one",
      brew?.recipe?.targetTimeSec === 240 && brew?.recipe?.pourSteps?.length === 5,
      `targetTimeSec=${brew?.recipe?.targetTimeSec} pours=${brew?.recipe?.pourSteps?.length}`);
  }

  // ── 2. Still broken after the repair → no button ───────────────────────────
  console.log("\nSCENARIO twice-broken — the model fails to fix it");
  {
    const r = await chat(cookie, "twice-broken", "Lush Lemons Rezept bitte. 450ml.");
    check("exactly one repair round is spent, not an endless loop", r.control.calls === 2, `calls=${r.control.calls}`);
    check("NO Brew button is offered", !r.actions.some((a) => a.destination === "start_brew"),
      `actions=${JSON.stringify(r.actions.map((a) => a.destination))}`);
    check("the user is told why there is no timer", /couldn't get that recipe to hold together/i.test(r.text),
      r.text.slice(-120));
  }

  // ── 3. A good recipe passes straight through ───────────────────────────────
  console.log("\nSCENARIO good-first-try — a brewable recipe is not obstructed");
  {
    const r = await chat(cookie, "good-first-try", "Lush Lemons Rezept bitte. 450ml.");
    check("no repair round is triggered", r.control.calls === 1, `calls=${r.control.calls}`);
    const brew = r.actions.find((a) => a.destination === "start_brew");
    check("the Brew button is offered", !!brew);
    check("the recipe is untouched", brew?.recipe?.targetTimeSec === 240);
  }

  // ── 4. Emoji never reach the client ────────────────────────────────────────
  console.log("\nSCENARIO emoji — split across two SSE deltas, as a real stream would");
  {
    const r = await chat(cookie, "emoji", "Danke!");
    check("no emoji in the streamed text", !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(r.text), JSON.stringify(r.text));
    check("no broken half-glyph either", !/[\uD800-\uDBFF]|[\uDC00-\uDFFF]/.test(r.text));
    check("the surrounding words survive", /völlig berechtigt/.test(r.text) && /Orea/.test(r.text), JSON.stringify(r.text));
  }
} catch (err) {
  console.error(`\nDRIVER ERROR: ${err.message}`);
  results.push({ name: "driver", ok: false, detail: err.message });
} finally {
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("FAILED:\n" + failed.map((f) => `  - ${f.name}${f.detail ? ` (${f.detail})` : ""}`).join("\n"));
  process.exit(1);
}
