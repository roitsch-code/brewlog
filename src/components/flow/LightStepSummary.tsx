"use client";

import { useEffect, useState } from "react";
import { useFlowStore } from "@/store/flowStore";
import { useRouter } from "next/navigation";
import { enqueueSession } from "@/lib/storage/saveQueue";
import LightFlowShell from "@/components/ui/light/LightFlowShell";
import BagPhoto from "@/components/ui/light/BagPhoto";
import LightStarRating from "@/components/ui/light/StarRating";
import CoffeeBeanGlow from "@/components/ui/light/CoffeeBeanGlow";
import BrewMethodIcon from "@/components/ui/BrewMethodIcon";
import Chip from "@/components/ui/light/Chip";
import type { FlowAnalysis } from "@/lib/brew/flowAnalysis";

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
  const [savedOffline, setSavedOffline] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [terrain, setTerrain] = useState<string | null>(null);
  const [adjustment, setAdjustment] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  // Post-brew insight → Coach workflow. null = actions still showing.
  const [insightAction, setInsightAction] = useState<null | "saved" | "dismissed">(null);
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

  const finishSaved = (offline: boolean) => {
    setSavedOffline(offline);
    setSaved(true);
    setTimeout(() => {
      reset();
      router.push("/");
    }, 1500);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    const body = {
      ...draft,
      fieldZones: useFlowStore.getState().fieldZones,
      type: "coffee" as const,
      createdAt: new Date().toISOString(),
    };

    // Offline → queue immediately and sync on reconnect (LightShell flushes).
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      try {
        await enqueueSession(body);
        finishSaved(true);
      } catch (err) {
        console.error("Offline queue error:", err);
        setSaveError("Couldn't queue this brew on your phone. Try again.");
      } finally {
        setSaving(false);
      }
      return;
    }

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        finishSaved(false);
      } else {
        // Server rejected the save while online — surface it, allow retry.
        const errBody = (await res.json().catch(() => ({}))) as {
          error?: string;
          details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
        };
        const fieldErrors = errBody.details?.fieldErrors ?? {};
        const firstField = Object.entries(fieldErrors).find(([, msgs]) => msgs && msgs.length > 0);
        const detailMsg = firstField
          ? `${firstField[0]}: ${firstField[1][0]}`
          : errBody.details?.formErrors?.[0];
        const baseMsg = errBody.error || "Couldn't save this brew. Try again in a moment.";
        setSaveError(detailMsg ? `${baseMsg} — ${detailMsg}` : baseMsg);
      }
    } catch (err) {
      // Network failure (dropped connection mid-save) → queue rather than
      // lose the brew.
      console.error("Session save network error:", err);
      try {
        await enqueueSession(body);
        finishSaved(true);
      } catch (queueErr) {
        console.error("Offline queue error:", queueErr);
        setSaveError("Couldn't save this brew. Try again — your notes are still here.");
      }
    } finally {
      setSaving(false);
    }
  };

  const coffee = draft.coffee;
  const result = draft.result;
  const brew = draft.brew;
  const rec = draft.recommendation;
  // Show the recipe the user actually selected (by candidate index), not always
  // the primary one — falls back for legacy drafts.
  const summaryRecipe =
    (brew?.selectedCandidateIdx != null
      ? rec?.candidates?.[brew.selectedCandidateIdx]?.recipe
      : undefined) ?? rec?.primaryRecipe;

  // ── Post-brew insight → Coach save ────────────────────────────────────
  // Map the post-brew card onto an insight: the concrete next-time lever is
  // the suggestion (the rule-based `adjustment`, or the `terrain` line when
  // it carries the advice itself), anchored to a data-grounded observation
  // built from this session. Saving writes a status='trying'/'confirmed' row
  // (so /recommend applies it next time) + the coffee's coach_insight card.
  const isExternal = draft.mode === "external";
  const coffeeName =
    [coffee?.roaster, coffee?.name].filter(Boolean).join(" ").trim() || "This coffee";
  const hasTerrain = !!(terrain && terrain.trim().length >= 10);
  const hasAdjustment = !!(adjustment && adjustment.trim().length >= 10);
  // A data-grounded "what happened" line for when there's only a single piece
  // of advice text to anchor (mirrors the insights table's observation intent).
  const sessionFacts: string[] = [];
  if (result?.rating != null) sessionFacts.push(`${result.rating}★`);
  if (result?.freeNotes?.trim()) sessionFacts.push(`“${result.freeNotes.trim()}”`);
  else if (result?.flavorNotes?.length)
    sessionFacts.push(`tasted ${result.flavorNotes.slice(0, 3).join(", ")}`);
  if (brew?.methodUsed && summaryRecipe)
    sessionFacts.push(
      `${brew.methodUsed} ${summaryRecipe.doseGrams}g/${summaryRecipe.waterGrams}g ${summaryRecipe.waterTempC}°C`,
    );
  const factsLine = sessionFacts.length ? `${coffeeName}: ${sessionFacts.join(" · ")}` : coffeeName;
  // When both rows are shown, save exactly what the user read (terrain =
  // observation, adjustment = suggestion). With a single text, that text is
  // the advice (suggestion) and the facts line anchors it (observation).
  const savableObservation = (hasTerrain && hasAdjustment ? terrain! : factsLine).trim();
  const savableSuggestion = (hasAdjustment ? adjustment! : terrain ?? "").trim();
  // Only offer the save workflow on home brews with a real, actionable note.
  const canSaveInsight =
    !isExternal && savableSuggestion.length >= 10 && savableObservation.length >= 10;

  const handleInsightAction = async (action: "trying" | "confirmed" | "doesnt-apply") => {
    if (action === "doesnt-apply") {
      // Nothing was ever persisted, so this just clears the card.
      setInsightAction("dismissed");
      return;
    }
    setInsightAction("saved"); // optimistic — also prevents a double-tap
    const citationFields = [
      coffee?.process ? "process" : null,
      coffee?.roastLevel ? "roast" : null,
      coffee?.origin ? "origin" : null,
      coffee?.variety ? "variety" : null,
      brew?.methodUsed || rec?.primaryMethod ? "method" : null,
    ].filter((f): f is string => f !== null);
    try {
      await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          observation: savableObservation,
          suggestion: savableSuggestion,
          citationFields,
          coffeeId: coffee?.coffeeId,
          coffeeName,
          status: action === "confirmed" ? "confirmed" : "trying",
        }),
      });
    } catch {
      /* optimistic — leave the saved confirmation up rather than nag */
    }
  };

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
              className="w-3.5 h-3.5 text-light-text-on-dark"
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
          <p className="text-[13px] text-light-muted-foreground mt-1">
            {savedOffline ? "Saved offline — will sync when you're back online" : "Session saved to your diary"}
          </p>
        </div>
      </div>
    );
  }

  // ── Review + save state ─────────────────────────────────────────────
  return (
    <LightFlowShell>
      {coffee?.bagPhotoUrl ? (
        <BagPhoto url={coffee.bagPhotoUrl} className="mb-6">
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <h2 className="font-fraunces text-[28px] leading-tight text-light-foreground">
              {coffee.name || "Unknown Coffee"}
            </h2>
            {coffee.roaster && (
              <p className="text-[13px] text-light-foreground/70 mt-1">{coffee.roaster}</p>
            )}
          </div>
        </BagPhoto>
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

        {brew?.flowAnalysis && <PourAnalysisCard analysis={brew.flowAnalysis} />}

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

                {/* Coach workflow — persist the advice so the next brew of
                    this coffee actually honours it (matches the /taste Coach
                    cards: Save to try / Confirmed / Doesn't apply). */}
                {canSaveInsight &&
                  (insightAction ? (
                    <p className="border-t border-light-foreground/10 pt-3 text-[12px] text-light-muted-foreground">
                      {insightAction === "saved"
                        ? "Saved — I’ll bring this up next time you brew this coffee."
                        : "Dismissed."}
                    </p>
                  ) : (
                    <div className="border-t border-light-foreground/10 pt-3 flex flex-wrap gap-2">
                      <Chip size="sm" onClick={() => handleInsightAction("trying")}>
                        Save to try
                      </Chip>
                      <Chip size="sm" onClick={() => handleInsightAction("confirmed")}>
                        Confirmed
                      </Chip>
                      <Chip size="sm" onClick={() => handleInsightAction("doesnt-apply")}>
                        Doesn’t apply
                      </Chip>
                    </div>
                  ))}
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

        {brew?.methodUsed && summaryRecipe && (
          <div className="rounded-3xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 p-4">
            <p className="label-eyebrow mb-2">Recipe</p>
            <div className="flex items-center gap-2 flex-wrap">
              <BrewMethodIcon method={brew.methodUsed} className="w-4 h-4 shrink-0 text-light-foreground" />
              <p className="text-[14px] text-light-foreground">
                {brew.methodUsed} · {summaryRecipe.doseGrams}g / {summaryRecipe.waterGrams}g ·{" "}
                {summaryRecipe.waterTempC}°C
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
          className="h-14 w-full rounded-full bg-light-foreground text-[15px] font-semibold text-light-text-on-dark active:scale-[0.99] transition-transform disabled:opacity-60 disabled:active:scale-100"
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

// ── Pour analysis (measured from a connected Acaia scale) ────────────────────

function mmss(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function AnalysisStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl bg-[hsl(36_55%_96%/0.5)] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-light-muted-foreground">{label}</p>
      <p className={`font-mono-num text-[15px] mt-0.5 ${accent ?? "text-light-foreground"}`}>{value}</p>
    </div>
  );
}

function PourAnalysisCard({ analysis }: { analysis: FlowAnalysis }) {
  const gradeLabel =
    analysis.derivedFlow === "perfect"
      ? "On target"
      : analysis.derivedFlow === "too-fast"
        ? "Ran fast"
        : "Ran slow";
  const gradeColor =
    analysis.derivedFlow === "perfect" ? "text-light-success" : "text-light-accent-overtime";

  // The pour that drifted furthest from its scheduled time (worth a teaching line).
  const drifted = analysis.perPour
    .filter((p) => p.errorSec != null)
    .sort((a, b) => Math.abs(b.errorSec as number) - Math.abs(a.errorSec as number))[0];
  const steady =
    analysis.pourSteadiness == null ? null : analysis.pourSteadiness < 0.3 ? "Steady" : "Uneven";

  return (
    <div className="rounded-3xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="label-eyebrow">Pour analysis</p>
        <span className="text-[10px] uppercase tracking-wide text-light-muted-foreground">measured</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <AnalysisStat
          label="Total"
          value={`${mmss(analysis.totalTimeSec)} / ${mmss(analysis.targetTimeSec)}`}
          accent={gradeColor}
        />
        <AnalysisStat label="Flow" value={gradeLabel} accent={gradeColor} />
        {analysis.avgFlowRateGPS != null && (
          <AnalysisStat label="Avg pour" value={`${analysis.avgFlowRateGPS} g/s`} />
        )}
        {analysis.overshootG != null && (
          <AnalysisStat
            label="Overshoot"
            value={`+${Math.max(0, analysis.overshootG)}g`}
            accent={analysis.overshootG > 20 ? "text-light-accent-overtime" : undefined}
          />
        )}
        {steady && <AnalysisStat label="Stream" value={steady} />}
      </div>
      {drifted && Math.abs(drifted.errorSec as number) >= 3 && (
        <p className="text-[12px] text-light-muted-foreground mt-3">
          {drifted.label} hit {drifted.targetGrams}g{" "}
          {(drifted.errorSec as number) > 0
            ? `${Math.round(drifted.errorSec as number)}s late`
            : `${Math.abs(Math.round(drifted.errorSec as number))}s early`}
          .
        </p>
      )}
    </div>
  );
}
