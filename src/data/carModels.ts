// Static list for programmatic "what's my X worth" landing pages.
// Deliberately contains no prices: figures come only from a live valuation.

export type Segment = "city" | "supermini" | "family-hatch" | "compact-suv" | "family-suv" | "compact-exec" | "electric";

export interface CarModelPage { make: string; model: string; slug: string; makeSlug: string; segment: Segment }

const RAW: [string, string, Segment][] = [
  ["Ford", "Fiesta", "supermini"], ["Ford", "Focus", "family-hatch"], ["Ford", "Puma", "compact-suv"], ["Ford", "Kuga", "family-suv"],
  ["Vauxhall", "Corsa", "supermini"], ["Vauxhall", "Astra", "family-hatch"], ["Vauxhall", "Mokka", "compact-suv"],
  ["Volkswagen", "Polo", "supermini"], ["Volkswagen", "Golf", "family-hatch"], ["Volkswagen", "T-Roc", "compact-suv"], ["Volkswagen", "Tiguan", "family-suv"],
  ["Nissan", "Juke", "compact-suv"], ["Nissan", "Qashqai", "family-suv"],
  ["Toyota", "Aygo", "city"], ["Toyota", "Yaris", "supermini"], ["Toyota", "Corolla", "family-hatch"], ["Toyota", "C-HR", "compact-suv"],
  ["BMW", "1 Series", "family-hatch"], ["BMW", "3 Series", "compact-exec"],
  ["Mercedes-Benz", "A-Class", "family-hatch"], ["Mercedes-Benz", "C-Class", "compact-exec"],
  ["Audi", "A3", "family-hatch"], ["Audi", "A4", "compact-exec"],
  ["Kia", "Ceed", "family-hatch"], ["Kia", "Sportage", "family-suv"], ["Hyundai", "Tucson", "family-suv"],
  ["MINI", "Hatch", "supermini"], ["Land Rover", "Range Rover Evoque", "compact-suv"],
  ["Peugeot", "208", "supermini"], ["Peugeot", "2008", "compact-suv"], ["Skoda", "Octavia", "family-hatch"],
  ["Honda", "Civic", "family-hatch"], ["Tesla", "Model 3", "electric"],
];

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const CAR_MODELS: CarModelPage[] = RAW.map(([make, model, segment]) => ({ make, model, segment, slug: slugify(model), makeSlug: slugify(make) }));

export function findModel(makeSlug?: string, slug?: string) {
  return CAR_MODELS.find((m) => m.makeSlug === makeSlug && m.slug === slug);
}

export const SEGMENT_LABEL: Record<Segment, string> = {
  city: "city car", supermini: "supermini", "family-hatch": "family hatchback", "compact-suv": "compact SUV",
  "family-suv": "family SUV", "compact-exec": "compact executive car", electric: "electric car",
};

/** General, non-model-specific guidance on what moves value in each segment. */
export const SEGMENT_TIPS: Record<Segment, string[]> = {
  city: ["Low running costs are the main draw, so a long MOT and recent service help.", "Kerbed wheels and scuffed bumpers are common on city cars; tidy them before photos.", "Many buyers are new drivers, so insurance group and tax band matter to them."],
  supermini: ["Superminis sell in big numbers, so buyers compare lots of adverts — price close to the market.", "Full service history stands out in a crowded market.", "Clean, well-lit photos make a real difference when buyers scroll past dozens of similar cars."],
  "family-hatch": ["Mileage and service history are the biggest price drivers for family hatchbacks.", "Interior wear (seats, boot lip, rear doors) is checked closely by family buyers.", "Higher trims with useful kit can justify asking towards the top of the range."],
  "compact-suv": ["Compact SUVs are in demand, so well-kept examples sell quickly at fair prices.", "Trim level and infotainment/safety kit vary widely — list the spec clearly.", "Check tyres: larger SUV wheels make replacements a noticeable cost to buyers."],
  "family-suv": ["Buyers look hard at service history and any timing belt/chain or gearbox work.", "Tow bars, panoramic roofs and higher trims can widen your buyer pool.", "Seat and boot wear from family use is expected, but deep cleaning pays for itself."],
  "compact-exec": ["Spec matters a lot: engine, trim and options can move value more than on mainstream cars.", "Main-dealer or specialist service history supports a higher price.", "Buyers check for warning lights and expensive advisories on MOT history."],
  electric: ["Battery health and remaining warranty are the first things buyers ask about.", "Charging cables and any home-charger details should be included in the sale.", "Range and charging speed vary by version — list the exact variant."],
};
