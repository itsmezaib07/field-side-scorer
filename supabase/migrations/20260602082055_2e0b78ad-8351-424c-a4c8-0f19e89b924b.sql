
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Auto-create profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Teams
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.teams TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams_select_all" ON public.teams FOR SELECT USING (true);
CREATE POLICY "teams_insert_own" ON public.teams FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "teams_update_own" ON public.teams FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "teams_delete_own" ON public.teams FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- Players
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  photo_url TEXT,
  jersey_number INT,
  position TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX players_team_idx ON public.players(team_id);
GRANT SELECT ON public.players TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.players TO authenticated;
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_team_owner(_team_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.teams WHERE id = _team_id AND owner_id = _user_id);
$$;

CREATE POLICY "players_select_all" ON public.players FOR SELECT USING (true);
CREATE POLICY "players_insert_team_owner" ON public.players FOR INSERT TO authenticated WITH CHECK (public.is_team_owner(team_id, auth.uid()));
CREATE POLICY "players_update_team_owner" ON public.players FOR UPDATE TO authenticated USING (public.is_team_owner(team_id, auth.uid()));
CREATE POLICY "players_delete_team_owner" ON public.players FOR DELETE TO authenticated USING (public.is_team_owner(team_id, auth.uid()));

-- Tournaments
CREATE TYPE public.tournament_format AS ENUM ('league', 'knockout');
CREATE TYPE public.tournament_status AS ENUM ('draft', 'active', 'completed');

CREATE TABLE public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  format public.tournament_format NOT NULL DEFAULT 'league',
  status public.tournament_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tournaments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tournaments TO authenticated;
GRANT ALL ON public.tournaments TO service_role;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tournaments_select_all" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "tournaments_insert_self" ON public.tournaments FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "tournaments_update_creator" ON public.tournaments FOR UPDATE TO authenticated USING (auth.uid() = creator_id);
CREATE POLICY "tournaments_delete_creator" ON public.tournaments FOR DELETE TO authenticated USING (auth.uid() = creator_id);

-- Tournament teams
CREATE TABLE public.tournament_teams (
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, team_id)
);
GRANT SELECT ON public.tournament_teams TO anon, authenticated;
GRANT INSERT, DELETE ON public.tournament_teams TO authenticated;
GRANT ALL ON public.tournament_teams TO service_role;
ALTER TABLE public.tournament_teams ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_tournament_admin(_tournament_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.tournaments WHERE id = _tournament_id AND creator_id = _user_id);
$$;

CREATE POLICY "tt_select_all" ON public.tournament_teams FOR SELECT USING (true);
CREATE POLICY "tt_insert_admin" ON public.tournament_teams FOR INSERT TO authenticated WITH CHECK (public.is_tournament_admin(tournament_id, auth.uid()));
CREATE POLICY "tt_delete_admin" ON public.tournament_teams FOR DELETE TO authenticated USING (public.is_tournament_admin(tournament_id, auth.uid()));

-- Match status
CREATE TYPE public.match_status AS ENUM ('scheduled','first_half','halftime','second_half','paused','finished');

-- Matches
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  home_team_id UUID NOT NULL REFERENCES public.teams(id),
  away_team_id UUID NOT NULL REFERENCES public.teams(id),
  scheduled_at TIMESTAMPTZ,
  status public.match_status NOT NULL DEFAULT 'scheduled',
  home_score INT NOT NULL DEFAULT 0,
  away_score INT NOT NULL DEFAULT 0,
  -- Timer state: when running, timer_started_at is set and elapsed = accumulated + (now - started). When paused/halftime, only accumulated counts.
  timer_started_at TIMESTAMPTZ,
  accumulated_seconds INT NOT NULL DEFAULT 0,
  current_half INT NOT NULL DEFAULT 0, -- 0=not started, 1=first, 2=second
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX matches_tournament_idx ON public.matches(tournament_id);
GRANT SELECT ON public.matches TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Scorers assigned to a match
CREATE TABLE public.match_scorers (
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (match_id, user_id)
);
GRANT SELECT ON public.match_scorers TO anon, authenticated;
GRANT INSERT, DELETE ON public.match_scorers TO authenticated;
GRANT ALL ON public.match_scorers TO service_role;
ALTER TABLE public.match_scorers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_score_match(_match_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.matches m
    JOIN public.tournaments t ON t.id = m.tournament_id
    WHERE m.id = _match_id AND t.creator_id = _user_id
  ) OR EXISTS(
    SELECT 1 FROM public.match_scorers WHERE match_id = _match_id AND user_id = _user_id
  );
$$;

CREATE POLICY "matches_select_all" ON public.matches FOR SELECT USING (true);
CREATE POLICY "matches_insert_admin" ON public.matches FOR INSERT TO authenticated WITH CHECK (public.is_tournament_admin(tournament_id, auth.uid()));
CREATE POLICY "matches_update_scorer" ON public.matches FOR UPDATE TO authenticated USING (public.can_score_match(id, auth.uid()));
CREATE POLICY "matches_delete_admin" ON public.matches FOR DELETE TO authenticated USING (public.is_tournament_admin(tournament_id, auth.uid()));

CREATE POLICY "ms_select_all" ON public.match_scorers FOR SELECT USING (true);
CREATE POLICY "ms_insert_admin" ON public.match_scorers FOR INSERT TO authenticated WITH CHECK (EXISTS(SELECT 1 FROM public.matches m WHERE m.id = match_id AND public.is_tournament_admin(m.tournament_id, auth.uid())));
CREATE POLICY "ms_delete_admin" ON public.match_scorers FOR DELETE TO authenticated USING (EXISTS(SELECT 1 FROM public.matches m WHERE m.id = match_id AND public.is_tournament_admin(m.tournament_id, auth.uid())));

-- Match squads
CREATE TABLE public.match_squads (
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id),
  is_starter BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (match_id, player_id)
);
GRANT SELECT ON public.match_squads TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.match_squads TO authenticated;
GRANT ALL ON public.match_squads TO service_role;
ALTER TABLE public.match_squads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msq_select_all" ON public.match_squads FOR SELECT USING (true);
CREATE POLICY "msq_write_scorer" ON public.match_squads FOR ALL TO authenticated USING (public.can_score_match(match_id, auth.uid())) WITH CHECK (public.can_score_match(match_id, auth.uid()));

-- Match events
CREATE TYPE public.event_type AS ENUM ('goal','yellow_card','red_card','substitution','kickoff','halftime','second_half','fulltime','pause','resume');

CREATE TABLE public.match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  type public.event_type NOT NULL,
  team_id UUID REFERENCES public.teams(id),
  player_id UUID REFERENCES public.players(id),
  assist_player_id UUID REFERENCES public.players(id),
  sub_in_player_id UUID REFERENCES public.players(id),
  minute INT,
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX match_events_match_idx ON public.match_events(match_id, created_at);
GRANT SELECT ON public.match_events TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.match_events TO authenticated;
GRANT ALL ON public.match_events TO service_role;
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "me_select_all" ON public.match_events FOR SELECT USING (true);
CREATE POLICY "me_write_scorer" ON public.match_events FOR ALL TO authenticated USING (public.can_score_match(match_id, auth.uid())) WITH CHECK (public.can_score_match(match_id, auth.uid()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_events;
ALTER TABLE public.matches REPLICA IDENTITY FULL;
ALTER TABLE public.match_events REPLICA IDENTITY FULL;
