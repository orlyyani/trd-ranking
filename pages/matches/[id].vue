<script setup lang="ts">
import type { Surface, MatchStatus, MatchType } from '~/types/database.types'

interface MatchRow {
  id: string; date: string
  match_type: MatchType
  player1_id: string | null; player2_id: string | null
  player3_id: string | null; player4_id: string | null
  winner_id: string | null; loser_id: string | null
  score: string | null; surface: Surface; tournament: string | null
  ranked: boolean
  stream_url: string | null; is_live: boolean
  live_score: string | null; status: MatchStatus; created_at: string
}
interface PlayerSnap { id: string; name: string; avatar_url: string | null; mmr: number; tier: string }
interface H2HMatch { id: string; date: string; score: string | null; surface: Surface; winner_id: string | null; loser_id: string | null }
interface MmrChange { player_id: string; delta: number }
interface MatchPageData {
  match: MatchRow
  player1: PlayerSnap | null
  player2: PlayerSnap | null
  player3: PlayerSnap | null
  player4: PlayerSnap | null
  h2hMatches: H2HMatch[]
  winnerH2HWins: number
  loserH2HWins: number
  mmrChanges: MmrChange[]
}

const route = useRoute()
const id = route.params.id as string

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
if (!UUID_RE.test(id)) throw createError({ statusCode: 404, statusMessage: 'Match not found' })

const supabase = useSupabase()
const user = useSupabaseUser()

// ── MVP voting ─────────────────────────────────────────────────────────────────
const votedFor = ref<string | null>(null)
const voteCounts = ref<Record<string, number>>({})
const voteLoading = ref(false)
const voteError = ref('')

async function loadVoteData() {
  if (!data.value?.match) return
  const { data: voteRows } = await supabase.from('mvp_votes').select('nominee_id').eq('match_id', id) as { data: { nominee_id: string }[] | null }
  const tally: Record<string, number> = {}
  for (const row of voteRows ?? []) tally[row.nominee_id] = (tally[row.nominee_id] ?? 0) + 1
  voteCounts.value = tally
  if (user.value) {
    const { data: myVote } = await supabase.from('mvp_votes').select('nominee_id').eq('match_id', id).eq('voter_id', user.value.id).maybeSingle() as { data: { nominee_id: string } | null }
    votedFor.value = myVote?.nominee_id ?? null
  }
}

async function castVote(nomineeId: string) {
  if (voteLoading.value || votedFor.value) return
  voteLoading.value = true; voteError.value = ''
  try {
    await $fetch('/api/votes', { method: 'POST', body: { match_id: id, nominee_id: nomineeId } })
    votedFor.value = nomineeId
    voteCounts.value[nomineeId] = (voteCounts.value[nomineeId] ?? 0) + 1
  } catch (err: unknown) {
    voteError.value = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Vote failed'
  } finally { voteLoading.value = false }
}

const totalVotes = computed(() => Object.values(voteCounts.value).reduce((a, b) => a + b, 0))
function votePercent(nomineeId: string) {
  return totalVotes.value === 0 ? 0 : Math.round(((voteCounts.value[nomineeId] ?? 0) / totalVotes.value) * 100)
}

const { data, pending, error } = await useAsyncData<MatchPageData | null>(`match-page-${id}`, async () => {
  type SR<T> = { data: T | null; error: unknown }

  const { data: match } = await supabase
    .from('matches')
    .select('id, date, match_type, player1_id, player2_id, player3_id, player4_id, winner_id, loser_id, score, surface, tournament, ranked, stream_url, is_live, live_score, status, created_at')
    .eq('id', id).single() as SR<MatchRow>
  if (!match) return null

  const allPlayerIds = [match.player1_id, match.player2_id, match.player3_id, match.player4_id].filter(Boolean) as string[]

  const [playersRes, mmrRes, h2hRaw] = await Promise.all([
    supabase.from('players').select('id, name, avatar_url, mmr, tier').in('id', allPlayerIds),
    supabase.from('elo_history').select('player_id, delta').eq('match_id', id),
    (match.player1_id && match.player2_id)
      ? supabase.from('matches').select('id, date, score, surface, winner_id, loser_id').or(
          `and(player1_id.eq.${match.player1_id},player2_id.eq.${match.player2_id}),and(player1_id.eq.${match.player2_id},player2_id.eq.${match.player1_id})`
        ).lte('date', match.date).order('date', { ascending: false })
      : Promise.resolve({ data: [] }),
  ]) as [SR<PlayerSnap[]>, SR<MmrChange[]>, SR<H2HMatch[]>]

  const pm = new Map((playersRes.data ?? []).map(p => [p.id, p]))

  const h2hMatches = (h2hRaw.data ?? []) as H2HMatch[]
  const winnerH2HWins = h2hMatches.filter(m => m.winner_id === match.player1_id).length
  const loserH2HWins  = h2hMatches.filter(m => m.winner_id === match.player2_id).length

  return {
    match,
    player1: match.player1_id ? (pm.get(match.player1_id) ?? null) : null,
    player2: match.player2_id ? (pm.get(match.player2_id) ?? null) : null,
    player3: match.player3_id ? (pm.get(match.player3_id) ?? null) : null,
    player4: match.player4_id ? (pm.get(match.player4_id) ?? null) : null,
    h2hMatches,
    winnerH2HWins,
    loserH2HWins,
    mmrChanges: mmrRes.data ?? [],
  }
})

