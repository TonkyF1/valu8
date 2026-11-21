-- Anonymous, cookieless first-party usage analytics (PECR/UK GDPR friendly: nothing stored on the device,
-- no cookies/localStorage/sessionStorage for analytics, no IP address, no user agent string, no fingerprinting,
-- no session replay, no personal data). Purely additive: a new table, views and grants; nothing existing changes.
--  * session_id: random UUID created per page load and held in the tab's memory only.
--  * path: route only (no query string, no ids); referrer_domain: hostname only; utm_*: campaign tags from the URL.
--  * device / browser / viewport: coarse buckets only.
--  * props: small jsonb of non-personal facts (never a registration plate, email or free text).
create table if not exists public.site_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  session_id uuid not null,
  event text not null check (event ~ '^[a-z0-9_]{1,40}$'),
  path text check (path is null or length(path) <= 120),
  referrer_domain text check (referrer_domain is null or length(referrer_domain) <= 80),
  utm_source text check (utm_source is null or utm_source ~ '^[a-z0-9_.+-]{1,64}$'),
  utm_medium text check (utm_medium is null or utm_medium ~ '^[a-z0-9_.+-]{1,64}$'),
  utm_campaign text check (utm_campaign is null or utm_campaign ~ '^[a-z0-9_.+-]{1,64}$'),
  device text check (device is null or device in ('mobile','tablet','desktop')),
  browser text check (browser is null or browser in ('chrome','safari','firefox','edge','samsung','other')),
  viewport text check (viewport is null or viewport in ('xs','sm','md','lg','xl')),
  props jsonb not null default '{}'::jsonb check (jsonb_typeof(props) = 'object' and length(props::text) <= 1500)
);
create index if not exists site_events_created_idx on public.site_events (created_at);
create index if not exists site_events_session_idx on public.site_events (session_id, created_at);
create index if not exists site_events_event_idx on public.site_events (event, created_at);

alter table public.site_events enable row level security;
revoke all on public.site_events from anon, authenticated;
grant insert (session_id, event, path, referrer_domain, utm_source, utm_medium, utm_campaign, device, browser, viewport, props)
  on public.site_events to anon, authenticated;
grant usage on sequence public.site_events_id_seq to anon, authenticated;
drop policy if exists "site_events insert only" on public.site_events;
create policy "site_events insert only" on public.site_events for insert to anon, authenticated with check (true);
-- No select/update/delete policies: only the service role / SQL editor can read.

-- Helper: sessions to exclude (QA runs tagged utm_source=v8qa).
create or replace view public.site_sessions with (security_invoker = true) as
select session_id,
  min(created_at) as first_seen,
  max(created_at) as last_seen,
  (array_agg(device order by created_at) filter (where device is not null))[1] as device,
  (array_agg(referrer_domain order by created_at) filter (where referrer_domain is not null))[1] as referrer_domain,
  (array_agg(utm_source order by created_at) filter (where utm_source is not null))[1] as utm_source,
  coalesce((array_agg(utm_source order by created_at) filter (where utm_source is not null))[1],
           (array_agg(referrer_domain order by created_at) filter (where referrer_domain is not null))[1], 'direct') as source,
  count(*) filter (where event = 'page_view') as page_views,
  bool_or(event in ('valuation_started','reg_typed')) as did_start,
  bool_or(event = 'valuation_completed') as did_valuation,
  bool_or(event = 'offer_click') as did_cta,
  bool_or(event = 'checkout_start') as did_checkout,
  bool_or(event = 'purchase_completed') as did_paid
from public.site_events
group by session_id
having coalesce(bool_or(utm_source = 'v8qa'), false) = false;
revoke all on public.site_sessions from anon, authenticated;

-- Funnel per day (Europe/London): distinct visits reaching each stage.
create or replace view public.site_funnel_daily with (security_invoker = true) as
select (first_seen at time zone 'Europe/London')::date as day,
  count(*) as visits,
  count(*) filter (where did_start) as started_valuation,
  count(*) filter (where did_valuation) as got_valuation,
  count(*) filter (where did_cta) as clicked_premium,
  count(*) filter (where did_checkout) as opened_checkout,
  count(*) filter (where did_paid) as paid
from public.site_sessions group by 1 order by 1 desc;
revoke all on public.site_funnel_daily from anon, authenticated;

