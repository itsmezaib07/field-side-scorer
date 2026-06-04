REVOKE EXECUTE ON FUNCTION public.is_team_tournament_admin(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.prevent_scorer_field_tampering() FROM PUBLIC, anon;