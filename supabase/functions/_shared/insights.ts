// Valu8 — pure, dependency-free vehicle insight helpers.
// Shared by the frontend (Vite) and edge functions (Deno). No runtime APIs.
// All figures are ESTIMATES built from public GOV.UK / DVSA / TfL guidance.

// ---------------- Dates & CSV ----------------

/** Parse "dd/mm/yyyy" (DVSA CSV) or ISO "yyyy-mm-dd[...]" into a UTC Date. */
export function parseUkDate(s: string | undefined | null): Date | null {
  if (!s) return null;
  const t = String(s).trim();
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  m = t.match(/^(\d{4})[-.](\d{1,2})[-.](\d{1,2})/);
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Minimal RFC-4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// ---------------- Recalls (DVSA open data, OGL v3) ----------------

export interface Recall {
  launchDate: string;
  number: string;
  make: string;
  model: string;
  concern: string;
  defect: string;
  remedy: string;
  buildStart?: string;
  buildEnd?: string;
}

export function parseRecalls(csv: string): Recall[] {
  const rows = parseCsv(csv);
  if (!rows.length) return [];
  const h = rows[0].map((x) => x.trim().toLowerCase());
  const col = (name: string) => h.indexOf(name);
  const iLaunch = col("launch date"), iNum = col("recalls number"), iMake = col("make"),
    iInfo = col("recalls model information"), iConcern = col("concern"), iDefect = col("defect"),
    iRemedy = col("remedy"), iModel = col("model"), iBs = col("build start"), iBe = col("build end");
  const out: Recall[] = [];
  for (const r of rows.slice(1)) {
    const make = (r[iMake] ?? "").trim();
    if (!make) continue;
    out.push({
      launchDate: (r[iLaunch] ?? "").trim(),
      number: (r[iNum] ?? "").trim(),
      make,
      model: ((r[iModel] ?? "") || (r[iInfo] ?? "")).trim(),
      concern: (r[iConcern] ?? "").trim(),
      defect: (r[iDefect] ?? "").trim(),
      remedy: (r[iRemedy] ?? "").trim(),
      buildStart: (r[iBs] ?? "").trim() || undefined,
      buildEnd: (r[iBe] ?? "").trim() || undefined,
    });
  }
  return out;
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
const MAKE_ALIASES: Record<string, string[]> = {
  "VOLKSWAGEN": ["VOLKSWAGEN", "VW"],
  "MERCEDES BENZ": ["MERCEDES BENZ", "MERCEDES"],
  "MERCEDES AMG": ["MERCEDES BENZ", "MERCEDES"],
  "MERCEDES": ["MERCEDES BENZ", "MERCEDES"],
  "MINI": ["MINI", "BMW"],
  "ALFA ROMEO": ["ALFA ROMEO", "FIAT CHRYSLER"],
  "FIAT": ["FIAT"],
  "JEEP": ["JEEP", "FIAT CHRYSLER"],
  "DS": ["DS", "CITROEN"],
};
// The DVSA file mixes cars with bikes, trucks, buses and vans.
const NON_CAR = /\b(MOTORCYCLES?|MOTORRAD|TRUCKS?|BUS|BUSES|COMMERCIAL|CARAVANS?|MOTORHOMES?)\b/;

function makeMatches(recallMake: string, userMake: string): boolean {
  const rm = norm(recallMake);
  if (NON_CAR.test(rm)) return false;
  const um = norm(userMake);
  const prefixes = MAKE_ALIASES[um] ?? [um];
  return prefixes.some((p) => rm === p || rm.startsWith(p + " "));
}

function hasPhrase(haystack: string, phrase: string): boolean {
  return (" " + haystack + " ").includes(" " + phrase + " ");
}

/**
 * Campaign-level match: same make, model name appears in the recall's model
 * field, and the car's year falls inside the build window (±1 year tolerance,
 * since we only know the year). This does NOT mean the individual car is
 * affected — only that a recall campaign exists for that model and period.
 */
export function matchRecalls(all: Recall[], make: string, model: string, year: number, limit = 20): Recall[] {
  const phrase = norm(model.split("·")[0]);
  if (!norm(make) || !phrase) return [];
  // "3 Series 320d" -> try "3 SERIES 320D", then "3 SERIES", then "3" only if long enough.
  const words = phrase.split(" ");
  const candidates = [phrase, words.slice(0, 2).join(" "), words[0]].filter((c, i, arr) => c && arr.indexOf(c) === i && (c.includes(" ") || c.length >= 2));
  const hits = all.filter((r) => {
    if (!makeMatches(r.make, make)) return false;
    const rm = norm(r.model);
    if (!candidates.some((c) => hasPhrase(rm, c))) return false;
    const bs = parseUkDate(r.buildStart), be = parseUkDate(r.buildEnd);
    if (bs && year < bs.getUTCFullYear() - 1) return false;
    if (be && year > be.getUTCFullYear() + 1) return false;
    return true;
  });
  hits.sort((a, b) => (parseUkDate(b.launchDate)?.getTime() ?? 0) - (parseUkDate(a.launchDate)?.getTime() ?? 0));
  const seen = new Set<string>();
  return hits.filter((r) => (seen.has(r.number) ? false : (seen.add(r.number), true))).slice(0, limit);
}

// ---------------- MOT mileage / clocking ----------------

export interface MileagePoint { date: string; mileage: number }
export interface MileageAnalysis {
  points: MileagePoint[];
  decreases: { date: string; from: number; to: number }[];
  avgMilesPerYear: number | null;
  /** "ok" | "warning" (any drop) | "insufficient" (<2 readings) */
  status: "ok" | "warning" | "insufficient";
  /** Entered mileage lower than the last MOT reading. */
  enteredBelowLastMot: boolean;
}

export function analyseMileage(entries: { date: string; mileage: number }[], enteredMileage?: number): MileageAnalysis {
  const points = entries
    .filter((e) => Number.isFinite(e.mileage) && e.mileage > 0 && parseUkDate(e.date))
    .map((e) => ({ date: parseUkDate(e.date)!.toISOString().slice(0, 10), mileage: Math.round(e.mileage) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const decreases: MileageAnalysis["decreases"] = [];
  for (let i = 1; i < points.length; i++) {
    // Allow a small tolerance for typos/unit noise.
    if (points[i].mileage < points[i - 1].mileage - 50) {
      decreases.push({ date: points[i].date, from: points[i - 1].mileage, to: points[i].mileage });
    }
  }
  let avg: number | null = null;
  if (points.length >= 2) {
    const first = points[0], last = points[points.length - 1];
    const years = (Date.parse(last.date) - Date.parse(first.date)) / (365.25 * 864e5);
    if (years > 0.25) avg = Math.round((last.mileage - first.mileage) / years);
  }
  const last = points[points.length - 1];
  const enteredBelowLastMot = !!last && typeof enteredMileage === "number" && enteredMileage > 0 && enteredMileage < last.mileage - 50;
  const status = points.length < 2 ? "insufficient" : decreases.length || enteredBelowLastMot ? "warning" : "ok";
  return { points, decreases, avgMilesPerYear: avg, status: enteredBelowLastMot && points.length < 2 ? "warning" : status, enteredBelowLastMot };
}

// ---------------- VED (vehicle tax) — rates from 1 April 2026 ----------------

export type FuelKind = "petrol" | "diesel" | "electric" | "hybrid" | "other" | "unknown";
export function fuelKind(f?: string | null): FuelKind {
  const s = (f ?? "").toLowerCase();
  if (!s) return "unknown";
  if (/electric|^ev$|bev/.test(s) && !/hybrid/.test(s)) return "electric";
  if (/hybrid|phev|hev/.test(s)) return "hybrid";
  if (/diesel/.test(s)) return "diesel";
  if (/petrol|gasoline/.test(s)) return "petrol";
  return "other";
}

/** 2001-03-01 .. 2017-03-31 bands (12-month single payment, from 1 April 2026). */
const BANDS_2001: { band: string; max: number; rate: number }[] = [
  { band: "A", max: 100, rate: 20 }, { band: "B", max: 110, rate: 20 }, { band: "C", max: 120, rate: 35 },
  { band: "D", max: 130, rate: 170 }, { band: "E", max: 140, rate: 200 }, { band: "F", max: 150, rate: 225 },
  { band: "G", max: 165, rate: 275 }, { band: "H", max: 175, rate: 325 }, { band: "I", max: 185, rate: 360 },
  { band: "J", max: 200, rate: 410 }, { band: "K", max: 225, rate: 445 }, { band: "L", max: 255, rate: 760 },
  { band: "M", max: Infinity, rate: 790 },
];

export interface VedEstimate {
  annual: number | null;
  /** Possible extra £440/yr expensive car supplement (list price unknown to us). */
  supplementPossible: boolean;
  basis: string;
  band?: string;
}

export const VED_RATES_FROM = "1 April 2026";
export const VED_SOURCE = "https://www.gov.uk/vehicle-tax-rate-tables";

export function estimateVed(opts: { firstRegistered?: string | null; year?: number; fuelType?: string | null; co2?: number | null; engineCc?: number | null; now?: Date }): VedEstimate {
  const now = opts.now ?? new Date();
  const reg = parseUkDate(opts.firstRegistered ?? undefined)
    ?? (opts.year ? new Date(Date.UTC(opts.year, 6, 1)) : null); // mid-year guess
  if (!reg) return { annual: null, supplementPossible: false, basis: "Registration date unknown" };
  const fk = fuelKind(opts.fuelType);
  const t = reg.getTime();
  const APR2017 = Date.UTC(2017, 3, 1), MAR2001 = Date.UTC(2001, 2, 1), APR2025 = Date.UTC(2025, 3, 1);
  const yearsSinceReg = (now.getTime() - t) / (365.25 * 864e5);
  const yearOnlyNearBoundary = !opts.firstRegistered && opts.year && (opts.year === 2017 || opts.year === 2001);

  if (t >= APR2017) {
    // Expensive car supplement applies years 2–6; EVs only if registered from 1 April 2025.
    const inWindow = yearsSinceReg < 6;
    const supplementPossible = inWindow && (fk !== "electric" || t >= APR2025);
    return {
      annual: 200, supplementPossible,
      basis: `Standard rate for cars first registered on or after 1 April 2017${yearOnlyNearBoundary ? " (assumed — check exact registration date)" : ""}.`,
    };
  }
  if (t >= MAR2001) {
    if (fk === "electric") return { annual: 20, supplementPossible: false, band: "A", basis: "Zero-emission car registered 2001–2017 (band A)." };
    if (!opts.co2 || opts.co2 <= 0) return { annual: null, supplementPossible: false, basis: "CO₂ figure needed for cars registered 2001–2017." };
    const b = BANDS_2001.find((x) => opts.co2! <= x.max)!;
    // Band K note: cars over 225g/km registered before 23 March 2006 pay band K.
    const preMar2006 = t < Date.UTC(2006, 2, 23);
    const band = preMar2006 && opts.co2 > 225 ? BANDS_2001[10] : b;
    return { annual: band.rate, supplementPossible: false, band: band.band, basis: `CO₂ band ${band.band} (${opts.co2} g/km).` };
  }
  if (opts.engineCc && opts.engineCc > 0) {
    return { annual: opts.engineCc <= 1549 ? 230 : 375, supplementPossible: false, basis: `Pre-March 2001 car, engine ${opts.engineCc}cc.` };
  }
  return { annual: null, supplementPossible: false, basis: "Engine size needed for cars registered before March 2001 (40+ year old cars may be exempt as historic)." };
}

// ---------------- ULEZ / Clean Air Zone (estimate) ----------------

export interface UlezEstimate {
  status: "likely_compliant" | "likely_non_compliant" | "check";
  reason: string;
}

export const ULEZ_CHECKER_URL = "https://tfl.gov.uk/modes/driving/check-your-vehicle/";
export const CAZ_CHECKER_URL = "https://www.gov.uk/clean-air-zones";

function euroNumber(euro?: string | null): number | null {
  const m = String(euro ?? "").match(/euro\s*([1-7])/i);
  return m ? +m[1] : null;
}

/**
 * London ULEZ and Class D Clean Air Zones use the same car standards:
 * petrol Euro 4+, diesel Euro 6+, zero-emission always OK.
 * Without a Euro status we infer from registration year (petrol Euro 4
 * mandatory from Jan 2006; diesel Euro 6 from Sep 2015), and say so.
 */
export function estimateUlez(opts: { fuelType?: string | null; year?: number; firstRegistered?: string | null; euroStatus?: string | null }): UlezEstimate {
  const fk = fuelKind(opts.fuelType);
  const euro = euroNumber(opts.euroStatus);
  const reg = parseUkDate(opts.firstRegistered ?? undefined);
  const year = reg ? reg.getUTCFullYear() : opts.year;
  if (fk === "electric") return { status: "likely_compliant", reason: "Zero-emission vehicles meet ULEZ and Clean Air Zone standards." };
  const isDiesel = fk === "diesel";
  const isPetrolLike = fk === "petrol" || fk === "hybrid";
  if (euro != null && (isDiesel || isPetrolLike)) {
    const need = isDiesel ? 6 : 4;
    return euro >= need
      ? { status: "likely_compliant", reason: `Euro ${euro} ${isDiesel ? "diesel" : "petrol"} meets the Euro ${need} standard.` }
      : { status: "likely_non_compliant", reason: `Euro ${euro} is below the Euro ${need} standard for ${isDiesel ? "diesel" : "petrol"} cars.` };
  }
  if (!year || (!isDiesel && !isPetrolLike)) return { status: "check", reason: "Not enough fuel/emissions data to estimate." };
  if (isPetrolLike) {
    if (year >= 2006) return { status: "likely_compliant", reason: "Petrol cars registered from 2006 are generally Euro 4 or better." };
    if (year >= 2001) return { status: "check", reason: "Many petrol cars from 2001–2005 meet Euro 4, but not all — check the official checker." };
    return { status: "likely_non_compliant", reason: "Petrol cars registered before 2001 rarely meet Euro 4." };
  }
  if (year >= 2016) return { status: "likely_compliant", reason: "Diesel cars registered from September 2015 are generally Euro 6." };
  if (year === 2015) return { status: "check", reason: "Diesel Euro 6 became mandatory in September 2015 — check this exact car." };
  return { status: "likely_non_compliant", reason: "Diesel cars registered before late 2015 are usually Euro 5 or older." };
}

// ---------------- MOT advisory → repair cost bands ----------------

export interface CostBand { category: string; low: number; high: number }

// Indicative UK independent-garage ranges (parts + labour), deliberately wide.
const COST_RULES: { re: RegExp; band: CostBand }[] = [
  { re: /tyre|tire|tread/i, band: { category: "Tyres", low: 60, high: 180 } },
  { re: /brake (disc|pad)|disc|pad|brake lining|brake shoe/i, band: { category: "Brakes", low: 120, high: 350 } },
  { re: /brake pipe|brake hose/i, band: { category: "Brake pipes/hoses", low: 80, high: 300 } },
  { re: /corro|rust/i, band: { category: "Corrosion", low: 100, high: 800 } },
  { re: /shock|damper|spring|suspension|bush|wishbone|arm|anti.?roll|drop link/i, band: { category: "Suspension", low: 100, high: 450 } },
  { re: /ball joint|track rod|steering|rack/i, band: { category: "Steering", low: 80, high: 350 } },
  { re: /exhaust|silencer|catalyst|cat\b/i, band: { category: "Exhaust", low: 100, high: 500 } },
  { re: /oil leak|leak|fluid|coolant/i, band: { category: "Leaks", low: 80, high: 500 } },
  { re: /cv|driveshaft|gaiter|boot/i, band: { category: "Driveshaft/CV boot", low: 80, high: 250 } },
  { re: /wiper|washer/i, band: { category: "Wipers/washers", low: 15, high: 60 } },
  { re: /lamp|bulb|headlamp|light|indicator|reflector/i, band: { category: "Lights", low: 10, high: 150 } },
  { re: /windscreen|screen|chip|crack/i, band: { category: "Windscreen", low: 0, high: 350 } },
  { re: /seat ?belt/i, band: { category: "Seat belt", low: 60, high: 250 } },
  { re: /parking brake|handbrake/i, band: { category: "Parking brake", low: 60, high: 300 } },
  { re: /emission|smoke|lambda|dpf/i, band: { category: "Emissions", low: 100, high: 900 } },
  { re: /wheel bearing|bearing/i, band: { category: "Wheel bearing", low: 120, high: 300 } },
];

export function advisoryCostBand(text: string): CostBand | null {
  for (const r of COST_RULES) if (r.re.test(text)) return r.band;
  return null;
}

export function summariseAdvisoryCosts(advisories: string[]): { items: { text: string; band: CostBand | null }[]; low: number; high: number } {
  const items = advisories.map((text) => ({ text, band: advisoryCostBand(text) }));
  // Sum once per category so duplicates (e.g. "nearside tyre", "offside tyre") don't double-count wildly.
  const byCat = new Map<string, CostBand & { n: number }>();
  for (const i of items) if (i.band) {
    const e = byCat.get(i.band.category);
    if (e) e.n++; else byCat.set(i.band.category, { ...i.band, n: 1 });
  }
  let low = 0, high = 0;
  for (const b of byCat.values()) { low += b.low; high += b.high * Math.min(b.n, 2); }
  return { items, low, high };
}

// ---------------- Buyer mode: fair price ----------------

export interface FairPriceResult {
  verdict: "great" | "fair" | "high" | "overpriced" | "unknown";
  low: number; mid: number; high: number;
  diffPct: number | null;
  sample: number;
}

/**
 * Compare an asking price with comparable listings, mileage-adjusted to the
 * target car (≈3% per 10k miles). Uses the interquartile range as "fair".
 */
export function fairPrice(asking: number, mileage: number, comps: { price: number; mileage?: number }[]): FairPriceResult {
  const adj = comps
    .filter((c) => Number.isFinite(c.price) && c.price > 300)
    .map((c) => {
      if (!c.mileage || c.mileage <= 0) return c.price;
      const f = Math.max(0.6, Math.min(1.25, 1 - ((mileage - c.mileage) / 10000) * 0.03));
      return c.price * f;
    })
    .sort((a, b) => a - b);
  if (adj.length < 3) return { verdict: "unknown", low: 0, mid: 0, high: 0, diffPct: null, sample: adj.length };
  const q = (p: number) => {
    const i = (adj.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
    return adj[lo] + (adj[hi] - adj[lo]) * (i - lo);
  };
  const low = Math.round(q(0.25)), mid = Math.round(q(0.5)), high = Math.round(q(0.75));
  const diffPct = Math.round(((asking - mid) / mid) * 100);
  const verdict = asking <= low ? "great" : asking <= high ? "fair" : asking <= high * 1.1 ? "high" : "overpriced";
  return { verdict, low, mid, high, diffPct, sample: adj.length };
}

// ---------------- Seller checklist ----------------

export function sellerChecklist(opts: { motExpiry?: string | null; hasServiceHistory?: boolean; now?: Date }): { item: string; why: string; urgent?: boolean }[] {
  const now = opts.now ?? new Date();
  const mot = parseUkDate(opts.motExpiry ?? undefined);
  const motDays = mot ? Math.round((mot.getTime() - now.getTime()) / 864e5) : null;
  const list = [
    { item: "V5C logbook in your name", why: "Buyers (and DVLA) need it to transfer keepership." },
    { item: "Service history & receipts", why: "Documented history typically adds value and speeds up the sale." },
    { item: "Both keys and the locking wheel nut", why: "Missing keys are a common price-chip." },
    { item: "Clear any outstanding finance", why: "A car with finance owing can't be sold without settling it." },
    { item: "Clean, well-lit photos of all sides, interior and odometer", why: "Listings with full photo sets get more enquiries." },
    { item: "Tell DVLA you've sold it (online, free)", why: "You remain liable for fines until you notify DVLA. gov.uk/sold-bought-vehicle" },
    { item: "Cancel or transfer your insurance and tax", why: "Vehicle tax isn't transferable — you get a refund for full months left." },
  ];
  if (motDays != null && motDays < 60) {
    list.unshift({ item: motDays < 0 ? "MOT has expired — renew before selling" : `MOT expires in ${motDays} days — consider renewing`, why: "A fresh MOT reassures buyers and is often worth more than it costs.", urgent: true } as any);
  }
  return list;
}
