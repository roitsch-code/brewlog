// Sample one lesson distillation against a real (level, scope) bucket
// WITHOUT writing to the DB. Use for Hard-Rule validation: see what
// Haiku produces under the new two-tool prompt before turning it loose
// on the corpus.
//
// Usage on VPS:
//   docker cp scripts brewlog-app-1:/app/
//   docker compose exec app node scripts/sample-lesson.mjs <level> <scope>
//
// Examples:
//   node scripts/sample-lesson.mjs coffee rvtc__el_congo_by_carlos_montero___don_eli
//   node scripts/sample-lesson.mjs roaster "hoppenworth & ploch"
//   node scripts/sample-lesson.mjs method-style "clever dripper · hub bloom-first clever"
//   node scripts/sample-lesson.mjs process-roast "natural × light"
//
// Output: the Haiku tool call (write_lesson or ask_for_clarification)
// pretty-printed to stdout. No DB writes. No row mutation. Safe to run
// dozens of times.

import pg from "pg";
import { randomUUID } from "crypto";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY env var missing");
  process.exit(1);
}

const [, , levelArg, ...scopeArgs] = process.argv;
if (!levelArg || scopeArgs.length === 0) {
  console.error("usage: node scripts/sample-lesson.mjs <level> <scope>");
  console.error("       level = coffee | roaster | method-style | process-roast");
  process.exit(1);
}
const scopeArg = scopeArgs.join(" ").toLowerCase().trim();

// ─── prompt + tools (mirror of scripts/backfill-lessons.mjs) ────────────

const SYSTEM_PROMPT = `You are BTTS's memory writer. You distill a user's brew history into ONE durable directive per scope — a paragraph a recommendation prompt can quote verbatim months from now.

COFFEE IS MULTIVARIATE. Before assigning blame to a recipe, consider:
- Bag age (<7d too fresh, 7–21d peak, 22–35d slightly past, 35–60d past peak, 60+ stale)
- Recipe family (Hoffmann vs Hub vs Kasuya vs Wölfl — different physics, different cups)
- Water source (clarity blend ~73 ppm vs filtered tap ~220 ppm — buffering differs)
- Grind drift (Niche calibration shifts over months)
- Pour technique (agitation level, pulse timing)
- Roast inconsistency at source — some bags are uneven, not the user's fault
- Palate fluctuation day to day

ONE TOOL PER TURN.

Call write_lesson when the evidence is clean: 3+ rated brews, a consistent pattern, ONE variable clearly standing out. Be a coach, not a hedger. Reference recipe NAMES (title plus based-on). Paraphrase freeNotes; never quote them.

Call ask_for_clarification when multiple plausible causes could explain the pattern and you need the user to disambiguate. The draft is your best guess as if you'd called write_lesson; the questions are how you'd want to be wrong. Questions must be SPECIFIC — reference the actual brews, the actual dates, the actual ambiguity. Options must be PLAUSIBLE — each one a real explanation the user might endorse, written in their voice. NO generic "Was it the recipe?" questions — name the recipes.

Single bucket, 1 rated brew: usually ask_for_clarification (a single data point cannot support a directive). Use the draft to capture what the brew suggested; use the question to ask whether the user thinks this is a real pattern or a one-off.

Metric units. No emojis. No quotation marks anywhere.`;

const WRITE_LESSON_TOOL = {
  name: "write_lesson",
  description:
    "Use when the evidence is clean: 3+ rated brews, consistent pattern, one variable clearly standing out as the cause. Be a coach issuing a directive. Never call this AND ask_for_clarification in the same turn.",
  input_schema: {
    type: "object",
    properties: {
      content: { type: "string" },
      confidence_n: { type: "integer" },
    },
    required: ["content", "confidence_n"],
  },
};

