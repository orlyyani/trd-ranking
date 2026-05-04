/**
 * Returns bracket data for every configured Challonge tournament.
 *
 * Env format (CHALLONGE_TOURNAMENT_URLS):
 *   Single:   53yr35ik
 *   Multiple: Class C:53yr35ik,Beginners:abc456
 *   (falls back to legacy CHALLONGE_TOURNAMENT_URL if the plural key is absent)
 *
 * API quota optimization (500 req/month free tier):
 *   - Participants cached per-tournament in Nitro storage for 2 h.
 *   - Match states fetched once per 3-minute outer cache window.
 *   - With 2 tournaments: ~2 match calls per 3 min during active play.
 */

interface ChallongeMatchRaw {
  match: {
    id: number
    state: string
    player1_id: number | null
    player2_id: number | null
    scores_csv: string
    round: number
  }
}

interface ChallongeParticipantRaw {
  participant: {
    id: number
    name: string
    display_name: string
  }
}

export interface ChallongeLiveMatch {
  matchId: number
  player1: string
  player2: string
  score: string
  round: number
}

export interface ChallongeBracketMatch {
  matchId: number
  round: number
  state: 'open' | 'complete' | 'pending'
  player1Name: string
  player2Name: string
  score: string
  isLive: boolean
}

export interface ChallongeTournamentData {
  slug: string
  name: string
  liveMatch: ChallongeLiveMatch | null
  bracket: ChallongeBracketMatch[]
}

const PARTICIPANT_CACHE_TTL = 2 * 60 * 60 * 1000 // 2 h in ms

function parseTournamentList(urlsEnv: string, urlEnv: string) {
  const src = urlsEnv?.trim() || urlEnv?.trim()
  if (!src) return []
  return src.split(',').map((entry) => {
    const colonIdx = entry.indexOf(':')
    if (colonIdx > 0) {
      return { name: entry.slice(0, colonIdx).trim(), slug: entry.slice(colonIdx + 1).trim() }
    }
    return { name: '', slug: entry.trim() }
  }).filter(t => t.slug)
}

// Returns null when the tournament no longer exists (404) so it can be filtered out cleanly.
async function fetchTournamentData(
  slug: string,
  displayName: string,
  apiKey: string,
  storage: ReturnType<typeof useStorage>,
): Promise<ChallongeTournamentData | null> {
  const base = `https://api.challonge.com/v1/tournaments/${slug}`
  const qs   = `?api_key=${apiKey}`

  try {
    // Participants: long-lived per-tournament cache to save API quota
    const pCacheKey   = `challonge:participants:${slug}`
    const pCacheEntry = await storage.getItem<{ data: ChallongeParticipantRaw[]; expiresAt: number }>(pCacheKey)

    let participantsRaw: ChallongeParticipantRaw[]
    if (pCacheEntry && pCacheEntry.expiresAt > Date.now()) {
      participantsRaw = pCacheEntry.data
    } else {
      participantsRaw = await $fetch<ChallongeParticipantRaw[]>(`${base}/participants.json${qs}`)
      await storage.setItem(pCacheKey, { data: participantsRaw, expiresAt: Date.now() + PARTICIPANT_CACHE_TTL })
    }

    const matchesRaw = await $fetch<ChallongeMatchRaw[]>(`${base}/matches.json${qs}`)

    const nameMap = new Map(
      participantsRaw.map(p => [p.participant.id, p.participant.display_name || p.participant.name]),
    )

    const live = matchesRaw.find(m =>
      m.match.state === 'open' && m.match.player1_id && m.match.player2_id,
    )

    const liveMatch: ChallongeLiveMatch | null = live
      ? {
          matchId: live.match.id,
          player1: nameMap.get(live.match.player1_id!) ?? 'Player 1',
          player2: nameMap.get(live.match.player2_id!) ?? 'Player 2',
          score:   live.match.scores_csv ? live.match.scores_csv.split(',').join(', ') : '',
          round:   live.match.round,
        }
      : null

    const bracket: ChallongeBracketMatch[] = matchesRaw
      .filter(m => m.match.round > 0)
      .map(m => ({
        matchId:     m.match.id,
        round:       m.match.round,
        state:       m.match.state as 'open' | 'complete' | 'pending',
        player1Name: m.match.player1_id ? (nameMap.get(m.match.player1_id) ?? 'TBD') : 'TBD',
        player2Name: m.match.player2_id ? (nameMap.get(m.match.player2_id) ?? 'TBD') : 'TBD',
        score:       m.match.scores_csv ? m.match.scores_csv.split(',').join(', ') : '',
        isLive:      m.match.state === 'open' && m.match.player1_id != null && m.match.player2_id != null,
      }))
      .sort((a, b) => a.round - b.round || a.matchId - b.matchId)

    return { slug, name: displayName, liveMatch, bracket }
  } catch (err: any) {
    const status = err?.response?.status ?? err?.statusCode
    if (status === 404 || status === 422) {
      // Tournament deleted or not found — evict the stale participant cache so it
      // doesn't get served again after the tournament is recreated with the same slug.
      await storage.removeItem(`challonge:participants:${slug}`)
      return null
    }
    throw err
  }
}

export default defineCachedEventHandler(
  async (): Promise<ChallongeTournamentData[]> => {
    const config     = useRuntimeConfig()
    const apiKey     = config.challongeApiKey as string | undefined
    const urlsEnv    = config.challongeTournamentUrls as string | undefined
    const urlEnv     = config.challongeTournamentUrl as string | undefined

    if (!apiKey) return []

    const tournaments = parseTournamentList(urlsEnv ?? '', urlEnv ?? '')
    if (!tournaments.length) return []

    const storage = useStorage('cache')

    const results = await Promise.all(
      tournaments.map(t => fetchTournamentData(t.slug, t.name, apiKey, storage)),
    )
    return results.filter((t): t is ChallongeTournamentData => t !== null)
  },
  {
    maxAge: 180,
    name: 'challonge-data',
    getKey: () => 'challonge-brackets',
  },
)
