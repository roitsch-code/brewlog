# BTTS Home — view spec

**Status:** draft.
**Scope:** Defines the Home view of BTTS. Home is the conversational primary surface — the user opens BTTS into a chat with the agent. Library, brew flow, and other destinations are reached through conversation or through the Burger overlay.
**Relationship to design system:** Builds on v1.0 (frozen) and v1.1 (draft). Introduces new primitives: Chat Surface, Pre-Composition Bubble, User Bubble, Photo Bubble, Coffee Reference Bubble, Action Pill, Attachment Sheet, Reference Coffee Picker Sheet, Navigation Overlay, Conversation Starter. These extend the system rather than replace it.
**Wireframe source:** Figma frames received 2026-05-12, plus Dot screenshots for top-edge fade behaviour reference.

⚠️ **Wireframes are structural, not visual.** Markus's Figma frames are black-on-white wireframes showing layout, hierarchy, and interaction. Final implementation uses v1.0 Light System styling: warm-cream Field background, Glass treatments on bubbles and sheets, Fraunces title, Inter body, all warm foreground tokens. Where the wireframe shows a bordered pill or rectangle, the implementation renders Glass.

---

## 0. The model

Home is the chat. Title and Burger live in the header; the rest of the screen is conversation. Voice and type are parallel input methods — voice initiates via a Waveform tap on the right of the sticky input, type initiates by tapping into the input field. Image and Coffee Reference are attached via a `+` sheet on the left.

The agent classifies each message and either responds inline with prose (optionally followed by up to three Action Pills) or issues a navigation directive that the client interprets — e.g. routing into Step 2 with a photo pre-loaded, or Step 3 with a coffee pre-selected.

There is no diary feed, no card grid, no "New Brew" CTA on Home. Brew Again, Library queries, and new-coffee scans all flow through conversation.

---

## 1. Header

Always visible, sticky-top. Sits above the Hero slot; the slot scrolls past it on scroll (see §4.4).

- **Title:** "Better taste than sorry", **plain text — no Glass, no border, no pill frame**. Inter 14/500, foreground at 60% opacity. Top-left at `pt-12 pl-5`.
- **Burger:** Icon top-right, `h-11 w-11 rounded-full` Glass treatment with hairline border. Top-right at `pt-12 pr-5`. Tap opens Navigation Overlay (§7).
- **No back button** on Home — it is the root.
- **No progress dots.**

The Title is a soft functional anchor, not a hero element. It identifies the app for context, no more. The Hero on Home is the Conversation Starter (§8) or the live conversation thread (§4) — not the title.

⚠️ **Anti-pattern:** Do not put the Title in a Glass pill, do not give it a border, do not increase the font size, do not center it. The Title sits quietly in the top-left corner. It does not compete with the Hero.

⚠️ **Spec change note:** Earlier drafts of this spec called for a Glass-pill Title with Inter 18/500 as a small editorial frame. That created two competing editorial elements on Home (Title and Starter). Resolution: Title becomes plain functional text, Starter takes the full editorial weight as Hero.

---

## 2. Conversational input bar

Sticky-bottom. The user's anchor through every state of the screen.

### 2.1 Anatomy (Idle)

```
                                              
                                              
         [conversation thread area]           
                                              
                                              
                                              
  (+)  ┌────────────────────────────────┐    
        │ Ask anything…              🎵 │    
        └────────────────────────────────┘    
```

- **Outer container:** `px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3`
- **Left button (+):** `h-11 w-11 rounded-full` Glass, `+` icon at foreground 70%. Tap opens Attachment Sheet (§5).
- **Gap:** ~12px between `+` and the pill
- **Input pill:** Flex-grow, `h-11 rounded-full` Glass, padding `pl-5 pr-3`, placeholder "Ask anything…" in muted-foreground (Inter 15/400).
- **Right icon (inside pill):** Waveform at `mr-2`, foreground 60%, `h-5 w-5`. Tap starts voice recording.

### 2.2 States

The input bar has these states. The bar's visual differs per state; the overall sticky-bottom position stays.

| State | Left | Input area | Right |
|---|---|---|---|
| **Idle** | `+` | Pill with placeholder "Ask anything…" | Waveform |
| **Typing** | `×` | Pre-Composition Bubble appears (see §3); input pill becomes a thin reference below | Send (↑) inside bubble |
| **Photo attached** | `×` | Pre-Composition Bubble with Photo thumbnail at top | Send (↑) inside bubble |
| **Coffee referenced** | `×` | Pre-Composition Bubble with Coffee chip at top | Send (↑) inside bubble |
| **Recording** | `×` | Bar morphs into Recording-pill: live waveform animation across full width | (Waveform morphs to stop; tap stops + sends to transcription) |
| **Transcript review** | `×` | Pre-Composition Bubble with transcript text (user can edit) | Send (↑) inside bubble |
| **Thinking** | `×` (cancel response) | Empty bar with three Dots above (`mb-3`) | Spinner |
| **Streaming** | `×` (stops TTS only — see §4.6) | Empty bar | Idle Waveform |

State transitions are instant — no animations between states.

### 2.3 The Cancel button (`×`) — contextual semantics

The `×` replaces `+` whenever composition or response is active. Its behaviour depends on state:

