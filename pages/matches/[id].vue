<script setup lang="ts">
import type { Surface, MatchStatus } from '~/types/database.types'

interface MatchRow {
  id: string; date: string
  player1_id: string | null; player2_id: string | null
  winner_id: string | null; loser_id: string | null
  score: string | null; surface: Surface; tournament: string | null
  stream_url: string | null; is_live: boolean
  live_score: string | null; status: MatchStatus; created_at: string
}
interface PlayerSnap { id: string; name: string; avatar_url: string | null; mmr: number }
interface H2HMatch { id: string; date: string; score: string | null; surface: Surface; winner_id: string | null; loser_id: string | null }
interface MmrChange { player_id: string; delta: number }
interface MatchPageData {
  match: MatchRow
  player1: PlayerSnap | null
  player2: PlayerSnap | null
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
    .select('id, date, player1_id, player2_id, winner_id, loser_id, score, surface, tournament, stream_url, is_live, live_score, status, created_at')
    .eq('id', id).single() as SR<MatchRow>
  if (!match) return null

  const participantIds = [match.player1_id, match.player2_id].filter(Boolean) as string[]

  const [player1Res, player2Res, mmrRes, h2hRaw] = await Promise.all([
    match.player1_id ? supabase.from('players').select('id, name, avatar_url, mmr').eq('id', match.player1_id).single() : Promise.resolve({ data: null }),
    match.player2_id ? supabase.from('players').select('id, name, avatar_url, mmr').eq('id', match.player2_id).single() : Promise.resolve({ data: null }),
    supabase.from('elo_history').select('player_id, delta').eq('match_id', id),
    (match.player1_id && match.player2_id)
      ? supabase.from('matches').select('id, date, score, surface, winner_id, loser_id').or(
          `and(player1_id.eq.${match.player1_id},player2_id.eq.${match.player2_id}),and(player1_id.eq.${match.player2_id},player2_id.eq.${match.player1_id})`
        ).lte('date', match.date).order('date', { ascending: false })
      : Promise.resolve({ data: [] }),
  ]) as [SR<PlayerSnap>, SR<PlayerSnap>, SR<MmrChange[]>, SR<H2HMatch[]>]

  const h2hMatches = (h2hRaw.data ?? []) as H2HMatch[]
  const winnerH2HWins = h2hMatches.filter(m => m.winner_id === match.player1_id).length
  const loserH2HWins  = h2hMatches.filter(m => m.winner_id === match.player2_id).length

  return {
    match,
    player1: player1Res.data,
    player2: player2Res.data,
    h2hMatches,
    winnerH2HWins,
    loserH2HWins,
    mmrChanges: mmrRes.data ?? [],
  }
})

if (!data.value && !pending.value) throw createError({ statusCode: 404, statusMessage: 'Match not found' })

onMounted(loadVoteData)
watch(user, loadVoteData)

const formattedDate = computed(() => {
  const d = data.value?.match?.date
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
})

const isCompleted = computed(() => data.value?.match?.status === 'completed')
const isLive      = computed(() => data.value?.match?.is_live)

// For MVP voting, use player1 as "winner candidate" and player2 as "loser candidate"
const voteablePlayers = computed(() => {
  const m = data.value
  if (!m || !isCompleted.value) return []
  return [
    { id: m.match.winner_id!, name: m.player1?.id === m.match.winner_id ? m.player1?.name : m.player2?.name },
    { id: m.match.loser_id!,  name: m.player1?.id === m.match.loser_id  ? m.player1?.name : m.player2?.name },
  ].filter(p => p.id)
})

useHead(() => ({
  title: data.value ? `${data.value.player1?.name} vs ${data.value.player2?.name} — TRD Ranking` : 'Match',
}))
</script>

