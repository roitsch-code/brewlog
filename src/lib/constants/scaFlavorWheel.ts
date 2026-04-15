// SCA Coffee Flavor Wheel — based on the SCAA/World Coffee Research Sensory Lexicon (2016)
// 9 top-level categories → sub-categories → individual flavor notes

export interface WheelCategory {
  /** Dark-gray shade for B&W rendering (no color in this app) */
  shade: string;
  subcategories: Record<string, string[]>;
}

export const SCA_WHEEL: Record<string, WheelCategory> = {
  "Fruity": {
    shade: "#2d2d2d",
    subcategories: {
      "Berry":        ["Strawberry", "Raspberry", "Blueberry", "Blackberry", "Blackcurrant", "Cranberry"],
      "Citrus":       ["Lemon", "Lime", "Orange", "Grapefruit", "Bergamot", "Yuzu"],
      "Stone Fruit":  ["Peach", "Apricot", "Cherry", "Plum", "Nectarine"],
      "Tropical":     ["Mango", "Pineapple", "Passion Fruit", "Papaya", "Coconut", "Lychee", "Guava"],
      "Other Fruit":  ["Apple", "Pear", "Grape", "Pomegranate"],
      "Dried Fruit":  ["Raisin", "Prune", "Date", "Fig"],
    },
  },
  "Floral": {
    shade: "#2a2a2a",
    subcategories: {
      "Floral": ["Jasmine", "Rose", "Lavender", "Orange Blossom", "Chamomile", "Elderflower", "Lilac"],
      "Tea":    ["Black Tea", "Green Tea", "White Tea"],
    },
  },
  "Sweet": {
    shade: "#303030",
    subcategories: {
      "Sweet": ["Caramel", "Honey", "Brown Sugar", "Maple", "Molasses", "Vanilla", "Marzipan", "Toffee", "Butterscotch"],
    },
  },
  "Nutty & Cocoa": {
    shade: "#272727",
    subcategories: {
      "Nutty": ["Almond", "Hazelnut", "Peanut", "Walnut", "Praline", "Pecan", "Macadamia"],
      "Cocoa": ["Dark Chocolate", "Milk Chocolate", "White Chocolate", "Cocoa", "Mocha"],
    },
  },
  "Spices": {
    shade: "#2e2e2e",
    subcategories: {
      "Spices": ["Cinnamon", "Cardamom", "Black Pepper", "Clove", "Ginger", "Anise", "Nutmeg", "Licorice", "Star Anise"],
    },
  },
  "Roasted": {
    shade: "#252525",
    subcategories: {
      "Cereal":  ["Toast", "Malt", "Biscuit", "Grain", "Graham Cracker", "Oats"],
      "Tobacco": ["Tobacco", "Cedar", "Pipe Tobacco", "Smoky", "Ashy"],
    },
  },
  "Sour & Fermented": {
    shade: "#2b2b2b",
    subcategories: {
      "Fermented": ["Winey", "Fermented", "Overripe", "Kombucha", "Boozy", "Vinegar"],
      "Sour":      ["Citric Acid", "Malic Acid", "Lactic", "Sour Aromatics"],
    },
  },
  "Herbal & Green": {
    shade: "#292929",
    subcategories: {
      "Herbal":  ["Herbal", "Mint", "Eucalyptus", "Tarragon", "Sage"],
      "Vegetal": ["Grassy", "Hay", "Olive Oil", "Green Bell Pepper", "Cucumber", "Green Tea"],
    },
  },
  "Savory": {
    shade: "#2c2c2c",
    subcategories: {
      "Savory": ["Earthy", "Mushroom", "Umami", "Meaty", "Smoky Spice"],
      "Other":  ["Woody", "Resinous", "Mineral"],
    },
  },
};

export const SCA_CATEGORIES = Object.keys(SCA_WHEEL) as Array<keyof typeof SCA_WHEEL>;

// 8-item quick-access shortlist
export const QUICK_FLAVORS = [
  "Caramel", "Dark Chocolate", "Cherry", "Peach",
  "Jasmine", "Honey", "Strawberry", "Brown Sugar",
];

// Flat sub-category → flavors map (backward compatible with old FLAVOR_TAXONOMY shape)
export const FLAVOR_TAXONOMY: Record<string, string[]> = Object.fromEntries(
  Object.values(SCA_WHEEL).flatMap(cat => Object.entries(cat.subcategories))
);

export const ALL_FLAVOR_NOTES: string[] = Object.values(SCA_WHEEL).flatMap(cat =>
  Object.values(cat.subcategories).flat()
);

/** Given a flavor note string, return its top-level SCA category key (or undefined). */
export function flavorCategory(flavor: string): string | undefined {
  for (const [cat, { subcategories }] of Object.entries(SCA_WHEEL)) {
    for (const flavors of Object.values(subcategories)) {
      if (flavors.includes(flavor)) return cat;
    }
  }
  return undefined;
}
