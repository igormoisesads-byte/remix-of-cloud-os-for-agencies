-- limpar dependências das tarefas órfãs de rotina (clientes já excluídos)
DELETE FROM public.task_checklist_items WHERE task_id IN (SELECT id FROM public.tasks WHERE client_id IS NULL AND kind = 'rotina');
DELETE FROM public.task_comments WHERE task_id IN (SELECT id FROM public.tasks WHERE client_id IS NULL AND kind = 'rotina');
DELETE FROM public.task_status_history WHERE task_id IN (SELECT id FROM public.tasks WHERE client_id IS NULL AND kind = 'rotina');
UPDATE public.messages SET task_id = NULL WHERE task_id IN (SELECT id FROM public.tasks WHERE client_id IS NULL AND kind = 'rotina');
DELETE FROM public.tasks WHERE client_id IS NULL AND kind = 'rotina';

-- daqui em diante, excluir um cliente remove suas tarefas
ALTER TABLE public.tasks DROP CONSTRAINT tasks_client_id_fkey;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;