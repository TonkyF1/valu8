// Tuning split (separate from held-out): deterministic ~15% of non-held rows by id hash.
// Fit on the rest, grid-search a cheap-private shrink: pred' = pred * (pred<T ? 1 - a*(1 - pred/T) : 1).
import { fitOwnComps, priceOwnComps, type CompListing } from "../../supabase/functions/_shared/ownComps.ts";
const WORK = Deno.env.get("WORK") ?? "/tmp/owncomps";
const all: (CompListing & { id: string; held: boolean; desc?: string; non_runner?: boolean })[] = JSON.parse(Deno.readTextFileSync(`${WORK}/clean.json`));
const h = (s: string) => { let x = 2166136261; for (const c of s) x = Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0; return x % 100; };
const pool = all.filter((x) => !x.held && !x.non_runner);
const tune = pool.filter((x) => h(x.id) < 15 && x.seller === "private" && x.price < 5000);
const m = fitOwnComps(pool.filter((x) => h(x.id) >= 15));
const raw = tune.map((t) => ({ price: t.price, pred: priceOwnComps(m, { ...t, adText: t.desc }).privatePrice }));
const med = (a: number[]) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
const score = (T: number, a: number) => med(raw.map((r) => { const p = r.pred < T ? r.pred * (1 - a * (1 - r.pred / T)) : r.pred; return Math.abs(p - r.price) / r.price * 100; }));
let best = { T: 0, a: 0, med: score(1, 0) };
for (const T of [3000, 4000, 5000, 6000, 8000]) for (let a = 0; a <= 0.6001; a += 0.05) { const s = score(T, a); if (s < best.med - 1e-9) best = { T, a: +a.toFixed(2), med: s }; }
console.log(JSON.stringify({ tuneN: tune.length, baselineMedian: +score(1, 0).toFixed(1), bias: med(raw.map((r) => (r.pred - r.price) / r.price * 100)).toFixed(1), best }));
