import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { openWorld, semanticDigest } from '../src/world.mjs';
import { publicEvents } from '../src/fixture.mjs';
import { atLondon } from '../src/time.mjs';
import { createApp } from '../server.mjs';
import { collectPublicContext, publicStoryRef } from '../src/public-story-context.mjs';
import { buildScenePacket, deterministicFallbackScene } from '../src/cinematics.mjs';
import { editorialCinematicRecordForApi } from '../src/editorial-cinematics.mjs';

const START = atLondon('2026-09-08', '00:00');
const THROUGH = atLondon('2026-09-15', '12:00');
const event = (id, at, options = {}) => ({ id, seq: at, occurredAt: START + at,
  type: 'SUPPORTING_CALLBACK', visibility: 'public', location: 'mi6', participants: ['ashai'],
  publicDescription: `Public passage ${id}.`, payload: {}, causedBy: [], ...options });

test('week return pages cover the persisted interval beyond 240 rows with a fixed reading ceiling', () => {
  const world = openWorld({ dbPath: ':memory:', startMs: START });
  try {
    world.advance(THROUGH);
    const snapshot = world.semanticSnapshot(), digest = semanticDigest(snapshot);
    const expected = snapshot.events.filter(row => row.visibility === 'public' && row.publicDescription
      && row.occurredAt >= START && row.occurredAt <= THROUGH);
    assert.ok(expected.length > 240);
    world.semanticSnapshot = () => { throw new Error('A return must not load the full ledger'); };
    const pages = []; let beforeSeq;
    do {
      const page = world.publicHistory({ afterMs: START, throughMs: THROUGH, beforeSeq, limit: 100 });
      assert.ok(page.events.length <= 100);
      assert.equal(page.continuityId, world.publicProjection().continuityId);
      assert.deepEqual(page.coverage, { after: START, through: THROUGH });
      assert.equal(page.complete, page.nextCursor === null);
      pages.unshift(...page.events); beforeSeq = page.nextCursor;
    } while (beforeSeq);
    assert.deepEqual(pages.map(row => row.id), expected.map(row => row.id));
    assert.deepEqual(pages.map(row => row.narrativeOrder), expected.map(row => row.seq));
    assert.equal(new Set(pages.map(row => row.id)).size, expected.length);
    const { presentationFloor, ...presentation } = world.presentationSnapshot();
    assert.equal(semanticDigest({ ...snapshot, ...presentation, events: snapshot.events }), digest);
    world.advance(THROUGH + 86_400_000);
    assert.deepEqual(world.publicHistory({ afterMs: START, throughMs: THROUGH, limit: 100 }).events,
      pages.slice(-100), 'new world activity cannot alter a fixed return window');
    for (const options of [{ beforeSeq: -1 }, { afterMs: NaN }, { throughMs: Infinity }, { afterMs: THROUGH, throughMs: START }])
      assert.throws(() => world.publicHistory(options), RangeError);
  } finally { world.close(); }
});

test('story identity is the owned instance, including historical night ledger identity, never its template family', () => {
  const a = event('one', 1, { payload: { offscreenStoryId: 'life:one', family: 'the_swing', privateCanary: 'HIDDEN' } });
  const b = event('two', 2, { payload: { offscreenStoryId: 'life:two', family: 'the_swing' } });
  assert.notDeepEqual(publicStoryRef(a), publicStoryRef(b));
  const night = event('night', 3, { type: 'NIGHT_DEBRIEF', changes: [{ entity: 'world', field: 'nightStories',
    path: ['episodes', 'night:owned', 'lastEventId'], after: 'night' }] });
  assert.deepEqual(publicStoryRef(night), { type: 'story', id: 'night:owned' });
  const projected = publicEvents({ events: [a, b, night] }, Infinity);
  assert.doesNotMatch(JSON.stringify(projected), /privateCanary|HIDDEN|lastEventId|"changes"|"payload"/);
});

