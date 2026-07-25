
-- Tighten clients INSERT/UPDATE to staff only
DROP POLICY IF EXISTS "team updates clients" ON public.clients;
DROP POLICY IF EXISTS "team creates clients" ON public.clients;

CREATE POLICY "staff creates clients" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "staff updates clients" ON public.clients
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- Tighten task_checklist_items to staff
DROP POLICY IF EXISTS "team write checklist" ON public.task_checklist_items;

CREATE POLICY "staff manages checklist" ON public.task_checklist_items
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));
