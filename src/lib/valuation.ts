// Deterministic mock valuation generator for Valu8 (test mode)
import { PHOTO_SLOTS } from "./cars";

export interface ValuationInput {
  make: string;
  model: string;
  year: number;
  mileage: number;
  registration?: string;
  motExpiry?: string;
  serviceNotes?: string;
  photoCount: number;
}

export interface MotEntry {
  date: string;
  result: "Pass" | "Advisory" | "Fail";
  note: string;
  mileage: number;
  expiryDate?: string;
  advisories?: string[];
  failures?: string[];
  source?: "dvsa" | "simulated";
}
export interface ValuationReport {
  conditionScore: number;
  conditionLabel: string;
  values: { dealerTradeIn: number; privateSale: number; dealerRetail: number };
  valueRange?: { privateSaleLow: number; privateSaleHigh: number };
  valueReasoning?: string;
  marketConfidence?: "High" | "Medium" | "Low";
  honestAnalysis: string;
  marketPositioning: string;
  photoObservations?: string;
  strengths: string[];
  watchPoints: string[];
  recommendations: { listingPrice: number; whereToSell: string[]; highlights: string[]; documents: string[] };
  hpi: { status: "All Clear" | "Needs Review"; checks: { label: string; ok: boolean }[] };
  motHistory: MotEntry[];
  generatedAt: string;
}

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}
function rand(seed: number) { return () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }

const PREMIUM = ["BMW","Mercedes-Benz","Audi","Porsche","Land Rover","Jaguar","Tesla","Lexus","Volvo","MINI","Bentley","Aston Martin","Maserati","Ferrari","Lamborghini","Rolls-Royce","McLaren","Polestar","Genesis"];
const ECONOMY = ["Dacia","SEAT","Škoda","Fiat","Citroën","Vauxhall","Peugeot","Renault","Suzuki","MG","Kia","Hyundai"];

function baseValue(make: string, year: number) {
  const age = Math.max(0, 2026 - year);
  let base = 18000;
  if (PREMIUM.includes(make)) base = 32000;
  else if (ECONOMY.includes(make)) base = 13000;
  // depreciation curve
  const retained = Math.max(0.15, Math.pow(0.86, age));
  return Math.round(base * retained);
}

