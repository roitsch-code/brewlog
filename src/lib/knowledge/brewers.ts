/**
 * The owner's brewers — every one of them on the table, equally.
 *
 * Owner, 2026-10-19: "Alle Brewer sind gleich wichtig und wertig. Aber alle
 * für etwas anderes gut bzw. haben Limitierungen." There is no primary brewer.
 * Each brewer has a ROLE (what it is for) and a physical LIMIT (what it holds),
 * and the model chooses between them by coffee, amount, occasion and goal.
 *
 * This file is the single source for that: the /recommend system prompt, the
 * per-turn brewer menu, the chat prompt and the greeting all read it. The
 * capacities come from VESSEL_CAPS (owner-measured) and are never copied.
 */
import { VESSEL_CAPS, type VesselCap } from "../utils/vesselCapacity";
import type { BrewerType } from "./recipes/types";
import { exactBrewerKey } from "../utils/brewMethodKey";

export type BrewerRoleKey =
  | "v60"
  | "orea-fast"
  | "orea-classic"
  | "orea-apex"
  | "orea-open"
  | "origami-cone"
  | "origami-wave"
  | "kalita-wave"
  | "clever"
  | "aeropress"
  | "moccamaster"
  | "chemex"
  | "cold-brew-jar";

export type BrewerStyle = "percolation" | "immersion" | "batch" | "hybrid";

export interface BrewerRole {
  key: BrewerRoleKey;
  /** The method string the model writes and the timer shows. */
  method: string;
  style: BrewerStyle;
  /** The owner's one-sentence role for this brewer. */
  role: string;
  /** Recipe brewer ids that pool under this role. */
  brewers: BrewerType[];
  /** True for the cold-brew partition only. */
  coldOnly?: boolean;
}

/** In the order the owner reads them — no order is a ranking. */
export const BREWER_ROLES: readonly BrewerRole[] = [
  {
    key: "aeropress",
    method: "AeroPress",
    style: "immersion",
    role: "small cup, exploring, immersion — also the Prismo for a pressure-style cup",
    brewers: ["aeropress", "aeropress-prismo"],
  },
  {
    key: "moccamaster",
    method: "Moccamaster",
    style: "batch",
    role: "big batch, the machine",
    brewers: ["moccamaster"],
  },
  {
    key: "chemex",
    method: "Chemex",
    style: "percolation",
    role: "big batch, percolation through its thick filter",
    brewers: ["chemex"],
  },
  {
    key: "clever",
    method: "Clever Dripper",
    style: "immersion",
    role: "immersion as a deliberate choice; forgives an imperfect pour",
    brewers: ["clever"],
  },
  {
    key: "v60",
    method: "V60",
    style: "percolation",
    role: "one cone among several, no default",
    brewers: ["v60"],
  },
  {
    key: "orea-fast",
    method: "Orea Fast",
    style: "percolation",
    role: "Orea V4 Wide with the Fast bottom — flat bed, the fastest drain of his bottoms (his measured drawdown about 10 s)",
    brewers: ["orea-v4-fast", "orea-v4-wide"],
  },
  {
    key: "orea-classic",
    method: "Orea Classic",
    style: "percolation",
    role: "Orea V4 Wide with the Classic bottom — flat bed, a slower drain (his measured drawdown about 48 s)",
    brewers: ["orea-classic"],
  },
  {
    key: "orea-apex",
    method: "Orea Apex",
    style: "percolation",
    role: "Orea V4 Wide with the Apex bottom — flat bed; its drain is not measured yet, say so when you choose it",
    brewers: ["orea-apex"],
  },
  {
    key: "orea-open",
    method: "Orea Open",
    style: "percolation",
    role: "Orea V4 Wide with the Open bottom — flat bed, open plate; its drain is not measured yet, say so when you choose it",
    brewers: ["orea-open"],
  },
  {
    key: "origami-cone",
    method: "Origami (cone)",
    style: "percolation",
    role: "Origami Air S with a cone filter — cone, resin, fast",
    brewers: ["origami-cone", "origami-air-m"],
  },
  {
    key: "origami-wave",
    method: "Origami (wave)",
    style: "percolation",
    role: "Origami Air S with a wave filter — a flat bed through the wave filter; no published recipe over 280 g, so scale and say so",
    brewers: ["origami-wave"],
  },
  {
    key: "kalita-wave",
    method: "Kalita Wave",
    style: "percolation",
    role: "flat bed, even and forgiving",
    brewers: ["kalita-wave"],
  },
  {
    key: "cold-brew-jar",
    method: "Cold-brew jar",
    style: "immersion",
    role: "the cold-brew occasion only",
    brewers: ["cold-brew-jar"],
    coldOnly: true,
  },
];

