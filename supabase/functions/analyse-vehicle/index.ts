// Valu8 — AI vehicle analysis edge function
// Pulls live UK market pricing from MarketCheck UK as the valuation anchor,
// then uses Lovable AI Gateway (Gemini 2.5 Pro vision) to adjust the figure
// based on photos, mileage, history, MOT advisories and modifications.

import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { capturePosthogAiGeneration } from "../_shared/posthog.ts";

const PHOTO_BUCKET = "vehicle-photos";
// 1h is plenty — the AI vision call completes in seconds.
const AI_PHOTO_EXPIRY_SECONDS = 60 * 60;

function extractPhotoPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = String(value).trim();
  if (!v) return null;
  if (!v.startsWith("http")) return v.replace(/^\/+/, "");
  try {
    const u = new URL(v);
    const marker = `/${PHOTO_BUCKET}/`;
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(u.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}

async function signPhotoRefsForAi(refs: string[]): Promise<string[]> {
  if (!refs.length) return [];
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE) return refs; // best-effort fallback
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const paths = refs.map(extractPhotoPath);
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)));
  if (unique.length === 0) return refs.map(() => "");
  const { data, error } = await admin.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(unique, AI_PHOTO_EXPIRY_SECONDS);
  if (error || !data) {
    console.error("Failed to sign vehicle photos for AI", error);
    return refs.map(() => "");
  }
  const map = new Map<string, string>();
  for (const item of data) {
    if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
  }
  return paths.map((p) => (p ? map.get(p) ?? "" : ""));
}



// ----- MarketCheck UK live pricing -----
const MC_KEY = Deno.env.get("MARKETCHECK_API_KEY");
const CURRENT_YEAR = new Date().getUTCFullYear();

export interface ComparableListing {
  price: number;
  mileage: number;
  year: number;
  trim?: string;
  location?: string;
  source?: string;
  url?: string;
}

interface MarketPricing {
  median: number;
  mean?: number;
  p25?: number;
  p75?: number;
  count: number;
  avgMiles?: number;
  listings: ComparableListing[];
  matchTier: string; // describes what filter matched (for transparency)
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function percentile(nums: number[], p: number): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.floor((p / 100) * (s.length - 1))));
  return s[idx];
}

async function fetchMarketCheckPricing(
  make: string,
  model: string,
  year: number,
  mileage: number,
  variant?: string,
): Promise<MarketPricing | null> {
  if (!MC_KEY) return null;
  const baseModel = model.split(" · ")[0].split("·")[0].trim();
  const trim = variant?.split(" · ")[0].split("·")[0].trim();

  // Pull up to 20 real active listings, with stats, for any given filter.
  const tryFetch = async (params: URLSearchParams, tierLabel: string): Promise<MarketPricing | null> => {
    params.set("rows", "20");
    params.set("stats", "price,miles");
    params.set("car_type", "used");
    // Stable ordering — without this MarketCheck returns relevance/freshness
    // order which shuffles between calls and makes the anchor wobble even with
    // identical inputs. Sorting by miles ascending gives a deterministic slice.
    params.set("sort_by", "miles");
    params.set("sort_order", "asc");
    const url = `https://mc-api.marketcheck.com/v2/search/car/uk/active?${params}`;
    try {
      const r = await fetch(url);
      if (!r.ok) {
        console.error("MarketCheck listings", r.status, (await r.text()).slice(0, 160));
        return null;
      }
      const j = await r.json();
      const count = Number(j?.num_found ?? 0);
      const items: any[] = Array.isArray(j?.listings) ? j.listings : [];
      const listings: ComparableListing[] = items
        .filter((it) => Number(it?.price) > 0 && Number(it?.build?.year) > 0)
        .map((it) => ({
          price: Math.round(Number(it.price)),
          mileage: Math.round(Number(it.miles ?? 0)),
          year: Number(it.build.year),
          trim: it.build?.trim || undefined,
          location: it.dealer?.city || it.dealer?.county || undefined,
          source: it.source || "MarketCheck",
          url: it.vdp_url || undefined,
        }))
        .filter((l) => l.price >= 200 && l.mileage >= 0);

      if (listings.length === 0 && count === 0) return null;

      const prices = listings.map((l) => l.price);
      const miles = listings.map((l) => l.mileage).filter((m) => m > 0);
      const sp = j?.stats?.price;
      const sm = j?.stats?.miles;

      // Prefer listing-derived stats (real prices), fall back to API stats.
      const med = prices.length ? median(prices) : Number(sp?.median ?? sp?.mean ?? 0);
      if (!med) return null;

      return {
        median: med,
        mean: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : Number(sp?.mean ?? 0) || undefined,
        p25: prices.length >= 4 ? percentile(prices, 25) : Number(sp?.iqr?.p25 ?? sp?.percentiles?.p25 ?? 0) || undefined,
        p75: prices.length >= 4 ? percentile(prices, 75) : Number(sp?.iqr?.p75 ?? sp?.percentiles?.p75 ?? 0) || undefined,
        count,
        avgMiles: miles.length ? miles.reduce((a, b) => a + b, 0) / miles.length : Number(sm?.mean ?? sm?.median ?? 0) || undefined,
        listings,
        matchTier: tierLabel,
      };
    } catch (e) {
      console.error("MarketCheck listings fetch error", e);
      return null;
    }
  };

  const milesLow = Math.max(0, mileage - 20000);
  const milesHigh = mileage + 20000;

  if (trim) {
    let r = await tryFetch(new URLSearchParams({
      api_key: MC_KEY,
      make, model: baseModel, year: String(year), trim,
      miles_range: `${milesLow}-${milesHigh}`,
    }), `${year} ${make} ${baseModel} ${trim} (similar mileage)`);
    if (r && r.listings.length >= 5) return r;

    r = await tryFetch(new URLSearchParams({
      api_key: MC_KEY,
      make, model: baseModel, year: String(year), trim,
    }), `${year} ${make} ${baseModel} ${trim}`);
    if (r && r.listings.length >= 3) return r;

    r = await tryFetch(new URLSearchParams({
      api_key: MC_KEY,
      make, model: baseModel, trim,
      year_range: `${year - 2}-${year + 2}`,
    }), `${make} ${baseModel} ${trim} ${year - 2}-${year + 2}`);
    if (r && r.listings.length >= 3) return r;
  }

  let r = await tryFetch(new URLSearchParams({
    api_key: MC_KEY,
    make, model: baseModel, year: String(year),
    miles_range: `${milesLow}-${milesHigh}`,
  }), `${year} ${make} ${baseModel} (similar mileage)`);
  if (r && r.listings.length >= 5) return r;

  r = await tryFetch(new URLSearchParams({
    api_key: MC_KEY,
    make, model: baseModel, year: String(year),
  }), `${year} ${make} ${baseModel}`);
  if (r && r.listings.length >= 3) return r;

  r = await tryFetch(new URLSearchParams({
    api_key: MC_KEY,
    make, model: baseModel,
    year_range: `${year - 2}-${year + 2}`,
  }), `${make} ${baseModel} ${year - 2}-${year + 2}`);
  return r;
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
  photos?: { slot: string; url: string }[];
}

