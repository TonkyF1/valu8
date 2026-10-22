// Valu8 — pure valuation maths, extracted from analyse-vehicle so it can be
// unit-tested (vitest) and shared. No Deno/Node APIs.

export const CURRENT_YEAR = new Date().getUTCFullYear();

export function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export function percentile(nums: number[], p: number): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.floor((p / 100) * (s.length - 1))));
  return s[idx];
}

// True if `re` matches a clause of `text` that is NOT negated earlier in the
// same clause ("no issues", "never had rust", "without any leaks", "isn't due").
export const NEGATION_RE = /\b(no|not|never|without|none|nothing|zero|nil|free of|free from)\b|n't\b/i;
export function mentionsUnnegated(re: RegExp, text: string): boolean {
  const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
  for (const clause of text.split(/[.;,!?\n]+|\bbut\b/i)) {
    const g = new RegExp(re.source, flags);
    let m: RegExpExecArray | null;
    while ((m = g.exec(clause))) {
      const before = clause.slice(0, m.index);
      if (!NEGATION_RE.test(before)) return true;
      if (m[0].length === 0) g.lastIndex++;
    }
  }
  return false;
}

export type ConfidenceLevel = "High" | "Medium" | "Low" | "Very Low";

// Ultra-rare makes — almost no live UK MarketCheck data, valuations are
// inherently uncertain and must never claim High confidence.
export const ULTRA_RARE_MAKES = [
  "Bugatti", "Koenigsegg", "Pagani", "Rimac", "Pininfarina", "Zenvo",
  "Singer", "Gordon Murray", "Hennessey", "SSC", "Apollo", "Czinger",
  "W Motors", "Spyker", "Noble",
];

// Specific hypercar / ultra-rare model patterns (treated like ultra-rare even
// if the make also makes mainstream cars).
export const ULTRA_RARE_MODEL_PATTERNS: Array<{ make?: string; match: RegExp }> = [
  { make: "Ferrari", match: /laferrari|enzo|f50|f40|monza|daytona\s?sp3/i },
  { make: "McLaren", match: /\bp1\b|senna|speedtail|elva|solus/i },
  { make: "Porsche", match: /carrera\s?gt|918\s?spyder/i },
  { make: "Aston Martin", match: /valkyrie|valhalla|one[- ]?77|vulcan/i },
  { make: "Lamborghini", match: /sian|veneno|reventon|centenario|countach\s?lpi/i },
  { make: "Mercedes-Benz", match: /amg\s?one|slr\s?stirling/i },
  { make: "Mercedes-AMG", match: /amg\s?one/i },
];

export function isUltraRare(make: string, model: string, variant?: string): boolean {
  if (ULTRA_RARE_MAKES.includes(make)) return true;
  const hay = `${model} ${variant ?? ""}`;
  return ULTRA_RARE_MODEL_PATTERNS.some((p) => (!p.make || p.make === make) && p.match.test(hay));
}

export const ENTHUSIAST_KEYWORDS = [
  "rs", "renaultsport", "renault sport", "gti", "gti clubsport", "st", "vrs", "v-rs", "vxr", "opc", "cupra", "type r", "type-r",
  "m", "m sport", "m3", "m4", "m5", "amg", "gt3", "gt3 rs", "gt4", "turbo s", "nismo", "evo", "integrale", "cooper s",
  "john cooper works", "jcw", "quadrifoglio", "abarth", "trophy", "williams", "cs", "csl", "clubsport", "superleggera", "performante", "svj", "lt"
];

