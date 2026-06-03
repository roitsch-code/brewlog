"use client";

import { useState, type ReactNode } from "react";
import { useFlowStore } from "@/store/flowStore";
import LightFlowShell from "@/components/ui/light/LightFlowShell";
import Hero from "@/components/ui/light/Hero";
import Section from "@/components/ui/light/Section";
import Chip from "@/components/ui/light/Chip";
import LightStarRating from "@/components/ui/light/StarRating";
import Card, { CardTitle } from "@/components/ui/light/Card";
import FlavorWheel from "@/components/ui/FlavorWheel";
import { SCA_WHEEL, QUICK_FLAVORS } from "@/lib/constants/scaFlavorWheel";
import { BREW_METHODS } from "@/lib/constants/brewMethods";

/**
 * Light System fork of /components/flow/StepLog.tsx.
 *
 * Mirrors Dark structure 1:1 — same state, same submission shape,
 * same conditional sections (rating-gated, home vs external, two
 * collapsibles). Only the visual layer changes:
 *   - LightStarRating (warm anthracite, no #F0EDE8 cream stars)
 *   - Chip primitive for text-only selectors (Flow, Timing, Body,
 *     Acidity, Flavor Notes, Sensory rows, quality dimensions)
 *   - Card primitive for the "Would brew again" Yes / No pair
 *   - Inline Light-glass inputs and textareas
 *
 * FlavorWheel was Dark for v1 but is now Light-themed — palette
 * inverted in place (canvas transparent, cream-glass panels,
 * anthracite text + icons) so it composes against the page's Field
 * gradient like the rest of the Light surfaces.
 *
 * Mounted ONLY by /app/(light)/brew/preview/page.tsx during migration.
 * Dark /components/flow/StepLog.tsx stays untouched until cut-over.
 */

const FLOW_OPTIONS = ["too-fast", "perfect", "too-slow", "na"] as const;
const FLOW_LABELS: Record<string, string> = { "too-fast": "Too Fast", perfect: "Perfect", "too-slow": "Too Slow", na: "N/A" };
const TIMING_OPTIONS = ["as-expected", "faster", "slower"] as const;
const TIMING_LABELS: Record<string, string> = { "as-expected": "As Expected", faster: "Faster", slower: "Slower" };
const BODY_OPTIONS = ["light", "medium", "full"];
const ACIDITY_OPTIONS = ["low", "medium", "high", "bright"];
const AGITATION_OPTIONS = ["yes", "partially", "no"] as const;
const AGITATION_LABELS: Record<string, string> = { yes: "Followed", partially: "Partially", no: "Skipped" };

const RATING_LABELS = ["", "Disappointing", "Okay", "Good", "Great", "Outstanding"];

const inputClass =
  "w-full rounded-2xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 px-3 py-2.5 text-[14px] text-light-foreground placeholder:text-light-muted-foreground/70 outline-none";

