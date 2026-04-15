"use client";
import { useFlowStore, FlowStep } from "@/store/flowStore";
import { cn } from "@/lib/utils/cn";
import ProgressDots from "@/components/ui/ProgressDots";
import CoffeeBeanGlow from "@/components/ui/CoffeeBeanGlow";
import { useRouter } from "next/navigation";

// "mode" is intentionally excluded — it's a sub-step of scan, not a visible dot
const HOME_STEPS:    FlowStep[] = ["scan", "context", "recommend", "brew", "log", "summary"];
const BREW_AGAIN_STEPS: FlowStep[] = ["context", "recommend", "brew", "log", "summary"];
const EXTERNAL_STEPS: FlowStep[] = ["scan", "log", "summary"];
const MATCH_STEPS:   FlowStep[] = ["scan", "match_result"];

interface FlowShellProps {
  children: React.ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  hideNav?: boolean;
}

export default function FlowShell({
  children, onBack, onNext, nextLabel = "Next", nextDisabled, nextLoading, hideNav
}: FlowShellProps) {
  const { step, draft, skipScan } = useFlowStore();
  const router = useRouter();

  const steps =
    draft.mode === "match"    ? MATCH_STEPS :
    draft.mode === "external" ? EXTERNAL_STEPS :
    skipScan                  ? BREW_AGAIN_STEPS :
    HOME_STEPS;

  const currentIndex = steps.indexOf(step as FlowStep);

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    // If entering from brew-again, back at first step → go home
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
    <div className="min-h-svh flex flex-col bg-brew-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pb-2" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}>
        <button
          type="button"
          onClick={handleBack}
          className="w-10 h-10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {currentIndex >= 0 && (
          <ProgressDots total={steps.length} current={currentIndex} />
        )}
        <div className="w-10" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {children}
      </div>

      {/* Bottom CTA */}
      {!hideNav && onNext && (
        <div className="px-5 py-4 pb-safe">
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled || nextLoading}
            className={cn(
              "w-full h-[52px] rounded-full font-semibold text-base transition-all active:scale-95 disabled:opacity-40",
              "bg-brew-accent text-brew-accent-fg"
            )}
          >
            {nextLoading ? (
              <span className="flex items-center justify-center">
                <CoffeeBeanGlow size={22} />
              </span>
            ) : nextLabel}
          </button>
        </div>
      )}
    </div>
  );
}