test('committed night returns and recoveries retain their exact story-ledger episode in public history', () => {
  const world = openWorld({ dbPath: ':memory:', startMs: atLondon('2026-09-07', '00:00') });
  try {
    world.advance(atLondon('2026-09-08', '12:00'));
    const snapshot = world.semanticSnapshot();
    const rows = snapshot.events.filter(row => row.visibility === 'public'
      && ['NIGHT_WORK_END', 'NIGHT_RETURN', 'NIGHT_RECOVERED'].includes(row.type));
    assert.ok(rows.some(row => row.type === 'NIGHT_RETURN'));
    assert.ok(rows.some(row => row.type === 'NIGHT_RECOVERED'));
    const raw = JSON.stringify(rows);
    const projected = new Map(world.publicHistory({ limit: 100 }).events.map(row => [row.id, row]));
    for (const row of rows) {
      const owner = row.changes.find(change => change.entity === 'story' && change.id === 'nightStories'
        && change.field === 'nightStories' && change.path?.[0] === 'episodes');
      assert.ok(owner, 'the real reducer must provide an explicit episode owner');
      assert.deepEqual(publicStoryRef(row), { type: 'story', id: owner.path[1] });
      assert.deepEqual(projected.get(row.id).storyRef, publicStoryRef(row));
      assert.equal(publicStoryRef({ ...row, changes: row.changes.map(change => ({ ...change, entity: 'character' })) }), null);
      assert.equal(publicStoryRef({ ...row, visibility: 'private' }), null);
    }
    const one = rows[0], owner = one.changes.find(change => change.path?.[0] === 'episodes');
    assert.equal(publicStoryRef({ ...one, changes: [owner, { ...owner, path: ['episodes', 'night:other', 'lastEventId'] }] }), null,
      'ambiguous ownership must not merge unrelated nights');
    assert.equal(JSON.stringify(rows), raw, 'identity extraction cannot edit committed events');
    assert.doesNotMatch(JSON.stringify([...projected.values()]), /"changes"|"payload"|"lastEventId"/);
  } finally { world.close(); }
});

test('old public origins survive the recent window; context is ordered, bounded and cannot leak private or future sources', () => {
  const origin = event('origin', 1, { type: 'SUPPORTING_COMMITMENT', payload: { supportingStoryId: 'support:one' } });
  const privateSource = event('private', 2, { visibility: 'private', publicDescription: 'SECRET_CANARY' });
  const future = event('future', 999999999, { publicDescription: 'FUTURE_CANARY' });
  const target = event('return', 8 * 86_400_000, { causedBy: [origin.id, privateSource.id, future.id, 'missing'],
    payload: { supportingStoryId: 'support:one' } });
  const rows = new Map([origin, privateSource, future, target].map(row => [row.id, row]));
  const lookup = id => rows.get(id);
  const projected = publicEvents({ events: [target], eventById: lookup })[0];
  assert.equal(projected.contextBridge.originEventId, origin.id);
  assert.match(projected.contextBridge.timeLabel, /2026-09-08/);
  assert.deepEqual(projected.earlierEventIds, [origin.id]);
  const context = collectPublicContext(target, lookup);
  assert.deepEqual(context.rows.map(row => row.id), [origin.id, target.id]);
  assert.equal(context.complete, true);
  assert.equal(collectPublicContext(target, lookup, { limit: 1 }).complete, false);
  assert.equal(collectPublicContext(privateSource, lookup), null);
  assert.doesNotMatch(JSON.stringify(projected), /SECRET_CANARY|FUTURE_CANARY|private|missing/);
  const report = event('report', 10, { type: 'AGENDA_REPORT', payload: { operationId: 'operation:owned' } });
  const read = event('read', 20, { type: 'AGENDA_REPORT_READ', causedBy: [report.id] });
  const projectedRead = publicEvents({ events: [report, read] }).at(-1);
  assert.deepEqual(projectedRead.storyRef, { type: 'operation', id: 'operation:owned' });
  const practice = event('practice', 40, { type: 'OFFSCREEN_START', causedBy: [origin.id, report.id],
    payload: { offscreenStoryId: 'life:later', continuationSourceEventId: origin.id } });
  const projectedPractice = publicEvents({ events: [origin, report, practice] }).at(-1);
  assert.equal(projectedPractice.contextBridge.originEventId, origin.id,
    'an earned later check exposes its actual older result, not a newer day-plan trigger');
});

