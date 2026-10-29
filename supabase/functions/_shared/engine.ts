// ens-3 (2026-10-28): the shown price on the no-MarketCheck path. Wraps the ens-2 model legs (pm-1 + own-comps, NO AI)
// and adds the three things measured on a time-held-out dev split (5,807 harvested adverts first seen after the
// training snapshot; never used for any training):
//  * coverage: own-comps level "make_segment"/"global" (no same-model comps) had 23-40% median error vs 9-21% at
//    "model"/"family", and cars 25+ years old are a collector market the legs under-price badly (+80-170% log bias).
//    Those cases are NOT confident -> the caller keeps the AI estimate (with its safety cap) as the fallback.
//    (A dealer old-car uplift was tried and dropped: it made 17+ year-old dealer cars worse once retail was bounded.)
//  * retail >= private always: retail is floored at private x 1.08 and bounded at private x 1.7 (<£5k), 1.5 (<£10k),
//    1.4 above (see coherentPricing.retailCapMultiplier). Cheap dealer cars really are ~1.4x a private sale.
import { ensemble, type EnsembleCtx, type EnsembleResult } from "./ensemble.ts";
import { retailCapMultiplier } from "./coherentPricing.ts";
import { ageCalib } from "./ageCurve.ts";

export const ENS3 = { VERSION: "ens-3", CONFIDENT_LEVELS: ["model", "family"], CLASSIC_AGE: 25, RETAIL_FLOOR: 1.08 } as const;
export interface EngineIn {
  pm: { private: number; low: number; high: number } | null; // pm-1 private incl. MOT signal factor
  ownComps: { privatePrice: number; unavailable?: boolean } | null;
  ctx: EnsembleCtx;                                          // as ens-2 (pmDealer incl. MOT factor, ocDealer, ocLevel...)
  // MOT-history factor (motSignals). The pm legs arrive already multiplied; it is applied here to the own-comps legs
  // too, so the blended price moves by the full factor the report shows (before, the geometric blend diluted it to
  // ~factor^0.6). Not measurable on the advert holdouts (no regs / DVSA history); sizes stay the bounded, shrunk
  // text-proxy priors in motSignals.ts. Omitted = 1 (fair-price, harness).
  motFactor?: number;
  // ac-1 age x seller calibration keys (ageCurve.ts); make/model optional (omitted = age-only calibration).
  vehicle?: { make?: string | null; model?: string | null };
}
export interface EngineOut { version: string; private: number; low: number; high: number; retail: number; confident: boolean; reason: string; ens: EnsembleResult }
const r50 = (x: number) => Math.round(x / 50) * 50;

export function engineValue(x: EngineIn): EngineOut | null {
  const f = x.motFactor && Number.isFinite(x.motFactor) && x.motFactor > 0 ? x.motFactor : 1;
  const own = x.ownComps && f !== 1 ? { ...x.ownComps, privatePrice: x.ownComps.privatePrice * f } : x.ownComps;
  const ctx = f !== 1 && x.ctx.ocDealer ? { ...x.ctx, ocDealer: x.ctx.ocDealer * f } : x.ctx;
  const ens = ensemble({ pm: x.pm, ownComps: own, ai: null, ctx });
  if (!ens || !(ens.private > 0)) return null;
  const age = Math.max(0, (x.ctx.currentYear ?? 2026) - x.ctx.year);
  const P0 = ens.private;
  let R = ens.retail?.price && ens.retail.price > 0 ? ens.retail.price : P0 * 1.2;
  R = Math.min(Math.max(R, P0 * ENS3.RETAIL_FLOOR), P0 * retailCapMultiplier(P0));
  // ac-1: calibrate both legs for age (and older-car model) bias measured on post-snapshot adverts.
  const ac = ageCalib(age, x.vehicle?.make, x.vehicle?.model);
  const fp = Math.exp(ac.priv), fr = Math.exp(ac.retail);
  const P = r50(P0 * fp);
  R = Math.max(R * fr, P * ENS3.RETAIL_FLOOR);
  const level = x.ctx.ocLevel ?? "";
  let reason = "ok";
  if (!x.ownComps || x.ownComps.unavailable) reason = "no own-comps";
  else if (!(ENS3.CONFIDENT_LEVELS as readonly string[]).includes(level)) reason = `own-comps level ${level || "none"}`;
  else if (age >= ENS3.CLASSIC_AGE) reason = "classic age";
  else if (!x.pm) reason = "no pm";
  // eng4 audit: older (15y+), modern-classic (20y+) and thin-data (<30 model rows) cars miss the range far more
  // often (80th-pct |log error| 0.6 vs 0.43), so widen their range instead of claiming false precision.
  const thin = x.ctx.pmNModel != null && x.ctx.pmNModel < 30;
  const widen = age >= 20 ? 1.4 : (age > 15 || thin) ? 1.2 : 1;
  const lo0 = Math.min(ens.low * fp, P), hi0 = Math.max(ens.high * fp, P);
  const lo = P * Math.pow(lo0 / P, widen), hi = P * Math.pow(hi0 / P, widen);
  return { version: ENS3.VERSION, private: P, low: Math.min(r50(lo), P), high: Math.max(r50(hi), P), retail: Math.max(r50(R), P), confident: reason === "ok", reason, ens };
}

const MOT_LABEL: Record<string, string> = {
  no_valid_mot: "No valid MOT", mot_due_soon: "MOT due soon", long_mot: "Long MOT remaining", recent_fails: "Recent MOT failures",
  advisories: "Several MOT advisories", serious_items: "Serious MOT items (corrosion, leaks, brakes or suspension)", clean_history: "Clean MOT history",
  odometer_drop: "MOT mileage reading went down", test_gap: "Gap in MOT history",
};
export interface LedgerLine { label: string; impactPct: number; scope: "retail" }
/** Report ledger for an engine-priced car. MOT parts are already in the price (shown, factor 1); declared write-off /
 *  spares items and clocking are applied on top (factor), capped at -60% combined. */
export function engineLedger(p: { motParts: { key: string; pct: number }[]; motPct: number; declared: { label: string; impactPct: number }[]; clocking: boolean }) {
  const items: LedgerLine[] = p.motParts.map((x) => ({ label: MOT_LABEL[x.key] ?? x.key.replace(/_/g, " "), impactPct: x.pct, scope: "retail" as const }));
  const rawMot = items.reduce((s, i) => s + i.impactPct, 0);
  if (items.length && Math.abs(rawMot - p.motPct) >= 0.1) items.push({ label: "MOT adjustments capped", impactPct: Math.round((p.motPct - rawMot) * 10) / 10, scope: "retail" });
  const extra: LedgerLine[] = p.declared.map((i) => ({ label: i.label, impactPct: i.impactPct, scope: "retail" as const }));
  if (p.clocking) extra.push({ label: "Declared mileage below MOT record", impactPct: -15, scope: "retail" });
  const raw = extra.reduce((s, i) => s + i.impactPct, 0), netPct = Math.max(-60, Math.min(0, raw));
  if (netPct !== raw) extra.push({ label: "Combined adjustments capped", impactPct: netPct - raw, scope: "retail" });
  return { items: [...items, ...extra], netPct, factor: 1 + netPct / 100 };
}