const ASK_FOR_CLARIFICATION_TOOL = {
  name: "ask_for_clarification",
  description:
    "Use when multiple plausible causes could explain the pattern and you genuinely need the user's input to disambiguate.",
  input_schema: {
    type: "object",
    properties: {
      draft: { type: "string" },
      confidence_n: { type: "integer" },
      questions: {
        type: "array",
        minItems: 1,
        maxItems: 2,
        items: {
          type: "object",
          properties: {
            prompt: { type: "string" },
            options: {
              type: "array",
              minItems: 2,
              maxItems: 4,
              items: { type: "string" },
            },
          },
          required: ["prompt", "options"],
        },
      },
    },
    required: ["draft", "confidence_n", "questions"],
  },
};

// ─── session helpers (mirror of backfill-lessons.mjs) ──────────────────

function resolveBrewedCandidate(session) {
  const rec = session.recommendation;
  if (!rec || !Array.isArray(rec.candidates)) return null;
  const idx = session.brew?.selectedCandidateIdx;
  if (typeof idx === "number" && rec.candidates[idx]) return rec.candidates[idx];
  const method = session.brew?.methodUsed;
  if (method) {
    const found = rec.candidates.find(
      (c) => c.method?.toLowerCase() === method.toLowerCase(),
    );
    if (found) return found;
  }
  return rec.candidates[0] ?? null;
}
function brewedRecipe(session) {
  const cand = resolveBrewedCandidate(session);
  return cand?.recipe ?? session.recommendation?.primaryRecipe ?? null;
}
function brewedRecipeName(candidate) {
  if (!candidate) return null;
  const title = candidate.title;
  const basedOn = candidate.basedOn;
  if (title && basedOn && basedOn.toLowerCase() !== "own recipe") {
    return `${title} (based on ${basedOn})`;
  }
  return title || null;
}
function scopesForSession(session) {
  const out = [];
  const coffee = session.coffee;
  const result = session.result;
  if (!coffee || !result) return out;
  const coffeeKey =
    coffee.coffeeId ??
    (coffee.roaster && coffee.name
      ? `${coffee.roaster}__${coffee.name}`.toLowerCase().replace(/[^a-z0-9]/g, "_")
      : null);
  if (coffeeKey) out.push({ level: "coffee", scope: coffeeKey, label: `${coffee.roaster} — ${coffee.name}` });
  if (coffee.roaster) out.push({ level: "roaster", scope: coffee.roaster.toLowerCase().trim(), label: coffee.roaster });
  const candidate = resolveBrewedCandidate(session);
  const basedOn = candidate?.basedOn?.trim();
  const usedMethod = (session.brew?.methodUsed || candidate?.method || "").trim();
  if (usedMethod && basedOn && basedOn.toLowerCase() !== "own recipe") {
    out.push({
      level: "method-style",
      scope: `${usedMethod} · ${basedOn}`.toLowerCase(),
      label: `${usedMethod} · ${basedOn}`,
    });
  }
  if (coffee.process && coffee.roastLevel) {
    out.push({
      level: "process-roast",
      scope: `${coffee.process} × ${coffee.roastLevel}`.toLowerCase().trim(),
      label: `${coffee.process} × ${coffee.roastLevel}`,
    });
  }
  return out;
}
function formatSessionsForPrompt(sessionList) {
  return sessionList
    .map((s) => {
      const candidate = resolveBrewedCandidate(s);
      const recipe = brewedRecipe(s);
      const method =
        s.brew?.methodUsed ||
        candidate?.method ||
        s.recommendation?.primaryMethod ||
        "?";
      const recipeName = brewedRecipeName(candidate);
      const date = new Date(s.createdAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const rating = s.result?.rating != null ? `${s.result.rating}★` : "unrated";
      const dose = s.brew?.doseGrams ?? recipe?.doseGrams;
      const water = s.brew?.waterGrams ?? recipe?.waterGrams;
      const grind = s.brew?.grindSettingUsed ?? recipe?.grindSize;
      const temp = s.brew?.actualTempC ?? recipe?.waterTempC;
      const flavors = s.result?.flavorNotes?.slice(0, 4).join(", ") || "";
      const free = s.result?.freeNotes
        ? ` freeNote=${s.result.freeNotes.replace(/\n/g, " ").slice(0, 400)}`
        : "";
      const attr = s.result?.attribution ? ` attribution=${s.result.attribution}` : "";
      const fit = s.result?.fit ? ` fit=${s.result.fit}` : "";
      const recipeLine = recipeName ? `${method} ${recipeName}` : method;
      const parts = [];
      if (dose != null) parts.push(`${dose}g`);
      if (water != null) parts.push(`${water}g`);
      if (grind != null && grind !== "") parts.push(typeof grind === "number" ? `${grind}°` : `${grind}`);
      if (temp != null) parts.push(`${temp}°C`);
      return `- ${date} · ${rating} · ${recipeLine} · ${parts.join("/")} · [${flavors}]${free}${attr}${fit}`;
    })
    .join("\n");
}

// ─── main ──────────────────────────────────────────────────────────────

async function main() {
  console.log(`Sampling distillation for ${levelArg}:${scopeArg}\n`);

  // Pull every session that contributes to this (level, scope).
  const sessRes = await pool.query(
    `SELECT id, type, mode, created_at, coffee, place, context, recommendation, brew, result
       FROM sessions
      ORDER BY created_at_ms DESC`,
  );
  const sessions = sessRes.rows
    .map((r) => ({
      id: r.id,
      type: r.type,
      mode: r.mode,
      createdAt: r.created_at.toISOString(),
      coffee: r.coffee,
      place: r.place ?? undefined,
      context: r.context ?? undefined,
      recommendation: r.recommendation ?? undefined,
      brew: r.brew ?? undefined,
      result: r.result ?? undefined,
    }))
    .filter((s) => s.result);

  const matched = sessions.filter((s) =>
    scopesForSession(s).some(
      (x) => x.level === levelArg && x.scope === scopeArg,
    ),
  );
  if (matched.length === 0) {
    console.error(`✗ no sessions match (${levelArg}, ${scopeArg})`);
    await pool.end();
    process.exit(1);
  }
  console.log(`Matched ${matched.length} sessions.`);

  // Pull existing lesson for this scope (so Haiku sees it as context).
  const existingRes = await pool.query(
    `SELECT content, source, status FROM lessons WHERE level = $1 AND scope = $2 LIMIT 1`,
    [levelArg, scopeArg],
  );
  const existing = existingRes.rows[0];
  if (existing) {
    console.log(`Existing lesson (source=${existing.source}, status=${existing.status}):`);
    console.log(`  ${existing.content}\n`);
  } else {
    console.log("No existing lesson for this scope.\n");
  }

  // Build the user message.
  const top = matched.slice(0, 30);
  const userMessage = `Level: ${levelArg}
Scope: ${scopeArg}

${existing?.content ? `Existing lesson (revise if the new evidence changes it; keep what still holds): ${existing.content}\n\n` : ""}Brews backing this scope (most recent first, max 30):
${formatSessionsForPrompt(top)}

Choose ONE tool — write_lesson if the signal is clean, ask_for_clarification if it isn't.`;

  console.log("─".repeat(60));
  console.log("CALLING HAIKU…\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [WRITE_LESSON_TOOL, ASK_FOR_CLARIFICATION_TOOL],
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    console.error(`✗ haiku ${res.status}: ${await res.text()}`);
    await pool.end();
    process.exit(1);
  }
  const body = await res.json();
  const toolBlock = body.content?.find((b) => b.type === "tool_use");
  if (!toolBlock) {
    console.error("✗ no tool_use block");
    console.error(JSON.stringify(body, null, 2));
    await pool.end();
    process.exit(1);
  }

  console.log(`TOOL CALLED: ${toolBlock.name}\n`);
  console.log("INPUT:");
  console.log(JSON.stringify(toolBlock.input, null, 2));
  console.log("");
  console.log(`stop_reason=${body.stop_reason} · input_tokens=${body.usage?.input_tokens} · output_tokens=${body.usage?.output_tokens}`);
  console.log("");
  console.log("NO DB WRITE. Done.");

  await pool.end();
}

main().catch((err) => {
  console.error("sample failed:", err);
  process.exit(1);
});
