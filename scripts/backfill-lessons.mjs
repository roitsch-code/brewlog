// Lessons Phase 2 — backfill the lessons table from existing sessions.
//
// Iterates every (level, scope) that the current session corpus
// touches and asks Haiku for a one-paragraph directive per scope. Each
// row is upserted into the lessons table with source='backfill', so
// the user can tell on the Lessons page which lines came from the
// one-shot vs. live distillation.
//
// IMPORTANT: this script does NOT import from src/lib/claude/lessons.ts
// because the production Docker image is a Next.js standalone build —
// @anthropic-ai/sdk is bundled into the compiled API routes but isn't
// available as a top-level node_modules entry an external script can
// import. So we call the Anthropic Messages API over plain fetch and
// re-implement scopesForSession() here. Keep the two in sync — if you
// add a level in src/lib/claude/lessons.ts, mirror it here.
//
// Run from the VPS (where DATABASE_URL + ANTHROPIC_API_KEY are set):
//   docker cp scripts brewlog-app-1:/app/ \
//     && docker compose exec app node scripts/backfill-lessons.mjs
//
// Idempotent — re-running upserts. Existing user-edited rows
// (source='user-edited') are preserved unchanged. Dismissed rows stay
// dismissed.

import pg from "pg";
import { randomUUID } from "crypto";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY env var missing");
  process.exit(1);
}

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
      content: {
        type: "string",
        description:
          "1–3 short sentences, plain prose, no quotation marks. A directive — prefer X / avoid Y / remember Z. Reference recipe NAMES (title plus based-on). Paraphrase freeNotes; never quote them.",
      },
      confidence_n: {
        type: "integer",
        description: "Number of rated brews backing this lesson.",
      },
    },
    required: ["content", "confidence_n"],
  },
};

const ASK_FOR_CLARIFICATION_TOOL = {
  name: "ask_for_clarification",
  description:
    "Use when multiple plausible causes could explain the pattern and you genuinely need the user's input to disambiguate. Examples: a single bad brew on a 42-day-old bag (recipe vs age?); a method change coinciding with a water source change; inconsistent ratings on the same recipe across weeks. Never call this AND write_lesson in the same turn.",
  input_schema: {
    type: "object",
    properties: {
      draft: {
        type: "string",
        description:
          "Your tentative directive — what you'd commit if your best guess were correct. The user reads this alongside the questions. Same constraints as write_lesson.content.",
      },
      confidence_n: {
        type: "integer",
        description: "Number of rated brews backing this draft.",
      },
      questions: {
        type: "array",
        minItems: 1,
        maxItems: 2,
        items: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description:
                "ONE concrete question naming the actual ambiguity. Reference the specific brews, recipe names, and dates. Not generic.",
            },
            options: {
              type: "array",
              minItems: 2,
              maxItems: 4,
              items: { type: "string" },
              description:
                "Plausible explanations the user can tap, written in the user's voice.",
            },
          },
          required: ["prompt", "options"],
        },
      },
    },
    required: ["draft", "confidence_n", "questions"],
  },
};

function resolveBrewedCandidate(session) {
  const rec = session.recommendation;
  if (!rec || !Array.isArray(rec.candidates)) return null;
  const idx = session.brew?.selectedCandidateIdx;
  if (typeof idx === "number" && rec.candidates[idx]) return rec.candidates[idx];
  // Legacy fallback — match by method name.
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
  if (coffeeKey) {
    out.push({
      level: "coffee",
      scope: coffeeKey,
      label: `${coffee.roaster ?? "unknown roaster"} — ${coffee.name ?? "unknown coffee"}`,
    });
  }

  if (coffee.roaster) {
    out.push({
      level: "roaster",
      scope: coffee.roaster.toLowerCase().trim(),
      label: coffee.roaster,
    });
  }

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
    const scope = `${coffee.process} × ${coffee.roastLevel}`.toLowerCase().trim();
    out.push({
      level: "process-roast",
      scope,
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
      const rating =
        s.result?.rating != null ? `${s.result.rating}★` : "unrated";
      const dose = s.brew?.doseGrams ?? recipe?.doseGrams;
      const water = s.brew?.waterGrams ?? recipe?.waterGrams;
      const grind = s.brew?.grindSettingUsed ?? recipe?.grindSize;
      const temp = s.brew?.actualTempC ?? recipe?.waterTempC;
      const flavors = s.result?.flavorNotes?.slice(0, 4).join(", ") || "";
      const free = s.result?.freeNotes
        ? ` freeNote="${s.result.freeNotes.replace(/\n/g, " ").slice(0, 400)}"`
        : "";
      const attr = s.result?.attribution
        ? ` attribution=${s.result.attribution}`
        : "";
      const fit = s.result?.fit ? ` fit=${s.result.fit}` : "";
      const recipeLine = recipeName ? `${method} "${recipeName}"` : method;
      const parts = [];
      if (dose != null) parts.push(`${dose}g`);
      if (water != null) parts.push(`${water}g`);
      if (grind != null && grind !== "") {
        parts.push(typeof grind === "number" ? `${grind}°` : `${grind}`);
      }
      if (temp != null) parts.push(`${temp}°C`);
      return `- ${date} · ${rating} · ${recipeLine} · ${parts.join("/")} · [${flavors}]${free}${attr}${fit}`;
    })
    .join("\n");
}

