import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldStore, semanticDigest } from '../experiment-l/src/world.mjs';
import { createFixture, DEFAULT_SEED, publicEvents } from '../src/fixture.mjs';
import { atLondon, londonDate, MINUTE_MS as MIN } from '../src/time.mjs';
import { openWorld } from '../src/world.mjs';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { SUPPORTING_IDS, SUPPORTING_RULES, initialSupportingStories, eligibleSupportingGuests,
  supportingStoryAvailability, supportingLeadAvailable, noteSupportingAppearance,
  supportingDayActions, supportingEncounterActions, issueSupportingActions, resolveSupportingAction,
  interruptSupportingStories, assertSupportingStories, publicSupportingSummaries } from '../src/supporting-stories.mjs';

const START = atLondon('2026-09-07', '00:00'), AT = atLondon('2026-09-07', '12:34');
const base = createFixture({ startMs: START });
const names = ids => new Set(ids);
const learned = (state, lead, key, now) => state.characters[lead].knowledge.find(memory => memory.factKey === key
  && memory.sourceEventId === state.facts[key]?.sourceEventId && memory.learnedAt <= now
  && (memory.validUntil == null || memory.validUntil > now));

function stateFor(guest = 'yukon', { lead = 'goaden', location = 'mi6', area = 'common_room', at = AT } = {}) {
  const state = base.initialState(); state.supportingStories = initialSupportingStories(); state.encounter = null;
  for (const actor of Object.values(state.characters)) Object.assign(actor, { activity: 'sleeping', area: 'quarters',
    location: 'mi6', journey: null, conditions: [], activitySince: START, activityUntil: null });
  Object.assign(state.characters[lead], { location, area, activity: location === 'mi6' ? 'unhurried_time'
    : location === 'enchanted_ink' ? 'visiting_enchanted_ink' : 'walking_the_city' });
  for (const id of SUPPORTING_IDS) if (id !== guest && !(['anarchy', 'balthazar'].includes(id) && ['anarchy', 'balthazar'].includes(guest)))
    state.supportingStories.appearances[id] = { at: at - MIN, eventId: `controlled-prior:${id}`, count: 1 };
  return state;
}
function context(state, action, extra = {}) {
  const id = `event:${action.id}`, now = action.dueAt;
  const event = { id, type: action.type, occurredAt: now, visibility: 'private', participants: [], causedBy: [], payload: {}, changes: [] };
  const set = (field, value) => { event.changes.push({ entity: 'world', id: 'shared', field,
    before: structuredClone(state[field]), after: structuredClone(value) }); state[field] = value; };
  const ctx = { state, action, id, now, seed: 'supporting-test-v1', event, followups: [], ops: {
    setSupportingStories: value => set('supportingStories', value),
    setArrangement: (key, value) => set('arrangements', { ...state.arrangements, [key]: value }),
    createFact(key, kind, subject, value, validUntil) { const fact = { key, kind, subject, value,
      sourceEventId: id, createdAt: now, validUntil }; set('facts', { ...state.facts, [key]: fact }); return fact; },
    learn(lead, fact, provenance) { if (learned(state, lead, fact.key, now)) return;
      state.characters[lead].knowledge.push({ factKey: fact.key, sourceEventId: fact.sourceEventId,
        acquisitionEventId: id, learnedAt: now, validUntil: fact.validUntil, provenance, visibility: 'private' }); },
    useMemory: (lead, key) => learned(state, lead, key, now), actorAvailable: () => true,
    publish(text) { event.visibility = 'public'; event.publicDescription = text; },
    skip(reason) { event.payload = { outcome: 'skipped', reason }; },
  }, ...extra };
  return ctx;
}
function harness(guest, options = {}) {
  const state = stateFor(guest, options), at = options.at ?? AT;
  const source = context(state, { id: 'actual-public-source', type: 'ACTIVITY_COMPLETE', dueAt: at - MIN });
  const queue = issueSupportingActions(source, [{ id: 'controlled-probe', type: 'SUPPORTING_COMMITMENT',
    dueAt: at, priority: 28, day: londonDate(at), version: 1, actors: [] }]), events = [];
  const commit = action => { const ctx = context(state, action); resolveSupportingAction(ctx);
    queue.push(...ctx.followups); events.push(ctx.event); assertSupportingStories(state); return ctx; };
  const next = () => { queue.sort((a, b) => a.dueAt - b.dueAt || a.priority - b.priority || a.id.localeCompare(b.id));
    const action = queue.shift(); assert.ok(action); return commit(action); };
  const first = next(); assert.equal(first.event.visibility, 'public');
  const story = () => Object.values(state.supportingStories.instances)[0];
  assert.ok(story());
  const drain = () => { for (let n = 0; queue.length && n < 30; n++) next(); assert.equal(queue.length, 0); };
  return { state, queue, events, first, story, commit, next, drain };
}

