
ALTER TABLE public.ad_creatives
  ADD COLUMN IF NOT EXISTS campaign_id text,
  ADD COLUMN IF NOT EXISTS campaign_name text,
  ADD COLUMN IF NOT EXISTS adset_id text,
  ADD COLUMN IF NOT EXISTS adset_name text;

CREATE INDEX IF NOT EXISTS ad_creatives_campaign_idx ON public.ad_creatives(ad_account_id, campaign_id);

CREATE TABLE IF NOT EXISTS public.ad_campaign_insights (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  date date NOT NULL,
  campaign_id text NOT NULL,
  campaign_name text,
  spend numeric NOT NULL DEFAULT 0,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  reach bigint NOT NULL DEFAULT 0,
  results bigint NOT NULL DEFAULT 0,
  cpm numeric,
  ctr numeric,
  cpc numeric,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ad_account_id, date, campaign_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_campaign_insights TO authenticated;
GRANT ALL ON public.ad_campaign_insights TO service_role;

ALTER TABLE public.ad_campaign_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team can view ad_campaign_insights" ON public.ad_campaign_insights
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "team can write ad_campaign_insights" ON public.ad_campaign_insights
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_ad_campaign_insights_updated
  BEFORE UPDATE ON public.ad_campaign_insights
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS ad_campaign_insights_acc_date_idx
  ON public.ad_campaign_insights(ad_account_id, date);
