// Valu8 — buyer mode: is this advert's asking price fair?
// MarketCheck is off by default (MARKETCHECK_ENABLED). Without it we price from
// our own comparable-listings engine (ownComps), falling back to a quick AI
// estimate when ownComps confidence is low. Response shape is unchanged, plus
// `source`: "marketcheck" | "own_comps" | "ai_estimate".
import { corsHeaders, guard, json, checkLimit, clientIp, envInt, adminClient } from "../_shared/guard.ts";
import { sanitiseLink, sellerTypeOf, privateFromDealer, sha256Hex, GUEST_TOKEN_RE } from "../_shared/adverts.ts";
import { fairPrice } from "../_shared/insights.ts";
import { valueWithOwnComps } from "../_shared/ownCompsAdjust.ts";

type Band = { low: number; mid: number; high: number };
function verdictFor(asking: number, b: Band, sample: number) {
  const diffPct = Math.round(((asking - b.mid) / b.mid) * 100);
  const verdict = asking <= b.low ? "great" : asking <= b.high ? "fair" : asking <= b.high * 1.1 ? "high" : "overpriced";
  return { verdict, ...b, diffPct, sample };
}

// Adverts are mostly dealer asking prices, so compare against the dealer-level band.
function ownCompsBand(make: string, model: string, variant: string | undefined, year: number, mileage: number) {
  const oc = valueWithOwnComps({ make, model, variant, year, mileage, adText: variant, currentYear: new Date().getUTCFullYear() });
  if (oc.unavailable || !(oc.privatePrice > 0) || !(oc.dealerPrice > 0)) return null;
  const k = oc.dealerPrice / oc.privatePrice;
  const r = (n: number) => Math.round(n / 50) * 50;
  return { band: { low: r(oc.low * k), mid: r(oc.dealerPrice), high: r(oc.high * k) }, confidence: oc.confidence, nComps: oc.nComps, level: oc.level };
}

async function aiBand(make: string, model: string, variant: string | undefined, year: number, mileage: number): Promise<Band | null> {
  const key = Deno.env.get("AI_API_KEY") || Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  const url = Deno.env.get("AI_GATEWAY_URL") || "https://ai.gateway.lovable.dev/v1/chat/completions";
  const resp = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(20000),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("AI_MODEL") || "google/gemini-2.5-flash",
      temperature: 0, top_p: 0,
      messages: [
        { role: "system", content: "You are a conservative UK used-car pricing analyst. Estimate typical current UK DEALER asking prices in GBP for the described car. Be realistic and avoid optimism." },
        { role: "user", content: `${year} ${make} ${model}${variant ? " " + variant : ""}, ${mileage} miles.` },
      ],
      tools: [{ type: "function", function: { name: "price_band", description: "UK dealer asking price band", parameters: {
        type: "object", required: ["low", "mid", "high"],
        properties: { low: { type: "number" }, mid: { type: "number" }, high: { type: "number" } } } } }],
      tool_choice: { type: "function", function: { name: "price_band" } },
    }),
  });
  if (!resp.ok) { console.error("fair-price AI", resp.status); return null; }
  const j = await resp.json();
  const args = j?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  const o = typeof args === "string" ? JSON.parse(args) : args;
  const low = Math.round(Number(o?.low)), mid = Math.round(Number(o?.mid)), high = Math.round(Number(o?.high));
  if (!(low > 0 && mid >= low && high >= mid)) return null;
  return { low, mid, high };
}

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

const ENGINE_VERSION = "v2.2-ledger";

