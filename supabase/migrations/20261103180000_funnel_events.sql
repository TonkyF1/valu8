-- Anonymous drop-off funnel. No cookies, no stored identifiers, no personal data:
-- a random per-page-load session id (memory only), the step, a coarse detail, device class and time.
create table if not exists public.funnel_events (
  id bigserial primary key,
  session_id uuid not null,
  step text not null check (step in (
    'landed','reg_typed','lookup_success','lookup_fail',
    'step_reg','step_details','step_photos','submitted','result_seen','price_alert_opt_in'
  )),
  detail text check (detail is null or detail ~ '^[a-z0-9_]{1,24}$'),
  device text not null check (device in ('mobile','tablet','desktop')),
  created_at timestamptz not null default now()
);
create index if not exists funnel_events_created_idx on public.funnel_events (created_at);
create index if not exists funnel_events_session_idx on public.funnel_events (session_id);

alter table public.funnel_events enable row level security;
revoke all on public.funnel_events from anon, authenticated;
grant insert (session_id, step, detail, device) on public.funnel_events to anon, authenticated;
grant usage on sequence public.funnel_events_id_seq to anon, authenticated;
drop policy if exists "funnel insert only" on public.funnel_events;
create policy "funnel insert only" on public.funnel_events for insert to anon, authenticated
  with check (created_at > now() - interval '1 minute');
-- No select/update/delete policies: nobody but the service role / SQL editor can read.

-- Funnel per day: distinct sessions reaching each step. Excludes QA sessions (landed with utm_source=v8qa).
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
  count(distinct e.session_id) filter (where step = 'price_alert_opt_in') as price_alert_opt_in
from public.funnel_events e
where e.session_id not in (select session_id from qa)
group by 1 order by 1 desc;
revoke all on public.funnel_daily from anon, authenticated;
