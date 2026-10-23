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
