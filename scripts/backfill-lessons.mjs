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

const SYSTEM_PROMPT = `You are BTTS's memory writer. You distill a user's brew history into ONE durable directive — a single short paragraph that a recommendation prompt can quote verbatim months from now.

When you call write_lesson, pass:
- content: ONE paragraph, 1–3 short sentences. A concrete, actionable directive — what to prefer, what to avoid, what to remember. Reference real numbers (ratings, recipe names, methods). If two recipes diverge in outcome, name both. If a freeNote flags a meta-fact about the coffee or roaster (e.g. roasted for espresso, fermented hot, stale), paraphrase it into the directive without using quotation marks. Plain prose, no bullets, no emojis. Metric units only. If you cannot write a concrete directive from the evidence, pass an empty string.
- confidence_n: integer count of rated brews backing this lesson.

Constraints:
- Prefer "Avoid X" / "Prefer Y" over generic "experiment more".
- Cite recipe NAMES (the title plus the based-on), not just methods, when distinguishing what worked.
- Do not use quotation marks anywhere in content — paraphrase rather than quote.
- No hedging. The user wants a directive, not advice.`;

const WRITE_LESSON_TOOL = {
  name: "write_lesson",
  description:
    "Persist the distilled BTTS lesson for this (level, scope). Always call this tool exactly once.",
  input_schema: {
    type: "object",
    properties: {
      content: {
        type: "string",
        description:
          "1–3 short sentences, plain prose, no quotation marks. Empty string if no concrete directive can be drawn from the evidence.",
      },
      confidence_n: {
        type: "integer",
        description: "Number of rated brews backing this lesson.",
      },
    },
    required: ["content", "confidence_n"],
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

async function callHaiku(scopeLabel, level, sessionList, existingContent) {
  const ratedCount = sessionList.filter((s) => s.result?.rating != null).length;
  if (ratedCount === 0) return null;

  const userMessage = `Level: ${level}
Scope: ${scopeLabel}

${existingContent ? `Existing lesson (revise if the new evidence changes it; keep what still holds): ${existingContent}\n\n` : ""}Brews backing this scope (most recent first, max 30):
${formatSessionsForPrompt(sessionList)}

Write the updated directive now via write_lesson.`;

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
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        tools: [WRITE_LESSON_TOOL],
        tool_choice: { type: "tool", name: "write_lesson" },
        messages: [{ role: "user", content: userMessage }],
      }),
    });
    if (!res.ok) {
      console.error(`  ✗ haiku ${res.status}:`, await res.text());
      return null;
    }
    const body = await res.json();
    const toolBlock = body.content?.find((b) => b.type === "tool_use");
    if (!toolBlock?.input) return null;
    const content =
      typeof toolBlock.input.content === "string"
        ? toolBlock.input.content.trim()
        : "";
    const confidenceN =
      typeof toolBlock.input.confidence_n === "number"
        ? Math.max(0, Math.floor(toolBlock.input.confidence_n))
        : ratedCount;
    if (!content) return null;
    return { content, confidenceN };
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
    const ratedCount = bucket.sessions.filter((s) => s.result?.rating != null).length;
    if (ratedCount === 0) {
      skipped++;
      continue;
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
    if (existing) {
      // Preserve dismissed status; do not auto-revive a thumbs-down.
      await pool.query(
        `UPDATE lessons
            SET content = $1, confidence_n = $2, evidence_session_ids = $3::jsonb,
                source = CASE WHEN source = 'user-edited' THEN source ELSE 'backfill' END,
                updated_at = $4
          WHERE id = $5`,
        [
          distillation.content,
          distillation.confidenceN,
          JSON.stringify(evidence),
          now,
          existing.id,
        ],
      );
    } else {
      await pool.query(
        `INSERT INTO lessons
            (id, level, scope, content, confidence_n, evidence_session_ids, source, status, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'backfill', 'active', $7, $7)`,
        [
          randomUUID(),
          bucket.level,
          bucket.scope,
          distillation.content,
          distillation.confidenceN,
          JSON.stringify(evidence),
          now,
        ],
      );
    }
    console.log("✓");
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
