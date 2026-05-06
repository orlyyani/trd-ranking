import type { Database } from '~/types/database.types'

export interface LeaderboardEntry {
  id: string
  name: string
  avatar_url: string | null
  mmr: number
  tier: string
  wins: number
  losses: number
  rank: number
  /** Positive = moved up, negative = moved down, null = no snapshot yet */
  rankDelta: number | null
}

interface UseLeaderboardOptions {
  page?: MaybeRef<number>
  limit?: number
  search?: MaybeRef<string>
}

const PAGE_SIZE = 10

export const useLeaderboard = (options: UseLeaderboardOptions = {}) => {
  const supabase = useSupabase()
  const limit  = options.limit ?? PAGE_SIZE
  const page   = options.page  ?? ref(1)
  const search = options.search ?? ref('')

  return useAsyncData<{ entries: LeaderboardEntry[]; total: number }>(
    `leaderboard-${unref(page)}-${limit}`,
    async () => {
      const p = unref(page)
      const q = unref(search).trim()
      const from = (p - 1) * limit
      const to   = from + limit - 1

      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      const [allPlayersResult, snapshotsResult] = await Promise.all([
        supabase.from('players').select('id, name, avatar_url, mmr, tier, wins, losses').order('mmr', { ascending: false }),
        supabase.from('rank_snapshots').select('player_id, rank').eq('snapshot_date', yesterdayStr),
      ])

      const allPlayers = allPlayersResult.data ?? []
      const snapshotMap = new Map(
        (snapshotsResult.data ?? []).map(s => [s.player_id, s.rank]),
      )

      // Assign accurate global ranks to every player first
      const ranked = allPlayers.map((player, index) => {
        const currentRank = index + 1
        const prevRank    = snapshotMap.get(player.id) ?? null
        return {
          ...player,
          rank: currentRank,
          rankDelta: prevRank !== null ? prevRank - currentRank : null,
        }
      })

      // Filter by search (client-side after global rank assignment)
      const filtered = q
        ? ranked.filter(p => p.name.toLowerCase().includes(q.toLowerCase()))
        : ranked

      const total   = filtered.length
      const entries = filtered.slice(from, to + 1)

      return { entries, total }
    },
    { watch: [() => unref(page), () => unref(search)] },
  )
}
