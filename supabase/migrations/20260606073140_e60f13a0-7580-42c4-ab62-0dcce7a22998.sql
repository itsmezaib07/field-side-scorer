
-- 1) Private contact info table
CREATE TABLE IF NOT EXISTS public.team_private_contacts (
  team_id uuid PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
  contact_info text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_private_contacts TO authenticated;
GRANT ALL ON public.team_private_contacts TO service_role;

ALTER TABLE public.team_private_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner or platform owner can read contacts"
  ON public.team_private_contacts FOR SELECT TO authenticated
  USING (
    public.is_platform_owner(auth.uid())
    OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.owner_id = auth.uid())
  );

CREATE POLICY "Owner or platform owner can insert contacts"
  ON public.team_private_contacts FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_owner(auth.uid())
    OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.owner_id = auth.uid())
  );

CREATE POLICY "Owner or platform owner can update contacts"
  ON public.team_private_contacts FOR UPDATE TO authenticated
  USING (
    public.is_platform_owner(auth.uid())
    OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.owner_id = auth.uid())
  )
  WITH CHECK (
    public.is_platform_owner(auth.uid())
    OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.owner_id = auth.uid())
  );

CREATE POLICY "Owner or platform owner can delete contacts"
  ON public.team_private_contacts FOR DELETE TO authenticated
  USING (
    public.is_platform_owner(auth.uid())
    OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.owner_id = auth.uid())
  );

-- 2) Migrate existing data, then drop public column
INSERT INTO public.team_private_contacts (team_id, contact_info)
SELECT id, contact_info FROM public.teams WHERE contact_info IS NOT NULL
ON CONFLICT (team_id) DO NOTHING;

ALTER TABLE public.teams DROP COLUMN IF EXISTS contact_info;

-- 3) Lock down SECURITY DEFINER helpers from anonymous callers
REVOKE EXECUTE ON FUNCTION public.is_platform_owner(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.assign_platform_owner_on_signup() FROM PUBLIC, anon, authenticated;