export const BREWER_ROLE_BY_KEY: ReadonlyMap<BrewerRoleKey, BrewerRole> = new Map(
  BREWER_ROLES.map((r) => [r.key, r]),
);

/** Recipe brewer id → role. Ids the owner does not own map to nothing. */
export const BREWER_TYPE_TO_ROLE: ReadonlyMap<BrewerType, BrewerRoleKey> = (() => {
  const m = new Map<BrewerType, BrewerRoleKey>();
  for (const r of BREWER_ROLES) for (const b of r.brewers) if (!m.has(b)) m.set(b, r.key);
  return m;
})();

/** The owner-measured capacity window for a role, read from VESSEL_CAPS. */
export function brewerCap(key: BrewerRoleKey): VesselCap {
  const probe = key.toLowerCase();
  for (const { match, label, minMl, maxMl } of VESSEL_CAPS) {
    if (match.test(probe)) return { label, minMl, maxMl };
  }
  return { label: key };
}

export type Reach =
  | { how: "fits" }
  | { how: "concentrate-bypass"; text: string }
  | { how: "not-for-this-size"; text: string };

/** Can this brewer serve `targetMl`, and if not, what is the honest path? */
export function reachFor(key: BrewerRoleKey, targetMl: number | undefined): Reach {
  if (!targetMl) return { how: "fits" };
  const cap = brewerCap(key);
  if (cap.maxMl != null && targetMl > cap.maxMl) {
    if (key === "aeropress") {
      return {
        how: "concentrate-bypass",
        text: `holds ${cap.maxMl} ml — for ${targetMl} g brew a concentrate and add bypass water in the cup, and say so`,
      };
    }
    return { how: "not-for-this-size", text: `holds ${cap.maxMl} ml — not for ${targetMl} g` };
  }
  if (cap.minMl != null && targetMl < cap.minMl) {
    return { how: "not-for-this-size", text: `needs at least ${cap.minMl} ml — not for ${targetMl} g` };
  }
  return { how: "fits" };
}

function capText(key: BrewerRoleKey): string {
  const cap = brewerCap(key);
  if (cap.minMl != null && cap.maxMl != null) return `${cap.minMl}–${cap.maxMl} ml`;
  if (cap.maxMl != null) return `up to ${cap.maxMl} ml`;
  return "no measured limit";
}

/**
 * The static YOUR BREWERS block for the /recommend system prompt. Process-
 * constant (it reads only code), so the cached prefix stays byte-identical.
 */
export function formatBrewerRolesBlock(): string {
  const lines = BREWER_ROLES.map((r) => `- ${r.method} — ${r.style}; ${r.role}. Holds ${capText(r.key)}.`);
  return [
    "YOUR BREWERS — every one of them is on the table, equally. Each has a role and a physical limit; none is a default and none is preferred. Choose by the coffee, the amount, the occasion and the goal, and say in one clause of whyChosen why THIS brewer today. The AeroPress above its limit brews a concentrate and adds bypass water in the cup; a batch brewer below its floor is simply not for that amount.",
    ...lines,
    "Write the method field exactly as the brewer is named here (an Orea always names its bottom; an Origami always names its filter).",
  ].join("\n");
}

/**
 * The role for a method string as the flow or the chat writes it ("Orea Apex",
 * "Orea V4 Classic", "V60 + Drip Assist", "Origami (cone)"). Keyed through
 * exactBrewerKey so the Orea bottoms and Origami filters stay apart.
 */
export function brewerRoleForMethod(method?: string): BrewerRole | undefined {
  const exact = exactBrewerKey(method).replace(/\+drip-assist$/, "");
  const key = exact === "kalita" ? "kalita-wave" : exact === "orea" ? "orea-fast" : exact;
  const role = BREWER_ROLE_BY_KEY.get(key as BrewerRoleKey);
  if (role) return role;
  // "Origami Air M" names no filter — still a percolation cone-or-wave, never immersion.
  if (exact === "origami") return BREWER_ROLE_BY_KEY.get("origami-cone");
  return undefined;
}

/**
 * The method line for a short post-brew prompt: the name plus what the brewer
 * IS. A bare "Orea Apex" let Haiku call the Orea an immersion brewer
 * (2026-10-27); the style word is what stops that.
 */
export function formatMethodForPrompt(method?: string): string {
  if (!method) return "unknown";
  const role = brewerRoleForMethod(method);
  if (!role) return method;
  return `${method} (${role.style} — ${role.role})`;
}

/** One line per role for the chat / greeting prompts. */
export function formatBrewerRolesForChat(): string {
  return BREWER_ROLES.filter((r) => !r.coldOnly)
    .map((r) => `- ${r.method}: ${r.role} (${capText(r.key)})`)
    .join("\n");
}
