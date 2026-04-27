<script setup lang="ts">
// Receives the PKCE code from Supabase magic link.
// The @nuxtjs/supabase plugin exchanges it for a session automatically.
// Once the user ref is populated, forward to /admin.
definePageMeta({ layout: false })

const user = useSupabaseUser()

watchEffect(() => {
  if (user.value) navigateTo('/admin', { replace: true })
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-950">
    <p class="text-slate-400 text-sm">Signing in…</p>
  </div>
</template>