test('all currently approved supporting characters have a canon-permitted opportunity; guardians and the shared body stay constrained', () => {
  const mi6Goaden = stateFor(), mi6Ashai = stateFor('greah', { lead: 'ashai' });
  const ink = stateFor('emily', { location: 'enchanted_ink', area: 'venue' });
  const all = names([...eligibleSupportingGuests(mi6Goaden, 'goaden', AT), ...eligibleSupportingGuests(mi6Ashai, 'ashai', AT),
    ...eligibleSupportingGuests(ink, 'goaden', AT)]);
  assert.deepEqual([...all].sort(), [...SUPPORTING_IDS].sort());
  assert.equal(eligibleSupportingGuests(mi6Goaden, 'goaden', AT).includes('emily'), false);
  assert.equal(eligibleSupportingGuests(mi6Goaden, 'goaden', AT).includes('greah'), false);
  assert.equal(eligibleSupportingGuests(mi6Ashai, 'ashai', AT).includes('kai'), false);
  for (const activity of ['sleeping', 'training', 'in_a_briefing', 'receiving_tattoo']) {
    mi6Goaden.characters.goaden.activity = activity; assert.deepEqual(eligibleSupportingGuests(mi6Goaden, 'goaden', AT), []);
  }
  const bonded = harness('anarchy');
  assert.deepEqual(bonded.story().guests, ['anarchy', 'balthazar']);
  assert.equal(supportingStoryAvailability(bonded.state, 'anarchy', { atMs: AT + MIN }), false);
  assert.equal(supportingStoryAvailability(bonded.state, 'balthazar', { atMs: AT + MIN }), false);
  assert.equal(supportingLeadAvailable(bonded.state, 'goaden', { atMs: AT + MIN }), false);
});

test('least-recent actual appearance wins; appearance notes require a public scene and retain stable counts', () => {
  const h = harness('davis'); assert.equal(h.story().guest, 'davis');
  const before = structuredClone(h.state.supportingStories.appearances);
  const privateCtx = context(h.state, { id: 'not-a-scene', type: 'SUPPORTING_COMMITMENT', dueAt: AT + MIN });
  noteSupportingAppearance(privateCtx, ['rose']); assert.deepEqual(h.state.supportingStories.appearances, before);
  noteSupportingAppearance(h.first, h.first.event.payload.cast);
  assert.equal(h.state.supportingStories.appearances.davis.count, 1);
  assert.equal(h.state.supportingStories.appearances.davis.eventId, h.first.id);
  privateCtx.event.visibility = 'public'; privateCtx.event.participants = ['goaden'];
  noteSupportingAppearance(privateCtx, ['greah', 'kai']);
  assert.equal(h.state.supportingStories.appearances.greah.eventId, before.greah.eventId);
  assert.equal(h.state.supportingStories.appearances.kai.eventId, privateCtx.id);
});

