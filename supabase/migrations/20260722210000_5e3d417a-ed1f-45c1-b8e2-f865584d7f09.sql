
-- 1) ad_accounts: colunas de saldo e imposto
ALTER TABLE public.ad_accounts
  ADD COLUMN IF NOT EXISTS balance_cents BIGINT,
  ADD COLUMN IF NOT EXISTS amount_spent_cents BIGINT,
  ADD COLUMN IF NOT EXISTS spend_cap_cents BIGINT,
  ADD COLUMN IF NOT EXISTS currency TEXT,
  ADD COLUMN IF NOT EXISTS funding_type TEXT,
  ADD COLUMN IF NOT EXISTS balance_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(6,4) NOT NULL DEFAULT 0.1215,
  ADD COLUMN IF NOT EXISTS low_balance_days_threshold INT NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS low_balance_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_low_balance_days NUMERIC(8,2);

-- 2) ad_billing_transactions: faturas/cobranças do Meta
CREATE TABLE IF NOT EXISTS public.ad_billing_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_account_id UUID NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  transaction_id TEXT NOT NULL,
  billing_start_time TIMESTAMPTZ,
  billing_end_time TIMESTAMPTZ,
  charge_type TEXT,
  product_type TEXT,
  status TEXT,
  payment_option TEXT,
  currency TEXT,
  amount_cents BIGINT NOT NULL DEFAULT 0,
  vat_cents BIGINT NOT NULL DEFAULT 0,
  net_cents BIGINT NOT NULL DEFAULT 0,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ad_account_id, transaction_id)
);

GRANT SELECT ON public.ad_billing_transactions TO authenticated;
GRANT ALL ON public.ad_billing_transactions TO service_role;

ALTER TABLE public.ad_billing_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_tx_read_auth"
  ON public.ad_billing_transactions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER trg_billing_tx_updated_at
  BEFORE UPDATE ON public.ad_billing_transactions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS ad_billing_tx_account_idx
  ON public.ad_billing_transactions (ad_account_id, billing_end_time DESC);

-- 3) push_subscriptions: notificações Web Push
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_sub_manage_own"
  ON public.push_subscriptions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_push_sub_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS push_sub_user_idx ON public.push_subscriptions (user_id);