// Logging only: records the check after the result is built. Never throws, never changes the result.
async function logCheck(ctx: { userId: string | null; body: any; make: string; model: string; variant?: string; year: number; mileage: number; asking: number }, payload: any): Promise<string | null> {
  try {
    if (!payload || payload.verdict === "unknown" || !(Number(payload.mid) > 0)) return null;
    const admin = adminClient();
    if (!admin) return null;
    const link = sanitiseLink(ctx.body?.link);
    const tok = !ctx.userId && typeof ctx.body?.guestToken === "string" && GUEST_TOKEN_RE.test(ctx.body.guestToken) ? ctx.body.guestToken : null;
    const id = crypto.randomUUID();
    const r = (n: unknown) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Math.round(Number(n)) : null);
    const { error } = await admin.from("advert_checks").insert({
      id, user_id: ctx.userId, guest_token_hash: tok ? await sha256Hex(tok) : null,
      make: ctx.make, model: ctx.model, variant: ctx.variant ?? null, year: Math.round(ctx.year), mileage: Math.round(ctx.mileage),
      asking_price: Math.round(ctx.asking), seller_type: sellerTypeOf(ctx.body?.sellerType),
      link_url: link?.url ?? null, link_domain: link?.domain ?? null, link_fetchable: link?.fetchable ?? false,
      verdict: String(payload.verdict ?? ""), estimate_private: privateFromDealer(Number(payload.mid)),
      estimate_dealer_low: r(payload.low), estimate_dealer_mid: r(payload.mid), estimate_dealer_high: r(payload.high),
      pricing_source: payload.source ?? null, confidence: payload.confidence ?? null, engine_version: ENGINE_VERSION,
    });
    if (error) { console.warn("advert_checks insert failed", error.message); return null; }
    return id;
  } catch (e) { console.warn("advert check logging failed", e); return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const g = await guard(req, { feature: "fair-price", requireUser: false, requirePremium: true, perMinute: 6, perDay: 40, ipPerHour: 60 });
  if (g.response) return g.response;
  if (!g.userId && !(await checkLimit(`fair-price:guest:ip:${clientIp(req)}:d`, 86400, envInt("GUEST_CHECK_DAILY_CAP", 10)))) {
    return json({ error: "You've used today's free guest checks. Create a free account to keep going.", code: "guest_limit" }, 429);
  }
  try {
    const b = await req.json().catch(() => ({}));
    const make = String(b?.make ?? "").trim().slice(0, 60);
    const model = String(b?.model ?? "").split("·")[0].trim().slice(0, 80);
    const year = Number(b?.year), mileage = Number(b?.mileage), asking = Number(b?.askingPrice);
    if (!make || !model || !Number.isFinite(year) || !Number.isFinite(mileage) || !(asking > 0)) {
      return json({ error: "make, model, year, mileage and askingPrice are required" }, 400);
    }
    const key = (Deno.env.get("MARKETCHECK_ENABLED") ?? "false").toLowerCase() === "true" ? Deno.env.get("MARKETCHECK_API_KEY") : undefined;
    const variant = String(b?.variant ?? "").trim().slice(0, 80) || undefined;
    const ctx = { userId: g.userId, body: b, make, model, variant, year, mileage, asking };
    const ok = async (payload: any) => {
      const checkId = await logCheck(ctx, payload);
      return json(checkId ? { ...payload, checkId } : payload);
    };
    if (!key) {
      const oc = (() => { try { return ownCompsBand(make, model, variant, year, mileage); } catch (e) { console.warn("ownComps failed", e); return null; } })();
      if (oc && oc.confidence !== "Low" && oc.confidence !== "Very Low") {
        return ok({ ...verdictFor(asking, oc.band, oc.nComps), basis: `Valu8 comparable data (${oc.nComps} similar cars)`, asking, comparables: [], source: "own_comps", confidence: oc.confidence });
      }
      const ai = await aiBand(make, model, variant, year, mileage).catch((e) => { console.error("fair-price AI failed", e); return null; });
      if (ai) return ok({ ...verdictFor(asking, ai, 0), basis: "AI market estimate", asking, comparables: [], source: "ai_estimate", confidence: "Low" });
      if (oc) return ok({ ...verdictFor(asking, oc.band, oc.nComps), basis: `Valu8 comparable data (${oc.nComps} similar cars)`, asking, comparables: [], source: "own_comps", confidence: oc.confidence });
      return json({ verdict: "unknown", low: 0, mid: 0, high: 0, diffPct: null, sample: 0, basis: "", asking, comparables: [], source: "ai_estimate" });
    }
    let list = await comps(key, { make, model, year: String(year), miles_range: `${Math.max(0, mileage - 25000)}-${mileage + 25000}` });
    let basis = `${year} ${make} ${model}, similar mileage`;
    if (list.length < 5) {
      list = await comps(key, { make, model, year_range: `${year - 1}-${year + 1}` });
      basis = `${make} ${model} ${year - 1}–${year + 1}`;
    }
    const result = fairPrice(asking, mileage, list);
    return ok({ ...result, basis, asking, comparables: list.slice(0, 8), source: "marketcheck" });
  } catch (e) {
    console.error("fair-price error", e);
    return json({ error: "Could not check the price right now." }, 500);
  }
});
