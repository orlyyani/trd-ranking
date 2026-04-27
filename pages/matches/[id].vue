<script setup lang="ts">
import type { Surface } from '~/types/database.types'

interface MatchRow {
  id: string; date: string; winner_id: string; loser_id: string
  score: string; surface: Surface; tournament: string | null; created_at: string
}
interface PlayerSnap { id: string; name: string; avatar_url: string | null; elo: number }
interface H2HMatch { id: string; date: string; score: string; surface: Surface; winner_id: string; loser_id: string }
interface EloChange { player_id: string; delta: number }
interface MatchPageData {
  match: MatchRow
  winner: PlayerSnap | null
  loser: PlayerSnap | null
  h2hMatches: H2HMatch[]
  winnerH2HWins: number
  loserH2HWins: number
  eloChanges: EloChange[]
}

const route = useRoute()
const id = route.params.id as string

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
if (!UUID_RE.test(id)) {
  throw createError({ statusCode: 404, statusMessage: 'Match not found' })
}

const supabase = useSupabase()
const user = useSupabaseUser()

// ── MVP voting state (client-side, user-specific) ──────────────────────────
const votedFor = ref<string | null>(null)      // nominee_id the user voted for, if any
const voteCounts = ref<Record<string, number>>({}) // nominee_id → count
const voteLoading = ref(false)
const voteError = ref('')

async function loadVoteData() {
  if (!data.value?.match) return

  // Aggregate vote counts for this match
  const { data: voteRows } = await supabase
    .from('mvp_votes')
    .select('nominee_id')
    .eq('match_id', id) as { data: { nominee_id: string }[] | null }

  const tally: Record<string, number> = {}
  for (const row of voteRows ?? []) {
    tally[row.nominee_id] = (tally[row.nominee_id] ?? 0) + 1
  }
  voteCounts.value = tally

  // Check if current user has already voted
  if (user.value) {
    const { data: myVote } = await supabase
      .from('mvp_votes')
      .select('nominee_id')
      .eq('match_id', id)
      .eq('voter_id', user.value.id)
      .maybeSingle() as { data: { nominee_id: string } | null }

    votedFor.value = myVote?.nominee_id ?? null
  }
}

async function castVote(nomineeId: string) {
  if (voteLoading.value || votedFor.value) return
  voteLoading.value = true
  voteError.value = ''

  try {
    await $fetch('/api/votes', {
      method: 'POST',
      body: { match_id: id, nominee_id: nomineeId },
    })
    votedFor.value = nomineeId
    voteCounts.value[nomineeId] = (voteCounts.value[nomineeId] ?? 0) + 1
  } catch (err: unknown) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Vote failed'
    voteError.value = msg
  } finally {
    voteLoading.value = false
  }
}

const totalVotes = computed(() => Object.values(voteCounts.value).reduce((a, b) => a + b, 0))

function votePercent(nomineeId: string) {
  if (totalVotes.value === 0) return 0
  return Math.round(((voteCounts.value[nomineeId] ?? 0) / totalVotes.value) * 100)
}

const { data, pending, error } = await useAsyncData<MatchPageData | null>(`match-page-${id}`, async () => {
  type SR<T> = { data: T | null; error: unknown }

  // 1. Fetch the match.
  const { data: match } = await supabase.from('matches').select('*').eq('id', id).single() as SR<MatchRow>
  if (!match) return null

  // 2. Fetch both players + ELO changes for this match in parallel.
  const [winnerRes, loserRes, eloRes, h2hRaw] = await Promise.all([
    supabase.from('players').select('id, name, avatar_url, elo').eq('id', match.winner_id).single(),
    supabase.from('players').select('id, name, avatar_url, elo').eq('id', match.loser_id).single(),
    supabase.from('elo_history').select('player_id, delta').eq('match_id', id),
    supabase
      .from('matches')
      .select('id, date, score, surface, winner_id, loser_id')
      .or(
        `and(winner_id.eq.${match.winner_id},loser_id.eq.${match.loser_id}),` +
        `and(winner_id.eq.${match.loser_id},loser_id.eq.${match.winner_id})`,
      )
      .lte('date', match.date)
      .order('date', { ascending: false }),
  ]) as [SR<PlayerSnap>, SR<PlayerSnap>, SR<EloChange[]>, SR<H2HMatch[]>]

  const h2hMatches = h2hRaw.data ?? []
  const winnerH2HWins = h2hMatches.filter(m => m.winner_id === match.winner_id).length
  const loserH2HWins  = h2hMatches.filter(m => m.winner_id === match.loser_id).length
  const eloChanges = eloRes.data ?? []

  return { match, winner: winnerRes.data, loser: loserRes.data, h2hMatches, winnerH2HWins, loserH2HWins, eloChanges }
})