if (!data.value && !pending.value) throw createError({ statusCode: 404, statusMessage: 'Match not found' })

onMounted(loadVoteData)
watch(user, loadVoteData)

const isDoubles   = computed(() => data.value?.match?.match_type === 'doubles')
const isCompleted = computed(() => data.value?.match?.status === 'completed')
const isLive      = computed(() => data.value?.match?.is_live)

const formattedDate = computed(() => {
  const d = data.value?.match?.date
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
})

// Which players are on the winning / losing team
const teamA = computed(() => ({ main: data.value?.player1, partner: data.value?.player3 }))
const teamB = computed(() => ({ main: data.value?.player2, partner: data.value?.player4 }))

const teamAWon = computed(() => {
  const m = data.value?.match
  return m?.winner_id === m?.player1_id
})

// All voteable players for MVP (2 for singles, 4 for doubles)
const voteablePlayers = computed(() => {
  const d = data.value
  if (!d || !isCompleted.value) return []
  const ids = [d.match.winner_id, d.match.loser_id, ...(isDoubles.value ? [d.match.player3_id, d.match.player4_id] : [])].filter(Boolean) as string[]
  const pm = new Map([d.player1, d.player2, d.player3, d.player4].filter(Boolean).map(p => [p!.id, p!]))
  return ids.map(id => ({ id, name: pm.get(id)?.name ?? '—' }))
})

function mmrDelta(playerId: string | null | undefined) {
  if (!playerId) return null
  return data.value?.mmrChanges.find(e => e.player_id === playerId)?.delta ?? null
}

useHead(() => {
  const d = data.value
  if (!d) return { title: 'Match — TRD Ranking' }
  const teamALabel = [d.player1?.name, d.player3?.name].filter(Boolean).join(' & ')
  const teamBLabel = [d.player2?.name, d.player4?.name].filter(Boolean).join(' & ')
  return { title: `${teamALabel} vs ${teamBLabel} — TRD Ranking` }
})
</script>

