// Valu8 — UK vehicle lookup by registration (DVSA MOT History API)
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

interface LookupResponse {
  registration: string;
  make?: string;
  model?: string;
  variant?: string;
  year?: number;
  fuelType?: string;
  transmission?: string;
  engineCapacity?: number;
  bodyStyle?: string;
  doors?: number;
  colour?: string;
  vin?: string;
  co2Emissions?: number;
  motExpiry?: string;
  motStatus?: "Valid" | "Expired" | "Unknown";
  motSummary?: string;
  lastMileage?: number;
  recentAdvisories?: string[];
  estimatedValue?: number;
  source?: string;
}

async function fetchVdg(reg: string) {
  const key = Deno.env.get("VEHICLE_DATA_GLOBAL_API_KEY");
  if (!key) return null;
  try {
    const url = `https://uk.api.vehicledataglobal.com/r2/lookup?packagename=VehicleDetails&apikey=${encodeURIComponent(key)}&vrm=${encodeURIComponent(reg)}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error("VDG error", resp.status, (await resp.text()).slice(0, 200));
      return null;
    }
    const json = await resp.json();
    const status = json?.ResponseInformation?.StatusCode ?? json?.StatusCode;
    if (status && String(status).toLowerCase() !== "success" && status !== 0) {
      console.error("VDG status", status, json?.ResponseInformation?.StatusMessage);
    }
    const r = json?.Results ?? json?.results ?? {};
    const vd = r?.VehicleDetails ?? r?.vehicleDetails ?? {};
    const ident = vd?.VehicleIdentification ?? vd?.vehicleIdentification ?? {};
    const reg2 = vd?.VehicleRegistration ?? vd?.vehicleRegistration ?? {};
    const tech = vd?.TechnicalDetails ?? vd?.technicalDetails ?? {};
    const dims = tech?.Dimensions ?? {};
    const general = tech?.General ?? {};
    const powertrain = tech?.Powertrain ?? {};
    const engine = powertrain?.Engine ?? {};
    const trans = powertrain?.Transmission ?? {};

    const yearStr = ident?.YearOfManufacture ?? reg2?.YearOfManufacture;
    const year = yearStr ? Number(String(yearStr).slice(0, 4)) : undefined;

    return {
      make: ident?.DvlaMake ?? ident?.Make,
      model: ident?.DvlaModel ?? ident?.Model,
      variant: ident?.ModelVariant ?? ident?.Derivative,
      year: Number.isFinite(year) ? year : undefined,
      fuelType: ident?.DvlaFuelType ?? ident?.FuelType ?? engine?.FuelType,
      transmission: trans?.TransmissionType ?? ident?.Transmission,
      engineCapacity: Number(engine?.EngineCapacityCc ?? engine?.CapacityCc) || undefined,
      bodyStyle: general?.BodyStyle ?? ident?.BodyStyle,
      doors: Number(dims?.NumberOfDoors ?? general?.NumberOfDoors) || undefined,
      colour: reg2?.Colour ?? ident?.Colour,
      vin: ident?.Vin ?? reg2?.Vin,
      co2Emissions: Number(general?.Co2Emissions ?? engine?.Co2) || undefined,
    };
  } catch (e) {
    console.error("VDG fetch failed", e);
    return null;
  }
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getDvsaToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const clientId = Deno.env.get("DVSA_MOT_CLIENT_ID");
  const clientSecret = Deno.env.get("DVSA_MOT_CLIENT_SECRET");
  const tokenUrl = Deno.env.get("DVSA_MOT_TOKEN_URL");
  if (!clientId || !clientSecret || !tokenUrl) throw new Error("DVSA credentials not configured");

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
  if (!resp.ok) throw new Error(`Token error ${resp.status}`);
  const json = await resp.json();
  const token = json.access_token as string;
  cachedToken = { token, expiresAt: Date.now() + ((json.expires_in ?? 3000) * 1000) };
  return token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { registration } = await req.json();
    const reg = String(registration ?? "").replace(/\s+/g, "").toUpperCase();
    if (!reg || reg.length < 2 || reg.length > 8) {
      return new Response(JSON.stringify({ error: "Invalid registration" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("DVSA_MOT_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Lookup service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await getDvsaToken();
    const resp = await fetch(
      `https://history.mot.api.gov.uk/v1/trade/vehicles/registration/${encodeURIComponent(reg)}`,
      { headers: { Authorization: `Bearer ${token}`, "x-api-key": apiKey, Accept: "application/json+v6" } },
    );

    if (resp.status === 404) {
      return new Response(JSON.stringify({ error: "No vehicle found for that registration" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!resp.ok) {
      const t = await resp.text();
      console.error("DVSA error", resp.status, t.slice(0, 300));
      return new Response(JSON.stringify({ error: "Lookup service unavailable" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const tests: any[] = Array.isArray(data?.motTests) ? data.motTests : [];
    const sorted = [...tests].sort((a, b) =>
      String(b?.completedDate ?? "").localeCompare(String(a?.completedDate ?? "")),
    );
    const latest = sorted[0];

    const firstUsed: string | undefined = data?.firstUsedDate || data?.registrationDate || data?.manufactureDate;
    const year = firstUsed ? Number(String(firstUsed).slice(0, 4)) : undefined;

    const motExpiry = latest?.expiryDate ? String(latest.expiryDate).slice(0, 10) : undefined;
    const now = new Date();
    const motStatus: LookupResponse["motStatus"] = motExpiry
      ? (new Date(motExpiry) >= now ? "Valid" : "Expired")
      : "Unknown";

    const passes = tests.filter(t => String(t?.testResult ?? "").toUpperCase() === "PASSED").length;
    const fails = tests.filter(t => String(t?.testResult ?? "").toUpperCase() !== "PASSED").length;
    const motSummary = `${tests.length} tests on record · ${passes} pass${passes === 1 ? "" : "es"}, ${fails} fail${fails === 1 ? "" : "s"}`;

    const recentAdvisories: string[] = [];
    if (latest?.defects && Array.isArray(latest.defects)) {
      for (const d of latest.defects) {
        if (/advisory|minor/i.test(String(d?.type ?? ""))) {
          const text = String(d?.text ?? "").trim();
          if (text) recentAdvisories.push(text);
        }
      }
    }

    const out: LookupResponse = {
      registration: reg,
      make: data?.make ? String(data.make).trim() : undefined,
      model: data?.model ? String(data.model).trim() : undefined,
      year: Number.isFinite(year) ? year : undefined,
      fuelType: data?.fuelType ? String(data.fuelType) : undefined,
      colour: data?.primaryColour ? String(data.primaryColour) : undefined,
      motExpiry,
      motStatus,
      motSummary,
      lastMileage: latest?.odometerValue ? Number(latest.odometerValue) : undefined,
      recentAdvisories: recentAdvisories.slice(0, 3),
    };

    return new Response(JSON.stringify(out), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("lookup-vehicle error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
