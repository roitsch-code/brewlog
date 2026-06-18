"use client";

import { useState, useEffect } from "react";
import { useFlowStore } from "@/store/flowStore";
import LightFlowShell from "@/components/ui/light/LightFlowShell";
import Hero from "@/components/ui/light/Hero";
import { nextHeroQuestion, CONTEXT_QUESTIONS } from "@/lib/heroQuestions";
import Section from "@/components/ui/light/Section";
import Footnote from "@/components/ui/light/Footnote";
import Card, { CardTitle, CardSubText, CardIcon } from "@/components/ui/light/Card";
import BrewMethodIcon from "@/components/ui/BrewMethodIcon";
import { Brain, FlaskConical, Moon, Users, CupSoda } from "lucide-react";
import type { Session, SessionContext } from "@/lib/types/session";
import type { CoachInsight } from "@/components/coach/CoachCard";

/**
 * Light System fork of /components/flow/StepContext.tsx.
 *
 * Composition follows lovable-v7/src/pages/Index.tsx verbatim for the
 * non-data-model elements (icons, footnote copy, section order, card
 * layout). Strict-Lovable deviations from the live Dark Brew Context:
 *   - TIME: 2 cards (Quick, Normal) — Unhurried dropped from the UI
 *     AND from the /api/recommend time buckets. The prompt now folds
 *     any stray "unhurried" into the slow end of "normal" (~330s cap);
 *     this UI only ever sends "quick" or "normal".
 *   - WATER: 2 cards (Tap only, Championship) — Diluted dropped.
 *   - APPROACH: 2 cards only (Claude picks / I'll choose). The Dark
 *     expanding method list is removed.
 *     `preferredMethod` and `dripAssist` are never set from this UI;
 *     /api/recommend handles undefined gracefully.
 *
 * Kept beyond the Vorlage (functional augmentations):
 *   - Brew memory block at the top — surfaces this coffee's prior
 *     written summary + what-to-explore when /api/coffees/:id has
 *     one. Lovable has no equivalent; the value is too high to drop.
 *   - Hero eyebrow includes the coffee name ("CONTEXT · <name>")
 *     per Markus-feedback (PR #65). Lovable's eyebrow is just
 *     "Context".
 *
 * GOAL preserves the existing 4 ID strings (balanced/high-clarity/
 * sweetness-forward/body-forward/explore) and adds Lovable's 6th
 * card "Aromatic / Floral" as new id `aromatic`. Renaming the
 * existing IDs to Lovable's bright/sweet/bold scheme would change
 * historical-session interpretation without functional benefit, so
 * it's been deferred indefinitely. The /api/recommend prompt grew
 * a sixth GOAL VOCABULARY entry to accept "aromatic" — see the
 * companion change in src/lib/claude/recommend.ts.
 */

async function getRecentSessions(limit: number): Promise<Session[]> {
  const res = await fetch(`/api/sessions?limit=${limit}`);
  if (!res.ok) return [];
  return (await res.json()) as Session[];
}

/**
 * Sunrise without the upward arrow. Spec §9.2 wants the chevron
 * removed because at card size it reads as a navigation cue.
 *
 * Lovable's source variant (lovable-v7/src/pages/Index.tsx) compresses
 * the geometry to y=7..17 of the 24×24 viewBox — only 40% of the
 * vertical space — which renders visibly smaller than the lucide
 * icons next to it (Brain, Moon, Users, FlaskConical) that fill the
 * full box. Fix: keep the same artistic intent (rays + horizon + sun
 * arc, no arrow) but use the lucide Sunrise paths sans the arrow
 * chevron, which span the full box and visually match the other
 * occasion icons.
 */
function SunriseNoArrow({ className }: { className?: string }) {
  return (
    <svg
      viewBox="2 6 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M12 8v2" />
      <path d="m4.93 10.93 1.41 1.41" />
      <path d="M2 18h2" />
      <path d="M20 18h2" />
      <path d="m19.07 10.93-1.41 1.41" />
      <path d="M22 22H2" />
      <path d="M16 18a4 4 0 0 0-8 0" />
    </svg>
  );
}

