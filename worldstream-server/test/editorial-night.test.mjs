import test from 'node:test';
import assert from 'node:assert/strict';
import { nightEditorial } from '../src/editorial-night.mjs';
import { atLondon, MINUTE_MS as MIN } from '../src/time.mjs';

const AT = atLondon('2026-09-06', '02:20');
function event(type, patch = {}) {
  return { id: `test:${type}`, type, visibility: 'public', occurredAt: AT, location: 'mi6',
    area: 'ops_room', participants: ['goaden'], payload: {}, ...patch };
}
const attach = (event, fields = {}) => ({ eventId: event.id, occurredAt: event.occurredAt, asOf: event.occurredAt, ...fields });
const examples = [
  event('NIGHT_WINDOW', { participants: [], payload: { kind: 'readiness_followup' } }),
  event('NIGHT_CALL', { area: 'quarters' }),
  event('NIGHT_CONTACT_ASHAI', { area: 'quarters', participants: ['ashai'] }),
  event('NIGHT_ASHAI_CHOICE', { area: 'quarters', participants: ['ashai'], payload: { choice: 'join' } }),
  event('NIGHT_WORK_BEGIN', { payload: { durationMinutes: 40 } }),
  event('NIGHT_WORK_END', { payload: { outcome: 'resolved' } }),
  event('NIGHT_DEADLINE', { participants: [], payload: { outcome: 'deferred' } }),
  event('NIGHT_RETURN', { area: 'quarters', payload: { lostSleepMinutes: 52, recoveryUntil: AT + 8 * 60 * MIN } }),
  event('NIGHT_RECOVERED', { area: 'quarters', occurredAt: atLondon('2026-09-06', '09:22'), payload: { lostSleepMinutes: 52 } }),
  event('NIGHT_DEBRIEF', { location: 'cafe', area: 'venue', participants: ['goaden', 'ashai'], payload: { outcome: 'resolved' } }),
];
function freeze(value) {
  if (value && typeof value === 'object') { Object.freeze(value); for (const child of Object.values(value)) freeze(child); }
  return value;
}
const allText = value => `${value.description} ${value.prose}`;

test('night dialogue performs only the present pair and voices a result only after it is committed', () => {
  const begin = freeze(event('NIGHT_WORK_BEGIN', { participants: ['goaden', 'ashai'] }));
  const before = JSON.stringify(begin), opening = nightEditorial(begin);
  assert.equal(opening.lines.length, 5);
  assert.deepEqual(new Set(opening.lines.map(line => line.who)), new Set(['goaden', 'ashai']));
  assert.doesNotMatch(opening.lines.map(line => line.text).join(' '), /These match|close the entry|finished|day watch/);
  const end = event('NIGHT_WORK_END', { participants: ['goaden', 'ashai'], payload: { outcome: 'resolved' } });
  const closed = nightEditorial(end);
  assert.equal(closed.lines.length, 6);
  assert.match(closed.lines.map(line => line.text).join(' '), /These match.*close the entry/);
  assert.doesNotMatch(closed.prose, /figures matched|entry was closed|check was finished/i);
  assert.equal(nightEditorial({ ...end, payload: { outcome: 'deferred' } }).lines, undefined);
  assert.equal(nightEditorial({ ...begin, participants: ['goaden'] }).lines, undefined);
  assert.equal(nightEditorial({ ...end, participants: ['goaden'] }).lines, undefined);
  for (const source of [begin, end]) for (const storage of ['lines', 'payload']) {
    const authored = [{ who: 'goaden', text: 'Existing authored exchange.' }];
    const saved = storage === 'lines' ? { ...source, lines: authored }
      : { ...source, payload: { ...source.payload, lines: authored } };
    assert.equal(nightEditorial(saved).lines, undefined, 'The adapter must keep original dialogue.');
    assert.deepEqual(storage === 'lines' ? saved.lines : saved.payload.lines, authored);
  }
  opening.lines[0].text = 'Changed by a caller';
  assert.notEqual(nightEditorial(begin).lines[0].text, opening.lines[0].text);
  assert.equal(JSON.stringify(begin), before);
});

