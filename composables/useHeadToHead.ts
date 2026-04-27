import type { Surface } from '~/types/database.types'

export interface H2HMatch {
  id: string
  date: string
  score: string
  surface: Surface
  tournament: string | null
  winner_id: string
  loser_id: string
}

export interface HeadToHeadData {
  matches: H2HMatch[]
  /** Wins by playerA (first argument) */
  aWins: number
  /** Wins by playerB (second argument) */
  bWins: number
}

/**
 * Fetches the head-to-head record between two players.
 *
 * Returns all matches between them (newest first) and the win counts for
 * each side.
 *
 * The PostgREST `or` filter covers both directions:
 *   (winner=A AND loser=B) OR (winner=B AND loser=A)
 *
 * `useAsyncData` key is order-independent — we sort the two IDs so that
 * h2h(A,B) and h2h(B,A) share the same cache entry.
 */
export const useHeadToHead = (
  playerAId: MaybeRef<string>,
  playerBId: MaybeRef<string>,
) => {
  const supabase = useSupabase()

  // Stable cache key regardless of argument order.
  const cacheKey = computed(() => {
    const ids = [unref(playerAId), unref(playerBId)].sort()
    return `h2h-${ids[0]}-${ids[1]}`
  })

  return useAsyncData<HeadToHeadData>(cacheKey.value, async () => {
    const aId = unref(playerAId)
    const bId = unref(playerBId)

    const { data, error } = await supabase
      .from('matches')
      .select('id, date, score, surface, tournament, winner_id, loser_id')
      .or(
        `and(winner_id.eq.${aId},loser_id.eq.${bId}),` +
        `and(winner_id.eq.${bId},loser_id.eq.${aId})`,
      )
      .order('date', { ascending: false })

    if (error) {
      console.error('[useHeadToHead] query:', error.message)
      return { matches: [], aWins: 0, bWins: 0 }
    }

    const matches = (data ?? []) as H2HMatch[]
    const aWins = matches.filter(m => m.winner_id === aId).length
    const bWins = matches.filter(m => m.winner_id === bId).length

    return { matches, aWins, bWins }
  })
}
