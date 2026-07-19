
-- =========== ENUMS ===========
CREATE TYPE public.app_role AS ENUM ('admin', 'gestor', 'operacional', 'financeiro');
CREATE TYPE public.client_type AS ENUM ('local', 'perpetuo', 'autoria');
CREATE TYPE public.client_status AS ENUM ('ativo', 'pausado', 'churn', 'onboarding');
CREATE TYPE public.fee_status AS ENUM ('pendente', 'pago', 'atrasado', 'cancelado');

-- =========== PROFILES ===========
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated can read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- =========== USER ROLES ===========
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manages roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========== AUTO PROFILE + FIRST USER = ADMIN ===========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count INT;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)));

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'operacional');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========== UPDATED_AT HELPER ===========
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========== CLIENTS ===========
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type public.client_type NOT NULL,
  status public.client_status NOT NULL DEFAULT 'onboarding',
  niche TEXT,
  platform TEXT,
  site TEXT,
  city_uf TEXT,
  address TEXT,
  contract_start DATE,
  monthly_fee_amount NUMERIC(12,2),
  monthly_fee_day INT CHECK (monthly_fee_day BETWEEN 1 AND 31),
  cs_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  performance_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team reads clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "team creates clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "team updates clients" ON public.clients FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin/gestor delete clients" ON public.clients FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));
CREATE TRIGGER clients_set_updated_at BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========== ONBOARDING TASKS ===========
CREATE TABLE public.onboarding_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  position INT NOT NULL DEFAULT 0,
  done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_tasks TO authenticated;
GRANT ALL ON public.onboarding_tasks TO service_role;
ALTER TABLE public.onboarding_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team manages onboarding" ON public.onboarding_tasks FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- =========== MONTHLY FEES ===========
CREATE TABLE public.monthly_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  reference_month DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  due_date DATE NOT NULL,
  status public.fee_status NOT NULL DEFAULT 'pendente',
  paid_at TIMESTAMPTZ,
  paid_amount NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, reference_month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_fees TO authenticated;
GRANT ALL ON public.monthly_fees TO service_role;
ALTER TABLE public.monthly_fees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team reads fees" ON public.monthly_fees FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin/gestor/financeiro manage fees" ON public.monthly_fees FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'financeiro'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'financeiro'));
CREATE TRIGGER fees_set_updated_at BEFORE UPDATE ON public.monthly_fees
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========== ACTIVITY LOG (auditoria) ===========
CREATE TABLE public.client_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.client_activities TO authenticated;
GRANT ALL ON public.client_activities TO service_role;
ALTER TABLE public.client_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team reads activity" ON public.client_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "team writes activity" ON public.client_activities FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_clients_status ON public.clients(status);
CREATE INDEX idx_fees_due ON public.monthly_fees(due_date, status);
CREATE INDEX idx_activities_client ON public.client_activities(client_id, created_at DESC);
