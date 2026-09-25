import { MINUTE_MS as MIN } from './time.mjs';

// Physical rule for the existing plaza gardens. This module has no access to
// Onari, narrative scores, scene selection, model calls, or character desires.
// A full day of heavy rain/storm permits a minor root-saturation consequence;
// dry weather clears the ongoing exposure. These are simulation rules, not a
// claim that measured real-world plant damage follows a universal threshold.
export const GARDEN_EXPOSURE_RULES = Object.freeze({
  locationId: 'big_ben_plaza', areaId: 'gardens',
  saturationAfterMs: 24 * 60 * MIN,
  episodeCooldownMs: 14 * 24 * 60 * MIN,
});

const SATURATING_WEATHER = new Set(['heavy_rain', 'storm']);

export function advanceHabitatExposure(previous, { eventId, occurredAt, weatherCode, maximumGapMs = 26 * 60 * MIN }) {
  if (!eventId || !Number.isSafeInteger(occurredAt) || !weatherCode
    || previous?.lastWeatherEventId === eventId || occurredAt < (previous?.lastWeatherAt ?? 0)) return previous;
  const saturated = SATURATING_WEATHER.has(weatherCode);
  const continuous = previous && occurredAt - previous.lastWeatherAt <= maximumGapMs;
  const wetSince = saturated ? (continuous ? previous.wetSince ?? occurredAt : occurredAt) : null;
  return { ...previous, wetSince,
    firstWetEventId: saturated ? (continuous ? previous.firstWetEventId ?? eventId : eventId) : null,
    lastWeatherEventId: eventId, lastWeatherAt: occurredAt,
    phase: !saturated ? 'draining' : occurredAt - wetSince >= GARDEN_EXPOSURE_RULES.saturationAfterMs ? 'saturated' : 'wet',
  };
}
