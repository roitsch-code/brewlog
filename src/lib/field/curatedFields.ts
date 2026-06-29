/**
 * Curated general-background Field compositions.
 *
 * The home screen (and every general/non-coffee background) used to render one
 * static default composition. The owner wants it to "present the colours of the
 * flavours in a changing manner — not one pattern with ALL colours, always nice
 * combinations, like the Mac desktop." So instead of one fixed palette, the
 * general background picks one of these hand-curated 2–3-flavour combos, and
 * advances to the next one each time the app is opened.
 *
 * Each combo leans into a few zones that look good together as a DIRECTIONAL
 * blend (the composition + motion live in composeGradient/FieldBlobs) — never a
 * muddy all-colours mix. Coffee bags list ~3 flavours, so 2–3 zones is the
 * natural count; the elegance comes from the pairing + the directional flow, not
 * from cutting colours.
 *
 * Pure data + a per-app-open picker. Deterministic per load (module-memoized),
 * SSR-safe (returns the static default on the server so there's no hydration
 * mismatch — the client effect swaps in the curated pick on mount).
 */

import { DEFAULT_FIELD_ZONES } from "./defaultZones";
import type { FieldZones } from "./types";

const SENTINEL = "1970-01-01T00:00:00.000Z";

function field(zones: FieldZones["zones"]): FieldZones {
  return {
    version: 1,
    zones,
    modifiers: { saturation: 0, lightness: 0 },
    source: "default",
    computedAt: SENTINEL,
  };
}

// Hand-picked elegant pairings. Names in comments are the flavour read.
export const CURATED_FIELDS: FieldZones[] = [
  // Blue + magenta — the reference wallpaper (blueberry meets floral).
  field([
    { id: "cool-berry", weight: 0.5 },
    { id: "floral", weight: 0.5 },
  ]),
  // Raspberry + vanilla.
  field([
    { id: "fruity-bright", weight: 0.55 },
    { id: "sweet-caramel", weight: 0.45 },
  ]),
  // Blueberry + caramel — cool/warm contrast.
  field([
    { id: "cool-berry", weight: 0.5 },
    { id: "sweet-caramel", weight: 0.5 },
  ]),
  // Plum + caramel.
  field([
    { id: "fruity-deep", weight: 0.5 },
    { id: "sweet-caramel", weight: 0.5 },
  ]),
  // Peach + jasmine + honey.
  field([
    { id: "fruity-bright", weight: 0.4 },
    { id: "floral", weight: 0.35 },
    { id: "sweet-caramel", weight: 0.25 },
  ]),
  // Berry + floral + caramel.
  field([
    { id: "cool-berry", weight: 0.4 },
    { id: "floral", weight: 0.35 },
    { id: "sweet-caramel", weight: 0.25 },
  ]),
  // Cocoa + cherry — a warm, deep one.
  field([
    { id: "nutty-cocoa", weight: 0.5 },
    { id: "fruity-deep", weight: 0.5 },
  ]),
  // Pink + red — floral meets bright fruit.
  field([
    { id: "floral", weight: 0.5 },
    { id: "fruity-bright", weight: 0.5 },
  ]),
];

const STORAGE_KEY = "btts.field.rotation.v1";

let memo: FieldZones | null = null;

/**
 * The general-background composition for this app load. Advances by one each
 * time the app is opened (a localStorage counter), so every launch lands on the
 * next nice combo; stays stable while you navigate (module-memoized). SSR-safe:
 * returns the static default on the server, where there's no localStorage.
 */
export function getGeneralField(): FieldZones {
  if (memo) return memo;
  if (typeof window === "undefined") return DEFAULT_FIELD_ZONES;
  let n = 0;
  try {
    n = parseInt(window.localStorage.getItem(STORAGE_KEY) ?? "0", 10) || 0;
    window.localStorage.setItem(STORAGE_KEY, String((n + 1) % 1_000_000));
  } catch {
    // Private mode / storage disabled — fall through with n = 0.
  }
  memo = CURATED_FIELDS[((n % CURATED_FIELDS.length) + CURATED_FIELDS.length) % CURATED_FIELDS.length];
  return memo;
}
