// Rebuilding the supporting cast's presence from committed history.
//
// WHY THIS EXISTS, since it is a correction and should read as one.
//
// The first shadow run reported that Emily and Yukon appeared at none of 751
// opportunities, and I wrote that up as a production truth: that Worldstream
// did not simulate them. **That was wrong.** Worldstream tracks both in
// `state.offscreenLives.people`, with a last-seen location, accumulated
// knowledge, encounter history and a current project — Emily on the swing in
// Big Ben Plaza, "get the chains to go slack at the top, which is a rule she
// made up"; Yukon in the MI6 gaming room, retrying the section that keeps
// beating him. `adapter.locateEveryone` already reads that field.
//
// The reason they never appeared is that the shadow runner rewinds state with
// `contextAtEvent`, which is production's *cinematic* rewind. It returns
// characters, relationships, weather, factions, pressure and events — and
// nothing else. `snapshot.offscreenLives` was `undefined` at every opportunity,
// so `locateEveryone` had nobody to find. The engine was not ignoring the
// supporting cast; it was never shown them.
//
// So this module reconstructs the field, forward from committed events only.
// Not from the world's final state: Emily's last-seen position at the end of a
// run is not where she was on day three, and reading it back would be an
// anachronism of exactly the kind `assertNoSpoiler` exists to prevent. Every
// value here is derived from an event at or before the moment it describes.

import { MINUTE_MS as MIN } from '../../src/time.mjs';
import { offscreenNightPlace, offscreenAwakeAtNight } from '../../src/offscreen-lives.mjs';

// ------------------------------------------------------------------- tiers
//
// Not everybody is promoted to a lead. Three levels, and the difference between
// them is how long a sighting keeps someone "here" and how much the world knows
// about what they are doing.
export const TIERS = Object.freeze({
  // Tracked supporting actor. Yukon genuinely occupies the MI6 world alongside
  // the leads — same building, a room of his own, a running project — so a
  // sighting stays good for a while and his activity is real rather than
  // generic. He does not get a lead's scheduling complexity.
  yukon: Object.freeze({ tier: 'tracked', presenceMinutes: 240 }),

  // Sparse persistent actor. Emily is deliberately *not* given a timetable.
  // She is present shortly after she has actually been seen and not otherwise,
  // which keeps her presence occasional and a little unaccountable — that is
  // the character, and a normal NPC routine would flatten it.
  emily: Object.freeze({ tier: 'sparse', presenceMinutes: 45 }),
});

/** Everyone else Worldstream carries offscreen: sparse, and not in the lab cast. */
export const DEFAULT_TIER = Object.freeze({ tier: 'sparse', presenceMinutes: 45 });

export const tierOf = who => TIERS[who] ?? DEFAULT_TIER;

// What a project family means as a present-tense activity. `gaming` and
// `unhurried_time` are both in production's INTERRUPTIBLE list, so a character
// doing either can be spoken to — which is the point of tracking it at all.
const ACTIVITY_BY_FAMILY = Object.freeze({
  game_retry: 'gaming',
  the_swing: 'unhurried_time',
  verse_revision: 'unhurried_time',
  lyric_cutting: 'unhurried_time',
  rhythm_practice: 'unhurried_time',
  liaison_notes: 'unhurried_time',
});

/**
 * Fold one committed event into the reconstruction. Call in `seq` order while
 * walking the ledger; the result describes the world as of that event and
 * carries nothing from later ones.
 */
export function noteEvent(people, event) {
  const payload = event.payload ?? {};
  // SIDE_PRESENCE names its subject differently, and carries its own area —
  // General Henderson coming through on his rounds is a sighting like any other.
  const guest = payload.guest ?? payload.who;
  if (!guest || !event.location) return people;

  const record = people[guest] ??= { knowledge: [], project: null, lastSeen: null, sightings: 0 };
  record.lastSeen = { at: event.occurredAt, location: event.location,
    area: payload.area ?? event.area ?? 'venue', eventId: event.id };
  record.sightings += 1;

  if (payload.family) {
    record.project = { id: payload.offscreenStoryId ?? null, family: payload.family,
      subject: payload.subject ?? null, stage: payload.stage ?? null,
      attempt: payload.attempt ?? null,
      // Where the project is happening. Omitted in the first version, and the
      // omission was silent: `contestFacts` matches a project's location
      // against the opportunity's, so every contest failed to match and
      // COMPETITIVE_RETRY never spawned an instance at all — it did not even
      // appear in the blocked list, which is what gave it away.
      location: event.location, area: payload.area ?? event.area ?? 'venue',
      // `settled` arrives as an outcome rather than a status.
      status: payload.outcome === 'settled' ? 'settled' : 'open' };
  }
  // What they now know, in the same shape `knownKeys` reads for a lead. A result
  // they produced is a thing they learned; anti-telepathy still applies, because
  // this lands only on their own record.
  if (payload.stage === 'result' && payload.offscreenStoryId) {
    const factKey = `${payload.offscreenStoryId}:result:${payload.attempt ?? 1}`;
    if (!record.knowledge.some(item => item.factKey === factKey))
      record.knowledge.push({ factKey, learnedAt: event.occurredAt,
        sourceEventId: event.id, validUntil: null });
  }
  return people;
}

/**
 * Present the reconstruction in the shape `snapshot.offscreenLives` has, so the
 * adapter reads it through the same path it already uses for a live world.
 *
 * `now` matters: a sighting only counts while it is inside the person's tier
 * window, so this is a view of the reconstruction rather than a dump of it.
 */
export function offscreenLivesAt(people, now, seed = '') {
  const out = {};
  for (const [who, record] of Object.entries(people)) {
    if (!record.lastSeen || record.lastSeen.at > now) continue;
    const tier = tierOf(who);

    // Night residence, from production's own declaration. A tracked figure whose
    // last sighting has gone cold is not nowhere at three in the morning — he is
    // asleep in the quarters, which is where the world says he sleeps. This
    // invents no sighting and no journey: it reads `NIGHT_RESIDENCE`, which is a
    // constant, and applies it only in the dark.
    const home = offscreenNightPlace(who, now);
    if (home) {
      const awake = offscreenAwakeAtNight(who, now, seed);
      out[who] = {
        lastSeen: { at: now, location: home.location, area: home.area, eventId: null },
        knowledge: record.knowledge.filter(item => item.learnedAt <= now),
        currentProject: record.project,
        // Asleep almost every night. Awake is the rare case, and it is the only
        // one in which anything can happen.
        activity: awake ? 'unhurried_time' : home.activity,
        tier: tier.tier, atNightResidence: true, awakeAtNight: awake,
      };
      continue;
    }

    if (now - record.lastSeen.at > tier.presenceMinutes * MIN) continue;
    out[who] = {
      lastSeen: record.lastSeen,
      knowledge: record.knowledge.filter(item => item.learnedAt <= now),
      // Carried so a Moment can be *about* the odd thing they are doing rather
      // than merely co-located with it.
      currentProject: record.project,
      activity: ACTIVITY_BY_FAMILY[record.project?.family] ?? 'unhurried_time',
      tier: tier.tier,
    };
  }
  return { version: 1, people: out };
}

/** Diagnostic only: who the reconstruction knows about at all, and how often seen. */
export const rosterOf = people => Object.fromEntries(
  Object.entries(people).map(([who, record]) => [who,
    { sightings: record.sightings, tier: tierOf(who).tier,
      lastSeen: record.lastSeen?.location ?? null }]));
