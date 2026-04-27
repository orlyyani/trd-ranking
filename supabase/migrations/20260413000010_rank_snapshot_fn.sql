-- ============================================================
-- Migration 010: take_rank_snapshot() + pg_cron daily schedule
-- ============================================================

-- ── DB function ───────────────────────────────────────────────────────────────
-- Captures the current leaderboard order into rank_snapshots for today.
-- Idempotent: ON CONFLICT DO NOTHING means re-running on the same day is safe.
-- Called by pg_cron daily at midnight and by the Edge Function on demand.

create or replace function public.take_rank_snapshot()
returns void
language plpgsql
security definer
as $$
begin
  insert into public.rank_snapshots (snapshot_date, player_id, rank, elo)
  select
    current_date,
    id,
    row_number() over (order by elo desc, id asc) as rank,
    elo
  from public.players
  on conflict (snapshot_date, player_id) do nothing;
end;
$$;

-- Only service_role may call this directly.
revoke execute on function public.take_rank_snapshot() from public, anon, authenticated;
grant  execute on function public.take_rank_snapshot() to service_role;

-- ── pg_cron schedule ──────────────────────────────────────────────────────────
-- pg_cron must be enabled first. In production Supabase go to:
--   Database → Extensions → search "pg_cron" → enable it
-- In local dev run: create extension if not exists pg_cron;
--
-- The DO block is wrapped in an exception handler so the migration succeeds
-- even if pg_cron is not yet available — the function above still gets created.

do $$
begin
  perform cron.schedule(
    'daily-rank-snapshot',      -- job name (unique)
    '0 0 * * *',               -- every day at 00:00 UTC
    'select public.take_rank_snapshot()'
  );
exception when others then
  raise notice 'pg_cron not available — schedule manually after enabling the extension: %', sqlerrm;
end;
$$;
