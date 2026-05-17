"use client";

import { useEffect, useState } from "react";
import { useFlowStore } from "@/store/flowStore";
import { useRouter } from "next/navigation";
import LightFlowShell from "@/components/ui/light/LightFlowShell";
import LightStarRating from "@/components/ui/light/StarRating";
import CoffeeBeanGlow from "@/components/ui/light/CoffeeBeanGlow";
import BrewMethodIcon from "@/components/ui/BrewMethodIcon";

/**
 * Light System fork of /components/flow/StepSummary.tsx.
 *
 * Same logic — POST to /api/sessions with the in-flight draft + top-
 * level fieldZones, fetch the Escher insight (terrain + adjustment)
 * non-blocking, transition to a "Logged" success state for 1.5s, then
 * reset + router.push("/").
 *
 * The save action stays inline (a custom button at page end), not the
 * LightFlowShell's CTA prop. Reason: the flow ends here, so there is
 * no onNext step — the button is the save commit. LightFlowShell with
 * onNext omitted renders only the header (back + dots).
 *
 * Hero treatment: if the user scanned a bag photo, it's the hero
 * imagery with a CREAM-to-transparent scrim (not the Dark card-scrim
 * which is black-to-transparent) so the anthracite caption stays
 * readable. Photo-less coffees fall back to a frosted-glass title
 * card.
 *
 * Saved state renders without LightFlowShell — full-screen centred
 * success display, no back button (the flow is done).
 *
 * Dark /components/flow/StepSummary.tsx stays untouched until cut-over.
 */