<template>
  <div v-if="pending" class="text-slate-400">Loading…</div>
  <div v-else-if="error || !data" class="text-red-400">Match not found.</div>

  <div v-else class="space-y-8">
    <!-- Match header -->
    <div class="card space-y-4">
      <!-- Meta row -->
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-2">
          <!-- Date -->
          <span class="text-sm text-slate-400">{{ formattedDate }}</span>

          <!-- Surface -->
          <SurfaceBadge :surface="data.match.surface" />

          <!-- Match type -->
          <span v-if="isDoubles" class="text-xs font-medium text-slate-300 bg-slate-700/60 ring-1 ring-slate-600/50 rounded-full px-2.5 py-0.5">Doubles</span>

          <!-- Ranked / Friendly -->
          <span v-if="data.match.ranked !== false" class="text-xs font-semibold text-brand-400 bg-brand-400/10 ring-1 ring-brand-400/25 rounded-full px-2.5 py-0.5">Ranked</span>
          <span v-else class="text-xs text-slate-400 bg-slate-700/50 ring-1 ring-slate-600/50 rounded-full px-2.5 py-0.5">Friendly</span>

          <!-- Status -->
          <span v-if="isLive" class="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400 bg-red-400/10 ring-1 ring-red-400/25 rounded-full px-2.5 py-0.5">
            <span class="relative flex h-1.5 w-1.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
            </span>
            Live
          </span>
          <span v-else-if="isCompleted" class="text-xs text-slate-500 bg-slate-700/40 ring-1 ring-slate-600/40 rounded-full px-2.5 py-0.5">Completed</span>
          <span v-else class="text-xs font-medium text-yellow-500/80 bg-yellow-500/10 ring-1 ring-yellow-500/25 rounded-full px-2.5 py-0.5">Scheduled</span>

          <!-- Tournament -->
          <span v-if="data.match.tournament" class="text-xs text-slate-400 truncate max-w-[160px]">{{ data.match.tournament }}</span>
        </div>
        <NuxtLink
          v-if="user"
          :to="`/admin/matches/${id}/edit`"
          class="shrink-0 rounded-lg border border-surface-border px-2.5 py-1 text-xs text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
        >Edit</NuxtLink>
      </div>

      <!-- Score row -->
      <div class="flex items-center gap-2 sm:gap-4">
        <!-- Team A / Player 1 -->
        <div class="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <PlayerAvatar :name="teamA.main?.name ?? '—'" :avatar-url="teamA.main?.avatar_url ?? null" :size="48" class="shrink-0" />
          <div class="min-w-0">
            <NuxtLink :to="teamA.main ? `/players/${teamA.main.id}` : '#'" class="font-semibold text-white hover:text-brand-400 transition-colors truncate block">
              {{ teamA.main?.name ?? '—' }}
            </NuxtLink>
            <!-- Doubles partner -->
            <NuxtLink v-if="isDoubles && teamA.partner" :to="`/players/${teamA.partner.id}`" class="text-sm text-slate-400 hover:text-white transition-colors truncate block">
              &amp; {{ teamA.partner.name }}
            </NuxtLink>
            <div class="flex items-center gap-1 sm:gap-2 mt-1 flex-wrap">
              <RankBadge v-if="teamA.main" :tier="teamA.main.tier" :size="32" />
              <MmrDelta v-if="isCompleted" :delta="mmrDelta(teamA.main?.id)" />
              <template v-if="isDoubles && teamA.partner">
                <span class="text-slate-600 text-xs">·</span>
                <RankBadge :tier="teamA.partner.tier" :size="32" />
                <MmrDelta v-if="isCompleted" :delta="mmrDelta(teamA.partner.id)" />
              </template>
              <span v-if="isCompleted && teamAWon" class="text-xs text-brand-400 font-semibold">W</span>
              <span v-else-if="isCompleted && !teamAWon && data.match.winner_id" class="text-xs text-red-400 font-semibold">L</span>
            </div>
          </div>
        </div>

        <!-- Centre score -->
        <div class="text-center shrink-0 px-2 sm:px-4">
          <template v-if="isCompleted && data.match.score">
            <p class="text-lg sm:text-2xl font-mono font-bold text-white">{{ data.match.score }}</p>
            <p class="text-xs text-slate-500 mt-1 hidden sm:block">Final score</p>
          </template>
          <template v-else-if="data.match.live_score">
            <p class="text-lg sm:text-2xl font-mono font-bold text-white">{{ data.match.live_score }}</p>
            <p class="text-xs text-red-400 mt-1">Live score</p>
          </template>
          <template v-else>
            <p class="text-slate-600 font-semibold">vs</p>
            <p class="text-xs text-slate-600 mt-1 capitalize">{{ data.match.status }}</p>
          </template>
        </div>

        <!-- Team B / Player 2 -->
        <div class="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 flex-row-reverse text-right">
          <PlayerAvatar :name="teamB.main?.name ?? '—'" :avatar-url="teamB.main?.avatar_url ?? null" :size="48" class="shrink-0" />
          <div class="min-w-0">
            <NuxtLink :to="teamB.main ? `/players/${teamB.main.id}` : '#'" class="font-semibold text-slate-400 hover:text-white transition-colors truncate block">
              {{ teamB.main?.name ?? '—' }}
            </NuxtLink>
            <!-- Doubles partner -->
            <NuxtLink v-if="isDoubles && teamB.partner" :to="`/players/${teamB.partner.id}`" class="text-sm text-slate-500 hover:text-white transition-colors truncate block">
              &amp; {{ teamB.partner.name }}
            </NuxtLink>
            <div class="flex items-center gap-1 sm:gap-2 mt-1 justify-end flex-wrap">
              <template v-if="isDoubles && teamB.partner">
                <MmrDelta v-if="isCompleted" :delta="mmrDelta(teamB.partner.id)" />
                <RankBadge :tier="teamB.partner.tier" :size="32" />
                <span class="text-slate-600 text-xs">·</span>
              </template>
              <MmrDelta v-if="isCompleted" :delta="mmrDelta(teamB.main?.id)" />
              <RankBadge v-if="teamB.main" :tier="teamB.main.tier" :size="32" />
              <span v-if="isCompleted && !teamAWon && data.match.winner_id" class="text-xs text-brand-400 font-semibold">W</span>
              <span v-else-if="isCompleted && teamAWon && data.match.winner_id" class="text-xs text-red-400 font-semibold">L</span>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Stream embed -->
    <div v-if="data.match.stream_url">
      <MediaEmbed :url="data.match.stream_url" />
    </div>

    <!-- H2H (singles only — doubles pairings change each match) -->
    <div v-if="!isDoubles && isCompleted && data.h2hMatches.length" class="card space-y-4">
      <h2 class="text-xs text-slate-500 uppercase tracking-widest">Head-to-head as of this match</h2>
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-brand-400 w-6 text-right tabular-nums">{{ data.winnerH2HWins }}</span>
        <div class="flex-1 h-2 bg-surface rounded-full overflow-hidden flex">
          <div class="bg-brand-500 transition-all" :style="`width: ${data.winnerH2HWins + data.loserH2HWins > 0 ? (data.winnerH2HWins / (data.winnerH2HWins + data.loserH2HWins)) * 100 : 50}%`" />
          <div class="bg-red-500 flex-1" />
        </div>
        <span class="text-sm font-semibold text-red-400 w-6 tabular-nums">{{ data.loserH2HWins }}</span>
      </div>
      <div class="flex justify-between text-xs text-slate-500">
        <span>{{ data.player1?.name }}</span>
        <span>{{ data.player2?.name }}</span>
      </div>
      <div v-if="data.h2hMatches.length > 1" class="space-y-2 pt-2 border-t border-surface-border">
        <p class="text-xs text-slate-500">Previous meetings</p>
        <div v-for="m in data.h2hMatches.filter(m => m.id !== id)" :key="m.id" class="flex items-center justify-between text-xs text-slate-400">
          <NuxtLink :to="`/matches/${m.id}`" class="hover:text-white transition-colors">
            {{ new Date(m.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }}
          </NuxtLink>
          <div class="flex items-center gap-2">
            <span :class="m.winner_id === data.match.player1_id ? 'text-brand-400' : 'text-red-400'" class="font-semibold">
              {{ m.winner_id === data.match.player1_id ? data.player1?.name : data.player2?.name }}
            </span>
            <SurfaceBadge :surface="m.surface" />
          </div>
        </div>
      </div>
    </div>

    <!-- MVP voting -->
    <div v-if="isCompleted" class="card space-y-4">
      <h2 class="text-xs text-slate-500 uppercase tracking-widest">MVP vote</h2>
      <p v-if="!user" class="text-sm text-slate-400">
        <NuxtLink to="/login" class="text-brand-400 hover:text-brand-300 underline-offset-2 hover:underline">Sign in</NuxtLink>
        to vote for the match MVP.
      </p>
      <template v-else>
        <p v-if="votedFor" class="text-sm text-green-400">
          You voted for <span class="font-semibold text-white">{{ voteablePlayers.find(p => p.id === votedFor)?.name }}</span>
        </p>
        <div class="grid grid-cols-2 gap-3">
          <button
            v-for="player in voteablePlayers" :key="player.id"
            :disabled="!!votedFor || voteLoading"
            :class="['rounded-lg border px-4 py-3 text-sm font-medium transition-colors text-left space-y-2', votedFor === player.id ? 'border-brand-500 bg-brand-900/40 text-white' : votedFor ? 'border-surface-border text-slate-500 opacity-50 cursor-not-allowed' : 'border-surface-border text-slate-300 hover:border-brand-600 hover:text-white']"
            @click="castVote(player.id)"
          >
            <span class="block">{{ player.name }}</span>
            <div class="h-1 w-full rounded-full bg-surface overflow-hidden">
              <div class="h-full bg-brand-500 transition-all duration-500" :style="`width: ${votePercent(player.id)}%`" />
            </div>
            <span class="text-xs text-slate-500">{{ voteCounts[player.id] ?? 0 }} vote{{ (voteCounts[player.id] ?? 0) === 1 ? '' : 's' }}<span v-if="totalVotes > 0"> ({{ votePercent(player.id) }}%)</span></span>
          </button>
        </div>
        <p v-if="voteError" class="text-sm text-red-400">{{ voteError }}</p>
      </template>
    </div>
  </div>
</template>
