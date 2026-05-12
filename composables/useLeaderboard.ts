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
  mode?: MaybeRef<'singles' | 'doubles'>
}

const PAGE_SIZE = 10

export const useLeaderboard = (options: UseLeaderboardOptions = {}) => {
  const supabase = useSupabase()
  const limit  = options.limit ?? PAGE_SIZE
  const page   = options.page  ?? ref(1)
  const search = options.search ?? ref('')
  const mode   = options.mode  ?? ref<'singles' | 'doubles'>('singles')

  return useAsyncData<{ entries: LeaderboardEntry[]; total: number }>(
    'leaderboard',
    async () => {
      const p = unref(page)
      const q = unref(search).trim()
      const m = unref(mode)
      const from = (p - 1) * limit
      const to   = from + limit - 1

      if (m === 'doubles') {
        type DoubleRow = { id: string; name: string; avatar_url: string | null; mmr: number; tier: string; doubles_wins: number | null; doubles_losses: number | null }
        const { data: rawDoubles } = await supabase
          .from('players')
          .select('id, name, avatar_url, mmr, tier, doubles_wins, doubles_losses')
          .order('doubles_wins', { ascending: false })
        const data = (rawDoubles ?? []) as DoubleRow[]

        const withDoubles = (data ?? []).filter(
          p => (p.doubles_wins ?? 0) + (p.doubles_losses ?? 0) > 0,
        )

        const ranked: LeaderboardEntry[] = withDoubles.map((player, index) => ({
          id:         player.id,
          name:       player.name,
          avatar_url: player.avatar_url,
          mmr:        player.mmr,
          tier:       player.tier,
          wins:       player.doubles_wins   ?? 0,
          losses:     player.doubles_losses ?? 0,
          rank:       index + 1,
          rankDelta:  null,
        }))

        const filtered = q
          ? ranked.filter(p => p.name.toLowerCase().includes(q.toLowerCase()))
          : ranked

        return { entries: filtered.slice(from, to + 1), total: filtered.length }
      }

      // Singles — existing logic with rank delta from snapshots
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      type SingleRow   = { id: string; name: string; avatar_url: string | null; mmr: number; tier: string; wins: number; losses: number }
      type SnapshotRow = { player_id: string; rank: number }

      const [{ data: rawPlayers }, { data: rawSnapshots }] = await Promise.all([
        supabase.from('players').select('id, name, avatar_url, mmr, tier, wins, losses').order('mmr', { ascending: false }),
        supabase.from('rank_snapshots').select('player_id, rank').eq('snapshot_date', yesterdayStr),
      ])

      const allPlayers = (rawPlayers ?? []) as SingleRow[]
      const snapshotMap = new Map(
        ((rawSnapshots ?? []) as SnapshotRow[]).map(s => [s.player_id, s.rank]),
      )

      const ranked = allPlayers.map((player, index) => {
        const currentRank = index + 1
        const prevRank    = snapshotMap.get(player.id) ?? null
        return {
          ...player,
          rank:      currentRank,
          rankDelta: prevRank !== null ? prevRank - currentRank : null,
        }
      })

      const filtered = q
        ? ranked.filter(p => p.name.toLowerCase().includes(q.toLowerCase()))
        : ranked

      return { entries: filtered.slice(from, to + 1), total: filtered.length }
    },
    { watch: [() => unref(page), () => unref(search), () => unref(mode)] },
  )
}
