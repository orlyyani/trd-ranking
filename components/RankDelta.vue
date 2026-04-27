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
</script>

<template>
  <span
    class="inline-block w-8 text-center text-xs font-semibold tabular-nums"
    :class="colorClass"
    :aria-label="delta === null ? 'No change data' : `Rank changed by ${delta}`"
  >
    {{ label }}
  </span>
</template>
