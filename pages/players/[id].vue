<script setup lang="ts">
import type { Surface } from '~/types/database.types'

interface PlayerRow {
  id: string
  name: string
  avatar_url: string | null
  elo: number
  wins: number
  losses: number
  created_at: string
}

interface OpponentInfo {
  id: string
  name: string
  avatar_url: string | null
  elo: number
}

interface MatchEntry {
  id: string
  date: string
  score: string
  surface: Surface
  tournament: string | null
  winner_id: string
  loser_id: string
  role: 'winner' | 'loser'
  opponentId: string
  opponent: OpponentInfo | null
}

interface EloEntry {
  elo_after: number
  match_id: string
}

interface PlayerPageData {
  player: PlayerRow
  matches: MatchEntry[]
  surfaceStats: Partial<Record<Surface, { wins: number; losses: number }>>
  eloHistory: EloEntry[]
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
    const [playerRes, mpRes, eloRes, allPlayersRes, snapshotRes] = await Promise.all([
      supabase.from('players').select('*').eq('id', id).single(),
      supabase.from('match_players').select('match_id, role').eq('player_id', id),
      supabase.from('elo_history').select('elo_after, match_id').eq('player_id', id).order('id', { ascending: true }),
      supabase.from('players').select('id, name, avatar_url, elo'),
      supabase.from('rank_snapshots').select('rank').eq('player_id', id).eq('snapshot_date', yesterdayStr).maybeSingle(),
    ]) as [
      SR<PlayerRow>,
      SR<{ match_id: string; role: 'winner' | 'loser' }[]>,
      SR<EloEntry[]>,
      SR<OpponentInfo[]>,
      SR<{ rank: number }>,
    ]

    if (!playerRes.data) return null

    const player = playerRes.data
    const mpRows = mpRes.data ?? []
    const eloRows = eloRes.data ?? []
    const allPlayers = allPlayersRes.data ?? []

    const sortedPlayers = [...allPlayers].sort((a, b) => b.elo - a.elo || a.id.localeCompare(b.id))
    const currentRank = sortedPlayers.findIndex(p => p.id === id) + 1 || 1
    const prevRank = snapshotRes.data?.rank ?? null
    const rankDelta = prevRank !== null ? prevRank - currentRank : null

    const playerMap = new Map<string, OpponentInfo>(allPlayers.map(p => [p.id, p]))
    const roleMap = new Map<string, 'winner' | 'loser'>(mpRows.map(r => [r.match_id, r.role]))
    const matchIds = mpRows.map(r => r.match_id)

    type RawMatch = { id: string; date: string; score: string; surface: Surface; tournament: string | null; winner_id: string; loser_id: string }
    const rawMatches: RawMatch[] = matchIds.length
      ? ((await supabase
          .from('matches')
          .select('id, date, score, surface, tournament, winner_id, loser_id')
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

    return { player, matches, surfaceStats, eloHistory: eloRows, rank: currentRank, rankDelta }
  },
)

if (!data.value && !pending.value) {
  throw createError({ statusCode: 404, statusMessage: 'Player not found' })
}

// ── ELO sparkline ────────────────────────────────────────────────────────────
const sparklinePath = computed(() => {
  const history = data.value?.eloHistory ?? []
  const points = [1000, ...history.map(h => h.elo_after)]
  if (points.length < 2) return ''

  const W = 300, H = 60, pad = 6
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 40 // avoid flat line if only one value

  return points
    .map((elo, i) => {
      const x = pad + (i / (points.length - 1)) * (W - 2 * pad)
      const y = (H - pad) - ((elo - min) / range) * (H - 2 * pad)
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

const SURFACES: Surface[] = ['clay', 'hard', 'grass', 'indoor']

useHead(() => ({
  title: player.value ? `${player.value.name} — TRD Ranking` : 'Player',
}))
</script>

<template>
  <div v-if="pending" class="text-slate-400">Loading…</div>
  <div v-else-if="error || !data" class="text-red-400">Player not found.</div>

  <div v-else class="space-y-8">
    <!-- Player header -->
    <div class="card flex flex-col sm:flex-row items-start sm:items-center gap-6">
      <PlayerAvatar :name="player!.name" :avatar-url="player!.avatar_url" :size="72" />

      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-3">
          <h1 class="text-2xl font-bold text-white truncate">{{ player!.name }}</h1>
          <NuxtLink
            v-if="user"
            :to="`/admin/players/${id}/edit`"
            class="shrink-0 rounded-lg border border-surface-border px-2.5 py-1 text-xs text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
          >
            Edit
          </NuxtLink>
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-400">
          <EloChip :elo="player!.elo" />
          <RankDelta :delta="data.rankDelta" />
          <span class="text-slate-500">#{{ data.rank }}</span>
          <span><span class="text-brand-400 font-semibold">{{ player!.wins }}</span> W</span>
          <span><span class="text-red-400 font-semibold">{{ player!.losses }}</span> L</span>
          <span>{{ winRate }} win rate</span>
        </div>
      </div>

      <!-- ELO sparkline -->
      <div v-if="sparklinePath" class="shrink-0">
        <p class="text-xs text-slate-500 mb-1">ELO history</p>
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

    <!-- Surface breakdown -->
    <div v-if="Object.keys(data.surfaceStats).length" class="card space-y-3">
      <h2 class="text-xs text-slate-500 uppercase tracking-widest">Surface breakdown</h2>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          v-for="surface in SURFACES"
          v-show="data.surfaceStats[surface]"
          :key="surface"
          class="bg-surface rounded-lg p-3 space-y-1"
        >
          <SurfaceBadge :surface="surface" />
          <div class="text-xs text-slate-400 mt-2">
            <span class="text-brand-400 font-semibold">{{ data.surfaceStats[surface]?.wins ?? 0 }}W</span>
            &nbsp;
            <span class="text-red-400 font-semibold">{{ data.surfaceStats[surface]?.losses ?? 0 }}L</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Match history -->
    <div class="space-y-3">
      <h2 class="text-xs text-slate-500 uppercase tracking-widest">Match history</h2>

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
    </div>
  </div>
</template>