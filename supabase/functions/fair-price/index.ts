// Valu8 — buyer mode: is this advert's asking price fair?
// Pulls comparable active UK listings from MarketCheck (existing key, same
// quota as valuations) and returns an interquartile "fair" band.
import { corsHeaders, guard, json } from "../_shared/guard.ts";
import { fairPrice } from "../_shared/insights.ts";

async function comps(key: string, p: Record<string, string>) {
  const params = new URLSearchParams({ api_key: key, rows: "40", car_type: "used", ...p });
  const r = await fetch(`https://mc-api.marketcheck.com/v2/search/car/uk/active?${params}`);
  if (!r.ok) { console.error("MarketCheck", r.status); return []; }
  const j = await r.json();
  const items: any[] = Array.isArray(j?.listings) ? j.listings : [];
  return items
    .filter((it) => Number(it?.price) > 0)
    .map((it) => ({ price: Math.round(Number(it.price)), mileage: Math.round(Number(it.miles ?? 0)), year: Number(it?.build?.year) || undefined, url: it.vdp_url as string | undefined }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const g = await guard(req, { feature: "fair-price", requireUser: true, requirePremium: true, perMinute: 6, perDay: 40, ipPerHour: 60 });
  if (g.response) return g.response;
  try {
    const b = await req.json().catch(() => ({}));
    const make = String(b?.make ?? "").trim().slice(0, 60);
    const model = String(b?.model ?? "").split("·")[0].trim().slice(0, 80);
    const year = Number(b?.year), mileage = Number(b?.mileage), asking = Number(b?.askingPrice);
    if (!make || !model || !Number.isFinite(year) || !Number.isFinite(mileage) || !(asking > 0)) {
      return json({ error: "make, model, year, mileage and askingPrice are required" }, 400);
    }
    const key = (Deno.env.get("MARKETCHECK_ENABLED") ?? "false").toLowerCase() === "true" ? Deno.env.get("MARKETCHECK_API_KEY") : undefined;
    if (!key) return json({ error: "Market data is not configured." }, 503);
    let list = await comps(key, { make, model, year: String(year), miles_range: `${Math.max(0, mileage - 25000)}-${mileage + 25000}` });
    let basis = `${year} ${make} ${model}, similar mileage`;
    if (list.length < 5) {
      list = await comps(key, { make, model, year_range: `${year - 1}-${year + 1}` });
      basis = `${make} ${model} ${year - 1}–${year + 1}`;
    }
    const result = fairPrice(asking, mileage, list);
    return json({ ...result, basis, asking, comparables: list.slice(0, 8) });
  } catch (e) {
    console.error("fair-price error", e);
    return json({ error: "Could not check the price right now." }, 500);
  }
});
