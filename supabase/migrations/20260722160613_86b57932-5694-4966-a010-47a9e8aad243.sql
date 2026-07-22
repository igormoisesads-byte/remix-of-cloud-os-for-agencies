
ALTER TABLE public.ad_geo ADD COLUMN IF NOT EXISTS region text;
ALTER TABLE public.ad_geo ADD COLUMN IF NOT EXISTS region_name text;
ALTER TABLE public.ad_geo ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.ad_geo DROP CONSTRAINT IF EXISTS ad_geo_ad_account_id_period_start_period_end_country_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS ad_geo_uniq_full
  ON public.ad_geo (ad_account_id, period_start, period_end, country_code, COALESCE(region, ''), COALESCE(city, ''));
