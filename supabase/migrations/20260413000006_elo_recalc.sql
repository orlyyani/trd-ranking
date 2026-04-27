-- ============================================================
-- Migration 006: recalculate_all_elo() — idempotent full replay
-- ============================================================
--
-- Replays every match in chronological order (date asc, created_at asc)
-- and writes the correct elo_before/elo_after to elo_history, then
-- materializes the final ELO + win/loss counts back onto the players row.
--
-- Idempotent: safe to call multiple times — it truncates elo_history and
-- resets all player ELOs to 1000 before replaying.
--
-- Call from server/api/matches/index.post.ts (service role) after every
-- match insert. Switch to incremental ELO at 500+ matches.

create or replace function public.recalculate_all_elo()
returns void
language plpgsql
security definer   -- runs as function owner (postgres), bypasses RLS
as $$
declare
  rec          record;
  winner_elo   integer;
  loser_elo    integer;
  expected_w   float;
  expected_l   float;
  new_w_elo    integer;
  new_l_elo    integer;
  k            constant integer := 32;
begin
  -- 1. Reset all players to base ELO and zero win/loss counts.
  update public.players
  set elo = 1000, wins = 0, losses = 0;

  -- 2. Clear the existing ELO history so we can replay cleanly.
  truncate public.elo_history;

  -- 3. Replay every match in strict chronological order.
  for rec in
    select id, winner_id, loser_id
    from   public.matches
    order  by date asc, created_at asc
  loop
    -- Fetch current ELO for both players.
    select elo into winner_elo from public.players where id = rec.winner_id;
    select elo into loser_elo  from public.players where id = rec.loser_id;

    -- Standard ELO formula (K=32, winner score=1, loser score=0).
    expected_w := 1.0 / (1.0 + power(10.0, (loser_elo  - winner_elo)::float / 400.0));
    expected_l := 1.0 / (1.0 + power(10.0, (winner_elo - loser_elo)::float  / 400.0));

    new_w_elo := round(winner_elo + k * (1.0 - expected_w));
    new_l_elo := round(loser_elo  + k * (0.0 - expected_l));

    -- Record the change in elo_history.
    insert into public.elo_history (match_id, player_id, elo_before, elo_after)
    values
      (rec.id, rec.winner_id, winner_elo, new_w_elo),
      (rec.id, rec.loser_id,  loser_elo,  new_l_elo);

    -- Apply new ELO and increment win/loss counters.
    update public.players
    set elo = new_w_elo, wins = wins + 1
    where id = rec.winner_id;

    update public.players
    set elo = new_l_elo, losses = losses + 1
    where id = rec.loser_id;
  end loop;
end;
$$;

-- Restrict execution to the postgres role (service role uses this).
-- Anon and authenticated roles cannot call it directly.
revoke execute on function public.recalculate_all_elo() from public, anon, authenticated;
grant  execute on function public.recalculate_all_elo() to service_role;