export const EXOTIC_MODEL_ANCHORS: Array<{ make: string; match: RegExp; low: number; high: number }> = [
  { make: "Bugatti", match: /chiron|pur sport|super sport|ss 300/i, low: 2200000, high: 4200000 },
  { make: "Bugatti", match: /veyron/i, low: 1200000, high: 1800000 },
  { make: "Ferrari", match: /laferrari/i, low: 2500000, high: 3200000 },
  { make: "Ferrari", match: /sf90/i, low: 320000, high: 450000 },
  { make: "Ferrari", match: /296\s?(gtb|gts)?/i, low: 230000, high: 290000 },
  { make: "Ferrari", match: /f8/i, low: 180000, high: 230000 },
  { make: "Ferrari", match: /488/i, low: 130000, high: 170000 },
  { make: "Ferrari", match: /roma/i, low: 140000, high: 190000 },
  { make: "Ferrari", match: /portofino/i, low: 110000, high: 150000 },
  { make: "Lamborghini", match: /revuelto/i, low: 450000, high: 600000 },
  { make: "Lamborghini", match: /aventador\s?svj/i, low: 400000, high: 550000 },
  { make: "Lamborghini", match: /aventador/i, low: 200000, high: 280000 },
  { make: "Lamborghini", match: /hurac[aá]n\s?performante/i, low: 200000, high: 260000 },
  { make: "Lamborghini", match: /hurac[aá]n\s?evo/i, low: 170000, high: 220000 },
  { make: "Lamborghini", match: /urus/i, low: 160000, high: 230000 },
  { make: "McLaren", match: /p1/i, low: 1200000, high: 1800000 },
  { make: "McLaren", match: /senna/i, low: 900000, high: 1300000 },
  { make: "McLaren", match: /765lt/i, low: 350000, high: 450000 },
  { make: "McLaren", match: /720s/i, low: 160000, high: 220000 },
  { make: "McLaren", match: /artura/i, low: 160000, high: 210000 },
  { make: "Porsche", match: /911\s?r$/i, low: 350000, high: 500000 },
  { make: "Porsche", match: /carrera\s?gt/i, low: 1200000, high: 1800000 },
  { make: "Porsche", match: /918/i, low: 1400000, high: 2000000 },
  { make: "Porsche", match: /992.*gt3/i, low: 160000, high: 210000 },
  { make: "Porsche", match: /992.*turbo\s?s/i, low: 180000, high: 240000 },
  { make: "Porsche", match: /991.*gt3\s?rs/i, low: 200000, high: 260000 },
  { make: "Porsche", match: /993.*turbo/i, low: 180000, high: 280000 },
  { make: "Aston Martin", match: /valkyrie/i, low: 2000000, high: 3000000 },
  { make: "Aston Martin", match: /dbs\s?superleggera/i, low: 160000, high: 220000 },
  { make: "Aston Martin", match: /db11/i, low: 90000, high: 140000 },
  { make: "Rolls-Royce", match: /phantom/i, low: 350000, high: 500000 },
  { make: "Rolls-Royce", match: /cullinan/i, low: 250000, high: 380000 },
  { make: "Rolls-Royce", match: /ghost/i, low: 220000, high: 320000 },
  { make: "Bentley", match: /continental\s?gt/i, low: 140000, high: 200000 },
  { make: "Bentley", match: /bentayga/i, low: 140000, high: 200000 },
  { make: "Bentley", match: /mulsanne/i, low: 120000, high: 200000 },
];

export const EXOTIC = ["Ferrari","Lamborghini","McLaren","Pagani","Bugatti","Koenigsegg","Rimac","Aston Martin","Bentley","Rolls-Royce","Maybach","Maserati","Pininfarina","Zenvo","Singer","Gordon Murray"];
export const PREMIUM = ["BMW","Mercedes-Benz","Mercedes-AMG","Audi","Porsche","Land Rover","Jaguar","Tesla","Lexus","Volvo","MINI","Polestar","Genesis","Alpine","Lotus","Morgan","TVR","Lucid","Rivian"];
export const ECONOMY = ["Dacia","SEAT","Škoda","Skoda","Fiat","Citroën","Citroen","Vauxhall","Peugeot","Renault","Suzuki","MG","Kia","Hyundai","Daihatsu","Perodua","Proton","Lada","Tata","BYD","Leapmotor","VinFast","XPeng"];

export function baseValue(make: string, year: number) {
  const age = Math.max(0, CURRENT_YEAR - year);
  let base = 18000;
  if (EXOTIC.includes(make)) base = 120000;
  else if (PREMIUM.includes(make)) base = 32000;
  else if (ECONOMY.includes(make)) base = 13000;
  if (age >= 30) return Math.round(base * Math.max(0.35, Math.pow(0.97, age - 30) * 0.55));
  return Math.round(base * Math.max(0.15, Math.pow(0.86, age)));
}

