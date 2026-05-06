<script setup lang="ts">
import type { ChallongeTournamentData } from '~/server/api/challonge.get'

const PAGE_SIZE = 10
const page = ref(1)
const { data: leaderboard, pending, error } = await useLeaderboard({ page, limit: PAGE_SIZE })
const totalPages = computed(() => Math.ceil((leaderboard.value?.total ?? 0) / PAGE_SIZE))

const { liveMatch } = useLiveMatch()

// Challonge — client-side only, errors caught so the page still renders
const { data: challonge } = await useFetch<ChallongeTournamentData[]>('/api/challonge', {
  server: false,
  lazy: true,
  default: () => [],
  onRequestError: () => [],
  onResponseError: () => [],
})

// All tournaments that currently have a live match
const challongeLiveTournaments = computed(() =>
  challonge.value?.filter(t => t.liveMatch) ?? [],
)

// One entry per live match — DB match first, then one per Challonge tournament
const liveBanners = computed(() => {
  const items: Array<{
    player1: string
    player2: string
    player3: string | null
    player4: string | null
    score: string | null
    streamUrl: string | null
    matchId: string | null
    tournamentName: string | null
    source: 'db' | 'challonge'
  }> = []

  if (liveMatch.value?.player1 && liveMatch.value?.player2) {
    const m = liveMatch.value
    items.push({
      player1:        m.player1.name,
      player2:        m.player2.name,
      player3:        m.player3?.name ?? null,
      player4:        m.player4?.name ?? null,
      score:          m.live_score,
      streamUrl:      m.stream_url,
      matchId:        m.id,
      tournamentName: null,
      source:         'db',
    })
  }

  for (const t of challongeLiveTournaments.value) {
    items.push({
      player1:        t.liveMatch!.player1,
      player2:        t.liveMatch!.player2,
      player3:        null,
      player4:        null,
      score:          t.liveMatch!.score || null,
      streamUrl:      null,
      matchId:        null,
      tournamentName: t.name || null,
      source:         'challonge',
    })
  }

  return items
})

const { data: recentData } = await useRecentMatches({ limit: 1 })
const lastMatch = computed(() => recentData.value?.matches[0] ?? null)

const lastMatchDisplay = computed(() => {
  const m = lastMatch.value
  if (!m) return null
  const winnerIsP1 = m.winner_id === m.player1_id
  const winner        = winnerIsP1 ? m.player1 : m.player2
  const loser         = winnerIsP1 ? m.player2 : m.player1
  const winnerPartner = m.match_type === 'doubles' ? (winnerIsP1 ? m.player3 : m.player4) : null
  const loserPartner  = m.match_type === 'doubles' ? (winnerIsP1 ? m.player4 : m.player3) : null
  return { winner, loser, winnerPartner, loserPartner }
})

const searchQuery = ref('')
const filteredLeaderboard = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const entries = leaderboard.value?.entries ?? []
  if (!q) return entries
  return entries.filter(p => p.name.toLowerCase().includes(q))
})

const winRate = (wins: number, losses: number) => {
  const total = wins + losses
  return total === 0 ? '—' : `${Math.round((wins / total) * 100)}%`
}
</script>

