// Niche Zero grind settings — single source of truth.
// Mirrors docs/grind-settings.md and the user's CLAUDE.md profile.
// The Niche Zero uses continuous degree (°) settings, not clicks.
// The Comandante C40 MK2 (travel) uses clicks instead.

export interface GrindSetting {
  method: string;
  process?: string;
  niche: { min: number; max: number };
  notes?: string;
}

export const NICHE_GRIND_SETTINGS: GrindSetting[] = [
  { method: "V60 + Drip Assist", process: "Washed", niche: { min: 403, max: 408 } },
  { method: "V60 + Drip Assist", process: "Honey", niche: { min: 405, max: 410 } },
  { method: "V60 + Drip Assist", process: "Natural", niche: { min: 406, max: 412 } },
  { method: "V60 (no Assist)", niche: { min: 396, max: 406 } },
  { method: "Orea V4", niche: { min: 401, max: 411 } },
  { method: "Origami Dripper", process: "Washed", niche: { min: 401, max: 407 } },
  { method: "Origami Dripper", process: "Honey", niche: { min: 403, max: 408 } },
  { method: "Origami Dripper", process: "Natural", niche: { min: 404, max: 409 } },
  { method: "Clever Dripper", niche: { min: 416, max: 436 } },
  { method: "AeroPress", niche: { min: 377, max: 387 } },
  { method: "Moccamaster", niche: { min: 431, max: 441 } },
  { method: "Peng 2025 (Championship)", niche: { min: 386, max: 396 } },
  { method: "Kasuya 4:6", niche: { min: 411, max: 421 } },
];

export const GRIND_FOOTNOTE =
  "Comandante C40 MK2 uses clicks, not degrees. Adjust grind coarser/finer to fix flow timing — never use temperature for that; temperature controls extraction chemistry only.";

export function formatGrindSettingsForPrompt(): string {
  const lines = NICHE_GRIND_SETTINGS.map((s) => {
    const head = s.process ? `${s.method} (${s.process})` : s.method;
    return `- ${head}: ${s.niche.min}–${s.niche.max}°`;
  });
  return lines.join("\n");
}
