import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANONICAL_WEATHER_CODES,
  normalizeWmoCode,
  londonWeatherSlot,
  normalizeWeatherObservation,
  isMaterialWeatherChange,
  fetchLondonWeather
} from '../src/weather-provider.mjs';

test('normalizeWmoCode maps WMO standard codes into canonical vocabulary', () => {
  assert.equal(normalizeWmoCode(0).code, 'clear');
  assert.equal(normalizeWmoCode(2).code, 'partly_cloudy');
  assert.equal(normalizeWmoCode(3).code, 'overcast');
  assert.equal(normalizeWmoCode(45).code, 'fog');
  assert.equal(normalizeWmoCode(51).code, 'drizzle');
  assert.equal(normalizeWmoCode(61).code, 'light_rain');
  assert.equal(normalizeWmoCode(63).code, 'rain');
  assert.equal(normalizeWmoCode(65).code, 'heavy_rain');
  assert.equal(normalizeWmoCode(67).code, 'sleet');
  assert.equal(normalizeWmoCode(71).code, 'snow');
  assert.equal(normalizeWmoCode(80).code, 'light_rain');
  assert.equal(normalizeWmoCode(95).code, 'storm');
});

test('londonWeatherSlot calculates 3-hour boundaries in Europe/London', () => {
  // 2026-09-12 12:34 London BST is 11:34 UTC
  const ms1 = Date.parse('2026-09-12T11:34:00Z');
  assert.equal(londonWeatherSlot(ms1), '2026-09-12T12:00');

  // 2026-09-12 04:15 London BST is 03:15 UTC -> slot 03:00
  const ms2 = Date.parse('2026-09-12T03:15:00Z');
  assert.equal(londonWeatherSlot(ms2), '2026-09-12T03:00');

  // 2026-09-12 00:05 London BST is 23:05 UTC on 11 Sep -> slot 00:00 on 12 Sep
  const ms3 = Date.parse('2026-09-11T23:05:00Z');
  assert.equal(londonWeatherSlot(ms3), '2026-09-12T00:00');
});

test('normalizeWeatherObservation parses Open-Meteo current structure', () => {
  const raw = {
    current: {
      time: '2026-09-12T12:00',
      temperature_2m: 14.2,
      precipitation: 0.8,
      weather_code: 61,
      wind_speed_10m: 18.6
    }
  };
  const obs = normalizeWeatherObservation(raw);
  assert.equal(obs.code, 'light_rain');
  assert.equal(obs.description, 'Light rain');
  assert.equal(obs.temperatureC, 14);
  assert.equal(obs.precipitationMm, 0.8);
  assert.equal(obs.windSpeedKph, 19);
  assert.equal(obs.source, 'open-meteo');
});

test('isMaterialWeatherChange detects meaningful shifts and suppresses minor drift', () => {
  const cloudy14 = { code: 'cloudy', temperatureC: 14 };
  const cloudy14point5 = { code: 'cloudy', temperatureC: 14 };
  const cloudy15 = { code: 'cloudy', temperatureC: 15 };
  const rain14 = { code: 'rain', temperatureC: 14 };
  const cloudy9 = { code: 'cloudy', temperatureC: 9 }; // 5 deg drop

  // Minor temp fluctuations on same code are suppressed
  assert.equal(isMaterialWeatherChange(cloudy14, cloudy14point5), false);
  assert.equal(isMaterialWeatherChange(cloudy14, cloudy15), false);

  // Weather code change is material
  assert.equal(isMaterialWeatherChange(cloudy14, rain14), true);

  // Significant temperature drop (>= 4C) is material
  assert.equal(isMaterialWeatherChange(cloudy14, cloudy9), true);

  // Missing previous is material
  assert.equal(isMaterialWeatherChange(null, cloudy14), true);
});

test('fetchLondonWeather fails gracefully on timeout or fetch rejection without throwing', async () => {
  const failingFetch = async () => { throw new Error('Network offline'); };
  const result = await fetchLondonWeather({ fetchFn: failingFetch });
  assert.equal(result, null);

  const status500Fetch = async () => ({ ok: false, status: 500 });
  const result500 = await fetchLondonWeather({ fetchFn: status500Fetch });
  assert.equal(result500, null);
});

test('fetchLondonWeather succeeds with mock provider payload', async () => {
  const mockFetch = async () => ({
    ok: true,
    json: async () => ({
      current: {
        time: '2026-09-12T15:00',
        temperature_2m: 16.1,
        precipitation: 0.0,
        weather_code: 0,
        wind_speed_10m: 12.0
      }
    })
  });
  const obs = await fetchLondonWeather({ fetchFn: mockFetch });
  assert.ok(obs);
  assert.equal(obs.code, 'clear');
  assert.equal(obs.temperatureC, 16);
});

test('normalizeWeatherObservation correctly parses London civil string under any timezone environment', () => {
  const raw = {
    current: {
      time: '2026-09-12T13:15',
      temperature_2m: 21.0,
      weather_code: 0
    }
  };

  // In London BST (UTC+1), 2026-09-12 13:15 is 12:15:00.000Z = 1789215300000
  // Under a raw Date.parse in UTC, it would wrongly parse as 13:15:00.000Z = 1789218900000 (+1 hr)
  const pollTime = Date.parse('2026-09-12T12:30:00Z'); // 13:30 BST
  const obs = normalizeWeatherObservation(raw, { observedAt: pollTime });

  assert.equal(obs.observedAt, 1789215300000, 'Observation must evaluate to London civil instant 12:15 UTC');
  assert.ok(obs.observedAt <= pollTime, 'Observation timestamp must not exceed poll time');
});

test('normalizeWeatherObservation clamps future timestamps to observedAt', () => {
  const raw = {
    current: {
      time: '2026-09-12T14:00', // 14:00 London = 13:00 UTC = 1789218000000
      temperature_2m: 20.0,
      weather_code: 0
    }
  };

  const pollTime = Date.parse('2026-09-12T12:30:00Z'); // 13:30 BST = 12:30 UTC
  const obs = normalizeWeatherObservation(raw, { observedAt: pollTime });

  assert.equal(obs.observedAt, pollTime, 'Future observation timestamp must be clamped to observedAt');
});
