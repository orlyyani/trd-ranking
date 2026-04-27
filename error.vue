<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const is404 = computed(() => props.error.statusCode === 404)

useHead({ title: is404.value ? 'Not found — TRD Ranking' : 'Error — TRD Ranking' })

function goHome() {
  clearError({ redirect: '/' })
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4 bg-slate-950">
    <div class="text-center space-y-4 max-w-sm">
      <p class="text-5xl font-bold text-white tabular-nums">{{ error.statusCode }}</p>

      <p class="text-slate-400 text-sm">
        {{ is404 ? 'This page doesn\'t exist.' : (error.statusMessage || 'Something went wrong.') }}
      </p>

      <button
        class="mt-4 rounded-lg bg-brand-600 hover:bg-brand-500 px-5 py-2 text-sm font-medium text-white transition-colors"
        @click="goHome"
      >
        Go home
      </button>
    </div>
  </div>
</template>
