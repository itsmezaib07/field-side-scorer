
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS first_half_stoppage_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS second_half_stoppage_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS second_half_minutes integer,
  ADD COLUMN IF NOT EXISTS first_half_actual_seconds integer,
  ADD COLUMN IF NOT EXISTS second_half_actual_seconds integer;
