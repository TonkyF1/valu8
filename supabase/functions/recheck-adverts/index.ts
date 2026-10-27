// Valu8 — daily re-check of advert links (Valu8Bot). Polite and minimal:
// - only link_fetchable rows aged 7–60 days, recheck_count < 4, not rechecked in 7 days, max 50 per run
// - never fetches denylisted domains (re-checked here too, not just trusted from the row)
// - obeys robots.txt for Valu8Bot (falls back to *), honours Crawl-delay, skips if robots can't be read
// - one request per domain per run; Gumtree up to 20, at least 10 s apart
// - stores only listing_status, a price from JSON-LD offers.price / og:price:amount, and timestamps
import { json, corsHeaders, adminClient, checkLimit } from "../_shared/guard.ts";
import { isDenylisted } from "../_shared/adverts.ts";
import { parseRobots, isAllowed, extractPrice, type RobotsRules } from "../_shared/robots.ts";

const UA = "Valu8Bot/1.0 (+https://valu8.uk/bot)";
const DAY = 86400_000;
const MAX_ROWS = 50;
const GUMTREE_MAX = 20;
const GUMTREE_GAP_MS = 10_000;
const BUDGET_MS = 130_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url: string, maxBytes: number): Promise<{ status: number; text: string }> {
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,text/plain" }, redirect: "follow", signal: AbortSignal.timeout(10_000) });
  if (!r.ok || !r.body) { try { await r.body?.cancel(); } catch { /* */ } return { status: r.status, text: "" }; }
  const reader = r.body.getReader();
  const chunks: Uint8Array[] = []; let n = 0;
  while (n < maxBytes) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); n += value.length; }
  try { await reader.cancel(); } catch { /* */ }
  const buf = new Uint8Array(n); let o = 0; for (const c of chunks) { buf.set(c.subarray(0, Math.min(c.length, n - o)), o); o += c.length; if (o >= n) break; }
  return { status: r.status, text: new TextDecoder().decode(buf) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  // At most a few runs per day whoever calls it.
  if (!(await checkLimit("recheck-adverts:run", 3600, 1))) return json({ skipped: "already ran this hour" });
  const admin = adminClient();
  if (!admin) return json({ error: "unavailable" }, 500);
  const started = Date.now();
  const now = new Date();
  const { data: rows, error } = await admin.from("advert_checks")
    .select("id, link_url, link_domain, asking_price, last_seen_price, recheck_count")
    .eq("link_fetchable", true).neq("listing_status", "gone").lt("recheck_count", 4)
    .lte("created_at", new Date(now.getTime() - 7 * DAY).toISOString())
    .gte("created_at", new Date(now.getTime() - 60 * DAY).toISOString())
    .or(`last_rechecked_at.is.null,last_rechecked_at.lte.${new Date(now.getTime() - 7 * DAY).toISOString()}`)
    .order("last_rechecked_at", { ascending: true, nullsFirst: true }).limit(MAX_ROWS);
  if (error) { console.error("recheck select", error.message); return json({ error: "select failed" }, 500); }

  const robotsCache = new Map<string, RobotsRules | null>();
  const perDomain = new Map<string, number>();
  const lastHit = new Map<string, number>();
  const stats = { considered: rows?.length ?? 0, fetched: 0, gone: 0, priceChanged: 0, skipped: 0 };

  for (const row of rows ?? []) {
    if (Date.now() - started > BUDGET_MS) break;
    let u: URL;
    try { u = new URL(row.link_url); } catch { stats.skipped++; continue; }
    const host = u.hostname.toLowerCase();
    const domain = host.replace(/^www\./, "");
    if (isDenylisted(domain)) { stats.skipped++; continue; }
    const isGumtree = domain === "gumtree.com" || domain.endsWith(".gumtree.com");
    const cap = isGumtree ? GUMTREE_MAX : 1;
    if ((perDomain.get(host) ?? 0) >= cap) { stats.skipped++; continue; }

    if (!robotsCache.has(host)) {
      try {
        const r = await fetchText(`${u.protocol}//${host}/robots.txt`, 200_000);
        robotsCache.set(host, r.status === 200 ? parseRobots(r.text, "Valu8Bot") : r.status === 404 ? parseRobots("", "Valu8Bot") : null);
      } catch { robotsCache.set(host, null); }
      lastHit.set(host, Date.now());
    }
    const rules = robotsCache.get(host);
    if (!rules || !isAllowed(rules, u.pathname)) { stats.skipped++; continue; }

    const gap = Math.max(isGumtree ? GUMTREE_GAP_MS : 0, (rules.crawlDelay ?? 0) * 1000);
    const wait = (lastHit.get(host) ?? 0) + gap - Date.now();
    if (wait > 0) { if (Date.now() - started + wait > BUDGET_MS) break; await sleep(wait); }

    perDomain.set(host, (perDomain.get(host) ?? 0) + 1);
    let status = 0, price: number | null = null;
    try {
      const r = await fetchText(row.link_url, 1_500_000);
      status = r.status;
      if (r.status === 200) price = extractPrice(r.text); // page content is discarded here
    } catch { status = 0; }
    lastHit.set(host, Date.now());
    stats.fetched++;

    const update: Record<string, unknown> = { last_rechecked_at: new Date().toISOString(), recheck_count: (row.recheck_count ?? 0) + 1 };
    if (status === 404 || status === 410) {
      update.listing_status = "gone";
      await admin.from("check_outcomes").insert({ kind: "advert", item_id: row.id, source: "recheck", outcome_type: "withdrawn" });
      stats.gone++;
    } else if (status === 200) {
      update.listing_status = "live";
      if (price) {
        const prev = row.last_seen_price ?? row.asking_price;
        update.last_seen_price = price;
        if (prev && price !== prev) {
          await admin.from("check_outcomes").insert({ kind: "advert", item_id: row.id, source: "recheck", outcome_type: "price_changed", outcome_price: price });
          stats.priceChanged++;
        }
      }
    }
    await admin.from("advert_checks").update(update).eq("id", row.id);
  }
  console.log("recheck-adverts", JSON.stringify(stats));
  return json(stats);
});
