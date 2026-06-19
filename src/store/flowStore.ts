import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { DraftSession, SessionMode, CoffeeIdentity, SessionContext, Recommendation, BrewLog, TasteResult, ExternalPlace } from "@/lib/types/session";
import type { FieldZones } from "@/lib/field/types";

export type FlowStep =
  | "scan"         // Photo + AI extraction + clarification (always first)
  | "mode"         // Home Brew / Coffee Shop (after scan)
  | "context"      // Occasion, amount, time, mood (home only)
  | "recommend"    // AI recommendation (home only)
  | "brew"         // Recipe card + timer
  | "log"          // Taste documentation
  | "summary";     // Save

interface FlowState {
  step: FlowStep;
  draft: DraftSession;
  /** Generative Field v1.1 — coffee's Zone composition for this in-flight brew.
   * Populated from /api/analyze-bag's `fieldZones` field at scan-complete.
   * Lives in-memory only (sessionStorage-persisted with the rest of the store
   * but NOT written into sessions.coffee on session save — that's a coffees
   * property per spec §10.4 anti-pattern). null = use Default Field. */
  fieldZones: FieldZones | null;
  skipScan: boolean;         // true when entering via "brew again" (no scan step)
  /** Set from the "Drip bag" toggle in the scan step. A drip bag brews one
   * fixed way, so when true the flow leaves the brew steps after scan and
   * routes to the drip documentation (flavours + rating), saved isolated in
   * the drip_bags table. See src/lib/types/dripBag.ts. */
  isDripBag: boolean;
  isAnalyzing: boolean;
  isRecommending: boolean;
  recommendError: string | null;
  /** Id of the server-side background recommendation job, set when the recipe
   * generation is kicked off and cleared when it resolves (or on reset). The
   * always-mounted RecommendJobWatcher polls it so generation survives the app
   * being backgrounded — see src/lib/recommend/jobStore.ts. */
  recommendJobId: string | null;
  clarificationMessages: ClarificationMessage[];
  /** A URL shared into the app via the iOS Share Sheet ("Add to BTTS"), to be
   * auto-analyzed by the scan step on mount, then cleared. */
  pendingScanUrl: string | null;
  /** A coffee URL shared in via "Add to BTTS" — the Home chat auto-asks
   * "What do you think of this coffee: <url>" on mount, then clears it. */
  pendingChatUrl: string | null;
  /** A PHOTO shared in via "Add to BTTS" (Share Sheet → album image), as a
   * base64 data URL read from the App Group. The Home chat uploads it, attaches
   * it, and auto-asks about it on mount, then clears it. */
  pendingChatImageData: string | null;

  // Actions
  setStep: (step: FlowStep) => void;
  setMode: (mode: SessionMode) => void;
  setSkipScan: (v: boolean) => void;
  setPendingScanUrl: (url: string | null) => void;
  setPendingChatUrl: (url: string | null) => void;
  setPendingChatImageData: (dataUrl: string | null) => void;
  setIsDripBag: (v: boolean) => void;
  setCoffee: (coffee: Partial<CoffeeIdentity>) => void;
  setPlace: (place: ExternalPlace) => void;
  setContext: (context: SessionContext) => void;
  setRecommendation: (rec: Recommendation) => void;
  setBrew: (brew: BrewLog) => void;
  setResult: (result: TasteResult) => void;
  setFieldZones: (zones: FieldZones | null) => void;
  setIsAnalyzing: (v: boolean) => void;
  setIsRecommending: (v: boolean) => void;
  setRecommendError: (err: string | null) => void;
  setRecommendJobId: (id: string | null) => void;
  addClarificationMessage: (msg: ClarificationMessage) => void;
  clearClarifications: () => void;
  reset: () => void;
  /** Re-hydrate a parked cold-brew session (snapshot stored at steep start) so
   * the user can return to LOG it after steeping — even if they ran other
   * brews in between (which overwrite the single live draft). Lands on the
   * "brew" step, where the cold-steep view shows the ready/steeping state. */
  resumeColdBrew: (draft: DraftSession, fieldZones: FieldZones | null) => void;
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
      step: "scan",
      draft: initialDraft,
      fieldZones: null,
      skipScan: false,
      pendingScanUrl: null,
      pendingChatUrl: null,
      pendingChatImageData: null,
      isDripBag: false,
      isAnalyzing: false,
      isRecommending: false,
      recommendError: null,
      recommendJobId: null,
      clarificationMessages: [],

      setStep: (step) => set({ step }),
      setMode: (mode) => set((s) => ({ draft: { ...s.draft, mode } })),
      setSkipScan: (v) => set({ skipScan: v }),
      setPendingScanUrl: (pendingScanUrl) => set({ pendingScanUrl }),
      setPendingChatUrl: (pendingChatUrl) => set({ pendingChatUrl }),
      setPendingChatImageData: (pendingChatImageData) => set({ pendingChatImageData }),
      setIsDripBag: (v) => set({ isDripBag: v }),
      setCoffee: (coffee) =>
        set((s) => ({ draft: { ...s.draft, coffee: { ...s.draft.coffee, ...coffee } as CoffeeIdentity } })),
      setPlace: (place) => set((s) => ({ draft: { ...s.draft, place } })),
      setContext: (context) => set((s) => ({ draft: { ...s.draft, context } })),
      setRecommendation: (recommendation) => set((s) => ({ draft: { ...s.draft, recommendation } })),
      setBrew: (brew) => set((s) => ({ draft: { ...s.draft, brew } })),
      setResult: (result) => set((s) => ({ draft: { ...s.draft, result } })),
      setFieldZones: (fieldZones) => set({ fieldZones }),
      setIsAnalyzing: (v) => set({ isAnalyzing: v }),
      setIsRecommending: (v) => set({ isRecommending: v }),
      setRecommendError: (err) => set({ recommendError: err }),
      setRecommendJobId: (id) => set({ recommendJobId: id }),
      addClarificationMessage: (msg) =>
        set((s) => ({ clarificationMessages: [...s.clarificationMessages, msg] })),
      clearClarifications: () => set({ clarificationMessages: [] }),
      reset: () =>
        set({ step: "scan", draft: initialDraft, fieldZones: null, skipScan: false, pendingScanUrl: null, pendingChatUrl: null, pendingChatImageData: null, isDripBag: false, isAnalyzing: false, isRecommending: false, recommendError: null, recommendJobId: null, clarificationMessages: [] }),
      resumeColdBrew: (draft, fieldZones) =>
        set({ step: "brew", draft, fieldZones, skipScan: true, isDripBag: false, isAnalyzing: false, isRecommending: false, recommendError: null, recommendJobId: null, clarificationMessages: [], pendingScanUrl: null, pendingChatUrl: null, pendingChatImageData: null }),
    }),
    {
      // localStorage (not sessionStorage) so an in-flight brew survives a
      // reload — critical offline, where an interrupted brew would
      // otherwise be lost. "New Session" calls reset() so it never resumes
      // a stale draft.
      name: "brew-flow",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
