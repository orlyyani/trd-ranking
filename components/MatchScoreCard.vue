<script setup lang="ts">
import type { Surface } from '~/types/database.types'

const props = defineProps<{
  matchId: string
  date: string
  score: string
  surface: Surface
  tournament?: string | null
  winnerId: string
  loserId: string
  winnerName: string
  loserName: string
  winnerAvatar?: string | null
  loserAvatar?: string | null
  /** If provided, highlights which side this player is on */
  perspectivePlayerId?: string
}>()

const isWinner = computed(() =>
  props.perspectivePlayerId === props.winnerId,
)
const isLoser = computed(() =>
  props.perspectivePlayerId === props.loserId,
)

const formattedDate = computed(() =>
  new Date(props.date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  }),
)
</script>

<template>
  <NuxtLink
    :to="`/matches/${matchId}`"
    class="card flex items-center gap-3 hover:border-surface-border/80 hover:bg-slate-800/50 transition-colors group"
  >
    <!-- Winner side -->
    <div class="flex items-center gap-2 flex-1 min-w-0">
      <PlayerAvatar :name="winnerName" :avatar-url="winnerAvatar" :size="32" />
      <span
        class="truncate text-sm font-medium"
        :class="isWinner ? 'text-brand-400' : 'text-slate-200'"
      >
        {{ winnerName }}
      </span>
    </div>

    <!-- Score block -->
    <div class="flex flex-col items-center shrink-0 px-2">
      <span class="text-sm font-mono font-semibold text-white">{{ score }}</span>
      <SurfaceBadge :surface="surface" class="mt-0.5" />
    </div>

    <!-- Loser side -->
    <div class="flex items-center gap-2 flex-1 min-w-0 flex-row-reverse">
      <PlayerAvatar :name="loserName" :avatar-url="loserAvatar" :size="32" />
      <span
        class="truncate text-sm font-medium text-right"
        :class="isLoser ? 'text-red-400' : 'text-slate-400'"
      >
        {{ loserName }}
      </span>
    </div>

    <!-- Meta (date / tournament) -->
    <div class="hidden sm:flex flex-col items-end shrink-0 text-xs text-slate-500 w-28">
      <span>{{ formattedDate }}</span>
      <span v-if="tournament" class="truncate max-w-full">{{ tournament }}</span>
    </div>
  </NuxtLink>
</template>