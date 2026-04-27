<template>
  <div class="min-h-screen flex flex-col bg-surface text-slate-100">
    <!-- Nav bar -->
    <header class="sticky top-0 z-30 border-b border-surface-border bg-surface/90 backdrop-blur-sm">
      <nav class="container-page flex items-center justify-between h-14">
        <!-- Logo / home link -->
        <NuxtLink
          to="/"
          class="flex items-center gap-2 font-semibold text-white hover:text-brand-400 transition-colors"
        >
          <svg
            class="w-5 h-5 text-brand-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <!-- Tennis ball icon approximation -->
            <circle cx="12" cy="12" r="10" />
            <path d="M6.3 6.3a9 9 0 0 1 11.4 0" />
            <path d="M6.3 17.7a9 9 0 0 0 11.4 0" />
          </svg>
          TRD Ranking
        </NuxtLink>

        <!-- Primary nav links -->
        <ul class="flex items-center gap-1 text-sm font-medium">
          <li>
            <NuxtLink
              to="/"
              class="nav-link"
              active-class="nav-link--active"
              exact
            >
              Leaderboard
            </NuxtLink>
          </li>
          <li>
            <NuxtLink
              to="/h2h"
              class="nav-link"
              active-class="nav-link--active"
            >
              Head-to-Head
            </NuxtLink>
          </li>
          <li>
            <NuxtLink
              to="/admin"
              class="nav-link"
              active-class="nav-link--active"
            >
              Admin
            </NuxtLink>
          </li>
        </ul>
      </nav>
    </header>

    <!-- Page content -->
    <main class="flex-1 container-page py-8">
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
</style>
