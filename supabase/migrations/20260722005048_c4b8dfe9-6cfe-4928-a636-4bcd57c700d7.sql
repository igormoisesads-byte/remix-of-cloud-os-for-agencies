
CREATE TABLE public.client_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  ref_date DATE NOT NULL,
  weekday SMALLINT,
  hour SMALLINT,
  leads INT NOT NULL DEFAULT 0,
  agendamentos INT NOT NULL DEFAULT 0,
  vendas INT NOT NULL DEFAULT 0,
  faturamento NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_sales_client_date ON public.client_sales(client_id, ref_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_sales TO authenticated;
GRANT ALL ON public.client_sales TO service_role;

ALTER TABLE public.client_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth users manage client_sales"
  ON public.client_sales FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_client_sales_updated
  BEFORE UPDATE ON public.client_sales
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Trigger: fill weekday/hour automatically
CREATE OR REPLACE FUNCTION public.tg_client_sales_derive()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.weekday IS NULL THEN
    NEW.weekday = EXTRACT(DOW FROM NEW.ref_date)::SMALLINT;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_client_sales_derive
  BEFORE INSERT OR UPDATE ON public.client_sales
  FOR EACH ROW EXECUTE FUNCTION public.tg_client_sales_derive();