test('a promise reserves actual attention, learns source-linked facts, and produces a completed encounter plus bounded relationship consequences', () => {
  const h = harness('yukon'), currentActivity = structuredClone(h.state.characters.goaden);
  assert.equal(h.story().status, 'promised');
  assert.ok(learned(h.state, 'goaden', h.story().promiseFactKey, AT));
  h.next(); assert.equal(h.story().status, 'met');
  h.next(); assert.equal(h.story().status, 'kept');
  const result = h.story().result;
  assert.ok(learned(h.state, 'goaden', result.factKey, AT + 10 * MIN));
  assert.equal(h.state.supportingStories.rapport['yukon:goaden'].reliability, 1);
  assert.equal(h.state.supportingStories.rapport['yukon:goaden'].kept, 1);
  assert.equal(h.state.arrangements[h.story().arrangementKey].status, 'completed');
  assert.equal(h.state.characters.goaden.activity, currentActivity.activity);
  assert.equal(h.state.characters.goaden.location, currentActivity.location);
  assert.match(h.events.at(-1).prose, /Yukon leaned forward/);
  const before = structuredClone(h.state); h.next(); assert.deepEqual(h.state, before, 'stale deadline is semantically inert');
});

test('missed and cut-short encounters have different persistent outcomes, no unavailable guest portrait and no imported supporter knowledge', () => {
  for (const [meet, outcome] of [[false, 'missed'], [true, 'cut_short']]) {
    const h = harness('davis'); if (meet) h.next();
    const at = AT + (meet ? 5 : 2) * MIN;
    const interruption = context(h.state, { id: 'actual-recall', type: 'TRAVEL_DEPART', dueAt: at });
    interruptSupportingStories(interruption, 'goaden', 'TRAVEL_DEPART');
    h.state.characters.goaden.location = 'streamliner'; h.state.characters.goaden.journey = { to: 'mi6' };
    h.queue.push(...interruption.followups); h.drain();
    assert.equal(h.story().status, outcome); assert.equal(h.state.arrangements[h.story().arrangementKey].status, 'broken');
    const event = h.events.find(row => row.id === h.story().result.sourceEventId);
    assert.equal(event.payload.cast.includes('davis'), false); assert.deepEqual(event.participants, []);
    assert.equal(h.state.supportingStories.people.davis.knowledge.some(memory => memory.factKey === h.story().result.factKey), false);
    assert.equal(h.state.supportingStories.rapport['davis:goaden'].reliability, 0, 'actual travel interruption is not personal unreliability');
    assert.equal(h.state.facts[h.story().result.factKey].value.interruption.eventId, interruption.id);
    assert.equal(h.state.supportingStories.rapport['davis:goaden'][meet ? 'cutShort' : 'missed'], 1);
  }
});

test('ordinary duty reservations, current encounters, night recovery and competing arrangements prevent a new invitation', () => {
  const state = stateFor('davis');
  state.agendas.supporting.davis.commitment = { startAt: AT - MIN, until: AT + 30 * MIN };
  assert.equal(eligibleSupportingGuests(state, 'goaden', AT).includes('davis'), false);
  assert.deepEqual(eligibleSupportingGuests(state, 'goaden', AT, { canUseActor: () => false }), []);
  state.encounter = { until: AT + MIN, area: 'common_room' };
  assert.deepEqual(eligibleSupportingGuests(state, 'goaden', AT), []);
  state.encounter = null;
  state.arrangements.existing = { party: ['goaden'], status: 'accepted', startAt: AT, until: AT + 30 * MIN };
  assert.deepEqual(eligibleSupportingGuests(state, 'goaden', AT), []);
});

