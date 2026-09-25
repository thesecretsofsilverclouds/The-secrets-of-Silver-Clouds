import test from 'node:test';
import assert from 'node:assert/strict';
import { createFixture, DEFAULT_SEED, RULES_VERSION } from '../src/fixture.mjs';
import { atLondon, londonDate } from '../src/time.mjs';
import { normalizeWeatherObservation, isMaterialWeatherChange, londonWeatherSlot } from '../src/weather-provider.mjs';

test('weather simulation: basic initial weather state under v28', () => {
  const start = atLondon('2026-09-05', '00:00');
  const fixture = createFixture({ startMs: start });
  assert.equal(fixture.rulesVersion, RULES_VERSION);
  const state = fixture.initialState();
  assert.equal(state.weather.code, 'cloudy');
  assert.equal(state.weather.simulated, true);
});

test('weather simulation: external observation updates state and material change publishes event', () => {
  const start = atLondon('2026-09-05', '00:00');
  const fixture = createFixture({ startMs: start });
  const state = fixture.initialState();

  // 00:00:00+1ms day initialization
  const initialAction = fixture.initialActions()[0];
  const r0 = fixture.reduceAction(state, initialAction, DEFAULT_SEED);
  assert.equal(r0.event.visibility, 'public');

  // Observation at 03:00 with material code change (e.g. rain)
  const obsTime = atLondon('2026-09-05', '03:00');
  const obsAction = {
    id: 'weather-obs:2026-09-05T03:00',
    type: 'WEATHER_OBSERVATION',
    dueAt: obsTime,
    priority: 5,
    slotTime: '2026-09-05T03:00',
    observation: {
      code: 'rain',
      description: 'Showers',
      temperatureC: 13,
      precipitationMm: 2.4,
      windSpeedKph: 15,
      slotTime: '2026-09-05T03:00',
      observedAt: obsTime,
      source: 'open-meteo',
    },
  };

  const r1 = fixture.reduceAction(state, obsAction, DEFAULT_SEED);
  assert.equal(r1.event.visibility, 'public');
  assert.equal(r1.event.payload.weatherCode, 'rain');
  assert.equal(r1.event.payload.material, true);
  assert.equal(state.weather.code, 'rain');
  assert.equal(state.weather.external, true);
  assert.equal(state.weather.simulated, false);
  assert.equal(state.weather.slotTime, '2026-09-05T03:00');

  // Projection reflects external weather
  const proj = fixture.publicProjection({ ...state, world: { id: 'silver-clouds-now', seed: DEFAULT_SEED, resolvedThrough: obsTime }, events: [r1.event] });
  assert.equal(proj.weather.code, 'rain');
  assert.equal(proj.weather.simulated, false);
  assert.equal(proj.weather.precipitationMm, 2.4);
});

test('weather simulation: minor temperature drift is suppressed (private, no public event)', () => {
  const start = atLondon('2026-09-05', '00:00');
  const fixture = createFixture({ startMs: start });
  const state = fixture.initialState();
  fixture.reduceAction(state, fixture.initialActions()[0], DEFAULT_SEED);

  // Set initial observation at 03:00
  const obs1Time = atLondon('2026-09-05', '03:00');
  fixture.reduceAction(state, {
    id: 'weather-obs:2026-09-05T03:00',
    type: 'WEATHER_OBSERVATION',
    dueAt: obs1Time,
    priority: 5,
    slotTime: '2026-09-05T03:00',
    observation: {
      code: 'cloudy',
      description: 'Cloudy',
      temperatureC: 14,
      precipitationMm: 0,
      windSpeedKph: 10,
      slotTime: '2026-09-05T03:00',
      observedAt: obs1Time,
    }
  }, DEFAULT_SEED);

  // Next slot at 06:00 has minor temp drift (14°C -> 15°C, same code)
  const obs2Time = atLondon('2026-09-05', '06:00');
  const r2 = fixture.reduceAction(state, {
    id: 'weather-obs:2026-09-05T06:00',
    type: 'WEATHER_OBSERVATION',
    dueAt: obs2Time,
    priority: 5,
    slotTime: '2026-09-05T06:00',
    observation: {
      code: 'cloudy',
      description: 'Cloudy',
      temperatureC: 15,
      precipitationMm: 0,
      windSpeedKph: 11,
      slotTime: '2026-09-05T06:00',
      observedAt: obs2Time,
    }
  }, DEFAULT_SEED);

  assert.equal(r2.event.visibility, 'private');
  assert.equal(r2.event.publicDescription, null);
  assert.equal(r2.event.payload.suppressed, true);
  assert.equal(state.weather.temperatureC, 15);
  assert.equal(state.weather.slotTime, '2026-09-05T06:00');
});

