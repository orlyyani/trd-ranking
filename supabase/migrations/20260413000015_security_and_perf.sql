-- ============================================================
-- Migration 015: Security & performance hardening
-- ============================================================
--
-- Security (2 fixes):
--   SECURITY DEFINER functions with a mutable search_path can be
--   exploited by injecting objects into the caller's search_path.
--   Fix: pin search_path = '' and use fully-qualified names (already done).
--
-- Performance (12 fixes):
--   RLS policies that call auth.uid() directly re-evaluate the function
--   once per row. Wrapping it in a sub-select (select auth.uid()) makes
--   Postgres evaluate it once per statement instead.
-- ============================================================


-- ── 1. Fix search_path on take_rank_snapshot() ───────────────────────────────

CREATE OR REPLACE FUNCTION public.take_rank_snapshot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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


-- ── 2. Fix search_path on recalculate_all_mmr() ──────────────────────────────

CREATE OR REPLACE FUNCTION public.recalculate_all_mmr()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

  TRUNCATE public.elo_history;

  FOR rec IN
    SELECT id, winner_id, loser_id
    FROM   public.matches
    ORDER  BY date ASC, created_at ASC
  LOOP
    SELECT mmr, wins + losses
      INTO winner_mmr, winner_matches
      FROM public.players
     WHERE id = rec.winner_id;

    SELECT mmr, wins + losses
      INTO loser_mmr, loser_matches
      FROM public.players
     WHERE id = rec.loser_id;

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


-- ── 3. Fix RLS policies: wrap auth.uid() in (select auth.uid()) ──────────────
--
-- auth.uid() called directly is re-evaluated per row. The sub-select form
-- is evaluated once per statement and the result is cached — no behavioural
-- change, just a significant speedup on tables with many rows.

-- players
DROP POLICY IF EXISTS "admin insert players" ON public.players;
DROP POLICY IF EXISTS "admin update players" ON public.players;
DROP POLICY IF EXISTS "admin delete players" ON public.players;

CREATE POLICY "admin insert players"
  ON public.players FOR INSERT
  WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM public.admins));

CREATE POLICY "admin update players"
  ON public.players FOR UPDATE
  USING ((select auth.uid()) IN (SELECT user_id FROM public.admins));

CREATE POLICY "admin delete players"
  ON public.players FOR DELETE
  USING ((select auth.uid()) IN (SELECT user_id FROM public.admins));

-- matches
DROP POLICY IF EXISTS "admin insert matches" ON public.matches;
DROP POLICY IF EXISTS "admin update matches" ON public.matches;
DROP POLICY IF EXISTS "admin delete matches" ON public.matches;

CREATE POLICY "admin insert matches"
  ON public.matches FOR INSERT
  WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM public.admins));

CREATE POLICY "admin update matches"
  ON public.matches FOR UPDATE
  USING ((select auth.uid()) IN (SELECT user_id FROM public.admins));

CREATE POLICY "admin delete matches"
  ON public.matches FOR DELETE
  USING ((select auth.uid()) IN (SELECT user_id FROM public.admins));

-- match_players
DROP POLICY IF EXISTS "admin insert match_players" ON public.match_players;
DROP POLICY IF EXISTS "admin update match_players" ON public.match_players;
DROP POLICY IF EXISTS "admin delete match_players" ON public.match_players;

CREATE POLICY "admin insert match_players"
  ON public.match_players FOR INSERT
  WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM public.admins));

CREATE POLICY "admin update match_players"
  ON public.match_players FOR UPDATE
  USING ((select auth.uid()) IN (SELECT user_id FROM public.admins));

CREATE POLICY "admin delete match_players"
  ON public.match_players FOR DELETE
  USING ((select auth.uid()) IN (SELECT user_id FROM public.admins));

-- mvp_votes
DROP POLICY IF EXISTS "auth users insert vote"    ON public.mvp_votes;
DROP POLICY IF EXISTS "auth users delete own vote" ON public.mvp_votes;

CREATE POLICY "auth users insert vote"
  ON public.mvp_votes FOR INSERT
  WITH CHECK ((select auth.uid()) = voter_id);

CREATE POLICY "auth users delete own vote"
  ON public.mvp_votes FOR DELETE
  USING ((select auth.uid()) = voter_id);

-- admins
DROP POLICY IF EXISTS "admins can read own row" ON public.admins;

CREATE POLICY "admins can read own row"
  ON public.admins FOR SELECT
  USING ((select auth.uid()) = user_id);
