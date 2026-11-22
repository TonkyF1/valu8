/**
 * "What moved your price": the real reasons behind a valuation, in plain English, from figures the engine stored.
 * Only shows a % where the engine actually applied one (MOT ledger, pf-1 trim/details factors). Everything else is
 * described as built in or as not changing the figure. Never invents an effect and never changes a price.
 */
import type { PriceFactors } from "../../supabase/functions/_shared/priceFactors";

export type MoverTone = "down" | "up" | "neutral";
export interface PriceMover { key: string; label: string; detail: string; tone: MoverTone; pct: number | null }

/** UK average is roughly 7,000 to 8,000 miles a year; 7,500 is the midpoint we compare against. */
export const TYPICAL_MILES_PER_YEAR = 7500;

interface MoverReport {
  priceAdjustments?: { label: string; impactPct: number }[] | null;
  motHistory?: { expiryDate?: string | null; date?: string }[] | null;
  priceFactors?: PriceFactors | null;
  factorsUp?: string[] | null;
  conditionScore?: number | null;
  conditionLabel?: string | null;
  pricingSource?: string | null;
  vehicle?: { firstRegistered?: string | null } | null;
  valuationUnavailable?: boolean;
}
export interface MoverVehicle { year: number; mileage: number; model?: string | null; motExpiry?: string | null; hasPhotos: boolean; modelName?: string | null }

const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const round1 = (n: number) => Math.round(n * 10) / 10;
const toneOf = (pct: number): MoverTone => (pct <= -1 ? "down" : pct >= 1 ? "up" : "neutral");
const isMotItem = (label: string) => /\bmot\b/i.test(label);
const isExpiredMot = (label: string) => /no valid mot|mot expired/i.test(label);
/** Seller-supplied details worth naming (history, belts, tyres, keys, owners), not the AI's market commentary. */
const DETAIL_RX = /history|service|stamp|belt|chain|tyre|key|owner|receipt|warranty|clutch|brake|battery|new |replaced|fitted|recent/i;

/** Latest MOT expiry: DVSA first, then the seller-entered date. Returns the date only when it is in the past. */
export function motExpiredOn(r: MoverReport, motExpiry?: string | null, now = new Date()): Date | null {
  const raw = r.motHistory?.[0]?.expiryDate ?? motExpiry ?? null;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) && d.getTime() < now.getTime() ? d : null;
}

export function carAgeYears(year: number, firstRegistered?: string | null, now = new Date()): number {
  const fr = firstRegistered ? new Date(firstRegistered) : null;
  if (fr && Number.isFinite(fr.getTime())) return Math.max(0, (now.getTime() - fr.getTime()) / (365.25 * 864e5));
  return Math.max(0, now.getFullYear() - year + 0.5);
}

/** Trim typed by the seller: pf-1 label, else the " · trim" suffix the app stores on the model. */
function trimOf(r: MoverReport, model?: string | null): string | null {
  if (r.priceFactors?.trimLabel) return r.priceFactors.trimLabel;
  const parts = String(model ?? "").split(" · ");
  return parts.length > 1 && parts[1].trim() ? parts[1].trim() : null;
}

