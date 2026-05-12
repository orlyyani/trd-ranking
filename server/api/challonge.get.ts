/**
 * Returns bracket data for every configured Challonge tournament using the v2.1 API.
 *
 * Env format (CHALLONGE_TOURNAMENT_URLS):
 *   Single:   53yr35ik
 *   Multiple: Class C:53yr35ik,Beginners:abc456
 *   (falls back to legacy CHALLONGE_TOURNAMENT_URL if the plural key is absent)
 *
 * If CHALLONGE_COMMUNITY is set, underway community tournaments are auto-discovered
 * and merged with any env-configured slugs (deduplicated).
 *
 * API quota optimization (500 req/month free tier):
 *   - Participants cached per-tournament in Nitro storage for 2 h.
 *   - Match states fetched once per 3-minute outer cache window.
 */

interface ChallongeMatchV2 {
  id: string
  type: 'match'
  attributes: {
    state: string
    round: number
    identifier: string
    scores: string
    score_in_sets: number[][]
    points_by_participant: { participant_id: number; scores: number[] }[]
    winner_id: number | null
    tie: boolean
    timestamps: {
      underway_at: string | null
      started_at: string | null
      created_at: string
      updated_at: string
    }
  }
}

interface ChallongeParticipantV2 {
  id: string
  type: 'participant'
  attributes: {
    name: string
    seed: number
    tournament_id: number
  }
}

interface CommunityTournamentRaw {
  id: string
  attributes: { name: string; url: string; state: string }
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
  winnerSlot: 1 | 2 | null
}

export interface ChallongeTournamentData {
  slug: string
  name: string
  liveMatch: ChallongeLiveMatch | null
  bracket: ChallongeBracketMatch[]
}

const PARTICIPANT_CACHE_TTL = 2 * 60 * 60 * 1000 // 2 h in ms

function challongeHeaders(apiKey: string) {
  return {
    'Authorization': apiKey,
    'Authorization-Type': 'v1',
    'Content-Type': 'application/vnd.api+json',
    'Accept': 'application/json',
  }
}

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

async function fetchUnderwayCommunitySlugs(
  community: string,
  apiKey: string,
): Promise<{ name: string; slug: string }[]> {
  try {
    const res = await $fetch<{ data: CommunityTournamentRaw[] }>(
      `https://api.challonge.com/v2.1/tournaments.json?community_id=${community}&state=in_progress`,
      { headers: challongeHeaders(apiKey) },
    )
    return res.data.map(t => ({ name: t.attributes.name, slug: t.attributes.url }))
  } catch {
    return []
  }
}

function getPlayer(
  m: ChallongeMatchV2,
  idx: 0 | 1,
  nameMap: Map<number, string>,
): { id: number | null; name: string } {
  const entry = m.attributes.points_by_participant[idx]
  if (!entry?.participant_id) return { id: null, name: 'TBD' }
  return { id: entry.participant_id, name: nameMap.get(entry.participant_id) ?? 'TBD' }
}

// Returns null when the tournament no longer exists (404) so it can be filtered out cleanly.
async function fetchTournamentData(
  slug: string,
  displayName: string,
  apiKey: string,
  storage: ReturnType<typeof useStorage>,
  community?: string,
): Promise<ChallongeTournamentData | null> {
  const base    = `https://api.challonge.com/v2.1/tournaments/${slug}`
  const qs      = community ? `?community_id=${community}` : ''
  const headers = challongeHeaders(apiKey)

  try {
    // Participants: long-lived per-tournament cache to save API quota
    const pCacheKey   = `challonge:participants:v2:${slug}`
    const pCacheEntry = await storage.getItem<{ data: ChallongeParticipantV2[]; expiresAt: number }>(pCacheKey)

    let participantsData: ChallongeParticipantV2[]
    if (pCacheEntry && pCacheEntry.expiresAt > Date.now()) {
      participantsData = pCacheEntry.data
    } else {
      const res = await $fetch<{ data: ChallongeParticipantV2[] }>(`${base}/participants.json${qs}`, { headers })
      participantsData = res.data
      await storage.setItem(pCacheKey, { data: participantsData, expiresAt: Date.now() + PARTICIPANT_CACHE_TTL })
    }

    const matchesRes  = await $fetch<{ data: ChallongeMatchV2[] }>(`${base}/matches.json${qs}`, { headers })
    const matchesData = matchesRes.data

    // Participant IDs in match payloads are numeric; participants list has string IDs.
    const nameMap = new Map(
      participantsData.map(p => [Number(p.id), p.attributes.name]),
    )

    const live = matchesData.find(m =>
      m.attributes.state === 'open' && m.attributes.timestamps.underway_at !== null,
    )

    const liveMatch: ChallongeLiveMatch | null = live
      ? {
          matchId: Number(live.id),
          player1: getPlayer(live, 0, nameMap).name,
          player2: getPlayer(live, 1, nameMap).name,
          score:   live.attributes.scores || '',
          round:   live.attributes.round,
        }
      : null

    const bracket: ChallongeBracketMatch[] = matchesData
      .filter(m => m.attributes.round > 0)
      .map((m) => {
        const p1 = getPlayer(m, 0, nameMap)
        const p2 = getPlayer(m, 1, nameMap)
        return {
          matchId:     Number(m.id),
          round:       m.attributes.round,
          state:       m.attributes.state as 'open' | 'complete' | 'pending',
          player1Name: p1.name,
          player2Name: p2.name,
          score:       m.attributes.scores || '',
          isLive:      m.attributes.state === 'open' && m.attributes.timestamps.underway_at !== null,
          winnerSlot:  m.attributes.winner_id
            ? (m.attributes.winner_id === p1.id ? 1 as const : 2 as const)
            : null,
        }
      })
      .sort((a, b) => a.round - b.round || a.matchId - b.matchId)

    return { slug, name: displayName, liveMatch, bracket }
  } catch (err: any) {
    const status = err?.response?.status ?? err?.statusCode
    if (status === 404 || status === 422) {
      await storage.removeItem(`challonge:participants:v2:${slug}`)
      return null
    }
    throw err
  }
}

export default defineCachedEventHandler(
  async (): Promise<ChallongeTournamentData[]> => {
    const config    = useRuntimeConfig()
    const apiKey    = config.challongeApiKey as string | undefined
    const urlsEnv   = config.challongeTournamentUrls as string | undefined
    const urlEnv    = config.challongeTournamentUrl as string | undefined
    const community = config.challongeCommunity as string | undefined

    if (!apiKey) return []

    const configured = parseTournamentList(urlsEnv ?? '', urlEnv ?? '')

    // Auto-discover underway community tournaments and merge (deduplicated by slug).
    const discovered     = community ? await fetchUnderwayCommunitySlugs(community, apiKey) : []
    const configuredSlugs = new Set(configured.map(t => t.slug))
    const merged          = [...configured, ...discovered.filter(t => !configuredSlugs.has(t.slug))]

    if (!merged.length) return []

    const storage = useStorage('cache')

    const results = await Promise.all(
      merged.map(t => fetchTournamentData(t.slug, t.name, apiKey, storage, community || undefined)),
    )
    return results.filter((t): t is ChallongeTournamentData => t !== null)
  },
  {
    maxAge: 180,
    name: 'challonge-data',
    getKey: () => 'challonge-brackets',
  },
)
