-- ============================================================
-- Migration 013: Live match streaming support
-- ============================================================

ALTER TABLE public.matches
  ADD COLUMN stream_url TEXT,
  ADD COLUMN is_live    BOOLEAN NOT NULL DEFAULT FALSE;

-- Existing admin UPDATE policy from migration 005 already covers all columns
-- on the matches table, including these new ones. No new RLS policy needed.

-- Ensure matches table is included in the Realtime publication so that
-- is_live changes propagate to subscribed clients instantly.
-- (Supabase Cloud includes public tables by default; this is a no-op if
--  already present but safe to run.)
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
