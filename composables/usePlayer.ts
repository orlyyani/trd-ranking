import type { Surface, PlayerTier } from '~/types/database.types'

export interface MatchHistoryEntry {
  id: string
  date: string
  score: string
  surface: Surface
  tournament: string | null
  role: 'winner' | 'loser'
  opponentId: string
}

export interface SurfaceBreakdown {
  wins: number
  losses: number
}

export interface PlayerProfile {
  id: string
  name: string
  avatar_url: string | null
  mmr: number
  tier: PlayerTier
  wins: number
  losses: number
  created_at: string
}

export interface PlayerData {
  player: PlayerProfile | null
  matches: MatchHistoryEntry[]
  /** e.g. { clay: { wins: 5, losses: 2 }, hard: { wins: 3, losses: 1 } } */
  surfaceStats: Partial<Record<Surface, SurfaceBreakdown>>
}

/**
 * Fetches a player's profile, full match history, and surface breakdown.
 */
export const usePlayer = (id: MaybeRef<string>) => {
  const supabase = useSupabase()

  return useAsyncData<PlayerData>(`player-${unref(id)}`, async () => {
    const playerId = unref(id)

    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id, name, avatar_url, mmr, tier, wins, losses, created_at')
      .eq('id', playerId)
      .single()

    if (playerError) {
      console.error('[usePlayer] players query:', playerError.message)
      return { player: null, matches: [], surfaceStats: {} }
    }

    const { data: mpRows, error: mpError } = await supabase
      .from('match_players')
      .select('match_id, role')
      .eq('player_id', playerId)

    if (mpError || !mpRows?.length) {
      return { player, matches: [], surfaceStats: {} }
    }

    const matchIds = mpRows.map(r => r.match_id)
    const roleMap = new Map(mpRows.map(r => [r.match_id, r.role] as const))

    const { data: rawMatches, error: matchError } = await supabase
      .from('matches')
      .select('id, date, score, surface, tournament, winner_id, loser_id')
      .in('id', matchIds)
      .order('date', { ascending: false })

    if (matchError) {
      console.error('[usePlayer] matches query:', matchError.message)
      return { player, matches: [], surfaceStats: {} }
    }

    const surfaceStats: Partial<Record<Surface, SurfaceBreakdown>> = {}
    const matches: MatchHistoryEntry[] = (rawMatches ?? []).map(m => {
      const role = roleMap.get(m.id)!
      const opponentId = role === 'winner' ? m.loser_id : m.winner_id

      const stat = surfaceStats[m.surface] ?? { wins: 0, losses: 0 }
      if (role === 'winner') stat.wins++
      else stat.losses++
      surfaceStats[m.surface] = stat

      return {
        id: m.id,
        date: m.date,
        score: m.score,
        surface: m.surface,
        tournament: m.tournament,
        role,
        opponentId,
      }
    })

    return { player, matches, surfaceStats }
  })
}
