<script setup lang="ts">
definePageMeta({ middleware: 'admin', layout: 'default' })

const route = useRoute()
const id = route.params.id as string
const supabase = useSupabaseClient()

// ── Load players + existing match ──────────────────────────────────────────────
const [{ data: players }, { data: match }] = await Promise.all([
  useAsyncData('admin-players-list', async () => {
    const { data } = await supabase.from('players').select('id, name, elo').order('elo', { ascending: false })
    return data ?? []
  }),
  useAsyncData(`admin-edit-match-${id}`, async () => {
    const { data } = await supabase
      .from('matches')
      .select('id, winner_id, loser_id, date, score, surface, tournament')
      .eq('id', id)
      .single()
    return data
  }),
])

if (!match.value) {
  throw createError({ statusCode: 404, statusMessage: 'Match not found' })
}

// ── Form state (pre-filled from existing match) ────────────────────────────────
const SURFACES = ['clay', 'hard', 'grass', 'indoor'] as const

const form = reactive({
  winner_id: match.value.winner_id,
  loser_id: match.value.loser_id,
  date: match.value.date,
  score: match.value.score,
  surface: match.value.surface as typeof SURFACES[number],
  tournament: match.value.tournament ?? '',
})

const loading = ref(false)
const error = ref('')
const success = ref(false)

// ── Submit ─────────────────────────────────────────────────────────────────────
async function submit() {
  error.value = ''
  success.value = false

  if (!form.winner_id || !form.loser_id) {
    error.value = 'Select both players.'
    return
  }
  if (form.winner_id === form.loser_id) {
    error.value = 'Winner and loser must be different players.'
    return
  }
  if (!form.score.trim()) {
    error.value = 'Score is required.'
    return
  }

  loading.value = true

  try {
    await $fetch(`/api/matches/${id}`, {
      method: 'PATCH',
      body: {
        winner_id: form.winner_id,
        loser_id: form.loser_id,
        date: form.date,
        score: form.score.trim(),
        surface: form.surface,
        tournament: form.tournament.trim() || undefined,
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

    <h1 class="text-2xl font-semibold text-white">Edit match</h1>

    <!-- Success -->
    <div v-if="success" class="rounded-lg bg-green-900/30 border border-green-700 px-4 py-3 space-y-1">
      <p class="text-sm font-medium text-green-400">Match updated! ELO recalculated.</p>
      <NuxtLink :to="`/matches/${id}`" class="text-xs text-brand-400 hover:text-brand-300 underline-offset-2 hover:underline">
        View match →
      </NuxtLink>
    </div>

    <form class="card space-y-5" @submit.prevent="submit">
      <!-- Winner -->
      <div>
        <label class="block text-sm font-medium text-slate-300 mb-1">Winner</label>
        <select
          v-model="form.winner_id"
          required
          class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="" disabled>Select player…</option>
          <option v-for="p in players" :key="p.id" :value="p.id" :disabled="p.id === form.loser_id">
            {{ p.name }} ({{ p.elo }})
          </option>
        </select>
      </div>

      <!-- Loser -->
      <div>
        <label class="block text-sm font-medium text-slate-300 mb-1">Loser</label>
        <select
          v-model="form.loser_id"
          required
          class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="" disabled>Select player…</option>
          <option v-for="p in players" :key="p.id" :value="p.id" :disabled="p.id === form.winner_id">
            {{ p.name }} ({{ p.elo }})
          </option>
        </select>
      </div>

      <!-- Date -->
      <div>
        <label class="block text-sm font-medium text-slate-300 mb-1">Date</label>
        <input
          v-model="form.date"
          type="date"
          required
          class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <!-- Score -->
      <div>
        <label class="block text-sm font-medium text-slate-300 mb-1">Score</label>
        <input
          v-model="form.score"
          type="text"
          required
          placeholder="e.g. 6-3 7-5"
          class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <!-- Surface -->
      <div>
        <label class="block text-sm font-medium text-slate-300 mb-1">Surface</label>
        <div class="flex gap-2 flex-wrap">
          <button
            v-for="s in SURFACES"
            :key="s"
            type="button"
            :class="[
              'rounded-full px-3 py-1 text-sm font-medium capitalize transition-colors border',
              form.surface === s
                ? 'bg-brand-600 border-brand-500 text-white'
                : 'bg-surface border-surface-border text-slate-400 hover:text-white',
            ]"
            @click="form.surface = s"
          >
            {{ s }}
          </button>
        </div>
      </div>

      <!-- Tournament -->
      <div>
        <label class="block text-sm font-medium text-slate-300 mb-1">
          Tournament <span class="text-slate-500 font-normal">(optional)</span>
        </label>
        <input
          v-model="form.tournament"
          type="text"
          placeholder="e.g. Club Championships 2026"
          class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <!-- Error -->
      <p v-if="error" class="text-sm text-red-400">{{ error }}</p>

      <button
        type="submit"
        :disabled="loading"
        class="w-full rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors"
      >
        {{ loading ? 'Saving…' : 'Save changes' }}
      </button>
    </form>
  </div>
</template>
