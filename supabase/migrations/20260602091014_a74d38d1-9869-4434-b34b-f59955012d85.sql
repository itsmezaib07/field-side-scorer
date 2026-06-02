
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS minutes_per_half integer NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS number_of_halves integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS extra_time_minutes_per_half integer NOT NULL DEFAULT 0;
