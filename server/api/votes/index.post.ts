import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

export default defineEventHandler(async (event) => {
  // ── 1. Auth check — any signed-in user may vote ────────────────────────────
  const user = await serverSupabaseUser(event)

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in to vote' })
  }

  // ── 2. Parse & validate body ───────────────────────────────────────────────
  const body = await readBody(event)
  const { match_id, nominee_id } = body ?? {}

  if (!isUuid(match_id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid match_id' })
  }
  if (!isUuid(nominee_id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid nominee_id' })
  }

  const admin = serverSupabaseServiceRole(event)

  // ── 3. Verify match exists and nominee is a participant ────────────────────
  const { data: match } = await admin
    .from('matches')
    .select('winner_id, loser_id')
    .eq('id', match_id)
    .maybeSingle()

  if (!match) {
    throw createError({ statusCode: 404, statusMessage: 'Match not found' })
  }

  if (nominee_id !== match.winner_id && nominee_id !== match.loser_id) {
    throw createError({ statusCode: 400, statusMessage: 'Nominee must be a participant in the match' })
  }

  // ── 4. Insert vote — service role but voter_id is explicitly the auth user ─
  // Using service role so we can return a clean 409 on duplicate rather than
  // relying on the RLS policy error message.
  const { error: insertError } = await admin
    .from('mvp_votes')
    .insert({
      match_id,
      voter_id: user.id,
      nominee_id,
    })

  if (insertError) {
    // 23505 = unique_violation — primary key (match_id, voter_id) already exists
    if (insertError.code === '23505') {
      throw createError({ statusCode: 409, statusMessage: 'You have already voted for this match' })
    }
    throw createError({ statusCode: 500, statusMessage: insertError.message })
  }

  return { ok: true }
})