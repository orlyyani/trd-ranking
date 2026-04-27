-- ============================================================
-- Migration 005: Row Level Security
-- ============================================================

-- Admins table — user_id must exist in auth.users
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- Enable RLS on all tables
alter table public.players         enable row level security;
alter table public.matches         enable row level security;
alter table public.match_players   enable row level security;
alter table public.mvp_votes       enable row level security;
alter table public.elo_history     enable row level security;
alter table public.rank_snapshots  enable row level security;
alter table public.admins          enable row level security;

-- ── Public read ──────────────────────────────────────────────
create policy "public read players"
  on public.players for select using (true);

create policy "public read matches"
  on public.matches for select using (true);

create policy "public read match_players"
  on public.match_players for select using (true);

create policy "public read mvp_votes"
  on public.mvp_votes for select using (true);

create policy "public read elo_history"
  on public.elo_history for select using (true);

create policy "public read rank_snapshots"
  on public.rank_snapshots for select using (true);

-- ── Admin write (players) ────────────────────────────────────
create policy "admin insert players"
  on public.players for insert
  with check (auth.uid() in (select user_id from public.admins));

create policy "admin update players"
  on public.players for update
  using (auth.uid() in (select user_id from public.admins));

create policy "admin delete players"
  on public.players for delete
  using (auth.uid() in (select user_id from public.admins));

-- ── Admin write (matches) ────────────────────────────────────
create policy "admin insert matches"
  on public.matches for insert
  with check (auth.uid() in (select user_id from public.admins));

create policy "admin update matches"
  on public.matches for update
  using (auth.uid() in (select user_id from public.admins));

create policy "admin delete matches"
  on public.matches for delete
  using (auth.uid() in (select user_id from public.admins));

-- ── Admin write (match_players) ──────────────────────────────
create policy "admin insert match_players"
  on public.match_players for insert
  with check (auth.uid() in (select user_id from public.admins));

create policy "admin update match_players"
  on public.match_players for update
  using (auth.uid() in (select user_id from public.admins));

create policy "admin delete match_players"
  on public.match_players for delete
  using (auth.uid() in (select user_id from public.admins));

-- ── MVP votes — any authenticated user, own voter_id only ────
create policy "auth users insert vote"
  on public.mvp_votes for insert
  with check (auth.uid() = voter_id);

-- Voters can delete their own vote (change their mind)
create policy "auth users delete own vote"
  on public.mvp_votes for delete
  using (auth.uid() = voter_id);

-- ── elo_history + rank_snapshots — service role only (writes) ─
-- These tables are only ever written to by server routes using
-- the service role key, which bypasses RLS entirely. No insert
-- policy needed for authenticated users.
