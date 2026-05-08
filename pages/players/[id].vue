<script setup lang="ts">
import type { Surface } from '~/types/database.types'

interface PlayerRow {
  id: string
  name: string
  avatar_url: string | null
  mmr: number
  tier: PlayerTier
  wins: number
  losses: number
  doubles_wins: number
  doubles_losses: number
  created_at: string
}

interface OpponentInfo {
  id: string
  name: string
  avatar_url: string | null
  mmr: number
}

interface MatchEntry {
  id: string
  date: string
  score: string
  surface: Surface
  tournament: string | null
  round: string | null
  winner_id: string
  loser_id: string
  role: 'winner' | 'loser'
  opponentId: string
  opponent: OpponentInfo | null
}

interface MmrEntry {
  mmr_after: number
  match_id: string
}

interface PlayerPageData {
  player: PlayerRow
  matches: MatchEntry[]
  surfaceStats: Partial<Record<Surface, { wins: number; losses: number }>>
  mmrHistory: MmrEntry[]
  rank: number
  rankDelta: number | null
}


const route = useRoute()
const id = route.params.id as string

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
if (!UUID_RE.test(id)) {
  throw createError({ statusCode: 404, statusMessage: 'Player not found' })
}

const supabase = useSupabase()
const user = useSupabaseUser()

const { data, pending, error } = await useAsyncData<PlayerPageData | null>(
  `player-page-${id}`,
  async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    type SR<T> = { data: T | null; error: unknown }
    const [playerRes, mpRes, mmrRes, allPlayersRes, snapshotRes] = await Promise.all([
      supabase.from('players').select('*').eq('id', id).single(),
      supabase.from('match_players').select('match_id, role').eq('player_id', id),
      supabase.from('elo_history').select('mmr_after, match_id').eq('player_id', id).order('id', { ascending: true }),
      supabase.from('players').select('id, name, avatar_url, mmr'),
      supabase.from('rank_snapshots').select('rank').eq('player_id', id).eq('snapshot_date', yesterdayStr).maybeSingle(),
    ]) as [
      SR<PlayerRow>,
      SR<{ match_id: string; role: 'winner' | 'loser' }[]>,
      SR<MmrEntry[]>,
      SR<OpponentInfo[]>,
      SR<{ rank: number }>,
    ]

    if (!playerRes.data) return null

    const player = playerRes.data
    const mpRows = mpRes.data ?? []
    const mmrRows = mmrRes.data ?? []
    const allPlayers = allPlayersRes.data ?? []

    const sortedPlayers = [...allPlayers].sort((a, b) => b.mmr - a.mmr || a.id.localeCompare(b.id))
    const currentRank = sortedPlayers.findIndex(p => p.id === id) + 1 || 1
    const prevRank = snapshotRes.data?.rank ?? null
    const rankDelta = prevRank !== null ? prevRank - currentRank : null

    const playerMap = new Map<string, OpponentInfo>(allPlayers.map(p => [p.id, p]))
    const roleMap = new Map<string, 'winner' | 'loser'>(mpRows.map(r => [r.match_id, r.role]))
    const matchIds = mpRows.map(r => r.match_id)

    type RawMatch = { id: string; date: string; score: string; surface: Surface; tournament: string | null; round: string | null; winner_id: string; loser_id: string }
    const rawMatches: RawMatch[] = matchIds.length
      ? ((await supabase
          .from('matches')
          .select('id, date, score, surface, tournament, round, winner_id, loser_id')
          .in('id', matchIds)
          .order('date', { ascending: false })).data ?? []) as RawMatch[]
      : []

    const surfaceStats: Partial<Record<Surface, { wins: number; losses: number }>> = {}
    const matches: MatchEntry[] = rawMatches.map(m => {
      const role = roleMap.get(m.id) ?? 'loser'
      const opponentId = role === 'winner' ? m.loser_id : m.winner_id
      const opponent = playerMap.get(opponentId) ?? null

      const stat = surfaceStats[m.surface] ?? { wins: 0, losses: 0 }
      if (role === 'winner') stat.wins++
      else stat.losses++
      surfaceStats[m.surface] = stat

      return { ...m, role, opponentId, opponent }
    })

    return { player, matches, surfaceStats, mmrHistory: mmrRows, rank: currentRank, rankDelta }
  },
)

