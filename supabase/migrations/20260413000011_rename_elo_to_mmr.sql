-- ============================================================
-- Migration 011: Rename ELO → MMR throughout the schema
-- ============================================================

-- ── players table ────────────────────────────────────────────────────────────
ALTER TABLE public.players RENAME COLUMN elo TO mmr;

-- ── elo_history table ────────────────────────────────────────────────────────
-- Generated column must be dropped before renaming its source columns.
ALTER TABLE public.elo_history DROP COLUMN delta;
ALTER TABLE public.elo_history RENAME COLUMN elo_before TO mmr_before;
ALTER TABLE public.elo_history RENAME COLUMN elo_after  TO mmr_after;
ALTER TABLE public.elo_history
  ADD COLUMN delta integer GENERATED ALWAYS AS (mmr_after - mmr_before) STORED;

-- ── rank_snapshots table ─────────────────────────────────────────────────────
ALTER TABLE public.rank_snapshots RENAME COLUMN elo TO mmr;

-- ── recalculate_all_mmr() ────────────────────────────────────────────────────
-- Replaces recalculate_all_elo() with identical logic but updated column names.
-- K-factor will be upgraded to variable K in migration 012.
CREATE OR REPLACE FUNCTION public.recalculate_all_mmr()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec        record;
  winner_mmr integer;
  loser_mmr  integer;
  expected_w float;
  expected_l float;
  new_w_mmr  integer;
  new_l_mmr  integer;
  k          CONSTANT integer := 32;
BEGIN
  UPDATE public.players SET mmr = 1000, wins = 0, losses = 0 WHERE true;
  TRUNCATE public.elo_history;

  FOR rec IN
    SELECT id, winner_id, loser_id
    FROM   public.matches
    ORDER  BY date ASC, created_at ASC
  LOOP
    SELECT mmr INTO winner_mmr FROM public.players WHERE id = rec.winner_id;
    SELECT mmr INTO loser_mmr  FROM public.players WHERE id = rec.loser_id;

    expected_w := 1.0 / (1.0 + POWER(10.0, (loser_mmr  - winner_mmr)::float / 400.0));
    expected_l := 1.0 / (1.0 + POWER(10.0, (winner_mmr - loser_mmr)::float  / 400.0));

    new_w_mmr := ROUND(winner_mmr + k * (1.0 - expected_w));
    new_l_mmr := ROUND(loser_mmr  + k * (0.0 - expected_l));

    INSERT INTO public.elo_history (match_id, player_id, mmr_before, mmr_after)
    VALUES
      (rec.id, rec.winner_id, winner_mmr, new_w_mmr),
      (rec.id, rec.loser_id,  loser_mmr,  new_l_mmr);

    UPDATE public.players SET mmr = new_w_mmr, wins   = wins   + 1 WHERE id = rec.winner_id;
    UPDATE public.players SET mmr = new_l_mmr, losses = losses + 1 WHERE id = rec.loser_id;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recalculate_all_mmr() FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.recalculate_all_mmr() TO service_role;

DROP FUNCTION IF EXISTS public.recalculate_all_elo();

-- ── take_rank_snapshot() ─────────────────────────────────────────────────────
-- Recreated to reference the renamed mmr column.
CREATE OR REPLACE FUNCTION public.take_rank_snapshot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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