if (!data.value && !pending.value) {
  throw createError({ statusCode: 404, statusMessage: 'Match not found' })
}

// Load vote data once match data is available; reload if user signs in/out.
onMounted(loadVoteData)
watch(user, loadVoteData)

const formattedDate = computed(() => {
  const d = data.value?.match?.date
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
})

useHead(() => ({
  title: data.value
    ? `${data.value.winner?.name} vs ${data.value.loser?.name} — TRD Ranking`
    : 'Match',
}))
</script>

<template>
  <div v-if="pending" class="text-slate-400">Loading…</div>
  <div v-else-if="error || !data" class="text-red-400">Match not found.</div>

  <div v-else class="space-y-8">
    <!-- Match header -->
    <div class="card space-y-4">
      <!-- Date / surface / tournament -->
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>{{ formattedDate }}</span>
          <span>·</span>
          <SurfaceBadge :surface="data.match.surface" />
          <template v-if="data.match.tournament">
            <span>·</span>
            <span>{{ data.match.tournament }}</span>
          </template>
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
        <!-- Winner -->
        <NuxtLink :to="`/players/${data.match.winner_id}`" class="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 group">
          <PlayerAvatar :name="data.winner?.name ?? '—'" :avatar-url="data.winner?.avatar_url" :size="48" class="shrink-0" />
          <div class="min-w-0">
            <p class="font-semibold text-white group-hover:text-brand-400 transition-colors truncate">
              {{ data.winner?.name }}
            </p>
            <div class="flex items-center gap-1 sm:gap-2 mt-1 flex-wrap">
              <EloChip :elo="data.winner!.elo" />
              <EloDelta :delta="data!.eloChanges.find(e => e.player_id === data!.match.winner_id)?.delta ?? null" />
            </div>
          </div>
        </NuxtLink>

        <!-- Score -->
        <div class="text-center shrink-0 px-2 sm:px-4">
          <p class="text-lg sm:text-2xl font-mono font-bold text-white">{{ data.match.score }}</p>
          <p class="text-xs text-slate-500 mt-1 hidden sm:block">Final score</p>
        </div>

        <!-- Loser -->
        <NuxtLink :to="`/players/${data.match.loser_id}`" class="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 flex-row-reverse text-right group">
          <PlayerAvatar :name="data.loser?.name ?? '—'" :avatar-url="data.loser?.avatar_url" :size="48" class="shrink-0" />
          <div class="min-w-0">
            <p class="font-semibold text-slate-400 group-hover:text-white transition-colors truncate">
              {{ data.loser?.name }}
            </p>
            <div class="flex items-center gap-1 sm:gap-2 mt-1 justify-end flex-wrap">
              <EloDelta :delta="data!.eloChanges.find(e => e.player_id === data!.match.loser_id)?.delta ?? null" />
              <EloChip :elo="data.loser!.elo" />
            </div>
          </div>
        </NuxtLink>
      </div>
    </div>

    <!-- H2H record as of this match -->
    <div class="card space-y-4">
      <h2 class="text-xs text-slate-500 uppercase tracking-widest">
        Head-to-head as of this match
      </h2>

      <!-- Win bar -->
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-brand-400 w-6 text-right tabular-nums">
          {{ data.winnerH2HWins }}
        </span>
        <div class="flex-1 h-2 bg-surface rounded-full overflow-hidden flex">
          <div
            class="bg-brand-500 transition-all"
            :style="`width: ${data.winnerH2HWins + data.loserH2HWins > 0
              ? (data.winnerH2HWins / (data.winnerH2HWins + data.loserH2HWins)) * 100
              : 50}%`"
          />
          <div class="bg-red-500 flex-1" />
        </div>
        <span class="text-sm font-semibold text-red-400 w-6 tabular-nums">
          {{ data.loserH2HWins }}
        </span>
      </div>

      <div class="flex justify-between text-xs text-slate-500">
        <span>{{ data.winner?.name }}</span>
        <span>{{ data.loser?.name }}</span>
      </div>

      <!-- Previous meetings -->
      <div v-if="data.h2hMatches.length > 1" class="space-y-2 pt-2 border-t border-surface-border">
        <p class="text-xs text-slate-500">Previous meetings</p>
        <div
          v-for="m in data.h2hMatches.filter(m => m.id !== id)"
          :key="m.id"
          class="flex items-center justify-between text-xs text-slate-400"
        >
          <NuxtLink :to="`/matches/${m.id}`" class="hover:text-white transition-colors">
            {{ new Date(m.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }}
          </NuxtLink>
          <div class="flex items-center gap-2">
            <span :class="m.winner_id === data.match.winner_id ? 'text-brand-400' : 'text-red-400'" class="font-semibold">
              {{ m.winner_id === data.match.winner_id ? data.winner?.name : data.loser?.name }}
            </span>
            <SurfaceBadge :surface="m.surface" />
          </div>
        </div>
      </div>
    </div>

    <!-- MVP voting -->
    <div class="card space-y-4">
      <h2 class="text-xs text-slate-500 uppercase tracking-widest">MVP vote</h2>

      <!-- Not signed in -->
      <p v-if="!user" class="text-sm text-slate-400">
        <NuxtLink to="/login" class="text-brand-400 hover:text-brand-300 underline-offset-2 hover:underline">Sign in</NuxtLink>
        to vote for the match MVP.
      </p>

      <template v-else>
        <!-- Already voted -->
        <p v-if="votedFor" class="text-sm text-green-400">
          You voted for
          <span class="font-semibold text-white">
            {{ votedFor === data.match.winner_id ? data.winner?.name : data.loser?.name }}
          </span>
        </p>

        <!-- Vote buttons -->
        <div class="grid grid-cols-2 gap-3">
          <button
            v-for="player in [
              { id: data.match.winner_id, name: data.winner?.name },
              { id: data.match.loser_id,  name: data.loser?.name  },
            ]"
            :key="player.id"
            :disabled="!!votedFor || voteLoading"
            :class="[
              'rounded-lg border px-4 py-3 text-sm font-medium transition-colors text-left space-y-2',
              votedFor === player.id
                ? 'border-brand-500 bg-brand-900/40 text-white'
                : votedFor
                  ? 'border-surface-border text-slate-500 opacity-50 cursor-not-allowed'
                  : 'border-surface-border text-slate-300 hover:border-brand-600 hover:text-white',
            ]"
            @click="castVote(player.id)"
          >
            <span class="block">{{ player.name }}</span>
            <!-- Vote bar -->
            <div class="h-1 w-full rounded-full bg-surface overflow-hidden">
              <div
                class="h-full bg-brand-500 transition-all duration-500"
                :style="`width: ${votePercent(player.id)}%`"
              />
            </div>
            <span class="text-xs text-slate-500">
              {{ voteCounts[player.id] ?? 0 }} vote{{ (voteCounts[player.id] ?? 0) === 1 ? '' : 's' }}
              <span v-if="totalVotes > 0">({{ votePercent(player.id) }}%)</span>
            </span>
          </button>
        </div>

        <p v-if="voteError" class="text-sm text-red-400">{{ voteError }}</p>
      </template>
    </div>
  </div>
</template>