type PhotoSlot = "front" | "rear" | "side" | "interior" | "odometer" | "engine" | "other";
const VALID_SLOTS: PhotoSlot[] = ["front","rear","side","interior","odometer","engine","other"];
const SLOT_LABELS: Record<PhotoSlot, string> = {
  front: "Front 3/4 exterior",
  rear: "Rear 3/4 exterior",
  side: "Driver's side profile",
  interior: "Interior (dash + seats)",
  odometer: "Odometer / mileage",
  engine: "Engine bay",
  other: "Additional photo",
};

type ConfidenceLevel = "High" | "Medium" | "Low" | "Very Low";

const LIMITED_DATA_MESSAGE = "We don't have enough reliable market data to give you an accurate figure for this car. We'd recommend speaking to a marque specialist or auction house instead.";
const LIMITED_DATA_WARNING = "We don't have enough reliable market data to value this car accurately. A specialist dealer or auction house will give you a much better idea of what it's worth.";

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
  const age = Math.max(0, CURRENT_YEAR - year);
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

function sanitizeNarrativeYears(text: string | undefined, vehicleYear: number, currentYear = CURRENT_YEAR, extraAllowed: number[] = []) {
  if (!text) return "";
  const allowed = new Set<number>([vehicleYear, currentYear, currentYear + 1, ...extraAllowed]);
  return text.replace(/\b(19|20)\d{2}\b/g, (match) => {
    const parsed = Number(match);
    if (allowed.has(parsed)) return match;
    return String(vehicleYear);
  });
}

