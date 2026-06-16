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
    body: JSON.stringify({ registration }),
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
  "valuation-cazana": { path: "/valuation-cazana/value",  ct: VND("valuation-cazana"), normalise: normaliseValuation },
  // previous-ads is the only service confirmed to require plain application/json
  "previous-ads":     { path: "/previous-ads/check",      ct: JSON_CT,                 normalise: normalisePreviousAds },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { registration, endpoints } = await req.json().catch(() => ({}));
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
      const res = await callEndpoint(cfg.path, cfg.service, reg);
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
