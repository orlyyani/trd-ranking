<script setup lang="ts">
definePageMeta({ layout: 'default' })
useHead({ title: 'Login' })

const supabase = useSupabaseClient()
const user = useSupabaseUser()

// Already logged in — go home
if (user.value) navigateTo('/')

const email = ref('')
const loading = ref(false)
const sent = ref(false)
const error = ref('')

async function signIn() {
  error.value = ''
  loading.value = true

  const { error: authError } = await supabase.auth.signInWithOtp({
    email: email.value,
    options: { emailRedirectTo: `${useRequestURL().origin}/auth/confirm` },
  })

  loading.value = false

  if (authError) {
    error.value = authError.message
  } else {
    sent.value = true
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <div class="card w-full max-w-sm space-y-6">
      <div>
        <h1 class="text-xl font-semibold text-white">Admin sign in</h1>
        <p class="mt-1 text-sm text-slate-400">
          We'll send a magic link to your email.
        </p>
      </div>

      <!-- Sent confirmation -->
      <div v-if="sent" class="rounded-lg bg-brand-900/40 border border-brand-700 px-4 py-3 text-sm text-brand-300">
        Check your inbox — a sign-in link has been sent to <strong>{{ email }}</strong>.
      </div>

      <!-- Form -->
      <form v-else class="space-y-4" @submit.prevent="signIn">
        <div>
          <label for="email" class="block text-sm font-medium text-slate-300 mb-1">
            Email
          </label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            autocomplete="email"
            placeholder="you@example.com"
            class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div v-if="error" class="text-sm text-red-400">{{ error }}</div>

        <button
          type="submit"
          :disabled="loading"
          class="w-full rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          {{ loading ? 'Sending…' : 'Send magic link' }}
        </button>
      </form>
    </div>
  </div>
</template>