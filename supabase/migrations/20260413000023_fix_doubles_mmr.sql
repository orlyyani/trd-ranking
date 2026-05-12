-- Migration 023: Restore doubles MMR logic lost in migrations 020 & 022.
--
-- Migrations 020 (placement=5) and 022 (ranked filter) both rewrote
-- recalculate_all_mmr() as singles-only, silently dropping the doubles branch
-- from migration 016. This migration merges all three correctly:
--   • Tier-based starting MMR (016/017)
--   • Resets doubles_wins / doubles_losses (016)
--   • Skips unranked matches (022)
--   • K=40/20 singles, K=20/10 doubles, threshold=5 matches (020)
--   • All 4 players updated for doubles (016)

CREATE OR REPLACE FUNCTION public.recalculate_all_mmr()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec          record;

  -- singles
  winner_mmr   integer;  loser_mmr    integer;
  winner_mc    integer;  loser_mc     integer;
  k_winner     integer;  k_loser      integer;
  expected_w   float;    expected_l   float;
  new_w_mmr    integer;  new_l_mmr    integer;

  -- doubles
  wt1_id       uuid;     wt2_id      uuid;
  lt1_id       uuid;     lt2_id      uuid;
  wt1_mmr      integer;  wt2_mmr     integer;
  lt1_mmr      integer;  lt2_mmr     integer;
  wt1_mc       integer;  wt2_mc      integer;
  lt1_mc       integer;  lt2_mc      integer;
  team_w_avg   float;    team_l_avg  float;
  exp_win      float;    exp_los     float;
  new_wt1_mmr  integer;  new_wt2_mmr integer;
  new_lt1_mmr  integer;  new_lt2_mmr integer;
BEGIN
  -- 1. Reset all players to tier-based starting MMR and zero all record counters.
  UPDATE public.players
  SET mmr = CASE tier
              WHEN 'class_a'  THEN 2200
              WHEN 'class_b'  THEN 1900
              WHEN 'class_c'  THEN 1500
              WHEN 'beginner' THEN 1000
              ELSE                 1000
            END,
      wins           = 0,
      losses         = 0,
      doubles_wins   = 0,
      doubles_losses = 0
  WHERE true;

  TRUNCATE public.elo_history;

  -- 2. Replay every ranked, completed match in strict chronological order.
  FOR rec IN
    SELECT id, match_type, winner_id, loser_id,
           player1_id, player2_id, player3_id, player4_id
    FROM   public.matches
    WHERE  ranked    = true
      AND  status    = 'completed'
      AND  winner_id IS NOT NULL
      AND  loser_id  IS NOT NULL
    ORDER  BY date ASC, created_at ASC
  LOOP

    IF rec.match_type = 'doubles'
       AND rec.player3_id IS NOT NULL
       AND rec.player4_id IS NOT NULL
    THEN
      -- Doubles: team A = player1+player3, team B = player2+player4.
      -- winner_id is the captain of the winning team.
      IF rec.winner_id = rec.player1_id THEN
        wt1_id := rec.player1_id;  wt2_id := rec.player3_id;
        lt1_id := rec.player2_id;  lt2_id := rec.player4_id;
      ELSE
        wt1_id := rec.player2_id;  wt2_id := rec.player4_id;
        lt1_id := rec.player1_id;  lt2_id := rec.player3_id;
      END IF;

      -- Total match count across all types drives placement phase.
      SELECT mmr, wins + losses + doubles_wins + doubles_losses
        INTO wt1_mmr, wt1_mc FROM public.players WHERE id = wt1_id;
      SELECT mmr, wins + losses + doubles_wins + doubles_losses
        INTO wt2_mmr, wt2_mc FROM public.players WHERE id = wt2_id;
      SELECT mmr, wins + losses + doubles_wins + doubles_losses
        INTO lt1_mmr, lt1_mc FROM public.players WHERE id = lt1_id;
      SELECT mmr, wins + losses + doubles_wins + doubles_losses
        INTO lt2_mmr, lt2_mc FROM public.players WHERE id = lt2_id;

      team_w_avg := (wt1_mmr + wt2_mmr) / 2.0;
      team_l_avg := (lt1_mmr + lt2_mmr) / 2.0;

      exp_win := 1.0 / (1.0 + POWER(10.0, (team_l_avg - team_w_avg) / 400.0));
      exp_los := 1.0 - exp_win;

      -- K=20 first 5 total matches, K=10 after (half of singles K).
      new_wt1_mmr := wt1_mmr + ROUND((CASE WHEN wt1_mc < 5 THEN 20 ELSE 10 END)::float * (1.0 - exp_win));
      new_wt2_mmr := wt2_mmr + ROUND((CASE WHEN wt2_mc < 5 THEN 20 ELSE 10 END)::float * (1.0 - exp_win));
      new_lt1_mmr := lt1_mmr + ROUND((CASE WHEN lt1_mc < 5 THEN 20 ELSE 10 END)::float * (0.0 - exp_los));
      new_lt2_mmr := lt2_mmr + ROUND((CASE WHEN lt2_mc < 5 THEN 20 ELSE 10 END)::float * (0.0 - exp_los));

      INSERT INTO public.elo_history (match_id, player_id, mmr_before, mmr_after)
      VALUES
        (rec.id, wt1_id, wt1_mmr, new_wt1_mmr),
        (rec.id, wt2_id, wt2_mmr, new_wt2_mmr),
        (rec.id, lt1_id, lt1_mmr, new_lt1_mmr),
        (rec.id, lt2_id, lt2_mmr, new_lt2_mmr);

      UPDATE public.players SET mmr = new_wt1_mmr, doubles_wins   = doubles_wins   + 1 WHERE id = wt1_id;
      UPDATE public.players SET mmr = new_wt2_mmr, doubles_wins   = doubles_wins   + 1 WHERE id = wt2_id;
      UPDATE public.players SET mmr = new_lt1_mmr, doubles_losses = doubles_losses + 1 WHERE id = lt1_id;
      UPDATE public.players SET mmr = new_lt2_mmr, doubles_losses = doubles_losses + 1 WHERE id = lt2_id;

    ELSE
      -- Singles
      SELECT mmr, wins + losses INTO winner_mmr, winner_mc FROM public.players WHERE id = rec.winner_id;
      SELECT mmr, wins + losses INTO loser_mmr,  loser_mc  FROM public.players WHERE id = rec.loser_id;

      k_winner := CASE WHEN winner_mc < 5 THEN 40 ELSE 20 END;
      k_loser  := CASE WHEN loser_mc  < 5 THEN 40 ELSE 20 END;

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
    END IF;

  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recalculate_all_mmr() FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.recalculate_all_mmr() TO service_role;