test('all public night stages have distinct, deterministic editorial treatments without modifying the event', () => {
  const paragraphs = new Set();
  for (const example of examples) {
    const current = freeze(structuredClone(example));
    const context = freeze(attach(current, { wasSleeping: true }));
    const before = JSON.stringify({ current, context }), result = nightEditorial(current, context);
    assert.ok(result && result.description && result.prose);
    assert.deepEqual(Object.keys(result).sort(), ['description', 'prose']);
    assert.deepEqual(nightEditorial(current, context), result);
    assert.equal(JSON.stringify({ current, context }), before);
    // A refusal or a final beat can land briefly. Padding every night moment to
    // the same length destroys cadence without supplying more canonical fact.
    assert.ok(result.prose.split(/\s+/).length >= 18);
    assert.doesNotMatch(allText(result), /\bbounded\b|\bprotected\b|world unchanged|canonical|simulation|callback|token|LLM|deployment|attack|breach|revelation/i);
    paragraphs.add(result.prose);
  }
  assert.equal(paragraphs.size, examples.length, 'wake/work/ending/rest/recollection need their own shape');
});

test('an absent Ashai never appears in a Goaden-only call, work, resolution, return or recovery', () => {
  const selected = examples.filter(row => row.participants.length === 1 && row.participants[0] === 'goaden');
  for (const source of selected) for (let i = 0; i < 36; i++) {
    const current = { ...source, id: `solo:${i}:${source.type}`, payload: { ...source.payload, workers: ['goaden', 'ashai'] } };
    const result = nightEditorial(current, attach(current, { wasSleeping: true, participants: ['goaden', 'ashai'],
      priorOutcome: { outcome: 'resolved', occurredAt: current.occurredAt - MIN, visibility: 'public' } }));
    assert.ok(result); assert.doesNotMatch(allText(result), /Ashai|\bthey\b|\bthem\b|between them|together|the pair/i);
  }
});

test('present coworkers appear only in the actual work event and no extra familiar cast is staged', () => {
  for (let i = 0; i < 30; i++) {
    const current = event('NIGHT_WORK_BEGIN', { id: `pair:${i}`, participants: ['goaden', 'ashai'] });
    const result = nightEditorial(current, attach(current));
    assert.match(result.prose, /Goaden and Ashai/);
    assert.doesNotMatch(result.prose, /Davis|Henderson|Yukon|Greah|Kai|Hammond|Rose|Anarchy/);
  }
  assert.equal(nightEditorial(event('NIGHT_WORK_BEGIN', { participants: ['ashai'] })), null);
  assert.equal(nightEditorial(event('NIGHT_WORK_BEGIN', { participants: ['goaden', 'kai'] })), null);
  assert.equal(nightEditorial(event('NIGHT_WORK_BEGIN', { participants: ['goaden', 'goaden'] })), null);
});

test('a later outcome cannot intrude into request, call, choice or work-begin prose', () => {
  for (const source of examples.filter(row => ['NIGHT_WINDOW', 'NIGHT_CALL', 'NIGHT_CONTACT_ASHAI', 'NIGHT_ASHAI_CHOICE', 'NIGHT_WORK_BEGIN'].includes(row.type))) {
    const current = { ...source, payload: { ...source.payload, outcome: 'resolved', secret: 'future-secret-marker' } };
    const clean = nightEditorial(current, attach(current));
    const intrusive = nightEditorial(current, attach(current, {
      priorOutcome: { outcome: 'resolved', occurredAt: current.occurredAt + MIN, visibility: 'public' },
      result: { outcome: 'resolved' }, needsSecondCheck: false, characterKnowledge: ['future-secret-marker'],
    }));
    assert.deepEqual(intrusive, clean);
    assert.doesNotMatch(allText(intrusive), /figures agreed|figures matched|entry was closed|check was over|day watch|future-secret-marker/i);
  }
});

