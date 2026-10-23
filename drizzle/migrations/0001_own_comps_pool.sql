CREATE TABLE IF NOT EXISTS public.market_listings (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_url TEXT,
  make TEXT NOT NULL, model TEXT NOT NULL, variant TEXT,
  year INTEGER NOT NULL, mileage INTEGER NOT NULL,
  fuel TEXT, gearbox TEXT, seller TEXT CHECK (seller IN ('private','dealer')),
  price INTEGER NOT NULL CHECK (price > 0),
  location TEXT,
  flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  listed_on DATE NOT NULL DEFAULT current_date,
  last_seen DATE NOT NULL DEFAULT current_date,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS market_listings_mm ON public.market_listings (lower(make), lower(model), year);

CREATE TABLE IF NOT EXISTS public.valuation_pool (
  valuation_id UUID PRIMARY KEY REFERENCES public.valuations(id) ON DELETE CASCADE,
  make TEXT NOT NULL, model TEXT NOT NULL, variant TEXT,
  year INTEGER NOT NULL, mileage INTEGER NOT NULL, fuel TEXT, gearbox TEXT,
  condition_score NUMERIC(3,1), declared_status TEXT, spec JSONB NOT NULL DEFAULT '{}'::jsonb,
  photo_count INTEGER NOT NULL DEFAULT 0,
  price_private INTEGER, price_source TEXT, own_comps JSONB,
  engine_version TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sale_feedback (
  valuation_id UUID PRIMARY KEY REFERENCES public.valuations(id) ON DELETE CASCADE,
  make TEXT NOT NULL, model TEXT NOT NULL, variant TEXT,
  year INTEGER NOT NULL, mileage INTEGER NOT NULL,
  sale_price INTEGER NOT NULL CHECK (sale_price > 0),
  sold_to TEXT, sold_on DATE, estimate_at_time INTEGER,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vehicle_history_flags (
  valuation_id UUID PRIMARY KEY REFERENCES public.valuations(id) ON DELETE CASCADE,
  write_off_category TEXT CHECK (write_off_category IN ('A','B','S','N')),
  stolen BOOLEAN, source TEXT NOT NULL DEFAULT 'self_declared',
  mot_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.market_listings TO authenticated; GRANT ALL ON public.market_listings TO service_role;
GRANT SELECT ON public.valuation_pool TO authenticated; GRANT ALL ON public.valuation_pool TO service_role;
GRANT SELECT ON public.sale_feedback TO authenticated; GRANT ALL ON public.sale_feedback TO service_role;
GRANT SELECT ON public.vehicle_history_flags TO authenticated; GRANT ALL ON public.vehicle_history_flags TO service_role;

ALTER TABLE public.market_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.valuation_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_history_flags ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['market_listings','valuation_pool','sale_feedback','vehicle_history_flags'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admins read %1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "Admins read %1$s" ON public.%1$I FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''admin''))', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.sync_sale_feedback() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE fb JSONB := NEW.report -> 'saleFeedback';
BEGIN
  IF fb IS NULL OR jsonb_typeof(fb) <> 'object' OR coalesce((fb->>'salePrice')::numeric, 0) <= 0 THEN
    DELETE FROM public.sale_feedback WHERE valuation_id = NEW.id; RETURN NEW;
  END IF;
  INSERT INTO public.sale_feedback (valuation_id, make, model, variant, year, mileage, sale_price, sold_to, sold_on, estimate_at_time)
  VALUES (NEW.id, NEW.make, NEW.model, NEW.report->>'variant', NEW.year, NEW.mileage,
          round((fb->>'salePrice')::numeric)::int, fb->>'soldTo', nullif(fb->>'soldOn','')::date,
          round(nullif(fb->>'estimateAtTime','')::numeric)::int)
  ON CONFLICT (valuation_id) DO UPDATE SET sale_price = EXCLUDED.sale_price, sold_to = EXCLUDED.sold_to,
    sold_on = EXCLUDED.sold_on, estimate_at_time = EXCLUDED.estimate_at_time, recorded_at = now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS valuations_sale_feedback ON public.valuations;
CREATE TRIGGER valuations_sale_feedback AFTER INSERT OR UPDATE OF report ON public.valuations
  FOR EACH ROW EXECUTE FUNCTION public.sync_sale_feedback();

CREATE OR REPLACE FUNCTION public.sync_valuation_pool() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.valuation_pool (valuation_id, make, model, variant, year, mileage, fuel, gearbox,
    condition_score, photo_count, price_private, price_source, own_comps, engine_version)
  VALUES (NEW.id, NEW.make, NEW.model, NEW.report->>'variant', NEW.year, NEW.mileage,
    NEW.report->>'fuelType', NEW.report->>'transmission', NEW.condition_score,
    coalesce(jsonb_array_length(NEW.photo_urls), 0), NEW.private_value, NEW.report->>'pricingSource',
    NEW.report->'ownCompsShadow', NEW.report->>'engineVersion')
  ON CONFLICT (valuation_id) DO UPDATE SET price_private = EXCLUDED.price_private, own_comps = EXCLUDED.own_comps,
    condition_score = EXCLUDED.condition_score;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS valuations_pool ON public.valuations;
CREATE TRIGGER valuations_pool AFTER INSERT OR UPDATE OF report, private_value ON public.valuations
  FOR EACH ROW EXECUTE FUNCTION public.sync_valuation_pool();