- **Typing / Photo attached / Coffee referenced / Transcript review:** Cancels composition. Clears text and attachment. Returns to Idle.
- **Recording:** Cancels recording. No transcript is generated, nothing is sent. Returns to Idle.
- **Thinking:** Cancels the agent request before response starts. Returns to Idle.
- **Streaming:** Stops the TTS playback only. Text response continues to stream and completes. Returns to Idle when text is done.

This is one button with five context-dependent behaviours. The icon stays `×`, the action varies.

### 2.4 Voice: Tap-to-Start, Tap-to-Stop, Transcript Review

The voice flow has three phases:

**Phase 1 — Recording.** User taps Waveform in Idle. Bar morphs to Recording-pill (full-width Glass pill, live audio waveform animating left-to-right). `×` left, stop indicator right. **No audio is stored** — ElevenLabs Scribe transcribes in stream; raw audio is discarded after transcription.

**Phase 2 — Stop and transcribe.** User taps the stop indicator (the right-edge morphed Waveform). Recording ends. Transcription processes (~1–2s with Scribe). During this micro-moment, the bar shows the same `×` left + a small spinner right.

**Phase 3 — Transcript review.** Transcript appears in a Pre-Composition Bubble (§3) — same Bubble used by typing. User can edit the transcript if Scribe mis-heard a coffee name. Send (↑) commits. `×` left cancels (discards transcript, returns to Idle).

The Transcript Review state is identical to the Typing state, just pre-populated. The same Bubble, same edit affordances, same Send. Voice does not create a separate path; it transcribes into the normal composition flow.

⚠️ **Anti-pattern:** Do not auto-send transcript after Scribe completes. Voice errors on coffee names are common ("Friedhats" → "Free hats", "Geisha" → "geyser"). Transcript Review is essential for editable correction.

---

## 3. Pre-Composition Bubble

When the user starts composing — by tapping into the input pill, attaching content via `+`, or completing voice transcription — the input area morphs into a Glass Bubble that floats above the input pill. The bubble is where composition happens; Send (↑) lives inside the bubble.

### 3.1 Anatomy

```
                 ┌──────────────────────────┐
                 │  [Attachment if present]  │
                 │                          │
                 │  Composed text…          │
                 │                          │
                 │                     ↑    │
                 └──────────────────────────┘
  (×)  ┌────────────────────────────────┐
        │ Ask anything…              🎵 │
        └────────────────────────────────┘
```

- **Bubble frame:** `rounded-2xl` Glass treatment, padding `p-3`
- **Width:** Grows with content, `max-w-[calc(100%-64px)]` (room for `×` on the left edge)
- **Position:** Right-aligned, `mb-2` above the input pill
- **Send button (↑):** `h-9 w-9 rounded-full bg-[hsl(20_14%_12%)] text-[hsl(30_40%_97%)]`, in bottom-right of bubble, `m-2`
- **Text:** Inter 15/400, foreground

The input pill **stays visible** below the bubble — placeholder "Ask anything…" still shown — so the user has a continuous visual anchor. Tapping the pill again would close the bubble's keyboard but **preserves typed text and any attachment**; tapping the bubble re-opens the keyboard.

### 3.2 Behaviour

- Bubble appears empty when triggered by `+`-Tap with no attachment yet (rare edge case; bubble only really materialises with content)
- Bubble grows vertically as user types more
- Send (↑) becomes active (full opacity) only when at least one of: text present, attachment present. Disabled (foreground 30%) otherwise.
- **Placeholder in the Bubble:** "Ask anything…" — same as the input pill. Unified placeholder regardless of attachment type.

⚠️ **Decision noted:** Earlier wireframes used "Share…" as Bubble placeholder when a Photo was attached. Final choice: **"Ask anything…" everywhere**, regardless of attachment. The attachment itself signals what is being asked about; the placeholder remains neutral. (Cognitive consistency over context-specific hints.)

### 3.3 Attachment display in the Bubble

When a Photo or Coffee Reference is attached, it appears at the top of the Bubble:

- **Photo:** Thumbnail at `h-20 w-20 rounded-xl`, top-left of bubble, with a small `×` button at top-right of thumbnail to remove
- **Coffee Reference:** Chip with `[coffee-cup-icon] Roaster · Name`, smaller height (`h-7`), with `×` button to remove

Below the attachment: the typing area. The user can compose text alongside the attachment.

**Max one attachment per message.** Photo OR Coffee Reference, not both. If the user has one attached and selects another from the +-Sheet, the new attachment replaces the old (no warning prompt — silent replacement; user can tell from the changed thumbnail).

---

## 4. Conversation thread

Where user messages and agent responses live. Renders between the header and the input bar.

### 4.1 Anatomy

```
┌─────────────────────────────────┐
│  Better taste than sorry   ☰   │   header (always visible)
│                                 │
│        [faded older content]    │   top edge: fade out + blur
│                                 │
│                  ┌────────┐    │   user content (right-aligned)
│                  │ Photo  │    │
│                  │        │    │
│                  └────────┘    │
│                  ┌────────────┐ │
│                  │ user text  │ │
│                  └────────────┘ │
│                                 │
│  Agent response prose body…     │   agent response (left-aligned, no bubble)
│  …continues across lines…       │
│                                 │
│  (☕ Pill) (🔄 Pill)            │   Action Pills (§6)
│                                 │
│  (+)  [Ask anything…    🎵]     │   input bar
└─────────────────────────────────┘
```

