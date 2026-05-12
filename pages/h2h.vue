<script setup lang="ts">
import type { Surface } from '~/types/database.types'

interface H2HPlayer {
  id: string
  name: string
  avatar_url: string | null
  mmr: number
  tier: string
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

const { data: players } = await useAsyncData<H2HPlayer[]>('h2h-players', async () => {
  const { data } = await supabase
    .from('players')
    .select('id, name, avatar_url, mmr, tier')
    .order('mmr', { ascending: false })
  return (data ?? []) as H2HPlayer[]
})

const playerAId = ref('')
const playerBId = ref('')

const bothSelected = computed(() =>
  !!playerAId.value && !!playerBId.value && playerAId.value !== playerBId.value,
)

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

const total    = computed(() => (h2h.value?.aWins ?? 0) + (h2h.value?.bWins ?? 0))
const aWinPct  = computed(() => total.value > 0 ? (h2h.value!.aWins / total.value) * 100 : 50)
const winPctA  = computed(() => total.value > 0 ? Math.round((h2h.value!.aWins / total.value) * 100) : 0)
const winPctB  = computed(() => total.value > 0 ? 100 - winPctA.value : 0)

// Sets won — scores are stored as "W-L" per set from the match winner's perspective
const setsStats = computed(() => {
  const matches = h2h.value?.matches
  if (!matches?.length) return null
  let aSets = 0, bSets = 0
  for (const m of matches) {
    for (const set of (m.score ?? '').split(' ')) {
      const [ws, ls] = set.split('-')
      const w = parseInt(ws), l = parseInt(ls)
      if (isNaN(w) || isNaN(l)) continue
      if (w > l) { m.winner_id === playerAId.value ? aSets++ : bSets++ }
      else if (l > w) { m.loser_id === playerAId.value ? aSets++ : bSets++ }
    }
  }
  return { aSets, bSets, total: aSets + bSets }
})

// Current winning streak (matches are sorted newest first)
const streak = computed(() => {
  const matches = h2h.value?.matches
  if (!matches?.length) return null
  const leaderId = matches[0].winner_id
  let count = 0
  for (const m of matches) {
    if (m.winner_id !== leaderId) break
    count++
  }
  return { isA: leaderId === playerAId.value, count }
})

// Surface breakdown
const surfaceStats = computed(() => {
  const matches = h2h.value?.matches
  if (!matches?.length) return []
  const map = new Map<string, { aWins: number; bWins: number }>()
  for (const m of matches) {
    if (!map.has(m.surface)) map.set(m.surface, { aWins: 0, bWins: 0 })
    const s = map.get(m.surface)!
    m.winner_id === playerAId.value ? s.aWins++ : s.bWins++
  }
  return [...map.entries()]
    .sort((a, b) => (b[1].aWins + b[1].bWins) - (a[1].aWins + a[1].bWins))
    .map(([surface, s]) => ({ surface, aWins: s.aWins, bWins: s.bWins, total: s.aWins + s.bWins }))
})

useHead({ title: 'Head-to-Head' })
</script>

<template>
  <div class="space-y-8">
    <h1 class="text-2xl font-semibold text-white">Head-to-Head</h1>

    <!-- Player pickers -->
    <div class="card grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-4 items-center">
      <div class="space-y-1">
        <label class="text-xs text-slate-500 uppercase tracking-widest">Player A</label>
        <PlayerCombobox v-model="playerAId" :players="players ?? []" :disabled-ids="new Set(playerBId ? [playerBId] : [])" placeholder="Search player…" />
      </div>

      <span class="text-slate-600 text-lg font-bold text-center">vs</span>

      <div class="space-y-1">
        <label class="text-xs text-slate-500 uppercase tracking-widest">Player B</label>
        <PlayerCombobox v-model="playerBId" :players="players ?? []" :disabled-ids="new Set(playerAId ? [playerAId] : [])" placeholder="Search player…" />
      </div>
    </div>

    <p v-if="!bothSelected" class="text-slate-500 text-sm text-center">
      Select two different players to see their head-to-head record.
    </p>

    <div v-else-if="status === 'pending'" class="text-slate-400 text-sm text-center">Loading…</div>

    <template v-else-if="h2h">
      <!-- Player header -->
      <div class="flex flex-col sm:grid sm:grid-cols-[1fr_auto_1fr] items-center gap-4">
        <!-- Player A -->
        <NuxtLink :to="`/players/${playerAId}`" class="flex items-center gap-3 group w-full sm:w-auto">
          <PlayerAvatar :name="playerA!.name" :avatar-url="playerA!.avatar_url" :size="48" />
          <div class="min-w-0">
            <p class="font-semibold text-white group-hover:text-brand-400 transition-colors truncate">{{ playerA!.name }}</p>
            <RankBadge :tier="playerA!.tier" :size="36" />
          </div>
        </NuxtLink>

