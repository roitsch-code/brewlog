# BrewLog Design System v1.0

**Status:** v1.0 — distilled from the Brew Context v7 iteration.
**Scope:** Every BrewLog view from v1.0 forward. Old `docs/redesign/spec.md` (Explore chat) is superseded.
**Migration mode:** View-by-view. Brew Detail is the first hero-view to receive this system.
**Source of truth:** Lovable v7 export — `src/index.css`, `src/pages/Index.tsx`, `tailwind.config.ts`.

---

## 0. How to read this document

This is a **system spec**, not a component library. It defines tokens, primitives, and rules that every BrewLog view must respect. View-specific layouts are *applications* of this system, not extensions of it.

Concrete Tailwind values are embedded inline — ready for translation into `tailwind.config.ts` extensions and component classNames during the Claude Code integration step (Step B). Where a value isn't a Tailwind default (arbitrary opacity, arbitrary HSL), the exact arbitrary syntax is shown.

⚠️ **Anti-pattern** boxes flag mistakes that have already been made in earlier Lovable iterations. They are non-negotiable; do not relitigate them in future views.

---

## 1. Visual identity

BrewLog reads as a **warm, hazy, late-afternoon room**. Not a UI — a place. The gradient field is the constant ground; cards float on it as frosted glass; type is editorial, deliberate, almost printed.

**Three anchors:**

- **The Field** — a six-layer radial-and-linear gradient blurred to 60px and scaled past the viewport. It is *always* the background. Cards never sit on a flat color.
- **The Glass** — every interactive surface is translucent (55–70% opacity) with `backdrop-blur` and `backdrop-saturate-150`. The Field reads *through* the surface, not behind it.
- **The Voice** — Fraunces Semibold for the hero question on each view. Inter for everything that asks the user to act or read. Editorial serif for emotion, geometric sans for information.

**Tonal range:** cream → cool mauve → warm peach → warm orange. Never cold, never neutral grey. Selected states deepen into warm taupe, not flatten into grey.

**What this system is not:**

- Not a card-on-white-card system. Cards are glass, not paper.
- Not a "dark mode invertible" system. The Field *is* the system. A future dark variant would need its own Field, not a flipped palette.
- Not emoji-friendly. Iconography is Lucide line-icons, 1.5 stroke. No filled icons, no emoji.

---

## 2. Color tokens

### 2.1 The Field — fixed atmospheric background

The Field is rendered once, fixed to the viewport, behind every view. It does not scroll with content.

