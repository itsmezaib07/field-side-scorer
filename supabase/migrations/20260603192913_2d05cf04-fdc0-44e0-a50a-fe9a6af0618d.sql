
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS home_ground text,
  ADD COLUMN IF NOT EXISTS team_colors text,
  ADD COLUMN IF NOT EXISTS contact_info text,
  ADD COLUMN IF NOT EXISTS last_modified_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_modified_by uuid;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS last_modified_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_modified_by uuid;

CREATE OR REPLACE FUNCTION public.set_last_modified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.last_modified_at := now();
  NEW.last_modified_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS teams_set_last_modified ON public.teams;
CREATE TRIGGER teams_set_last_modified
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.set_last_modified();

DROP TRIGGER IF EXISTS players_set_last_modified ON public.players;
CREATE TRIGGER players_set_last_modified
  BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.set_last_modified();
