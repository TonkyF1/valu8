-- Anonymous £2.99 offer funnel steps: offer_view, offer_click, checkout_start.
-- Documents a change already applied to production; safe to re-run (idempotent).
-- Still anonymous: per-page-load session id (memory only), step, coarse detail, device class, time.

alter table public.funnel_events drop constraint if exists funnel_events_step_check;
alter table public.funnel_events add constraint funnel_events_step_check check (step in (
  'landed','reg_typed','lookup_success','lookup_fail',
  'step_reg','step_details','step_photos','submitted','result_seen','price_alert_opt_in',
  'offer_view','offer_click','checkout_start'
));

-- Funnel per day: distinct sessions reaching each step. Excludes QA sessions (landed with utm_source=v8qa).
-- New columns are appended at the end so create or replace view is valid.
create or replace view public.funnel_daily with (security_invoker = true) as
with qa as (select distinct session_id from public.funnel_events where step = 'landed' and detail = 'qa')
select (e.created_at at time zone 'Europe/London')::date as day,
  count(distinct e.session_id) filter (where step = 'landed')         as landed,
  count(distinct e.session_id) filter (where step = 'reg_typed')      as reg_typed,
  count(distinct e.session_id) filter (where step = 'lookup_success') as lookup_success,
  count(distinct e.session_id) filter (where step = 'lookup_fail')    as lookup_fail,
  count(distinct e.session_id) filter (where step = 'step_details')   as step_details,
  count(distinct e.session_id) filter (where step = 'step_photos')    as step_photos,
  count(distinct e.session_id) filter (where step = 'submitted')      as submitted,
  count(distinct e.session_id) filter (where step = 'result_seen')    as result_seen,
  count(distinct e.session_id) filter (where step = 'price_alert_opt_in') as price_alert_opt_in,
  count(distinct e.session_id) filter (where step = 'offer_view')     as offer_view,
  count(distinct e.session_id) filter (where step = 'offer_click')    as offer_click,
  count(distinct e.session_id) filter (where step = 'checkout_start') as checkout_start
from public.funnel_events e
where e.session_id not in (select session_id from qa)
group by 1 order by 1 desc;
revoke all on public.funnel_daily from anon, authenticated;
