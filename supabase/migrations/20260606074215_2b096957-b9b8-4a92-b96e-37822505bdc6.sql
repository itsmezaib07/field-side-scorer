-- Server-side match reconciliation: auto-ends matches that have exceeded their
-- configured duration + stoppage + grace window, even when no client is open.

CREATE OR REPLACE FUNCTION public.reconcile_match(_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m RECORD;
  base_mph int;
  fh_limit int;
  sh_min int;
  sh_limit int;
  grace_sec int := 45;
  hard_wall_hours int := 12;
  elapsed int;
  first_actual int;
  second_elapsed int;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = _match_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF m.status NOT IN ('first_half','second_half','paused','halftime') THEN RETURN; END IF;

  base_mph := COALESCE(m.minutes_per_half, 45);
  fh_limit := base_mph * 60 + COALESCE(m.first_half_stoppage_seconds, 0);
  sh_min   := COALESCE(m.second_half_minutes, base_mph);
  sh_limit := sh_min * 60 + COALESCE(m.second_half_stoppage_seconds, 0);

  elapsed := COALESCE(m.accumulated_seconds, 0);
  IF m.timer_started_at IS NOT NULL AND m.status IN ('first_half','second_half') THEN
    elapsed := elapsed + GREATEST(0, EXTRACT(EPOCH FROM (now() - m.timer_started_at))::int);
  END IF;

  first_actual := COALESCE(m.first_half_actual_seconds, 0);

  -- Hard wall: any live/paused/halftime match older than N hours since kickoff is force-finished.
  IF m.actual_started_at IS NOT NULL
     AND (now() - m.actual_started_at) > make_interval(hours => hard_wall_hours) THEN
    UPDATE public.matches SET
      status = 'finished',
      timer_started_at = NULL,
      first_half_actual_seconds = COALESCE(NULLIF(first_actual, 0), fh_limit),
      second_half_actual_seconds = sh_limit,
      accumulated_seconds = COALESCE(NULLIF(first_actual, 0), fh_limit) + sh_limit
    WHERE id = _match_id;
    INSERT INTO public.match_events (match_id, type, minute)
      VALUES (_match_id, 'fulltime', GREATEST(1, (COALESCE(NULLIF(first_actual, 0), fh_limit) + sh_limit) / 60));
    RETURN;
  END IF;

  -- Auto-end first half once configured + stoppage + grace has passed.
  IF m.status = 'first_half' AND elapsed >= fh_limit + grace_sec THEN
    first_actual := LEAST(elapsed, fh_limit);
    UPDATE public.matches SET
      status = 'halftime',
      timer_started_at = NULL,
      accumulated_seconds = first_actual,
      first_half_actual_seconds = first_actual,
      second_half_minutes = sh_min
    WHERE id = _match_id;
    INSERT INTO public.match_events (match_id, type, minute)
      VALUES (_match_id, 'halftime', GREATEST(1, first_actual / 60));
    SELECT * INTO m FROM public.matches WHERE id = _match_id;
    elapsed := COALESCE(m.accumulated_seconds, 0);
    first_actual := COALESCE(m.first_half_actual_seconds, 0);
  END IF;

  -- Auto-end match once second half has exceeded its limit + grace.
  IF m.status = 'second_half' THEN
    second_elapsed := GREATEST(0, elapsed - first_actual);
    IF second_elapsed >= sh_limit + grace_sec THEN
      UPDATE public.matches SET
        status = 'finished',
        timer_started_at = NULL,
        accumulated_seconds = first_actual + LEAST(second_elapsed, sh_limit),
        second_half_actual_seconds = LEAST(second_elapsed, sh_limit)
      WHERE id = _match_id;
      INSERT INTO public.match_events (match_id, type, minute)
        VALUES (_match_id, 'fulltime', GREATEST(1, (first_actual + LEAST(second_elapsed, sh_limit)) / 60));
    END IF;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reconcile_match(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_match(uuid) TO authenticated, service_role;

-- Sweep all live matches (called by pg_cron).
CREATE OR REPLACE FUNCTION public.reconcile_live_matches()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM public.matches
    WHERE status IN ('first_half','second_half','paused','halftime')
  LOOP
    PERFORM public.reconcile_match(r.id);
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reconcile_live_matches() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_live_matches() TO service_role;

-- Schedule sweep every 2 minutes via pg_cron.
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-live-matches') THEN
    PERFORM cron.unschedule('reconcile-live-matches');
  END IF;
END $$;

SELECT cron.schedule(
  'reconcile-live-matches',
  '*/2 * * * *',
  $$ SELECT public.reconcile_live_matches(); $$
);
