# TRD Ranking — Build Plan

## Phase Overview

| Phase | What | Status |
|---|---|---|
| 0 | Nuxt scaffold, Tailwind, Supabase CLI, env setup | ✅ Done |
| 1 | DB schema & migrations | ✅ Done |
| 2 | Auth + RLS policies | ✅ Done |
| 3 | ELO engine (TS utility + Postgres function + POST /api/matches) | ✅ Done |
| 4 | Core composables (useLeaderboard, usePlayer, useHeadToHead) | ✅ Done |
| 5 | Layout, design tokens, shared components | ✅ Done |
| 6 | Pages: leaderboard → player profile → match detail → H2H | ✅ Done |
| 7 | Admin interface (add match, add player) | ✅ Done |
| 8 | MVP voting (server route + UI) | ✅ Done |
| 9 | Daily rank snapshot cron (Supabase Edge Function) | ✅ Done |
| 10 | Production hardening & Vercel deployment | ✅ Done |

---

## Phase 0 — Repository & Tooling Bootstrap

### Steps
- [ ] 0.1 Scaffold Nuxt 3 project (`npx nuxi@latest init .`)
- [ ] 0.2 Install core dependencies (Tailwind, @nuxtjs/supabase, @nuxt/image)
- [ ] 0.3 Configure `nuxt.config.ts` (modules, route rules, runtimeConfig)
- [ ] 0.4 Tailwind setup (`tailwind.config.ts` + `assets/css/main.css`)
- [ ] 0.5 Create `.env.example` and `.gitignore`
- [ ] 0.6 Initialize Supabase CLI (`supabase init`)

### Key decisions
- `ssr: true` (default) — leaderboard and player pages benefit from SSR/ISR
- `supabase.redirect: false` in nuxt.config.ts — prevents auto-redirect from breaking public pages
- Route rules: `/` → `isr: 60`, `/players/:id` → `isr: 300`, `/matches/:id` → `cache: { maxAge: 3600 }`
- Service role key: server-only, never in `runtimeConfig.public`

---

## Phase 1 — Database Schema & Migrations

### Steps
- [ ] 1.1 Migration: core tables (players, matches, match_players, mvp_votes)
- [ ] 1.2 Migration: elo_history table (audit trail for idempotent ELO)
- [ ] 1.3 Migration: rank_snapshots table (for rank delta display)
- [ ] 1.4 Migration: indexes
- [ ] 1.5 Seed data (6–8 players, 10–15 matches with deterministic UUIDs)

### Key decisions
- `players.elo` is a materialized cache — always recomputable from `elo_history`
- Tiebreaker for ELO replay: `order by date asc, created_at asc` (must be consistent)
- Rank delta ≠ ELO delta — rank_snapshots is the only correct approach

### Gotchas
- Run `supabase db reset` after each migration iteration (drops, recreates, seeds)
- `winner_id <> loser_id` check constraint must be in DB, not just server route

---

## Phase 2 — Authentication & RLS

### Steps
- [ ] 2.1 Decide auth model (admin write, public read, authenticated MVP votes)
- [ ] 2.2 Migration: RLS policies on all tables + admins table
- [ ] 2.3 Auth UI: `pages/login.vue` + `middleware/admin.ts`

### Key decisions
- All tables: public SELECT, admin-only INSERT/UPDATE/DELETE
- mvp_votes: authenticated users only, `voter_id = auth.uid()` enforced by RLS
- Service role key bypasses RLS — only used in `server/api/`, never client-side

### Gotchas
- RLS must be enabled on every table before going to production
- `auth.uid()` is null for anon requests — public read policies use `using (true)`

---

## Phase 3 — ELO Engine (Server-Side)

### Steps
- [ ] 3.1 `server/utils/elo.ts` — pure TS ELO calculation (K=32, no DB access)
- [ ] 3.2 Migration: `recalculate_all_elo()` Postgres function (full replay)
- [ ] 3.3 `server/api/matches/index.post.ts` — validates input, inserts match, triggers ELO update

### Key decisions
- Full recalc via DB function on each insert (MVP strategy — switch to incremental at 500+ matches)
- ELO updates always server-side — never in pages or composables
- Use service role client in server routes

### Gotchas
- ELO replay ordering: `order by date asc, created_at asc` — tiebreaker is mandatory
- Input validation must mirror DB constraints (surface enum, UUID format, winner ≠ loser)

---

## Phase 4 — Core Composables & API Layer

### Steps
- [ ] 4.1 `composables/useSupabase.ts` — typed Supabase client wrapper
- [ ] 4.2 Generate TypeScript types: `supabase gen types typescript --local > types/database.types.ts`
- [ ] 4.3 `composables/useLeaderboard.ts` — players + rank delta from snapshots
- [ ] 4.4 `composables/usePlayer.ts` — player row + match history + surface breakdown
- [ ] 4.5 `composables/useHeadToHead.ts` — H2H record between two players

