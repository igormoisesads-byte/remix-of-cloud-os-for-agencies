CREATE OR REPLACE FUNCTION public.tg_clients_set_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    IF NEW.niche_id IS NOT NULL THEN
      NEW.codigo := public.generate_client_code(NEW.niche_id, COALESCE(NEW.created_at, now()));
    END IF;
  END IF;
  RETURN NEW;
END $function$;

GRANT EXECUTE ON FUNCTION public.generate_client_code(uuid, timestamp with time zone) TO authenticated;