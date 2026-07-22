
-- NPS surveys (form builder da empresa)
CREATE TABLE public.nps_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{id,label,type:'nps'|'text'|'rating'|'choice',options?}]
  active boolean NOT NULL DEFAULT true,
  public_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nps_surveys TO authenticated;
GRANT SELECT ON public.nps_surveys TO anon;
GRANT ALL ON public.nps_surveys TO service_role;
ALTER TABLE public.nps_surveys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage surveys" ON public.nps_surveys FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon read active surveys" ON public.nps_surveys FOR SELECT TO anon USING (active = true);
CREATE TRIGGER trg_nps_surveys_upd BEFORE UPDATE ON public.nps_surveys FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.nps_survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.nps_surveys(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  score int CHECK (score BETWEEN 0 AND 10),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  comment text,
  respondent_name text,
  respondent_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nps_survey_responses TO authenticated;
GRANT INSERT ON public.nps_survey_responses TO anon;
GRANT ALL ON public.nps_survey_responses TO service_role;
ALTER TABLE public.nps_survey_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read responses" ON public.nps_survey_responses FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage responses" ON public.nps_survey_responses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon insert responses" ON public.nps_survey_responses FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.nps_surveys s WHERE s.id = survey_id AND s.active = true));

-- Passos do PDA (plano de ação)
CREATE TABLE public.pda_action_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pda_id uuid NOT NULL REFERENCES public.pdas(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  title text NOT NULL,
  description text,
  owner_id uuid REFERENCES public.profiles(id),
  due_date date,
  status text NOT NULL DEFAULT 'aberto', -- aberto | em_andamento | concluido
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pda_action_steps TO authenticated;
GRANT ALL ON public.pda_action_steps TO service_role;
ALTER TABLE public.pda_action_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all pda steps" ON public.pda_action_steps FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_pda_steps_upd BEFORE UPDATE ON public.pda_action_steps FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
