import test from 'node:test';
import assert from 'node:assert/strict';
import { editorialEvent, correctEditorialText, EDITORIAL_REVISION } from '../src/editorial.mjs';
import { publicEvents } from '../src/fixture.mjs';
import { openWorld, semanticDigest } from '../src/world.mjs';
import { atLondon } from '../src/time.mjs';
import { buildStoryThread, listStoryThreads } from '../src/story-threads.mjs';

const make = (type, payload = {}, extra = {}) => ({ id: `event:${type}`, occurredAt: 1_000,
  type, location: 'mi6', area: 'common_room', participants: ['goaden', 'ashai'],
  visibility: 'public', publicDescription: 'Original public summary.', prose: 'Original passage.',
  payload, changes: [], causedBy: ['previous-event'], ...extra });

test('copy correction changes the missing building in both old descriptions and passages', () => {
  const old = 'Enchanted Ink was on the wrong street again, and the street it had left was one street shorter than it should be.';
  const source = make('UNEASE', { kind: 'ink_relocation' }, { publicDescription: old, prose: old });
  const revised = editorialEvent(source);
  assert.equal(revised.publicDescription, 'Enchanted Ink was on the wrong street again, and the street it had left had one building fewer than it should.');
  assert.equal(revised.prose, revised.publicDescription);
  assert.equal(source.prose, old);
  assert.equal(correctEditorialText(revised.prose), revised.prose);
});

test('outcomes, attendance and acceptance govern the passage, never the current world or future answers', () => {
  const done = make('INTENT_COMPLETE', { status: 'completed', activity: 'practice' });
  assert.notEqual(editorialEvent(done).prose, done.prose);
  const missing = { ...done, participants: ['goaden'] };
  assert.equal(editorialEvent(missing).prose, missing.prose);
  const pending = { ...done, payload: { activity: 'practice' } };
  assert.equal(editorialEvent(pending, { result: 'completed', characters: { ashai: 'present' } }).prose, pending.prose);
  assert.strictEqual(editorialEvent({ ...done, visibility: 'private' }).prose, done.prose);
  assert.strictEqual(editorialEvent(done, { asOf: 999 }), done);
  assert.equal(editorialEvent(make('UNKNOWN_EVENT')).prose, 'Original passage.');
});

test('Ashai refusing the counteroffer is not rewritten as Goaden refusing her', () => {
  const counter = editorialEvent(make('INTENT_RENEGOTIATE', { status: 'declined', activity: 'quiet' }));
  assert.match(counter.prose, /^Ashai declined/);
  const response = editorialEvent(make('INTENT_RESPONSE', { status: 'declined', activity: 'game' }));
  assert.match(response.prose, /^Goaden/);
});

test('delivery resolution cannot invent accepted supplies, shop closing time, or absent protagonists', () => {
  for (let i = 0; i < 20; i++) {
    const overdue = editorialEvent(make('THREAD_DELIVERY_DEADLINE', { completed: true, outcome: 'missed_window' },
      { id: `deadline:${i}`, location: 'enchanted_ink', participants: [] }));
    assert.doesNotMatch(overdue.prose, /closing time|Goaden|Ashai/);
    assert.match(overdue.prose, /outstanding/);
    const returned = editorialEvent(make('THREAD_DELIVERY_DECIDE', { completed: true, outcome: 'returned' }, { id: `returned:${i}`, participants: [] }));
    assert.match(returned.prose, /returned|went back/);
    const pending = editorialEvent(make('THREAD_DELIVERY_DECIDE', { completed: false, outcome: 'reconciled' }));
    assert.equal(pending.prose, 'Original passage.');
  }
});

test('travel prose does not finish a journey at departure or manufacture weather, opening hours or permission', () => {
  for (let i = 0; i < 20; i++) {
    const source = make('TRAVEL_DEPART', { to: 'sanctuary' }, { id: `travel:${i}`, location: 'streamliner' });
    const revised = editorialEvent(source);
    assert.doesNotMatch(revised.prose, /arrived|came in|slept|whole way|gold|rain|night halls|invitation/i);
    const solo = { ...source, participants: ['goaden'] };
    assert.equal(editorialEvent(solo).prose, solo.prose);
  }
});

test('a summons never places an absent Ashai in the room or gives her knowledge of it', () => {
  const source = make('ARCANE_SURGE', {}, { participants: ['goaden'], area: 'quarters' });
  assert.doesNotMatch(editorialEvent(source).prose, /Ashai|she|her evening|they hate/);
});

