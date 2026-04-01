"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { useFlowStore } from "@/store/flowStore";
import FlowShell from "./FlowShell";
import Chip from "@/components/ui/Chip";
import { getRecentSessions } from "@/lib/firebase/firestore";
import type { SessionContext } from "@/lib/types/session";

const OCCASIONS = [
  { id: "morning-ritual", label: "Morning Ritual",  img: "/images/occasion-morning.jpg" },
  { id: "focus",          label: "Deep Focus",       img: "/images/occasion-focus.jpg" },
  { id: "experiment",     label: "Experiment",       img: "/images/occasion-experiment.jpg" },
  { id: "after-dinner",   label: "After Dinner",     img: "/images/occasion-afterdinner.jpg" },
  { id: "social",         label: "Social",           img: "/images/occasion-social.jpg" },
];

const AMOUNTS = [
  { id: "small",    label: "Small",       sub: "350 ml · 23 g" },
  { id: "big",      label: "Big",         sub: "520 ml · 34 g" },
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

const DEFAULT_GRINDERS = ["Niche Zero", "Comandante C40"];

export default function StepContext() {
  const { draft, setContext, setStep, setIsRecommending, setRecommendError } = useFlowStore();
  const ctx = draft.context || {} as Partial<SessionContext>;
  const [customMl, setCustomMl] = useState<string>("");
  const [grinders, setGrinders] = useState<string[]>(DEFAULT_GRINDERS);

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
          <div className="flex flex-col gap-2">
            {OCCASIONS.map(o => (
              <button
                key={o.id}
                type="button"
                onClick={() => update("occasion", o.id)}
                className={`flex items-center gap-3 rounded-2xl border overflow-hidden transition-all active:scale-[0.98] ${
                  ctx.occasion === o.id ? "border-brew-accent" : "border-brew-border"
                }`}
              >
                <div className="relative w-16 h-14 shrink-0 bg-brew-surface">
                  <Image src={o.img} alt={o.label} fill className="object-cover" sizes="64px" />
                  {ctx.occasion === o.id && <div className="absolute inset-0 bg-brew-accent/20" />}
                </div>
                <span className={`text-sm font-medium pr-4 ${ctx.occasion === o.id ? "text-brew-accent" : "text-white"}`}>
                  {o.label}
                </span>
              </button>
            ))}
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

        <Section title="Water">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => update("waterSource", "tap")}
              className={`flex-1 p-4 rounded-2xl border text-left transition-all active:scale-95 ${
                ctx.waterSource === "tap" ? "border-brew-accent bg-brew-accent/10" : "border-brew-border bg-brew-surface"
              }`}
            >
              <p className={`font-semibold text-sm ${ctx.waterSource === "tap" ? "text-brew-accent" : "text-white"}`}>Tap only</p>
              <p className="text-brew-muted text-xs mt-1">~300 ppm</p>
            </button>
            <button
              type="button"
              onClick={() => update("waterSource", "diluted")}
              className={`flex-1 p-4 rounded-2xl border text-left transition-all active:scale-95 ${
                ctx.waterSource === "diluted" ? "border-brew-accent bg-brew-accent/10" : "border-brew-border bg-brew-surface"
              }`}
            >
              <p className={`font-semibold text-sm ${ctx.waterSource === "diluted" ? "text-brew-accent" : "text-white"}`}>Diluted</p>
              <p className="text-brew-muted text-xs mt-1">1:1 tap + distilled · ~150 ppm</p>
            </button>
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
