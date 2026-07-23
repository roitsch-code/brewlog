/**
 * Blend helpers — the SINGLE source of truth for reading a coffee's origin
 * components and deriving the scalar summary strings from them.
 *
 * Design (see migration 0021 + the BlendComponent doc in types/session.ts):
 * a coffee stores a `components` array when it's a blend (2+ origins), and the
 * scalar `origin` / `region` / `variety` / `process` fields are kept as a
 * comma-joined SUMMARY of those components. This keeps every free-text and
 * keyword consumer that predates blends working off the scalar unchanged; the
 * blend-aware consumers call `componentsOf()` to get the real per-component
 * breakdown.
 *
 * A single-origin bag never carries `components`; `componentsOf()` synthesises
 * a one-element array from its scalar fields so callers have one shape to read.
 */

/** The minimal fields a blend component carries. Structurally compatible with
 * BlendComponent (types/session.ts) — kept local so this module has no import
 * cycle with the session types. */
export interface Component {
  origin: string;
  region?: string;
  variety?: string;
  process?: string;
  ratio?: number;
}

/** The scalar identity fields this module reads/derives. Both CoffeeIdentity
 * and Coffee satisfy this (they carry these fields plus `components`). */
interface BlendableCoffee {
  origin?: string;
  region?: string;
  variety?: string;
  process?: string;
  components?: Component[] | null;
}

function cleanComponents(raw: Component[] | null | undefined): Component[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => ({
      origin: (c?.origin ?? "").trim(),
      region: c?.region?.trim() || undefined,
      variety: c?.variety?.trim() || undefined,
      process: c?.process?.trim() || undefined,
      ratio:
        typeof c?.ratio === "number" && Number.isFinite(c.ratio)
          ? c.ratio
          : undefined,
    }))
    // A component with no origin AND no process/variety is empty noise from a
    // half-filled editor row — drop it so it never becomes a blank blend.
    .filter((c) => c.origin || c.process || c.variety);
}

/** True when the coffee is a real blend (2+ meaningful components). */
export function isBlend(coffee: BlendableCoffee): boolean {
  return cleanComponents(coffee.components).length >= 2;
}

/**
 * The coffee's origin components as a uniform array. A blend returns its
 * cleaned components; a single-origin bag returns a one-element array
 * synthesised from the scalar fields (so callers have one code path).
 */
export function componentsOf(coffee: BlendableCoffee): Component[] {
  const cleaned = cleanComponents(coffee.components);
  if (cleaned.length >= 2) return cleaned;
  // 0 or 1 component ⇒ single-origin view from the scalars.
  const origin = (coffee.origin ?? "").trim();
  if (!origin && !(coffee.process ?? "").trim()) return [];
  return [
    {
      origin,
      region: coffee.region?.trim() || undefined,
      variety: coffee.variety?.trim() || undefined,
      process: coffee.process?.trim() || undefined,
    },
  ];
}

/** Distinct, order-preserving join of a component field. */
function joinDistinct(values: (string | undefined)[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = (v ?? "").trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out.join(", ");
}

/**
 * Derive the scalar summary fields from a set of components. Used by the write
 * path so the stored `origin`/`region`/`variety`/`process` always reflect the
 * blend. Returns empty strings for fields no component fills.
 */
export function deriveIdentitySummary(components: Component[]): {
  origin: string;
  region: string;
  variety: string;
  process: string;
} {
  return {
    origin: joinDistinct(components.map((c) => c.origin)),
    region: joinDistinct(components.map((c) => c.region)),
    variety: joinDistinct(components.map((c) => c.variety)),
    process: joinDistinct(components.map((c) => c.process)),
  };
}

/**
 * A one-line human summary of a blend for prompts / display, e.g.
 * "Brazil (Natural) + Ethiopia (Washed)" or "60% Brazil + 40% Colombia".
 * Returns "" for a non-blend (callers show the scalar origin instead).
 */
export function describeBlend(coffee: BlendableCoffee): string {
  const comps = cleanComponents(coffee.components);
  if (comps.length < 2) return "";
  return comps
    .map((c) => {
      const pct = c.ratio != null ? `${c.ratio}% ` : "";
      const proc = c.process ? ` (${c.process})` : "";
      return `${pct}${c.origin || "Unknown"}${proc}`;
    })
    .join(" + ");
}
