# Own-comps pricing engine (owncomps-2) — SHADOW MODE

Files: `supabase/functions/_shared/ownComps.ts` (engine), `ownCompsAdjust.ts` (adjustment modules + loader),
`ownCompsData.ts` (892 cleaned UK asking prices, embedded), tests `_shared/ownComps.test.ts` (Deno) and `src/test/ownComps.test.ts` (vitest).
`analyse-vehicle` computes it on every run and returns `report.ownCompsShadow` (+ admin `debug.ownComps`). **It does not set the price**:
held-out accuracy did not beat the current path, so the live figure is unchanged (engine string stays v2.2-ledger).

## Method
log(price) = segment curve (perf / premium / mainstream: intercept, age, age², ln-miles) + dealer/private terms (incl. private×age, private×miles)
+ auto + diesel + condition flag, ridge-fitted on training rows only. Local offset = year/mileage-kernel-weighted mean of comparables'
residuals, shrunk hierarchically: make+model(+perf variant via `performance.ts`) → model family → make+segment → global curve.
Fitted trim-token uplift (≥8 uses, shrunk k=10, capped ±15%). Confidence from effective comp count. Sold prices can be added as comps with weight 3.

Cleaning: 1,000 rows → 899 (55 malformed/impossible incl. shifted valu8_tests rows repaired where possible, 3 placeholder prices, 6 dupes,
37 robust outliers; held-out rows were never outlier-filtered and never trained on). Non-runners excluded from the fit.

## Accuracy (asking price, abs % error)
| Set | n | mean | median | within 15% |
|---|---|---|---|---|
| Held-out (79) | 79 | 36.2% | 22.8% | 41% |
| held <£5k | 32 | 59.1% | 54.0% | 31% |
| held £5–15k | 45 | 21.1% | 16.6% | 44% |
| held >£15k | 2 | 9.3% | 12.7% | 100% |
| held private | 24 | 67.5% | 54.0% | 21% |
| held dealer | 55 | 22.5% | 16.0% | 49% |
| held performance | 30 | 19.5% | 12.7% | 60% |
| 5-fold CV (899) | 899 | 25.7% | 17.1% | 45% |
| CV <£5k / £5–15k / >£15k | 212/591/96 | 45.3/19.1/22.6% | 27.1/15.6/16.8% | 32/49/46% |
| CV private / dealer | 183/716 | 39.5/22.2% | 27.4/15.6% | 27/49% |
| CV performance | 480 | 21.0% | 16.1% | 47% |
| Baseline overlap (18 held): current path | 18 | 58.6% | 19.1% | 50% |
| Baseline overlap: own-comps | 18 | 83.0% | 65.4% | 17% |
| AI-fallback rows (9): current / own-comps | 9 | 56.6 / 128.6% | 27.0 / 115.4% | 33 / 0% |

Main failure: cheap private cars (£500–£2k). The held set's private cars are much cheaper than training private cars of the same
age/miles (median £2,125 vs £4,100); Gumtree "cheap" searches are price-capped, so the data is truncated and the engine overprices bargains.

## owncomps-2 changes (23 Oct 2026)
- New `van` segment (van model list + body text) so vans no longer price off cars; performance trims pool only with performance trims.
- Age curve is piecewise-linear (hinges at 3/8/15 years) instead of quadratic, ridge-shrunk toward a pooled all-cars prior curve (`priorK=40`) so thin segments follow a sane depreciation shape and can't extrapolate upward for new cars.
- Dealer vs private: dealer asks normalised as private = (dealer - 1500) / 1.10 (`DEALER_NORM`), replacing a dummy that put young-car dealer prices ~1.75x private.
- Huber-weighted pooling, model-name resolution for unseen variants, confidence score built from effective comps, dispersion and nearest-year gap (make_segment/global capped at 0.3).
- Data: +4,881 new Gumtree rows tonight (vans + newer/high-price breadth); master now 13,164 harvested + 1,000 seed, 13,301 training rows after cleaning.

| Metric | Before (owncomps-1) | After (owncomps-2 + harvest) |
|---|---|---|
| Held-out median abs % err (n=79) | 22.7 | 17.2 |
| Held-out mean | 28.3 | 24.1 |
| Held-out within 15% | 37% | 47% |
| 4-fold CV median | 22.0 | 18.9 |
| Octavia vRS 2023 14.1k mi (real 26,250; AI 22,200) | 40,500 live | 27,850 dealer / 23,950 private |
| Transit Custom 2025 (real 32,000; AI 20,750) | 24,050 live | 23,450 dealer / 19,950 private |

Still **not promoted**: on the 9 rows where live used the AI fallback, own-comps median error is 36% vs AI 27%, so it stays in shadow.

