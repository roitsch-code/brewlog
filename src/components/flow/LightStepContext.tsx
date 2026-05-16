"use client";

import { useState, useEffect } from "react";
import { useFlowStore } from "@/store/flowStore";
import LightFlowShell from "@/components/ui/light/LightFlowShell";
import Hero from "@/components/ui/light/Hero";
import Section from "@/components/ui/light/Section";
import Footnote from "@/components/ui/light/Footnote";
import Card, { CardTitle, CardSubText, CardIcon } from "@/components/ui/light/Card";
import Chip from "@/components/ui/light/Chip";
import BrewMethodIcon from "@/components/ui/BrewMethodIcon";
import { Brain, FlaskConical, Moon, Users, Snowflake } from "lucide-react";
import type { Session, SessionContext } from "@/lib/types/session";

/**
 * Light System v1.0 fork of /components/flow/StepContext.tsx.
 *
 * Same flow logic — reads/writes the same flowStore, calls the same
 * /api/recommend, hands off via the same `setStep("recommend")`. Only
 * the visual layer changes: Dark surfaces (`bg-brew-surface`,
 * `text-white`) become Light primitives (Card, Section, Footnote,
 * Hero, CTA).
 *
 * Mounted ONLY by /app/(light)/brew/preview/page.tsx during migration.
 * The Dark StepContext at /components/flow/StepContext.tsx is the live
 * production component until the Light cut-over (Phase 5 of the plan).
 *
 * Spec deviations flagged for review:
 *   - Section 3 (Time, 3 options) and Section 7 (Water, 3 options)
 *     render as 3-column equal-width rows. Spec §5.2 mandates 2-col
 *     grids with even card counts; the cleaner fix would be either
 *     splitting or adding a wildcard, but both alter the data sent to
 *     /api/recommend. Deferred — flagged in PR description.
 *   - Section 4 (Goal, 5 options) renders 2-col with an orphan on
 *     row 3. Same constraint as above.
 *   - Section 6 (Brewing approach) keeps its expanding method list as
 *     a vertical list of full-width method rows, not card-grid. The
 *     section is fundamentally hierarchical (2-card mode toggle that
 *     reveals a 12-option list) and doesn't fit the §5 grid pattern.
 */

async function getRecentSessions(limit: number): Promise<Session[]> {
  const res = await fetch(`/api/sessions?limit=${limit}`);
  if (!res.ok) return [];
  return (await res.json()) as Session[];
}

// Sunrise icon without the upward arrow — matches the Dark version's
// SunriseIcon byte-for-byte. The chevron read as a navigation cue at
// card size, so the icon's arrow is stripped (Spec §9.2 custom-SVG
// pattern, Lucide conventions).
function SunriseIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
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
  { id: "morning-ritual", label: "Morning Ritual", Icon: SunriseIcon, footnote: "A slower, deliberate pour that anchors the start of a day." },
  { id: "focus", label: "Deep Focus", Icon: Brain, footnote: "A clean, alert cup for sustained concentration." },
  { id: "social", label: "Social", Icon: Users, footnote: "Brewing for a guest or two — bigger batch, conversational pace." },
  { id: "after-dinner", label: "After Dinner", Icon: Moon, footnote: "A digestive cup — lower volume, gentle finish." },
  { id: "experiment", label: "Experiment", Icon: FlaskConical, footnote: "Push parameters — championship recipes, single-variable changes." },
  { id: "summer-time", label: "Summer Time", Icon: Snowflake, footnote: "Iced or flash-chilled — bright, aromatic, cold-friendly." },
];

const AMOUNTS = [
  { id: "small", label: "Small", sub: "350 ml", footnote: "A single cup — focused tasting, faster brew." },
  { id: "big", label: "Big", sub: "520 ml", footnote: "Bigger batch for the morning — long, attentive pour." },
  { id: "custom", label: "Custom", sub: "enter ml", footnote: null },
  { id: "surprise", label: "Surprise me", sub: "Claude picks", footnote: "Claude picks everything freely — a 120 ml AeroPress concentrate, a 4:6 experiment, or something untried." },
];

const TIMES = [
  { id: "quick", label: "Quick", sub: "~2 min" },
  { id: "normal", label: "Normal", sub: "~5 min" },
  { id: "unhurried", label: "Unhurried", sub: "7 min+" },
];

