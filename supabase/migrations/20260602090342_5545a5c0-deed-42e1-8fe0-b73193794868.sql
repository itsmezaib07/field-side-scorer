
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'foul';

ALTER TABLE public.match_events
  ADD COLUMN IF NOT EXISTS foul_outcome text,
  ADD COLUMN IF NOT EXISTS card_type text,
  ADD COLUMN IF NOT EXISTS card_player_id uuid REFERENCES public.players(id);
