// Valu8 — AI vehicle analysis edge function
// Pulls live UK market pricing from MarketCheck UK as the valuation anchor,
// then uses Lovable AI Gateway (Gemini 2.5 Flash vision, provider configurable via AI_GATEWAY_URL/AI_API_KEY/AI_MODEL) to adjust the figure
// based on photos, mileage, history, MOT advisories and modifications.

import { corsHeaders, guard, isAdminUser, json, clientIp, checkLimit, envInt, adminClient } from "../_shared/guard.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { capturePosthogAiGeneration } from "../_shared/posthog.ts";
import {
  median, percentile, mentionsUnnegated, isUltraRare, baseValue, roundTo50, roundToGrain, clamp,
  sanitizeNarrativeYears, sanitizeNarrativeList, isEnthusiastCar, getExoticAnchor,
  isClearlyBadMarketData, computeMarketRange, type ConfidenceLevel,
} from "../_shared/valuation-math.ts";
import { motStatus, motAdjustment, currentMotExpiry, failedWithoutValidMot, sanitizeMotClaim, isFalseLongMotClaim, motDaysRemaining, motConsistentBullets } from "../_shared/mot.ts";
import { fixOdometerWording, compSearchModels } from "../_shared/vehicle-text.ts";
import { detectPerformanceVariant, filterCompsByPerformance, downgradeConfidence, type PerfVariant, type PerfMatch } from "../_shared/performance.ts";
import { shrinkThinAnchor, aiAgeFactor, THIN_COMP_FULL_WEIGHT } from "../_shared/calibration.ts";
import { valueWithOwnComps } from "../_shared/ownCompsAdjust.ts";
import { pricePmBoth, blendWithOwnComps, resolveBody } from "../_shared/priceModel.ts";
import { motSignals, motAdjustment as motSignalAdjustment } from "../_shared/motSignals.ts";
import { similarAdverts, anchorPrice, anchorBlock, anchorDeviation, anchorArm, DEVIATION_REASON_PROPERTY } from "../_shared/aiAnchor.ts";
import { ensemble } from "../_shared/ensemble.ts";
import { engineValue, engineLedger } from "../_shared/engine.ts";
import { coherentPricing } from "../_shared/coherentPricing.ts";
import { cheapPriceRange } from "../_shared/cheapRange.ts";
import { aiSafetyCap } from "../_shared/aiCap.ts";
import { displayMake } from "../_shared/vehicle-text.ts";
import { resolveVariant, perfCompReference, variantToken, reconcileProsePrices, stripPriceSentences, proseRatio, sanityVerdict, aiTextVariant, optionRegex, MIN_VARIANT_COMPS, type ShownPrices, type PerfCompRow } from "../_shared/variantGuard.ts";
import { compAdjustedAnchor, privateFromRetail, tradeFrom, calibrateAiPrivate, privateRange, highMileagePenalty, sumPhotoImpacts, dedupeReportText, finalisePricing, reconcileMileage, mileageNoteText, marketConfidenceTier, filterCompsBySpec, dealerToPrivate, motPenaltyItems, retailFromPrivate, declaredStatusItems, applyCheapCarRules, aiPathAdjustments, type LedgerItem } from "../_shared/pricing.ts";
import { validatePhotoInsights, fixableUpside } from "../_shared/photo-insights.ts";

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

async function signPhotoRefsForAi(refs: string[], allowedPrefix: string | null): Promise<string[]> {
  if (!refs.length) return [];
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE) return refs.map(() => "");
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  // Only sign objects inside the authenticated caller's or this guest report's folder.
  // Without this, any caller could ask the service role to sign anyone's photos.
  const paths = refs.map(extractPhotoPath).map((p) => (p && allowedPrefix && p.startsWith(allowedPrefix) && !p.split("/").some((part) => part === "." || part === "..") ? p : null));
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
// MarketCheck is switched off (owner decision 2026-10-23: slow/429-prone). Set env
// MARKETCHECK_ENABLED=true to restore; pricing otherwise uses the AI-estimate fallback.
const MARKETCHECK_ENABLED = (Deno.env.get("MARKETCHECK_ENABLED") ?? "false").toLowerCase() === "true";
const MC_KEY = MARKETCHECK_ENABLED ? Deno.env.get("MARKETCHECK_API_KEY") : undefined;
const CURRENT_YEAR = new Date().getUTCFullYear();

export interface ComparableListing {
  price: number;
  mileage: number;
  year: number;
  trim?: string;
  location?: string;
  source?: string;
  url?: string;
  fuelType?: string;
  transmission?: string;
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


// Try the DVLA model name first, then cleaned-up variants (trim stripped,
// import alias, Mazda6-style) — a zero-comp search otherwise falls back to AI-only.
async function fetchMarketCheckPricing(
  make: string,
  model: string,
  year: number,
  mileage: number,
  variant?: string,
): Promise<MarketPricing | null> {
  const candidates = compSearchModels(make, model);
  let best: MarketPricing | null = null;
  for (const m of candidates.length ? candidates : [model]) {
    const r = await fetchMarketCheckPricingFor(make, m, year, mileage, variant);
    if (r && r.listings.length >= 3) return r;
    if (r && r.listings.length > (best?.listings.length ?? 0)) best = r;
  }
  return best;
}

// Performance variants: the generic tiers return the first 50 listings sorted
// by mileage, which for e.g. a Megane are almost all GT Line / dCi. Pull an
// extra price-descending pool across +/-2 years so enough like-for-like
// performance comps are available to filter on.
async function fetchPerformancePool(make: string, model: string, year: number): Promise<ComparableListing[]> {
  if (!MC_KEY) return [];
  const baseModel = model.split(" · ")[0].split("·")[0].trim();
  const out: ComparableListing[] = [];
  for (const start of [0, 50]) {
    const params = new URLSearchParams({
      api_key: MC_KEY, make, model: baseModel, year_range: `${year - 2}-${year + 2}`,
      rows: "50", start: String(start), car_type: "used", sort_by: "price", sort_order: "desc",
    });
    try {
      const r = await fetchWithRetry(`https://mc-api.marketcheck.com/v2/search/car/uk/active?${params}`);
      if (!r.ok) { await r.body?.cancel(); break; }
      const j = await r.json();
      const items: any[] = Array.isArray(j?.listings) ? j.listings : [];
      out.push(...items.map(toComparable).filter((l): l is ComparableListing => !!l));
      if (items.length < 50) break;
    } catch (e) { console.error("MarketCheck performance pool error", e); break; }
  }
  return out;
}

function toComparable(it: any): ComparableListing | null {
  if (!(Number(it?.price) > 0 && Number(it?.build?.year) > 0)) return null;
  const l: ComparableListing = {
    price: Math.round(Number(it.price)),
    mileage: Math.round(Number(it.miles ?? 0)),
    year: Number(it.build.year),
    trim: it.build?.trim || undefined,
    location: it.dealer?.city || it.dealer?.county || undefined,
    source: it.source || "MarketCheck",
    url: it.vdp_url || undefined,
    fuelType: it.build?.fuel_type || undefined,
    transmission: it.build?.transmission || undefined,
  };
  return l.price >= 200 && l.mileage >= 0 ? l : null;
}

/** Adds the performance pool to the generic comps and keeps like-for-like ones. */
export function applyPerformanceComps(
  mc: MarketPricing | null, pool: ComparableListing[], perf: PerfVariant | null,
): { mc: MarketPricing | null; match: PerfMatch | null; matchedCount: number; premium?: number } {
  if (!perf) return { mc, match: null, matchedCount: 0 };
  const seen = new Set<string>();
  const merged = [...(mc?.listings ?? []), ...pool].filter((l) => {
    const k = l.url || `${l.price}|${l.mileage}|${l.year}|${l.trim ?? ""}`;
    if (seen.has(k)) return false; seen.add(k); return true;
  });
  const f = filterCompsByPerformance(merged, perf);
  if (f.match === "fallback") return { mc, match: "fallback", matchedCount: f.matchedCount };
  const prices = f.comps.map((l) => l.price);
  const miles = f.comps.map((l) => l.mileage).filter((m) => m > 0);
  return {
    match: f.match, matchedCount: f.matchedCount, premium: f.premium,
    mc: {
      median: median(prices),
      mean: prices.reduce((a, b) => a + b, 0) / prices.length,
      p25: percentile(prices, 25), p75: percentile(prices, 75),
      count: f.comps.length,
      avgMiles: miles.length ? miles.reduce((a, b) => a + b, 0) / miles.length : undefined,
      listings: f.comps,
      matchTier: `${perf.label} like-for-like (${f.match === "specific" ? perf.specific?.label : f.match === "parent" ? `parent trim of ${perf.specific?.label}` : "performance family"}) from ${merged.length} listings`,
    },
  };
}

// Timestamp of the last MarketCheck request that still failed after retries
// with 429/5xx/network error. Used to flag AI fallbacks caused by throttling
// rather than a genuinely thin market (batch run: 30/41 cars fell to AI).
let mcThrottledAt = 0;
export function marketCheckRecentlyThrottled(now = Date.now()): boolean {
  return now - mcThrottledAt < 120_000;
}

async function fetchWithRetry(url: string, attempts = 2): Promise<Response> {
  let last: Response | undefined; let err: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      last = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (last.ok || (last.status !== 429 && last.status < 500)) return last;
      console.warn("MarketCheck retryable status", last.status, "attempt", i + 1);
      if (i < attempts - 1) await last.body?.cancel();
    } catch (e) { err = e; console.warn("MarketCheck network error, attempt", i + 1, e); }
    if (i < attempts - 1) await new Promise((res) => setTimeout(res, 300 + Math.floor(Math.random() * 200)));
  }
  if (!last || last.status === 429 || last.status >= 500) mcThrottledAt = Date.now();
  if (last) return last;
  throw err;
}

