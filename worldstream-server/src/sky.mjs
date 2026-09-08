import { londonClock, londonDate } from './time.mjs';

// Two independent time semantics, both in Europe/London and both deterministic.
//
// `dayPhase` is astronomical: it comes from the real solar position for the date,
// so the world darkens in December and stays light until late June. Weather never
// changes it; an overcast afternoon is still day.
//
// `daypart` is civil: fixed wall-clock bands that opening hours, shifts and
// routines are written against. These stay put across a daylight-saving change
// because a 09:00 training slot is 09:00 on both sides of the clock change.

const LATITUDE = 51.5074;
const LONGITUDE = -0.1278;
const MINUTE = 60_000;
const DEGREES = Math.PI / 180;
// Standard refraction-corrected solar altitudes: the disc touching the horizon,
// and the civil twilight limit at which outdoor detail is lost.
const SUNRISE_ALTITUDE = -0.833;
const CIVIL_ALTITUDE = -6;

export const DAY_PHASES = Object.freeze(['dawn', 'day', 'dusk', 'night']);
// Ordered bands. `night` wraps midnight and is resolved last.
export const DAYPARTS = Object.freeze(['small_hours', 'morning', 'midday', 'evening', 'night']);
const DAYPART_BANDS = Object.freeze([
  { daypart: 'small_hours', from: 3 * 60, until: 6 * 60 },
  { daypart: 'morning', from: 6 * 60, until: 11 * 60 },
  { daypart: 'midday', from: 11 * 60, until: 17 * 60 },
  { daypart: 'evening', from: 17 * 60, until: 20 * 60 },
]);

const sin = degrees => Math.sin(degrees * DEGREES);
const cos = degrees => Math.cos(degrees * DEGREES);
const tan = degrees => Math.tan(degrees * DEGREES);

// NOAA solar position. The sun's declination and the equation of time are read at
// the middle of the day rather than at its start, because both drift measurably
// over 24 hours and a half-day offset would cost a few minutes at each horizon.
// London sits within a minute of the prime meridian, so midday UTC is solar noon
// and the whole calculation stays inside one UTC day; no wrapping is needed.
function solarTerms(date) {
  const midnightUtc = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(midnightUtc)) throw new RangeError('Expected an ISO calendar date');
  const century = ((midnightUtc + 43_200_000) / 86_400_000 + 2_440_587.5 - 2_451_545) / 36_525;
  const meanLongitude = (280.46646 + century * (36_000.76983 + century * 0.0003032)) % 360;
  const meanAnomaly = 357.52911 + century * (35_999.05029 - 0.0001537 * century);
  const eccentricity = 0.016708634 - century * (0.000042037 + 0.0000001267 * century);
  const centre = sin(meanAnomaly) * (1.914602 - century * (0.004817 + 0.000014 * century))
    + sin(2 * meanAnomaly) * (0.019993 - 0.000101 * century)
    + sin(3 * meanAnomaly) * 0.000289;
  const apparentLongitude = meanLongitude + centre - 0.00569 - 0.00478 * sin(125.04 - 1934.136 * century);
  const meanObliquity = 23 + (26 + (21.448 - century * (46.815 + century * (0.00059 - century * 0.001813))) / 60) / 60;
  const obliquity = meanObliquity + 0.00256 * cos(125.04 - 1934.136 * century);
  const declination = Math.asin(sin(obliquity) * sin(apparentLongitude)) / DEGREES;
  const y = tan(obliquity / 2) ** 2;
  // The bracket is in radians; four minutes of time per degree gives minutes.
  const equationOfTime = 4 * (y * sin(2 * meanLongitude) - 2 * eccentricity * sin(meanAnomaly)
    + 4 * eccentricity * y * sin(meanAnomaly) * cos(2 * meanLongitude)
    - 0.5 * y * y * sin(4 * meanLongitude) - 1.25 * eccentricity * eccentricity * sin(2 * meanAnomaly)) / DEGREES;
  return { midnightUtc, declination, noonMinutes: 720 - 4 * LONGITUDE - equationOfTime };
}

// Minutes of hour angle between solar noon and the sun reaching `altitude`.
// London never reaches the polar cases, but they are clamped rather than NaN.
function hourAngle(declination, altitude) {
  const ratio = (sin(altitude) - sin(LATITUDE) * sin(declination)) / (cos(LATITUDE) * cos(declination));
  if (ratio <= -1) return 720;
  if (ratio >= 1) return 0;
  return 4 * (Math.acos(ratio) / DEGREES);
}

const memo = new Map();

// Solar instants for one London calendar date, as UTC milliseconds.
export function sunEvents(date) {
  const cached = memo.get(date);
  if (cached) return cached;
  const { midnightUtc, declination, noonMinutes } = solarTerms(date);
  const at = minutes => midnightUtc + Math.round(minutes) * MINUTE;
  const daylight = hourAngle(declination, SUNRISE_ALTITUDE);
  const twilight = hourAngle(declination, CIVIL_ALTITUDE);
  const events = Object.freeze({
    date,
    dawn: at(noonMinutes - twilight),
    sunrise: at(noonMinutes - daylight),
    solarNoon: at(noonMinutes),
    sunset: at(noonMinutes + daylight),
    dusk: at(noonMinutes + twilight),
    daylightMinutes: Math.round(2 * daylight),
  });
  if (memo.size > 800) memo.clear();
  memo.set(date, events);
  return events;
}

// dawn → day → dusk → night, from the real sun rather than fixed clock hours.
export function dayPhase(ms) {
  const events = sunEvents(londonDate(ms));
  if (ms >= events.sunrise && ms < events.sunset) return 'day';
  if (ms >= events.dawn && ms < events.sunrise) return 'dawn';
  if (ms >= events.sunset && ms < events.dusk) return 'dusk';
  return 'night';
}

export function daypart(ms) {
  const { hour, minute } = londonClock(ms);
  const total = hour * 60 + minute;
  return DAYPART_BANDS.find(band => total >= band.from && total < band.until)?.daypart ?? 'night';
}

// Sunlight as a 0–1 curve, for presentation only. Civil twilight reads as partial
// light so dawn and dusk are visibly distinct from both day and night.
export function daylightFraction(ms) {
  const events = sunEvents(londonDate(ms));
  if (ms >= events.sunrise && ms < events.sunset) return 1;
  if (ms >= events.dawn && ms < events.sunrise) return Number(((ms - events.dawn) / (events.sunrise - events.dawn)).toFixed(3));
  if (ms >= events.sunset && ms < events.dusk) return Number((1 - (ms - events.sunset) / (events.dusk - events.sunset)).toFixed(3));
  return 0;
}
