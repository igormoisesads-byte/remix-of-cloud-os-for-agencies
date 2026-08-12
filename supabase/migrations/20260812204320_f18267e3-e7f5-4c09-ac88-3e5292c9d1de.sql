CREATE OR REPLACE FUNCTION public.tg_monthly_fees_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO public.client_activities(client_id,user_id,action,description,entity_type,entity_id)
    VALUES (NEW.client_id, auth.uid(), 'Mensalidade criada',
            to_char(NEW.reference_month,'MM/YYYY')||' · R$ '||NEW.amount, 'monthly_fee', NEW.id);
  ELSIF TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.client_activities(client_id,user_id,action,description,entity_type,entity_id)
    VALUES (NEW.client_id, auth.uid(),
      CASE WHEN NEW.status='pago' THEN 'Mensalidade paga' ELSE 'Mensalidade '||NEW.status END,
      to_char(NEW.reference_month,'MM/YYYY')||' · R$ '||NEW.amount, 'monthly_fee', NEW.id);
  END IF;
  RETURN NEW;
END $$;