async function fetchMarketCheckPricingFor(
  make: string,
  model: string,
  year: number,
  mileage: number,
  variant?: string,
): Promise<MarketPricing | null> {
  if (!MC_KEY) return null;
  const baseModel = model.split(" · ")[0].split("·")[0].trim();
  const expectedMiles = Math.max(3000, (new Date().getUTCFullYear() - year) * 8000);
  const highMiles = mileage > expectedMiles * 1.1;
  const trim = variant?.split(" · ")[0].split("·")[0].trim();

  // Pull up to 20 real active listings, with stats, for any given filter.
  const tryFetch = async (params: URLSearchParams, tierLabel: string): Promise<MarketPricing | null> => {
    params.set("rows", "50");
    params.set("stats", "price,miles");
    params.set("car_type", "used");
    // Stable ordering — without this MarketCheck returns relevance/freshness
    // order which shuffles between calls and makes the anchor wobble even with
    // identical inputs. Sorting by miles ascending gives a deterministic slice.
    params.set("sort_by", "miles");
    // High-mileage cars sort descending so the slice isn't all low-mile stock
    // (a 180k car was being priced off 60k-mile listings).
    params.set("sort_order", highMiles ? "desc" : "asc");
    const url = `https://mc-api.marketcheck.com/v2/search/car/uk/active?${params}`;
    try {
      // MarketCheck throttles bursts (several tier queries per valuation):
      // retry 429/5xx/network errors with a short backoff instead of silently
      // dropping a well-covered car to the AI-only path (VE15WHA: 715 comps -> 0).
      const r = await fetchWithRetry(url);
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
          fuelType: it.build?.fuel_type || undefined,
          transmission: it.build?.transmission || undefined,
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
    miles_range: `${Math.max(0, mileage - 40000)}-${mileage + 40000}`,
  }), `${make} ${baseModel} ${year - 2}-${year + 2} (similar mileage)`);
  if (r && r.listings.length >= 5) return r;

  r = await tryFetch(new URLSearchParams({
    api_key: MC_KEY,
    make, model: baseModel,
    year_range: `${year - 2}-${year + 2}`,
  }), `${make} ${baseModel} ${year - 2}-${year + 2}`);
  if (r && r.listings.length >= 5) return r;

  // Wider net for old/cheap cars where stock is thin; comps are mileage/age-corrected later.
  const wide = await tryFetch(new URLSearchParams({
    api_key: MC_KEY,
    make, model: baseModel,
    year_range: `${year - 4}-${year + 4}`,
  }), `${make} ${baseModel} ${year - 4}-${year + 4}`);
  return wide && wide.listings.length > (r?.listings.length ?? 0) ? wide : r;
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
  modifications?: string;
  /** Admin-only: include full comps + pricing internals in the response. */
  debugComps?: boolean;
  colour?: string;
  fuelType?: string;
  transmission?: string;
  engineCapacity?: number;
  bodyStyle?: string;
  firstRegistered?: string;
  motAdvisories?: string[];
  photoUrls: string[];
  photos?: { slot: string; url: string }[];
  guestToken?: unknown;
  guestPhotos?: { slot: string; dataUrl: string }[];
  guestSave?: { displayModel?: string; serviceNotes?: string; vehicle?: unknown; attribution?: unknown };
}

type PhotoSlot = "front" | "rear" | "side" | "interior" | "odometer" | "engine" | "other";
const VALID_SLOTS: PhotoSlot[] = ["front","rear","side","interior","odometer","engine","other"];
const SLOT_LABELS: Record<PhotoSlot, string> = {
  front: "Front 3/4 exterior",
  rear: "Rear 3/4 exterior",
  side: "Driver's side profile",
  interior: "Interior (dash + seats)",
  odometer: "Odometer / mileage (the mileage counter — not the rev counter/tachometer)",
  engine: "Engine bay",
  other: "Additional photo",
};


