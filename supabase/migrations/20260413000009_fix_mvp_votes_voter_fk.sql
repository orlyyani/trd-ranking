-- Migration 009: Fix mvp_votes.voter_id FK.
-- Originally referenced public.players(id), but voters are authenticated users
-- whose auth.uid() won't match a player UUID. Change FK to auth.users(id) so
-- the RLS policy (auth.uid() = voter_id) can actually be satisfied.

alter table public.mvp_votes
  drop constraint mvp_votes_voter_id_fkey;

alter table public.mvp_votes
  add constraint mvp_votes_voter_id_fkey
  foreign key (voter_id) references auth.users(id) on delete cascade;
