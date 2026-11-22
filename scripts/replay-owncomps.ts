// Replays the own-comps engine on exported valuations (JSON rows: make, model, year, mileage, fuel, gearbox).
// deno run -A scripts/replay-owncomps.ts <repoRoot> <out.json> <rows.json>
const root = Deno.args[0];
const { valueWithOwnComps } = await import(`${root}/supabase/functions/_shared/ownCompsAdjust.ts`);
const rows = JSON.parse(await Deno.readTextFile(Deno.args[2] ?? "recent.json"));
const out: any[] = [];
for (const r of rows) {
  const [model, variant] = String(r.model).split(" · ");
  if (/agent test|qa/i.test(String(r.model))) continue;
  const q = { make: r.make, model: model.replace(/\s*\(agent test.*\)$/i, ""), variant: variant ?? undefined, year: r.year, mileage: r.mileage,
    fuel: r.fuel?.toLowerCase(), gearbox: (r.gearbox ?? (/\b(auto|cvt|dsg|s-a|a)\b/i.test(String(r.model)) ? "automatic" : undefined))?.toLowerCase(), adText: variant, currentYear: 2026 };
  let res: any; try { res = valueWithOwnComps(q as any); } catch (e) { res = { error: String(e) }; }
  out.push({ id: r.id, make: r.make, model: r.model, year: r.year, mileage: r.mileage, conf: r.conf, src: r.src, unav: r.unav,
    level: res.level, ocConf: res.confidence, n: res.nComps, priv: res.finalPrivate, lo: res.finalLow, hi: res.finalHigh, score: res.confidenceScore });
}
await Deno.writeTextFile(Deno.args[1], JSON.stringify(out));
const c = (k: string) => Object.entries(out.reduce((a: any, o: any) => (a[o[k]] = (a[o[k]] ?? 0) + 1, a), {}));
console.log("rows", out.length, "level", JSON.stringify(c("level")), "ocConf", JSON.stringify(c("ocConf")));
