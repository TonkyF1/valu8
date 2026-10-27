ALTER TABLE public.check_outcomes DROP CONSTRAINT check_outcomes_outcome_type_check;
ALTER TABLE public.check_outcomes ADD CONSTRAINT check_outcomes_outcome_type_check CHECK (outcome_type IN ('bought','not_bought','still_looking','sold','not_selling','withdrawn','price_changed','seller'));
ALTER TABLE public.check_outcomes ADD CONSTRAINT check_outcomes_seller_channel_check CHECK (outcome_type <> 'seller' OR seller_type IN ('private','part_ex','dealer','not_sold'));

ALTER POLICY "Users update own outcomes" ON public.check_outcomes WITH CHECK (source = 'user' AND (
  (kind = 'advert' AND EXISTS (SELECT 1 FROM public.advert_checks c WHERE c.id = item_id AND c.user_id = auth.uid()))
  OR (kind = 'valuation' AND EXISTS (SELECT 1 FROM public.valuations v WHERE v.id = item_id AND v.user_id = auth.uid()))));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS marketing_opt_in_at timestamptz;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE opt boolean := coalesce((NEW.raw_user_meta_data->>'marketing_opt_in') = 'true', false);
BEGIN
  INSERT INTO public.profiles (user_id, marketing_opt_in, marketing_opt_in_at)
  VALUES (NEW.id, opt, CASE WHEN opt THEN now() END)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TABLE public.guest_marketing_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (length(email) <= 254 AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  marketing_opt_in boolean NOT NULL DEFAULT true,
  consented_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.guest_marketing_consents TO anon, authenticated;
GRANT ALL ON public.guest_marketing_consents TO service_role;
ALTER TABLE public.guest_marketing_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can record their own consent" ON public.guest_marketing_consents FOR INSERT TO anon, authenticated WITH CHECK (marketing_opt_in = true);
CREATE POLICY "Admins read guest consents" ON public.guest_marketing_consents FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.email_followups (
  kind text NOT NULL CHECK (kind IN ('advert','valuation')),
  item_id uuid NOT NULL,
  user_id uuid NOT NULL,
  sent_count int NOT NULL DEFAULT 0,
  last_sent_at timestamptz,
  next_at timestamptz,
  PRIMARY KEY (kind, item_id)
);
GRANT ALL ON public.email_followups TO service_role;
ALTER TABLE public.email_followups ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE VIEW public.readiness_outcomes AS
WITH seller AS (
  SELECT
    'seller'::text AS side,
    sf.valuation_id AS item_id,
    v.created_at AS estimated_at,
    sf.recorded_at AS outcome_at,
    sf.sale_price::numeric AS outcome_price,
    coalesce(sf.sold_to, 'private') AS sale_type,
    CASE WHEN sf.sold_to IN ('dealer','part_ex')
         THEN nullif((v.report->'values'->>'dealerTradeIn')::numeric, 0)
         ELSE coalesce(sf.estimate_at_time, v.private_value)::numeric END AS estimate,
    v.report->>'engineVersion' AS engine_version,
    v.report->>'pricingSource' AS pricing_source,
    v.report->>'marketConfidence' AS confidence,
    v.make, v.model, v.year, v.mileage
  FROM public.sale_feedback sf
  JOIN public.valuations v ON v.id = sf.valuation_id
  WHERE v.user_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v.user_id AND r.role = 'admin')
)
SELECT * FROM seller
UNION ALL
SELECT 'buyer'::text, o.item_id, c.created_at, o.recorded_at, o.outcome_price::numeric, coalesce(c.seller_type,'unknown'),
       (CASE WHEN c.seller_type = 'dealer' THEN c.estimate_dealer_mid ELSE c.estimate_private END)::numeric,
       c.engine_version, c.pricing_source, c.confidence, c.make, c.model, c.year, c.mileage
FROM public.check_outcomes o JOIN public.advert_checks c ON c.id = o.item_id
WHERE o.kind = 'advert' AND o.source = 'user' AND o.outcome_type = 'bought' AND o.outcome_price > 0
  AND (c.user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = c.user_id AND r.role = 'admin'))
UNION ALL
SELECT 'seller'::text, o.item_id, v.created_at, o.recorded_at, o.outcome_price::numeric, o.seller_type,
       (CASE WHEN o.seller_type IN ('dealer','part_ex') THEN nullif((v.report->'values'->>'dealerTradeIn')::numeric, 0)
             ELSE v.private_value::numeric END),
       v.report->>'engineVersion', v.report->>'pricingSource', v.report->>'marketConfidence', v.make, v.model, v.year, v.mileage
FROM public.check_outcomes o JOIN public.valuations v ON v.id = o.item_id
WHERE o.kind = 'valuation' AND o.source = 'user' AND o.outcome_type = 'seller' AND o.outcome_price > 0
  AND NOT EXISTS (SELECT 1 FROM public.sale_feedback sf WHERE sf.valuation_id = o.item_id)
  AND (v.user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = v.user_id AND r.role = 'admin'));
REVOKE ALL ON public.readiness_outcomes FROM anon, authenticated;

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
         count(*) FILTER (WHERE v.report ? 'saleFeedback' OR v.report ? 'followupDeclined'
            OR EXISTS (SELECT 1 FROM public.check_outcomes o WHERE o.kind = 'valuation' AND o.item_id = v.id AND o.source = 'user')),
         count(*) FILTER (WHERE (v.report->'saleFeedback'->>'salePrice')::numeric > 0
            OR EXISTS (SELECT 1 FROM public.check_outcomes o WHERE o.kind = 'valuation' AND o.item_id = v.id
                       AND o.source = 'user' AND o.outcome_type = 'seller' AND o.outcome_price > 0))
       FROM public.valuations v) f)
  ) INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.readiness_stats(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.readiness_stats(text) TO authenticated;