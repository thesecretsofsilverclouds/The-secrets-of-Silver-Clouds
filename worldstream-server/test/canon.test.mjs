import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { openWorld, semanticDigest } from '../src/world.mjs';
import { createFixture, DEFAULT_SEED, EVENT_TYPES, knowsFact, canEnterSanctuary, assertCanonState, themeForDay,
  weatherForDay, isShelterWeather, isTravelDelayWeather, factionsForDay, isRecallDay, cityKindForDay,
  FACTION_LEVELS, LOCATION_MODES, ACTIVITY_DAYPARTS, locationMode, permitsActivity, permitsDaypart,
  assertScheduleWindows, THEME_NAMES, scheduleJitter, RELATIONSHIP_BANDS, veilForDate } from '../src/fixture.mjs';
import { atLondon, nextLondonDay, prevLondonDay, londonDate } from '../src/time.mjs';
import { LEGION_CAST, OUTSIDE_CAST, SIDE_CHARACTERS } from '../src/cast.mjs';
import { veilDateForYear } from '../src/veil.mjs';
import { EXCHANGES, MOODS, GOADEN_PLATES, ASHAI_PLATES, moodFor, linesOf } from '../src/dialogue.mjs';
import { DAYPARTS, DAY_PHASES, daypart, dayPhase, daylightFraction, sunEvents } from '../src/sky.mjs';
import { THREAD_EVENT_TYPES } from '../src/threads.mjs';
import { applyChange, readChange, sideOf } from '../src/ledger.mjs';
import { SUPPORTING_EVENT_TYPES } from '../src/supporting-stories.mjs';
import { OFFSCREEN_EVENT_TYPES } from '../src/offscreen-lives.mjs';
import { NIGHT_EVENT_TYPES } from '../src/night-stories.mjs';
import { ARC_EVENT_TYPES } from '../src/arcs.mjs';

const START = atLondon('2026-09-04', '00:00');
// One full turn of the theme rotation, so every theme is exercised once.
const END = atLondon('2026-09-15', '00:00');
const RAINY_CODES = new Set(['light_rain', 'heavy_rain', 'storm']);
const MINUTE = 60_000;
const WORLD_URL = new URL('../src/world.mjs', import.meta.url).href;
const fixtureDefinition = createFixture({ startMs: START });

function storage(t) {
  const directory = mkdtempSync(join(tmpdir(), 'silver-clouds-now-canon-test-'));
  const stores = [];
  t.after(() => {
    for (const world of stores) world.close();
    const resolved = realpathSync(directory);
    if (dirname(resolved) !== realpathSync(tmpdir()) || !basename(resolved).startsWith('silver-clouds-now-canon-test-')) {
      throw new Error(`Refusing unexpected cleanup target: ${resolved}`);
    }
    rmSync(resolved, { recursive: true, force: true });
  });
  return {
    path: (name = 'world') => join(directory, `${name}.sqlite`),
    open(name = 'world', options = { seed: DEFAULT_SEED, startMs: START }) {
      const world = openWorld({ dbPath: join(directory, `${name}.sqlite`), ...options });
      stores.push(world);
      return world;
    },
  };
}

function same(actual, expected) {
  assert.deepEqual(actual, expected);
  assert.equal(semanticDigest(actual), semanticDigest(expected));
  assert.equal(new Set(actual.events.map(event => event.id)).size, actual.events.length);
}

function dayFor(theme) {
  for (let day = '2026-09-04', count = 0; count < THEME_NAMES.length; count++, day = nextLondonDay(day)) {
    if (themeForDay(day, DEFAULT_SEED) === theme) return day;
  }
  throw new Error(`The fixture window does not contain ${theme}`);
}

// Every day within a horizon carrying a theme, in order. A themed day is only an
// *intention* — the director and the pressure axis are both allowed to take the
// evening off it — so a test about what the day contains has to be free to walk
// to the next one rather than pinning the first.
function daysFor(theme, limit = 6, horizon = 120) {
  const days = [];
  for (let day = '2026-09-04', count = 0; count < horizon && days.length < limit; count++, day = nextLondonDay(day)) {
    if (themeForDay(day, DEFAULT_SEED) === theme) days.push(day);
  }
  if (!days.length) throw new Error(`The fixture window does not contain ${theme}`);
  return days;
}

// The first day within a long horizon whose deterministic inputs satisfy a predicate.
function dayWhere(predicate, horizon = 400) {
  for (let day = '2026-09-04', count = 0; count < horizon; count++, day = nextLondonDay(day)) {
    if (predicate(day)) return day;
  }
  throw new Error('No qualifying day within the search window');
}

// Ground work may occupy Ashai when the first invitation conversation was
// intended. These admission/projection controls need a genuinely agreed visit;
// later negative cases still remove exactly the permission or knowledge tested.
function dayWithAcceptedInvitation(f, label) {
  const probe = f.open(`${label}-eligible-invitation`);
  for (const day of daysFor('invitation')) {
    probe.advance(atLondon(day, '13:14'));
    const snapshot = probe.semanticSnapshot();
    if (canEnterSanctuary(snapshot, atLondon(day, '14:55'), ['goaden', 'ashai'], `${day}:invite`)
      && snapshot.arrangements[`${day}:outing`]?.status === 'accepted'
      && snapshot.arrangements[`${day}:outing`]?.public) return day;
  }
  assert.fail('The bounded calendar must contain an actually agreed daytime Sanctuary visit');
}

function nextAction(world, type) {
  const action = world.semanticSnapshot().pendingActions.find(action => action.type === type);
  assert.ok(action, `Expected pending ${type}`);
  return structuredClone(action);
}

function reduce(snapshot, action) {
  const state = structuredClone(snapshot);
  const result = fixtureDefinition.reduceAction(state, structuredClone(action), DEFAULT_SEED);
  return { state, ...result };
}

