import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import { UUID_RE } from '~/server/utils/validate'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const admin = serverSupabaseServiceRole(event)

  const { data: adminRow } = await admin
    .from('admins').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!adminRow) throw createError({ statusCode: 403, statusMessage: 'Forbidden' })

  const id = getRouterParam(event, 'id') ?? ''
  if (!UUID_RE.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid match ID' })

  const { data: match } = await admin
    .from('matches').select('id, status').eq('id', id).maybeSingle()
  if (!match) throw createError({ statusCode: 404, statusMessage: 'Match not found' })

  // Refuse to delete completed matches — doing so would silently alter MMR history.
  if (match.status === 'completed') {
    throw createError({ statusCode: 409, statusMessage: 'Completed matches cannot be deleted. Change the result instead.' })
  }

  const { error } = await admin.from('matches').delete().eq('id', id)
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return { matchId: id }
})
