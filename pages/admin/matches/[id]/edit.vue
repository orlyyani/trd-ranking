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
      .select('id, match_type, player1_id, player2_id, player3_id, player4_id, winner_id, loser_id, date, score, surface, tournament, round, ranked, stream_url, is_live, live_score, status, challonge_match_id, challonge_tournament')
      .eq('id', id)
      .single()
    return data
  }),
])

if (!match.value) throw createError({ statusCode: 404, statusMessage: 'Match not found' })

const SURFACES = ['clay', 'hard', 'grass', 'indoor'] as const
const ROUNDS   = ['group', 'quarterfinal', 'semifinal', 'final'] as const

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
  round:                match.value.round ?? '' as typeof ROUNDS[number] | '',
  ranked:               match.value.ranked ?? true,
  stream_url:           match.value.stream_url ?? '',
  challonge_match_id:   match.value.challonge_match_id ?? '',
  challonge_tournament: match.value.challonge_tournament ?? '',
})

const usedIds = computed(() =>
  new Set([info.player1_id, info.player2_id, info.player3_id, info.player4_id].filter(Boolean)),
)

const infoLoading       = ref(false)
const infoError         = ref('')
const infoSuccess       = ref(false)
const showRankedWarning   = ref(false)
const showCompleteConfirm = ref(false)

function trySetRanked() {
  if (!info.ranked) showRankedWarning.value = true
  else info.ranked = false
}

function requestCompleteConfirm() {
  const effectiveWinnerId = isDoubles.value
    ? (winning_team.value === 'A' ? info.player1_id : winning_team.value === 'B' ? info.player2_id : '')
    : winner_id.value

  if (!effectiveWinnerId) { scoreError.value = isDoubles.value ? 'Select the winning team.' : 'Select a winner.'; return }
  if (!finalScore.value.trim()) { scoreError.value = 'Enter the final score.'; return }

  scoreError.value = ''
  showCompleteConfirm.value = true
}

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
      round:                info.round                      || undefined,
      ranked:               info.ranked,
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

