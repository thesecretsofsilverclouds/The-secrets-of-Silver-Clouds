const MINUTE = 60_000;
const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function parts(ms) {
  return Object.fromEntries(partsFormatter.formatToParts(ms).map(p => [p.type, p.value]));
}

export function londonDate(ms) {
  const p = parts(ms);
  return `${p.year}-${p.month}-${p.day}`;
}

export function nextLondonDay(date) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

export function prevLondonDay(date) {
  return new Date(Date.parse(`${date}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

// The civil wall clock, which is what opening hours and routines are written against.
export function londonClock(ms) {
  const p = parts(ms);
  return { hour: Number(p.hour), minute: Number(p.minute) };
}

export function atLondon(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new RangeError('Expected London date and HH:mm');
  const base = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(base) || new Date(base).toISOString().slice(0, 10) !== date) throw new RangeError('Invalid calendar date');
  // London uses UTC or UTC+1. In autumn choose the first occurrence of a slot.
  const candidates = [base - 60 * MINUTE, base].filter(ms => {
    const p = parts(ms);
    return `${p.year}-${p.month}-${p.day}` === date && `${p.hour}:${p.minute}` === time;
  });
  if (candidates.length) return Math.min(...candidates);
  // The missing spring hour is moved to its first valid instant, 02:00 BST.
  const firstValid = Date.parse(`${date}T01:00:00Z`);
  const p = parts(firstValid);
  if (time.startsWith('01:') && `${p.hour}:${p.minute}` === '02:00') return firstValid;
  throw new RangeError('Unsupported London civil time');
}

export function londonMidnight(ms) { return atLondon(londonDate(ms), '00:00'); }

export const MINUTE_MS = MINUTE;
