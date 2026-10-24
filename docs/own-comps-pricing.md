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

## 2026-10-24 (evening): coverage-gap harvesting, stratified held-out set, hybrid simulation

### Gumtree collector: coverage-gap priority jobs (no new collector, robots-compliant)
Harvest coverage at 24,901 rows was thin in these areas: MG 8 rows, smart 7, Abarth 0, Porsche 142, private >£20k 169, anything >£40k 151, dealer <£2k 172.
Model-level MG/smart/Abarth URLs were returning 0 ads, because of wrong model slugs. Make-level pages
(`/cars-vans-motorbikes/cars/<make>[/<facet>][/uk/<town>]?seller_type=<x>`) do return 26–30 ads per page.
Gumtree ignores `?price=` on these pages, and `min_price`/`max_price` are disallowed by robots.txt. So the price gaps are
targeted through model choice instead: the models with the most >£20k/£40k listings for private sellers, and the models with the most sub-£2k listings for trade.
`scripts/harvest/priority_jobs.mjs` builds 1,219 page-1 jobs. `collect_robots.mjs` runs them before the normal list on every start.
Progress is stored in `state/priority_next.txt`. These jobs log as `qN/M`, so autorun.sh's resume index (`^pN/`) is unchanged. Set `PRIORITY=0` to disable them.

### Stratified time-split held-out set (`scripts/owncomps/strat_eval.ts`)
The pool is 23,891 harvested Gumtree rows (excluding non-runners, the fixed held set and rows under £300). Strata are price band × seller.
Within each stratum, the newest 20% by Gumtree id are held out (4,784 test rows). Own-comps is fitted on the older rows only.
Test ids are in `strat_test_ids.json` and the full output is in `strat_eval_2026-10-24.json`.

| stratum | n | median abs err % | within 25% | median signed % |
|---|---|---|---|---|
| overall | 4784 | 17.0 | 65 | +1.7 |
| confident (model, n≥50, conf≥0.6) | 2283 | 15.6 | 69 | |
| dealer | 1703 | 10.8 | 81 | +3.8 |
| private | 3081 | 21.5 | 57 | 0 |
| <£2k | 1165 | 27.3 | 48 | +21.4 |
| £2–5k | 1366 | 20.0 | 60 | −2.0 |
| £5–10k | 1056 | 14.5 | 73 | −3.4 |
| £10–20k | 889 | 11.5 | 81 | −0.5 |
| £20–40k | 283 | 9.3 | 85 | −3.5 |
| £40k+ | 25 | 23.1 | 56 | −21.1 |
| dealer <£2k | 32 | 135.1 | 0 | +135.1 |
| private £20–40k | 28 | 28.9 | 39 | −27.8 |
| Porsche | 21 | 33.3 | 38 | −9.6 |

A pure global time split (newest 20% overall, 4,779 rows) gives a median of 17.1, within-25% of 64 and a bias of +3.3.
Banding by *actual* price builds regression to the mean into the signed figures. Banded by *predicted* price, the bias stays within ±6.5% in every
cell except dealer £2–5k (+11.4%). The extreme signed errors (dealer <£2k, private >£20k) mostly come from that selection effect and from sparse data.
The level of error in those cells is real, though, and those are the cells the priority jobs target.

### Hybrid AI / own-comps rules (`hybrid_dump.ts`, `hybrid_sim.py`)
Live shadow logs: only 5 valuations carry `ownCompsShadow` (4 unique, all test calls), and `sale_feedback` is empty, so there is no ground truth there.
The simulation instead used the 32 listings with a stored AI-estimate baseline (`results_baseline.json`, AI source only), with own-comps fitted excluding all of them.
On those 32, AI plus the live cap gives a median of 29.6 and a mean of 73.8. No rule beat it on median: own-comps alone 41.9, OC-if-confident 37.2, 30/70 blend 33.9.
The geometric mean cut the mean error to 63.1 (19 wins / 11 losses), but the median went up to 39.2. No hybrid clearly beats AI+cap, so none was adopted.

## 2026-10-24 (night): trained price model pm-1 (`_shared/priceModel.ts`) — SHADOW ONLY, not deployed

