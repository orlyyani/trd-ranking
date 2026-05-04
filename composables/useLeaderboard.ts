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

/**
 * Fetches all players ordered by MMR (descending) and annotates each with
 * their current rank and rank delta relative to yesterday's snapshot.
 *
 * rank delta = yesterday's rank − today's rank
 *   +3 means the player moved up 3 places
 *   -2 means they fell 2 places
 *   null means no snapshot exists yet (new player or first day)
 */
export const useLeaderboard = () => {
  const supabase = useSupabase()

  return useAsyncData<LeaderboardEntry[]>('leaderboard', async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    const [playersResult, snapshotsResult] = await Promise.all([
      supabase
        .from('players')
        .select('id, name, avatar_url, mmr, tier, wins, losses')
        .order('mmr', { ascending: false }),
      supabase
        .from('rank_snapshots')
        .select('player_id, rank')
        .eq('snapshot_date', yesterdayStr),
    ])

    const players = playersResult.data ?? []
    const snapshotMap = new Map(
      (snapshotsResult.data ?? []).map(s => [s.player_id, s.rank]),
    )

    return players.map((player, index) => {
      const currentRank = index + 1
      const prevRank = snapshotMap.get(player.id) ?? null
      const rankDelta = prevRank !== null ? prevRank - currentRank : null
      return { ...player, rank: currentRank, rankDelta }
    })
  })
}
