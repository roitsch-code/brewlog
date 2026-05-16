"use client";

import { useFlowStore } from "@/store/flowStore";
import StepScan from "@/components/flow/StepScan";
import LightStepMode from "@/components/flow/LightStepMode";
import LightStepContext from "@/components/flow/LightStepContext";
import LightStepRecommend from "@/components/flow/LightStepRecommend";
import LightStepBrew from "@/components/flow/LightStepBrew";
import LightStepLog from "@/components/flow/LightStepLog";
import LightStepSummary from "@/components/flow/LightStepSummary";

/**
 * Light migration parallel route.
 *
 * Mirrors src/app/brew/new/page.tsx step-switch exactly, except step
 * "context" renders <LightStepContext> instead of <StepContext>. All
 * other steps render their Dark counterparts unchanged — this page is
 * a deliberate Frankenstein during the view-by-view migration.
 *
 * The live Dark route stays at /brew/new and is the orange Plus button's
 * destination. Switching to /brew/preview by URL is the only way to
 * exercise the Light Context step. Cut-over (Phase 5 of the plan) will
 * rename this directory to (light)/brew/new and delete the Dark page.
 *
 * NOTE: Dark step components inherit the (light) layout's Chivo body
 * font — fine because they all set their own typography classes
 * (font-display, font-sans, etc.), and any drift is acceptable during
 * the migration since each Dark step is short-lived in this route.
 */
export default function BrewPreviewPage() {
  const { step } = useFlowStore();

  return (
    <>
      {step === "scan" && <StepScan />}
      {step === "mode" && <LightStepMode />}
      {step === "context" && <LightStepContext />}
      {step === "recommend" && <LightStepRecommend />}
      {step === "brew" && <LightStepBrew />}
      {step === "log" && <LightStepLog />}
      {step === "summary" && <LightStepSummary />}
    </>
  );
}
