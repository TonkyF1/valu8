# Listings harvest (free, scheduled)

`node scripts/harvest/collect.mjs` collects UK used-car listings into `data/listings/`:

- `listings.csv.gz` - one row per listing: source, listing_id, url, make, model, trim, year, mileage, fuel,
  gearbox, body, engine_cc, price, seller_type, location (town only), first_seen, last_seen, status,
  sold_price_inferred, desc (first 160 chars, used for condition flags). No registration plates, names or
  postcodes are stored.
- `daily/YYYY-MM-DD.csv.gz` - append-only log of every observation that day (source,listing_id,price).
- `runs.jsonl` - one summary line per run.

**Sold-price inference:** a listing not seen for 14+ days (`DELIST_DAYS`) becomes `status=delisted` and
its last asking price is kept as `sold_price_inferred`. If it reappears it goes back to `active`.
Caveat: Gumtree is sampled (page budget per day), so "not seen" can also mean "not crawled"; the
inference is a proxy, not a confirmed sale.

**Dedupe:** per source by listing id; across sources by make|model|year|mileage|price (later copies are
kept with `status=duplicate` and excluded from training and from Supabase).

## Sources

| Source | Status | Why |
|---|---|---|
| Gumtree | ON | Public search pages embed structured listing data (make/model/year/mileage/price/seller/etc.), 25-30 per page, so no per-ad fetches are needed. ~200 make/models x 6 price/seller bands, no price cap, private + trade. 4 s+ between requests with jitter and exponential backoff. Gumtree serves a JS bot challenge to bursts; the collector never solves it - it pauses 5 min and stops for the day after 3 challenges. |
| eBay Motors UK | READY, needs keys | Official, free [Browse API](https://developer.ebay.com/api-docs/buy/browse/overview.html) (category 9801 Cars, EBAY_GB). Needs repo secrets `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` from a free account at https://developer.ebay.com (Production keyset). Sold/completed prices need the Marketplace Insights API, which eBay restricts to approved partners - not used. |
| PistonHeads | OFF | robots.txt allows `/buy/...` pages, but the Terms of Use forbid scraping/data-mining Site Content ("you may not ... 'scrape,' data mine ..."), so it is skipped. |
| AutoTrader | OFF | robots.txt disallows the parameters search needs (`?postcode=`, `?sort=`, `?year-from=`, `?radius=` ...), results are loaded client-side from a protected API, and the terms prohibit automated extraction. Not circumvented. |
| Facebook Marketplace | OFF | Needs a logged-in session; handled manually, never automated. |
| Motors.co.uk | OFF | robots.txt disallows `/car-*` and `/vehicle/*` (the listing pages) and the Acceptable Use Policy bans "use of automated means, including spiders, robots, crawlers ... to download data from the Site". Checked 2026-10-23. |
| CarGurus UK | OFF | Terms of Use prohibit "systematic extraction of data ... by use of any automated mechanism" and limit content use to occasional personal, non-commercial viewing; cargurus.co.uk also serves a bot-verification wall. Checked 2026-10-23. |
| Exchange and Mart | OFF | robots.txt disallows `/search/`, `/ad/`, `/classifieds*` and `/localsites/` for all user agents, i.e. every listing/search URL. Checked 2026-10-23. |
| Retailer / dealer feeds & dealer-site sitemaps | OFF (manual opt-in only) | No public free feed found. Dealer sites are mostly hosted on platforms (e.g. AutoTrader/Motors/Cazoo dealer sites) whose terms forbid automated extraction; a dealer feed would need that dealer's written permission, so none are automated. |
| Public auction results (BCA, Manheim, Aston Barclay, Copart) | OFF | Results/prices sit behind trade logins; terms restrict use to registered buyers. Not automated. |
| eBay Motors UK (Browse API) | READY, keys pending | Collector is in `collect.mjs` and wired into the nightly workflow; it activates automatically once `EBAY_CLIENT_ID`/`EBAY_CLIENT_SECRET` repo secrets exist. |

**Coverage additions (2026-10-23):** the Gumtree collector now also searches **vans** (`search_category=vans`, ~40 van/pick-up models
x 4 price/seller bands) and a **breadth** set of newer/high-price cars (extra models + trade 15-25k / 25k+ and private 12k+ bands),
interleaved 1-in-4 into the daily budget. `FOCUS=breadth node scripts/harvest/collect.mjs` runs only those jobs (catch-up runs).

## Schedule (.github/workflows/harvest.yml)

- Daily ~03:00 UK: collect, commit `data/listings`, upsert changed rows into `market_listings` when
  `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` secrets exist and the table is migrated (otherwise skipped).
- Weekly (Sun 04:30 UTC): `scripts/owncomps/rebuild.sh` rebuilds `ownCompsData.ts` from
  `scripts/owncomps/base_listings.csv.gz` + harvested data, re-runs the fixed 79-listing held-out
  evaluation, and commits only if the held-out median error is not worse than `last_eval.json`.

Env: `MAX_PAGES` (default 400), `DELAY_MS` (4000), `ORDER` (`interleave` | `priority`), `DELIST_DAYS` (14),
`EBAY_MAX_ITEMS` (1500).

Note: the initial seed was pushed through a text-only API, so it lands as `*.gz.b64`; the first
collector run converts these to real `.gz` files (and `build_listings.py` reads either form).
