<script setup lang="ts">
definePageMeta({ middleware: 'admin', layout: 'default' })
useHead({ title: 'Edit Match' })

const route = useRoute()
const id    = route.params.id as string
const supabase = useSupabaseClient()

const [{ data: players }, { data: match }] = await Promise.all([
  useAsyncData('admin-players-list', async () => {
    const { data } = await supabase.from('players').select('id, name, mmr').order('mmr', { ascending: false })
    return data ?? []
  }),
  useAsyncData(`admin-edit-match-${id}`, async () => {
    const { data } = await supabase
      .from('matches')
      .select('id, match_type, player1_id, player2_id, player3_id, player4_id, winner_id, loser_id, date, score, surface, tournament, stream_url, is_live, live_score, status, challonge_match_id, challonge_tournament')
      .eq('id', id)
      .single()
    return data
  }),
])

if (!match.value) throw createError({ statusCode: 404, statusMessage: 'Match not found' })

const SURFACES = ['clay', 'hard', 'grass', 'indoor'] as const

const isDoubles = computed(() => match.value?.match_type === 'doubles')

// ── Match info form ────────────────────────────────────────────────────────────
const info = reactive({
  player1_id:           match.value.player1_id ?? '',
  player2_id:           match.value.player2_id ?? '',
  player3_id:           match.value.player3_id ?? '',
  player4_id:           match.value.player4_id ?? '',
  date:                 match.value.date,
  surface:              match.value.surface as typeof SURFACES[number],
  tournament:           match.value.tournament ?? '',
  stream_url:           match.value.stream_url ?? '',
  challonge_match_id:   match.value.challonge_match_id ?? '',
  challonge_tournament: match.value.challonge_tournament ?? '',
})

const usedIds = computed(() =>
  new Set([info.player1_id, info.player2_id, info.player3_id, info.player4_id].filter(Boolean)),
)

const infoLoading = ref(false)
const infoError   = ref('')
const infoSuccess = ref(false)

async function saveInfo() {
  infoError.value   = ''
  infoSuccess.value = false
  infoLoading.value = true
  try {
    const body: Record<string, unknown> = {
      player1_id:           info.player1_id  || undefined,
      player2_id:           info.player2_id  || undefined,
      date:                 info.date,
      surface:              info.surface,
      tournament:           info.tournament.trim()           || undefined,
      stream_url:           info.stream_url.trim()          || undefined,
      challonge_match_id:   info.challonge_match_id.trim()  || undefined,
      challonge_tournament: info.challonge_tournament.trim() || undefined,
    }
    if (isDoubles.value) {
      body.player3_id = info.player3_id || null
      body.player4_id = info.player4_id || null
    }
    await $fetch(`/api/matches/${id}`, { method: 'PATCH', body })
    infoSuccess.value = true
  } catch (err: unknown) {
    infoError.value = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Error'
  } finally {
    infoLoading.value = false
  }
}

// ── Scoring / result form ──────────────────────────────────────────────────────
const currentStatus = ref(match.value.status ?? 'scheduled')
const liveScore     = ref(match.value.live_score ?? '')
const winner_id     = ref(match.value.winner_id ?? '')
const winning_team  = ref<'A' | 'B' | ''>(
  match.value.winner_id === match.value.player1_id ? 'A'
  : match.value.winner_id === match.value.player2_id ? 'B'
  : '',
)
const finalScore  = ref(match.value.score ?? '')
const isLive      = ref(match.value.is_live ?? false)

const scoreLoading = ref(false)
const scoreError   = ref('')
const scoreSuccess = ref('')

function playerName(id: string) {
  return players.value?.find(p => p.id === id)?.name ?? ''
}

const teamALabel = computed(() =>
  [info.player1_id && playerName(info.player1_id), info.player3_id && playerName(info.player3_id)]
    .filter(Boolean).join(' & ') || 'Team A',
)
const teamBLabel = computed(() =>
  [info.player2_id && playerName(info.player2_id), info.player4_id && playerName(info.player4_id)]
    .filter(Boolean).join(' & ') || 'Team B',
)

const liveScoreLabel = computed(() =>
  isDoubles.value ? `${teamALabel.value} vs ${teamBLabel.value}` : `${playerName(info.player1_id) || 'Player 1'} vs ${playerName(info.player2_id) || 'Player 2'}`,
)

