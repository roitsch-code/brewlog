"use client";

import { useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useFlowStore, type FlowStep } from "@/store/flowStore";
import { useFieldConfig } from "@/lib/field/FieldContext";
import { DEFAULT_FIELD_ZONES } from "@/lib/field/defaultZones";
import CTA from "./CTA";

/**
 * Light System v1.0 §7 — page skeleton for the brew flow.
 *
 * Header (§7.3): back button (left), progress dots (centre), spacer
 * (right). Active dot = foreground/80; inactive = foreground/15.
 *
 * Body: caller renders <Hero>, <Section>s, etc. inside this Shell. The
 * Shell does not provide the hero — different flow steps frame their
 * own questions.
 *
 * CTA (§7.5): non-sticky. Sits at the end of the page content, not
 * pinned. Wrapped in our <CTA> primitive which carries the CTA Warmth.
 *
 * Container is `max-w-[430px] mx-auto px-5`. The Field is already
 * applied by the (light) route group's <LightShell>.
 *
 * Step sequence mirrors the Dark FlowShell — Light migration is
 * view-by-view, the step machinery is shared.
 */

const HOME_STEPS: FlowStep[] = ["scan", "context", "recommend", "brew", "log", "summary"];
const BREW_AGAIN_STEPS: FlowStep[] = ["context", "recommend", "brew", "log", "summary"];
const EXTERNAL_STEPS: FlowStep[] = ["scan", "log", "summary"];

// Generative Field v1.1 §8.1 — per-step rotation across the flow. Scan
// runs at 0° (coffee unknown until extraction completes); each
// subsequent step adds 25° so the seven-step flow drifts 125° total —
// "same room, different time of day", never "different room".
const STEP_ROTATION: Record<FlowStep, number> = {
  scan: 0,
  mode: 0,
  context: 25,
  recommend: 50,
  brew: 75,
  log: 100,
  summary: 125,
};

interface LightFlowShellProps {
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
}

export default function LightFlowShell({
  children,
  onBack,
  onNext,
  nextLabel = "Next",
  nextDisabled,
  nextLoading,
}: LightFlowShellProps) {
  const { step, draft, skipScan, fieldZones } = useFlowStore();
  const router = useRouter();

  // Drive the application-wide Field renderer with this brew's coffee
  // composition and the current step's rotation. fieldZones === null
  // (no scan yet, or scan returned no notes) falls through to Default.
  const fieldConfig = useMemo(
    () => ({
      fieldZones: fieldZones ?? DEFAULT_FIELD_ZONES,
      rotation: STEP_ROTATION[step as FlowStep] ?? 0,
    }),
    [fieldZones, step],
  );
  useFieldConfig(fieldConfig);

  const steps =
    draft.mode === "external"
      ? EXTERNAL_STEPS
      : skipScan
        ? BREW_AGAIN_STEPS
        : HOME_STEPS;

  const currentIndex = steps.indexOf(step as FlowStep);

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (skipScan && step === "context") {
      router.push("/");
      return;
    }
    if (currentIndex > 0) {
      useFlowStore.getState().setStep(steps[currentIndex - 1]);
    } else {
      router.push("/");
    }
  };

  return (
    <div className="relative mx-auto max-w-[430px] px-5">
      {/* Header (§7.3) */}
      <div
        className="flex items-center justify-between"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 3rem)", paddingBottom: "2rem" }}
      >
        <button
          type="button"
          onClick={handleBack}
          aria-label="Back"
          className="h-9 w-9 -ml-2 rounded-full flex items-center justify-center text-light-foreground/70 active:scale-95 transition-transform"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
        </button>
        {currentIndex >= 0 ? (
          <div className="flex items-center gap-2" aria-label={`Step ${currentIndex + 1} of ${steps.length}`}>
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${
                  i === currentIndex ? "bg-light-foreground/80" : "bg-light-foreground/15"
                }`}
              />
            ))}
          </div>
        ) : (
          <div />
        )}
        <div className="w-9" />
      </div>

      {/* Body */}
      {children}

      {/* Non-sticky CTA — sits in flow at end of content */}
      {onNext && (
        <CTA onClick={onNext} disabled={nextDisabled} loading={nextLoading}>
          {nextLoading ? "…" : nextLabel}
        </CTA>
      )}
    </div>
  );
}