<template>
  <div v-if="pending" class="text-slate-400">Loading…</div>
  <div v-else-if="error || !data" class="text-red-400">Match not found.</div>

  <div v-else class="space-y-8">
    <!-- Match header -->
    <div class="card space-y-4">
      <!-- Meta row -->
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>{{ formattedDate }}</span>
          <span>·</span>
          <SurfaceBadge :surface="data.match.surface" />
          <template v-if="data.match.tournament">
            <span>·</span>
            <span>{{ data.match.tournament }}</span>
          </template>
          <!-- Status badge -->
          <span>·</span>
          <span :class="['font-semibold capitalize', isLive ? 'text-red-400' : isCompleted ? 'text-brand-400' : 'text-yellow-400']">
            <template v-if="isLive">
              <span class="inline-flex items-center gap-1">
                <span class="relative flex h-1.5 w-1.5">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                </span>
                Live
              </span>
            </template>
            <template v-else>{{ data.match.status }}</template>
          </span>
        </div>
        <NuxtLink
          v-if="user"
          :to="`/admin/matches/${id}/edit`"
          class="shrink-0 rounded-lg border border-surface-border px-2.5 py-1 text-xs text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
        >
          Edit
        </NuxtLink>
      </div>

      <!-- Score row -->
      <div class="flex items-center gap-2 sm:gap-4">
        <!-- Player 1 -->
        <NuxtLink :to="data.player1 ? `/players/${data.player1.id}` : '#'" class="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 group">
          <PlayerAvatar :name="data.player1?.name ?? '—'" :avatar-url="data.player1?.avatar_url ?? null" :size="48" class="shrink-0" />
          <div class="min-w-0">
            <p class="font-semibold text-white group-hover:text-brand-400 transition-colors truncate">{{ data.player1?.name ?? '—' }}</p>
            <div class="flex items-center gap-1 sm:gap-2 mt-1 flex-wrap">
              <MmrChip v-if="data.player1" :mmr="data.player1.mmr" />
              <MmrDelta v-if="isCompleted && data.match.winner_id === data.player1?.id" :delta="data.mmrChanges.find(e => e.player_id === data.player1?.id)?.delta ?? null" />
              <span v-if="isCompleted && data.match.winner_id === data.player1?.id" class="text-xs text-brand-400 font-semibold">W</span>
            </div>
          </div>
        </NuxtLink>

        <!-- Centre: score / live score -->
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

        <!-- Player 2 -->
        <NuxtLink :to="data.player2 ? `/players/${data.player2.id}` : '#'" class="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 flex-row-reverse text-right group">
          <PlayerAvatar :name="data.player2?.name ?? '—'" :avatar-url="data.player2?.avatar_url ?? null" :size="48" class="shrink-0" />
          <div class="min-w-0">
            <p class="font-semibold text-slate-400 group-hover:text-white transition-colors truncate">{{ data.player2?.name ?? '—' }}</p>
            <div class="flex items-center gap-1 sm:gap-2 mt-1 justify-end flex-wrap">
              <MmrDelta v-if="isCompleted && data.match.loser_id === data.player2?.id" :delta="data.mmrChanges.find(e => e.player_id === data.player2?.id)?.delta ?? null" />
              <MmrChip v-if="data.player2" :mmr="data.player2.mmr" />
              <span v-if="isCompleted && data.match.loser_id === data.player2?.id" class="text-xs text-red-400 font-semibold">L</span>
            </div>
          </div>
        </NuxtLink>
      </div>

      <!-- Watch live button (no iframe — YouTube blocks embedding) -->
      <div v-if="data.match.stream_url" class="pt-2 border-t border-surface-border">
        <a
          :href="data.match.stream_url"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-2 rounded-lg bg-red-600/20 border border-red-800/50 hover:bg-red-600/30 px-4 py-2 text-sm font-medium text-red-400 transition-colors"
        >
          <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          Watch live ↗
        </a>
      </div>
    </div>

    <!-- H2H (completed matches only) -->
    <div v-if="isCompleted && data.h2hMatches.length" class="card space-y-4">
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

    <!-- MVP voting (completed matches only) -->
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
