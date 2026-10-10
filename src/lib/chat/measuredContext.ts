/**
 * The owner's MEASURED brewing, for the chat (2026-10-03). /recommend has read
 * the user's own grind settings, measured drawdowns and "what works for you"
 * findings for weeks; the chat — the surface most used on the road and the one
 * that writes recipes in prose — got none of them. Pure assembly over the same
 * helpers, so the two surfaces cannot disagree about what was measured.
 */

import type { Session } from "../types/session";
import { buildMeasuredGrind, formatMeasuredGrindForPrompt } from "../claude/measuredGrind";
import { drawdownFor } from "../brew/drawdown";
import { buildContextInsights, formatContextFindingsForGreeting } from "../taste/brewContextInsights";
import { brewMethodKey } from "../utils/brewMethodKey";
import { formatPourPaceForPrompt, measuredPourPace } from "../brew/pourPace";

/** The two batch sizes the owner actually brews (the flow's Small / Big presets). */
export const CHAT_MEASURED_VOLUMES = [350, 450] as const;

export function measuredDrawdownLines(sessions: Session[], volumes: readonly number[] = CHAT_MEASURED_VOLUMES): string[] {
  const methods = new Map<string, string>();
  for (const s of sessions) {
    const m = s.brew?.methodUsed?.trim();
    if (m && !methods.has(brewMethodKey(m))) methods.set(brewMethodKey(m), m);
  }
  const lines: string[] = [];
  for (const method of Array.from(methods.values())) {
    for (const v of volumes) {
      const d = drawdownFor(sessions, method, v);
      if (d && d.source === "measured") {
        lines.push(`- ${method} at ~${v} g: drawdown ~${Math.round(d.sec)} s after the last pour (median of ${d.count} measured brews)`);
      }
    }
  }
  return lines;
}

export function buildChatMeasuredBlock(
  sessions: Session[],
  rotation: Array<{ origin?: string; process?: string; roaster?: string; name?: string }>,
  grinder?: string,
): string {
  if (sessions.length === 0) return "";
  const parts: string[] = [];

  const grind = CHAT_MEASURED_VOLUMES.map((v) => formatMeasuredGrindForPrompt(buildMeasuredGrind(sessions, v), grinder))
    .filter(Boolean);
  if (grind.length) parts.push(grind.join("\n"));

  // His delivered pour rate, read off the Acaia (2026-10-10 — "Who says my
  // pace is 4 g/s?"). Only once measured: the house fallback is not a fact
  // about him and has no place in a block titled "your measured brewing".
  const pace = measuredPourPace(sessions);
  if (pace.source !== "house") parts.push(formatPourPaceForPrompt(pace));

  const dd = measuredDrawdownLines(sessions);
  if (dd.length) {
    parts.push(
      `MEASURED DRAWDOWN — how long the user's own brews actually took to drain after the last pour, per brewer and batch (from their Acaia / timer logs). When you state a total time for a recipe on one of these brewers, build it from the pour cadence plus THIS drawdown, not from the published recipe's clock:\n${dd.join("\n")}`,
    );
  }

  const findings = buildContextInsights(sessions).insights;
  const contrast = formatContextFindingsForGreeting(findings, rotation);
  if (contrast) parts.push(`WHAT WORKS FOR THIS USER — measured contrasts between their ≥4.5★ and ≤3.5★ cups within one kind of coffee (the figures are exact; quote them, never round or flip them):\n${contrast}`);

  if (parts.length === 0) return "";
  return `\n## Your measured brewing (from your own logged brews — these beat any general table)\n${parts.join("\n\n")}`;
}
