<script setup lang="ts">
definePageMeta({ middleware: 'admin', layout: 'default' })

const route = useRoute()
const id = route.params.id as string
const supabase = useSupabaseClient()
const config = useRuntimeConfig()

// ── Load existing player ───────────────────────────────────────────────────────
const { data: player } = await useAsyncData(`admin-edit-player-${id}`, async () => {
  const { data } = await supabase.from('players').select('id, name, avatar_url').eq('id', id).single()
  return data
})

if (!player.value) {
  throw createError({ statusCode: 404, statusMessage: 'Player not found' })
}

// ── Form state ─────────────────────────────────────────────────────────────────
const name = ref(player.value.name)
const avatarUrl = ref(player.value.avatar_url ?? '')
const previewUrl = ref(player.value.avatar_url ?? '')
const fileInput = ref<HTMLInputElement | null>(null)

const loading = ref(false)
const uploading = ref(false)
const error = ref('')
const success = ref(false)

// ── Cloudinary upload ──────────────────────────────────────────────────────────
async function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  previewUrl.value = URL.createObjectURL(file)

  const cloudName = config.public.cloudinaryCloudName
  const preset = config.public.cloudinaryUploadPreset

  if (!cloudName || !preset) {
    error.value = 'Cloudinary is not configured — photo upload is unavailable.'
    return
  }

  uploading.value = true
  error.value = ''

  try {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('upload_preset', preset)

    const res = await $fetch<{ secure_url: string }>(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: 'POST', body: fd },
    )
    avatarUrl.value = res.secure_url
  } catch {
    error.value = 'Photo upload failed.'
    previewUrl.value = player.value?.avatar_url ?? ''
    avatarUrl.value = player.value?.avatar_url ?? ''
  } finally {
    uploading.value = false
  }
}

function clearPhoto() {
  previewUrl.value = ''
  avatarUrl.value = ''
  if (fileInput.value) fileInput.value.value = ''
}

// ── Submit ─────────────────────────────────────────────────────────────────────
async function submit() {
  error.value = ''
  success.value = false

  if (!name.value.trim()) {
    error.value = 'Player name is required.'
    return
  }

  loading.value = true

  try {
    await $fetch(`/api/players/${id}`, {
      method: 'PATCH',
      body: {
        name: name.value.trim(),
        avatar_url: avatarUrl.value || null,
      },
    })
    success.value = true
  } catch (err: unknown) {
    error.value = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Unknown error'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="space-y-6 max-w-lg">
    <!-- Back -->
    <NuxtLink to="/admin" class="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Admin
    </NuxtLink>

    <h1 class="text-2xl font-semibold text-white">Edit player</h1>

    <!-- Success -->
    <div v-if="success" class="rounded-lg bg-green-900/30 border border-green-700 px-4 py-3 space-y-1">
      <p class="text-sm font-medium text-green-400">Player updated!</p>
      <NuxtLink :to="`/players/${id}`" class="text-xs text-brand-400 hover:text-brand-300 underline-offset-2 hover:underline">
        View profile →
      </NuxtLink>
    </div>

    <form class="card space-y-5" @submit.prevent="submit">
      <!-- Name -->
      <div>
        <label class="block text-sm font-medium text-slate-300 mb-1">Name</label>
        <input
          v-model="name"
          type="text"
          required
          class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <!-- Photo -->
      <div>
        <label class="block text-sm font-medium text-slate-300 mb-2">
          Photo <span class="text-slate-500 font-normal">(optional)</span>
        </label>

        <div v-if="previewUrl" class="mb-3 flex items-center gap-3">
          <img :src="previewUrl" alt="Preview" class="h-14 w-14 rounded-full object-cover border border-surface-border" />
          <div class="space-y-1">
            <p v-if="uploading" class="text-xs text-slate-400">Uploading…</p>
            <p v-else-if="avatarUrl" class="text-xs text-green-400">Ready</p>
            <button type="button" class="text-xs text-red-400 hover:text-red-300 transition-colors" @click="clearPhoto">
              Remove photo
            </button>
          </div>
        </div>

        <label
          v-if="!previewUrl"
          class="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-surface-border px-4 py-6 text-sm text-slate-400 hover:border-slate-500 hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Click to upload a photo
          <input ref="fileInput" type="file" accept="image/*" class="sr-only" @change="onFileChange" />
        </label>
      </div>

      <!-- Error -->
      <p v-if="error" class="text-sm text-red-400">{{ error }}</p>

      <button
        type="submit"
        :disabled="loading || uploading"
        class="w-full rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors"
      >
        {{ loading ? 'Saving…' : uploading ? 'Waiting for upload…' : 'Save changes' }}
      </button>
    </form>
  </div>
</template>
