import { londonDate, londonClock, atLondon } from './time.mjs';

/**
 * Standard Worldstream canonical weather vocabulary.
 */
export const CANONICAL_WEATHER_CODES = Object.freeze([
  'clear',
  'partly_cloudy',
  'cloudy',
  'overcast',
  'fog',
  'drizzle',
  'light_rain',
  'rain',
  'heavy_rain',
  'storm',
  'sleet',
  'snow'
]);

/**
 * Maps WMO weather interpretation codes (0-99 standard) to Worldstream canonical terms.
 */
export function normalizeWmoCode(wmoCode) {
  const code = Number(wmoCode);
  switch (code) {
    case 0:
      return { code: 'clear', description: 'Clear' };
    case 1:
      return { code: 'clear', description: 'Mainly clear' };
    case 2:
      return { code: 'partly_cloudy', description: 'Partly cloudy' };
    case 3:
      return { code: 'overcast', description: 'Overcast' };
    case 45:
    case 48:
      return { code: 'fog', description: 'Fog' };
    case 51:
    case 53:
    case 55:
      return { code: 'drizzle', description: 'Drizzle' };
    case 56:
    case 57:
      return { code: 'drizzle', description: 'Freezing drizzle' };
    case 61:
      return { code: 'light_rain', description: 'Light rain' };
    case 63:
      return { code: 'rain', description: 'Rain' };
    case 65:
      return { code: 'heavy_rain', description: 'Heavy rain' };
    case 66:
    case 67:
      return { code: 'sleet', description: 'Sleet' };
    case 71:
    case 73:
      return { code: 'snow', description: 'Snow' };
    case 75:
    case 78:
      return { code: 'snow', description: 'Heavy snow' };
    case 77:
      return { code: 'snow', description: 'Snow grains' };
    case 80:
      return { code: 'light_rain', description: 'Light showers' };
    case 81:
      return { code: 'rain', description: 'Showers' };
    case 82:
      return { code: 'heavy_rain', description: 'Heavy showers' };
    case 85:
    case 86:
      return { code: 'snow', description: 'Snow showers' };
    case 95:
    case 96:
    case 99:
      return { code: 'storm', description: 'Thunderstorm' };
    default:
      return { code: 'cloudy', description: 'Cloudy' };
  }
}

/**
 * Fixed 3-hour London schedule slots:
 * 00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00.
 */
export const LONDON_WEATHER_HOURS = Object.freeze([0, 3, 6, 9, 12, 15, 18, 21]);

/**
 * Returns the canonical 3-hour slot identifier for a given epoch ms in Europe/London.
 * E.g., "2026-09-12T12:00"
 */
export function londonWeatherSlot(ms) {
  const date = londonDate(ms);
  const { hour } = londonClock(ms);
  const slotHour = Math.floor(hour / 3) * 3;
  const slotStr = String(slotHour).padStart(2, '0');
  return `${date}T${slotStr}:00`;
}

/**
 * Normalizes an Open-Meteo or generic raw weather provider payload into a
 * canonical Worldstream weather observation record.
 */
export function normalizeWeatherObservation(raw, { observedAt = Date.now(), source = 'open-meteo' } = {}) {
  if (!raw || typeof raw !== 'object') return null;

  const current = raw.current ?? raw;
  const wmoCode = current.weather_code ?? current.weatherCode ?? current.code ?? 3;
  const { code, description } = normalizeWmoCode(wmoCode);

  const temp = current.temperature_2m ?? current.temperatureC ?? current.temp;
  const temperatureC = typeof temp === 'number' && Number.isFinite(temp) ? Math.round(temp) : 12;

  const precip = current.precipitation ?? current.precipitationMm ?? current.rain;
  const precipitationMm = typeof precip === 'number' && Number.isFinite(precip)
    ? Number(precip.toFixed(1))
    : 0;

  const wind = current.wind_speed_10m ?? current.windSpeedKph ?? current.wind;
  const windSpeedKph = typeof wind === 'number' && Number.isFinite(wind)
    ? Math.round(wind)
    : 0;

  let timestamp = observedAt;
  if (typeof current.time === 'number' && Number.isFinite(current.time)) {
    timestamp = current.time;
  } else if (typeof current.time === 'string') {
    const match = current.time.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    if (match) {
      try {
        timestamp = atLondon(match[1], match[2]);
      } catch {
        timestamp = Date.parse(current.time);
      }
    } else {
      timestamp = Date.parse(current.time);
    }
  }

  if (!Number.isSafeInteger(timestamp)) {
    timestamp = observedAt;
  }
  // Observation timestamp must never be ahead of the observation wall time
  if (timestamp > observedAt) {
    timestamp = observedAt;
  }

  return Object.freeze({
    code,
    description,
    temperatureC,
    precipitationMm,
    windSpeedKph,
    observedAt: timestamp,
    slotTime: londonWeatherSlot(timestamp),
    source
  });
}

/**
 * Evaluates whether a new observation represents a narratively meaningful
 * change compared to the currently active weather.
 *
 * Rules:
 * 1. Missing previous -> material.
 * 2. Weather code changes (e.g. cloudy -> rain, rain -> clear, clear -> fog) -> material.
 * 3. Temperature crossing a significant band (>= 4°C shift) -> material.
 * 4. Minor temperature drift (e.g. 14.1°C -> 14.3°C) on same code -> suppressed (not material).
 */
export function isMaterialWeatherChange(previous, next) {
  if (!previous || !previous.code) return true;
  if (!next || !next.code) return false;

  if (previous.code !== next.code) return true;

  const prevTemp = previous.temperatureC ?? 0;
  const nextTemp = next.temperatureC ?? 0;
  if (Math.abs(nextTemp - prevTemp) >= 4) return true;

  return false;
}

const LONDON_ENDPOINT = 'https://api.open-meteo.com/v1/forecast?latitude=51.5074&longitude=-0.1278&current=temperature_2m,precipitation,weather_code,wind_speed_10m&timezone=Europe%2FLondon';

/**
 * Fetches real London weather from Open-Meteo.
 * Strictly isolated: only called by scheduled background jobs, never by request or simulation loops.
 * Returns normalized observation or null on failure/timeout.
 */
export async function fetchLondonWeather({
  endpoint = LONDON_ENDPOINT,
  fetchFn = globalThis.fetch,
  timeoutMs = 6000,
  now = Date.now()
} = {}) {
  if (typeof fetchFn !== 'function') return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetchFn(endpoint, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json', 'User-Agent': 'Worldstream-Weather-Adapter/1.0' }
    }).finally(() => clearTimeout(timer));

    if (!response || !response.ok) return null;
    const data = await response.json();
    return normalizeWeatherObservation(data, { observedAt: now, source: 'open-meteo' });
  } catch (err) {
    // Network errors or aborts fail gracefully without throwing
    return null;
  }
}
