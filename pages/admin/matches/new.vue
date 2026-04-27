<script setup lang="ts">
definePageMeta({ middleware: 'admin', layout: 'default' })

const supabase = useSupabaseClient()

// ── Load players for the dropdowns ────────────────────────────────────────────
const { data: players } = await useAsyncData('admin-players-list', async () => {
  const { data } = await supabase
    .from('players')
    .select('id, name, elo')
    .order('elo', { ascending: false })
  return data ?? []
})

// ── Form state ─────────────────────────────────────────────────────────────────
const form = reactive({
  winner_id: '',
  loser_id: '',
  date: new Date().toISOString().split('T')[0],
  score: '',
  surface: 'hard' as 'clay' | 'hard' | 'grass' | 'indoor',
  tournament: '',
})

const loading = ref(false)
const error = ref('')
const success = ref<{ matchId: string; eloWinner: number; eloLoser: number } | null>(null)

const SURFACES = ['clay', 'hard', 'grass', 'indoor'] as const

// ── Submit ─────────────────────────────────────────────────────────────────────
async function submit() {
  error.value = ''
  success.value = null

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
    const res = await $fetch('/api/matches', {
      method: 'POST',
      body: {
        winner_id: form.winner_id,
        loser_id: form.loser_id,
        date: form.date,
        score: form.score.trim(),
        surface: form.surface,
        tournament: form.tournament.trim() || undefined,
      },
    }) as { matchId: string; elo: { winner: { after: number }; loser: { after: number } } }

    success.value = {
      matchId: res.matchId,
      eloWinner: res.elo.winner.after,
      eloLoser: res.elo.loser.after,
    }

    // Reset form (keep date/surface)
    form.winner_id = ''
    form.loser_id = ''
    form.score = ''
    form.tournament = ''
  } catch (err: unknown) {
    const msg = (err as { data?: { statusMessage?: string }; message?: string })
      ?.data?.statusMessage ?? (err as { message?: string })?.message ?? 'Unknown error'
    error.value = msg
  } finally {
    loading.value = false
  }
}

const winnerName = computed(() => players.value?.find(p => p.id === form.winner_id)?.name ?? '')
const loserName  = computed(() => players.value?.find(p => p.id === form.loser_id)?.name ?? '')
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

    <h1 class="text-2xl font-semibold text-white">Add match</h1>

    <!-- Success -->
    <div v-if="success" class="rounded-lg bg-green-900/30 border border-green-700 px-4 py-3 space-y-1">
      <p class="text-sm font-medium text-green-400">Match recorded!</p>
      <p class="text-xs text-slate-400">
        {{ winnerName || 'Winner' }} → {{ success.eloWinner }} ELO ·
        {{ loserName || 'Loser' }} → {{ success.eloLoser }} ELO
      </p>
      <NuxtLink :to="`/matches/${success.matchId}`" class="text-xs text-brand-400 hover:text-brand-300 underline-offset-2 hover:underline">
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
          <option
            v-for="p in players"
            :key="p.id"
            :value="p.id"
            :disabled="p.id === form.loser_id"
          >
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
          <option
            v-for="p in players"
            :key="p.id"
            :value="p.id"
            :disabled="p.id === form.winner_id"
          >
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

      <!-- Tournament (optional) -->
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
        {{ loading ? 'Saving…' : 'Save match' }}
      </button>
    </form>
  </div>
</template>