## Adjustment modules
| Module | Basis |
|---|---|
| Segment depreciation / mileage / seller / fuel / gearbox | fitted |
| Trim/spec uplift (variant tokens) | fitted |
| Cat S/N write-off | fitted condition coef (≈-19%) clamped to -25..-40%; **self-declared** (no free write-off/stolen data in DVLA/MOT) |
| Cat A/B / stolen | self-declared → no valuation |
| Market trend by segment/month | fitted when ≥2 months & ≥20 rows/month; neutral now (all data 2026-10-23) |
| Rarity | heuristic: widens range only |
| Condition score | heuristic: 7 neutral, ±3%/pt, -15..+9% |
| Photo condition | heuristic from existing AI photoInsights severities; neutral stub with no photos (no paid API) |

## Data gaps
Thin/none: Land Rover 11, Volvo 10, Mitsubishi 6, Fiat 5, Jaguar 5, Suzuki 3, MG 2, Dacia/Smart/Porsche/Alfa/DS ≤1; hybrids 26, no EVs;
>£20k only 71; private sellers 183; cars >15 yrs 167. All one collection date, so no trend data yet.

## Refreshing listings for free
1. Weekly GitHub Action (free minutes) or Supabase `pg_cron` + edge function runs the existing harvester (`dataset/harvest.py` logic) against
   Gumtree search pages at polite rates (≤1 req/2s, robots-respecting), rotating make/model/price-band queries **without** price caps
   (fixes truncation), plus private-seller filters.
2. Upsert into `market_listings` (id = source id); bump `last_seen`; rows unseen for 30 days are marked delisted (last asking ≈ achieved).
3. Nightly: re-export clean rows → regenerate `ownCompsData.ts` (or load from the table at cold start), re-fit, re-run held-out eval;
   only promote if held-out median improves.
4. Free extra sources: user "Sold it?" feedback (weight 3), DVLA/MOT data for mileage sanity, eBay Motors/AutoTrader public pages only
   where ToS allow — check before adding.

## Promotion criteria (to make it primary)
Held-out median <15% and beats current path on the same rows, especially <£5k private. Then: use own-comps as anchor, MarketCheck as
secondary, AI narrative only (AI never sets price).

## Privacy policy — APPLIED 23 October 2026 (src/pages/Privacy.tsx)
Owner decisions:
- No location (incl. postcode district) is recorded.
- No opt-in/opt-out prompt; lawful basis is legitimate interests (accurate valuations).
- Anonymised records (no name, email, registration or photos) kept indefinitely to build the pricing database; anonymised data is not personal data.
- Registration, photos and reports linked to an account kept only while needed for the account; users can request deletion of account data.
- Personal data is never sold.
- Controller: Tony Fisher trading as Valu8 (src/lib/legal.ts); contact by email only, no postal address published.
Wording added to section 3 ("Improving our valuations") and section 5 (Retention); "Last updated" set to 23 October 2026.

## 2026-10-24 — diagnosis and fixes (commit 3e38643)

Tuned on the 15% id-hash tuning split only (3,588 adverts); held-out 79 evaluated once.

Root causes found:
- Gumtree gearbox "Other" (1,337 rows, 93% private) is mostly automatics but was encoded manual: -28% signed bias, 30.7% median error on those rows.
- One global auto/diesel dummy (+0.39 log for auto) mis-prices mixed pools; the within-model auto effect is ~0.27. Fixed by down-weighting comps with a different gearbox or fuel (x0.3).
- The mean residual offset is pulled by odd adverts; a weighted median is more robust.
- Cheap private adverts are near an irreducible noise floor: leave-one-out median of close comps (same model, ±1yr, ±25% miles, same seller/fuel) is still 25% median error for private <£5k.
- The held-out 79 are seed adverts, 30 of them "cheap"-tagged (all 18 AI-shared cases), so held-out is small and skewed; a time split (newest 10% of harvested adverts, n=2,290) is used as a second benchmark.

| | tuning (3,588) | time split (2,290) | held-out 79 (repo data) |
|---|---|---|---|
| before | 18.5% | 16.4% | 17.2% |
| after | 16.5% | 15.2% | 15.3% |

Dealer median error on tuning 12.9% -> 10.8%. Tried with no gain: kernel bandwidth/shrinkage grids, dealer-conversion grid, seller-match weighting, engine-cc matching, junk-text filters, high-mileage hinge, model-string cleaning.
Own-comps is still behind the AI estimate on the 18 shared held cases (35.0% vs 19.1% median), so it stays in shadow.

## 2026-10-24 — AI safety cap (`_shared/aiCap.ts`)

On the AI-only path, if own-comps is confident (exact-model level, >= 50 comps, confidenceScore >= 0.6) and the AI
private figure is > 1.8x own-comps, the private figure is capped at 1.6x own-comps; trade, retail and the private
range are scaled by the same factor before `coherentPricing`. Logged in `debugInfo.aiCap`
(`applied, aiRaw, ownComps, capped, ratio, reason`). Calibration (confident private adverts): 3.8% (tuning) / 3.5%
(newest-10%) of asking prices exceed 1.6x own-comps. Simulated with the stored AI error distribution: tuning
median 36.1% -> 26.1%, newest-10% 36.7% -> 27.0%, fires on ~14-15% of rows, makes ~0.2% worse. Real stored AI rows:
held-out 18 never fire (median unchanged 17.0%); cal 13 fire twice, neither worse.
