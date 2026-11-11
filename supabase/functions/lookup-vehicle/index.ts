// Valu8 — UK vehicle lookup by registration (DVSA MOT History API)
import { normaliseFuel, normaliseColour, displayModel } from "../_shared/vehicle-text.ts";
import { motDaysRemaining } from "../_shared/mot.ts";
import { assessImport } from "../_shared/importCheck.ts";
import { corsHeaders, guard, checkLimit, clientIp, envInt, json, adminClient } from "../_shared/guard.ts";
import { guessGearbox } from "../_shared/gearbox.ts";

interface LookupResponse {
  registration: string;
  firstRegistered?: string;
  /** Year the car was built when it differs from the first UK registration (imports). */
  manufactureYear?: number;
  importStatus?: "likely" | "possible";
  importReason?: string;
  make?: string;
  model?: string;
  variant?: string;
  year?: number;
  fuelType?: string;
  transmission?: string;
  /** gb-1: likely gearbox from our adverts when the record has none (>= 80% of this make/model/year). Pre-sets the chip. */
  transmissionGuess?: "Automatic" | "Manual";
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
  /** Date (YYYY-MM-DD) of the MOT test that recorded lastMileage. */
  lastMileageDate?: string;
  motTestCount?: number;
  recentAdvisories?: string[];
  estimatedValue?: number;
  source?: string;
}

type Reason = "not_found" | "error";
type VdgResult = { v: any | null; reason?: Reason; detail?: string };

async function fetchVdg(reg: string): Promise<VdgResult> {
  const key = Deno.env.get("VEHICLE_DATA_GLOBAL_API_KEY");
  if (!key) return { v: null, reason: "error", detail: "missing_key" };
  try {
    // VDG's r2 endpoint documents the key as a query parameter (no header auth
    // confirmed). It is only ever used here, server-side; never log `url`.
    const url = `https://uk.api.vehicledataglobal.com/r2/lookup?packagename=VehicleDetails&apikey=${encodeURIComponent(key)}&vrm=${encodeURIComponent(reg)}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      await resp.text().catch(() => "");
      return { v: null, reason: resp.status === 404 ? "not_found" : "error", detail: `http ${resp.status}` };
    }
    const json = await resp.json();
    const status = json?.ResponseInformation?.StatusCode ?? json?.StatusCode;
    if (status && String(status).toLowerCase() !== "success" && status !== 0) {
      const msg = String(json?.ResponseInformation?.StatusMessage ?? "");
      // No-match style codes are a clean "not found"; sandbox/validation/credit/key codes are errors.
      const notFound = /no ?match|not ?found|invalidsearchterm|novehicle/i.test(msg);
      return { v: null, reason: notFound ? "not_found" : "error", detail: `status ${status} ${msg}`.trim() };
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

    return { v: {
      make: ident?.DvlaMake ?? ident?.Make,
      model: ident?.DvlaModel ?? ident?.Model,
      variant: r?.ModelDetails?.ModelIdentification?.ModelVariant ?? ident?.ModelVariant ?? ident?.Derivative,
      year: Number.isFinite(year) ? year : undefined,
      fuelType: ident?.DvlaFuelType ?? ident?.FuelType ?? engine?.FuelType,
      transmission: trans?.TransmissionType ?? ident?.Transmission,
      engineCapacity: Number(engine?.EngineCapacityCc ?? engine?.CapacityCc) || undefined,
      bodyStyle: general?.BodyStyle ?? ident?.BodyStyle,
      doors: Number(dims?.NumberOfDoors ?? general?.NumberOfDoors) || undefined,
      colour: reg2?.Colour ?? ident?.Colour,
      vin: ident?.Vin ?? reg2?.Vin,
      co2Emissions: Number(general?.Co2Emissions ?? engine?.Co2) || undefined,
    } };
  } catch (e) {
    return { v: null, reason: "error", detail: `fetch failed ${(e as any)?.name ?? "Error"}` };
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

function notFoundResponse() {
  return new Response(JSON.stringify({ error: "We couldn't find a vehicle with that registration.", code: "not_found" }), {
    status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function unavailableResponse() {
  return new Response(JSON.stringify({ error: "Our vehicle lookup is temporarily unavailable.", code: "lookup_unavailable" }), {
    status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function dvsaOnce(reg: string, apiKey: string): Promise<Response> {
  const token = await getDvsaToken();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    return await fetch(
      `https://history.mot.api.gov.uk/v1/trade/vehicles/registration/${encodeURIComponent(reg)}`,
      { headers: { Authorization: `Bearer ${token}`, "x-api-key": apiKey, Accept: "application/json+v6" }, signal: ctrl.signal },
    );
  } finally {
    clearTimeout(t);
  }
}

