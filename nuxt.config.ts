// https://nuxt.com/docs/api/configuration/nuxt-config
const siteUrl  = process.env.NUXT_PUBLIC_SITE_URL ?? 'https://trd-ranking.vercel.app'
const siteName = 'TRD Ranking'
const siteDesc = 'Tennis player rankings, match history, head-to-head records and live scores for The Rally District.'
const ogImage  = `${siteUrl}/images/logo-white.png`

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',

  devtools: { enabled: process.env.NODE_ENV !== 'production' },

  app: {
    head: {
      titleTemplate: `%s — ${siteName}`,
      title: siteName,
      htmlAttrs: { lang: 'en' },
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
      ],
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#0f172a' },
        { name: 'description', content: siteDesc },
        // Open Graph
        { property: 'og:site_name', content: siteName },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: siteName },
        { property: 'og:description', content: siteDesc },
        { property: 'og:image', content: ogImage },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:url', content: siteUrl },
        // Twitter / X
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: siteName },
        { name: 'twitter:description', content: siteDesc },
        { name: 'twitter:image', content: ogImage },
      ],
    },
  },

  modules: [
    '@nuxtjs/supabase',
    '@nuxt/image',
  ],

  // @nuxt/image — allow Cloudinary URLs and use Cloudinary's own pipeline
  // for automatic resizing/optimisation when a cloud name is provided.
  image: {
    // Allow <NuxtImg> to load images from Cloudinary's CDN domain.
    domains: ['res.cloudinary.com'],
    // Cloudinary provider: when cloudinaryCloudName is set, NuxtImg will
    // use Cloudinary's transformation API instead of the local IPX proxy,
    // giving you on-the-fly resizing, format negotiation (WebP/AVIF), etc.
    cloudinary: {
      baseURL: process.env.CLOUDINARY_CLOUD_NAME
        ? `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/`
        : undefined,
    },
  },

  css: ['~/assets/css/main.css'],

  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },

  // Supabase module config
  // redirect: false prevents @nuxtjs/supabase from auto-redirecting
  // public pages to /login — we manage auth redirects manually
  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
    redirect: false,
  },

  // Route-level caching via Nitro
  routeRules: {
    // Leaderboard: revalidate every 60 seconds
    '/': { isr: 60 },
    // Player profiles: revalidate every 5 minutes
    '/players/**': { isr: 300 },
    // Match detail: immutable after entry, cache for 1 hour
    '/matches/**': { cache: { maxAge: 3600 } },
    // Admin pages: never cache, always dynamic
    '/admin/**': { ssr: false },
  },

  runtimeConfig: {
    // Server-only — never exposed to the client bundle
    supabaseServiceKey: '',
    challongeApiKey: process.env.CHALLONGE_API_KEY ?? '',
    // Plural (new): "Class C:53yr35ik,Beginners:abc456" — takes priority
    challongeTournamentUrls: process.env.CHALLONGE_TOURNAMENT_URLS ?? '',
    // Singular (legacy): kept for backwards compatibility
    challongeTournamentUrl: process.env.CHALLONGE_TOURNAMENT_URL ?? '',
    public: {
      // These are also set via NUXT_PUBLIC_* env vars automatically
      supabaseUrl: '',
      supabaseAnonKey: '',
      siteUrl,
      // Cloudinary — browser-direct upload (unsigned preset), safe to expose
      cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
      cloudinaryUploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET ?? '',
    },
  },
})
