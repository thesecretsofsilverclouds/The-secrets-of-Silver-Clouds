// What a newspaper thinks is worth printing.
//
// Worldstream already has a salience scorer: `scoreEventSalience` in
// src/dispatch.mjs. It is a flat lookup from event type to a number, and for
// picking today's three or four most interesting things it works. What it
// cannot do is the thing that actually makes newspapers behave like newspapers:
// notice that something has happened *again*.
//
// A single Streamliner delay is not news. The third one this week is, and it is
// news precisely because of the first two. That is a property of the archive,
// not of the event, so it cannot live in a lookup table. Everything below is
// designed around that: a score has a recurrence term, and the recurrence term
// reads the paper's own memory of what it has already printed.
//
// Nothing here decides what happened. The engine reads committed public events
// and decides what to say about them.

export const DIMENSIONS = Object.freeze({
  scale: 'how many people it touched',
  danger: 'whether anybody could have been hurt',
  novelty: 'whether this kind of thing normally happens',
  proximity: 'how near it is to the paper\'s readership',
  faction: 'whether an institution is implicated',
  disruption: 'whether it stopped people doing things',
  recurrence: 'whether it has happened before, recently',
  mystery: 'whether anybody can explain it',
  visual: 'whether it looked like something',
});

// Base weights per event type. Deliberately coarse: the interesting behaviour
// comes from the terms that are computed, not from these.
const BASE = Object.freeze({
  ARCANE_SURGE: { scale: 5, danger: 4, novelty: 3, faction: 3, mystery: 4, visual: 5 },
  INCIDENT: { scale: 4, danger: 5, novelty: 3, disruption: 4, mystery: 3 },
  AFTERMATH: { scale: 3, danger: 2, disruption: 3 },
  UNEASE: { mystery: 3, visual: 2, novelty: 1 },
  INSTITUTION_NOTICE: { faction: 4, scale: 3, proximity: 3 },
  FACTION_STATUS: { faction: 5, scale: 3 },
  WEATHER_DISRUPTION: { disruption: 4, scale: 3, proximity: 4 },
  MINOR_ANOMALY: { mystery: 3, visual: 3, novelty: 2 },
  TRAVEL_DEPART: { scale: 1 },
  TRAVEL_ARRIVE: { scale: 1 },
  OUTING_CUT_SHORT: { disruption: 2 },
  PLAN_BROKEN: { disruption: 1 },
  LEGION_VISIT: { visual: 2, novelty: 2 },
  VENUE_SCENE: { proximity: 1 },
  // Everything else scores from the computed terms alone, which for an ordinary
  // routine event means nothing. Ashai eating lunch is not a story.
});

// A borough paper cares about the boroughs. MI6's internal life is, to the
// Gazette, a building it is not allowed into.
const PROXIMITY = Object.freeze({
  big_ben_plaza: 5, streamliner: 5, cafe: 4, enchanted_ink: 4,
  legion_hideout: 2, sanctuary: 3, mi6: 1,
});

export const NEWSWORTHY_FLOOR = 12;

/**
 * @param {object} event      A committed public Worldstream event.
 * @param {object} context    { thread, daysSinceSimilar, knownCause }
 * @returns {{score:number, terms:object, why:string[]}}
 */
export function newsworthiness(event, { thread = null, daysSinceSimilar = null,
  knownCause = true } = {}) {
  const terms = { ...(BASE[event.type] ?? {}) };
  const why = [];

  terms.proximity = (terms.proximity ?? 0) + (PROXIMITY[event.location] ?? 0);
  if (terms.proximity) why.push(`${event.location} is on the paper's patch`);

  // Recurrence, and the shape of it is the point.
  //
  // The obvious model is a ramp: each repeat is worth more than the last. That
  // is wrong, and the lab proved it wrong in one run — a thirty-day Gazette
  // reported the same storm thirteen times with escalating outrage, because
  // every recurrence made the next one more newsworthy and nothing ever made it
  // less. Real papers do the opposite at the far end: the fourth failure this
  // month is a scandal and the fortieth is just what the eastern line is like
  // now. So recurrence rises to a peak around the third or fourth occurrence
  // and then falls away, and a story that keeps happening eventually stops
  // being a story. This single curve is what keeps the paper from becoming a
  // machine for shouting.
  if (thread && thread.entries.length > 0) {
    const n = thread.entries.length;            // occurrences already printed
    terms.recurrence = n <= 3 ? n * 2 : Math.max(-8, 6 - (n - 3) * 3);
    why.push(n === 1 ? 'it has happened once before'
      : n <= 3 ? `it has now happened ${n + 1} times, which is a pattern`
        : `it keeps happening, which is no longer news`);
  }

  // Novelty is the mirror of recurrence and they are not in conflict: a thing
  // that never happens is news the first time, and a thing that keeps
  // happening is news the fourth time. The trough is in between.
  if (daysSinceSimilar === null) { terms.novelty = (terms.novelty ?? 0) + 3; why.push('nothing like it on file'); }
  else if (daysSinceSimilar > 21) { terms.novelty = (terms.novelty ?? 0) + 2; why.push('not seen for weeks'); }

  // A thing nobody can explain is the best kind of story and the most dangerous
  // kind to print, which is why it interacts with sourcing rather than standing alone.
  if (!knownCause) { terms.mystery = (terms.mystery ?? 0) + 3; why.push('no official explanation'); }

  const score = Object.values(terms).reduce((total, value) => total + value, 0);
  return { score, terms, why };
}

export const isNewsworthy = result => result.score >= NEWSWORTHY_FLOOR;