test('callback requires actual learned outcome and a later eligible meeting; failed callback is bounded and cannot rewrite the ending', () => {
  const h = harness('kartel'); h.drain(); const result = structuredClone(h.story().result);
  const originalKnowledge = structuredClone(h.state.characters.goaden.knowledge), later = AT + 24 * 60 * MIN;
  h.state.characters.goaden.knowledge = [];
  h.state.supportingStories.nextEligibleAt = later + MIN;
  function probe(at, suffix) {
    const source = context(h.state, { id: `public-source-${suffix}`, dueAt: at - 1 });
    const actions = issueSupportingActions(source, [{ id: `later-${suffix}`, type: 'SUPPORTING_COMMITMENT', dueAt: at,
      priority: 28, day: londonDate(at), actors: [], version: 1 }]);
    return h.commit(actions[0]);
  }
  probe(later, 'unknown'); assert.equal(h.queue.length, 0); assert.equal(h.story().callbackEventId, null);
  h.state.characters.goaden.knowledge = originalKnowledge;
  probe(later + 1, 'known'); assert.equal(h.queue.at(-1).type, 'SUPPORTING_CALLBACK');
  h.next(); assert.ok(h.story().callbackEventId);
  assert.ok(h.events.at(-1).causedBy.includes(result.sourceEventId));
  // The actual ending and its source survive, while the callback can show the
  // chair being offered again without a generic sentence announcing 'kept'.
  assert.equal(h.events.at(-1).payload.outcome, 'kept');
  assert.match(h.events.at(-1).publicDescription, /chair|table/);
  assert.doesNotMatch(h.events.at(-1).publicDescription, /unfinished|did not come off|cut short/);
  assert.deepEqual(h.story().result, result);
  const before = structuredClone(h.state); h.commit({ ...h.events.at(-1), id: 'forged-callback', dueAt: later + 3,
    type: 'SUPPORTING_CALLBACK', version: 1, storyId: h.story().id, token: h.story().token });
  assert.deepEqual(h.state, before);
});

test('owned scheduling rejects forged IDs, times, cast, version and tokens without semantic changes; lazy activation schedules future probes only', () => {
  const h = harness('rose'), action = h.queue.find(item => item.type === 'SUPPORTING_ENCOUNTER');
  for (const patch of [{ id: 'forged' }, { dueAt: action.dueAt + 1 }, { actors: ['ashai'] }, { version: 2 }, { token: 'forged' }]) {
    const before = structuredClone(h.state); h.commit({ ...action, ...patch }); assert.deepEqual(h.state, before);
  }
  const before = structuredClone(h.state); h.commit(h.first.action); assert.deepEqual(h.state, before);
  const actions = supportingDayActions({ state: h.state, day: '2026-09-07', now: atLondon('2026-09-07', '16:00'),
    parentActionId: 'activation', parentEventId: 'activation-event' });
  assert.equal(actions.length, 1); assert.equal(actions[0].dueAt, atLondon('2026-09-07', '19:06'));
  assert.deepEqual(supportingDayActions({ state: h.state, day: '2026-09-07', now: atLondon('2026-09-07', '22:00'),
    parentActionId: 'activation', parentEventId: 'activation-event' }), []);
  const publicValue = JSON.stringify(publicSupportingSummaries(h.state, AT + MIN));
  for (const forbidden of ['token', 'FactKey', 'knowledge', 'reliability', 'people', 'appearances', 'issued', 'causal'])
    assert.equal(publicValue.includes(forbidden), false, forbidden);
});

test('a real later venue visit can use the remaining daily slot, giving venue-only Emily an opportunity without new travel or friendship', () => {
  const h = harness('yukon'); h.drain();
  const at = AT + 100 * MIN;
  Object.assign(h.state.characters.goaden, { location: 'enchanted_ink', area: 'venue', activity: 'visiting_enchanted_ink', journey: null,
    activityId: 'actual-ink-activity', activityUntil: at + 55 * MIN });
  h.state.arrangements.parentVisit = { party: ['goaden'], status: 'started', public: true, activity: 'ink_visit',
    startAt: at - 20 * MIN, until: at + 90 * MIN, startedEventId: 'actual-ink-activity' };
  delete h.state.supportingStories.appearances.emily;
  const source = context(h.state, { id: 'actual-ink-visit', dueAt: at });
  const proposals = supportingEncounterActions({ state: h.state, now: at, parentActionId: source.action.id, parentEventId: source.id });
  assert.equal(proposals.length, 1, 'MI6 six-hour cooldown must not veto every city visit');
  const [owned] = issueSupportingActions(source, proposals); h.commit(owned);
  const newest = Object.values(h.state.supportingStories.instances).sort((a, b) => b.openedAt - a.openedAt)[0];
  assert.equal(newest.guest, 'emily'); assert.equal(newest.location, 'enchanted_ink');
  assert.equal(h.state.characters.goaden.location, 'enchanted_ink');
  assert.equal(h.state.supportingStories.counts[londonDate(at)], 2);
  h.drain();
  const resultEvent = h.events.find(row => row.id === h.state.supportingStories.instances[newest.id].result.sourceEventId);
  assert.match(resultEvent.prose, /without a promise to meet again/);
  assert.equal(h.state.relationships.length, 2, 'no friendship or main relationship stage is invented');
});

