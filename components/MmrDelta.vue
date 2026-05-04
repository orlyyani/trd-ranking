<script setup lang="ts">
const props = defineProps<{
  /** MMR points gained (positive) or lost (negative). null = no data. */
  delta: number | null
}>()

const label = computed(() => {
  if (props.delta === null) return null
  return props.delta >= 0 ? `+${props.delta}` : `${props.delta}`
})

const colorClass = computed(() => {
  if (props.delta === null) return ''
  return props.delta >= 0 ? 'text-brand-400' : 'text-red-400'
})
</script>

<template>
  <span
    v-if="label !== null"
    class="text-xs font-semibold tabular-nums"
    :class="colorClass"
  >
    {{ label }}
  </span>
</template>