### 4.2 User content — bubble style, right-aligned

User-generated content (text, attachments) renders as Glass bubbles, right-aligned, `max-w-[80%]`, `rounded-2xl px-4 py-3`. Same Glass treatment as the Pre-Composition Bubble.

**Stacked bubble rule:** when a user message includes an attachment, the attachment renders as its own bubble *above* the text bubble. Two bubbles, both right-aligned, both Glass, separated by `mb-2`:

- **Photo bubble:** ~280×280 image, `rounded-2xl`, Photo content fills bubble
- **Coffee Reference bubble:** Coffee-cup-icon + Roaster (small, muted) + Name (foreground), `rounded-2xl`, content centered, `min-h-[60px]`. Optionally renders the coffee's v1.1 `field_zones` palette as a subtle background gradient when v1.1 is live.
- **Text bubble:** Inter 15/400, the user's typed or transcribed text

If both attachment and text are present, both bubbles render. If only attachment, only the attachment bubble. If only text, only the text bubble.

### 4.3 Agent response — prose body, left-aligned

Agent responses render as plain prose, left-aligned, full content width (`px-5`), Inter 15/400. Paragraph spacing `mb-3` between paragraphs. **No bubble around the response.**

This is the key visual distinction: user speaks in bubbles, agent speaks in prose. It mirrors Dot's pattern and serves the editorial brand — BTTS writes, the user chats.

### 4.4 Top-edge scroll fade

When the conversation scrolls upward (older messages disappearing into the header area), the top of the thread fades to transparent and blurs slightly. Reference: Dot's behaviour, confirmed by Markus.

Implementation: A `mask-image: linear-gradient(to bottom, transparent 0%, black 80px)` on the conversation container, top 80px being the fade zone. Header sits above the masked area. Optionally, a subtle backdrop-blur on the masked content as it nears the header.

The fade signals "history exists, scroll up" without taking screen real estate. Older messages remain accessible by scrolling but don't visually clutter.

### 4.5 Scroll behaviour

- **Default position:** Latest message at bottom, conversation scrolled to bottom, input bar visible
- **Manual scroll up:** User can scroll up to see older messages
- **New response auto-scroll:** Auto-scroll-to-bottom on new agent message *unless* the user has manually scrolled up (preserves their position during long agent responses)
- **Conversation persists** for the duration of the app session (see §10 for cross-session persistence)

### 4.6 TTS stream parallel to text stream

Agent responses stream as text in the body **and** as TTS audio through ElevenLabs synthesis simultaneously. Two streams, one response.

**`×` during Streaming stops TTS only.** Text continues streaming to completion. The user can choose to:
- Stop the audio if they're in a context where it's unwelcome (meeting, library)
- Let both run if they want voice + text together

There is no "stop everything" button. Text always completes once the agent has started responding. This is a deliberate decision: cancelling text mid-stream creates partial-state UX problems that aren't worth the rare cancel-need.

⚠️ **Anti-pattern:** Do not auto-play TTS without user opt-in. TTS-on-response should be a user preference (Settings → Audio → "Read responses aloud" toggle), default off. Sound coming out of a phone unannounced is bad UX.

### 4.7 Compose-while-streaming

The user can tap into the input field while an agent response is still streaming. Composition is active — Pre-Composition Bubble opens, keyboard rises, typing works. **Send (↑) is disabled** until the agent response completes. Send becomes active when streaming finishes; tapping sends the queued message.

This protects the natural conversation order: one exchange completes before the next begins. The user doesn't lose their next-message draft to a still-running response.

---

## 5. Attachment Sheet (+-Sheet)

Tapping `+` in Idle opens a small bottom sheet above the input bar with three options.

### 5.1 Anatomy

```
                  ┌─────────────────────────┐
                  │  📷  Camera             │
                  │  🖼️  Photo library      │
                  │  ☕  Reference coffee   │
                  └─────────────────────────┘
  (×) [Ask anything…             🎵]
```

- **Sheet container:** `rounded-2xl` Glass treatment, padding `p-2`, positioned `mb-2` above the input bar, `max-w-[280px]` width, left-aligned (so it visually anchors to the `+` button below)
- **Rows:** Three vertically stacked. Each row `h-10 px-3 rounded-xl flex items-center gap-3`, Inter 15/500, foreground
- **Icons:** Lucide icons, `h-5 w-5`, foreground 80%
  - Camera: `Camera` icon
  - Photo library: `Image` icon
  - Reference coffee: Coffee-cup glyph (custom or `Coffee` from Lucide)
- **Tap-outside dismisses** the sheet without selection

### 5.2 Camera option

Tapping "Camera" launches the native iOS Camera (full-screen, system UI). User captures a photo. Apple's confirmation screen (Use Photo / Retake) follows. Once confirmed, returns to BTTS Home with the photo attached — Pre-Composition Bubble appears with Photo thumbnail.

### 5.3 Photo library option

