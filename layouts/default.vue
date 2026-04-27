<script setup lang="ts">
const mobileMenuOpen = ref(false)
const route = useRoute()
watch(() => route.path, () => { mobileMenuOpen.value = false })
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
            <NuxtLink to="/h2h" class="nav-link" active-class="nav-link--active">
              Head-to-Head
            </NuxtLink>
          </li>
          <li>
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
              <NuxtLink to="/h2h" class="mobile-nav-link" active-class="mobile-nav-link--active" @click="mobileMenuOpen = false">
                Head-to-Head
              </NuxtLink>
            </li>
            <li>
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
      <div class="container-page flex items-center justify-between h-12 text-xs text-slate-500">
        <span>TRD Ranking</span>
        <span>Powered by Supabase &amp; Nuxt</span>
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