test('weather simulation: duplicate observation for same slot is skipped idempotently', () => {
  const start = atLondon('2026-09-05', '00:00');
  const fixture = createFixture({ startMs: start });
  const state = fixture.initialState();
  fixture.reduceAction(state, fixture.initialActions()[0], DEFAULT_SEED);

  const obsTime = atLondon('2026-09-05', '03:00');
  const action = {
    id: 'weather-obs:2026-09-05T03:00',
    type: 'WEATHER_OBSERVATION',
    dueAt: obsTime,
    priority: 5,
    slotTime: '2026-09-05T03:00',
    observation: {
      code: 'storm',
      description: 'Thunderstorm',
      temperatureC: 11,
      precipitationMm: 12.0,
      windSpeedKph: 45,
      slotTime: '2026-09-05T03:00',
      observedAt: obsTime,
    }
  };

  const r1 = fixture.reduceAction(state, action, DEFAULT_SEED);
  assert.equal(r1.event.visibility, 'public');

  // Redundant replay / execution of identical slot
  const r2 = fixture.reduceAction(state, action, DEFAULT_SEED);
  assert.equal(r2.event.visibility, 'private');
  assert.equal(r2.event.payload.skipped, true);
});

test('weather simulation: day rollover at 00:00 retains committed external weather', () => {
  const start = atLondon('2026-09-05', '00:00');
  const fixture = createFixture({ startMs: start });
  const state = fixture.initialState();
  fixture.reduceAction(state, fixture.initialActions()[0], DEFAULT_SEED);

  // Ingest external weather late in day (21:00)
  const obsTime = atLondon('2026-09-05', '21:00');
  fixture.reduceAction(state, {
    id: 'weather-obs:2026-09-05T21:00',
    type: 'WEATHER_OBSERVATION',
    dueAt: obsTime,
    priority: 5,
    slotTime: '2026-09-05T21:00',
    observation: {
      code: 'fog',
      description: 'Fog',
      temperatureC: 8,
      precipitationMm: 0,
      windSpeedKph: 5,
      slotTime: '2026-09-05T21:00',
      observedAt: obsTime,
    }
  }, DEFAULT_SEED);

  assert.equal(state.weather.code, 'fog');
  assert.equal(state.weather.external, true);

  // Rollover to next day at 2026-09-06T00:00
  const nextDay = '2026-09-06';
  const rolloverAction = {
    id: `${nextDay}/day`,
    day: nextDay,
    dueAt: atLondon(nextDay, '00:00') + 1,
    priority: 0,
    type: 'WEATHER_CHANGE'
  };

  const rolloverResult = fixture.reduceAction(state, rolloverAction, DEFAULT_SEED);
  assert.equal(rolloverResult.event.visibility, 'public');
  assert.equal(rolloverResult.event.payload.weatherCode, 'fog');
  assert.equal(state.weather.code, 'fog');
  assert.equal(state.weather.external, true);
});

test('weather simulation: observation with future effective time is rejected by causal invariant', () => {
  const start = atLondon('2026-09-05', '00:00');
  const fixture = createFixture({ startMs: start });
  const state = fixture.initialState();
  fixture.reduceAction(state, fixture.initialActions()[0], DEFAULT_SEED);

  const now = atLondon('2026-09-05', '12:00');
  const futureTime = atLondon('2026-09-05', '13:00');

  const futureAction = {
    id: 'weather-obs:future',
    type: 'WEATHER_OBSERVATION',
    dueAt: now,
    priority: 5,
    slotTime: '2026-09-05T12:00',
    observation: {
      code: 'storm',
      description: 'Thunderstorm',
      temperatureC: 10,
      precipitationMm: 15,
      windSpeedKph: 50,
      observedAt: futureTime, // 1 hour in the future!
      slotTime: '2026-09-05T12:00',
    }
  };

  const result = fixture.reduceAction(state, futureAction, DEFAULT_SEED);
  assert.equal(result.event.payload.outcome, 'skipped');
  assert.equal(result.event.payload.reason, 'Weather observation effective time is in the future');
  assert.notEqual(state.weather.code, 'storm');
});

test('weather simulation: public projection clamps observedAt so it never exceeds resolvedThrough', () => {
  const start = atLondon('2026-09-05', '00:00');
  const fixture = createFixture({ startMs: start });
  const state = fixture.initialState();
  const watermark = atLondon('2026-09-05', '12:00');

  // Even if state somehow held a legacy skewed observedAt
  state.weather = {
    code: 'clear',
    description: 'Clear',
    temperatureC: 21,
    simulated: false,
    external: true,
    observedAt: watermark + 3600000, // 1 hr ahead
  };

  const proj = fixture.publicProjection({
    ...state,
    world: { id: 'silver-clouds-now', seed: DEFAULT_SEED, resolvedThrough: watermark },
    events: [],
  });

  assert.ok(proj.weather.observedAt <= watermark, 'Public projection observedAt must never exceed resolvedThrough');
  assert.equal(proj.weather.observedAt, watermark);
});
