GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_report_payload(text) TO anon, authenticated, service_role;