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
  winnerPartnerName?: string | null
  loserPartnerName?: string | null
  isLive?: boolean
  compact?: boolean
  perspectivePlayerId?: string
  /** false = friendly/unranked — no MMR impact */
  ranked?: boolean
}>()

const isDoubles  = computed(() => !!props.winnerPartnerName || !!props.loserPartnerName)
const isFriendly = computed(() => props.ranked === false)

const isWinner = computed(() => props.perspectivePlayerId === props.winnerId)
const isLoser  = computed(() => props.perspectivePlayerId === props.loserId)

const formattedDate = computed(() =>
  new Date(props.date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  }),
)
</script>

<template>
  <NuxtLink
    :to="`/matches/${matchId}`"
    class="card flex flex-col hover:border-surface-border/80 hover:bg-slate-800/50 transition-colors group"
    :class="{
      'border-l-4 border-l-brand-500/70 rounded-l-none': ranked === true,
      'border-l-4 border-l-slate-600/60 rounded-l-none': isFriendly,
    }"
  >
    <!-- Row 1: players + score -->
    <div class="flex items-center gap-3">
      <!-- Winner side -->
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <PlayerAvatar :name="winnerName" :avatar-url="winnerAvatar" :size="32" class="shrink-0" />
        <div class="min-w-0">
          <span class="truncate text-sm font-medium block" :class="isWinner ? 'text-brand-400' : 'text-slate-200'">
            {{ winnerName }}
          </span>
          <span v-if="isDoubles && winnerPartnerName" class="truncate text-xs text-slate-500 block">
            &amp; {{ winnerPartnerName }}
          </span>
        </div>
      </div>

      <!-- Score block -->
      <div class="flex flex-col items-center shrink-0 px-1">
        <span class="text-sm font-mono font-semibold text-white">{{ score }}</span>
        <SurfaceBadge :surface="surface" class="mt-0.5" />
        <span v-if="isDoubles" class="text-xs text-slate-600 mt-0.5">2v2</span>
      </div>

      <!-- Loser side -->
      <div class="flex items-center gap-2 flex-1 min-w-0 flex-row-reverse">
        <PlayerAvatar :name="loserName" :avatar-url="loserAvatar" :size="32" class="shrink-0" />
        <div class="min-w-0 text-right">
          <span class="truncate text-sm font-medium block" :class="isLoser ? 'text-red-400' : 'text-slate-400'">
            {{ loserName }}
          </span>
          <span v-if="isDoubles && loserPartnerName" class="truncate text-xs text-slate-500 block">
            &amp; {{ loserPartnerName }}
          </span>
        </div>
      </div>

      <!-- Meta — non-compact only, right column -->
      <div v-if="!compact" class="hidden sm:flex flex-col items-end shrink-0 text-xs text-slate-500 w-28">
        <template v-if="isLive">
          <span class="inline-flex items-center gap-1 text-red-400 font-semibold uppercase tracking-widest">
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span class="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            Live
          </span>
        </template>
        <template v-else>
          <span v-if="ranked === true" class="text-brand-400 font-semibold mb-0.5">Ranked</span>
          <span v-if="isFriendly" class="text-slate-500 mb-0.5">Friendly</span>
          <span>{{ formattedDate }}</span>
          <span v-if="tournament" class="truncate max-w-full">{{ tournament }}</span>
        </template>
      </div>
    </div>

    <!-- Row 2: meta — compact mode only -->
    <div v-if="compact" class="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-slate-700/40 text-xs text-slate-500">
      <template v-if="isLive">
        <span class="inline-flex items-center gap-1 text-red-400 font-semibold uppercase tracking-widest">
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span class="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          Live
        </span>
      </template>
      <template v-else>
        <span v-if="ranked === true" class="text-brand-400 font-semibold">Ranked</span>
        <span v-if="isFriendly">Friendly</span>
        <span>{{ formattedDate }}</span>
        <span v-if="tournament" class="truncate">· {{ tournament }}</span>
      </template>
    </div>
  </NuxtLink>
</template>
