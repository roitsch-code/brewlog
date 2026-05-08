# BrewLog Redesign — Design Language Spec (v0.1, chat-focused)

> **Status:** Phase 0 draft, scoped to what Phases 1–3 need (tokens, primitives, Explore chat). Other surfaces (home feed, brew flow, library, cafés, taste, onboarding) get a spec addendum when those phases start.
>
> **Source material:** `docs/redesign/dot-refs/` — 42 DOT screenshots. The chat / voice / attachment / source / gradient subset (~20 images) was the primary input for this draft.
>
> **Hard rule:** changes to tokens, type, motion or chat patterns must update this file *first*, then propagate to code. The spec is the contract that prevents scope creep mid-redesign.

---

## 1. Translation principle

DOT is a **light** app — soft pearl + peach + warm-grey radial gradients on cream-white bases. BrewLog stays **dark** (per the user's explicit preference). The job of this spec is to translate DOT's *gradient atmosphere*, *editorial typography*, and *chat patterns* onto a dark base — not to copy DOT's palette wholesale.

The closest direct DOT reference for our base look is `Splashscreen2_Dot ios Jul 2024 22.png`: near-black background, soft warm-pink radial blob, painterly falloff. That's the atmosphere we want underneath BrewLog's chat (and eventually the rest of the app).

---

## 2. Color tokens

### Surfaces

| Token | Hex | Purpose |
|------|------|--------|
| `--bg-base` | `#0E0B0A` | Deepest backdrop. Below the gradient layer. |
| `--bg-gradient-warm` | `#3A2018` | Warm peach mid-stop in radial gradient. |
| `--bg-gradient-glow` | `#6B4838` | Brightest radial peak (top-left or bottom-right). |
| `--bg-gradient-cool` | `#1A1614` | Cool falloff toward edges. |
| `--surface-1` | `#171311` | Card / sheet rest state. |
| `--surface-2` | `#1F1A17` | Elevated card / modal. |
| `--surface-pill-user` | `#F5ECE5` | User message bubble (warm cream, not pure white). |
| `--surface-pill-input` | `rgba(28,22,19,0.65)` + `backdrop-blur` | Chat input bar (glassy dark pill). |
| `--surface-pill-attach` | `rgba(40,30,26,0.7)` + `backdrop-blur` | Attachment chips above input. |
| `--border-subtle` | `rgba(255,235,220,0.08)` | Dividers, pill outlines. |
| `--scrim-dialog` | `rgba(8,5,4,0.55)` + `backdrop-blur` | Behind iOS-style permission / sheet dialogs. |

### Text

| Token | Hex | Purpose |
|------|------|--------|
| `--text-primary` | `#F0E8E1` | Body, assistant messages on gradient. |
| `--text-on-pill-user` | `#1A130E` | Text inside the cream user bubble. |
| `--text-secondary` | `#B8ADA4` | Timestamps, source labels, placeholders. |
| `--text-muted` | `#6B635D` | Lowest-priority annotations. |
| `--text-accent` | `#E8C5A8` | Active link / interactive label. Replaces existing `brew-accent` for chat-context use. |

### Accent gradients

Named exports in `src/lib/theme/gradients.ts`:

- `gradientChatBg` — radial, two glow stops, organic; rendered as a wrapper `<div>` with `bg-[radial-gradient(...)]` + a second offset radial via `::before`. Reference: blend of `Splashscreen2_*.png` (background) and `LoadingScreen_*.png` (centered glow).
- `gradientHeroSurface` — used on the home feed hero card and brew flow recommend candidates. Tighter, single-stop.
- `gradientPillUser` — subtle warm-on-warm gradient inside the user bubble for dimensionality (very soft; reference is the cream pill in `Chat_Text_Dot ios Jul 2024 25.png`).
- `gradientButtonPrimary` — for the `StepRecommend` "Brew this" CTA later.

Implementation note: gradients live as exported class strings, not magic literals scattered through components. One source of truth.

### What we keep from existing tokens

- `--font-display` (Geist), `--font-mono-num` — kept.
- `.label-mono` utility — kept.
- `.text-gradient-amber` — **renamed** to `.text-gradient-warm` and re-tinted to match the new accent. Old class deleted; consumers updated.
- `card-scrim` — kept; tint shifts slightly.

### What we delete / shift

- `brew-accent: #D4B896` → replaced by `--text-accent: #E8C5A8` (slightly warmer, slightly pinker — matches the DOT peach without screaming).
- `brew-success: #5A9E5A` — kept, no change.
- `brew-bg: #111111` → replaced by `--bg-base: #0E0B0A` (warmer, less neutral). The chat gradient layer rides on top.

---

## 3. Typography

### Stack

- **Body:** Geist Sans (existing). No change. Geist is clean and sits well next to a serif.
- **Display / editorial:** **Instrument Serif** (decided — free, Google Fonts, variable). Used for the "thinking…" loading state, hero headlines on the home feed, and the empty-state of the chat. Reference: DOT's `LoadingScreen` ("Dot is reflecting on your letter...") sets the tone — a single serif line, generous size, calm. Loaded via Next.js font loader; ~30 KB woff2 budget. Never used at body size — display moments only.
- **Mono:** Geist Mono (existing). No change. Kept for numbers, grind degrees, ratios.

### Scale

| Role | Size | Weight | Line | Font |
|------|------|--------|------|------|
| Display L | 32px | 400 | 1.15 | Instrument Serif |
| Display M | 24px | 400 | 1.2 | Instrument Serif |
| Title | 18px | 600 | 1.3 | Geist Sans |
| Body | 16px | 400 | 1.5 | Geist Sans |
| Body small | 14px | 400 | 1.45 | Geist Sans |
| Label | 13px | 500 | 1.3 | Geist Sans |
| Caption | 12px | 400 | 1.3 | Geist Sans |
| Source pill | 12px | 500 | 1 | Geist Sans |
| Mono number | 14px | 500 | 1 | Geist Mono |

### Specific use cases

- **Assistant chat message:** Body (16/1.5) in `--text-primary`. No bubble, no avatar — just text on the gradient.
- **User chat message:** Body (16/1.5) in `--text-on-pill-user`, inside the cream pill.
- **Timestamp / "Just now":** Caption (12/1.3) in `--text-secondary`, centered.
- **Source link:** Source pill style with `> ` chevron, in `--text-secondary`.
- **Loading state ("BrewLog is thinking…"):** Display M serif, centered, on a faintly intensified gradient.

---

## 4. Radius + shadow

### Radius scale

| Token | Value | Use |
|------|-------|-----|
| `radius-sm` | 8px | Inline chips, small attachments |
| `radius-md` | 14px | Cards, sheets |
| `radius-lg` | 22px | User bubble corner (inside), attachment thumbnails |
| `radius-xl` | 28px | User bubble corner (outside), input pill |
| `radius-pill` | 999px | Full pill (CTA buttons, source links) |

### Shadow / glow

- `glow-subtle`: `0 0 60px rgba(232,197,168,0.08)` — applied to elevated pills (input bar) so they read as floating on the gradient.
- `glow-strong`: `0 0 90px rgba(232,197,168,0.18)` — used during voice recording on the bottom playback pill.
- No drop shadows on cards. Atmosphere comes from the gradient + glow, not stacked drop shadows.

---

## 5. Motion principles

- **Durations:** quick = 160ms, base = 240ms, slow = 480ms, breathing = 2400ms (loops).
- **Easing:** `cubic-bezier(0.32, 0.72, 0, 1)` for all spring-feeling moves (entrances, sheet reveals). `cubic-bezier(0.4, 0, 0.2, 1)` for press / state changes. Linear only for waveform sample timing.
- **Where motion lives:**
  - Message append: 240ms fade + 8px upward slide.
  - Typing indicator: three dots `•••` with staggered opacity loop, 1200ms cycle. **Replaces `CoffeeBeanGlow` as the chat thinking spinner.**
  - Voice waveform (recording): live, sample-accurate bars driven by `AnalyserNode` — not a stock animation.
  - Voice waveform (playback): pre-rendered static bars, with a moving playhead overlay.
  - Send button press: 100ms scale 0.95 → release.
  - Sheet reveal (sources, attach menu): 280ms slide-up + 200ms scrim fade.
  - Splash / hero gradient: subtle 24s `transform: rotate(360deg) scale(1.05)` loop on the radial layer to keep the "alive" feel without being distracting.
- **Reduce motion:** `@media (prefers-reduced-motion: reduce)` strips the gradient rotation and message-append slide, keeps fades only.

---

## 6. Chat patterns (the priority screen)

### 6.1 Layout shell

- **Header (top of chat):**
  - Top-left: **tab switcher pills** for Ask / Insights / Nearby (decided). Active tab uses `--surface-pill-user` background with `--text-on-pill-user` label; inactive tabs are transparent with `--text-secondary` label. Pills sit in a single floating glass container with the same backdrop-blur treatment as the bottom nav.
  - Top-right: three-dots overflow `⋯` opening a sheet with "Clear chat / Settings / Help".
  - **No app icon, no coffee bean, no avatar.** Per the user's explicit note: drop the icon entirely.
  - No title text. The tabs are the only top-level affordance.
- **Message scroll area:**
  - Edge-to-edge horizontally with 20px lateral padding for content.
  - 16px vertical gap between message groups; 8px between same-author follow-ups.
  - Timestamps render centered as a row when there's been a >5 min gap. Format: "Today at 11:30 AM" / "Just now" — same as DOT.
- **Input dock (bottom):**
  - Sticky to bottom, padded for safe area.
  - Glassy pill (`--surface-pill-input` + `backdrop-blur(20px)`).
  - Left: `+` icon (24px, `--text-secondary` → `--text-accent` on tap). Opens attach sheet.
  - Center: textarea, placeholder "Ask something" (already shipped), `--text-secondary` placeholder.
  - Right: stylized 3-bar mic glyph by default → swaps to a **filled circular up-arrow send button** (`--text-accent` fill, dark glyph) when text is present.

### 6.2 Message bubbles

- **User:** right-aligned, max-width 78% of viewport, `--surface-pill-user` background, asymmetric radius (`radius-xl` outer, `radius-lg` inner-bottom-right). Body text in `--text-on-pill-user`. No tail.
- **Assistant:** left-aligned, **no bubble**, max-width 88% of viewport. Body text in `--text-primary` directly on gradient. Markdown supported (existing `MessageContent` parser is good — keep).
- **Loading (thinking):** three dots `•••` left-aligned where the next assistant message will appear. Replaces the current `CoffeeBeanGlow` spinner inside the chat surface. (`CoffeeBeanGlow` may still live elsewhere — Phase 3b will touch only the chat instance.)
- **Source links:** small chevron pill below the assistant message, "Source >" (singular) or "Sources >" (plural). Tapping opens a bottom sheet (see 6.6).
- **Suggestion chips (pre-message):** rendered as a vertical stack of buttons on the empty state. Subtle pill, `--surface-1` fill, `--text-primary` text, lucide icon on left. Match DOT's vertical stacked layout, not a horizontal scroller.

### 6.3 Voice mode

The existing voice hooks (`useVoiceCapture`, `useVoicePlayback`) stay. Visual changes only.

#### Idle → recording
- Tap the mic glyph in the input bar.
- First time only: native iOS permission dialog (already handled).
- Once active:
  - **Top of viewport** (just under the status bar): a small dark capsule appears with a **live mini waveform** + a tiny pulsing dot (`--text-accent` color). DOT renders this in the dynamic-island area; on non-dynamic-island devices we render it as a floating capsule in the same position.
  - **Bottom dock** swaps from the input pill to a **wider waveform display**: live sample bars across most of the width, **stop button** (filled square in a circle) on the right.
  - **No timer.** Per user request — even though DOT shows one. We omit `0:14` text entirely. The waveform itself is feedback enough.
- Gradient backdrop intensifies subtly during recording (multiplicative warm overlay, ~6% lift).

#### Recording → review
- Tap stop.
- Bottom dock becomes a **playback pill**: X (cancel) on left, play button + static waveform + a small refresh/redo icon + filled up-arrow send on right. Still no timer.
- Top capsule disappears.

#### Review → send
- Tap up-arrow.
- The user message renders as a **normal text bubble** containing the transcript only (decided — transcript-only, no audio retained). The waveform UI is for capture/preview only; nothing is persisted as audio. This keeps the existing `useVoiceCapture` flow untouched and avoids adding audio storage. We diverge from DOT here intentionally — DOT keeps the audio pill, BrewLog doesn't need to.

#### Edge cases
- If transcript fails: show a small error banner above the input ("Couldn't transcribe — tap to retry") — already in current code; restyle only.
- If mic permission denied: show iOS-style alert overlay with link to Settings.

### 6.4 Attachment menu (`+` button)

- Tap `+` opens a small bottom sheet (~140px tall) with two rows:
  1. **Photo** — opens iOS photo picker. On select, a thumbnail card stacks above the input pill (rounded `radius-lg`, X to remove). Reuses existing `PhotoUpload` and `/api/upload` route.
  2. **Reference coffee** — opens a search sheet powered by `/api/coffees/compact`. Tapping a coffee adds a small "bag chip" above the input (roaster + name, X to remove).
- After attachments are added, the user types and sends as normal. The composed message bundles:
  - Attached photo URL → forwarded as the agent's `analyze_image` tool input (existing tool, no backend change).
  - Attached coffee → injected into the user-message text as `[Coffee: Friedhats Frinsa Decaf]` so the agent has structured context (existing prompt already understands coffee names from history).
- DOT pattern reference: `Chat_with_Image_Input_Text.png` shows the photo card stacked above the input.

### 6.5 Source links

- After an assistant message that used `fetch_page` or research insights, a small "Source >" / "Sources >" pill renders below the message (left-aligned, indent 0).
- Tapping opens a bottom sheet with a list of sources. Each row: favicon (or generic globe), title, URL truncated, X to close.
- Tapping a source row opens it in an iOS-style **in-app sheet with a URL bar at top** — matches `Chat_Detail_Sources_Maps.png`. Implementation: Safari View Controller via PWA capability if available; else a styled iframe sheet.

### 6.6 What we drop from current chat

- **`CoffeeBeanGlow` as the in-chat thinking indicator** — replaced by `•••`.
- **Avatar / icon next to messages** — there is none today, but explicitly forbidden going forward.
- **The "Hi! I'm BrewLog" hero block** — already removed in commit `87aba71`. Keep it removed.
- **The voice timer** — never adopt DOT's `0:14` display.

---

## 7. Layout primitives that need repainting (Phase 2 work)

| Component | Current | Target |
|-----------|---------|--------|
| `Button.tsx` | Solid `brew-accent` fills, sharp radius | New gradient-fill primary, glass secondary, ghost tertiary; `radius-pill` everywhere. |
| `Chip.tsx` | `bg-card` solid pill | Glass pill (`--surface-pill-input` style) for resting; `--text-accent` border + background for active. |
| `TopMenu.tsx` | Floating rounded-full surface | Strip-style header consistent with chat (no rounded-full container); only the dropdown panel uses a card surface. |
| `BottomNav.tsx` | Single floating rounded-full bottom strip with 5 mixed icons + Brew centered | **Replaced — see §7.1 (4+1 split).** |
| `ScrollContainer.tsx` | Flat `bg-brew-bg` | Place the `gradientChatBg` (or hero variant per page) behind it; container goes transparent. |
| `BottomSpacer.tsx` | No change. |

The `CircularTimer.tsx` glow ring shifts from amber to `--text-accent` warm-peach. The brew flow itself isn't redesigned in Phase 3, but the timer ring lives across screens — single-line touch.

### 7.1 BottomNav — 4+1 split (decided)

Replaces the current single centered pill with **two floating elements** at the bottom of the viewport. Inspiration: the divided-pill pattern at the *top* of Linear's mobile views (back-pill on the left, actions-pill on the right) — adapted to the bottom for BrewLog.

**Main pill** (left, 4 icons, no text labels):

| Slot | Icon (lucide) | Route | Reasoning |
|------|--------------|-------|-----------|
| Home | `home` | `/` | Standard, recognized. |
| Library | `coffee` | `/coffees` | Distinctive against `home`; says "this is where my coffees live" without text. |
| Taste | `radar` | `/taste` | Taste profile already renders as a radar chart — on-the-nose match. |
| Explore | `sparkles` | `/explore` | Reads as "AI / magic" — fits the conversational + voice + image-analysis nature of Explore. |

- Pill: glass surface (`--surface-pill-input` + `backdrop-blur(20px)`), `radius-pill`.
- Height ~52px, internal horizontal padding so each tap target is ≥44×44px.
- Active state: subtle inner tile (`--surface-2` overlay, `radius-md`) behind the icon, with the icon stroke shifting from `--text-secondary` → `--text-primary`.
- Optional: a small `--text-accent` chevron-up indicator above the active tile (the Linear pattern). Decide during Phase 2 implementation; can be added in a one-line follow-up if it doesn't read well.

**Brew FAB** (right, separated):

- `plus` icon (lucide), filled.
- Circular, 56px diameter (visually outranks the 52px nav).
- Background: `--text-accent` (`#E8C5A8`); glyph: `--bg-base` (dark).
- Glow: `glow-subtle` so it reads as floating.
- Sits ~14px to the right of the main pill.
- Tap → `/brew/new` (existing route, unchanged).

**Layout:** both elements anchor to the safe-area bottom with ~16px lateral padding from screen edge. The Brew FAB is intentionally larger and color-distinct — Brew is the app's primary action, navigation is secondary.

**Hidden on:** routes that own their own bottom dock — `/explore` (chat input replaces it on the Ask tab), `/brew/new` and steps (their own flow shell). Same hide rules as today; just two elements to fade instead of one.

**Why not a hamburger menu:** rejected by the user. Bottom nav stays because Home / Library / Taste / Explore are surfaces accessed multiple times per session; hiding them behind a modal tap costs more than it saves.

---

## 8. Decisions log

All Phase-3 blockers resolved 2026-05-08:

1. **Voice messages → transcript only.** Existing `useVoiceCapture` flow stays; voice messages render as normal text bubbles after transcription. No audio persistence. We diverge from DOT here intentionally.
2. **Chat header → tab switcher pills.** Ask / Insights / Nearby remain the three tabs. Active tab pill uses `--surface-pill-user`; container is glass with the same backdrop-blur as the bottom nav.
3. **Typography → Geist Sans + Instrument Serif (display only).** Instrument Serif loaded via Next.js font loader. ~30 KB woff2 budget. Used on display headlines and "thinking…" states only; never at body size.
4. **Bottom nav → 4+1 split.** Four-icon glass pill (Home, Library, Taste, Explore) + separated Brew `+` FAB. Icon set: `home`, `coffee`, `radar`, `sparkles`, `plus`. Detailed in §7.1.

---

## 9. Out of scope for this draft

The following are **not** specified yet and will be added when their phase begins:

- Home feed / session card surface
- Brew flow steps (Mode, Scan, Context, Recommend, Brew, Log, Summary)
- Coffee library + detail
- Cafés (map + place detail)
- Taste / Match
- Onboarding (DOT references read at the time of Phase 4f, not now)
- Empty / error / skeleton states across the app

Each of these gets a dedicated section appended to this file when its phase opens.

---

## 10. Reference index

The DOT screenshots that informed each section above:

- **Section 1 (translation principle):** `Splashscreen2_*`, `GradientBackground_*`, `LoadingScreen_*`.
- **Section 6.1 (chat shell):** `Chat_Text_*`, `Chat_Text2_*`, `Chat_LongAnswer_*`.
- **Section 6.2 (bubbles):** `Chat_Text_*`, `Chat_Type_*`, `Chat_Type_Long_*`, `Chat_Answer_Animation`, `Chat_Answers_Short`.
- **Section 6.3 (voice):** `Chat_Voice_Access`, `Chat_Voice_Recording`, `Chat_Voice_Transcription`, `Chat_Voice_Send`, `Chat_Voice_Answer`.
- **Section 6.4 (attachments):** `Chat_with_Image_Input_Text`, `Chat_with_Image_Input_Text2`, `Chat_with_Image_and_Text`, `Chat_Interaction_Images_*`, `Chat_with_Image_*`, `Image_Usage_*`, `Access_Camera_*`.
- **Section 6.5 (sources):** `Chat_Reference_Sources`, `Chat_Detail_Sources_Maps`, `Chat_Details_Sources_*`.
- **Not yet read (future addenda):** `Onboarding1`–`Onboarding9`, `Chronicles_*`, `Chronicles2_*`, `Page_Text_*`, `Permissions_*`, `EnablePermissions_*`.
