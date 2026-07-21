ALTER TABLE public.client_reports
  ADD COLUMN IF NOT EXISTS ai_content text,
  ADD COLUMN IF NOT EXISTS ai_model text,
  ADD COLUMN IF NOT EXISTS ai_generated_at timestamptz;