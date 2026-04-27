<script setup lang="ts">
const props = defineProps<{
  name: string
  avatarUrl?: string | null
  /** Rendered size in pixels — drives both NuxtImg and the fallback circle. Default 40 */
  size?: number
}>()

const px = computed(() => props.size ?? 40)

/** Two-character initials: first letter of each word, up to two words. */
const initials = computed(() => {
  const parts = props.name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
})

/** Deterministic background hue from the player's name. */
const hue = computed(() => {
  let hash = 0
  for (const ch of props.name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff
  return Math.abs(hash) % 360
})

const bgStyle = computed(() => ({
  backgroundColor: `hsl(${hue.value} 45% 30%)`,
  width: `${px.value}px`,
  height: `${px.value}px`,
  fontSize: `${Math.round(px.value * 0.38)}px`,
}))

/**
 * Route Cloudinary URLs through the Cloudinary provider so @nuxt/image
 * can apply on-the-fly resizing and format optimisation. All other URLs
 * fall back to the local IPX proxy.
 */
const imgProvider = computed(() =>
  props.avatarUrl?.includes('res.cloudinary.com') ? 'cloudinary' : undefined,
)
</script>

<template>
  <!-- Prefer photo when available -->
  <NuxtImg
    v-if="avatarUrl"
    :src="avatarUrl"
    :alt="name"
    :width="px"
    :height="px"
    :provider="imgProvider"
    class="rounded-full object-cover shrink-0"
    :style="`width:${px}px; height:${px}px;`"
    loading="lazy"
  />

  <!-- Initials fallback -->
  <span
    v-else
    class="inline-flex items-center justify-center rounded-full shrink-0 font-semibold text-white select-none"
    :style="bgStyle"
    :aria-label="name"
  >
    {{ initials }}
  </span>
</template>