import type { Database } from '~/types/database.types'

export interface LeaderboardEntry {
  id: string
  name: string
  avatar_url: string | null
  elo: number
  wins: number
  losses: number
  rank: number
  /** Positive = moved up, negative = moved down, null = no snapshot yet */
  rankDelta: number | null
}

/**
 * Fetches all players ordered by ELO (descending) and annotates each with
 * their current rank and rank delta relative to yesterday's snapshot.
 *
 * rank delta = yesterday's rank − today's rank
 *   +3 means the player moved up 3 places
 *   -2 means they fell 2 places
 *   null means no snapshot exists yet (new player or first day)
 *
 * Uses `useAsyncData` so SSR payload is forwarded to the client — no
 * duplicate DB call on hydration.
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
        .select('id, name, avatar_url, elo, wins, losses')
        .order('elo', { ascending: false }),
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