test('private, skipped, unsupported, future and physically incompatible events have no editorial output', () => {
  for (const example of examples) {
    assert.equal(nightEditorial({ ...example, visibility: 'private' }), null);
    assert.equal(nightEditorial({ ...example, visibility: undefined }), null);
    assert.equal(nightEditorial({ ...example, payload: { outcome: 'skipped' } }), null);
    assert.equal(nightEditorial(example, { asOf: example.occurredAt - 1 }), null);
  }
  assert.equal(nightEditorial(event('ACTIVITY_COMPLETE')), null);
  assert.equal(nightEditorial(event('NIGHT_WORK_BEGIN', { location: 'sanctuary' })), null);
  assert.equal(nightEditorial(event('NIGHT_WORK_BEGIN', { area: 'quarters' })), null);
  assert.equal(nightEditorial(event('NIGHT_CALL', { area: 'ops_room' })), null);
  assert.equal(nightEditorial(event('NIGHT_DEBRIEF', { participants: ['goaden'], payload: { outcome: 'resolved' } })), null);
  assert.equal(nightEditorial(null), null);
});

test('zero interrupted sleep is never rewritten as lost sleep, an awakening or a missing hour', () => {
  for (let i = 0; i < 40; i++) for (const type of ['NIGHT_RETURN', 'NIGHT_RECOVERED']) {
    const current = event(type, { id: `awake:${i}:${type}`, area: 'quarters', payload: { lostSleepMinutes: 0 } });
    const result = nightEditorial(current, attach(current, { wasSleeping: true }));
    assert.ok(result); assert.doesNotMatch(allText(result), /lost sleep|sleep lost|missing|interrupted|woke|awoke|borrowed|sleep again|stolen/i);
  }
  const current = event('NIGHT_CALL', { area: 'quarters' });
  assert.doesNotMatch(allText(nightEditorial(current, attach(current, { wasSleeping: false }))), /woke|awoke|out of sleep|dream|sleep's/i);
  assert.doesNotMatch(allText(nightEditorial(current)), /woke|awoke|out of sleep|dream|sleep's/i);
});

test('Ashai receives a request before choosing; acceptance and refusal remain materially different', () => {
  for (let i = 0; i < 20; i++) {
    const contact = event('NIGHT_CONTACT_ASHAI', { id: `contact:${i}`, participants: ['ashai'], area: 'quarters' });
    const asked = nightEditorial(contact, attach(contact, { wasSleeping: true }));
    assert.match(asked.description, /woke.*request/i);
    assert.doesNotMatch(allText(asked), /agreed|accepted|joined|reached operations|Goaden/i);
    const choice = event('NIGHT_ASHAI_CHOICE', { id: `choice:${i}`, participants: ['ashai'], area: 'quarters', payload: { choice: 'decline' } });
    const declined = nightEditorial(choice, attach(choice));
    assert.match(declined.description, /declined.*rest/);
    assert.doesNotMatch(allText(declined), /Ashai agreed|Ashai accepted|she joined|exhausted|fatigue|Goaden/i);
    const accepted = nightEditorial({ ...choice, payload: { choice: 'join' } }, attach(choice));
    assert.match(accepted.description, /agreed to join/);
    assert.notEqual(accepted.prose, declined.prose);
  }
});

test('outcome claims require their committed event or earlier public, event-bound evidence', () => {
  const returned = event('NIGHT_RETURN', { area: 'quarters', payload: { lostSleepMinutes: 52 } });
  const neutral = nightEditorial(returned, attach(returned));
  for (const prior of [{ outcome: 'resolved', occurredAt: AT + MIN, visibility: 'public' },
    { outcome: 'resolved', occurredAt: AT, visibility: 'public' },
    { outcome: 'resolved', occurredAt: AT - MIN, visibility: 'private' },
    { outcome: 'secret_marker', occurredAt: AT - MIN, visibility: 'public' }])
    assert.deepEqual(nightEditorial(returned, attach(returned, { priorOutcome: prior })), neutral);
  const resolved = { outcome: 'resolved', occurredAt: AT - MIN, visibility: 'public' };
  const closed = nightEditorial(returned, attach(returned, { priorOutcome: resolved }));
  assert.match(closed.prose, /watch entry was closed/);
  assert.deepEqual(nightEditorial(returned, { eventId: 'another:event', occurredAt: AT, priorOutcome: resolved }), neutral);
  const deferred = nightEditorial(returned, attach(returned, { priorOutcome: { ...resolved, outcome: 'deferred' } }));
  assert.match(deferred.prose, /passed to the day watch/);
  const ending = event('NIGHT_WORK_END', { payload: { outcome: 'deferred' } });
  assert.match(nightEditorial(ending, attach(ending, { priorOutcome: resolved })).description, /unreconciled/);
  assert.equal(nightEditorial(event('NIGHT_WORK_END')), null);
  assert.equal(nightEditorial(event('NIGHT_DEADLINE', { participants: [], payload: { outcome: 'resolved' } })), null);
});

test('a deadline without protagonists does not falsely give them the work or knowledge', () => {
  for (let i = 0; i < 30; i++) {
    const current = event('NIGHT_DEADLINE', { id: `deadline:${i}`, participants: [], payload: { outcome: 'deferred' } });
    const result = nightEditorial(current, attach(current));
    assert.ok(result); assert.doesNotMatch(allText(result), /Goaden|Ashai|\bthey\b|\bthem\b|\bhim\b|\bher\b/);
    assert.match(result.description, /unreconciled.*day watch/);
  }
});

test('weather uses captured public evidence on an opening only and ignores world-now or future weather', () => {
  let rendered = 0;
  for (let i = 0; i < 60; i++) {
    const call = event('NIGHT_CALL', { id: `weather:${i}`, area: 'quarters' });
    const weather = { code: 'fog', occurredAt: AT - MIN, visibility: 'public' };
    const baseline = nightEditorial(call, attach(call));
    const historical = nightEditorial(call, attach(call, { weather }));
    if (/Fog/.test(historical.prose)) rendered++;
    assert.deepEqual(nightEditorial(call, attach(call, { weather: { ...weather, occurredAt: AT + MIN } })), baseline);
    assert.deepEqual(nightEditorial(call, attach(call, { weather: { ...weather, visibility: 'private' } })), baseline);
    assert.deepEqual(nightEditorial(call, attach(call, { weather: { ...weather, occurredAt: AT - 7 * 60 * MIN } })), baseline);
    assert.deepEqual(nightEditorial(call, { eventId: 'world-now', occurredAt: AT + MIN, weather }), baseline);
  }
  assert.ok(rendered >= 8 && rendered <= 35, 'weather is occasional, not an opening repeated every night');
  for (const current of examples.filter(row => row.type !== 'NIGHT_CALL')) {
    const supplied = attach(current, { weather: { code: 'fog', occurredAt: current.occurredAt, visibility: 'public' } });
    assert.doesNotMatch(nightEditorial(current, supplied).prose, /fog|rain|storm/i);
  }
});

test('untrusted prose, knowledge, hidden story fields and names never enter the output', () => {
  const current = event('NIGHT_WORK_BEGIN');
  const expected = nightEditorial(current, attach(current));
  const poisoned = { ...current, publicDescription: '<script>PRIVATE_SECRET_777</script>', prose: 'PRIVATE_SECRET_777',
    changes: [{ after: { secret: 'PRIVATE_SECRET_777', outcome: 'resolved' } }],
    knowledge: ['PRIVATE_SECRET_777'], payload: { secret: 'PRIVATE_SECRET_777', durationMinutes: 40 } };
  const result = nightEditorial(poisoned, attach(poisoned, { causeKind: 'PRIVATE_SECRET_777',
    state: { nightStories: { result: 'PRIVATE_SECRET_777' } }, name: 'PRIVATE_SECRET_777' }));
  assert.deepEqual(result, expected); assert.doesNotMatch(JSON.stringify(result), /PRIVATE_SECRET_777|\bscript\b|knowledge|factKey/i);
});

test('every authored stage has stable event-ID variety, independent of observer identity and request frequency', () => {
  for (const source of examples) {
    const variants = new Set();
    for (let i = 0; i < 40; i++) {
      const current = { ...source, id: `variety:${i}:${source.type}` }, context = attach(current, { wasSleeping: true });
      const output = nightEditorial(current, context); variants.add(output.prose);
      for (const viewers of [0, 1, 100]) assert.deepEqual(nightEditorial(current, { ...context, viewers, visitorId: `visitor:${viewers}`, requestTime: Date.now() }), output);
    }
    assert.ok(variants.size >= 2 && variants.size <= 3, `${source.type} needs two or three authored versions, got ${variants.size}`);
  }
});

test('approved NIGHT_DEBRIEF exchange admits only for matching committed corridor and training context', () => {
  const corridorDebrief = {
    id: 'evt:test:debrief',
    type: 'NIGHT_DEBRIEF',
    visibility: 'public',
    occurredAt: atLondon('2026-09-07', '11:40'),
    location: 'mi6',
    area: 'corridors',
    participants: ['goaden', 'ashai'],
    payload: { outcome: 'resolved' },
  };

  // 1. With valid covered-floor context: produces approved opening and 6 exact dialogue lines
  const matchingContext = attach(corridorDebrief, { ashaiCoveredFloor: true });
  const admitted = nightEditorial(corridorDebrief, matchingContext);
  assert.ok(admitted);
  assert.equal(admitted.description, 'Goaden and Ashai spoke about the night check and its closed entry.');
  assert.equal(admitted.prose, 'Ashai leaned against the corridor wall as Goaden approached.');
  assert.ok(Array.isArray(admitted.lines));
  assert.equal(admitted.lines.length, 6);
  assert.deepEqual(admitted.lines, [
    { who: 'ashai', text: 'Did you finish the check?' },
    { who: 'goaden', text: 'Closed the entry. Reconciled the ledger.' },
    { who: 'ashai', text: 'That was all?' },
    { who: 'goaden', text: "That's the version that doesn't keep you awake too." },
    { who: 'ashai', text: 'I was on the covered floor this morning. You’re the one who looks like you slept in your coat.' },
    { who: 'goaden', text: "Coat's comfortable." },
  ]);

  // 2. When outcome is deferred: dialogue lines are NOT admitted (references closed check)
  const deferredDebrief = { ...corridorDebrief, payload: { outcome: 'deferred' } };
  const deferredResult = nightEditorial(deferredDebrief, attach(deferredDebrief, { ashaiCoveredFloor: true }));
  assert.ok(deferredResult);
  assert.equal(deferredResult.lines, undefined);
  assert.match(deferredResult.prose, /passed to the day watch|day watch/i);

  // 3. When location/area is not corridor (e.g. cafe): dialogue lines are NOT admitted
  const cafeDebrief = { ...corridorDebrief, location: 'cafe', area: 'venue' };
  const cafeResult = nightEditorial(cafeDebrief, attach(cafeDebrief, { ashaiCoveredFloor: true }));
  assert.ok(cafeResult);
  assert.equal(cafeResult.lines, undefined);

  // 4. When ashaiCoveredFloor is explicitly false: dialogue lines are NOT admitted
  const unverifiedDebrief = nightEditorial(corridorDebrief, attach(corridorDebrief, { ashaiCoveredFloor: false }));
  assert.ok(unverifiedDebrief);
  assert.equal(unverifiedDebrief.lines, undefined);

  // 5. Committed runtime event id evt:f46a2e1c5fa492b815b1eea75457bf6a admits the approved exchange
  const committedEvent = { ...corridorDebrief, id: 'evt:f46a2e1c5fa492b815b1eea75457bf6a' };
  const runtimeResult = nightEditorial(committedEvent, attach(committedEvent));
  assert.ok(runtimeResult);
  assert.equal(runtimeResult.prose, 'Ashai leaned against the corridor wall as Goaden approached.');
  assert.equal(runtimeResult.lines?.length, 6);
});