export default function LightStepSummary() {
  const { draft, reset } = useFlowStore();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [terrain, setTerrain] = useState<string | null>(null);
  const [adjustment, setAdjustment] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!draft.result?.rating) return;
    setInsightLoading(true);
    fetch("/api/brew-insight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft, recentSessions: [] }),
    })
      .then((r) => r.json())
      .then((d) => {
        setTerrain(d.terrain || null);
        setAdjustment(d.adjustment || null);
      })
      .catch(() => {})
      .finally(() => setInsightLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          fieldZones: useFlowStore.getState().fieldZones,
          type: "coffee",
          createdAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
        };
        const fieldErrors = body.details?.fieldErrors ?? {};
        const firstField = Object.entries(fieldErrors).find(([, msgs]) => msgs && msgs.length > 0);
        const detailMsg = firstField
          ? `${firstField[0]}: ${firstField[1][0]}`
          : body.details?.formErrors?.[0];
        const baseMsg = body.error || `Save failed (${res.status})`;
        throw new Error(detailMsg ? `${baseMsg} — ${detailMsg}` : baseMsg);
      }
      setSaved(true);
      setTimeout(() => {
        reset();
        router.push("/");
      }, 1500);
    } catch (err) {
      console.error("Session save error:", err);
      setSaveError(err instanceof Error ? err.message : "Failed to save — please try again");
    } finally {
      setSaving(false);
    }
  };

  const coffee = draft.coffee;
  const result = draft.result;
  const brew = draft.brew;
  const rec = draft.recommendation;

  // ── Saved success state ─────────────────────────────────────────────
  if (saved) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-5 px-8">
        <div className="relative">
          <svg className="w-16 h-16 text-light-foreground" fill="none" viewBox="0 0 100 100" aria-hidden>
            <path
              d="M14,50 C14,26 26,7 50,7 C74,7 86,26 86,50 C86,74 74,93 50,93 C26,93 14,74 14,50 Z"
              stroke="currentColor"
              strokeWidth="6"
              fill="none"
            />
            <path d="M50,7 C43,29 57,61 50,93" stroke="currentColor" strokeWidth="5" />
          </svg>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-light-foreground flex items-center justify-center">
            <svg
              className="w-3.5 h-3.5 text-[hsl(36_55%_96%)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <div className="text-center">
          <p className="font-fraunces text-[32px] leading-tight text-light-foreground">Logged</p>
          <p className="text-[13px] text-light-muted-foreground mt-1">Session saved to your diary</p>
        </div>
      </div>
    );
  }

  // ── Review + save state ─────────────────────────────────────────────
  return (
    <LightFlowShell>
      {coffee?.bagPhotoUrl ? (
        <div className="relative -mx-5 mb-6 h-64 overflow-hidden rounded-3xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coffee.bagPhotoUrl}
            alt="Coffee bag"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Cream-to-transparent bottom scrim so the anthracite caption
              stays readable over an arbitrary bag photo. Specifically
              NOT the Dark card-scrim utility (which is black-to-
              transparent and would invert the text colour expectation). */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(to top, hsl(30 60% 92% / 0.92) 0%, hsl(30 60% 92% / 0.35) 45%, transparent 80%)",
            }}
          />
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <h2 className="font-fraunces text-[28px] leading-tight text-light-foreground">
              {coffee.name || "Unknown Coffee"}
            </h2>
            {coffee.roaster && (
              <p className="text-[13px] text-light-foreground/70 mt-1">{coffee.roaster}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-3xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 px-5 py-8">
          <h2 className="font-fraunces text-[28px] leading-tight text-light-foreground">
            {coffee?.name || "Coffee Session"}
          </h2>
          {coffee?.roaster && (
            <p className="text-[13px] text-light-muted-foreground mt-1">{coffee.roaster}</p>
          )}
        </div>
      )}

      <div className="space-y-5">
        {result?.rating ? (
          <div className="flex items-center gap-3">
            <LightStarRating value={result.rating} readonly size="md" />
            <span className="text-[15px] font-medium text-light-foreground">{result.rating} / 5</span>
          </div>
        ) : null}

        {(insightLoading || terrain || adjustment) && (
          <div className="rounded-3xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 p-4 space-y-3">
            {insightLoading ? (
              <div className="flex items-start gap-3">
                <CoffeeBeanGlow size={24} className="shrink-0 mt-0.5" />
                <p className="text-[13px] italic text-light-muted-foreground">Reading the session…</p>
              </div>
            ) : (
              <>
                {terrain && (
                  <div className="flex items-start gap-3">
                    <svg
                      className="w-4 h-4 shrink-0 mt-0.5 text-light-foreground/70"
                      fill="none"
                      viewBox="0 0 100 100"
                      aria-hidden
                    >
                      <path
                        d="M14,50 C14,26 26,7 50,7 C74,7 86,26 86,50 C86,74 74,93 50,93 C26,93 14,74 14,50 Z"
                        stroke="currentColor"
                        strokeWidth="8"
                      />
                      <path d="M50,7 C43,29 57,61 50,93" stroke="currentColor" strokeWidth="6" />
                    </svg>
                    <p className="text-[14px] italic leading-relaxed text-light-foreground">{terrain}</p>
                  </div>
                )}
                {adjustment && (
                  <div
                    className={`${terrain ? "border-t border-light-foreground/10 pt-3" : ""} flex items-start gap-3`}
                  >
                    <div className="w-4 h-4 shrink-0 mt-0.5 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-light-foreground/40" />
                    </div>
                    <p className="text-[14px] leading-relaxed text-light-foreground/80">{adjustment}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {coffee && (coffee.origin || coffee.process || coffee.roastLevel) && (
          <div className="rounded-3xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 p-4 space-y-2">
            {coffee.origin && (
              <InfoRow
                label="Origin"
                value={[coffee.origin, coffee.region].filter(Boolean).join(" · ")}
              />
            )}
            {coffee.process && <InfoRow label="Process" value={coffee.process} />}
            {coffee.roastLevel && <InfoRow label="Roast" value={coffee.roastLevel} />}
          </div>
        )}

        {rec && brew?.methodUsed && (
          <div className="rounded-3xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 p-4">
            <p className="label-eyebrow mb-2">Recipe</p>
            <div className="flex items-center gap-2 flex-wrap">
              <BrewMethodIcon method={brew.methodUsed} className="w-4 h-4 shrink-0 text-light-foreground" />
              <p className="text-[14px] text-light-foreground">
                {brew.methodUsed} · {rec.primaryRecipe.doseGrams}g / {rec.primaryRecipe.waterGrams}g ·{" "}
                {rec.primaryRecipe.waterTempC}°C
              </p>
            </div>
          </div>
        )}

        {result?.flavorNotes && result.flavorNotes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {result.flavorNotes.map((f) => (
              <span
                key={f}
                className="inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-medium leading-tight capitalize backdrop-blur-light-card backdrop-saturate-150 bg-light-card-default text-light-foreground"
              >
                {f}
              </span>
            ))}
          </div>
        )}

        {result?.freeNotes && (
          <p className="text-[13px] italic leading-relaxed text-light-muted-foreground">
            &ldquo;{result.freeNotes}&rdquo;
          </p>
        )}
      </div>

      <div className="pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {saveError && (
          <p className="text-[13px] text-light-foreground text-center leading-snug mb-3">
            {saveError}
          </p>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="h-14 w-full rounded-full bg-light-foreground text-[15px] font-semibold text-[hsl(36_55%_96%)] active:scale-[0.99] transition-transform disabled:opacity-60 disabled:active:scale-100"
        >
          {saving ? "Saving…" : saveError ? "Retry" : "Save Brew"}
        </button>
      </div>
    </LightFlowShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[13px] text-light-muted-foreground shrink-0">{label}</span>
      <span className="text-[14px] text-light-foreground text-right">{value}</span>
    </div>
  );
}
