CREATE OR REPLACE FUNCTION public.tg_bootstrap_superadmin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF lower(NEW.email) = 'igormoises.ads@gmail.com' THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'superadmin') ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_bootstrap_superadmin ON public.profiles;
CREATE TRIGGER trg_bootstrap_superadmin AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_bootstrap_superadmin();