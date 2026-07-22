
ALTER TABLE public.ad_creatives
  ADD COLUMN IF NOT EXISTS frequency numeric(14,4),
  ADD COLUMN IF NOT EXISTS cpm numeric(14,4),
  ADD COLUMN IF NOT EXISTS cpp numeric(14,4),
  ADD COLUMN IF NOT EXISTS unique_link_clicks bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unique_link_ctr numeric(14,4),
  ADD COLUMN IF NOT EXISTS unique_link_cpc numeric(14,4),
  ADD COLUMN IF NOT EXISTS unique_outbound_clicks bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unique_outbound_ctr numeric(14,4),
  ADD COLUMN IF NOT EXISTS unique_outbound_cpc numeric(14,4),
  ADD COLUMN IF NOT EXISTS landing_page_views bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_per_landing_page_view numeric(14,4),
  ADD COLUMN IF NOT EXISTS initiate_checkout bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_per_initiate_checkout numeric(14,4),
  ADD COLUMN IF NOT EXISTS initiate_checkout_value numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchases bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_per_purchase numeric(14,4),
  ADD COLUMN IF NOT EXISTS purchase_value numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS roas numeric(14,4),
  ADD COLUMN IF NOT EXISTS video_plays bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_p3s bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_p75 bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS messaging_conversations_started bigint NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS ad_creatives_status_idx ON public.ad_creatives(ad_account_id, status);