export function roundTo50(n: number) { return Math.round(n / 50) * 50; }

export function roundToGrain(n: number) {
  const grain = n >= 1000000 ? 25000 : n >= 500000 ? 10000 : n >= 100000 ? 5000 : n >= 30000 ? 500 : 50;
  return Math.round(n / grain) * grain;
}

export function clamp(num: number, min: number, max: number) {
  return Math.max(min, Math.min(max, num));
}

export function sanitizeNarrativeYears(text: string | undefined, vehicleYear: number, currentYear = CURRENT_YEAR, extraAllowed: number[] = []) {
  if (!text) return "";
  const allowed = new Set<number>([vehicleYear, currentYear, currentYear + 1, ...extraAllowed]);
  return text.replace(/\b(19|20)\d{2}\b/g, (match) => {
    const parsed = Number(match);
    if (allowed.has(parsed)) return match;
    return String(vehicleYear);
  });
}

export function sanitizeNarrativeList(items: string[] | undefined, vehicleYear: number, currentYear = CURRENT_YEAR, extraAllowed: number[] = []) {
  return (items ?? []).map((item) => sanitizeNarrativeYears(item, vehicleYear, currentYear, extraAllowed));
}

export function isEnthusiastCar(make: string, model: string, variant?: string) {
  const hay = `${make} ${model} ${variant ?? ""}`.toLowerCase();
  return ENTHUSIAST_KEYWORDS.some((keyword) => hay.includes(keyword));
}

export function getExoticAnchor(make: string, model: string, variant?: string) {
  const hay = `${model} ${variant ?? ""}`;
  return EXOTIC_MODEL_ANCHORS.find((entry) => entry.make === make && entry.match.test(hay));
}

export function isClearlyBadMarketData(params: {
  make: string;
  model: string;
  variant?: string;
  median: number;
  count: number;
  ultraRare: boolean;
  exoticAnchor?: { low: number; high: number };
}) {
  const { make, model, variant, median, count, ultraRare, exoticAnchor } = params;
  if (!Number.isFinite(median) || median <= 0) return true;
  if (ultraRare && count < 50) return true;
  if (exoticAnchor && median < exoticAnchor.low * 0.45) return true;

  const hay = `${make} ${model} ${variant ?? ""}`.toLowerCase();
  if (/(bugatti|koenigsegg|pagani|rimac|laferrari|enzo|f40|f50|senna|p1|speedtail|valkyrie|amg\s?one|veneno|centenario|sian|carrera\s?gt|918\s?spyder)/i.test(hay) && median < 100000) {
    return true;
  }
  if (/(ferrari|lamborghini|mclaren|rolls-royce)/i.test(hay) && median < 35000) {
    return true;
  }

  return false;
}

