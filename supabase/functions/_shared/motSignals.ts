// MOT-history condition signals for pricing (SHADOW ONLY: feeds pmShadow.motAdj / pmWithMot, never the displayed price).
// Input = the DVSA entries analyse-vehicle already fetches (newest first). Pure TS, no network.
//
// Sizing (docs/own-comps-pricing.md "MOT signals"): the harvest has no DVSA data, so effects were measured as the
// median price residual of adverts whose TEXT says the same thing, against a pm-1 refit without any text flags
// (5-fold OOF, matched make/model/trim/age/mileage/fuel/body), by price band <£2k / £2-5k / £5k+:
//   "no MOT / expired"  -39.9% / -31.7% / n<15      "MOT failed"  -47.8% (<2k, n=21)
//   "long/12 months MOT" +4.1% / +1.8% / -5.6%      "no advisories / clean MOT" +12.4% / +3.9% / -2.8%
//   "rust/corrosion" -7.9% (<2k, n=33, wide CI)     "smoke/knock/oil leak/misfire" -13.4% / -12.1% / -12.0%
//   "warning light / limp mode / DPF" -9.8% / -2.6% / -7.7%
// Adverts that admit a fault are worse on average than a DVSA line item, so every factor below is shrunk toward 0
// (roughly half to two-thirds of the measured effect) and items with no text proxy (advisory counts, past fails,
// odometer drops, test gaps) are labelled "prior". Bounds: £5k+ -15%..+4%, £2-5k -25%..+6%, <£2k -35%..+8%.
import { currentMotExpiry, motDaysRemaining } from "./mot.ts";

export interface MotTestIn { date: string; result: string; mileage?: number; expiryDate?: string | null; advisories?: string[]; failures?: string[] }
export type Band = "<2k" | "2-5k" | "5k+";
export interface MotSignals {
  tests: number; latestResult: string | null; latestDate: string | null; daysToExpiry: number | null;
  expiryStatus: "expired" | "due_soon" | "ok" | "long" | "unknown"; noValidMot: boolean;
  failsLast2: number; advisoriesLatest: number;
  serious: { corrosion: boolean; brakes: boolean; suspension: boolean; tyres: boolean; oilLeak: boolean; emissions: boolean };
  mileageDrop: number; mileageAnomaly: boolean; maxGapYears: number; testGap: boolean;
  recentAnnualMiles: number | null; lifetimeAnnualMiles: number | null; highRecentUse: boolean;
  cleanHistory: boolean;
}
export interface MotAdjPart { key: string; pct: number; basis: "measured-text-proxy" | "prior" }
export interface MotAdj { pct: number; factor: number; band: Band; bounds: [number, number]; parts: MotAdjPart[]; signals: MotSignals | null }

const RX = {
  corrosion: /corro|corrod|rust|structurally weak/, brakes: /brake|disc|pad|caliper|handbrake|parking brake/,
  suspension: /suspension|shock absorber|spring|bush|ball joint|track rod|anti-roll|wishbone/, tyres: /tyre|tire|tread/,
  oilLeak: /oil leak|leaking oil|oil (?:seep|weep)|fluid leak/, emissions: /emission|exhaust|lambda|smoke|catalyst|dpf/,
};
const AVG_ANNUAL = 7400; // DfT average annual car mileage (England, NTS 2023), used only for highRecentUse
const DAY = 86_400_000;
const t = (s?: string | null) => { const d = s ? Date.parse(s) : NaN; return Number.isFinite(d) ? d : NaN; };

export function motSignals(entries: MotTestIn[] | null | undefined, opts: { now?: Date; year?: number } = {}): MotSignals | null {
  const E = (entries ?? []).filter((e) => e && e.date).slice().sort((a, b) => b.date.localeCompare(a.date));
  if (!E.length) return null;
  const now = opts.now ?? new Date();
  const latest = E[0];
  const days = motDaysRemaining(currentMotExpiry(E as any) ?? null, now);
  const expiryStatus = days == null ? "unknown" : days < 0 ? "expired" : days < 60 ? "due_soon" : days >= 270 ? "long" : "ok";
  const noValidMot = days == null ? latest.result === "Fail" : days < 0;
  const latestText = [...(latest.advisories ?? []), ...(latest.failures ?? [])].join(" ").toLowerCase();
  const serious = Object.fromEntries(Object.entries(RX).map(([k, r]) => [k, r.test(latestText)])) as MotSignals["serious"];
  // Odometer: chronological; a reading below the running max (beyond 1,000 mi / 3% noise) = possible clocking or swap.
  const chron = E.slice().reverse().filter((e) => Number(e.mileage) > 0);
  let max = 0, drop = 0;
  for (const e of chron) { const m = Number(e.mileage); if (m < max) drop = Math.max(drop, max - m); max = Math.max(max, m); }
  const mileageAnomaly = drop > Math.max(1000, 0.03 * max);
  let gap = 0;
  for (let i = 1; i < chron.length; i++) gap = Math.max(gap, (t(chron[i].date) - t(chron[i - 1].date)) / (365.25 * DAY));
  const rec = chron.length >= 2 ? chron.slice(-2) : null;
  const recYears = rec ? (t(rec[1].date) - t(rec[0].date)) / (365.25 * DAY) : 0;
  const recentAnnualMiles = rec && recYears > 0.5 ? Math.round((Number(rec[1].mileage) - Number(rec[0].mileage)) / recYears) : null;
  const ageYears = opts.year ? Math.max(0.5, (t(latest.date) - Date.UTC(opts.year, 6, 1)) / (365.25 * DAY)) : null;
  const lifetimeAnnualMiles = ageYears && max > 0 ? Math.round(max / ageYears) : null;
  const last3 = E.slice(0, 3);
  return {
    tests: E.length, latestResult: latest.result ?? null, latestDate: latest.date ?? null, daysToExpiry: days, expiryStatus, noValidMot,
    failsLast2: E.slice(0, 2).filter((e) => e.result === "Fail").length, advisoriesLatest: (latest.advisories ?? []).length, serious,
    mileageDrop: Math.round(drop), mileageAnomaly, maxGapYears: Math.round(gap * 10) / 10, testGap: gap > 2.2,
    recentAnnualMiles, lifetimeAnnualMiles, highRecentUse: recentAnnualMiles != null && recentAnnualMiles > 2 * AVG_ANNUAL,
    cleanHistory: E.length >= 3 && !last3.some((e) => e.result === "Fail") && (latest.advisories ?? []).length <= 1,
  };
}