export default function LightStepLog() {
  const { draft, setBrew, setResult, setStep } = useFlowStore();
  const isExternal = draft.mode === "external";
  const rec = draft.recommendation;
  // Recipe the user actually brewed = the candidate they selected (by index),
  // not always the first/primary one. Falls back for legacy drafts.
  const selIdx = draft.brew?.selectedCandidateIdx;
  const selectedRecipe =
    (selIdx != null ? rec?.candidates?.[selIdx]?.recipe : undefined) ??
    rec?.primaryRecipe;

  const [rating, setRating] = useState(0);
  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
  const [body, setBody] = useState("");
  const [acidity, setAcidity] = useState("");
  const [freeNotes, setFreeNotes] = useState("");
  const [wouldAgain, setWouldAgain] = useState<boolean | null>(null);
  const [flow, setFlow] = useState<string>("");
  const [timing, setTiming] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const [attribution, setAttribution] = useState<"brew" | "bean" | "roaster" | null>(null);
  const [craft, setCraft] = useState<"off" | "solid" | "exceptional" | null>(null);
  const [fit, setFit] = useState<"not-my-style" | "neutral" | "my-kind" | null>(null);
  const [roastQuality, setRoastQuality] = useState<"poor" | "fine" | "exceptional" | null>(null);

  const [grindUsed, setGrindUsed] = useState(selectedRecipe?.grindSize ?? "");
  const [tempUsed, setTempUsed] = useState(selectedRecipe?.waterTempC?.toString() ?? "");

  const [followedAgitation, setFollowedAgitation] = useState<"yes" | "partially" | "no" | "">("");
  const [agitationNote, setAgitationNote] = useState("");

  const [showBrewDetails, setShowBrewDetails] = useState(false);
  const [externalMethod, setExternalMethod] = useState(draft.place?.methodServed ?? "");
  const [externalDose, setExternalDose] = useState("");
  const [externalWater, setExternalWater] = useState("");
  const [externalTime, setExternalTime] = useState("");

  const [sweetness, setSweetness] = useState<"low" | "medium" | "high" | "">("");
  const [clarity, setClarity] = useState<"muddy" | "cloudy" | "clean" | "crystal" | "">("");
  const [bitterness, setBitterness] = useState<"none" | "pleasant" | "harsh" | "">("");
  const [finish, setFinish] = useState<"short" | "medium" | "long" | "">("");
  const [improvedWhileCooling, setImprovedWhileCooling] = useState<boolean | null>(null);
  const [matchedIntention, setMatchedIntention] = useState<boolean | null>(null);

  // Post-rate coach micro-dialogue. The heuristic decides locally whether
  // to ask (no LLM round-trip just to skip); the endpoint only writes the
  // question text when one is warranted.
  const [coachQuestion, setCoachQuestion] = useState<{ question: string; chips: string[] } | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachAnswer, setCoachAnswer] = useState<string>("");
  const [coachCustom, setCoachCustom] = useState<string>("");

  const toggleFlavor = (f: string) =>
    setSelectedFlavors((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const canProceed = rating > 0;

  /** Build the TasteResult object from current local state. Pure, no
   * side effects — used both by the "save without coach" path and by
   * the "save with coachAnswer" path so the field-merge logic lives in
   * one place. */
  const buildResult = (coachAnswerData?: { question: string; answer: string }) => ({
    rating,
    flavorNotes: selectedFlavors,
    body,
    acidity,
    freeNotes,
    ...(wouldAgain !== null ? { wouldBrewAgain: wouldAgain } : {}),
    ...(rating <= 3 && attribution ? { attribution } : {}),
    ...(craft ? { craft } : {}),
    ...(fit ? { fit } : {}),
    ...(roastQuality ? { roastQuality } : {}),
    ...(sweetness ? { sweetness } : {}),
    ...(clarity ? { clarity } : {}),
    ...(bitterness ? { bitterness } : {}),
    ...(finish ? { finish } : {}),
    ...(improvedWhileCooling !== null ? { improvedWhileCooling } : {}),
    ...(matchedIntention !== null ? { matchedIntention } : {}),
    ...(coachAnswerData ? { coachAnswer: coachAnswerData } : {}),
  });

  const commitBrew = () => {
    if (isExternal) {
      setBrew({
        // Do NOT spread draft.brew here — home-mode fields would leak into
        // the external save and trip Zod's enum validation on the server.
        ...(externalMethod ? { methodUsed: externalMethod } : {}),
        ...(externalDose ? { doseGrams: parseFloat(externalDose) } : {}),
        ...(externalWater ? { waterGrams: parseFloat(externalWater) } : {}),
        ...(externalTime ? { actualTimeSec: parseInt(externalTime, 10) } : {}),
      });
    } else {
      setBrew({
        ...draft.brew,
        ...(flow ? { flow: flow as "too-fast" | "perfect" | "too-slow" | "na" } : {}),
        ...(timing ? { timing: timing as "as-expected" | "faster" | "slower" } : {}),
        ...(grindUsed ? { grindSettingUsed: grindUsed } : {}),
        ...(tempUsed ? { actualTempC: parseFloat(tempUsed) } : {}),
        ...(followedAgitation ? { followedAgitation } : {}),
        ...(agitationNote.trim() ? { agitationNote: agitationNote.trim() } : {}),
      });
    }
  };

  /** Deterministic ambiguity heuristic — decides whether the post-rate
   * coach should ask one micro-dialogue question. The endpoint never
   * decides whether to ask: this function does. Examples below match
   * the plan's call-out cases (rating drop, timing drift, bitter+low,
   * muddy+high, cooling shift). */
  const computeCoachSignals = () => {
    const recipe = selectedRecipe;
    const actualTimeSec = draft.brew?.actualTimeSec;
    const targetTimeSec = recipe?.targetTimeSec;
    const overrunPct =
      actualTimeSec != null && targetTimeSec != null && targetTimeSec > 0
        ? ((actualTimeSec - targetTimeSec) / targetTimeSec) * 100
        : undefined;

    const bitterAndLowRating = bitterness === "harsh" && rating > 0 && rating <= 3;
    const muddyAndHighRating = (clarity === "muddy" || clarity === "cloudy") && rating >= 4;
    const coolingChangedTaste = improvedWhileCooling === true;

    const fireCount =
      (overrunPct != null && Math.abs(overrunPct) >= 20 ? 1 : 0) +
      (bitterAndLowRating ? 1 : 0) +
      (muddyAndHighRating ? 1 : 0) +
      (coolingChangedTaste ? 1 : 0);

    return {
      shouldAsk: fireCount > 0,
      signals: {
        ...(overrunPct != null ? { timingOverrunPct: overrunPct } : {}),
        ...(bitterAndLowRating ? { bitterAndLowRating: true } : {}),
        ...(muddyAndHighRating ? { muddyAndHighRating: true } : {}),
        ...(coolingChangedTaste ? { coolingChangedTaste: true } : {}),
      },
      context: {
        coffeeName: draft.coffee ? `${draft.coffee.roaster ?? ""} ${draft.coffee.name ?? ""}`.trim() : undefined,
        methodUsed: draft.brew?.methodUsed ?? rec?.primaryMethod,
        rating,
        bitterness: bitterness || undefined,
        clarity: clarity || undefined,
        finish: finish || undefined,
        actualTimeSec,
        targetTimeSec,
        flavorNotes: selectedFlavors,
        freeNotes: freeNotes || undefined,
      },
    };
  };

  const handleNext = async () => {
    commitBrew();
    const { shouldAsk, signals, context } = computeCoachSignals();

    if (!shouldAsk || isExternal) {
      // External brews are out of scope for the coach micro-dialogue —
      // we didn't author the recipe so we can't ask sharp questions
      // about it.
      setResult(buildResult());
      setStep("summary");
      return;
    }

    // Ambiguity present — open the modal with a loading state, fetch
    // the question, then let the user answer or skip. If the fetch
    // fails or times out, fall through to save without the coach.
    setCoachOpen(true);
    setCoachLoading(true);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch("/api/coach-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signals, context }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data?.question && Array.isArray(data?.chips)) {
          setCoachQuestion({ question: data.question, chips: data.chips });
          setCoachLoading(false);
          return;
        }
      }
    } catch {
      // network error or timeout — fall through and save without coach
    }
    // No question available — skip silently.
    setCoachLoading(false);
    setCoachOpen(false);
    setResult(buildResult());
    setStep("summary");
  };

  const submitCoachAnswer = (answerText: string) => {
    const answer = answerText.trim();
    if (!coachQuestion || !answer) return;
    setResult(buildResult({ question: coachQuestion.question, answer }));
    setCoachOpen(false);
    setStep("summary");
  };

  const skipCoach = () => {
    setResult(buildResult());
    setCoachOpen(false);
    setStep("summary");
  };

  return (
    <LightFlowShell onNext={handleNext} nextDisabled={!canProceed} nextLabel="Save">
      <Hero eyebrow="Taste Log" question={<>How was it?</>} />

      {/* Rating — central hero-adjacent affordance */}
      <div className="flex flex-col items-center gap-3 pb-8">
        <LightStarRating value={rating} onChange={setRating} size="lg" />
        <p className="text-[13px] text-light-muted-foreground">
          {rating === 0 ? "Tap to rate" : RATING_LABELS[rating] ?? ""}
        </p>
      </div>

      <div className="space-y-10">
        {/* ─── TASTE ─────────────────────────────────────────────
            The cup itself. Body / Acidity / Sweetness / Bitterness /
            Finish are all flavour dimensions and travel together. Clarity
            is mouthfeel/visual, not flavour — kept here because it sits
            alongside body in tasting language. Nothing in an accordion;
            every field is optional but visible. */}
        <Section eyebrow="Taste">
          <div className="space-y-4">
            <SensoryRow
              label="Body"
              options={BODY_OPTIONS.map((b) => ({ id: b, label: b.charAt(0).toUpperCase() + b.slice(1) }))}
              value={body}
              onChange={setBody}
            />
            <SensoryRow
              label="Acidity"
              options={ACIDITY_OPTIONS.map((a) => ({ id: a, label: a.charAt(0).toUpperCase() + a.slice(1) }))}
              value={acidity}
              onChange={setAcidity}
            />
            <SensoryRow
              label="Sweetness"
              options={[{ id: "low", label: "Low" }, { id: "medium", label: "Medium" }, { id: "high", label: "High" }]}
              value={sweetness}
              onChange={(v) => setSweetness(v as typeof sweetness)}
            />
            <SensoryRow
              label="Bitterness"
              options={[{ id: "none", label: "None" }, { id: "pleasant", label: "Pleasant" }, { id: "harsh", label: "Harsh" }]}
              value={bitterness}
              onChange={(v) => setBitterness(v as typeof bitterness)}
            />
            <SensoryRow
              label="Finish"
              options={[{ id: "short", label: "Short" }, { id: "medium", label: "Medium" }, { id: "long", label: "Long" }]}
              value={finish}
              onChange={(v) => setFinish(v as typeof finish)}
            />
            <SensoryRow
              label="Clarity (mouthfeel)"
              options={[{ id: "muddy", label: "Muddy" }, { id: "cloudy", label: "Cloudy" }, { id: "clean", label: "Clean" }, { id: "crystal", label: "Crystal" }]}
              value={clarity}
              onChange={(v) => setClarity(v as typeof clarity)}
            />
            <div className="space-y-3 pt-2">
              <SensoryToggle label="Improved while cooling" value={improvedWhileCooling} onChange={setImprovedWhileCooling} />
              <SensoryToggle label="Matched your intention" value={matchedIntention} onChange={setMatchedIntention} />
            </div>
          </div>
        </Section>

        {/* ─── FLAVOR NOTES (wheel) ─────────────────────────── */}
        <Section eyebrow="Flavor notes">
          <div className="w-full flex justify-center">
            <FlavorWheel
              mode="select"
              activeCategory={activeCategory}
              onCategorySelect={setActiveCategory}
              selectedFlavors={selectedFlavors}
              size={320}
            />
          </div>

          {activeCategory ? (
            <div className="space-y-3 mt-3">
              <p className="label-eyebrow px-1">{activeCategory}</p>
              {Object.entries(SCA_WHEEL[activeCategory].subcategories).map(([sub, flavors]) => (
                <div key={sub}>
                  {Object.keys(SCA_WHEEL[activeCategory].subcategories).length > 1 && (
                    <p className="text-[11px] text-light-muted-foreground/70 mb-1.5 px-1">{sub}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {flavors.map((f) => (
                      <Chip key={f} size="sm" selected={selectedFlavors.includes(f)} onClick={() => toggleFlavor(f)}>
                        {f}
                      </Chip>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2 mt-3">
              <div className="flex flex-wrap gap-2">
                {QUICK_FLAVORS.map((f) => (
                  <Chip key={f} size="sm" selected={selectedFlavors.includes(f)} onClick={() => toggleFlavor(f)}>
                    {f}
                  </Chip>
                ))}
              </div>
              <p className="text-[12px] text-light-muted-foreground px-1 mt-1">Tap the wheel to explore by category</p>
            </div>
          )}

          {selectedFlavors.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-3 mt-2 border-t border-light-foreground/10">
              {selectedFlavors.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggleFlavor(f)}
                  className="text-[12px] text-light-foreground bg-light-card-selected px-2 py-0.5 rounded-lg"
                >
                  {f} ×
                </button>
              ))}
            </div>
          )}
        </Section>

        {/* ─── HOW IT BREWED ─────────────────────────────────────
            How the water moved, not how it tasted. Separate eyebrow so
            the user can't confuse Flow / Timing (mechanics) with the
            taste dimensions above. Home-mode only — externals don't
            brew anything themselves. */}
        {!isExternal && (
          <Section eyebrow="How it brewed">
            <div className="space-y-4">
              <SensoryRow
                label="Flow"
                options={FLOW_OPTIONS.map((o) => ({ id: o, label: FLOW_LABELS[o] }))}
                value={flow}
                onChange={setFlow}
              />
              <SensoryRow
                label="Timing"
                options={TIMING_OPTIONS.map((o) => ({ id: o, label: TIMING_LABELS[o] }))}
                value={timing}
                onChange={setTiming}
              />
              <div className="grid grid-cols-2 gap-3">
                <LabeledInput
                  label="Grind used"
                  value={grindUsed}
                  onChange={setGrindUsed}
                  placeholder={selectedRecipe?.grindSize ?? "e.g. 406°"}
                />
                <LabeledInput
                  label="Temp (°C)"
                  type="number"
                  value={tempUsed}
                  onChange={setTempUsed}
                  placeholder={selectedRecipe?.waterTempC?.toString() ?? "°C"}
                />
              </div>
              <SensoryRow
                label="Agitation"
                options={AGITATION_OPTIONS.map((o) => ({ id: o, label: AGITATION_LABELS[o] }))}
                value={followedAgitation}
                onChange={(v) => setFollowedAgitation(v as typeof followedAgitation)}
              />
              {followedAgitation && followedAgitation !== "yes" && (
                <input
                  type="text"
                  value={agitationNote}
                  onChange={(e) => setAgitationNote(e.target.value)}
                  placeholder="What did you actually do?"
                  className={inputClass}
                />
              )}
            </div>
          </Section>
        )}

        {isExternal && (
          <Disclosure label="Brew details — optional" open={showBrewDetails} onToggle={() => setShowBrewDetails((v) => !v)}>
            <div className="space-y-5">
              <div>
                <p className="label-eyebrow mb-2 px-1">Method</p>
                <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                  {BREW_METHODS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setExternalMethod((prev) => (prev === m.label ? "" : m.label))}
                      className={`shrink-0 inline-flex items-center rounded-full px-4 py-2 text-[13px] font-medium leading-tight transition-all backdrop-blur-light-card backdrop-saturate-150 ${
                        externalMethod === m.label
                          ? "bg-light-card-selected text-light-foreground shadow-light-card-pressed"
                          : "bg-light-card-default text-light-foreground"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <LabeledInput label="Dose (g)" type="number" value={externalDose} onChange={setExternalDose} placeholder="e.g. 18" />
                <LabeledInput label="Water (ml)" type="number" value={externalWater} onChange={setExternalWater} placeholder="e.g. 270" />
              </div>
              <LabeledInput label="Brew time (seconds)" type="number" value={externalTime} onChange={setExternalTime} placeholder="e.g. 210" />
            </div>
          </Disclosure>
        )}

        {/* ─── QUALITY DIMENSIONS ─────────────────────────────────
            Separates execution (craft) from style alignment (fit) from
            raw material (roastQuality). Gated on a rating so the user
            isn't asked to attribute before they've evaluated. */}
        {rating > 0 && (
          <Section eyebrow="Quality">
            <div className="space-y-4">
              <SensoryRow
                label={isExternal ? "Brew (craft)" : "Your brew (craft)"}
                options={[{ id: "off", label: "Off day" }, { id: "solid", label: "Solid" }, { id: "exceptional", label: "Exceptional" }]}
                value={craft ?? ""}
                onChange={(v) => setCraft(v === "" ? null : (v as typeof craft))}
              />
              <SensoryRow
                label="The bean (fit)"
                options={[{ id: "not-my-style", label: "Not my style" }, { id: "neutral", label: "Neutral" }, { id: "my-kind", label: "My kind" }]}
                value={fit ?? ""}
                onChange={(v) => setFit(v === "" ? null : (v as typeof fit))}
              />
              <SensoryRow
                label="The roast"
                options={[{ id: "poor", label: "Poor" }, { id: "fine", label: "Fine" }, { id: "exceptional", label: "Exceptional" }]}
                value={roastQuality ?? ""}
                onChange={(v) => setRoastQuality(v === "" ? null : (v as typeof roastQuality))}
              />
              {rating <= 3 && (
                <SensoryRow
                  label="What held it back most?"
                  options={[{ id: "brew", label: "My brew" }, { id: "bean", label: "The bean" }, { id: "roaster", label: "The roaster" }]}
                  value={attribution ?? ""}
                  onChange={(v) => setAttribution(v === "" ? null : (v as typeof attribution))}
                />
              )}
            </div>
          </Section>
        )}

        <Section eyebrow={isExternal ? "Would you drink this again?" : "Would you brew this exact setup again?"}>
          <div className="grid grid-cols-2 gap-3">
            <div className="h-[88px]">
              <Card selected={wouldAgain === true} onClick={() => setWouldAgain((prev) => (prev === true ? null : true))} ariaLabel="Yes">
                <CardTitle>Yes</CardTitle>
              </Card>
            </div>
            <div className="h-[88px]">
              <Card selected={wouldAgain === false} onClick={() => setWouldAgain((prev) => (prev === false ? null : false))} ariaLabel="No">
                <CardTitle>No</CardTitle>
              </Card>
            </div>
          </div>
        </Section>

        <Section eyebrow="Notes (optional)">
          <textarea
            value={freeNotes}
            onChange={(e) => setFreeNotes(e.target.value)}
            placeholder="Anything else worth noting…"
            rows={3}
            className="w-full rounded-2xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 px-4 py-3 text-[15px] text-light-foreground placeholder:text-light-muted-foreground/70 outline-none resize-none"
          />
        </Section>
      </div>

      {coachOpen && (
        <CoachQuestionSheet
          loading={coachLoading}
          question={coachQuestion}
          answer={coachAnswer}
          custom={coachCustom}
          onPickChip={(chip) => {
            setCoachAnswer(chip);
            setCoachCustom("");
          }}
          onTypeCustom={(value) => {
            setCoachCustom(value);
            setCoachAnswer("");
          }}
          onSubmit={() => {
            const answer = coachAnswer || coachCustom;
            if (answer) submitCoachAnswer(answer);
          }}
          onSkip={skipCoach}
        />
      )}
    </LightFlowShell>
  );
}

/**
 * Bottom sheet that surfaces the coach's one micro-dialogue question.
 * Only mounted when the ambiguity heuristic has fired AND the Sonnet
 * call returned a usable question. Modal-style — covers the screen,
 * blocks save until answered or explicitly skipped.
 */
function CoachQuestionSheet({
  loading,
  question,
  answer,
  custom,
  onPickChip,
  onTypeCustom,
  onSubmit,
  onSkip,
}: {
  loading: boolean;
  question: { question: string; chips: string[] } | null;
  answer: string;
  custom: string;
  onPickChip: (chip: string) => void;
  onTypeCustom: (value: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
}) {
  const canSubmit = !!(answer || custom.trim());
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-light-foreground/30 backdrop-blur-sm">
      <div className="bg-light-surface rounded-t-3xl px-6 pt-6 pb-8 shadow-light-card-pressed" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)" }}>
        <p className="label-eyebrow text-light-muted-foreground mb-3">One quick check</p>
        {loading || !question ? (
          <div className="space-y-3">
            <div className="h-4 bg-light-foreground/10 rounded-full w-full animate-pulse" />
            <div className="h-4 bg-light-foreground/10 rounded-full w-3/4 animate-pulse" />
            <p className="text-light-muted-foreground text-xs pt-2">Coach is thinking…</p>
          </div>
        ) : (
          <>
            <p className="font-fraunces text-[22px] leading-tight text-light-foreground mb-5">{question.question}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {question.chips.map((chip) => (
                <Chip key={chip} selected={answer === chip} onClick={() => onPickChip(chip)}>
                  {chip}
                </Chip>
              ))}
            </div>
            <input
              type="text"
              value={custom}
              onChange={(e) => onTypeCustom(e.target.value)}
              placeholder="Other…"
              className={inputClass}
            />
            <div className="flex items-center gap-3 mt-5">
              <button
                type="button"
                onClick={onSkip}
                className="flex-1 h-12 rounded-full text-light-muted-foreground text-[14px] active:text-light-foreground"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={!canSubmit}
                className={`flex-[2] h-12 rounded-full font-semibold text-[14px] transition-opacity ${
                  canSubmit
                    ? "bg-light-foreground text-light-text-on-dark active:scale-[0.98]"
                    : "bg-light-foreground/30 text-light-text-on-dark cursor-not-allowed"
                }`}
              >
                Save with this
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <p className="text-[11px] text-light-muted-foreground mb-1.5 px-1">{label}</p>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputClass} />
    </div>
  );
}

function SensoryRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="label-eyebrow px-1">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o.id} selected={value === o.id} onClick={() => onChange(value === o.id ? "" : o.id)}>
            {o.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function SensoryToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[14px] text-light-foreground/80">{label}</span>
      <div className="flex gap-2">
        <Chip selected={value === true} onClick={() => onChange(value === true ? null : true)}>
          Yes
        </Chip>
        <Chip selected={value === false} onClick={() => onChange(value === false ? null : false)}>
          No
        </Chip>
      </div>
    </div>
  );
}

/**
 * Collapsible section disclosure. Subtle eyebrow button + animated
 * expansion. Used twice in this file (Brew details, Sensory detail).
 * Inlined rather than promoted to a primitive — two consumers, both
 * here. Promote if a third appears elsewhere.
 */
function Disclosure({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 label-eyebrow px-1 transition-colors active:text-light-foreground"
      >
        <span>{label}</span>
        <span className="text-light-foreground/30">{open ? "▲" : "▼"}</span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          open ? "max-h-[800px] opacity-100 mt-4" : "max-h-0 opacity-0"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
