-- ============================================================
-- Migration 012: Player tier + variable K-factor MMR recalculation
-- ============================================================

-- ── 1. Player tier enum + column ─────────────────────────────────────────────
CREATE TYPE public.player_tier AS ENUM ('unranked', 'beginner', 'class_c');

ALTER TABLE public.players
  ADD COLUMN tier public.player_tier NOT NULL DEFAULT 'unranked';

-- ── 2. Replace recalculate_all_mmr() with K-factor-aware version ──────────────
--
-- Tier-based starting MMR:
--   class_c  → 1950  (midpoint of 1900–2000 per TENNIS_ELO_SYSTEM.md)
--   beginner → 1200
--   unranked → 1000
--
-- Variable K-factor per TENNIS_ELO_SYSTEM.md:
--   First 10 matches: K = 40
--   After 10 matches: K = 20
--
-- K is applied per-player independently. When a veteran (K=20) beats a
-- newcomer (K=40), each player's change is calculated with their own K.
--
-- wins + losses during replay equals the count of matches already processed
-- for that player in the current iteration — correct because we increment
-- those counters as part of the loop.

CREATE OR REPLACE FUNCTION public.recalculate_all_mmr()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec             record;
  winner_mmr      integer;
  loser_mmr       integer;
  winner_matches  integer;
  loser_matches   integer;
  k_winner        integer;
  k_loser         integer;
  expected_w      float;
  expected_l      float;
  new_w_mmr       integer;
  new_l_mmr       integer;
BEGIN
  -- 1. Reset all players to their tier-based starting MMR.
  UPDATE public.players
  SET
    mmr = CASE tier
            WHEN 'class_c'  THEN 1950
            WHEN 'beginner' THEN 1200
            ELSE 1000
          END,
    wins   = 0,
    losses = 0
  WHERE true;

  -- 2. Clear MMR history for clean replay.
  TRUNCATE public.elo_history;

  -- 3. Replay every match in strict chronological order.
  FOR rec IN
    SELECT id, winner_id, loser_id
    FROM   public.matches
    ORDER  BY date ASC, created_at ASC
  LOOP
    -- Read current MMR and match count (before this iteration).
    SELECT mmr, wins + losses
      INTO winner_mmr, winner_matches
      FROM public.players
     WHERE id = rec.winner_id;

    SELECT mmr, wins + losses
      INTO loser_mmr, loser_matches
      FROM public.players
     WHERE id = rec.loser_id;

    -- K=40 for first 10 matches per player, K=20 thereafter.
    k_winner := CASE WHEN winner_matches < 10 THEN 40 ELSE 20 END;
    k_loser  := CASE WHEN loser_matches  < 10 THEN 40 ELSE 20 END;

    expected_w := 1.0 / (1.0 + POWER(10.0, (loser_mmr  - winner_mmr)::float / 400.0));
    expected_l := 1.0 / (1.0 + POWER(10.0, (winner_mmr - loser_mmr)::float  / 400.0));

    new_w_mmr := ROUND(winner_mmr + k_winner * (1.0 - expected_w));
    new_l_mmr := ROUND(loser_mmr  + k_loser  * (0.0 - expected_l));

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
