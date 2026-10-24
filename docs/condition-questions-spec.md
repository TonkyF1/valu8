# Condition questions — frontend spec DRAFT (not built)

Goal: capture the few facts that move price most and that photos/MOT can't show, in ≤30 seconds, optional, on the valuation form
(NewValuation.tsx, after mileage/notes). Sent to analyse-vehicle as `condition: {...}`; used first in shadow only (pmShadow / ensemble),
then in pricing once measured against sale feedback.

| # | Question | Control | Values sent | Proposed price use (shadow first) | Evidence |
|---|---|---|---|---|---|
| 1 | How many previous owners (keepers)? | stepper 1-10+ / "not sure" | `owners: number \| null` | none at first; log only (V5C keeper count; DVLA doesn't give it) | ad text: "1 owner" +20% <£2k (n=62), ~0 above; 4+ owners not significant |
| 2 | Service history? | Full / Part / None / Not sure | `serviceHistory: "full"\|"part"\|"none"\|null` | full: +6/+4/+1% (<£2k/2-5k/5k+), none: -5/-4/-3% | ad text "FSH" +14.8/+8.4/+2.3%; "service history" +8.4/+4.6/+0.5% |
| 3 | Any dashboard warning lights on? | No / Yes (engine, ABS, airbag, other) | `warningLights: string[]` | engine/airbag: -8/-5/-4%; others -3/-2/-1% | ad text "warning light/limp mode/DPF" -9.8/-2.6/-7.7% |
| 4 | Tyre condition? | Good / Some worn / Need replacing | `tyres: "good"\|"some"\|"replace"` | replace: -£(4 × typical tyre for cc), floor -6% | prior; DVSA tyre advisories cross-check |
| 5 | Accident damage or write-off? | None / Repaired damage / Cat S / Cat N / Not sure | `accident: "none"\|"repaired"\|"cat_s"\|"cat_n"\|null` | Cat S/N via existing writeOffAdj (fitted); repaired -4% | ad text "Cat S/N/write-off" -6.8/-12.2/-20.6%; damage -11% |
| 6 | Does it run and drive? | Yes / Starts but faults / Non-runner | `runs: "yes"\|"faults"\|"no"` | non-runner → existing unavailable/spares rule; faults -12% | ad text "smoke/knock/leak/misfire" -12% all bands |

Rules: every answer optional and "Not sure" = no adjustment; never combine with the same signal already seen in notes/photos
(take the stronger, don't stack); show a one-line "why" in the price breakdown; store answers in `valuations.report.condition`
for later fitting. Total condition adjustment shares the MOT-signal bounds (-15..+4% £5k+, -25..+6% £2-5k, -35..+8% <£2k).
