ALTER FUNCTION public.record_task_status_change() SET search_path = public;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('commission_tiers','team reads tiers'),('niches','auth read niches'),
    ('onboarding_template_stages','auth read stages'),('onboarding_template_tasks','auth read tmpl tasks'),
    ('onboarding_templates','auth read tmpl'),('plans','team reads plans'),
    ('role_analises','read ana'),('role_attribuicoes','read attr'),('role_kpis','read kpi'),
    ('role_reunioes','read reu'),('role_rotinas','read rot'),('role_templates','read templates'),
    ('task_checklist_items','team read checklist'),('task_comments','team can view comments'),
    ('task_status_history','Users can see all task history'),('tasks','team can view tasks'),
    ('app_settings','everyone read app_settings')
  ) v(t,p) LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I USING (public.is_staff(auth.uid()))', r.p, r.t);
  END LOOP;

  FOR r IN SELECT * FROM (VALUES
    ('ad_campaign_insights','team can view ad_campaign_insights'),('ad_creatives','team read creatives'),
    ('ad_funnel_whatsapp','team read wa funnel'),('ad_geo','team read geo'),
    ('ad_hourly_leads','read ad_hourly_leads'),('ad_insights','team can view ad_insights')
  ) v(t,p) LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I USING (EXISTS (SELECT 1 FROM public.ad_accounts a WHERE a.id = ad_account_id AND public.user_can_see_client(a.client_id, auth.uid())))', r.p, r.t);
  END LOOP;
END $$;

ALTER POLICY "Users can manage documents of their clients" ON public.client_documents
  USING (public.user_can_see_client(client_id, auth.uid()))
  WITH CHECK (public.user_can_see_client(client_id, auth.uid()));

ALTER POLICY "team can insert tasks" ON public.tasks
  WITH CHECK (public.is_staff(auth.uid()) AND (created_by IS NULL OR created_by = auth.uid()));

ALTER POLICY chat_att_read ON storage.objects
  USING (bucket_id = 'chat-attachments' AND public.is_staff(auth.uid()));