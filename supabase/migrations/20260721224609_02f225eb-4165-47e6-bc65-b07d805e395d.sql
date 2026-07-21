
-- Template de cargo (RH/DP)
CREATE TABLE public.role_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo text NOT NULL,
  nivel text,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cargo, nivel)
);
GRANT SELECT ON public.role_templates TO authenticated;
GRANT ALL ON public.role_templates TO service_role;
ALTER TABLE public.role_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read templates" ON public.role_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage templates" ON public.role_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));
CREATE TRIGGER role_templates_updated BEFORE UPDATE ON public.role_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Atribuições
CREATE TABLE public.role_attribuicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.role_templates(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.role_attribuicoes(template_id);
GRANT SELECT ON public.role_attribuicoes TO authenticated;
GRANT ALL ON public.role_attribuicoes TO service_role;
ALTER TABLE public.role_attribuicoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read attr" ON public.role_attribuicoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage attr" ON public.role_attribuicoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

-- Reuniões
CREATE TABLE public.role_reunioes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.role_templates(id) ON DELETE CASCADE,
  periodicidade text NOT NULL,
  titulo text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.role_reunioes(template_id);
GRANT SELECT ON public.role_reunioes TO authenticated;
GRANT ALL ON public.role_reunioes TO service_role;
ALTER TABLE public.role_reunioes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read reu" ON public.role_reunioes FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage reu" ON public.role_reunioes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

-- Rotinas
CREATE TABLE public.role_rotinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.role_templates(id) ON DELETE CASCADE,
  periodicidade text NOT NULL,
  tarefa text NOT NULL,
  entregavel boolean NOT NULL DEFAULT false,
  entregavel_desc text,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.role_rotinas(template_id);
GRANT SELECT ON public.role_rotinas TO authenticated;
GRANT ALL ON public.role_rotinas TO service_role;
ALTER TABLE public.role_rotinas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read rot" ON public.role_rotinas FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage rot" ON public.role_rotinas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

-- Análises
CREATE TABLE public.role_analises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.role_templates(id) ON DELETE CASCADE,
  analise text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.role_analises(template_id);
GRANT SELECT ON public.role_analises TO authenticated;
GRANT ALL ON public.role_analises TO service_role;
ALTER TABLE public.role_analises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read ana" ON public.role_analises FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage ana" ON public.role_analises FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

-- KPIs
CREATE TABLE public.role_kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.role_templates(id) ON DELETE CASCADE,
  kpi text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.role_kpis(template_id);
GRANT SELECT ON public.role_kpis TO authenticated;
GRANT ALL ON public.role_kpis TO service_role;
ALTER TABLE public.role_kpis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read kpi" ON public.role_kpis FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage kpi" ON public.role_kpis FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

-- Seed cargo Gestor de Tráfego com os dados do exemplo
INSERT INTO public.role_templates (cargo, descricao) VALUES ('Gestor de Tráfego', 'Template padrão de rotinas e atribuições')
ON CONFLICT DO NOTHING;