if (!data.value && !pending.value) {
  throw createError({ statusCode: 404, statusMessage: 'Player not found' })
}

// ── MMR sparkline ─────────────────────────────────────────────────────────────
const sparklinePath = computed(() => {
  const history = data.value?.mmrHistory ?? []
  const startingMmr = data.value?.player?.mmr ?? 1000
  const points = [startingMmr, ...history.map(h => h.mmr_after)]
  if (points.length < 2) return ''

  const W = 300, H = 60, pad = 6
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 40

  return points
    .map((mmr, i) => {
      const x = pad + (i / (points.length - 1)) * (W - 2 * pad)
      const y = (H - pad) - ((mmr - min) / range) * (H - 2 * pad)
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
})

const player = computed(() => data.value?.player ?? null)
const winRate = computed(() => {
  const p = player.value
  if (!p) return '—'
  const total = p.wins + p.losses
  return total === 0 ? '—' : `${Math.round((p.wins / total) * 100)}%`
})

const doublesWinRate = computed(() => {
  const p = player.value
  if (!p) return '—'
  const total = p.doubles_wins + p.doubles_losses
  return total === 0 ? '—' : `${Math.round((p.doubles_wins / total) * 100)}%`
})

const hasDoubles = computed(() => {
  const p = player.value
  return p ? (p.doubles_wins + p.doubles_losses) > 0 : false
})

const TIER_MMR_COLOR: Record<string, string> = {
  class_a:  'text-amber-400',
  class_b:  'text-violet-400',
  class_c:  'text-blue-400',
  beginner: 'text-brand-400',
  unranked: 'text-slate-400',
}

const mmrColor = computed(() => TIER_MMR_COLOR[player.value?.tier ?? ''] ?? 'text-slate-400')

// ── Tournament achievements ───────────────────────────────────────────────────

type AchievementFilter = 'entered' | 'champion' | 'finals' | 'semis' | null
const selectedFilter = ref<AchievementFilter>(null)

const achievementData = computed(() => {
  const matches = data.value?.matches ?? []
  const tourMatches = matches.filter(m => m.tournament)

  const byTournament = new Map<string, MatchEntry[]>()
  for (const m of tourMatches) {
    const t = m.tournament!
    if (!byTournament.has(t)) byTournament.set(t, [])
    byTournament.get(t)!.push(m)
  }

  const entered = [...byTournament.keys()]
  const champions = entered.filter(t =>
    byTournament.get(t)!.some(m => m.round === 'final' && m.role === 'winner'),
  )
  const finalists = entered.filter(t =>
    byTournament.get(t)!.some(m => m.round === 'final'),
  )
  const semifinalists = entered.filter(t =>
    byTournament.get(t)!.some(m => m.round === 'semifinal'),
  )

  return { byTournament, entered, champions, finalists, semifinalists }
})

const achievements = computed(() => ({
  entered:       achievementData.value.entered.length,
  championships: achievementData.value.champions.length,
  finals:        achievementData.value.finalists.length,
  semis:         achievementData.value.semifinalists.length,
}))

const rightTitle = computed(() => {
  if (!selectedFilter.value) return 'Match history'
  if (selectedFilter.value === 'entered')  return 'Tournaments entered'
  if (selectedFilter.value === 'champion') return 'Championships'
  if (selectedFilter.value === 'finals')   return 'Finals reached'
  return 'Semis reached'
})

const visibleTournaments = computed(() => {
  const d = achievementData.value
  if (!selectedFilter.value)               return []
  if (selectedFilter.value === 'entered')  return d.entered
  if (selectedFilter.value === 'champion') return d.champions
  if (selectedFilter.value === 'finals')   return d.finalists
  return d.semifinalists
})

function tournamentResult(tournament: string) {
  const ms = achievementData.value.byTournament.get(tournament) ?? []
  if (ms.some(m => m.round === 'final'        && m.role === 'winner'))
    return { label: 'Champion',        cls: 'text-yellow-400 bg-yellow-400/10 ring-yellow-500/30' }
  if (ms.some(m => m.round === 'final'))
    return { label: 'Finalist',        cls: 'text-brand-400 bg-brand-400/10 ring-brand-500/30' }
  if (ms.some(m => m.round === 'semifinal'))
    return { label: 'Semi-finalist',   cls: 'text-slate-300 bg-slate-700/50 ring-slate-500/30' }
  if (ms.some(m => m.round === 'quarterfinal'))
    return { label: 'Quarter-finalist', cls: 'text-slate-400 bg-slate-800 ring-slate-600' }
  return   { label: 'Participant',     cls: 'text-slate-500 bg-slate-800 ring-slate-700' }
}

function tournamentDateRange(tournament: string) {
  const ms = achievementData.value.byTournament.get(tournament) ?? []
  const dates = ms.map(m => m.date).sort()
  if (!dates.length) return ''
  return dates[0] === dates[dates.length - 1]
    ? dates[0]
    : `${dates[0]} – ${dates[dates.length - 1]}`
}

function toggleFilter(f: NonNullable<AchievementFilter>) {
  selectedFilter.value = selectedFilter.value === f ? null : f
}

const SURFACES: Surface[] = ['clay', 'hard', 'grass', 'indoor']

useHead(() => ({
  title: player.value ? `${player.value.name} — TRD Ranking` : 'Player',
}))
</script>

<template>
  <div v-if="pending" class="text-slate-400">Loading…</div>
  <div v-else-if="error || !data" class="text-red-400">Player not found.</div>

  <div v-else class="space-y-6">

    <!-- ── Player header (full width) ─────────────────────────────────────── -->
    <div class="card flex flex-col sm:flex-row items-start sm:items-center gap-6">
      <PlayerAvatar :name="player!.name" :avatar-url="player!.avatar_url" :size="72" />

      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-3">
          <h1 class="text-xl sm:text-2xl font-bold text-white truncate">{{ player!.name }}</h1>
          <NuxtLink
            v-if="user"
            :to="`/admin/players/${id}/edit`"
            class="shrink-0 rounded-lg border border-surface-border px-2.5 py-1 text-xs text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
          >
            Edit
          </NuxtLink>
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-400">
          <RankBadge :tier="player!.tier" :size="44" />
          <span class="inline-flex items-baseline gap-1">
            <span class="text-lg font-mono font-semibold" :class="mmrColor">{{ player!.mmr }}</span>
            <span class="text-xs text-slate-500">MMR</span>
          </span>
          <RankDelta :delta="data.rankDelta" />
          <span class="text-slate-500">#{{ data.rank }}</span>
          <span class="text-slate-600 text-xs uppercase tracking-wider">Singles</span>
          <span><span class="text-brand-400 font-semibold">{{ player!.wins }}</span> W</span>
          <span><span class="text-red-400 font-semibold">{{ player!.losses }}</span> L</span>
          <span>{{ winRate }}</span>
          <template v-if="hasDoubles">
            <span class="text-slate-700">·</span>
            <span class="text-slate-600 text-xs uppercase tracking-wider">Doubles</span>
            <span><span class="text-brand-400 font-semibold">{{ player!.doubles_wins }}</span> W</span>
            <span><span class="text-red-400 font-semibold">{{ player!.doubles_losses }}</span> L</span>
            <span>{{ doublesWinRate }}</span>
          </template>
        </div>
      </div>

      <!-- MMR sparkline -->
      <div v-if="sparklinePath" class="shrink-0 hidden sm:block">
        <p class="text-xs text-slate-500 mb-1">MMR history</p>
        <svg
          viewBox="0 0 300 60"
          width="150"
          height="30"
          class="overflow-visible"
          aria-hidden="true"
        >
          <path
            :d="sparklinePath"
            fill="none"
            stroke="#22c55e"
            stroke-width="2"
            stroke-linejoin="round"
            stroke-linecap="round"
          />
        </svg>
      </div>
    </div>

    <!-- ── Two-column body ────────────────────────────────────────────────── -->
    <div class="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">

      <!-- Left: Surface breakdown + Achievements -->
      <div class="space-y-4">

        <!-- Surface breakdown -->
        <div class="card space-y-3">
          <h2 class="text-xs text-slate-500 uppercase tracking-widest">Surface</h2>
          <p v-if="!Object.keys(data.surfaceStats).length" class="text-xs text-slate-600">No matches played yet.</p>
          <div v-else class="space-y-2">
            <div
              v-for="surface in SURFACES"
              v-show="data.surfaceStats[surface]"
              :key="surface"
              class="flex items-center gap-3"
            >
              <SurfaceBadge :surface="surface" class="shrink-0" />
              <div class="flex-1 text-xs text-slate-400 text-right">
                <span class="text-brand-400 font-semibold">{{ data.surfaceStats[surface]?.wins ?? 0 }}W</span>
                &nbsp;
                <span class="text-red-400 font-semibold">{{ data.surfaceStats[surface]?.losses ?? 0 }}L</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Tournament achievements -->
        <div class="card space-y-0.5">
          <h2 class="text-xs text-slate-500 uppercase tracking-widest pb-2">Tournaments</h2>
          <p v-if="achievements.entered === 0" class="text-xs text-slate-600 pb-1">No tournaments played yet.</p>

          <!-- Entered -->
          <button
            class="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-left transition-colors"
            :class="selectedFilter === 'entered' ? 'bg-surface-elevated ring-1 ring-brand-500/40' : 'hover:bg-surface-elevated'"
            @click="toggleFilter('entered')"
          >
            <span class="text-xl font-bold w-7 text-right shrink-0 text-white">{{ achievements.entered }}</span>
            <span class="flex-1 text-sm text-slate-300">Entered</span>
            <svg class="w-3.5 h-3.5 text-slate-600 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <!-- Champion -->
          <button
            :disabled="achievements.championships === 0"
            class="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-left transition-colors disabled:cursor-default"
            :class="selectedFilter === 'champion' ? 'bg-surface-elevated ring-1 ring-yellow-500/40' : achievements.championships > 0 ? 'hover:bg-surface-elevated' : ''"
            @click="achievements.championships > 0 && toggleFilter('champion')"
          >
            <span class="text-xl font-bold w-7 text-right shrink-0" :class="achievements.championships > 0 ? 'text-yellow-400' : 'text-slate-700'">{{ achievements.championships }}</span>
            <span class="flex-1 text-sm" :class="achievements.championships > 0 ? 'text-slate-300' : 'text-slate-600'">Champion</span>
            <svg v-if="achievements.championships > 0" class="w-3.5 h-3.5 text-slate-600 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <!-- Finals -->
          <button
            :disabled="achievements.finals === 0"
            class="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-left transition-colors disabled:cursor-default"
            :class="selectedFilter === 'finals' ? 'bg-surface-elevated ring-1 ring-brand-500/40' : achievements.finals > 0 ? 'hover:bg-surface-elevated' : ''"
            @click="achievements.finals > 0 && toggleFilter('finals')"
          >
            <span class="text-xl font-bold w-7 text-right shrink-0" :class="achievements.finals > 0 ? 'text-brand-400' : 'text-slate-700'">{{ achievements.finals }}</span>
            <span class="flex-1 text-sm" :class="achievements.finals > 0 ? 'text-slate-300' : 'text-slate-600'">Finals</span>
            <svg v-if="achievements.finals > 0" class="w-3.5 h-3.5 text-slate-600 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <!-- Semis -->
          <button
            :disabled="achievements.semis === 0"
            class="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-left transition-colors disabled:cursor-default"
            :class="selectedFilter === 'semis' ? 'bg-surface-elevated ring-1 ring-brand-500/40' : achievements.semis > 0 ? 'hover:bg-surface-elevated' : ''"
            @click="achievements.semis > 0 && toggleFilter('semis')"
          >
            <span class="text-xl font-bold w-7 text-right shrink-0" :class="achievements.semis > 0 ? 'text-brand-400' : 'text-slate-700'">{{ achievements.semis }}</span>
            <span class="flex-1 text-sm" :class="achievements.semis > 0 ? 'text-slate-300' : 'text-slate-600'">Semis</span>
            <svg v-if="achievements.semis > 0" class="w-3.5 h-3.5 text-slate-600 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Right: Match history or filtered tournament view -->
      <div class="space-y-3">
        <div class="flex items-center justify-between min-h-[20px]">
          <h2 class="text-xs text-slate-500 uppercase tracking-widest">{{ rightTitle }}</h2>
          <button
            v-if="selectedFilter"
            class="text-xs text-slate-500 hover:text-white transition-colors"
            @click="selectedFilter = null"
          >
            ← All matches
          </button>
        </div>

        <!-- Filtered: grouped by tournament -->
        <template v-if="selectedFilter">
          <div v-if="!visibleTournaments.length" class="text-slate-400 text-sm">No matches found.</div>

          <div v-for="tournament in visibleTournaments" :key="tournament" class="space-y-2">
            <!-- Tournament header -->
            <div class="flex items-start justify-between gap-3 pt-1 pb-0.5 px-1">
              <div class="min-w-0">
                <p class="text-sm font-semibold text-white truncate">{{ tournament }}</p>
                <p class="text-xs text-slate-500">{{ tournamentDateRange(tournament) }}</p>
              </div>
              <span
                class="shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset"
                :class="tournamentResult(tournament).cls"
              >
                {{ tournamentResult(tournament).label }}
              </span>
            </div>

            <MatchScoreCard
              v-for="m in achievementData.byTournament.get(tournament)"
              :key="m.id"
              :match-id="m.id"
              :date="m.date"
              :score="m.score"
              :surface="m.surface"
              :tournament="m.tournament"
              :winner-id="m.winner_id"
              :loser-id="m.loser_id"
              :winner-name="m.winner_id === id ? player!.name : (m.opponent?.name ?? '—')"
              :loser-name="m.loser_id === id ? player!.name : (m.opponent?.name ?? '—')"
              :winner-avatar="m.winner_id === id ? player!.avatar_url : (m.opponent?.avatar_url ?? null)"
              :loser-avatar="m.loser_id === id ? player!.avatar_url : (m.opponent?.avatar_url ?? null)"
              :perspective-player-id="id"
            />
          </div>
        </template>

        <!-- Default: flat match list -->
        <template v-else>
          <div v-if="!data.matches.length" class="text-slate-400 text-sm">No matches recorded yet.</div>
          <div class="space-y-2">
            <MatchScoreCard
              v-for="m in data.matches"
              :key="m.id"
              :match-id="m.id"
              :date="m.date"
              :score="m.score"
              :surface="m.surface"
              :tournament="m.tournament"
              :winner-id="m.winner_id"
              :loser-id="m.loser_id"
              :winner-name="m.winner_id === id ? player!.name : (m.opponent?.name ?? '—')"
              :loser-name="m.loser_id === id ? player!.name : (m.opponent?.name ?? '—')"
              :winner-avatar="m.winner_id === id ? player!.avatar_url : (m.opponent?.avatar_url ?? null)"
              :loser-avatar="m.loser_id === id ? player!.avatar_url : (m.opponent?.avatar_url ?? null)"
              :perspective-player-id="id"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
