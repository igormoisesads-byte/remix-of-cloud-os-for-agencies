
CREATE TYPE public.task_status AS ENUM ('todo','doing','review','done');
CREATE TYPE public.task_priority AS ENUM ('baixa','media','alta','urgente');
CREATE TYPE public.task_kind AS ENUM ('kickoff','rotina','demanda','auditoria');

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status public.task_status NOT NULL DEFAULT 'todo',
  priority public.task_priority NOT NULL DEFAULT 'media',
  kind public.task_kind NOT NULL DEFAULT 'demanda',
  due_date DATE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  position INT NOT NULL DEFAULT 0,
  done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team can view tasks" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "team can insert tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "team can update tasks" ON public.tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "team can delete tasks" ON public.tasks FOR DELETE TO authenticated USING (true);

CREATE TRIGGER tasks_set_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_client ON public.tasks(client_id);
CREATE INDEX idx_tasks_assignee ON public.tasks(assignee_id);
CREATE INDEX idx_tasks_due ON public.tasks(due_date);

CREATE TABLE public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comments TO authenticated;
GRANT ALL ON public.task_comments TO service_role;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team can view comments" ON public.task_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "team can insert comments" ON public.task_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "author can edit comments" ON public.task_comments FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "author can delete comments" ON public.task_comments FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- Auditoria automática: quando tarefa vinculada a cliente é criada/muda status/é concluída, registra em client_activities
CREATE OR REPLACE FUNCTION public.tg_task_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.client_id IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.client_activities (client_id, user_id, action, description)
    VALUES (NEW.client_id, COALESCE(NEW.created_by, auth.uid()),
      'Tarefa criada',
      NEW.title || ' [' || NEW.kind || ']');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.client_activities (client_id, user_id, action, description)
    VALUES (NEW.client_id, auth.uid(),
      CASE WHEN NEW.status = 'done' THEN 'Tarefa concluída' ELSE 'Tarefa movida' END,
      NEW.title || ' → ' || NEW.status);
    IF NEW.status = 'done' AND OLD.status <> 'done' THEN
      NEW.done_at = now();
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER tasks_audit
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tg_task_audit();
