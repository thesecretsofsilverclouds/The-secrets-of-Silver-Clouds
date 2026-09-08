import { openWorld } from '../../src/world.mjs';
import { atLondon, londonDate, MINUTE_MS as MIN } from '../../src/time.mjs';
import { translate } from '../engine/adapter.mjs';
import { validateProposal } from '../engine/validate.mjs';
import { evaluateMomentOpportunity, viewFrom, MOMENT_RULES } from '../engine/engine.mjs';
import { PRACTICES } from '../grammar/practices.mjs';
import { CAST, CAST_IDS } from '../grammar/cast.mjs';

// One run of the world, with the Moment Engine either attached or not.
//
// The control and the lab share this file on purpose. The only difference
// between the two runs is the boolean, so a difference in the output cannot be
// a difference in how the world was driven.
//
// Worldstream is never modified. The engine reads a snapshot, proposes, and the
// proposal is validated and recorded in the lab's own ledger. Nothing is
// written back into the world database — which means the lab measures what the
// engine *would* contribute, and deliberately does not let it perturb the
// simulation it is being compared against. That is the only way the two runs
// stay comparable.

// Bounded opportunity triggers. The engine is not asked a question every
// minute; it is asked when something changed that could plausibly make a
// moment available. Section 21 of the brief, implemented literally.
export const TRIGGERS = Object.freeze({
  ACTIVITY_COMPLETE: 'activity_completed',
  PRACTICE_END: 'activity_completed',
  END_ENCOUNTER: 'encounter_ended',
  CROSS_PATHS: 'newly_co_present',
  TRAVEL_ARRIVE: 'arrived',
  OFFSCREEN_START: 'guest_appeared',
  OFFSCREEN_ENCOUNTER: 'guest_appeared',
  OFFSCREEN_WITNESS: 'guest_appeared',
  WEATHER_CHANGE: 'environment_changed',
  INSTITUTION_NOTICE: 'environment_changed',
  MINOR_ANOMALY: 'environment_changed',
  WEATHER_DISRUPTION: 'environment_changed',
  MOMENT_NOTICED: 'shared_moment',
  SUPPORTING_ENCOUNTER: 'newly_co_present',
  VENUE_SCENE: 'newly_co_present',
});

const BLOCK = 30 * MIN;

// What is worth noticing somebody else do. Everything else happens and is not
// remarked on, which is most of what happens.
const UNUSUAL = new Set(['fade_bypass', 'count_pattern', 'literal_answer']);

// How long a persisted experience stays usable. Deliberately short and
// deliberately different per kind: seeing somebody do something odd stays with
// you for an afternoon, a question wants answering soon, and an answer closes
// the exchange. None of these is a memory of the event — Worldstream owns
// that — they are only the minimum needed to make the next affordance reachable.
const EXPERIENCE_MINUTES = { observed: 180, asked: 60, answered: 240 };

// Imported in spirit from src/callbacks.mjs, whose CALLBACK_REGISTRY holds the
// coat exchange and the event it came from. The lab restates it as an
// affordance so the engine can reach it; production would read the registry.
const SEEDED_CALLBACKS = [
  { key: 'coat_comfortable', by: 'ashai', about: 'goaden', topic: 'coat_comfortable',
    sourceEventId: 'evt:f46a2e1c5fa492b815b1eea75457bf6a', spent: false },
  { key: 'coat_comfortable_g', by: 'goaden', about: 'ashai', topic: 'coat_comfortable',
    sourceEventId: 'evt:f46a2e1c5fa492b815b1eea75457bf6a', spent: false },
];

function readState(world) {
  return JSON.parse(world.db.prepare('SELECT state_json FROM world_state WHERE id=1').get().state_json);
}
function readEventsSince(world, seq) {
  return world.db.prepare('SELECT seq, semantic_json FROM events WHERE seq > ? ORDER BY seq').all(seq)
    .map(row => ({ seq: row.seq, ...JSON.parse(row.semantic_json) }));
}

/**
 * @param {object} options
 * @param {boolean} options.momentEngine  false = control baseline.
 */
