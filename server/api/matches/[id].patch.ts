import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import { isUuid, isValidSurface, isValidDate, UUID_RE, VALID_SURFACES } from '~/server/utils/validate'

const VALID_STATUSES = ['scheduled', 'live', 'completed'] as const

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
    player1_id, player2_id,
    winner_id, score,
    date, surface, tournament,
    status,
    challonge_match_id, challonge_tournament,
  } = body ?? {}

  if (player1_id !== undefined && !isUuid(player1_id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid player1_id' })
  }
  if (player2_id !== undefined && !isUuid(player2_id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid player2_id' })
  }
  if (date      !== undefined && !isValidDate(date)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid date — expected YYYY-MM-DD' })
  }
  if (surface   !== undefined && !isValidSurface(surface)) {
    throw createError({ statusCode: 400, statusMessage: `surface must be one of: ${VALID_SURFACES.join(', ')}` })
  }
  if (status    !== undefined && !VALID_STATUSES.includes(status)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid status' })
  }
  if (winner_id !== undefined && winner_id !== null && !isUuid(winner_id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid winner_id' })
  }

  // ── 4. Fetch existing match ────────────────────────────────────────────────
  const { data: existing } = await admin
    .from('matches')
    .select('id, player1_id, player2_id, winner_id, loser_id, status')
    .eq('id', id)
    .maybeSingle()

  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Match not found' })

  // ── 5. Resolve winner/loser ────────────────────────────────────────────────
  const resolvedPlayer1 = player1_id ?? existing.player1_id
  const resolvedPlayer2 = player2_id ?? existing.player2_id
  const resolvedWinner  = winner_id  ?? existing.winner_id
  const resolvedStatus  = status     ?? existing.status

  let resolvedLoser: string | null = existing.loser_id

  if (resolvedWinner && resolvedPlayer1 && resolvedPlayer2) {
    if (resolvedWinner !== resolvedPlayer1 && resolvedWinner !== resolvedPlayer2) {
      throw createError({ statusCode: 400, statusMessage: 'winner_id must be one of the two players' })
    }
    resolvedLoser = resolvedWinner === resolvedPlayer1 ? resolvedPlayer2 : resolvedPlayer1
  }

  const completing = resolvedStatus === 'completed' && !!resolvedWinner

  if (completing && (score !== undefined) && (typeof score !== 'string' || !score.trim())) {
    throw createError({ statusCode: 400, statusMessage: 'score is required when completing a match' })
  }

  // ── 6. Build patch object ──────────────────────────────────────────────────
  const patch: Record<string, unknown> = {}
  if (player1_id          !== undefined) patch.player1_id          = player1_id
  if (player2_id          !== undefined) patch.player2_id          = player2_id
  if (date                !== undefined) patch.date                = date
  if (surface             !== undefined) patch.surface             = surface
  if (tournament          !== undefined) patch.tournament          = tournament?.trim() || null
  if (challonge_match_id  !== undefined) patch.challonge_match_id  = challonge_match_id || null
  if (challonge_tournament !== undefined) patch.challonge_tournament = challonge_tournament || null
  if (winner_id           !== undefined) patch.winner_id           = resolvedWinner
  if (winner_id           !== undefined) patch.loser_id            = resolvedLoser
  if (score               !== undefined) patch.score               = typeof score === 'string' ? score.trim() : null
  if (status              !== undefined) {
    patch.status  = resolvedStatus
    patch.is_live = resolvedStatus === 'live'
  }

  if (Object.keys(patch).length === 0) {
    return { matchId: id }
  }

  const { error: matchError } = await admin.from('matches').update(patch).eq('id', id)
  if (matchError) throw createError({ statusCode: 500, statusMessage: matchError.message })

  // ── 7. Rebuild match_players + recalc when completing ─────────────────────
  if (completing && resolvedWinner && resolvedLoser) {
    await admin.from('match_players').delete().eq('match_id', id)
    await admin.from('match_players').insert([
      { match_id: id, player_id: resolvedWinner, role: 'winner' },
      { match_id: id, player_id: resolvedLoser,  role: 'loser'  },
    ])

    const { error: recalcError } = await admin.rpc('recalculate_all_mmr')
    if (recalcError) console.error('[matches/patch] recalc error:', recalcError.message)
  }

  return { matchId: id }
})
