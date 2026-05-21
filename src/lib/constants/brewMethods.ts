export interface BrewMethod {
  id: string;
  label: string;
  emoji: string;
  defaultTemp: number;
  defaultDose: number;
  defaultWater: number;
  defaultTimeSec: number;
  category: "pour-over" | "immersion" | "other";
}

export const BREW_METHODS: BrewMethod[] = [
  { id: "v60", label: "V60", emoji: "☕", defaultTemp: 98, defaultDose: 23, defaultWater: 350, defaultTimeSec: 210, category: "pour-over" },
  // Orea V4 — same brewer body, four interchangeable bottoms. Each
  // bottom changes flow rate dramatically (Apex most restrictive →
  // Open fastest), so each gets its own picker entry + icon. Defaults
  // skew with the bottom's character: Apex / Classic target clarity-
  // forward dialing, Open / Fast push faster contact time.
  { id: "orea-classic", label: "Orea Classic", emoji: "⬡", defaultTemp: 94, defaultDose: 17, defaultWater: 270, defaultTimeSec: 150, category: "pour-over" },
  { id: "orea-open",    label: "Orea Open",    emoji: "⬡", defaultTemp: 94, defaultDose: 17, defaultWater: 270, defaultTimeSec: 140, category: "pour-over" },
  { id: "orea-apex",    label: "Orea Apex",    emoji: "⬡", defaultTemp: 95, defaultDose: 17, defaultWater: 255, defaultTimeSec: 165, category: "pour-over" },
  { id: "orea-fast",    label: "Orea Fast",    emoji: "⬡", defaultTemp: 93, defaultDose: 17, defaultWater: 270, defaultTimeSec: 140, category: "pour-over" },
  { id: "origami-cone", label: "Origami (cone)", emoji: "◇", defaultTemp: 96, defaultDose: 17, defaultWater: 255, defaultTimeSec: 180, category: "pour-over" },
  { id: "origami-wave", label: "Origami (wave)", emoji: "◇", defaultTemp: 94, defaultDose: 17, defaultWater: 255, defaultTimeSec: 200, category: "pour-over" },
  { id: "kalita", label: "Kalita Wave", emoji: "△", defaultTemp: 94, defaultDose: 15, defaultWater: 250, defaultTimeSec: 210, category: "pour-over" },
  { id: "clever", label: "Clever Dripper", emoji: "⊡", defaultTemp: 93, defaultDose: 25, defaultWater: 400, defaultTimeSec: 300, category: "immersion" },
  { id: "aeropress", label: "AeroPress", emoji: "⊙", defaultTemp: 88, defaultDose: 14, defaultWater: 240, defaultTimeSec: 120, category: "immersion" },
  { id: "aeropress-concentrate", label: "AeroPress Concentrate", emoji: "⊙", defaultTemp: 86, defaultDose: 14, defaultWater: 90, defaultTimeSec: 90, category: "immersion" },
  { id: "origami", label: "Origami Dripper", emoji: "◇", defaultTemp: 95, defaultDose: 22, defaultWater: 330, defaultTimeSec: 180, category: "pour-over" },
  { id: "moccamaster", label: "Moccamaster", emoji: "⚡", defaultTemp: 92, defaultDose: 45, defaultWater: 750, defaultTimeSec: 360, category: "other" },
];

export const getMethodById = (id: string) => BREW_METHODS.find(m => m.id === id);
