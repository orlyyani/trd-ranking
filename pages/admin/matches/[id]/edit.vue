<script setup lang="ts">
definePageMeta({ middleware: 'admin', layout: 'default' })

const route = useRoute()
const id = route.params.id as string
const supabase = useSupabaseClient()

const [{ data: players }, { data: match }] = await Promise.all([
  useAsyncData('admin-players-list', async () => {
    const { data } = await supabase.from('players').select('id, name, mmr').order('mmr', { ascending: false })
    return data ?? []
  }),
  useAsyncData(`admin-edit-match-${id}`, async () => {
    const { data } = await supabase
      .from('matches')
      .select('id, player1_id, player2_id, winner_id, loser_id, date, score, surface, tournament, stream_url, is_live, live_score, status, challonge_match_id, challonge_tournament')
      .eq('id', id)
      .single()
    return data
  }),
])

if (!match.value) throw createError({ statusCode: 404, statusMessage: 'Match not found' })

const SURFACES = ['clay', 'hard', 'grass', 'indoor'] as const

// ── Match info form ────────────────────────────────────────────────────────────
const info = reactive({
  player1_id:           match.value.player1_id ?? '',
  player2_id:           match.value.player2_id ?? '',
  date:                 match.value.date,
  surface:              match.value.surface as typeof SURFACES[number],
  tournament:           match.value.tournament ?? '',
  stream_url:           match.value.stream_url ?? '',
  challonge_match_id:   match.value.challonge_match_id ?? '',
  challonge_tournament: match.value.challonge_tournament ?? '',
})

const infoLoading = ref(false)
const infoError   = ref('')
const infoSuccess = ref(false)

async function saveInfo() {
  infoError.value   = ''
  infoSuccess.value = false
  infoLoading.value = true
  try {
    await $fetch(`/api/matches/${id}`, {
      method: 'PATCH',
      body: {
        player1_id:           info.player1_id  || undefined,
        player2_id:           info.player2_id  || undefined,
        date:                 info.date,
        surface:              info.surface,
        tournament:           info.tournament.trim()           || undefined,
        challonge_match_id:   info.challonge_match_id.trim()  || undefined,
        challonge_tournament: info.challonge_tournament.trim() || undefined,
      },
    })
    infoSuccess.value = true
  } catch (err: unknown) {
    infoError.value = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Error'
  } finally {
    infoLoading.value = false
  }
}

// ── Scoring / result form ──────────────────────────────────────────────────────
const currentStatus = ref(match.value.status ?? 'scheduled')
const liveScore    = ref(match.value.live_score ?? '')
const winner_id    = ref(match.value.winner_id ?? '')
const finalScore   = ref(match.value.score ?? '')
const isLive       = ref(match.value.is_live ?? false)

const scoreLoading = ref(false)
const scoreError   = ref('')
const scoreSuccess = ref('')

async function saveLiveScore() {
  scoreError.value   = ''
  scoreSuccess.value = ''
  scoreLoading.value = true
  try {
    await $fetch(`/api/matches/${id}/live`, {
      method: 'PATCH',
      body: { live_score: liveScore.value || null, is_live: isLive.value },
    })
    scoreSuccess.value = 'Live score updated.'
  } catch (err: unknown) {
    scoreError.value = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Error'
  } finally {
    scoreLoading.value = false
  }
}

async function completeMatch() {
  if (!winner_id.value) { scoreError.value = 'Select a winner.'; return }
  if (!finalScore.value.trim()) { scoreError.value = 'Enter the final score.'; return }
  scoreError.value   = ''
  scoreSuccess.value = ''
  scoreLoading.value = true
  try {
    await $fetch(`/api/matches/${id}`, {
      method: 'PATCH',
      body: {
        winner_id: winner_id.value,
        score:     finalScore.value.trim(),
        status:    'completed',
      },
    })
    currentStatus.value = 'completed'
    isLive.value = false
    scoreSuccess.value = 'Match completed! MMR recalculated.'
  } catch (err: unknown) {
    scoreError.value = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Error'
  } finally {
    scoreLoading.value = false
  }
}

async function setStatus(s: 'scheduled' | 'live' | 'completed') {
  scoreError.value = ''
  await $fetch(`/api/matches/${id}/live`, { method: 'PATCH', body: { status: s } })
  currentStatus.value = s
  isLive.value = s === 'live'
}

const player1Name = computed(() => players.value?.find(p => p.id === info.player1_id)?.name ?? 'Player 1')
const player2Name = computed(() => players.value?.find(p => p.id === info.player2_id)?.name ?? 'Player 2')
</script>

