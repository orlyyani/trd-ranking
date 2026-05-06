<script setup lang="ts">
definePageMeta({ middleware: 'admin', layout: 'default' })

const supabase = useSupabaseClient()

const { data: players } = await useAsyncData('admin-players-list', async () => {
  const { data } = await supabase.from('players').select('id, name, mmr').order('mmr', { ascending: false })
  return data ?? []
})

const SURFACES = ['clay', 'hard', 'grass', 'indoor'] as const

const form = reactive({
  match_type:   'singles' as 'singles' | 'doubles',
  player1_id:   '',
  player2_id:   '',
  player3_id:   '', // doubles: Team A partner
  player4_id:   '', // doubles: Team B partner
  date:          new Date().toISOString().split('T')[0],
  surface:       'hard' as typeof SURFACES[number],
  tournament:    '',
  stream_url:    '',
  challonge_match_id:   '',
  challonge_tournament: '',
  status:        'scheduled' as 'scheduled' | 'live' | 'completed',
  winner_id:     '',        // singles
  winning_team:  '' as 'A' | 'B' | '', // doubles
  score:         '',
})

const loading = ref(false)
const error   = ref('')
const success = ref<{ matchId: string; status: string } | null>(null)

const isDoubles  = computed(() => form.match_type === 'doubles')
const completing = computed(() => form.status === 'completed')

const usedIds = computed(() =>
  new Set([form.player1_id, form.player2_id, form.player3_id, form.player4_id].filter(Boolean)),
)

function playerName(id: string) {
  return players.value?.find(p => p.id === id)?.name ?? ''
}

const teamALabel = computed(() =>
  [form.player1_id && playerName(form.player1_id), form.player3_id && playerName(form.player3_id)]
    .filter(Boolean).join(' & ') || 'Team A',
)
const teamBLabel = computed(() =>
  [form.player2_id && playerName(form.player2_id), form.player4_id && playerName(form.player4_id)]
    .filter(Boolean).join(' & ') || 'Team B',
)

function resetPlayerFields() {
  form.player1_id = ''; form.player2_id = ''
  form.player3_id = ''; form.player4_id = ''
  form.winner_id  = ''; form.winning_team = ''
}