const OCCASIONS = [
  { id: "morning-ritual", label: "Morning Ritual", Icon: SunriseNoArrow, footnote: "A slower, deliberate pour that anchors the start of a day." },
  { id: "focus", label: "Deep Focus", Icon: Brain, footnote: "A clean, mid-strength cup engineered for sustained attention." },
  { id: "social", label: "Social", Icon: Users, footnote: "A forgiving recipe that holds its character as it cools." },
  { id: "after-dinner", label: "After Dinner", Icon: Moon, footnote: "A heavier, dessert-leaning brew that closes the day with body and sweetness." },
  { id: "experiment", label: "Experiment", Icon: FlaskConical, footnote: "The recipe will push ratios, methods or sequences you haven’t tried on this coffee." },
  { id: "summer-time", label: "Summer Time", Icon: CupSoda, footnote: "Bright and refreshing, leaning into clarity and travelling well over ice." },
];

const AMOUNTS = [
  { id: "small", label: "Small", sub: "350 ml", footnote: "A single cup — focused tasting, faster brew." },
  { id: "big", label: "Big", sub: "520 ml", footnote: "A mug or two to share." },
  { id: "custom", label: "Custom", sub: "enter ml", footnote: "Set your own target in millilitres." },
  { id: "surprise", label: "Surprise me", sub: "Claude picks", footnote: "Claude picks the volume to match this coffee." },
];

const TIMES = [
  { id: "quick", label: "Quick", sub: "~2 min" },
  { id: "normal", label: "Normal", sub: "~5 min" },
];

const GOALS = [
  { id: "balanced", label: "Balanced", sub: "no taste-axis bias" },
  { id: "high-clarity", label: "Bright / Clarity", sub: "Zone-1 emphasis" },
  { id: "sweetness-forward", label: "Sweet", sub: "Zone-2 emphasis" },
  { id: "body-forward", label: "Bold / Body", sub: "mouthfeel emphasis" },
  { id: "aromatic", label: "Aromatic / Floral", sub: "volatile & delicate emphasis" },
  { id: "explore", label: "Explore", sub: "Wildcard" },
];

const GRINDERS = [
  { id: "Niche Zero", label: "Niche Zero", sub: "° values" },
  { id: "Comandante C40", label: "Comandante C40", sub: "click values" },
];

type ApproachId = "claude-picks" | "ill-choose";
const APPROACHES: ReadonlyArray<{ id: ApproachId; label: string; sub: string; footnote: string }> = [
  { id: "claude-picks", label: "Claude picks", sub: "Best method for this coffee", footnote: "Claude picks the best method for this coffee & context." },
  { id: "ill-choose", label: "I’ll choose", sub: "Claude dials in the recipe", footnote: "Pick a method below to lock it in." },
];

// Restored from the Dark version after the strict-Lovable cut left
// "I'll choose" with nothing to actually choose (Markus' /brew/preview
// feedback). Same 12 brewers as Dark StepContext, same Drip-Assist
// compatibility set (immersion / pressure / batch brewers are
// excluded — the Hario disc only controls pour rate, no effect when
// there's no pouring phase).
const METHODS = [
  { id: "V60", label: "V60", sub: "Hario cone" },
  { id: "Orea Fast", label: "Orea Fast", sub: "fast drip, max ~500 ml" },
  { id: "Orea Apex", label: "Orea Apex", sub: "clarity & brightness" },
  { id: "Orea Classic", label: "Orea Classic", sub: "sweetness focus" },
  { id: "Orea Open", label: "Orea Open", sub: "open bed, max flow, max ~500 ml" },
  { id: "Kalita Wave", label: "Kalita Wave", sub: "even bed, max ~500 ml" },
  { id: "Origami (cone)", label: "Origami (cone)", sub: "ceramic, V60-like clarity, max ~500 ml" },
  { id: "Origami (wave)", label: "Origami (wave)", sub: "ceramic, Kalita-like sweetness, max ~500 ml" },
  { id: "Chemex", label: "Chemex", sub: "clean & bright, max ~600 ml" },
  { id: "AeroPress", label: "AeroPress", sub: "max 230 ml · or concentrate" },
  { id: "Clever Dripper", label: "Clever Dripper", sub: "immersion, max 400 ml" },
  { id: "Moccamaster", label: "Moccamaster", sub: "batch brewer, ≥ 500 ml" },
  // Emergency-only: the Drip Assist disc is retired from daily use, but kept
  // selectable for when there's no gooseneck kettle around (e.g. travelling).
  // The "drip assist" token is stripped in normaliseEquipmentKey, so this maps
  // to the v60 brewer for recipe selection.
  { id: "V60 + Drip Assist", label: "V60 + Drip Assist", sub: "no gooseneck? emergency only" },
];

