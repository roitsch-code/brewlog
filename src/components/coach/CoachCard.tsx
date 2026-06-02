"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

/**
 * Coach insight card — shared across /taste, /coffees/[id], and the
 * /brew/new Context reminder pill.
 *
 * The card itself is presentational. The three actions surface
 * Try it / Confirmed / Doesn't apply with a clean visual hierarchy:
 * anthracite for the encouraged path, cream-glass for satisfaction,
 * muted text for dismissal.
 *
 * Two-line layout is intentional:
 *   - row 1 = observation (data with real counts)
 *   - row 2 = suggestion (next move)
 * Visually distinct weights so the roles are scannable.
 */

export type InsightStatus = "new" | "trying" | "confirmed" | "doesnt-apply";

export interface CoachInsight {
  id: string;
  observation: string;
  suggestion: string;
  citationFields: string[];
  status: InsightStatus;
  source: string;
}

export function CoachCard({
  insight,
  onTry,
  onConfirm,
  onDoesntApply,
  eyebrow,
}: {
  insight: CoachInsight;
  onTry: () => void;
  onConfirm: () => void;
  onDoesntApply: () => void;
  /** Optional small label above the card ("Coach", "Reminder", etc.). */
  eyebrow?: string;
}) {
  return (
    <div className="bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 rounded-2xl px-4 py-4">
      {eyebrow && (
        <p className="text-light-muted-foreground text-[11px] uppercase tracking-widest mb-2">
          {eyebrow}
        </p>
      )}
      <p className="text-light-foreground text-[15px] font-medium leading-relaxed">
        {insight.observation}
      </p>
      <p className="text-light-foreground/75 text-[14px] leading-relaxed mt-2">
        {insight.suggestion}
      </p>
      <div className="mt-4 pt-3 border-t border-light-foreground/10 flex gap-2">
        <CardAction onClick={onTry} variant="primary">
          Try it
        </CardAction>
        <CardAction onClick={onConfirm} variant="soft">
          Confirmed
        </CardAction>
        <CardAction onClick={onDoesntApply} variant="muted">
          Doesn’t apply
        </CardAction>
      </div>
    </div>
  );
}

function CardAction({
  onClick,
  variant,
  children,
}: {
  onClick: () => void;
  variant: "primary" | "soft" | "muted";
  children: ReactNode;
}) {
  const classes =
    variant === "primary"
      ? "flex-1 h-9 rounded-full bg-light-foreground text-[hsl(36_55%_96%)] text-[12px] font-semibold tracking-tight active:scale-[0.97] transition-transform"
      : variant === "soft"
        ? "flex-1 h-9 rounded-full bg-light-card-selected text-light-foreground text-[12px] font-semibold tracking-tight backdrop-blur-light-card backdrop-saturate-150 active:scale-[0.97] transition-transform"
        : "flex-1 h-9 rounded-full text-light-muted-foreground text-[12px] tracking-tight active:text-light-foreground transition-colors";
  return (
    <button type="button" onClick={onClick} className={classes}>
      {children}
    </button>
  );
}

/**
 * Lightweight wrapper for /coffees/[id]: fetches insights filtered to
 * `new` + `trying`, scores by attribute overlap with the given coffee,
 * renders the single best match. No render when the coffee isn't in
 * rotation, or when nothing matches.
 *
 * Filter precedence: prefers status='trying' (active reminder) then
 * status='new'. Never renders confirmed or doesnt-apply.
 */
export function CoffeeCoachCard({
  inRotation,
  variety,
  process,
  origin,
  roastLevel,
  method,
}: {
  inRotation: boolean;
  variety?: string | null;
  process?: string | null;
  origin?: string | null;
  roastLevel?: string | null;
  /** Optional brew method history hint — boosts insights citing 'method'. */
  method?: string | null;
}) {
  const [pick, setPick] = useState<CoachInsight | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!inRotation) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    fetch("/api/insights?status=trying,new", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        const all: CoachInsight[] = Array.isArray(d.insights) ? d.insights : [];
        setPick(selectBestMatch(all, { variety, process, origin, roastLevel, method }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [inRotation, variety, process, origin, roastLevel, method]);

  if (!inRotation || loading || !pick) return null;

  const patchStatus = async (status: InsightStatus) => {
    setPick(null);
    try {
      await fetch("/api/insights", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pick.id, status }),
      });
    } catch {
      /* optimistic */
    }
  };

  return (
    <div className="px-5 py-4 border-b border-light-foreground/15">
      <CoachCard
        insight={pick}
        eyebrow="Coach"
        onTry={() => patchStatus("trying")}
        onConfirm={() => patchStatus("confirmed")}
        onDoesntApply={() => patchStatus("doesnt-apply")}
      />
    </div>
  );
}

/**
 * Score insights by `citationFields` overlap with the coffee's
 * attributes. Trying status wins all ties (it's already an active
 * reminder; surface it on the page where the user is about to brew).
 */
function selectBestMatch(
  insights: CoachInsight[],
  ctx: {
    variety?: string | null;
    process?: string | null;
    origin?: string | null;
    roastLevel?: string | null;
    method?: string | null;
  },
): CoachInsight | null {
  if (insights.length === 0) return null;

  const want = new Set<string>();
  if (ctx.variety) want.add("variety");
  if (ctx.process) want.add("process");
  if (ctx.origin) want.add("origin");
  if (ctx.roastLevel) want.add("roast");
  if (ctx.method) want.add("method");

  const score = (i: CoachInsight) => {
    const overlap = i.citationFields.reduce(
      (acc, f) => acc + (want.has(f.toLowerCase()) ? 1 : 0),
      0,
    );
    // Trying tier beats new tier regardless of overlap.
    const tier = i.status === "trying" ? 100 : 0;
    return tier + overlap;
  };

  const best = [...insights].sort((a, b) => score(b) - score(a))[0];
  // Require at least one field overlap OR a 'trying' status to bother
  // surfacing — otherwise the card is just generic noise on this page.
  if (best.status !== "trying" && score(best) === 0) return null;
  return best;
}
