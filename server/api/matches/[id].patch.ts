import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import { isUuid, isValidSurface, isValidDate, UUID_RE, VALID_SURFACES } from '~/server/utils/validate'

export default defineEventHandler(async (event) => {
  // ── 1. Auth guard ──────────────────────────────────────────────────────────
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const admin = serverSupabaseServiceRole(event)

  const { data: adminRow } = await admin
    .from('admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!adminRow) throw createError({ statusCode: 403, statusMessage: 'Forbidden' })

  // ── 2. Validate route param ────────────────────────────────────────────────
  const id = getRouterParam(event, 'id') ?? ''
  if (!UUID_RE.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid match ID' })

  // ── 3. Parse & validate body ───────────────────────────────────────────────
  const body = await readBody(event)
  const { winner_id, loser_id, date, score, surface, tournament } = body ?? {}

  if (!isUuid(winner_id)) throw createError({ statusCode: 400, statusMessage: 'Invalid winner_id' })
  if (!isUuid(loser_id))  throw createError({ statusCode: 400, statusMessage: 'Invalid loser_id' })
  if (winner_id === loser_id) throw createError({ statusCode: 400, statusMessage: 'winner_id and loser_id must differ' })
  if (!isValidDate(date)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid date — expected YYYY-MM-DD' })
  }
  if (typeof score !== 'string' || score.trim() === '') {
    throw createError({ statusCode: 400, statusMessage: 'score is required' })
  }
  if (!isValidSurface(surface)) {
    throw createError({ statusCode: 400, statusMessage: `Invalid surface — must be one of: ${VALID_SURFACES.join(', ')}` })
  }
  if (tournament !== undefined && tournament !== null && typeof tournament !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'tournament must be a string or omitted' })
  }

  // ── 4. Verify match exists ─────────────────────────────────────────────────
  const { data: existing } = await admin
    .from('matches')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Match not found' })

  // ── 5. Update match row ────────────────────────────────────────────────────
  const { error: matchError } = await admin
    .from('matches')
    .update({
      winner_id,
      loser_id,
      date,
      score: score.trim(),
      surface,
      tournament: tournament?.trim() || null,
    })
    .eq('id', id)

  if (matchError) throw createError({ statusCode: 500, statusMessage: matchError.message })

  // ── 6. Rebuild match_players rows ──────────────────────────────────────────
  await admin.from('match_players').delete().eq('match_id', id)
  await admin.from('match_players').insert([
    { match_id: id, player_id: winner_id, role: 'winner' },
    { match_id: id, player_id: loser_id,  role: 'loser'  },
  ])

  // ── 7. Full ELO recalculation (idempotent) ─────────────────────────────────
  const { error: recalcError } = await admin.rpc('recalculate_all_elo')
  if (recalcError) {
    console.error('[matches/patch] recalculate_all_elo error:', recalcError.message)
  }

  return { matchId: id }
})