Tapping "Photo library" launches the native iOS Photo Picker. User selects one existing image. Returns to BTTS Home with that photo attached.

**Why Camera and Library are separate options:** iOS's native picker offers both inside a system action sheet. Splitting them at the BTTS Sheet level means the user goes one tap deeper into intent ("I want to take a new photo" vs. "I want to use an existing one"), but skips iOS's action sheet entirely. The result is a more direct path and a Sheet that stays in BTTS atmosphere until handoff.

### 5.4 Reference coffee option

Tapping "Reference coffee" opens the Reference Coffee Picker (§5.5). The +-Sheet is replaced by the Picker Sheet (transition, not nested).

**Disabled state:** When the user's library is empty (no rows in `coffees`), this option is disabled. Label changes to "Reference coffee (library empty)" or similar muted treatment. The Camera and Photo library options remain enabled.

### 5.5 Reference Coffee Picker — separate Sheet

A larger Bottom Sheet, replaces the +-Sheet when "Reference coffee" is tapped.

```
                  ┌─────────────────────────┐
                  │  ☕  Reference coffee   │   header row
                  │                         │
                  │  ┌───────────────────┐  │
                  │  │ Search…           │  │   search pill
                  │  └───────────────────┘  │
                  │                         │
                  │  Some Roaster 1         │   list rows
                  │  Some coffee 1          │
                  │                         │
                  │  Some Roaster 2         │
                  │  Some coffee 2          │
                  │  …                      │
                  └─────────────────────────┘
       (Apple iOS Keyboard)
```

- **Sheet container:** `rounded-t-2xl` Glass, full-width, `min-h-[60vh]` (scrollable list)
- **Header:** Coffee-cup-icon + "Reference coffee", `h-12 px-5 flex items-center gap-3`, Inter 17/500, hairline divider below
- **Search pill:** `h-11 rounded-full` Glass, `mx-5 mt-3`, placeholder "Search roaster or coffee", Inter 15/400. Tap focuses, native keyboard rises.
- **List rows:** Each row `px-5 py-3 flex flex-col`. Roaster label small/muted (Inter 13/400, foreground 60%); Coffee name larger/foreground (Inter 17/500). Tappable area is the entire row.
- **Data source:** `/api/coffees/compact` endpoint. Lightweight library list, supports text search.
- **Tap on a row:** Picker closes, Pre-Composition Bubble appears with Coffee Reference chip at top.

⚠️ **Anti-pattern:** Don't add a search-glass icon to the search pill. The Sheet header already says "Reference coffee" and the placeholder says "Search roaster or coffee". A magnifier icon is redundant.

---

## 6. Action Pills

Action Pills appear directly below an agent response when the response can lead to specific destinations or actions. **Max 3 pills per response.** If the agent's intent suggests more, the agent must prioritise.

### 6.1 Anatomy

```
Agent response prose body…
…ends here.

(☕ Chunky Cherry)  (🔄 Brew this again)
```

- **Pill container:** Horizontal flex, `gap-2`, `mt-4` below response prose, wraps if needed (rare at max 3)
- **Each pill:** `h-9 px-4 rounded-full` Glass treatment, Inter 13/500, foreground
- **Icon prefix:** Small icon left of label, `h-4 w-4`, foreground 80%, `mr-1.5`

### 6.2 Icon meanings — disambiguation

The icon signals what type of action the pill performs. The label says what specifically.

- **☕ Coffee-cup icon:** Navigation pill. Tap opens a destination (Coffee Detail Page, Library, etc.)
- **🔄 Brew/refresh icon (custom SVG, v1.0 §9.2 conventions):** Brew Action pill. Tap starts a brew flow (e.g. Step 3 with that coffee pre-selected)
- **📍 Map pin icon:** Navigation to map view (e.g. café result)
- **🔗 Arrow / Link icon:** Generic navigation / external source

Same coffee can appear in both icon forms in the same response — once with Coffee-cup ("☕ Chunky Cherry" → opens detail) and once with Brew ("🔄 Brew Chunky Cherry again" → starts brew). Different actions, same coffee.

### 6.3 Tap behaviour

Tapping a pill is a single navigation event. No confirmation, no in-between sheet. The destination loads. If the destination is a brew step (Step 2 or Step 3), the flowStore is pre-populated with the relevant coffee or photo data before navigation.

⚠️ **Anti-pattern:** Do not put primary CTAs (e.g. "Brew this") as inline buttons within the response prose. Action Pills are the only action affordance on agent responses. Keeps prose readable and actions clearly grouped.

---

## 7. Navigation Overlay (Burger)

Tap on the Burger icon top-right of header opens a full-screen overlay.

### 7.1 Anatomy

```
┌─────────────────────────────────┐
│  ✕                              │   close button, top-right
│                                 │
│  Library                        │
│  Cafés                          │
│  Taste profile                  │
│  Match                          │
│  Settings                       │
│                                 │
│                                 │
└─────────────────────────────────┘
```

- **Overlay:** Full screen, Glass treatment, Field background (v1.0 §2.1) remains visible through the overlay
- **Close:** `×` icon top-right, same position as the Burger was, mirroring placement so thumb knows where to look. Tap closes.
- **Destinations:** Vertical list, `pt-24 pl-6`, gap `mb-6` between items, Inter 24/500, foreground
- **Tap on destination:** Navigates and closes overlay simultaneously

