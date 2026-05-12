<script setup lang="ts">
import type { ChallongeTournamentData, ChallongeBracketMatch } from '~/server/api/challonge.get'

const props = defineProps<{
  data: ChallongeTournamentData
  /** Hides the name header — use when the parent already renders it */
  hideName?: boolean
}>()

const maxRound = computed(() =>
  props.data.bracket.length ? Math.max(...props.data.bracket.map(m => m.round)) : 0,
)

const roundsByNumber = computed(() => {
  const map = new Map<number, ChallongeBracketMatch[]>()
  for (const m of props.data.bracket) {
    if (!map.has(m.round)) map.set(m.round, [])
    map.get(m.round)!.push(m)
  }
  return [...map.entries()].sort(([a], [b]) => a - b)
})

function roundLabel(round: number) {
  const fromEnd = maxRound.value - round
  if (fromEnd === 0) return 'Final'
  if (fromEnd === 1) return 'Semifinals'
  if (fromEnd === 2) return 'Quarterfinals'
  return `Round ${round}`
}
</script>

<template>
  <div class="space-y-4">
    <!-- Tournament name -->
    <p v-if="!hideName && data.name" class="text-sm font-semibold text-slate-300">
      {{ data.name }}
    </p>

    <!-- Live match banner -->
    <div
      v-if="data.liveMatch"
      class="card border-red-500/40 bg-red-500/5 py-3 px-4"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2 shrink-0">
          <span class="relative flex h-2.5 w-2.5">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
          <span class="text-red-400 font-semibold text-sm uppercase tracking-widest">Live</span>
          <span class="text-slate-500 text-xs">{{ roundLabel(data.liveMatch.round) }}</span>
        </div>

        <div class="flex items-center gap-3 text-sm font-medium min-w-0">
          <span class="text-slate-100 truncate">{{ data.liveMatch.player1 }}</span>
          <span class="text-slate-500 font-mono text-xs shrink-0">
            {{ data.liveMatch.score || 'In progress' }}
          </span>
          <span class="text-slate-100 truncate">{{ data.liveMatch.player2 }}</span>
        </div>
      </div>
    </div>

    <!-- Bracket rounds -->
    <div v-if="roundsByNumber.length" class="space-y-4">
      <div v-for="[round, matches] in roundsByNumber" :key="round">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
          {{ roundLabel(round) }}
        </h3>

        <div class="space-y-1.5">
          <div
            v-for="m in matches"
            :key="m.matchId"
            class="card py-2.5 px-3 flex items-center gap-3 text-sm transition-colors"
            :class="{
              'border-red-500/30 bg-red-500/5': m.isLive,
              'border-emerald-500/30 bg-emerald-500/5': m.state === 'complete',
            }"
          >
            <!-- Player 1 -->
            <div class="flex items-center gap-1.5 flex-1 min-w-0">
              <span
                v-if="m.isLive"
                class="relative flex h-1.5 w-1.5 shrink-0"
              >
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
              </span>
              <span
                class="truncate"
                :class="
                  m.state === 'pending' ? 'text-slate-600'
                  : m.state === 'complete' && m.winnerSlot === 1 ? 'text-emerald-300 font-medium'
                  : m.state === 'complete' && m.winnerSlot === 2 ? 'text-slate-500 line-through decoration-slate-600'
                  : 'text-slate-200'
                "
              >
                {{ m.player1Name }}
              </span>
            </div>

            <!-- Score / state -->
            <div class="font-mono text-xs shrink-0 w-20 text-center">
              <template v-if="m.state === 'complete'">
                <span class="text-emerald-400">{{ m.score || '—' }}</span>
              </template>
              <template v-else-if="m.isLive">
                <span class="text-red-400">{{ m.score || 'Live' }}</span>
              </template>
              <template v-else>
                <span class="text-slate-600">vs</span>
              </template>
            </div>

            <!-- Player 2 -->
            <div class="flex items-center justify-end flex-1 min-w-0">
              <span
                class="truncate text-right"
                :class="
                  m.state === 'pending' ? 'text-slate-600'
                  : m.state === 'complete' && m.winnerSlot === 2 ? 'text-emerald-300 font-medium'
                  : m.state === 'complete' && m.winnerSlot === 1 ? 'text-slate-500 line-through decoration-slate-600'
                  : 'text-slate-400'
                "
              >
                {{ m.player2Name }}
              </span>
            </div>

            <!-- Status pill -->
            <div class="shrink-0 w-12 text-right">
              <span v-if="m.state === 'complete'" class="text-xs font-semibold text-emerald-600">&#10003;</span>
              <span v-else-if="m.state === 'pending'" class="text-xs text-slate-700">TBD</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
