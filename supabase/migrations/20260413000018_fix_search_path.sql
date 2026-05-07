-- ============================================================
-- Migration 018: Fix mutable search_path on SECURITY DEFINER functions
-- ============================================================
-- Without SET search_path, a SECURITY DEFINER function is vulnerable to
-- search_path hijacking — an attacker could create objects in a schema
-- that appears before public, shadowing tables/functions the function uses.

-- ── recalculate_all_elo (migration 006) ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recalculate_all_elo()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec          record;
  winner_elo   integer;
  loser_elo    integer;
  expected_w   float;
  expected_l   float;
  new_w_elo    integer;
  new_l_elo    integer;
  k            CONSTANT integer := 32;
BEGIN
  UPDATE public.players SET elo = 1000, wins = 0, losses = 0;
  TRUNCATE public.elo_history;

  FOR rec IN
    SELECT id, winner_id, loser_id
    FROM   public.matches
    ORDER  BY date ASC, created_at ASC
  LOOP
    SELECT elo INTO winner_elo FROM public.players WHERE id = rec.winner_id;
    SELECT elo INTO loser_elo  FROM public.players WHERE id = rec.loser_id;

    expected_w := 1.0 / (1.0 + POWER(10.0, (loser_elo  - winner_elo)::float / 400.0));
    expected_l := 1.0 / (1.0 + POWER(10.0, (winner_elo - loser_elo)::float  / 400.0));

    new_w_elo := ROUND(winner_elo + k * (1.0 - expected_w));
    new_l_elo := ROUND(loser_elo  + k * (0.0 - expected_l));

    INSERT INTO public.elo_history (match_id, player_id, elo_before, elo_after)
    VALUES
      (rec.id, rec.winner_id, winner_elo, new_w_elo),
      (rec.id, rec.loser_id,  loser_elo,  new_l_elo);

    UPDATE public.players SET elo = new_w_elo, wins   = wins   + 1 WHERE id = rec.winner_id;
    UPDATE public.players SET elo = new_l_elo, losses = losses + 1 WHERE id = rec.loser_id;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recalculate_all_elo() FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.recalculate_all_elo() TO service_role;

-- ── recalculate_all_mmr (migration 012 / 017) ────────────────────────────────
CREATE OR REPLACE FUNCTION public.recalculate_all_mmr()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
            WHEN 'class_a'  THEN 2200
            WHEN 'class_b'  THEN 1900
            WHEN 'class_c'  THEN 1500
            WHEN 'beginner' THEN 1000
            ELSE                 1000
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
