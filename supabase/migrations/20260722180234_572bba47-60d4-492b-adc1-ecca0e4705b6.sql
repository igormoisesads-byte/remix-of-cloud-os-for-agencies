
CREATE OR REPLACE FUNCTION public.tg_clients_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.client_activities(client_id,user_id,action,description,entity_type,entity_id)
  VALUES (NEW.id, COALESCE(NEW.created_by, auth.uid()), 'Cliente criado',
          NEW.name || COALESCE(' · '||NEW.codigo,''), 'client', NEW.id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_clients_audit ON public.clients;
CREATE TRIGGER trg_clients_audit AFTER INSERT ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.tg_clients_audit();

CREATE OR REPLACE FUNCTION public.tg_public_reports_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.client_activities(client_id,user_id,action,description,entity_type,entity_id)
  VALUES (NEW.client_id, COALESCE(NEW.created_by, auth.uid()), 'Link do relatório criado',
          COALESCE(NEW.title,'Relatório público'), 'public_report', NEW.id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_public_reports_audit ON public.public_reports;
CREATE TRIGGER trg_public_reports_audit AFTER INSERT ON public.public_reports
FOR EACH ROW EXECUTE FUNCTION public.tg_public_reports_audit();

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
      CASE WHEN NEW.status='paid' THEN 'Mensalidade paga' ELSE 'Mensalidade '||NEW.status END,
      to_char(NEW.reference_month,'MM/YYYY')||' · R$ '||NEW.amount, 'monthly_fee', NEW.id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_monthly_fees_audit ON public.monthly_fees;
CREATE TRIGGER trg_monthly_fees_audit AFTER INSERT OR UPDATE ON public.monthly_fees
FOR EACH ROW EXECUTE FUNCTION public.tg_monthly_fees_audit();

CREATE OR REPLACE FUNCTION public.tg_task_comments_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client uuid; v_title text;
BEGIN
  SELECT client_id, title INTO v_client, v_title FROM public.tasks WHERE id = NEW.task_id;
  IF v_client IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.client_activities(client_id,user_id,action,description,entity_type,entity_id)
  VALUES (v_client, COALESCE(NEW.user_id, auth.uid()), 'Comentário na tarefa',
          v_title||': '||left(NEW.body, 140), 'task_comment', NEW.id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_task_comments_audit ON public.task_comments;
CREATE TRIGGER trg_task_comments_audit AFTER INSERT ON public.task_comments
FOR EACH ROW EXECUTE FUNCTION public.tg_task_comments_audit();

-- Backfill
INSERT INTO public.client_activities(client_id,user_id,action,description,entity_type,entity_id,created_at)
SELECT c.id, c.created_by, 'Cliente criado',
       c.name || COALESCE(' · '||c.codigo,''), 'client', c.id, c.created_at
FROM public.clients c
WHERE NOT EXISTS (SELECT 1 FROM public.client_activities a WHERE a.client_id = c.id AND a.entity_type='client');

INSERT INTO public.client_activities(client_id,user_id,action,description,entity_type,entity_id,created_at)
SELECT pr.client_id, pr.created_by, 'Link do relatório criado',
       COALESCE(pr.title,'Relatório público'), 'public_report', pr.id, pr.created_at
FROM public.public_reports pr
WHERE NOT EXISTS (SELECT 1 FROM public.client_activities a WHERE a.entity_type='public_report' AND a.entity_id = pr.id);

INSERT INTO public.client_activities(client_id,user_id,action,description,entity_type,entity_id,created_at)
SELECT mf.client_id, NULL, 'Mensalidade criada',
       to_char(mf.reference_month,'MM/YYYY')||' · R$ '||mf.amount, 'monthly_fee', mf.id, mf.created_at
FROM public.monthly_fees mf
WHERE NOT EXISTS (SELECT 1 FROM public.client_activities a WHERE a.entity_type='monthly_fee' AND a.entity_id = mf.id);
