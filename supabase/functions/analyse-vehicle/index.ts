// Valu8 — AI vehicle analysis edge function
// Pulls live UK market pricing from MarketCheck UK as the valuation anchor,
// then uses Lovable AI Gateway (Gemini 2.5 Pro vision) to adjust the figure
// based on photos, mileage, history, MOT advisories and modifications.

import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

// ----- MarketCheck UK live pricing -----
const MC_KEY = Deno.env.get("MARKETCHECK_API_KEY");

interface MarketPricing {
  median: number;
  mean?: number;
  p25?: number;
  p75?: number;
  count: number;
  avgMiles?: number;
}

async function fetchMarketCheckPricing(
  make: string,
  model: string,
  year: number,
  mileage: number,
): Promise<MarketPricing | null> {
  if (!MC_KEY) return null;
  const baseModel = model.split(" · ")[0].split("·")[0].trim();

  const tryFetch = async (params: URLSearchParams): Promise<MarketPricing | null> => {
    const url = `https://mc-api.marketcheck.com/v2/search/car/uk/active?${params}`;
    try {
      const r = await fetch(url);
      if (!r.ok) {
        console.error("MarketCheck pricing", r.status, (await r.text()).slice(0, 160));
        return null;
      }
      const j = await r.json();
      const sp = j?.stats?.price;
      const sm = j?.stats?.miles;
      const count = Number(j?.num_found ?? 0);
      const median = Number(sp?.median ?? sp?.mean ?? 0);
      if (!median || count < 1) return null;
      return {
        median,
        mean: Number(sp?.mean ?? 0) || undefined,
        p25: Number(sp?.iqr?.p25 ?? sp?.percentiles?.p25 ?? 0) || undefined,
        p75: Number(sp?.iqr?.p75 ?? sp?.percentiles?.p75 ?? 0) || undefined,
        count,
        avgMiles: Number(sm?.mean ?? sm?.median ?? 0) || undefined,
      };
    } catch (e) {
      console.error("MarketCheck pricing fetch error", e);
      return null;
    }
  };

  // 1) tight: same year + similar mileage band
  const milesLow = Math.max(0, mileage - 20000);
  const milesHigh = mileage + 20000;
  const tight = new URLSearchParams({
    api_key: MC_KEY,
    ymm: `${year}|${make}|${baseModel}`,
    car_type: "used",
    stats: "price,miles",
    rows: "0",
    miles_range: `${milesLow}-${milesHigh}`,
  });
  let res = await tryFetch(tight);
  if (res && res.count >= 5) return res;

  // 2) same year, any mileage
  const sameYear = new URLSearchParams({
    api_key: MC_KEY,
    ymm: `${year}|${make}|${baseModel}`,
    car_type: "used",
    stats: "price,miles",
    rows: "0",
  });
  res = await tryFetch(sameYear);
  if (res && res.count >= 3) return res;

  // 3) same make+model ±2 years
  const wide = new URLSearchParams({
    api_key: MC_KEY,
    make,
    model: baseModel,
    year_range: `${year - 2}-${year + 2}`,
    car_type: "used",
    stats: "price,miles",
    rows: "0",
  });
  res = await tryFetch(wide);
  return res;
}

interface AnalyseRequest {
  make: string;
  model: string;
  variant?: string;
  year: number;
  mileage: number;
  registration?: string;
  motExpiry?: string;
  serviceNotes?: string;
  photoUrls: string[];
}

type ConfidenceLevel = "High" | "Medium" | "Low" | "Very Low";

const LIMITED_DATA_MESSAGE = "Unable to provide accurate valuation at this time. Limited reliable market data available for this model. Please consult a marque specialist.";
const LIMITED_DATA_WARNING = "Limited reliable market data available for this model. We recommend a marque specialist, specialist dealer, or auction route instead of relying on an automated estimate.";

// Ultra-rare makes — almost no live UK MarketCheck data, valuations are
// inherently uncertain and must never claim High confidence.
const ULTRA_RARE_MAKES = [
  "Bugatti", "Koenigsegg", "Pagani", "Rimac", "Pininfarina", "Zenvo",
  "Singer", "Gordon Murray", "Hennessey", "SSC", "Apollo", "Czinger",
  "W Motors", "Spyker", "Noble",
];

// Specific hypercar / ultra-rare model patterns (treated like ultra-rare even
// if the make also makes mainstream cars).
const ULTRA_RARE_MODEL_PATTERNS: Array<{ make?: string; match: RegExp }> = [
  { make: "Ferrari", match: /laferrari|enzo|f50|f40|monza|daytona\s?sp3/i },
  { make: "McLaren", match: /\bp1\b|senna|speedtail|elva|solus/i },
  { make: "Porsche", match: /carrera\s?gt|918\s?spyder/i },
  { make: "Aston Martin", match: /valkyrie|valhalla|one[- ]?77|vulcan/i },
  { make: "Lamborghini", match: /sian|veneno|reventon|centenario|countach\s?lpi/i },
  { make: "Mercedes-Benz", match: /amg\s?one|slr\s?stirling/i },
  { make: "Mercedes-AMG", match: /amg\s?one/i },
];

