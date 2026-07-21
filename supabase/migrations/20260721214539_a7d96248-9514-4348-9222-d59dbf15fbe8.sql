
CREATE TABLE public.ad_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('meta','google')),
  account_id text NOT NULL,
  account_name text,
  access_token text,
  refresh_token text,
  currency text DEFAULT 'BRL',
  active boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  last_sync_error text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, provider, account_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_accounts TO authenticated;
GRANT ALL ON public.ad_accounts TO service_role;
ALTER TABLE public.ad_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team can view ad_accounts" ON public.ad_accounts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins/gestores manage ad_accounts" ON public.ad_accounts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));

CREATE TRIGGER trg_ad_accounts_updated BEFORE UPDATE ON public.ad_accounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.ad_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  date date NOT NULL,
  spend numeric(14,2) NOT NULL DEFAULT 0,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  reach bigint NOT NULL DEFAULT 0,
  results bigint NOT NULL DEFAULT 0,
  cpm numeric(14,4),
  ctr numeric(14,4),
  cpc numeric(14,4),
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ad_account_id, date)
);

CREATE INDEX idx_ad_insights_account_date ON public.ad_insights(ad_account_id, date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_insights TO authenticated;
GRANT ALL ON public.ad_insights TO service_role;
ALTER TABLE public.ad_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team can view ad_insights" ON public.ad_insights
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "team can write ad_insights" ON public.ad_insights
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_ad_insights_updated BEFORE UPDATE ON public.ad_insights
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
