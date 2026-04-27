// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',

  devtools: { enabled: process.env.NODE_ENV !== 'production' },

  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
      ],
      meta: [
        { name: 'theme-color', content: '#0f172a' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
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
    public: {
      // These are also set via NUXT_PUBLIC_* env vars automatically
      supabaseUrl: '',
      supabaseAnonKey: '',
      // Cloudinary — browser-direct upload (unsigned preset), safe to expose
      cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
      cloudinaryUploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET ?? '',
    },
  },
})
