CREATE TABLE IF NOT EXISTS public.ad_hourly_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_account_id UUID NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hour SMALLINT NOT NULL,
  dow SMALLINT NOT NULL,
  results NUMERIC NOT NULL DEFAULT 0,
  spend NUMERIC NOT NULL DEFAULT 0,
  impressions NUMERIC NOT NULL DEFAULT 0,
  clicks NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ad_account_id, date, hour)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_hourly_leads TO authenticated;
GRANT ALL ON public.ad_hourly_leads TO service_role;
ALTER TABLE public.ad_hourly_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view hourly leads"
  ON public.ad_hourly_leads FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ad_accounts a WHERE a.id = ad_hourly_leads.ad_account_id));
CREATE POLICY "Service role manages hourly leads"
  ON public.ad_hourly_leads FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_ad_hourly_leads_acct ON public.ad_hourly_leads(ad_account_id);
CREATE INDEX IF NOT EXISTS idx_ad_hourly_leads_dow_hour ON public.ad_hourly_leads(dow, hour);