const GOALS = [
  { id: "balanced", label: "Balanced", sub: "no taste-axis bias" },
  { id: "high-clarity", label: "Bright / Clarity", sub: "Zone-1 emphasis" },
  { id: "sweetness-forward", label: "Sweet", sub: "Zone-2 emphasis" },
  { id: "body-forward", label: "Bold / Body", sub: "mouthfeel emphasis" },
  { id: "explore", label: "Explore", sub: "wildcard / championship" },
];

const DEFAULT_GRINDERS = ["Niche Zero", "Comandante C40"];

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
];

const DRIP_ASSIST_COMPATIBLE = new Set<string>([
  "V60", "Orea Fast", "Orea Apex", "Orea Classic", "Orea Open", "Kalita Wave", "Chemex",
]);

interface CoffeeMemory {
  writtenSummary?: string;
  whatToExplore?: string;
}

export default function LightStepContext() {
  const { draft, setContext, setStep, setIsRecommending, setRecommendError } = useFlowStore();
  const ctx = (draft.context || {}) as Partial<SessionContext>;
  const [customMl, setCustomMl] = useState<string>("");
  const [grinders, setGrinders] = useState<string[]>(DEFAULT_GRINDERS);
  const [brewMode, setBrewMode] = useState<"ai" | "manual" | null>(null);
  const [coffeeMemory, setCoffeeMemory] = useState<CoffeeMemory | null>(null);

  useEffect(() => {
    fetch("/api/preferences", { cache: "no-store" })
      .then((r) => r.json())
      .then((prefs: { grinder?: string } | null) => {
        if (prefs?.grinder) {
          const known = new Set([prefs.grinder, ...DEFAULT_GRINDERS]);
          setGrinders(Array.from(known));
        }
      })
      .catch(() => {});
  }, []);

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
    setStep("recommend");
    try {
      let pastSessions: Awaited<ReturnType<typeof getRecentSessions>> = [];
      try {
        pastSessions = await getRecentSessions(100);
      } catch {}
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coffee: draft.coffee, context: finalCtx, pastSessions }),
      });
      if (!res.ok) throw new Error(`Recommendation failed (${res.status})`);
      const recommendation = await res.json();
      if (!recommendation.primaryMethod) throw new Error("No recommendation returned");
      useFlowStore.getState().setRecommendation(recommendation);
    } catch (err) {
      setRecommendError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsRecommending(false);
    }
  };

  const selectedOccasion = OCCASIONS.find((o) => o.id === ctx.occasion);
  const selectedAmount = AMOUNTS.find((a) => a.id === ctx.amount);

  return (
    <LightFlowShell onNext={handleNext} nextDisabled={!isComplete} nextLabel="Get my recipe">
      <Hero
        eyebrow={`Context${draft.coffee?.name ? ` · ${draft.coffee.name}` : ""}`}
        question={<>What&rsquo;s the vibe?</>}
      />

      {/* Brew memory — only when this coffee has prior history. */}
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

      <div className="space-y-10">
        {/* Occasion — Hybrid Footnote (default + per-card). */}
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

        {/* Amount — Reactive Footnote + Form-C input when "custom" selected. */}
        <Section
          eyebrow="How much?"
          footnote={
            selectedAmount?.footnote ? <Footnote>{selectedAmount.footnote}</Footnote> : null
          }
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
                        className="flex items-baseline gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="number"
                          inputMode="numeric"
                          min={50}
                          max={900}
                          value={customMl}
                          onChange={(e) => setCustomMl(e.target.value)}
                          placeholder="220"
                          autoFocus
                          className="w-14 bg-transparent text-center text-[15px] font-medium text-light-foreground outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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

        {/* Time — 3 options, equal-width row. */}
        <Section eyebrow="Time available?">
          <div className="grid grid-cols-3 gap-3">
            {TIMES.map((t) => (
              <div key={t.id} className="h-[88px]">
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

        {/* Goal — 5 options in 2-col, orphan on row 3. Educational Footnote. */}
        <Section
          eyebrow="Goal"
          footnote={
            <Footnote>
              Your taste direction for this brew. Method selection is driven by science — every brewer in your equipment is eligible; the goal sharpens which is best for THIS coffee.
            </Footnote>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            {GOALS.map((g) => (
              <div key={g.id} className="h-[88px]">
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

        {/* Grinder — Chips (compact, not card-grid). */}
        <Section
          eyebrow="Grinder"
          footnote={
            ctx.grinder ? (
              <Footnote>
                {ctx.grinder.toLowerCase().includes("niche")
                  ? "Recipe will use Niche° values."
                  : "Recipe will use click values."}
              </Footnote>
            ) : null
          }
        >
          <div className="flex flex-wrap gap-2">
            {grinders.map((g) => (
              <Chip
                key={g}
                selected={ctx.grinder === g}
                onClick={() => updateCtx({ grinder: ctx.grinder === g ? "" : g })}
              >
                {g}
              </Chip>
            ))}
          </div>
        </Section>

        {/* Brewing approach — 2-card mode toggle + expanding method list. */}
        <Section
          eyebrow="Brewing approach"
          footnote={
            brewMode === "manual" && ctx.preferredMethod ? (
              <Footnote>
                {ctx.preferredMethod}
                {ctx.dripAssist &&
                ctx.preferredMethod !== "V60" &&
                DRIP_ASSIST_COMPATIBLE.has(ctx.preferredMethod)
                  ? " + Drip Assist"
                  : ""}{" "}
                locked in — Claude will dial in the full recipe for it.
              </Footnote>
            ) : brewMode === "manual" ? (
              <Footnote>Tap a method to lock it in.</Footnote>
            ) : brewMode === "ai" ? (
              <Footnote>Claude picks the best method for this coffee &amp; context — and explains why.</Footnote>
            ) : (
              <Footnote>Pick a method below, or let Claude decide.</Footnote>
            )
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="h-[88px]">
              <Card
                selected={brewMode === "ai"}
                onClick={() => {
                  setBrewMode("ai");
                  setContext({ ...ctx, preferredMethod: "", dripAssist: false } as SessionContext);
                }}
                ariaLabel="Claude picks"
              >
                <CardTitle>Claude picks</CardTitle>
                <CardSubText>Best method for this coffee</CardSubText>
              </Card>
            </div>
            <div className="h-[88px]">
              <Card
                selected={brewMode === "manual"}
                onClick={() => setBrewMode("manual")}
                ariaLabel="I'll choose"
              >
                <CardTitle>I&rsquo;ll choose</CardTitle>
                <CardSubText>Claude dials in the recipe</CardSubText>
              </Card>
            </div>
          </div>

          {/* Method list — expands when manual mode is active. */}
          <div
            className={`overflow-hidden transition-all duration-300 ${
              brewMode === "manual" ? "max-h-[1100px] opacity-100 mt-3" : "max-h-0 opacity-0"
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
                      setContext({
                        ...ctx,
                        preferredMethod: newMethod,
                        dripAssist: DRIP_ASSIST_COMPATIBLE.has(newMethod) ? ctx.dripAssist : false,
                      } as SessionContext);
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

            {ctx.preferredMethod && DRIP_ASSIST_COMPATIBLE.has(ctx.preferredMethod) && (
              <button
                type="button"
                onClick={() => updateCtx({ dripAssist: !ctx.dripAssist })}
                aria-pressed={!!ctx.dripAssist}
                className={`flex items-center justify-between w-full mt-2 rounded-3xl px-4 py-3 backdrop-blur-light-card backdrop-saturate-150 transition-all text-left ${
                  ctx.dripAssist
                    ? "bg-light-card-selected scale-[0.99] shadow-light-card-pressed"
                    : "bg-light-card-default"
                }`}
              >
                <div>
                  <p className="text-[15px] font-medium text-light-foreground">With Drip Assist</p>
                  <p className="text-[12px] text-light-muted-foreground mt-0.5">
                    Hario disc — steadier pour for any pour-over
                  </p>
                </div>
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                    ctx.dripAssist ? "bg-light-foreground" : "border border-light-foreground/30"
                  }`}
                >
                  {ctx.dripAssist && (
                    <svg
                      className="w-3.5 h-3.5 text-[hsl(36_55%_96%)]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
              </button>
            )}
          </div>
        </Section>

        {/* Water — 3 options, equal-width row. Reactive Footnote. */}
        <Section
          eyebrow="Water"
          footnote={
            ctx.waterSource === "diluted" ? (
              <Footnote>Equal parts tap and distilled water. SCA optimal range.</Footnote>
            ) : ctx.waterSource === "tap" ? (
              <Footnote>Above SCA ceiling. Recipe will adjust accordingly.</Footnote>
            ) : ctx.waterSource === "championship" ? (
              <Footnote>40–80 ppm TDS — championship water. Sharpest aromatic expression.</Footnote>
            ) : null
          }
        >
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: "tap", label: "Tap only", sub: "~300 ppm" },
              { id: "diluted", label: "Diluted", sub: "~150 ppm" },
              { id: "championship", label: "Championship", sub: "50 ppm" },
            ].map((w) => (
              <div key={w.id} className="h-[88px]">
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
