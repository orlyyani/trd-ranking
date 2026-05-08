-- Migration 021: Fix take_rank_snapshot — add SET search_path, re-register pg_cron job
--
-- Migration 018 fixed SET search_path on recalculate_* functions but missed
-- take_rank_snapshot(). This also re-attempts the pg_cron schedule in case
-- pg_cron was not enabled when migration 010 ran (the error was silently swallowed).

CREATE OR REPLACE FUNCTION public.take_rank_snapshot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.rank_snapshots (snapshot_date, player_id, rank, mmr)
  SELECT
    current_date,
    id,
    ROW_NUMBER() OVER (ORDER BY mmr DESC, id ASC) AS rank,
    mmr
  FROM public.players
  ON CONFLICT (snapshot_date, player_id) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.take_rank_snapshot() FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.take_rank_snapshot() TO service_role;

-- Re-register the daily cron job.
-- cron.unschedule is a no-op if the job doesn't exist, so this is safe to run
-- even if the job was never created.
DO $$
BEGIN
  PERFORM cron.unschedule('daily-rank-snapshot');
EXCEPTION WHEN others THEN
  NULL; -- job didn't exist, nothing to unschedule
END;
$$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'daily-rank-snapshot',
    '0 0 * * *',
    'SELECT public.take_rank_snapshot()'
  );
EXCEPTION WHEN others THEN
  RAISE NOTICE 'pg_cron not available — enable the extension in Database → Extensions, then run: SELECT cron.schedule(''daily-rank-snapshot'', ''0 0 * * *'', ''SELECT public.take_rank_snapshot()'');';
END;
$$;
