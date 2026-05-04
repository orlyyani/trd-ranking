<script setup lang="ts">
const props = defineProps<{ mmr: number }>()

/**
 * Color tiers aligned with TENNIS_ELO_SYSTEM.md:
 *   < 1000    — slate  (below unranked base)
 *   1000–1199 — blue   (Unranked)
 *   1200–1499 — green  (Beginner)
 *   1500–1699 — yellow
 *   1700–1899 — orange
 *   1900+     — red    (Class C)
 */
const tierClass = computed(() => {
  if (props.mmr >= 1900) return 'bg-red-900/60 text-red-300 ring-red-700'
  if (props.mmr >= 1700) return 'bg-orange-900/60 text-orange-300 ring-orange-700'
  if (props.mmr >= 1500) return 'bg-yellow-900/60 text-yellow-300 ring-yellow-700'
  if (props.mmr >= 1200) return 'bg-brand-900/60 text-brand-300 ring-brand-700'
  if (props.mmr >= 1000) return 'bg-blue-900/60 text-blue-300 ring-blue-700'
  return 'bg-slate-800 text-slate-400 ring-slate-600'
})
</script>

<template>
  <span
    class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-mono font-semibold ring-1 ring-inset"
    :class="tierClass"
  >
    {{ mmr }}
  </span>
</template>
