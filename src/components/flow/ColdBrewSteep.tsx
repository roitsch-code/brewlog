"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
 * minutes, so there's no live pour timer:
 *   1. Show the recipe (prep card + method steps).
 *   2. "Start steep" schedules an iOS "ready" reminder (lib/coldBrew, fires with
 *      the app closed) and parks the session so other brews can run in between.
 *   3. While steeping you can LEAVE — it keeps running, shows up in the menu as
 *      "Cold brew · Xh left", and you return to log it when it's done.
 *
 * Built on the Light design tokens (card glass, h-14 rounded-full primary CTA,
 * label-eyebrow, Fraunces headline) — same primitives as the rest of the flow.
 */

function fmtRemaining(ms: number): string {
  if (ms <= 0) return "Ready";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${total % 60}s`;
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-light-muted-foreground">{label}</p>
      <p className="text-light-foreground font-medium tabular-nums leading-tight">{value}</p>
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
  const router = useRouter();
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
      {/* Recipe prep card — same shape as the hot-brew recipe card */}
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
          <MiniStat label="Dose" value={`${recipe.doseGrams}g`} />
          <MiniStat label="Water" value={`${recipe.waterGrams}g`} />
          <MiniStat label="Temp" value={`${recipe.waterTempC}°`} />
          <MiniStat label="Steep" value={fmtSteepLength(steepMinutes)} />
        </div>
        <div className="mt-3 border-t border-light-foreground/10 pt-3">
          <MiniStat label="Grind" value={recipe.grindSize} />
        </div>
      </div>

      {/* Method steps */}
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

      {/* Action area */}
      {!loaded ? null : !active ? (
        // Not started — explain + Start
        <div className="rounded-3xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 p-5">
          <p className="text-[14px] leading-relaxed text-light-foreground mb-5">
            Combine and stir, then start the {fmtSteepLength(steepMinutes)} steep. It runs in the
            background — you can brew other coffee meanwhile, and we&apos;ll remind you when it&apos;s ready,
            even with the app closed.
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
      ) : (
        // Steeping / ready
        <div className="rounded-3xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 p-5">
          <p className="label-eyebrow mb-1">{ready ? "Ready" : "Steeping"}</p>
          <p className="font-fraunces text-[48px] leading-none text-light-foreground mb-2 tabular-nums">
            {ready ? "Done" : `${fmtRemaining(remaining)} left`}
          </p>
          <p className="text-light-muted-foreground text-sm mb-4">
            {ready ? "Your cold brew has finished steeping." : `Ready at ${fmtClock(active.endMs)}`}
          </p>
          <div className="h-1.5 rounded-full bg-light-foreground/15 overflow-hidden mb-5">
            <div
              className="h-full bg-light-foreground rounded-full transition-[width] duration-1000"
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          {ready ? (
            <button
              type="button"
              onClick={handleLog}
              disabled={busy}
              className="w-full h-14 rounded-full bg-light-foreground text-light-text-on-dark font-semibold active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              Log it
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="w-full h-14 rounded-full bg-light-foreground text-light-text-on-dark font-semibold active:scale-[0.98] transition-transform"
              >
                Leave it steeping
              </button>
              <p className="text-[12px] leading-relaxed text-light-muted-foreground mt-3">
                It keeps steeping in the background. Find it any time under <span className="text-light-foreground">Cold brew</span> in the menu, and log it when it&apos;s ready.
              </p>
            </>
          )}

          <button
            type="button"
            onClick={handleCancel}
            disabled={busy}
            className="w-full h-11 mt-2 rounded-full text-light-muted-foreground text-[14px] font-medium active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            Cancel steep
          </button>
        </div>
      )}
    </div>
  );
}