const WATERS = [
  { id: "tap", label: "BWT filtered", sub: "~220 ppm", footnote: "Daily driver — great for naturals & honeys." },
  { id: "championship", label: "Clarity blend", sub: "~73 ppm", footnote: "1:2 filtered + distilled — washed florals & championship methods." },
];

interface CoffeeMemory {
  writtenSummary?: string;
  whatToExplore?: string;
}

export default function LightStepContext() {
  const { draft, setContext, setStep, setIsRecommending, setRecommendError, setRecommendJobId } = useFlowStore();
  const ctx = (draft.context || {}) as Partial<SessionContext>;
  const [heroQuestion, setHeroQuestion] = useState("");
  useEffect(() => {
    setHeroQuestion(nextHeroQuestion("context", CONTEXT_QUESTIONS));
  }, []);
  const [customMl, setCustomMl] = useState<string>("");
  // Tracks which approach card is selected. Drives the footnote only;
  // /api/recommend never receives a manual preferredMethod from this
  // UI (strict-Lovable: method list removed).
  const [approach, setApproach] = useState<ApproachId | null>(null);
  const [grinderId, setGrinderId] = useState<string | null>(ctx.grinder ?? null);
  const [coffeeMemory, setCoffeeMemory] = useState<CoffeeMemory | null>(null);
  // Single 'trying' insight matching this coffee — surfaces as a quiet
  // reminder above the Context selectors. The user's earlier "Try it"
  // tap on /taste lands here when they reach for the same coffee.
  const [tryingReminder, setTryingReminder] = useState<CoachInsight | null>(null);

  // Sync local grinder selection with whatever lands in ctx (rehydrate
  // from store when the page is re-entered mid-session).
  useEffect(() => {
    if (ctx.grinder && ctx.grinder !== grinderId) setGrinderId(ctx.grinder);
  }, [ctx.grinder, grinderId]);

  useEffect(() => {
    const coffeeId = draft.coffee?.coffeeId;
    if (!coffeeId) return;
    let cancelled = false;
    fetch(`/api/coffees/${coffeeId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((coffee: { writtenSummary?: string; whatToExplore?: string } | null) => {
        if (cancelled || !coffee) return;
        if (coffee.writtenSummary || coffee.whatToExplore) {
          setCoffeeMemory({
            writtenSummary: coffee.writtenSummary,
            whatToExplore: coffee.whatToExplore,
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [draft.coffee?.coffeeId]);

  // Fetch THIS coffee's per-coffee insight; surface it as a quiet
  // reminder pill only when its status is 'trying' (the user already
  // tapped "Try it" on the /coffees/[id] coach card and we're now in
  // the flow that should remind them).
  useEffect(() => {
    const coffeeId = draft.coffee?.coffeeId;
    if (!coffeeId) return;
    let cancelled = false;
    fetch(`/api/coffees/${coffeeId}/insight`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { insight: null }))
      .then((d) => {
        if (cancelled) return;
        const raw = d.insight;
        if (!raw || raw.status !== "trying") {
          setTryingReminder(null);
          return;
        }
        setTryingReminder({
          id: coffeeId,
          observation: raw.observation,
          suggestion: raw.suggestion,
          citationFields: [],
          status: raw.status,
          source: "per-coffee",
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [draft.coffee?.coffeeId]);

  const updateCtx = (patch: Partial<SessionContext>) => {
    setContext({ ...ctx, ...patch } as SessionContext);
  };

  const toggleField = <K extends keyof SessionContext>(key: K, value: SessionContext[K]) => {
    const current = ctx[key];
    const next = current === value ? ("" as SessionContext[K]) : value;
    updateCtx({ [key]: next } as Partial<SessionContext>);
  };

  const isComplete = !!(
    ctx.occasion &&
    ctx.amount &&
    ctx.timeAvailable &&
    ctx.intent &&
    (ctx.amount !== "custom" || (customMl.trim() !== "" && Number(customMl) >= 50))
  );

  const handleNext = async () => {
    if (!isComplete) return;
    const finalCtx: SessionContext = {
      ...(ctx as SessionContext),
      customWaterMl: ctx.amount === "custom" ? Number(customMl) : undefined,
    };
    setIsRecommending(true);
    setRecommendError(null);
    setRecommendJobId(null);
    setStep("recommend");
    // Kick the ~1-min Opus call off as a SERVER-side background job and only
    // hold its id. The generation no longer dies when the iOS PWA is
    // backgrounded; the always-mounted RecommendJobWatcher polls the job and
    // fills in the recipe when it lands (or surfaces an error). We await only
    // the fast `/start` handshake here.
    try {
      let pastSessions: Awaited<ReturnType<typeof getRecentSessions>> = [];
      try {
        pastSessions = await getRecentSessions(100);
      } catch {}
      const res = await fetch("/api/recommend/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coffee: draft.coffee, context: finalCtx, pastSessions }),
      });
      if (!res.ok) throw new Error(`Recommendation failed (${res.status})`);
      const { jobId } = await res.json();
      if (!jobId) throw new Error("Recommendation failed to start");
      setRecommendJobId(jobId);
    } catch (err) {
      setRecommendError(err instanceof Error ? err.message : "Something went wrong");
      setIsRecommending(false);
    }
  };

  const selectedOccasion = OCCASIONS.find((o) => o.id === ctx.occasion);
  const selectedAmount = AMOUNTS.find((a) => a.id === ctx.amount);
  const selectedWater = WATERS.find((w) => w.id === ctx.waterSource);

  return (
    <LightFlowShell onNext={handleNext} nextDisabled={!isComplete} nextLabel="Get my recipe">
      <Hero
        eyebrow={`Context${draft.coffee?.name ? ` · ${draft.coffee.name}` : ""}`}
        question={heroQuestion}
      />

      {coffeeMemory && (coffeeMemory.writtenSummary || coffeeMemory.whatToExplore) && (
        <div className="mb-10 rounded-3xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 p-4 space-y-3">
          {coffeeMemory.writtenSummary && (
            <div>
              <p className="label-eyebrow mb-1.5">Brew memory</p>
              <p className="text-[14px] leading-relaxed text-light-foreground">
                {coffeeMemory.writtenSummary}
              </p>
            </div>
          )}
          {coffeeMemory.whatToExplore && (
            <div>
              <p className="label-eyebrow mb-1.5">What to explore</p>
              <p className="text-[14px] leading-relaxed text-light-foreground">
                {coffeeMemory.whatToExplore}
              </p>
            </div>
          )}
        </div>
      )}

      {tryingReminder && (
        <div className="mb-10 rounded-3xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 p-4">
          <p className="label-eyebrow mb-1.5">Coach reminder · trying</p>
          <p className="text-[14px] leading-relaxed text-light-foreground">
            {tryingReminder.observation}
          </p>
          <p className="text-[13px] leading-relaxed text-light-foreground/70 mt-1.5">
            {tryingReminder.suggestion}
          </p>
        </div>
      )}

      <div className="space-y-10">
        {/* OCCASION — Hybrid footnote (default text + per-card). */}
        <Section
          eyebrow="Occasion"
          footnote={
            <Footnote>
              {selectedOccasion ? selectedOccasion.footnote : "Sets the pace and ritual of this brew."}
            </Footnote>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            {OCCASIONS.map((o) => (
              <div key={o.id} className="h-[104px]">
                <Card
                  selected={ctx.occasion === o.id}
                  onClick={() => toggleField("occasion", o.id)}
                  ariaLabel={o.label}
                >
                  <CardTitle>{o.label}</CardTitle>
                  <CardIcon>
                    <o.Icon className="h-5 w-5" strokeWidth={1.5} />
                  </CardIcon>
                </Card>
              </div>
            ))}
          </div>
        </Section>

        {/* AMOUNT — Reactive footnote (all 4 cards). Custom swaps the
            Sub-Text slot for an inline number input when selected. */}
        <Section
          eyebrow="Amount"
          footnote={selectedAmount?.footnote ? <Footnote>{selectedAmount.footnote}</Footnote> : null}
        >
          <div className="grid grid-cols-2 gap-3">
            {AMOUNTS.map((a) => {
              const selected = ctx.amount === a.id;
              return (
                <div key={a.id} className="h-[104px]">
                  <Card
                    selected={selected}
                    onClick={() => toggleField("amount", a.id)}
                    ariaLabel={a.label}
                  >
                    <CardTitle>{a.label}</CardTitle>
                    {a.id === "custom" && selected ? (
                      <div
                        className="inline-flex items-baseline gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="number"
                          inputMode="numeric"
                          min={100}
                          max={1000}
                          value={customMl}
                          onChange={(e) => setCustomMl(e.target.value)}
                          placeholder="350"
                          autoFocus
                          className="w-14 bg-transparent text-center text-[15px] font-medium leading-tight text-light-foreground outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-[12px] text-light-muted-foreground">ml</span>
                      </div>
                    ) : (
                      <CardSubText>{a.sub}</CardSubText>
                    )}
                  </Card>
                </div>
              );
            })}
          </div>
        </Section>

        {/* TIME — 2 cards only (Lovable strict). No footnote. */}
        <Section eyebrow="Time">
          <div className="grid grid-cols-2 gap-3">
            {TIMES.map((t) => (
              <div key={t.id} className="h-[104px]">
                <Card
                  selected={ctx.timeAvailable === t.id}
                  onClick={() => toggleField("timeAvailable", t.id)}
                  ariaLabel={t.label}
                >
                  <CardTitle>{t.label}</CardTitle>
                  <CardSubText>{t.sub}</CardSubText>
                </Card>
              </div>
            ))}
          </div>
        </Section>

        {/* GOAL — 6 cards (Lovable parity). Educational footnote.
            Existing 5 IDs are kept; Aromatic / Floral added as the
            new id "aromatic" — recognised by the /api/recommend
            prompt (companion change in src/lib/claude/recommend.ts).
            ID rename to bright/sweet/bold deferred indefinitely. */}
        <Section
          eyebrow="Goal"
          footnote={
            <Footnote>The goal defines which method works best for THIS coffee.</Footnote>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            {GOALS.map((g) => (
              <div key={g.id} className="h-[104px]">
                <Card
                  selected={ctx.intent === g.id}
                  onClick={() => toggleField("intent", g.id)}
                  ariaLabel={g.label}
                >
                  <CardTitle>{g.label}</CardTitle>
                  <CardSubText>{g.sub}</CardSubText>
                </Card>
              </div>
            ))}
          </div>
        </Section>

        {/* GRINDER — Cards (Lovable), not Chips. No footnote. */}
        <Section eyebrow="Grinder">
          <div className="grid grid-cols-2 gap-3">
            {GRINDERS.map((g) => (
              <div key={g.id} className="h-[104px]">
                <Card
                  selected={grinderId === g.id}
                  onClick={() => {
                    const next = grinderId === g.id ? null : g.id;
                    setGrinderId(next);
                    updateCtx({ grinder: next ?? "" });
                  }}
                  ariaLabel={g.label}
                >
                  <CardTitle>{g.label}</CardTitle>
                  <CardSubText>{g.sub}</CardSubText>
                </Card>
              </div>
            ))}
          </div>
        </Section>

        {/* BREWING APPROACH — 2 cards + expanding method list (restored
            after Markus' /brew/preview feedback: "I'll choose" had
            nothing to actually choose). When "ill-choose" is active,
            a vertical method list expands below. Selecting "Claude
            picks" (or toggling "I'll choose" off) clears any manual
            preferredMethod so the recipe prompt doesn't carry stale
            state. */}
        <Section
          eyebrow="Brewing approach"
          footnote={
            approach === "ill-choose" ? (
              ctx.preferredMethod ? (
                <Footnote>
                  {ctx.preferredMethod} locked in — Claude will dial in the full recipe for it.
                </Footnote>
              ) : (
                <Footnote>Pick a method below to lock it in.</Footnote>
              )
            ) : approach === "claude-picks" ? (
              <Footnote>{APPROACHES[0].footnote}</Footnote>
            ) : null
          }
        >
          <div className="grid grid-cols-2 gap-3">
            {APPROACHES.map((a) => (
              <div key={a.id} className="h-[104px]">
                <Card
                  selected={approach === a.id}
                  onClick={() => {
                    const next = approach === a.id ? null : a.id;
                    setApproach(next);
                    if (next !== "ill-choose") {
                      updateCtx({ preferredMethod: "" });
                    }
                  }}
                  ariaLabel={a.label}
                >
                  <CardTitle>{a.label}</CardTitle>
                  <CardSubText>{a.sub}</CardSubText>
                </Card>
              </div>
            ))}
          </div>

          {/* Method list — expands when "I'll choose" is active */}
          <div
            className={`overflow-hidden transition-all duration-300 ${
              approach === "ill-choose" ? "max-h-[1100px] opacity-100 mt-3" : "max-h-0 opacity-0"
            }`}
          >
            <div className="flex flex-col gap-2">
              {METHODS.map((m) => {
                const selected = ctx.preferredMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      const newMethod = ctx.preferredMethod === m.id ? "" : m.id;
                      updateCtx({ preferredMethod: newMethod });
                    }}
                    aria-pressed={selected}
                    className={`flex items-center justify-between rounded-3xl px-4 py-3 backdrop-blur-light-card backdrop-saturate-150 transition-all ${
                      selected
                        ? "bg-light-card-selected scale-[0.99] shadow-light-card-pressed"
                        : "bg-light-card-default"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <BrewMethodIcon method={m.id} className="w-8 h-8 shrink-0 text-light-foreground" />
                      <span className="text-[15px] font-medium text-light-foreground">{m.label}</span>
                    </div>
                    <span className="text-[12px] text-light-muted-foreground">{m.sub}</span>
                  </button>
                );
              })}
            </div>

          </div>
        </Section>

        {/* WATER — 2 cards only (Lovable strict). Diluted dropped. */}
        <Section
          eyebrow="Water"
          footnote={selectedWater?.footnote ? <Footnote>{selectedWater.footnote}</Footnote> : null}
        >
          <div className="grid grid-cols-2 gap-3">
            {WATERS.map((w) => (
              <div key={w.id} className="h-[104px]">
                <Card
                  selected={ctx.waterSource === w.id}
                  onClick={() => toggleField("waterSource", w.id)}
                  ariaLabel={w.label}
                >
                  <CardTitle>{w.label}</CardTitle>
                  <CardSubText>{w.sub}</CardSubText>
                </Card>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </LightFlowShell>
  );
}
