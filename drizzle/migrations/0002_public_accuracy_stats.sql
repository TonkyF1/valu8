-- OPTIONAL (needs a Lovable/Supabase deploy; NOT applied automatically).
-- Lets the public /accuracy page show aggregated predicted-vs-sold stats across ALL users
-- without exposing any individual valuation. Until this exists, /accuracy shows the
-- honest "collecting results" state (plus the signed-in user's own results).
create or replace function public.public_accuracy_stats()
returns table (count integer, median_abs_pct numeric, within_10_pct integer, mean_signed_pct numeric)
language sql stable security definer set search_path = public as $$
  with d as (
    select ((report->'saleFeedback'->>'salePrice')::numeric
            - coalesce((report->'saleFeedback'->>'estimateAtTime')::numeric, private_value))
           / nullif(coalesce((report->'saleFeedback'->>'estimateAtTime')::numeric, private_value), 0) * 100 as pct
    from valuations
    where report ? 'saleFeedback'
  )
  select count(*)::int,
         round(percentile_cont(0.5) within group (order by abs(pct))::numeric, 1),
         round(100.0 * count(*) filter (where abs(pct) <= 10) / nullif(count(*), 0))::int,
         round(avg(pct)::numeric, 1)
  from d where pct is not null;
$$;
grant execute on function public.public_accuracy_stats() to anon, authenticated;
