import { createHash } from 'node:crypto';
import { atLondon, londonDate } from './time.mjs';

// The Celestial Veil is the one thing this world is always leaning toward.
//
// Canon puts the festival in view early — a crowd watching scenes from the
// upcoming Veil at the Sanctuary in the sky (~p.21), and a bystander amazed it
// has never been hosted there before (~p.87) — while the festival itself does
// not begin until well past the p.183 checkpoint. So at this checkpoint the true
// state of the world is: it is coming, and it has not happened yet.
//
// That is exactly what is modelled here. The Veil has a real date, it approaches
// on the real calendar, and the Church leans harder into preparation as it
// nears. The day itself is marked with a single public notice and nothing more:
// no scene, no attendance, no consequence for Goaden or Ashai. The festival is
// Book One's, and this is only the season around it.

// A fixed autumn window, drawn once per year from the seed so a given world
// always keeps the same date and a restart never moves it.
const VEIL_WINDOW_START = { month: 10, day: 12 };
const VEIL_WINDOW_DAYS = 24;
const DAY_MS = 86_400_000;

const hash = text => createHash('sha256').update(text).digest().readUInt32BE(0);

function pad(value) { return String(value).padStart(2, '0'); }

// The date of the Veil in a given calendar year.
export function veilDateForYear(year, seed) {
  const offset = hash(`${seed}|celestial-veil|${year}`) % VEIL_WINDOW_DAYS;
  const start = Date.parse(`${year}-${pad(VEIL_WINDOW_START.month)}-${pad(VEIL_WINDOW_START.day)}T12:00:00Z`);
  return new Date(start + offset * DAY_MS).toISOString().slice(0, 10);
}

// Whole days from a London date to the Veil, counted on the calendar rather than
// in elapsed hours, so a daylight-saving change cannot shift the countdown.
const daysBetween = (from, to) =>
  Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS);

// The next Veil at or after a given instant: this year's while it is still
// ahead, otherwise next year's.
export function nextVeil(atMs, seed) {
  const today = londonDate(atMs);
  const year = Number(today.slice(0, 4));
  for (const candidate of [year, year + 1]) {
    const date = veilDateForYear(candidate, seed);
    const away = daysBetween(today, date);
    if (away >= 0) return { date, daysAway: away, phase: phaseFor(away) };
  }
  throw new RangeError('No Celestial Veil ahead');
}

// How loudly the world is leaning toward it.
export function phaseFor(daysAway) {
  if (daysAway === 0) return 'underway';
  if (daysAway <= 7) return 'imminent';
  if (daysAway <= 30) return 'preparing';
  if (daysAway <= 60) return 'announced';
  return 'distant';
}

// How often the Church's daily posture is pulled toward Veil business. Far out
// it is ordinary business among other business; close in, it is most of what
// the Church is publicly doing.
export const VEIL_PRESSURE = Object.freeze({
  distant:0, announced:1, preparing:2, imminent:3, underway:3,
});

// One public line per phase, published when the world crosses into it, so the
// season is something a reader watches arrive rather than a number ticking down.
export const VEIL_NOTICES = Object.freeze({
  announced:'The Church opened preparations for the Celestial Veil at the Sanctuary in the sky.',
  preparing:'Celestial Veil preparations stepped up; the Church began fitting out the Sanctuary halls.',
  imminent:'The Sanctuary in the sky entered its final week of Celestial Veil preparations.',
  underway:'The Celestial Veil began at the Sanctuary in the sky.',
});

export const VEIL_PHASES = Object.freeze(['distant','announced','preparing','imminent','underway']);
