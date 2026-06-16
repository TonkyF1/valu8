// Valu8 — MotorSpecs API proxy (OAuth2 client credentials + Apigility-style vendor media types)
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BASE = "https://staging.motorspecs.com";
const TOKEN_URL = `${BASE}/oauth`;

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const clientId = Deno.env.get("MOTORSPECS_CLIENT_ID");
  const clientSecret = Deno.env.get("MOTORSPECS_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("MotorSpecs credentials not configured");

  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`MotorSpecs token error ${resp.status}: ${text.slice(0, 300)}`);
  const json = JSON.parse(text);
  const token = json.access_token;
  const expiresIn = Number(json.expires_in ?? 3600);
  if (!token) throw new Error(`MotorSpecs token missing in response`);
  cachedToken = { token, expiresAt: Date.now() + expiresIn * 1000 };
  console.log(`MotorSpecs auth ok (expires_in=${expiresIn}s, scopes=${json.scope ?? ""})`);
  return token;
}

interface CallResult {
  status: number;
  ok: boolean;
  body: unknown;
  url: string;
  vendorService: string;
}

/**
 * Call a MotorSpecs endpoint.
 * The API is Apigility (Laminas API Tools). Accept is always application/hal+json.
 * Content-Type is either the vendor media type `application/vnd.<service>.v1+json`
 * or plain `application/json` depending on the endpoint.
 * Body is JSON with `registration` (not `vrm`).
 */
