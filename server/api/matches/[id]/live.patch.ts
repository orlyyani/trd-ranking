import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import { UUID_RE } from '~/server/utils/validate'

export default defineEventHandler(async (event) => {
  // ── 1. Auth guard ──────────────────────────────────────────────────────────
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const admin = serverSupabaseServiceRole(event)

  const { data: adminRow } = await admin.from('admins').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!adminRow) throw createError({ statusCode: 403, statusMessage: 'Forbidden' })

  // ── 2. Validate route param ────────────────────────────────────────────────
  const id = getRouterParam(event, 'id') ?? ''
  if (!UUID_RE.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid match ID' })

  // ── 3. Parse & validate body ───────────────────────────────────────────────
  const body = await readBody(event)
  const { stream_url, is_live, live_score, status } = body ?? {}

  if (stream_url !== undefined && stream_url !== null) {
    if (typeof stream_url !== 'string') {
      throw createError({ statusCode: 400, statusMessage: 'stream_url must be a string or null' })
    }
    try { new URL(stream_url) } catch {
      throw createError({ statusCode: 400, statusMessage: 'stream_url must be a valid URL' })
    }
  }
  if (is_live !== undefined && typeof is_live !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'is_live must be a boolean' })
  }
  if (live_score !== undefined && live_score !== null && typeof live_score !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'live_score must be a string or null' })
  }
  if (status !== undefined && !['scheduled', 'live', 'completed'].includes(status)) {
    throw createError({ statusCode: 400, statusMessage: 'status must be scheduled, live, or completed' })
  }

  // ── 4. Verify match exists ─────────────────────────────────────────────────
  const { data: existing } = await admin.from('matches').select('id').eq('id', id).maybeSingle()
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Match not found' })

  // ── 5. Build patch object ──────────────────────────────────────────────────
  const patch: Record<string, unknown> = {}
  if (stream_url !== undefined) patch.stream_url = stream_url
  if (is_live    !== undefined) patch.is_live     = is_live
  if (live_score !== undefined) patch.live_score  = live_score
  if (status     !== undefined) {
    patch.status  = status
    // Keep is_live in sync with status when not explicitly set
    if (is_live === undefined) patch.is_live = status === 'live'
  }

  const { error } = await admin.from('matches').update(patch).eq('id', id)
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return { matchId: id, ...patch }
})
