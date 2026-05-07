import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import { calculateMmr } from '~/server/utils/mmr'
import { isUuid, isValidSurface, isValidDate, VALID_SURFACES } from '~/server/utils/validate'

const VALID_STATUSES    = ['scheduled', 'live', 'completed'] as const
const VALID_MATCH_TYPES = ['singles', 'doubles'] as const
const VALID_ROUNDS      = ['group', 'quarterfinal', 'semifinal', 'final'] as const
type MatchStatus = (typeof VALID_STATUSES)[number]
type MatchType   = (typeof VALID_MATCH_TYPES)[number]

export default defineEventHandler(async (event) => {
  // ── 1. Auth guard ──────────────────────────────────────────────────────────
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const admin = serverSupabaseServiceRole(event)
  const { data: adminRow } = await admin
    .from('admins').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!adminRow) throw createError({ statusCode: 403, statusMessage: 'Forbidden' })

  // ── 2. Parse & validate body ───────────────────────────────────────────────
  const body = await readBody(event)
  const {
    match_type = 'singles',
    player1_id, player2_id, player3_id, player4_id,
    date, surface, tournament, round,
    status = 'scheduled',
    winner_id, score,
    stream_url, challonge_match_id, challonge_tournament,
  } = body ?? {}

  if (!VALID_MATCH_TYPES.includes(match_type)) {
    throw createError({ statusCode: 400, statusMessage: 'match_type must be singles or doubles' })
  }
  if (!isUuid(player1_id)) throw createError({ statusCode: 400, statusMessage: 'Invalid player1_id' })
  if (!isUuid(player2_id)) throw createError({ statusCode: 400, statusMessage: 'Invalid player2_id' })
  if (!isValidDate(date))  throw createError({ statusCode: 400, statusMessage: 'Invalid date — expected YYYY-MM-DD' })
  if (!isValidSurface(surface)) {
    throw createError({ statusCode: 400, statusMessage: `surface must be one of: ${VALID_SURFACES.join(', ')}` })
  }
  if (!VALID_STATUSES.includes(status)) {
    throw createError({ statusCode: 400, statusMessage: 'status must be scheduled, live, or completed' })
  }
  if (round !== undefined && round !== null && !VALID_ROUNDS.includes(round)) {
    throw createError({ statusCode: 400, statusMessage: `round must be one of: ${VALID_ROUNDS.join(', ')}` })
  }
  if (stream_url && typeof stream_url === 'string') {
    try { new URL(stream_url) } catch {
      throw createError({ statusCode: 400, statusMessage: 'stream_url must be a valid URL' })
    }
  }

  const isDoubles  = match_type === 'doubles'
  const completing = status === 'completed'

  if (isDoubles) {
    if (!isUuid(player3_id)) throw createError({ statusCode: 400, statusMessage: 'player3_id required for doubles' })
    if (!isUuid(player4_id)) throw createError({ statusCode: 400, statusMessage: 'player4_id required for doubles' })
    if (new Set([player1_id, player2_id, player3_id, player4_id]).size !== 4) {
      throw createError({ statusCode: 400, statusMessage: 'All 4 players must be different' })
    }
  } else {
    if (player1_id === player2_id) throw createError({ statusCode: 400, statusMessage: 'Players must differ' })
  }

  if (completing) {
    if (!isUuid(winner_id)) throw createError({ statusCode: 400, statusMessage: 'winner_id required when completing a match' })
    if (winner_id !== player1_id && winner_id !== player2_id) {
      throw createError({ statusCode: 400, statusMessage: 'winner_id must be player1_id or player2_id' })
    }
    if (typeof score !== 'string' || !score.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'score is required when completing a match' })
    }
  }

  const loser_id = completing
    ? (winner_id === player1_id ? player2_id : player1_id)
    : null

  // ── 3. Verify all players exist ────────────────────────────────────────────
  const allPlayerIds = isDoubles
    ? [player1_id, player2_id, player3_id, player4_id]
    : [player1_id, player2_id]

  const { data: players } = await admin
    .from('players').select('id, mmr, wins, losses').in('id', allPlayerIds)

  if (!players || players.length !== allPlayerIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'One or more players not found' })
  }

  // ── 4. Insert match ────────────────────────────────────────────────────────
  const { data: match, error: matchError } = await admin
    .from('matches')
    .insert({
      match_type:           match_type as MatchType,
      player1_id,
      player2_id,
      player3_id:           isDoubles ? player3_id : null,
      player4_id:           isDoubles ? player4_id : null,
      winner_id:            completing ? winner_id : null,
      loser_id:             completing ? loser_id  : null,
      date,
      score:                completing ? score.trim() : null,
      surface,
      tournament:           tournament?.trim() || null,
      round:                round || null,
      status:               status as MatchStatus,
      stream_url:           stream_url || null,
      challonge_match_id:   challonge_match_id || null,
      challonge_tournament: challonge_tournament || null,
      is_live:              status === 'live',
    })
    .select('id')
    .single()

  if (matchError || !match) {
    throw createError({ statusCode: 500, statusMessage: matchError?.message ?? 'Failed to insert match' })
  }

  // ── 5. match_players rows + MMR recalc when completed ─────────────────────
  if (completing) {
    // For doubles: p3 is partner of p1's team, p4 is partner of p2's team
    const winnerPartner = isDoubles ? (winner_id === player1_id ? player3_id : player4_id) : null
    const loserPartner  = isDoubles ? (winner_id === player1_id ? player4_id : player3_id) : null

    const matchPlayerRows = [
      { match_id: match.id, player_id: winner_id,     role: 'winner' },
      { match_id: match.id, player_id: loser_id,      role: 'loser'  },
      ...(isDoubles ? [
        { match_id: match.id, player_id: winnerPartner, role: 'winner' },
        { match_id: match.id, player_id: loserPartner,  role: 'loser'  },
      ] : []),
    ]

    await admin.from('match_players').insert(matchPlayerRows)

    const { error: recalcError } = await admin.rpc('recalculate_all_mmr')
    if (recalcError) console.error('[matches/post] recalc error:', recalcError.message)

    if (!isDoubles) {
      const winner  = players.find(p => p.id === winner_id)!
      const loser   = players.find(p => p.id === loser_id)!
      const preview = calculateMmr(
        winner.mmr, loser.mmr,
        winner.wins + winner.losses,
        loser.wins  + loser.losses,
      )
      return {
        matchId: match.id,
        status: 'completed',
        mmr: {
          winner: { before: winner.mmr, after: preview.newWinnerMmr },
          loser:  { before: loser.mmr,  after: preview.newLoserMmr  },
        },
      }
    }

    return { matchId: match.id, status: 'completed' }
  }

  return { matchId: match.id, status }
})
