CREATE OR REPLACE FUNCTION public.readiness_stats(p_engine text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r json;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  WITH scored AS (
    SELECT *, (estimate - outcome_price)/outcome_price AS signed_err,
           abs(estimate - outcome_price)/outcome_price AS abs_err,
           (estimate BETWEEN 5000 AND 20000) AS in_band,
           CASE WHEN estimate IS NULL OR estimate <= 0 THEN 'no_estimate'
                WHEN outcome_price < 300 THEN 'too_low'
                WHEN outcome_price > 5*estimate OR outcome_price < 0.2*estimate THEN 'implausible'
                WHEN outcome_at < estimated_at + interval '1 day' THEN 'too_soon' END AS reject_reason
    FROM public.readiness_outcomes
    WHERE p_engine IS NULL OR engine_version = p_engine
  ),
  ok AS (SELECT * FROM scored WHERE reject_reason IS NULL AND in_band),
  good AS (SELECT * FROM scored WHERE reject_reason IS NULL)
  SELECT json_build_object(
    'n_in_band',          (SELECT count(*) FROM ok),
    'median_abs_pct',     (SELECT round((100 * percentile_cont(0.5) WITHIN GROUP (ORDER BY abs_err))::numeric, 1) FROM ok),
    'median_signed_pct',  (SELECT round((100 * percentile_cont(0.5) WITHIN GROUP (ORDER BY signed_err))::numeric, 1) FROM ok),
    'within_10_pct',      (SELECT round(100.0 * count(*) FILTER (WHERE abs_err <= 0.10) / nullif(count(*),0), 1) FROM ok),
    'miss_30_pct',        (SELECT round(100.0 * count(*) FILTER (WHERE abs_err > 0.30) / nullif(count(*),0), 1) FROM ok),
    'recent_90d_share',   (SELECT round(100.0 * count(*) FILTER (WHERE outcome_at > now() - interval '90 days') / nullif(count(*),0), 1) FROM ok),
    'rejected',           (SELECT json_object_agg(reject_reason, c) FROM (SELECT reject_reason, count(*) c FROM scored WHERE reject_reason IS NOT NULL GROUP BY 1) x),
    'all_bands_n',        (SELECT count(*) FROM good),
    'breakdown', (SELECT coalesce(json_agg(b), '[]'::json) FROM (
       SELECT
         CASE WHEN estimate < 5000 THEN '<£5k' WHEN estimate < 10000 THEN '£5–10k'
              WHEN estimate < 15000 THEN '£10–15k' WHEN estimate <= 20000 THEN '£15–20k' ELSE '>£20k' END AS band,
         side, pricing_source, engine_version, confidence,
         count(*) n,
         round((100 * percentile_cont(0.5) WITHIN GROUP (ORDER BY abs_err))::numeric, 1) median_abs_pct,
         round(100.0 * count(*) FILTER (WHERE abs_err <= 0.10) / count(*), 1) within_10_pct,
         round(100.0 * count(*) FILTER (WHERE abs_err > 0.30) / count(*), 1) miss_30_pct
       FROM good
       GROUP BY GROUPING SETS ((1), (side), (pricing_source), (engine_version), (confidence))) b),
    'weekly', (SELECT coalesce(json_agg(w ORDER BY w.wk), '[]'::json) FROM (
       SELECT date_trunc('week', outcome_at)::date wk,
              count(*) FILTER (WHERE in_band) n_week,
              sum(count(*) FILTER (WHERE in_band)) OVER (ORDER BY date_trunc('week', outcome_at)::date) n_cumulative
       FROM good GROUP BY 1) w),
    'funnel', (SELECT json_agg(f) FROM (
       SELECT 'advert' kind,
         count(*) checks,
         count(*) FILTER (WHERE c.followup_sent_at IS NOT NULL) asked,
         count(*) FILTER (WHERE c.followup_answered_at IS NOT NULL) answered,
         count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.check_outcomes o
            WHERE o.kind = 'advert' AND o.item_id = c.id AND o.source = 'user' AND o.outcome_price > 0)) usable
       FROM public.advert_checks c
       UNION ALL
       SELECT 'valuation',
         count(*),
         count(*) FILTER (WHERE v.report ? 'followupSentAt'),
         count(*) FILTER (WHERE v.report ? 'saleFeedback' OR v.report ? 'followupDeclined'),
         count(*) FILTER (WHERE (v.report->'saleFeedback'->>'salePrice')::numeric > 0)
       FROM public.valuations v) f)
  ) INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.readiness_stats(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.readiness_stats(text) TO authenticated;