/**
 * Two-tool Haiku call. Returns either:
 *   { kind: 'confident', content, confidenceN }
 *   { kind: 'uncertain', draft, confidenceN, questions: [{id, prompt, options}] }
 * or null on failure.
 */
async function callHaiku(scopeLabel, level, sessionList, existingContent) {
  const ratedCount = sessionList.filter((s) => s.result?.rating != null).length;
  if (ratedCount === 0) return null;

  const userMessage = `Level: ${level}
Scope: ${scopeLabel}

${existingContent ? `Existing lesson (revise if the new evidence changes it; keep what still holds): ${existingContent}\n\n` : ""}Brews backing this scope (most recent first, max 30):
${formatSessionsForPrompt(sessionList)}

Choose ONE tool — write_lesson if the signal is clean, ask_for_clarification if it isn't.`;

  try {
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
      console.error(`  ✗ haiku ${res.status}:`, await res.text());
      return null;
    }
    const responseText = await res.text();
    let body;
    try {
      body = JSON.parse(responseText);
    } catch (parseErr) {
      console.error(`  ✗ json parse: ${parseErr.message}`);
      console.error(`     raw len=${responseText.length}`);
      console.error(`     first 400: ${responseText.slice(0, 400)}`);
      console.error(`     last 200:  ${responseText.slice(-200)}`);
      return null;
    }
    if (body.stop_reason && body.stop_reason !== "tool_use" && body.stop_reason !== "end_turn") {
      console.error(`  ⚠ stop_reason=${body.stop_reason}`);
    }
    const toolBlock = body.content?.find((b) => b.type === "tool_use");
    if (!toolBlock?.input) {
      console.error(`  ✗ no tool_use block. content types: ${(body.content ?? []).map((b) => b.type).join(", ") || "none"}`);
      return null;
    }

    if (toolBlock.name === "write_lesson") {
      const content =
        typeof toolBlock.input.content === "string"
          ? toolBlock.input.content.trim()
          : "";
      const confidenceN =
        typeof toolBlock.input.confidence_n === "number"
          ? Math.max(0, Math.floor(toolBlock.input.confidence_n))
          : ratedCount;
      if (!content) return null;
      return { kind: "confident", content, confidenceN };
    }

    if (toolBlock.name === "ask_for_clarification") {
      const draft =
        typeof toolBlock.input.draft === "string"
          ? toolBlock.input.draft.trim()
          : "";
      const confidenceN =
        typeof toolBlock.input.confidence_n === "number"
          ? Math.max(0, Math.floor(toolBlock.input.confidence_n))
          : ratedCount;
      const rawQs = Array.isArray(toolBlock.input.questions)
        ? toolBlock.input.questions
        : [];
      const questions = rawQs.flatMap((q) => {
        if (!q || typeof q !== "object") return [];
        const prompt = typeof q.prompt === "string" ? q.prompt.trim() : "";
        const options = Array.isArray(q.options)
          ? q.options
              .filter((o) => typeof o === "string" && o.trim().length > 0)
              .map((o) => o.trim())
              .slice(0, 4)
          : [];
        if (!prompt || options.length < 2) return [];
        return [{ id: randomUUID(), prompt, options }];
      });
      if (!draft || questions.length === 0) return null;
      return { kind: "uncertain", draft, confidenceN, questions };
    }

    return null;
  } catch (err) {
    console.error(`  ✗ haiku error:`, err.message);
    return null;
  }
}