**Composition (rendered bottom-up, painter's algorithm):**

| Layer | Definition | Role |
|---|---|---|
| 1 (base) | `linear-gradient(135deg, hsl(30 60% 92%) 0%, hsl(345 50% 82%) 50%, hsl(18 80% 72%) 100%)` | Cream → mauve → peach diagonal ground |
| 2 | `radial-gradient(circle at 12% 92%, hsl(14 88% 68% / 0.8) 0%, transparent 60%)` | Bottom-left warm peach hotspot |
| 3 | `radial-gradient(circle at 95% 45%, hsl(25 60% 88% / 0.7) 0%, transparent 50%)` | Mid-right warm cream |
| 4 | `radial-gradient(circle at 18% 50%, hsl(330 50% 70% / 0.85) 0%, transparent 55%)` | Mid-left rose anchor |
| 5 | `radial-gradient(circle at 55% 25%, hsl(348 75% 86% / 0.55) 0%, transparent 50%)` | Upper-mid cool mauve |
| 6 (top) | `radial-gradient(circle at 92% 8%, hsl(30 65% 91%) 0%, transparent 60%)` | Top-right cream highlight |

**Post-processing:**

- `filter: blur(60px)`
- `transform: scale(1.18)`
- `transform-origin: center`

The scale-past-viewport prevents the blur from revealing hard edges at the screen border.

**Container & z-order:**

- Wrapper: `pointer-events-none fixed inset-0 -z-10 overflow-hidden`
- Inner element: `absolute inset-[-10%]` (the gradient itself, so the blurred halo has somewhere to land outside the viewport)

⚠️ **Anti-pattern:** Do not re-render the Field per view, per section, or per screen. It is **one** fixed element at the app root. Per-view gradients cause flicker on navigation and break the "single room" reading. They also produced visible seams between sections during an earlier Lovable iteration.

### 2.2 CTA Warmth — local gradient

A second, localized gradient sits behind the primary CTA at the bottom of each view. It is *additive* to the Field, not a replacement.

```
background: radial-gradient(ellipse at 50% 100%,
  hsl(12 88% 66% / 0.85) 0%,
  hsl(18 82% 74% / 0.5) 35%,
  transparent 70%);
filter: blur(50px);
```

- Positioned `absolute inset-x-[-20%] -bottom-10 -top-16 -z-10` **relative to the CTA wrapper** (not the page)
- Bleeds horizontally past the viewport edges (`-20%`) so the warmth feels environmental, not pasted on

This layer is the visual anchor of the CTA: it warms the bottom of the screen and pulls the eye to the commit moment without the button needing a colored fill.

### 2.3 Surface tokens

| Token (proposed) | Value | Use |
|---|---|---|
| `bg-card-default` | `hsl(36 55% 96% / 0.55)` | Card default fill (warm cream, 55% opacity) |
| `bg-card-selected` | `hsl(28 22% 84% / 0.7)` | Card pressed fill (warm taupe, 70% opacity) |
| `shadow-card-pressed` | `inset 0 2px 4px rgba(60, 40, 30, 0.12)` | Pressed inset shadow — **warm brown, not grey** |
| `backdrop-blur-card` | `14px` | Glass blur on all cards |
| `backdrop-saturate-card` | `150%` | Saturation boost so the Field reads vivid through glass |

### 2.4 Foreground tokens

| Token | HSL | Use |
|---|---|---|
| `text-foreground` | `20 14% 12%` | Body, card titles, hero |
| `text-foreground/80` | — | Icons inside cards |
| `text-foreground/70` | — | Eyebrows |
| `text-muted-foreground` | `20 8% 45%` | Sub-text, footnotes, captions, unit suffixes |
| `text-foreground/15` | — | Inactive progress dots |

All foreground tokens carry warm hue (20° / 8–14% saturation). They are warm near-blacks, not neutrals.

⚠️ **Anti-pattern:** Do not introduce pure greys (`text-gray-500`, `text-zinc-*`, `text-slate-*`). They read cold against the Field and break the unified palette.

---

## 3. Typography

### 3.1 Font stack

- **Hero serif:** **Fraunces**, weights 400 / 500 / 600. Google Fonts variable, `opsz,wght` axis.
- **Body sans:** **Inter**, weights 400 / 500 / 600. Google Fonts.

Both loaded via a single Google Fonts `<link>` in document `<head>`. No self-hosted fonts in v1.0; revisit only if perf becomes an issue.

Tailwind binding:

```ts
fontFamily: {
  sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  serif: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
}
```

`body { @apply font-sans }` — Inter is the default everywhere except where `font-serif` is explicit.

### 3.2 Scale

| Role | Family | Size | Weight | Leading | Tracking | Tailwind |
|---|---|---|---|---|---|---|
| Hero question | Fraunces | 40 | 600 | 1.05 | -0.01em | `font-serif font-semibold text-[40px] leading-[1.05] tracking-[-0.01em]` |
| Card title | Inter | 15 | 500 | tight | default | `text-[15px] font-medium leading-tight` |
| Card sub-text | Inter | 12 | 400 | tight | default | `text-[12px] leading-tight text-muted-foreground` |
| Eyebrow | Inter | 11 | 600 | default | 0.14em | `text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/70` |
| Footnote | Inter | 12 | 400 | relaxed | default | `text-[12px] leading-relaxed text-muted-foreground` |
| CTA label | Inter | 15 | 600 | default | default | `text-[15px] font-semibold` |
| Unit suffix (in input) | Inter | 12 | 400 | tight | default | `text-[12px] text-muted-foreground` |

The eyebrow style is captured in a utility:

```css
@layer utilities {
  .label-eyebrow {
    @apply text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/70;
  }
}
```

### 3.3 Rules

- **Fraunces is reserved for the hero question on each view.** No serif elsewhere in v1.0. Resist the urge to "elevate" a section heading with Fraunces — the eyebrow already does that job.
- **Card titles never wrap to three lines.** If a label is long enough to break twice in 15/500 Inter at 50% column width, shorten the label or expand the section's card height. Do not let typography break the grid.
- **Sub-text is always `line-clamp-2`.** Three lines of sub-text in a 104px card is a smell — sub-text is shorthand, not prose.

---

## 4. Card primitive

The Card is the load-bearing component of the system. Every selectable option in any view is a Card.

### 4.1 Anatomy

```
┌─────────────────────────┐
│                         │
│       [Slot 1]          │   Title — always present
│                         │
│       [Slot 2]          │   Detail — exactly one of three forms
│                         │
└─────────────────────────┘
```

**Card frame:**

- Fixed height **per section** — all cards in a section share height (§5). Brew Context uses `h-[104px]`. Future sections may pick a different fixed height, but within a section it's constant.
- `rounded-3xl` (24px)
- `px-3 py-4` (12px horizontal, 16px vertical)
- `gap-1.5` between slots (6px)
- `flex flex-col items-center justify-center text-center`
- `transition-all` (covers state transitions)
- Full-width within its grid cell (`w-full`)

### 4.2 Slot 2 — three Detail forms

The Card primitive supports exactly three Detail forms. **Choose one per card; never mix within a section.**

**Form A — Sub-Text** (most common)

Inter 12/400, muted-foreground, `line-clamp-2`, tight leading. Used for unit hints (`350 ml`), context modifiers (`Zone-1 emphasis`), or short qualifiers (`Claude picks`).

**Form B — Icon**

Lucide line-icon, `h-5 w-5` (20px), `strokeWidth={1.5}`, color `text-foreground/80`, rendered inside a `h-6 w-6` flex centering container. See §9 for icon rules.

**Form C — Inline Input** (Custom-card variant only)

A focused, transparent number input flanked by a static unit suffix. Used today only by AMOUNT's "Custom" card. When the Custom card is selected, Slot 2 swaps from Sub-Text ("enter ml") to the live Input.

Input spec:

- `<input type="number" inputMode="numeric">`
- `w-14 bg-transparent text-center outline-none`
- Spinner suppressed (`[appearance:textfield]` + webkit overrides)
- Same typography as the card title (Inter 15/500) — the input *replaces* the title's visual weight when active
- Static suffix label after input: Inter 12/400, muted-foreground (e.g. `ml`)
- `onClick` on the input element calls `stopPropagation()` so editing the number doesn't bubble up and deselect the card
- `useEffect` auto-focus + `select()` on mount

⚠️ **Anti-pattern:** Two Detail forms in one card (e.g. title + icon + sub-text) is forbidden. If a card needs more information, rethink the section — not the card. The card is a fixed shape.

### 4.3 States

The Card has exactly two states in v1.0: **Default** and **Selected (pressed)**.

There is no hover state on mobile, no ring variant, no disabled state yet. (A disabled state will be added when first needed; do not pre-emptively design it.)

**Default**

- Fill: `bg-[hsl(36_55%_96%_/_0.55)]`
- `backdrop-blur-[14px] backdrop-saturate-150`
- No border, no shadow

**Selected (pressed)**

- Fill: `bg-[hsl(28_22%_84%_/_0.7)]`
- Same blur/saturate as Default
- `scale-[0.98]` — the card visually recedes, as if physically pressed
- `shadow-[inset_0_2px_4px_rgba(60,40,30,0.12)]` — soft inset shadow in warm brown

The combination of **darker fill + scale-down + inset shadow** reads as *pressed into the surface*, not *highlighted*. This is intentional: selection should feel like commitment (a depression in the Field), not announcement (a glow).

⚠️ **Anti-pattern:** Do not add a ring, outline, or border to the Selected state. An earlier ring variant (`ring-1 ring-[hsl(28_25%_72%)]`) was tested and rejected — it competes with the inset shadow and reads as *focus*, not *selection*. The ring variant has been removed from the codebase.

### 4.4 Tap-to-deselect

Every Card supports deselection. Tapping a Selected card returns the section to "nothing selected".

- Single-select per section (radio behavior, not checkbox)
- Tapping a different card moves selection to the new card
- Tapping the *same* card again clears selection
- No multi-select in v1.0 anywhere

This is a deliberate departure from typical mobile radio-group patterns. The deselect affordance gives the user an out from a wrong tap without an explicit "clear" button, and it makes the section state honest: **empty is a legitimate state**, not a forced default.

Pattern: `onClick={() => setX(prev => prev === id ? null : id)}`.

### 4.5 Custom-input card behavior

The Custom card (currently AMOUNT only) is the one sanctioned exception to "Slot 2 doesn't mutate":

- Default state: Slot 2 shows Sub-Text ("enter ml")
- Selected state: Slot 2 shows the Inline Input (Form C)
- On deselect: input value clears (`customMl: null`)

If another section needs a similar pattern in the future, it follows the same rule: Sub-Text → Input → cleared on deselect. No other Slot-2 mutations are allowed.

---

## 5. Section layout

A Section is the unit of decision: one Eyebrow + one grid of Cards + optionally one Footnote.

### 5.1 Anatomy

```
┌──────────────────────────────┐
│ EYEBROW                      │   uppercase, tracked, muted
│                              │
│ ┌──────────┐ ┌──────────┐   │
│ │  Card A  │ │  Card B  │   │   2-column grid, equal heights
│ └──────────┘ └──────────┘   │
│ ┌──────────┐ ┌──────────┐   │
│ │  Card C  │ │  Card D  │   │
│ └──────────┘ └──────────┘   │
│                              │
│ Footnote text (optional)     │   muted, 12/relaxed
└──────────────────────────────┘
```

### 5.2 Grid rules

- **Always 2 columns.** `grid grid-cols-2 gap-3` (12px gap, vertical = horizontal). No 1-column, no 3-column variants in v1.0.
- **Card count must be even.** Sections with an odd number of options must either expand to the next even number (add a wildcard card like "Surprise me" / "Explore") or split into two sections. An orphan card in row N+1 is not allowed.
- **All cards in a section share the same fixed height.** Set height once on the section, not per card. Brew Context's value is `h-[104px]`.

### 5.3 Vertical spacing — the rule that broke in v6

This is the rule that an earlier Lovable iteration got wrong. State it explicitly:

> **Section bottom-spacing is measured from the *last visible element* of the section to the eyebrow of the next section. That distance is a constant.**

"Last visible element" means:

- The Footnote, **if one is rendered**
- Otherwise, the last row of Cards

The Footnote is **part of the section**, not a separate block. It does not get its own bottom margin equal to the section-spacing. The section-spacing applies once, *after* whatever the last element happens to be.

**Implementation:**

| Spacing | Value | Tailwind |
|---|---|---|
| Eyebrow → first card row | 12px | `mb-3` on eyebrow |
| Card row → next card row | 12px | `gap-3` on grid (vertical = horizontal) |
| Last card row → Footnote | 12px | `mt-3` on Footnote |
| Section → next section | 40px | `space-y-10` on parent |

Use `space-y-10` on the section container's parent. The Footnote sits *inside* the `<section>` with its own internal `mt-3` above. The 40px gap reads from the bottom of the Footnote — or, in sections without a Footnote, from the bottom of the last card row. Same constant either way.

⚠️ **Anti-pattern:** Adding `mb-10` to the Footnote *and* `space-y-10` to the section parent produces an 80px gap below Footnote'd sections and 40px below non-Footnote sections — visibly inconsistent rhythm. **The Footnote does not own bottom space.**

---

## 6. Footnote system

A Footnote is a single line (or short paragraph) of muted-foreground text below the card grid. Its job is to give the user *reading* — context, justification, or framing — without competing with the cards for attention.

### 6.1 The three modes (plus None)

Every section is in exactly one mode. **Mode is decided per-section at design time and does not change at runtime.**

**Mode 1 — Educational** (always-on, static text)

The Footnote is always rendered, and the text does not change based on selection. Used when the section's *concept* needs explaining, not its options. The Footnote teaches the user what the section *is*.

> **Example — GOAL:** "The goal defines which method works best for THIS coffee."
> The user needs to know *why* they're picking a goal. The text is identical regardless of which goal they pick.

**Mode 2 — Reactive** (selection-driven, per-card text, hides when empty)

The Footnote renders only when a card is selected. Each card maps to a unique Footnote line that justifies or annotates the choice. With nothing selected, there is no Footnote and no reserved space.

> **Example — AMOUNT, BREWING APPROACH, WATER.** Each option carries its own short line:
> *"A single cup — focused tasting, faster brew."* / *"Above SCA ceiling. Recipe will adjust accordingly."*

**Mode 3 — Hybrid** (always-on, default text + per-card text)

The Footnote is always rendered. With nothing selected it shows a default framing line; on selection it swaps to the selected card's specific Footnote.

> **Example — OCCASION** (currently the only Hybrid section).
> Default: *"Sets the pace and ritual of this brew."*
> On Morning Ritual: *"A slower, deliberate pour that anchors the start of a day."*

**Mode 0 — None** (trivial)

The section renders no Footnote, ever. Used for sections that are self-explanatory and don't benefit from per-card annotation.

> **Example — TIME, GRINDER.** The options speak for themselves; an annotation would add noise.

### 6.2 Mode selection heuristic

When designing a new section, pick a mode by asking:

1. Does the user need to understand *what this section is for*, beyond what the eyebrow says? → **Educational** or **Hybrid**.
2. Does each option carry meaning that's not obvious from its label? → **Reactive** or **Hybrid**.
3. Both? → **Hybrid**.
4. Neither? → **None**.

⚠️ **Anti-pattern:** Reserving Footnote space "in case we add one later" produces inconsistent vertical rhythm. A section either has a Footnote (every render) or doesn't (never). Mode 2's "render only on selection" is a *controlled* exception: the space is genuinely absent when no card is selected — not held empty.

### 6.3 Implementation

A `getFootnote(section, selectedId)` helper returns either a string (render) or `null` (don't render). Every section calls it the same way:

- Mode 1: helper returns the same string regardless of `selectedId`
- Mode 2: helper returns the per-card string when `selectedId` is set, `null` when null
- Mode 3: helper returns the default string when `selectedId` is null, per-card string when set
- Mode 0: helper is not called

Render guard: `{getFootnote(s, id) && <Footnote>{getFootnote(s, id)}</Footnote>}`.

The `<Footnote>` component is a thin wrapper: `<p className="mt-3 px-1 text-[12px] leading-relaxed text-muted-foreground">`.

---

## 7. Page structure

Every view in the system has the same skeleton.

### 7.1 Anatomy

```
┌─────────────────────────────────┐
│ ◀     • • • • •                 │   Header — back + progress dots + spacer
│                                 │
│ CONTEXT                         │   Hero eyebrow
│ What's the vibe?                │   Hero question (Fraunces 40)
│                                 │
│ ─── Sections (see §5) ───       │   Body
│                                 │
│ ┌───────────────────────────┐  │
│ │      Get my recipe        │  │   CTA — non-sticky, end-of-page
│ └───────────────────────────┘  │
└─────────────────────────────────┘
```

### 7.2 Container

- `max-w-[430px]` (iPhone 14/15 Pro Max width — comfortable upper bound)
- `mx-auto` centered
- `px-5` (20px horizontal padding)
- `relative` (so the Field can position fixed relative to viewport, not container)

### 7.3 Header

- Outer: `flex items-center justify-between pt-12 pb-8` (48px top clears the notch; 32px bottom)
- Three-column: **back button (left) · progress dots (center) · spacer (right)**
- Back button: `h-9 w-9 rounded-full text-foreground/70`, icon `ChevronLeft h-5 w-5 strokeWidth={1.75}`, container offset `-ml-2` so the visual edge of the icon aligns with content
- Progress dots: `h-1.5 w-1.5 rounded-full` each, container `gap-2`; active dot `bg-foreground/80`, inactive `bg-foreground/15`
- Right spacer: empty `w-9` div to keep dots centered against the back button

### 7.4 Hero

- `pb-10` (40px below hero before the first section)
- Eyebrow: `label-eyebrow` utility, `mb-3 px-1`
- Hero question: Fraunces 40/600, leading 1.05, tracking -0.01em, foreground

The hero question is a single short sentence ending in a question mark. It frames the view, doesn't title it.

### 7.5 CTA — non-sticky

The primary CTA sits at the end of the page content. It is **not** `position: fixed` or `sticky`.

- Button: `h-14 w-full rounded-full bg-foreground text-background text-[15px] font-semibold active:scale-[0.99]`
- Wrapper: `relative pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]`
- The wrapper hosts the CTA Warmth Layer (§2.2) as an `absolute -z-10` sibling, scoped to the CTA position

⚠️ **Anti-pattern:** Sticky-bottom CTAs were tested and rejected. They obscure the last section's Footnote and create a permanent visual weight that fights the editorial reading. The Brew Context view (and any decision-flow view modeled on it) is **a flow, not a tool**: the user scrolls through, then commits at the bottom. A sticky CTA implies "you can commit at any time" — the wrong message.

---

## 8. Hybrid gradient scroll

The system uses exactly two background layers: a static Field and a scrolling CTA Warmth. Together they create a scroll experience where the room stays still but the warmth at the bottom *belongs to the CTA*.

| Layer | Position | Scroll behavior | Job |
|---|---|---|---|
| Field (§2.1) | `fixed inset-0 -z-10` | Static — does not scroll | Atmospheric ground |
| CTA Warmth (§2.2) | `absolute` inside CTA wrapper | Scrolls with the CTA | Anchors the commit moment |

When the user scrolls past the CTA (on a longer view), the warmth scrolls out of view with the button. When they scroll back, the warmth returns. The Field is unchanged throughout.

This is the v1.0 model. It is intentionally minimal — no parallax, no scroll-driven hue shifts, no per-section atmospheric layers. Adding more dynamic layers is allowed in future versions **only** if a specific view need justifies it.

⚠️ **Anti-pattern:** Rendering the Field per-section (each section gets its own gradient block) was attempted and produced visible seams between sections plus performance drag on iOS Safari. **One fixed Field, one local CTA Warmth. Nothing else.**

---

## 9. Icons

### 9.1 Default: Lucide

Lucide line-icons are the system default. They're rendered as line icons with consistent stroke and visual weight.

- Library: `lucide-react`
- Inside cards: `h-5 w-5` (20px), `strokeWidth={1.5}`, color `text-foreground/80`
- Inside an `h-6 w-6` flex centering container so visual center aligns with the title above
- In the back button: `h-5 w-5`, `strokeWidth={1.75}` (slightly heavier for the smaller tappable target)

### 9.2 Custom SVG pattern

When Lucide doesn't have the right icon, or its closest match doesn't read clearly at card size, a custom SVG is built **to Lucide's conventions**:

- `viewBox="0 0 24 24"`
- `fill="none" stroke="currentColor"` (color inherits from parent)
- `strokeWidth={1.5}` default, accept a prop override
- `strokeLinecap="round" strokeLinejoin="round"`
- Sized via parent `className` (`h-5 w-5` etc.) — **never** hard-coded `width`/`height` on the SVG element
- `aria-hidden` on the SVG (icons in this system are always decorative)

> **Current example** — `SunriseNoArrow` in the Morning Ritual card. The Lucide `Sunrise` icon includes an arrow that read as a navigation cue at card size; the custom variant strips it.
>
> The Morning Ritual icon itself is still iterating — its final form will land in Claude Code at integration time (Step B), not in Lovable. The *pattern* documented here (Lucide conventions, override-friendly props, sized by parent) is what governs.

### 9.3 What not to use

- No filled / solid icons
- No multi-color icons
- No emoji as icons
- No icon fonts (Font Awesome, Material Icons, etc.)

---

## 10. Interaction rules

A short list, because most of the interaction model is already implicit in the primitives above.

1. **Single-select per section.** No multi-select anywhere in v1.0. A section has zero or one selected card.
2. **Tap-to-deselect.** Tapping a Selected card clears the section. See §4.4.
3. **No hover states on mobile.** The system targets the iPhone PWA first. Hover is not designed for; when desktop becomes relevant, hover treatments will be added explicitly, not inherited.
4. **No drag, no swipe, no long-press** as primary interactions in the brew flow. Cards respond to **tap only**. (Map and list views may add swipe-to-delete etc. when those views are specified.)
5. **`active:scale-[0.99]` on the CTA only.** Cards already animate via their state transition (`transition-all` + `scale-[0.98]` on Selected) — don't double up.
6. **Navigation between flow steps is linear.** Back goes back, CTA goes forward, no skip-ahead. Progress dots are *informational*, not interactive.

---

## Appendix A — Forward-looking Tailwind config (for Step B briefing)

The Claude Code integration step (Step B) will translate this spec into `tailwind.config.ts` extensions. A rough shape, for the briefing's reference — not final code:

```ts
extend: {
  fontFamily: {
    sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
    serif: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
  },
  colors: {
    // surface tokens map to HSL custom properties so dark variants stay possible
    'card-default': 'hsl(36 55% 96% / 0.55)',
    'card-selected': 'hsl(28 22% 84% / 0.7)',
  },
  backgroundImage: {
    'brew-field': /* full 6-layer gradient, see §2.1 */,
    'brew-cta-warmth': /* radial, see §2.2 */,
  },
  boxShadow: {
    'card-pressed': 'inset 0 2px 4px rgba(60, 40, 30, 0.12)',
  },
  backdropBlur: {
    card: '14px',
  },
}
```

Actual translation, plus `index.css` utility wiring, lives in the Step B briefing — not here.

---

## Appendix B — Verified against

Source files extracted from Lovable v7 export, 2026-05-11:

- `src/index.css` — Field gradient, CTA Warmth gradient, `label-eyebrow` utility, all CSS-variable color tokens
- `src/pages/Index.tsx` — Card primitive, section layout, footnote logic, page skeleton, custom-amount-input behavior
- `tailwind.config.ts` — font stack, color HSL bindings, radius scale

**Decisions made during spec authoring (not extractable from files alone):**

- Selected state is **pressed-only**; the `ring` variant that exists in the Lovable codebase as dead code is rejected and not part of v1.0.
- Footnote modes are formalized as **three modes + None**: Educational / Reactive / Hybrid + Mode 0. OCCASION stays Hybrid (does not collapse into Reactive).
- Card Slot 2 is a **generic Detail slot** with three permitted forms (Sub-Text / Icon / Inline Input). Custom-Input is documented as a legitimate form, not a section-specific hack.

**Deferred to later steps:**

- Morning Ritual icon — not yet final, will be refined in Claude Code at integration time.
- Dark mode — token names exist in CSS (`html.dark`) but their values are inherited from a generic shadcn template and are unrelated to BrewLog's identity. Treat dark mode as **not yet designed**.
- Disabled state on cards — not encountered in Brew Context; design when first needed, not pre-emptively.

---

*End of v1.0.*
