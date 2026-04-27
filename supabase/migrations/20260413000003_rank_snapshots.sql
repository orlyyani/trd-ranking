-- ============================================================
-- Migration 003: Rank snapshots — required for leaderboard rank delta (↑↓)
-- ============================================================

-- A daily cron inserts one row per player ordered by ELO.
-- The leaderboard joins today's order against yesterday's snapshot to show rank delta.
-- Note: rank delta ≠ ELO delta — two players can swap ranks without ELO changing.
create table public.rank_snapshots (
  snapshot_date  date not null,
  player_id      uuid not null references public.players(id) on delete cascade,
  rank           integer not null,
  elo            integer not null,
  primary key (snapshot_date, player_id)
);