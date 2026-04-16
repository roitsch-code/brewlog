"use client";
import { useState, useEffect } from "react";
import { useFlowStore } from "@/store/flowStore";
import FlowShell from "./FlowShell";
import Chip from "@/components/ui/Chip";
import { getRecentSessions } from "@/lib/firebase/firestore";
import type { SessionContext } from "@/lib/types/session";
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

const MOODS = [
  { id: "strong",   label: "Strong & Bold" },
  { id: "balanced", label: "Balanced" },
  { id: "light",    label: "Light & Clean" },
  { id: "sweet",    label: "Sweet" },
  { id: "curious",  label: "Surprise me" },
];

const INTENTS = [
  { id: "safest",           label: "Safest bet" },
  { id: "explore",          label: "Explore" },
  { id: "high-clarity",     label: "High clarity" },
  { id: "sweetness-forward", label: "Sweetness" },
  { id: "educational",      label: "Educational" },
  { id: "repeat-best",      label: "Repeat best" },
  { id: "compare",          label: "Compare methods" },
  { id: "troubleshoot",     label: "Troubleshoot" },
];

const DEFAULT_GRINDERS = ["Niche Zero", "Comandante C40"];

const METHODS = [
  { id: "V60 + Drip Assist", label: "V60 + Drip Assist",   sub: "daily driver, max ~600 ml" },
  { id: "V60",               label: "V60",                  sub: "classic, no assist" },
  { id: "Orea Fast",         label: "Orea Fast",            sub: "fast drip, max ~500 ml" },
  { id: "Orea Apex",         label: "Orea Apex",            sub: "clarity & brightness" },
  { id: "Orea Classic",      label: "Orea Classic",         sub: "sweetness focus" },
  { id: "Orea Open",         label: "Orea Open",            sub: "open bed, max flow, max ~500 ml" },
  { id: "Kalita Wave",       label: "Kalita Wave",          sub: "even bed, max ~500 ml" },
  { id: "Chemex",            label: "Chemex",               sub: "clean & bright, max ~600 ml" },
  { id: "AeroPress",         label: "AeroPress",            sub: "max 230 ml · or concentrate" },
  { id: "Clever Dripper",    label: "Clever Dripper",       sub: "immersion, max 400 ml" },
  { id: "Moccamaster",       label: "Moccamaster",          sub: "batch brewer, ≥ 500 ml" },
];

export default function StepContext() {
  const { draft, setContext, setStep, setIsRecommending, setRecommendError } = useFlowStore();
  const ctx = draft.context || {} as Partial<SessionContext>;
  const [customMl, setCustomMl] = useState<string>("");
  const [grinders, setGrinders] = useState<string[]>(DEFAULT_GRINDERS);
  // "ai" = Claude picks freely; "manual" = user selects method, Claude dials in the recipe
  const [brewMode, setBrewMode] = useState<"ai" | "manual">("ai");

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

  const update = (key: keyof SessionContext, value: string | number) => {
    setContext({ ...ctx, [key]: value } as SessionContext);
  };

  const isComplete = !!(
    ctx.occasion &&
    ctx.amount &&
    ctx.timeAvailable &&
    ctx.moodPreference &&
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
      try { pastSessions = await getRecentSessions(10); } catch {}
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

        <Section title="Mood">
          <div className="flex flex-wrap gap-2">
            {MOODS.map(m => (
              <Chip key={m.id} label={m.label} selected={ctx.moodPreference === m.id} onClick={() => update("moodPreference", m.id)} />
            ))}
          </div>
        </Section>

        <Section title="Goal — optional">
          <div className="flex flex-wrap gap-2">
            {INTENTS.map(i => (
              <Chip
                key={i.id}
                label={i.label}
                selected={ctx.intent === i.id}
                onClick={() => update("intent", ctx.intent === i.id ? "" : i.id)}
                size="sm"
              />
            ))}
          </div>
          <p className="text-brew-muted text-xs px-1">
            {ctx.intent
              ? `Goal: ${INTENTS.find(i => i.id === ctx.intent)?.label ?? ctx.intent} — Claude will tailor the recipe portfolio to this.`
              : "Skip to let Claude infer the goal from occasion and mood."}
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
                update("preferredMethod", "");
              }}
              className={`flex-1 p-4 rounded-2xl border text-left transition-all active:scale-95 ${
                brewMode === "ai" ? "border-brew-accent bg-brew-accent/10" : "border-brew-border bg-brew-surface"
              }`}
            >
              <p className={`font-semibold text-sm leading-tight ${brewMode === "ai" ? "text-brew-accent" : "text-white"}`}>
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
              <p className={`font-semibold text-sm leading-tight ${brewMode === "manual" ? "text-brew-accent" : "text-white"}`}>
                I&apos;ll choose
              </p>
              <p className="text-brew-muted text-xs mt-1 leading-tight">Claude dials in the recipe</p>
            </button>
          </div>

          {/* Method list — expands when user chooses manual mode */}
          <div
            className={`overflow-hidden transition-all duration-300 ${
              brewMode === "manual" ? "max-h-[600px] opacity-100 mt-3" : "max-h-0 opacity-0"
            }`}
          >
            <div className="flex flex-col gap-1.5">
              {METHODS.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => update("preferredMethod", ctx.preferredMethod === m.id ? "" : m.id)}
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
            {ctx.preferredMethod ? (
              <p className="text-brew-muted text-xs px-1 mt-2">
                {ctx.preferredMethod} locked in — Claude will dial in the full recipe for it.
              </p>
            ) : (
              <p className="text-brew-muted text-xs px-1 mt-2">Tap a method to lock it in.</p>
            )}
          </div>

          {brewMode === "ai" && (
            <p className="text-brew-muted text-xs px-1">
              Claude picks the best method for this coffee &amp; context — and explains why.
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