### Key decisions
- Use `useAsyncData` in all composables (forwards SSR payload to client, no duplicate requests)
- `useAsyncData` key must be unique per page/params (e.g. `player-${id}`)
- Run `supabase gen types` after every schema migration

---

## Phase 5 — Layouts & Design System

### Steps
- [ ] 5.1 `layouts/default.vue` — nav bar, container, footer
- [ ] 5.2 Design tokens in `tailwind.config.ts` (brand colors, surface colors)
- [ ] 5.3 Shared components:
  - `PlayerAvatar.vue` — with `<NuxtImg>` and initials fallback
  - `EloChip.vue` — colored ELO badge
  - `RankDelta.vue` — ↑3, ↓2, or — with color coding
  - `SurfaceBadge.vue` — clay/hard/grass/indoor pill
  - `MatchScoreCard.vue` — single-row match display

---

## Phase 6 — Pages (MVP)

### Steps
- [ ] 6.1 `pages/index.vue` — leaderboard (ISR 60s)
- [ ] 6.2 `pages/players/[id].vue` — player profile with ELO sparkline (ISR 300s)
- [ ] 6.3 `pages/matches/[id].vue` — match detail with H2H context
- [ ] 6.4 `pages/h2h.vue` — head-to-head comparison with player pickers

### Gotchas
- Validate UUID params server-side before any DB query (return 400 for non-UUID strings)
- H2H "as of this match" requires `date <= match.date` filter in the query
- ELO sparkline: pure SVG path is zero bundle cost — preferred over a chart library

---

## Phase 7 — Admin Interface

### Steps
- [ ] 7.1 `pages/admin/index.vue` — dashboard (protected by admin middleware)
- [ ] 7.2 `pages/admin/matches/new.vue` — add match form
- [ ] 7.3 `pages/admin/players/new.vue` — add player form with Cloudinary upload
- [ ] 7.4 `server/api/players/index.post.ts` — create player endpoint

### Gotchas
- Cloudinary upload: browser → Cloudinary directly (unsigned preset), never proxy through Nuxt
- Store only the returned `secure_url` in `players.avatar_url`

---

## Phase 8 — MVP Voting

### Steps
- [ ] 8.1 `server/api/votes/index.post.ts` — validate match, nominee, dedup by PK
- [ ] 8.2 Voting UI on match detail page (visible when authenticated, disabled after vote)

### Gotchas
- Use anon client + user JWT for vote submission (not service client) — RLS enforces `voter_id = auth.uid()`
- Unique vote constraint is the primary key `(match_id, voter_id)` — catch 409 and show "already voted"

---

## Phase 9 — Rank Snapshot Cron

### Steps
- [ ] 9.1 `supabase/functions/take-rank-snapshot/index.ts` — Edge Function
- [ ] 9.2 Schedule via Supabase cron or pg_cron (runs daily at midnight)

---

## Phase 10 — Production Hardening & Deployment

### Steps
- [ ] 10.1 Connect GitHub repo to Vercel, set env vars
- [ ] 10.2 Create Supabase production project, run `supabase db push`
- [ ] 10.3 Error handling audit — structured errors in all server routes, error states in all pages
- [ ] 10.4 Bundle audit with `npx nuxi analyze`

---

## Decision Log

| Decision | Choice | Reason |
|---|---|---|
| ELO idempotency | Full recalc via DB function on insert | Simplest correct implementation for MVP |
| Rank delta storage | `rank_snapshots` table | Only correct approach — rank delta ≠ ELO delta |
| Auth scope | Admin write, public read, auth votes | Minimal auth surface for MVP |
| Surface enum | clay, hard, grass, indoor | Matches ITF standard surfaces |
| ELO floor | None (can go below 1000) | Standard ELO |
| Type safety | `supabase gen types` after each migration | Catches schema drift at compile time |
| Service client | Only in `server/api/` | Never leaked to client bundle |
| Cloudinary upload | Browser-to-Cloudinary directly | No media proxying through server |
| ELO sparkline | Pure SVG path | Zero bundle cost |

---

## Global Gotchas

1. `@nuxtjs/supabase` auto-redirect must be disabled (`supabase.redirect: false`)
2. `winner_id <> loser_id` constraint must be in DB
3. ELO replay ordering needs `created_at` tiebreaker for same-day matches
4. Service role key bypasses RLS — never expose to client
5. UUID validation in server routes before any DB query
6. Rank delta requires yesterday's snapshot — `rank_snapshots` is mandatory
7. MVP vote uniqueness is the primary key, not application logic
8. `supabase db reset` = drop + migrate + seed — use as dev loop
9. Cloudinary upload = browser-direct, not server-proxied
10. Re-run `supabase gen types` after every schema change
