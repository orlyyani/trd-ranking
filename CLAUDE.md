# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

TRD Ranking — a Dotabuff-style tennis ranking & statistics platform. Players can view their ELO ranking, match history, head-to-head records, and MVP statistics.

## Tech Stack

- **Frontend**: Nuxt.js 3 + Tailwind CSS
- **Backend**: Supabase (Postgres + Auth + Realtime)
- **Hosting**: Vercel (frontend) + Supabase (backend)
- **Media**: Cloudinary (player photos, optional)

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Build for production
npm run preview      # Preview production build
supabase start       # Start local Supabase (requires Supabase CLI)
supabase db reset    # Reset local DB and re-run all migrations
```

## Architecture

Nuxt 3 with file-based routing. Pages fetch data via a shared Supabase composable (`composables/useSupabase.ts`). Server-side logic lives in `server/api/` as Nuxt server routes. DB schema changes are managed as versioned migrations in `supabase/migrations/`.

### Key data flows

- **Leaderboard** (`pages/index.vue`): queries `players` table ordered by `elo`, shows rank delta
- **Player profile** (`pages/players/[id].vue`): joins `players`, `match_players`, and `matches`
- **Match detail** (`pages/matches/[id].vue`): shows score, head-to-head context, MVP vote result
- **ELO updates**: must go through a server route or DB function — never computed client-side — so recalculation stays idempotent and replayable from match history

### Database schema

```
players      — id, name, avatar_url, elo, wins, losses, created_at
matches      — id, date, winner_id, loser_id, score, surface, tournament
match_players — match_id, player_id, role (winner/loser), stats (JSON)
mvp_votes    — match_id, voter_id, nominee_id
```

### ELO

Standard ELO with K=32. Update after every match. Recalculation must be idempotent (replayable from match history). Never store a derived ELO value that can't be reconstructed by replaying `matches` in order.

## Nuxt Performance Guidelines

- **Data fetching**: use `useFetch` / `useAsyncData` — they forward server-fetched data to the client via payload, preventing duplicate API calls
- **Lazy components**: prefix component names with `Lazy` (e.g. `<LazyMatchCard>`) for dynamic import; use `hydrate-on-visible` to defer hydration of below-the-fold components
- **Links**: use `<NuxtLink>` everywhere — it prefetches JS for visible links automatically
- **Images**: use `<NuxtImg>` (Nuxt Image module) for player photos and avatars; set `fetchpriority="high"` on above-the-fold images and `loading="lazy"` on the rest
- **Route rules**: apply Nitro caching/ISR via route rules for the leaderboard and player profile pages, which change infrequently
- **Plugins vs composables**: keep plugin registrations minimal; prefer composables or utilities to avoid hydration delays
- **Bundle auditing**: run `npx nuxi analyze` to spot large dependencies before they ship

## Hard Rules

- All DB queries must be covered by Supabase Row Level Security (RLS) policies
- Input validation is required on every API endpoint in `server/api/`
- ELO recalculation must be idempotent — replayable from match history
