CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

CREATE OR REPLACE FUNCTION public.tg_client_channel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_channel_id uuid; slug text;
BEGIN
  slug := trim(both '-' from regexp_replace(lower(public.unaccent(NEW.name)), '[^a-z0-9]+', '-', 'g'));
  IF slug = '' THEN slug := 'cliente'; END IF;

  INSERT INTO public.channels(name, topic, type, client_id, created_by)
  VALUES (slug, 'Canal do cliente ' || NEW.name, 'client', NEW.id, NEW.created_by)
  RETURNING id INTO new_channel_id;

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

-- Rename existing client channels using unaccent + client name
UPDATE public.channels ch
SET name = COALESCE(NULLIF(trim(both '-' from regexp_replace(lower(public.unaccent(c.name)), '[^a-z0-9]+', '-', 'g')), ''), 'cliente')
FROM public.clients c
WHERE ch.type = 'client' AND ch.client_id = c.id;