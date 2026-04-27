import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  if (!UUID_RE.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid player ID' })

  // ── 3. Parse & validate body ───────────────────────────────────────────────
  const body = await readBody(event)
  const { name, avatar_url } = body ?? {}

  const patch: Record<string, unknown> = {}

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim() === '') {
      throw createError({ statusCode: 400, statusMessage: 'name must be a non-empty string' })
    }
    if (name.trim().length > 100) {
      throw createError({ statusCode: 400, statusMessage: 'name must be 100 characters or fewer' })
    }
    patch.name = name.trim()
  }

  if (avatar_url !== undefined) {
    if (avatar_url === null || avatar_url === '') {
      patch.avatar_url = null
    } else {
      if (typeof avatar_url !== 'string') {
        throw createError({ statusCode: 400, statusMessage: 'avatar_url must be a string or null' })
      }
      try {
        const url = new URL(avatar_url)
        if (url.protocol !== 'https:') throw new Error('not https')
      } catch {
        throw createError({ statusCode: 400, statusMessage: 'avatar_url must be a valid https URL' })
      }
      patch.avatar_url = avatar_url
    }
  }

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' })
  }

  // ── 4. Apply update ────────────────────────────────────────────────────────
  const { data: player, error } = await admin
    .from('players')
    .update(patch)
    .eq('id', id)
    .select('id, name, avatar_url')
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  if (!player) throw createError({ statusCode: 404, statusMessage: 'Player not found' })

  return player
})
