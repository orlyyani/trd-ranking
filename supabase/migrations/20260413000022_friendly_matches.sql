-- Migration 022: Add ranked column for friendly/casual matches
-- ranked = true  → counts toward MMR (default, existing behaviour)
-- ranked = false → recorded for history only, never processed by recalculate_all_mmr()

ALTER TABLE public.matches
  ADD COLUMN ranked boolean NOT NULL DEFAULT true;

-- Rebuild recalculate_all_mmr() to skip unranked matches.
-- Based on migration 020 (placement = 5 matches).
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
    WHERE  ranked = true          -- friendly matches are never replayed
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

    k_winner := CASE WHEN winner_matches < 5 THEN 40 ELSE 20 END;
    k_loser  := CASE WHEN loser_matches  < 5 THEN 40 ELSE 20 END;

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
