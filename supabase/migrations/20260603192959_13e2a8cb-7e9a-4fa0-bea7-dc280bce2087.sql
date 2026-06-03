
CREATE OR REPLACE FUNCTION public.is_team_tournament_admin(_team_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tournament_teams tt
    JOIN public.tournaments t ON t.id = tt.tournament_id
    WHERE tt.team_id = _team_id AND t.creator_id = _user_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_team_tournament_admin(uuid, uuid) FROM anon;

DROP POLICY IF EXISTS teams_update_own ON public.teams;
CREATE POLICY teams_update_own ON public.teams
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR public.is_team_tournament_admin(id, auth.uid()));

DROP POLICY IF EXISTS players_update_team_owner ON public.players;
CREATE POLICY players_update_team_owner ON public.players
  FOR UPDATE TO authenticated
  USING (public.is_team_owner(team_id, auth.uid()) OR public.is_team_tournament_admin(team_id, auth.uid()));
