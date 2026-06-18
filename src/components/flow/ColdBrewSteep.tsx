"use client";
import { useEffect, useState } from "react";
import type { BrewRecipe, BrewPourStep } from "@/lib/types/session";
import { useFlowStore } from "@/store/flowStore";
import {
  getActiveColdBrew,
  startColdBrew,
  cancelColdBrew,
  type ColdBrew,
} from "@/lib/coldBrew/coldBrew";

/**
 * Cold-brew steep view — rendered by LightStepBrew when the chosen recipe is a
 * long cold immersion steep (occasion "cold-brew"). Cold brew is hours, not
 * minutes, so there's no live pour timer: we show the recipe (prep + steps),
 * then a "Start steep" button that schedules an iOS local notification for when
 * it's ready (reusing the steep-reminder engine in lib/coldBrew/coldBrew.ts —
 * fires even with the app closed). When the steep is done the user taps "Log it"
 * to drop into the normal rating/notes flow.
 */

function fmtRemaining(ms: number): string {
  if (ms <= 0) return "Ready";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtClock(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function fmtSteepLength(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

interface Props {
  recipe: BrewRecipe;
  methodLabel: string;
  recipeName?: string;
  basedOn?: string | null;
  coffeeName: string;
  steepMinutes: number;
  onLog: () => void;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-light-muted-foreground">{label}</p>
      <p className="text-light-foreground font-medium tabular-nums">{value}</p>
    </div>
  );
}

export default function ColdBrewSteep({
  recipe,
  methodLabel,
  recipeName,
  basedOn,
  coffeeName,
  steepMinutes,
  onLog,
}: Props) {
  const [active, setActive] = useState<ColdBrew | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setActive(getActiveColdBrew());
    setNow(Date.now());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  const remaining = active ? active.endMs - now : 0;
  const ready = active ? remaining <= 0 : false;
  const progress = active
    ? Math.min(1, Math.max(0, (now - active.startMs) / (active.endMs - active.startMs)))
    : 0;

  const steps: BrewPourStep[] = recipe.pourSteps ?? [];

  async function handleStart() {
    setBusy(true);
    // Park a full snapshot of the flow so this cold brew can be resumed for
    // logging after it steeps — even if other brews run in between (they
    // overwrite the single live draft).
    const { draft, fieldZones } = useFlowStore.getState();
    const cb = await startColdBrew(coffeeName, steepMinutes, { draft, fieldZones });
    setActive(cb);
    setNow(Date.now());
    setBusy(false);
  }

  async function handleCancel() {
    setBusy(true);
    await cancelColdBrew();
    setActive(null);
    setBusy(false);
  }

  async function handleLog() {
    setBusy(true);
    await cancelColdBrew();
    onLog();
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Recipe prep card */}
      <div className="rounded-3xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 p-4">
        <div className="mb-3">
          <p className="label-eyebrow">{methodLabel}</p>
          {recipeName && (
            <p className="font-fraunces text-[18px] leading-tight text-light-foreground mt-1">
              {recipeName}
            </p>
          )}
          {basedOn && (
            <p className="text-[11px] text-light-muted-foreground mt-0.5">based on {basedOn}</p>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <Stat label="Dose" value={`${recipe.doseGrams}g`} />
          <Stat label="Water" value={`${recipe.waterGrams}g`} />
          <Stat label="Temp" value={`${recipe.waterTempC}°`} />
          <Stat label="Steep" value={fmtSteepLength(steepMinutes)} />
        </div>
        <div className="mt-2 border-t border-light-foreground/10 pt-2">
          <Stat label="Grind" value={recipe.grindSize} />
        </div>
      </div>

      {/* Steps */}
      {steps.length > 0 && (
        <div className="rounded-3xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 p-4">
          <p className="label-eyebrow mb-3">Method</p>
          <ol className="space-y-2.5">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-light-muted-foreground tabular-nums text-[13px] mt-0.5 w-4 shrink-0">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] leading-snug text-light-foreground">{s.label}</p>
                  {s.notes && (
                    <p className="text-[12px] leading-snug text-light-muted-foreground mt-0.5">
                      {s.notes}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Steep state */}
      {!loaded ? null : active ? (
        <div className="rounded-3xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 p-6">
          <p className="label-eyebrow mb-1">{ready ? "Ready" : "Steeping"}</p>
          <p className="font-fraunces text-[44px] leading-none text-light-foreground mb-2 tabular-nums">
            {fmtRemaining(remaining)}
          </p>
          <p className="text-light-muted-foreground text-sm mb-5">
            {ready ? "Steep complete." : `Ready at ${fmtClock(active.endMs)} — we'll remind you, even if the app is closed.`}
          </p>
          <div className="h-1.5 rounded-full bg-light-foreground/15 overflow-hidden mb-6">
            <div
              className="h-full bg-light-foreground rounded-full transition-[width] duration-1000"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <button
            type="button"
            onClick={handleLog}
            disabled={busy}
            className="w-full h-14 rounded-full bg-light-foreground text-light-text-on-dark font-semibold active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {ready ? "Log it" : "It's ready — log it"}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={busy}
            className="w-full h-12 mt-2 rounded-full text-light-muted-foreground font-medium active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            Cancel steep
          </button>
        </div>
      ) : (
        <div className="rounded-3xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 p-6">
          <p className="text-light-foreground leading-relaxed mb-5">
            Combine and stir, then start the {fmtSteepLength(steepMinutes)} steep. We&apos;ll remind you when it&apos;s ready — even if the app is closed.
          </p>
          <button
            type="button"
            onClick={handleStart}
            disabled={busy}
            className="w-full h-14 rounded-full bg-light-foreground text-light-text-on-dark font-semibold active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {busy ? "Starting…" : "Start steep"}
          </button>
        </div>
      )}
    </div>
  );
}
