import { fitOwnComps, priceOwnComps, priceFor } from "../../supabase/functions/_shared/ownComps.ts";
const all = JSON.parse(Deno.readTextFileSync(`${Deno.env.get("WORK") ?? "/tmp/owncomps"}/clean.json`));
const base = JSON.parse(Deno.readTextFileSync(new URL("./results_baseline.json", import.meta.url)));
const cal = new Set(base.map((r: any) => r.id));
const pool = all.filter((x: any) => !x.held && !x.non_runner);
const out: any[] = [];
for (const [name, train, test] of [["all", pool.filter((x: any) => !cal.has(x.id) && !x.held), all.filter((x: any) => cal.has(x.id))]] as any) {
  const m = fitOwnComps(train);
  for (const t of test) { const r = priceOwnComps(m, { ...t, adText: t.desc }); out.push({ split: name, id: t.id, seller: t.seller, price: t.price, oc: priceFor(r, String(t.seller)), priv: r.privatePrice, level: r.level, n: r.nComps, conf: r.confidenceScore }); }
}
Deno.writeTextFileSync((Deno.env.get("WORK") ?? "/tmp/owncomps") + "/hybrid_oc.json", JSON.stringify(out)); console.log(out.length);
