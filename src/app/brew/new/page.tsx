"use client";
import { useFlowStore } from "@/store/flowStore";
import StepMode from "@/components/flow/StepMode";
import StepScan from "@/components/flow/StepScan";
import StepContext from "@/components/flow/StepContext";
import StepRecommend from "@/components/flow/StepRecommend";
import StepBrew from "@/components/flow/StepBrew";
import StepLog from "@/components/flow/StepLog";
import StepSummary from "@/components/flow/StepSummary";

export default function NewBrewPage() {
  const { step } = useFlowStore();

  return (
    <>
      {step === "scan" && <StepScan />}
      {step === "mode" && <StepMode />}
      {step === "context" && <StepContext />}
      {step === "recommend" && <StepRecommend />}
      {step === "brew" && <StepBrew />}
      {step === "log" && <StepLog />}
      {step === "summary" && <StepSummary />}
    </>
  );
}
