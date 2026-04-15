"use client";
import { useState } from "react";
import { useFlowStore } from "@/store/flowStore";
import FlowShell from "./FlowShell";
import Chip from "@/components/ui/Chip";
import StarRating from "@/components/ui/StarRating";
import FlavorWheel from "@/components/ui/FlavorWheel";
import { SCA_WHEEL, QUICK_FLAVORS } from "@/lib/constants/scaFlavorWheel";

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
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [attribution, setAttribution] = useState<"brew" | "bean" | "roaster" | null>(null);
  const [craft, setCraft] = useState<"off" | "solid" | "exceptional" | null>(null);
  const [fit, setFit] = useState<"not-my-style" | "neutral" | "my-kind" | null>(null);
  // Extended sensory fields (optional)
  const [showSensory, setShowSensory] = useState(false);
  const [sweetness, setSweetness] = useState<"low" | "medium" | "high" | "">("");
  const [clarity, setClarity] = useState<"muddy" | "cloudy" | "clean" | "crystal" | "">("");
  const [bitterness, setBitterness] = useState<"none" | "pleasant" | "harsh" | "">("");
  const [finish, setFinish] = useState<"short" | "medium" | "long" | "">("");
  const [improvedWhileCooling, setImprovedWhileCooling] = useState<boolean | null>(null);
  const [matchedIntention, setMatchedIntention] = useState<boolean | null>(null);

  const toggleFlavor = (f: string) =>
    setSelectedFlavors(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

  const canProceed = rating > 0;

  const handleNext = () => {
    setBrew({ ...draft.brew, flow: flow as "too-fast" | "perfect" | "too-slow" | "na", timing: timing as "as-expected" | "faster" | "slower" });
    setResult({
      rating,
      flavorNotes: selectedFlavors,
      body,
      acidity,
      freeNotes,
      ...(wouldAgain !== null ? { wouldBrewAgain: wouldAgain } : {}),
      ...(rating <= 3 && attribution ? { attribution } : {}),
      ...(craft ? { craft } : {}),
      ...(fit ? { fit } : {}),
      ...(sweetness ? { sweetness } : {}),
      ...(clarity ? { clarity } : {}),
      ...(bitterness ? { bitterness } : {}),
      ...(finish ? { finish } : {}),
      ...(improvedWhileCooling !== null ? { improvedWhileCooling } : {}),
      ...(matchedIntention !== null ? { matchedIntention } : {}),
    });
    setStep("summary");
  };

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

        {/* Attribution — only shown for low ratings */}
        {rating > 0 && rating <= 3 && (
          <div className="space-y-3">
            <h3 className="text-brew-muted text-xs uppercase tracking-widest">What held it back?</h3>
            <div className="flex gap-2">
              {(["brew", "bean", "roaster"] as const).map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setAttribution(prev => prev === opt ? null : opt)}
                  className={`flex-1 py-3 rounded-2xl border text-sm font-medium transition-all active:scale-95 ${
                    attribution === opt
                      ? "border-brew-accent/60 bg-brew-accent/10 text-white"
                      : "border-brew-border text-brew-muted"
                  }`}
                >
                  {opt === "brew" ? "My brew" : opt === "bean" ? "The bean" : "The roaster"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Craft — how well was it executed */}
        {rating > 0 && (
          <Section title="Your Craft">
            <div className="flex gap-2">
              {(["off", "solid", "exceptional"] as const).map(opt => (
                <Chip
                  key={opt}
                  label={opt === "off" ? "Off" : opt === "solid" ? "Solid" : "Exceptional"}
                  selected={craft === opt}
                  onClick={() => setCraft(prev => prev === opt ? null : opt)}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Fit — does it suit your taste */}
        {rating > 0 && (
          <Section title="Fit">
            <div className="flex gap-2 flex-wrap">
              {(["not-my-style", "neutral", "my-kind"] as const).map(opt => (
                <Chip
                  key={opt}
                  label={opt === "not-my-style" ? "Not my style" : opt === "neutral" ? "Neutral" : "My kind of cup"}
                  selected={fit === opt}
                  onClick={() => setFit(prev => prev === opt ? null : opt)}
                />
              ))}
            </div>
          </Section>
        )}

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

        {/* Flavor notes — SCA wheel navigation */}
        <Section title="Flavor Notes">
          {/* Visual wheel: tap a category to filter chips below */}
          <div className="w-full">
            <FlavorWheel
              mode="select"
              activeCategory={activeCategory}
              onCategorySelect={setActiveCategory}
              selectedFlavors={selectedFlavors}
              size={320}
            />
          </div>

          {/* Chips panel */}
          {activeCategory ? (
            <div className="space-y-3 mt-1">
              <p className="text-brew-muted text-xs uppercase tracking-widest">{activeCategory}</p>
              {Object.entries(SCA_WHEEL[activeCategory].subcategories).map(([sub, flavors]) => (
                <div key={sub}>
                  {Object.keys(SCA_WHEEL[activeCategory].subcategories).length > 1 && (
                    <p className="text-brew-subtle text-xs mb-1.5">{sub}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {flavors.map(f => (
                      <Chip key={f} label={f} selected={selectedFlavors.includes(f)} onClick={() => toggleFlavor(f)} size="sm" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2 mt-1">
              <div className="flex flex-wrap gap-2">
                {QUICK_FLAVORS.map(f => (
                  <Chip key={f} label={f} selected={selectedFlavors.includes(f)} onClick={() => toggleFlavor(f)} size="sm" />
                ))}
              </div>
              <p className="text-brew-muted text-xs">Tap the wheel to explore by category</p>
            </div>
          )}

          {/* Selected flavors summary */}
          {selectedFlavors.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-brew-border/30">
              {selectedFlavors.map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggleFlavor(f)}
                  className="text-brew-accent text-xs border border-brew-accent/30 bg-brew-accent/10 px-2 py-0.5 rounded-lg"
                >
                  {f} ×
                </button>
              ))}
            </div>
          )}
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
        <Section title={isExternal ? "Would you have this again?" : "Would you brew this exact setup again?"}>
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

        {/* Extended sensory — optional, collapsible */}
        <div>
          <button
            type="button"
            onClick={() => setShowSensory(v => !v)}
            className="flex items-center gap-2 text-brew-muted text-xs uppercase tracking-widest hover:text-white transition-colors"
          >
            <span>Sensory Detail — optional</span>
            <span className="text-white/30">{showSensory ? "▲" : "▼"}</span>
          </button>

          <div className={`overflow-hidden transition-all duration-300 ${showSensory ? "max-h-[600px] opacity-100 mt-4" : "max-h-0 opacity-0"}`}>
            <div className="space-y-5">
              <SensoryRow
                label="Sweetness"
                options={[{ id: "low", label: "Low" }, { id: "medium", label: "Medium" }, { id: "high", label: "High" }]}
                value={sweetness}
                onChange={v => setSweetness(v as typeof sweetness)}
              />
              <SensoryRow
                label="Clarity"
                options={[{ id: "muddy", label: "Muddy" }, { id: "cloudy", label: "Cloudy" }, { id: "clean", label: "Clean" }, { id: "crystal", label: "Crystal" }]}
                value={clarity}
                onChange={v => setClarity(v as typeof clarity)}
              />
              <SensoryRow
                label="Bitterness"
                options={[{ id: "none", label: "None" }, { id: "pleasant", label: "Pleasant" }, { id: "harsh", label: "Harsh" }]}
                value={bitterness}
                onChange={v => setBitterness(v as typeof bitterness)}
              />
              <SensoryRow
                label="Finish"
                options={[{ id: "short", label: "Short" }, { id: "medium", label: "Medium" }, { id: "long", label: "Long" }]}
                value={finish}
                onChange={v => setFinish(v as typeof finish)}
              />
              {/* Toggles */}
              <div className="space-y-3">
                <SensoryToggle
                  label="Improved while cooling"
                  value={improvedWhileCooling}
                  onChange={setImprovedWhileCooling}
                />
                <SensoryToggle
                  label="Matched your intention"
                  value={matchedIntention}
                  onChange={setMatchedIntention}
                />
              </div>
            </div>
          </div>
        </div>

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
      <p className="text-brew-muted text-xs uppercase tracking-widest">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {options.map(o => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(value === o.id ? "" : o.id)}
            className={`px-3 py-1.5 rounded-full border text-sm transition-all active:scale-95 ${
              value === o.id
                ? "border-brew-accent bg-brew-accent/10 text-brew-accent"
                : "border-brew-border text-brew-muted"
            }`}
          >
            {o.label}
          </button>
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
      <span className="text-white/60 text-sm">{label}</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(value === true ? null : true)}
          className={`px-3 py-1.5 rounded-full border text-xs transition-all active:scale-95 ${
            value === true ? "border-brew-accent bg-brew-accent/10 text-brew-accent" : "border-brew-border text-brew-muted"
          }`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(value === false ? null : false)}
          className={`px-3 py-1.5 rounded-full border text-xs transition-all active:scale-95 ${
            value === false ? "border-white/30 bg-white/5 text-white/60" : "border-brew-border text-brew-muted"
          }`}
        >
          No
        </button>
      </div>
    </div>
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
