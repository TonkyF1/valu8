// Stratified time-split held-out evaluation of own-comps (harvested Gumtree rows only).
// Strata = price band x seller. Within each stratum the newest TEST_FRAC of listings (by Gumtree id, which increases
// with posting time) are held out; the model is fitted only on the remaining (older) rows. Also reports a pure global
// time split (newest TEST_FRAC overall). Writes $WORK/strat_eval.json and $WORK/strat_test_ids.json.
import { fitOwnComps, priceOwnComps, priceFor } from "../../supabase/functions/_shared/ownComps.ts";
const WORK = Deno.env.get("WORK") ?? "/tmp/owncomps", FRAC = +(Deno.env.get("TEST_FRAC") ?? 0.2);
const all: any[] = JSON.parse(Deno.readTextFileSync(`${WORK}/clean.json`));
const pool = all.filter((x) => x.id.startsWith("gt") && x.search_tag === "harvest" && !x.non_runner && !x.held && x.price >= 300);
const BANDS = [2000, 5000, 10000, 20000, 40000, Infinity], BN = ["<2k", "2-5k", "5-10k", "10-20k", "20-40k", "40k+"];
const band = (p: number) => BN[BANDS.findIndex((b) => p < b)];
const TOP = ["ford", "volkswagen", "bmw", "audi", "peugeot", "mercedes-benz", "nissan", "vauxhall", "toyota", "land rover", "renault", "kia", "honda", "volvo", "porsche", "mg", "smart", "abarth"];
const mk = (m: string) => { const s = String(m).toLowerCase(); return TOP.includes(s) ? s : "other"; };
const gid = (x: any) => +x.id.slice(2);
const strat = new Map<string, any[]>();
for (const x of pool) { const k = `${band(x.price)}|${x.seller}`; (strat.get(k) ?? strat.set(k, []).get(k)!).push(x); }
const test = new Set<string>();
for (const xs of strat.values()) { xs.sort((a, b) => gid(a) - gid(b)); for (const x of xs.slice(Math.floor(xs.length * (1 - FRAC)))) test.add(x.id); }
const stats = (e: number[]) => { if (!e.length) return { n: 0 }; e = [...e].sort((a, b) => a - b); const q = (f: number) => +e[Math.min(e.length - 1, Math.floor(e.length * f))].toFixed(1);
  return { n: e.length, median: q(0.5), p75: q(0.75), mean: +(e.reduce((a, b) => a + b, 0) / e.length).toFixed(1), within15: +(e.filter((v) => v <= 15).length / e.length * 100).toFixed(0), within25: +(e.filter((v) => v <= 25).length / e.length * 100).toFixed(0) }; };
const run = (train: any[], tst: any[]) => { const m = fitOwnComps(train); return tst.map((t) => { const r = priceOwnComps(m, { ...t, adText: t.desc, cat_sn: false, no_mot: false, non_runner: false });
  const pred = priceFor(r, String(t.seller)); return { id: t.id, price: t.price, pred, err: Math.abs(pred - t.price) / t.price * 100, signed: (pred - t.price) / t.price * 100, band: band(t.price), seller: t.seller, make: mk(t.make), level: r.level, n: r.nComps, conf: r.confidenceScore }; }); };
const by = (rs: any[], f: (r: any) => string) => { const o: Record<string, any> = {}; for (const r of rs) (o[f(r)] ??= []).push(r);
  return Object.fromEntries(Object.entries(o).sort().map(([k, v]: any) => [k, { ...stats(v.map((r: any) => r.err)), bias: stats(v.map((r: any) => r.signed)).median }])); };
const report = (rs: any[]) => ({ overall: stats(rs.map((r) => r.err)), bias: stats(rs.map((r) => r.signed)).median, byBand: by(rs, (r) => r.band), bySeller: by(rs, (r) => r.seller),
  byBandSeller: by(rs, (r) => `${r.band}|${r.seller}`), byMake: by(rs, (r) => r.make), byLevel: by(rs, (r) => r.level),
  confidentModel: stats(rs.filter((r) => r.level === "model" && r.n >= 50 && r.conf >= 0.6).map((r) => r.err)) });
const sRes = run(pool.filter((x) => !test.has(x.id)), pool.filter((x) => test.has(x.id)));
const ids = pool.map(gid).sort((a, b) => a - b), cut = ids[Math.floor(ids.length * (1 - FRAC))];
const gRes = run(pool.filter((x) => gid(x) < cut), pool.filter((x) => gid(x) >= cut));
const out = { pool: pool.length, testFrac: FRAC, stratifiedTime: { train: pool.length - test.size, test: test.size, ...report(sRes) }, globalTime: { cutId: cut, test: gRes.length, ...report(gRes) } };
Deno.writeTextFileSync(`${WORK}/strat_eval.json`, JSON.stringify(out, null, 1));
Deno.writeTextFileSync(`${WORK}/strat_test_ids.json`, JSON.stringify([...test].sort()));
Deno.writeTextFileSync(`${WORK}/strat_preds.json`, JSON.stringify(sRes));
console.log(JSON.stringify(out, null, 1));