async function fetchDvsa(reg: string, apiKey: string | undefined): Promise<{ data: any | null; reason?: Reason; detail?: string }> {
  if (!apiKey) return { data: null, reason: "error", detail: "missing_key" };
  let retriedNetwork = false;
  let retriedAuth = false;
  let lastDetail = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await dvsaOnce(reg, apiKey);
      if (resp.ok) return { data: await resp.json() };
      await resp.text().catch(() => "");
      lastDetail = `http ${resp.status}`;
      if (resp.status === 404) return { data: null, reason: "not_found", detail: lastDetail };
      if ((resp.status === 401 || resp.status === 403) && !retriedAuth) {
        retriedAuth = true; cachedToken = null; continue;
      }
      if ((resp.status >= 500 || resp.status === 429) && !retriedNetwork) {
        retriedNetwork = true; await sleep(400); continue;
      }
      return { data: null, reason: "error", detail: lastDetail };
    } catch (e: any) {
      lastDetail = e?.name === "AbortError" ? "timeout" : `network ${e?.name ?? "Error"}: ${String(e?.message ?? "").split("(")[0].trim().slice(0, 80)}`;
      if (!retriedNetwork) { retriedNetwork = true; await sleep(400); continue; }
      return { data: null, reason: "error", detail: lastDetail };
    }
  }
  return { data: null, reason: "error", detail: lastDetail };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  {
    const g = await guard(req, { feature: "lookup", requireUser: false, perMinute: 8, perDay: 60, ipPerHour: 60 });
    if (g.response) return g.response;
    if (!g.userId && !(await checkLimit(`lookup:guest:ip:${clientIp(req)}:d`, 86400, envInt("GUEST_LOOKUP_DAILY_CAP", 10)))) {
      return json({ error: "You've used today's free guest lookups. Create a free account to keep going.", code: "guest_limit" }, 429);
    }
  }

  try {
    const { registration } = await req.json();
    const reg = String(registration ?? "").replace(/[^A-Za-z0-9]+/g, "").toUpperCase();
    if (!/^[A-Z0-9]{2,7}$/.test(reg) || !/[A-Z]/.test(reg) || !/[0-9]/.test(reg)) {
      return new Response(JSON.stringify({ error: "That doesn't look like a valid UK registration." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("DVSA_MOT_API_KEY");

    // Fetch VDG and DVSA in parallel
    const vdgPromise = fetchVdg(reg);
    const dvsaPromise = fetchDvsa(reg, apiKey);

    const [vdgRes, dvsaRes] = await Promise.all([vdgPromise, dvsaPromise]);
    const vdg = vdgRes.v;
    const data = dvsaRes.data;
    if (!vdg) console.error("VDG no vehicle", vdgRes.reason, vdgRes.detail ?? "");
    if (!data) console.error("DVSA no vehicle", dvsaRes.reason, dvsaRes.detail ?? "");

    if (!vdg && !data) {
      if (dvsaRes.reason === "not_found") return notFoundResponse();
      return unavailableResponse();
    }

    let motExpiry: string | undefined;
    let motStatus: LookupResponse["motStatus"] = "Unknown";
    let motSummary: string | undefined;
    let lastMileage: number | undefined;
    let lastMileageDate: string | undefined;
    let motTestCount = 0;
    const recentAdvisories: string[] = [];
    let dvsaYear: number | undefined;
    let dvsaMake: string | undefined;
    let dvsaModel: string | undefined;
    let dvsaFuel: string | undefined;
    let dvsaColour: string | undefined;
    let dvsaFirstReg: string | undefined;
    let dvsaEngineCc: number | undefined;
    let dvsaManufacture: string | undefined;

    if (data) {
      const tests: any[] = Array.isArray(data?.motTests) ? data.motTests : [];
      const sorted = [...tests].sort((a, b) =>
        String(b?.completedDate ?? "").localeCompare(String(a?.completedDate ?? "")),
      );
      const latest = sorted[0];
      // First UK registration (firstUsedDate/registrationDate). For an import this can be years after the car was
      // built, so manufactureDate is kept separately and the build year is resolved below (rare-cars-1).
      const firstUsed: string | undefined = data?.firstUsedDate || data?.registrationDate || data?.manufactureDate;
      dvsaManufacture = data?.manufactureDate ? String(data.manufactureDate).slice(0, 10).replace(/\./g, "-") : undefined;
      const y = firstUsed ? Number(String(firstUsed).slice(0, 4)) : undefined;
      dvsaYear = Number.isFinite(y) ? y : undefined;
      dvsaFirstReg = firstUsed ? String(firstUsed).slice(0, 10).replace(/\./g, "-") : undefined;
      dvsaMake = data?.make ? String(data.make).trim() : undefined;
      dvsaModel = data?.model ? String(data.model).trim() : undefined;
      dvsaFuel = data?.fuelType ? String(data.fuelType) : undefined;
      dvsaColour = data?.primaryColour ? String(data.primaryColour) : undefined;
      dvsaEngineCc = Number(data?.engineSize) || undefined;

      motExpiry = latest?.expiryDate ? String(latest.expiryDate).slice(0, 10) : undefined;
      { const d = motDaysRemaining(motExpiry); motStatus = d == null ? "Unknown" : d >= 0 ? "Valid" : "Expired"; }
      const passes = tests.filter(t => String(t?.testResult ?? "").toUpperCase() === "PASSED").length;
      const fails = tests.filter(t => String(t?.testResult ?? "").toUpperCase() !== "PASSED").length;
      motSummary = `${tests.length} tests on record · ${passes} pass${passes === 1 ? "" : "es"}, ${fails} fail${fails === 1 ? "" : "s"}`;
      motTestCount = tests.length;
      // Newest test with a real odometer reading (some tests record "unreadable" / no odometer); km converted to miles.
      for (const t of sorted) {
        const v = Number(t?.odometerValue);
        if (!(v > 0) || /unread|no.?odo/i.test(String(t?.odometerResultType ?? ""))) continue;
        lastMileage = /^k/i.test(String(t?.odometerUnit ?? "")) ? Math.round(v * 0.621371) : v;
        lastMileageDate = t?.completedDate ? String(t.completedDate).slice(0, 10) : undefined;
        break;
      }
      if (latest?.defects && Array.isArray(latest.defects)) {
        for (const d of latest.defects) {
          if (/advisory|minor/i.test(String(d?.type ?? ""))) {
            const text = String(d?.text ?? "").trim();
            if (text) recentAdvisories.push(text);
          }
        }
      }
    }

    const imp = assessImport({ registration: reg, firstRegistered: dvsaFirstReg, manufactureDate: dvsaManufacture,
      make: vdg?.make ?? dvsaMake, model: vdg?.model ?? dvsaModel });
    const out: LookupResponse = {
      registration: reg,
      make: vdg?.make ?? dvsaMake,
      model: displayModel(vdg?.make ?? dvsaMake, vdg?.model ?? dvsaModel, vdg?.fuelType ?? dvsaFuel) || undefined,
      variant: vdg?.variant,
      year: vdg?.year ?? imp.buildYear ?? dvsaYear,
      firstRegistered: dvsaFirstReg,
      ...(imp.buildYear && imp.buildYear !== dvsaYear ? { manufactureYear: imp.buildYear } : {}),
      ...(imp.status !== "no" ? { importStatus: imp.status, importReason: imp.reason } : {}),
      fuelType: normaliseFuel(vdg?.fuelType ?? dvsaFuel),
      transmission: vdg?.transmission,
      engineCapacity: vdg?.engineCapacity ?? dvsaEngineCc,
      bodyStyle: vdg?.bodyStyle,
      doors: vdg?.doors,
      colour: normaliseColour(vdg?.colour ?? dvsaColour),
      vin: vdg?.vin,
      co2Emissions: vdg?.co2Emissions,
      motExpiry,
      motStatus,
      motSummary,
      lastMileage,
      lastMileageDate,
      motTestCount: data ? motTestCount : undefined,
      recentAdvisories: recentAdvisories.slice(0, 3),
      source: vdg && data ? "vdg+dvsa" : vdg ? "vdg" : "dvsa",
    };

    // A response with no make/model would render as "Vehicle found" with blank
    // fields; treat it as not found so the client shows an error instead.
    if (!out.make || !out.model) {
      return notFoundResponse();
    }

    if (!out.transmission) {
      const g = await guessGearbox(adminClient(), out.make, out.model, out.year).catch(() => null);
      if (g?.gearbox) out.transmissionGuess = g.gearbox;
    }

    return new Response(JSON.stringify(out), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("lookup-vehicle error", e?.name ?? "Error", e?.message ?? "");
    return unavailableResponse();
  }
});
