export const FLAVOR_TAXONOMY: Record<string, string[]> = {
  "Citrus": ["Lemon", "Orange", "Grapefruit", "Lime", "Bergamot", "Yuzu"],
  "Stone Fruit": ["Peach", "Apricot", "Nectarine", "Plum", "Cherry"],
  "Berry": ["Strawberry", "Raspberry", "Blueberry", "Blackcurrant", "Cranberry"],
  "Tropical": ["Mango", "Pineapple", "Passion Fruit", "Papaya", "Lychee"],
  "Dried Fruit": ["Raisin", "Date", "Fig", "Prune"],
  "Sweet": ["Caramel", "Honey", "Brown Sugar", "Maple", "Vanilla", "Marzipan"],
  "Chocolate": ["Dark Chocolate", "Milk Chocolate", "Cocoa", "Brownie"],
  "Nut": ["Almond", "Hazelnut", "Walnut", "Praline"],
  "Floral": ["Jasmine", "Rose", "Lavender", "Orange Blossom", "Chamomile", "Elderflower"],
  "Spice": ["Cinnamon", "Cardamom", "Black Pepper", "Clove", "Ginger"],
  "Cereal": ["Oats", "Malt", "Toast", "Biscuit"],
  "Savory": ["Tobacco", "Cedar", "Earthy", "Mushroom"],
};

export const QUICK_FLAVORS = [
  "Caramel", "Dark Chocolate", "Cherry", "Peach", "Almond",
  "Jasmine", "Citrus", "Honey", "Strawberry", "Brown Sugar",
];

export const ALL_FLAVOR_NOTES = Object.values(FLAVOR_TAXONOMY).flat();
