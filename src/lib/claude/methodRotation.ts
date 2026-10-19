// Brewer recency for /recommend — INFORMATION, never a demotion (2026-10-19).
//
// Until this rewrite the module computed "dominant brewer families" over the
// last 6 recommendation sets, told the model a dominant brewer "must EARN its
// slot", and demoted one family's recipes inside the menu's tie groups. The
// owner's verdict on that whole class of lever: every brewer is equal, the
// model chooses, and what it needs to choose well is to KNOW what he has been
// offered lately — not to be steered. So this module now counts, per brewer
// role, how many brews ago it was last offered or brewed, and says so in one
// line. The menu (menu.ts) uses the same count to decide which brewers get
// their best recipe in full this turn (the least recently offered lead).

import type { Session } from "../types/session";
import { BREWER_ROLE_BY_KEY, BREWER_TYPE_TO_ROLE, type BrewerRoleKey } from "../knowledge/brewers";
import { brewersFromMethod } from "../knowledge/recipes/helpers";
import { RECENCY_WINDOW } from "../knowledge/recipes/menu";

/** Resolve a free-text method ("Orea Fast", "Origami (wave)", "V60 + Drip
 * Assist") to its brewer role. */
export function roleFromMethod(method?: string): BrewerRoleKey | null {
  if (!method) return null;
  for (const b of Array.from(brewersFromMethod(method))) {
    const role = BREWER_TYPE_TO_ROLE.get(b);
    if (role) return role;
  }
  return null;
}

export interface BrewerRecency {
  /** role → brews ago (0 = the newest session in the window). */
  lastOffered: Map<BrewerRoleKey, number>;
  /** Roles never offered or brewed inside the window. */
  notOffered: BrewerRoleKey[];
  /** The one-line information block for the user message ("" with no history). */
  line: string;
}

/**
 * Per brewer role: how many brews ago it last appeared, as an offered
 * candidate OR as the brewed method, over the newest `window` sessions
 * (`pastSessions` newest first).
 */
export function brewerRecency(pastSessions: Session[], window: number = RECENCY_WINDOW): BrewerRecency {
  const lastOffered = new Map<BrewerRoleKey, number>();
  const recent = pastSessions.slice(0, window);
  recent.forEach((s, i) => {
    const methods = [
      ...(s.recommendation?.candidates?.map((c) => c.method) ?? [s.recommendation?.primaryMethod, s.recommendation?.alternativeMethod]),
      s.brew?.methodUsed,
    ];
    for (const m of methods) {
      const role = roleFromMethod(m ?? undefined);
      if (role && !lastOffered.has(role)) lastOffered.set(role, i);
    }
  });
  const notOffered = Array.from(BREWER_ROLE_BY_KEY.keys()).filter((k) => !lastOffered.has(k) && !BREWER_ROLE_BY_KEY.get(k)?.coldOnly);
  if (recent.length === 0) return { lastOffered, notOffered, line: "" };
  const offered = Array.from(lastOffered.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([k, n]) => `${BREWER_ROLE_BY_KEY.get(k)?.method ?? k} (${n === 0 ? "last brew" : `${n + 1} brews ago`})`);
  const line =
    `\nBREWER RECENCY over your last ${recent.length} brews — information, not a rule: ` +
    (notOffered.length
      ? `not offered at all: ${notOffered.map((k) => BREWER_ROLE_BY_KEY.get(k)?.method ?? k).join(", ")}. `
      : "every brewer appeared. ") +
    (offered.length ? `Most recent first: ${offered.join(", ")}.` : "");
  return { lastOffered, notOffered, line };
}
