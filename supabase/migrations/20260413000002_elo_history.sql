-- ============================================================
-- Migration 002: ELO history — audit trail for idempotent recalculation
-- ============================================================

-- Every ELO change is recorded here. Replaying all rows in order
-- from this table (or from matches) always reconstructs players.elo exactly.
create table public.elo_history (
  id          bigint generated always as identity primary key,
  match_id    uuid not null references public.matches(id) on delete cascade,
  player_id   uuid not null references public.players(id),
  elo_before  integer not null,
  elo_after   integer not null,
  delta       integer generated always as (elo_after - elo_before) stored,
  created_at  timestamptz not null default now()
);