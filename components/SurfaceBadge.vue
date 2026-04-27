<script setup lang="ts">
import type { Surface } from '~/types/database.types'

defineProps<{ surface: Surface }>()

const config: Record<Surface, { label: string; classes: string }> = {
  clay:   { label: 'Clay',   classes: 'bg-orange-900/50 text-orange-300 ring-orange-700' },
  hard:   { label: 'Hard',   classes: 'bg-blue-900/50 text-blue-300 ring-blue-700' },
  grass:  { label: 'Grass',  classes: 'bg-brand-900/50 text-brand-300 ring-brand-700' },
  indoor: { label: 'Indoor', classes: 'bg-slate-700/60 text-slate-300 ring-slate-500' },
}
</script>

<template>
  <span
    class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
    :class="config[surface].classes"
  >
    {{ config[surface].label }}
  </span>
</template>