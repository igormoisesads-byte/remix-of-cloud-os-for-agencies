CREATE TABLE public.client_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    title text NOT NULL,
    type text NOT NULL,
    url text NOT NULL,
    file_name text,
    file_size integer,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

GRANT ALL ON public.client_documents TO authenticated;
GRANT ALL ON public.client_documents TO service_role;
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage documents of their clients" ON public.client_documents
    FOR ALL TO authenticated USING (true);

ALTER TABLE public.clients ADD COLUMN onboarding_skipped boolean DEFAULT false;