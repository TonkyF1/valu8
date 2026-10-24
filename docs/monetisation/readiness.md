# Accuracy readiness dashboard — "ready to charge?" (spec)

Purpose: one admin-only panel that answers a single question — **have we earned the right to charge?**
It must be impossible to pass by accident: only real, user-reported outcomes count, and the numbers
shown here are the same ones we'd be happy to publish on `/accuracy`.

## Go / no-go gate (all must be true)
| # | Check | Threshold |
|---|---|---|
| G1 | Real outcomes in band | **≥ 200** known outcomes where the estimate at the time was **£5,000–£20,000** |
| G2 | Median absolute error (in band) | **≤ 12%** |
| G3 | Big misses (in band) | **< 5%** of outcomes with absolute error **> 30%** |
| G4 | Freshness | ≥ 50% of G1 outcomes recorded in the last 90 days (so we're grading today's engine, not an old one) |
| G5 | Not one-sided | Median *signed* error between −6% and +6% (we're not systematically high or low) |
| G6 | Current engine | G1–G3 also pass when restricted to the live `engineVersion` (currently `v2.2-ledger`), or ≥100 outcomes on it |

G1–G3 are the agreed gate. G4–G6 are guard-rails (recommended; Tony can waive). Display each as
green / amber (within 10% of threshold) / red, plus a single **READY / NOT READY** banner.

### Definitions
- **Outcome** = a price a real person tells us a car actually changed hands for:
  - Seller side: "Sold it?" → `valuations.report.saleFeedback` → copied by trigger into `public.sale_feedback`.
  - Buyer side (after Prompt A): "Did you buy it? What did you pay?" on an advert check / valuation → `public.check_outcomes` with `source = 'user'`.
- **Estimate** = the figure we showed at the time, matched to the sale type:
  - sold/bought **private** (or unknown) → private-sale estimate (`estimate_at_time`, else `valuations.private_value`);
  - sold **to a dealer / part-ex** → `report.values.dealerTradeIn`;
  - bought **from a dealer** → dealer retail estimate (`report.values.dealerRetail` or the advert check's dealer mid).
- **Absolute error** = `|estimate − outcome| / outcome`. (Denominator is the real price. Note `public_accuracy_stats()` divides by the estimate; the readiness panel should use the real price, and `/accuracy` should be aligned before launch.)
- **Signed error** = `(estimate − outcome) / outcome` (positive = we were too high).
- **In band** = estimate between £5,000 and £20,000 inclusive.
- **Excluded**: admins/test accounts (`user_roles.role = 'admin'`), outcomes recorded < 1 day after the valuation (likely testing), outcome price < £300 or > 5× / < 0.2× the estimate (typos — counted separately as "rejected" so nothing is hidden), duplicates (one outcome per valuation/check).
- **Not counted toward the gate**: re-check signals (advert withdrawn, last seen asking price). Shown as a secondary "market signal" panel only — an asking price is not a sale price.

## Panel layout (Admin → "Readiness")
1. Banner: READY / NOT READY + which gates fail.
2. Gate tiles G1–G6: value, threshold, colour.
3. Progress: outcomes in band over time (weekly, cumulative) with a line at 200.
4. Error distribution: histogram of signed error buckets (−30%+, −30..−20, … , +30%+).
5. Breakdown table: by price band (<£5k, £5–10k, £10–15k, £15–20k, >£20k), by source (seller / buyer), by `pricingSource` (marketcheck / own_comps / ai_estimate), by `engineVersion`, by confidence (`marketConfidence`): n, median abs error, % within 10%, % > 30%.
6. Worst 20 misses (admin only): make/model/year/mileage, estimate, outcome, error, engine version — **no reg, no user id, no email**.
7. Funnel (from Prompt A logging): checks made → follow-up asked → answered → usable outcome. Shows whether we need better prompts or just more volume.
8. Secondary: re-check market signals (advert checks only, allowed domains only).

## SQL

All functions `SECURITY DEFINER`, `search_path = public`, raise `forbidden` unless `has_role(auth.uid(),'admin')`, `GRANT EXECUTE ... TO authenticated` (same pattern as `admin_stats()` in `20261023000000_launch_readiness.sql`).

### Existing tables used
- `public.valuations` (id, user_id NULLABLE for guests via `guest_token_hash`, make, model, year, mileage, private_value, report JSONB, created_at). `report` keys used: `saleFeedback{salePrice,soldOn,soldTo,recordedAt,estimateAtTime}`, `values{dealerTradeIn,privateSale,dealerRetail}`, `valueRange`, `pricingSource`, `marketConfidence`, `engineVersion`.
- `public.sale_feedback` (valuation_id, make, model, variant, year, mileage, sale_price, sold_to, sold_on, estimate_at_time, recorded_at) — trigger-synced.
- `public.user_roles` (user_id, role).
- After Prompt A: `public.advert_checks`, `public.check_outcomes` (schema in `prompt-a-outcome-tracking.md`).

### 1. Unified outcomes view (works today on seller outcomes; buyer outcomes join in after Prompt A)
```sql
create or replace view public.readiness_outcomes as
with seller as (
  select
    'seller'::text                                   as side,
    sf.valuation_id                                  as item_id,
    v.created_at                                     as estimated_at,
    sf.recorded_at                                   as outcome_at,
    sf.sale_price::numeric                           as outcome_price,
    coalesce(sf.sold_to, 'private')                  as sale_type,
    case when sf.sold_to in ('dealer','part_ex')
         then nullif((v.report->'values'->>'dealerTradeIn')::numeric, 0)
         else coalesce(sf.estimate_at_time, v.private_value)::numeric end as estimate,
    v.report->>'engineVersion'                       as engine_version,
    v.report->>'pricingSource'                       as pricing_source,
    v.report->>'marketConfidence'                    as confidence,
    v.make, v.model, v.year, v.mileage
  from public.sale_feedback sf
  join public.valuations v on v.id = sf.valuation_id
  where v.user_id is null
     or not exists (select 1 from public.user_roles r where r.user_id = v.user_id and r.role = 'admin')
)
select * from seller
-- After Prompt A, add:
-- union all
-- select 'buyer', o.item_id, c.created_at, o.recorded_at, o.outcome_price, coalesce(c.seller_type,'unknown'),
--        case when c.seller_type = 'dealer' then c.estimate_dealer_mid else c.estimate_private end,
--        c.engine_version, c.pricing_source, c.confidence, c.make, c.model, c.year, c.mileage
-- from public.check_outcomes o join public.advert_checks c on c.id = o.item_id
-- where o.kind = 'advert' and o.source = 'user' and o.outcome_type = 'bought' and o.outcome_price > 0
--   and (c.user_id is null or not exists (select 1 from public.user_roles r where r.user_id = c.user_id and r.role = 'admin'))
;
revoke all on public.readiness_outcomes from anon, authenticated;
```
(Views run with owner rights; keep it unreadable by clients and expose only via the admin RPC below.)

### 2. Cleaned + scored rows
```sql
-- used inside the RPC as a CTE
scored as (
  select *,
    (estimate - outcome_price) / outcome_price               as signed_err,
    abs(estimate - outcome_price) / outcome_price            as abs_err,
    (estimate between 5000 and 20000)                        as in_band,
    case
      when estimate is null or estimate <= 0                 then 'no_estimate'
      when outcome_price < 300                               then 'too_low'
      when outcome_price > 5 * estimate
        or outcome_price < 0.2 * estimate                    then 'implausible'
      when outcome_at < estimated_at + interval '1 day'      then 'too_soon'
      else null end                                          as reject_reason
  from public.readiness_outcomes
)
```

### 3. Gate RPC
```sql
create or replace function public.readiness_stats(p_engine text default null)
returns json language plpgsql stable security definer set search_path = public as $$
declare r json;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  with scored as ( /* CTE from §2 */
    select *, (estimate - outcome_price)/outcome_price as signed_err,
           abs(estimate - outcome_price)/outcome_price as abs_err,
           (estimate between 5000 and 20000) as in_band,
           case when estimate is null or estimate <= 0 then 'no_estimate'
                when outcome_price < 300 then 'too_low'
                when outcome_price > 5*estimate or outcome_price < 0.2*estimate then 'implausible'
                when outcome_at < estimated_at + interval '1 day' then 'too_soon' end as reject_reason
    from public.readiness_outcomes
    where p_engine is null or engine_version = p_engine
  ),
  ok as (select * from scored where reject_reason is null and in_band)
  select json_build_object(
    'n_in_band',          (select count(*) from ok),
    'median_abs_pct',     (select round((100 * percentile_cont(0.5) within group (order by abs_err))::numeric, 1) from ok),
    'median_signed_pct',  (select round((100 * percentile_cont(0.5) within group (order by signed_err))::numeric, 1) from ok),
    'within_10_pct',      (select round(100.0 * count(*) filter (where abs_err <= 0.10) / nullif(count(*),0), 1) from ok),
    'miss_30_pct',        (select round(100.0 * count(*) filter (where abs_err > 0.30) / nullif(count(*),0), 1) from ok),
    'recent_90d_share',   (select round(100.0 * count(*) filter (where outcome_at > now() - interval '90 days') / nullif(count(*),0), 1) from ok),
    'rejected',           (select json_object_agg(reject_reason, c) from (select reject_reason, count(*) c from scored where reject_reason is not null group by 1) x),
    'all_bands_n',        (select count(*) from scored where reject_reason is null)
  ) into r;
  return r;
end $$;
revoke all on function public.readiness_stats(text) from public, anon;
grant execute on function public.readiness_stats(text) to authenticated;
```
Frontend computes the gate: `ready = n_in_band >= 200 && median_abs_pct <= 12 && miss_30_pct < 5` (+ G4–G6 guard-rails). Call twice: `readiness_stats()` and `readiness_stats('v2.2-ledger')` for G6.

### 4. Breakdown (same CTE, grouped)
```sql
select
  case when estimate < 5000 then '<£5k' when estimate < 10000 then '£5–10k'
       when estimate < 15000 then '£10–15k' when estimate <= 20000 then '£15–20k' else '>£20k' end as band,
  side, pricing_source, engine_version, confidence,
  count(*) n,
  round((100 * percentile_cont(0.5) within group (order by abs_err))::numeric, 1) median_abs_pct,
  round(100.0 * count(*) filter (where abs_err <= 0.10) / count(*), 1) within_10_pct,
  round(100.0 * count(*) filter (where abs_err > 0.30) / count(*), 1) miss_30_pct
from scored where reject_reason is null
group by grouping sets ((band), (side), (pricing_source), (engine_version), (confidence));
```

### 5. Weekly progress
```sql
select date_trunc('week', outcome_at)::date wk,
       count(*) filter (where in_band) n_week,
       sum(count(*) filter (where in_band)) over (order by date_trunc('week', outcome_at)) n_cumulative
from scored where reject_reason is null group by 1 order by 1;
```

### 6. Follow-up funnel (after Prompt A)
```sql
select 'advert' kind,
  count(*)                                                  as checks,
  count(*) filter (where c.followup_sent_at is not null)    as asked,
  count(*) filter (where c.followup_answered_at is not null) as answered,
  count(*) filter (where exists (select 1 from public.check_outcomes o
     where o.kind = 'advert' and o.item_id = c.id and o.source = 'user' and o.outcome_price > 0)) as usable
from public.advert_checks c
union all
select 'valuation',
  count(*),
  count(*) filter (where v.report ? 'followupSentAt'),
  count(*) filter (where v.report ? 'saleFeedback' or v.report ? 'followupDeclined'),
  count(*) filter (where (v.report->'saleFeedback'->>'salePrice')::numeric > 0)
from public.valuations v;
```

## Honesty rules
- Never show the gate as passed on fewer than 200 in-band outcomes, even if the error looks great.
- Rejected rows are counted and shown, never silently dropped.
- Whatever median/miss rate the gate uses is what `/accuracy` publishes (once there are ≥ 30 results), including when it's bad.
- No personal data on the panel: no reg, no names, no emails, no locations.
