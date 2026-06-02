
-- 1) Prevent scorers (non-admins) from changing immutable match fields
CREATE OR REPLACE FUNCTION public.prevent_scorer_field_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Tournament admins can change anything
  IF public.is_tournament_admin(OLD.tournament_id, auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Non-admin scorers must not change structural fields
  IF NEW.tournament_id IS DISTINCT FROM OLD.tournament_id
     OR NEW.home_team_id IS DISTINCT FROM OLD.home_team_id
     OR NEW.away_team_id IS DISTINCT FROM OLD.away_team_id
     OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
    RAISE EXCEPTION 'Only tournament admins can modify match assignment fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS matches_prevent_scorer_tampering ON public.matches;
CREATE TRIGGER matches_prevent_scorer_tampering
BEFORE UPDATE ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.prevent_scorer_field_tampering();

-- 2) Lock down handle_new_user — only the auth trigger should ever call it
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
