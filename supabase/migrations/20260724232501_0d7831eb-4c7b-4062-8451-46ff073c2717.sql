
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid WHERE t.typname='channel_type' AND e.enumlabel='squad') THEN
    ALTER TYPE public.channel_type ADD VALUE 'squad';
  END IF;
END $$;

ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS squad_id uuid REFERENCES public.squads(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_channels_squad_id ON public.channels(squad_id);

CREATE OR REPLACE FUNCTION public.tg_squad_channel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE new_channel_id uuid; slug text;
BEGIN
  slug := trim(both '-' from regexp_replace(lower(public.unaccent(NEW.name)), '[^a-z0-9]+', '-', 'g'));
  IF slug = '' THEN slug := 'squad'; END IF;
  INSERT INTO public.channels(name, topic, type, squad_id, created_by)
  VALUES ('squad-' || slug, 'Canal do squad ' || NEW.name, 'squad'::public.channel_type, NEW.id, NEW.head_user_id)
  RETURNING id INTO new_channel_id;
  IF NEW.head_user_id IS NOT NULL THEN
    INSERT INTO public.channel_members(channel_id, user_id, role)
    VALUES (new_channel_id, NEW.head_user_id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $fn$;

DROP TRIGGER IF EXISTS trg_squad_channel ON public.squads;
CREATE TRIGGER trg_squad_channel AFTER INSERT ON public.squads
FOR EACH ROW EXECUTE FUNCTION public.tg_squad_channel();

CREATE OR REPLACE FUNCTION public.tg_squad_member_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE ch_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT id INTO ch_id FROM public.channels WHERE squad_id = NEW.squad_id LIMIT 1;
    IF ch_id IS NOT NULL THEN
      INSERT INTO public.channel_members(channel_id, user_id, role)
      VALUES (ch_id, NEW.user_id, 'member') ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT id INTO ch_id FROM public.channels WHERE squad_id = OLD.squad_id LIMIT 1;
    IF ch_id IS NOT NULL THEN
      DELETE FROM public.channel_members
       WHERE channel_id = ch_id AND user_id = OLD.user_id
         AND user_id <> COALESCE((SELECT head_user_id FROM public.squads WHERE id = OLD.squad_id), '00000000-0000-0000-0000-000000000000'::uuid);
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $fn$;

DROP TRIGGER IF EXISTS trg_squad_member_sync ON public.squad_members;
CREATE TRIGGER trg_squad_member_sync AFTER INSERT OR DELETE ON public.squad_members
FOR EACH ROW EXECUTE FUNCTION public.tg_squad_member_sync();

CREATE OR REPLACE FUNCTION public.tg_squad_head_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE ch_id uuid;
BEGIN
  IF NEW.head_user_id IS DISTINCT FROM OLD.head_user_id AND NEW.head_user_id IS NOT NULL THEN
    SELECT id INTO ch_id FROM public.channels WHERE squad_id = NEW.id LIMIT 1;
    IF ch_id IS NOT NULL THEN
      INSERT INTO public.channel_members(channel_id, user_id, role)
      VALUES (ch_id, NEW.head_user_id, 'admin')
      ON CONFLICT (channel_id, user_id) DO UPDATE SET role = 'admin';
    END IF;
  END IF;
  RETURN NEW;
END; $fn$;

DROP TRIGGER IF EXISTS trg_squad_head_sync ON public.squads;
CREATE TRIGGER trg_squad_head_sync AFTER UPDATE ON public.squads
FOR EACH ROW EXECUTE FUNCTION public.tg_squad_head_sync();
