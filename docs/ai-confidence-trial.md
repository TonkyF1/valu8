# AI-assisted confidence rating (conf-ai-1) — trial

**What it does.** After every price, range and "can't price" decision is final, analyse-vehicle asks a small AI model
(`AI_CONFIDENCE_MODEL`, default `google/gemini-2.5-flash-lite`, 6 s timeout) to rate how sure we are, from the evidence
(adverts held and how closely they match, range width, source disagreement, sanity verdict, pm-1 model coverage, age,
mileage, MOT signals, import/performance flags) plus its own UK market knowledge. It returns `{level, reason}`.

**Guardrails (code, `guardConfidence`).** At most one step from the rule-based level; never High when the sanity verdict is
lessCertain/unavailable (or an ultra-rare make), fewer than 10 relevant comps (same model/family, or MarketCheck count),
an import, or 20+ years old. Invalid, failed or slow AI output keeps the rule level and reason. The reason shown always
matches the level shown (rule reason if unchanged, the AI's sentence if the AI's level is shown, a neutral sentence if the
guard clipped the AI's level). `confidenceFields` only returns marketConfidence, marketConfidenceReason, confidenceData and
confidenceAi, so prices and ranges are identical with the feature on, shadow or off (tested).

**Switch.** `AI_CONFIDENCE` secret: `off` (no call), `shadow` (call and store `confidenceAi`, show the rule level), `on` (everyone), `testers` (default: shown only to user ids in `AI_CONFIDENCE_TESTERS`, default Tony; the id comes from the JWT verified in guard(), never the body; guests always shadow).

**Backtest (23 Nov 2026).** 30 days of real valuations (24 Oct–23 Nov; excluding v8qa, qaAuditTest, unpriced and agent tests):
274 valuations, 171 distinct cars. The gateway key is not available outside the edge function, so the AI decision in the
backtest was made by the assistant following the same prompt and evidence, then passed through the real guardrails. Treat
it as a preview; run a week in `shadow` (or check `confidenceAi` on live reports) to see the deployed model's own calls.

| Rule level → final | High | Medium | Low | Very Low |
|---|---|---|---|---|
| Medium (95) | 20 | 69 | 6 | 0 |
| Low (49) | 0 | 6 | 41 | 2 |
| Very Low (27) | 0 | 0 | 3 | 24 |

Before: 0 High / 95 Medium / 49 Low / 27 Very Low. After: 20 / 75 / 50 / 26 (distinct cars).
Median source disagreement by final level: High 0.08, Medium 0.17, Low 0.29, Very Low 0.66 (partly circular: disagreement
is one of the inputs). Comp price spread: High 15%, Medium 17.5%, Low 27%, Very Low 25%.
