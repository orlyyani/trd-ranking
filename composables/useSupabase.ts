import type { Database } from '~/types/database.types'

/**
 * Typed Supabase client wrapper.
 *
 * The @nuxtjs/supabase module provides `useSupabaseClient()` globally.
 * This thin wrapper locks the generic so every call-site gets the full
 * Database type without repeating the import.
 *
 * Usage:
 *   const supabase = useSupabase()
 *   const { data } = await supabase.from('players').select('*')
 */
export const useSupabase = () => useSupabaseClient<Database>()