        <!-- Win counts + bar + percentages -->
        <div class="text-center space-y-2 sm:px-4 w-full sm:w-36">
          <p class="text-3xl font-bold font-mono text-white tabular-nums">
            {{ h2h.aWins }}<span class="text-slate-600 mx-1">–</span>{{ h2h.bWins }}
          </p>
          <div class="flex h-2 w-full rounded-full overflow-hidden">
            <div class="bg-brand-500 transition-all duration-500" :style="`width: ${aWinPct}%`" />
            <div class="bg-red-500 flex-1" />
          </div>
          <div class="flex justify-between text-xs tabular-nums">
            <span class="text-brand-400 font-semibold">{{ winPctA }}%</span>
            <span class="text-slate-500">{{ total }} match{{ total !== 1 ? 'es' : '' }}</span>
            <span class="text-red-400 font-semibold">{{ winPctB }}%</span>
          </div>
        </div>

        <!-- Player B -->
        <NuxtLink :to="`/players/${playerBId}`" class="flex items-center gap-3 sm:flex-row-reverse sm:text-right group w-full sm:w-auto">
          <PlayerAvatar :name="playerB!.name" :avatar-url="playerB!.avatar_url" :size="48" />
          <div class="min-w-0">
            <p class="font-semibold text-white group-hover:text-brand-400 transition-colors truncate">{{ playerB!.name }}</p>
            <RankBadge :tier="playerB!.tier" :size="36" />
          </div>
        </NuxtLink>
      </div>

      <p v-if="!h2h.matches.length" class="text-slate-500 text-sm text-center">
        No matches played between these two players yet.
      </p>

      <template v-else>
        <!-- Stats cards -->
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <!-- Sets -->
          <div v-if="setsStats" class="card space-y-2">
            <p class="text-xs text-slate-500 uppercase tracking-widest">Sets won</p>
            <div class="flex items-baseline justify-between">
              <span class="text-2xl font-bold tabular-nums text-brand-400">{{ setsStats.aSets }}</span>
              <span class="text-slate-600 text-sm">–</span>
              <span class="text-2xl font-bold tabular-nums text-red-400">{{ setsStats.bSets }}</span>
            </div>
            <div class="flex h-1.5 w-full rounded-full overflow-hidden bg-surface-border">
              <div class="bg-brand-500 transition-all duration-500" :style="`width: ${setsStats.total > 0 ? (setsStats.aSets / setsStats.total) * 100 : 50}%`" />
              <div class="bg-red-500 flex-1" />
            </div>
          </div>

          <!-- Streak -->
          <div v-if="streak" class="card space-y-2">
            <p class="text-xs text-slate-500 uppercase tracking-widest">Current streak</p>
            <p class="text-2xl font-bold tabular-nums" :class="streak.isA ? 'text-brand-400' : 'text-red-400'">
              W{{ streak.count }}
            </p>
            <p class="text-xs text-slate-400 truncate">
              {{ streak.isA ? playerA!.name : playerB!.name }}
            </p>
          </div>

          <!-- MMR diff -->
          <div class="card space-y-2">
            <p class="text-xs text-slate-500 uppercase tracking-widest">MMR gap</p>
            <p class="text-2xl font-bold tabular-nums text-white">
              {{ Math.abs((playerA?.mmr ?? 0) - (playerB?.mmr ?? 0)) }}
            </p>
            <p class="text-xs text-slate-400 truncate">
              {{ (playerA?.mmr ?? 0) >= (playerB?.mmr ?? 0) ? playerA!.name : playerB!.name }} leads
            </p>
          </div>
        </div>

        <!-- Surface breakdown (only when played on more than one surface) -->
        <div v-if="surfaceStats.length > 1" class="card space-y-4">
          <h2 class="text-xs text-slate-500 uppercase tracking-widest">By surface</h2>
          <div class="space-y-3">
            <div v-for="s in surfaceStats" :key="s.surface" class="grid grid-cols-[3rem_1fr_3rem] items-center gap-3">
              <span class="text-xs text-brand-400 font-semibold tabular-nums text-right">{{ s.aWins }}-{{ s.bWins }}</span>
              <div class="space-y-1">
                <div class="flex h-1.5 rounded-full overflow-hidden bg-surface-border">
                  <div class="bg-brand-500 transition-all duration-500" :style="`width: ${(s.aWins / s.total) * 100}%`" />
                  <div class="bg-red-500 flex-1" />
                </div>
                <p class="text-xs text-slate-500 capitalize text-center">{{ s.surface }} <span class="text-slate-600">({{ s.total }})</span></p>
              </div>
              <span class="text-xs text-slate-500 tabular-nums">{{ Math.round((s.aWins / s.total) * 100) }}%</span>
            </div>
          </div>
        </div>

        <!-- Match history -->
        <div class="space-y-3">
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
    </template>
  </div>
</template>
