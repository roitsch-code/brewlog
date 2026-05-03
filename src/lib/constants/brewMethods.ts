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
  { id: "v60-drip-assist", label: "V60 + Drip Assist", emoji: "☕", defaultTemp: 98, defaultDose: 34, defaultWater: 520, defaultTimeSec: 240, category: "pour-over" },
  { id: "orea", label: "Orea V4", emoji: "⬡", defaultTemp: 94, defaultDose: 17, defaultWater: 270, defaultTimeSec: 150, category: "pour-over" },
  { id: "origami-cone", label: "Origami (cone)", emoji: "◇", defaultTemp: 96, defaultDose: 17, defaultWater: 255, defaultTimeSec: 180, category: "pour-over" },
  { id: "origami-wave", label: "Origami (wave)", emoji: "◇", defaultTemp: 94, defaultDose: 17, defaultWater: 255, defaultTimeSec: 200, category: "pour-over" },
  { id: "kalita", label: "Kalita Wave", emoji: "△", defaultTemp: 94, defaultDose: 15, defaultWater: 250, defaultTimeSec: 210, category: "pour-over" },
  { id: "clever", label: "Clever Dripper", emoji: "⊡", defaultTemp: 93, defaultDose: 25, defaultWater: 400, defaultTimeSec: 300, category: "immersion" },
  { id: "aeropress", label: "AeroPress", emoji: "⊙", defaultTemp: 88, defaultDose: 14, defaultWater: 240, defaultTimeSec: 120, category: "immersion" },
  { id: "aeropress-concentrate", label: "AeroPress Concentrate", emoji: "⊙", defaultTemp: 86, defaultDose: 14, defaultWater: 90, defaultTimeSec: 90, category: "immersion" },
  { id: "moccamaster", label: "Moccamaster", emoji: "⚡", defaultTemp: 92, defaultDose: 45, defaultWater: 750, defaultTimeSec: 360, category: "other" },
];

export const getMethodById = (id: string) => BREW_METHODS.find(m => m.id === id);
