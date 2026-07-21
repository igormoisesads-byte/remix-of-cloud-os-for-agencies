
-- ============ NICHES & ONBOARDING TEMPLATES ============
CREATE TABLE public.niches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.niches TO authenticated;
GRANT ALL ON public.niches TO service_role;
ALTER TABLE public.niches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read niches" ON public.niches FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage niches" ON public.niches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.onboarding_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_id uuid NOT NULL REFERENCES public.niches(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_templates TO authenticated;
GRANT ALL ON public.onboarding_templates TO service_role;
ALTER TABLE public.onboarding_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read tmpl" ON public.onboarding_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage tmpl" ON public.onboarding_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_tmpl_upd BEFORE UPDATE ON public.onboarding_templates FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.onboarding_template_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.onboarding_templates(id) ON DELETE CASCADE,
  name text NOT NULL,
  position int NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_template_stages TO authenticated;
GRANT ALL ON public.onboarding_template_stages TO service_role;
ALTER TABLE public.onboarding_template_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read stages" ON public.onboarding_template_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage stages" ON public.onboarding_template_stages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.onboarding_template_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES public.onboarding_template_stages(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  position int NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_template_tasks TO authenticated;
GRANT ALL ON public.onboarding_template_tasks TO service_role;
ALTER TABLE public.onboarding_template_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read tmpl tasks" ON public.onboarding_template_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage tmpl tasks" ON public.onboarding_template_tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Client-scoped copy of stages
CREATE TABLE public.client_onboarding_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  position int NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_onboarding_stages TO authenticated;
GRANT ALL ON public.client_onboarding_stages TO service_role;
ALTER TABLE public.client_onboarding_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all cos" ON public.client_onboarding_stages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Extend clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS niche_id uuid REFERENCES public.niches(id),
  ADD COLUMN IF NOT EXISTS onboarding_template_id uuid REFERENCES public.onboarding_templates(id),
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS contract_end date,
  ADD COLUMN IF NOT EXISTS performance_user_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS cs_user_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS brand_anniversary date,
  ADD COLUMN IF NOT EXISTS logo_url text;

-- Extend onboarding_tasks
ALTER TABLE public.onboarding_tasks
  ADD COLUMN IF NOT EXISTS stage_id uuid REFERENCES public.client_onboarding_stages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS assignee_id uuid REFERENCES public.profiles(id);

-- ============ ROUTINES ============
CREATE TABLE public.client_routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  frequency text NOT NULL DEFAULT 'semanal', -- semanal | quinzenal | mensal
  day_of_week int, -- 0-6
  day_of_month int,
  assignee_id uuid REFERENCES public.profiles(id),
  active boolean NOT NULL DEFAULT true,
  last_generated date,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_routines TO authenticated;
GRANT ALL ON public.client_routines TO service_role;
ALTER TABLE public.client_routines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all routines" ON public.client_routines FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ HEALTH SCORE ============
CREATE TABLE public.health_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  score int NOT NULL CHECK (score BETWEEN 0 AND 100),
  notes text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES public.profiles(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_scores TO authenticated;
GRANT ALL ON public.health_scores TO service_role;
ALTER TABLE public.health_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all hs" ON public.health_scores FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ PDAs ============
CREATE TABLE public.pdas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'media', -- baixa | media | alta
  status text NOT NULL DEFAULT 'aberto', -- aberto | em_andamento | resolvido
  due_date date,
  resolved_at timestamptz,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdas TO authenticated;
GRANT ALL ON public.pdas TO service_role;
ALTER TABLE public.pdas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all pdas" ON public.pdas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_pdas_upd BEFORE UPDATE ON public.pdas FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ NPS ============
CREATE TABLE public.nps_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  score int NOT NULL CHECK (score BETWEEN 0 AND 10),
  comment text,
  respondent text,
  period text, -- ex 2026-07
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nps_responses TO authenticated;
GRANT ALL ON public.nps_responses TO service_role;
ALTER TABLE public.nps_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all nps" ON public.nps_responses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ REPORTS ============
CREATE TABLE public.client_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'mensal', -- semanal | mensal | total
  period_start date,
  period_end date,
  title text NOT NULL,
  url text,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_reports TO authenticated;
GRANT ALL ON public.client_reports TO service_role;
ALTER TABLE public.client_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all reports" ON public.client_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ MEETINGS ============
CREATE TABLE public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  held_at timestamptz NOT NULL DEFAULT now(),
  drive_url text,
  recording_url text,
  transcript text,
  notes text,
  attendees text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO authenticated;
GRANT ALL ON public.meetings TO service_role;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all meetings" ON public.meetings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ MOODBOARDS ============
CREATE TABLE public.moodboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.moodboards TO authenticated;
GRANT ALL ON public.moodboards TO service_role;
ALTER TABLE public.moodboards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all mb" ON public.moodboards FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ ACCESS ============
CREATE TABLE public.client_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform text NOT NULL,
  login_url text,
  username text,
  password text,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_access TO authenticated;
GRANT ALL ON public.client_access TO service_role;
ALTER TABLE public.client_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all access" ON public.client_access FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_access_upd BEFORE UPDATE ON public.client_access FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ AUDIT EXTENSIONS ============
ALTER TABLE public.client_activities
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id uuid;

-- Auto-audit trigger for PDAs
CREATE OR REPLACE FUNCTION public.tg_pda_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.client_activities(client_id,user_id,action,description,entity_type,entity_id)
    VALUES (NEW.client_id, COALESCE(NEW.created_by, auth.uid()), 'PDA criado', NEW.title, 'pda', NEW.id);
  ELSIF TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.client_activities(client_id,user_id,action,description,entity_type,entity_id)
    VALUES (NEW.client_id, auth.uid(), 'PDA '||NEW.status, NEW.title, 'pda', NEW.id);
    IF NEW.status='resolvido' AND OLD.status<>'resolvido' THEN NEW.resolved_at = now(); END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_pda_audit AFTER INSERT OR UPDATE ON public.pdas FOR EACH ROW EXECUTE FUNCTION public.tg_pda_audit();

-- Auto-audit for NPS, Meetings, Health Score
CREATE OR REPLACE FUNCTION public.tg_generic_client_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE action_label text;
BEGIN
  action_label := CASE TG_TABLE_NAME
    WHEN 'nps_responses' THEN 'NPS registrado'
    WHEN 'meetings' THEN 'Reunião registrada'
    WHEN 'health_scores' THEN 'Health Score registrado'
    WHEN 'client_reports' THEN 'Relatório adicionado'
    WHEN 'moodboards' THEN 'Moodboard adicionado'
    WHEN 'client_access' THEN 'Acesso adicionado'
    ELSE TG_TABLE_NAME
  END;
  INSERT INTO public.client_activities(client_id,user_id,action,description,entity_type,entity_id)
  VALUES (NEW.client_id, COALESCE(NEW.created_by, auth.uid()), action_label,
    COALESCE(NEW.title, NEW.score::text, ''), TG_TABLE_NAME, NEW.id);
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_nps_audit AFTER INSERT ON public.nps_responses FOR EACH ROW EXECUTE FUNCTION public.tg_generic_client_audit();
CREATE TRIGGER trg_meetings_audit AFTER INSERT ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.tg_generic_client_audit();
CREATE TRIGGER trg_health_audit AFTER INSERT ON public.health_scores FOR EACH ROW EXECUTE FUNCTION public.tg_generic_client_audit();
CREATE TRIGGER trg_reports_audit AFTER INSERT ON public.client_reports FOR EACH ROW EXECUTE FUNCTION public.tg_generic_client_audit();
CREATE TRIGGER trg_moodboards_audit AFTER INSERT ON public.moodboards FOR EACH ROW EXECUTE FUNCTION public.tg_generic_client_audit();
CREATE TRIGGER trg_access_audit AFTER INSERT ON public.client_access FOR EACH ROW EXECUTE FUNCTION public.tg_generic_client_audit();

-- Onboarding task audit
CREATE OR REPLACE FUNCTION public.tg_onboarding_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO public.client_activities(client_id,user_id,action,description,entity_type,entity_id)
    VALUES (NEW.client_id, COALESCE(NEW.created_by, auth.uid()), 'Item de onboarding criado', NEW.title, 'onboarding_task', NEW.id);
  ELSIF TG_OP='UPDATE' AND NEW.done IS DISTINCT FROM OLD.done THEN
    INSERT INTO public.client_activities(client_id,user_id,action,description,entity_type,entity_id)
    VALUES (NEW.client_id, auth.uid(), CASE WHEN NEW.done THEN 'Onboarding: concluído' ELSE 'Onboarding: reaberto' END, NEW.title, 'onboarding_task', NEW.id);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_onboarding_audit AFTER INSERT OR UPDATE ON public.onboarding_tasks FOR EACH ROW EXECUTE FUNCTION public.tg_onboarding_audit();
