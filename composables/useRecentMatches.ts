import type { Surface, MatchStatus, MatchType } from '~/types/database.types'

export interface RecentMatch {
  id: string
  date: string
  score: string | null
  surface: Surface
  tournament: string | null
  ranked: boolean
  match_type: MatchType
  player1_id: string | null
  player2_id: string | null
  player3_id: string | null
  player4_id: string | null
  winner_id: string | null
  loser_id: string | null
  is_live: boolean
  live_score: string | null
  stream_url: string | null
  status: MatchStatus
  created_at: string
  player1: { id: string; name: string; avatar_url: string | null; mmr: number } | null
  player2: { id: string; name: string; avatar_url: string | null; mmr: number } | null
  player3: { id: string; name: string; avatar_url: string | null; mmr: number } | null
  player4: { id: string; name: string; avatar_url: string | null; mmr: number } | null
}

interface UseRecentMatchesOptions {
  page?: MaybeRef<number>
  limit?: number
}

const PAGE_SIZE = 10

export const useRecentMatches = (options: UseRecentMatchesOptions = {}) => {
  const supabase = useSupabase()
  const limit = options.limit ?? PAGE_SIZE
  const page  = options.page ?? ref(1)

  return useAsyncData<{ matches: RecentMatch[]; total: number }>(
    `recent-matches-${unref(page)}-${limit}`,
    async () => {
      const p    = unref(page)
      const from = (p - 1) * limit
      const to   = from + limit - 1

      const [matchRes, countRes] = await Promise.all([
        supabase
          .from('matches')
          .select('id, date, score, surface, tournament, ranked, match_type, player1_id, player2_id, player3_id, player4_id, winner_id, loser_id, is_live, live_score, stream_url, status, created_at')
          .neq('status', 'scheduled')
          .order('created_at', { ascending: false })
          .range(from, to),
        supabase
          .from('matches')
          .select('id', { count: 'exact', head: true })
          .neq('status', 'scheduled'),
      ])

      const rawMatches = matchRes.data ?? []
      const total      = countRes.count ?? 0

      if (!rawMatches.length) return { matches: [], total }

      const playerIds = [
        ...new Set(
          rawMatches.flatMap(m =>
            [m.player1_id, m.player2_id, m.player3_id, m.player4_id].filter(Boolean),
          ),
        ),
      ] as string[]

      const { data: playerRows } = await supabase
        .from('players')
        .select('id, name, avatar_url, mmr')
        .in('id', playerIds)

      const playerMap = new Map((playerRows ?? []).map(p => [p.id, p]))

      const matches: RecentMatch[] = rawMatches.map(m => ({
        ...m,
        match_type: (m.match_type ?? 'singles') as MatchType,
        player3_id: m.player3_id ?? null,
        player4_id: m.player4_id ?? null,
        player1: m.player1_id ? (playerMap.get(m.player1_id) ?? null) : null,
        player2: m.player2_id ? (playerMap.get(m.player2_id) ?? null) : null,
        player3: m.player3_id ? (playerMap.get(m.player3_id) ?? null) : null,
        player4: m.player4_id ? (playerMap.get(m.player4_id) ?? null) : null,
      }))

      return { matches, total }
    },
    { watch: [() => unref(page)] },
  )
}
