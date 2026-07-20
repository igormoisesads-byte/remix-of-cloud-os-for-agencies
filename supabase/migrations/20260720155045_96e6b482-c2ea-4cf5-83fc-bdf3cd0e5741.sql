
-- ENUMS
CREATE TYPE public.channel_type AS ENUM ('public','private','dm','client');
CREATE TYPE public.channel_member_role AS ENUM ('admin','member');

-- CHANNELS
CREATE TABLE public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  topic text,
  type public.channel_type NOT NULL DEFAULT 'public',
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX channels_client_unique ON public.channels(client_id) WHERE client_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channels TO authenticated;
GRANT ALL ON public.channels TO service_role;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

-- CHANNEL MEMBERS
CREATE TABLE public.channel_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.channel_member_role NOT NULL DEFAULT 'member',
  last_read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);
CREATE INDEX channel_members_user_idx ON public.channel_members(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_members TO authenticated;
GRANT ALL ON public.channel_members TO service_role;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;

-- MESSAGES
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_channel_idx ON public.messages(channel_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Helper: is user member of channel? (SECURITY DEFINER to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_channel_member(_channel_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.channel_members WHERE channel_id = _channel_id AND user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_channel_admin(_channel_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.channel_members WHERE channel_id = _channel_id AND user_id = _user_id AND role = 'admin')
$$;

-- POLICIES: channels
CREATE POLICY "members read channels" ON public.channels FOR SELECT TO authenticated
  USING (public.is_channel_member(id, auth.uid()));
CREATE POLICY "auth create channels" ON public.channels FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "channel admins update" ON public.channels FOR UPDATE TO authenticated
  USING (public.is_channel_admin(id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "channel admins delete" ON public.channels FOR DELETE TO authenticated
  USING (public.is_channel_admin(id, auth.uid()) OR public.has_role(auth.uid(),'admin'));

-- POLICIES: channel_members
CREATE POLICY "members see members" ON public.channel_members FOR SELECT TO authenticated
  USING (public.is_channel_member(channel_id, auth.uid()));
CREATE POLICY "self or admin add members" ON public.channel_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_channel_admin(channel_id, auth.uid())
    OR public.has_role(auth.uid(),'admin')
  );
CREATE POLICY "admin update members" ON public.channel_members FOR UPDATE TO authenticated
  USING (public.is_channel_admin(channel_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "self leave or admin remove" ON public.channel_members FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_channel_admin(channel_id, auth.uid())
    OR public.has_role(auth.uid(),'admin')
  );

-- POLICIES: messages
CREATE POLICY "members read messages" ON public.messages FOR SELECT TO authenticated
  USING (public.is_channel_member(channel_id, auth.uid()));
CREATE POLICY "members send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.is_channel_member(channel_id, auth.uid()));
CREATE POLICY "authors edit messages" ON public.messages FOR UPDATE TO authenticated
  USING (author_id = auth.uid());
CREATE POLICY "authors or channel admins delete" ON public.messages FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_channel_admin(channel_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));

-- Updated_at triggers
CREATE TRIGGER trg_channels_updated BEFORE UPDATE ON public.channels
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-create client channel + add all admins on new client
CREATE OR REPLACE FUNCTION public.tg_client_channel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_channel_id uuid;
BEGIN
  INSERT INTO public.channels(name, topic, type, client_id, created_by)
  VALUES ('cli-' || regexp_replace(lower(NEW.name),'[^a-z0-9]+','-','g'),
          'Canal do cliente ' || NEW.name, 'client', NEW.id, NEW.created_by)
  RETURNING id INTO new_channel_id;

  -- Add creator + all admins/gestores
  INSERT INTO public.channel_members(channel_id, user_id, role)
  SELECT new_channel_id, ur.user_id,
         CASE WHEN ur.role = 'admin' THEN 'admin'::channel_member_role ELSE 'member'::channel_member_role END
  FROM public.user_roles ur
  WHERE ur.role IN ('admin','gestor')
  ON CONFLICT DO NOTHING;

  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.channel_members(channel_id, user_id, role)
    VALUES (new_channel_id, NEW.created_by, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_client_channel AFTER INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.tg_client_channel();

-- On new user, add to all public channels + backfill create #geral if missing
CREATE OR REPLACE FUNCTION public.tg_add_user_to_public_channels()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.channel_members(channel_id, user_id, role)
  SELECT c.id, NEW.id, 'member'
  FROM public.channels c WHERE c.type = 'public'
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_profile_channels AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_add_user_to_public_channels();

-- Seed a #geral channel and add everyone
DO $$
DECLARE gid uuid;
BEGIN
  INSERT INTO public.channels(name, topic, type, created_by)
  VALUES ('geral','Canal geral da equipe','public', NULL)
  RETURNING id INTO gid;

  INSERT INTO public.channel_members(channel_id, user_id, role)
  SELECT gid, p.id, 'member' FROM public.profiles p
  ON CONFLICT DO NOTHING;
END $$;

-- Backfill: create client channels for existing clients
DO $$
DECLARE r record; cid uuid;
BEGIN
  FOR r IN SELECT * FROM public.clients LOOP
    INSERT INTO public.channels(name, topic, type, client_id, created_by)
    VALUES ('cli-' || regexp_replace(lower(r.name),'[^a-z0-9]+','-','g'),
            'Canal do cliente ' || r.name, 'client', r.id, r.created_by)
    RETURNING id INTO cid;

    INSERT INTO public.channel_members(channel_id, user_id, role)
    SELECT cid, ur.user_id, CASE WHEN ur.role='admin' THEN 'admin'::channel_member_role ELSE 'member'::channel_member_role END
    FROM public.user_roles ur WHERE ur.role IN ('admin','gestor')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;