### 7.2 Destinations

```
- Home
- Past Conversations
- New Session
- Coffee Library
- Nearby
- Café Library
- Taste Profile
```

- **Home** — returns to the chat surface. Explicit link so deep destinations (e.g. Taste Profile) have a clear way home.
- **Past Conversations** — archive of all previously-archived conversation threads (see §10). List view shows date + first User-Message as preview. Tap → opens that thread read-only. Swipe-to-delete on individual entries. Sits as second item in the menu because the conversation archive belongs conceptually next to Home — they share the chat surface, just at different points in time.
- **New Session** — opens the brew flow (StepMode → Home Brew / Coffee Shop / Taste Match). Backup path for when the user prefers a structured entry over a chat command. Stays in v1 as a safety net; may be removed in later iterations once chat-driven brew commands are reliable.
- **Coffee Library** — full library of coffee bags (search, filter, sort, detail pages)
- **Nearby** — map view for exploring, navigating, and finding places. Was previously called "Cafés"; renamed because the view's job is geographic discovery, not the user's own café history.
- **Café Library** — log of brews the user has had at external locations. Different from Nearby: this is the *record* of past café visits and their brews, not a discovery surface.
- **Taste Profile** — taste profile + AI-written summary of taste evolution

Flat list, no hierarchy. Seven items, one tap each.

**Not in Burger:**
- **Insights** — accessible only as chat response ("tell me something new about coffee")
- **Match** — folded into New Session as one of three StepMode options (Home Brew / Coffee Shop / Taste Match)
- **Settings** — BTTS is a single-user app. There is no Settings destination in v1. Equipment, grinder, and preferences are captured once via Onboarding and edited inline when relevant (rare). If a Settings-like surface becomes necessary later, it'll get its own spec.

### 7.3 Visual style

Same Glass treatment as cards: `bg-[hsl(36_55%_96%_/_0.55)] backdrop-blur-[14px]`. The atmospheric Field remains visible underneath. The overlay sheets *over* Home, doesn't replace it — Home is still there, just behind a sheet.

⚠️ **Anti-pattern:** Don't add icons next to destination labels in the Burger. The list is short, the words are clear. Icons add noise without clarity gain. Editorial-pure: just words.

---

## 8. Conversation Starter — the editorial Hero of Home

When the Hero slot is in Starter state (§11.1) — i.e. on the first app-open of a new day, or after an idle-reset, or whenever a live thread is absent — Home shows a short editorial sentence as its centrepiece. This is **the** Hero element of Home: the surface's voice, its writer's opening line, the thing the user reads on entering. It carries Home the way "What's the vibe?" carries Brew Context.

The Starter dismisses on the first composition action (typing, attaching, starting voice). On subsequent visits within the same day where the Hero slot would otherwise show a Starter (e.g. after an idle-reset cleared a thread, see §10), the same Starter from earlier in the day is shown again — not regenerated, not dismissed. Per-day caching applies until midnight.

### 8.1 Anatomy

```
┌─────────────────────────────────┐
│ Better taste than sorry      ☰ │
│                                 │
│                                 │
│                                 │
│   Good morning.                 │
│   DAK Coffee Roasters           │
│   yesterday — try Process       │
│   or anything new today?        │
│                                 │
│                                 │
│                                 │
│  (+)  [Ask anything…    🎵]    │
└─────────────────────────────────┘
```

