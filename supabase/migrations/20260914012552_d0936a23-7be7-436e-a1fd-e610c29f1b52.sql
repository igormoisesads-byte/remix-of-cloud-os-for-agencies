DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'tasks',
    'task_checklist_items',
    'task_comments',
    'task_status_history',
    'monthly_fees',
    'clients',
    'client_activities',
    'client_documents',
    'onboarding_tasks',
    'profiles',
    'user_roles',
    'expenses',
    'pdas',
    'pda_action_steps',
    'nps_responses',
    'client_sales'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = v_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
    END IF;
  END LOOP;
END
$$;