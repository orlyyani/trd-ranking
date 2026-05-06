/**
 * Returns upcoming (pending) and in-progress tournaments for the configured
 * Challonge community using the v2.1 API with community_id filter.
 *
 * v1 API subdomain param does NOT work for communities — must use v2.1.
 * Cached for 15 minutes (community schedules change slowly).
 */

interface ChallongeTournamentV2 {
  id: string
  type: string
  attributes: {
    name: string
    url: string
    full_challonge_url: string
    state: string
    starts_at: string | null
    participants_count: number
    tournament_type: string
    decorated_tournament_type: string
    timestamps: {
      starts_at: string | null
      started_at: string | null
      created_at: string
    }
  }
}

interface ChallongeV2Response {
  data: ChallongeTournamentV2[]
}

export interface CommunityTournament {
  id: string
  name: string
  slug: string
  url: string
  state: 'pending' | 'underway'
  startsAt: string | null
  participantsCount: number
  tournamentType: string
}

export default defineCachedEventHandler(
  async (): Promise<CommunityTournament[]> => {
    const config    = useRuntimeConfig()
    const apiKey    = config.challongeApiKey as string | undefined
    const community = config.challongeCommunity as string | undefined

    if (!apiKey || !community) return []

    const base    = 'https://api.challonge.com/v2.1/tournaments.json'
    const headers = { 'Authorization': apiKey, 'Authorization-Type': 'v1', 'Content-Type': 'application/vnd.api+json', 'Accept': 'application/json' }

    const [pendingRes, underwayRes] = await Promise.all([
      $fetch<ChallongeV2Response>(`${base}?community_id=${community}&state=pending`, { headers }).catch(() => ({ data: [] } as ChallongeV2Response)),
      $fetch<ChallongeV2Response>(`${base}?community_id=${community}&state=in_progress`, { headers }).catch(() => ({ data: [] } as ChallongeV2Response)),
    ])

    const toEntry = (t: ChallongeTournamentV2, state: 'pending' | 'underway'): CommunityTournament => ({
      id:               t.id,
      name:             t.attributes.name,
      slug:             t.attributes.url,
      url:              t.attributes.full_challonge_url,
      state,
      startsAt:         t.attributes.timestamps.starts_at ?? t.attributes.starts_at,
      participantsCount: t.attributes.participants_count,
      tournamentType:   t.attributes.decorated_tournament_type || t.attributes.tournament_type,
    })

    const results: CommunityTournament[] = [
      ...underwayRes.data.map(t => toEntry(t, 'underway')),
      ...pendingRes.data.map(t => toEntry(t, 'pending')),
    ]

    results.sort((a, b) => {
      if (a.state !== b.state) return a.state === 'underway' ? -1 : 1
      return (a.startsAt ?? '').localeCompare(b.startsAt ?? '')
    })

    return results
  },
  {
    maxAge: 900,
    name: 'challonge-community',
    getKey: () => 'community-tournaments',
  },
)
