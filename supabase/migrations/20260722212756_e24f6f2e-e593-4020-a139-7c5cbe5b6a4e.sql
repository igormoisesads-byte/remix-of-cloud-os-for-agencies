
-- Revoke EXECUTE from public/anon/authenticated on trigger and internal-only SECURITY DEFINER functions.
-- Triggers run as the table owner (postgres), so revoking here does not break them.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.tg_set_updated_at() from public, anon, authenticated;
revoke execute on function public.tg_task_audit() from public, anon, authenticated;
revoke execute on function public.tg_add_user_to_public_channels() from public, anon, authenticated;
revoke execute on function public.tg_clients_audit() from public, anon, authenticated;
revoke execute on function public.tg_pda_audit() from public, anon, authenticated;
revoke execute on function public.tg_generic_client_audit() from public, anon, authenticated;
revoke execute on function public.tg_onboarding_audit() from public, anon, authenticated;
revoke execute on function public.tg_clients_set_code() from public, anon, authenticated;
revoke execute on function public.tg_client_sales_derive() from public, anon, authenticated;
revoke execute on function public.tg_client_channel() from public, anon, authenticated;
revoke execute on function public.tg_public_reports_audit() from public, anon, authenticated;
revoke execute on function public.tg_monthly_fees_audit() from public, anon, authenticated;
revoke execute on function public.tg_task_comments_audit() from public, anon, authenticated;
revoke execute on function public.generate_client_code(uuid, timestamptz) from public, anon, authenticated;

-- Helpers used by RLS policies must remain executable by authenticated
grant execute on function public.has_role(uuid, app_role) to authenticated;
grant execute on function public.is_channel_admin(uuid, uuid) to authenticated;
grant execute on function public.is_channel_member(uuid, uuid) to authenticated;
grant execute on function public.is_staff(uuid) to authenticated;

-- HR RPCs: restrict to authenticated (they already check admin role internally)
revoke execute on function public.get_employee_hr(uuid) from public, anon;
revoke execute on function public.list_employees_hr() from public, anon;
revoke execute on function public.update_employee_hr(uuid, text, text, date, numeric, jsonb) from public, anon;
grant execute on function public.get_employee_hr(uuid) to authenticated;
grant execute on function public.list_employees_hr() to authenticated;
grant execute on function public.update_employee_hr(uuid, text, text, date, numeric, jsonb) to authenticated;