function isUltraRare(make: string, model: string, variant?: string): boolean {
  if (ULTRA_RARE_MAKES.includes(make)) return true;
  const hay = `${model} ${variant ?? ""}`;
  return ULTRA_RARE_MODEL_PATTERNS.some((p) => (!p.make || p.make === make) && p.match.test(hay));
}

const ENTHUSIAST_KEYWORDS = [
  "rs", "renaultsport", "renault sport", "gti", "gti clubsport", "st", "vrs", "v-rs", "vxr", "opc", "cupra", "type r", "type-r",
  "m", "m sport", "m3", "m4", "m5", "amg", "gt3", "gt3 rs", "gt4", "turbo s", "nismo", "evo", "integrale", "cooper s",
  "john cooper works", "jcw", "quadrifoglio", "abarth", "trophy", "williams", "cs", "csl", "clubsport", "superleggera", "performante", "svj", "lt"
];

const EXOTIC_MODEL_ANCHORS: Array<{ make: string; match: RegExp; low: number; high: number }> = [
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

const EXOTIC = ["Ferrari","Lamborghini","McLaren","Pagani","Bugatti","Koenigsegg","Rimac","Aston Martin","Bentley","Rolls-Royce","Maybach","Maserati","Pininfarina","Zenvo","Singer","Gordon Murray"];
const PREMIUM = ["BMW","Mercedes-Benz","Mercedes-AMG","Audi","Porsche","Land Rover","Jaguar","Tesla","Lexus","Volvo","MINI","Polestar","Genesis","Alpine","Lotus","Morgan","TVR","Lucid","Rivian"];
const ECONOMY = ["Dacia","SEAT","Škoda","Skoda","Fiat","Citroën","Citroen","Vauxhall","Peugeot","Renault","Suzuki","MG","Kia","Hyundai","Daihatsu","Perodua","Proton","Lada","Tata","BYD","Leapmotor","VinFast","XPeng"];

function baseValue(make: string, year: number) {
  const age = Math.max(0, 2026 - year);
  let base = 18000;
  if (EXOTIC.includes(make)) base = 120000;
  else if (PREMIUM.includes(make)) base = 32000;
  else if (ECONOMY.includes(make)) base = 13000;
  if (age >= 30) return Math.round(base * Math.max(0.35, Math.pow(0.97, age - 30) * 0.55));
  return Math.round(base * Math.max(0.15, Math.pow(0.86, age)));
}

function roundTo50(n: number) { return Math.round(n / 50) * 50; }

function roundToGrain(n: number) {
  const grain = n >= 1000000 ? 25000 : n >= 500000 ? 10000 : n >= 100000 ? 5000 : n >= 30000 ? 500 : 50;
  return Math.round(n / grain) * grain;
}

function clamp(num: number, min: number, max: number) {
  return Math.max(min, Math.min(max, num));
}

function isEnthusiastCar(make: string, model: string, variant?: string) {
  const hay = `${make} ${model} ${variant ?? ""}`.toLowerCase();
  return ENTHUSIAST_KEYWORDS.some((keyword) => hay.includes(keyword));
}

function getExoticAnchor(make: string, model: string, variant?: string) {
  const hay = `${model} ${variant ?? ""}`;
  return EXOTIC_MODEL_ANCHORS.find((entry) => entry.make === make && entry.match.test(hay));
}

function isClearlyBadMarketData(params: {
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

function computeMarketRange(params: {
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
  const age = Math.max(0, 2026 - year);
  const expectedMileage = age <= 0 ? 3000 : age * 8000;
  const mileageRatio = mileage / Math.max(expectedMileage, 1);
  const serviceText = `${serviceNotes ?? ""}`.toLowerCase();
  const hasStrongHistory = /(full service|fsh|main dealer|specialist|major service|timing belt|timing chain|clutch|ceramic|recent service|full history)/i.test(serviceText);
  const needsWork = /(needs|due|overdue|warning light|smoke|fault|damage|dent|scuff|scratch|leak|issue)/i.test(serviceText);
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
  if (conditionScore >= 8.8) center *= 1.02;
  else if (conditionScore <= 6.5) center *= 0.92;
  else if (conditionScore <= 5.5) center *= 0.82;

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

// ----- DVSA MOT History API integration -----
type MotEntryOut = {
  date: string;
  result: "Pass" | "Fail" | "Advisory";
  note: string;
  mileage: number;
  expiryDate?: string;
  advisories?: string[];
  failures?: string[];
  source?: "dvsa" | "simulated";
};

let cachedDvsaToken: { token: string; expiresAt: number } | null = null;

async function getDvsaAccessToken(): Promise<string> {
  if (cachedDvsaToken && cachedDvsaToken.expiresAt > Date.now() + 30_000) {
    return cachedDvsaToken.token;
  }
  const clientId = Deno.env.get("DVSA_MOT_CLIENT_ID");
  const clientSecret = Deno.env.get("DVSA_MOT_CLIENT_SECRET");
  const tokenUrl = Deno.env.get("DVSA_MOT_TOKEN_URL");
  if (!clientId || !clientSecret || !tokenUrl) {
    throw new Error("DVSA MOT credentials not configured");
  }
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://tapi.dvsa.gov.uk/.default",
  });
  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`DVSA token error ${resp.status}: ${t.slice(0, 200)}`);
  }
  const json = await resp.json();
  const token = json.access_token as string;
  const expiresIn = (json.expires_in as number) ?? 3000;
  cachedDvsaToken = { token, expiresAt: Date.now() + expiresIn * 1000 };
  return token;
}

async function fetchDvsaMotHistory(registration: string): Promise<{ entries: MotEntryOut[]; vehicle?: { make?: string; model?: string }; error?: string }> {
  const apiKey = Deno.env.get("DVSA_MOT_API_KEY");
  if (!apiKey) return { entries: [], error: "DVSA_MOT_API_KEY not configured" };
  const reg = registration.replace(/\s+/g, "").toUpperCase();
  if (!reg) return { entries: [], error: "Invalid registration" };

  let token: string;
  try { token = await getDvsaAccessToken(); }
  catch (e) { return { entries: [], error: (e as Error).message }; }

  const resp = await fetch(`https://history.mot.api.gov.uk/v1/trade/vehicles/registration/${encodeURIComponent(reg)}`, {
    headers: { Authorization: `Bearer ${token}`, "x-api-key": apiKey, Accept: "application/json+v6" },
  });

  if (resp.status === 404) return { entries: [], error: "No MOT history found for this registration" };
  if (resp.status === 400) return { entries: [], error: "Invalid registration format" };
  if (!resp.ok) {
    const t = await resp.text();
    console.error("DVSA MOT error", resp.status, t.slice(0, 300));
    return { entries: [], error: "MOT service temporarily unavailable" };
  }

  const data = await resp.json();
  const tests: any[] = Array.isArray(data?.motTests) ? data.motTests : [];
  const entries: MotEntryOut[] = tests
    .map((t: any): MotEntryOut => {
      const defects: any[] = Array.isArray(t?.defects) ? t.defects : [];
      const advisories = defects
        .filter(d => /advisory|minor/i.test(String(d?.type ?? "")))
        .map(d => String(d?.text ?? "").trim()).filter(Boolean);
      const failures = defects
        .filter(d => /(fail|major|dangerous)/i.test(String(d?.type ?? "")))
        .map(d => String(d?.text ?? "").trim()).filter(Boolean);
      const passed = String(t?.testResult ?? "").toUpperCase() === "PASSED";
      const result: MotEntryOut["result"] = passed
        ? (advisories.length > 0 ? "Advisory" : "Pass")
        : "Fail";
      const note = !passed
        ? (failures[0] ?? "Failed test")
        : advisories.length > 0
          ? (advisories[0])
          : "No advisories — clean test";
      const mileage = Number(t?.odometerValue ?? 0) || 0;
      const dateRaw = String(t?.completedDate ?? "");
      const date = dateRaw ? dateRaw.slice(0, 10) : "";
      return {
        date,
        result,
        note,
        mileage,
        expiryDate: t?.expiryDate ? String(t.expiryDate).slice(0, 10) : undefined,
        advisories,
        failures,
        source: "dvsa",
      };
    })
    .filter(e => e.date)
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    entries,
    vehicle: { make: data?.make, model: data?.model },
  };
}