const completeWinnerLabel = computed(() => {
  if (isDoubles.value)
    return winning_team.value === 'A' ? teamALabel.value : winning_team.value === 'B' ? teamBLabel.value : ''
  return playerName(winner_id.value)
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
        <div v-if="info.tournament.trim()">
          <label class="block text-sm font-medium text-slate-300 mb-1">Round <span class="text-slate-500 font-normal">(optional)</span></label>
          <div class="flex gap-2 flex-wrap">
            <button v-for="r in ROUNDS" :key="r" type="button"
              :class="['rounded-full px-3 py-1 text-sm font-medium capitalize transition-colors border', info.round === r ? 'bg-brand-600 border-brand-500 text-white' : 'bg-surface border-surface-border text-slate-400 hover:text-white']"
              @click="info.round = info.round === r ? '' : r">{{ r }}</button>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-2">Match mode</label>
          <div class="flex rounded-lg overflow-hidden border border-surface-border w-fit">
            <button type="button"
              :class="['px-5 py-2 text-sm font-medium transition-colors', info.ranked ? 'bg-brand-600 text-white' : 'bg-surface text-slate-400 hover:text-white']"
              @click="trySetRanked">Ranked</button>
            <button type="button"
              :class="['px-5 py-2 text-sm font-medium transition-colors', !info.ranked ? 'bg-slate-700 text-white' : 'bg-surface text-slate-400 hover:text-white']"
              @click="info.ranked = false">Friendly</button>
          </div>
          <p v-if="!info.ranked" class="mt-1 text-xs text-slate-500">No MMR changes — recorded for history only.</p>
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

          <button type="button" :disabled="scoreLoading" class="w-full rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white transition-colors" @click="requestCompleteConfirm">
            {{ scoreLoading ? 'Saving…' : info.ranked ? 'Complete & update MMR' : 'Complete match' }}
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

  <!-- ── Complete match confirmation modal ─────────────────────────────────── -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showCompleteConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        @click.self="showCompleteConfirm = false"
      >
        <div class="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-md space-y-5 p-6">

          <div>
            <h2 class="text-lg font-semibold text-white">Review match details</h2>
            <p class="text-xs text-slate-500 mt-0.5">Double-check everything before confirming.</p>
          </div>

          <!-- Ranked / Friendly badge -->
          <div
            class="rounded-lg px-4 py-3 flex items-center gap-3 ring-1"
            :class="info.ranked ? 'bg-brand-900/40 ring-brand-700' : 'bg-slate-800/60 ring-slate-600'"
          >
            <div class="h-2.5 w-2.5 rounded-full shrink-0" :class="info.ranked ? 'bg-brand-400' : 'bg-slate-400'" />
            <div>
              <p class="text-sm font-semibold" :class="info.ranked ? 'text-brand-300' : 'text-slate-300'">
                {{ info.ranked ? 'Ranked match' : 'Friendly match' }}
              </p>
              <p class="text-xs mt-0.5" :class="info.ranked ? 'text-brand-400/70' : 'text-slate-500'">
                {{ info.ranked ? 'MMR will be updated after this match.' : 'No MMR changes — recorded for history only.' }}
              </p>
            </div>
          </div>

          <!-- Details -->
          <dl class="space-y-2 text-sm">
            <div class="flex justify-between gap-4">
              <dt class="text-slate-500 shrink-0">Type</dt>
              <dd class="text-slate-200 capitalize text-right">{{ isDoubles ? 'Doubles' : 'Singles' }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-slate-500 shrink-0">{{ isDoubles ? 'Team A' : 'Player 1' }}</dt>
              <dd class="text-slate-200 text-right truncate">{{ isDoubles ? teamALabel : playerName(info.player1_id) }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-slate-500 shrink-0">{{ isDoubles ? 'Team B' : 'Player 2' }}</dt>
              <dd class="text-slate-200 text-right truncate">{{ isDoubles ? teamBLabel : playerName(info.player2_id) }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-slate-500 shrink-0">Date</dt>
              <dd class="text-slate-200 text-right">{{ info.date }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-slate-500 shrink-0">Surface</dt>
              <dd class="text-slate-200 capitalize text-right">{{ info.surface }}</dd>
            </div>
            <template v-if="info.tournament.trim()">
              <div class="flex justify-between gap-4">
                <dt class="text-slate-500 shrink-0">Tournament</dt>
                <dd class="text-slate-200 text-right truncate">{{ info.tournament }}</dd>
              </div>
              <div v-if="info.round" class="flex justify-between gap-4">
                <dt class="text-slate-500 shrink-0">Round</dt>
                <dd class="text-slate-200 capitalize text-right">{{ info.round }}</dd>
              </div>
            </template>
            <div class="border-t border-surface-border pt-2 flex justify-between gap-4">
              <dt class="text-slate-500 shrink-0">Winner</dt>
              <dd class="text-brand-400 font-medium text-right truncate">{{ completeWinnerLabel }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-slate-500 shrink-0">Score</dt>
              <dd class="text-white font-mono font-semibold text-right">{{ finalScore }}</dd>
            </div>
          </dl>

          <div class="flex gap-3 pt-1">
            <button
              type="button"
              class="flex-1 rounded-lg border border-surface-border px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
              @click="showCompleteConfirm = false"
            >Go back</button>
            <button
              type="button"
              :disabled="scoreLoading"
              class="flex-1 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors"
              @click="showCompleteConfirm = false; completeMatch()"
            >{{ info.ranked ? 'Confirm & update MMR' : 'Confirm & complete' }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- ── Ranked warning modal ────────────────────────────────────────────────── -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showRankedWarning"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        @click.self="showRankedWarning = false"
      >
        <div class="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-sm space-y-4 p-6">
          <div class="flex items-start gap-3">
            <div class="mt-0.5 flex-shrink-0 rounded-full bg-amber-500/15 p-2">
              <svg class="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-semibold text-white">Change to Ranked?</h3>
              <p class="mt-1 text-sm text-slate-400">This match will affect MMR when saved. Make sure the result is finalised before switching to ranked.</p>
            </div>
          </div>
          <div class="flex gap-3">
            <button
              type="button"
              class="flex-1 rounded-lg border border-surface-border px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
              @click="showRankedWarning = false"
            >Cancel</button>
            <button
              type="button"
              class="flex-1 rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors"
              @click="info.ranked = true; showRankedWarning = false"
            >Yes, set Ranked</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