**What:** LightGBM (free, local) on log(price) over the harvested Gumtree listings. Features (`scripts/pricemodel/features.py`, mirrored 1:1 in `priceModel.ts`):
age, log mileage, miles/year, engine cc, fuel, gearbox, body, seller, perf-trim regex, advert-text flags (spares/repair/non-runner, Cat S/N/write-off,
no MOT, long MOT, FSH, ULEZ, low miles, warranty, finance/PX, urgent/cheap, damage/project, one owner) and hierarchical smoothed target encodings
make → make|model → make|model|trim (out-of-fold on train). Finance/deposit/"parts only" prices < £2,500 dropped from training. 900 trees × 31 leaves.
Range = split-conformal q10/q90 of out-of-fold log residuals by predicted band × seller (no extra models).

**Eval — the SAME stratified held-out set as own-comps** (`scripts/owncomps/strat_test_ids.json`, newest 20% per band×seller, 4,784 rows; train 19,097).
Median abs % error (`scripts/pricemodel/pm_eval_2026-10-24.json`):

| stratum | n | own-comps | **pm-1** | pm-1^0.7·oc^0.3 blend |
|---|---|---|---|---|
| overall | 4784 | 17.0 | **15.2** (≤25%: 69% vs 65%) | 14.7 |
| dealer | 1703 | 10.8 | **10.2** | 9.4 |
| private | 3081 | 21.5 | **19.4** | 19.4 |
| <£2k | 1165 | 27.3 | **24.9** | 24.5 |
| £2–5k | 1366 | 20.0 | **17.9** | 17.5 |
| £5–10k | 1056 | 14.5 | **13.4** | 12.6 |
| £10–20k | 889 | 11.5 | **10.0** | 9.5 |
| £20–40k | 283 | 9.3 | **9.2** | 8.8 |
| £40k+ | 25 | 23.1 | **21.3** | 19.6 |
| dealer <£2k | 32 | 129.6 | **51.2** | 82.6 |
| private £10–20k / £20–40k | 223 / 28 | 20.0 / 28.4 | **13.6 / 14.2** | 15.4 / 18.0 |
| confident model-level rows | 2283 | 15.6 | **13.8** | — |

Paired bootstrap: pm-1 median gain over own-comps +1.7 pts (95% CI +1.0 to +2.4); pm-1 closer on 53% of rows. Range coverage 80.4% at nominal 80%
(dealer 81.2, private 80.0), median width 79% of the price (honest but wide). Makes where pm-1 is worse than own-comps: Land Rover 16.3 vs 15.2.

**32 AI-estimate cases** (refit excluding all 41 baseline ids + held rows): pm-1 median 43.0% / mean 65.2 vs AI+cap 29.6 / 73.8 and own-comps 41.9 / 66.1.
The AI (which read the full advert) still wins on median for these cheap, text-driven cases; pm-1 wins on mean (fewer blow-ups). Do NOT replace the AI path.
Best simple combo seen: geometric mean of AI+cap and pm-1 → median 37.5 / mean 60.7 (n=32, too small to adopt).

**Verdict:** pm-1 beats own-comps in every price band and both seller types → candidate to replace own-comps as the comps engine, in shadow first.
It does not beat AI+cap on the AI cases.

**Size / speed:** `priceModelData.ts` 1.07 MB (≈410 KB gzipped); 0.12 ms per prediction in Deno; parity with Python LightGBM worst 0.003%
(`priceModel.test.ts`, 200 fixtures). No deps, no network, no paid calls. `REF_YEAR=2026` is baked in: retrain (not edit) next year.

**Rebuild:** `WORK=<dir with clean.json> RAW=<harvest listings.csv.gz> OC_PREDS=<strat_preds.json> EXPORT=1 TS_OUT=supabase/functions/_shared/priceModelData.ts
python scripts/pricemodel/train.py` (lightgbm 4.7, pandas; ~20 s on 8 CPUs), then copy `$WORK/pm_parity.json` to `_shared/priceModel.parity.json` and run
`deno test --no-lock supabase/functions/_shared/priceModel.test.ts` (delete any deno.lock).

