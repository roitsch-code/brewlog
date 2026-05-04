"use client";
import { useState, useEffect } from "react";
import { useFlowStore } from "@/store/flowStore";
import FlowShell from "./FlowShell";
import Chip from "@/components/ui/Chip";
import type { Session, SessionContext } from "@/lib/types/session";

async function getRecentSessions(limit: number): Promise<Session[]> {
  const res = await fetch(`/api/sessions?limit=${limit}`);
  if (!res.ok) return [];
  return (await res.json()) as Session[];
}
import { Brain, FlaskConical, Moon, Users, Snowflake } from "lucide-react";
import BrewMethodIcon from "@/components/ui/BrewMethodIcon";

// Sunrise without the upward arrow — chevron removed; middle beam shortened to match side beams (~2 units each)
// viewBox cropped to y:6–26 so the icon fills its size the same as other lucide icons
function SunriseIcon({ size = 24, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="2 6 20 20"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
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
  { id: "morning-ritual", label: "Morning Ritual",  Icon: SunriseIcon },
  { id: "focus",          label: "Deep Focus",       Icon: Brain },
  { id: "social",         label: "Social",           Icon: Users },
  { id: "after-dinner",   label: "After Dinner",     Icon: Moon },
  { id: "experiment",     label: "Experiment",       Icon: FlaskConical },
  { id: "summer-time",    label: "Summer Time",      Icon: Snowflake },
];

const AMOUNTS = [
  { id: "small",    label: "Small",       sub: "350 ml" },
  { id: "big",      label: "Big",         sub: "520 ml" },
  { id: "custom",   label: "Custom",      sub: "enter ml" },
  { id: "surprise", label: "Surprise me", sub: "Claude picks" },
];

const TIMES = [
  { id: "quick",     label: "Quick",     sub: "~2 min" },
  { id: "normal",    label: "Normal",    sub: "~5 min" },
  { id: "unhurried", label: "Unhurried", sub: "7 min+" },
];

const GOALS = [
  { id: "balanced",          label: "Balanced",         sub: "no taste-axis bias" },
  { id: "high-clarity",      label: "Bright / Clarity", sub: "Zone-1 emphasis" },
  { id: "sweetness-forward", label: "Sweet",            sub: "Zone-2 emphasis" },
  { id: "body-forward",      label: "Bold / Body",      sub: "mouthfeel emphasis" },
  { id: "explore",           label: "Explore",          sub: "wildcard / championship recipes" },
];

const DEFAULT_GRINDERS = ["Niche Zero", "Comandante C40"];

const METHODS = [
  { id: "V60",               label: "V60",                  sub: "Hario cone" },
  { id: "Orea Fast",         label: "Orea Fast",            sub: "fast drip, max ~500 ml" },
  { id: "Orea Apex",         label: "Orea Apex",            sub: "clarity & brightness" },
  { id: "Orea Classic",      label: "Orea Classic",         sub: "sweetness focus" },
  { id: "Orea Open",         label: "Orea Open",            sub: "open bed, max flow, max ~500 ml" },
  { id: "Kalita Wave",       label: "Kalita Wave",          sub: "even bed, max ~500 ml" },
  { id: "Origami (cone)",    label: "Origami (cone)",       sub: "ceramic, V60-like clarity, max ~500 ml" },
  { id: "Origami (wave)",    label: "Origami (wave)",       sub: "ceramic, Kalita-like sweetness, max ~500 ml" },
  { id: "Chemex",            label: "Chemex",               sub: "clean & bright, max ~600 ml" },
  { id: "AeroPress",         label: "AeroPress",            sub: "max 230 ml · or concentrate" },
  { id: "Clever Dripper",    label: "Clever Dripper",       sub: "immersion, max 400 ml" },
  { id: "Moccamaster",       label: "Moccamaster",          sub: "batch brewer, ≥ 500 ml" },
];

// Brewers that can have the Hario Drip Assist disc placed on top for a steadier pour.
// Immersion / pressure / batch brewers are excluded — the Assist controls pour rate and
// has no effect when there's no pouring phase.
const DRIP_ASSIST_COMPATIBLE = new Set<string>([
  "V60", "Orea Fast", "Orea Apex", "Orea Classic", "Orea Open", "Kalita Wave", "Chemex",
]);

export default function StepContext() {
  const { draft, setContext, setStep, setIsRecommending, setRecommendError } = useFlowStore();
  const ctx = draft.context || {} as Partial<SessionContext>;
  const [customMl, setCustomMl] = useState<string>("");
  const [grinders, setGrinders] = useState<string[]>(DEFAULT_GRINDERS);
  // null = nothing selected yet (like all other sections); "ai" = Claude picks; "manual" = user picks
  const [brewMode, setBrewMode] = useState<"ai" | "manual" | null>(null);

  useEffect(() => {
    fetch("/api/preferences", { cache: "no-store" })
      .then(r => r.json())
      .then((prefs: { grinder?: string } | null) => {
        if (prefs?.grinder) {
          const known = new Set([prefs.grinder, ...DEFAULT_GRINDERS]);
          setGrinders(Array.from(known));
        }
      })
      .catch(() => {});
  }, []);

  const update = (key: keyof SessionContext, value: string | number | boolean) => {
    setContext({ ...ctx, [key]: value } as SessionContext);
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
      ...ctx as SessionContext,
      customWaterMl: ctx.amount === "custom" ? Number(customMl) : undefined,
    };
    setIsRecommending(true);
    setRecommendError(null);
    setStep("recommend");
    try {
      let pastSessions: Awaited<ReturnType<typeof getRecentSessions>> = [];
      try { pastSessions = await getRecentSessions(100); } catch {}
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

  return (
    <FlowShell onNext={handleNext} nextDisabled={!isComplete} nextLabel="Get My Recipe">
      <div className="px-5 py-4 flex flex-col gap-8">
        <div>
          <p className="text-brew-muted text-xs tracking-widest uppercase mb-2">Context</p>
          <h1 className="font-display text-2xl text-white">What&apos;s the vibe?</h1>
        </div>

        <Section title="Occasion">
          <div className="grid grid-cols-2 gap-2">
            {OCCASIONS.map(o => {
              const selected = ctx.occasion === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => update("occasion", o.id)}
                  className="flex flex-col items-center gap-2 rounded-2xl border py-4 px-3 transition-all active:scale-[0.98]"
                  style={{
                    background: selected ? "#2A241C" : "var(--card)",
                    borderColor: selected ? "var(--primary)" : "var(--border)",
                  }}
                >
                  <o.Icon size={22} style={{ color: selected ? "var(--primary)" : "var(--muted-foreground)" }} />
                  <span className="text-sm font-medium text-center" style={{ color: selected ? "var(--primary)" : "var(--foreground)" }}>
                    {o.label}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="How much?">
          <div className="grid grid-cols-2 gap-3">
            {AMOUNTS.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => update("amount", a.id)}
                className={`p-4 rounded-2xl border text-left transition-all active:scale-95 ${
                  ctx.amount === a.id ? "border-brew-accent bg-brew-accent/10" : "border-brew-border bg-brew-surface"
                }`}
              >
                <p className={`font-semibold text-base leading-tight ${ctx.amount === a.id ? "text-brew-accent" : "text-white"}`}>
                  {a.label}
                </p>
                <p className="text-brew-muted text-xs mt-1 leading-tight">{a.sub}</p>
              </button>
            ))}
          </div>

          {ctx.amount === "custom" && (
            <div className="flex items-center gap-3 mt-3">
              <span className="text-brew-muted text-sm shrink-0">Target water:</span>
              <div className="relative flex-1">
                <input
                  type="number"
                  inputMode="numeric"
                  min="50"
                  max="900"
                  value={customMl}
                  onChange={e => setCustomMl(e.target.value)}
                  placeholder="e.g. 220"
                  autoFocus
                  className="w-full bg-brew-surface border border-brew-border rounded-xl px-4 py-3 text-white font-mono-num text-base placeholder:text-brew-muted focus:outline-none focus:border-white/40 pr-10"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-brew-muted text-sm">ml</span>
              </div>
            </div>
          )}

          {ctx.amount === "surprise" && (
            <p className="text-brew-muted text-xs mt-2 px-1 italic leading-relaxed">
              Claude picks everything freely — could be a 120 ml AeroPress concentrate, a 4:6 experiment, or something you haven&apos;t tried with this coffee yet.
            </p>
          )}
        </Section>

        <Section title="Time available?">
          <div className="flex gap-3">
            {TIMES.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => update("timeAvailable", t.id)}
                className={`flex-1 p-4 rounded-2xl border text-center transition-all active:scale-95 ${
                  ctx.timeAvailable === t.id ? "border-brew-accent bg-brew-accent/10" : "border-brew-border bg-brew-surface"
                }`}
              >
                <p className={`font-medium text-sm ${ctx.timeAvailable === t.id ? "text-brew-accent" : "text-white"}`}>
                  {t.label}
                </p>
                <p className="text-brew-muted text-xs mt-0.5">{t.sub}</p>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Goal">
          <div className="grid grid-cols-2 gap-2">
            {GOALS.map(g => {
              const selected = ctx.intent === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => update("intent", g.id)}
                  className="rounded-2xl border py-3 px-3 text-left transition-all active:scale-[0.98]"
                  style={{
                    background: selected ? "#2A241C" : "var(--card)",
                    borderColor: selected ? "var(--primary)" : "var(--border)",
                  }}
                >
                  <p className="text-sm font-semibold leading-tight" style={{ color: selected ? "var(--primary)" : "var(--foreground)" }}>
                    {g.label}
                  </p>
                  <p className="text-xs mt-0.5 leading-tight" style={{ color: "var(--muted-foreground)" }}>
                    {g.sub}
                  </p>
                </button>
              );
            })}
          </div>
          <p className="text-brew-muted text-xs px-1">
            Your taste direction for this brew. Method selection is driven by science — every brewer in your equipment is equally eligible; the goal sharpens which is best for THIS coffee.
          </p>
        </Section>

        <Section title="Grinder">
          <div className="flex flex-wrap gap-2">
            {grinders.map(g => (
              <Chip
                key={g}
                label={g}
                selected={ctx.grinder === g}
                onClick={() => update("grinder", ctx.grinder === g ? "" : g)}
                size="sm"
              />
            ))}
          </div>
          {ctx.grinder && (
            <p className="text-brew-muted text-xs mt-1.5 px-1">
              {ctx.grinder.toLowerCase().includes("niche") ? "Recipe will use Niche° values" : "Recipe will use click values"}
            </p>
          )}
        </Section>

        {/* Brewing approach — Claude picks freely or user locks in a method */}
        <Section title="Brewing approach">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setBrewMode("ai");
                setContext({ ...ctx, preferredMethod: "", dripAssist: false } as SessionContext);
              }}
              className={`flex-1 p-4 rounded-2xl border text-left transition-all active:scale-95 ${
                brewMode === "ai" ? "border-brew-accent bg-brew-accent/10" : "border-brew-border bg-brew-surface"
              }`}
            >
              <p className={`font-semibold text-sm leading-tight ${brewMode === "ai" ? "text-brew-accent" : "text-brew-muted"}`}>
                Claude picks
              </p>
              <p className="text-brew-muted text-xs mt-1 leading-tight">Best method for this coffee</p>
            </button>
            <button
              type="button"
              onClick={() => setBrewMode("manual")}
              className={`flex-1 p-4 rounded-2xl border text-left transition-all active:scale-95 ${
                brewMode === "manual" ? "border-brew-accent bg-brew-accent/10" : "border-brew-border bg-brew-surface"
              }`}
            >
              <p className={`font-semibold text-sm leading-tight ${brewMode === "manual" ? "text-brew-accent" : "text-brew-muted"}`}>
                I&apos;ll choose
              </p>
              <p className="text-brew-muted text-xs mt-1 leading-tight">Claude dials in the recipe</p>
            </button>
          </div>

          {/* Method list — expands when user chooses manual mode */}
          <div
            className={`overflow-hidden transition-all duration-300 ${
              brewMode === "manual" ? "max-h-[900px] opacity-100 mt-3" : "max-h-0 opacity-0"
            }`}
          >
            <div className="flex flex-col gap-1.5">
              {METHODS.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    const newMethod = ctx.preferredMethod === m.id ? "" : m.id;
                    setContext({
                      ...ctx,
                      preferredMethod: newMethod,
                      // Clear dripAssist if the new method can't use it
                      dripAssist: DRIP_ASSIST_COMPATIBLE.has(newMethod) ? ctx.dripAssist : false,
                    } as SessionContext);
                  }}
                  className={`flex items-center justify-between px-4 py-3 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                    ctx.preferredMethod === m.id
                      ? "border-brew-accent bg-brew-accent/10"
                      : "border-brew-border bg-brew-surface"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <BrewMethodIcon method={m.id} className="w-8 h-8 shrink-0" />
                    <span className={`text-sm font-medium ${ctx.preferredMethod === m.id ? "text-brew-accent" : "text-white"}`}>
                      {m.label}
                    </span>
                  </div>
                  <span className="text-brew-muted text-xs">{m.sub}</span>
                </button>
              ))}
            </div>
            {ctx.preferredMethod && DRIP_ASSIST_COMPATIBLE.has(ctx.preferredMethod) && (
              <button
                type="button"
                onClick={() => update("dripAssist", !ctx.dripAssist)}
                className={`flex items-center justify-between w-full mt-2 px-4 py-3 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                  ctx.dripAssist ? "border-brew-accent bg-brew-accent/10" : "border-brew-border bg-brew-surface"
                }`}
              >
                <div>
                  <p className={`text-sm font-medium ${ctx.dripAssist ? "text-brew-accent" : "text-white"}`}>
                    With Drip Assist
                  </p>
                  <p className="text-brew-muted text-xs mt-0.5">Hario disc — steadier pour for any pour-over</p>
                </div>
                <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                  ctx.dripAssist ? "bg-brew-accent border-brew-accent" : "border-white/30"
                }`}>
                  {ctx.dripAssist && (
                    <svg className="w-3.5 h-3.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>
            )}
            {ctx.preferredMethod ? (
              <p className="text-brew-muted text-xs px-1 mt-2">
                {ctx.preferredMethod}{ctx.dripAssist && ctx.preferredMethod !== "V60" && DRIP_ASSIST_COMPATIBLE.has(ctx.preferredMethod) ? " + Drip Assist" : ""} locked in — Claude will dial in the full recipe for it.
              </p>
            ) : (
              <p className="text-brew-muted text-xs px-1 mt-2">Tap a method to lock it in.</p>
            )}
          </div>

          {(brewMode === "ai" || brewMode === null) && (
            <p className="text-brew-muted text-xs px-1">
              {brewMode === "ai"
                ? "Claude picks the best method for this coffee \u0026 context — and explains why."
                : "Pick a method above, or let Claude decide."}
            </p>
          )}
        </Section>

        <Section title="Water">
          <div className="flex gap-2">
            {[
              { id: "tap",          label: "Tap only",      sub: "~300 ppm" },
              { id: "diluted",      label: "Diluted",       sub: "~150 ppm" },
              { id: "championship", label: "Championship",  sub: "50 ppm" },
            ].map(w => (
              <button
                key={w.id}
                type="button"
                onClick={() => update("waterSource", w.id)}
                className="flex-1 p-3 rounded-2xl border text-left transition-all active:scale-95"
                style={{
                  background: ctx.waterSource === w.id ? "#2A241C" : "var(--card)",
                  borderColor: ctx.waterSource === w.id ? "var(--primary)" : "var(--border)",
                }}
              >
                <p className="font-semibold text-sm" style={{ color: ctx.waterSource === w.id ? "var(--primary)" : "var(--foreground)" }}>{w.label}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{w.sub}</p>
              </button>
            ))}
          </div>
          {ctx.waterSource === "diluted" && (
            <p className="text-brew-muted text-xs mt-1.5 px-1">Equal parts tap and distilled water. SCA optimal range.</p>
          )}
          {ctx.waterSource === "tap" && (
            <p className="text-brew-muted text-xs mt-1.5 px-1">Above SCA ceiling. Recipe will adjust accordingly.</p>
          )}
        </Section>

      </div>
    </FlowShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-brew-muted text-xs uppercase tracking-widest">{title}</h3>
      {children}
    </div>
  );
}
