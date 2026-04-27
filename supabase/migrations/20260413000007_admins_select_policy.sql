-- Migration 007: Allow authenticated admins to read their own row.
-- Without this policy, the middleware's anon-client query returns nothing
-- even when the user_id row exists, causing the admin check to fail.
create policy "admins can read own row"
  on public.admins for select
  using (auth.uid() = user_id);
