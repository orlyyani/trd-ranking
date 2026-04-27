// Protects all /admin/** routes.
// Apply to a page with: definePageMeta({ middleware: 'admin' })
export default defineNuxtRouteMiddleware(async () => {
  const user = useSupabaseUser()
  const supabase = useSupabaseClient()

  // Not logged in
  if (!user.value) {
    return navigateTo('/login')
  }

  // Check the admins table
  const { data } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', user.value.id)
    .maybeSingle()

  if (!data) {
    // Authenticated but not an admin — send home
    return navigateTo('/')
  }
})