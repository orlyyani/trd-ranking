import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import { calculateMmr, TIER_STARTING_MMR } from '~/server/utils/mmr'
import { isUuid, isValidSurface, isValidDate, VALID_SURFACES } from '~/server/utils/validate'

const VALID_STATUSES = ['scheduled', 'live', 'completed'] as const
type MatchStatus = (typeof VALID_STATUSES)[number]

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
    player1_id, player2_id,
    date, surface, tournament,
    status = 'scheduled',
    winner_id,
    score,
    stream_url,
    challonge_match_id,
    challonge_tournament,
  } = body ?? {}

  if (!isUuid(player1_id)) throw createError({ statusCode: 400, statusMessage: 'Invalid player1_id' })
  if (!isUuid(player2_id)) throw createError({ statusCode: 400, statusMessage: 'Invalid player2_id' })
  if (player1_id === player2_id) throw createError({ statusCode: 400, statusMessage: 'Players must differ' })
  if (!isValidDate(date))  throw createError({ statusCode: 400, statusMessage: 'Invalid date — expected YYYY-MM-DD' })
  if (!isValidSurface(surface)) {
    throw createError({ statusCode: 400, statusMessage: `surface must be one of: ${VALID_SURFACES.join(', ')}` })
  }
  if (!VALID_STATUSES.includes(status)) {
    throw createError({ statusCode: 400, statusMessage: 'status must be scheduled, live, or completed' })
  }
  if (tournament !== undefined && tournament !== null && typeof tournament !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'tournament must be a string or omitted' })
  }
  if (stream_url && typeof stream_url === 'string') {
    try { new URL(stream_url) } catch {
      throw createError({ statusCode: 400, statusMessage: 'stream_url must be a valid URL' })
    }
  }

  const completing = status === 'completed'

  if (completing) {
    if (!isUuid(winner_id)) throw createError({ statusCode: 400, statusMessage: 'winner_id required when completing a match' })
    if (winner_id !== player1_id && winner_id !== player2_id) {
      throw createError({ statusCode: 400, statusMessage: 'winner_id must be one of the two players' })
    }
    if (typeof score !== 'string' || !score.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'score is required when completing a match' })
    }
  }

  const loser_id = completing
    ? (winner_id === player1_id ? player2_id : player1_id)
    : null

  // ── 3. Verify both players exist ───────────────────────────────────────────
  const { data: players } = await admin
    .from('players').select('id, mmr, wins, losses').in('id', [player1_id, player2_id])

  if (!players || players.length !== 2) {
    throw createError({ statusCode: 400, statusMessage: 'One or both players not found' })
  }

  // ── 4. Insert match ────────────────────────────────────────────────────────
  const { data: match, error: matchError } = await admin
    .from('matches')
    .insert({
      player1_id,
      player2_id,
      winner_id:             completing ? winner_id : null,
      loser_id:              completing ? loser_id  : null,
      date,
      score:                 completing ? score.trim() : null,
      surface,
      tournament:            tournament?.trim() || null,
      status:                status as MatchStatus,
      stream_url:            stream_url || null,
      challonge_match_id:    challonge_match_id || null,
      challonge_tournament:  challonge_tournament || null,
      is_live:               status === 'live',
    })
    .select('id')
    .single()

  if (matchError || !match) {
    throw createError({ statusCode: 500, statusMessage: matchError?.message ?? 'Failed to insert match' })
  }

  // ── 5. Insert match_players + run MMR recalc only when completed ───────────
  if (completing) {
    await admin.from('match_players').insert([
      { match_id: match.id, player_id: winner_id, role: 'winner' },
      { match_id: match.id, player_id: loser_id,  role: 'loser'  },
    ])

    const winner = players.find(p => p.id === winner_id)!
    const loser  = players.find(p => p.id === loser_id)!

    const preview = calculateMmr(
      winner.mmr, loser.mmr,
      winner.wins + winner.losses,
      loser.wins  + loser.losses,
    )

    const { error: recalcError } = await admin.rpc('recalculate_all_mmr')
    if (recalcError) console.error('[matches/post] recalc error:', recalcError.message)

    return {
      matchId: match.id,
      status: 'completed',
      mmr: {
        winner: { before: winner.mmr, after: preview.newWinnerMmr },
        loser:  { before: loser.mmr,  after: preview.newLoserMmr  },
      },
    }
  }

  return { matchId: match.id, status }
})
