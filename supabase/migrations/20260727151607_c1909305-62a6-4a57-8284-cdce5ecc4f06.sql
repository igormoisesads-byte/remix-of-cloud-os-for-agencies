CREATE OR REPLACE FUNCTION public.tg_generic_client_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE action_label text; descr text;
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

  IF TG_TABLE_NAME = 'client_access' THEN
    descr := COALESCE(NEW.platform, '');
  ELSIF TG_TABLE_NAME IN ('nps_responses','health_scores') THEN
    descr := COALESCE(NEW.score::text, '');
  ELSE
    descr := COALESCE(NEW.title, '');
  END IF;

  INSERT INTO public.client_activities(client_id,user_id,action,description,entity_type,entity_id)
  VALUES (NEW.client_id, COALESCE(NEW.created_by, auth.uid()), action_label, descr, TG_TABLE_NAME, NEW.id);
  RETURN NEW;
END; $function$;