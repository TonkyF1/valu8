// Held-out evaluation of the own-comps engine. Trains on every non-held row of $WORK/clean.json and
// predicts the fixed 79-listing held-out set (held_ids.json). Writes $WORK/eval.json.
import { fitOwnComps, priceOwnComps, priceFor, type CompListing } from "../../supabase/functions/_shared/ownComps.ts";
const WORK = Deno.env.get("WORK") ?? "/tmp/owncomps";
const all: (CompListing & { id: string; held: boolean; desc?: string })[] = JSON.parse(Deno.readTextFileSync(`${WORK}/clean.json`));
type P = { price: number; pred: number; seller: string };
export function stats(ps: P[]) {
  if (!ps.length) return { n: 0, median: NaN, mean: NaN, within15: NaN };
  const e = ps.map((p) => Math.abs(p.pred - p.price) / p.price * 100).sort((a, b) => a - b);
  return { n: e.length, median: +e[Math.floor(e.length / 2)].toFixed(1), mean: +(e.reduce((a, b) => a + b, 0) / e.length).toFixed(1), within15: +(e.filter((x) => x <= 15).length / e.length * 100).toFixed(0) };
}
const train = all.filter((x) => !x.held && !x.non_runner), held = all.filter((x) => x.held);
const m = fitOwnComps(train);
const ps: P[] = held.map((t) => { const r = priceOwnComps(m, { ...t, adText: t.desc }); return { price: t.price, pred: priceFor(r, String(t.seller)), seller: String(t.seller) }; });
const out = { trainRows: train.length, overall: stats(ps), under5kPrivate: stats(ps.filter((p) => p.price < 5000 && p.seller === "private")), under5k: stats(ps.filter((p) => p.price < 5000)), private: stats(ps.filter((p) => p.seller === "private")) };
console.log(JSON.stringify(out, null, 1));
Deno.writeTextFileSync(`${WORK}/eval.json`, JSON.stringify(out));
