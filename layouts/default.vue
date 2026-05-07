<script setup lang="ts">
const mobileMenuOpen = ref(false)
const route = useRoute()
watch(() => route.path, () => { mobileMenuOpen.value = false })

const user = useSupabaseUser()
const supabase = useSupabaseClient()
const isAdmin = ref(false)

watch(user, async (u) => {
  if (!u) { isAdmin.value = false; return }
  const { data } = await supabase.from('admins').select('user_id').eq('user_id', u.id).maybeSingle()
  isAdmin.value = !!data
}, { immediate: true })
</script>

<template>
  <div class="min-h-screen flex flex-col bg-surface text-slate-100">
    <!-- Nav bar -->
    <header class="sticky top-0 z-30 border-b border-surface-border bg-surface/90 backdrop-blur-sm">
      <nav class="container-page flex items-center justify-between h-14">
        <!-- Logo / home link -->
        <NuxtLink
          to="/"
          class="flex items-center gap-2 font-semibold text-white hover:text-brand-400 transition-colors shrink-0"
        >
          <img
            src="/images/logo.png"
            alt="TRD Ranking logo"
            class="h-8 w-auto"
            fetchpriority="high"
          />
          <span class="hidden sm:inline">TRD Ranking</span>
        </NuxtLink>

        <!-- Desktop nav links -->
        <ul class="hidden sm:flex items-center gap-1 text-sm font-medium">
          <li>
            <NuxtLink to="/" class="nav-link" active-class="nav-link--active" exact>
              Leaderboard
            </NuxtLink>
          </li>
          <li>
            <NuxtLink to="/matches" class="nav-link" active-class="nav-link--active">
              Matches
            </NuxtLink>
          </li>
          <li>
            <NuxtLink to="/h2h" class="nav-link" active-class="nav-link--active">
              Head-to-Head
            </NuxtLink>
          </li>
          <li>
            <NuxtLink to="/faq" class="nav-link" active-class="nav-link--active">
              FAQ
            </NuxtLink>
          </li>
          <li v-if="isAdmin">
            <NuxtLink to="/admin" class="nav-link" active-class="nav-link--active">
              Admin
            </NuxtLink>
          </li>
        </ul>

        <!-- Mobile hamburger button -->
        <button
          class="sm:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-surface-elevated transition-colors"
          :aria-expanded="mobileMenuOpen"
          aria-label="Toggle navigation menu"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <svg v-if="!mobileMenuOpen" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </nav>

      <!-- Mobile dropdown menu -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <div v-if="mobileMenuOpen" class="sm:hidden border-t border-surface-border bg-surface/95 backdrop-blur-sm">
          <ul class="container-page py-3 space-y-1 text-sm font-medium">
            <li>
              <NuxtLink to="/" class="mobile-nav-link" active-class="mobile-nav-link--active" exact @click="mobileMenuOpen = false">
                Leaderboard
              </NuxtLink>
            </li>
            <li>
              <NuxtLink to="/matches" class="mobile-nav-link" active-class="mobile-nav-link--active" @click="mobileMenuOpen = false">
                Matches
              </NuxtLink>
            </li>
            <li>
              <NuxtLink to="/h2h" class="mobile-nav-link" active-class="mobile-nav-link--active" @click="mobileMenuOpen = false">
                Head-to-Head
              </NuxtLink>
            </li>
            <li>
              <NuxtLink to="/faq" class="mobile-nav-link" active-class="mobile-nav-link--active" @click="mobileMenuOpen = false">
                FAQ
              </NuxtLink>
            </li>
            <li v-if="isAdmin">
              <NuxtLink to="/admin" class="mobile-nav-link" active-class="mobile-nav-link--active" @click="mobileMenuOpen = false">
                Admin
              </NuxtLink>
            </li>
          </ul>
        </div>
      </Transition>
    </header>

    <!-- Page content -->
    <main class="flex-1 container-page py-6 sm:py-8">
      <slot />
    </main>

    <!-- Footer -->
    <footer class="border-t border-surface-border">
      <div class="container-page flex items-center justify-between py-4 text-xs text-slate-500">
        <NuxtLink to="/" class="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity">
          <img src="/images/logo.png" alt="TRD Ranking" class="h-7 w-auto" loading="lazy" />
          <span class="hidden sm:inline font-medium text-slate-400">TRD Ranking</span>
        </NuxtLink>
        <div class="flex items-center gap-4">
          <a
            href="https://www.facebook.com/therallydistrict"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            class="text-slate-500 hover:text-white transition-colors"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987H7.9v-2.89h2.538V9.845c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
            </svg>
          </a>
          <a
            href="https://www.instagram.com/therallydistrict"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            class="text-slate-500 hover:text-white transition-colors"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path fill-rule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clip-rule="evenodd" />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.nav-link {
  @apply px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-elevated transition-colors;
}
.nav-link--active {
  @apply text-white bg-surface-elevated;
}
.mobile-nav-link {
  @apply block px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-elevated transition-colors;
}
.mobile-nav-link--active {
  @apply text-white bg-surface-elevated;
}
</style>
