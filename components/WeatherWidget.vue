<script setup lang="ts">
interface WeatherResponse {
  current: {
    temperature_2m: number
    weather_code: number
    wind_speed_10m: number
    relative_humidity_2m: number
  }
  daily: {
    time: string[]
    weather_code: number[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
  }
}

const WMO: Record<number, { label: string; icon: string }> = {
  0:  { label: 'Clear sky',        icon: '☀️' },
  1:  { label: 'Mainly clear',     icon: '🌤️' },
  2:  { label: 'Partly cloudy',    icon: '⛅' },
  3:  { label: 'Overcast',         icon: '☁️' },
  45: { label: 'Foggy',            icon: '🌫️' },
  48: { label: 'Icy fog',          icon: '🌫️' },
  51: { label: 'Light drizzle',    icon: '🌦️' },
  53: { label: 'Drizzle',          icon: '🌦️' },
  55: { label: 'Heavy drizzle',    icon: '🌧️' },
  61: { label: 'Slight rain',      icon: '🌧️' },
  63: { label: 'Moderate rain',    icon: '🌧️' },
  65: { label: 'Heavy rain',       icon: '🌧️' },
  80: { label: 'Slight showers',   icon: '🌦️' },
  81: { label: 'Showers',          icon: '🌧️' },
  82: { label: 'Heavy showers',    icon: '⛈️' },
  95: { label: 'Thunderstorm',     icon: '⛈️' },
  96: { label: 'Thunderstorm',     icon: '⛈️' },
  99: { label: 'Thunderstorm',     icon: '⛈️' },
}

function wmo(code: number) {
  return WMO[code] ?? { label: 'Unknown', icon: '❓' }
}

function dayLabel(isoDate: string, index: number): string {
  if (index === 0) return 'Today'
  if (index === 1) return 'Tomorrow'
  return new Date(isoDate).toLocaleDateString('en-GB', { weekday: 'short' })
}

const { data, error } = await useFetch<WeatherResponse>('/api/weather')

const current = computed(() => data.value?.current)
const daily   = computed(() => data.value?.daily)
</script>

<template>
  <!-- Silent fail: widget simply doesn't render on error -->
  <div
    v-if="current && daily && !error"
    class="card space-y-3"
  >
    <!-- Header -->
    <div class="flex items-center justify-between">
      <p class="text-xs text-slate-500 uppercase tracking-widest">Court conditions</p>
      <p class="text-xs text-slate-600">Polotana TC · GenSan</p>
    </div>

    <!-- Current conditions -->
    <div class="flex items-center gap-4">
      <span class="text-4xl" aria-hidden="true">{{ wmo(current.weather_code).icon }}</span>
      <div>
        <p class="text-2xl font-semibold text-white tabular-nums">
          {{ Math.round(current.temperature_2m) }}°C
        </p>
        <p class="text-xs text-slate-400">{{ wmo(current.weather_code).label }}</p>
      </div>
      <div class="ml-auto text-right space-y-0.5 text-xs text-slate-500">
        <p>💧 {{ current.relative_humidity_2m }}%</p>
        <p>💨 {{ Math.round(current.wind_speed_10m) }} km/h</p>
      </div>
    </div>

    <!-- 3-day forecast -->
    <div class="grid grid-cols-3 gap-2 pt-2 border-t border-surface-border">
      <div
        v-for="(time, i) in daily.time"
        :key="time"
        class="flex flex-col items-center gap-1 text-xs"
      >
        <span class="text-slate-500">{{ dayLabel(time, i) }}</span>
        <span class="text-xl" aria-hidden="true">{{ wmo(daily.weather_code[i]).icon }}</span>
        <span class="text-slate-300 tabular-nums">
          {{ Math.round(daily.temperature_2m_max[i]) }}°
          <span class="text-slate-600">/</span>
          {{ Math.round(daily.temperature_2m_min[i]) }}°
        </span>
      </div>
    </div>
  </div>
</template>
