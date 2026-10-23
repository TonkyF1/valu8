#!/usr/bin/env node
// Valu8 free UK car-listings collector (no paid APIs, no deps; Node >= 20).
// Sources: Gumtree public search pages (structured data embedded in the page), eBay Motors UK via the
// free official Browse API (only when EBAY_CLIENT_ID/EBAY_CLIENT_SECRET are set).
// Skipped on purpose (see scripts/harvest/README.md): AutoTrader, PistonHeads (terms prohibit scraping),
// Facebook Marketplace (needs a logged-in session).
// State: data/listings/listings.csv.gz (one row per listing, first_seen/last_seen/status) and an
// append-only observation log data/listings/daily/YYYY-MM-DD.csv.gz (source,listing_id,price).
// Env: MAX_PAGES (Gumtree page budget, default 400), DELAY_MS (default 4000), DELIST_DAYS (default 14),
//      EBAY_MAX_ITEMS (default 1500), SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (optional upsert).
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const DIR = path.join(ROOT, "data/listings");
const MASTER = path.join(DIR, "listings.csv.gz");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const MAX_PAGES = +(process.env.MAX_PAGES ?? 400);
const DELAY = +(process.env.DELAY_MS ?? 4000); // Gumtree serves a bot challenge to bursts; stay slow.
const DELIST_DAYS = +(process.env.DELIST_DAYS ?? 14);
// Stop crawling (but still save) on SIGTERM/SIGINT or after MAX_MINUTES.
let STOP = false; const T0 = Date.now(); const MAX_MIN = +(process.env.MAX_MINUTES ?? 70);
const shouldStop = () => STOP || (Date.now() - T0) / 60000 > MAX_MIN;
const TODAY = new Date().toISOString().slice(0, 10);
export const COLS = ["source", "listing_id", "url", "make", "model", "trim", "year", "mileage", "fuel", "gearbox", "body", "engine_cc", "price", "seller_type", "location", "first_seen", "last_seen", "status", "sold_price_inferred", "desc"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = () => DELAY + Math.random() * DELAY * 0.6;

export async function politeFetch(url, opts = {}, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(30000), ...opts, headers: { "User-Agent": UA, "Accept-Language": "en-GB,en;q=0.9", ...(opts.headers ?? {}) } });
      if (r.status === 429 || r.status >= 500) { console.error("http", r.status, url); await sleep(2 ** i * 5000); continue; }
      if (r.status === 403) throw Object.assign(new Error("403 blocked"), { blocked: true });
      return r;
    } catch (e) { if (e.blocked) throw e; console.error("fetch error", e.message); await sleep(2 ** i * 3000); }
  }
  throw new Error("gave up: " + url);
}

// ---------- CSV ----------
const esc = (v) => { const s = v == null ? "" : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function toCsv(rows) { return [COLS.join(","), ...rows.map((r) => COLS.map((c) => esc(r[c])).join(","))].join("\n") + "\n"; }
export function parseCsv(text) {
  const out = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); out.push(row); row = []; f = ""; } else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); out.push(row); }
  const [h, ...rest] = out; return rest.filter((r) => r.length > 1).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ""])));
}
export const readGz = (p) => fs.existsSync(p) ? parseCsv(zlib.gunzipSync(fs.readFileSync(p)).toString("utf8")) : [];
const writeGz = (p, rows) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, zlib.gzipSync(toCsv(rows), { level: 9 })); };

// ---------- normalisation ----------
export const redactPlates = (s) => String(s ?? "").replace(/\b[A-Z]{2}[0-9]{2} ?[A-Z]{3}\b/gi, "[reg]");
const town = (s) => String(s ?? "").split(",")[0].trim().slice(0, 40);
const title = (s) => String(s ?? "").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
export const fingerprint = (r) => [r.make, r.model, r.year, r.mileage, r.price].map((x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, "")).join("|");

