// AI anchor: give the AI our own trained-model price, range, own-comps figure and a few similar real adverts, and ask
// it to start from that anchor (explaining any >15% deviation). Pure TS; builds prompt text + rollout arm only.
// Rollout: ANCHOR_MODE env = "off" (default) | "split" (50/50 by a stable hash of the inputs) | "on". The arm is logged
// in the report (anchorArm) so the two arms can be compared on real feedback without a second paid AI call.
import { OWN_COMPS_ROWS } from "./ownCompsData.ts";
import { normMake, normModel, trimTokens } from "./ownComps.ts";

export interface SimilarAdvert { title: string; year: number; mileage: number; price: number; seller: "private" | "dealer"; fuel: string; gearbox: string }
type Row = (typeof OWN_COMPS_ROWS)[number];
let index: Map<string, Row[]> | null = null;
const keyOf = (make: string, model: string) => normMake(make) + "|" + normModel(make, model);
function idx() {
  if (index) return index;
  index = new Map();
  for (const r of OWN_COMPS_ROWS) { const k = keyOf(r[0], r[1]); (index.get(k) ?? index.set(k, []).get(k)!).push(r); }
  return index;
}
const FUEL = ["petrol", "diesel", "hybrid"];
const tc = (s: string) => s.replace(/\b([a-z])/g, (m) => m.toUpperCase());
const fuelIdx = (f?: string | null) => { const v = String(f ?? "").toLowerCase(); return v.includes("hybrid") ? 2 : v.includes("diesel") ? 1 : v.includes("electric") ? 3 : 0; };

/** Up to k nearest real adverts (same make+model, no Cat/no-MOT rows) by year, mileage, fuel, gearbox and trim words. */
export function similarAdverts(q: { make: string; model: string; variant?: string | null; year: number; mileage: number; fuel?: string | null; gearbox?: string | null }, k = 5): SimilarAdvert[] {
  const rows = idx().get(keyOf(q.make, q.model)) ?? [];
  const fi = fuelIdx(q.fuel), auto = String(q.gearbox ?? "").toLowerCase().startsWith("auto") ? 1 : q.gearbox ? 0 : -1;
  const tq = new Set(trimTokens(q.variant ?? ""));
  const lm = Math.log1p(Math.max(0, q.mileage) / 1000);
  const scored = rows.filter((r) => !r[9]).map((r) => {
    const tr = trimTokens(r[2]); const overlap = tq.size ? tr.filter((t) => tq.has(t)).length / tq.size : 0;
    const d = Math.abs(r[3] - q.year) + 2 * Math.abs(Math.log1p(r[4] / 1000) - lm) + (r[5] !== fi ? 1.5 : 0) + (auto >= 0 && r[6] !== auto ? 0.75 : 0) - overlap;
    return { r, d };
  }).sort((a, b) => a.d - b.d || a.r[8] - b.r[8]);
  return scored.slice(0, k).map(({ r }) => ({
    title: `${r[3]} ${tc(r[0])} ${tc(r[1])}${r[2] ? " " + r[2] : ""}`.replace(/\s+/g, " ").trim().slice(0, 80), year: r[3], mileage: r[4], price: r[8],
    seller: r[7] ? "dealer" : "private", fuel: FUEL[r[5]] ?? "other", gearbox: r[6] ? "automatic" : "manual",
  }));
}

export interface AnchorInput {
  pm: { private: number; dealer: number; low: number; high: number; known: string }; // pm-1 (after resolveBody), optional MOT adj applied
  motAdjPct?: number | null;
  ownComps?: { privatePrice: number; low?: number; high?: number; nComps: number; level: string; confidenceScore?: number; unavailable?: boolean } | null;
  similar: SimilarAdvert[];
}
const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");
/** Anchor private price = geometric blend 0.7 pm / 0.3 own-comps (best fixed blend on the held-out set). */
export function anchorPrice(a: AnchorInput): number {
  const oc = a.ownComps && !a.ownComps.unavailable && a.ownComps.privatePrice > 0 ? a.ownComps.privatePrice : null;
  const p = oc ? Math.pow(a.pm.private, 0.7) * Math.pow(oc, 0.3) : a.pm.private;
  return Math.round(p / 50) * 50;
}
/** Text block appended to the user message (kept short: ~150-250 tokens). */
export function anchorBlock(a: AnchorInput): string {
  const L = ["VALU8 DATA ANCHOR (from our own model trained on ~25,000 real UK adverts — start here):",
    `- Trained model: private ${gbp(a.pm.private)}, dealer forecourt ${gbp(a.pm.dealer)}, 80% range ${gbp(a.pm.low)}–${gbp(a.pm.high)} (match level: ${a.pm.known})${a.motAdjPct ? `, includes MOT-history adjustment ${a.motAdjPct > 0 ? "+" : ""}${a.motAdjPct}%` : ""}`];
  if (a.ownComps && !a.ownComps.unavailable && a.ownComps.privatePrice > 0)
    L.push(`- Comparable-adverts engine: private ${gbp(a.ownComps.privatePrice)} from ${a.ownComps.nComps} adverts (${a.ownComps.level} level)`);
  L.push(`- Anchor private price: ${gbp(anchorPrice(a))}`);
  if (a.similar.length) {
    L.push("- Similar adverts (asking prices):");
    for (const s of a.similar) L.push(`  • ${s.title}, ${s.mileage.toLocaleString("en-GB")} mi, ${s.fuel}/${s.gearbox}, ${s.seller}: ${gbp(s.price)}`);
  }
  L.push("Instructions: base privateSale on the anchor. Adjust for condition, photos, MOT history, spec and notes. If your privateSale differs from the anchor by more than 15%, set deviationReason to one sentence naming the concrete reason (e.g. 'MOT failed on corrosion', 'Cat S', 'rare high-spec trim'). Do not deviate just because of general market knowledge.");
  return L.join("\n");
}
/** JSON-schema property to add to the valu8_report tool. */
export const DEVIATION_REASON_PROPERTY = {
  deviationReason: { type: "string", description: "Only if privateSale differs from the VALU8 DATA ANCHOR by more than 15%: one sentence with the concrete reason. Otherwise empty." },
} as const;
export function anchorDeviation(aiPrivate: number, anchor: number): { ratio: number; pct: number; large: boolean } {
  const ratio = anchor > 0 ? aiPrivate / anchor : NaN;
  return { ratio: Math.round(ratio * 100) / 100, pct: Math.round((ratio - 1) * 1000) / 10, large: Number.isFinite(ratio) && Math.abs(Math.log(ratio)) > Math.log(1.15) };
}
export type AnchorMode = "off" | "split" | "on";
const fnv = (s: string) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
/** Which arm this request is in. split = stable 50/50 on make|model|year|mileage|registration (same car -> same arm). */
export function anchorArm(mode: string | null | undefined, key: string): "anchor" | "control" {
  const m = (String(mode ?? "off").toLowerCase() as AnchorMode);
  if (m === "on") return "anchor"; if (m === "split") return fnv(key) % 2 === 0 ? "anchor" : "control";
  return "control";
}
