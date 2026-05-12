<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  players: Array<{ id: string; name: string; mmr: number }>
  disabledIds?: Set<string>
  placeholder?: string
  required?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const query    = ref('')
const open     = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

const selected = computed(() => props.players.find(p => p.id === props.modelValue) ?? null)

const filtered = computed(() => {
  const q = query.value.toLowerCase().trim()
  return q ? props.players.filter(p => p.name.toLowerCase().includes(q)) : props.players
})

function pick(player: { id: string; name: string; mmr: number }) {
  if (isDisabled(player.id)) return
  emit('update:modelValue', player.id)
  query.value = player.name
  open.value  = false
}

function isDisabled(id: string) {
  return !!(props.disabledIds?.has(id) && id !== props.modelValue)
}

function onFocus() {
  query.value = ''
  open.value  = true
}

function onBlur() {
  setTimeout(() => {
    open.value  = false
    query.value = selected.value?.name ?? ''
  }, 150)
}

function clear() {
  emit('update:modelValue', '')
  query.value = ''
  open.value  = true
  nextTick(() => inputRef.value?.focus())
}

// Keep display in sync when value is reset externally
watch(() => props.modelValue, val => {
  if (!open.value) {
    query.value = val ? (props.players.find(p => p.id === val)?.name ?? '') : ''
  }
})
</script>

<template>
  <div class="relative">
    <div class="relative">
      <input
        ref="inputRef"
        :value="open ? query : (selected?.name ?? '')"
        :placeholder="placeholder ?? 'Search player…'"
        :required="required && !modelValue"
        autocomplete="off"
        class="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 pr-8 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
        @input="query = ($event.target as HTMLInputElement).value"
        @focus="onFocus"
        @blur="onBlur"
      />
      <!-- clear button -->
      <button
        v-if="modelValue"
        type="button"
        class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
        tabindex="-1"
        @mousedown.prevent="clear"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </button>
      <!-- chevron -->
      <svg v-else xmlns="http://www.w3.org/2000/svg" class="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    </div>

    <Transition
      enter-active-class="transition-all duration-100 origin-top"
      enter-from-class="opacity-0 scale-y-95"
      enter-to-class="opacity-100 scale-y-100"
      leave-active-class="transition-all duration-75 origin-top"
      leave-from-class="opacity-100 scale-y-100"
      leave-to-class="opacity-0 scale-y-95"
    >
      <ul
        v-if="open"
        class="absolute z-30 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-surface-border bg-surface-elevated shadow-xl"
      >
        <li v-if="filtered.length === 0" class="px-3 py-2 text-sm text-slate-500">No players found</li>
        <li
          v-for="p in filtered"
          :key="p.id"
          :class="[
            'flex items-center justify-between px-3 py-2 text-sm cursor-pointer select-none',
            isDisabled(p.id)
              ? 'opacity-40 cursor-not-allowed text-slate-400'
              : p.id === modelValue
                ? 'bg-brand-600/30 text-white'
                : 'text-slate-200 hover:bg-white/5',
          ]"
          @mousedown.prevent="pick(p)"
        >
          <span>{{ p.name }}</span>
          <span class="text-xs text-slate-500 tabular-nums">{{ p.mmr }}</span>
        </li>
      </ul>
    </Transition>
  </div>
</template>