async function main() {
  console.log("Backfilling BTTS lessons from existing sessions...");
  const sessionRes = await pool.query(
    `SELECT id, type, mode, created_at, coffee, place, context, recommendation, brew, result
       FROM sessions
      ORDER BY created_at_ms DESC`,
  );
  const sessionRows = sessionRes.rows.map((r) => ({
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
  }));
  console.log(`Loaded ${sessionRows.length} sessions.`);

  // Group sessions by (level, scope).
  const buckets = new Map();
  for (const session of sessionRows) {
    if (!session.result) continue;
    const scopes = scopesForSession(session);
    for (const sc of scopes) {
      const key = `${sc.level}::${sc.scope}`;
      let entry = buckets.get(key);
      if (!entry) {
        entry = { level: sc.level, scope: sc.scope, label: sc.label, sessions: [] };
        buckets.set(key, entry);
      }
      entry.sessions.push(session);
    }
  }
  console.log(`Found ${buckets.size} unique (level, scope) buckets:`);
  const perLevel = { coffee: 0, roaster: 0, "method-style": 0, "process-roast": 0 };
  for (const b of buckets.values()) perLevel[b.level] = (perLevel[b.level] ?? 0) + 1;
  for (const [level, n] of Object.entries(perLevel)) console.log(`  ${level}: ${n}`);

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const bucket of buckets.values()) {
    const rated = bucket.sessions.filter((s) => typeof s.result?.rating === "number");

    // Pattern threshold gate — mirror of meetsPatternThreshold() in
    // src/lib/claude/lessons.ts. Keep in sync if the live gate moves.
    //   coffee         ≥3 rated brews
    //   roaster        ≥3 rated brews AND ≥2 different coffees
    //   method-style   ≥3 rated brews
    //   process-roast  ≥3 rated brews AND ≥2 different coffees
    if (rated.length < 3) {
      console.log(`  ⏭  ${bucket.level}:${bucket.scope} (${rated.length} brews — below threshold)`);
      skipped++;
      continue;
    }
    if (bucket.level === "roaster" || bucket.level === "process-roast") {
      const uniqueCoffees = new Set(
        rated
          .map((s) => {
            const c = s.coffee;
            if (!c) return null;
            return (
              c.coffeeId ??
              (c.roaster && c.name
                ? `${c.roaster}__${c.name}`.toLowerCase()
                : null)
            );
          })
          .filter((x) => x !== null),
      );
      if (uniqueCoffees.size < 2) {
        console.log(`  ⏭  ${bucket.level}:${bucket.scope} (only ${uniqueCoffees.size} coffee${uniqueCoffees.size === 1 ? "" : "s"} — need ≥2 for ${bucket.level})`);
        skipped++;
        continue;
      }
    }

    // Pull existing row to feed Haiku and to honour user-edited rows.
    const existingRes = await pool.query(
      `SELECT id, content, source, status FROM lessons WHERE level = $1 AND scope = $2 LIMIT 1`,
      [bucket.level, bucket.scope],
    );
    const existing = existingRes.rows[0];
    if (existing && existing.source === "user-edited") {
      console.log(`  ⏭  ${bucket.level}:${bucket.scope} (user-edited, preserving)`);
      skipped++;
      continue;
    }
    if (existing && existing.status === "pending") {
      console.log(`  ⏭  ${bucket.level}:${bucket.scope} (pending — awaiting user answer)`);
      skipped++;
      continue;
    }

    const top = bucket.sessions
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 30);
    process.stdout.write(`  → ${bucket.level}:${bucket.scope} (${top.length} brews)… `);
    const distillation = await callHaiku(
      bucket.label,
      bucket.level,
      top,
      existing?.content ?? null,
    );
    if (!distillation) {
      console.log("✗ no result");
      errors++;
      continue;
    }
    const evidence = top.slice(0, 12).map((s) => s.id);
    const now = new Date();
    // Branch on Haiku's tool choice:
    //   confident  -> status='active', content=content, questions=null
    //   uncertain  -> status='pending', content=draft,  questions=[...]
    const content =
      distillation.kind === "confident"
        ? distillation.content
        : distillation.draft;
    const status =
      distillation.kind === "confident" ? "active" : "pending";
    const questionsJson =
      distillation.kind === "uncertain"
        ? JSON.stringify(distillation.questions)
        : null;
    if (existing) {
      // Preserve dismissed status; do not auto-revive a thumbs-down.
      await pool.query(
        `UPDATE lessons
            SET content = $1, confidence_n = $2, evidence_session_ids = $3::jsonb,
                source = CASE WHEN source = 'user-edited' THEN source ELSE 'backfill' END,
                status = CASE WHEN status = 'dismissed' THEN status ELSE $4 END,
                questions = $5::jsonb,
                answers = NULL,
                updated_at = $6
          WHERE id = $7`,
        [
          content,
          distillation.confidenceN,
          JSON.stringify(evidence),
          status,
          questionsJson,
          now,
          existing.id,
        ],
      );
    } else {
      await pool.query(
        `INSERT INTO lessons
            (id, level, scope, content, confidence_n, evidence_session_ids,
             source, status, questions, answers, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'backfill', $7, $8::jsonb, NULL, $9, $9)`,
        [
          randomUUID(),
          bucket.level,
          bucket.scope,
          content,
          distillation.confidenceN,
          JSON.stringify(evidence),
          status,
          questionsJson,
          now,
        ],
      );
    }
    console.log(distillation.kind === "uncertain" ? "✓ pending" : "✓");
    processed++;
  }

  console.log("");
  console.log(`Done: processed=${processed} skipped=${skipped} errors=${errors}`);
  await pool.end();
}

main().catch((err) => {
  console.error("backfill failed:", err);
  process.exit(1);
});
