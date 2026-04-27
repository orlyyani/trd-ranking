<script setup lang="ts">
const props = defineProps<{ elo: number }>()

/**
 * Color tier based on ELO:
 *   < 900   — slate  (below average)
 *   900–999 — blue
 *   1000–1099 — green (base)
 *   1100–1199 — yellow
 *   1200–1349 — orange
 *   1350+   — red (elite)
 */
const tierClass = computed(() => {
  if (props.elo >= 1350) return 'bg-red-900/60 text-red-300 ring-red-700'
  if (props.elo >= 1200) return 'bg-orange-900/60 text-orange-300 ring-orange-700'
  if (props.elo >= 1100) return 'bg-yellow-900/60 text-yellow-300 ring-yellow-700'
  if (props.elo >= 1000) return 'bg-brand-900/60 text-brand-300 ring-brand-700'
  if (props.elo >= 900)  return 'bg-blue-900/60 text-blue-300 ring-blue-700'
  return 'bg-slate-800 text-slate-400 ring-slate-600'
})
</script>

<template>
  <span
    class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-mono font-semibold ring-1 ring-inset"
    :class="tierClass"
  >
    {{ elo }}
  </span>
</template>