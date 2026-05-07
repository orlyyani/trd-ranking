-- Migration 019: Add round column to matches for tournament achievement tracking
alter table public.matches
  add column round text check (round in ('group', 'quarterfinal', 'semifinal', 'final'));
