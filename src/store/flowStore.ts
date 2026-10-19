import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { DraftSession, SessionMode, CoffeeIdentity, SessionContext, Recommendation, BrewLog, TasteResult, ExternalPlace } from "@/lib/types/session";
import type { FieldZones } from "@/lib/field/types";
import { applyGrinderAnswer } from "@/lib/flow/grinderAnswer";

export type FlowStep =
  | "scan"         // Photo + AI extraction + clarification (always first)
  | "mode"         // Home Brew / Coffee Shop (after scan)
  | "context"      // Occasion, amount, time, mood (home only)
  | "recommend"    // AI recommendation (home only)
  | "brew"         // Recipe card + timer
  | "log"          // Taste documentation
  | "summary";     // Save

export interface PendingInsight {
  key: string;
  status: "loading" | "done";
  terrain: string | null;
  adjustment: string | null;
}

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
  /** The post-brew insight, requested from the LOG screen the moment Save is
   * tapped (in parallel with the coach question) so the Summary does not start
   * the wait from zero. `key` = insightRequestKey(result, brew) of the draft it
   * was requested for; the Summary ignores it when the key no longer matches. */
  pendingInsight: PendingInsight | null;
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
  /** A Siri / Action-Button trigger (`btts://voice`) asked to open the Home
   * voice chat and start listening. The Home page consumes this on mount,
   * arms the mic (which sounds the listening earcon), then clears it. Cleared
   * back to false in steady state so a normal app open never auto-listens. */
  pendingVoiceChat: boolean;
  /** The pending_brews row (migration 0025) this draft is parked under. Set
   * when the Log screen opens, so a brew that is never rated — or is overwritten
   * by the next brew — survives server-side and shows on the Home card. The
   * Summary save sends it as body.pendingBrewId so the server drops the row. */
  pendingBrewId: string | null;
  /** When the brew finished (Log screen opened), ISO — the session's createdAt,
   * so a brew rated hours later is dated to when it was brewed. */
  brewedAt: string | null;
  /** True once the pending_brews PUT succeeded (false → the Log screen retries). */
  pendingBrewSynced: boolean;
  /** Entered via the Home "to rate" card — Back from the Log returns to the
   * list instead of the (finished) timer. */
  resumedForRating: boolean;
  /** Every candidate the recipe screen showed in THIS flow. Sent with the next
   * /recommend request, so going Back (and changing the context) and asking
   * again never serves the same recipes (shownGuard.ts). Survives a context
   * change on purpose; cleared only by a new session. */
  shownCandidates: ShownCandidate[];

  // Actions
  setStep: (step: FlowStep) => void;
  setMode: (mode: SessionMode) => void;
  setSkipScan: (v: boolean) => void;
  setPendingScanUrl: (url: string | null) => void;
  setPendingChatUrl: (url: string | null) => void;
  setPendingChatImageData: (dataUrl: string | null) => void;
  setPendingVoiceChat: (v: boolean) => void;
  setIsDripBag: (v: boolean) => void;
  setCoffee: (coffee: Partial<CoffeeIdentity>) => void;
  setPlace: (place: ExternalPlace) => void;
  setContext: (context: SessionContext) => void;
  setRecommendation: (rec: Recommendation) => void;
  /** A FRESH recommendation landed from the job: store it AND remember its
   * candidates as shown. (Brew-again restores go through setRecommendation.) */
  receiveRecommendation: (rec: Recommendation) => void;
  setBrew: (brew: BrewLog) => void;
  /** The owner's one-tap answer to a candidate's grinder proposal: accept
   * swaps the recipe's grind into the proposed grinder's unit and sets the
   * brew's grinder; decline restores both. Reversible, nothing regenerated. */
  answerGrinderSuggestion: (candidateIdx: number, accepted: boolean) => void;
  setResult: (result: TasteResult) => void;
  setFieldZones: (zones: FieldZones | null) => void;
  setIsAnalyzing: (v: boolean) => void;
  setIsRecommending: (v: boolean) => void;
  setRecommendError: (err: string | null) => void;
  setRecommendJobId: (id: string | null) => void;
  setPendingInsight: (p: PendingInsight | null) => void;
  addClarificationMessage: (msg: ClarificationMessage) => void;
  clearClarifications: () => void;
  reset: () => void;
  setPendingBrew: (id: string, brewedAt: string) => void;
  setPendingBrewSynced: (v: boolean) => void;
  /** Re-open a parked, unrated brew on the Log screen. */
  resumeForRating: (args: { id: string; brewedAt: string; draft: DraftSession; fieldZones: FieldZones | null }) => void;
  /** Re-hydrate a parked cold-brew session (snapshot stored at steep start) so
   * the user can return to LOG it after steeping — even if they ran other
   * brews in between (which overwrite the single live draft). Lands on the
   * "brew" step, where the cold-steep view shows the ready/steeping state. */
  resumeColdBrew: (draft: DraftSession, fieldZones: FieldZones | null) => void;
}

export interface ShownCandidate {
  title: string;
  method: string;
  basedOn?: string;
}

