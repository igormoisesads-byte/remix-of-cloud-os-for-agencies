
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_type text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_size integer,
  ADD COLUMN IF NOT EXISTS attachment_kind text;

CREATE INDEX IF NOT EXISTS messages_parent_id_idx ON public.messages(parent_id);

-- Allow empty body when there is an attachment
ALTER TABLE public.messages ALTER COLUMN body DROP NOT NULL;