test('Node HTTP history and context expose complete ranges and persisted origins with safe invalid-request responses', async t => {
  const world = openWorld({ dbPath: ':memory:', startMs: START });
  world.advance(THROUGH);
  const server = createApp({ world, now: () => THROUGH, cinematicOptions: { enabled: false } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); world.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${base}/api/history?after=${START}&through=${THROUGH}&limit=100`);
  assert.equal(response.status, 200);
  const page = await response.json(); assert.equal(page.events.length, 100); assert.equal(page.complete, false);
  const old = world.publicHistory({ afterMs: START, throughMs: START + 86_400_000, limit: 100 }).events[0];
  const contextResponse = await fetch(`${base}/api/events/${encodeURIComponent(old.id)}/context`);
  assert.equal(contextResponse.status, 200);
  const context = await contextResponse.json(); assert.equal(context.event.id, old.id);
  assert.equal(context.continuityId, page.continuityId);
  assert.equal(context.events.at(-1).id, old.id);
  assert.equal((await fetch(`${base}/api/history?after=nope`)).status, 400);
  assert.equal((await fetch(`${base}/api/events/missing/context`)).status, 404);
});

test('history identity separates two persisted continuities at the same timestamp', () => {
  const one = openWorld({ dbPath: ':memory:', startMs: START, seed: 'return-identity-one' });
  const two = openWorld({ dbPath: ':memory:', startMs: START, seed: 'return-identity-two' });
  try {
    one.advance(START + 1); two.advance(START + 1);
    assert.equal(one.publicHistory().continuityId, one.publicProjection().continuityId);
    assert.equal(two.publicHistory().continuityId, two.publicProjection().continuityId);
    assert.notEqual(one.publicHistory().continuityId, two.publicHistory().continuityId);
  } finally { one.close(); two.close(); }
});

test('a paged legacy conversation and its canonical cache use exact public night proof outside the loaded page', () => {
  const world = openWorld({ dbPath: ':memory:', startMs: START });
  const work = event('night-work-proof', 3.5 * 3_600_000, { seq: 1, type: 'NIGHT_WORK_END', participants: ['goaden', 'ashai'] });
  const recoveries = ['goaden', 'ashai'].map((who, index) => event(`night-recovery:${who}`, 9 * 3_600_000,
    { seq: index + 2, type: 'NIGHT_RECOVERED', participants: [who], causedBy: [work.id] }));
  const talk = event('legacy-talk', 18.75 * 3_600_000, { seq: 4, type: 'CONVERSATION', participants: ['goaden', 'ashai'],
    payload: { mood: 'ordinary', lines: [
      { who: 'goaden', expression: 'idle', text: "You've been up since five." },
      { who: 'ashai', expression: 'guarded', text: 'So have you.' },
      { who: 'goaden', expression: 'smirk', text: 'Yeah, but I carry it better.' },
    ] } });
  try {
    const insert = world.db.prepare('INSERT INTO events (seq,id,occurred_at,semantic_json,recorded_at) VALUES (?,?,?,?,?)');
    for (const row of [work, ...recoveries, talk]) insert.run(row.seq, row.id, row.occurredAt, JSON.stringify(row), new Date().toISOString());
    world.db.prepare('UPDATE world_state SET resolved_through = ? WHERE id = 1').run(talk.occurredAt);
    const rawBefore = JSON.stringify(world.eventById(talk.id));
    const page = world.publicHistory({ afterMs: talk.occurredAt, limit: 1 });
    assert.equal(page.events.length, 1);
    assert.equal(page.events[0].lines[0].text, "You've had a long night.");
    assert.equal(world.publicEventContext(talk.id).event.lines[0].text, "You've had a long night.");
    const packet = buildScenePacket(talk, { events: [talk], characters: {} });
    const record = { eventId: talk.id, occurredAt: talk.occurredAt, acceptedAt: talk.occurredAt,
      status: 'performed', packet, scene: deterministicFallbackScene(packet) };
    const cachedBefore = JSON.stringify(record);
    const api = editorialCinematicRecordForApi(record, { event: talk, snapshot: { events: [] },
      publicSourcesForEvent: source => world.publicDialogueSources(source) });
    assert.equal(api.scene.beats[0].line, "You've had a long night.");
    assert.equal(api.acceptedAt, record.acceptedAt);
    assert.equal(JSON.stringify(record), cachedBefore);
    assert.equal(JSON.stringify(world.eventById(talk.id)), rawBefore);
    // A private replacement cannot serve as proof, even if its text says the same thing.
    world.db.prepare('UPDATE events SET semantic_json = ? WHERE id = ?')
      .run(JSON.stringify({ ...recoveries[1], visibility: 'private' }), recoveries[1].id);
    assert.equal(world.publicHistory({ afterMs: talk.occurredAt, limit: 1 }).events[0].lines[0].text, "You've been up since five.");
  } finally { world.close(); }
});