async function callEndpoint(
  path: string,
  contentType: string,
  registration: string,
  extra?: Record<string, unknown>,
): Promise<CallResult> {
  const token = await getToken();
  const url = `${BASE}${path}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/hal+json",
      "Content-Type": contentType,
    },
    body: JSON.stringify({ registration, ...(extra ?? {}) }),
  });
  const ct = resp.headers.get("content-type") ?? "";
  const body = ct.includes("json") ? await resp.json().catch(() => null) : await resp.text();
  return { status: resp.status, ok: resp.ok, body, url, vendorService: contentType };
}

// ---- Normalisers (best-effort, pass raw through too) ----

function normaliseIdentity(raw: any) {
  if (!raw || typeof raw !== "object") return null;
  const r: any = raw.data ?? raw.result ?? raw.vehicle ?? raw;
  return {
    vrm: r.vrm ?? r.registration ?? r.reg,
    vin: r.vin ?? r.VIN,
    make: r.make ?? r.manufacturer,
    model: r.model,
    variant: r.variant ?? r.derivative ?? r.trim,
    year: Number(r.year ?? r.modelYear ?? r.yearOfManufacture) || undefined,
    fuelType: r.fuelType ?? r.fuel,
    transmission: r.transmission,
    bodyStyle: r.bodyStyle ?? r.bodyType,
    doors: Number(r.doors ?? r.numberOfDoors) || undefined,
    colour: r.colour ?? r.color,
    engineCapacity: Number(r.engineCapacity ?? r.engineCc) || undefined,
    co2: Number(r.co2 ?? r.co2Emissions) || undefined,
  };
}

/**
 * Normalises the rich /identity-specs/lookup response.
 * Source shape: { registration, vehicleId, vehicle: { dvla, mvris, keepers, combined }, specsVehicle, similarVehicles }
 */
function normaliseIdentitySpecs(raw: any) {
  if (!raw || typeof raw !== "object") return null;
  const dvla = raw.vehicle?.dvla ?? {};
  const mvris = raw.vehicle?.mvris ?? {};
  const keepers = raw.vehicle?.keepers ?? {};
  const combined = raw.vehicle?.combined ?? {};
  const sv = raw.specsVehicle ?? {};
  const sims: any[] = Array.isArray(raw.similarVehicles) ? raw.similarVehicles : [];

  const pick = <T,>(...vals: (T | null | undefined | "" | 0)[]): T | undefined =>
    vals.find((v) => v !== null && v !== undefined && v !== "" && v !== 0) as T | undefined;
  const num = (...vals: any[]): number | undefined => {
    for (const v of vals) {
      const n = Number(v);
      if (Number.isFinite(n) && n !== 0) return n;
    }
    return undefined;
  };

  const regDate: string | undefined = pick(combined.regDate, dvla.regDate, mvris.regDate);
  const year =
    num(sv.modelYear, combined.year) ??
    (regDate ? Number(regDate.slice(0, 4)) : undefined);

  return {
    // Core identifiers
    vrm: pick(raw.registration, combined.registration, combined.id),
    vin: pick(combined.vin, dvla.vin),
    vehicleId: raw.vehicleId,

    // Make / model / trim (prefer specsVehicle for properly cased model + trim)
    make: pick(sv.make, combined.make, mvris.make, dvla.make),
    model: pick(sv.model, combined.model, mvris.model),
    version: pick(sv.version, combined.version, mvris.modelVariantName, dvla.model),
    trim: sv.trim,
    generation: sv.modelGeneration,
    series: mvris.vehicleSeries,

    // Dates
    year,
    regDate,
    v5cDate: dvla.v5cDate,
    introDate: sv.introDate,
    concludeDate: sv.concludeDate,

    // Body / drivetrain
    bodyStyle: pick(sv.body, combined.body, mvris.bodyDesc, dvla.body),
    doors: num(sv.doors, combined.doors, mvris.doorCount),
    seats: num(mvris.seatCount, dvla.seatingCapacity),
    transmission: pick(sv.transmission, combined.transmission, mvris.gearboxType),
    transmissionDescription: sv.transmissionDescription,
    gears: num(mvris.gearsCount),
    driveType: pick(mvris.driveType, mvris.driveAxle),
    powertrain: sv.powertrain,

    // Engine
    fuelType: pick(sv.fuel, combined.fuel, mvris.fuel, dvla.fuel),
    engineCC: num(sv.engineCC, combined.cc, mvris.cc, dvla.cc),
    engineCode: dvla.engineCode ?? mvris.engineDescription,
    engineMake: mvris.engineMake,
    powerBHP: num(sv.powerBHP, combined.powerBHP, mvris.bhpCount),
    powerKW: num(sv.powerKW, combined.powerKW, mvris.powerKw, dvla.maxPower),
    torqueNm: num(mvris.torqueNm),
    cylinders: num(mvris.cylinderCount),
    valves: num(mvris.valveCount),
    fuelDelivery: mvris.fuelDelivery,
    euroStatus: num(mvris.euroStatus),

    // Performance / economy
    topSpeedMph: num(mvris.maxSpeedMph),
    zeroToSixtyS: num(mvris.accelerationMph),
    combinedMpg: num(mvris.combinedMpg),
    urbanMpg: num(mvris.urbanColdMpg),
    extraUrbanMpg: num(mvris.extraUrbanMpg),

    // Dimensions / weight
    lengthMm: num(mvris.vehicleLength),
    widthMm: num(mvris.vehicleWidth),
    heightMm: num(mvris.vehicleHeight),
    kerbWeightKg: num(mvris.kerbWeight),
    grossWeightKg: num(dvla.grossWeight, mvris.vehicleGrossWeight),

    // Emissions
    co2: num(mvris.vehicleCo2, dvla.co2),

    // Identity colour / origin
    colour: pick(combined.colour, dvla.colour),
    origin: pick(combined.origin, mvris.vehicleOrigin, dvla.source),
    imported: !!(combined.imported || dvla.imported),
    exported: !!dvla.exported,

    // Keepers / mileage (useful for HPI + desirability scoring)
    keepers: {
      numberOfPrevious: num(keepers.numberOfPrevious),
      currentSince: keepers.startDate,
      previousAcquired: keepers.previousAcquire,
      previousDisposed: keepers.previousDispose,
    },
    currentMiles: num(combined.currentMiles),
    annualMiles: num(combined.annualMiles),

    // Market segmentation (useful for similar-cars and pricing context)
    globalSegment: sv.globalSegment,
    localSegment: sv.localSegment,
    desirabilityScore: num(sv.score),

    // Similar variants (same generation/spec family)
    similarVehicles: sims.slice(0, 10).map((s) => ({
      id: s.id,
      make: s.make,
      model: s.model,
      year: s.modelYear,
      generation: s.modelGeneration,
      version: s.version,
      trim: s.trim,
      bodyStyle: s.body,
      doors: s.doors,
      fuelType: s.fuel,
      transmission: s.transmission,
      transmissionDescription: s.transmissionDescription,
      engineCC: s.engineCC,
      powerBHP: s.powerBHP,
      powerKW: s.powerKW,
      score: s.score,
      introDate: s.introDate,
      concludeDate: s.concludeDate,
    })),

    // Raw source pointers so the UI can fall back if needed
    sources: { dvla: !!raw.vehicle?.dvla, mvris: !!raw.vehicle?.mvris, specs: !!raw.specsVehicle },
  };
}



function normaliseProvenance(raw: any) {
  if (!raw || typeof raw !== "object") return null;
  const r: any = raw.data ?? raw.result ?? raw;
  const flag = (...keys: string[]) =>
    keys.reduce<any>((acc, k) => acc ?? r[k] ?? r?.checks?.[k], undefined);
  return {
    outstandingFinance: !!flag("outstandingFinance", "finance", "hasFinance"),
    writeOff: !!flag("writeOff", "insuranceWriteOff", "writtenOff"),
    stolen: !!flag("stolen", "stolenMarker"),
    mileageDiscrepancy: !!flag("mileageDiscrepancy", "mileageAnomaly"),
    plateChanges: r.plateChanges ?? r.previousPlates ?? [],
    keeperChanges: Number(r.keeperChanges ?? r.numberOfKeepers) || undefined,
  };
}

function normaliseValuation(raw: any) {
  if (!raw || typeof raw !== "object") return null;
  const r: any = raw.data ?? raw.result ?? raw.valuation ?? raw;
  return {
    tradeIn: Number(r.tradeIn ?? r.trade ?? r.dealerTradeIn) || undefined,
    privateSale: Number(r.privateSale ?? r.private ?? r.privateValue) || undefined,
    dealerRetail: Number(r.dealerRetail ?? r.retail ?? r.forecourt) || undefined,
  };
}

function normalisePreviousAds(raw: any) {
  if (!raw || typeof raw !== "object") return null;
  return {
    make: raw.make,
    model: raw.model,
    trim: raw.trim,
    ads: Array.isArray(raw.previousAds) ? raw.previousAds.map((a: any) => ({
      sold: a.sold,
      mileage: a.mileage,
      price: a.price,
      originalPrice: a.originalPrice,
      firstSeen: a.firstSeen,
      lastSeen: a.lastSeen,
      dealerType: a.dealerType,
      businessName: a.businessName,
      adText: a.adText,
    })) : [],
  };
}

// Per-endpoint mapping. `ct` is the Content-Type required by that service.
const VND = (s: string) => `application/vnd.${s}.v1+json`;
const JSON_CT = "application/json";

const ENDPOINTS: Record<string, { path: string; ct: string; normalise: (r: any) => any }> = {
  identity:           { path: "/identity/lookup",         ct: VND("identity"),         normalise: normaliseIdentity },
  "identity-specs":   { path: "/identity-specs/lookup",   ct: VND("identity-specs"),   normalise: normaliseIdentity },
  provenance:         { path: "/provenance/check",        ct: VND("provenance"),       normalise: normaliseProvenance },
  valuation:          { path: "/valuation/value",         ct: VND("valuation"),        normalise: normaliseValuation },
  "valuation-brego":  { path: "/valuation-brego/value",   ct: VND("valuation-brego"),  normalise: normaliseValuation },
  "valuation-cazana":     { path: "/valuation-cazana/value",     ct: VND("valuation-cazana"),     normalise: normaliseValuation },
  "valuation-autotrader": { path: "/valuation-autotrader/value", ct: VND("valuation-autotrader"), normalise: normaliseValuation },
  // previous-ads is the only service confirmed to require plain application/json
  "previous-ads":         { path: "/previous-ads/check",         ct: JSON_CT,                     normalise: normalisePreviousAds },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { registration, endpoints, currentMiles, mileage } = await req.json().catch(() => ({}));
    const miles = Number(currentMiles ?? mileage) || undefined;
    const reg = String(registration ?? "").replace(/\s+/g, "").toUpperCase();
    if (!reg || reg.length < 2 || reg.length > 8) {
      return new Response(JSON.stringify({ error: "Invalid registration" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requested: string[] = Array.isArray(endpoints) && endpoints.length
      ? endpoints.map((e: string) => e.toLowerCase())
      : ["identity", "provenance", "previous-ads"];

    const results: Record<string, any> = {};
    for (const key of requested) {
      const cfg = ENDPOINTS[key];
      if (!cfg) { results[key] = { error: "Unknown endpoint" }; continue; }
      const extra = key.startsWith("valuation") && miles ? { currentMiles: miles } : undefined;
      const res = await callEndpoint(cfg.path, cfg.ct, reg, extra);
      results[key] = {
        status: res.status,
        ok: res.ok,
        url: res.url,
        normalised: res.ok ? cfg.normalise(res.body) : null,
        body: res.body,
      };
    }

    return new Response(JSON.stringify({ registration: reg, results }, null, 2), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("motorspecs error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
