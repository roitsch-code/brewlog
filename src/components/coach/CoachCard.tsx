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
 * Per-coffee coach card. Fetches an Opus-generated insight that is
 * specifically about THIS coffee — its brew history, its roaster
 * prior, its variety prior — from /api/coffees/[id]/insight.
 *
 * Rotation-only: out-of-rotation pages stay clean.
 *
 * Status actions are local to this coffee (not the global /taste queue):
 *   - Try it → status='trying'; surfaces as a /brew/new Context reminder
 *     when this same coffee is selected for the next brew.
 *   - Confirmed → status='confirmed'; preserved across regenerations
 *     until the user explicitly dismisses or replaces.
 *   - Doesn't apply → status='doesnt-apply'; next regeneration replaces.
 *
 * Replaces the earlier library-wide citation-field matcher that was
 * surfacing wrong insights on the wrong coffees.
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
        // Hide confirmed + doesnt-apply from this view — the user has
        // already acted on them. (The regeneration logic preserves
        // confirmed rows specifically so the suggestion stays alive
        // for /recommend prompts; on the coffee page itself, a
        // resolved card just clutters.)
        if (raw.status === "confirmed" || raw.status === "doesnt-apply") {
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
    setPick(null);
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