async function submit() {
  error.value = ''; success.value = null

  if (!form.player1_id || !form.player2_id) { error.value = 'Select the main players for each team.'; return }

  if (isDoubles.value) {
    if (!form.player3_id || !form.player4_id) { error.value = 'Select all 4 players for doubles.'; return }
    if (new Set([form.player1_id, form.player2_id, form.player3_id, form.player4_id]).size !== 4) {
      error.value = 'All 4 players must be different.'; return
    }
    if (completing.value && !form.winning_team) { error.value = 'Select the winning team.'; return }
  } else {
    if (form.player1_id === form.player2_id) { error.value = 'Players must differ.'; return }
    if (completing.value && !form.winner_id)  { error.value = 'Select a winner.'; return }
  }

  if (completing.value && !form.score.trim()) { error.value = 'Enter the final score.'; return }

  loading.value = true
  try {
    const effectiveWinnerId = isDoubles.value
      ? (form.winning_team === 'A' ? form.player1_id : form.player2_id)
      : form.winner_id

    const body: Record<string, unknown> = {
      match_type:  form.match_type,
      player1_id:  form.player1_id,
      player2_id:  form.player2_id,
      date:         form.date,
      surface:      form.surface,
      status:       form.status,
      tournament:   form.tournament.trim() || undefined,
      stream_url:   form.stream_url.trim() || undefined,
      challonge_match_id:   form.challonge_match_id.trim()   || undefined,
      challonge_tournament: form.challonge_tournament.trim() || undefined,
    }
    if (isDoubles.value) { body.player3_id = form.player3_id; body.player4_id = form.player4_id }
    if (completing.value) { body.winner_id = effectiveWinnerId; body.score = form.score.trim() }

    const res = await $fetch('/api/matches', { method: 'POST', body }) as { matchId: string; status: string }
    success.value = res

    form.player1_id = ''; form.player2_id = ''; form.player3_id = ''; form.player4_id = ''
    form.winner_id = ''; form.winning_team = ''; form.score = ''
    form.tournament = ''; form.stream_url = ''
    form.challonge_match_id = ''; form.challonge_tournament = ''
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
      <p class="text-sm font-medium text-green-400">Match {{ success.status === 'completed' ? 'recorded' : 'scheduled' }}!</p>
      <NuxtLink :to="`/matches/${success.matchId}`" class="text-xs text-brand-400 hover:text-brand-300 underline-offset-2 hover:underline">View match →</NuxtLink>
    </div>

    <form class="space-y-6" @submit.prevent="submit">

      <!-- Match type -->
      <div>
        <label class="block text-sm font-medium text-slate-300 mb-2">Match type</label>
        <div class="flex rounded-lg overflow-hidden border border-surface-border w-fit">
          <button
            v-for="t in (['singles', 'doubles'] as const)" :key="t" type="button"
            :class="['px-6 py-2 text-sm font-medium capitalize transition-colors', form.match_type === t ? 'bg-brand-600 text-white' : 'bg-surface text-slate-400 hover:text-white']"
            @click="form.match_type = t; resetPlayerFields()"
          >{{ t }}</button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <!-- Left: Match info -->
        <div class="card space-y-4">
          <h2 class="text-sm font-semibold text-slate-300">{{ isDoubles ? 'Teams' : 'Players & details' }}</h2>

          <!-- Singles players -->
          <template v-if="!isDoubles">
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-1">Player 1</label>
              <select v-model="form.player1_id" required class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="" disabled>Select player…</option>
                <option v-for="p in players" :key="p.id" :value="p.id" :disabled="p.id === form.player2_id">{{ p.name }} ({{ p.mmr }})</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-1">Player 2</label>
              <select v-model="form.player2_id" required class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="" disabled>Select player…</option>
                <option v-for="p in players" :key="p.id" :value="p.id" :disabled="p.id === form.player1_id">{{ p.name }} ({{ p.mmr }})</option>
              </select>
            </div>
          </template>

          <!-- Doubles: Team A + Team B -->
          <template v-else>
            <div class="space-y-2">
              <p class="text-xs font-semibold uppercase tracking-wider text-brand-400">Team A</p>
              <div>
                <label class="block text-xs text-slate-400 mb-1">Player 1</label>
                <select v-model="form.player1_id" required class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="" disabled>Select player…</option>
                  <option v-for="p in players" :key="p.id" :value="p.id" :disabled="usedIds.has(p.id) && p.id !== form.player1_id">{{ p.name }} ({{ p.mmr }})</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-slate-400 mb-1">Partner</label>
                <select v-model="form.player3_id" required class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="" disabled>Select partner…</option>
                  <option v-for="p in players" :key="p.id" :value="p.id" :disabled="usedIds.has(p.id) && p.id !== form.player3_id">{{ p.name }} ({{ p.mmr }})</option>
                </select>
              </div>
            </div>

            <div class="border-t border-surface-border" />

            <div class="space-y-2">
              <p class="text-xs font-semibold uppercase tracking-wider text-red-400">Team B</p>
              <div>
                <label class="block text-xs text-slate-400 mb-1">Player 2</label>
                <select v-model="form.player2_id" required class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="" disabled>Select player…</option>
                  <option v-for="p in players" :key="p.id" :value="p.id" :disabled="usedIds.has(p.id) && p.id !== form.player2_id">{{ p.name }} ({{ p.mmr }})</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-slate-400 mb-1">Partner</label>
                <select v-model="form.player4_id" required class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="" disabled>Select partner…</option>
                  <option v-for="p in players" :key="p.id" :value="p.id" :disabled="usedIds.has(p.id) && p.id !== form.player4_id">{{ p.name }} ({{ p.mmr }})</option>
                </select>
              </div>
            </div>
          </template>

          <!-- Shared fields -->
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1">Date</label>
            <input v-model="form.date" type="date" required class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1">Surface</label>
            <div class="flex gap-2 flex-wrap">
              <button v-for="s in SURFACES" :key="s" type="button"
                :class="['rounded-full px-3 py-1 text-sm font-medium capitalize transition-colors border', form.surface === s ? 'bg-brand-600 border-brand-500 text-white' : 'bg-surface border-surface-border text-slate-400 hover:text-white']"
                @click="form.surface = s">{{ s }}</button>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1">Tournament <span class="text-slate-500 font-normal">(optional)</span></label>
            <input v-model="form.tournament" type="text" placeholder="e.g. Club Championships" class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1">Stream URL <span class="text-slate-500 font-normal">(optional)</span></label>
            <input v-model="form.stream_url" type="url" placeholder="https://youtube.com/watch?v=…" class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1">Challonge tournament <span class="text-slate-500 font-normal">(optional)</span></label>
            <input v-model="form.challonge_tournament" type="text" placeholder="your-tournament-url-slug" class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
        </div>

        <!-- Right: Status & result -->
        <div class="card space-y-4">
          <h2 class="text-sm font-semibold text-slate-300">Status & result</h2>

          <div>
            <label class="block text-sm font-medium text-slate-300 mb-2">Match status</label>
            <div class="flex rounded-lg overflow-hidden border border-surface-border">
              <button v-for="s in (['scheduled', 'live', 'completed'] as const)" :key="s" type="button"
                :class="['flex-1 py-2 text-sm font-medium capitalize transition-colors', form.status === s ? 'bg-brand-600 text-white' : 'bg-surface text-slate-400 hover:text-white']"
                @click="form.status = s">{{ s }}</button>
            </div>
            <p class="mt-1.5 text-xs text-slate-500">
              <template v-if="form.status === 'scheduled'">Match hasn't started yet — no MMR changes.</template>
              <template v-else-if="form.status === 'live'">Match is in progress — set the score later.</template>
              <template v-else>Match is done — set the {{ isDoubles ? 'winning team' : 'winner' }} and score below.</template>
            </p>
          </div>

          <template v-if="completing">
            <!-- Singles winner -->
            <div v-if="!isDoubles">
              <label class="block text-sm font-medium text-slate-300 mb-1">Winner</label>
              <select v-model="form.winner_id" class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="" disabled>Select winner…</option>
                <option v-if="form.player1_id" :value="form.player1_id">{{ playerName(form.player1_id) || 'Player 1' }}</option>
                <option v-if="form.player2_id" :value="form.player2_id">{{ playerName(form.player2_id) || 'Player 2' }}</option>
              </select>
            </div>

            <!-- Doubles winning team -->
            <div v-else>
              <label class="block text-sm font-medium text-slate-300 mb-2">Winning team</label>
              <div class="space-y-2">
                <label v-for="team in (['A', 'B'] as const)" :key="team"
                  class="flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors"
                  :class="form.winning_team === team ? 'border-brand-500 bg-brand-600/10' : 'border-surface-border hover:border-slate-500'">
                  <input v-model="form.winning_team" type="radio" :value="team" class="accent-brand-500" />
                  <span class="text-sm font-medium text-slate-200">
                    Team {{ team }}
                    <span class="text-slate-400 font-normal ml-1 text-xs">{{ team === 'A' ? teamALabel : teamBLabel }}</span>
                  </span>
                </label>
              </div>
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
