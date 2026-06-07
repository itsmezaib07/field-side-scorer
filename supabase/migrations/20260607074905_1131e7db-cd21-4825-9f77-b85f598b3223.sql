-- 1. Schema: make tournament optional; add owner + label + venue
ALTER TABLE public.matches
  ALTER COLUMN tournament_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS creator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS competition_name text,
  ADD COLUMN IF NOT EXISTS location text;

-- Backfill creator_id for existing tournament matches
UPDATE public.matches m
  SET creator_id = t.creator_id
  FROM public.tournaments t
  WHERE m.tournament_id = t.id AND m.creator_id IS NULL;

-- 2. Update can_score_match to allow standalone creators
CREATE OR REPLACE FUNCTION public.can_score_match(_match_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS(
    SELECT 1 FROM public.matches m
    LEFT JOIN public.tournaments t ON t.id = m.tournament_id
    WHERE m.id = _match_id
      AND (t.creator_id = _user_id OR m.creator_id = _user_id)
  ) OR EXISTS(
    SELECT 1 FROM public.match_scorers WHERE match_id = _match_id AND user_id = _user_id
  );
$function$;

-- 3. Update tampering trigger to handle null tournament_id (standalone match creator is the admin)
CREATE OR REPLACE FUNCTION public.prevent_scorer_field_tampering()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_platform_owner(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF OLD.tournament_id IS NOT NULL AND public.is_tournament_admin(OLD.tournament_id, auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF OLD.tournament_id IS NULL AND OLD.creator_id = auth.uid() THEN
    RETURN NEW;
  END IF;
  IF NEW.tournament_id IS DISTINCT FROM OLD.tournament_id
     OR NEW.home_team_id IS DISTINCT FROM OLD.home_team_id
     OR NEW.away_team_id IS DISTINCT FROM OLD.away_team_id
     OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
    RAISE EXCEPTION 'Only tournament admins can modify match assignment fields';
  END IF;
  RETURN NEW;
END;
$function$;

-- 4. Replace insert/delete policies to allow standalone matches
DROP POLICY IF EXISTS "matches_insert_admin" ON public.matches;
CREATE POLICY "matches_insert_admin_or_creator" ON public.matches
  FOR INSERT TO authenticated
  WITH CHECK (
    (tournament_id IS NOT NULL AND public.is_tournament_admin(tournament_id, auth.uid()))
    OR (tournament_id IS NULL AND creator_id = auth.uid())
  );

DROP POLICY IF EXISTS "matches_delete_admin" ON public.matches;
CREATE POLICY "matches_delete_admin_or_creator" ON public.matches
  FOR DELETE TO authenticated
  USING (
    (tournament_id IS NOT NULL AND public.is_tournament_admin(tournament_id, auth.uid()))
    OR (tournament_id IS NULL AND creator_id = auth.uid())
  );

-- 5. Allow match_events insert/update/delete by standalone match creator
DROP POLICY IF EXISTS "match_events_insert_admin" ON public.match_events;
DROP POLICY IF EXISTS "match_events_update_admin" ON public.match_events;
DROP POLICY IF EXISTS "match_events_delete_admin" ON public.match_events;
-- (Re-create using can_score_match which now covers standalone creators)
CREATE POLICY "match_events_write_scorer" ON public.match_events
  FOR ALL TO authenticated
  USING (public.can_score_match(match_id, auth.uid()))
  WITH CHECK (public.can_score_match(match_id, auth.uid()));