test('actual integrated month reaches supporting encounters, diverse cast and callbacks without replacing main schedules', t => {
  const world = openWorld({ dbPath: ':memory:', startMs: atLondon('2026-09-04', '00:00'), seed: DEFAULT_SEED });
  try {
    world.advance(atLondon('2026-10-02', '00:00'));
    const snapshot = world.semanticSnapshot(), state = snapshot.supportingStories;
    const starts = snapshot.events.filter(event => event.type === 'SUPPORTING_COMMITMENT' && event.visibility === 'public');
    const outcomes = snapshot.events.filter(event => event.type === 'SUPPORTING_OUTCOME' && event.visibility === 'public');
    const callbacks = snapshot.events.filter(event => event.type === 'SUPPORTING_CALLBACK' && event.visibility === 'public');
    assert.ok(starts.length >= 10, `supporting promises must execute: ${starts.length}`);
    assert.ok(outcomes.length >= 8, `supporting outcomes must execute: ${outcomes.length}`);
    assert.ok(callbacks.length >= 1, 'actual schedule must provide callbacks');
    assert.ok(Object.keys(state.appearances).length >= 10, 'existing cast must not collapse to one frequent face');
    const guests = starts.map(event => snapshot.facts[`${event.payload.supportingStoryId}:promise`]?.value.guest);
    assert.ok(guests.includes('emily'), 'venue-only Emily must receive an actual ordinary opportunity');
    t.diagnostic(JSON.stringify({ promises: starts.length, outcomes: outcomes.length, callbacks: callbacks.length,
      featured: Object.fromEntries([...new Set(guests)].map(guest => [guest, guests.filter(id => id === guest).length])) }));
    for (const event of [...starts, ...outcomes, ...callbacks]) assert.ok(event.causedBy.length);
    assertSupportingStories(snapshot);
    const before = semanticDigest(snapshot); for (let n = 0; n < 5; n++) world.publicProjection();
    assert.equal(semanticDigest(world.semanticSnapshot()), before);
  } finally { world.close(); }
});

