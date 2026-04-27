import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'

// Starting ELO for every new player.
const INITIAL_ELO = 1000

export default defineEventHandler(async (event) => {
  // ── 1. Auth guard: only admins may create players ──────────────────────────
  const user = await serverSupabaseUser(event)

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  // Service-role client for admin DB access (bypasses RLS).
  const admin = serverSupabaseServiceRole(event)

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
  const { name, avatar_url } = body ?? {}

  if (typeof name !== 'string' || name.trim() === '') {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }
  if (name.trim().length > 100) {
    throw createError({ statusCode: 400, statusMessage: 'name must be 100 characters or fewer' })
  }

  if (avatar_url !== undefined && avatar_url !== null) {
    if (typeof avatar_url !== 'string') {
      throw createError({ statusCode: 400, statusMessage: 'avatar_url must be a string' })
    }
    try {
      const url = new URL(avatar_url)
      if (url.protocol !== 'https:') {
        throw new Error('not https')
      }
    } catch {
      throw createError({ statusCode: 400, statusMessage: 'avatar_url must be a valid https URL' })
    }
  }

  // ── 3. Insert the player ───────────────────────────────────────────────────
  const { data: player, error: insertError } = await admin
    .from('players')
    .insert({
      name: name.trim(),
      avatar_url: avatar_url ?? null,
      elo: INITIAL_ELO,
      wins: 0,
      losses: 0,
    })
    .select('id, name, elo')
    .single()

  if (insertError || !player) {
    throw createError({
      statusCode: 500,
      statusMessage: insertError?.message ?? 'Failed to insert player',
    })
  }

  return { id: player.id, name: player.name, elo: player.elo }
})