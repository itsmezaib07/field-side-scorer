ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS archived_at timestamptz;