const LIMITED_DATA_MESSAGE = "We don't have enough reliable market data to give you an accurate figure for this car. We'd recommend speaking to a marque specialist or auction house instead.";
const LIMITED_DATA_WARNING = "We don't have enough reliable market data to value this car accurately. A specialist dealer or auction house will give you a much better idea of what it's worth.";


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
      // Label by the actual DVSA testResult; advisories are listed separately.
      const result: MotEntryOut["result"] = passed ? "Pass" : "Fail";
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
    const yr = new Date().getFullYear() - i;
    mi = Math.max(1000, mi - annualMiles + Math.round((rand() - 0.5) * 1500));
    const month = String(1 + Math.floor(rand() * 12)).padStart(2, "0");
    const day = String(1 + Math.floor(rand() * 27)).padStart(2, "0");
    const roll = rand();
    records.push({
      date: `${yr}-${month}-${day}`,
      result: "Pass",
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
- Routine "corroded but not seriously weakened" advisories on the LATEST MOT: -1% to -5% total (very common on older cars).
- Serious/structural corrosion (seriously weakened, excessive, perforated) or corrosion failures: -8% to -16%.
- MOT failures in the last 12 months: -5% to -8% on top of repair cost. Total MOT-related deduction no more than -15%.
- Visible accident damage / mismatched panel / clearly bad respray: -8% to -15%.
- Patchy or unknown history on a premium car: -5% to -10%.
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
- 6.0–6.9: Average. Some visible wear.
- 5.0–5.9: Below average. Multiple issues stacking.
- Below 5.0: Project / requires significant work.
Do NOT default to 7.0 out of caution — score what you actually see.
The condition score is VISIBLE condition only. Do NOT lower it for mileage, age, MOT advisories or history — those are priced separately by our engine. Never put mileage, MOT or service-history items in photoInsights or give them a priceImpact.

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
The user message gives you a numbered list of photos ("Photo 1", "Photo 2", ...). The images are sent in the SAME ORDER as that list. You are NOT told what each photo shows — you must determine that yourself by LOOKING at each individual image. There is no slot hint; do not assume photo order means anything (it does not).

For EVERY photo you analyse:
- Look at THAT SPECIFIC image and decide what it actually contains.
- Set photoIndex to the 1-based number of the image you are looking at (Photo 1, Photo 2, ...). This is non-negotiable — if you describe seat wear, photoIndex must point at the image that actually shows seats.
- On instrument-cluster photos, the mileage reading comes from the ODOMETER (the total-miles counter, usually a digital readout). The rev counter/tachometer shows engine RPM, not mileage — never call the odometer a "rev counter".
- Set slot to what you ACTUALLY see in that image (front / rear / side / interior / odometer / engine / other) — purely from the visible content, never from position in the list.
- Never describe something that isn't in that photo. If a photo shows the rear of the car, only talk about the rear in that observation. Interior wear belongs against the interior photo, kerbed alloys against the photo showing those alloys, etc.
- Analyse each photo independently. Do not carry over observations from a previous photo.

DAMAGE vs SHADOW vs REFLECTION — be careful:
- A dark line that follows a body crease, panel gap or curve in even light is almost always a SHADOW or reflection, not a scratch. Do not flag it.
- A reflection of the sky, a building or the photographer on glossy paint is not paint damage. Do not flag it.
- Real scratches usually break panel reflections, sit at odd angles to body lines, catch light along their length, or expose primer/metal.
- Real dents distort reflections in a localised oval/round pattern; shadows from overhead light do not.
- Kerb damage on alloys shows as missing lacquer/silver flecks on the rim outer edge, not as a dark arc following the rim.
- If you are not confident something is real damage, either say "possible light mark — worth checking in person" (severity: minor, no priceImpact) or skip it. Do NOT invent defects.
- Equally, do not miss obvious real wear: kerbed alloys with visible silver gouges, cracked bumpers, scuffs across body lines, missing trim, tyre cords showing, cracked screens, ripped seats, water staining, warning lights on the dash.
- BEFORE flagging anything as "notable" damage, sanity-check: is the mark visible from more than one angle, does it break a reflection, and would a reasonable buyer notice it standing 2m away? If not, downgrade to "minor" or skip.

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
        sellerTip: { type: "string", description: "One personal, practical sentence of advice for the seller. Any £ figure must be consistent with privateSaleValue." },
        identifiedVariant: { type: "string", description: "Exact model/trim if badges, photos or the description show it (e.g. 'RS6 Avant', 'Golf R', 'M3'); empty string if unsure." },
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
    // Rate limit / daily cap / optional Turnstile / premium (only if PREMIUM_ENFORCED=true).
    const g = await guard(req, { feature: "analyse", requireUser: false, requirePremium: true, turnstile: true, perMinute: 4, perDay: 25, ipPerHour: 40 });
    if (g.response) return g.response;

    const body = (await req.json().catch(() => null)) as AnalyseRequest | null;
    let tokenHash: string | null = null;
    let guestValuationId: string | null = null;
    if (!g.userId) {
      if (typeof body?.guestToken !== "string" || !/^[a-f0-9]{64}$/.test(body.guestToken)) {
        return json({ error: "Please refresh the page and try again." }, 400);
      }
      const cap = envInt("GUEST_DAILY_CAP", 3);
      const ip = clientIp(req);
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body.guestToken));
      tokenHash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
      const okIp = await checkLimit(`analyse:guest:ip:${ip}:d`, 86400, cap);
      const okTok = await checkLimit(`analyse:guest:t:${tokenHash}:d`, 86400, cap);
      if (!okIp || !okTok) {
        return json({ error: "You've used today's free guest valuations. Create a free account to keep going — it takes 30 seconds and your reports are saved.", code: "guest_limit" }, 429);
      }
      guestValuationId = crypto.randomUUID();
    }
    if (!body?.make || !body?.model || !body?.year || body?.mileage == null) {
      return new Response(JSON.stringify({ error: "Missing required vehicle fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const AI_API_KEY = Deno.env.get("AI_API_KEY") || Deno.env.get("LOVABLE_API_KEY");
    if (!AI_API_KEY) {
      return new Response(JSON.stringify({ error: "AI provider not configured (set AI_API_KEY or LOVABLE_API_KEY)" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const AI_GATEWAY_URL = Deno.env.get("AI_GATEWAY_URL") || "https://ai.gateway.lovable.dev/v1/chat/completions";

    // Resolve the caller from their JWT (never trust body.userId for access control).
    let callerId: string | null = null;
    try {
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.replace(/^Bearer\s+/i, "");
      const SU = Deno.env.get("SUPABASE_URL"); const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (token && SU && SR) {
        const { data } = await createClient(SU, SR).auth.getUser(token);
        callerId = data?.user?.id ?? null;
      }
    } catch (e) { console.warn("Could not resolve caller", e); }

    // Build labeled photo list (slot + ref). Accepts either storage paths
    // (new private-bucket clients) or legacy public URLs. All refs are then
    // signed via service-role for the AI vision call.
    const guestLabeled: { slot: PhotoSlot; ref: string }[] = [];
    if (guestValuationId && Array.isArray(body.guestPhotos)) {
      const admin = adminClient();
      for (const [i, item] of body.guestPhotos.slice(0, 6).entries()) {
        if (!item || typeof item.dataUrl !== "string") continue;
        const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(item.dataUrl);
        if (!match || match[2].length > Math.ceil(1.5 * 1024 * 1024 / 3) * 4) continue;
        try {
          const decoded = atob(match[2]);
          if (!decoded.length || decoded.length > 1.5 * 1024 * 1024) continue;
          const bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
          const ext = match[1] === "jpeg" ? "jpg" : match[1];
          const path = `guest/${guestValuationId}/${i}.${ext}`;
          if (!admin) { console.warn("Guest photo upload unavailable"); continue; }
          const { error } = await admin.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: `image/${match[1]}`, upsert: false });
          if (error) { console.warn("Guest photo upload failed", error.message); continue; }
          guestLabeled.push({ slot: VALID_SLOTS.includes(item.slot as PhotoSlot) ? item.slot as PhotoSlot : "other", ref: path });
        } catch (e) { console.warn("Guest photo upload failed", e); }
      }
    }
    const rawLabeled: { slot: PhotoSlot; ref: string }[] = guestValuationId ? guestLabeled : (() => {
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
    const signed = await signPhotoRefsForAi(rawLabeled.map((p) => p.ref), guestValuationId ? `guest/${guestValuationId}/` : callerId ? `${callerId}/` : null);
    const labeledPhotos: { slot: PhotoSlot; url: string }[] = rawLabeled
      .map((p, i) => ({ slot: p.slot, url: signed[i] }))
      .filter((p) => !!p.url);
    const photoUrls = labeledPhotos.map((p) => p.url);

    // Fetch MOT history + MarketCheck pricing in parallel BEFORE calling the AI,
    // so we can feed real signals (corrosion advisories, fails, etc.) into the prompt.
    const seed = hash(`${body.make}|${body.model}|${body.year}|${body.mileage}|${body.registration ?? ""}`);
    // eng-4: DVLA gives "A6" for an RS6. Infer the real trim from engine size + seller text
    // before anything is priced, so perf detection / comps / pm all see the true variant.
    const variantRes = resolveVariant({
      make: body.make, model: body.model, variant: body.variant, fuel: body.fuelType ?? null,
      cc: Number(body.engineCapacity ?? (body.guestSave?.vehicle as any)?.engineCapacity) || null,
      year: body.year, gearbox: body.transmission ?? null,
      text: [body.serviceNotes, (body as any).modifications].filter(Boolean).join(" "),
    });
    if (variantRes.variant && variantRes.source !== "provider") body.variant = variantRes.variant;
    const perf = detectPerformanceVariant(body.make, body.model, body.variant, body.serviceNotes);
    const [mcGeneric, dvsa, perfPool] = await Promise.all([
      fetchMarketCheckPricing(body.make, body.model, body.year, body.mileage, body.variant),
      body.registration && body.registration.trim().length >= 2
        ? fetchDvsaMotHistory(body.registration).catch((e) => {
            console.error("DVSA fetch failed", e);
            return { entries: [], error: "MOT service temporarily unavailable" } as const;
          })
        : Promise.resolve({ entries: [] as MotEntryOut[] }),
      perf ? fetchPerformancePool(body.make, compSearchModels(body.make, body.model).slice(-1)[0] ?? body.model, body.year) : Promise.resolve([] as ComparableListing[]),
    ]);
    const perfComps = applyPerformanceComps(mcGeneric, perfPool, perf);
    const mc = perfComps.mc;
    const perfFallback = !!perf && perfComps.match === "fallback";
    const debugInfo: Record<string, unknown> = {};

    // Extract MOT signals — ONLY use the latest test for pricing / watchPoints
    const motEntries: MotEntryOut[] = [...(dvsa.entries ?? [])];
    const latestTest = motEntries[0];
    const latestAdvisories = latestTest?.advisories ?? [];

    // Years legitimately allowed in narrative output: vehicle year, current
    // year, current+1, plus the real MOT expiry year (DVSA or user-provided).
    const motExpiryYearFromDvsa = currentMotExpiry(motEntries) ? Number(String(currentMotExpiry(motEntries)).slice(0, 4)) : undefined;
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

    // Reconcile the declared mileage with DVSA odometer readings. A small gap
    // (≤ max(3,000 mi, 3%)) or a round advert figure is not clocking: price on
    // the higher reading and show a gentle note instead of a penalty.
    const motMaxMiles = motEntries.reduce((m, e) => Math.max(m, Number(e.mileage) || 0), 0);
    const mileageCheck = reconcileMileage(body.mileage, motMaxMiles);
    const pricedMiles = mileageCheck.miles;
    const mileageNote = mileageNoteText(mileageCheck);

    // PRE-AI shadow figures (shadow only — never affect displayed prices; never throw).
    let preAi: { pm: any; motAdj: any; pmWithMot: number | null; ocBase: any; similar: any[] } | null = null;
    try {
      const pmIn = {
        make: body.make, model: body.model, variant: body.variant ?? null, year: body.year, mileage: pricedMiles,
        fuel: body.fuelType ?? null, gearbox: body.transmission ?? null, body: body.bodyStyle ?? null,
        engine_cc: Number(body.engineCapacity ?? (body.guestSave?.vehicle as any)?.engineCapacity) || null,
        desc: [body.serviceNotes, body.modifications].filter(Boolean).join(" ") || null,
      };
      const pm = pricePmBoth(pmIn);
      const motAdj = motSignalAdjustment(motSignals(motEntries as any, { year: body.year }), pm.private.price);
      const ocBase = valueWithOwnComps({ // NO conditionScore/photoInsights: neutral base, computable before the AI
        make: body.make, model: body.model, variant: body.variant, year: body.year, mileage: pricedMiles,
        fuel: body.fuelType, gearbox: body.transmission, adText: body.variant, currentYear: CURRENT_YEAR,
      } as any);
      const similar = similarAdverts({ make: body.make, model: body.model, variant: body.variant, year: body.year, mileage: pricedMiles,
        fuel: body.fuelType, gearbox: body.transmission }, 5);
      preAi = { pm, motAdj, pmWithMot: Math.round(pm.private.price * motAdj.factor / 50) * 50, ocBase, similar };
    } catch (e) { console.warn("preAi shadow failed", e); preAi = null; }

    // Build a mileage-weighted anchor from the actual live listings.
    // Use a fully deterministic sort so identical inputs yield identical anchors
    // even when MarketCheck returns the same listings in a different order.
    // Match fuel type and transmission when enough comparables share them.
    const specFilter = filterCompsBySpec(mc?.listings ?? [], body.fuelType, body.transmission);
    const allListings = specFilter.comps;
    const sortedByMileageDistance = [...allListings].sort((a, b) => {
      const da = Math.abs(a.mileage - pricedMiles);
      const db = Math.abs(b.mileage - pricedMiles);
      if (da !== db) return da - db;
      if (a.price !== b.price) return a.price - b.price;
      if (a.year !== b.year) return a.year - b.year;
      return (a.url ?? "").localeCompare(b.url ?? "");
    });
    const anchorSubset = sortedByMileageDistance.slice(0, Math.min(15, allListings.length));
    // Each comparable is corrected to this car's mileage and year before taking
    // the median (see _shared/pricing.ts), replacing the old step adjustment.
    const rawMedianOfSubset = anchorSubset.length >= 3 ? median(anchorSubset.map((l) => l.price)) : (mc?.median ?? 0);
    const anchorMedianRaw = anchorSubset.length >= 3
      ? (compAdjustedAnchor(anchorSubset.map((l) => ({ price: l.price, miles: l.mileage, year: l.year })), pricedMiles, body.year) ?? rawMedianOfSubset)
      : (mc?.median ?? 0);
    // Round the anchor to a stable grain so small price wobbles in the sample
    // (one listing changing by £200) don't bleed into the final valuation.
    const anchorMedian = anchorMedianRaw > 0 ? roundToGrain(anchorMedianRaw) : 0;
    // Median of the corrected comps, for labelling the mileage/age correction
    // separately from the cheap-market lower-quantile step.
    const anchorAdjMedian = anchorSubset.length >= 3
      ? (compAdjustedAnchor(anchorSubset.map((l) => ({ price: l.price, miles: l.mileage, year: l.year })), pricedMiles, body.year, 0.5) ?? anchorMedianRaw)
      : anchorMedianRaw;
    const compMedianMiles = anchorSubset.length >= 3 ? median(anchorSubset.map((l) => l.mileage).filter((m) => m > 0)) : null;
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

These are REAL cars currently for sale in the UK. Use the anchor above as the dealer-asking benchmark for this exact car. These are mostly DEALER forecourt prices: a private sale typically lands 12-20% below them (more on cheap or high-mileage cars).`
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

    // AI anchor arm — prompt change behind ANCHOR_MODE (default off = unchanged request).
    const anchorMode = Deno.env.get("ANCHOR_MODE") || "off"; // off | split | on
    const armKey = `${body.make}|${body.model}|${body.year}|${body.mileage}|${body.registration ?? ""}`;
    const arm = preAi ? anchorArm(anchorMode, armKey) : "control";
    let anchorInput: any = null;
    if (arm === "anchor" && preAi) {
      const f = preAi.motAdj.factor;
      anchorInput = {
        pm: { private: preAi.pm.private.price * f, dealer: preAi.pm.dealer.price * f, low: preAi.pm.private.low * f, high: preAi.pm.private.high * f, known: preAi.pm.private.known },
        motAdjPct: preAi.motAdj.pct,
        ownComps: preAi.ocBase && !preAi.ocBase.unavailable ? { privatePrice: preAi.ocBase.privatePrice, low: preAi.ocBase.finalLow, high: preAi.ocBase.finalHigh,
          nComps: preAi.ocBase.nComps, level: preAi.ocBase.level, confidenceScore: preAi.ocBase.confidenceScore } : null,
        similar: preAi.similar,
      };
    }

    const userContent: any[] = [
      {
        type: "text",
        text:
`Vehicle:
- Vehicle year: ${body.year}
- Current year: ${CURRENT_YEAR}
- ${body.year} ${body.make} ${body.model}${body.variant ? ` — ${body.variant}` : ""}
- Mileage: ${pricedMiles.toLocaleString()} miles${pricedMiles !== body.mileage ? ` (latest MOT reading; advert says ${body.mileage.toLocaleString()})` : ""}
- Registration: ${body.registration || "not provided"}
- MOT expiry: ${(() => { const e = body.motExpiry || motEntries[0]?.expiryDate; if (!e) return "not provided"; const st = motStatus(e); return `${e} (${st.label}${st.kind === "due_soon" || st.kind === "expired" ? " — NOT a long MOT; do not describe it as long, fresh or a selling point" : ""})`; })()}
- Service notes: ${body.serviceNotes || "none provided"}
- Modifications / extras: ${body.modifications || "none provided"}
- Colour: ${body.colour || "not provided"}
- Fuel: ${body.fuelType || "not provided"}${!(dvsa.entries ?? []).length && body.motAdvisories?.length ? `\n- Latest MOT advisories (from lookup): ${body.motAdvisories.join("; ")}` : ""}
- Photos attached: ${photoUrls.length}
${labeledPhotos.length > 0 ? `
PHOTO LIST — the images below are sent in this exact order. Use the Photo N number as photoIndex in every photoInsight. There are NO slot labels — look at each image and set the slot purely from what you actually see:
${labeledPhotos.map((_, i) => `  Photo ${i + 1} — determine what this image shows by looking at it.`).join("\n")}` : ""}

${marketBlock}

${motBlock}

Be honest and conservative. Lean lower if there are negatives. Call out high mileage, corrosion and history gaps explicitly. If you mention the car's year, you must say ${body.year}. If you mention the current year or today's market, you must say ${CURRENT_YEAR}. Call the valu8_report function.` + (arm === "anchor" && anchorInput ? "\n\n" + anchorBlock(anchorInput) : ""),
      },
      ...photoUrls.map((url) => ({ type: "image_url", image_url: { url } })),
    ];

    const aiStart = Date.now();
    const aiModel = Deno.env.get("AI_MODEL") || "google/gemini-2.5-flash";
    const aiResp = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${AI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        tools: [arm === "anchor" && anchorInput
          ? { ...TOOL, function: { ...TOOL.function, parameters: { ...TOOL.function.parameters, properties: { ...TOOL.function.parameters.properties, ...DEVIATION_REASON_PROPERTY } } } }
          : TOOL],
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
        distinctId: callerId,
      });
      const message = aiResp.status === 429
        ? "AI service is busy right now — please try again in a moment."
        : aiResp.status === 402
          ? "AI credits exhausted on the configured AI provider."
          : "AI analysis is temporarily unavailable. Please try again shortly.";
      return new Response(
        JSON.stringify({ error: message, fallback: true }),
        { status: aiResp.status === 429 ? 429 : 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiData = await aiResp.json();
    capturePosthogAiGeneration({
      model: aiModel, latencyMs: aiLatency, httpStatus: 200,
      inputTokens: aiData?.usage?.prompt_tokens,
      outputTokens: aiData?.usage?.completion_tokens,
      totalTokens: aiData?.usage?.total_tokens,
      feature: "analyse-vehicle",
      distinctId: callerId,
      extra: { make: body.make, model: body.model, year: body.year, photoCount: photoUrls.length },
    });
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in AI response", JSON.stringify(aiData));
      throw new Error("AI did not return a structured report");
    }

    let parsedArgs: unknown;
    try { parsedArgs = JSON.parse(toolCall.function.arguments); }
    catch (e) {
      console.error("AI returned malformed tool arguments", e);
      return new Response(JSON.stringify({ error: "AI returned an unreadable report. Please try again." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const ai = parsedArgs as {
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
        photoIndex?: number;
      }>;
      headline?: string;
      marketContext?: string;
      factorsUp?: string[];
      factorsDown?: string[];
      sellerTip?: string;
      negotiationBuffer?: number;
      recommendations: { whereToSell: string[]; highlights: string[]; documents: string[] };
    };

    // Strip "long MOT" claims the AI may make when the MOT is actually due soon/expired.
    {
      const exp = body.motExpiry || motEntries[0]?.expiryDate;
      const fix = (t?: string) => (t ? sanitizeMotClaim(t, exp) : t);
      const fixList = (l?: string[]) => (Array.isArray(l) ? l.filter((x) => !isFalseLongMotClaim(x, exp)) : l);
      ai.honestAnalysis = fix(ai.honestAnalysis) as string;
      ai.valueReasoning = fix(ai.valueReasoning) as string;
      ai.marketPositioning = fix(ai.marketPositioning) as string;
      ai.headline = fix(ai.headline);
      ai.sellerTip = fix(ai.sellerTip);
      ai.marketContext = fix(ai.marketContext);
      ai.strengths = fixList(ai.strengths) ?? [];
      ai.factorsUp = fixList(ai.factorsUp);
      if (ai.recommendations) {
        ai.recommendations.highlights = fixList(ai.recommendations.highlights) ?? [];
        ai.recommendations.documents = (ai.recommendations.documents ?? []).map((d) => fix(d) as string);
      }
    }

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
    const adjustments: { label: string; impactPct: number; scope?: LedgerItem["scope"] }[] = [];

    const age = Math.max(0, CURRENT_YEAR - body.year);
    const expectedMileage = age <= 0 ? 3000 : age * 8000;
    const mileageRatio = pricedMiles / Math.max(expectedMileage, 1);
    // Only seller-written text is keyword-scanned; colour/fuel/MOT data are passed as structured fields.
    const serviceText = `${body.serviceNotes ?? ""}\n${body.modifications ?? ""}`.toLowerCase();
    const hasStrongHistory = /(full service history|fsh|main dealer|marque specialist|specialist serviced|full history|complete service history|every service|all stamps|stamped book)/i.test(serviceText);
    const hasPartialHistory = /(partial|part service|patchy|some history|limited history|few stamps)/i.test(serviceText);
    const noHistory = /(no history|no service history|missing history|no records|history lost)/i.test(serviceText);
    // Recent major mechanical work — strong positive signal for private buyers
    const recentMajorWork = /(cambelt|timing belt|timing chain|new clutch|clutch replaced|subframe|new turbo|turbo replaced|new dpf|dpf replaced|new battery|hybrid battery|injectors replaced|gearbox rebuilt|suspension overhaul|new shocks|new dampers|coilovers fitted|full respray|new tyres all round|four new tyres|brake discs and pads|new brakes|recently serviced|just serviced|fresh service|fresh mot)/i.test(serviceText);
    const desirableSpec = /(manual|alcantara|carbon|ceramic|sports exhaust|akrapovic|milltek|panoramic|sunroof|heads.?up|hud|adaptive cruise|matrix led|night vision|comfort access|harman|bang.?olufsen|burmester|bowers|pan roof|extended leather|nappa|m sport plus|black pack|tech pack|premium plus|sport plus|launch edition|first edition|limited edition|low owners?|one owner|two owners|sole owner|original paint|garaged|never tracked|non.?smoker|pet.?free)/i.test(serviceText);
    const needsWork = mentionsUnnegated(/(needs|due|overdue|warning light|smoke|fault|damage|dent|scuff|scratch|leak|issue|rust|corrosion)/i, serviceText);

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
      // Every item below lands in ONE ledger (see finalisePricing): retail-scope
      // items sum to the net % applied to the anchor, so the listed adjustments
      // are exactly what moved the price. Mileage is priced once — inside the
      // comp-corrected anchor plus the residual high-mileage curve.
      const items: LedgerItem[] = [];
      const add = (label: string, impactPct: number, scope: LedgerItem["scope"] = "retail") => items.push({ label, impactPct, scope });

      const milesVsSample = pricedMiles / Math.max(mc.avgMiles ?? expectedMileage, 1);
      const compCorrectionPct = rawMedianOfSubset > 0 && anchorAdjMedian > 0 ? Math.round((anchorAdjMedian / rawMedianOfSubset - 1) * 100) : 0;
      if (Math.abs(compCorrectionPct) >= 2) {
        add(compCorrectionPct < 0 ? "Higher mileage / older than comparables" : "Lower mileage / newer than comparables", compCorrectionPct, "anchor");
      }
      const cheapMarketPct = anchorAdjMedian > 0 && anchorMedianRaw > 0 ? Math.round((anchorMedianRaw / anchorAdjMedian - 1) * 100) : 0;
      if (cheapMarketPct <= -2) add("Budget market: priced on lower-middle of comparables", cheapMarketPct, "anchor");

      // --- MOT corrosion / failures (real DVSA signals). The advisory-count
      // deduction is skipped when corrosion already covers the advisories.
      // Mild for routine "not seriously weakened" corrosion, strong for
      // serious/structural corrosion and failures in the last 12 months, capped.
      items.push(...motPenaltyItems(motEntries, new Date().toISOString().slice(0, 10)));
      // A failed latest test with no MOT left means the car can't legally be
      // driven: it sells as a project, far below MOT'd comps (Golf NL61TWY).
      if (failedWithoutValidMot(motEntries)) add("Failed latest MOT — no valid MOT", -20);
      // Declared write-off category / spares-or-repair in the seller's notes.
      items.push(...declaredStatusItems(serviceText));

      if (hasStrongHistory) add("Full service history", 6);
      else if (hasPartialHistory) add("Partial service history", -5);
      else if (noHistory) add("No service history", -10);
      if (recentMajorWork) add("Recent major mechanical work", 5);
      if (desirableSpec) add("Desirable spec / options", 3);
      if (enthusiast && pricedMiles < 50000) add("Sought-after enthusiast spec", 3);
      if (needsWork && !corrosionMatches) add("Issues noted in description", -4);

      // --- Condition score (visible condition only; the prompt forbids scoring mileage).
      let conditionPct = 0;
      if (score >= 9.0) conditionPct = 12;
      else if (score >= 8.5) conditionPct = 8;
      else if (score >= 8.0) conditionPct = 5;
      else if (score >= 7.5) conditionPct = 2;
      else if (score >= 7.0) conditionPct = 0;
      else if (score >= 6.5) conditionPct = -3;
      else if (score >= 6.0) conditionPct = -7;
      else if (score >= 5.5) conditionPct = -12;
      else if (score >= 5.0) conditionPct = -17;
      else conditionPct = -22;
      // No photos → the score is a guess, not an observation: don't price it.
      if (photoUrls.length === 0) conditionPct = 0;
      if (conditionPct !== 0) {
        add(conditionPct > 0
          ? `${ai.conditionLabel || "Strong"} visible condition (${score.toFixed(1)}/10)`
          : `Condition deductions (${score.toFixed(1)}/10)`, conditionPct);
      }

      // --- MOT expiry: dealers re-MOT before sale, so it affects private only.
      const motAdj = motAdjustment(body.motExpiry || currentMotExpiry(motEntries));
      if (motAdj) add(motAdj.label, motAdj.impactPct, "private");

      // --- Possible clocking: only a gap beyond tolerance that isn't rounding.
      if (mileageCheck.status === "clocking") {
        add(`Declared mileage below MOT record (${mileageCheck.motMax.toLocaleString()} mi)`, -15);
      }

      // --- Photo-level damage (validated line items only; capped).
      const photoImpactGbp = sumPhotoImpacts(validatePhotoInsights(ai.photoInsights ?? []));
      const photoImpactAnchor = Math.max(1, (anchorMedian > 0 ? anchorMedian : mc.median) || 1);
      const photoImpactPct = Math.round(clamp(photoImpactGbp / photoImpactAnchor, -0.08, 0.04) * 100);
      if (photoImpactPct !== 0) add("Specific issues seen in photos", photoImpactPct);

      let anchor = anchorMedian > 0 ? anchorMedian : mc.median;
      if (allListings.length > 0 && allListings.length < 3) {
        anchor = roundToGrain(compAdjustedAnchor(allListings.map((l) => ({ price: l.price, miles: l.mileage, year: l.year })), pricedMiles, body.year, 0.5) ?? anchor);
      }
      const thinN = Math.min(mc.count, allListings.length || mc.count);
      if (thinN < THIN_COMP_FULL_WEIGHT) {
        const prior = retailFromPrivate(aiPrivate);
        const sh = shrinkThinAnchor(anchor, prior, thinN);
        const pct = Math.round((sh.anchor / anchor - 1) * 100);
        debugInfo.thinShrink = { n: thinN, compAnchor: anchor, priorRetail: Math.round(prior), weight: sh.weight };
        if (pct !== 0) add(`Only ${thinN} comparable${thinN === 1 ? "" : "s"}: blended with model estimate`, pct, "anchor");
        anchor = roundToGrain(sh.anchor);
      }
      if (perfComps.match === "parent" && perfComps.premium && perfComps.premium !== 1) {
        const pct = Math.round((perfComps.premium - 1) * 100);
        add(`${perf?.specific?.label} premium over ${body.model} parent-trim comparables`, pct, "anchor");
        anchor = roundToGrain(anchor * perfComps.premium);
      }
      // Cheap-car rules: no history/recent-work uplift under ~£2k private, and
      // budget anchor + soft MOT/description deductions capped at -12%.
      const pricedItems = applyCheapCarRules(items, { anchor, correctedMedian: anchorAdjMedian > 0 ? anchorAdjMedian : anchor });
      const ledger = finalisePricing({ anchor, miles: pricedMiles, compMedianMiles, items: pricedItems });
      let dealerRetail = ledger.dealerRetail;
      let privateSale = ledger.privateSale;
      let dealerTradeIn = ledger.dealerTradeIn;
      for (const it of ledger.items) adjustments.push(it);

      // Sanity floor for ultra-rare cars
      if (ultraRare && exoticAnchor && dealerRetail < exoticAnchor.low * 0.7) {
        dealerRetail = roundToGrain(exoticAnchor.low * 0.85);
        privateSale = roundToGrain(dealerToPrivate(dealerRetail) * Math.max(0.3, 1 + ledger.privateNetPct / 100));
        dealerTradeIn = roundToGrain(tradeFrom(dealerRetail, privateSale));
        adjustments.push({ label: "Adjusted toward known exotic floor (sparse market data)", impactPct: 0, scope: "anchor" });
      }

      // Range — tighter for strong cars, wider for problem cars
      const negativeCount = adjustments.filter((a) => a.impactPct < 0).length;
      const positiveCount = adjustments.filter((a) => a.impactPct > 0).length;
      let spread = negativeCount >= 3 ? 0.12 : negativeCount >= 1 ? 0.08 : 0.06;
      if (positiveCount >= 3 && negativeCount === 0) spread = 0.05;
      if (ultraRare) spread = Math.max(spread, 0.20);
      ({ low: rangeLow, high: rangeHigh } = privateRange(privateSale, spread));

      // --- Confidence reasoning (short, model-specific) ---
      const isOutlierMileage = milesVsSample >= 1.5 || milesVsSample <= 0.5;
      const carName = `${body.make} ${body.model}${body.variant ? ` ${body.variant}` : ""}`.trim();
      const shortName = body.variant ? `${body.model} ${body.variant}` : body.model;
      const mileageDescriptor = pricedMiles >= 100000 ? "high-mileage " : pricedMiles <= 30000 ? "low-mileage " : "";

      const tier = marketConfidenceTier({ sampleSize: mc.count, outlierMileage: isOutlierMileage });
      if (ultraRare) {
        confidence = "Low";
        confidenceReason = `Very few ${carName}s come up for sale, so this is a guide rather than a firm figure.`;
        rareCarWarning = LIMITED_DATA_WARNING;
      } else if (tier === "High") {
        confidence = "High";
        confidenceReason = `Plenty of comparable ${shortName}s on the market right now (${mc.count.toLocaleString()} listings), so this figure is well-supported.`;
      } else if (tier === "Medium") {
        confidence = "Medium";
        confidenceReason = isOutlierMileage && mc.count >= 150
          ? `Lots of ${shortName}s for sale, but few with mileage like yours — we've corrected each comparable to match.`
          : `Reasonable number of similar ${shortName}s for sale. We've weighed each factor carefully — this figure is well-supported.`;
      } else if (tier === "Low") {
        confidence = "Low";
        confidenceReason = `Not many ${mileageDescriptor}${shortName}s like yours on the market right now, so treat this as a useful guide rather than an exact price.`;
      } else {
        confidence = "Very Low";
        confidenceReason = `Very few ${shortName}s on sale to compare against — this is a rough guide only.`;
      }

      if (perf && perfFallback) {
        // Never silently value a performance variant off its everyday siblings.
        confidence = downgradeConfidence(confidence);
        confidenceReason = `Only ${perfComps.matchedCount} ${perf.label} listing${perfComps.matchedCount === 1 ? "" : "s"} found, so this is based on wider ${body.model} listings and may undervalue a performance variant — treat as a rough guide.`;
      } else if (perf && perfComps.match === "parent") {
        confidence = downgradeConfidence(confidence);
        confidenceReason = `Very few ${perf.specific?.label}s are for sale, so this is priced from ${body.model} ${perf.specific?.label?.replace(/-R$/, "")} listings plus a typical ${perf.specific?.label} premium — treat as a guide.`;
      } else if (perf) {
        confidenceReason += ` Compared only against ${perf.specific?.label && perfComps.match === "specific" ? perf.specific.label : perf.label} listings.`;
      }
      values = { dealerTradeIn, privateSale, dealerRetail };
      const baseRetail = ledger.baseRetail;
      marketBaseline = {
        source: "MarketCheck UK",
        sampleSize: mc.count,
        baseDealerRetail: baseRetail,
        basePrivateSale: roundToGrain(dealerToPrivate(baseRetail)),
        baseTradeIn: roundToGrain(tradeFrom(baseRetail, dealerToPrivate(baseRetail))),
        // Equals the sum of the retail-scope adjustments listed in the report.
        netAdjustmentPct: ledger.retailNetPct,
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
        mileage: pricedMiles,
        motExpiry: body.motExpiry,
        serviceNotes: [body.serviceNotes, body.modifications].filter(Boolean).join("\n"),
        photoCount: photoUrls.length,
        conditionScore: score,
        aiPrivateValue: aiPrivate > fallback * 0.25 ? aiPrivate : fallback,
      });
      const motDays = motDaysRemaining(body.motExpiry || currentMotExpiry(motEntries));
      const cal = calibrateAiPrivate({
        aiPrivate: market.center, make: body.make, year: body.year, miles: pricedMiles,
        currentYear: CURRENT_YEAR, motValid: motDays != null && motDays >= 0,
      });
      // Same deterministic post-adjustments as the comps path (MOT penalties,
      // failed MOT with no valid MOT, declared write-off / spares, clocking).
      const post = aiPathAdjustments({
        motItems: motPenaltyItems(motEntries, new Date().toISOString().slice(0, 10)),
        failedNoMot: failedWithoutValidMot(motEntries),
        declared: declaredStatusItems(serviceText),
        clocking: mileageCheck.status === "clocking",
        motMax: mileageCheck.motMax,
        privateEstimate: cal.privateSale,
      });
      for (const it of post.items) adjustments.push(it);
      const fair = Math.max(100, cal.privateSale * post.factor * aiAgeFactor(age));
      const calRatio = fair / Math.max(1, market.center);
      // Retail implied by the same dealer-cost model used on the comps path.
      const impliedRetail = retailFromPrivate(fair / Math.max(0.5, 1 - highMileagePenalty(pricedMiles)));
      values = {
        dealerTradeIn: roundToGrain(tradeFrom(impliedRetail, fair)),
        privateSale: roundToGrain(fair),
        dealerRetail: roundToGrain(Math.max(impliedRetail, fair * 1.08)),
      };
      // For ultra-rare cars, widen the range further to communicate uncertainty.
      if (ultraRare) {
        rangeLow = roundToGrain(fair * 0.75);
        rangeHigh = roundToGrain(fair * 1.25);
      } else {
        ({ low: rangeLow, high: rangeHigh } = {
          low: Math.min(values.privateSale, roundToGrain(market.low * calRatio)),
          high: Math.max(values.privateSale, roundToGrain(market.high * calRatio)),
        });
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
        if (MARKETCHECK_ENABLED && marketCheckRecentlyThrottled()) {
          confidence = "Very Low";
          confidenceReason = "Live market data was temporarily unavailable, so this is a model estimate without comparable listings — try again in a few minutes for a market-backed figure.";
          debugInfo.marketCheckThrottled = true;
        }
        pricingReasoning = market.reasoning;
      }
      dataSource = "ai_estimate";
    }

    // Own-comps engine (SHADOW MODE): priced from our own collected listings and
    // logged alongside the live figure for evaluation. It does NOT set the price yet —
    // held-out accuracy has not beaten the current path (see docs/own-comps-pricing.md).
    let ownCompsShadow: Record<string, unknown> | undefined;
    let engineShown = false;
    let ownForCap: { privatePrice: number; level: string; nComps: number; confidenceScore: number; unavailable?: boolean; dealerPrice?: number; perf?: boolean } | null = null;
    try {
      const oc = valueWithOwnComps({
        make: body.make, model: body.model, variant: body.variant, year: body.year, mileage: pricedMiles,
        fuel: body.fuelType, gearbox: body.transmission, adText: body.variant, currentYear: CURRENT_YEAR,
        conditionScore: score, photoInsights: Array.isArray(ai.photoInsights) ? ai.photoInsights : [],
        declaredStatus: serviceText,
      });
      ownCompsShadow = {
        version: "owncomps-1", privateSale: oc.finalPrivate, low: oc.finalLow, high: oc.finalHigh, unavailable: oc.unavailable,
        level: oc.level, confidence: oc.confidence, confidenceScore: oc.confidenceScore, nComps: oc.nComps, segment: oc.segment,
        adjustments: oc.adjustments.map((a) => ({ key: a.key, pct: a.pct, basis: a.basis })),
      };
      debugInfo.ownComps = { ...ownCompsShadow, nearest: oc.nearest, perfKey: oc.perfKey, trimUpliftPct: oc.trimUpliftPct };
      ownForCap = { privatePrice: oc.privatePrice, level: oc.level, nComps: oc.nComps, confidenceScore: oc.confidenceScore, unavailable: oc.unavailable,
        dealerPrice: oc.dealerPrice, perf: !!oc.perfKey };
    } catch (e) {
      console.warn("ownComps shadow failed", e);
    }

    let pmShadow: Record<string, unknown> | null = null;
    try {
      const pm = pricePmBoth({
        make: body.make, model: body.model, variant: body.variant ?? null, year: body.year, mileage: pricedMiles,
        fuel: body.fuelType ?? null, gearbox: body.transmission ?? null, body: body.bodyStyle ?? null,
        engine_cc: Number(body.engineCapacity ?? (body.guestSave?.vehicle as any)?.engineCapacity) || null,
        desc: [body.serviceNotes, body.modifications].filter(Boolean).join(" ") || null,
      });
      pmShadow = {
        version: pm.private.version, private: pm.private.price, dealer: pm.dealer.price,
        low: pm.private.low, high: pm.private.high, known: pm.private.known,
        blend: blendWithOwnComps(pm.private.price, ownForCap && !ownForCap.unavailable ? ownForCap.privatePrice : null),
        bodySource: resolveBody(body.make, body.model, body.bodyStyle ?? null).source,
        motAdj: preAi ? { pct: preAi.motAdj.pct, band: preAi.motAdj.band, parts: preAi.motAdj.parts } : null,
        motSignals: preAi?.motAdj.signals ?? null,
        pmWithMot: preAi?.pmWithMot ?? null,
        firstRegistered: body.firstRegistered ?? null,
      };
      debugInfo.pm = pmShadow;
    } catch (e) { console.warn("pm shadow failed", e); pmShadow = null; }

    // AI safety cap: on the AI-only path, pull clear blowups down to a bounded multiple of a CONFIDENT
    // own-comps figure (see _shared/aiCap.ts). All figures and the private range are scaled together so
    // trade < private range (containing the realistic price) < retail still holds before coherentPricing.
    if (dataSource === "ai_estimate" && !valuationUnavailable && values.privateSale > 0) {
      const cap = aiSafetyCap({ aiPrivate: values.privateSale, own: ownForCap });
      debugInfo.aiCap = cap;
      if (cap.applied && cap.capped < values.privateSale) {
        const k = cap.capped / values.privateSale;
        values = {
          dealerTradeIn: roundToGrain(values.dealerTradeIn * k),
          privateSale: cap.capped,
          dealerRetail: roundToGrain(values.dealerRetail * k),
        };
        rangeLow = Math.min(roundToGrain(rangeLow * k), values.privateSale);
        rangeHigh = Math.max(roundToGrain(rangeHigh * k), values.privateSale);
      }
    }

    // ens-3 engine = the SHOWN price on the no-MarketCheck path (see _shared/engine.ts): pm-1 + own-comps from our
    // collected adverts, MOT-history signals, retail >= private. The AI estimate above stays as the fallback when the
    // engine is not confident (no same-model comps, 25+ year-old car) or anything fails. Never throws.
    if (dataSource === "ai_estimate" && !valuationUnavailable && values.privateSale > 0 && preAi && ownForCap) {
      try {
        const e = engineValue({
          pm: { private: preAi.pm.private.price * preAi.motAdj.factor, low: preAi.pm.private.low * preAi.motAdj.factor, high: preAi.pm.private.high * preAi.motAdj.factor },
          ownComps: ownForCap,
          ctx: { year: body.year, currentYear: CURRENT_YEAR, pmNModel: preAi.pm.private.n_model ?? null, ocConfidence: ownForCap.confidenceScore ?? null,
            ocLevel: ownForCap.level ?? null, perf: !!ownForCap.perf, pmDealer: preAi.pm.dealer.price * preAi.motAdj.factor, ocDealer: ownForCap.dealerPrice ?? null },
          motFactor: preAi.motAdj.factor,
        });
        const engDbg: Record<string, unknown> | null = e ? { version: e.version, private: e.private, low: e.low, high: e.high, retail: e.retail, confident: e.confident, reason: e.reason, aiPrivate: values.privateSale, shown: false } : null;
        debugInfo.engine = engDbg;
        if (e && e.confident) {
          // MOT condition is already inside the figures (motSignals); add only declared write-off/spares and clocking.
          const led = engineLedger({ motParts: preAi.motAdj.parts, motPct: preAi.motAdj.pct, declared: declaredStatusItems(serviceText),
            clocking: mileageCheck.status === "clocking" && !preAi.motAdj.parts.some((x: any) => x.key === "odometer_drop") });
          const P = roundToGrain(Math.max(100, e.private * led.factor));
          const R = roundToGrain(Math.max(e.retail * led.factor, P * 1.08));
          values = { dealerTradeIn: roundToGrain(tradeFrom(R, P)), privateSale: P, dealerRetail: R };
          rangeLow = Math.min(roundToGrain(e.low * led.factor), P);
          rangeHigh = Math.max(roundToGrain(e.high * led.factor), P);
          adjustments.length = 0;
          for (const it of led.items) adjustments.push(it);
          const n = ownForCap.nComps ?? 0;
          confidence = ownForCap.level === "model" && n >= 20 ? "Medium" : "Low";
          confidenceReason = `Priced from ${n.toLocaleString("en-GB")} comparable UK adverts we have collected for this ${ownForCap.level === "model" ? "model" : "model family"}, matched on age, mileage, fuel and gearbox, blended with our trained pricing model.`;
          pricingReasoning = `Based on ${n.toLocaleString("en-GB")} similar UK adverts and our pricing model, adjusted for this car's MOT history.`;
          engineShown = true;
          debugInfo.engine = { ...engDbg, shown: true, private: P, retail: R, ledgerPct: led.netPct };
        }
      } catch (err) { console.warn("engine failed; keeping AI estimate", err); }
    }

    // Ensemble shadow (never affects displayed prices; never throws).
    let ensembleShadow: Record<string, unknown> | null = null;
    try {
      const pmE = preAi ? { private: preAi.pmWithMot ?? preAi.pm.private.price, low: preAi.pm.private.low * preAi.motAdj.factor, high: preAi.pm.private.high * preAi.motAdj.factor } : null;
      // ens-2: confidence-weighted pm/own-comps blend + retail figure (see _shared/ensemble.ts)
      const ctx = { year: body.year, currentYear: CURRENT_YEAR, pmNModel: preAi?.pm.private.n_model ?? null, ocConfidence: ownForCap?.confidenceScore ?? null,
        ocLevel: ownForCap?.level ?? null, perf: !!ownForCap?.perf, pmDealer: preAi ? preAi.pm.dealer.price * preAi.motAdj.factor : null, ocDealer: ownForCap?.dealerPrice ?? null };
      ensembleShadow = ensemble({ pm: pmE, ownComps: ownForCap, ai: dataSource === "ai_estimate" && !valuationUnavailable ? values.privateSale : null, ctx } as any) as any;
    } catch (e) { console.warn("ensemble shadow failed", e); }
    const anchorShadow = {
      mode: anchorMode, arm, price: anchorInput ? anchorPrice(anchorInput) : null,
      deviation: anchorInput && Number(ai.privateSaleValue) > 0 ? anchorDeviation(Number(ai.privateSaleValue), anchorPrice(anchorInput)) : null,
      deviationReason: arm === "anchor" ? (typeof (ai as any).deviationReason === "string" ? (ai as any).deviationReason.slice(0, 300) : "") : null,
    };
    debugInfo.ensemble = ensembleShadow;
    debugInfo.anchor = anchorShadow;

    // ----- eng-4 guards: performance variant comps + cross-source sanity -----
    let detectedModel: string | undefined = variantRes.displayModel;
    let guardNote: string | null = null;
    const markUnavailable = (why: string) => {
      valuationUnavailable = true;
      values = { dealerTradeIn: 0, privateSale: 0, dealerRetail: 0 };
      rangeLow = 0; rangeHigh = 0;
      confidence = "Low";
      confidenceReason = why;
      pricingReasoning = why;
      rareCarWarning = LIMITED_DATA_WARNING;
    };
    try {
      const aiVariantText = String((ai as any).identifiedVariant ?? "").slice(0, 80);
      const aiVar = aiTextVariant(body.make, body.model, [aiVariantText, ai.headline]);
      const perfEff = perf ?? aiVar;
      if (!detectedModel && perfEff) {
        const tok = variantToken(perfEff, body.model, `${body.variant ?? ""} ${aiVariantText}`);
        if (tok) detectedModel = tok.toUpperCase().replace(/\s+/g, "");
      }
      debugInfo.variantGuard = { resolved: variantRes, aiVariant: aiVariantText || null, perf: perfEff?.key ?? null };
      if (!valuationUnavailable && values.privateSale > 0) {
        if (perfEff) {
          const token = variantToken(perfEff, body.model, `${body.variant ?? ""} ${aiVariantText}`);
          const admin = adminClient();
          let rows: PerfCompRow[] = [];
          if (admin && token) {
            const t = token.replace(/\s+/g, ""), sp = t.replace(/^([a-z]+)(\d)/, "$1 $2");
            const { data } = await admin.from("market_listings").select("model,variant,year,mileage,price,seller")
              .ilike("make", `%${body.make}%`).gte("year", body.year - 4).lte("year", body.year + 4)
              .or(`model.ilike.%${t}%,variant.ilike.%${t}%,model.ilike.%${sp}%,variant.ilike.%${sp}%`).limit(1000);
            rows = (data ?? []) as PerfCompRow[];
          }
          const ref = perfCompReference(perfEff, rows, { year: body.year, mileage: pricedMiles, token, base: String(body.model ?? "").split(/\s+/)[0] });
          debugInfo.variantGuard = { ...(debugInfo.variantGuard as any), token, refN: ref.n, refPrivate: Math.round(ref.private) };
          const name = detectedModel ? `${displayMake(body.make)} ${detectedModel}` : perfEff.label;
          const an = /^[aeiou]/i.test(name) ? "an" : "a";
          if (ref.n < MIN_VARIANT_COMPS && (perfFallback || !perf || (dataSource === "ai_estimate" && ownForCap && !ownForCap.perf))) {
            markUnavailable(`We can’t value this one accurately yet — it looks like ${an} ${name}, a performance/rare variant, and we only have ${ref.n} comparable ${name} advert${ref.n === 1 ? "" : "s"}. Pricing it against standard models would badly undervalue it, so we'd rather not show a number. A marque specialist will give you a proper figure.`);
          } else if (ref.n >= MIN_VARIANT_COMPS) {
            const ratio = values.privateSale / ref.private;
            if (ratio < 0.75 || ratio > 1.33) {
              const k = ref.private / values.privateSale;
              values = { dealerTradeIn: roundToGrain(values.dealerTradeIn * k), privateSale: roundToGrain(ref.private), dealerRetail: roundToGrain(values.dealerRetail * k) };
              rangeLow = roundToGrain(Math.min(ref.low, values.privateSale)); rangeHigh = roundToGrain(Math.max(ref.high, values.privateSale));
              confidence = "Low";
              confidenceReason = `Priced against ${ref.n} ${name} adverts rather than standard ${body.model}s — treat as a guide.`;
              pricingReasoning = `Based on ${ref.n} ${name} adverts, adjusted for age and mileage.`;
            }
          } else if (perfFallback) {
            markUnavailable(`We can’t value this one accurately yet — it's ${an} ${name}, a performance/rare variant, and there aren't enough like-for-like adverts to compare against. A marque specialist will give you a proper figure.`);
          }
        } else if (variantRes.ambiguousPerf && variantRes.hint) {
          markUnavailable(`This car's ${variantRes.hint.options.length > 1 ? "engine size matches performance versions (" + variantRes.hint.options.join(" or ") + ")" : "engine size matches the " + variantRes.hint.options[0]}, which are worth far more than a standard ${body.model}. Please confirm the exact model on the details step so we can compare like-for-like.`);
        }
      }
      if (!valuationUnavailable && values.privateSale > 0) {
        const pr = proseRatio([ai.sellerTip, ai.headline, ai.marketContext, ai.honestAnalysis, ai.valueReasoning], values.privateSale);
        const sv = sanityVerdict({ shown: values.privateSale, aiPrivate: Number(ai.privateSaleValue) || null,
          disagreement: Number((ensembleShadow as any)?.disagreement) || null, proseRatio: pr });
        debugInfo.sanity = { ...sv, proseRatio: pr };
        if (sv.verdict === "unavailable") {
          markUnavailable("We can’t value this one accurately yet — our data sources disagree too much on this car (it may be a rare or performance version). We'd rather not show a number that could mislead you; a specialist will give you a proper figure.");
        } else if (sv.verdict === "lessCertain") {
          confidence = "Very Low";
          rangeLow = roundToGrain(Math.min(rangeLow, values.privateSale * 0.85));
          rangeHigh = roundToGrain(Math.max(rangeHigh, values.privateSale * 1.15));
          guardNote = "Our data sources disagree on this car, so treat this figure as a rough guide and check similar adverts before you list.";
          confidenceReason = guardNote;
        }
      }
    } catch (e) { console.warn("variant guard failed", e); }

    // Negotiation buffer: trust AI if reasonable (2-8% of privateSale), else default to ~4%.
    const aiBuffer = Number(ai.negotiationBuffer) || 0;
    const minBuf = values.privateSale * 0.02;
    const maxBuf = values.privateSale * 0.08;
    let askRangeOut: { low: number; high: number } | undefined;
    let negotiationBuffer = valuationUnavailable
      ? 0
      : roundTo50(clamp(aiBuffer > 0 ? aiBuffer : values.privateSale * 0.04, minBuf, maxBuf));
    // Enforce one coherent model: trade < private range ∋ realistic ≤ ask ≤ retail.
    let recommendedAskingPrice = 0;
    if (!valuationUnavailable && values.privateSale > 0) {
      const c = coherentPricing({
        privateSale: values.privateSale, tradeIn: values.dealerTradeIn, retail: values.dealerRetail,
        privateLow: rangeLow, privateHigh: rangeHigh, buffer: negotiationBuffer,
      });
      values = { dealerTradeIn: c.tradeIn, privateSale: c.privateSale, dealerRetail: c.retail };
      rangeLow = c.privateLow;
      rangeHigh = c.privateHigh;
      negotiationBuffer = c.buffer;
      recommendedAskingPrice = c.askLow;
      askRangeOut = { low: c.askLow, high: c.askHigh };
    }
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
        const observation = sanitizeNarrativeYears(
          fixOdometerWording(String(ins?.observation ?? "").trim()),
          body.year, CURRENT_YEAR, allowedNarrativeYears,
        ).slice(0, 140);
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
    // Drop zero-evidence items / non-photo deductions; upside is computed here, not by the AI.
    const validInsights = validatePhotoInsights(photoInsights as any[]) as typeof photoInsights;
    const motExpiryForText = body.motExpiry || currentMotExpiry(motEntries);
    const marketContext = sanitizeNarrativeYears(ai.marketContext ?? "", body.year, CURRENT_YEAR, allowedNarrativeYears);
    const sellerTip = sanitizeNarrativeYears(ai.sellerTip ?? "", body.year, CURRENT_YEAR, allowedNarrativeYears);

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

    const report = {
      conditionScore: Math.round(score * 10) / 10,
      conditionLabel: ai.conditionLabel,
      values,
      valueRange: valuationUnavailable ? undefined : { privateSaleLow: rangeLow, privateSaleHigh: rangeHigh },
      // Below £5,000 (our estimate) the headline is a measured ~70% range; values.privateSale stays the midpoint (see _shared/cheapRange.ts).
      priceRange: valuationUnavailable ? undefined : (cheapPriceRange(values.privateSale) ?? undefined),
      askRange: askRangeOut,
      valueReasoning: sanitizeNarrativeYears(valuationUnavailable || engineShown ? pricingReasoning : ai.valueReasoning, body.year, CURRENT_YEAR, allowedNarrativeYears),
      marketConfidence: confidence,
      marketConfidenceReason: confidenceReason,
      pricingSource: dataSource,
      marketSampleSize: mc?.count,
      priceAdjustments: adjustments,
      marketBaseline,
      comparableListings: valuationUnavailable ? [] : exampleListings,
      marketAnchor: valuationUnavailable ? undefined : (anchorMedian > 0 ? Math.round(anchorMedian) : undefined),
      expertInsight: (() => {
        const sources: string[] = [];
        if (mc?.count) {
          sources.push(`Priced from the ${mc.count.toLocaleString()} closest-matching UK listings (MarketCheck)`);
        }
        if (engineShown && ownForCap) sources.push(`Priced from ${(ownForCap.nComps ?? 0).toLocaleString("en-GB")} comparable UK adverts collected by Valu8, plus our trained pricing model`);
        if (photoUrls.length > 0) sources.push(`${photoUrls.length}-photo Vision AI condition scan (${(ai.conditionScore ?? 0).toFixed(1)}/10)`);
        if (motEntries.length > 0) sources.push(`${motEntries.length} DVSA MOT record${motEntries.length === 1 ? "" : "s"}`);

        const isRare = ultraRare || (mc && mc.count < 15);
        // Trigger criteria — only show when the car is genuinely hard to price
        // or when we've leveraged car-specific history. A standard car with
        // plenty of live comparables and a clean condition score shouldn't
        // need an "Expert Insight" overlay.
        const conditionScore = Number(ai.conditionScore ?? 7);
        const majorConditionIssue = conditionScore < 6;
        const veryThinMarket = !!mc && mc.count < 10;
        const shown = isRare || valuationUnavailable || majorConditionIssue || veryThinMarket;
        let reason = "";
        if (majorConditionIssue) {
          reason = `Condition signals from your photos (${conditionScore.toFixed(1)}/10) materially affect this car's value, so we've adjusted away from the headline market figure of ${mc?.count?.toLocaleString() ?? "live"} comparable UK listings.`;
        } else if (isRare || veryThinMarket) {
          reason = `Limited live market data for this car — figure stress-tested against multiple data sources before being shown.`;
        }
        return { shown, reason, sources };
      })(),
      rareCarWarning,
      valuationUnavailable,
      honestAnalysis: sanitizeNarrativeYears(valuationUnavailable ? LIMITED_DATA_MESSAGE : ai.honestAnalysis, body.year, CURRENT_YEAR, allowedNarrativeYears),
      marketPositioning: sanitizeNarrativeYears(valuationUnavailable ? "This type of car needs a specialist's eye. A marque specialist or auction house will give you a proper appraisal." : ai.marketPositioning, body.year, CURRENT_YEAR, allowedNarrativeYears),
      photoObservations: sanitizeNarrativeYears(ai.photoObservations, body.year, CURRENT_YEAR, allowedNarrativeYears),
      photoInsights: validInsights,
      fixableUpside: fixableUpside(validInsights as any[]),
      mileageNote,
      pricedMileage: pricedMiles !== body.mileage ? pricedMiles : undefined,
      specMatchedComps: specFilter.matched.length ? specFilter.matched : undefined,
      strengths: motConsistentBullets(sanitizeNarrativeList(ai.strengths, body.year, CURRENT_YEAR, allowedNarrativeYears), motExpiryForText),
      watchPoints: (() => {
        const w = sanitizeNarrativeList(ai.watchPoints, body.year, CURRENT_YEAR, allowedNarrativeYears) ?? [];
        return mileageNote ? [mileageNote, ...w] : w;
      })(),
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
      factorsUp: motConsistentBullets(factorsUp, motExpiryForText),
      factorsDown,
      sellerTip,
      negotiationBuffer,
      recommendedAskingPrice,
      hpi: {
        // No HPI/provenance provider is integrated, so we must not claim "All Clear".
        // Only the mileage check is real (derived from DVSA odometer readings).
        status: "Not Checked" as const,
        checks: [
          { label: "Outstanding finance — not checked (get a full HPI check)", ok: false },
          { label: "Insurance write-off — not checked", ok: false },
          { label: "Stolen marker — not checked", ok: false },
          (() => {
            const maxMi = motEntries.reduce((m, e) => Math.max(m, Number(e.mileage) || 0), 0);
            if (!maxMi) return { label: "Mileage vs MOT history — no MOT data", ok: false };
            if (mileageCheck.status === "clocking") return { label: `Mileage LOWER than MOT record (${maxMi.toLocaleString()} mi)`, ok: false };
            if (mileageCheck.status === "note") return { label: `Mileage consistent with MOT history (priced on ${maxMi.toLocaleString()} mi)`, ok: true };
            return { label: "Mileage consistent with MOT history", ok: true };
          })(),
        ],
      },
      motHistory,
      motSource,
      motNotice,
      generatedAt: new Date().toISOString(),
      engineVersion: "v2.2-ledger",
      ...(ownCompsShadow ? { ownCompsShadow } : {}),
      pmShadow,
      ensembleShadow,
      anchor: anchorShadow,
      ...(detectedModel ? { detectedModel: `${displayMake(body.make)} ${detectedModel}`.trim() } : {}),
      ...(variantRes.ambiguousPerf && variantRes.hint && !detectedModel ? { variantOptions: variantRes.hint.options } : {}),
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

    // eng-4: every AI-written £ figure must agree (±10%) with the numbers we show.
    {
      const shownP: ShownPrices | null = report.valuationUnavailable ? null : {
        privateSale: report.values.privateSale, tradeIn: report.values.dealerTradeIn, retail: report.values.dealerRetail,
        askLow: askRangeOut?.low, askHigh: askRangeOut?.high, rangeLow, rangeHigh,
      };
      const fixP = (t: any) => typeof t === "string" ? reconcileProsePrices(t, shownP) : t;
      const fixL = (l: any) => Array.isArray(l) ? l.map(fixP).filter((x: any) => typeof x !== "string" || x.trim()) : l;
      if (report.valuationUnavailable) (report as any).headline = "We can’t give a reliable figure for this car yet — see why below.";
      for (const k of ["sellerTip", "headline", "marketContext", "honestAnalysis", "valueReasoning", "marketPositioning", "photoObservations"] as const) (report as any)[k] = fixP((report as any)[k]);
      for (const k of ["strengths", "watchPoints", "factorsUp", "factorsDown"] as const) (report as any)[k] = fixL((report as any)[k]);
      for (const k of ["whereToSell", "highlights", "documents"] as const) (report.recommendations as any)[k] = fixL((report.recommendations as any)[k]);
    }

    if (guestValuationId && tokenHash) {
      const admin = adminClient();
      if (!admin) return json({ error: "We couldn't save your report — please try again." }, 500);
      const displayModel = typeof body.guestSave?.displayModel === "string" ? body.guestSave.displayModel.slice(0, 120) : "";
      const notes = body.guestSave?.serviceNotes ?? body.serviceNotes ?? null;
      const cleanReport = dedupeReportText(report);
      const { error } = await admin.from("valuations").insert({
        id: guestValuationId, user_id: null, guest_token_hash: tokenHash,
        make: body.make, model: displayModel || body.model, year: body.year, mileage: body.mileage,
        registration: body.registration || null, mot_expiry: body.motExpiry || null,
        service_notes: typeof notes === "string" ? notes.slice(0, 4000) : null,
        photo_urls: guestLabeled.map((p) => p.ref), condition_score: report.conditionScore,
        private_value: report.valuationUnavailable ? null : report.values?.privateSale ?? null,
        report: { ...cleanReport, vehicle: body.guestSave?.vehicle ?? null, ...(body.guestSave?.attribution ? { attribution: body.guestSave.attribution } : {}) },
      });
      if (error) {
        console.error("Guest valuation save failed", error.message);
        return json({ error: "We couldn't save your report — please try again." }, 500);
      }
      return json({ report: cleanReport, valuationId: guestValuationId });
    }

    const wantDebug = body.debugComps === true && !!g.userId && (await isAdminUser(g.userId));
    const debug = wantDebug ? {
      ...debugInfo,
      perfMatch: perfComps.match, perfMatched: perfComps.matchedCount, perfPremium: perfComps.premium ?? null,
      matchTier: mc?.matchTier ?? null, mcCount: mc?.count ?? 0,
      comps: (mc?.listings ?? []).map((l) => ({ price: l.price, mileage: l.mileage, year: l.year, trim: l.trim, url: l.url, fuelType: l.fuelType, transmission: l.transmission })),
      anchorMedian, anchorAdjMedian, rawMedianOfSubset, compMedianMiles, aiPrivate,
    } : undefined;
    return new Response(JSON.stringify(debug ? { report: dedupeReportText(report), debug } : { report: dedupeReportText(report) }), {
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
