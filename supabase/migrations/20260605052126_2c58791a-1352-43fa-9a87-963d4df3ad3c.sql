
-- 1. Role enum + user_roles table
CREATE TYPE public.app_role AS ENUM ('platform_owner', 'admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Security definer helpers
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_platform_owner(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'platform_owner')
$$;

-- 3. RLS on user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Platform owner can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_platform_owner(auth.uid()));

CREATE POLICY "Platform owner can manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.is_platform_owner(auth.uid()))
  WITH CHECK (public.is_platform_owner(auth.uid()));

-- 4. Platform owner override policies on all domain tables
CREATE POLICY "Platform owner full access tournaments"
  ON public.tournaments FOR ALL TO authenticated
  USING (public.is_platform_owner(auth.uid()))
  WITH CHECK (public.is_platform_owner(auth.uid()));

CREATE POLICY "Platform owner full access teams"
  ON public.teams FOR ALL TO authenticated
  USING (public.is_platform_owner(auth.uid()))
  WITH CHECK (public.is_platform_owner(auth.uid()));

CREATE POLICY "Platform owner full access players"
  ON public.players FOR ALL TO authenticated
  USING (public.is_platform_owner(auth.uid()))
  WITH CHECK (public.is_platform_owner(auth.uid()));

CREATE POLICY "Platform owner full access matches"
  ON public.matches FOR ALL TO authenticated
  USING (public.is_platform_owner(auth.uid()))
  WITH CHECK (public.is_platform_owner(auth.uid()));

CREATE POLICY "Platform owner full access match_events"
  ON public.match_events FOR ALL TO authenticated
  USING (public.is_platform_owner(auth.uid()))
  WITH CHECK (public.is_platform_owner(auth.uid()));

CREATE POLICY "Platform owner full access match_squads"
  ON public.match_squads FOR ALL TO authenticated
  USING (public.is_platform_owner(auth.uid()))
  WITH CHECK (public.is_platform_owner(auth.uid()));

CREATE POLICY "Platform owner full access match_scorers"
  ON public.match_scorers FOR ALL TO authenticated
  USING (public.is_platform_owner(auth.uid()))
  WITH CHECK (public.is_platform_owner(auth.uid()));

CREATE POLICY "Platform owner full access tournament_teams"
  ON public.tournament_teams FOR ALL TO authenticated
  USING (public.is_platform_owner(auth.uid()))
  WITH CHECK (public.is_platform_owner(auth.uid()));

CREATE POLICY "Platform owner can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_platform_owner(auth.uid()));

-- 5. Update scorer-tamper trigger to allow platform_owner
CREATE OR REPLACE FUNCTION public.prevent_scorer_field_tampering()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_platform_owner(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF public.is_tournament_admin(OLD.tournament_id, auth.uid()) THEN
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
$$;

-- 6. Assign platform_owner to designated account (now or on signup)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'platform_owner'::public.app_role FROM auth.users
WHERE lower(email) = 'p4providerking@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.assign_platform_owner_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF lower(NEW.email) = 'p4providerking@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'platform_owner')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_platform_owner_on_signup_trigger ON auth.users;
CREATE TRIGGER assign_platform_owner_on_signup_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.assign_platform_owner_on_signup();
