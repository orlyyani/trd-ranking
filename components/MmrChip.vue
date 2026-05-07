<script setup lang="ts">
const props = defineProps<{ mmr: number }>()

// Thresholds from TENNIS_ELO_SYSTEM.md:
//   2200+      — amber  (Class A / Open)
//   1900–2199  — red    (Class B)
//   1500–1899  — orange (Class C)
//   1000–1499  — green  (Beginner)
//   < 1000     — slate  (Placement / Unranked)
const tierClass = computed(() => {
  if (props.mmr >= 2200) return 'bg-amber-900/60 text-amber-300 ring-amber-600'
  if (props.mmr >= 1900) return 'bg-red-900/60 text-red-300 ring-red-700'
  if (props.mmr >= 1500) return 'bg-orange-900/60 text-orange-300 ring-orange-700'
  if (props.mmr >= 1000) return 'bg-brand-900/60 text-brand-300 ring-brand-700'
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
