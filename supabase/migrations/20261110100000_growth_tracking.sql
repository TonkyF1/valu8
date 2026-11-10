-- Growth tracking (10 Nov 2026): four outcome steps and campaign tags.
-- Still anonymous: no cookies, no personal data. UTMs are campaign labels from the landing URL.
-- Idempotent; applied to production on 10 Nov 2026.

-- 1. New funnel steps.
alter table public.funnel_events drop constraint if exists funnel_events_step_check;
alter table public.funnel_events add constraint funnel_events_step_check check (step in (
  'landed','reg_typed','lookup_success','lookup_fail',
  'step_reg','step_details','step_photos','submitted','result_seen','price_alert_opt_in',
  'offer_view','offer_click','checkout_start',
  'valuation_started','valuation_completed','report_checkout','report_purchased'
));

-- 2. Campaign tags on funnel events (sent with the landed step) and on valuations.
alter table public.funnel_events
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text;
alter table public.valuations
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text;

do $$
declare t text; c text;
begin
  foreach t in array array['funnel_events','valuations'] loop
    foreach c in array array['utm_source','utm_medium','utm_campaign'] loop
      execute format('alter table public.%I drop constraint if exists %I', t, t || '_' || c || '_check');
      execute format('alter table public.%I add constraint %I check (%I is null or %I ~ ''^[a-z0-9_.+-]{1,64}$'')', t, t || '_' || c || '_check', c, c);
    end loop;
  end loop;
end $$;

grant insert (session_id, step, detail, device, utm_source, utm_medium, utm_campaign) on public.funnel_events to anon, authenticated;
create index if not exists valuations_utm_campaign_idx on public.valuations (utm_campaign) where utm_campaign is not null;

-- 3. Daily funnel view: new columns appended at the end so create or replace is valid.
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
  count(distinct e.session_id) filter (where step = 'checkout_start') as checkout_start,
  count(distinct e.session_id) filter (where step = 'valuation_started')   as valuation_started,
  count(distinct e.session_id) filter (where step = 'valuation_completed') as valuation_completed,
  count(distinct e.session_id) filter (where step = 'report_checkout')     as report_checkout,
  count(distinct e.session_id) filter (where step = 'report_purchased')    as report_purchased
from public.funnel_events e
where e.session_id not in (select session_id from qa)
group by 1 order by 1 desc;
revoke all on public.funnel_daily from anon, authenticated;