test('bounded supporting fixture resumes queued causal stages with the same result under absence, small advances, process restart and duplicates', t => {
  const state = stateFor('yukon'), source = context(state, { id: 'source', dueAt: AT - MIN });
  rememberedMeeting(state, { guest: 'yukon', at: START + MIN });
  const initial = issueSupportingActions(source, [{ id: 'restart-probe', type: 'SUPPORTING_COMMITMENT', dueAt: AT,
    day: londonDate(AT), version: 1, priority: 28, actors: [] }]);
  const fixture = { ...base, initialState: () => structuredClone(state), initialActions: () => structuredClone(initial),
    reduceAction(s, action, seed) {
      const ctx = context(s, action); ctx.seed = seed; resolveSupportingAction(ctx);
      // Reuse the actual deterministic transaction engine and event validation.
      assertSupportingStories(s); return { event: ctx.event, followups: ctx.followups };
    } };
  const one = new WorldStore({ dbPath: ':memory:', seed: 'same', fixture });
  const frequent = new WorldStore({ dbPath: ':memory:', seed: 'same', fixture });
  const directory = mkdtempSync(join(tmpdir(), 'supporting-stories-')), dbPath = join(directory, 'restart.sqlite');
  t.after(() => { assert.equal(dirname(realpathSync(directory)), realpathSync(tmpdir()));
    assert.ok(basename(directory).startsWith('supporting-stories-')); rmSync(directory, { recursive: true, force: true }); });
  let restarted = new WorldStore({ dbPath, seed: 'same', fixture });
  try {
    const end = AT + 20 * MIN; one.advance(end);
    for (const at of [AT, AT + 4 * MIN, AT + 7 * MIN, AT + 9 * MIN, end, end]) frequent.advance(at);
    restarted.advance(AT + 4 * MIN); restarted.close();
    restarted = new WorldStore({ dbPath, seed: 'same', fixture }); restarted.advance(end); restarted.advance(end);
    assert.deepEqual(frequent.semanticSnapshot(), one.semanticSnapshot());
    assert.deepEqual(restarted.semanticSnapshot(), one.semanticSnapshot());
    assert.equal(Object.values(one.semanticSnapshot().supportingStories.instances)[0].status, 'kept');
    assert.equal(Object.values(one.semanticSnapshot().supportingStories.instances)[0].relationshipChoice.reason, 'familiar_company');
  } finally { one.close(); frequent.close(); restarted.close(); }
});

function rememberedMeeting(state, { guest = 'yukon', lead = 'goaden', id = 'prior-meeting',
  at = AT, outcome = 'kept', witnesses = [lead], interruption = null } = {}) {
  const key = `fact:${id}`, sourceEventId = `event:${id}`;
  state.facts[key] = { key, kind: 'supporting_result', subject: lead, sourceEventId, createdAt: at, validUntil: null,
    value: { guest, outcome, interruption, presentationText: `${guest}'s meeting ${outcome}.` } };
  for (const who of witnesses) (state.characters[who] ?? state.supportingStories.people[who]).knowledge.push({
    factKey: key, sourceEventId, acquisitionEventId: `learned:${who}:${id}`, learnedAt: at + 1, validUntil: null });
}
function chooseMeeting(state, at, id = 'history-probe') {
  const source = context(state, { id: `source:${id}`, dueAt: at - 1 });
  const [action] = issueSupportingActions(source, [{ id, type: 'SUPPORTING_COMMITMENT', dueAt: at,
    priority: 28, day: londonDate(at), version: 1, actors: [] }]);
  const ctx = context(state, action); resolveSupportingAction(ctx); assertSupportingStories(state); return ctx;
}

test('paired actual selection changes when a known meeting matters; unknown history, cast rotation and hard gates stay intact', () => {
  const at = AT + 8 * 24 * 60 * MIN, ordinary = stateFor('davis', { at });
  const remembered = structuredClone(ordinary), unknown = structuredClone(ordinary), unavailable = structuredClone(ordinary);
  rememberedMeeting(remembered, { at: at - 4 * 24 * 60 * MIN });
  rememberedMeeting(unknown, { at: at - 4 * 24 * 60 * MIN, witnesses: ['yukon'] });
  rememberedMeeting(unavailable, { guest: 'emily', at: at - 4 * 24 * 60 * MIN });
  const chosen = s => Object.values(s.supportingStories.instances).at(-1)?.guest;
  chooseMeeting(ordinary, at); const decision = chooseMeeting(remembered, at); chooseMeeting(unknown, at); chooseMeeting(unavailable, at);
  assert.equal(chosen(ordinary), 'davis'); assert.equal(chosen(remembered), 'yukon');
  assert.equal(chosen(unknown), 'davis', 'another person knowing does not grant the lead knowledge');
  assert.equal(chosen(unavailable), 'davis', 'remembering Emily cannot make her available at MI6');
  assert.ok(decision.event.causedBy.includes('event:prior-meeting'));
  assert.ok(decision.event.causedBy.includes('learned:goaden:prior-meeting'));
  const [reading] = publicEvents({ events: [decision.event] });
  assert.match(reading.prose, /remembered the last time with Yukon/);
  assert.equal(JSON.stringify(reading).includes('fact:prior-meeting'), false, 'internal knowledge keys are not reader payload');
  const rotated = stateFor('davis', { at }); rememberedMeeting(rotated, { at: at - 4 * 24 * 60 * MIN });
  rotated.supportingStories.counts[londonDate(at)] = 1; chooseMeeting(rotated, at);
  assert.equal(chosen(rotated), 'davis', 'the second daily slot retains least-seen cast variety');
});

