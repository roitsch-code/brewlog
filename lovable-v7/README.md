# Lovable v7 — Read-Only Design Reference

This directory holds an exported snapshot of the Lovable v7 BrewLog
project. **It is a reference, not application code.** Nothing here is
imported by the live app; the production routes live under `src/`.

## What it's for

`specs/design-system-v1.0.md` was distilled from Lovable v7, but the
spec covers *primitives and tokens*, not per-view content (card labels,
sub-text, footnote copy, exact section counts, custom inputs). When
the Light migration of a view starts, we read the matching view here
to pull the exact composition.

Example mismatches the spec alone couldn't have surfaced (caught
post-deploy on `/brew/preview` PR #66):

- Grinder section uses **Cards** with sub-text (`° values` / `click
  values`), not Chips.
- Water section is **2 cards** (Tap only / Championship), not 3.
- Amount → Custom card carries the footnote **"Set your own target in
  millilitres."**

## How to use it

1. The user paste-drops the Lovable export into this folder (any
   structure Lovable produces is fine — typically `src/pages/`,
   `src/components/`, `src/index.css`, `tailwind.config.ts`).
2. When migrating a Light view, read the relevant Lovable page (e.g.
   `lovable-v7/src/pages/BrewContext.tsx`) before writing the Light
   fork.
3. **Do not edit files here.** If a label needs to change, change it
   in the live `src/` component AND update `specs/` if it's a
   system-level rule. The Lovable export stays pristine as the
   audit trail.

## Lifecycle

When all Light views are migrated and the production app no longer
references Lovable as a source of truth, this directory can be
removed. Until then, it's the canonical "what did Lovable show?"
answer that prevents reading screenshots and guessing.

## Not in scope

- `node_modules` (don't commit)
- `.lovable/` cache files (don't commit)
- Build artifacts (`dist/`, `.next/`, etc. — don't commit)

If the Lovable export contains those, prune before committing or add
them to `.gitignore` under this path.
