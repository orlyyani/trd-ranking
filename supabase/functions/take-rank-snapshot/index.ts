// Edge Function: take-rank-snapshot
//
// Triggers the take_rank_snapshot() DB function on demand.
// Useful for:
//   - Manual runs from the Supabase dashboard
//   - HTTP-triggered cron jobs (e.g. cron-job.org, GitHub Actions)
//   - Testing locally with: supabase functions invoke take-rank-snapshot
//
// Auth: requires the service role key as Bearer token, or runs via the
// Supabase cron scheduler which injects it automatically.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  // Verify caller — must present the service role key.
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const authHeader = req.headers.get('Authorization') ?? ''

  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    serviceKey,
  )

  const { error } = await supabase.rpc('take_rank_snapshot')

  if (error) {
    console.error('[take-rank-snapshot] rpc error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const date = new Date().toISOString().split('T')[0]
  console.log(`[take-rank-snapshot] snapshot taken for ${date}`)

  return new Response(JSON.stringify({ ok: true, date }), {
    headers: { 'Content-Type': 'application/json' },
  })
})