async function saveLiveScore() {
  scoreError.value = ''; scoreSuccess.value = ''; scoreLoading.value = true
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
  const effectiveWinnerId = isDoubles.value
    ? (winning_team.value === 'A' ? info.player1_id : winning_team.value === 'B' ? info.player2_id : '')
    : winner_id.value

  if (!effectiveWinnerId) { scoreError.value = isDoubles.value ? 'Select the winning team.' : 'Select a winner.'; return }
  if (!finalScore.value.trim()) { scoreError.value = 'Enter the final score.'; return }

  scoreError.value = ''; scoreSuccess.value = ''; scoreLoading.value = true
  try {
    await $fetch(`/api/matches/${id}`, {
      method: 'PATCH',
      body: { winner_id: effectiveWinnerId, score: finalScore.value.trim(), status: 'completed' },
    })
    currentStatus.value = 'completed'
    isLive.value = false
    if (match.value) {
      match.value.winner_id = effectiveWinnerId
      match.value.score = finalScore.value.trim()
    }
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

const showDetails = ref(true)
const gridCols = computed(() => {
  const hasEmbed = !!info.stream_url
  if (showDetails.value && hasEmbed) return 'lg:grid-cols-[1fr_340px_minmax(0,1fr)]'
  if (showDetails.value)             return 'lg:grid-cols-[1fr_340px]'
  if (hasEmbed)                      return 'lg:grid-cols-[340px_minmax(0,1fr)]'
  return 'lg:grid-cols-[340px]'
})

const completedWinnerName = computed(() => {
  if (!match.value?.winner_id) return 'Winner'
  if (isDoubles.value) {
    const cap = playerName(match.value.winner_id)
    const partner = match.value.winner_id === match.value.player1_id
      ? (match.value.player3_id ? playerName(match.value.player3_id) : '')
      : (match.value.player4_id ? playerName(match.value.player4_id) : '')
    return partner ? `${cap} & ${partner}` : cap
  }
  return playerName(match.value.winner_id)
})
</script>

<template>
  <div class="space-y-6">
    <NuxtLink to="/admin" class="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Admin
    </NuxtLink>

    <div class="flex items-center gap-3 flex-wrap">
      <h1 class="text-2xl font-semibold text-white">Edit match</h1>
      <span :class="['rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize', currentStatus === 'live' ? 'bg-red-900/50 text-red-400' : currentStatus === 'completed' ? 'bg-brand-900/50 text-brand-400' : 'bg-slate-800 text-slate-400']">
        {{ currentStatus }}
      </span>
      <span v-if="isDoubles" class="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-slate-800 text-slate-400">
        Doubles
      </span>
      <button
        type="button"
        class="ml-auto rounded-lg border border-surface-border px-3 py-1 text-xs text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
        @click="showDetails = !showDetails"
      >
        {{ showDetails ? 'Hide details' : 'Show details' }}
      </button>
    </div>

    <div :class="['grid grid-cols-1 gap-6 items-start', gridCols]">

      <!-- Col 1: Match details (toggleable) -->
      <div v-if="showDetails" class="card space-y-4">
        <h2 class="text-sm font-semibold text-slate-300">Match details</h2>
        <div v-if="infoSuccess" class="rounded-lg bg-green-900/30 border border-green-700 px-3 py-2 text-xs text-green-400">Saved.</div>

        <!-- Singles players -->
        <template v-if="!isDoubles">
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
        </template>

        <!-- Doubles players (Team A + Team B) -->
        <template v-else>
          <div class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-wider text-brand-400">Team A</p>
            <div>
              <label class="block text-xs text-slate-400 mb-1">Player 1</label>
              <select v-model="info.player1_id" class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="" disabled>Select player…</option>
                <option v-for="p in players" :key="p.id" :value="p.id" :disabled="usedIds.has(p.id) && p.id !== info.player1_id">{{ p.name }} ({{ p.mmr }})</option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">Partner</label>
              <select v-model="info.player3_id" class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="" disabled>Select partner…</option>
                <option v-for="p in players" :key="p.id" :value="p.id" :disabled="usedIds.has(p.id) && p.id !== info.player3_id">{{ p.name }} ({{ p.mmr }})</option>
              </select>
            </div>
          </div>
          <div class="border-t border-surface-border" />
          <div class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-wider text-red-400">Team B</p>
            <div>
              <label class="block text-xs text-slate-400 mb-1">Player 2</label>
              <select v-model="info.player2_id" class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="" disabled>Select player…</option>
                <option v-for="p in players" :key="p.id" :value="p.id" :disabled="usedIds.has(p.id) && p.id !== info.player2_id">{{ p.name }} ({{ p.mmr }})</option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">Partner</label>
              <select v-model="info.player4_id" class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="" disabled>Select partner…</option>
                <option v-for="p in players" :key="p.id" :value="p.id" :disabled="usedIds.has(p.id) && p.id !== info.player4_id">{{ p.name }} ({{ p.mmr }})</option>
              </select>
            </div>
          </div>
        </template>

        <!-- Shared fields -->
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-1">Date</label>
          <input v-model="info.date" type="date" class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-1">Surface</label>
          <div class="flex gap-2 flex-wrap">
            <button v-for="s in SURFACES" :key="s" type="button"
              :class="['rounded-full px-3 py-1 text-sm font-medium capitalize transition-colors border', info.surface === s ? 'bg-brand-600 border-brand-500 text-white' : 'bg-surface border-surface-border text-slate-400 hover:text-white']"
              @click="info.surface = s">{{ s }}</button>
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
              @click="setStatus(s)">{{ s }}</button>
          </div>
        </div>

        <!-- Live score -->
        <div v-if="currentStatus === 'live'" class="card space-y-3">
          <h2 class="text-sm font-semibold text-slate-300">Live score</h2>
          <p class="text-xs text-slate-500 truncate">{{ liveScoreLabel }}</p>
          <input v-model="liveScore" type="text" placeholder="e.g. 4-3 (set 1)"
            class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500" />
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

        <!-- Complete match -->
        <div v-if="currentStatus !== 'completed'" class="card space-y-3">
          <h2 class="text-sm font-semibold text-slate-300">Complete match</h2>

          <!-- Singles: winner dropdown -->
          <div v-if="!isDoubles">
            <label class="block text-sm font-medium text-slate-300 mb-1">Winner</label>
            <select v-model="winner_id" class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="" disabled>Select winner…</option>
              <option v-if="info.player1_id" :value="info.player1_id">{{ playerName(info.player1_id) || 'Player 1' }}</option>
              <option v-if="info.player2_id" :value="info.player2_id">{{ playerName(info.player2_id) || 'Player 2' }}</option>
            </select>
          </div>

          <!-- Doubles: winning team radio -->
          <div v-else>
            <label class="block text-sm font-medium text-slate-300 mb-2">Winning team</label>
            <div class="space-y-2">
              <label v-for="team in (['A', 'B'] as const)" :key="team"
                class="flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors"
                :class="winning_team === team ? 'border-brand-500 bg-brand-600/10' : 'border-surface-border hover:border-slate-500'">
                <input v-model="winning_team" type="radio" :value="team" class="accent-brand-500" />
                <span class="text-sm font-medium text-slate-200">
                  Team {{ team }}
                  <span class="text-slate-400 font-normal ml-1 text-xs">{{ team === 'A' ? teamALabel : teamBLabel }}</span>
                </span>
              </label>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1">Final score</label>
            <input v-model="finalScore" type="text" placeholder="e.g. 6-3 7-5"
              class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>

          <button type="button" :disabled="scoreLoading" class="w-full rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white transition-colors" @click="completeMatch">
            {{ scoreLoading ? 'Saving…' : 'Complete & update MMR' }}
          </button>
        </div>

        <!-- Completed summary -->
        <div v-else class="card space-y-2">
          <h2 class="text-sm font-semibold text-slate-300">Result</h2>
          <p class="text-sm text-slate-400">
            <span class="text-white font-medium">{{ completedWinnerName }}</span>
            won · <span class="font-mono">{{ match?.score }}</span>
          </p>
          <NuxtLink :to="`/matches/${id}`" class="text-xs text-brand-400 hover:text-brand-300">View match →</NuxtLink>
        </div>

        <div v-if="scoreError"   class="text-sm text-red-400 px-1">{{ scoreError }}</div>
        <div v-if="scoreSuccess" class="text-sm text-green-400 px-1">{{ scoreSuccess }}</div>
      </div>

      <!-- Col 3: Embed preview -->
      <div v-if="info.stream_url" class="card space-y-3">
        <h2 class="text-sm font-semibold text-slate-300">Stream preview</h2>
        <MediaEmbed :url="info.stream_url" />
      </div>
    </div>
  </div>
</template>