export function priceMovers(r: MoverReport | null | undefined, v: MoverVehicle, now = new Date()): PriceMover[] {
  if (!r || r.valuationUnavailable) return [];
  const out: PriceMover[] = [];
  const adj = Array.isArray(r.priceAdjustments) ? r.priceAdjustments.filter((a) => a && typeof a.impactPct === "number") : [];
  const modelName = v.modelName || String(v.model ?? "").split(" · ")[0] || "car";

  // 1. MOT expiry: the biggest single driver when it applies.
  const expired = motExpiredOn(r, v.motExpiry, now);
  const expiryAdj = adj.find((a) => isExpiredMot(a.label));
  if (expired) {
    out.push({
      key: "mot-expired", label: "MOT expired", tone: "down", pct: expiryAdj ? round1(expiryAdj.impactPct) : null,
      detail: `It ran out on ${fmtDate(expired)}. Buyers pay less for a car without an MOT. A fresh pass usually wins most of this back.`,
    });
  }
  // 2. Other MOT findings, as one line.
  const motRest = adj.filter((a) => isMotItem(a.label) && !isExpiredMot(a.label));
  if (motRest.length) {
    const pct = round1(motRest.reduce((s, a) => s + a.impactPct, 0));
    out.push({ key: "mot-findings", label: "MOT history", tone: toneOf(pct), pct, detail: motRest.map((a) => a.label).join(". ") + "." });
  }
  // 3. Anything else the engine applied (declared write-off, clocking...).
  for (const a of adj.filter((x) => !isMotItem(x.label))) {
    out.push({ key: `adj-${a.label}`, label: a.label, tone: toneOf(a.impactPct), pct: round1(a.impactPct), detail: "Applied to the market figure." });
  }

  // 4. Mileage against a typical car of the same age (built into the comparables, so no separate %).
  const age = carAgeYears(v.year, r.vehicle?.firstRegistered, now);
  if (v.mileage > 0 && age >= 1) {
    const typical = Math.round((age * TYPICAL_MILES_PER_YEAR) / 1000) * 1000;
    const ratio = v.mileage / Math.max(1, typical);
    const miles = `${v.mileage.toLocaleString("en-GB")} miles`;
    out.push(ratio > 1.2
      ? { key: "mileage", label: `Mileage: ${miles}`, tone: "down", pct: null, detail: `Higher than a typical ${v.year} car (about ${typical.toLocaleString("en-GB")}). Built into the price through the cars we compare it with.` }
      : ratio < 0.8
      ? { key: "mileage", label: `Mileage: ${miles}`, tone: "up", pct: null, detail: `Lower than a typical ${v.year} car (about ${typical.toLocaleString("en-GB")}). Built into the price through the cars we compare it with.` }
      : { key: "mileage", label: `Mileage: ${miles}`, tone: "neutral", pct: null, detail: `About typical for a ${v.year} car. Built into the price.` });
  }

  // 5. Trim.
  const trim = trimOf(r, v.model);
  if (trim) {
    const tp = r.priceFactors?.trimPct;
    out.push(typeof tp === "number"
      ? { key: "trim", label: `Trim: ${trim}`, tone: toneOf(tp), pct: Math.abs(tp) >= 1 ? round1(tp) : null,
          detail: Math.abs(tp) < 1 ? `Priced in line with the average ${modelName}.` : `Compared with the average ${modelName} advert, this trim sells for ${tp < 0 ? "less" : "more"}.` }
      : { key: "trim", label: `Trim: ${trim}`, tone: "neutral", pct: null, detail: `Priced against adverts for this trim where we have enough of them.` });
  }

  // 6. Details the seller added (service history, belts, tyres...).
  const named = (r.factorsUp ?? []).filter((f) => DETAIL_RX.test(f) && !/\bmot\b/i.test(f)).slice(0, 3)
    .map((f, i) => (i > 0 && /^[A-Z][a-z]/.test(f) ? f[0].toLowerCase() + f.slice(1) : f));
  const dp = r.priceFactors?.detailsPct;
  if (typeof dp === "number") {
    out.push({ key: "details", label: "Details you added", tone: toneOf(dp), pct: Math.abs(dp) >= 1 ? round1(dp) : null,
      detail: Math.abs(dp) >= 1
        ? `${named.length ? named.join(", ") + ". " : ""}Things like full service history move what buyers pay, and we've counted them.`
        : `${named.length ? named.join(", ") + ". " : ""}Good to have, and they help you sell, but cars like this usually have them too, so the market figure barely moves.` });
  } else if (named.length) {
    out.push({ key: "details", label: "Details you added", tone: "neutral", pct: null,
      detail: `${named.join(", ")}. Good to have, and they help you reach the top of the range, but they don't change the market figure on their own.` });
  }

  // 7. Photos / condition.
  if (v.hasPhotos && typeof r.conditionScore === "number") {
    const engine = r.pricingSource === "valu8_comps";
    out.push({ key: "photos", label: `Photos: ${r.conditionLabel || "scored"} (${r.conditionScore}/10)`, tone: "neutral", pct: null,
      detail: engine ? "They show buyers the condition. The figure comes from comparable adverts, so photos didn't change it." : "Visible condition was taken into account." });
  }

  // 8. Age.
  if (age >= 1) out.push({ key: "age", label: `Age: ${Math.floor(age)} year${Math.floor(age) === 1 ? "" : "s"}`, tone: "neutral", pct: null, detail: `Priced against other cars from around ${v.year}.` });

  return out;
}

/** Signed % for display, e.g. "−20%" / "+3.5%". */
export function fmtPct(p: number): string {
  const n = Math.abs(p);
  return `${p < 0 ? "\u2212" : "+"}${Number.isInteger(n) ? n : n.toFixed(1)}%`;
}
