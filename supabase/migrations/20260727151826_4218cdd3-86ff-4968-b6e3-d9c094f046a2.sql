ALTER TABLE public.ad_creatives
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end date;
CREATE INDEX IF NOT EXISTS ad_creatives_period_idx ON public.ad_creatives (ad_account_id, period_start, period_end);