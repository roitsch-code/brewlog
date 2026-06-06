"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UserPreferences } from "@/lib/types/preferences";
import Chip from "@/components/ui/light/Chip";

async function savePreferences(prefs: UserPreferences): Promise<void> {
  await fetch("/api/preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prefs),
  });
}

const EQUIPMENT_OPTIONS = [
  { id: "V60", label: "V60" },
  { id: "OreaV4", label: "Orea V4" },
  { id: "Origami", label: "Origami" },
  { id: "Kalita", label: "Kalita Wave" },
  { id: "CleverDripper", label: "Clever Dripper" },
  { id: "AeroPress", label: "AeroPress" },
  { id: "Chemex", label: "Chemex" },
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
    <div className="min-h-svh bg-transparent flex flex-col px-5">
      <div className="pb-8" style={{ paddingTop: "calc(env(safe-area-inset-top) + 3rem)" }}>
        <p className="text-light-muted-foreground text-xs tracking-widest uppercase mb-3">Setup</p>
        <h1 className="font-fraunces text-3xl text-light-foreground leading-none whitespace-pre-line">
          {step === "equipment" ? "What's in\nyour kitchen?" : "Your grinder"}
        </h1>
      </div>

      {step === "equipment" ? (
        <div className="flex-1 flex flex-col gap-6 pb-safe">
          <p className="text-light-muted-foreground text-sm">Select everything you own — tap to toggle</p>
          <div className="flex flex-wrap gap-2">
            {EQUIPMENT_OPTIONS.map(e => {
              const selected = equipment.includes(e.id);
              return (
                <Chip
                  key={e.id}
                  selected={selected}
                  size="sm"
                  onClick={() => toggleEquipment(e.id)}
                >
                  {e.label}
                </Chip>
              );
            })}
          </div>
          <div className="mt-auto pt-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
            <button
              type="button"
              onClick={() => setStep("grinder")}
              disabled={equipment.length === 0}
              className="w-full h-14 rounded-full bg-light-foreground text-light-text-on-dark font-semibold text-base active:scale-[0.98] transition-transform disabled:opacity-30"
            >
              Next →
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-6 pb-safe">
          <p className="text-light-muted-foreground text-sm">Select your primary grinder</p>
          <div className="flex flex-wrap gap-2">
            {GRINDER_OPTIONS.map(g => (
              <Chip
                key={g}
                selected={grinder === g}
                onClick={() => setGrinder(prev => prev === g ? "" : g)}
              >
                {g}
              </Chip>
            ))}
          </div>

          {grinder === "Other" && (
            <input
              type="text"
              value={grinderCustom}
              onChange={e => setGrinderCustom(e.target.value)}
              placeholder="Enter your grinder model..."
              className="w-full bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/20 rounded-2xl px-4 py-3 text-light-foreground text-base placeholder:text-light-muted-foreground focus:outline-none focus:border-light-foreground/40"
              autoFocus
            />
          )}

          <div className="mt-auto pt-4 flex gap-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
            <button
              type="button"
              onClick={() => setStep("equipment")}
              className="h-14 px-6 rounded-full bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/20 text-light-foreground font-medium active:scale-[0.98] transition-transform"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 h-14 rounded-full bg-light-foreground text-light-text-on-dark font-semibold text-base active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {saving ? "Saving..." : "Start Brewing"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
