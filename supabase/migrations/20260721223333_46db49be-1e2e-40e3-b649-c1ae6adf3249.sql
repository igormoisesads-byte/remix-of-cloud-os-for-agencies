
-- 1) NEW ROLES (idempotent)
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'superadmin';
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_conta';
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gestor_trafego_junior';
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gestor_trafego_senior';
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'especialista_performance';
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sucesso_cliente';
END $$;

-- 2) NICHES: sigla
ALTER TABLE public.niches
  ADD COLUMN IF NOT EXISTS sigla text;
UPDATE public.niches
   SET sigla = upper(regexp_replace(substr(name,1,3),'[^A-Za-z0-9]','','g'))
 WHERE sigla IS NULL OR sigla = '';

-- 3) CLIENTS: BI fields + código único
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS codigo text UNIQUE,
  ADD COLUMN IF NOT EXISTS responsavel_nome text,
  ADD COLUMN IF NOT EXISTS responsavel_telefone text,
  ADD COLUMN IF NOT EXISTS responsavel_email text,
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS primeiro_vencimento date,
  ADD COLUMN IF NOT EXISTS tempo_contrato_meses integer,
  ADD COLUMN IF NOT EXISTS investimento_mensal numeric(12,2);

-- Function to generate unique client code: SIGLA + YYMM + #### (sequential per sigla+YYMM)
CREATE OR REPLACE FUNCTION public.generate_client_code(_niche_id uuid, _at timestamptz DEFAULT now())
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sigla text;
  v_yymm  text;
  v_prefix text;
  v_next   int;
  v_code   text;
BEGIN
  SELECT COALESCE(NULLIF(sigla,''), upper(regexp_replace(substr(name,1,3),'[^A-Za-z0-9]','','g')), 'CLI')
    INTO v_sigla FROM public.niches WHERE id = _niche_id;
  IF v_sigla IS NULL THEN v_sigla := 'CLI'; END IF;
  v_yymm := to_char(_at, 'YYMM');
  v_prefix := v_sigla || '-' || v_yymm || '-';
  SELECT COALESCE(MAX((regexp_replace(codigo, '^'||v_prefix, ''))::int), 0) + 1
    INTO v_next
    FROM public.clients
   WHERE codigo LIKE v_prefix || '%'
     AND codigo ~ ('^'||v_prefix||'[0-9]+$');
  v_code := v_prefix || lpad(v_next::text, 4, '0');
  RETURN v_code;
END $$;

CREATE OR REPLACE FUNCTION public.tg_clients_set_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    IF NEW.niche_id IS NOT NULL THEN
      NEW.codigo := public.generate_client_code(NEW.niche_id, COALESCE(NEW.created_at, now()));
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_clients_set_code ON public.clients;
CREATE TRIGGER trg_clients_set_code
BEFORE INSERT ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.tg_clients_set_code();

-- Backfill existing codes
UPDATE public.clients
   SET codigo = public.generate_client_code(niche_id, created_at)
 WHERE codigo IS NULL AND niche_id IS NOT NULL;

-- 4) ONBOARDING template: prazo (in days)
ALTER TABLE public.onboarding_template_stages
  ADD COLUMN IF NOT EXISTS prazo_dias integer;
ALTER TABLE public.onboarding_template_tasks
  ADD COLUMN IF NOT EXISTS prazo_dias integer;

-- 5) TASK CHECKLIST ITEMS (subtarefas leves)
CREATE TABLE IF NOT EXISTS public.task_checklist_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  done_at timestamptz,
  done_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_checklist_items TO authenticated;
GRANT ALL ON public.task_checklist_items TO service_role;
ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "team read checklist" ON public.task_checklist_items;
DROP POLICY IF EXISTS "team write checklist" ON public.task_checklist_items;
CREATE POLICY "team read checklist" ON public.task_checklist_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "team write checklist" ON public.task_checklist_items FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_checklist_task ON public.task_checklist_items(task_id);
DROP TRIGGER IF EXISTS trg_checklist_updated ON public.task_checklist_items;
CREATE TRIGGER trg_checklist_updated BEFORE UPDATE ON public.task_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 6) PROFILES HR fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS cargo text,
  ADD COLUMN IF NOT EXISTS nivel text CHECK (nivel IN ('junior','pleno','senior') OR nivel IS NULL),
  ADD COLUMN IF NOT EXISTS admissao date,
  ADD COLUMN IF NOT EXISTS salario numeric(12,2),
  ADD COLUMN IF NOT EXISTS obrigacoes jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Protect HR-sensitive columns: only allow SELECT on public/general columns for authenticated.
-- Salário/admissão/obrigações não são acessíveis por SELECT direto — só via RPC has_role-checked.
REVOKE ALL ON public.profiles FROM authenticated;
GRANT SELECT (id, full_name, email, avatar_url, telefone, cargo, nivel, created_at, updated_at)
  ON public.profiles TO authenticated;
-- Allow users to update their own basic fields (RLS still applies)
GRANT UPDATE (full_name, avatar_url, telefone)
  ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- RPC: read HR (salary/admissão/obrigações) — apenas superadmin/admin
CREATE OR REPLACE FUNCTION public.get_employee_hr(_user_id uuid)
RETURNS TABLE(user_id uuid, full_name text, email text, cargo text, nivel text, admissao date, salario numeric, obrigacoes jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
    SELECT p.id, p.full_name, p.email, p.cargo, p.nivel, p.admissao, p.salario, p.obrigacoes
      FROM public.profiles p
     WHERE p.id = _user_id;
END $$;

CREATE OR REPLACE FUNCTION public.list_employees_hr()
RETURNS TABLE(user_id uuid, full_name text, email text, cargo text, nivel text, admissao date, salario numeric, obrigacoes jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
    SELECT p.id, p.full_name, p.email, p.cargo, p.nivel, p.admissao, p.salario, p.obrigacoes
      FROM public.profiles p
     ORDER BY p.full_name;
END $$;

CREATE OR REPLACE FUNCTION public.update_employee_hr(
  _user_id uuid, _cargo text, _nivel text, _admissao date, _salario numeric, _obrigacoes jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.profiles
     SET cargo = _cargo,
         nivel = _nivel,
         admissao = _admissao,
         salario = _salario,
         obrigacoes = COALESCE(_obrigacoes, '{}'::jsonb),
         updated_at = now()
   WHERE id = _user_id;
END $$;

REVOKE ALL ON FUNCTION public.get_employee_hr(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_employees_hr() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_employee_hr(uuid,text,text,date,numeric,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_employee_hr(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_employees_hr() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_employee_hr(uuid,text,text,date,numeric,jsonb) TO authenticated;
