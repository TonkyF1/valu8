// Valu8 — free DVSA vehicle recall lookup.
// Source: DVSA "Vehicle recalls" open data (Open Government Licence v3.0).
// Recalls are per campaign (make/model/build dates), not per vehicle, so a
// match means "a campaign exists for this model and period" — users must
// confirm with the manufacturer or https://www.check-vehicle-recalls.service.gov.uk/
import { corsHeaders, guard, json } from "../_shared/guard.ts";
import { matchRecalls, parseRecalls, type Recall } from "../_shared/insights.ts";

const CSV_URL = Deno.env.get("RECALLS_CSV_URL") || "https://www.check-vehicle-recalls.service.gov.uk/documents/RecallsFile.csv";
const TTL_MS = 12 * 60 * 60 * 1000;
let cache: { at: number; rows: Recall[] } | null = null;
let inflight: Promise<Recall[]> | null = null;

async function loadRecalls(): Promise<Recall[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  if (inflight) return inflight;
  inflight = (async () => {
    const res = await fetch(CSV_URL, {
      // The DVSA download rejects requests without a browser-like User-Agent.
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Valu8/1.0; +https://valu8.co.uk)", Accept: "text/csv,*/*" },
    });
    if (!res.ok) throw new Error(`Recalls download failed (${res.status})`);
    const buf = new Uint8Array(await res.arrayBuffer());
    const text = new TextDecoder("latin1").decode(buf); // file is Windows-1252/latin-1
    const rows = parseRecalls(text);
    cache = { at: Date.now(), rows };
    return rows;
  })().finally(() => { inflight = null; });
  return inflight;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const g = await guard(req, { feature: "recalls", perMinute: 20, perDay: 200, ipPerHour: 120 });
  if (g.response) return g.response;
  try {
    const body = await req.json().catch(() => ({}));
    const make = String(body?.make ?? "").slice(0, 60);
    const model = String(body?.model ?? "").slice(0, 80);
    const year = Number(body?.year);
    if (!make || !model || !Number.isFinite(year)) return json({ error: "make, model and year are required" }, 400);
    const all = await loadRecalls();
    const recalls = matchRecalls(all, make, model, year);
    return json({
      recalls,
      checkedAt: new Date().toISOString(),
      source: "DVSA vehicle recalls data (Open Government Licence v3.0)",
      checkUrl: "https://www.check-vehicle-recalls.service.gov.uk/",
    });
  } catch (e) {
    console.error("recall-check error", e);
    return json({ error: "Recall data is temporarily unavailable." }, 502);
  }
});
