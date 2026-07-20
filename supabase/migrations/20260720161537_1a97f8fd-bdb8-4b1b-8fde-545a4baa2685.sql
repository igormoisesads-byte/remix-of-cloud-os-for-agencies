
-- Add lancamento to client_type enum if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='lancamento' AND enumtypid=(SELECT oid FROM pg_type WHERE typname='client_type')) THEN
    ALTER TYPE public.client_type ADD VALUE 'lancamento';
  END IF;
END $$;

-- Plans table
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'mensal', -- mensal, lancamento, autoria, outro
  amount numeric(12,2),
  description text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team reads plans" ON public.plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manages plans" ON public.plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER plans_updated BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Commission tiers (default negotiation table for launches)
CREATE TABLE IF NOT EXISTS public.commission_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_revenue numeric(14,2) NOT NULL DEFAULT 0,
  max_revenue numeric(14,2),
  pct numeric(5,2) NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_tiers TO authenticated;
GRANT ALL ON public.commission_tiers TO service_role;
ALTER TABLE public.commission_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team reads tiers" ON public.commission_tiers FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manages tiers" ON public.commission_tiers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER tiers_updated BEFORE UPDATE ON public.commission_tiers FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Client extra fields
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contract_end date,
  ADD COLUMN IF NOT EXISTS launch_commission_pct numeric(5,2);

-- Seed default commission tiers if empty
INSERT INTO public.commission_tiers (min_revenue, max_revenue, pct, label)
SELECT * FROM (VALUES
  (0::numeric, 50000::numeric, 10::numeric, 'Até R$ 50k'),
  (50000::numeric, 100000::numeric, 12::numeric, 'R$ 50k a 100k'),
  (100000::numeric, 250000::numeric, 15::numeric, 'R$ 100k a 250k'),
  (250000::numeric, 500000::numeric, 18::numeric, 'R$ 250k a 500k'),
  (500000::numeric, NULL::numeric, 20::numeric, 'Acima de R$ 500k')
) AS v(min_revenue, max_revenue, pct, label)
WHERE NOT EXISTS (SELECT 1 FROM public.commission_tiers);
