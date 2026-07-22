
-- Helper: staff = any user with a role assigned
create or replace function public.is_staff(_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.user_roles where user_id = _uid) $$;

-- ============ CRITICAL FIXES ============

-- ad_accounts: contains OAuth tokens/balances
drop policy if exists "team can view ad_accounts" on public.ad_accounts;
create policy "staff read ad_accounts" on public.ad_accounts for select to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor') or public.has_role(auth.uid(),'financeiro'));

-- ad_creatives / ad_funnel_whatsapp / ad_geo: drop anon read (public report uses admin server fn)
drop policy if exists "anon read creatives" on public.ad_creatives;
drop policy if exists "anon read wa funnel" on public.ad_funnel_whatsapp;
drop policy if exists "anon read geo" on public.ad_geo;

-- client_access: plaintext credentials
drop policy if exists "auth all access" on public.client_access;
create policy "admins manage client_access" on public.client_access for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor'));

-- profiles: personal HR data (salary, phone)
drop policy if exists "authenticated can read profiles" on public.profiles;
create policy "self or admin read profiles" on public.profiles for select to authenticated
using (id = auth.uid() or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'superadmin') or public.has_role(auth.uid(),'gestor'));

-- ============ WARNING FIXES ============

-- ad_billing_transactions
drop policy if exists "billing_tx_read_auth" on public.ad_billing_transactions;
create policy "finance read billing_tx" on public.ad_billing_transactions for select to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor') or public.has_role(auth.uid(),'financeiro'));

-- clients (contact/financial)
drop policy if exists "team reads clients" on public.clients;
create policy "staff read clients" on public.clients for select to authenticated using (public.is_staff());

-- client_activities
drop policy if exists "team reads activity" on public.client_activities;
create policy "staff read activity" on public.client_activities for select to authenticated using (public.is_staff());

-- client_reports
drop policy if exists "auth all reports" on public.client_reports;
create policy "staff manage reports" on public.client_reports for all to authenticated
using (public.is_staff()) with check (public.is_staff());

-- client_routines
drop policy if exists "auth all routines" on public.client_routines;
create policy "staff manage routines" on public.client_routines for all to authenticated
using (public.is_staff()) with check (public.is_staff());

-- client_sales
drop policy if exists "auth users manage client_sales" on public.client_sales;
create policy "staff manage client_sales" on public.client_sales for all to authenticated
using (public.is_staff()) with check (public.is_staff());

-- health_scores
drop policy if exists "auth all hs" on public.health_scores;
create policy "staff manage health_scores" on public.health_scores for all to authenticated
using (public.is_staff()) with check (public.is_staff());

-- meetings
drop policy if exists "auth all meetings" on public.meetings;
create policy "staff manage meetings" on public.meetings for all to authenticated
using (public.is_staff()) with check (public.is_staff());

-- monthly_fees read
drop policy if exists "team reads fees" on public.monthly_fees;
create policy "finance read fees" on public.monthly_fees for select to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor') or public.has_role(auth.uid(),'financeiro'));

-- moodboards
drop policy if exists "auth all mb" on public.moodboards;
create policy "staff manage moodboards" on public.moodboards for all to authenticated
using (public.is_staff()) with check (public.is_staff());

-- nps_survey_responses read
drop policy if exists "auth read responses" on public.nps_survey_responses;
drop policy if exists "auth manage responses" on public.nps_survey_responses;
create policy "admin read nps responses" on public.nps_survey_responses for select to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor'));
create policy "admin manage nps responses" on public.nps_survey_responses for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor'));

-- onboarding_tasks
drop policy if exists "team manages onboarding" on public.onboarding_tasks;
create policy "staff manage onboarding_tasks" on public.onboarding_tasks for all to authenticated
using (public.is_staff()) with check (public.is_staff());

-- pdas / pda_action_steps
drop policy if exists "auth all pdas" on public.pdas;
create policy "staff manage pdas" on public.pdas for all to authenticated
using (public.is_staff()) with check (public.is_staff());
drop policy if exists "auth all pda steps" on public.pda_action_steps;
create policy "staff manage pda_steps" on public.pda_action_steps for all to authenticated
using (public.is_staff()) with check (public.is_staff());

-- tasks writes (update/delete) — keep insert/select for team
drop policy if exists "team can update tasks" on public.tasks;
drop policy if exists "team can delete tasks" on public.tasks;
create policy "staff update tasks" on public.tasks for update to authenticated
using (public.is_staff()) with check (public.is_staff());
create policy "staff delete tasks" on public.tasks for delete to authenticated
using (public.is_staff());
