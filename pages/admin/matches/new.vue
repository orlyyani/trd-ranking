<script setup lang="ts">
definePageMeta({ middleware: 'admin', layout: 'default' })

const supabase = useSupabaseClient()

const { data: players } = await useAsyncData('admin-players-list', async () => {
  const { data } = await supabase.from('players').select('id, name, mmr').order('mmr', { ascending: false })
  return data ?? []
})

const SURFACES = ['clay', 'hard', 'grass', 'indoor'] as const

const form = reactive({
  player1_id: '',
  player2_id: '',
  date: new Date().toISOString().split('T')[0],
  surface: 'hard' as typeof SURFACES[number],
  tournament: '',
  stream_url: '',
  challonge_match_id: '',
  challonge_tournament: '',
  // Result (filled only for immediate completion)
  status: 'scheduled' as 'scheduled' | 'live' | 'completed',
  winner_id: '',
  score: '',
})

const loading = ref(false)
const error   = ref('')
const success = ref<{ matchId: string; status: string } | null>(null)

async function submit() {
  error.value   = ''
  success.value = null

  if (!form.player1_id || !form.player2_id) { error.value = 'Select both players.'; return }
  if (form.player1_id === form.player2_id)   { error.value = 'Players must differ.'; return }
  if (form.status === 'completed' && !form.winner_id) { error.value = 'Select a winner.'; return }
  if (form.status === 'completed' && !form.score.trim()) { error.value = 'Enter the final score.'; return }

  loading.value = true

  try {
    const body: Record<string, unknown> = {
      player1_id: form.player1_id,
      player2_id: form.player2_id,
      date:       form.date,
      surface:    form.surface,
      status:     form.status,
      tournament: form.tournament.trim() || undefined,
      stream_url: form.stream_url.trim() || undefined,
      challonge_match_id:   form.challonge_match_id.trim()   || undefined,
      challonge_tournament: form.challonge_tournament.trim() || undefined,
    }
    if (form.status === 'completed') {
      body.winner_id = form.winner_id
      body.score     = form.score.trim()
    }

    const res = await $fetch('/api/matches', { method: 'POST', body }) as { matchId: string; status: string }
    success.value = res

    form.player1_id = ''
    form.player2_id = ''
    form.winner_id  = ''
    form.score      = ''
    form.tournament = ''
    form.stream_url = ''
    form.challonge_match_id   = ''
    form.challonge_tournament = ''
    form.status = 'scheduled'
  } catch (err: unknown) {
    error.value = (err as { data?: { statusMessage?: string }; message?: string })
      ?.data?.statusMessage ?? (err as { message?: string })?.message ?? 'Unknown error'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="space-y-6 max-w-2xl">
    <NuxtLink to="/admin" class="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Admin
    </NuxtLink>

    <h1 class="text-2xl font-semibold text-white">Add match</h1>

    <div v-if="success" class="rounded-lg bg-green-900/30 border border-green-700 px-4 py-3 space-y-1">
      <p class="text-sm font-medium text-green-400">
        Match {{ success.status === 'completed' ? 'recorded' : 'scheduled' }}!
      </p>
      <NuxtLink :to="`/matches/${success.matchId}`" class="text-xs text-brand-400 hover:text-brand-300 underline-offset-2 hover:underline">
        View match →
      </NuxtLink>
    </div>

    <form class="space-y-6" @submit.prevent="submit">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <!-- Left: Match info -->
        <div class="card space-y-4">
          <h2 class="text-sm font-semibold text-slate-300">Match info</h2>

          <!-- Player 1 -->
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1">Player 1</label>
            <select v-model="form.player1_id" required class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="" disabled>Select player…</option>
              <option v-for="p in players" :key="p.id" :value="p.id" :disabled="p.id === form.player2_id">
                {{ p.name }} ({{ p.mmr }})
              </option>
            </select>
          </div>

          <!-- Player 2 -->
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1">Player 2</label>
            <select v-model="form.player2_id" required class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="" disabled>Select player…</option>
              <option v-for="p in players" :key="p.id" :value="p.id" :disabled="p.id === form.player1_id">
                {{ p.name }} ({{ p.mmr }})
              </option>
            </select>
          </div>

          <!-- Date -->
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1">Date</label>
            <input v-model="form.date" type="date" required class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>

          <!-- Surface -->
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1">Surface</label>
            <div class="flex gap-2 flex-wrap">
              <button
                v-for="s in SURFACES" :key="s" type="button"
                :class="['rounded-full px-3 py-1 text-sm font-medium capitalize transition-colors border', form.surface === s ? 'bg-brand-600 border-brand-500 text-white' : 'bg-surface border-surface-border text-slate-400 hover:text-white']"
                @click="form.surface = s"
              >{{ s }}</button>
            </div>
          </div>

          <!-- Tournament -->
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1">Tournament <span class="text-slate-500 font-normal">(optional)</span></label>
            <input v-model="form.tournament" type="text" placeholder="e.g. Club Championships" class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>

          <!-- Stream URL -->
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1">Stream URL <span class="text-slate-500 font-normal">(optional)</span></label>
            <input v-model="form.stream_url" type="url" placeholder="https://youtube.com/watch?v=…" class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>

          <!-- Challonge -->
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1">Challonge tournament <span class="text-slate-500 font-normal">(optional)</span></label>
            <input v-model="form.challonge_tournament" type="text" placeholder="your-tournament-url-slug" class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
        </div>

        <!-- Right: Status & result -->
        <div class="card space-y-4">
          <h2 class="text-sm font-semibold text-slate-300">Status & result</h2>

          <!-- Status tabs -->
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-2">Match status</label>
            <div class="flex rounded-lg overflow-hidden border border-surface-border">
              <button
                v-for="s in (['scheduled', 'live', 'completed'] as const)"
                :key="s" type="button"
                :class="['flex-1 py-2 text-sm font-medium capitalize transition-colors', form.status === s ? 'bg-brand-600 text-white' : 'bg-surface text-slate-400 hover:text-white']"
                @click="form.status = s"
              >{{ s }}</button>
            </div>
            <p class="mt-1.5 text-xs text-slate-500">
              <template v-if="form.status === 'scheduled'">Match hasn't started yet — no MMR changes.</template>
              <template v-else-if="form.status === 'live'">Match is in progress — set the score later.</template>
              <template v-else>Match is done — set winner and score below.</template>
            </p>
          </div>

          <!-- Result fields (only when completing) -->
          <template v-if="form.status === 'completed'">
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-1">Winner</label>
              <select v-model="form.winner_id" class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="" disabled>Select winner…</option>
                <option v-if="form.player1_id" :value="form.player1_id">
                  {{ players?.find(p => p.id === form.player1_id)?.name ?? 'Player 1' }}
                </option>
                <option v-if="form.player2_id" :value="form.player2_id">
                  {{ players?.find(p => p.id === form.player2_id)?.name ?? 'Player 2' }}
                </option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-300 mb-1">Final score</label>
              <input v-model="form.score" type="text" placeholder="e.g. 6-3 7-5" class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </template>

          <div v-else class="rounded-lg bg-surface px-4 py-6 text-center text-sm text-slate-500">
            {{ form.status === 'live' ? 'Set the score from the match edit page once the match starts.' : 'Result will be entered after the match.' }}
          </div>
        </div>
      </div>

      <p v-if="error" class="text-sm text-red-400">{{ error }}</p>

      <button type="submit" :disabled="loading" class="rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 px-6 py-2 text-sm font-medium text-white transition-colors">
        {{ loading ? 'Saving…' : form.status === 'scheduled' ? 'Schedule match' : form.status === 'live' ? 'Start match' : 'Record match' }}
      </button>
    </form>
  </div>
</template>