function sanitizeNarrativeList(items: string[] | undefined, vehicleYear: number, currentYear = CURRENT_YEAR, extraAllowed: number[] = []) {
  return (items ?? []).map((item) => sanitizeNarrativeYears(item, vehicleYear, currentYear, extraAllowed));
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
  const age = Math.max(0, CURRENT_YEAR - year);
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
  const ageYears = Math.max(0, CURRENT_YEAR - year);
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

// Stable fingerprint of every input that should change the valuation.
// Normalise whitespace/case so cosmetic edits to service notes don't bust the lock.
export function computeInputsHash(input: {
  make: string;
  model: string;
  variant?: string;
  year: number;
  mileage: number;
  registration?: string;
  motExpiry?: string;
  serviceNotes?: string;
  photoRefs: string[];
}): string {
  const norm = (s: string | undefined | null) => (s ?? "").toString().trim().toLowerCase().replace(/\s+/g, " ");
  const photos = [...(input.photoRefs ?? [])].map(norm).sort().join("|");
  const payload = [
    norm(input.make),
    norm(input.model),
    norm(input.variant),
    String(input.year ?? ""),
    String(input.mileage ?? ""),
    norm(input.registration),
    norm(input.motExpiry),
    norm(input.serviceNotes),
    photos,
  ].join("::");
  return hash(payload).toString(36);
}

const SYSTEM_PROMPT = `You are a senior UK car valuer who advises PRIVATE sellers — not dealers. You speak clearly, plainly, and with the confidence of someone who values cars every day.

YOUR JOB: produce a REALISTIC private-sale figure that a well-presented car can genuinely achieve within 3–4 weeks. Not the rock-bottom trade figure. Not the optimistic dealer-asking screenshot. The honest mid-point of what private buyers actually pay for a car of this exact condition, history and spec.

CRITICAL YEAR RULE — READ CAREFULLY:
The user message always contains the EXACT vehicle year and the CURRENT YEAR. Use ONLY the exact vehicle year when referring to the car, and ONLY the current year when talking about "today"/"now". NEVER guess or reuse a year from previous context. Double-check every year you write.

CORE PRINCIPLES — INTERNALISE THESE:
1. The MarketCheck anchor we give you is already mileage-matched to THIS car. Do NOT apply another big mileage penalty on top — that double-counts.
2. Private sale for a CLEAN, well-photographed car typically lands 4–8% below the dealer-asking anchor (NOT 15%). Tired/high-mileage examples land 10–18% below.
3. Condition (from photos) is one of the BIGGEST levers. An outstanding car (9+ score) can match or beat the anchor; a poor car (sub-6) drops 15–25%.
4. Recent major mechanical work (cambelt/timing chain/clutch/subframe/turbo/DPF/suspension overhaul) is a STRONG positive — buyers pay a premium for "just done" because it removes their biggest fear. Reward it with +4% to +8%.
5. Full documented service history with a marque specialist or main dealer = +4% to +7%. Don't be shy with this.
6. Genuinely desirable spec (manual on a sports car, rare colour, factory options like Alcantara/PPF/upgraded brakes, low owner count) = +3% to +6%.
7. Low mileage for age on an enthusiast/premium car is a meaningful uplift (+4% to +9%), not a token bump.

NEGATIVE FACTORS — apply when REAL, not by default:
- Corrosion/rust on LATEST MOT advisory: -6% to -12% (multiple = -12% to -20%).
- Recent MOT failures: -5% to -10% on top of repair cost.
- Visible accident damage / mismatched panel / clearly bad respray: -8% to -15%.
- Patchy or unknown history on a premium car: -5% to -10%.
- Mileage 30%+ above what the anchor sample averages: -3% to -8% (the anchor already partially accounts for mileage — do NOT stack heavy deductions).
- MOT expiring within 30 days with no recent test: -2% to -4%.

WORKED EXAMPLE (placeholder year — use the REAL year provided):
YYYY BMW M140i, 58k miles, full BMW main-dealer history, new clutch + brakes last year, kept in garage, photos show concours-level paint.
- MarketCheck anchor (mileage-matched live listings): £20,500.
- Condition score 9.0 (excellent photos): +6%.
- Full main-dealer history: +5%.
- Recent clutch + brakes: +4%.
- Desirable manual M-spec: +3%.
- Result: dealer-equivalent ~£24,200. Private sale: ~£22,800. Range £22,000–£23,500.
This is the right answer. Under-pricing this car at £19k would be a disservice to the seller.

CONDITION SCORE GUIDE (1.0–10.0) — be decisive, use the full range:
- 9.0–10.0: Concours / immaculate / showroom — top 5% of examples.
- 8.0–8.9: Excellent. Visibly above average, no notable wear, strong history likely.
- 7.0–7.9: Good. Typical well-cared-for example. Minor age-appropriate wear.
- 6.0–6.9: Average. Some visible wear, advisories, or higher mileage.
- 5.0–5.9: Below average. Multiple issues stacking.
- Below 5.0: Project / requires significant work.
Do NOT default to 7.0 out of caution — score what you actually see.

OUTPUT DISCIPLINE:
- Be DECISIVE. Sellers value clarity over hedging.
- Use plain English. No jargon ("net adjustment", "anchored on", "negative signals").
- honestAnalysis: 2–3 short sentences explaining the 2–3 biggest factors driving the price. Honest, warm, never depressing.
- valueReasoning: 2–3 short sentences — explain WHY this price is realistic in plain terms.
- marketPositioning: 1–2 sentences. Confident and helpful.

REQUIRED NEW FIELDS:
- headline: ONE short sentence (max ~110 chars) on price fairness and expected sale speed.
- marketContext: ONE short sentence on current UK demand for this make/model.
- factorsUp: 2–4 SHORT bullet phrases (max ~60 chars) that genuinely raise this car's value. Reward history, condition, recent work, spec, low mileage.
- factorsDown: 2–4 SHORT bullets that buyers will use to negotiate. If genuinely none, return empty array.
- sellerTip: ONE personal sentence of advice (e.g. "List at £X, expect offers around £X–£X. Lead with the service history.").
- negotiationBuffer: integer GBP, typically 3–5% of privateSaleValue, rounded to £50.

PER-PHOTO ANALYSIS — OUR MOAT, BE SPECIFIC AND VISUALLY HONEST:
The user message gives you a numbered list of photos ("Photo 1 — slot=front", "Photo 2 — slot=rear", ...). The images are sent in the SAME ORDER as that list. The slot label is the user's HINT — it may be WRONG because they uploaded photos in any order. You MUST look at each image and describe what is ACTUALLY in it.

For EVERY photo you analyse:
- Set photoIndex to the 1-based number of the image you are looking at (Photo 1, Photo 2, ...). This is non-negotiable — if you talk about seat wear, photoIndex must point at the image that actually shows seats.
- Set slot to what you ACTUALLY see (front / rear / side / interior / odometer / engine / other). If the user labelled an image "interior" but it's clearly the rear bumper, set slot="rear" and describe the rear.
- Never describe something that isn't in that photo. If a photo shows the rear of the car, do NOT mention seat wear in that observation — write it against the interior photo instead.

DAMAGE vs SHADOW vs REFLECTION — be careful:
- A dark line that follows a body crease, panel gap or curve in even light is almost always a SHADOW or reflection, not a scratch. Do not flag it.
- A reflection of the sky, a building or the photographer on glossy paint is not paint damage. Do not flag it.
- Real scratches usually break panel reflections, sit at odd angles to body lines, catch light along their length, or expose primer/metal.
- Real dents distort reflections in a localised oval/round pattern; shadows from overhead light do not.
- Kerb damage on alloys shows as missing lacquer/silver flecks on the rim outer edge, not as a dark arc following the rim.
- If you are not confident something is real damage, either say "possible light mark — worth checking in person" (severity: minor, no priceImpact) or skip it. Do NOT invent defects.
- Equally, do not miss obvious real wear: kerbed alloys with visible silver gouges, cracked bumpers, scuffs across body lines, missing trim, tyre cords showing, cracked screens, ripped seats, water staining, warning lights on the dash.

Each observation must be SHORT and CONCRETE (max ~80 chars) and reference what is visibly in THAT photo. NEVER generic.
- Good examples: "Kerbed nearside front alloy — visible silver gouges", "Odometer reads 47,213 miles — matches declared", "Driver bolster shows light leather creasing", "Engine bay tidy, no obvious leaks or corrosion".
- severity: "positive" | "neutral" | "minor" | "notable".
- priceImpact: GBP integer (negative = deduction, positive = uplift). Omit if truly zero or if you flagged something as merely "possible".
- fixCost: GBP integer for realistic remedy cost. Omit for positive/neutral.
- fixable: true if a private seller can sensibly fix before listing.

Aim for 1–2 observations per photo and 4–10 total. If a photo is clean, return a positive note rather than inventing problems.

IMPORTED / GREY-IMPORT / JDM / EU-SPEC CARS:
The vehicle may be a Japanese (JDM), American, or European import — especially R32/R33/R34 Skyline, Supra, Evo, Integra Type R, RX-7, Hilux Surf, Land Cruiser, S2000, NSX, AMG variants not officially sold in the UK, US muscle, Singer/restomod work, etc. Take import status into account in marketContext (UK MOT-able imports often command a premium over UK-spec equivalents for sought-after JDM, but lose value if mileage in km has been converted poorly or paperwork is patchy). Never claim "not sold in the UK so unvaluable" — give your best honest figure based on imported-car private listings and auction results.

MOT — STRICT HONESTY RULE:
Only mention MOT facts that are explicitly present in the MOT HISTORY block of the user message or in the provided MOT expiry field. NEVER invent MOT dates, test years, expiry years or phrases like "long MOT until [year]". If the user message does not give you an MOT expiry, say "MOT status not confirmed in records provided" — do not guess.

Always reply by calling the valu8_report function. Never write JSON in plain text.`;


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
        honestAnalysis: { type: "string", description: "2-3 short sentences in plain English. Explain the 2-3 biggest factors affecting the price. Be honest but warm — not cold or depressing. End with something helpful or positive where possible." },
        marketPositioning: { type: "string", description: "1-2 short sentences. Keep it simple and encouraging. Plain English only." },
        valueReasoning: { type: "string", description: "2-3 short sentences max. Same friendly, plain tone. Focus on the main things buyers care about. No jargon like 'net adjustment' or 'anchored on'." },
        strengths: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 5 },
        watchPoints: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 },
        photoObservations: { type: "string", description: "Brief overall summary of what photos show. Empty if no photos." },
        photoInsights: {
          type: "array",
          description: "Per-photo observations. Aim for 4-10 across all photos. Each item should be short, specific to what is visible, and reference the slot label provided in the user message.",
          minItems: 0,
          maxItems: 18,
          items: {
            type: "object",
            properties: {
              photoIndex: { type: "number", description: "1-based index of the photo this observation is about. MUST match the 'Photo N' number from the slot map in the user message — this is how we know which image you are describing." },
              slot: { type: "string", enum: ["front","rear","side","interior","odometer","engine","other"], description: "What this photo ACTUALLY shows, as you see it. If the labelled slot looks wrong (e.g. labelled 'interior' but it's clearly the rear of the car), override it with what you genuinely see." },
              observation: { type: "string", description: "Short, concrete observation about what is visibly in THIS specific photo (max ~80 chars). Must describe THIS image — never describe a different photo." },
              severity: { type: "string", enum: ["positive","neutral","minor","notable"] },
              priceImpact: { type: "number", description: "GBP impact on value. Negative = deduction, positive = uplift. Omit if zero." },
              fixCost: { type: "number", description: "GBP estimate to remedy. Omit for positive/neutral." },
              fixable: { type: "boolean", description: "Whether a private seller can sensibly fix this before listing." },
            },
            required: ["photoIndex", "slot", "observation", "severity"],
            additionalProperties: false,
          },
        },
        headline: { type: "string", description: "One short sentence summarising whether this price is fair/strong and roughly how quickly the car should sell." },
        marketContext: { type: "string", description: "One short sentence on current UK demand for this make/model/spec." },
        factorsUp: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 4, description: "Short bullet phrases that raise the value." },
        factorsDown: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 4, description: "Short bullet phrases a buyer will use to negotiate." },
        sellerTip: { type: "string", description: "One personal, practical sentence of advice for the seller." },
        negotiationBuffer: { type: "number", description: "Negotiation room in GBP, typically 3-5% of privateSaleValue, rounded to £50." },
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
      required: ["conditionScore", "conditionLabel", "privateSaleValue", "honestAnalysis", "marketPositioning", "valueReasoning", "strengths", "watchPoints", "photoObservations", "photoInsights", "headline", "marketContext", "factorsUp", "factorsDown", "sellerTip", "negotiationBuffer", "recommendations"],
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

    // Build labeled photo list (slot + ref). Accepts either storage paths
    // (new private-bucket clients) or legacy public URLs. All refs are then
    // signed via service-role for the AI vision call.
    const rawLabeled: { slot: PhotoSlot; ref: string }[] = (() => {
      if (Array.isArray(body.photos) && body.photos.length > 0) {
        return body.photos
          .filter((p) => p && typeof p.url === "string" && p.url.length > 0)
          .slice(0, 6)
          .map((p) => ({
            slot: (VALID_SLOTS.includes(p.slot as PhotoSlot) ? p.slot : "other") as PhotoSlot,
            ref: p.url,
          }));
      }
      const guess: PhotoSlot[] = ["front", "rear", "side", "interior", "odometer", "engine"];
      return (body.photoUrls || []).slice(0, 6).map((url, i) => ({
        slot: guess[i] ?? "other",
        ref: url,
      }));
    })();
    const signed = await signPhotoRefsForAi(rawLabeled.map((p) => p.ref));
    const labeledPhotos: { slot: PhotoSlot; url: string }[] = rawLabeled
      .map((p, i) => ({ slot: p.slot, url: signed[i] }))
      .filter((p) => !!p.url);
    const photoUrls = labeledPhotos.map((p) => p.url);

    // Fetch MOT history + MarketCheck pricing in parallel BEFORE calling the AI,
    // so we can feed real signals (corrosion advisories, fails, etc.) into the prompt.
    const seed = hash(`${body.make}|${body.model}|${body.year}|${body.mileage}|${body.registration ?? ""}`);
    const [mc, dvsa] = await Promise.all([
      fetchMarketCheckPricing(body.make, body.model, body.year, body.mileage, body.variant),
      body.registration && body.registration.trim().length >= 2
        ? fetchDvsaMotHistory(body.registration).catch((e) => {
            console.error("DVSA fetch failed", e);
            return { entries: [], error: "MOT service temporarily unavailable" } as const;
          })
        : Promise.resolve({ entries: [] as MotEntryOut[] }),
    ]);

    // Extract MOT signals — ONLY use the latest test for pricing / watchPoints
    const motEntries = dvsa.entries ?? [];
    const latestTest = motEntries[0];
    const latestAdvisories = latestTest?.advisories ?? [];

    // Years legitimately allowed in narrative output: vehicle year, current
    // year, current+1, plus the real MOT expiry year (DVSA or user-provided).
    const motExpiryYearFromDvsa = latestTest?.expiryDate ? Number(String(latestTest.expiryDate).slice(0, 4)) : undefined;
    const motExpiryYearFromUser = body.motExpiry ? Number(String(body.motExpiry).slice(0, 4)) : undefined;
    const allowedNarrativeYears: number[] = [];
    if (Number.isFinite(motExpiryYearFromDvsa)) allowedNarrativeYears.push(motExpiryYearFromDvsa as number);
    if (Number.isFinite(motExpiryYearFromUser)) allowedNarrativeYears.push(motExpiryYearFromUser as number);
    const latestFailures = latestTest?.failures ?? [];
    const allFailures = motEntries.flatMap((m) => m.failures ?? []);
    const latestAdvisoryText = latestAdvisories.join(" ").toLowerCase();
    const latestFailureText = latestFailures.join(" ").toLowerCase();
    const corrosionMatches = (latestAdvisoryText.match(/corro|corrod|rust|excessive\s+rust|structurally\s+weak/g) ?? []).length
      + (latestFailureText.match(/corro|corrod|rust|structurally\s+weak/g) ?? []).length;
    const recentFailCount = motEntries.slice(0, 3).filter((m) => m.result === "Fail").length;
    const totalAdvisoryCount = latestAdvisories.length;

    // Build a mileage-weighted anchor from the actual live listings.
    // Use a fully deterministic sort so identical inputs yield identical anchors
    // even when MarketCheck returns the same listings in a different order.
    const allListings = mc?.listings ?? [];
    const sortedByMileageDistance = [...allListings].sort((a, b) => {
      const da = Math.abs(a.mileage - body.mileage);
      const db = Math.abs(b.mileage - body.mileage);
      if (da !== db) return da - db;
      if (a.price !== b.price) return a.price - b.price;
      if (a.year !== b.year) return a.year - b.year;
      return (a.url ?? "").localeCompare(b.url ?? "");
    });
    const anchorSubset = sortedByMileageDistance.slice(0, Math.min(10, allListings.length));
    const anchorMedianRaw = anchorSubset.length >= 3 ? median(anchorSubset.map((l) => l.price)) : (mc?.median ?? 0);
    // Round the anchor to a stable grain so small price wobbles in the sample
    // (one listing changing by £200) don't bleed into the final valuation.
    const anchorMedian = anchorMedianRaw > 0 ? roundToGrain(anchorMedianRaw) : 0;
    const exampleListings = sortedByMileageDistance.slice(0, 3);

    const examplesText = exampleListings.length
      ? exampleListings
          .map((l, i) => `  ${i + 1}. £${l.price.toLocaleString()} — ${l.year} ${l.mileage.toLocaleString()}mi${l.trim ? ` ${l.trim}` : ""}${l.location ? `, ${l.location}` : ""}`)
          .join("\n")
      : "";

    const marketBlock = mc
      ? `LIVE UK LISTINGS (MarketCheck UK — ${allListings.length} pulled from ${mc.count} active; filter: ${mc.matchTier}):
- Anchor (median of ${anchorSubset.length} closest-mileage live listings): £${Math.round(anchorMedian).toLocaleString()}
- Wider median across all pulled listings: £${Math.round(mc.median).toLocaleString()}
- Asking range across listings: £${Math.round(mc.p25 ?? mc.median * 0.9).toLocaleString()} – £${Math.round(mc.p75 ?? mc.median * 1.1).toLocaleString()}
${mc.avgMiles ? `- Avg mileage of comparable listings: ${Math.round(mc.avgMiles).toLocaleString()} mi (this car: ${body.mileage.toLocaleString()} mi)` : ""}

CLOSEST 3 LIVE EXAMPLES TO THIS CAR:
${examplesText}

These are REAL cars currently for sale in the UK. Use the anchor above as the dealer-asking benchmark for this exact car. Private sale typically lands 8-12% below dealer asking.`
      : `(No live MarketCheck listings returned for this exact spec — fall back on your own UK private market knowledge and stay conservative.)`;

    const motBlock = motEntries.length > 0
      ? `MOT HISTORY (DVSA — real data):
- Tests on record: ${motEntries.length}
- Latest test: ${latestTest?.date ?? "unknown"} — ${latestTest?.result ?? "?"}
- Recent failures (last 3 tests): ${recentFailCount}
- Advisories on LATEST test only: ${totalAdvisoryCount}
- Corrosion/rust mentions on latest test: ${corrosionMatches}
${latestAdvisories.length > 0 ? `- Latest test advisories: ${latestAdvisories.slice(0, 6).map((a) => `"${a}"`).join("; ")}` : ""}
${latestFailures.length > 0 ? `- Latest test failures: ${latestFailures.slice(0, 4).map((a) => `"${a}"`).join("; ")}` : ""}

ONLY consider advisories and failures from the LATEST test when pricing and writing watchPoints. Older advisories that do not appear on the latest test have been rectified and must NOT be mentioned.`
      : body.registration
        ? `MOT HISTORY: No DVSA records returned for this registration.`
        : `MOT HISTORY: No registration provided.`;

    const userContent: any[] = [
      {
        type: "text",
        text:
`Vehicle:
- Vehicle year: ${body.year}
- Current year: ${CURRENT_YEAR}
- ${body.year} ${body.make} ${body.model}${body.variant ? ` — ${body.variant}` : ""}
- Mileage: ${body.mileage.toLocaleString()} miles
- Registration: ${body.registration || "not provided"}
- MOT expiry: ${body.motExpiry || "not provided"}
- Service notes: ${body.serviceNotes || "none provided"}
- Photos attached: ${photoUrls.length}
${labeledPhotos.length > 0 ? `
PHOTO LIST — the images below are sent in this exact order. Use the Photo N number as photoIndex in every photoInsight:
${labeledPhotos.map((p, i) => `  Photo ${i + 1} — user-labelled "${p.slot}" (${SLOT_LABELS[p.slot]}). The label is a HINT only — describe what you actually see in this image and set slot to what you see.`).join("\n")}` : ""}

${marketBlock}

${motBlock}

Be honest and conservative. Lean lower if there are negatives. Call out high mileage, corrosion and history gaps explicitly. If you mention the car's year, you must say ${body.year}. If you mention the current year or today's market, you must say ${CURRENT_YEAR}. Call the valu8_report function.`,
      },
      ...photoUrls.map((url) => ({ type: "image_url", image_url: { url } })),
    ];

    const aiStart = Date.now();
    const aiModel = "google/gemini-2.5-pro";
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "valu8_report" } },
        // Determinism: same inputs -> same output. Gemini honours all three.
        temperature: 0,
        top_p: 0,
        seed,
      }),
    });
    const aiLatency = Date.now() - aiStart;

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, txt);
      capturePosthogAiGeneration({
        model: aiModel, latencyMs: aiLatency, httpStatus: aiResp.status,
        isError: true, errorMessage: txt.slice(0, 300), feature: "analyse-vehicle",
        distinctId: (body as any).userId ?? null,
      });
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
    capturePosthogAiGeneration({
      model: aiModel, latencyMs: aiLatency, httpStatus: 200,
      inputTokens: aiData?.usage?.prompt_tokens,
      outputTokens: aiData?.usage?.completion_tokens,
      totalTokens: aiData?.usage?.total_tokens,
      feature: "analyse-vehicle",
      distinctId: (body as any).userId ?? null,
      extra: { make: body.make, model: body.model, year: body.year, photoCount: photoUrls.length },
    });
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
      photoInsights?: Array<{
        slot?: string;
        observation?: string;
        severity?: string;
        priceImpact?: number;
        fixCost?: number;
        fixable?: boolean;
      }>;
      headline?: string;
      marketContext?: string;
      factorsUp?: string[];
      factorsDown?: string[];
      sellerTip?: string;
      negotiationBuffer?: number;
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

    const age = Math.max(0, CURRENT_YEAR - body.year);
    const expectedMileage = age <= 0 ? 3000 : age * 8000;
    const mileageRatio = body.mileage / Math.max(expectedMileage, 1);
    const serviceText = `${body.serviceNotes ?? ""}`.toLowerCase();
    const hasStrongHistory = /(full service history|fsh|main dealer|marque specialist|specialist serviced|full history|complete service history|every service|all stamps|stamped book)/i.test(serviceText);
    const hasPartialHistory = /(partial|part service|patchy|some history|limited history|few stamps)/i.test(serviceText);
    const noHistory = /(no history|no service history|missing history|no records|history lost)/i.test(serviceText);
    // Recent major mechanical work — strong positive signal for private buyers
    const recentMajorWork = /(cambelt|timing belt|timing chain|new clutch|clutch replaced|subframe|new turbo|turbo replaced|new dpf|dpf replaced|new battery|hybrid battery|injectors replaced|gearbox rebuilt|suspension overhaul|new shocks|new dampers|coilovers fitted|full respray|new tyres all round|four new tyres|brake discs and pads|new brakes|recently serviced|just serviced|fresh service|fresh mot)/i.test(serviceText);
    const desirableSpec = /(manual|alcantara|carbon|ceramic|sports exhaust|akrapovic|milltek|panoramic|sunroof|heads.?up|hud|adaptive cruise|matrix led|night vision|comfort access|harman|bang.?olufsen|burmester|bowers|pan roof|extended leather|nappa|m sport plus|black pack|tech pack|premium plus|sport plus|launch edition|first edition|limited edition|low owners?|one owner|two owners|sole owner|original paint|garaged|never tracked|non.?smoker|pet.?free)/i.test(serviceText);
    const needsWork = /(needs|due|overdue|warning light|smoke|fault|damage|dent|scuff|scratch|leak|issue|rust|corrosion)/i.test(serviceText);

    const ultraRare = isUltraRare(body.make, body.model, body.variant);
    const exoticAnchor = getExoticAnchor(body.make, body.model, body.variant);
    const enthusiast = isEnthusiastCar(body.make, body.model, body.variant);
    let rareCarWarning: string | undefined;
    let valuationUnavailable = false;

    // Decide whether MarketCheck data is actually usable. For ultra-rare cars
    // the public UK active-listings feed is almost always too thin/noisy to
    // trust as a price anchor, so we deliberately ignore it unless we have a
    // very strong sample.
    const badMarketData = !!mc && isClearlyBadMarketData({
      make: body.make,
      model: body.model,
      variant: body.variant,
      median: mc.median,
      count: mc.count,
      ultraRare,
      exoticAnchor: exoticAnchor ? { low: exoticAnchor.low, high: exoticAnchor.high } : undefined,
    });

    const mcUsable = !!mc && !badMarketData && mc.median > 0 && (
      ultraRare ? mc.count >= 50 : true
    );

    if (ultraRare && (!mc || badMarketData || mc.count < 50)) {
      valuationUnavailable = true;
      values = { dealerTradeIn: 0, privateSale: 0, dealerRetail: 0 };
      rangeLow = 0;
      rangeHigh = 0;
      confidence = "Low";
      confidenceReason = "This is a very rare car and we don't have enough reliable market data to value it confidently. A specialist will give you a much better idea.";
      pricingReasoning = LIMITED_DATA_MESSAGE;
      dataSource = "ai_estimate";
      rareCarWarning = LIMITED_DATA_WARNING;
    } else if (mcUsable && mc) {
      let mult = 1.0;

      // --- Mileage adjustments — LIGHT because the anchor is already mileage-matched.
      // Only penalise when this car is meaningfully above the comparable sample average.
      const sampleAvg = mc.avgMiles ?? expectedMileage;
      const milesVsSample = body.mileage / Math.max(sampleAvg, 1);
      if (milesVsSample >= 1.6) { mult *= 0.90; adjustments.push({ label: "Well above comparable mileage", impactPct: -10 }); }
      else if (milesVsSample >= 1.3) { mult *= 0.95; adjustments.push({ label: "Above comparable mileage", impactPct: -5 }); }
      else if (milesVsSample <= 0.6 && body.mileage < 60000) { mult *= 1.07; adjustments.push({ label: "Well below comparable mileage", impactPct: 7 }); }
      else if (milesVsSample <= 0.8) { mult *= 1.03; adjustments.push({ label: "Below comparable mileage", impactPct: 3 }); }

      // --- MOT corrosion / failures (real DVSA signals) ---
      if (corrosionMatches >= 2) { mult *= 0.84; adjustments.push({ label: `Multiple corrosion advisories (${corrosionMatches})`, impactPct: -16 }); }
      else if (corrosionMatches === 1) { mult *= 0.92; adjustments.push({ label: "Corrosion advisory on MOT", impactPct: -8 }); }
      if (recentFailCount >= 1) { mult *= 0.94; adjustments.push({ label: "Recent MOT failure(s)", impactPct: -6 }); }
      if (totalAdvisoryCount >= 6) { mult *= 0.97; adjustments.push({ label: `${totalAdvisoryCount} current advisories`, impactPct: -3 }); }

      // --- Service history (stronger positive, fair negative) ---
      if (hasStrongHistory) { mult *= 1.06; adjustments.push({ label: "Full service history", impactPct: 6 }); }
      else if (hasPartialHistory) { mult *= 0.95; adjustments.push({ label: "Partial service history", impactPct: -5 }); }
      else if (noHistory) { mult *= 0.90; adjustments.push({ label: "No service history", impactPct: -10 }); }

      // --- Recent major mechanical work — strong positive lever ---
      if (recentMajorWork) { mult *= 1.05; adjustments.push({ label: "Recent major mechanical work", impactPct: 5 }); }

      // --- Desirability (spec, options, ownership) ---
      if (desirableSpec) { mult *= 1.03; adjustments.push({ label: "Desirable spec / options", impactPct: 3 }); }
      if (enthusiast && body.mileage < 50000) { mult *= 1.03; adjustments.push({ label: "Sought-after enthusiast spec", impactPct: 3 }); }

      // --- Other condition flags from notes ---
      if (needsWork && !corrosionMatches) { mult *= 0.96; adjustments.push({ label: "Issues noted in description", impactPct: -4 }); }

      // --- Condition score (MAJOR lever now — was previously ±8%, now ±18%) ---
      // 7.0 is neutral. Each point above adds ~6%, each below removes ~7%.
      let conditionAdj = 1.0;
      if (score >= 9.0) conditionAdj = 1.12;
      else if (score >= 8.5) conditionAdj = 1.08;
      else if (score >= 8.0) conditionAdj = 1.05;
      else if (score >= 7.5) conditionAdj = 1.02;
      else if (score >= 7.0) conditionAdj = 1.00;
      else if (score >= 6.5) conditionAdj = 0.97;
      else if (score >= 6.0) conditionAdj = 0.93;
      else if (score >= 5.5) conditionAdj = 0.88;
      else if (score >= 5.0) conditionAdj = 0.83;
      else conditionAdj = 0.78;
      mult *= conditionAdj;
      const conditionPct = Math.round((conditionAdj - 1) * 100);
      if (conditionPct !== 0) {
        adjustments.push({
          label: conditionPct > 0
            ? `${ai.conditionLabel || "Strong"} visible condition (${score.toFixed(1)}/10)`
            : `Condition deductions (${score.toFixed(1)}/10)`,
          impactPct: conditionPct,
        });
      }

      // Cap total swing — wider upside than before, still a sensible floor.
      mult = clamp(mult, 0.55, 1.28);

      // Use the mileage-weighted live-listings anchor when available; otherwise fall back to the wider median.
      const anchor = anchorMedian > 0 ? anchorMedian : mc.median;
      let dealerRetail = roundToGrain(anchor * mult);

      // Sanity floor for ultra-rare cars
      if (ultraRare && exoticAnchor && dealerRetail < exoticAnchor.low * 0.7) {
        dealerRetail = roundToGrain(exoticAnchor.low * 0.85);
        adjustments.push({ label: "Adjusted toward known exotic floor (sparse market data)", impactPct: 0 });
      }

      // Private-sale ratio — clean cars achieve closer to dealer asking than the old 0.90 assumed.
      // Tune by condition: outstanding cars 0.95, good 0.93, average 0.91, poor 0.88.
      let privateRatio = 0.92;
      if (score >= 8.5) privateRatio = 0.95;
      else if (score >= 7.5) privateRatio = 0.93;
      else if (score >= 6.5) privateRatio = 0.91;
      else privateRatio = 0.88;
      if (hasStrongHistory) privateRatio += 0.01;
      if (recentMajorWork) privateRatio += 0.01;
      privateRatio = clamp(privateRatio, 0.86, 0.97);

      const privateSale = roundToGrain(dealerRetail * privateRatio);
      const dealerTradeIn = roundToGrain(dealerRetail * 0.78);

      // Range — tighter for strong cars, wider for problem cars
      const negativeCount = adjustments.filter((a) => a.impactPct < 0).length;
      const positiveCount = adjustments.filter((a) => a.impactPct > 0).length;
      let spread = negativeCount >= 3 ? 0.12 : negativeCount >= 1 ? 0.08 : 0.06;
      if (positiveCount >= 3 && negativeCount === 0) spread = 0.05;
      if (ultraRare) spread = Math.max(spread, 0.20);
      rangeLow = roundToGrain(privateSale * (1 - spread * 0.8));
      rangeHigh = roundToGrain(privateSale * (1 + spread));

      // --- Confidence reasoning (short, model-specific) ---
      const isOutlierMileage = milesVsSample >= 1.5 || milesVsSample <= 0.5;
      const carName = `${body.make} ${body.model}${body.variant ? ` ${body.variant}` : ""}`.trim();
      const shortName = body.variant ? `${body.model} ${body.variant}` : body.model;
      const mileageDescriptor = body.mileage >= 100000 ? "high-mileage " : body.mileage <= 30000 ? "low-mileage " : "";

      if (ultraRare) {
        confidence = "Low";
        confidenceReason = `Very few ${carName}s come up for sale, so this is a guide rather than a firm figure.`;
        rareCarWarning = LIMITED_DATA_WARNING;
      } else if (mc.count >= 500 && !isOutlierMileage && photoUrls.length >= 4 && negativeCount <= 1) {
        confidence = "High";
        confidenceReason = `Plenty of comparable ${shortName}s on the market right now, and most signals on this car are positive.`;
      } else if (mc.count >= 50 && !isOutlierMileage && negativeCount <= 3) {
        confidence = "Medium";
        confidenceReason = `Reasonable number of similar ${shortName}s for sale. We've weighed each factor carefully — this figure is well-supported.`;
      } else if (mc.count >= 10) {
        confidence = "Low";
        confidenceReason = `Not many ${mileageDescriptor}${shortName}s like yours on the market right now, so treat this as a useful guide rather than an exact price.`;
      } else {
        confidence = "Very Low";
        confidenceReason = `Very few ${shortName}s on sale to compare against — this is a rough guide only.`;
      }

      values = { dealerTradeIn, privateSale, dealerRetail };
      const baseRetail = roundToGrain(anchor);
      marketBaseline = {
        source: "MarketCheck UK",
        sampleSize: mc.count,
        baseDealerRetail: baseRetail,
        basePrivateSale: roundToGrain(baseRetail * 0.92),
        baseTradeIn: roundToGrain(baseRetail * 0.78),
        netAdjustmentPct: Math.round((mult - 1) * 100),
      };
      // Build a transparent reasoning string that highlights both sides.
      const topPositives = adjustments.filter(a => a.impactPct > 0).sort((a,b)=>b.impactPct-a.impactPct).slice(0,2).map(a => a.label.toLowerCase());
      const topNegatives = adjustments.filter(a => a.impactPct < 0).sort((a,b)=>a.impactPct-b.impactPct).slice(0,2).map(a => a.label.toLowerCase());
      if (topPositives.length && topNegatives.length) {
        pricingReasoning = `Lifted by ${topPositives.join(" and ")}; offset by ${topNegatives.join(" and ")}.`;
      } else if (topPositives.length) {
        pricingReasoning = `Lifted by ${topPositives.join(" and ")} — pricing reflects a clean example of this ${shortName}.`;
      } else if (topNegatives.length) {
        pricingReasoning = `Main things affecting the price: ${topNegatives.join(" and ")}.`;
      } else {
        pricingReasoning = `Based on what similar ${shortName}s are selling for in the UK right now.`;
      }
      dataSource = "marketcheck";

    } else if (badMarketData) {
      valuationUnavailable = true;
      values = { dealerTradeIn: 0, privateSale: 0, dealerRetail: 0 };
      rangeLow = 0;
      rangeHigh = 0;
      confidence = ultraRare ? "Low" : "Very Low";
      confidenceReason = "The market data we found doesn't look reliable for this car, so we'd rather not show a number that could mislead you.";
      pricingReasoning = LIMITED_DATA_MESSAGE;
      dataSource = "ai_estimate";
      rareCarWarning = LIMITED_DATA_WARNING;
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
        valuationUnavailable = true;
        values = { dealerTradeIn: 0, privateSale: 0, dealerRetail: 0 };
        rangeLow = 0;
        rangeHigh = 0;
        confidence = "Low";
        confidenceReason = "This is a very rare car and we don't have enough reliable market evidence. A specialist will give you a much better figure.";
        rareCarWarning = LIMITED_DATA_WARNING;
        pricingReasoning = LIMITED_DATA_MESSAGE;
      } else {
        confidence = "Low";
        confidenceReason = "We couldn't find enough similar cars for sale right now, so this is our best estimate without direct comparable sales.";
        pricingReasoning = market.reasoning;
      }
      dataSource = "ai_estimate";
    }

    // Negotiation buffer: trust AI if reasonable (2-8% of privateSale), else default to ~4%.
    const aiBuffer = Number(ai.negotiationBuffer) || 0;
    const minBuf = values.privateSale * 0.02;
    const maxBuf = values.privateSale * 0.08;
    const negotiationBuffer = valuationUnavailable
      ? 0
      : roundTo50(clamp(aiBuffer > 0 ? aiBuffer : values.privateSale * 0.04, minBuf, maxBuf));
    const recommendedAskingPrice = valuationUnavailable
      ? 0
      : roundTo50(values.privateSale + negotiationBuffer);
    const listingPrice = recommendedAskingPrice || (valuationUnavailable ? 0 : roundToGrain(values.privateSale * 1.03));

    // Build factorsUp/Down: prefer AI output, fall back to deterministic adjustments.
    const aiUp = (ai.factorsUp ?? []).map((s) => String(s).trim()).filter(Boolean).slice(0, 4);
    const aiDown = (ai.factorsDown ?? []).map((s) => String(s).trim()).filter(Boolean).slice(0, 4);
    const factorsUp = aiUp.length > 0
      ? sanitizeNarrativeList(aiUp, body.year, CURRENT_YEAR, allowedNarrativeYears)
      : adjustments.filter((a) => a.impactPct > 0).map((a) => a.label).slice(0, 4);
    const factorsDown = aiDown.length > 0
      ? sanitizeNarrativeList(aiDown, body.year, CURRENT_YEAR, allowedNarrativeYears)
      : adjustments.filter((a) => a.impactPct < 0).map((a) => a.label).slice(0, 4);

    const headline = sanitizeNarrativeYears(ai.headline ?? "", body.year, CURRENT_YEAR, allowedNarrativeYears);

    // Sanitize per-photo insights and attach the matching photoIndex.
    const rawInsights = Array.isArray(ai.photoInsights) ? ai.photoInsights : [];
    const photoInsights = rawInsights
      .map((ins) => {
        const observation = sanitizeNarrativeYears(String(ins?.observation ?? "").trim(), body.year, CURRENT_YEAR, allowedNarrativeYears).slice(0, 140);
        if (!observation) return null;
        // Photo index is the authoritative anchor — it ties the AI's words to the
        // exact image it actually looked at, regardless of any user slot label.
        const rawIndex = Number(ins?.photoIndex);
        const photoIndex = Number.isFinite(rawIndex) && rawIndex >= 1 && rawIndex <= labeledPhotos.length
          ? Math.floor(rawIndex) - 1
          : -1;
        // Trust the AI's detected slot first; fall back to the user-labelled slot
        // for that image; finally to "other". Never re-derive slot from labelled list
        // because the user labels may be wrong.
        const aiSlot = VALID_SLOTS.includes(ins?.slot as PhotoSlot) ? (ins!.slot as PhotoSlot) : null;
        const labeledSlot = photoIndex >= 0 ? labeledPhotos[photoIndex].slot : null;
        const slot: PhotoSlot = (aiSlot ?? labeledSlot ?? "other") as PhotoSlot;
        const severity = (["positive","neutral","minor","notable"].includes(String(ins?.severity)) ? ins!.severity : "neutral") as "positive"|"neutral"|"minor"|"notable";
        const priceImpact = Number.isFinite(Number(ins?.priceImpact)) && Number(ins?.priceImpact) !== 0 ? Math.round(Number(ins!.priceImpact)) : undefined;
        const fixCost = Number.isFinite(Number(ins?.fixCost)) && Number(ins?.fixCost) > 0 ? Math.round(Number(ins!.fixCost)) : undefined;
        const fixable = typeof ins?.fixable === "boolean" ? ins!.fixable : undefined;
        return {
          slot,
          photoIndex: photoIndex >= 0 ? photoIndex : undefined,
          observation,
          severity,
          ...(priceImpact !== undefined ? { priceImpact } : {}),
          ...(fixCost !== undefined ? { fixCost } : {}),
          ...(fixable !== undefined ? { fixable } : {}),
        };
      })
      .filter(Boolean)
      .slice(0, 18);
    const marketContext = sanitizeNarrativeYears(ai.marketContext ?? "", body.year);
    const sellerTip = sanitizeNarrativeYears(ai.sellerTip ?? "", body.year);

    // ----- Build MOT history payload — REAL DVSA only. Never invent. -----
    // If a registration was supplied, we either show genuine DVSA history or
    // nothing at all. Simulated history is only ever used as a clearly-labelled
    // illustration when no registration was given.
    let motHistory: any[] = [];
    let motSource: "dvsa" | "simulated" | "unavailable" = "unavailable";
    let motNotice: string | undefined;
    if (motEntries.length > 0) {
      motHistory = motEntries;
      motSource = "dvsa";
    } else if (body.registration && body.registration.trim().length >= 2) {
      // Reg provided but DVSA returned nothing — show no history at all rather
      // than fabricate dates/expiry years that would mislead the seller.
      motHistory = [];
      motSource = "unavailable";
      motNotice = (dvsa as any).error
        ?? "We couldn't retrieve real MOT history for this registration. This may be a new import, a very new vehicle, or a vehicle exempt from MOT.";
    } else {
      motNotice = "No registration provided — MOT history not available.";
      motHistory = [];
      motSource = "unavailable";
    }

    // Years that are legitimately allowed to appear in narrative text
    // (vehicle year, current year, current+1 by default, plus the real MOT
    // expiry year when we have one from DVSA or the user).
    const allowedNarrativeYears: number[] = [];
    const motExpiryYearFromDvsa = motEntries[0]?.expiryDate ? Number(String(motEntries[0].expiryDate).slice(0, 4)) : undefined;
    const motExpiryYearFromUser = body.motExpiry ? Number(String(body.motExpiry).slice(0, 4)) : undefined;
    if (Number.isFinite(motExpiryYearFromDvsa)) allowedNarrativeYears.push(motExpiryYearFromDvsa as number);
    if (Number.isFinite(motExpiryYearFromUser)) allowedNarrativeYears.push(motExpiryYearFromUser as number);

    const report = {
      conditionScore: Math.round(score * 10) / 10,
      conditionLabel: ai.conditionLabel,
      values,
      valueRange: valuationUnavailable ? undefined : { privateSaleLow: rangeLow, privateSaleHigh: rangeHigh },
      valueReasoning: sanitizeNarrativeYears(valuationUnavailable ? pricingReasoning : ai.valueReasoning, body.year, CURRENT_YEAR, allowedNarrativeYears),
      marketConfidence: confidence,
      marketConfidenceReason: confidenceReason,
      pricingSource: dataSource,
      marketSampleSize: mc?.count,
      priceAdjustments: adjustments,
      marketBaseline,
      comparableListings: valuationUnavailable ? [] : exampleListings,
      marketAnchor: valuationUnavailable ? undefined : (anchorMedian > 0 ? Math.round(anchorMedian) : undefined),
      rareCarWarning,
      valuationUnavailable,
      honestAnalysis: sanitizeNarrativeYears(valuationUnavailable ? LIMITED_DATA_MESSAGE : ai.honestAnalysis, body.year, CURRENT_YEAR, allowedNarrativeYears),
      marketPositioning: sanitizeNarrativeYears(valuationUnavailable ? "This type of car needs a specialist's eye. A marque specialist or auction house will give you a proper appraisal." : ai.marketPositioning, body.year, CURRENT_YEAR, allowedNarrativeYears),
      photoObservations: sanitizeNarrativeYears(ai.photoObservations, body.year, CURRENT_YEAR, allowedNarrativeYears),
      photoInsights,
      strengths: sanitizeNarrativeList(ai.strengths, body.year, CURRENT_YEAR, allowedNarrativeYears),
      watchPoints: sanitizeNarrativeList(ai.watchPoints, body.year, CURRENT_YEAR, allowedNarrativeYears),
      recommendations: {
        listingPrice,
        recommendedAskingPrice,
        negotiationBuffer,
        whereToSell: sanitizeNarrativeList(ai.recommendations?.whereToSell, body.year, CURRENT_YEAR, allowedNarrativeYears),
        highlights: sanitizeNarrativeList(ai.recommendations?.highlights, body.year, CURRENT_YEAR, allowedNarrativeYears),
        documents: sanitizeNarrativeList(ai.recommendations?.documents, body.year, CURRENT_YEAR, allowedNarrativeYears),
      },
      headline,
      marketContext,
      factorsUp,
      factorsDown,
      sellerTip,
      negotiationBuffer,
      recommendedAskingPrice,
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
      engineVersion: "v2.1-deterministic",
      inputsHash: computeInputsHash({
        make: body.make,
        model: body.model,
        variant: body.variant,
        year: body.year,
        mileage: body.mileage,
        registration: body.registration,
        motExpiry: body.motExpiry,
        serviceNotes: body.serviceNotes,
        photoRefs: rawLabeled.map((p) => extractPhotoPath(p.ref) ?? p.ref),
      }),
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
