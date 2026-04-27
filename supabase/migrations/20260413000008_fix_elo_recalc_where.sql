-- Migration 008: Fix recalculate_all_elo() — add WHERE true to satisfy
-- require_where_clause. Semantics are identical; WHERE true matches every row.
create or replace function public.recalculate_all_elo()
returns void
language plpgsql
security definer
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
  set elo = 1000, wins = 0, losses = 0
  where true;

  -- 2. Clear the existing ELO history so we can replay cleanly.
  truncate public.elo_history;

  -- 3. Replay every match in strict chronological order.
  for rec in
    select id, winner_id, loser_id
    from   public.matches
    order  by date asc, created_at asc
  loop
    select elo into winner_elo from public.players where id = rec.winner_id;
    select elo into loser_elo  from public.players where id = rec.loser_id;

    expected_w := 1.0 / (1.0 + power(10.0, (loser_elo  - winner_elo)::float / 400.0));
    expected_l := 1.0 / (1.0 + power(10.0, (winner_elo - loser_elo)::float  / 400.0));

    new_w_elo := round(winner_elo + k * (1.0 - expected_w));
    new_l_elo := round(loser_elo  + k * (0.0 - expected_l));

    insert into public.elo_history (match_id, player_id, elo_before, elo_after)
    values
      (rec.id, rec.winner_id, winner_elo, new_w_elo),
      (rec.id, rec.loser_id,  loser_elo,  new_l_elo);

    update public.players
    set elo = new_w_elo, wins = wins + 1
    where id = rec.winner_id;

    update public.players
    set elo = new_l_elo, losses = losses + 1
    where id = rec.loser_id;
  end loop;
end;
$$;

revoke execute on function public.recalculate_all_elo() from public, anon, authenticated;
grant  execute on function public.recalculate_all_elo() to service_role;