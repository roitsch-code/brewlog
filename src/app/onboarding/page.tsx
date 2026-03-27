"use client";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { savePreferences } from "@/lib/firebase/firestore";
import type { UserPreferences } from "@/lib/types/preferences";

const EQUIPMENT_OPTIONS = [
  { id: "V60", label: "V60" },
  { id: "V60 + Drip Assist", label: "V60 + Drip Assist" },
  { id: "OreaV4", label: "Orea V4" },
  { id: "Kalita", label: "Kalita Wave" },
  { id: "CleverDripper", label: "Clever Dripper" },
  { id: "AeroPress", label: "AeroPress" },
  { id: "Moccamaster", label: "Moccamaster" },
  { id: "FrenchPress", label: "French Press" },
  { id: "Espresso", label: "Espresso" },
];

const GRINDER_OPTIONS = ["Niche Zero", "Comandante C40", "1Zpresso", "Baratza", "Fellow Ode", "Other"];

export default function OnboardingPage() {
  const [step, setStep] = useState<"equipment" | "grinder">("equipment");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [grinder, setGrinder] = useState("");
  const [grinderCustom, setGrinderCustom] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const toggleEquipment = (id: string) => {
    setEquipment(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
  };

  const effectiveGrinder = grinder === "Other" ? grinderCustom : grinder;

  const handleSave = async () => {
    setSaving(true);
    const prefs: UserPreferences = {
      equipment,
      grinder: effectiveGrinder || undefined,
      tasteProfile: {
        likedOrigins: ["Brazil", "Ethiopia", "Kenya", "Costa Rica"],
        likedProcesses: ["Natural", "Washed", "Honey"],
        avoidProcesses: ["Anaerobic"],
        preferredBodyLevel: "medium",
        preferredAcidityLevel: "medium-high",
      },
      defaultAmount: "small",
      onboardingComplete: true,
    };
    await savePreferences(prefs);
    router.push("/");
  };

  return (
    <div className="min-h-svh bg-brew-bg flex flex-col px-5">
      <div className="pt-safe pt-12 pb-8">
        <p className="text-brew-accent text-xs tracking-widest uppercase font-medium mb-3">Setup</p>
        <h1 className="font-display text-4xl text-white leading-tight">
          {step === "equipment" ? "What's in\nyour kitchen?" : "Your grinder"}
        </h1>
      </div>

      {step === "equipment" ? (
        <div className="flex-1 flex flex-col gap-6 pb-safe">
          <p className="text-white/60 text-sm">Select everything you own — tap to toggle</p>
          <div className="flex flex-wrap gap-2">
            {EQUIPMENT_OPTIONS.map(e => {
              const selected = equipment.includes(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => toggleEquipment(e.id)}
                  className={`px-4 py-2.5 rounded-full border text-sm font-medium transition-all active:scale-95 ${
                    selected
                      ? "border-brew-accent bg-brew-accent/15 text-brew-accent"
                      : "border-brew-border text-white/60"
                  }`}
                >
                  {selected && <span className="mr-1.5">✓</span>}{e.label}
                </button>
              );
            })}
          </div>
          <div className="mt-auto pb-safe pt-4">
            <button
              type="button"
              onClick={() => setStep("grinder")}
              disabled={equipment.length === 0}
              className="w-full h-14 rounded-full bg-white text-black font-semibold text-base active:scale-95 transition-all disabled:opacity-30"
            >
              Next →
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-6">
          <p className="text-white/60 text-sm">Select your primary grinder</p>
          <div className="flex flex-wrap gap-2">
            {GRINDER_OPTIONS.map(g => (
              <button
                key={g}
                type="button"
                onClick={() => setGrinder(prev => prev === g ? "" : g)}
                className={`px-4 py-2.5 rounded-full border text-sm font-medium transition-all active:scale-95 ${
                  grinder === g
                    ? "border-brew-accent bg-brew-accent/15 text-brew-accent"
                    : "border-brew-border text-white/60"
                }`}
              >
                {grinder === g && <span className="mr-1.5">✓</span>}{g}
              </button>
            ))}
          </div>

          {grinder === "Other" && (
            <input
              type="text"
              value={grinderCustom}
              onChange={e => setGrinderCustom(e.target.value)}
              placeholder="Enter your grinder model..."
              className="w-full bg-brew-surface border border-brew-border rounded-2xl px-4 py-3 text-white text-base placeholder:text-brew-muted focus:outline-none focus:border-white/30"
              autoFocus
            />
          )}

          <div className="mt-auto pb-safe pt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setStep("equipment")}
              className="h-14 px-6 rounded-full bg-brew-surface border border-brew-border text-white font-medium active:scale-95 transition-all"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 h-14 rounded-full bg-white text-black font-semibold text-base active:scale-95 transition-all disabled:opacity-60"
            >
              {saving ? "Saving..." : "Start Brewing"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
