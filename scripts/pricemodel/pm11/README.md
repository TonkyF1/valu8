# pm-1.1 retrain attempt — 2026-10-27 (NOT promoted; pm-1 stays live)

**Data.** New since the pm-1 snapshot (2026-10-24, 24,901 raw harvest rows): 5,586 raw rows from the Gumtree collector (first_seen 24–26 Oct).
These were cleaned with the same pipeline (`scripts/owncomps/build_listings.py` + `clean.py` run on the snapshot rows plus the new rows), leaving 5,337 rows.
The training-pool filter brought that to 5,325. `dedupe.py` then dropped 81 rows that duplicate held-out adverts (same make|model|year with mileage
within 100 mi, or the same first 80 characters of advert text) and 26 relists of old train rows (same make|model|year, mileage within 10 mi, price within 20%).
**5,218 new usable rows** remain (3,298 dealer, 1,920 private). Wider mileage windows were tested: the match count grew linearly with the window, so most wider matches were random collisions.

**Splits.** A = the original held-out set (4,784 ids, `scripts/owncomps/strat_test_ids.json`, f675ad6). It is never used for training.
B = fresh holdout: the newest 20% (by Gumtree id) of the new rows in each band|seller stratum (1,047 rows). pm-1.1 trained on 19,097 old + 4,171 new = 23,268 rows.
Body fill on both splits uses the train-only make|model mode.

| median abs % err | A pm-1 | A pm-1.1 | A pm-1+oc | A pm-1.1+oc | B pm-1 | B pm-1.1 |
|---|---|---|---|---|---|---|
| overall | 15.56 | 15.98 | 14.98 | 15.42 | 13.30 | 12.05 |
| <2k | 24.91 | 24.97 | 24.47 | 25.39 | 26.12 | 23.20 |
| 2-5k | 18.36 | 18.09 | 17.86 | 17.95 | 17.33 | 15.78 |
| 5-10k | 13.64 | 13.89 | 12.76 | 12.98 | 11.94 | 9.88 |
| 10-20k | 9.81 | 10.39 | 9.20 | 9.74 | 11.52 | 10.53 |
| 20-40k | 10.09 | 10.84 | 9.12 | 9.61 | 19.70 (n=19) | 20.52 |
| 40k+ | 19.99 | 17.06 | 19.59 | 17.93 | 20.98 (n=10) | 23.94 |
| dealer | 10.55 | 10.92 | 9.46 | 9.68 | 11.18 | 9.56 |
| private | 19.69 | 20.19 | 19.44 | 19.79 | 18.71 | 18.17 |

**Gate:** pm-1.1 must beat pm-1 overall on A and lose no stratum by more than 1 pt. It **fails**: overall is +0.42 pts on A (worst stratum is 20-40k, +0.75).
Seeds 2 and 3 show the same result (A 16.15 / 16.23 vs pm-1 15.66 / 15.87). Down-weighting new rows to 0.5 does not help (A 16.00).
`diag.py` points to distribution shift as the likely cause. The new rows are 63% dealer (36% in the old train) and 44% are in the 5-10k band.
pm-1 also over-predicts them by about 4% (median signed log error -0.043 on B, against -0.001 on A). Adding them pulls the model away from the original population.
pm-1.1 is clearly better on the new population (B -1.25 pts).
Next step: re-split A+B jointly once the harvest is less skewed, or add a harvest-batch / listing-age feature.

**Range fix (thin cells).** `train11.py qtable()`: cells with n<30 are shrunk to the band quantiles (the band itself shrunk to global, K=30), with lo <= -3% and hi >= +3%.
This fixes pm-1's `40k+|private` cell (5 cars, q10 = +0.3%, so the lower bound sat above the price): shrunk to [-0.2634, +0.3461].
Coverage (nominal 80%): A 80.7% / B 81.2% shrunk, against 80.7% / 81.1% unshrunk. `40k+|private` on B goes from 33% to 67% (n=3). pm-1.1's own table gives A 79.7%, B 83.3%.
pm-1 was not promoted, so priceModelData.ts is unchanged. The proposed one-cell change to the live pm-1 range (trees untouched) is
`"40k+|private":[0.0033,0.3476,5]` -> `"40k+|private":[-0.2634,0.3461,5]`.

Reproduce: see the env list in the train11.py docstring (OLD_CLEAN = pm-1 clean.json, RAW = snapshot + new raw rows, NEW_POOL from dedupe.py).
The pm-1.1 export (24,315 rows, 1.09 MB) was produced and passes the parity test in a scratch copy, but it was not committed.