<template>
  <div class="space-y-6">
    <NuxtLink to="/admin" class="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Admin
    </NuxtLink>

    <div class="flex items-center gap-3">
      <h1 class="text-2xl font-semibold text-white">Edit match</h1>
      <span :class="['rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize', currentStatus === 'live' ? 'bg-red-900/50 text-red-400' : currentStatus === 'completed' ? 'bg-brand-900/50 text-brand-400' : 'bg-slate-800 text-slate-400']">
        {{ currentStatus }}
      </span>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">

      <!-- Left: Match details -->
      <div class="card space-y-4">
        <h2 class="text-sm font-semibold text-slate-300">Match details</h2>

        <div v-if="infoSuccess" class="rounded-lg bg-green-900/30 border border-green-700 px-3 py-2 text-xs text-green-400">Saved.</div>

        <div>
          <label class="block text-sm font-medium text-slate-300 mb-1">Player 1</label>
          <select v-model="info.player1_id" class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="" disabled>Select player…</option>
            <option v-for="p in players" :key="p.id" :value="p.id" :disabled="p.id === info.player2_id">{{ p.name }} ({{ p.mmr }})</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-300 mb-1">Player 2</label>
          <select v-model="info.player2_id" class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="" disabled>Select player…</option>
            <option v-for="p in players" :key="p.id" :value="p.id" :disabled="p.id === info.player1_id">{{ p.name }} ({{ p.mmr }})</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-300 mb-1">Date</label>
          <input v-model="info.date" type="date" class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-300 mb-1">Surface</label>
          <div class="flex gap-2 flex-wrap">
            <button v-for="s in SURFACES" :key="s" type="button" :class="['rounded-full px-3 py-1 text-sm font-medium capitalize transition-colors border', info.surface === s ? 'bg-brand-600 border-brand-500 text-white' : 'bg-surface border-surface-border text-slate-400 hover:text-white']" @click="info.surface = s">{{ s }}</button>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-300 mb-1">Tournament <span class="text-slate-500 font-normal">(optional)</span></label>
          <input v-model="info.tournament" type="text" class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-300 mb-1">Stream URL <span class="text-slate-500 font-normal">(optional)</span></label>
          <input v-model="info.stream_url" type="url" placeholder="https://youtube.com/watch?v=…" class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-300 mb-1">Challonge tournament <span class="text-slate-500 font-normal">(optional)</span></label>
          <input v-model="info.challonge_tournament" type="text" placeholder="your-tournament-slug" class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>

        <p v-if="infoError" class="text-sm text-red-400">{{ infoError }}</p>

        <button type="button" :disabled="infoLoading" class="w-full rounded-lg bg-surface-elevated hover:bg-surface-border border border-surface-border disabled:opacity-50 px-4 py-2 text-sm font-medium text-slate-200 transition-colors" @click="saveInfo">
          {{ infoLoading ? 'Saving…' : 'Save match details' }}
        </button>
      </div>

      <!-- Right: Scores / Status -->
      <div class="space-y-4">

        <!-- Status toggle -->
        <div class="card space-y-3">
          <h2 class="text-sm font-semibold text-slate-300">Match status</h2>
          <div class="flex rounded-lg overflow-hidden border border-surface-border">
            <button v-for="s in (['scheduled', 'live', 'completed'] as const)" :key="s" type="button"
              :class="['flex-1 py-2 text-xs font-semibold capitalize transition-colors', currentStatus === s ? (s === 'live' ? 'bg-red-600 text-white' : 'bg-brand-600 text-white') : 'bg-surface text-slate-400 hover:text-white']"
              :disabled="s === 'completed' && currentStatus !== 'completed'"
              @click="setStatus(s)"
            >{{ s }}</button>
          </div>
        </div>

        <!-- Live score (when status = live) -->
        <div v-if="currentStatus === 'live'" class="card space-y-3">
          <h2 class="text-sm font-semibold text-slate-300">Live score</h2>
          <div class="flex items-center gap-2 text-xs text-slate-500">
            <span class="truncate">{{ player1Name }}</span>
            <span class="shrink-0">vs</span>
            <span class="truncate text-right">{{ player2Name }}</span>
          </div>
          <input
            v-model="liveScore"
            type="text"
            placeholder="e.g. 4-3 (set 1)"
            class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <div class="flex items-center gap-3">
            <button type="button" :class="['relative inline-flex h-6 w-11 items-center rounded-full transition-colors', isLive ? 'bg-red-600' : 'bg-surface-border']" @click="isLive = !isLive">
              <span :class="['inline-block h-4 w-4 transform rounded-full bg-white transition-transform', isLive ? 'translate-x-6' : 'translate-x-1']" />
            </button>
            <span class="text-sm" :class="isLive ? 'text-red-400 font-semibold' : 'text-slate-400'">{{ isLive ? 'Streaming LIVE' : 'Not streaming' }}</span>
          </div>
          <button type="button" :disabled="scoreLoading" class="w-full rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white transition-colors" @click="saveLiveScore">
            {{ scoreLoading ? 'Saving…' : 'Update live score' }}
          </button>
        </div>

        <!-- Complete match (when scheduled or live) -->
        <div v-if="currentStatus !== 'completed'" class="card space-y-3">
          <h2 class="text-sm font-semibold text-slate-300">Complete match</h2>

          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1">Winner</label>
            <select v-model="winner_id" class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="" disabled>Select winner…</option>
              <option v-if="info.player1_id" :value="info.player1_id">{{ player1Name }}</option>
              <option v-if="info.player2_id" :value="info.player2_id">{{ player2Name }}</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1">Final score</label>
            <input v-model="finalScore" type="text" placeholder="e.g. 6-3 7-5" class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>

          <button type="button" :disabled="scoreLoading" class="w-full rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white transition-colors" @click="completeMatch">
            {{ scoreLoading ? 'Saving…' : 'Complete & update MMR' }}
          </button>
        </div>

        <!-- Completed summary -->
        <div v-else class="card space-y-2">
          <h2 class="text-sm font-semibold text-slate-300">Result</h2>
          <p class="text-sm text-slate-400">
            <span class="text-white font-medium">{{ players?.find(p => p.id === match?.winner_id)?.name ?? 'Winner' }}</span>
            won · <span class="font-mono">{{ match?.score }}</span>
          </p>
          <NuxtLink :to="`/matches/${id}`" class="text-xs text-brand-400 hover:text-brand-300">View match →</NuxtLink>
        </div>

        <div v-if="scoreError"   class="text-sm text-red-400 px-1">{{ scoreError }}</div>
        <div v-if="scoreSuccess" class="text-sm text-green-400 px-1">{{ scoreSuccess }}</div>
      </div>
    </div>
  </div>
</template>