export function computeMarketRange(params: {
  make: string;
  model: string;
  variant?: string;
  year: number;
  mileage: number;
  motExpiry?: string;
  serviceNotes?: string;
  photoCount: number;
  conditionScore: number;
  aiPrivateValue: number;
}) {
  const { make, model, variant, year, mileage, motExpiry, serviceNotes, photoCount, conditionScore, aiPrivateValue } = params;
  const age = Math.max(0, CURRENT_YEAR - year);
  const expectedMileage = age <= 0 ? 3000 : age * 8000;
  const mileageRatio = mileage / Math.max(expectedMileage, 1);
  const serviceText = `${serviceNotes ?? ""}`.toLowerCase();
  const hasStrongHistory = /(full service|fsh|main dealer|specialist|major service|timing belt|timing chain|clutch|ceramic|recent service|full history)/i.test(serviceText);
  const needsWork = mentionsUnnegated(/(needs|due|overdue|warning light|smoke|fault|damage|dent|scuff|scratch|leak|issue)/i, serviceText);
  const enthusiast = isEnthusiastCar(make, model, variant);
  const exoticAnchor = getExoticAnchor(make, model, variant);
  const motSoon = !!motExpiry && (() => {
    const expiry = new Date(motExpiry);
    if (Number.isNaN(expiry.getTime())) return false;
    const days = (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 90;
  })();

  // Trust the AI's private-sale figure as the primary anchor. Apply a small
  // conservative bias so we don't over-promise — private sales typically
  // achieve 3-7% below dealer asking screenshots that AIs often anchor to.
  let center = Math.max(aiPrivateValue, 500) * 0.97;
  let rangeSpread = 0.08;
  let confidence: ConfidenceLevel = photoCount >= 5 ? "High" : photoCount >= 3 ? "Medium" : "Low";

  if (exoticAnchor) {
    // Keep within the anchor band but lean toward the lower-mid for private sale realism.
    const anchorMid = (exoticAnchor.low + exoticAnchor.high) / 2;
    const anchorLowerMid = exoticAnchor.low + (anchorMid - exoticAnchor.low) * 0.6;
    if (center > exoticAnchor.high * 1.05) center = exoticAnchor.high;
    if (center < exoticAnchor.low * 0.85) center = anchorLowerMid;
    rangeSpread = 0.12;
    confidence = photoCount >= 4 ? "High" : "Medium";
  }

  // Condition / history / mileage adjustments — conservative, symmetric.
  if (hasStrongHistory) center *= 1.02;
  if (needsWork) center *= 0.90;
  if (mileageRatio <= 0.7) center *= enthusiast ? 1.05 : 1.03;
  else if (mileageRatio <= 0.9) center *= 1.01;
  else if (mileageRatio >= 1.5) center *= 0.82;
  else if (mileageRatio >= 1.25) center *= 0.90;
  else if (mileageRatio >= 1.1) center *= 0.96;
  if (motSoon) center *= 0.98;
  // NOTE: the AI privateSaleValue already reflects condition (see prompt), so only
  // apply a light correction here. Order fixed: the <=5.5 branch was unreachable.
  if (conditionScore >= 8.8) center *= 1.02;
  else if (conditionScore <= 5.5) center *= 0.92;
  else if (conditionScore <= 6.5) center *= 0.96;

  if (enthusiast) rangeSpread += 0.01;
  if (photoCount < 4) rangeSpread += 0.025;
  if (needsWork) rangeSpread += 0.02;
  if (hasStrongHistory) rangeSpread -= 0.005;
  rangeSpread = clamp(rangeSpread, 0.06, 0.16);

  let low = center * (1 - rangeSpread);
  let high = center * (1 + rangeSpread);

  if (exoticAnchor) {
    // Soft-clamp to the anchor band — don't let estimates blow past it.
    low = clamp(low, exoticAnchor.low * 0.85, exoticAnchor.high);
    high = clamp(high, low * 1.04, exoticAnchor.high * 1.05);
  }

  const roundedCenter = roundToGrain(center);
  const roundedLow = roundToGrain(Math.min(low, roundedCenter));
  const roundedHigh = roundToGrain(Math.max(high, roundedCenter));

  const reasons = [
    mileageRatio <= 0.9 ? "lower-than-typical mileage for age" : mileageRatio >= 1.15 ? "above-average mileage for age" : "age-appropriate mileage",
    conditionScore >= 8 ? "strong visible condition" : conditionScore <= 6.4 ? "condition deductions" : "solid used-market condition",
    hasStrongHistory ? "good service history support" : "limited history evidence",
  ];
  if (enthusiast) reasons.push("healthy enthusiast demand for this spec");
  if (motSoon) reasons.push("an MOT date that may slightly temper offers");
  if (exoticAnchor) reasons.push("rare-market pricing anchored to current exotic transaction levels");

  const reasoning = `The range reflects ${reasons.join(", ")}. ${enthusiast && conditionScore >= 7.8 ? "Clean enthusiast examples can outperform book pricing in private sale." : ""}`.trim();

  return {
    center: roundedCenter,
    low: roundedLow,
    high: roundedHigh,
    confidence,
    reasoning,
    enthusiast,
  };
}
