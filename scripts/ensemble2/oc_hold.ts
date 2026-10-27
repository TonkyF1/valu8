// Own-comps on held-out A/B: OLD = owncomps-2 fitted on the train rows that are in the 24-Oct embedded snapshot; NEW = fitted on all train rows.
import { fitOwnComps, priceOwnComps, type CompListing } from "/workspace/valu8-d/supabase/functions/_shared/ownComps.ts";
import { detectPerformanceVariant } from "/workspace/valu8-d/supabase/functions/_shared/performance.ts";
import { OWN_COMPS_ROWS } from "/workspace/valu8-d/supabase/functions/_shared/ownCompsData.ts";
const W = Deno.env.get("WORK")!;
const ocMod = Deno.env.get("OCMOD"); // optional alternative ownComps module for NEW
const all = JSON.parse(Deno.readTextFileSync(`${W}/clean.json`)).filter((x: any) => !x.non_runner);
const S = JSON.parse(Deno.readTextFileSync(`${W}/splits.json`));
const tr = new Set(S.train), A = new Set(S.A), B = new Set(S.B);
const toComp = (x: any): CompListing => {
  const needDesc = !detectPerformanceVariant(x.make, x.model, x.variant, "") && detectPerformanceVariant(x.make, x.model, x.variant, x.desc);
  const v = needDesc ? `${x.variant} ${String(x.desc).slice(0, 160).replace(/\s+/g, " ")}`.trim() : x.variant;
  return { make: x.make, model: x.model, variant: v, year: x.year, mileage: x.mileage, fuel: x.fuel, gearbox: x.gearbox, seller: x.seller, price: x.price, cat_sn: !!(x.cat_sn || x.no_mot) };
};
const emb = new Set(OWN_COMPS_ROWS.map((r) => `${r[0]}|${r[3]}|${r[4]}|${r[8]}`));
const trainRows = all.filter((x: any) => tr.has(x.id));
const oldRows = trainRows.filter((x: any) => emb.has(`${x.make}|${x.year}|${x.mileage}|${x.price}`));
console.error("train", trainRows.length, "old-subset", oldRows.length);
let t0 = performance.now(); const mOld = fitOwnComps(oldRows.map(toComp)); console.error("fit old ms", Math.round(performance.now() - t0));
const NEW = ocMod ? await import(ocMod) : { fitOwnComps, priceOwnComps };
t0 = performance.now(); const mNew = NEW.fitOwnComps(trainRows.map(toComp)); console.error("fit new ms", Math.round(performance.now() - t0));
const out: any[] = [];
for (const x of all) {
  if (!A.has(x.id) && !B.has(x.id)) continue;
  const q = { make: x.make, model: x.model, variant: x.variant, year: x.year, mileage: x.mileage, fuel: x.fuel, gearbox: x.gearbox, adText: x.variant, currentYear: 2026, cat_sn: false, no_mot: false, non_runner: false };
  const o = priceOwnComps(mOld, q), n = NEW.priceOwnComps(mNew, q);
  out.push({ id: x.id, make: x.make, model: x.model, variant: x.variant, year: x.year, mileage: x.mileage, fuel: x.fuel, gearbox: x.gearbox,
    oo_priv: o.privatePrice, oo_dealer: o.dealerPrice, oo_level: o.level, oo_n: o.nComps, oo_conf: o.confidenceScore,
    on_priv: n.privatePrice, on_dealer: n.dealerPrice, on_level: n.level, on_n: n.nComps, on_conf: n.confidenceScore, seg: n.segment, perf: n.perfKey ? 1 : 0 });
}
Deno.writeTextFileSync(`${W}/${Deno.env.get("OUT") ?? "oc_hold.json"}`, JSON.stringify(out));
console.error("rows", out.length);
