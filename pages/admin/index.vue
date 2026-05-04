<script setup lang="ts">
definePageMeta({ middleware: 'admin', layout: 'default' })

const supabase = useSupabaseClient()

const { data: stats } = await useAsyncData('admin-stats', async () => {
  const [{ count: playerCount }, { count: matchCount }] = await Promise.all([
    supabase.from('players').select('*', { count: 'exact', head: true }),
    supabase.from('matches').select('*', { count: 'exact', head: true }),
  ])
  return { playerCount: playerCount ?? 0, matchCount: matchCount ?? 0 }
})

// Recent matches for quick access (including is_live status)
const { data: recentMatches } = await useAsyncData('admin-recent-matches', async () => {
  const { data: matches } = await supabase
    .from('matches')
    .select('id, date, score, surface, winner_id, loser_id, is_live')
    .order('created_at', { ascending: false })
    .limit(8)

  if (!matches?.length) return []

  const playerIds = [...new Set(matches.flatMap(m => [m.winner_id, m.loser_id]))]
  const { data: players } = await supabase
    .from('players')
    .select('id, name')
    .in('id', playerIds)

  const pm = new Map((players ?? []).map(p => [p.id, p.name]))

  return matches.map(m => ({
    id: m.id,
    date: m.date,
    score: m.score,
    is_live: m.is_live,
    winnerName: pm.get(m.winner_id) ?? '—',
    loserName:  pm.get(m.loser_id)  ?? '—',
  }))
})

async function signOut() {
  await supabase.auth.signOut()
  navigateTo('/login')
}
</script>

<template>
  <div class="space-y-8">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-white">Admin</h1>
      <button
        class="rounded-lg border border-surface-border px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
        @click="signOut"
      >
        Sign out
      </button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div class="card text-center space-y-1">
        <p class="text-3xl font-bold text-white">{{ stats?.playerCount }}</p>
        <p class="text-xs text-slate-400 uppercase tracking-widest">Players</p>
      </div>
      <div class="card text-center space-y-1">
        <p class="text-3xl font-bold text-white">{{ stats?.matchCount }}</p>
        <p class="text-xs text-slate-400 uppercase tracking-widest">Matches</p>
      </div>
    </div>

    <!-- Actions -->
    <div class="grid gap-4 sm:grid-cols-2">
      <NuxtLink
        to="/admin/matches/new"
        class="card group flex items-center gap-4 hover:border-brand-600 transition-colors"
      >
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-900/50 text-brand-400 group-hover:bg-brand-800/60 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <div>
          <p class="font-medium text-white">Add match</p>
          <p class="text-sm text-slate-400">Record a match result and update MMR</p>
        </div>
      </NuxtLink>

      <NuxtLink
        to="/admin/players/new"
        class="card group flex items-center gap-4 hover:border-brand-600 transition-colors"
      >
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-900/50 text-brand-400 group-hover:bg-brand-800/60 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div>
          <p class="font-medium text-white">Add player</p>
          <p class="text-sm text-slate-400">Register a new player with optional photo</p>
        </div>
      </NuxtLink>
    </div>

    <!-- Recent matches — quick access for editing / streaming setup -->
    <div v-if="recentMatches?.length" class="space-y-3">
      <h2 class="text-sm font-medium text-slate-400 uppercase tracking-widest">Recent matches</h2>
      <div class="card p-0 divide-y divide-surface-border">
        <div
          v-for="m in recentMatches"
          :key="m.id"
          class="flex items-center justify-between px-4 py-3 gap-4"
        >
          <div class="flex items-center gap-2 min-w-0">
            <!-- LIVE indicator -->
            <span v-if="m.is_live" class="relative flex h-2 w-2 shrink-0">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span class="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span class="text-sm text-slate-200 truncate">
              {{ m.winnerName }} <span class="text-slate-500">vs</span> {{ m.loserName }}
            </span>
            <span class="text-xs text-slate-500 shrink-0 hidden sm:inline">{{ m.score }}</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <NuxtLink
              :to="`/matches/${m.id}`"
              class="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              View
            </NuxtLink>
            <NuxtLink
              :to="`/admin/matches/${m.id}/edit`"
              class="rounded-md border border-surface-border px-2.5 py-1 text-xs text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
            >
              Edit / Stream
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick links -->
    <div>
      <h2 class="mb-3 text-sm font-medium text-slate-400 uppercase tracking-widest">Quick links</h2>
      <div class="flex flex-wrap gap-3">
        <NuxtLink to="/" class="text-sm text-brand-400 hover:text-brand-300 underline-offset-2 hover:underline">
          Leaderboard
        </NuxtLink>
        <NuxtLink to="/matches" class="text-sm text-brand-400 hover:text-brand-300 underline-offset-2 hover:underline">
          Matches
        </NuxtLink>
        <NuxtLink to="/h2h" class="text-sm text-brand-400 hover:text-brand-300 underline-offset-2 hover:underline">
          Head-to-head
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
