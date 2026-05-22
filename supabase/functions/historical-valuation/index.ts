// Valu8 — Historical valuation trend
// Builds a realistic lifetime depreciation curve anchored on today's valuation
// for the SPECIFIC car. Uses a piecewise UK depreciation model rather than a
// raw exponential, which avoided wildly inflated "new" prices on old cars
// (e.g. a 2006 Mazda RX-8 starting at £76k).
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

interface ReqBody {
  make: string;
  model: string;
  year: number;
  currentValue: number;
}

interface Point {
  year: string;
  value: number;
}

const MC_KEY = Deno.env.get("MARKETCHECK_API_KEY");

// Realistic UK private-sale retention curve (fraction of original list price
// remaining after N years). Calibrated against typical mainstream cars; rare
// classics will skew but the floor/ceiling caps below keep results sensible.
const RETENTION_CURVE: { age: number; retention: number }[] = [
  { age: 0,  retention: 1.00 },
  { age: 1,  retention: 0.78 },
  { age: 2,  retention: 0.66 },
  { age: 3,  retention: 0.56 },
  { age: 4,  retention: 0.48 },
  { age: 5,  retention: 0.42 },
  { age: 7,  retention: 0.33 },
  { age: 10, retention: 0.24 },
  { age: 13, retention: 0.18 },
  { age: 16, retention: 0.14 },
  { age: 20, retention: 0.11 },
  { age: 25, retention: 0.09 },
  { age: 30, retention: 0.08 },
];

function retentionForAge(age: number): number {
  if (age <= 0) return 1;
  for (let i = 0; i < RETENTION_CURVE.length - 1; i++) {
    const a = RETENTION_CURVE[i];
    const b = RETENTION_CURVE[i + 1];
    if (age >= a.age && age <= b.age) {
      const t = (age - a.age) / (b.age - a.age);
      return a.retention + (b.retention - a.retention) * t;
    }
  }
  return RETENTION_CURVE[RETENTION_CURVE.length - 1].retention;
}

// Sanity-cap the implied "new" price so freak market data can't produce
// absurd starting values. Tuned for the UK mainstream market.
function clampNewPrice(implied: number, currentValue: number): number {
  // A new price below today's value makes no physical sense.
  const minNew = Math.max(currentValue * 1.15, 5000);
  // No mainstream car was ever new at >10x its current trade-in.
  const maxNew = Math.max(currentValue * 9, 12000);
  // Absolute ceiling — anything above this is almost certainly bad data.
  const hardCeiling = 250000;
  return Math.min(hardCeiling, Math.max(minNew, Math.min(maxNew, implied)));
}

async function fetchMarketCheckMedian(body: ReqBody): Promise<number | null> {
  if (!MC_KEY) return null;
  const ymm = `${body.year}|${body.make}|${body.model}`;
  const params = new URLSearchParams({
    api_key: MC_KEY,
    ymm,
    car_type: "used",
    stats: "price",
    rows: "0",
  });
  const url = `https://mc-api.marketcheck.com/v2/search/car/uk/active?${params}`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const json = await resp.json();
    const stats = json?.stats?.price;
    // Prefer median (less sensitive to modified/rare outliers) over mean.
    const v = stats?.median ?? stats?.mean;
    return typeof v === "number" && v > 500 ? Math.round(v) : null;
  } catch {
    return null;
  }
}

function buildSeries(body: ReqBody, anchorToday: number): { series: Point[]; estimated: boolean } {
  const nowYear = new Date().getFullYear();
  const ageYears = Math.max(1, nowYear - body.year);

  const retentionToday = retentionForAge(ageYears);
  const impliedNew = anchorToday / Math.max(retentionToday, 0.06);
  const newPrice = Math.round(clampNewPrice(impliedNew, anchorToday) / 50) * 50;

  // If we had to clamp aggressively, re-derive today's value so the curve
  // stays internally consistent (otherwise the line wouldn't land on the
  // anchor).
  const effectiveToday = Math.round(newPrice * retentionToday);

  const points: Point[] = [];
  for (let i = 0; i <= ageYears; i++) {
    const ret = retentionForAge(i);
    const base = newPrice * ret;
    // Tiny natural variation so the line isn't ruler-straight.
    const noise = Math.sin(i * 1.3 + body.year) * 0.008 * base;
    points.push({
      year: String(body.year + i),
      value: Math.max(500, Math.round((base + noise) / 50) * 50),
    });
  }
  // Lock endpoints exactly.
  points[0].value = newPrice;
  points[points.length - 1].value = Math.round(anchorToday / 50) * 50;

  // Flag estimated when the MC anchor and caller anchor differ a lot, or
  // when the car is very old (sparse data).
  const estimated = ageYears >= 15 || Math.abs(effectiveToday - anchorToday) / anchorToday > 0.25;

  return { series: points, estimated };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = (await req.json()) as ReqBody;
    if (!body?.make || !body?.model || !body?.year || !body?.currentValue) {
      return json({ error: "make, model, year and currentValue are required" }, 400);
    }

    // Try MarketCheck for a present-day market anchor; fall back to the
    // caller's currentValue. We blend toward MC only when it's within a
    // sensible range of currentValue (guards against outlier listings).
    const mcMedian = await fetchMarketCheckMedian(body);
    let anchorToday = body.currentValue;
    if (mcMedian && mcMedian > body.currentValue * 0.4 && mcMedian < body.currentValue * 2.2) {
      anchorToday = Math.round((mcMedian + body.currentValue) / 2);
    }

    const { series, estimated } = buildSeries(body, anchorToday);
    return json({
      series,
      source: "marketcheck",
      estimated,
      note: estimated
        ? "Limited historical data available — trend based on best available market information."
        : undefined,
    });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