const MAX_SHOWN = 20;

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
      pendingVoiceChat: false,
      pendingBrewId: null,
      brewedAt: null,
      pendingBrewSynced: false,
      resumedForRating: false,
      shownCandidates: [],
      isDripBag: false,
      isAnalyzing: false,
      isRecommending: false,
      recommendError: null,
      recommendJobId: null,
      pendingInsight: null,
      clarificationMessages: [],

      setStep: (step) => set({ step }),
      setMode: (mode) => set((s) => ({ draft: { ...s.draft, mode } })),
      setSkipScan: (v) => set({ skipScan: v }),
      setPendingScanUrl: (pendingScanUrl) => set({ pendingScanUrl }),
      setPendingChatUrl: (pendingChatUrl) => set({ pendingChatUrl }),
      setPendingChatImageData: (pendingChatImageData) => set({ pendingChatImageData }),
      setPendingVoiceChat: (pendingVoiceChat) => set({ pendingVoiceChat }),
      setIsDripBag: (v) => set({ isDripBag: v }),
      setCoffee: (coffee) =>
        set((s) => {
          const next = { ...s.draft.coffee, ...coffee } as CoffeeIdentity;
          // A different bag is a different question: what was shown for the
          // last one must not be held against this one.
          const sameBag = next.name === s.draft.coffee?.name && next.roaster === s.draft.coffee?.roaster;
          return { draft: { ...s.draft, coffee: next }, ...(sameBag ? {} : { shownCandidates: [] }) };
        }),
      setPlace: (place) => set((s) => ({ draft: { ...s.draft, place } })),
      setContext: (context) => set((s) => ({ draft: { ...s.draft, context } })),
      setRecommendation: (recommendation) => set((s) => ({ draft: { ...s.draft, recommendation } })),
      receiveRecommendation: (recommendation) =>
        set((s) => ({
          draft: { ...s.draft, recommendation },
          shownCandidates: [
            ...s.shownCandidates,
            ...(recommendation.candidates ?? []).map((c) => ({
              title: c.title,
              method: c.method,
              ...(c.basedOn ? { basedOn: c.basedOn } : {}),
            })),
          ].slice(-MAX_SHOWN),
        })),
      setBrew: (brew) => set((s) => ({ draft: { ...s.draft, brew } })),
      answerGrinderSuggestion: (candidateIdx, accepted) =>
        set((s) => {
          const next = applyGrinderAnswer(s.draft, candidateIdx, accepted);
          return next ? { draft: next } : {};
        }),
      setResult: (result) => set((s) => ({ draft: { ...s.draft, result } })),
      setFieldZones: (fieldZones) => set({ fieldZones }),
      setIsAnalyzing: (v) => set({ isAnalyzing: v }),
      setIsRecommending: (v) => set({ isRecommending: v }),
      setRecommendError: (err) => set({ recommendError: err }),
      setRecommendJobId: (id) => set({ recommendJobId: id }),
      setPendingInsight: (pendingInsight) => set({ pendingInsight }),
      addClarificationMessage: (msg) =>
        set((s) => ({ clarificationMessages: [...s.clarificationMessages, msg] })),
      clearClarifications: () => set({ clarificationMessages: [] }),
      reset: () =>
        set({ step: "scan", draft: initialDraft, fieldZones: null, skipScan: false, pendingScanUrl: null, pendingChatUrl: null, pendingChatImageData: null, pendingVoiceChat: false, isDripBag: false, isAnalyzing: false, isRecommending: false, recommendError: null, recommendJobId: null, pendingInsight: null, clarificationMessages: [], pendingBrewId: null, brewedAt: null, pendingBrewSynced: false, resumedForRating: false, shownCandidates: [] }),
      setPendingBrew: (pendingBrewId, brewedAt) => set({ pendingBrewId, brewedAt, pendingBrewSynced: false }),
      setPendingBrewSynced: (pendingBrewSynced) => set({ pendingBrewSynced }),
      resumeForRating: ({ id, brewedAt, draft, fieldZones }) =>
        set({ step: "log", draft, fieldZones, skipScan: true, isDripBag: false, isAnalyzing: false, isRecommending: false, recommendError: null, recommendJobId: null, pendingInsight: null, clarificationMessages: [], pendingScanUrl: null, pendingChatUrl: null, pendingChatImageData: null, pendingVoiceChat: false, pendingBrewId: id, brewedAt, pendingBrewSynced: true, resumedForRating: true, shownCandidates: [] }),
      resumeColdBrew: (draft, fieldZones) =>
        set({ step: "brew", draft, fieldZones, skipScan: true, isDripBag: false, isAnalyzing: false, isRecommending: false, recommendError: null, recommendJobId: null, pendingInsight: null, clarificationMessages: [], pendingScanUrl: null, pendingChatUrl: null, pendingChatImageData: null, pendingVoiceChat: false, pendingBrewId: null, brewedAt: null, pendingBrewSynced: false, resumedForRating: false, shownCandidates: [] }),
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
