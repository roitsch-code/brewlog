"use client";
import { useState } from "react";
import { useFlowStore } from "@/store/flowStore";
import FlowShell from "./FlowShell";
import Chip from "@/components/ui/Chip";
import StarRating from "@/components/ui/StarRating";
import { QUICK_FLAVORS, FLAVOR_TAXONOMY } from "@/lib/constants/flavorTaxonomy";

const FLOW_OPTIONS = ["too-fast", "perfect", "too-slow", "na"] as const;
const FLOW_LABELS: Record<string, string> = { "too-fast": "Too Fast", "perfect": "Perfect", "too-slow": "Too Slow", "na": "N/A" };
const TIMING_OPTIONS = ["as-expected", "faster", "slower"] as const;
const TIMING_LABELS: Record<string, string> = { "as-expected": "As Expected", "faster": "Faster", "slower": "Slower" };
const BODY_OPTIONS = ["light", "medium", "full"];
const ACIDITY_OPTIONS = ["low", "medium", "high", "bright"];

export default function StepLog() {
  const { draft, setBrew, setResult, setStep } = useFlowStore();
  const isExternal = draft.mode === "external";
  const [rating, setRating] = useState(0);
  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
  const [body, setBody] = useState("");
  const [acidity, setAcidity] = useState("");
  const [freeNotes, setFreeNotes] = useState("");
  const [wouldAgain, setWouldAgain] = useState<boolean | null>(null);
  const [flow, setFlow] = useState<string>("");
  const [timing, setTiming] = useState<string>("");
  const [showAllFlavors, setShowAllFlavors] = useState(false);

  const toggleFlavor = (f: string) =>
    setSelectedFlavors(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

  const canProceed = rating > 0;

  const handleNext = () => {
    setBrew({ ...draft.brew, flow: flow as "too-fast" | "perfect" | "too-slow" | "na", timing: timing as "as-expected" | "faster" | "slower" });
    setResult({ rating, flavorNotes: selectedFlavors, body, acidity, freeNotes, wouldUseMethodAgain: wouldAgain ?? true });
    setStep("summary");
  };

  const allFlavors = Object.entries(FLAVOR_TAXONOMY);

  return (
    <FlowShell onNext={handleNext} nextDisabled={!canProceed} nextLabel="Save →">
      <div className="px-5 py-4 flex flex-col gap-8">
        <div>
          <p className="text-brew-muted text-xs tracking-widest uppercase mb-2">Taste Log</p>
          <h1 className="font-display text-2xl text-white">How was it?</h1>
        </div>

        {/* Rating */}
        <div className="flex flex-col items-center gap-3 py-2">
          <StarRating value={rating} onChange={setRating} size="lg" />
          <p className="text-brew-muted text-sm">
            {rating === 0 ? "Tap to rate" : ["", "Disappointing", "Okay", "Good", "Great", "Outstanding"][rating]}
          </p>
        </div>

        {/* Flow + Timing — home mode only */}
        {!isExternal && (
          <>
            <Section title="Flow">
              <div className="flex gap-2 flex-wrap">
                {FLOW_OPTIONS.map(o => (
                  <Chip key={o} label={FLOW_LABELS[o]} selected={flow === o} onClick={() => setFlow(o)} size="sm" />
                ))}
              </div>
            </Section>

            <Section title="Timing">
              <div className="flex gap-2 flex-wrap">
                {TIMING_OPTIONS.map(o => (
                  <Chip key={o} label={TIMING_LABELS[o]} selected={timing === o} onClick={() => setTiming(o)} size="sm" />
                ))}
              </div>
            </Section>
          </>
        )}

        {/* Flavor notes */}
        <Section title="Flavor Notes">
          <div className="flex flex-wrap gap-2">
            {QUICK_FLAVORS.map(f => (
              <Chip key={f} label={f} selected={selectedFlavors.includes(f)} onClick={() => toggleFlavor(f)} size="sm" />
            ))}
          </div>
          {showAllFlavors && allFlavors.map(([cat, tags]) => (
            <div key={cat} className="mt-3">
              <p className="text-brew-muted text-xs uppercase tracking-widest mb-2">{cat}</p>
              <div className="flex flex-wrap gap-2">
                {tags.filter(t => !QUICK_FLAVORS.includes(t)).map(f => (
                  <Chip key={f} label={f} selected={selectedFlavors.includes(f)} onClick={() => toggleFlavor(f)} size="sm" />
                ))}
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setShowAllFlavors(v => !v)} className="text-brew-muted text-sm mt-2 hover:text-white transition-colors">
            {showAllFlavors ? "Show less" : "Show all flavors →"}
          </button>
        </Section>

        {/* Body + Acidity */}
        <Section title="Body">
          <div className="flex gap-2">
            {BODY_OPTIONS.map(b => (
              <Chip key={b} label={b.charAt(0).toUpperCase() + b.slice(1)} selected={body === b} onClick={() => setBody(b)} />
            ))}
          </div>
        </Section>

        <Section title="Acidity">
          <div className="flex gap-2">
            {ACIDITY_OPTIONS.map(a => (
              <Chip key={a} label={a.charAt(0).toUpperCase() + a.slice(1)} selected={acidity === a} onClick={() => setAcidity(a)} />
            ))}
          </div>
        </Section>

        {/* Would brew/drink again */}
        <Section title={isExternal ? "Would you drink this again?" : "Would you brew this again?"}>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setWouldAgain(true)}
              className={`flex-1 py-4 rounded-2xl border text-lg font-medium transition-all active:scale-95 ${wouldAgain === true ? "border-brew-success bg-brew-success/10 text-brew-success" : "border-brew-border text-white"}`}
            >
              Yes ✓
            </button>
            <button
              type="button"
              onClick={() => setWouldAgain(false)}
              className={`flex-1 py-4 rounded-2xl border text-lg font-medium transition-all active:scale-95 ${wouldAgain === false ? "border-red-700 bg-red-900/20 text-red-400" : "border-brew-border text-white"}`}
            >
              No ✕
            </button>
          </div>
        </Section>

        {/* Notes */}
        <Section title="Notes (optional)">
          <textarea
            value={freeNotes}
            onChange={e => setFreeNotes(e.target.value)}
            placeholder="Anything else worth noting..."
            rows={3}
            className="w-full bg-brew-surface border border-brew-border rounded-2xl px-4 py-3 text-white text-base resize-none placeholder:text-brew-muted focus:outline-none focus:border-white/30"
          />
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
