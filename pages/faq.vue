<script setup lang="ts">
useHead({ title: 'FAQ — TRD Ranking' })

const faqs = [
  {
    question: 'How are rankings determined?',
    answer:
      'Rankings are based on the ELO rating system, adapted for tennis. Every match updates both players\' MMR — the winner gains points and the loser loses them. The amount gained or lost depends on the rating difference between the two players.',
  },
  {
    question: 'What are the ranking tiers?',
    answer:
      'There are five tiers: Unranked (Placement Phase) for new players still completing placements, Beginner (1000–1499), Class C (1500–1899), Class B (1900–2199), and Class A / Open (2200+).',
  },
  {
    question: 'What is the Placement Phase?',
    answer:
      'New players start in the Placement Phase (Unranked) with a provisional MMR of 1000. After playing their first 10 matches, their rating stabilises and they receive their official tier placement.',
  },
  {
    question: 'Why do I gain or lose different amounts per match?',
    answer:
      'Upsets reward more points. If a lower-rated player beats a higher-rated one, both sides see a big swing. When the favourite wins, only a small amount transfers — the result was already expected. This keeps ratings accurate over time.',
  },
  {
    question: 'What is the K-factor?',
    answer:
      'The K-factor controls how much a single match can move your rating. It is set to 40 for your first 10 matches (placement), then drops to 20 afterwards. A higher K means faster movement early on while your rating is still uncertain.',
  },
  {
    question: 'How quickly does my rating change?',
    answer:
      'During placement (first 10 matches) your rating moves faster (K=40). After that it stabilises (K=20). Over time, consistent results against similarly-rated opponents will gradually shift your ranking to its true level.',
  },
  {
    question: 'Can I drop out of my current tier?',
    answer:
      'Yes. Tiers are not locked — your rating updates after every match. If your MMR falls below your tier\'s threshold (e.g. drops below 1500 while in Class C), you move down to Beginner.',
  },
  {
    question: 'What counts as a match for ranking purposes?',
    answer:
      'Only officially recorded matches entered by an admin count toward your ranking. Casual or unrecorded games do not affect your MMR.',
  },
  {
    question: 'How does head-to-head affect my ranking?',
    answer:
      'Head-to-head records are tracked for reference but do not directly modify the ELO formula. Each match is evaluated individually based on the MMR of both players at the time it is played.',
  },
  {
    question: 'When are rankings updated?',
    answer:
      'Ratings update automatically after each match is recorded. The leaderboard reflects the latest MMR at all times.',
  },
]

const open = ref<number | null>(null)

function toggle(i: number) {
  open.value = open.value === i ? null : i
}
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-8">
    <div>
      <h1 class="text-2xl font-semibold text-white">Frequently Asked Questions</h1>
      <p class="mt-1 text-sm text-slate-400">Everything you need to know about the TRD Ranking system.</p>
    </div>

    <!-- Tier reference card -->
    <div class="card space-y-3">
      <h2 class="text-sm font-semibold text-slate-300 uppercase tracking-wide">Ranking Tiers</h2>
      <div class="divide-y divide-surface-border">
        <div class="flex items-center justify-between py-2.5 text-sm">
          <span class="text-slate-300 font-medium">Unranked</span>
          <span class="text-slate-500">Placement Phase — &lt;10 matches</span>
        </div>
        <div class="flex items-center justify-between py-2.5 text-sm">
          <span class="text-brand-300 font-medium">Beginner</span>
          <span class="text-slate-500">1000 – 1499 MMR</span>
        </div>
        <div class="flex items-center justify-between py-2.5 text-sm">
          <span class="text-orange-300 font-medium">Class C</span>
          <span class="text-slate-500">1500 – 1899 MMR</span>
        </div>
        <div class="flex items-center justify-between py-2.5 text-sm">
          <span class="text-red-300 font-medium">Class B</span>
          <span class="text-slate-500">1900 – 2199 MMR</span>
        </div>
        <div class="flex items-center justify-between py-2.5 text-sm">
          <span class="text-amber-300 font-medium">Class A / Open</span>
          <span class="text-slate-500">2200+ MMR</span>
        </div>
      </div>
    </div>

    <!-- FAQ accordion -->
    <div class="space-y-2">
      <div
        v-for="(faq, i) in faqs"
        :key="i"
        class="card overflow-hidden"
      >
        <button
          class="w-full flex items-center justify-between gap-4 text-left text-sm font-medium text-white py-0.5"
          :aria-expanded="open === i"
          @click="toggle(i)"
        >
          <span>{{ faq.question }}</span>
          <svg
            class="shrink-0 h-4 w-4 text-slate-400 transition-transform duration-200"
            :class="open === i ? 'rotate-180' : ''"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="opacity-0 max-h-0"
          enter-to-class="opacity-100 max-h-96"
          leave-active-class="transition-all duration-150 ease-in"
          leave-from-class="opacity-100 max-h-96"
          leave-to-class="opacity-0 max-h-0"
        >
          <p v-if="open === i" class="mt-3 text-sm text-slate-400 leading-relaxed">
            {{ faq.answer }}
          </p>
        </Transition>
      </div>
    </div>
  </div>
</template>
