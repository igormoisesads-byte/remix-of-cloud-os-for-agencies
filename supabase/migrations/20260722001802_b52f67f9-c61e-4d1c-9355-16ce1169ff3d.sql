
-- CREATIVES
CREATE TABLE public.ad_creatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  name text,
  thumbnail_url text,
  preview_url text,
  destination_url text,
  status text,
  spend numeric(14,2) NOT NULL DEFAULT 0,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  reach bigint NOT NULL DEFAULT 0,
  results bigint NOT NULL DEFAULT 0,
  ctr numeric(14,4),
  cpc numeric(14,4),
  last_sync_at timestamptz,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ad_account_id, external_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_creatives TO authenticated;
GRANT ALL ON public.ad_creatives TO service_role;
GRANT SELECT ON public.ad_creatives TO anon;
ALTER TABLE public.ad_creatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team read creatives" ON public.ad_creatives FOR SELECT TO authenticated USING (true);
CREATE POLICY "team write creatives" ON public.ad_creatives FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon read creatives" ON public.ad_creatives FOR SELECT TO anon USING (true);
CREATE TRIGGER trg_ad_creatives_updated BEFORE UPDATE ON public.ad_creatives FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- GEO
CREATE TABLE public.ad_geo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  country_code text NOT NULL,
  country_name text,
  spend numeric(14,2) NOT NULL DEFAULT 0,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  reach bigint NOT NULL DEFAULT 0,
  results bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ad_account_id, period_start, period_end, country_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_geo TO authenticated;
GRANT ALL ON public.ad_geo TO service_role;
GRANT SELECT ON public.ad_geo TO anon;
ALTER TABLE public.ad_geo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team read geo" ON public.ad_geo FOR SELECT TO authenticated USING (true);
CREATE POLICY "team write geo" ON public.ad_geo FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon read geo" ON public.ad_geo FOR SELECT TO anon USING (true);
CREATE TRIGGER trg_ad_geo_updated BEFORE UPDATE ON public.ad_geo FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- WHATSAPP FUNNEL (daily)
CREATE TABLE public.ad_funnel_whatsapp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  date date NOT NULL,
  impressions bigint NOT NULL DEFAULT 0,
  link_clicks bigint NOT NULL DEFAULT 0,
  conversations_started bigint NOT NULL DEFAULT 0,
  first_replies bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ad_account_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_funnel_whatsapp TO authenticated;
GRANT ALL ON public.ad_funnel_whatsapp TO service_role;
GRANT SELECT ON public.ad_funnel_whatsapp TO anon;
ALTER TABLE public.ad_funnel_whatsapp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team read wa funnel" ON public.ad_funnel_whatsapp FOR SELECT TO authenticated USING (true);
CREATE POLICY "team write wa funnel" ON public.ad_funnel_whatsapp FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon read wa funnel" ON public.ad_funnel_whatsapp FOR SELECT TO anon USING (true);
CREATE TRIGGER trg_ad_funnel_wa_updated BEFORE UPDATE ON public.ad_funnel_whatsapp FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- PUBLIC REPORTS
CREATE TABLE public.public_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  title text,
  password_hash text,
  active boolean NOT NULL DEFAULT true,
  view_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.public_reports TO authenticated;
GRANT ALL ON public.public_reports TO service_role;
GRANT SELECT ON public.public_reports TO anon;
ALTER TABLE public.public_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin/gestor manage public_reports" ON public.public_reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));
CREATE POLICY "anon read active public_reports" ON public.public_reports FOR SELECT TO anon
  USING (active = true AND (expires_at IS NULL OR expires_at > now()));
CREATE TRIGGER trg_public_reports_updated BEFORE UPDATE ON public.public_reports FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- APP SETTINGS (agency branding)
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  agency_name text,
  agency_logo_url text,
  agency_primary_color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
GRANT SELECT ON public.app_settings TO anon;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "everyone read app_settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "anon read app_settings" ON public.app_settings FOR SELECT TO anon USING (true);
CREATE POLICY "admin write app_settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_app_settings_updated BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
INSERT INTO public.app_settings (singleton, agency_name) VALUES (true, 'CloudOS');

-- Allow anon read on clients (only fields exposed in public share) - we'll rely on server fn using service role instead. So no anon policy on clients.
