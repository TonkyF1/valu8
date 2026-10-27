CREATE TABLE public.advert_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_token_hash text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  make text NOT NULL,
  model text NOT NULL,
  variant text,
  year int NOT NULL,
  mileage int NOT NULL,
  asking_price int NOT NULL,
  seller_type text NOT NULL DEFAULT 'unknown' CHECK (seller_type IN ('dealer','private','unknown')),
  link_url text NULL,
  link_domain text NULL,
  link_fetchable boolean NOT NULL DEFAULT false,
  verdict text,
  estimate_private int,
  estimate_dealer_low int,
  estimate_dealer_mid int,
  estimate_dealer_high int,
  pricing_source text,
  confidence text,
  engine_version text,
  followup_sent_at timestamptz,
  followup_answered_at timestamptz,
  followup_snoozes int NOT NULL DEFAULT 0,
  followup_next_at timestamptz,
  recheck_count int NOT NULL DEFAULT 0,
  last_rechecked_at timestamptz,
  last_seen_price int,
  listing_status text NOT NULL DEFAULT 'unknown' CHECK (listing_status IN ('live','gone','unknown'))
);
CREATE INDEX advert_checks_user_idx ON public.advert_checks (user_id);
CREATE INDEX advert_checks_guest_idx ON public.advert_checks (guest_token_hash) WHERE guest_token_hash IS NOT NULL;
CREATE INDEX advert_checks_recheck_idx ON public.advert_checks (created_at) WHERE link_fetchable;

GRANT SELECT ON public.advert_checks TO authenticated;
GRANT UPDATE (followup_sent_at, followup_answered_at) ON public.advert_checks TO authenticated;
GRANT ALL ON public.advert_checks TO service_role;
ALTER TABLE public.advert_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own advert checks" ON public.advert_checks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own advert checks" ON public.advert_checks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins read advert checks" ON public.advert_checks FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.check_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('advert','valuation')),
  item_id uuid NOT NULL,
  source text NOT NULL CHECK (source IN ('user','recheck')),
  outcome_type text NOT NULL CHECK (outcome_type IN ('bought','not_bought','still_looking','sold','not_selling','withdrawn','price_changed')),
  outcome_price int NULL CHECK (outcome_price > 0),
  outcome_date date NULL,
  seller_type text NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX check_outcomes_user_unique ON public.check_outcomes (kind, item_id) WHERE source = 'user';
CREATE INDEX check_outcomes_item_idx ON public.check_outcomes (kind, item_id);

GRANT SELECT, INSERT, UPDATE ON public.check_outcomes TO authenticated;
GRANT ALL ON public.check_outcomes TO service_role;
ALTER TABLE public.check_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own outcomes" ON public.check_outcomes FOR SELECT TO authenticated USING (
  (kind = 'advert' AND EXISTS (SELECT 1 FROM public.advert_checks c WHERE c.id = item_id AND c.user_id = auth.uid()))
  OR (kind = 'valuation' AND EXISTS (SELECT 1 FROM public.valuations v WHERE v.id = item_id AND v.user_id = auth.uid())));
CREATE POLICY "Users insert own outcomes" ON public.check_outcomes FOR INSERT TO authenticated WITH CHECK (
  source = 'user' AND (
  (kind = 'advert' AND EXISTS (SELECT 1 FROM public.advert_checks c WHERE c.id = item_id AND c.user_id = auth.uid()))
  OR (kind = 'valuation' AND EXISTS (SELECT 1 FROM public.valuations v WHERE v.id = item_id AND v.user_id = auth.uid()))));
CREATE POLICY "Users update own outcomes" ON public.check_outcomes FOR UPDATE TO authenticated USING (
  source = 'user' AND (
  (kind = 'advert' AND EXISTS (SELECT 1 FROM public.advert_checks c WHERE c.id = item_id AND c.user_id = auth.uid()))
  OR (kind = 'valuation' AND EXISTS (SELECT 1 FROM public.valuations v WHERE v.id = item_id AND v.user_id = auth.uid()))))
  WITH CHECK (source = 'user');
CREATE POLICY "Admins read outcomes" ON public.check_outcomes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

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
  AND (c.user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = c.user_id AND r.role = 'admin'));
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
              sum(count(*) FILTER (WHERE in_band)) OVER (ORDER BY date_trunc('week', outcome_at)) n_cumulative
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