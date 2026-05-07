<script setup lang="ts">
import classAImg   from '~/assets/images/rank/class_a_open.svg'
import classBImg   from '~/assets/images/rank/class_b.svg'
import classCImg   from '~/assets/images/rank/class_c.svg'
import beginnerImg from '~/assets/images/rank/beginner.svg'
import unrankedImg from '~/assets/images/rank/unranked.svg'

const props = withDefaults(defineProps<{
  tier: string
  size?: number
}>(), { size: 40 })

const IMAGES: Record<string, string> = {
  class_a:  classAImg,
  class_b:  classBImg,
  class_c:  classCImg,
  beginner: beginnerImg,
  unranked: unrankedImg,
}

const LABELS: Record<string, string> = {
  class_a:  'Class A',
  class_b:  'Class B',
  class_c:  'Class C',
  beginner: 'Beginner',
  unranked: 'Unranked',
}

const src   = computed(() => IMAGES[props.tier] ?? unrankedImg)
const label = computed(() => LABELS[props.tier] ?? props.tier)
</script>

<template>
  <div class="relative group inline-flex shrink-0">
    <img
      :src="src"
      :alt="label"
      :width="size"
      :height="size"
      class="object-contain drop-shadow-sm select-none"
    />

    <!-- Tooltip: classification name only -->
    <div
      class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30
             opacity-0 group-hover:opacity-100 transition-opacity duration-150"
    >
      <div class="bg-surface-elevated border border-surface-border rounded-lg px-3 py-1.5 text-xs whitespace-nowrap shadow-lg text-center">
        <p class="text-slate-200 font-medium leading-tight">{{ label }}</p>
      </div>
      <!-- Caret -->
      <div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-surface-border" />
    </div>
  </div>
</template>
