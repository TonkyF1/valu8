// Valu8 — MotorSpecs API proxy (OAuth2 client credentials)
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BASE = "https://staging.motorspecs.com";
const TOKEN_URL = `${BASE}/oauth`;

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const clientId = Deno.env.get("MOTORSPECS_CLIENT_ID");
  const clientSecret = Deno.env.get("MOTORSPECS_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("MotorSpecs credentials not configured");

  const attempts: Array<{ name: string; init: RequestInit }> = [
    {
      name: "basic+form",
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        },
        body: new URLSearchParams({ grant_type: "client_credentials" }),
      },
    },
    {
      name: "form-body",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        }),
      },
    },
    {
      name: "json-body",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        }),
      },
    },
  ];

  let lastErr = "";
  for (const attempt of attempts) {
    const resp = await fetch(TOKEN_URL, attempt.init);
    const text = await resp.text();
    if (resp.ok) {
      const json = JSON.parse(text);
      const token = json.access_token ?? json.token ?? json.accessToken;
      const expiresIn = Number(json.expires_in ?? json.expiresIn ?? 3600);
      if (!token) throw new Error(`MotorSpecs token missing: ${text.slice(0, 300)}`);
      cachedToken = { token, expiresAt: Date.now() + expiresIn * 1000 };
      console.log(`MotorSpecs auth ok via ${attempt.name} (expires_in=${expiresIn})`);
      return token;
    }
    lastErr = `${attempt.name} → ${resp.status} ${text.slice(0, 200)}`;
    console.log(`MotorSpecs auth attempt ${attempt.name} failed: ${resp.status} ${text.slice(0, 200)}`);
  }
  throw new Error(`MotorSpecs token error. Last: ${lastErr}`);
}

interface CallResult {
  status: number;
  ok: boolean;
  body: unknown;
  url: string;
}

async function callEndpoint(path: string, payload?: unknown): Promise<CallResult> {
  const token = await getToken();
  const url = `${BASE}${path}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload ?? {}),
  });
  const ct = resp.headers.get("content-type") ?? "";
  const body = ct.includes("application/json") ? await resp.json().catch(() => null) : await resp.text();
  return { status: resp.status, ok: resp.ok, body, url };
}

// Normalisation helpers — best-effort, pass through raw too.
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
    raw,
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
    raw,
  };
}

function normaliseValuation(raw: any) {
  if (!raw || typeof raw !== "object") return null;
  const r: any = raw.data ?? raw.result ?? raw.valuation ?? raw;
  return {
    tradeIn: Number(r.tradeIn ?? r.trade ?? r.dealerTradeIn) || undefined,
    privateSale: Number(r.privateSale ?? r.private ?? r.privateValue) || undefined,
    dealerRetail: Number(r.dealerRetail ?? r.retail ?? r.forecourt) || undefined,
    raw,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { registration, endpoints, checkId, valueId, calculatorId } = await req.json().catch(() => ({}));
    const reg = String(registration ?? "").replace(/\s+/g, "").toUpperCase();
    if (!reg || reg.length < 2 || reg.length > 8) {
      return new Response(JSON.stringify({ error: "Invalid registration" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const list: string[] = Array.isArray(endpoints) && endpoints.length
      ? endpoints.map((e: string) => e.toLowerCase())
      : ["identity"];

    const results: Record<string, any> = {};

    if (list.includes("identity")) {
      const res = await callEndpoint(`/identity/lookup/${encodeURIComponent(reg)}`);
      results.identity = { ...res, normalised: res.ok ? normaliseIdentity(res.body) : null };
    }
    if (list.includes("provenance")) {
      const id = checkId ?? reg;
      const res = await callEndpoint(`/provenance/check/${encodeURIComponent(id)}`, { vrm: reg });
      results.provenance = { ...res, normalised: res.ok ? normaliseProvenance(res.body) : null };
    }
    if (list.includes("valuation")) {
      const id = valueId ?? reg;
      const res = await callEndpoint(`/valuation-vip/value/${encodeURIComponent(id)}`, { vrm: reg });
      results.valuation = { ...res, normalised: res.ok ? normaliseValuation(res.body) : null };
    }
    if (list.includes("finance")) {
      const id = calculatorId ?? reg;
      const res = await callEndpoint(`/finance/calculator/${encodeURIComponent(id)}`, { vrm: reg });
      results.finance = res;
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