-- Same funnel per hour.
create or replace view public.site_funnel_hourly with (security_invoker = true) as
select date_trunc('hour', first_seen at time zone 'Europe/London') as hour,
  count(*) as visits,
  count(*) filter (where did_start) as started_valuation,
  count(*) filter (where did_valuation) as got_valuation,
  count(*) filter (where did_cta) as clicked_premium,
  count(*) filter (where did_checkout) as opened_checkout,
  count(*) filter (where did_paid) as paid
from public.site_sessions group by 1 order by 1 desc;
revoke all on public.site_funnel_hourly from anon, authenticated;

-- Funnel by traffic source and device (last 30 days).
create or replace view public.site_funnel_by_source with (security_invoker = true) as
select source, device,
  count(*) as visits,
  count(*) filter (where did_start) as started_valuation,
  count(*) filter (where did_valuation) as got_valuation,
  count(*) filter (where did_cta) as clicked_premium,
  count(*) filter (where did_checkout) as opened_checkout,
  count(*) filter (where did_paid) as paid
from public.site_sessions where first_seen > now() - interval '30 days'
group by 1, 2 order by visits desc;
revoke all on public.site_funnel_by_source from anon, authenticated;

-- Top drop-off points: each stage with its visits (last 30 days) and the share lost since the previous stage.
create or replace view public.site_dropoff with (security_invoker = true) as
with s as (select * from public.site_sessions where first_seen > now() - interval '30 days'),
stages(ord, stage, n) as (
  select 1, 'visit', count(*) from s union all
  select 2, 'started_valuation', count(*) filter (where did_start) from s union all
  select 3, 'got_valuation', count(*) filter (where did_valuation) from s union all
  select 4, 'clicked_premium', count(*) filter (where did_cta) from s union all
  select 5, 'opened_checkout', count(*) filter (where did_checkout) from s union all
  select 6, 'paid', count(*) filter (where did_paid) from s)
select ord, stage, n as visits,
  round(100.0 * n / nullif(first_value(n) over (order by ord), 0), 1) as pct_of_visits,
  lag(n) over (order by ord) - n as lost_since_previous,
  round(100.0 * (lag(n) over (order by ord) - n) / nullif(lag(n) over (order by ord), 0), 1) as pct_lost_since_previous
from stages order by ord;
revoke all on public.site_dropoff from anon, authenticated;

-- Where visits stop: the last page seen per visit (last 30 days).
create or replace view public.site_exit_pages with (security_invoker = true) as
select path, count(*) as exits from (
  select distinct on (session_id) session_id, path from public.site_events
  where event = 'page_view' and created_at > now() - interval '30 days'
  order by session_id, created_at desc) x
group by path order by exits desc;
revoke all on public.site_exit_pages from anon, authenticated;

-- Page engagement: views, visits, average time on page and deepest scroll (last 30 days).
create or replace view public.site_page_engagement with (security_invoker = true) as
with pv as (select path, session_id, count(*) as views from public.site_events
            where event = 'page_view' and created_at > now() - interval '30 days' group by 1, 2),
t as (select path, session_id, props->>'pv' as pv, max((props->>'seconds')::int) as seconds
      from public.site_events where event = 'page_time' and created_at > now() - interval '30 days' group by 1, 2, 3),
sc as (select path, session_id, props->>'pv' as pv, max((props->>'pct')::int) as pct
       from public.site_events where event = 'scroll_depth' and created_at > now() - interval '30 days' group by 1, 2, 3)
select pv.path, sum(pv.views) as page_views, count(distinct pv.session_id) as visits,
  round((select avg(seconds) from t where t.path = pv.path), 0) as avg_seconds,
  round((select avg(pct) from sc where sc.path = pv.path), 0) as avg_max_scroll_pct
from pv group by pv.path order by page_views desc;
revoke all on public.site_page_engagement from anon, authenticated;

-- Event counts per day, for quick "what happened" questions.
create or replace view public.site_event_counts with (security_invoker = true) as
select (created_at at time zone 'Europe/London')::date as day, event,
  count(*) as events, count(distinct session_id) as visits
from public.site_events group by 1, 2 order by 1 desc, 3 desc;
revoke all on public.site_event_counts from anon, authenticated;
