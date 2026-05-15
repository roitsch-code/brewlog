# BTTS Agent Memory — spec stub

**Status:** Concept noted, full spec deferred to post-Home-v1.
**Scope:** A persistent memory layer that lets the BTTS Agent learn about Markus across conversations, and (Reading 2 below) makes that memory accessible to Claude.ai strategic sessions on the same data.

This file exists so the concept isn't lost. It is not a spec yet. When Home v1 ships, we open this file and design properly.

---

## What it is

The BTTS Agent — the conversational layer that runs on Home and powers `/api/explore-agent` — currently has no persistent knowledge of Markus beyond what's passed via system prompt on each call (recent brews, library snapshot, etc.). Each conversation starts effectively cold.

Agent Memory is a separate persistent layer: a curated set of facts about Markus that the agent has learned from past conversations and writes back as it learns more. The agent reads it on every call (in the system prompt) and can write to it via a dedicated tool.

**Example memory items:**
- "Markus prefers Naturals over Washed processing (mentioned 2026-05-15)"
- "Markus uses Ode Gen 2 grinder, owns V60, Aeropress, Chemex"
- "Markus drinks one large brew in the morning, sometimes a small after dinner"
- "Markus actively dislikes very acidic coffees ('makes my stomach turn')"

These are different from BrewLog session data (which is structured: amount, grind, time). Memory items are unstructured preference signals expressed in conversation.

---

## Two readings of the use case

### Reading 1 — Agent Memory inside BTTS

The BTTS Agent uses memory to make its responses more personalized over time. If Markus once said "I hate floral coffees", the agent doesn't recommend a Geisha six months later. If Markus mentioned switching grinders, the agent stops referring to the old one.

This is internal to BTTS. The memory lives in BTTS's Postgres, the agent reads/writes it.

### Reading 2 — Memory available to Claude.ai sessions

This file's `agent-memory-tbd.md` content — plus the actual memory entries — is *also* useful in strategic Claude.ai project sessions like the ones where Markus designs BTTS itself. When Markus says here "remember that I dislike very acidic coffees", that should be the same knowledge the BTTS Agent has, not a separate thing.

This implies a sync mechanism. Two viable paths:

**Path A — Manual sync via file export.**
BTTS has an endpoint that exports current Agent Memory as a markdown file. Markus periodically downloads it and uploads to the Claude.ai project. Project knowledge picks it up. Stable, simple, no real-time.

**Path B — MCP sync.**
BTTS exposes an MCP server that Claude.ai connects to. The server has a `read_agent_memory` tool. Strategic sessions like the current one can query in real-time. This is the same MCP server that would surface Coffee Library, Sessions, etc. (see next section / future MCP spec).

Path B is much more powerful but lives in MCP-for-BTTS territory, which is its own design work.

---

## Open design questions (for when we actually spec this)

### Memory architecture

- **How does an item get written?** Agent decides ("I should remember that") with a dedicated tool, or Markus says "remember that..." explicitly, or both?
- **How does an item get updated?** Markus changes his mind about Naturals. Is the old item edited, marked obsolete, or replaced?
- **How does an item get deleted?** Privacy is a real concern — some Conversation content shouldn't become long-term memory. Explicit delete UI, or auto-pruning?
- **Item structure.** Free text? Structured (category + value)? Tagged with timestamp + source-conversation-id?
- **Confidence levels.** "Markus mentioned Naturals once" vs. "Markus has stated this consistently across five conversations" — is that distinction worth modeling?

### Read integration into agent prompts

- Which memory items are loaded for which agent calls? All of them every time, or relevance-filtered?
- Token cost — at scale, memory could grow large. Pruning strategy?
- Memory items vs. recent context — how does the agent prompt balance "what Markus said five minutes ago" with "what Markus said three months ago"?

### Reading 2 — sync architecture

- Manual export (Path A) or MCP (Path B)?
- If MCP: BTTS MCP server is its own substantial design topic (see "BTTS MCP server" as next big strategic topic post-Home-v1)
- If manual: cadence? Markus triggers it, or scheduled?

### Privacy model

- Does the user (Markus) see his own Agent Memory? Browse it, edit it directly?
- Are there topics that should never become memory items? (Crisis content, health, etc.)
- Is there a "private conversation" mode where memory writing is disabled for a session?

---

## Why this isn't in Home v1

Home v1 ships with Conversation Persistence (§10) — threads are archived, browseable, deletable. That gives Markus the substrate from which Agent Memory will eventually be distilled.

But the *Agent Memory layer itself* — the curated cross-conversation knowledge — is a different design challenge: it's about what survives distillation from raw conversation transcripts to long-term, prompt-injectable facts. That's worth doing properly, with its own iteration cycle, after Home v1 is real and the conversation archive has actual content to learn from.

In the meantime: §10 archive gives us the raw material. Agent Memory v1 (when designed) reads from that.

---

## Reminder for future Markus

You wanted this. Don't lose it. When Home v1 is in production and you have ~50 conversations archived, that's the right moment to come back to this file and design properly. Until then: file stays as a stub, marker, and reminder.