// ---------- Gumtree ----------
export const GT_MODELS = [
  ["ford", ["fiesta", "focus", "kuga", "mondeo", "ka", "c-max", "puma", "ecosport", "galaxy", "s-max", "transit connect"]],
  ["vauxhall", ["corsa", "astra", "insignia", "zafira", "mokka", "meriva", "adam", "agila"]],
  ["volkswagen", ["golf", "polo", "passat", "tiguan", "up", "touran", "t-roc", "scirocco", "sharan"]],
  ["bmw", ["1 series", "3 series", "5 series", "x1", "x3", "x5", "2 series", "4 series"]],
  ["audi", ["a3", "a4", "a1", "a6", "q3", "q5", "tt", "q7"]],
  ["mercedes-benz", ["a class", "c class", "e class", "b class", "cla class", "glc class", "ml class"]],
  ["toyota", ["yaris", "aygo", "auris", "corolla", "prius", "rav4", "c-hr", "avensis"]],
  ["nissan", ["qashqai", "micra", "juke", "note", "x-trail", "leaf"]],
  ["peugeot", ["208", "207", "308", "2008", "3008", "107", "206", "108", "5008"]],
  ["renault", ["clio", "megane", "captur", "scenic", "twingo", "kadjar"]],
  ["citroen", ["c1", "c3", "c4", "c4 picasso", "ds3", "berlingo"]],
  ["honda", ["civic", "jazz", "cr-v", "accord", "hr-v"]],
  ["hyundai", ["i10", "i20", "i30", "tucson", "ix35", "kona"]],
  ["kia", ["picanto", "rio", "ceed", "sportage", "niro", "venga"]],
  ["skoda", ["fabia", "octavia", "superb", "yeti", "citigo", "kodiaq"]],
  ["seat", ["ibiza", "leon", "ateca", "alhambra", "arona"]],
  ["mini", ["hatch", "countryman", "clubman", "convertible"]],
  ["fiat", ["500", "punto", "panda", "tipo"]],
  ["mazda", ["mazda2", "mazda3", "mazda6", "cx-5", "mx-5"]],
  ["land rover", ["range rover sport", "freelander", "discovery", "range rover evoque", "discovery sport", "range rover"]],
  ["volvo", ["v40", "xc60", "xc90", "v70", "s60", "xc40"]],
  ["suzuki", ["swift", "vitara", "splash", "alto", "sx4"]],
  ["dacia", ["sandero", "duster"]], ["mitsubishi", ["outlander", "l200", "asx"]], ["jaguar", ["xf", "xe", "x-type", "f-pace"]],
  ["lexus", ["is", "rx", "ct"]], ["alfa romeo", ["giulietta", "mito"]], ["porsche", ["cayenne", "boxster", "911"]], ["subaru", ["impreza", "forester"]],
  ["smart", ["fortwo"]], ["chevrolet", ["spark", "cruze"]], ["jeep", ["renegade", "compass"]], ["tesla", ["model 3"]], ["mg", ["zs", "mg3"]], ["ds", ["ds 3"]],
];
// Bands in priority order: cheap private cars first.
export const GT_BANDS = [
  { seller: "private", min: 0, max: 3000, pages: 4 }, { seller: "private", min: 3000, max: 8000, pages: 2 },
  { seller: "trade", min: 0, max: 5000, pages: 1 }, { seller: "private", min: 8000, max: 0, pages: 1 },
  { seller: "trade", min: 5000, max: 15000, pages: 1 }, { seller: "trade", min: 15000, max: 0, pages: 1 },
];
const attr = (a, k) => a.find((x) => x.key === k)?.value ?? "";
export function parseGumtreePage(html) {
  const i = html.indexOf("%22searchAds%22"); if (i < 0) return { ads: [], total: 0 };
  const st = html.lastIndexOf('"', i), en = html.indexOf('"', i);
  let j; try { j = JSON.parse(decodeURIComponent(html.slice(st + 1, en))); } catch { return { ads: [], total: 0 }; }
  let ads = []; const find = (o) => { if (!o || typeof o !== "object") return; if (Array.isArray(o.searchAds) && o.searchAds.length > ads.length) ads = o.searchAds; for (const v of Object.values(o)) find(v); };
  find(j); const total = +(html.match(/"tr":(\d+)/)?.[1] ?? 0);
  const listDetails = new Map([...html.matchAll(/"id":(\d+),"isTrade":(true|false),"location":"([^"]*)"/g)].map((m) => [m[1], { trade: m[2] === "true", loc: m[3] }]));
  return {
    total,
    ads: ads.map((a) => {
      const at = a.attributes ?? [], price = Number(String(a.price ?? "").replace(/[^0-9.]/g, ""));
      const st = attr(at, "seller_type") || (listDetails.get(String(a.id))?.trade ? "Trade" : "Private");
      return {
        source: "gumtree", listing_id: String(a.id), url: "https://www.gumtree.com" + a.path,
        make: attr(at, "vehicle_make"), model: title(attr(at, "vehicle_model")), trim: attr(at, "vehicle_derivative") || String(a.title ?? "").slice(0, 80),
        year: attr(at, "vehicle_registration_year"), mileage: attr(at, "vehicle_mileage"), fuel: attr(at, "vehicle_fuel_type"), gearbox: attr(at, "vehicle_transmission"),
        body: attr(at, "vehicle_body_type"), engine_cc: attr(at, "vehicle_engine_size"), price: Math.round(price) || "",
        seller_type: /trade/i.test(st) ? "dealer" : "private", location: town(a.location ?? listDetails.get(String(a.id))?.loc),
        desc: redactPlates(a.shortDescription).replace(/\s+/g, " ").trim().slice(0, 160),
      };
    }),
  };
}
// ORDER=priority (seed): every page of a band before the next band (cheap private first).
// ORDER=interleave (default, daily): page 1 of every model x band first, then page 2, ... so dealers and
// higher prices are covered every day too.
export function gumtreeJobs(order = process.env.ORDER ?? "interleave") {
  const jobs = [];
  const maxPg = Math.max(...GT_BANDS.map((b) => b.pages));
  if (order === "priority") { for (const band of GT_BANDS) for (const [make, models] of GT_MODELS) for (const model of models) for (let pg = 1; pg <= band.pages; pg++) jobs.push({ band, make, model, pg }); }
  else for (let pg = 1; pg <= maxPg; pg++) for (const band of GT_BANDS) if (band.pages >= pg) for (const [make, models] of GT_MODELS) for (const model of models) jobs.push({ band, make, model, pg });
  return jobs;
}
async function* gumtree(budget) {
  let used = 0, challenges = 0; const done = new Set();
  for (const { band, make, model, pg } of gumtreeJobs()) {
    const key = `${make}|${model}|${band.seller}|${band.min}`;
    if (done.has(key)) continue;
    if (used >= budget || shouldStop()) return;
    const q = new URLSearchParams({ search_category: "cars", vehicle_make: make.replace(/ /g, "-"), vehicle_model: model.replace(/ /g, "-"), seller_type: band.seller });
    if (band.min) q.set("min_price", band.min); if (band.max) q.set("max_price", band.max); if (pg > 1) q.set("page", pg);
    used++;
    let html; try { html = await (await politeFetch("https://www.gumtree.com/search?" + q)).text(); } catch (e) { console.error("gumtree", e.message); if (e.blocked) return; continue; }
    if (/window\.rbzns|kramericaindustries/.test(html)) {
      // Bot-protection challenge: do NOT try to solve it. Back off, and give up on Gumtree after 3.
      if (++challenges >= 3) { console.error("gumtree: bot challenge 3x - stopping Gumtree for today"); return; }
      console.error(`gumtree: bot challenge (${challenges}) - pausing 5 min`); await sleep(300000); continue;
    }
    const { ads, total } = parseGumtreePage(html);
    if (!ads.length && process.env.DEBUG_DIR) fs.writeFileSync(`${process.env.DEBUG_DIR}/gt_empty_${used}.html`, html);
    if (!ads.length || used % 10 === 0) console.log(`gumtree page ${used}/${budget}: ${make} ${model} ${band.seller} ${band.min}-${band.max || "+"} p${pg} -> ${ads.length}/${total}`);
    yield* ads;
    if (!ads.length || pg * ads.length >= total) done.add(key);
    await sleep(jitter());
  }
}

// ---------- eBay Motors UK (official Browse API, free developer account) ----------
async function ebayToken() {
  const id = process.env.EBAY_CLIENT_ID, sec = process.env.EBAY_CLIENT_SECRET; if (!id || !sec) return null;
  const r = await fetch("https://api.ebay.com/identity/v1/oauth2/token", { method: "POST", headers: { Authorization: "Basic " + Buffer.from(`${id}:${sec}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope" });
  if (!r.ok) { console.error("ebay token", r.status); return null; }
  return (await r.json()).access_token;
}
export function mapEbayItem(it) {
  const asp = Object.fromEntries((it.localizedAspects ?? []).map((a) => [a.name.toLowerCase(), a.value]));
  const num = (s) => Number(String(s ?? "").replace(/[^0-9]/g, "")) || "";
  return {
    source: "ebay", listing_id: String(it.legacyItemId ?? it.itemId), url: String(it.itemWebUrl ?? "").split("?")[0],
    make: asp["manufacturer"] ?? asp["make"] ?? "", model: title(asp["model"] ?? ""), trim: String(asp["trim"] ?? it.title ?? "").slice(0, 80),
    year: num(asp["year"] ?? asp["year of manufacture"]), mileage: num(asp["mileage"]), fuel: asp["fuel"] ?? asp["fuel type"] ?? "", gearbox: asp["transmission"] ?? "",
    body: asp["body type"] ?? "", engine_cc: num(asp["engine size"]), price: Math.round(+(it.price?.value ?? it.currentBidPrice?.value ?? 0)) || "",
    seller_type: /business/i.test(it.seller?.sellerAccountType ?? "") ? "dealer" : "private", location: town(it.itemLocation?.city),
    desc: redactPlates(it.shortDescription ?? it.title).replace(/\s+/g, " ").slice(0, 160),
  };
}
async function* ebay(maxItems) {
  const tok = await ebayToken(); if (!tok) { console.error("ebay: EBAY_CLIENT_ID/EBAY_CLIENT_SECRET not set - skipped"); return; }
  const H = { Authorization: "Bearer " + tok, "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB" };
  let got = 0;
  for (const price of ["[300..3000]", "[3000..8000]", "[8000..]"]) for (let off = 0; off < 2000 && got < maxItems; off += 200) {
    const q = new URLSearchParams({ category_ids: "9801", limit: "200", offset: String(off), filter: `price:${price},priceCurrency:GBP,itemLocationCountry:GB,buyingOptions:{FIXED_PRICE|AUCTION|BEST_OFFER}` });
    let js; try { js = await (await politeFetch("https://api.ebay.com/buy/browse/v1/item_summary/search?" + q, { headers: H })).json(); } catch (e) { console.error("ebay", e.message); return; }
    for (const s of js.itemSummaries ?? []) {
      if (got >= maxItems || shouldStop()) return;
      try { const it = await (await politeFetch(`https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(s.itemId)}`, { headers: H })).json(); got++; yield mapEbayItem({ ...s, ...it }); } catch (e) { console.error("ebay item", e.message); }
      await sleep(250);
    }
    if (!js.next) break;
  }
}

// ---------- merge / delist ----------
export function merge(master, seen, today = TODAY, delistDays = DELIST_DAYS) {
  const byKey = new Map(master.map((r) => [`${r.source}:${r.listing_id}`, r]));
  const fp = new Map(master.filter((r) => r.status !== "duplicate").map((r) => [fingerprint(r), r]));
  const stats = {};
  for (const s of seen) {
    if (!s.price || !s.make || !s.year || !s.listing_id) continue;
    const k = `${s.source}:${s.listing_id}`, ex = byKey.get(k);
    if (ex) { Object.assign(ex, { ...s, first_seen: ex.first_seen, last_seen: today, status: ex.status === "duplicate" ? "duplicate" : "active", sold_price_inferred: "" }); continue; }
    const dup = fp.get(fingerprint(s));
    const row = { ...s, first_seen: today, last_seen: today, status: dup && dup.source !== s.source ? "duplicate" : "active", sold_price_inferred: "" };
    if (dup && dup.source !== s.source) dup.last_seen = today; else fp.set(fingerprint(s), row);
    byKey.set(k, row); stats[s.source] = (stats[s.source] ?? 0) + 1;
  }
  const cut = new Date(Date.parse(today) - delistDays * 864e5).toISOString().slice(0, 10);
  for (const r of byKey.values()) if (r.status === "active" && r.last_seen < cut) { r.status = "delisted"; r.sold_price_inferred = r.price; }
  return { rows: [...byKey.values()], newBySource: stats };
}

async function supabaseUpsert(rows) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.log("supabase: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set - skipped"); return; }
  const H = { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" };
  const probe = await fetch(`${url}/rest/v1/market_listings?select=*&limit=1`, { headers: H });
  if (!probe.ok) { console.log("supabase: market_listings not available (", probe.status, ") - skipped"); return; }
  const pre = { gumtree: "gt", ebay: "eb" };
  const map = (r) => ({
    id: (pre[r.source] ?? r.source) + r.listing_id, source: r.source, source_url: r.url, make: r.make, model: r.model, variant: r.trim,
    year: +r.year, mileage: +r.mileage || 0, fuel: r.fuel, gearbox: r.gearbox, seller: r.seller_type, price: +r.price, location: r.location,
    flags: { status: r.status, sold_price_inferred: +r.sold_price_inferred || null, body: r.body, engine_cc: +r.engine_cc || null },
    listed_on: r.first_seen, last_seen: r.last_seen,
  });
  for (let i = 0; i < rows.length; i += 500) {
    const r = await fetch(`${url}/rest/v1/market_listings?on_conflict=id`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows.slice(i, i + 500).map(map)) });
    if (!r.ok) { console.log("supabase upsert failed", r.status, (await r.text()).slice(0, 300)); return; }
  }
  console.log("supabase: upserted", rows.length);
}

// Seed files pushed through text-only tooling arrive as base64 (*.gz.b64); turn them into real .gz once.
export function unpackB64(dir = DIR) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir, { recursive: true }).map(String).filter((f) => f.endsWith(".gz.b64"))) {
    const src = path.join(dir, f), dst = src.slice(0, -4);
    if (!fs.existsSync(dst)) fs.writeFileSync(dst, Buffer.from(fs.readFileSync(src, "utf8").replace(/\s+/g, ""), "base64"));
    fs.unlinkSync(src);
  }
}

async function main() {
  unpackB64();
  for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => { console.error(sig, "- stopping crawl and saving"); STOP = true; });
  const master = readGz(MASTER), seen = [], perSource = {};
  const take = async (gen) => { for await (const r of gen) { seen.push(r); perSource[r.source] = (perSource[r.source] ?? 0) + 1; if (seen.length % 300 === 0) console.log("seen", seen.length, JSON.stringify(perSource)); } };
  await take(gumtree(MAX_PAGES));
  await take(ebay(+(process.env.EBAY_MAX_ITEMS ?? 1500)));
  const { rows, newBySource } = merge(master, seen);
  writeGz(MASTER, rows);
  const dayFile = path.join(DIR, "daily", `${TODAY}.csv.gz`);
  // Compact append-only observation log: who was seen at what price today (full rows live in the master).
  const prev = fs.existsSync(dayFile) ? zlib.gunzipSync(fs.readFileSync(dayFile)).toString("utf8") : "source,listing_id,price\n";
  fs.mkdirSync(path.dirname(dayFile), { recursive: true });
  fs.writeFileSync(dayFile, zlib.gzipSync(prev + seen.map((r) => [r.source, r.listing_id, r.price].join(",")).join("\n") + (seen.length ? "\n" : ""), { level: 9 }));
  const summary = { date: TODAY, seen: perSource, new: newBySource, total: rows.length, active: rows.filter((r) => r.status === "active").length, delisted: rows.filter((r) => r.status === "delisted").length };
  console.log(JSON.stringify(summary));
  fs.appendFileSync(path.join(DIR, "runs.jsonl"), JSON.stringify(summary) + "\n");
  const changed = rows.filter((r) => r.last_seen === TODAY || r.status === "delisted");
  await supabaseUpsert(changed.filter((r) => r.status !== "duplicate" && r.model && +r.year && +r.price > 0));
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main().catch((e) => { console.error(e); process.exit(1); });
