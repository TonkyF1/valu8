-- Share card + referral unlock (10 Nov 2026).
-- One share code per valuation. When a friend arrives with ?ref=<code> and completes their own
-- valuation, the "referral" edge function marks the share redeemed and report-entitlement then
-- treats the sharer's valuation as unlocked (same as a paid Full Report). Service role only:
-- no anon/authenticated access, so nobody can mark a share redeemed from the browser.
-- Idempotent; applied to production on 10 Nov 2026.
create table if not exists public.referral_shares (
  code text primary key check (code ~ '^[a-z0-9]{10}$'),
  valuation_id uuid not null unique references public.valuations(id) on delete cascade,
  ip_hash text,
  created_at timestamptz not null default now(),
  friend_valuation_id uuid unique references public.valuations(id) on delete set null,
  redeemed_at timestamptz
);
create index if not exists referral_shares_redeemed_idx on public.referral_shares (valuation_id) where redeemed_at is not null;
alter table public.referral_shares enable row level security;
revoke all on public.referral_shares from anon, authenticated;
grant all on public.referral_shares to service_role;

-- Funnel: share and embed steps (anonymous, same rules as the other steps).
alter table public.funnel_events drop constraint if exists funnel_events_step_check;
alter table public.funnel_events add constraint funnel_events_step_check check (step in (
  'landed','reg_typed','lookup_success','lookup_fail',
  'step_reg','step_details','step_photos','submitted','result_seen','price_alert_opt_in',
  'offer_view','offer_click','checkout_start',
  'valuation_started','valuation_completed','report_checkout','report_purchased',
  'share_click','referral_unlocked','embed_submit'
));
