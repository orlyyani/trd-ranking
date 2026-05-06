<script setup lang="ts">
import type { ChallongeTournamentData } from '~/server/api/challonge.get'
import type { CommunityTournament } from '~/server/api/challonge-community.get'

const route = useRoute()
const router = useRouter()
const supabase = useSupabase()

const page = computed(() => {
  const p = Number(route.query.page)
  return Number.isInteger(p) && p > 0 ? p : 1
})

const PAGE_SIZE = 10

const { data, pending, error, refresh } = await useRecentMatches({ page, limit: PAGE_SIZE })

const totalPages = computed(() => Math.ceil((data.value?.total ?? 0) / PAGE_SIZE))

function goToPage(p: number) {
  router.push({ query: { ...route.query, page: p } })
}

// Challonge bracket — client-side only so ISR caching doesn't serve stale live data.
// The server endpoint itself is cached for 3 minutes; polling here just re-checks that cache.
const { data: tournaments, refresh: refreshChallonge } = await useAsyncData<ChallongeTournamentData[]>(
  'challonge-bracket',
  () => $fetch<ChallongeTournamentData[]>('/api/challonge').catch(() => []),
  { server: false, default: () => [] },
)

const hasBracket = computed(
  () => (tournaments.value?.length ?? 0) > 0,
)

// Upcoming & in-progress community tournaments (15-min server cache)
const { data: communityTournaments } = await useFetch<CommunityTournament[]>('/api/challonge-community', {
  default: () => [],
})

const activeSlugs = computed(() => new Set(tournaments.value?.map(t => t.slug) ?? []))

function formatTournamentDate(iso: string | null) {
  if (!iso) return 'Date TBD'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTournamentType(raw: string) {
  return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// Realtime + polling fallback
onMounted(() => {
  let channel: ReturnType<typeof supabase.channel> | null = null
  try {
    channel = supabase.channel('matches-page-realtime')
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => refresh())
      .subscribe((_status, err) => {
        if (err) console.warn('[matches] Realtime error:', err)
      })
  } catch (err) {
    console.warn('[matches] Realtime unavailable:', err)
  }

  const poll = setInterval(() => refresh(), 30_000)
  // Challonge: poll every 3 minutes — matches the server-side cache TTL.
  // Keeps client fresh without burning extra API quota.
  const challongePoll = setInterval(() => refreshChallonge(), 3 * 60 * 1_000)

  onUnmounted(() => {
    clearInterval(poll)
    clearInterval(challongePoll)
    if (channel) supabase.removeChannel(channel)
  })
})

useHead({ title: 'Matches', meta: [{ property: 'og:title', content: 'Matches — TRD Ranking' }] })
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-xl sm:text-2xl font-semibold text-white">Matches</h1>

    <!-- Upcoming & in-progress community tournaments -->
    <div v-if="communityTournaments?.length" class="space-y-3">
      <h2 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Tournaments</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        <a
          v-for="t in communityTournaments"
          :key="t.id"
          :href="t.url"
          target="_blank"
          rel="noopener noreferrer"
          class="card flex flex-col gap-2 hover:border-slate-500 transition-colors group"
        >
          <div class="flex items-start justify-between gap-2">
            <span class="font-medium text-white group-hover:text-brand-400 transition-colors text-sm leading-snug">{{ t.name }}</span>
            <span :class="['shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold', t.state === 'underway' ? 'bg-brand-900/50 text-brand-400' : 'bg-yellow-900/40 text-yellow-400']">
              {{ t.state === 'underway' ? 'Underway' : 'Upcoming' }}
            </span>
          </div>
          <div class="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
            <span>{{ formatTournamentDate(t.startsAt) }}</span>
            <span>·</span>
            <span>{{ t.participantsCount }} players</span>
            <span>·</span>
            <span>{{ formatTournamentType(t.tournamentType) }}</span>
          </div>
          <div v-if="t.state === 'underway' && activeSlugs.has(t.slug)" class="text-xs text-brand-400">
            View bracket ↓
          </div>
          <div v-else class="text-xs text-slate-600 group-hover:text-slate-400 transition-colors">
            View on Challonge ↗
          </div>
        </a>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">

      <!-- Left: Tournament brackets -->
      <div class="space-y-3">
        <h2 class="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Tournament Bracket{{ (tournaments?.length ?? 0) > 1 ? 's' : '' }}
        </h2>
        <template v-if="hasBracket">
          <ChallongeBracket
            v-for="t in tournaments"
            :key="t.slug"
            :data="t"
          />
        </template>
        <div v-else class="card py-8 flex items-center justify-center text-slate-600 text-sm">
          No active tournament
        </div>
      </div>

      <!-- Right: Match history -->
      <div class="space-y-3 lg:sticky lg:top-20">
        <h2 class="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Match History
        </h2>

        <div v-if="pending" class="text-slate-400 text-sm">Loading…</div>
        <div v-else-if="error" class="text-red-400 text-sm">Failed to load matches.</div>

        <template v-else>
          <div v-if="!data?.matches.length" class="text-slate-400 text-sm">No matches recorded yet.</div>

          <div v-else class="space-y-2">
            <MatchScoreCard
              v-for="m in data!.matches"
              :key="m.id"
              compact
              :match-id="m.id"
              :date="m.date"
              :score="m.score ?? ''"
              :surface="m.surface"
              :tournament="m.tournament"
              :winner-id="m.winner_id ?? m.player1_id ?? ''"
              :loser-id="m.loser_id ?? m.player2_id ?? ''"
              :winner-name="(m.winner_id === m.player1_id ? m.player1?.name : m.player2?.name) ?? '—'"
              :loser-name="(m.winner_id === m.player1_id ? m.player2?.name : m.player1?.name) ?? '—'"
              :winner-avatar="(m.winner_id === m.player1_id ? m.player1?.avatar_url : m.player2?.avatar_url) ?? null"
              :loser-avatar="(m.winner_id === m.player1_id ? m.player2?.avatar_url : m.player1?.avatar_url) ?? null"
              :winner-partner-name="m.match_type === 'doubles' ? (m.winner_id === m.player1_id ? m.player3?.name : m.player4?.name) ?? null : null"
              :loser-partner-name="m.match_type === 'doubles' ? (m.winner_id === m.player1_id ? m.player4?.name : m.player3?.name) ?? null : null"
              :is-live="m.is_live"
            />
          </div>

          <!-- Pagination -->
          <div v-if="totalPages > 1" class="flex items-center justify-between pt-1">
            <button
              :disabled="page <= 1"
              class="rounded-lg border border-surface-border px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:border-slate-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              @click="goToPage(page - 1)"
            >
              ← Prev
            </button>
            <span class="text-sm text-slate-500">{{ page }} / {{ totalPages }}</span>
            <button
              :disabled="page >= totalPages"
              class="rounded-lg border border-surface-border px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:border-slate-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              @click="goToPage(page + 1)"
            >
              Next →
            </button>
          </div>
        </template>
      </div>

    </div>
  </div>
</template>