**Shadow plan (prepared, not deployed):** in `analyse-vehicle`, after the existing own-comps shadow, call
`pricePmBoth({make, model, variant, year, mileage, fuel, gearbox, body, engine_cc, desc: adText})` inside try/catch and attach
`report.pmShadow = {version, private, dealer, low, high, known, blend}` (blend = `blendWithOwnComps(pm, ownCompsPrice)`); no change to any shown price.
Promotion: after ≥200 shadow rows with a real outcome, if pm-1/blend median error ≤ own-comps − 1.5 pts, make it the comps engine
(AI + cap remains for AI-estimate cases; consider pm-1 as the cap reference instead of own-comps).

## 2026-10-24 (late): accuracy round 2 — body fix, MOT signals, AI anchor, ensemble (all SHADOW unless noted)
Scripts: `scripts/pricemodel/round2/` (run with the pm venv; WORK/RAW as for train.py). Held-out set = the same stratified 4,784 rows.
All numbers are median absolute % error vs asking price.

**1. Biggest finding: pm-1 was being run without a body type.** analyse-vehicle passed `body: null` and the frontend sends no body,
so every car priced as body "other". On the held-out set that is **17.80%** (cheap <£2k band 42.4%!) vs **15.22%** with the true body.
Fix (`priceModel.ts resolveBody` + `priceModelBody.ts`, generated by `scripts/pricemodel/body_modes.py`): use a given DVLA/VDG body
(new spellings: "5 DOOR HATCHBACK", "4 DOOR SALOON", "CABRIOLET"...) when it maps to a well-trained class, otherwise (missing, SUV,
"other") the most common advert body for that make|model. Measured with the fill: **15.56%** (<£2k 24.9%). Parity tests unchanged
(featurize is untouched; only pricePm resolves the body). Passing the DVLA body from the frontend should get most of the remaining 0.3pt.
Engine cc is already passed (removing it would cost 15.2→20.3%). First-registration date: the training data has year only, so no
gain is measurable until a retrain with month-level age — not wired.

**2. MOT signals (`_shared/motSignals.ts`).** Features from the DVSA entries: tests, latest result/date, days to expiry + status,
no valid MOT, fails in last 2 tests, advisories on the latest test, serious keywords (corrosion, brakes, suspension, tyres, oil leak,
emissions), odometer drop (clocking risk), longest test gap, recent vs lifetime annual miles, clean history.
Sizing from harvest ad-text proxies: refit pm without any text flags (5-fold OOF on train+test, so matched on make/model/trim/age/
mileage/fuel/body/cc), median log residual of flagged adverts by band (<£2k / £2-5k / £5k+), 90% bootstrap CI in `round2/effects.json`:

| ad text proxy | <£2k | £2-5k | £5k+ |
|---|---|---|---|
| no MOT / expired (n=91) | -39.9% | -31.7% | n<15 |
| MOT failed (n=26) | -47.8% | n<15 | n<15 |
| long / 12 months MOT | +4.1% | +1.8% | -5.6% |
| no advisories / clean MOT | +12.4% | +3.9% | -2.8% |
| mentions advisories | +11.7% | +2.6% | -5.9% |
| rust / corrosion (n=47) | -7.9% (wide CI) | n<15 | n<15 |
| smoke / knock / oil leak / misfire | -13.4% | -12.1% | -12.0% |
| warning light / limp mode / DPF | -9.8% | -2.6% | -7.7% |
| new clutch/cambelt/tyres etc. | +5.7% | +1.7% | +1.3% |
| service history mentioned | +8.4% | +4.6% | +0.5% |

Assumptions: (a) a seller who writes "MOT failed / rust / leak" is describing a worse car than a DVSA line item, so factors are
shrunk to roughly half–two-thirds of the measured effect; (b) "mentions advisories" is positive (thorough sellers), so it is NOT used
as evidence about DVSA advisory counts, which get a small prior penalty instead; (c) the negative £5k+ "long MOT" effect is
confounded (dealers rarely mention MOT) so it is set to 0. Factors (pp, <£2k/£2-5k/£5k+): no valid MOT -30/-20/-10; due <60d
-3/-2/-1 (prior); long MOT +4/+2/0; each fixed fail in last 2 tests -2/-1.5/-1 (cap -4/-3/-2, prior); each advisory beyond 2
-1/-0.75/-0.5 (cap -4/-3/-2, prior); corrosion -6/-4/-2, oil leak -5/-4/-3, brakes/suspension -1.5/-1/-0.5, tyres -1/-0.5/-0.5,
emissions -2/-1.5/-1 (serious total cap -10/-8/-5); clean history +3/+2/+1; odometer drop -15/-12/-10 (prior); test gap >2.2y
-2/-2/-1 (prior). Total bounds: £5k+ -15..+4%, £2-5k -25..+6%, <£2k -35..+8%. Cannot be validated on the harvest (no DVSA
data there): it is shadow-only (`pmShadow.motAdj`, `pmShadow.pmWithMot`) until sale feedback / user corrections can score it.