- **Position:** Hero-slot center. Vertically centred in the space between the Header (top, sticky) and the Input Bar (bottom, sticky). See §11 for the Hero-slot geometry definition. The Starter sits where the slot's vertical midline is — not pinned to the viewport center, but to the slot's center.
- **Typography:** Fraunces ~40px, semibold (600), leading-tight, foreground at full opacity, left-aligned. Matches the typographic treatment of the Brew Context Hero Question ("What's the vibe?") — same scale, same family, same weight, same colour weight. Same surface posture.
- **Text alignment:** Left-aligned within the slot, not centred per line. The block has presence on the left margin (`pl-5` matching the Title's left edge) and breathes to the right with natural ragged line breaks.
- **Length:** Haiku-generated, 8–16 words, breaks naturally across 2–4 lines depending on content.
- **Text content:** Haiku-generated, contextual based on user's last brew + time of day + library state.
- **No tap target, no background, no border, no Glass treatment.** Pure typography on the Field. The Starter is reading material, not an affordance.

⚠️ **Reference surface:** The Brew Context view in BrewLog (currently rendered with Field gradient + Fraunces Hero Question "What's the vibe?") is the canonical reference for the Starter's typographic treatment. When implementing Home, look at Brew Context first, then replicate the same Fraunces scale and weight for the Starter. If they diverge, Brew Context wins until Home is brought into alignment.

⚠️ **Anti-pattern:** Do not render the Starter as small Inter body text. Do not centre each line. Do not put it in a Glass pill. The Starter is the largest, most editorial element on Home — bigger than the Title (Inter 14/500 at 60% opacity), bigger than any bubble, bigger than any pill. If it does not feel substantively larger than every other text element on Home, it is wrong.

### 8.2 Generation logic

Data sources: existing `loadUserProfile()`, `buildRecentRecipes()`, `loadCoffeeLibraryCompact()` helpers.

Haiku is prompted for **one short editorial sentence**, 8–16 words, no exclamation marks (a soft question mark is fine if natural), no second sentence. Generated **once per calendar day** and cached in localStorage with a `lastStarterDate` timestamp. On the next calendar day, regenerated on the first app-open.

If the user opens the app multiple times in one day, the same Starter is shown each time (until dismissed by interaction — see §8.3).

### 8.3 Lifecycle within a day

1. **First app-open of the day** → Starter is generated (once per calendar day, see §8.2) and rendered immediately as the Hero element of Home.
2. **Starter stays visible** as long as no composition action occurs. Opening the Burger and closing it, navigating to another view and returning, scrolling — none of these dismiss the Starter.
3. **First composition action dismisses the Starter:**
   - Tap into the input pill (typing intent)
   - Tap `+` (attachment intent)
   - Tap Waveform (voice intent)

   The Hero slot now switches from Starter state to Live-thread state (§11.2). The Starter is hidden while the thread is active.
4. **Within-session dismissal-then-cancel** — the user taps `+` but closes the Sheet without selecting, or starts typing then taps `×`. The thread is still empty (no message sent yet), so technically the slot would have nothing to show. The Starter **does not return mid-composition cancellation**: the user already saw it and chose to act. The slot stays in the "user is between actions" state without re-pulling the Starter. The user will see the Starter again next time it qualifies (next idle-reset or next day).
5. **30-min idle-reset, same day** — the user closes the app or leaves it idle for more than 30 min, then returns. The previous thread auto-archives (§10). The Hero slot is now empty of conversation, so today's Starter returns to the slot. Same Starter, not regenerated.
6. **Next calendar day** — fresh Starter generated on the first app-open. The cycle restarts.

So the Starter can appear multiple times within a single day: once on first open, and again after each idle-reset (each time the thread archives and the slot would otherwise be empty). It is the **same** Starter all those times. The Haiku regenerates only at calendar-day boundaries.

⚠️ **Anti-pattern:** Do not regenerate the Starter mid-day. One Starter per day, period. If the slot needs filling multiple times in a day, the same text appears.

⚠️ **Anti-pattern:** Do not show the Starter on top of a live thread. The slot is *either* Starter *or* thread, never both.

---

## 9. Intent classification — the agent's job

The agent classifies every incoming message and decides between **inline response** and **navigation directive**. This logic lives in the agent prompt and tool-use, not in client code.

| Intent | Trigger examples | Response shape |
|---|---|---|
| **Information query** | "What's the difference between Yellow and Black Honey?" | Inline prose, optional Action Pill (Coffee-cup if a specific coffee is referenced) |
| **Brew command — specific coffee** | "Brew Chunky Cherry again", "Make the DAK one", "I want the cherry coffee" | Inline confirmation + Brew Action Pill, OR direct navigation directive to Step 3 |
| **Brew command — open** | "What should I brew now?", "I want to brew" | Inline recommendation prose + Coffee-cup Pill (to that coffee) + Brew Action Pill (to start) |
| **Library query** | "Show my last coffees", "What's in my library?" | Inline prose summary + up to 3 Coffee-cup Pills |
| **Photo + brew intent** | Photo attached + "analyze and brew this" | Inline ack + navigation directive to Step 2 (photo pre-loaded) |
| **Photo + info intent** | Photo attached + "what is this?", "tell me about this bag" | Inline analysis using `analyze_image`, optional Coffee-cup Pill if known coffee identified |
| **Reference coffee query** | Coffee chip attached + question | Inline answer using coffee context, no Pill needed (coffee already on screen) |
| **Navigation request** | "Show me cafés in London Soho", "Open my taste profile" | Inline confirmation + Navigation Pill |

### 9.1 Ambiguity handling

When the user references a coffee that matches multiple library entries ("the bourbon" with two bourbons):
- **Default:** Ask in chat — "Which one — Red Bourbon or Yellow Bourbon?"
- **Fallback (close match-confidence):** Render two Coffee-cup Pills, user taps to disambiguate

⚠️ **Anti-pattern:** Do not default to "most recently brewed" silently when ambiguous. The user deserves a question.

### 9.2 Fuzzy matching

Coffee references in user input can be partial, casual, or vague ("the cherry one", "DAK Coffee Cherry", "that cherry from DAK"). The agent must fuzzy-match against the user's library before deciding intent routing. This builds on the existing `getVarietyPriorsForBag` fuzzy-match pattern but extends to coffee name + roaster matching.

---

## 10. Conversation persistence

**Within a session:** Conversation thread persists in the database. User sends a message, navigates away via Action Pill or Burger to another view, completes a brew, returns to Home — thread is still there, exactly as left.

**Across sessions — 30-minute idle window:** When the user reopens BTTS, the system checks the timestamp of the last *send* (User-Message or Agent-Response, whichever is later). If less than 30 minutes have elapsed, the existing thread is resumed in the Hero slot. If more than 30 minutes have elapsed, the thread is auto-archived and the Hero slot resets to Conversation Starter (§8) — same Starter as earlier the same day, or fresh Haiku if it's a new calendar day.

**Auto-archive trigger:** Any thread that gets reset by the idle-window check is automatically saved to the Past Conversations archive, accessible via the Burger (§7.2). Empty threads — app opened, Starter seen, nothing sent — are not archived. Only threads with at least one User-Message survive.

**Manual archive trigger:** None in v1. The only path into the archive is the idle-window auto-archive.

**Storage:** Postgres via Drizzle. Two new tables:
- `conversations` — id, started_at, ended_at, message_count, first_user_message (for preview in archive list)
- `messages` — conversation_id, role (user / agent), content (text), attachments (jsonb: photo path, coffee_id), created_at

Single-user app, so no `user_id` column needed. Authentication handled at app-level via existing WebAuthn passkey.

**Retention:** Unlimited. Archive grows indefinitely. Manual delete is available via Past Conversations list (swipe-to-delete on individual entries; long-press for bulk select TBD if ever needed).

**The "Hero slot is never empty" guarantee:**

Combining §8 (Starter) and this section:
- If a live thread exists (within 30-min idle window): Hero slot shows the conversation
- If no live thread (fresh open, post-idle-reset, or new calendar day): Hero slot shows today's Starter
- Within a day, after dismissal-by-interaction, the same Starter returns whenever the slot would otherwise be empty
- Across days, the Starter regenerates once per calendar day on first open

The slot is content-bearing in every state. Empty is not a state.

⚠️ **Anti-pattern:** Do not show the archive UI on Home. The archive is reached only via Burger → Past Conversations. Home itself never lists or hints at past threads — that's not what Home is for. Home is current-only.

---

## 11. Hero-slot content states

The Hero slot — the editorial middle of Home — has three content states. The slot is never empty (see §10's "Hero slot is never empty" guarantee). What it shows depends on whether a live thread exists and whether today's Starter has been generated.

### 11.0 Hero-slot geometry

The Hero slot is the vertical region between the sticky Header (top) and the sticky Input Bar (bottom). It is the entire space between them.

- **Top edge of slot:** Bottom of the Header. Header is `pt-12` + content height (`h-11` for Burger) + ~`pb-3` breathing room — practically ends ~96px from the top of the viewport on a 390-wide iPhone.
- **Bottom edge of slot:** Top of the Input Bar. Input Bar is `pt-3` + content height (`h-11`) + `pb-[max(1rem,env(safe-area-inset-bottom))]` — practically begins ~96px from the bottom of the viewport on a 390-wide iPhone with safe-area.
- **Slot content vertical positioning:** When the slot is in Starter state (§11.1), the Starter text block is **vertically centred within the slot** — `flex items-center` on the slot container, so the Starter sits at the slot's vertical midline regardless of how many lines the Starter takes.
- **Slot content horizontal positioning:** Starter text is left-aligned at `pl-5` (matching Title and Input Bar left padding); Starter content has natural right-side ragged-edge wrapping based on its content length, with no forced right margin beyond viewport-edge breathing.

When the slot is in Live-thread state (§11.2), the slot becomes a scrollable container with the Conversation Thread filling it (see §4 for thread layout, which has its own top-edge fade and bottom-anchored scroll).

⚠️ **Anti-pattern:** Do not pin the Starter to viewport-center (`min-h-screen flex items-center` on the full viewport). The Starter belongs to the *slot*, not the viewport. If the slot's center and the viewport's center diverge (because Header or Input Bar grow), the Starter follows the slot.

### 11.1 Starter state — fresh slot

The Hero slot shows today's Conversation Starter (§8). This is the state on:

- First app-open of a new calendar day (Starter freshly generated)
- Any subsequent app-open on the same day, when no live thread exists (post-idle-reset or after the previous thread was auto-archived per §10)

What renders:
- Header (Title + Burger)
- **Conversation Starter in the Hero slot** — the daily editorial greeting from Haiku, Fraunces ~40px (see §8.1)
- Idle input bar at bottom with "Ask anything…" placeholder

The Starter is the centrepiece. It greets the user as a writer would open a letter. The user reads, then decides whether to respond by typing, speaking, or attaching.

### 11.2 Live-thread state — conversation in progress

The Hero slot shows the active conversation thread. This is the state once the user has sent at least one message in the current session (or has returned within the 30-min idle window with a thread still alive).

What renders:
- Header (Title + Burger)
- **Conversation thread in the Hero slot** — user bubbles right-aligned, agent prose left-aligned, per §4
- Idle input bar at bottom (or one of its composition states, per §2)

No Starter is shown while a live thread exists. The thread *is* the editorial surface.

### 11.3 Fresh-app state — no Starter context yet

Edge case: the very first time the user ever opens BTTS (no library, no history), the Haiku generation has no context to draw from. The Starter for this case defaults to a static welcome line — *"Welcome to Better Taste Than Sorry."* — for one day, then the regular per-day Haiku cycle takes over once history exists.

This is a sub-state of Starter state (§11.1), not a separate state. The slot still renders a Starter; the Starter's content is just a fallback string.

⚠️ **Anti-pattern:** No "Welcome to BTTS" overlay modal. No onboarding carousel. No "Try saying: 'Brew the Bourbon again'" chip. The Starter (or its static fallback) is the only greeting affordance.

⚠️ **Anti-pattern:** No truly empty Hero slot. If the slot would otherwise be empty (post-dismissal, post-idle-reset, post-archive), today's Starter returns. Empty middle is not a permitted state — see §10.

---

## 12. What's NOT in this spec

Deferred to other documents or future iterations:

- **Brew flow step migrations** — Step 2 (Scan), Step 3 (Context), and others each get their own view spec when migrated to Light
- **Coffee Detail page** — destination Coffee-cup Pills navigate to. Currently Dark. Spec when migrated.
- **Library full view** — full destination via Burger. Currently Dark. Spec when migrated.
- **Voice playback-before-send** — Dot has this pattern (a Play button between Cancel and Send during recording-review). BTTS v1 does not — transcript review is the QA mechanism, audio is discarded
- **Multi-image attachments** — single image only in v1
- **Match as chat intent** — Match stays a Burger destination for v1; may migrate to chat-intent later
- **Generative Field on Coffee Reference bubble** — when v1.1 is live, the coffee's `field_zones` can render as a mini-gradient background on the in-thread Coffee Reference bubble. Visual upgrade, not a requirement.
- **Settings → "Read responses aloud" toggle** — implied by §4.6 but not specced here. v1 default: TTS off, user opts in
- **TTS voice selection / customisation** — ElevenLabs has voice options; v1 picks one default

---

## 13. New primitives this spec introduces

For Step B integration, these primitives need to be built in `src/components/ui/light/`:

- **`<ChatSurface>`** — conversation thread container with top-edge fade (§4.4)
- **`<ChatInput>`** — sticky-bottom input bar with all eight states (§2.2)
- **`<CompositionBubble>`** — the floating Pre-Composition Bubble with Send (§3)
- **`<UserBubble>`** — right-aligned Glass bubble for user messages in thread (§4.2)
- **`<PhotoBubble>`** — right-aligned Glass bubble containing a photo, in-thread (§4.2)
- **`<CoffeeReferenceBubble>`** — right-aligned Glass bubble with coffee chip, in-thread (§4.2)
- **`<AgentResponse>`** — left-aligned prose container, no bubble (§4.3)
- **`<ActionPill>`** — Glass pill with icon prefix, three icon variants (§6)
- **`<AttachmentSheet>`** — three-option Bottom Sheet for `+` (§5.1)
- **`<ReferenceCoffeePicker>`** — separate Bottom Sheet with search + list (§5.5)
- **`<NavigationOverlay>`** — Burger full-screen overlay (§7)
- **`<ConversationStarter>`** — daily editorial hint above input (§8)

Plus the foundation primitives already specced in v1.0 (`<LightShell>`, etc.), which Home consumes.

---

## 14. Step B integration sequence

Replaces the obsolete PR1 briefing. Realistic PR breakdown:

- **PR2a — Light System foundation.** Tokens, Fraunces + Inter, `<LightShell>`, foundational primitives (Section, Footnote, PageHeader — though Home doesn't use them, they're shared system pieces). No consumer yet.
- **PR2b — Home skeleton.** Title, Burger placeholder, empty middle, static "Ask anything…" pill (no interactivity yet). Bottom Nav removed globally. First Light surface live.
- **PR2c — Navigation Overlay (Burger).** Full-screen overlay, destination list, navigates to existing Dark views.
- **PR2d — Chat Input core states.** Idle / Typing / Pre-Composition Bubble / Send. No attachments, no voice yet. Connects to `/api/explore-agent` for text-only responses inline.
- **PR2e — Top-edge scroll fade + Agent Response styling.** Thread rendering, prose-vs-bubble visual distinction, scroll behaviour.
- **PR2f — Voice (Recording, Transcript Review).** Bar morphing, ElevenLabs Scribe integration via existing `voice/transcribe`. TTS streaming via existing `voice/synthesize`.
- **PR2g — `+`-Sheet + Photo attachment.** Camera, Photo library, Photo bubble in Pre-Composition, Photo bubble in thread.
- **PR2h — Reference Coffee Picker + Coffee Reference attachment.** Extract from existing `/explore` page, port to Light System.
- **PR2i — Intent classification + Action Pills.** Agent prompt evolution, client-side directive interpretation, Pill rendering.
- **PR2j — Conversation Starter.** `/api/greeting` endpoint, Haiku integration, daily cache logic.
- **PR2k — Conversation persistence + idle-window logic.** Drizzle schema for `conversations` and `messages` tables, migrations, `/api/conversations` routes for create/append/archive, 30-min idle-window check on app-open, auto-archive trigger. Hero-slot decides between live thread and Starter based on this check.
- **PR2l — Past Conversations view.** Burger destination, list view with date + first-message preview, tap-to-open read-only thread, swipe-to-delete.
- **PR2m — `/explore` route removal.** Delete `src/app/explore/page.tsx` and related code. Final cleanup.

Thirteen PRs. Each is small, deployable, reversible. PR2b can ship before any chat logic exists — Home with a placeholder pill is a valid intermediate state. Conversation Starter is one of the last UI PRs because it depends on having composition flows already working. Persistence (PR2k) lands after the chat surface is functional, before the archive view (PR2l) that consumes it.

---

*End of spec.*
