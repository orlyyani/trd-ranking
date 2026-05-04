/**
 * Proxies Open-Meteo weather for Polotana Tennis Court, General Santos City.
 * Open-Meteo is free with no API key and no rate limits for reasonable use.
 * Cached server-side for 10 minutes via Nitro's defineCachedEventHandler.
 */
export default defineCachedEventHandler(
  async () => {
    return await $fetch(
      'https://api.open-meteo.com/v1/forecast' +
      '?latitude=6.2381836' +
      '&longitude=125.0832572' +
      '&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min' +
      '&timezone=Asia%2FManila' +
      '&forecast_days=3',
    )
  },
  {
    maxAge: 600,
    name: 'weather',
    getKey: () => 'polotana-weather',
  },
)
