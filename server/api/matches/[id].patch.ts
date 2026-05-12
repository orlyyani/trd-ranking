import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import { isUuid, isValidSurface, isValidDate, UUID_RE, VALID_SURFACES } from '~/server/utils/validate'

const VALID_STATUSES = ['scheduled', 'live', 'completed'] as const
const VALID_ROUNDS   = ['group', 'quarterfinal', 'semifinal', 'final'] as const

export default defineEventHandler(async (event) => {
  // ── 1. Auth guard ──────────────────────────────────────────────────────────
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const admin = serverSupabaseServiceRole(event)

  const { data: adminRow } = await admin
    .from('admins').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!adminRow) throw createError({ statusCode: 403, statusMessage: 'Forbidden' })

  // ── 2. Validate route param ────────────────────────────────────────────────
  const id = getRouterParam(event, 'id') ?? ''
  if (!UUID_RE.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid match ID' })

  // ── 3. Parse body — all fields optional (partial update) ──────────────────
  const body = await readBody(event)
  const {
    player1_id, player2_id, player3_id, player4_id,
    winner_id, score,
    date, surface, tournament, round, ranked,
    stream_url,
    status,
    challonge_match_id, challonge_tournament,
  } = body ?? {}

  if (player1_id !== undefined && !isUuid(player1_id)) throw createError({ statusCode: 400, statusMessage: 'Invalid player1_id' })
  if (player2_id !== undefined && !isUuid(player2_id)) throw createError({ statusCode: 400, statusMessage: 'Invalid player2_id' })
  if (player3_id !== undefined && player3_id !== null && !isUuid(player3_id)) throw createError({ statusCode: 400, statusMessage: 'Invalid player3_id' })
  if (player4_id !== undefined && player4_id !== null && !isUuid(player4_id)) throw createError({ statusCode: 400, statusMessage: 'Invalid player4_id' })
  if (date     !== undefined && !isValidDate(date))    throw createError({ statusCode: 400, statusMessage: 'Invalid date — expected YYYY-MM-DD' })
  if (surface  !== undefined && !isValidSurface(surface)) throw createError({ statusCode: 400, statusMessage: `surface must be one of: ${VALID_SURFACES.join(', ')}` })
  if (status   !== undefined && !VALID_STATUSES.includes(status)) throw createError({ statusCode: 400, statusMessage: 'Invalid status' })
  if (winner_id !== undefined && winner_id !== null && !isUuid(winner_id)) throw createError({ statusCode: 400, statusMessage: 'Invalid winner_id' })
  if (round !== undefined && round !== null && !VALID_ROUNDS.includes(round)) throw createError({ statusCode: 400, statusMessage: `round must be one of: ${VALID_ROUNDS.join(', ')}` })

  // ── 4. Fetch existing match (includes doubles columns) ────────────────────
  const { data: existing } = await admin
    .from('matches')
    .select('id, match_type, player1_id, player2_id, player3_id, player4_id, winner_id, loser_id, status, ranked')
    .eq('id', id)
    .maybeSingle()

  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Match not found' })

  const isDoubles = existing.match_type === 'doubles'

  // ── 5. Resolve players / winner / loser ───────────────────────────────────
  const resolvedPlayer1 = player1_id ?? existing.player1_id
  const resolvedPlayer2 = player2_id ?? existing.player2_id
  const resolvedPlayer3 = player3_id !== undefined ? player3_id : existing.player3_id
  const resolvedPlayer4 = player4_id !== undefined ? player4_id : existing.player4_id
  const resolvedWinner  = winner_id  ?? existing.winner_id
  const resolvedStatus  = status     ?? existing.status

  let resolvedLoser: string | null = existing.loser_id

  if (resolvedWinner && resolvedPlayer1 && resolvedPlayer2) {
    if (resolvedWinner !== resolvedPlayer1 && resolvedWinner !== resolvedPlayer2) {
      throw createError({ statusCode: 400, statusMessage: 'winner_id must be player1_id or player2_id' })
    }
    resolvedLoser = resolvedWinner === resolvedPlayer1 ? resolvedPlayer2 : resolvedPlayer1
  }

  const completing = resolvedStatus === 'completed' && !!resolvedWinner

  if (completing && score !== undefined && (typeof score !== 'string' || !score.trim())) {
    throw createError({ statusCode: 400, statusMessage: 'score is required when completing a match' })
  }

  // ── 6. Build patch object ──────────────────────────────────────────────────
  const patch: Record<string, unknown> = {}
  if (player1_id           !== undefined) patch.player1_id           = player1_id
  if (player2_id           !== undefined) patch.player2_id           = player2_id
  if (player3_id           !== undefined) patch.player3_id           = player3_id ?? null
  if (player4_id           !== undefined) patch.player4_id           = player4_id ?? null
  if (date                 !== undefined) patch.date                 = date
  if (surface              !== undefined) patch.surface              = surface
  if (tournament           !== undefined) patch.tournament           = tournament?.trim() || null
  if (round                !== undefined) patch.round                = round || null
  if (ranked               !== undefined) patch.ranked               = ranked !== false
  if (stream_url           !== undefined) patch.stream_url           = stream_url?.trim() || null
  if (challonge_match_id   !== undefined) patch.challonge_match_id   = challonge_match_id || null
  if (challonge_tournament !== undefined) patch.challonge_tournament = challonge_tournament || null
  if (winner_id            !== undefined) patch.winner_id            = resolvedWinner
  if (winner_id            !== undefined) patch.loser_id             = resolvedLoser
  if (score                !== undefined) patch.score                = typeof score === 'string' ? score.trim() : null
  if (status               !== undefined) {
    patch.status  = resolvedStatus
    patch.is_live = resolvedStatus === 'live'
    // When setting this match live, clear stale is_live flags on all others.
    if (patch.is_live === true) {
      await admin.from('matches').update({ is_live: false }).neq('id', id).eq('is_live', true)
    }
  }

  if (Object.keys(patch).length === 0) return { matchId: id }

  const { error: matchError } = await admin.from('matches').update(patch).eq('id', id)
  if (matchError) throw createError({ statusCode: 500, statusMessage: matchError.message })

  // ── 7. Rebuild match_players + recalc when completing ─────────────────────
  if (completing && resolvedWinner && resolvedLoser) {
    await admin.from('match_players').delete().eq('match_id', id)

    const winnerPartner = isDoubles
      ? (resolvedWinner === resolvedPlayer1 ? resolvedPlayer3 : resolvedPlayer4)
      : null
    const loserPartner = isDoubles
      ? (resolvedWinner === resolvedPlayer1 ? resolvedPlayer4 : resolvedPlayer3)
      : null

    const rows = [
      { match_id: id, player_id: resolvedWinner, role: 'winner' },
      { match_id: id, player_id: resolvedLoser,  role: 'loser'  },
      ...(isDoubles && winnerPartner ? [{ match_id: id, player_id: winnerPartner, role: 'winner' }] : []),
      ...(isDoubles && loserPartner  ? [{ match_id: id, player_id: loserPartner,  role: 'loser'  }] : []),
    ]
    await admin.from('match_players').insert(rows)

    const isRanked = ranked !== undefined ? ranked !== false : (existing.ranked ?? true)
    if (isRanked) {
      const { error: recalcError } = await admin.rpc('recalculate_all_mmr')
      if (recalcError) console.error('[matches/patch] recalc error:', recalcError.message)
    }
  }

  return { matchId: id }
})
