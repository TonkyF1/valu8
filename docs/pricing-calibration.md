# Pricing calibration (Oct 2026)

Fitted against 6 live test cars (see `src/test/fixtures/backtest-cars.ts`); run `npx tsx scripts/backtest.ts`.
Constants are round, general-market values chosen so no single car drives them — not exact fits.

| Change | Why |
|---|---|
| Per-comp mileage correction `(car/comp miles)^-0.18`, clamped 0.70–1.15; age `0.88^Δyears` | A 180k car was priced off 60k-mile listings (ascending sort). Replaces the old ±3–10% step adjustment (no double count). |
| MarketCheck: rows 50; sort miles **desc** for above-average-mileage cars; extra ±2y/±40k-mile and ±4y tiers | Wider, mileage-relevant pool for old/cheap/high-mileage cars. |
| Private = `retail×0.93 − £750` (clamped 0.68–0.90 of retail) | MarketCheck is dealer stock. Dealer cost is part fixed (prep, warranty), so the gap widens on cheap cars. AI blend dropped (it shares the dealer bias). |
| High-mileage penalty: 0 → 35% from 140k → 200k miles | Finance/warranty dry up; buyer pool shrinks. |
| MOT-soon adjustment applied to private/trade only | Dealers re-MOT before retail. |
| AI fallback: −12% (≤5y), −3% (5–10y), 0 (>10y) | AI figures sit near dealer prices for young cars. |
| Old-car floor £1,500 (+15% Toyota/Honda/Lexus/Mazda/Suzuki at 10y+), only with valid MOT, ≤1.1× average mileage, <140k | MOT'd, average-mileage old cars rarely sell privately for less. |
| Trade = min(retail×0.74, private×0.90) | Keeps trade below private. |
| Ask range low ≥ realistic private figure | C-HR showed private £16,600 below an ask range of £16,800–£18,000. |

## Data-calibrated layer (Oct 23 2026) — `_shared/calibration.ts`

Dataset: 931 Gumtree listings (+69 prior tests) in `/workspace/dataset/listings.csv`; live baseline harness `run_valu8.mjs` (held-out first).

| Change | Evidence |
|---|---|
| Thin comps (<5): anchor shrunk toward AI-implied retail, weight n/5 (log space); 1–2 comps are mileage/year-corrected instead of using the raw median | 2006 GL-Class, 1 comp: £12,500 private vs £2,500 ask (+400%) |
| Old-car AI floor £1,500 → £1,000 (durable makes keep £1,725) | £1,500 was the *median* private ask of floor-eligible cars (n=49; p20 £995) |
| Trophy-R comps: "Trophy R.S. 300" no longer matches Trophy-R; Trophy-R uses own comps at ≥2, else plain-Trophy comps × 1.6 with confidence −1 | Sasso Trophy-R report claimed "Trophy-R listings" but comps were RS/Trophy (−44%) |
| MarketCheck 429/5xx: 4 attempts, exponential backoff; AI fallback within 2 min of a throttle → "Very Low" + "live data temporarily unavailable" | Batch run: 30/41 cars silently fell to AI after ~10 calls |
| AI age factor (12y+) | Kept at 1.0: held-out medAPE worsened with 0.8 (n=28) |
| `debugComps: true` (admin role only) returns full comps + anchor internals | — |
