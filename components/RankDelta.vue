<script setup lang="ts">
const props = defineProps<{
  /** Positive = moved up, negative = moved down, null = no snapshot */
  delta: number | null
}>()

const label = computed(() => {
  if (props.delta === null) return '—'
  if (props.delta === 0)    return '—'
  return props.delta > 0 ? `↑${props.delta}` : `↓${Math.abs(props.delta)}`
})

const colorClass = computed(() => {
  if (props.delta === null || props.delta === 0) return 'text-slate-500'
  return props.delta > 0 ? 'text-brand-400' : 'text-red-400'
})

const tooltip = 'Rank change since yesterday'
</script>

<template>
  <span class="relative inline-flex group">
    <span
      class="inline-block w-8 text-center text-xs font-semibold tabular-nums cursor-default"
      :class="colorClass"
      :aria-label="delta === null ? 'No change data' : `Rank changed by ${delta}`"
    >
      {{ label }}
    </span>
    <span
      class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5
             whitespace-nowrap rounded-md bg-slate-800 border border-slate-700
             px-2 py-1 text-xs text-slate-200 shadow-lg
             opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50"
    >
      {{ tooltip }}
    </span>
  </span>
</template>
