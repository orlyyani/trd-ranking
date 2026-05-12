export interface LiveMatch {
  id: string
  match_type: 'singles' | 'doubles'
  stream_url: string | null
  live_score: string | null
  status: string
  player1: { id: string; name: string; mmr: number } | null
  player2: { id: string; name: string; mmr: number } | null
  player3: { id: string; name: string; mmr: number } | null
  player4: { id: string; name: string; mmr: number } | null
}

/**
 * Reactively returns the currently live match.
 * Uses Supabase Realtime for instant updates; falls back to 30-second polling
 * if the WebSocket connection fails (common in local dev).
 */
export const useLiveMatch = () => {
  const supabase = useSupabase()

  const { data: liveMatch, refresh } = useAsyncData<LiveMatch | null>(
    'live-match',
    async () => {
      const { data: matches } = await supabase
        .from('matches')
        .select('id, match_type, stream_url, live_score, status, player1_id, player2_id, player3_id, player4_id')
        .eq('is_live', true)
        .order('created_at', { ascending: false })
        .limit(1)

      const match = matches?.[0] ?? null
      if (!match) return null

      const playerIds = [
        match.player1_id, match.player2_id,
        match.player3_id, match.player4_id,
      ].filter(Boolean) as string[]

      const { data: players } = await supabase
        .from('players')
        .select('id, name, mmr')
        .in('id', playerIds)

      const pm = new Map((players ?? []).map(p => [p.id, p]))

      return {
        id:         match.id,
        match_type: (match.match_type ?? 'singles') as 'singles' | 'doubles',
        stream_url: match.stream_url,
        live_score: match.live_score,
        status:     match.status,
        player1:    match.player1_id ? (pm.get(match.player1_id) ?? null) : null,
        player2:    match.player2_id ? (pm.get(match.player2_id) ?? null) : null,
        player3:    match.player3_id ? (pm.get(match.player3_id) ?? null) : null,
        player4:    match.player4_id ? (pm.get(match.player4_id) ?? null) : null,
      }
    },
    { server: false },
  )

  onMounted(() => {
    // Realtime subscription — fails gracefully if WebSocket is unavailable
    let channel: ReturnType<typeof supabase.channel> | null = null
    try {
      channel = supabase.channel('live-match-watch')
      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => refresh())
        .subscribe((status, err) => {
          // WebSocket failures are expected in local dev without Supabase running.
          // Polling fallback below keeps data fresh regardless.
          if (err && process.env.NODE_ENV !== 'development') {
            console.warn('[useLiveMatch] Realtime error:', err)
          }
        })
    } catch (err) {
      console.warn('[useLiveMatch] Realtime unavailable, falling back to polling:', err)
    }

    // Polling fallback — refreshes every 30 s regardless of WebSocket state
    const poll = setInterval(() => refresh(), 30_000)

    onUnmounted(() => {
      clearInterval(poll)
      if (channel) supabase.removeChannel(channel)
    })
  })

  return { liveMatch }
}
