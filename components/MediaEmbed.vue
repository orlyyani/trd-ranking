<script setup lang="ts">
const props = defineProps<{ url: string }>()

const hostname = useRequestURL().hostname

interface EmbedInfo {
  type: 'youtube' | 'twitch-channel' | 'twitch-vod' | 'facebook' | 'kick' | 'unsupported'
  src: string
}

function parseEmbed(raw: string): EmbedInfo {
  try {
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    const u = new URL(normalized)
    const host = u.hostname.replace(/^www\./, '')

    if (host === 'youtube.com' || host === 'youtu.be') {
      let videoId: string | null = null
      if (host === 'youtu.be') {
        videoId = u.pathname.slice(1).split('?')[0]
      } else if (u.pathname.startsWith('/watch')) {
        videoId = u.searchParams.get('v')
      } else if (u.pathname.startsWith('/live/')) {
        videoId = u.pathname.split('/live/')[1]?.split('/')[0] ?? null
      } else if (u.pathname.startsWith('/embed/')) {
        videoId = u.pathname.split('/embed/')[1]?.split('/')[0] ?? null
      } else if (u.pathname.startsWith('/shorts/')) {
        videoId = u.pathname.split('/shorts/')[1]?.split('/')[0] ?? null
      }
      if (videoId) return { type: 'youtube', src: `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0` }
    }

    if (host === 'twitch.tv') {
      const parts = u.pathname.split('/').filter(Boolean)
      if (parts[0] === 'videos' && parts[1]) {
        return { type: 'twitch-vod', src: `https://player.twitch.tv/?video=${parts[1]}&parent=${hostname}&autoplay=true` }
      }
      if (parts[0] && parts[0] !== 'directory') {
        return { type: 'twitch-channel', src: `https://player.twitch.tv/?channel=${parts[0]}&parent=${hostname}&autoplay=true` }
      }
    }

    if (host === 'facebook.com' || host === 'fb.watch') {
      return {
        type: 'facebook',
        src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(raw)}&show_text=false&autoplay=true`,
      }
    }

    if (host === 'kick.com') {
      const channel = u.pathname.split('/').filter(Boolean)[0]
      if (channel) return { type: 'kick', src: `https://player.kick.com/${channel}?autoplay=true` }
    }
  } catch {
    // fall through
  }
  return { type: 'unsupported', src: '' }
}

const embed = computed(() => parseEmbed(props.url))
</script>

<template>
  <div v-if="embed.type !== 'unsupported'" class="relative w-full overflow-hidden rounded-lg bg-black" style="padding-top: 56.25%">
    <iframe
      :src="embed.src"
      class="absolute inset-0 h-full w-full border-0"
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowfullscreen
    />
  </div>
  <a
    v-else
    :href="url"
    target="_blank"
    rel="noopener noreferrer"
    class="inline-flex items-center gap-2 rounded-lg bg-red-600/20 border border-red-800/50 hover:bg-red-600/30 px-4 py-2 text-sm font-medium text-red-400 transition-colors"
  >
    <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
    Watch live ↗
  </a>
</template>