test('conversation staging follows the actual payload dialogue and never narrates its answers first', () => {
  const lines = [{ who: 'ashai', text: "That isn't a tear any more. That's a hole with opinions." },
    { who: 'goaden', text: "It's fine, mate." }, { who: 'ashai', text: 'The lining is coming out of the cuff, Goaden.' }];
  const source = make('CONVERSATION', { mood: 'ordinary', lines });
  const staged = editorialEvent(source);
  assert.match(staged.prose, /lining.*cuff/);
  assert.doesNotMatch(staged.prose, /answer|replied|conversation kept|exchange took/);
  assert.deepEqual(staged.payload.lines, lines);
  assert.equal(source.prose, 'Original passage.');
  const other = editorialEvent(make('CONVERSATION', { mood: 'ordinary', lines: [{ who: 'goaden', text: 'Long one.' }] }));
  assert.doesNotMatch(other.prose, /lining|cuff|Ashai spoke/);
});

test('a gaming arrangement reads as a later plan rather than an immediate room change', () => {
  const source = make('ANNOUNCE_ARRANGEMENT', {}, { prose: undefined,
    publicDescription: "Goaden and Ashai took up Yukon's challenge in the MI6 gaming room." });
  const revised = editorialEvent(source);
  assert.match(revised.publicDescription, /agreed.*later/);
  assert.equal(revised.location, source.location);
  assert.deepEqual(revised.changes, source.changes);
});

test('resuming a game cannot narrate its duration or ending before it happens', () => {
  const source = make('GAME_RESUME', {}, { prose: undefined,
    publicDescription: 'A game went on between them for longer than either meant it to.' });
  const revised = editorialEvent(source);
  assert.match(revised.publicDescription, /returned to their unfinished game/);
  assert.doesNotMatch(revised.publicDescription, /longer|finished their|won|lost/);
  assert.equal(revised.register, source.register);
});

test('editorial reads are stable and retain all canonical effects, identity and original dialogue', () => {
  const source = make('INTENT_COMPLETE', { status: 'completed', activity: 'practice', lines: [{ who: 'goaden', text: 'Recorded words.' }] },
    { changes: [{ entity: 'character', id: 'ashai', field: 'knowledge', after: ['PRIVATE_KNOWLEDGE'] }], conditions: ['unchanged'] });
  const before = structuredClone(source), first = editorialEvent(source);
  const facts = row => { const copy = { ...row }; for (const key of ['publicDescription', 'prose', 'register', 'editorialRevision']) delete copy[key]; return copy; };
  assert.deepEqual(facts(first), facts(before));
  for (let i = 0; i < 100; i++) assert.deepEqual(editorialEvent(source, { now: Date.now(), viewers: i, privateReason: 'DO_NOT_PUBLISH' }), first);
  assert.deepEqual(source, before);
  assert.equal(first.editorialRevision, EDITORIAL_REVISION);
  assert.deepEqual(editorialEvent(first), first);
  assert.doesNotMatch(JSON.stringify(publicEvents({ events: [source] })), /PRIVATE_KNOWLEDGE|DO_NOT_PUBLISH|causedBy|changes|knowledge/);
});

test('live-shaped history, feed and owned trails use the same edition without changing persisted state', () => {
  const world = openWorld({ dbPath: ':memory:', startMs: atLondon('2026-09-04', '00:00') });
  try {
    world.advance(atLondon('2026-09-09', '00:00'));
    const before = world.semanticSnapshot(), digest = semanticDigest(before), stats = world.operationalStats();
    const page = world.publicProjection(), recent = world.publicHistory({ limit: 100 });
    const rendered = new Map(publicEvents(before, Infinity).map(event => [event.id, event]));
    for (const event of [...page.events, ...recent.events]) assert.deepEqual(event, rendered.get(event.id));
    for (const row of listStoryThreads(before)) {
      const trail = buildStoryThread(before, row, { eventById: id => world.eventById(id) });
      for (const event of trail.events) {
        assert.equal(event.description, rendered.get(event.id).description);
        assert.equal(event.prose, rendered.get(event.id).prose);
      }
    }
    // The event itself contains the historical sleeping transition. Later
    // snapshots are neither necessary nor safe for supplying this detail.
    const call = before.events.find(event => event.type === 'NIGHT_CALL');
    assert.ok(call); assert.match(editorialEvent(call).publicDescription, /woke/);
    for (let i = 0; i < 3; i++) { world.publicProjection(); world.publicHistory(); }
    assert.equal(semanticDigest(world.semanticSnapshot()), digest);
    assert.deepEqual(world.operationalStats(), stats);
  } finally { world.close(); }
});

