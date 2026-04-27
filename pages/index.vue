<script setup lang="ts">
const { data: leaderboard, pending, error } = await useLeaderboard()

const winRate = (wins: number, losses: number) => {
  const total = wins + losses
  return total === 0 ? '—' : `${Math.round((wins / total) * 100)}%`
}
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-xl sm:text-2xl font-semibold text-white">Leaderboard</h1>

    <div v-if="pending" class="text-slate-400">Loading…</div>
    <div v-else-if="error" class="text-red-400">Failed to load leaderboard.</div>

    <div v-else class="card overflow-x-auto p-0">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-surface-border text-xs text-slate-500 uppercase tracking-widest">
            <th class="px-4 py-3 text-right w-10">#</th>
            <th class="px-4 py-3 text-left w-8"></th>
            <th class="px-4 py-3 text-left">Player</th>
            <th class="px-4 py-3 text-center">ELO</th>
            <th class="px-4 py-3 text-center">W</th>
            <th class="px-4 py-3 text-center">L</th>
            <th class="px-4 py-3 text-center hidden sm:table-cell">Win %</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-surface-border">
          <tr
            v-for="player in leaderboard"
            :key="player.id"
            class="hover:bg-surface-elevated/50 transition-colors"
          >
            <td class="px-4 py-3 text-right text-slate-400 font-mono tabular-nums">
              {{ player.rank }}
            </td>
            <td class="px-2 py-3">
              <RankDelta :delta="player.rankDelta" />
            </td>
            <td class="px-4 py-3">
              <NuxtLink
                :to="`/players/${player.id}`"
                class="flex items-center gap-3 group"
              >
                <PlayerAvatar :name="player.name" :avatar-url="player.avatar_url" :size="36" />
                <span class="font-medium text-slate-200 group-hover:text-white transition-colors">
                  {{ player.name }}
                </span>
              </NuxtLink>
            </td>
            <td class="px-4 py-3 text-center">
              <EloChip :elo="player.elo" />
            </td>
            <td class="px-4 py-3 text-center text-brand-400 font-medium">{{ player.wins }}</td>
            <td class="px-4 py-3 text-center text-red-400 font-medium">{{ player.losses }}</td>
            <td class="px-4 py-3 text-center text-slate-400 hidden sm:table-cell">
              {{ winRate(player.wins, player.losses) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>