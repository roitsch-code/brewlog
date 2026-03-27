import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { DraftSession, SessionMode, CoffeeIdentity, SessionContext, Recommendation, BrewLog, TasteResult, ExternalPlace } from "@/lib/types/session";

export type FlowStep =
  | "mode"       // Home vs External toggle
  | "scan"       // Photo + AI extraction + clarification
  | "context"    // Occasion, amount, time, mood (home only)
  | "recommend"  // AI recommendation (home only)
  | "brew"       // Recipe card + timer
  | "log"        // Taste documentation
  | "summary";   // Save

interface FlowState {
  step: FlowStep;
  draft: DraftSession;
  isAnalyzing: boolean;
  isRecommending: boolean;
  recommendError: string | null;
  clarificationMessages: ClarificationMessage[];

  // Actions
  setStep: (step: FlowStep) => void;
  setMode: (mode: SessionMode) => void;
  setCoffee: (coffee: Partial<CoffeeIdentity>) => void;
  setPlace: (place: ExternalPlace) => void;
  setContext: (context: SessionContext) => void;
  setRecommendation: (rec: Recommendation) => void;
  setBrew: (brew: BrewLog) => void;
  setResult: (result: TasteResult) => void;
  setIsAnalyzing: (v: boolean) => void;
  setIsRecommending: (v: boolean) => void;
  setRecommendError: (err: string | null) => void;
  addClarificationMessage: (msg: ClarificationMessage) => void;
  clearClarifications: () => void;
  reset: () => void;
}

export interface ClarificationMessage {
  role: "assistant" | "user";
  text: string;
  chips?: string[];
}

const initialDraft: DraftSession = {
  type: "coffee",
  mode: "home",
};

export const useFlowStore = create<FlowState>()(
  persist(
    (set) => ({
      step: "mode",
      draft: initialDraft,
      isAnalyzing: false,
      isRecommending: false,
      recommendError: null,
      clarificationMessages: [],

      setStep: (step) => set({ step }),
      setMode: (mode) => set((s) => ({ draft: { ...s.draft, mode } })),
      setCoffee: (coffee) =>
        set((s) => ({ draft: { ...s.draft, coffee: { ...s.draft.coffee, ...coffee } as CoffeeIdentity } })),
      setPlace: (place) => set((s) => ({ draft: { ...s.draft, place } })),
      setContext: (context) => set((s) => ({ draft: { ...s.draft, context } })),
      setRecommendation: (recommendation) => set((s) => ({ draft: { ...s.draft, recommendation } })),
      setBrew: (brew) => set((s) => ({ draft: { ...s.draft, brew } })),
      setResult: (result) => set((s) => ({ draft: { ...s.draft, result } })),
      setIsAnalyzing: (v) => set({ isAnalyzing: v }),
      setIsRecommending: (v) => set({ isRecommending: v }),
      setRecommendError: (err) => set({ recommendError: err }),
      addClarificationMessage: (msg) =>
        set((s) => ({ clarificationMessages: [...s.clarificationMessages, msg] })),
      clearClarifications: () => set({ clarificationMessages: [] }),
      reset: () =>
        set({ step: "mode", draft: initialDraft, isAnalyzing: false, isRecommending: false, recommendError: null, clarificationMessages: [] }),
    }),
    {
      name: "brew-flow",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
