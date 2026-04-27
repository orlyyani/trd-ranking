import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import { calculateElo } from '~/server/utils/elo'
import { isUuid, isValidSurface, isValidDate, VALID_SURFACES } from '~/server/utils/validate'

export default defineEventHandler(async (event) => {
  // ── 1. Auth guard: only admins may create matches ──────────────────────────
  const user = await serverSupabaseUser(event)

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  // Service-role client for admin DB access (bypasses RLS).
  const admin = serverSupabaseServiceRole(event)

  // Check admins table.
  const { data: adminRow } = await admin
    .from('admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!adminRow) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  // ── 2. Parse & validate body ───────────────────────────────────────────────
  const body = await readBody(event)

  const { winner_id, loser_id, date, score, surface, tournament } = body ?? {}

  if (!isUuid(winner_id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid winner_id — must be a UUID' })
  }
  if (!isUuid(loser_id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid loser_id — must be a UUID' })
  }
  if (winner_id === loser_id) {
    throw createError({ statusCode: 400, statusMessage: 'winner_id and loser_id must differ' })
  }
  if (!isValidDate(date)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid date — expected YYYY-MM-DD' })
  }
  if (typeof score !== 'string' || score.trim() === '') {
    throw createError({ statusCode: 400, statusMessage: 'score is required' })
  }
  if (!isValidSurface(surface)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid surface — must be one of: ${VALID_SURFACES.join(', ')}`,
    })
  }
  if (tournament !== undefined && tournament !== null && typeof tournament !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'tournament must be a string or omitted' })
  }

  // ── 3. Verify both players exist ───────────────────────────────────────────
  const { data: players, error: playerError } = await admin
    .from('players')
    .select('id, elo')
    .in('id', [winner_id, loser_id])

  if (playerError) {
    throw createError({ statusCode: 500, statusMessage: 'DB error fetching players' })
  }
  if (!players || players.length !== 2) {
    throw createError({ statusCode: 400, statusMessage: 'One or both player IDs not found' })
  }

  const winner = players.find(p => p.id === winner_id)!
  const loser  = players.find(p => p.id === loser_id)!

  // ── 4. Insert the match ────────────────────────────────────────────────────
  const { data: match, error: matchError } = await admin
    .from('matches')
    .insert({
      winner_id,
      loser_id,
      date,
      score: score.trim(),
      surface,
      tournament: tournament?.trim() || null,
    })
    .select('id')
    .single()

  if (matchError || !match) {
    throw createError({ statusCode: 500, statusMessage: matchError?.message ?? 'Failed to insert match' })
  }

  // ── 5. Insert match_players rows ───────────────────────────────────────────
  const { error: mpError } = await admin.from('match_players').insert([
    { match_id: match.id, player_id: winner_id, role: 'winner' },
    { match_id: match.id, player_id: loser_id,  role: 'loser'  },
  ])

  if (mpError) {
    console.error('[matches/post] match_players insert error:', mpError.message)
  }

  // ── 6. Run incremental ELO update (fast path) ─────────────────────────────
  const { newWinnerElo, newLoserElo } = calculateElo(winner.elo, loser.elo)

  const { error: recalcError } = await admin.rpc('recalculate_all_elo')

  if (recalcError) {
    console.error('[matches/post] recalculate_all_elo error:', recalcError.message)
  }

  return {
    matchId: match.id,
    elo: {
      winner: { before: winner.elo, after: newWinnerElo },
      loser:  { before: loser.elo,  after: newLoserElo  },
    },
  }
})