export function generateValuation(input: ValuationInput): ValuationReport {
  const seed = hash(`${input.make}|${input.model}|${input.year}|${input.mileage}|${input.registration ?? ""}`);
  const r = rand(seed);

  const expectedMileage = (2026 - input.year) * 8500;
  const mileageRatio = input.mileage / Math.max(expectedMileage, 1);
  // condition baseline 6.0..9.2, modulated by mileage and photo completeness
  const photoBoost = (input.photoCount / PHOTO_SLOTS.length) * 0.6;
  const mileagePenalty = Math.min(1.6, Math.max(-0.6, (mileageRatio - 1) * 1.2));
  const noisy = (r() - 0.5) * 0.6;
  let score = 7.6 + photoBoost - mileagePenalty + noisy;
  score = Math.max(4.5, Math.min(9.6, score));
  score = Math.round(score * 10) / 10;

  const conditionLabel =
    score >= 9 ? "Outstanding" :
    score >= 8 ? "Excellent" :
    score >= 7 ? "Good" :
    score >= 6 ? "Average" : "Below Average";

  const base = baseValue(input.make, input.year);
  const conditionMultiplier = 0.7 + (score / 10) * 0.55; // 0.7..~1.23
  const mileageMultiplier = Math.max(0.55, Math.min(1.15, 1 - (mileageRatio - 1) * 0.18));
  const fair = Math.round(base * conditionMultiplier * mileageMultiplier);

  const dealerTradeIn = Math.round(fair * 0.82 / 50) * 50;
  const privateSale = Math.round(fair / 50) * 50;
  const dealerRetail = Math.round(fair * 1.16 / 50) * 50;
  const privateSaleLow = Math.round((privateSale * 0.95) / 50) * 50;
  const privateSaleHigh = Math.round((privateSale * 1.08) / 50) * 50;

  const strengthsPool = [
    "Photos suggest well-kept paintwork with no obvious panel damage",
    "Mileage tracks reasonably for the vehicle's age",
    "Interior presentation looks tidy and unmarked",
    "Service notes indicate consistent ownership care",
    "Desirable specification for the UK private market",
    "Strong residual values for this make and model",
  ];
  const watchPool = [
    "Verify cambelt/service intervals before listing — buyers will ask",
    "Check tyre tread depth across all four corners",
    "MOT expiry date is approaching — consider re-testing before sale",
    "Stone chips on the bonnet are typical at this age — be transparent",
    "Mileage is slightly above average — emphasise condition to offset",
    "Battery health is worth checking on stop-start models",
  ];
  const pick = (arr: string[], n: number) => [...arr].sort(() => r() - 0.5).slice(0, n);

  const honestAnalysis =
    `Your ${input.year} ${input.make} ${input.model} sits in the ${conditionLabel.toLowerCase()} bracket of the current UK market. ` +
    `With ${input.mileage.toLocaleString()} miles on the clock — ${mileageRatio < 0.9 ? "below" : mileageRatio > 1.15 ? "above" : "in line with"} ` +
    `the ~${expectedMileage.toLocaleString()} miles expected for its age — the strongest play is a private sale. ` +
    `Buyers in this segment respond best to a clear story: full photos, honest history, and a defensible price.`;

  const marketPositioning =
    score >= 8
      ? "Top quartile for the model. Price confidently — quality examples sell quickly to private buyers right now."
      : score >= 7
      ? "Mid-to-upper market position. Realistic asking prices generate fast enquiries; aggressive pricing risks low offers."
      : "Value-end of the market. Lead on honesty and recent maintenance to build buyer trust.";

  // MOT history (simulated)
  const motHistory: MotEntry[] = [];
  let curMileage = input.mileage;
  for (let i = 0; i < Math.min(5, 2026 - input.year); i++) {
    const yr = 2025 - i;
    curMileage = Math.max(1000, Math.round(curMileage - expectedMileage / Math.max(1, 2026 - input.year)));
    const roll = r();
    motHistory.push({
      date: `${yr}-${String(Math.ceil(r() * 12)).padStart(2, "0")}-${String(Math.ceil(r() * 27)).padStart(2, "0")}`,
      result: roll > 0.85 ? "Advisory" : "Pass",
      note: roll > 0.85 ? "Front brake pads wearing thin" : "No advisories — clean test",
      mileage: curMileage,
    });
  }

  return {
    conditionScore: score,
    conditionLabel,
    values: { dealerTradeIn, privateSale, dealerRetail },
    valueRange: { privateSaleLow, privateSaleHigh },
    valueReasoning:
      `This range reflects ${mileageRatio < 0.95 ? "below-average mileage" : mileageRatio > 1.1 ? "higher mileage for age" : "age-appropriate mileage"}, ` +
      `${score >= 8 ? "strong visible condition" : "typical used-market condition"}, and the strength of private-buyer demand for this type of car.`,
    marketConfidence: input.photoCount >= 5 ? "High" : input.photoCount >= 3 ? "Medium" : "Low",
    honestAnalysis,
    marketPositioning,
    strengths: pick(strengthsPool, 4),
    watchPoints: pick(watchPool, 3),
    recommendations: {
      listingPrice: Math.round((privateSale * 1.04) / 50) * 50,
      whereToSell: ["AutoTrader (premium listing)", "PistonHeads (enthusiast models)", "Facebook Marketplace (local buyers)", "Car & Classic (modern classics)"],
      highlights: ["Service history & receipts", "Recent MOT with no advisories", "Original paint & matching panels", "Two keys & full handbook"],
      documents: ["V5C log book", "Service book / digital service record", "MOT certificates", "Recent receipts (last 12 months)"],
    },
    hpi: {
      status: "All Clear",
      checks: [
        { label: "Outstanding finance", ok: true },
        { label: "Insurance write-off", ok: true },
        { label: "Stolen marker", ok: true },
        { label: "Mileage discrepancy", ok: true },
        { label: "Plate transfers", ok: true },
        { label: "VIN integrity", ok: true },
      ],
    },
    motHistory,
    generatedAt: new Date().toISOString(),
  };
}
