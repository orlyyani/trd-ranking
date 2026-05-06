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
    `leaderboard-${unref(page)}-${limit}-${unref(search)}`,
    async () => {
      const p = unref(page)
      const q = unref(search).trim()
      const from = (p - 1) * limit
      const to   = from + limit - 1

      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      let pageQuery  = supabase.from('players').select('id, name, avatar_url, mmr, tier, wins, losses').order('mmr', { ascending: false }).range(from, to)
      let countQuery = supabase.from('players').select('id', { count: 'exact', head: true })
      if (q) {
        pageQuery  = pageQuery.ilike('name', `%${q}%`)
        countQuery = countQuery.ilike('name', `%${q}%`)
      }

      const [playersResult, countResult, snapshotsResult] = await Promise.all([
        pageQuery,
        countQuery,
        supabase.from('rank_snapshots').select('player_id, rank').eq('snapshot_date', yesterdayStr),
      ])

      const players = playersResult.data ?? []
      const total   = countResult.count ?? 0
      const snapshotMap = new Map(
        (snapshotsResult.data ?? []).map(s => [s.player_id, s.rank]),
      )

      const entries = players.map((player, index) => {
        const currentRank = from + index + 1
        const prevRank    = snapshotMap.get(player.id) ?? null
        const rankDelta   = prevRank !== null ? prevRank - currentRank : null
        return { ...player, rank: currentRank, rankDelta }
      })

      return { entries, total }
    },
    { watch: [() => unref(page), () => unref(search)] },
  )
}
