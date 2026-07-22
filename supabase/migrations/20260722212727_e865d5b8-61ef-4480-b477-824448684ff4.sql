
-- Ad sync tables: writes are done via server admin client; restrict user-facing writes to admin/gestor
drop policy if exists "team write creatives" on public.ad_creatives;
create policy "admins write creatives" on public.ad_creatives for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor'));

drop policy if exists "team write wa funnel" on public.ad_funnel_whatsapp;
create policy "admins write wa funnel" on public.ad_funnel_whatsapp for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor'));

drop policy if exists "team write geo" on public.ad_geo;
create policy "admins write geo" on public.ad_geo for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor'));

drop policy if exists "team can write ad_insights" on public.ad_insights;
create policy "admins write ad_insights" on public.ad_insights for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor'));

drop policy if exists "team can write ad_campaign_insights" on public.ad_campaign_insights;
create policy "admins write ad_campaign_insights" on public.ad_campaign_insights for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor'));

-- Client onboarding stages (created by users during client setup)
drop policy if exists "auth all cos" on public.client_onboarding_stages;
create policy "staff manage cos" on public.client_onboarding_stages for all to authenticated
using (public.is_staff()) with check (public.is_staff());

-- NPS: legacy nps_responses and surveys management
drop policy if exists "auth all nps" on public.nps_responses;
create policy "staff manage nps" on public.nps_responses for all to authenticated
using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth manage surveys" on public.nps_surveys;
create policy "admin manage surveys" on public.nps_surveys for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor'));