test('a guest can actually defer after two learned misses, without a reservation, invented promise, or queued encounter', () => {
  const at = AT + 8 * 24 * 60 * MIN, state = stateFor('davis', { at });
  // All other possible guests have recently received a turn. This preserves
  // the real 72-hour gate rather than making a test-only cast permission.
  for (const guest of SUPPORTING_IDS) if (guest !== 'davis') state.supportingStories.lastChoices[
    ['anarchy', 'balthazar'].includes(guest) ? 'anarchy+balthazar' : guest] = { at: at - MIN, eventId: `recent:${guest}`, response: 'accepted' };
  for (const [id, days] of [['earlier', 6], ['later', 3]]) rememberedMeeting(state, { id, guest: 'davis',
    at: at - days * 24 * 60 * MIN, outcome: 'missed', witnesses: ['goaden', 'davis'] });
  const unaware = structuredClone(state); unaware.supportingStories.people.davis.knowledge = [];
  const deferred = chooseMeeting(state, at), accepted = chooseMeeting(unaware, at);
  assert.equal(deferred.event.visibility, 'public'); assert.equal(deferred.event.payload.outcome, 'deferred');
  assert.equal(deferred.followups.length, 0); assert.equal(Object.keys(state.supportingStories.instances).length, 0);
  assert.equal(Object.keys(state.arrangements).length, 0);
  assert.equal(state.supportingStories.counts[londonDate(at)], 1);
  assert.equal(state.supportingStories.lastChoices.davis.response, 'deferred');
  assert.ok(accepted.followups.some(action => action.type === 'SUPPORTING_ENCOUNTER'));
  assert.equal(Object.values(unaware.supportingStories.instances)[0].guest, 'davis');
  for (const id of ['earlier', 'later']) {
    assert.ok(deferred.event.causedBy.includes(`event:${id}`));
    assert.ok(deferred.event.causedBy.includes(`learned:davis:${id}`));
  }
  const [reading] = publicEvents({ events: [deferred.event] });
  assert.match(reading.prose, /two meetings that had never begun/);
  assert.equal(reading.lines.length, 2); assert.match(reading.lines[0].text, /Leave it for now/);
  assert.doesNotMatch(reading.prose, /forgiv|neglect|angry|blam|unreliab/i);
  const authored = { ...deferred.event, lines: [{ who: 'davis', text: 'Exact recorded refusal. Bloody timing.' }] };
  assert.deepEqual(publicEvents({ events: [authored] })[0].lines.map(line => ({ who: line.who, text: line.text })), authored.lines);
});

test('an owned scene-bank gathering blocks overlapping supporting reservations and releases at its actual end', () => {
  const state = stateFor('yukon');
  state.sceneBank = { session: { cast: ['goaden', 'yukon'], startAt: AT, until: AT + 10 * MIN } };
  assert.equal(supportingStoryAvailability(state, 'yukon', { atMs: AT }), false);
  assert.equal(supportingLeadAvailable(state, 'goaden', { atMs: AT + MIN }), false);
  assert.deepEqual(eligibleSupportingGuests(state, 'goaden', AT), []);
  assert.equal(supportingStoryAvailability(state, 'yukon', { atMs: AT - 1 }), true);
  assert.equal(supportingLeadAvailable(state, 'goaden', { atMs: AT + 10 * MIN }), true);
  assert.ok(eligibleSupportingGuests(state, 'goaden', AT + 10 * MIN).includes('yukon'));
});