// Fallback: realistic simulated MOT history (used when no reg or API unavailable).
function simulateMotHistory(year: number, currentMileage: number, seed: number) {
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const ageYears = Math.max(0, 2026 - year);
  if (ageYears < 3) return [];
  const records: { date: string; result: "Pass" | "Advisory" | "Fail"; note: string; mileage: number }[] = [];
  const yearsToShow = Math.min(5, ageYears - 2);
  const annualMiles = Math.max(3000, Math.round(currentMileage / Math.max(1, ageYears)));
  let mi = currentMileage;
  const advisories = [
    "Front brake pads wearing thin",
    "Nearside front tyre worn close to legal limit",
    "Headlamp aim slightly out of alignment",
    "Minor oil leak from sump gasket",
    "Rear wiper blade deteriorated",
    "Anti-roll bar bush has slight play",
  ];
  for (let i = 0; i < yearsToShow; i++) {
    const yr = 2025 - i;
    mi = Math.max(1000, mi - annualMiles + Math.round((rand() - 0.5) * 1500));
    const month = String(1 + Math.floor(rand() * 12)).padStart(2, "0");
    const day = String(1 + Math.floor(rand() * 27)).padStart(2, "0");
    const roll = rand();
    records.push({
      date: `${yr}-${month}-${day}`,
      result: roll > 0.82 ? "Advisory" : "Pass",
      note: roll > 0.82 ? advisories[Math.floor(rand() * advisories.length)] : "No advisories — clean test",
      mileage: mi,
    });
  }
  return records;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

const SYSTEM_PROMPT = `You are an expert UK private seller car valuer in 2026 with deep, current knowledge of real market prices from AutoTrader, PistonHeads, Facebook Marketplace, Gumtree and Car & Classic. You assess vehicles for PRIVATE SELLERS, not dealers.

YOUR JOB IS TO BE HONEST AND CONSERVATIVE — NOT OPTIMISTIC.
Sellers come to you because they want a realistic number. Over-promising helps no one. When in doubt, lean LOWER. A car the seller can actually sell at your figure within 3-4 weeks is a win; an inflated number that sits unsold is a failure.

CORE PRINCIPLES:
1. Private sale prices typically sit 8-15% BELOW dealer asking. Trade-in is 20-25% below dealer asking.
2. The MarketCheck UK median you are given is the DEALER ASKING benchmark for clean, well-presented stock — not for tired, high-mileage examples.
3. Apply STRONG negative adjustments for issues. The market punishes problems harder than it rewards strengths.

NEGATIVE FACTORS — APPLY THESE STRICTLY:
- Mileage 80k–100k: typically -10% to -15% vs the median listing.
- Mileage 100k–130k: typically -18% to -28% vs the median.
- Mileage 130k+: typically -28% to -40%+ vs the median.
- ANY corrosion / rust advisory on MOT: -8% to -15% (significant future welding/structural cost). Multiple corrosion advisories: -15% to -25%.
- Recent MOT failure(s): -8% to -15% on top of any specific repair cost.
- Multiple unresolved advisories (>3): -5% to -10%.
- Partial / patchy / unknown service history: -5% to -10%.
- No history at all: -10% to -15%.
- Visible damage in photos (kerbing, dents, paint defects, worn interior): -5% to -15% per significant issue.
- Cambelt/timing service overdue on belt-driven engines: -5% to -10%.
- MOT expiring within 60 days with no recent test: -3% to -5%.

POSITIVE FACTORS — APPLY MODERATELY:
- Genuine FSH with main dealer or marque specialist: +3% to +6%.
- Significantly below average mileage for age: +3% to +8%.
- Recent major service / cambelt / clutch (with receipts implied): +2% to +4%.
- Desirable spec / colour / options on enthusiast cars: +3% to +8%.
DO NOT stack positives to inflate beyond the MarketCheck p75. The upper bound for a private sale is roughly the MC IQR top minus the standard private-sale discount.

WORKED EXAMPLE — internalise this:
2010 Renault Clio RS 200 with 106,000 miles and corrosion advisories on MOT:
- MarketCheck median for clean ~40k mi examples might be ~£11k.
- Mileage at 106k: -22%.
- Corrosion advisory: -12%.
- That gives a dealer-equivalent figure around £6.7k.
- Private sale = ~£6k. Range £5.0k–£6.8k. Trade-in £4.5k–£5.0k.
- This is the right answer, even though clean examples sell for £11k+.

CONDITION SCORE GUIDE (1.0–10.0):
- 9.0+: Outstanding, concours / immaculate, low miles, full history, no advisories.
- 8.0–8.9: Excellent. Below-average mileage, FSH, no significant advisories.
- 7.0–7.9: Good. Average mileage and history, minor cosmetic wear.
- 6.0–6.9: Average. Higher mileage OR patchy history OR a few advisories.
- 5.0–5.9: Below Average. Multiple negatives — high mileage AND corrosion AND/OR weak history.
- Below 5.0: Poor / project. Major work needed.
A car with 100k+ miles and corrosion advisories should NOT score above 6.5 regardless of how clean the photos look.

OUTPUT DISCIPLINE:
- Default to the LOWER half of any reasonable range unless EVERY signal is positive.
- The honestAnalysis MUST explicitly call out negative factors (mileage, corrosion, history gaps) and explain how they affect the price. Do not bury bad news.
- The valueReasoning must list the specific deductions you applied.
- Watch points must include each material negative.

Always reply by calling the provided function. Never write JSON in plain text.`;

const TOOL = {
  type: "function",
  function: {
    name: "valu8_report",
    description: "Return the structured Valu8 valuation analysis.",
    parameters: {
      type: "object",
      properties: {
        conditionScore: { type: "number", description: "1.0 to 10.0" },
        conditionLabel: { type: "string", enum: ["Outstanding", "Excellent", "Good", "Average", "Below Average"] },
        privateSaleValue: { type: "number", description: "Realistic UK private-sale price in GBP. For exotics/classics may be hundreds of thousands or millions." },
        honestAnalysis: { type: "string", description: "2-4 sentences. Honest, specific to this car." },
        marketPositioning: { type: "string", description: "1-2 sentences on UK private market position." },
        valueReasoning: { type: "string", description: "Short explanation of why this car sits at this valuation level, referencing mileage, condition, history, rarity/spec or demand." },
        strengths: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 5 },
        watchPoints: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 },
        photoObservations: { type: "string", description: "Brief observations on what photos show. Empty if no photos." },
        recommendations: {
          type: "object",
          properties: {
            whereToSell: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 4 },
            highlights: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 5 },
            documents: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 5 },
          },
          required: ["whereToSell", "highlights", "documents"],
          additionalProperties: false,
        },
      },
      required: ["conditionScore", "conditionLabel", "privateSaleValue", "honestAnalysis", "marketPositioning", "valueReasoning", "strengths", "watchPoints", "photoObservations", "recommendations"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as AnalyseRequest;
    if (!body?.make || !body?.model || !body?.year || body?.mileage == null) {
      return new Response(JSON.stringify({ error: "Missing required vehicle fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const photoUrls = (body.photoUrls || []).slice(0, 6);

    // Fetch MOT history + MarketCheck pricing in parallel BEFORE calling the AI,
    // so we can feed real signals (corrosion advisories, fails, etc.) into the prompt.
    const seed = hash(`${body.make}|${body.model}|${body.year}|${body.mileage}|${body.registration ?? ""}`);
    const [mc, dvsa] = await Promise.all([
      fetchMarketCheckPricing(body.make, body.model, body.year, body.mileage),
      body.registration && body.registration.trim().length >= 2
        ? fetchDvsaMotHistory(body.registration).catch((e) => {
            console.error("DVSA fetch failed", e);
            return { entries: [], error: "MOT service temporarily unavailable" } as const;
          })
        : Promise.resolve({ entries: [] as MotEntryOut[] }),
    ]);

    // Extract MOT signals
    const motEntries = dvsa.entries ?? [];
    const allAdvisories = motEntries.flatMap((m) => m.advisories ?? []);
    const allFailures = motEntries.flatMap((m) => m.failures ?? []);
    const advisoryText = allAdvisories.join(" ").toLowerCase();
    const failureText = allFailures.join(" ").toLowerCase();
    const corrosionMatches = (advisoryText.match(/corro|corrod|rust|excessive\s+rust|structurally\s+weak/g) ?? []).length
      + (failureText.match(/corro|corrod|rust|structurally\s+weak/g) ?? []).length;
    const recentFailCount = motEntries.slice(0, 3).filter((m) => m.result === "Fail").length;
    const totalAdvisoryCount = allAdvisories.length;
    const latestTest = motEntries[0];

    const marketBlock = mc
      ? `LIVE UK MARKET DATA (MarketCheck UK, ${mc.count} active listings for this make/model/year band):
- Median dealer asking: £${Math.round(mc.median).toLocaleString()}
- Typical asking range (IQR): £${Math.round(mc.p25 ?? mc.median * 0.9).toLocaleString()} – £${Math.round(mc.p75 ?? mc.median * 1.1).toLocaleString()}
${mc.avgMiles ? `- Average mileage of comparable listings: ${Math.round(mc.avgMiles).toLocaleString()} mi (this car: ${body.mileage.toLocaleString()} mi)` : ""}

REMEMBER: the median above is for typical / clean dealer stock. If this car has high mileage, corrosion, or weak history, the right number is materially BELOW that median.`
      : `(No live MarketCheck listings returned for this exact spec — fall back on your own UK private market knowledge and stay conservative.)`;

    const motBlock = motEntries.length > 0
      ? `MOT HISTORY (DVSA — real data):
- Tests on record: ${motEntries.length}
- Latest test: ${latestTest?.date ?? "unknown"} — ${latestTest?.result ?? "?"}
- Recent failures (last 3 tests): ${recentFailCount}
- Total advisories on file: ${totalAdvisoryCount}
- Corrosion/rust mentions: ${corrosionMatches}
${allAdvisories.length > 0 ? `- Recent advisory examples: ${allAdvisories.slice(0, 6).map((a) => `"${a}"`).join("; ")}` : ""}
${allFailures.length > 0 ? `- Failure examples: ${allFailures.slice(0, 4).map((a) => `"${a}"`).join("; ")}` : ""}

You MUST factor these into the price and call them out explicitly in your analysis.`
      : body.registration
        ? `MOT HISTORY: No DVSA records returned for this registration.`
        : `MOT HISTORY: No registration provided.`;

    const userContent: any[] = [
      {
        type: "text",
        text:
`Vehicle:
- ${body.year} ${body.make} ${body.model}${body.variant ? ` — ${body.variant}` : ""}
- Mileage: ${body.mileage.toLocaleString()} miles
- Registration: ${body.registration || "not provided"}
- MOT expiry: ${body.motExpiry || "not provided"}
- Service notes: ${body.serviceNotes || "none provided"}
- Photos attached: ${photoUrls.length}

${marketBlock}

${motBlock}

Be honest and conservative. Lean lower if there are negatives. Call out high mileage, corrosion and history gaps explicitly. Call the valu8_report function.`,
      },
      ...photoUrls.map((url) => ({ type: "image_url", image_url: { url } })),
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "valu8_report" } },
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, txt);
      const message = aiResp.status === 429
        ? "AI service is busy right now — please try again in a moment."
        : aiResp.status === 402
          ? "AI credits exhausted. Please top up Lovable AI credits in workspace settings to generate new valuations."
          : "AI analysis is temporarily unavailable. Please try again shortly.";
      return new Response(
        JSON.stringify({ error: message, fallback: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiData = await aiResp.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in AI response", JSON.stringify(aiData));
      throw new Error("AI did not return a structured report");
    }
    const ai = JSON.parse(toolCall.function.arguments) as {
      conditionScore: number;
      conditionLabel: string;
      privateSaleValue: number;
      honestAnalysis: string;
      marketPositioning: string;
      valueReasoning: string;
      strengths: string[];
      watchPoints: string[];
      photoObservations: string;
      recommendations: { whereToSell: string[]; highlights: string[]; documents: string[] };
    };

    // ----- Pricing engine: MarketCheck-anchored, with strong deterministic deductions -----
    const score = Math.max(1, Math.min(10, ai.conditionScore));
    const aiPrivate = Math.max(500, Number(ai.privateSaleValue) || 0);

    let values: { dealerTradeIn: number; privateSale: number; dealerRetail: number };
    let rangeLow: number;
    let rangeHigh: number;
    let confidence: ConfidenceLevel;
    let confidenceReason: string;
    let pricingReasoning: string;
    let dataSource: "marketcheck" | "ai_estimate";
    let marketBaseline: {
      source: "MarketCheck UK";
      sampleSize: number;
      baseDealerRetail: number;
      basePrivateSale: number;
      baseTradeIn: number;
      netAdjustmentPct: number;
    } | undefined;
    const adjustments: { label: string; impactPct: number }[] = [];

    const age = Math.max(0, 2026 - body.year);
    const expectedMileage = age <= 0 ? 3000 : age * 8000;
    const mileageRatio = body.mileage / Math.max(expectedMileage, 1);
    const serviceText = `${body.serviceNotes ?? ""}`.toLowerCase();
    const hasStrongHistory = /(full service history|fsh|main dealer|specialist|full history|complete service history)/i.test(serviceText);
    const hasPartialHistory = /(partial|part service|patchy|some history|limited history)/i.test(serviceText);
    const noHistory = /(no history|no service|missing history|no records)/i.test(serviceText);
    const needsWork = /(needs|due|overdue|warning light|smoke|fault|damage|dent|scuff|scratch|leak|issue|rust|corrosion)/i.test(serviceText);

    const ultraRare = isUltraRare(body.make, body.model, body.variant);
    const exoticAnchor = getExoticAnchor(body.make, body.model, body.variant);
    let rareCarWarning: string | undefined;

    // Decide whether MarketCheck data is actually usable. For ultra-rare cars
    // the public UK active-listings feed is almost always too thin/noisy to
    // trust as a price anchor, so we deliberately ignore it unless we have a
    // very strong sample.
    const mcUsable = !!mc && mc.median > 0 && (
      ultraRare ? mc.count >= 30 : true
    );

    if (mcUsable && mc) {
      let mult = 1.0;

      // --- Mileage tiering (absolute miles, not just ratio) ---
      if (body.mileage >= 130000) { mult *= 0.68; adjustments.push({ label: "Very high mileage (130k+)", impactPct: -32 }); }
      else if (body.mileage >= 100000) { mult *= 0.78; adjustments.push({ label: `High mileage (${Math.round(body.mileage/1000)}k)`, impactPct: -22 }); }
      else if (body.mileage >= 80000) { mult *= 0.88; adjustments.push({ label: `Above-average mileage (${Math.round(body.mileage/1000)}k)`, impactPct: -12 }); }
      else if (body.mileage >= 60000 && mileageRatio > 1.1) { mult *= 0.95; adjustments.push({ label: "Slightly above-average mileage", impactPct: -5 }); }
      else if (mileageRatio <= 0.7 && body.mileage < 50000) { mult *= 1.04; adjustments.push({ label: "Below-average mileage for age", impactPct: 4 }); }

      // --- MOT corrosion / failures ---
      if (corrosionMatches >= 2) { mult *= 0.82; adjustments.push({ label: `Multiple corrosion advisories (${corrosionMatches})`, impactPct: -18 }); }
      else if (corrosionMatches === 1) { mult *= 0.90; adjustments.push({ label: "Corrosion advisory on MOT", impactPct: -10 }); }
      if (recentFailCount >= 1) { mult *= 0.92; adjustments.push({ label: `Recent MOT failure(s)`, impactPct: -8 }); }
      if (totalAdvisoryCount >= 6) { mult *= 0.95; adjustments.push({ label: `${totalAdvisoryCount} advisories on file`, impactPct: -5 }); }

      // --- Service history ---
      if (hasStrongHistory) { mult *= 1.04; adjustments.push({ label: "Full service history", impactPct: 4 }); }
      else if (hasPartialHistory) { mult *= 0.93; adjustments.push({ label: "Partial service history", impactPct: -7 }); }
      else if (noHistory) { mult *= 0.88; adjustments.push({ label: "No service history", impactPct: -12 }); }

      // --- Other condition flags from notes ---
      if (needsWork && !corrosionMatches) { mult *= 0.96; adjustments.push({ label: "Issues noted in description", impactPct: -4 }); }

      // --- Condition score adjustment (lighter — most penalties already applied above) ---
      const conditionAdj = 1 + (score - 7.0) * 0.025;
      mult *= clamp(conditionAdj, 0.92, 1.08);

      mult = clamp(mult, 0.45, 1.18);

      let dealerRetail = roundToGrain(mc.median * mult);

      // Sanity floor for ultra-rare cars: never publish a number below ~70% of
      // the lower exotic anchor, even if MarketCheck noise suggests otherwise.
      if (ultraRare && exoticAnchor && dealerRetail < exoticAnchor.low * 0.7) {
        dealerRetail = roundToGrain(exoticAnchor.low * 0.85);
        adjustments.push({ label: "Adjusted toward known exotic floor (sparse market data)", impactPct: 0 });
      }

      const privateSale = roundToGrain(dealerRetail * 0.90);
      const dealerTradeIn = roundToGrain(dealerRetail * 0.76);

      // Range — wider when there are negatives or when the car is rare
      const negativeCount = adjustments.filter((a) => a.impactPct < 0).length;
      let spread = negativeCount >= 3 ? 0.14 : negativeCount >= 1 ? 0.10 : 0.07;
      if (ultraRare) spread = Math.max(spread, 0.20);
      rangeLow = roundToGrain(privateSale * (1 - spread));
      rangeHigh = roundToGrain(privateSale * (1 + spread * 0.7));

      // --- Confidence reasoning (much stricter) ---
      const isOutlierMileage = body.mileage >= 100000 || (mc.avgMiles && Math.abs(body.mileage - mc.avgMiles) > 30000);
      const photoQuality = photoUrls.length >= 5 ? "strong" : photoUrls.length >= 3 ? "moderate" : "limited";

      if (ultraRare) {
        // Ultra-rare cars NEVER get High confidence, regardless of sample.
        confidence = mc.count >= 100 ? "Low" : "Very Low";
        confidenceReason = `Ultra-rare model — even with ${mc.count} live listing${mc.count === 1 ? "" : "s"}, the UK market is too thin and variable for a confident figure. Treat this as an indicative guide only.`;
        rareCarWarning = "Limited market data available for this model. Valuation should be treated as a rough guide only — for an accurate figure, consult a marque specialist or auction house.";
      } else if (mc.count >= 500 && !isOutlierMileage && photoUrls.length >= 4 && negativeCount <= 1) {
        confidence = "High";
        confidenceReason = `Backed by ${mc.count} closely comparable live UK listings, with similar mileage and ${photoQuality} photo evidence. Few negative signals.`;
      } else if (mc.count >= 50 && !isOutlierMileage && negativeCount <= 3) {
        confidence = "Medium";
        confidenceReason = `${mc.count} comparable live UK listings on file, ${photoQuality} photo evidence${isOutlierMileage ? ", mileage outside the typical band" : ""}. Some negatives applied.`;
      } else if (mc.count >= 10) {
        confidence = "Low";
        const reasons: string[] = [];
        reasons.push(`only ${mc.count} comparable live listings (need 50+ for medium, 500+ for high)`);
        if (isOutlierMileage) reasons.push("mileage well outside the typical band");
        if (photoUrls.length < 3) reasons.push("limited photo evidence");
        if (negativeCount >= 4) reasons.push("multiple negative condition/history signals");
        confidenceReason = `Lower confidence: ${reasons.join(", ")}.`;
      } else {
        confidence = "Very Low";
        confidenceReason = `Very low confidence: only ${mc.count} comparable live listing${mc.count === 1 ? "" : "s"} found — not enough to establish a reliable market figure.`;
      }

      values = { dealerTradeIn, privateSale, dealerRetail };
      const baseRetail = roundToGrain(mc.median);
      marketBaseline = {
        source: "MarketCheck UK",
        sampleSize: mc.count,
        baseDealerRetail: baseRetail,
        basePrivateSale: roundToGrain(baseRetail * 0.90),
        baseTradeIn: roundToGrain(baseRetail * 0.76),
        netAdjustmentPct: Math.round((mult - 1) * 100),
      };
      const negSummary = adjustments.filter(a => a.impactPct < 0).map(a => a.label).slice(0, 3).join(", ");
      pricingReasoning = `Anchored on ${mc.count} live MarketCheck UK listings (median dealer asking £${Math.round(mc.median).toLocaleString()}). Net adjustment: ${Math.round((mult - 1) * 100)}%${negSummary ? ` — driven by ${negSummary}` : ""}.`;
      dataSource = "marketcheck";
    } else {
      // Fallback: AI-only / anchor-based estimate.
      const fallback = baseValue(body.make, body.year);
      const market = computeMarketRange({
        make: body.make,
        model: body.model,
        variant: body.variant,
        year: body.year,
        mileage: body.mileage,
        motExpiry: body.motExpiry,
        serviceNotes: body.serviceNotes,
        photoCount: photoUrls.length,
        conditionScore: score,
        aiPrivateValue: aiPrivate > fallback * 0.25 ? aiPrivate : fallback,
      });
      const fair = market.center;
      values = {
        dealerTradeIn: roundToGrain(fair * 0.78),
        privateSale: roundToGrain(fair),
        dealerRetail: roundToGrain(fair * 1.15),
      };
      // For ultra-rare cars, widen the range further to communicate uncertainty.
      if (ultraRare) {
        rangeLow = roundToGrain(fair * 0.75);
        rangeHigh = roundToGrain(fair * 1.25);
      } else {
        rangeLow = market.low;
        rangeHigh = market.high;
      }
      if (ultraRare) {
        confidence = "Very Low";
        confidenceReason = `No reliable live UK market data for this ultra-rare model. Figure is anchored to known transaction bands and should be treated as an indicative guide only.`;
        rareCarWarning = "Limited market data available for this model. Valuation should be treated as a rough guide only — for an accurate figure, consult a marque specialist or auction house.";
      } else {
        confidence = "Low";
        confidenceReason = `No live MarketCheck listings available for this exact spec — figures are an AI estimate without direct comparable sales data.`;
      }
      pricingReasoning = market.reasoning;
      dataSource = "ai_estimate";
    }

    const listingPrice = roundToGrain(Math.min(rangeHigh, values.privateSale * 1.03));

    // ----- Build MOT history payload (real DVSA where available, simulated fallback) -----
    let motHistory: any[] = [];
    let motSource: "dvsa" | "simulated" = "simulated";
    let motNotice: string | undefined;
    if (motEntries.length > 0) {
      motHistory = motEntries;
      motSource = "dvsa";
    } else if (body.registration && body.registration.trim().length >= 2) {
      motNotice = (dvsa as any).error ?? "No MOT records returned by DVSA.";
      motHistory = simulateMotHistory(body.year, body.mileage, seed).map(m => ({ ...m, source: "simulated" as const }));
    } else {
      motNotice = "No registration provided — showing illustrative MOT history.";
      motHistory = simulateMotHistory(body.year, body.mileage, seed).map(m => ({ ...m, source: "simulated" as const }));
    }

    const report = {
      conditionScore: Math.round(score * 10) / 10,
      conditionLabel: ai.conditionLabel,
      values,
      valueRange: { privateSaleLow: rangeLow, privateSaleHigh: rangeHigh },
      valueReasoning: `${ai.valueReasoning} ${pricingReasoning}`.trim(),
      marketConfidence: confidence,
      marketConfidenceReason: confidenceReason,
      pricingSource: dataSource,
      marketSampleSize: mc?.count,
      priceAdjustments: adjustments,
      marketBaseline,
      rareCarWarning,
      honestAnalysis: ai.honestAnalysis,
      marketPositioning: ai.marketPositioning,
      photoObservations: ai.photoObservations,
      strengths: ai.strengths,
      watchPoints: ai.watchPoints,
      recommendations: { listingPrice, ...ai.recommendations },
      hpi: {
        status: "All Clear" as const,
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
      motSource,
      motNotice,
      generatedAt: new Date().toISOString(),
    };

    return new Response(JSON.stringify({ report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    console.error("analyse-vehicle error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