export function runWorld({ startDate = '2026-03-02', days = 30, seed, momentEngine = true,
  rules = MOMENT_RULES, collectAudits = false } = {}) {
  const startMs = atLondon(startDate, '00:00');
  const world = openWorld({ dbPath: ':memory:', startMs, seed });
  const target = startMs + days * 86_400_000;

  const moments = [];      // surfaced: what a reader is shown
  const actions = [];      // canonical: what characters actually did
  const lifespan = {};     // years permanently spent, whether shown or not
  const rejections = [];
  const audits = [];
  const opportunities = [];
  const history = { byCharacter: {}, world: [] };
  const notices = [];     // short-lived public events that create affordances
  const experiences = []; // observed / asked / answered, scoped to who was there
  // Callbacks Worldstream already owns. src/callbacks.mjs holds the coat
  // exchange with its origin event; the engine consumes it as an affordance
  // rather than authoring a second copy, which is the whole point of section 16
  // — a past event enlarges the set of actions available now.
  const callbacks = SEEDED_CALLBACKS.map(item => ({ ...item, expiresAt: startMs + 400 * 86_400_000 }));
  const witnessed = [];   // what somebody actually saw somebody else do
  const stats = { blocks: 0, triggersSeen: 0, evaluations: 0, engineMs: 0,
    refusals: {}, worldEvents: 0, publicEvents: 0 };

  let watermark = startMs, lastSeq = 0;
  const t0 = process.hrtime.bigint();

  while (watermark < target) {
    const step = Math.min(target, watermark + BLOCK);
    watermark = world.advance(step).resolvedThrough;
    stats.blocks += 1;

    const fresh = readEventsSince(world, lastSeq);
    if (fresh.length) lastSeq = fresh.at(-1).seq;
    stats.worldEvents += fresh.length;
    stats.publicEvents += fresh.filter(event => event.visibility === 'public').length;

    if (!momentEngine) continue;

    // Notices are events, not states: the bell rang, it is not ringing. They
    // are carried for a short window so a behaviour can bind to something that
    // only exists for the next twenty minutes.
    for (const event of fresh)
      if (event.payload?.notice || event.payload?.moment)
        notices.push({ at: event.occurredAt, key: event.payload.notice ?? event.payload.moment });

    // One opportunity per distinct place that a trigger touched in this block.
    const places = new Map();
    for (const event of fresh) {
      const trigger = TRIGGERS[event.type];
      if (!trigger) continue;
      stats.triggersSeen += 1;
      const key = `${event.location}/${event.area ?? 'venue'}`;
      if (!places.has(key)) places.set(key, { trigger, event });
    }
    if (!places.size) continue;

    const state = readState(world);
    const day = londonDate(watermark);

    for (const [key, { trigger, event }] of places) {
      const [location, area] = key.split('/');
      const active = callbacks.filter(item => item.expiresAt > watermark);
      const seenHere = witnessed.filter(item => watermark - item.at < 6 * 60 * MIN);
      const { sentences, present, inputs } =
        translate(state, { now: watermark, location, area, callbacks: active,
          witnessed: seenHere, castIds: CAST_IDS,
          experiences: experiences.filter(item => item.expiresAt > watermark),
          recentNotices: notices.filter(item => watermark - item.at < 40 * MIN).map(item => item.key) });
      if (present.length === 0) continue;
      opportunities.push({ at: watermark, day, location, area, trigger, present: present.length });

      const started = process.hrtime.bigint();
      const { proposal, audit, chosen } = evaluateMomentOpportunity({
        now: watermark, day, location, area, presentCharacters: present,
        view: viewFrom(sentences), practices: PRACTICES, cast: CAST,
        history, arcConstraints: arcConstraintsFor(state, watermark),
        seed: seed ?? 'silver-clouds-now-v1', rules, trigger,
        worldEventInputs: [event.id, ...inputs],
      });
      stats.engineMs += Number(process.hrtime.bigint() - started) / 1e6;
      stats.evaluations += 1;
      if (collectAudits) audits.push(audit);
      if (audit.refusal) stats.refusals[audit.refusal] = (stats.refusals[audit.refusal] ?? 0) + 1;

      // A chosen action is canonical whether or not a reader is shown it. This
      // is where the author's split lands: the world records that Emily used
      // Fade and spent the ten years, every time, and whether the Reading View
      // stops to say so is a separate question answered above.
      if (chosen) {
        actions.push(chosen);
        (history.byCharacter[chosen.actor] ??= []).push({ at: watermark, day,
          family: chosen.surfacedFamily ?? chosen.family,
          behaviour: chosen.surfacedBehaviour ?? chosen.behaviour,
          surface: proposal?.presentationKey ?? null, line: proposal?.line ?? null,
          surfaced: Boolean(proposal) });
        // Cost follows what was done, not what was shown. If the surfaced
        // action is a different one, its cost counts too — the character did
        // both; only one of them made the page.
        const costed = chosen.surfacedAction && chosen.surfacedAction !== chosen.action
          ? [...chosen.effects, ...(chosen.surfacedEffects ?? [])]
          : chosen.effects;
        for (const effect of costed)
          if (effect.cost?.lifespanYears)
            lifespan[chosen.actor] = (lifespan[chosen.actor] ?? 0) + effect.cost.lifespanYears;
      }
      if (!proposal) continue;

      const verdict = validateProposal(proposal, state, { now: watermark, cast: CAST, callbacks: active });
      if (!verdict.ok) { rejections.push({ proposal, verdict }); continue; }

      moments.push(proposal);
      history.world.push({ at: watermark, day, family: proposal.family,
        behaviour: proposal.behaviour, actor: proposal.actor });

      // Committed effects become future affordances. This is the loop the brief
      // calls "memory as future affordance": a moment now enlarges the set of
      // actions available later, rather than merely being displayed later.
      for (const item of proposal.callbackSeedsCreated)
        callbacks.push({ key: item.key.replace(/[^a-zA-Z0-9]+/g, '_'), by: proposal.actor,
          about: proposal.target ?? null, topic: item.topic ?? null,
          sourceEventId: proposal.id, spent: false,
          expiresAt: watermark + (item.lifespanDays ?? 14) * 86_400_000 });
      // A callback is spent when it is used. Without this the same earned line
      // is available every time the two of them are in a room, which is the
      // brief's "quip exhaustion" failure arriving within two days.
      for (const effect of verdict.effects)
        if (effect.kind === 'callback_used') {
          const used = active.find(item => item.key === proposal.roles.Key);
          if (used) used.spent = true;
        }
      // Persisted experience, recorded once per person who was actually in the
      // room. This is the whole anti-telepathy rail for the chain: the observer
      // list is the present cast, so somebody elsewhere never acquires the
      // sentence and therefore never acquires the affordance.
      for (const effect of proposal.requestedEffects) {
        if (!effect.experience) continue;
        const thing = proposal.roles.Thing ?? proposal.roles.Other ?? proposal.action;
        const minutes = EXPERIENCE_MINUTES[effect.experience] ?? 120;
        const observers = effect.experience === 'observed'
          ? present.filter(who => who !== proposal.actor)   // who saw it happen
          : [proposal.actor];                               // who did the asking/answering
        for (const observer of observers)
          experiences.push({ kind: effect.experience, observer,
            actor: effect.experience === 'observed' ? proposal.actor : (proposal.target ?? proposal.roles.Other),
            thing, at: watermark, expiresAt: watermark + minutes * MIN, eventId: proposal.id });
      }

      // Only genuinely strange behaviour is witnessable. Somebody sitting down
      // is not an event in anybody's memory, and treating it as one turns
      // NOTICE_UNUSUAL_BEHAVIOUR into a machine for remarking on nothing.
      if (UNUSUAL.has(proposal.presentationKey))
        for (const other of present) {
          if (other === proposal.actor) continue;
          witnessed.push({ observer: other, actor: proposal.actor,
            what: proposal.presentationKey === 'fade_bypass' ? 'used_fade' : proposal.presentationKey,
            at: watermark, eventId: proposal.id });
        }
    }
  }

  const totalMs = Number(process.hrtime.bigint() - t0) / 1e6;
  const snapshotEvents = readEventsSince(world, 0);
  world.close();
  return { moments, actions, lifespan, rejections, audits, opportunities, stats: { ...stats, totalMs },
    events: snapshotEvents, days, startDate, momentEngine, callbacks, witnessed };
}

/**
 * Arc precedence, read off Worldstream's own arc state. An arc that is mid-beat
 * owns its characters outright; the engine is not asked for an opinion.
 */
export function arcConstraintsFor(state, now) {
  const arcs = state.arcs;
  const active = arcs?.activeId ? arcs.instances?.[arcs.activeId] : null;
  if (!active) return {};
  const beatDue = Object.values(active.beats ?? {}).some(beat =>
    beat.status === 'pending' && Math.abs((beat.dueAt ?? 0) - now) < 90 * MIN);
  if (beatDue) return { hardObligation: true, reason: `arc ${active.storyId ?? arcs.activeId} is mid-beat` };
  return { activeArc: arcs.activeId };
}