function writer(t, dbPath) {
  const program = `
    import { openWorld, semanticDigest } from ${JSON.stringify(WORLD_URL)};
    const world = openWorld({ dbPath: ${JSON.stringify(dbPath)} });
    process.once('message', () => {
      try {
        const result = world.advance(${END});
        const digest = semanticDigest(world.semanticSnapshot());
        world.close();
        process.send({type:'result', result, digest}, () => process.disconnect());
      } catch (error) {
        world.close();
        process.send({type:'failure', message:error.stack}, () => process.disconnect());
        process.exitCode = 1;
      }
    });
    process.send({type:'ready', pid:process.pid});
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', program], {
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true,
  });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  let stderr = '', delivered;
  child.stderr.on('data', chunk => { stderr += chunk; });
  let readyResolve, readyReject, doneResolve, doneReject;
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  const completed = new Promise((resolve, reject) => { doneResolve = resolve; doneReject = reject; });
  const fail = error => { readyReject(error); doneReject(error); };
  const timer = setTimeout(() => { fail(new Error(`Writer timed out: ${stderr}`)); child.kill(); }, 20_000);
  child.on('message', message => {
    if (message.type === 'ready') readyResolve(message);
    if (message.type === 'result') delivered = message;
    if (message.type === 'failure') fail(new Error(message.message));
  });
  child.on('error', error => { clearTimeout(timer); fail(error); });
  child.on('exit', code => {
    clearTimeout(timer);
    if (code === 0 && delivered) doneResolve(delivered);
    else fail(new Error(`Writer exited ${code}: ${stderr}`));
  });
  return { child, ready, completed };
}

test('A–D: one theme rotation has identical facts with frequent, one-shot, irregular restart and duplicate advances', t => {
  const f = storage(t);
  const absent = f.open('absent');
  absent.advance(END);
  const expected = absent.semanticSnapshot();
  assert.deepEqual(new Set(expected.events.filter(e => e.type === 'WEATHER_CHANGE').map(e => e.payload.theme)),
    new Set(THEME_NAMES));

  const frequent = f.open('frequent');
  for (let time = START + 43 * MINUTE; time < END; time += 43 * MINUTE) {
    frequent.advance(time);
    frequent.publicProjection();
  }
  frequent.advance(END);
  same(frequent.semanticSnapshot(), expected);

  let irregular = f.open('irregular');
  // The new reservations and faction work can legitimately prevent the first
  // intended outing. Restart during a journey that actually happened, keeping
  // the persistence assertion about transit rather than a scripted calendar.
  const journey = expected.events.flatMap(event => event.changes)
    .find(change => change.entity === 'character' && change.id === 'goaden' && change.field === 'journey'
      && change.after?.arrivesAt > change.after?.departedAt
      && change.after.arrivesAt < START + (END - START) * 0.57)?.after;
  assert.ok(journey, 'The comparison horizon must include a real Goaden journey before the later restart targets');
  irregular.advance(Math.floor((journey.departedAt + journey.arrivesAt) / 2));
  assert.equal(irregular.semanticSnapshot().characters.goaden.location, 'streamliner');
  const inTransit = irregular.semanticSnapshot();
  irregular.close();
  irregular = f.open('irregular', {});
  same(irregular.semanticSnapshot(), inTransit);
  for (const fraction of [0.57, 0.71, 0.93, 1]) irregular.advance(Math.round(START + (END - START) * fraction));
  same(irregular.semanticSnapshot(), expected);

  const duplicate = f.open('duplicate');
  for (let day = '2026-09-04'; day !== '2026-09-15'; day = nextLondonDay(day)) {
    for (const time of ['08:20', '13:17', '16:35', '23:59']) {
      const target = atLondon(day, time);
      duplicate.advance(target);
      const committed = duplicate.semanticSnapshot();
      for (let n = 0; n < 3; n++) {
        assert.equal(duplicate.advance(target).appendedEvents, 0);
        same(duplicate.semanticSnapshot(), committed);
      }
    }
  }
  duplicate.advance(END);
  same(duplicate.semanticSnapshot(), expected);
});

test('E: independent processes advance the same persisted canon world without duplicate facts', async t => {
  const f = storage(t);
  const baseline = f.open('baseline');
  baseline.advance(END);
  const expected = baseline.semanticSnapshot();
  f.open('shared').close();
  const workers = Array.from({ length: 4 }, () => writer(t, f.path('shared')));
  const completed = Promise.all(workers.map(worker => worker.completed));
  completed.catch(() => {});
  const ready = await Promise.all(workers.map(worker => worker.ready));
  assert.equal(new Set(ready.map(message => message.pid)).size, workers.length);
  for (const worker of workers) worker.child.send('advance');
  const results = await completed;
  assert.equal(results.filter(({ result }) => result.appendedEvents > 0).length, 1);
  assert.equal(results.reduce((sum, { result }) => sum + result.appendedEvents, 0), expected.events.length);
  for (const result of results) assert.equal(result.digest, semanticDigest(expected));
  same(f.open('shared', {}).semanticSnapshot(), expected);
});

test('reads, stale requests and a failed commit cannot mutate or partially advance canon history', t => {
  const f = storage(t);
  let world = f.open();
  world.advance(atLondon('2026-09-04', '13:17'));
  const before = world.semanticSnapshot();
  const stats = world.operationalStats();
  for (let count = 0; count < 100; count++) world.publicProjection();
  assert.equal(world.advance(START).appendedEvents, 0);
  assert.throws(() => world.advance(END, { failBeforeCommit: true }), /Injected failure/);
  same(world.semanticSnapshot(), before);
  assert.deepEqual(world.operationalStats(), stats);
  world.close();
  world = f.open('world', {});
  same(world.semanticSnapshot(), before);
  const baseline = f.open('baseline');
  baseline.advance(END);
  world.advance(END);
  same(world.semanticSnapshot(), baseline.semanticSnapshot());
  assert.throws(() => f.open('world', { seed: 'different-seed' }), /seed differs/);
  assert.throws(() => f.open('world', { startMs: START + 86_400_000 }), /epoch differs/);
});

test('ledger replays every state change with prior causes, timed acquisition and stable canon anchors', t => {
  const f = storage(t);
  const world = f.open();
  const initial = world.semanticSnapshot();
  world.advance(END);
  const final = world.semanticSnapshot();
  const replay = structuredClone(initial);
  const byId = new Map();
  let priorTime = START;
  for (const event of final.events) {
    assert.ok(EVENT_TYPES.includes(event.type), `Unapproved type ${event.type}`);
    assert.ok(event.occurredAt >= priorTime && event.occurredAt <= END);
    for (const cause of event.causedBy) {
      assert.ok(cause.startsWith('canon-seed:') || byId.has(cause), `Missing or future cause ${cause}`);
    }
    for (const change of event.changes) {
      // 'director' is the pacing ledger added in v13. It lives on the state
      // root like 'world' does, and is labelled separately so the canon rails
      // can tell world state from the director's own bookkeeping.
      const target = ['world', 'director', 'pressure', 'story'].includes(change.entity) ? replay
        : change.entity === 'character' ? replay.characters[change.id]
        : replay.relationships.find(pair => `${pair.from}->${pair.to}` === change.id);
      assert.ok(target, `Unknown entity ${change.entity}/${change.id}`);
      // A change is a leaf now — one position inside a bag — so the audit reads
      // and writes through the same applier the world itself uses. The
      // guarantee is unchanged, and it is still the strongest one here: every
      // recorded before-value must match the state the replay actually reached.
      assert.deepEqual(readChange(target, change), sideOf(change, 'before'),
        `Broken replay before-value at ${event.id}`);
      applyChange(target, change, 'after');
    }
    byId.set(event.id, event);
    assertCanonState(replay);
    assert.deepEqual(replay.meta.canonAnchors, initial.meta.canonAnchors);
    for (const id of ['goaden', 'ashai']) {
      assert.deepEqual(replay.characters[id].body, initial.characters[id].body);
      for (const memory of replay.characters[id].knowledge) {
        assert.ok(memory.learnedAt <= event.occurredAt, 'Memory was learned in the future');
        if (memory.provenance === 'canon_seed') continue;
        assert.ok(byId.has(memory.sourceEventId));
        assert.ok(byId.has(memory.acquisitionEventId));
        assert.ok(byId.get(memory.sourceEventId).occurredAt <= memory.learnedAt);
        assert.equal(byId.get(memory.acquisitionEventId).occurredAt, memory.learnedAt);
      }
    }
    priorTime = event.occurredAt;
  }
  for (const key of ['meta', 'characters', 'relationships', 'weather', 'factions', 'facts', 'invitations', 'arrangements', 'plans', 'games', 'encounter', 'director', 'pressure', 'storyEffects', 'threads', 'intent', 'agendas', 'abilities']) {
    assert.deepEqual(replay[key], final[key], `Replay differs in ${key}`);
  }
  assert.ok(final.pendingActions.every(action => action.dueAt > final.world.resolvedThrough));
});

test('a knowledge-dependent offer cannot use absent, future or expired information', t => {
  const f = storage(t);
  const world = f.open();
  const day = dayFor('fatigue');
  world.advance(atLondon(day, '13:51'));
  const snapshot = world.semanticSnapshot();
  const offer = nextAction(world, 'OFFER_ACTIVITY');
  const informed = reduce(snapshot, offer);
  assert.equal(informed.event.payload.usedKnowledge, true);
  assert.equal(informed.event.payload.outcome, 'short_game');
  for (const variant of ['absent', 'future', 'expired']) {
    const altered = structuredClone(snapshot);
    const actor = altered.characters.ashai;
    const memory = actor.knowledge.find(m => m.factKey === offer.requiredFact);
    assert.ok(memory, 'Positive control requires acquired break preference');
    if (variant === 'absent') actor.knowledge = actor.knowledge.filter(m => m !== memory);
    if (variant === 'future') memory.learnedAt = offer.dueAt + 1;
    if (variant === 'expired') memory.validUntil = offer.dueAt;
    assert.equal(knowsFact(actor, offer.requiredFact, offer.dueAt), undefined);
    const result = reduce(altered, offer);
    assert.equal(result.event.payload.usedKnowledge, false, variant);
    assert.equal(result.event.payload.outcome, 'game', variant);
    assert.equal(result.state.arrangements[offer.arrangementKey].knowledgeSource, null);
  }
});

test('a known cause replaces a queued optional activity; missing knowledge preserves it and mandatory plans resist replacement', t => {
  const f = storage(t);
  const world = f.open();
  world.advance(atLondon(dayFor('invitation'), '12:46'));
  const snapshot = world.semanticSnapshot();
  const change = nextAction(world, 'PLAN_CHANGE');
  const plannedActivity = snapshot.pendingActions.find(action => action.type === 'PRACTICE_BEGIN' && action.planKey === change.planKey);
  assert.ok(plannedActivity, 'The changed plan must refer to a real queued activity');
  assert.equal(snapshot.plans[change.planKey].status, 'scheduled');

  const informed = reduce(snapshot, change);
  assert.equal(informed.state.plans[change.planKey].status, 'replaced');
  assert.equal(informed.state.plans[change.planKey].decisionEventId, informed.event.id);
  const knowledge = snapshot.characters.goaden.knowledge.find(memory => memory.factKey === change.factKey);
  assert.ok(knowledge);
  assert.ok(informed.event.causedBy.includes(knowledge.sourceEventId));
  assert.ok(informed.event.causedBy.includes(knowledge.acquisitionEventId));
  const afterReplacement = reduce(informed.state, plannedActivity);
  assert.equal(afterReplacement.event.payload.outcome, 'skipped');
  assert.notEqual(afterReplacement.state.characters.goaden.activity, 'training');

  const uninformed = structuredClone(snapshot);
  uninformed.characters.goaden.knowledge = uninformed.characters.goaden.knowledge.filter(memory => memory.factKey !== change.factKey);
  const unchanged = reduce(uninformed, change);
  assert.equal(unchanged.event.payload.outcome, 'skipped');
  assert.equal(unchanged.state.plans[change.planKey].status, 'scheduled');
  assert.equal(reduce(unchanged.state, plannedActivity).state.characters.goaden.activity, 'training');

  const mandatory = structuredClone(snapshot);
  mandatory.plans[change.planKey].optional = false;
  assert.throws(() => reduce(mandatory, change), /future optional activity/);
});

test('night rest persists across midnight until breakfast instead of completing after thirty minutes', t => {
  const f = storage(t);
  const world = f.open();
  const day = '2026-09-04', nextDay = nextLondonDay(day);
  // Routine times carry a small deterministic offset, so each of them turns in
  // and sits down to breakfast on their own minute rather than in lockstep.
  const scheduled = (date, id, time) => atLondon(date, time) + scheduleJitter(DEFAULT_SEED, date, id) * MINUTE;
  const sleepSince = actor => scheduled(day, `night-${actor}`, '22:30');
  const breakfast = actor => scheduled(nextDay, `breakfast-${actor}`, '08:00');
  for (const target of [atLondon(day, '23:30'), atLondon(nextDay, '07:30')]) {
    world.advance(target);
    for (const actor of Object.values(world.semanticSnapshot().characters)) {
      assert.equal(actor.activity, 'sleeping');
      assert.equal(actor.activitySince, sleepSince(actor.id));
      assert.equal(actor.activityUntil, null);
    }
  }
  world.advance(Math.max(breakfast('goaden'), breakfast('ashai')));
  for (const actor of Object.values(world.semanticSnapshot().characters)) {
    assert.equal(actor.activity, 'eating');
    assert.equal(actor.activitySince, breakfast(actor.id));
  }
});

test('sharing requires an actual common-space encounter; the building alone does not teach a fact', t => {
  const f = storage(t);
  const world = f.open();
  world.advance(atLondon(dayWithAcceptedInvitation(f, 'sharing'), '13:10'));
  const action = nextAction(world, 'SHARE_PRACTICAL_FACT');
  const snapshot = world.semanticSnapshot();
  assert.equal(knowsFact(snapshot.characters.ashai, action.factKey, action.dueAt), undefined);
  assert.ok(knowsFact(reduce(snapshot, action).state.characters.ashai, action.factKey, action.dueAt));
  for (const variant of ['no_encounter', 'different_room']) {
    const altered = structuredClone(snapshot);
    if (variant === 'no_encounter') altered.encounter = null;
    else altered.characters.ashai.area = 'quarters';
    const result = reduce(altered, action);
    assert.equal(result.event.payload.outcome, 'skipped');
    assert.equal(knowsFact(result.state.characters.ashai, action.factKey, action.dueAt), undefined);
  }
});

test('Sanctuary admission requires acceptance, an eligible informed party and a valid window', t => {
  const f = storage(t);
  const world = f.open();
  const day = dayWithAcceptedInvitation(f, 'admission'), key = `${day}:invite`, arrival = atLondon(day, '14:55');
  world.advance(atLondon(day, '12:46'));
  assert.equal(canEnterSanctuary(world.semanticSnapshot(), arrival, ['goaden', 'ashai'], key), false);
  world.advance(atLondon(day, '13:13'));
  const allowed = world.semanticSnapshot();
  assert.equal(canEnterSanctuary(allowed, arrival, ['goaden', 'ashai'], key), true);
  assert.equal(canEnterSanctuary(allowed, atLondon(day, '14:44'), ['goaden', 'ashai'], key), false);
  assert.equal(canEnterSanctuary(allowed, atLondon(day, '15:15'), ['goaden', 'ashai'], key), false);
  for (const variant of ['unaccepted', 'future_acceptance', 'ineligible_guest', 'unknown_guest']) {
    const altered = structuredClone(allowed);
    if (variant === 'unaccepted') altered.invitations[key].acceptedAt = null;
    if (variant === 'future_acceptance') altered.invitations[key].acceptedAt = arrival + 1;
    if (variant === 'ineligible_guest') altered.invitations[key].party = ['goaden'];
    if (variant === 'unknown_guest') altered.characters.ashai.knowledge = altered.characters.ashai.knowledge.filter(m => m.factKey !== key);
    assert.equal(canEnterSanctuary(altered, arrival, ['goaden', 'ashai'], key), false, variant);
  }
  world.advance(atLondon(day, '14:40'));
  const transit = world.semanticSnapshot(), arrivalAction = nextAction(world, 'TRAVEL_ARRIVE');
  transit.invitations[key].acceptedAt = null;
  assert.throws(() => reduce(transit, arrivalAction), /admission denied/);
});

test('invitation acceptance rejects an unknown, late or ineligible recipient', t => {
  const f = storage(t);
  const world = f.open();
  world.advance(atLondon(dayFor('invitation'), '12:45'));
  const snapshot = world.semanticSnapshot(), action = nextAction(world, 'INVITATION_ACCEPTED');
  assert.ok(reduce(snapshot, action).state.invitations[action.factKey].acceptedAt);
  for (const variant of ['unknown', 'late', 'ineligible']) {
    const altered = structuredClone(snapshot), attempted = structuredClone(action);
    if (variant === 'unknown') altered.characters.goaden.knowledge = altered.characters.goaden.knowledge.filter(m => m.factKey !== action.factKey);
    if (variant === 'late') attempted.dueAt = altered.invitations[action.factKey].replyUntil;
    if (variant === 'ineligible') altered.invitations[action.factKey].party = ['ashai'];
    const result = reduce(altered, attempted);
    assert.equal(result.event.payload.outcome, 'skipped', variant);
    assert.equal(result.state.invitations[action.factKey].acceptedAt, null, variant);
  }
});

test('an encounter cannot silently relocate a sleeping or training character into the common room', t => {
  const f = storage(t);
  const world = f.open();
  world.advance(atLondon(dayFor('invitation'), '13:09'));
  const snapshot = world.semanticSnapshot(), action = nextAction(world, 'CROSS_PATHS');
  for (const label of ['sleeping', 'training']) {
    const altered = structuredClone(snapshot);
    altered.characters.ashai.activity = label;
    altered.characters.ashai.activityUntil = action.dueAt + 30 * MINUTE;
    altered.characters.ashai.area = label === 'sleeping' ? 'quarters' : 'training';
    const result = reduce(altered, action);
    assert.equal(result.event.payload.outcome, 'skipped', label);
    assert.equal(result.state.characters.ashai.area, altered.characters.ashai.area, label);
  }
});

test('public projection excludes private state, source links and spoiler sentinels even on public events', t => {
  const f = storage(t);
  const world = f.open();
  world.advance(END);
  const snapshot = world.semanticSnapshot();
  const poisoned = structuredClone(snapshot);
  const sentinel = 'PRIVATE_FUTURE_PARENTAGE_BASEMENT_ROMANCE_SENTINEL';
  poisoned.characters.ashai.knowledge.push({ factKey: sentinel, value: sentinel });
  poisoned.characters.goaden.conditions.push({ kind: sentinel });
  poisoned.characters.ashai.body.privateNote = sentinel;
  poisoned.meta.privateNote = sentinel;
  for (const event of poisoned.events) {
    event.payload.privateNote = sentinel;
    event.causedBy.push(sentinel);
    for (const field of ['narrativeParagraphs', 'sceneBeats']) {
      for (const item of event.payload[field] ?? []) {
        item.privateNote = sentinel;
        item.sourceEventId = sentinel;
      }
    }
  }
  const projection = fixtureDefinition.publicProjection(poisoned);
  const text = JSON.stringify(projection);
  for (const forbidden of [sentinel, 'PRIVATE_ORDINARY_BREAK_PREFERENCE', 'canon-seed:', 'sourceEventId', 'acquisitionEventId', 'learnedAt', 'knowledge', 'conditions', 'canonAnchors']) {
    assert.ok(!text.includes(forbidden), `Public projection leaked ${forbidden}`);
  }
  for (const event of snapshot.events.filter(e => e.visibility === 'private')) assert.ok(!text.includes(event.id));
  for (const actor of projection.characters) {
    // `room` joined this allowlist in v13. It is the manuscript's name for the
    // section of the barracks somebody is standing in, and it is the same class
    // of public fact the activity already was — never why they are in it.
    assert.deepEqual(Object.keys(actor).filter(key => key !== 'nextTransition').sort(),
      ['activity', 'activitySince', 'activityUntil', 'id', 'journey', 'location', 'name', 'room', 'upcoming']);
    for (const item of actor.upcoming) assert.deepEqual(Object.keys(item).sort(), ['at', 'description']);
    // A journey carries where it started, where it ends and when — never why.
    if (actor.journey !== null) {
      assert.deepEqual(Object.keys(actor.journey).sort(), ['arrivesAt', 'departedAt', 'from', 'to']);
      assert.equal(actor.location, 'streamliner', 'only someone in transit should carry a journey');
    }
  }
  for (const event of projection.events) {
    // A conversation adds its written lines; every other event keeps exactly
    // these six fields. `room` joined the allowlist in v13 and is the room as
    // it was at the time, which is a property of the event rather than of
    // whatever snapshot somebody reads it from.
    // `register` and `prose` joined in v15. They are the two-register feed: a
    // routine meal is a ticker line, a confrontation is a paragraph. Neither
    // carries anything the description did not already make public.
    // `type` joined in v16, for the Gazette. It is the category of a thing that
    // has already been published in words — MEAL_BEGIN beside "Goaden stopped
    // for a meal" — so it discloses nothing the sentence did not. It is here
    // because the alternative was the paper classifying the day by running
    // regexes over its own prose, which is brittle and reads like it.
    // `contextBridge` joined for Reading View contextual continuity. It carries
    // only a discreet 1-2 sentence carry-forward ({ time, timeLabel, snippet })
    // for beats with dependent antecedents, disclosing no private state.
    // `memoryCallback` joined for authored callbacks with origin links. It carries
    // an earned callback reference ({ key, originEventId, originLabel, originLines, originSnippet, originTime, originTimeLabel }).
    // Read-side continuity adds only opaque committed story identity, ledger
    // order and addressable PUBLIC origins. All payload/knowledge canaries and
    // every private event ID are still excluded by the checks above.
    const raw = snapshot.events.find(source => source.id === event.id);
    const performanceFields = raw.type === 'SCENE_BANK_BEAT'
      ? ['narrativeParagraphs', 'sceneBeats', 'sceneTime', 'sceneTitle', 'sceneBankId'] : [];
    const keys = Object.keys(event).filter(key => !['lines', 'prose', 'contextBridge', 'memoryCallback',
      'storyRef', 'narrativeOrder', 'earlierEventIds', 'routineContinuation', ...performanceFields].includes(key)).sort();
    assert.deepEqual(keys, ['description', 'id', 'location', 'occurredAt', 'participants', 'register', 'room', 'type']);
    assert.ok(['ticker', 'prose'].includes(event.register));
    if (raw.type === 'SCENE_BANK_BEAT') {
      assert.equal(raw.visibility, 'public');
      for (const field of ['sceneTitle', 'sceneBankId']) {
        assert.equal(typeof event[field], 'string');
        assert.ok(event[field].length > 0);
        assert.equal(event[field], raw.payload[field]);
      }
      assert.deepEqual(event.sceneTime, {
        dayPhase: dayPhase(raw.occurredAt), daylight: daylightFraction(raw.occurredAt),
      });
      for (const field of ['narrativeParagraphs', 'sceneBeats']) {
        assert.ok(Array.isArray(event[field]) && event[field].length > 0);
        assert.equal(event[field].length, raw.payload[field].length);
        for (const [index, item] of event[field].entries()) {
          assert.deepEqual(Object.keys(item).filter(key => !['who', 'expression', 'nimbusPlate'].includes(key)).sort(),
            ['kind', 'text']);
          assert.ok(['prose', 'dialogue'].includes(item.kind));
          assert.equal(typeof item.text, 'string');
          assert.ok(item.text.trim());
          for (const [key, value] of Object.entries(item)) {
            assert.equal(typeof value, 'string');
            assert.equal(value, raw.payload[field][index][key], 'only committed performance may reach the reader');
          }
        }
      }
    }
    if (event.narrativeOrder !== undefined) assert.equal(event.narrativeOrder, raw.seq);
    if (event.storyRef !== undefined) {
      assert.deepEqual(Object.keys(event.storyRef).sort(), ['id', 'type']);
      assert.ok(['story', 'arc', 'intention', 'operation'].includes(event.storyRef.type));
      assert.equal(typeof event.storyRef.id, 'string');
      assert.ok(event.storyRef.id.length > 0 && event.storyRef.id.length <= 200);
    }
    if (event.earlierEventIds !== undefined) {
      assert.ok(Array.isArray(event.earlierEventIds) && event.earlierEventIds.length <= 16);
      for (const id of event.earlierEventIds) {
        const source = snapshot.events.find(row => row.id === id);
        assert.equal(source?.visibility, 'public');
        assert.ok(source.occurredAt <= event.occurredAt);
        assert.ok(raw.causedBy.includes(id) || raw.payload.continuationSourceEventId === id
          || raw.memoryCallback?.originEventId === id);
      }
    }
    if (event.routineContinuation !== undefined) {
      assert.equal(event.routineContinuation, true);
      assert.equal(raw.payload.routineContinuation, true);
    }
    if (event.prose !== undefined) {
      assert.equal(event.register, 'prose', 'a ticker line was given a paragraph');
      assert.equal(typeof event.prose, 'string');
    }
    if (event.contextBridge !== undefined) {
      assert.deepEqual(Object.keys(event.contextBridge).filter(key => !['originEventId', 'originOccurredAt', 'originType'].includes(key)).sort(),
        ['snippet', 'time', 'timeLabel']);
      assert.equal(typeof event.contextBridge.snippet, 'string');
      assert.equal(typeof event.contextBridge.timeLabel, 'string');
      if (event.contextBridge.originEventId !== undefined) {
        const source = snapshot.events.find(row => row.id === event.contextBridge.originEventId);
        assert.equal(source?.visibility, 'public');
        assert.equal(event.contextBridge.originOccurredAt, source.occurredAt);
        assert.equal(event.contextBridge.originType, source.type);
        assert.ok(source.occurredAt <= event.occurredAt);
      }
    }
    if (event.memoryCallback !== undefined) {
      assert.deepEqual(Object.keys(event.memoryCallback).sort(), ['key', 'originEventId', 'originLabel', 'originLines', 'originSnippet', 'originTime', 'originTimeLabel']);
      assert.equal(typeof event.memoryCallback.key, 'string');
      assert.equal(typeof event.memoryCallback.originLabel, 'string');
      assert.equal(typeof event.memoryCallback.originSnippet, 'string');
      assert.equal(typeof event.memoryCallback.originTimeLabel, 'string');
    }
    if (event.lines === undefined) continue;
    assert.ok(Array.isArray(event.lines) && event.lines.length);
    for (const line of event.lines) {
      assert.deepEqual(Object.keys(line).sort(), ['expression', 'text', 'who']);
      // The pair are no longer the only two people who speak. A venue scene or
      // a Legion visit puts the crew on stage, and each of them has real plate
      // art — a speaker with no face is caught by the venue and legion suites.
      assert.ok(['goaden', 'ashai', ...Object.keys(LEGION_CAST), ...Object.keys(OUTSIDE_CAST)].includes(line.who), line.who);
      assert.equal(typeof line.text, 'string');
    }
  }
});

test('fixed body, power and friendship anchors, allowed topics and relationship bands reject drift', () => {
  const valid = fixtureDefinition.initialState();
  assertCanonState(valid);
  const mutations = [
    state => { state.characters.ashai.body.eye = 'natural_eye'; },
    state => { state.meta.canonAnchors.abilities = 'new_power'; },
    state => { state.meta.canonAnchors.relationshipStage = 'romantic_commitment'; },
    state => { state.meta.canonAnchors.sanctuary = 'permanent_membership'; },
    state => { state.characters.goaden.conditions = [{ kind: 'new_injury' }]; },
    state => { state.facts.forbidden = { kind: 'parentage' }; },
    // The bands widened when feelings began persisting across days, so drift is
    // now checked at the new edges — and a fractional value is drift too.
    state => { state.relationships[0].trust = 6; },
    state => { state.relationships[0].trust = -1; },
    state => { state.relationships[0].concern = 4; },
    state => { state.relationships[0].irritation = 4; },
    state => { state.relationships[0].irritation = 1.5; },
  ];
  for (const mutate of mutations) {
    const altered = structuredClone(valid);
    mutate(altered);
    assert.throws(() => assertCanonState(altered));
  }
});

test('weather deterministically causes consequences: shelter encounters, later training and Streamliner delays', () => {
  const weatherResult = day => {
    const state = structuredClone(fixtureDefinition.initialState());
    const action = { id: `${day}/day`, day, dueAt: atLondon(day, '00:00') + 1, priority: 0, type: 'WEATHER_CHANGE' };
    return fixtureDefinition.reduceAction(state, action, DEFAULT_SEED);
  };

  const dry = dayWhere(day => !isShelterWeather(weatherForDay(day, DEFAULT_SEED).code));
  const dryResult = weatherResult(dry);
  assert.ok(!dryResult.followups.some(a => a.id === `${dry}/shelter-meeting`));
  assert.equal(dryResult.followups.find(a => a.id === `${dry}/morning-goaden`).dueAt,
    atLondon(dry, '09:00') + scheduleJitter(DEFAULT_SEED, dry, 'morning-goaden') * MINUTE);

  const wet = dayWhere(day => isShelterWeather(weatherForDay(day, DEFAULT_SEED).code));
  const wetResult = weatherResult(wet);
  assert.match(wetResult.event.publicDescription, /outdoor yard is closed/);
  assert.ok(wetResult.followups.some(a => a.id === `${wet}/shelter-meeting` && a.type === 'CROSS_PATHS'));
  assert.ok(wetResult.followups.some(a => a.id === `${wet}/end-shelter-meeting` && a.type === 'END_ENCOUNTER'));
  assert.equal(wetResult.followups.find(a => a.id === `${wet}/morning-goaden`).dueAt,
    atLondon(wet, '09:20') + scheduleJitter(DEFAULT_SEED, wet, 'morning-goaden') * MINUTE);

  const isInvitation = day => themeForDay(day, DEFAULT_SEED) === 'invitation';
  const delayedOuting = dayWhere(day => isInvitation(day) && isTravelDelayWeather(weatherForDay(day, DEFAULT_SEED).code));
  assert.equal(weatherResult(delayedOuting).followups.find(a => a.id === `${delayedOuting}/outbound`).duration, 35);
  const punctualOuting = dayWhere(day => isInvitation(day) && factionsForDay(day, DEFAULT_SEED).streamliner === 'normal');
  assert.equal(weatherResult(punctualOuting).followups.find(a => a.id === `${punctualOuting}/outbound`).duration, 25);

  // Rain reroutes an outdoor plaza walk into the cafe without touching daylight.
  const wetWalk = dayWhere(day => themeForDay(day, DEFAULT_SEED) === 'city_walk' && RAINY_CODES.has(weatherForDay(day, DEFAULT_SEED).code));
  assert.equal(cityKindForDay('city_walk', weatherForDay(wetWalk, DEFAULT_SEED)), 'cafe_outing');
  const dryWalk = dayWhere(day => themeForDay(day, DEFAULT_SEED) === 'city_walk' && !RAINY_CODES.has(weatherForDay(day, DEFAULT_SEED).code));
  assert.equal(cityKindForDay('city_walk', weatherForDay(dryWalk, DEFAULT_SEED)), 'city_walk');

  const projection = fixtureDefinition.publicProjection({
    world: { id: 'projection-check', resolvedThrough: START },
    ...structuredClone(fixtureDefinition.initialState()), events: [],
  });
  assert.equal(projection.weather.code, 'cloudy');
});

test('what the pair carry survives midnight, holds under a bad run and eases over quiet days', t => {
  const f = storage(t);
  const world = f.open();
  const pair = () => world.semanticSnapshot().relationships.find(r => r.from === 'ashai');
  // A day counts as pressed if anything that day actually pushed concern upward.
  // Reading that off the ledger rather than naming event types means the test
  // keeps working when a new kind of pressure is added — an enumerated list
  // silently missed both the surge and the fatigue share when they arrived.
  const raisedConcern = (events, day) => events.some(event => londonDate(event.occurredAt) === day
    && event.changes.some(change => change.entity === 'relationship' && change.field === 'concern'
      && change.after > change.before));

  // The world pressing on them is a different thing from them telling each other
  // something, and the two move concern by different amounts: pressure sets a
  // floor of two, an ordinary share adds one. Conflating them made this test
  // demand two steps of a quiet afternoon's conversation.
  const PRESSURE = new Set(['OUTING_CUT_SHORT', 'ARCANE_SURGE', 'PLAN_BROKEN']);
  const pressedOn = (events, day) => events.some(event => londonDate(event.occurredAt) === day
    && PRESSURE.has(event.type) && event.publicDescription);

  const carried = [];
  for (let day = '2026-09-04', count = 0; count < 60; count++, day = nextLondonDay(day)) {
    world.advance(atLondon(day, '23:30'));
    const events = world.semanticSnapshot().events;
    carried.push({ day, pressed: pressedOn(events, day), rose: raisedConcern(events, day), ...pair() });
  }

  // The point of the change: pressure is still felt the following day. Under the
  // old midnight reset this was impossible, and an increment that eased by the
  // same step each night would cancel exactly and never exceed one.
  const runs = carried.filter((entry, index) => entry.pressed && carried[index + 1] && !carried[index + 1].rose);
  assert.ok(runs.length, 'expected at least one pressed day followed by a quiet one');
  for (const entry of runs) {
    const next = carried[carried.indexOf(entry) + 1];
    assert.ok(entry.concern >= 2, `pressure should register at least two steps of concern on ${entry.day}`);
    assert.ok(next.concern >= 1, `the day after ${entry.day} should still carry something`);
    assert.ok(next.concern < entry.concern, `${next.day} raised nothing and should ease rather than hold`);
  }
  // Consecutive bad days hold it up instead of sawtoothing back down.
  for (const [index, entry] of carried.entries()) {
    if (entry.pressed && carried[index - 1]?.pressed) assert.ok(entry.concern >= 2, `a second pressed day should hold on ${entry.day}`);
  }
  // And a quiet stretch really does return them to baseline.
  assert.ok(carried.some(entry => entry.concern === 0), 'concern never returned to baseline');
  assert.ok(carried.some(entry => entry.concern >= 2), 'concern never rose');

  // Every value stays inside its band the whole way, and trust is never reset
  // to its opening value by a passing midnight.
  for (const entry of carried) {
    for (const [field, band] of Object.entries(RELATIONSHIP_BANDS)) {
      assert.ok(Number.isInteger(entry[field]) && entry[field] >= band.min && entry[field] <= band.max,
        `${field} left its band on ${entry.day}`);
    }
  }
  assert.ok(carried.at(-1).trust > carried[0].trust, 'trust should accumulate rather than reset nightly');
});

test('a callout breaks an arranged evening, costs trust, and the next day earns it back', t => {
  const f = storage(t);
  const world = f.open();
  const broken = dayWhere(day => themeForDay(day, DEFAULT_SEED) === 'sanctuary_night'
    && factionsForDay(day, DEFAULT_SEED).mi6 === 'elevated');
  const after = nextLondonDay(broken);
  const felt = () => world.semanticSnapshot().relationships.find(r => r.from === 'ashai');
  // Scoped to a window: the pair visit Sanctuary on other days too, so an
  // unbounded search would match an earlier evening and prove nothing.
  const said = (from, to) => world.semanticSnapshot().events
    .filter(e => e.occurredAt >= from && e.occurredAt <= to && e.publicDescription)
    .map(e => e.publicDescription).join(' | ');
  const dayStart = atLondon(broken, '00:00');

  world.advance(atLondon(broken, '19:10'));
  const arranged = felt();
  assert.match(said(dayStart, atLondon(broken, '19:10')), /arranged an evening visit to Sanctuary/);

  // The surge is her worry about him, not his about her: the pair is directional.
  world.advance(atLondon(broken, '19:45'));
  assert.ok(felt().concern >= 2, 'a surge should leave her carrying something');
  assert.match(said(dayStart, atLondon(broken, '19:45')), /surge along the Thames corridor/);

  // Duty breaking a promise is the one force here that moves trust downward.
  world.advance(atLondon(broken, '20:40'));
  assert.equal(felt().trust, arranged.trust - 1, 'a broken evening should cost trust');
  assert.match(said(dayStart, atLondon(broken, '20:40')), /callout broke the evening/);
  // And everything downstream of the broken plan stays quiet on its own.
  assert.doesNotMatch(said(dayStart, atLondon(broken, '23:59')), /entered the Sanctuary/);

  // It is still felt the next morning rather than reset by the midnight rollover.
  world.advance(atLondon(after, '09:00'));
  assert.equal(felt().trust, arranged.trust - 1, 'the cost should survive midnight');

  // The repair needs the cause remembered, and keeping it earns the trust back.
  world.advance(atLondon(after, '23:00'));
  assert.match(said(atLondon(after, '00:00'), atLondon(after, '23:00')), /take back the evening the callout cost them/);
  assert.equal(felt().trust, arranged.trust, 'keeping the made-up evening should restore trust');
});

test('the Veil is a real date the world leans toward, announced once per step', t => {
  const f = storage(t);
  const world = f.open();

  // A fixed date per year: a restart never moves it, and each year has its own.
  for (const year of [2026, 2027, 2028]) {
    assert.equal(veilDateForYear(year, DEFAULT_SEED), veilDateForYear(year, DEFAULT_SEED));
    assert.match(veilDateForYear(year, DEFAULT_SEED), new RegExp(`^${year}-1[01]-\\d{2}$`));
  }
  assert.notEqual(veilDateForYear(2026, DEFAULT_SEED), veilDateForYear(2027, DEFAULT_SEED).replace('2027', '2026'));

  // The countdown falls by exactly one a day and the phase only ever tightens —
  // until the festival passes, when it rolls over to next year's and starts far
  // out again. Both halves of that are the contract.
  const order = ['distant', 'announced', 'preparing', 'imminent', 'underway'];
  let previous = null, rollovers = 0;
  for (let day = '2026-09-04', count = 0; count < 400; count++, day = nextLondonDay(day)) {
    const veil = veilForDate(day, DEFAULT_SEED);
    if (previous) {
      if (previous.daysAway === 0) {
        assert.ok(veil.daysAway > 300, `the next Veil should be a year out, saw ${veil.daysAway} on ${day}`);
        assert.equal(veil.phase, 'distant');
        rollovers++;
      } else {
        assert.equal(veil.daysAway, previous.daysAway - 1, `countdown skipped on ${day}`);
        assert.ok(order.indexOf(veil.phase) >= order.indexOf(previous.phase), `phase went backwards on ${day}`);
      }
    }
    previous = veil;
  }
  assert.equal(rollovers, 1, 'expected exactly one festival to pass in a year of days');

  world.advance(atLondon('2026-10-27', '12:00'));
  const notices = world.semanticSnapshot().events
    .filter(event => event.type === 'INSTITUTION_NOTICE' && /Celestial Veil/.test(event.publicDescription || ''))
    .map(event => event.publicDescription);

  // Each milestone is a step the world takes once, not a countdown it repeats.
  for (const milestone of [/stepped up/, /final week/, /began at the Sanctuary/]) {
    assert.equal(notices.filter(text => milestone.test(text)).length, 1, `expected exactly one ${milestone}`);
  }
  // Dates are confirmed while the festival is far off and never again once the
  // Church is visibly working on it — it read as a bug when it repeated.
  const confirmations = world.semanticSnapshot().events
    .filter(event => /confirmed dates/.test(event.publicDescription || '') && event.type === 'INSTITUTION_NOTICE');
  for (const event of confirmations) {
    assert.equal(veilForDate(londonDate(event.occurredAt), DEFAULT_SEED).phase, 'distant',
      'the Church re-confirmed dates while already preparing');
  }

  // The festival day is the world's, not theirs. They may talk about it — that
  // anticipation is the point — but nothing takes them to it: the notice is
  // institutional with nobody in it, and no plan they make is the Veil.
  const day = veilDateForYear(2026, DEFAULT_SEED);
  const onTheDay = world.semanticSnapshot().events.filter(event => londonDate(event.occurredAt) === day);
  const opening = onTheDay.find(event => /Celestial Veil began/.test(event.publicDescription || ''));
  assert.ok(opening, 'the festival should open publicly');
  assert.equal(opening.type, 'INSTITUTION_NOTICE');
  assert.deepEqual(opening.participants, [], 'the festival notice named someone');
  for (const event of onTheDay) {
    assert.ok(!/(arranged|entered|attended|boarded).{0,60}Veil/i.test(event.publicDescription || ''),
      `the pair were taken to the festival: ${event.publicDescription}`);
  }
});

test('lintel numbers overhead follow the ambient magic the MEU is reading', t => {
  const f = storage(t);
  const world = f.open();
  const seen = new Map();
  for (let day = '2026-09-04', count = 0; count < 45; count++, day = nextLondonDay(day)) {
    world.advance(atLondon(day, '13:00'));
    const projection = world.publicProjection();
    const arcane = projection.factions.arcane;
    assert.ok(Number.isInteger(projection.sky.lintels) && projection.sky.lintels >= 1,
      'the sky should never be empty of them');
    // One reading, one count: the sky is a function of the world, not of chance.
    if (seen.has(arcane)) assert.equal(seen.get(arcane), projection.sky.lintels, `${arcane} drew a different crowd`);
    seen.set(arcane, projection.sky.lintels);
  }
  assert.ok(seen.size >= 2, 'expected more than one arcane reading across the run');
  // More ambient energy draws more of them, which is the whole point of showing it.
  const levels = ['low', 'moderate', 'high'].filter(level => seen.has(level));
  for (let i = 1; i < levels.length; i++) {
    assert.ok(seen.get(levels[i]) > seen.get(levels[i - 1]), `${levels[i]} should draw more than ${levels[i - 1]}`);
  }
});

test('conversations are authored, in the moment, and never disclose anything', t => {
  const f = storage(t);
  const world = f.open();
  world.advance(atLondon('2027-01-31', '23:00'));
  const snapshot = world.semanticSnapshot();
  const talks = snapshot.events.filter(event => event.type === 'CONVERSATION' && event.payload?.lines);
  assert.ok(talks.length > 100, `expected a conversation most days, saw ${talks.length}`);

  // Every line is one of the written ones — nothing is generated at runtime.
  // An exchange is either a bare list of lines or a gated `{requires, lines}`,
  // so the rail reads through `linesOf` rather than flattening twice. Without
  // this the check silently stops seeing gated exchanges — which is the same
  // failure mode as an unauthored line, arriving from the opposite direction.
  const authored = new Set(Object.values(EXCHANGES).flat().flatMap(linesOf).map(line => line.text));
  const moods = new Set();
  for (const talk of talks) {
    moods.add(talk.payload.mood);
    // Still nothing in the world: no knowledge, no relationship, no plan. The
    // director's pacing clock is its own ledger entity precisely so this rail
    // can keep saying that without having to make an exception for it.
    assert.deepEqual(talk.changes.filter(change => change.entity !== 'director'), [],
      'a conversation must not move state');
    for (const change of talk.changes) assert.equal(change.field, 'director');
    assert.deepEqual([...talk.participants].sort(), ['ashai', 'goaden']);
    for (const line of talk.payload.lines) {
      assert.ok(authored.has(line.text), `unauthored line: ${line.text}`);
      // A conversation may now carry a colleague, but only one the building
      // could actually have put in that room at that hour. The pair are always
      // eligible; anybody else has to be a side character whose own catalogue
      // entry lists this area and this daypart. Participants stay the two of
      // them, exactly as a venue hour does with its guests.
      if (!['goaden', 'ashai'].includes(line.who)) {
        const colleague = SIDE_CHARACTERS[line.who];
        assert.ok(colleague, `${line.who} spoke and is not a side character`);
        assert.ok(colleague.areas?.includes(talk.area),
          `${line.who} spoke in ${talk.area}, which is not one of their areas`);
        assert.ok(colleague.dayparts.includes(daypart(talk.occurredAt)),
          `${line.who} spoke at ${daypart(talk.occurredAt)}, which is not one of their dayparts`);
        assert.ok(colleague.plates?.includes(line.expression),
          `${line.who} has no ${line.expression} plate`);
        continue;
      }
      const plates = line.who === 'goaden' ? GOADEN_PLATES : ASHAI_PLATES;
      assert.ok(plates.includes(line.expression), `${line.who} has no ${line.expression} plate`);
    }
  }
  // Every bank is reachable, so no written scene is dead weight.
  assert.deepEqual([...moods].sort(), [...MOODS].sort());

  // The mood follows the world rather than being sprinkled on: a repair scene
  // only ever happens in the shadow of a plan the world actually broke.
  const breaks = snapshot.events.filter(event => event.type === 'PLAN_BROKEN' && event.publicDescription);
  for (const talk of talks.filter(entry => entry.payload.mood === 'repair')) {
    assert.ok(breaks.some(entry => entry.occurredAt < talk.occurredAt && talk.occurredAt - entry.occurredAt < 48 * 3_600_000),
      'a repair conversation happened with no broken plan behind it');
  }

  // Nothing in the dialogue reaches past the checkpoint or names private state.
  const spoken = talks.flatMap(talk => talk.payload.lines.map(line => line.text)).join(' ').toLowerCase();
  for (const term of ['shonen', 'kartia', "j'kobi", 'whisper', 'parentage', 'father', 'mother', 'daughter', 'grimoire', 'voices',
    'trust', 'concern', 'irritation']) {
    assert.ok(!spoken.includes(term), `dialogue surfaced ${term}`);
  }
});

test('the upcoming hours show ordinary routine and announced plans, and never an unannounced or replaceable one', t => {
  const f = storage(t);
  const world = f.open();
  const day = dayWithAcceptedInvitation(f, 'upcoming');
  const upcomingOf = actor => world.publicProjection().characters.find(c => c.id === actor).upcoming;
  const described = actor => upcomingOf(actor).map(item => item.description);
  const sanctuary = 'Leaving for an invited Sanctuary visit';

  // Accepted at 13:13 but not announced until 13:14: an agreed plan is still private.
  world.advance(atLondon(day, '13:13'));
  assert.ok(!described('goaden').includes(sanctuary), 'An unannounced arrangement reached the public horizon');
  assert.ok(!described('ashai').includes(sanctuary), 'An unannounced arrangement reached the public horizon');
  // The optional 13:30 practice is queued, and a private decision may yet
  // replace it. Listing it would let a viewer watch that decision happen.
  assert.ok(!described('goaden').includes('Training'), 'A replaceable optional plan reached the public horizon');

  world.advance(atLondon(day, '13:20'));
  for (const actor of ['goaden', 'ashai']) {
    assert.ok(described(actor).includes(sanctuary), `${actor} should carry the announced plan once it is public`);
  }

  // Across a long stretch, nothing outside this vocabulary is ever named, every
  // entry lies ahead, and none reaches past the stated horizon. The list is
  // written out rather than imported, so a label that starts carrying a private
  // reason fails here instead of quietly widening what the page may say.
  const allowed = new Set(['Training', 'A meal', 'Time at the piano', 'Listening to music', 'Television',
    'A quiet break', 'A game', 'Finishing a game', 'Turning in for the night', 'An inner circle briefing',
    'On call', 'Waiting',
    'Leaving for an invited Sanctuary visit', 'A meal together', 'An outing to Enchanted Ink',
    'A trip to the Silver Spoon Cafe', 'A walk beneath New Big Ben', 'A match in the MI6 gaming room',
    'An evening at Sanctuary', "Going back to finish yesterday's visit", 'Finishing the interrupted match',
    'A game together', 'The evening they missed', 'A comms check']);
  let seen = 0;
  const sweep = f.open('sweep');
  for (let step = atLondon('2026-09-04', '06:00'); step < END; step += 97 * MINUTE) {
    sweep.advance(step);
    const projection = sweep.publicProjection();
    for (const character of projection.characters) {
      for (const item of character.upcoming) {
        assert.ok(allowed.has(item.description), `Unapproved horizon entry: ${item.description}`);
        assert.ok(item.at > projection.resolvedThrough, 'A past action appeared in the horizon');
        assert.ok(item.at <= projection.resolvedThrough + 8 * 60 * MINUTE, 'The horizon reached beyond eight hours');
        seen++;
      }
      assert.ok(character.upcoming.length <= 4, 'The horizon listed more than four entries');
    }
  }
  assert.ok(seen > 100, `Expected a well-populated horizon across the run, saw ${seen}`);
});

test('routine times drift a few minutes so the pair leave lockstep, while causal chains keep their authored times', () => {
  const dayPlan = day => fixtureDefinition.reduceAction(structuredClone(fixtureDefinition.initialState()),
    { id: `${day}/day`, day, dueAt: atLondon(day, '00:00') + 1, priority: 0, type: 'WEATHER_CHANGE' }, DEFAULT_SEED).followups;
  const dueAt = (plan, day, id) => plan.find(a => a.id === `${day}/${id}`)?.dueAt;

  // The offset is deterministic and small enough to read as a person being a
  // few minutes early or late, never as a different schedule.
  for (const day of ['2026-09-04', '2026-11-30', '2027-03-29']) {
    for (const id of ['breakfast-goaden', 'night-ashai', 'morning-goaden']) {
      assert.equal(scheduleJitter(DEFAULT_SEED, day, id), scheduleJitter(DEFAULT_SEED, day, id));
      assert.ok(Math.abs(scheduleJitter(DEFAULT_SEED, day, id)) <= 3, `${day}/${id} drifted too far`);
    }
  }

  // The point of the offset: they stop doing the same thing on the same second.
  let day = '2026-09-04', days = 0, lockstep = 0;
  for (; days < 60; days++, day = nextLondonDay(day)) {
    const plan = dayPlan(day);
    for (const routine of ['breakfast', 'evening-meal', 'night']) {
      if (dueAt(plan, day, `${routine}-goaden`) === dueAt(plan, day, `${routine}-ashai`)) lockstep++;
    }
  }
  assert.ok(lockstep < days, `Routines still start together on ${lockstep} of ${days * 3} occasions`);

  // Chains are deliberately left alone. An offer, its agreement and the plan it
  // replaces are minutes apart, and drift would let one overtake its own cause.
  const invitation = dayWhere(d => themeForDay(d, DEFAULT_SEED) === 'invitation');
  const invitePlan = dayPlan(invitation);
  for (const [id, time] of [['notice-invite', '12:45'], ['accept-invite', '12:46'],
    ['optional-practice-change', '12:47'], ['optional-practice', '13:30'], ['outbound', '14:30']]) {
    assert.equal(dueAt(invitePlan, invitation, id), atLondon(invitation, time), `${id} should keep its authored time`);
  }
});

test('the day phase follows the real London sun rather than fixed clock hours', () => {
  const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const minutes = label => { const [hour, minute] = label.split(':').map(Number); return hour * 60 + minute; };
  // Published London almanac times for four points around the year.
  for (const [date, [rise, set]] of Object.entries({
    '2026-01-01': ['08:06', '16:02'], '2026-03-20': ['06:04', '18:12'],
    '2026-06-21': ['04:43', '21:21'], '2026-12-21': ['08:04', '15:53'],
  })) {
    const events = sunEvents(date);
    assert.ok(Math.abs(minutes(clock.format(events.sunrise)) - minutes(rise)) <= 3, `${date} sunrise ${clock.format(events.sunrise)} vs ${rise}`);
    assert.ok(Math.abs(minutes(clock.format(events.sunset)) - minutes(set)) <= 3, `${date} sunset ${clock.format(events.sunset)} vs ${set}`);
    assert.ok(events.dawn < events.sunrise, `${date} dawn precedes sunrise`);
    assert.ok(events.sunrise < events.solarNoon && events.solarNoon < events.sunset);
    assert.ok(events.sunset < events.dusk, `${date} dusk follows sunset`);
  }
  // Midsummer daylight is hours longer than midwinter: a real cycle, not a band.
  assert.ok(sunEvents('2026-06-21').daylightMinutes > sunEvents('2026-12-21').daylightMinutes + 480);

  // The four phases tile a day in order, with the boundaries on the solar instants.
  for (const date of ['2026-03-29', '2026-06-21', '2026-10-25', '2026-12-21']) {
    const events = sunEvents(date);
    assert.equal(dayPhase(atLondon(date, '00:00')), 'night', date);
    assert.equal(dayPhase(events.dawn - 1), 'night', date);
    assert.equal(dayPhase(events.dawn), 'dawn', date);
    assert.equal(dayPhase(events.sunrise - 1), 'dawn', date);
    assert.equal(dayPhase(events.sunrise), 'day', date);
    assert.equal(dayPhase(events.sunset - 1), 'day', date);
    assert.equal(dayPhase(events.sunset), 'dusk', date);
    assert.equal(dayPhase(events.dusk - 1), 'dusk', date);
    assert.equal(dayPhase(events.dusk), 'night', date);
  }

  // Both clock changes: the day is 23 or 25 hours long, the sun keeps moving, and
  // the civil bands stay attached to the wall clock rather than drifting an hour.
  assert.equal(atLondon('2026-03-30', '00:00') - atLondon('2026-03-29', '00:00'), 23 * 3_600_000);
  assert.equal(atLondon('2026-10-26', '00:00') - atLondon('2026-10-25', '00:00'), 25 * 3_600_000);
  for (const date of ['2026-03-28', '2026-03-29', '2026-03-30', '2026-10-24', '2026-10-25', '2026-10-26']) {
    assert.equal(daypart(atLondon(date, '04:30')), 'small_hours', date);
    assert.equal(daypart(atLondon(date, '09:00')), 'morning', date);
    assert.equal(daypart(atLondon(date, '13:00')), 'midday', date);
    assert.equal(daypart(atLondon(date, '18:00')), 'evening', date);
    assert.equal(daypart(atLondon(date, '22:00')), 'night', date);
    assert.equal(dayPhase(atLondon(date, '13:00')), 'day', date);
    assert.equal(dayPhase(atLondon(date, '23:30')), 'night', date);
  }
  // Sunrise jumps roughly an hour across the spring change and back in autumn.
  const springJump = minutes(clock.format(sunEvents('2026-03-29').sunrise)) - minutes(clock.format(sunEvents('2026-03-28').sunrise));
  assert.ok(springJump > 50 && springJump < 70, `spring sunrise jumped ${springJump} minutes`);

  // Every minute of a day resolves to exactly one declared daypart and phase.
  const partsSeen = new Set(), phasesSeen = new Set();
  for (let ms = atLondon('2026-06-21', '00:00'); ms < atLondon('2026-06-22', '00:00'); ms += 60_000) {
    assert.ok(DAYPARTS.includes(daypart(ms)));
    assert.ok(DAY_PHASES.includes(dayPhase(ms)));
    partsSeen.add(daypart(ms));
    phasesSeen.add(dayPhase(ms));
  }
  assert.deepEqual([...partsSeen].sort(), [...DAYPARTS].sort());
  assert.deepEqual([...phasesSeen].sort(), [...DAY_PHASES].sort());
});

test('location modes and dayparts make impossible combinations unreachable', () => {
  // No location has an undefined hour.
  for (const [location, modes] of Object.entries(LOCATION_MODES)) {
    assert.deepEqual(Object.keys(modes).sort(), [...DAYPARTS].sort(), location);
  }
  const day = '2026-09-10';
  const sanctuaryAt = time => locationMode('sanctuary', atLondon(day, time));
  assert.equal(sanctuaryAt('04:00'), 'closed_reset');
  assert.equal(sanctuaryAt('08:00'), 'sacred_quiet');
  assert.equal(sanctuaryAt('14:30'), 'public_attraction');
  assert.equal(sanctuaryAt('18:30'), 'evening_transition');
  assert.equal(sanctuaryAt('22:30'), 'nightlife');

  // Music belongs to the public and nightlife modes, never to the sacred morning
  // or the overnight reset; the tattoo parlour is only open when it is open.
  assert.equal(permitsActivity('sanctuary', sanctuaryAt('14:30'), 'listening_to_music'), true);
  assert.equal(permitsActivity('sanctuary', sanctuaryAt('22:30'), 'listening_to_music'), true);
  assert.equal(permitsActivity('sanctuary', sanctuaryAt('08:00'), 'listening_to_music'), false);
  assert.equal(permitsActivity('sanctuary', sanctuaryAt('04:00'), 'listening_to_music'), false);
  assert.equal(permitsActivity('enchanted_ink', locationMode('enchanted_ink', atLondon(day, '09:00')), 'visiting_enchanted_ink'), false);
  assert.equal(permitsActivity('enchanted_ink', locationMode('enchanted_ink', atLondon(day, '14:00')), 'visiting_enchanted_ink'), true);
  // MI6 never closes, but the night shift is not the day watch.
  assert.equal(permitsActivity('mi6', locationMode('mi6', atLondon(day, '02:00')), 'training'), false);
  assert.equal(permitsActivity('mi6', locationMode('mi6', atLondon(day, '09:00')), 'training'), true);
  assert.equal(permitsActivity('mi6', locationMode('mi6', atLondon(day, '02:00')), 'gaming'), true);

  // The reducer is the choke point: an activity its place and hour disallow cannot commit.
  const attempt = (action, at) => {
    const state = structuredClone(fixtureDefinition.initialState());
    for (const who of Object.values(state.characters)) {
      who.location = action.location ?? 'mi6';
      who.activity = 'unhurried_time';
      who.activityUntil = null;
    }
    return () => fixtureDefinition.reduceAction(state, { id: 'probe', day, dueAt: at, priority: 40, ...action }, DEFAULT_SEED);
  };
  assert.throws(attempt({ type: 'PRACTICE_BEGIN', actor: 'goaden', duration: 30 }, atLondon(day, '02:00')),
    /training is not available at mi6 in night_shift mode/);
  assert.throws(attempt({ type: 'PIANO_BEGIN', actor: 'goaden', duration: 30 }, atLondon(day, '21:00')),
    /playing_piano is not available/);
  assert.throws(attempt({ type: 'TV_BEGIN', actor: 'ashai', duration: 30 }, atLondon(day, '04:00')),
    /TV_BEGIN cannot begin during small_hours/);
  assert.throws(attempt({ type: 'QUIET_TIME_BEGIN', actor: 'ashai', duration: 30, location: 'sanctuary' }, atLondon(day, '04:00')),
    /quiet_break is not available at sanctuary in closed_reset mode/);
  assert.throws(attempt({ type: 'MUSIC_LISTEN_BEGIN', actors: ['goaden', 'ashai'], duration: 30, location: 'sanctuary' }, atLondon(day, '08:30')),
    /listening_to_music is not available at sanctuary in sacred_quiet mode/);
  // Positive controls at their own hours.
  attempt({ type: 'PRACTICE_BEGIN', actor: 'goaden', duration: 30 }, atLondon(day, '09:00'))();
  attempt({ type: 'TV_BEGIN', actor: 'ashai', duration: 30 }, atLondon(day, '21:00'))();
  attempt({ type: 'MUSIC_LISTEN_BEGIN', actors: ['goaden', 'ashai'], duration: 30, location: 'sanctuary' }, atLondon(day, '22:30'))();
});

test('a day plan is refused before it is queued if any action falls outside its own window', () => {
  const day = '2026-09-10';
  const ink = { id: `${day}/probe`, type: 'CITY_ACTIVITY_BEGIN', kind: 'ink_visit', location: 'enchanted_ink' };
  // The evening is a legal hour for a city outing, but the parlour has shuttered.
  assert.throws(() => assertScheduleWindows([{ ...ink, dueAt: atLondon(day, '18:30') }]), /not open for ink_visit/);
  assert.throws(() => assertScheduleWindows([{ ...ink, dueAt: atLondon(day, '23:30') }]), /CITY_ACTIVITY_BEGIN cannot begin during night/);
  assertScheduleWindows([{ ...ink, dueAt: atLondon(day, '14:30') }]);
  assert.throws(() => assertScheduleWindows([{ id: 'p', type: 'PRACTICE_BEGIN', dueAt: atLondon(day, '02:30') }]),
    /PRACTICE_BEGIN cannot begin during night/);
  assert.throws(() => assertScheduleWindows([{ id: 'p', type: 'PRACTICE_BEGIN', dueAt: atLondon(day, '04:30') }]),
    /PRACTICE_BEGIN cannot begin during small_hours/);
  assertScheduleWindows([{ id: 'p', type: 'PRACTICE_BEGIN', dueAt: atLondon(day, '09:00') }]);

  // Four months of real schedules already satisfy every declared window.
  let checked = 0;
  for (let day = '2026-09-04', count = 0; count < 120; count++, day = nextLondonDay(day)) {
    const { followups } = fixtureDefinition.reduceAction(structuredClone(fixtureDefinition.initialState()),
      { id: `${day}/day`, day, dueAt: atLondon(day, '00:00') + 1, priority: 0, type: 'WEATHER_CHANGE' }, DEFAULT_SEED);
    for (const action of followups) {
      assert.ok(permitsDaypart(action.type, action.dueAt), `${action.id} would begin during ${daypart(action.dueAt)}`);
      if (ACTIVITY_DAYPARTS[action.type]) checked++;
    }
  }
  assert.ok(checked > 1_000, `expected a substantial sample, saw ${checked}`);
});

test('Sanctuary is a daytime attraction and a nightlife venue at the same address', t => {
  const f = storage(t);
  const onDay = (snapshot, date) => snapshot.events.filter(event => event.occurredAt >= atLondon(date, '00:00')
    && event.occurredAt < atLondon(nextLondonDay(date), '00:00'));
  // An evening at the Sanctuary is not owed to anybody. A surge on the corridor
  // takes the night whole often enough that the first themed night in the window
  // is frequently a night they never got. So walk the themed nights instead of
  // pinning one, and hold each to the harder rule: it either opened the halls or
  // it was explicitly broken. Silently not happening is the failure.
  let veil = null;
  let veilDay = null;
  for (const candidate of daysFor('sanctuary_night')) {
    const world = f.open(`evening-${candidate}`);
    world.advance(atLondon(candidate, '23:59'));
    const day = onDay(world.semanticSnapshot(), candidate);
    if (day.some(e => e.publicDescription?.includes('entered the Sanctuary'))) {
      veil = day;
      veilDay = candidate;
      break;
    }
    assert.ok(day.some(e => ['PLAN_BROKEN', 'OUTING_CUT_SHORT'].includes(e.type)),
      `${candidate}: the Sanctuary evening neither happened nor was broken`);
  }
  assert.ok(veil, 'every Sanctuary night in the window was cancelled');

  // Admission happens inside the evening guest window, when the halls are open.
  const entered = veil.find(e => e.publicDescription?.includes('entered the Sanctuary'));
  assert.equal(locationMode('sanctuary', entered.occurredAt), 'nightlife');
  const nightMusic = veil.find(e => e.location === 'sanctuary' && e.type === 'MUSIC_LISTEN_BEGIN');
  assert.ok(nightMusic, 'expected music inside Sanctuary');
  assert.equal(locationMode('sanctuary', nightMusic.occurredAt), 'nightlife');
  assert.match(nightMusic.publicDescription, /central hub/);
  // They are home before the halls close and the venue resets for the night.
  // Matched on the event rather than one sentence: the homeward leg has a bank
  // now, because it was the single most repeated line in a world about going out.
  const home = veil.find(e => e.type === 'TRAVEL_ARRIVE' && e.payload?.to === 'mi6');
  assert.ok(home && locationMode('sanctuary', home.occurredAt) === 'nightlife');

  // The daytime invitation reaches the same address in its public-attraction mode
  // and never borrows the nightlife wording.
  const daytime = f.open('daytime');
  let inviteDay, snapshot, day, dayMusic;
  for (const candidate of daysFor('invitation')) {
    daytime.advance(atLondon(candidate, '23:59'));
    const actual = daytime.semanticSnapshot(), events = onDay(actual, candidate);
    const music = events.find(e => e.visibility === 'public' && e.location === 'sanctuary' && e.type === 'MUSIC_LISTEN_BEGIN');
    if (music) { inviteDay = candidate; snapshot = actual; day = events; dayMusic = music; break; }
  }
  assert.ok(dayMusic, 'expected music during the daytime visit');
  assert.equal(locationMode('sanctuary', dayMusic.occurredAt), 'public_attraction');
  assert.match(dayMusic.publicDescription, /portal halls/);
  for (const event of day) assert.ok(!event.publicDescription?.includes('central hub'));
  for (const event of veil) assert.ok(!event.publicDescription?.includes('portal halls'));

  // The projection names the venue by its mode and hands presentation an asset key.
  const scene = (at, code = 'clear') => fixtureDefinition.publicProjection({
    ...structuredClone(snapshot), world: { id: 'scene-check', resolvedThrough: at },
    weather: { code, description: 'Clear', temperatureC: 15, simulated: true },
    characters: { goaden: { ...snapshot.characters.goaden, location: 'sanctuary' }, ashai: { ...snapshot.characters.ashai, location: 'sanctuary' } },
    events: [],
  });
  assert.equal(scene(atLondon(inviteDay, '14:30')).scene.backgroundKey, 'sanctuary_day');
  assert.equal(scene(atLondon(inviteDay, '18:30')).scene.backgroundKey, 'sanctuary_evening');
  assert.equal(scene(atLondon(inviteDay, '22:30')).scene.backgroundKey, 'sanctuary_nightclub');
  assert.equal(scene(atLondon(inviteDay, '04:00')).scene.backgroundKey, 'sanctuary_closed');
  assert.equal(scene(atLondon(inviteDay, '14:30')).worldStatus, 'An invited visit to Sanctuary');
  assert.equal(scene(atLondon(inviteDay, '22:30')).worldStatus, 'Sanctuary has opened for the evening');
  // Weather dresses a scene but never decides which scene it is.
  const wet = scene(atLondon(inviteDay, '22:30'), 'storm');
  assert.equal(wet.scene.backgroundKey, 'sanctuary_nightclub_rain');
  assert.equal(wet.scene.fallbackKey, 'sanctuary_nightclub');
  assert.equal(wet.scene.mode, 'nightlife');
  assert.equal(wet.time.dayPhase, scene(atLondon(inviteDay, '22:30')).time.dayPhase);
  assert.equal(scene(atLondon(inviteDay, '13:00'), 'storm').time.dayPhase, 'day');
});

test('faction postures decay a step at a time instead of resetting overnight', () => {
  // A posture at its top level is still raised the next day: escalation lingers.
  let ramps = 0;
  for (let day = '2026-09-04', count = 0; count < 150; count++, day = nextLondonDay(day)) {
    const next = nextLondonDay(day);
    for (const faction of ['mi6', 'order', 'arcane']) {
      const levels = FACTION_LEVELS[faction];
      if (factionsForDay(day, DEFAULT_SEED)[faction] !== levels.at(-1)) continue;
      assert.notEqual(factionsForDay(next, DEFAULT_SEED)[faction], levels[0], `${faction} reset overnight on ${next}`);
      ramps++;
    }
  }
  assert.ok(ramps > 20, `expected escalations to observe, saw ${ramps}`);

  // An elevated MI6 footing steps down to briefings rather than straight to routine.
  const elevated = dayWhere(day => factionsForDay(day, DEFAULT_SEED).mi6 === 'elevated'
    && factionsForDay(nextLondonDay(day), DEFAULT_SEED).arcane !== 'high');
  assert.equal(factionsForDay(nextLondonDay(elevated), DEFAULT_SEED).mi6, 'briefings');

  // Single-day occurrences are redrawn daily, so they are free to end at once.
  assert.ok(dayWhere(day => factionsForDay(day, DEFAULT_SEED).church === 'veil_cycle'
    && factionsForDay(nextLondonDay(day), DEFAULT_SEED).church === 'quiet'), 'Church business must be able to end');
  assert.ok(dayWhere(day => factionsForDay(day, DEFAULT_SEED).sanctuary === 'private_event'
    && factionsForDay(nextLondonDay(day), DEFAULT_SEED).sanctuary === 'invited_guests'), 'a private event must be able to end');

  // Rail delays follow the day's own weather and arcane level, not yesterday's.
  for (let day = '2026-09-04', count = 0; count < 60; count++, day = nextLondonDay(day)) {
    const posture = factionsForDay(day, DEFAULT_SEED);
    const caused = isTravelDelayWeather(weatherForDay(day, DEFAULT_SEED).code) || posture.arcane === 'high';
    assert.equal(posture.streamliner, caused ? 'minor_delays' : 'normal', day);
    for (const [faction, allowed] of Object.entries(FACTION_LEVELS)) assert.ok(allowed.includes(posture[faction]), `${faction} on ${day}`);
  }
});

test('a publicly visible event teaches Goaden and Ashai nothing by itself', t => {
  const f = storage(t);
  const world = f.open();
  world.advance(END);
  const snapshot = world.semanticSnapshot();
  const notices = snapshot.events.filter(event => event.type === 'INSTITUTION_NOTICE');
  assert.ok(notices.length >= THEME_NAMES.length, `expected daily notices, saw ${notices.length}`);
  const noticeIds = new Set(notices.map(event => event.id));
  const postures = snapshot.events.filter(event => event.type === 'FACTION_STATUS');
  assert.ok(postures.length >= THEME_NAMES.length);

  // Notices and postures are world texture: they touch nobody's memory.
  // A notice may now leave a hook the authored-situation layer can pick up
  // later — that is the point of it, and it is what stops the world from being
  // a set of unconnected days. What it still may not do is touch anybody's
  // memory, feelings, plans or whereabouts, which is what 'story' being its own
  // ledger entity makes checkable rather than merely intended.
  for (const event of notices) {
    assert.ok(event.changes.every(change => change.entity === 'story'),
      'a notice must not change private state');
    assert.equal(event.visibility, 'public');
    assert.deepEqual(event.participants, []);
    assert.ok(event.publicDescription);
  }
  for (const event of postures) {
    assert.deepEqual(event.participants, []);
    assert.ok(event.changes.every(change => change.entity === 'story'
      || (change.entity === 'world' && change.field === 'factions')));
  }
  for (const id of ['goaden', 'ashai']) {
    for (const memory of snapshot.characters[id].knowledge) {
      assert.ok(!noticeIds.has(memory.sourceEventId), `${id} remembered a notice`);
      assert.ok(!noticeIds.has(memory.acquisitionEventId), `${id} acquired a notice`);
    }
  }
  // Knowledge only ever arrives through an explicit acquisition, one actor at a
  // time. ARCANE_SURGE and PLAN_BROKEN join the list on the same footing as
  // OUTING_CUT_SHORT: the world reaches in and they are in it. Being called to
  // stand by, or losing an arranged evening to that callout, is participation —
  // not the passive absorption of a notice, which still teaches nobody anything.
  // INCIDENT joins on exactly the same footing, and it is the clearest case of
  // the rule rather than an exception to it: living through something is how a
  // person comes to know it. Note what is still absent — UNEASE teaches nobody
  // anything, because noticing a strange thing in passing is not knowledge, and
  // AFTERMATH requires the memory to already exist rather than creating one.
  const acquisitions = new Set(['NOTICE_PUBLIC_FACT', 'SHARE_PRACTICAL_FACT', 'DEFER_ACTIVITY', 'PRACTICE_END', 'GAME_PAUSE',
    'OUTING_CUT_SHORT', 'ARCANE_SURGE', 'PLAN_BROKEN', 'INCIDENT',
    // A committed scene teaches only its actual witnesses, never its audience.
    'SCENE_BANK_BEAT',
    'INK_DESIGN_CHOSEN', 'INK_SLOT_RELEASED', 'INK_APPOINTMENT_BOOKED',
    'INK_APPOINTMENT_COMPLETED', 'INK_APPOINTMENT_INTERRUPTED', 'INK_RESULT_NOTICED', ...THREAD_EVENT_TYPES,
    // Reading an available report, doing the recorded preparation/work, and
    // participating in an actual negotiation/session are explicit acquisitions.
    // Merely announcing an agenda, restriction or future intention is absent.
    'AGENDA_REPORT_READ', 'MEU_REPORT_READ', 'GROUND_PREPARED', 'GROUND_WORK_COMPLETED',
    'INTENT_OFFER', 'INTENT_RESPONSE', 'INTENT_RENEGOTIATE', 'INTENT_COMPLETE', 'INTENT_INTERRUPTED',
    // The supporting, offscreen and night families are pulled in from their own
    // modules rather than retyped, so a new event type cannot quietly grant
    // knowledge just because somebody forgot this list existed. What still holds
    // them to the rail is the participation check below: whatever the type, the
    // learner has to have been in the event.
    ...SUPPORTING_EVENT_TYPES, ...OFFSCREEN_EVENT_TYPES, ...NIGHT_EVENT_TYPES,
    // A multi-day arc's confrontation is the clearest case of the rule rather
    // than an exception to it: they were both in the corridor, so they both
    // know. The signs leading up to it teach nobody anything, which is what
    // keeps the ladder from becoming knowledge before the night it is earned.
    ...ARC_EVENT_TYPES]);
  const byId = new Map(snapshot.events.map(event => [event.id, event]));
  for (const id of ['goaden', 'ashai']) {
    for (const memory of snapshot.characters[id].knowledge) {
      if (memory.provenance === 'canon_seed') continue;
      const via = byId.get(memory.acquisitionEventId);
      assert.ok(acquisitions.has(via.type), `unexpected acquisition ${via.type}`);
      if (via.type === 'SCENE_BANK_BEAT') {
        assert.ok(via.participants.includes(id), `${id} learned an unwitnessed scene ${via.id}`);
      }
      // The rail that actually matters, and which the type allowlist above only
      // approximates: nothing arrives in a head without a channel. There are
      // exactly two — you were in the event, or the fact is about you.
      //
      // The second is not a loophole, it is the harder half. Goaden recalled to
      // a train at the moment he had promised Davis half an hour learns that he
      // missed it, and `participants` stays empty because participants means
      // physical presence and he is demonstrably elsewhere. What he has is not
      // news reaching him; it is knowledge of his own conduct. A memory whose
      // subject is somebody else and whose event he was absent from has neither
      // channel, and that is the thing this catches.
      if (via.visibility === 'private') continue;
      assert.ok(via.participants.includes(id) || memory.subject === id,
        `${id} learned about ${memory.subject} from ${via.type} without being in it`
        + ` (participants: ${JSON.stringify(via.participants)})`);
    }
  }
});

test('activity starts and status transitions are idempotent under a duplicate request', t => {
  const f = storage(t);
  const recallCity = dayWhere(day => ['ink_visit', 'cafe_outing', 'city_walk'].includes(themeForDay(day, DEFAULT_SEED))
    && isRecallDay(factionsForDay(day, DEFAULT_SEED)));
  const cases = [
    [dayFor('invitation'), ['FACTION_STATUS', 'INSTITUTION_NOTICE', 'CROSS_PATHS', 'INVITATION_AVAILABLE', 'INVITATION_ACCEPTED',
      'NOTICE_PUBLIC_FACT', 'SHARE_PRACTICAL_FACT', 'OFFER_ACTIVITY', 'ACCEPT_ACTIVITY', 'ANNOUNCE_ARRANGEMENT', 'PLAN_CHANGE',
      'MEAL_BEGIN', 'PRACTICE_BEGIN', 'TRAVEL_DEPART', 'END_ENCOUNTER', 'ACKNOWLEDGE_ARRANGEMENT']],
    [dayFor('fatigue'), ['SHARE_PRACTICAL_FACT', 'GAME_BEGIN']],
    [dayFor('quiet_request'), ['DEFER_ACTIVITY', 'SMALL_DISAGREEMENT', 'QUIET_TIME_BEGIN']],
    [dayFor('unfinished_game'), ['GAME_PAUSE', 'GAME_RESUME']],
    [dayFor('gaming_night'), ['GAME_BEGIN']],
    [dayFor('sanctuary_night'), ['MUSIC_LISTEN_BEGIN', 'REST_BEGIN']],
    [recallCity, ['CITY_ACTIVITY_BEGIN', 'OUTING_CUT_SHORT']],
  ];
  for (const [day, types] of cases) {
    const planner = f.open(`plan-${day}`);
    planner.advance(atLondon(day, '00:02'));
    const scheduled = planner.semanticSnapshot().pendingActions.filter(action => action.day === day);
    for (const type of types) {
      const action = scheduled.find(candidate => candidate.type === type);
      assert.ok(action, `expected a scheduled ${type} on the ${themeForDay(day, DEFAULT_SEED)} day`);
      const world = f.open(`idempotent-${day}-${type}`);
      world.advance(action.dueAt - 1);
      const once = reduce(world.semanticSnapshot(), action);
      assert.ok(once.event, `${type} produced no event`);
      const again = reduce(once.state, action);
      assert.deepEqual(again.event.changes, [], `${type} changed state on replay`);
      assert.deepEqual(again.state, once.state, `${type} is not idempotent`);
      assertCanonState(again.state);
    }
  }
});

test('mid-story knowledge boundaries stay out of the world', t => {
  const f = storage(t);
  const world = f.open();
  world.advance(END);
  const snapshot = world.semanticSnapshot();
  // Disclosures that belong after the p.183 checkpoint: Ashai's parentage
  // (PDF ~p.445), J'kobi alive (~p.425), Whisper as Nameless (~p.428), and
  // Goaden's voices, which begin on the very next page.
  const embargoed = ['shonen', 'kartia', "j'kobi", 'jkobi', 'whisper', 'parentage',
    'father', 'daughter', 'mother', 'voices', 'grimoire'];
  const surfaces = [
    JSON.stringify(world.publicProjection()),
    snapshot.events.map(event => event.publicDescription ?? '').join(' '),
    JSON.stringify(Object.keys(snapshot.facts)),
    JSON.stringify(['goaden', 'ashai'].map(id => snapshot.characters[id].knowledge.map(memory => [memory.factKey, memory.value]))),
  ];
  for (const surface of surfaces) {
    for (const term of embargoed) assert.ok(!surface.toLowerCase().includes(term), `embargoed term surfaced: ${term}`);
  }
  // The checkpoint enforced numerically rather than by keyword: nothing either of
  // them remembers may be sourced from a page the story has not reached.
  for (const id of ['goaden', 'ashai']) {
    for (const memory of snapshot.characters[id].knowledge) {
      if (memory.provenance !== 'canon_seed') continue;
      assert.ok(memory.source.physicalPage <= 183, `${id} remembers PDF p.${memory.source.physicalPage}`);
    }
  }
  assert.equal(snapshot.meta.canonAnchors.checkpoint, 'opening-pdf-p183-before-p184-disclosure');
  assert.equal(snapshot.meta.canonAnchors.relationshipStage, 'friends');
  assert.equal(snapshot.meta.canonAnchors.abilities, 'already_taught_only');
});
