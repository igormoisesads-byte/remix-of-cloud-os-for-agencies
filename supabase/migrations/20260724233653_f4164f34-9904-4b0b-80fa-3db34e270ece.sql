
DO $$ BEGIN
  CREATE TYPE expense_status AS ENUM ('pendente','pago','atrasado','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE expense_recurrence AS ENUM ('none','monthly','annual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  category TEXT,
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  paid_amount NUMERIC,
  status expense_status NOT NULL DEFAULT 'pendente',
  notes TEXT,
  recurrence expense_recurrence NOT NULL DEFAULT 'none',
  recurrence_day INTEGER,
  parent_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  vendor TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance staff manage expenses" ON public.expenses
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'gestor')
    OR public.has_role(auth.uid(),'financeiro')
    OR public.has_role(auth.uid(),'superadmin')
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'gestor')
    OR public.has_role(auth.uid(),'financeiro')
    OR public.has_role(auth.uid(),'superadmin')
  );

CREATE INDEX expenses_due_date_idx ON public.expenses(due_date);
CREATE INDEX expenses_status_idx ON public.expenses(status);
CREATE INDEX expenses_recurrence_idx ON public.expenses(recurrence) WHERE recurrence <> 'none';

CREATE TRIGGER expenses_set_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
