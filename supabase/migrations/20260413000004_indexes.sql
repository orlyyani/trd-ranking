-- ============================================================
-- Migration 004: Indexes
-- ============================================================

-- matches — foreign key lookups and chronological replay
create index on public.matches (winner_id);
create index on public.matches (loser_id);
create index on public.matches (date desc);

-- match_players — fetching all matches for a player
create index on public.match_players (player_id);

-- elo_history — player ELO timeline (sparkline, recalc)
create index on public.elo_history (player_id, created_at desc);

-- rank_snapshots — daily rank lookup for leaderboard delta
create index on public.rank_snapshots (snapshot_date desc, rank);