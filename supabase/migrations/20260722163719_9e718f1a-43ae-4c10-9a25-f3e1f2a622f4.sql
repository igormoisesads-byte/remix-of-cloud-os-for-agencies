
CREATE TABLE IF NOT EXISTS public.ad_hourly_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  date date NOT NULL,
  hour smallint NOT NULL CHECK (hour BETWEEN 0 AND 23),
  dow smallint NOT NULL CHECK (dow BETWEEN 0 AND 6),
  results bigint NOT NULL DEFAULT 0,
  spend numeric NOT NULL DEFAULT 0,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ad_account_id, date, hour)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_hourly_leads TO authenticated;
GRANT ALL ON public.ad_hourly_leads TO service_role;

ALTER TABLE public.ad_hourly_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read ad_hourly_leads" ON public.ad_hourly_leads
FOR SELECT TO authenticated USING (true);

CREATE POLICY "service role manages ad_hourly_leads" ON public.ad_hourly_leads
FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS ad_hourly_leads_account_idx ON public.ad_hourly_leads(ad_account_id, date);
