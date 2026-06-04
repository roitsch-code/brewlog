"use client";

import { useEffect, useState } from "react";
import Chip from "@/components/ui/light/Chip";

/**
 * Coach insight card — shared across /taste, /coffees/[id], and the
 * /brew/new Context reminder pill.
 *
 * Two visible stages driven off `insight.status`:
 *
 *   New stage (status='new')
 *     - eyebrow: "Coach" (or caller-provided)
 *     - card surface: cream-glass `bg-light-card-default`
 *     - actions: Save to try / Confirmed / Doesn't apply
 *
 *   Saved stage (status='trying')
 *     - eyebrow: "Saved · Trying"
 *     - card surface: warm taupe `bg-light-card-selected` +
 *       `shadow-light-card-pressed` (signals "this is yours, you
 *       committed to it")
 *     - actions: It helped / Didn't help / Skip
 *       — "It helped" → confirmed
 *       — "Didn't help" → doesnt-apply
 *       — "Skip" → snoozed (hidden for 7 days, then resurfaces)
 *
 * Two-line layout is intentional:
 *   - row 1 = observation (data with real counts)
 *   - row 2 = suggestion (next move)
 * Visually distinct weights so the roles are scannable.
 */

export type InsightStatus =
  | "new"
  | "trying"
  | "confirmed"
  | "doesnt-apply"
  | "snoozed";

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
  onAction,
  eyebrow,
}: {
  insight: CoachInsight;
  /**
   * Unified handler — the card maps the visible buttons to the next
   * status itself, so the parent doesn't carry the new-vs-saved branch.
   * Parent passes the optimistic UI update + the PATCH.
   */
  onAction: (next: InsightStatus) => void;
  /** Optional small label above the card. Defaults to "Coach" (new) or
   *  "Saved · Trying" (saved). */
  eyebrow?: string;
}) {
  const isSaved = insight.status === "trying";
  const surface = isSaved
    ? "bg-light-card-selected shadow-light-card-pressed"
    : "bg-light-card-default";
  const resolvedEyebrow = eyebrow ?? (isSaved ? "Saved · Trying" : "Coach");

  return (
    <div
      className={`${surface} backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 rounded-2xl px-4 py-4`}
    >
      <p className="text-light-muted-foreground text-[11px] uppercase tracking-widest mb-2">
        {resolvedEyebrow}
      </p>
      <p className="text-light-foreground text-[15px] font-medium leading-relaxed">
        {insight.observation}
      </p>
      <p className="text-light-foreground/75 text-[14px] leading-relaxed mt-2">
        {insight.suggestion}
      </p>
      <div className="mt-4 pt-3 border-t border-light-foreground/10 flex flex-wrap gap-2">
        {isSaved ? (
          <>
            <Chip size="sm" onClick={() => onAction("confirmed")}>It helped</Chip>
            <Chip size="sm" onClick={() => onAction("doesnt-apply")}>Didn’t help</Chip>
            <Chip size="sm" onClick={() => onAction("snoozed")}>Skip</Chip>
          </>
        ) : (
          <>
            <Chip size="sm" onClick={() => onAction("trying")}>Save to try</Chip>
            <Chip size="sm" onClick={() => onAction("confirmed")}>Confirmed</Chip>
            <Chip size="sm" onClick={() => onAction("doesnt-apply")}>Doesn’t apply</Chip>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Per-coffee coach card. Fetches an Opus-generated insight that is
 * specifically about THIS coffee — its brew history, its roaster
 * prior, its variety prior — from /api/coffees/[id]/insight.
 *
 * Rotation-only: out-of-rotation pages stay clean.
 *
 * Saved-stage cards stay on this page in the taupe highlight so the
 * user can act on them later. Confirmed / Doesn't apply / Skip hide
 * the card from this view (the server preserves the row so /recommend
 * still benefits where relevant).
 */
export function CoffeeCoachCard({
  coffeeId,
  inRotation,
}: {
  coffeeId: string;
  inRotation: boolean;
}) {
  const [pick, setPick] = useState<CoachInsight | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!inRotation) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/coffees/${coffeeId}/insight`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : { insight: null }))
      .then((d) => {
        const raw = d.insight;
        if (!raw) {
          setPick(null);
          return;
        }
        // Hide terminal statuses + active snoozes. The server is
        // already filtering active snoozes on GET; this is a belt-and-
        // braces guard so a stale cache doesn't surface them.
        if (
          raw.status === "confirmed" ||
          raw.status === "doesnt-apply" ||
          raw.status === "snoozed"
        ) {
          setPick(null);
          return;
        }
        setPick({
          id: coffeeId,
          observation: raw.observation,
          suggestion: raw.suggestion,
          citationFields: [],
          status: raw.status,
          source: "per-coffee",
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [inRotation, coffeeId]);

  if (!inRotation || loading || !pick) return null;

  const patchStatus = async (status: InsightStatus) => {
    // Save-to-try keeps the card visible in the saved state; everything
    // else hides it from this view.
    if (status === "trying") {
      setPick({ ...pick, status });
    } else {
      setPick(null);
    }
    try {
      await fetch(`/api/coffees/${coffeeId}/insight`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    } catch {
      /* optimistic */
    }
  };

  return (
    <div className="px-5 py-4 border-b border-light-foreground/15">
      <CoachCard insight={pick} onAction={patchStatus} />
    </div>
  );
}
