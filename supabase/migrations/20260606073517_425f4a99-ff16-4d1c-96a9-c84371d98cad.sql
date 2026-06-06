
-- Teams: restrict management visibility to owner / platform owner, while still
-- exposing teams that participate in at least one tournament so tournament
-- pages, standings, fixtures, and match reports keep showing them publicly.
DROP POLICY IF EXISTS "teams_select_all" ON public.teams;

CREATE POLICY "teams_select_owner_or_public_participant"
  ON public.teams
  FOR SELECT
  TO anon, authenticated
  USING (
    (auth.uid() IS NOT NULL AND owner_id = auth.uid())
    OR public.is_platform_owner(auth.uid())
    OR EXISTS (SELECT 1 FROM public.tournament_teams tt WHERE tt.team_id = teams.id)
  );

-- Players: mirror the same rule via their team.
DROP POLICY IF EXISTS "players_select_all" ON public.players;

CREATE POLICY "players_select_owner_or_public_participant"
  ON public.players
  FOR SELECT
  TO anon, authenticated
  USING (
    public.is_platform_owner(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = players.team_id
        AND (
          (auth.uid() IS NOT NULL AND t.owner_id = auth.uid())
          OR EXISTS (SELECT 1 FROM public.tournament_teams tt WHERE tt.team_id = t.id)
        )
    )
  );
