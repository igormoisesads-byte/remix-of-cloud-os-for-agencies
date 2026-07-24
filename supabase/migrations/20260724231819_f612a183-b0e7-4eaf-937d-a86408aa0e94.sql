
-- Squads: grupos de clientes com 1 Head + N membros
CREATE TABLE public.squads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text,
  head_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.squads TO authenticated;
GRANT ALL ON public.squads TO service_role;
ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff reads squads" ON public.squads FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "admin/gestor writes squads" ON public.squads FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));
CREATE POLICY "admin/gestor updates squads" ON public.squads FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));
CREATE POLICY "admin/gestor deletes squads" ON public.squads FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));

CREATE TRIGGER squads_set_updated BEFORE UPDATE ON public.squads
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Members
CREATE TABLE public.squad_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(squad_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.squad_members TO authenticated;
GRANT ALL ON public.squad_members TO service_role;
ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff reads squad_members" ON public.squad_members FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "admin/gestor manages squad_members" ON public.squad_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));

-- Client squad link
ALTER TABLE public.clients ADD COLUMN squad_id uuid REFERENCES public.squads(id) ON DELETE SET NULL;
CREATE INDEX idx_clients_squad_id ON public.clients(squad_id);
CREATE INDEX idx_squad_members_user ON public.squad_members(user_id);

-- Helper: current user is in the same squad as this client
CREATE OR REPLACE FUNCTION public.user_can_see_client(_client_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = _client_id
      AND (
        public.has_role(_user_id,'admin')
        OR public.has_role(_user_id,'gestor')
        OR public.has_role(_user_id,'superadmin')
        OR c.cs_user_id = _user_id
        OR c.performance_user_id = _user_id
        OR c.created_by = _user_id
        OR (c.squad_id IS NOT NULL AND (
              EXISTS (SELECT 1 FROM public.squad_members sm WHERE sm.squad_id = c.squad_id AND sm.user_id = _user_id)
              OR EXISTS (SELECT 1 FROM public.squads s WHERE s.id = c.squad_id AND s.head_user_id = _user_id)
        ))
      )
  );
$$;
REVOKE EXECUTE ON FUNCTION public.user_can_see_client(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_see_client(uuid, uuid) TO authenticated;

-- Replace clients SELECT policy to respect squad membership
DROP POLICY IF EXISTS "staff read clients" ON public.clients;
CREATE POLICY "clients scoped read" ON public.clients FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'gestor')
  OR public.has_role(auth.uid(),'superadmin')
  OR cs_user_id = auth.uid()
  OR performance_user_id = auth.uid()
  OR created_by = auth.uid()
  OR (squad_id IS NOT NULL AND (
        EXISTS (SELECT 1 FROM public.squad_members sm WHERE sm.squad_id = clients.squad_id AND sm.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.squads s WHERE s.id = clients.squad_id AND s.head_user_id = auth.uid())
     ))
);