**3. AI anchor (`_shared/aiAnchor.ts`).** The AI gets pm-1 private/dealer/80% range (with MOT adj), the own-comps base price
(computed BEFORE the AI call, without the AI condition score), the 0.7/0.3 anchor price and ≤5 similar real adverts from
OWN_COMPS_ROWS, and is told to start from the anchor and give `deviationReason` if it moves >15%. AI cap stays. Cost: the block is
~1,050-1,100 characters ≈ 270 input tokens + ~30 output tokens ≈ $0.00016 per valuation on gemini-2.5-flash list prices
(≈ +5-8% of the current prompt); no extra AI call. Rollout: `ANCHOR_MODE` env off (default) / split (stable 50/50 hash of
make|model|year|mileage|reg; arm logged as `anchorArm`) / on. A true shadow would need a second paid call per valuation, so it is
not recommended. The anchor arm DOES change the displayed AI price, so `split` is the first measured step and needs approval.

**4. Ensemble (`_shared/ensemble.ts`, `ensembleShadow`).** Segment weights (band × seller × pm-known × own-comps-confident ×
has-text, hierarchical shrinkage K=100-800, 10× repeated 2-fold cross-fitting) did not beat one fixed weight: 14.91-15.06% vs
14.98% for pm^0.7·oc^0.3 (noise), and some strata lost 0.5-1pt. So the weight is fixed. Held-out (no AI on this set):

| stratum | pm-1 (body filled) | own-comps | ensemble (pm/oc) |
|---|---|---|---|
| overall | 15.56 | 16.98 | **14.98** |
| <£2k | 24.91 | 27.27 | 24.47 |
| £2-5k | 18.36 | 20.00 | 17.86 |
| £5-10k | 13.64 | 14.55 | 12.76 |
| £10-20k | 9.81 | 11.53 | 9.20 |
| £20-40k | 10.09 | 9.27 | 9.12 |
| dealer | 10.55 | 10.80 | 9.46 |
| private | 19.69 | 21.54 | 19.44 |

AI weight: the only labelled AI cases are 32 cheap private cars (median £1,250): AI+cap 29.6%, pm 43.0%, own-comps 41.9%,
pm/oc blend 43.3%; ensemble with w_ai=0.8 30.7%, leave-one-out-chosen weight 35.5%. So w_ai = 0.8 under £5k and a neutral
0.5 prior above (no labelled data). On this thin evidence the ensemble does NOT beat AI+cap on AI-path cars (it is ~1pt worse);
its value is robustness when the AI is far off. Range: pm-1's conformal range re-centred on the ensemble, widened by the max
pairwise log disagreement d: unwidened coverage 84% (d<0.1), 83%, 80%, 78% (0.3-0.5, ×1.05), 56% (d>0.5, n=121, ×1.85);
d>0.5 sets `lessCertain`. Note: pm range table cell `40k+|private` has n=5 and q10>0 — the TS falls back only by cell lookup, so
treat 40k+ private ranges as unreliable until retrain (fix in pm-2).

**5. pm-2 (not adopted).** Adding 9 new text flags (MOT fail, advisories, clean MOT, rust, new parts, HPI clear, warning lights,
service history, smoke/leak) + owners count: 15.44 → 15.28% (3-seed avg), paired bootstrap gain 0.16pt, 90% CI [-0.20, +0.33],
P(gain>0)=0.67; worst stratum 5-10k private +0.67pt. Not a clear win, and in production `desc` is the user's notes, not advert
text, so pm-1 files are kept. **Region** from ad town: town residual spread p10/p90 -2.6%/+2.2% and adding it made the held-out
worse (15.28→15.49) — skipped; the reg area code is the first-registration office, not where the car is now. **Season**: the
harvest spans 2 days (first_seen 23-24 Oct), so no month effect is measurable — skipped.