export const bandOfPrice = (p: number): Band => (p < 2000 ? "<2k" : p < 5000 ? "2-5k" : "5k+");
const BOUNDS: Record<Band, [number, number]> = { "<2k": [-35, 8], "2-5k": [-25, 6], "5k+": [-15, 4] };
// [<2k, 2-5k, 5k+] percentage points
const F = {
  noValidMot: [-30, -20, -10], dueSoon: [-3, -2, -1], longMot: [4, 2, 0], failPerRecent: [-2, -1.5, -1], failCap: [-4, -3, -2],
  advisoryPerExtra: [-1, -0.75, -0.5], advisoryCap: [-4, -3, -2],
  corrosion: [-6, -4, -2], oilLeak: [-5, -4, -3], brakes: [-1.5, -1, -0.5], suspension: [-1.5, -1, -0.5], tyres: [-1, -0.5, -0.5], emissions: [-2, -1.5, -1],
  seriousCap: [-10, -8, -5], clean: [3, 2, 1], mileageAnomaly: [-15, -12, -10], testGap: [-2, -2, -1],
} as const;

/** Bounded multiplicative condition adjustment from MOT history. refPrice = the model's private price (sets the band). */
export function motAdjustment(sig: MotSignals | null, refPrice: number): MotAdj {
  const band = bandOfPrice(refPrice); const bi = band === "<2k" ? 0 : band === "2-5k" ? 1 : 2; const bounds = BOUNDS[band];
  if (!sig) return { pct: 0, factor: 1, band, bounds, parts: [], signals: null };
  const parts: MotAdjPart[] = []; const add = (key: string, pct: number, basis: MotAdjPart["basis"]) => { if (pct) parts.push({ key, pct: Math.round(pct * 10) / 10, basis }); };
  if (sig.noValidMot) add("no_valid_mot", F.noValidMot[bi], "measured-text-proxy");
  else if (sig.expiryStatus === "due_soon") add("mot_due_soon", F.dueSoon[bi], "prior");
  else if (sig.expiryStatus === "long") add("long_mot", F.longMot[bi], "measured-text-proxy");
  // a recent fail that was then passed: the car needed work; noValidMot already covers a standing fail
  const fixedFails = sig.noValidMot ? Math.max(0, sig.failsLast2 - 1) : sig.failsLast2;
  add("recent_fails", Math.max(F.failCap[bi], fixedFails * F.failPerRecent[bi]), "prior");
  add("advisories", Math.max(F.advisoryCap[bi], Math.max(0, sig.advisoriesLatest - 2) * F.advisoryPerExtra[bi]), "prior");
  let ser = 0;
  for (const k of ["corrosion", "oilLeak", "brakes", "suspension", "tyres", "emissions"] as const) if (sig.serious[k]) ser += F[k][bi];
  add("serious_items", Math.max(F.seriousCap[bi], ser), sig.serious.corrosion || sig.serious.oilLeak ? "measured-text-proxy" : "prior");
  if (sig.cleanHistory && !sig.noValidMot) add("clean_history", F.clean[bi], "measured-text-proxy");
  if (sig.mileageAnomaly) add("odometer_drop", F.mileageAnomaly[bi], "prior");
  if (sig.testGap) add("test_gap", F.testGap[bi], "prior");
  const raw = parts.reduce((s, p) => s + p.pct, 0);
  const pct = Math.round(Math.max(bounds[0], Math.min(bounds[1], raw)) * 10) / 10;
  return { pct, factor: 1 + pct / 100, band, bounds, parts, signals: sig };
}
