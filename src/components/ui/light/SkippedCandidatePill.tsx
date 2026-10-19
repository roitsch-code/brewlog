"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shuffle } from "lucide-react";
import { startBrewFromChat } from "@/lib/flow/brewAgain";
import { fetchCoffeeIdentity } from "@/lib/flow/coffeeIdentityFetch";
import type { SkippedCandidate } from "@/lib/flow/skippedCandidate";
import type { CoffeeIdentity } from "@/lib/types/session";
import type { FieldZones } from "@/lib/field/types";

/**
 * "Try the one you skipped" (2026-10-19). Every recommendation offers two
 * candidates and he brews one; this pill brings the other one back for the
 * next brew of the same bag — the recipe exactly as it was composed, timeline
 * included, straight to the timer, nothing regenerated. Renders nothing while
 * loading and nothing when the last brew had no second candidate, so the
 * surfaces that carry it (the chat's "Brew again" row, the coffee page's
 * "Brew this") look exactly as before in that case.
 */
export default function SkippedCandidatePill({
  coffeeId,
  identity,
  fieldZones,
  variant = "pill",
}: {
  coffeeId: string;
  /** When the caller already holds the identity (the coffee page), no row fetch. */
  identity?: CoffeeIdentity;
  fieldZones?: FieldZones | null;
  /** "pill" = the chat's anthracite Action Pill; "cta" = the coffee page's full-width secondary button. */
  variant?: "pill" | "cta";
}) {
  const router = useRouter();
  const [skipped, setSkipped] = useState<SkippedCandidate | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sessions/previous?coffeeId=${encodeURIComponent(coffeeId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { skipped?: SkippedCandidate | null } | null) => {
        if (!cancelled && data?.skipped?.recipe) setSkipped(data.skipped);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [coffeeId]);

  if (!skipped) return null;

  const label = `Try the one you skipped · ${skipped.title ?? skipped.method}`;

  const go = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const target = identity
        ? { identity, fieldZones: fieldZones ?? null }
        : await fetchCoffeeIdentity(coffeeId);
      if (!target) {
        setBusy(false);
        return;
      }
      startBrewFromChat(target.identity, target.fieldZones, skipped.recipe, skipped.method, skipped.title, skipped.basedOn);
      router.push("/brew/new");
    } finally {
      setBusy(false);
    }
  };

  if (variant === "cta") {
    return (
      <button
        type="button"
        onClick={() => void go()}
        disabled={busy}
        className="w-full h-14 rounded-full text-sm font-medium bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 text-light-foreground active:scale-[0.98] transition-transform disabled:opacity-80"
      >
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void go()}
      disabled={busy}
      title={skipped.basedOn ? `Based on ${skipped.basedOn}` : undefined}
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-light-foreground px-4 font-chivo text-[13px] font-medium text-light-text-on-dark shadow-light-float active:opacity-90 disabled:opacity-80"
    >
      <Shuffle className="h-4 w-4 text-light-text-on-dark" strokeWidth={1.75} />
      {label}
    </button>
  );
}
