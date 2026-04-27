-- ============================================================
-- Migration 001: Core tables
-- ============================================================

-- players
create table public.players (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  avatar_url  text,
  elo         integer not null default 1000,
  wins        integer not null default 0,
  losses      integer not null default 0,
  created_at  timestamptz not null default now()
);

-- matches
create table public.matches (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  winner_id   uuid not null references public.players(id),
  loser_id    uuid not null references public.players(id),
  score       text not null,        -- e.g. "6-3 7-5"
  surface     text not null check (surface in ('clay', 'hard', 'grass', 'indoor')),
  tournament  text,
  created_at  timestamptz not null default now(),
  constraint no_self_match check (winner_id <> loser_id)
);

-- match_players — denormalized per-player stats per match
create table public.match_players (
  match_id    uuid not null references public.matches(id) on delete cascade,
  player_id   uuid not null references public.players(id),
  role        text not null check (role in ('winner', 'loser')),
  stats       jsonb,
  primary key (match_id, player_id)
);

-- mvp_votes — one vote per voter per match
create table public.mvp_votes (
  match_id    uuid not null references public.matches(id) on delete cascade,
  voter_id    uuid not null references public.players(id),
  nominee_id  uuid not null references public.players(id),
  created_at  timestamptz not null default now(),
  primary key (match_id, voter_id),
  constraint no_self_vote check (voter_id <> nominee_id)
);
