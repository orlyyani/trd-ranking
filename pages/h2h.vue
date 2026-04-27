<script setup lang="ts">
import type { Surface } from '~/types/database.types'

interface H2HPlayer {
  id: string
  name: string
  avatar_url: string | null
  elo: number
}

interface H2HMatch {
  id: string
  date: string
  score: string
  surface: Surface
  tournament: string | null
  winner_id: string
  loser_id: string
}

interface H2HResult {
  matches: H2HMatch[]
  aWins: number
  bWins: number
}

const supabase = useSupabase()

// All players for the dropdowns.
const { data: players } = await useAsyncData<H2HPlayer[]>('h2h-players', async () => {
  const { data } = await supabase
    .from('players')
    .select('id, name, avatar_url, elo')
    .order('elo', { ascending: false })
  return (data ?? []) as H2HPlayer[]
})

const playerAId = ref('')
const playerBId = ref('')

const bothSelected = computed(() =>
  !!playerAId.value && !!playerBId.value && playerAId.value !== playerBId.value,
)

// H2H data — re-fetches whenever the selection changes.
// server: false because it depends on client-side state.
const { data: h2h, status } = await useAsyncData<H2HResult | null>(
  'h2h-result',
  async () => {
    if (!bothSelected.value) return null

    const aId = playerAId.value
    const bId = playerBId.value

    const { data: matches } = await supabase
      .from('matches')
      .select('id, date, score, surface, tournament, winner_id, loser_id')
      .or(
        `and(winner_id.eq.${aId},loser_id.eq.${bId}),` +
        `and(winner_id.eq.${bId},loser_id.eq.${aId})`,
      )
      .order('date', { ascending: false })

    const list = (matches ?? []) as H2HMatch[]
    const aWins = list.filter(m => m.winner_id === aId).length
    const bWins = list.filter(m => m.winner_id === bId).length

    return { matches: list, aWins, bWins }
  },
  { server: false, watch: [playerAId, playerBId] },
)

const playerA = computed(() => players.value?.find(p => p.id === playerAId.value) ?? null)
const playerB = computed(() => players.value?.find(p => p.id === playerBId.value) ?? null)

const total = computed(() => (h2h.value?.aWins ?? 0) + (h2h.value?.bWins ?? 0))
const aWinPct = computed(() => total.value > 0 ? (h2h.value!.aWins / total.value) * 100 : 50)
</script>

<template>
  <div class="space-y-8">
    <h1 class="text-2xl font-semibold text-white">Head-to-Head</h1>

    <!-- Player pickers -->
    <div class="card grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-4 items-center">
      <div class="space-y-1">
        <label class="text-xs text-slate-500 uppercase tracking-widest">Player A</label>
        <select
          v-model="playerAId"
          class="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Select player…</option>
          <option
            v-for="p in players"
            :key="p.id"
            :value="p.id"
            :disabled="p.id === playerBId"
          >
            {{ p.name }}
          </option>
        </select>
      </div>

      <span class="text-slate-600 text-lg font-bold text-center">vs</span>

      <div class="space-y-1">
        <label class="text-xs text-slate-500 uppercase tracking-widest">Player B</label>
        <select
          v-model="playerBId"
          class="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Select player…</option>
          <option
            v-for="p in players"
            :key="p.id"
            :value="p.id"
            :disabled="p.id === playerAId"
          >
            {{ p.name }}
          </option>
        </select>
      </div>
    </div>

    <!-- Prompt when not selected -->
    <p v-if="!bothSelected" class="text-slate-500 text-sm text-center">
      Select two different players to see their head-to-head record.
    </p>

    <!-- Loading -->
    <div v-else-if="status === 'pending'" class="text-slate-400 text-sm text-center">Loading…</div>

    <!-- Results -->
    <template v-else-if="h2h">
      <!-- Player headers -->
      <div class="flex flex-col sm:grid sm:grid-cols-[1fr_auto_1fr] items-center gap-4">
        <!-- Player A -->
        <NuxtLink :to="`/players/${playerAId}`" class="flex items-center gap-3 group w-full sm:w-auto">
          <PlayerAvatar :name="playerA!.name" :avatar-url="playerA!.avatar_url" :size="48" />
          <div class="min-w-0">
            <p class="font-semibold text-white group-hover:text-brand-400 transition-colors truncate">{{ playerA!.name }}</p>
            <EloChip :elo="playerA!.elo" />
          </div>
        </NuxtLink>

        <!-- Win counts + bar -->
        <div class="text-center space-y-2 sm:px-4 w-full sm:w-auto">
          <p class="text-3xl font-bold font-mono text-white tabular-nums">
            {{ h2h.aWins }}<span class="text-slate-600 mx-1">–</span>{{ h2h.bWins }}
          </p>
          <div class="flex h-2 w-full sm:w-32 rounded-full overflow-hidden">
            <div class="bg-brand-500 transition-all" :style="`width: ${aWinPct}%`" />
            <div class="bg-red-500 flex-1" />
          </div>
          <p class="text-xs text-slate-500">{{ total }} match{{ total !== 1 ? 'es' : '' }}</p>
        </div>

        <!-- Player B -->
        <NuxtLink :to="`/players/${playerBId}`" class="flex items-center gap-3 sm:flex-row-reverse sm:text-right group w-full sm:w-auto">
          <PlayerAvatar :name="playerB!.name" :avatar-url="playerB!.avatar_url" :size="48" />
          <div class="min-w-0">
            <p class="font-semibold text-white group-hover:text-brand-400 transition-colors truncate">{{ playerB!.name }}</p>
            <EloChip :elo="playerB!.elo" />
          </div>
        </NuxtLink>
      </div>

      <!-- No matches yet -->
      <p v-if="!h2h.matches.length" class="text-slate-500 text-sm text-center">
        No matches played between these two players yet.
      </p>

      <!-- Match list -->
      <div v-else class="space-y-3">
        <h2 class="text-xs text-slate-500 uppercase tracking-widest">Meetings</h2>
        <div class="space-y-2">
          <MatchScoreCard
            v-for="m in h2h.matches"
            :key="m.id"
            :match-id="m.id"
            :date="m.date"
            :score="m.score"
            :surface="m.surface"
            :tournament="m.tournament"
            :winner-id="m.winner_id"
            :loser-id="m.loser_id"
            :winner-name="m.winner_id === playerAId ? playerA!.name : playerB!.name"
            :loser-name="m.loser_id === playerAId ? playerA!.name : playerB!.name"
            :winner-avatar="m.winner_id === playerAId ? playerA!.avatar_url : playerB!.avatar_url"
            :loser-avatar="m.loser_id === playerAId ? playerA!.avatar_url : playerB!.avatar_url"
          />
        </div>
      </div>
    </template>
  </div>
</template>