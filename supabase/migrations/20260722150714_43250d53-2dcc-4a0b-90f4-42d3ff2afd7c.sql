ALTER TABLE public.nps_surveys 
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS ref_month date;
CREATE INDEX IF NOT EXISTS idx_nps_surveys_client ON public.nps_surveys(client_id, ref_month);