<template>
  <div class="space-y-5">

    <!-- ── Live banners (one per active match) ──────────────────────────────── -->
    <div
      v-if="liveBanners.length"
      class="rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 space-y-2.5"
    >
      <!-- Header -->
      <div class="flex items-center gap-2">
        <span class="relative flex h-2.5 w-2.5 shrink-0">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
        </span>
        <span class="text-xs font-semibold text-red-400 uppercase tracking-widest">Live now</span>
        <span v-if="liveBanners.length > 1" class="text-xs text-slate-500">· {{ liveBanners.length }} matches</span>
      </div>

      <!-- One row per live match -->
      <div
        v-for="(b, i) in liveBanners"
        :key="i"
        class="flex flex-wrap items-center gap-x-3 gap-y-1"
        :class="liveBanners.length > 1 ? 'pl-4 border-l border-red-900/40' : ''"
      >
        <!-- Tournament label -->
        <span v-if="b.tournamentName" class="text-xs text-slate-500 shrink-0">{{ b.tournamentName }} ·</span>

        <!-- Players + score -->
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <span class="font-medium text-white truncate">
            {{ b.player1 }}<template v-if="b.player3"> &amp; {{ b.player3 }}</template>
          </span>
          <span
            v-if="b.score"
            class="shrink-0 px-2 py-0.5 rounded bg-surface-elevated text-xs font-mono font-semibold text-white"
          >{{ b.score }}</span>
          <span v-else class="text-slate-500 text-sm shrink-0">vs</span>
          <span class="font-medium text-white truncate">
            {{ b.player2 }}<template v-if="b.player4"> &amp; {{ b.player4 }}</template>
          </span>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-3 shrink-0">
          <a
            v-if="b.streamUrl"
            :href="b.streamUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-colors"
          >
            Watch ↗
          </a>
          <NuxtLink
            v-if="b.matchId"
            :to="`/matches/${b.matchId}`"
            class="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Details →
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- ── Two-column layout ────────────────────────────────────────────────── -->
    <div class="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">

      <!-- Left: Leaderboard -->
      <div class="space-y-4">
        <div class="flex items-center justify-between gap-4 flex-wrap">
          <h1 class="text-xl sm:text-2xl font-semibold text-white">Leaderboard</h1>
          <div class="relative">
            <svg class="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              v-model="searchQuery"
              type="search"
              placeholder="Search players…"
              class="w-full sm:w-56 rounded-lg bg-surface-elevated border border-surface-border pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <div v-if="pending" class="text-slate-400">Loading…</div>
        <div v-else-if="error" class="text-red-400">Failed to load leaderboard.</div>

        <div v-else class="card overflow-x-auto p-0">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-surface-border text-xs text-slate-500 uppercase tracking-widest">
                <th class="px-4 py-3 text-right w-10">#</th>
                <th class="px-4 py-3 text-left w-8"></th>
                <th class="px-4 py-3 text-left">Player</th>
                <th class="px-4 py-3 text-center">MMR</th>
                <th class="px-4 py-3 text-center">W</th>
                <th class="px-4 py-3 text-center">L</th>
                <th class="px-4 py-3 text-center hidden sm:table-cell">Win %</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-surface-border">
              <template v-if="filteredLeaderboard.length">
                <tr
                  v-for="player in filteredLeaderboard"
                  :key="player.id"
                  class="hover:bg-surface-elevated/50 transition-colors"
                >
                  <td class="px-4 py-3 text-right text-slate-400 font-mono tabular-nums">{{ player.rank }}</td>
                  <td class="px-2 py-3"><RankDelta :delta="player.rankDelta" /></td>
                  <td class="px-4 py-3">
                    <NuxtLink :to="`/players/${player.id}`" class="flex items-center gap-3 group">
                      <PlayerAvatar :name="player.name" :avatar-url="player.avatar_url" :size="36" />
                      <span class="font-medium text-slate-200 group-hover:text-white transition-colors">{{ player.name }}</span>
                    </NuxtLink>
                  </td>
                  <td class="px-4 py-3 text-center"><MmrChip :mmr="player.mmr" /></td>
                  <td class="px-4 py-3 text-center text-brand-400 font-medium">{{ player.wins }}</td>
                  <td class="px-4 py-3 text-center text-red-400 font-medium">{{ player.losses }}</td>
                  <td class="px-4 py-3 text-center text-slate-400 hidden sm:table-cell">{{ winRate(player.wins, player.losses) }}</td>
                </tr>
              </template>
              <tr v-else>
                <td colspan="7" class="px-4 py-8 text-center text-slate-500 text-sm">
                  No players match "{{ searchQuery }}"
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="flex items-center justify-between pt-1">
          <button
            :disabled="page <= 1"
            class="rounded-lg border border-surface-border px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:border-slate-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            @click="page--"
          >← Prev</button>
          <span class="text-sm text-slate-500">{{ page }} / {{ totalPages }}</span>
          <button
            :disabled="page >= totalPages"
            class="rounded-lg border border-surface-border px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:border-slate-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            @click="page++"
          >Next →</button>
        </div>
      </div>

      <!-- Right: Weather · Last match · Live details -->
      <div class="space-y-4 lg:sticky lg:top-20">

        <!-- Weather -->
        <WeatherWidget />

        <!-- Last match -->
        <div v-if="lastMatch" class="space-y-2">
          <h2 class="text-xs text-slate-500 uppercase tracking-widest">Last match</h2>
          <MatchScoreCard
            compact
            :match-id="lastMatch.id"
            :date="lastMatch.date"
            :score="lastMatch.score ?? ''"
            :surface="lastMatch.surface"
            :tournament="lastMatch.tournament"
            :winner-id="lastMatch.winner_id ?? ''"
            :loser-id="lastMatch.loser_id ?? ''"
            :winner-name="lastMatchDisplay?.winner?.name ?? '—'"
            :loser-name="lastMatchDisplay?.loser?.name ?? '—'"
            :winner-avatar="lastMatchDisplay?.winner?.avatar_url ?? null"
            :loser-avatar="lastMatchDisplay?.loser?.avatar_url ?? null"
            :winner-partner-name="lastMatchDisplay?.winnerPartner?.name ?? null"
            :loser-partner-name="lastMatchDisplay?.loserPartner?.name ?? null"
            :is-live="lastMatch.is_live"
          />
        </div>

        <!-- Live match details -->
        <div class="space-y-2">
          <h2 class="text-xs text-slate-500 uppercase tracking-widest">Live</h2>

          <!-- DB live match -->
          <div v-if="liveMatch" class="card space-y-4">
            <div class="flex items-center gap-3">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-white truncate">{{ liveMatch.player1?.name ?? '—' }}</p>
                <p v-if="liveMatch.match_type === 'doubles' && liveMatch.player3" class="text-xs text-slate-500 truncate">&amp; {{ liveMatch.player3.name }}</p>
              </div>
              <div class="shrink-0 text-center">
                <span v-if="liveMatch.live_score" class="text-lg font-mono font-bold text-white">{{ liveMatch.live_score }}</span>
                <span v-else class="text-slate-600 text-sm font-medium">vs</span>
              </div>
              <div class="flex-1 min-w-0 text-right">
                <p class="text-sm font-semibold text-white truncate">{{ liveMatch.player2?.name ?? '—' }}</p>
                <p v-if="liveMatch.match_type === 'doubles' && liveMatch.player4" class="text-xs text-slate-500 truncate">&amp; {{ liveMatch.player4.name }}</p>
              </div>
            </div>
            <a
              v-if="liveMatch.stream_url"
              :href="liveMatch.stream_url"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center justify-center gap-2 rounded-lg bg-red-600/20 border border-red-800/50 hover:bg-red-600/30 px-4 py-2 text-sm font-medium text-red-400 transition-colors w-full"
            >
              <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              Watch live ↗
            </a>
          </div>

          <!-- Challonge live matches (one card per tournament) -->
          <template v-if="challongeLiveTournaments.length">
            <div
              v-for="t in challongeLiveTournaments"
              :key="t.slug"
              class="card space-y-2"
            >
              <div class="flex items-center gap-2">
                <span class="relative flex h-2 w-2 shrink-0">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                <span class="text-xs font-semibold text-red-400 uppercase tracking-widest">Live</span>
                <span v-if="t.name" class="text-xs text-slate-500 truncate">· {{ t.name }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="flex-1 text-sm font-medium text-white truncate">{{ t.liveMatch!.player1 }}</span>
                <span v-if="t.liveMatch!.score" class="text-sm font-mono font-bold text-white shrink-0">{{ t.liveMatch!.score }}</span>
                <span v-else class="text-slate-500 text-xs shrink-0">vs</span>
                <span class="flex-1 text-sm font-medium text-white truncate text-right">{{ t.liveMatch!.player2 }}</span>
              </div>
              <p class="text-xs text-slate-600">Round {{ t.liveMatch!.round }} · via Challonge</p>
            </div>
          </template>

          <!-- No live match anywhere -->
          <div v-if="!liveMatch && !challongeLiveTournaments.length" class="card flex items-center gap-3 py-5 justify-center">
            <svg class="h-5 w-5 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 9.75v9A2.25 2.25 0 004.5 18.75z" />
            </svg>
            <p class="text-sm text-slate-500">No match is live right now</p>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>