test('yard work distinguishes completed preliminary checks from the work starting now', () => {
  const prepared = editorialEvent(make('GROUND_WORK_OPPORTUNITY', { prepared: true }));
  assert.match(prepared.prose, /preliminary checks were complete.*Goaden and Ashai began the remaining work/);
  assert.doesNotMatch(prepared.prose, /already started|themselves|crew|roster|official/);

  const unprepared = editorialEvent(make('GROUND_WORK_OPPORTUNITY', { prepared: false }));
  assert.match(unprepared.prose, /checks and preparations still had to be done/);
  assert.doesNotMatch(unprepared.prose, /reopened|complete\./);
  const solo = editorialEvent(make('GROUND_WORK_OPPORTUNITY', { prepared: true, resumed: true }, { participants: ['ashai'] }));
  assert.match(solo.prose, /^Ashai returned.*still closed/);
  assert.doesNotMatch(solo.prose, /Goaden|they worked/);
  const weather = make('GROUND_WORK_OPPORTUNITY', { outcome: 'weather_deferred' }, { participants: [] });
  assert.equal(editorialEvent(weather).prose, weather.prose);
});

test('GROUND_WORK_COMPLETED carries forward the yard preparations rather than bare reset', () => {
  const completed = editorialEvent(make('GROUND_WORK_COMPLETED', { outcome: 'reopened', method: 'cooperative_reset' }));
  assert.match(completed.prose, /yard preparations finished between them/);
  assert.doesNotMatch(completed.prose, /with the reset finished/);
});

test('a cancelled outing reports the cancellation without inventing the later callout result', () => {
  const source = make('PLAN_BROKEN', {}, { publicDescription: 'An MI6 callout broke the evening Goaden and Ashai had arranged at Sanctuary.' });
  const revised = editorialEvent(source);
  assert.match(revised.prose, /MI6 callout.*Sanctuary/);
  assert.doesNotMatch(revised.prose, /hurt|injur|safe|by nine|returned/);
  assert.equal(editorialEvent({ ...source, publicDescription: 'A different future plan broke.' }).prose, source.prose);
});

test('an invitation does not become a shared or completed visit before it is arranged', () => {
  const source = make('INVITATION_ACCEPTED', {}, { participants: ['ashai'], publicDescription: 'Ashai received a Sanctuary guest invitation.' });
  const revised = editorialEvent(source);
  assert.match(revised.prose, /Ashai.*Sanctuary.*still had to be arranged/);
  assert.doesNotMatch(revised.prose, /Goaden|evening|went|entered/);
});

test('the selected negotiation gives its own answer and an unstarted interruption stays unstarted', () => {
  const lines = [{ who: 'goaden', text: 'Could we make it quiet? Just for a bit.' }, { who: 'ashai', text: 'That I can arrange.' }];
  const source = make('INTENT_RENEGOTIATE', { status: 'reserved', activity: 'quiet', lines });
  const revised = editorialEvent(source);
  assert.doesNotMatch(revised.prose, /agreed|declined|no agreement|had yet to answer/);
  assert.deepEqual(revised.payload.lines, lines);
  const interrupted = editorialEvent(make('INTENT_INTERRUPTED', { status: 'interrupted', activity: 'game' }, { participants: [] }));
  assert.doesNotMatch(interrupted.prose, /had to break off|controller|stood|sat|played/);
  assert.match(interrupted.prose, /unfinished/);
  const lapsed = editorialEvent(make('INTENT_RESPONSE', { status: 'declined' }, { participants: [],
    publicDescription: 'The short MI6 offer lapsed before Goaden and Ashai could agree it.' }));
  assert.match(lapsed.prose, /before they could agree/);
  assert.doesNotMatch(lapsed.prose, /declined|refused|heard him out/);
});

test('a jacket continuation identifies the object before its pronouns and retains the recorded words', () => {
  const lines = [{ who: 'goaden', text: "It's back, yeah." }, { who: 'goaden', text: 'She has left the burn on the shoulder.' }];
  const source = make('CONVERSATION', { lines });
  assert.match(editorialEvent(source).prose, /repaired jacket/);
  assert.deepEqual(editorialEvent(source).payload.lines, source.payload.lines);
});
