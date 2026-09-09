import test from 'node:test';
import assert from 'node:assert/strict';
import { newcomerOrientation, narrativeWeight, forwardReadingEvents, loadedDialogueScenes } from '../../worldstream/app/reader-narrative.js';

test('Scenes discovers existing loaded dialogue without accepting or generating another scene', () => {
  const first = { id: 'first', occurredAt: 1, lines: [{ who: 'goaden', text: 'Exact.' }] };
  const second = { ...first, id: 'second', occurredAt: 2 };
  assert.deepEqual(loadedDialogueScenes([first, second, first, { id: 'routine' }], [{ eventId: 'second' }]), [first]);
});

test('orientation exposes only current public lead state and open committed threads', () => {
  const world = { resolvedThrough: 100, worldStatus: 'The night watch', characters: [
    { id: 'goaden', name: 'Goaden Reeves', location: 'mi6', activity: 'resting', privateMemory: 'NEVER' },
    { id: 'other', name: 'Other' }], storyThreads: [
      { id: 'done', status: 'resolved', title: 'Finished', openedAt: 1 },
      { id: 'next', status: 'active', title: 'Future', openedAt: 200 },
      { id: 'now', type: 'story', status: 'unfinished', title: 'The question', openedAt: 90 }] };
  const result = newcomerOrientation(world);
  assert.equal(result.status, world.worldStatus); assert.equal(result.people.length, 1);
  assert.equal(result.people[0].privateMemory, undefined);
  assert.deepEqual(result.threads.map(row => row.id), ['now']);
  assert.equal(newcomerOrientation().threads.length, 0);
});

test('a shared night recovery reads once but unrelated simultaneous rests do not merge', () => {
  const work = { id: 'work', type: 'NIGHT_WORK_END', occurredAt: 100, location: 'mi6',
    participants: ['goaden', 'ashai'], prose: 'They completed the check.' };
  const rest = who => ({ id: `rest-${who}`, type: 'NIGHT_RETURN', occurredAt: 200, location: 'mi6',
    room: 'the quarters', participants: [who], earlierEventIds: ['work'],
    contextBridge: { originEventId: 'work' }, prose: `${who} returned to rest.` });
  const input = [work, rest('goaden'), rest('ashai')], copy = structuredClone(input);
  const rows = forwardReadingEvents(input), recovery = rows.filter(row => row.type === 'NIGHT_RETURN');
  assert.equal(recovery.filter(row => row.readerWeight > 0).length, 1);
  assert.match(recovery.find(row => row.readerWeight > 0).readerProse, /separate quarters/);
  assert.deepEqual(input, copy);
  assert.equal(recovery.find(row => row.readerWeight === 0).prose, copy.find(row => row.id === recovery.find(r => r.readerWeight === 0).id).prose);
  const unlinked = input.map(row => ({ ...row, earlierEventIds: [], contextBridge: null }));
  assert.equal(forwardReadingEvents(unlinked).filter(row => row.type === 'NIGHT_RETURN' && row.readerWeight > 0).length, 2);
  const laterArrival = input.map(row => row.id === 'rest-ashai' ? { ...row, occurredAt: 201 } : row);
  assert.equal(forwardReadingEvents(laterArrival).filter(row => row.type === 'NIGHT_RETURN' && row.readerWeight > 0).length, 2,
    'a later arrival must not disappear behind a previously rendered solo paragraph');
  const paged = input.flatMap(row => forwardReadingEvents([row], undefined, { history: input, visible: input }));
  assert.deepEqual(paged.sort((a,b) => a.id.localeCompare(b.id)), [...rows].sort((a,b) => a.id.localeCompare(b.id)));
});

test('in-chapter source prompts disappear only for passages actually presented before them', () => {
  const source = { id: 'source', occurredAt: 100, type: 'NIGHT_WORK_BEGIN', location: 'mi6', participants: ['goaden'], prose: 'He began.' };
  const end = { ...source, id: 'end', occurredAt: 200, type: 'NIGHT_WORK_END', prose: 'He finished.', contextBridge: { originEventId: 'source' } };
  const all = forwardReadingEvents([source, end]);
  assert.equal(all[0].readerSceneEnd, false);
  assert.equal(all[1].readerSceneEnd, true);
  assert.equal(all[1].readerContextVisible, true);
  const onlyEnd = forwardReadingEvents([end], undefined, { history: [source] });
  assert.equal(onlyEnd[0].readerContextVisible, false, 'unshown editorial history is not a page the reader can see');
  assert.deepEqual(end.contextBridge, { originEventId: 'source' });
});

test('separate committed stories in one room still begin separate scenes', () => {
  const base = { occurredAt: 100, type: 'SUPPORTING_COMMITMENT', location: 'mi6', participants: ['goaden'], prose: 'He waited.' };
  const first = { ...base, id: 'first', storyRef: { type: 'story', id: 'one' } };
  const second = { ...base, id: 'second', occurredAt: 200, prose: 'He read the message.', storyRef: { type: 'story', id: 'two' } };
  const rows = forwardReadingEvents([first, second]);
  assert.equal(rows[1].readerSceneStart, true);
  assert.equal(rows[0].readerSceneEnd, true);
});

test('four weights protect consequences and dialogue even on an ordinary event type', () => {
  assert.equal(narrativeWeight({ type: 'WEATHER_CHANGE' }), 0);
  assert.equal(narrativeWeight({ type: 'TRAVEL_DEPART', register: 'prose', prose: 'Long travel.' }), 1);
  assert.equal(narrativeWeight({ type: 'MOMENT_NOTICED', prose: 'Emily counts.' }), 2);
  assert.equal(narrativeWeight({ type: 'CONVERSATION', lines: [{ text: 'Hello' }] }), 3);
  assert.equal(narrativeWeight({ type: 'ACTIVITY_COMPLETE', contextBridge: { snippet: 'A consequence.' } }), 2);
  assert.equal(narrativeWeight({ type: 'MEAL_BEGIN', memoryCallback: { originSnippet: 'An earlier scene.' } }), 2);
});

test('forward sequence puts source before response and marks viewpoint switches before prose without mutating truth', () => {
  const source = { id: 'source', occurredAt: 10, type: 'ARCANE_SURGE', location: 'mi6', participants: [] };
  const response = { id: 'response', occurredAt: 12, type: 'MOMENT_NOTICED', location: 'mi6', participants: ['ashai'], prose: 'She looks.' };
  const other = { id: 'else', occurredAt: 13, type: 'OFFSCREEN_START', location: 'cafe', participants: ['emily'], prose: 'She counts.' };
  const result = forwardReadingEvents([other, response, source]);
  assert.deepEqual(result.map(row => row.id), ['source', 'response', 'else']);
  assert.equal(result[2].readerContext, 'Elsewhere · cafe');
  assert.equal(source.readerContext, undefined); assert.equal(result[1].prose, response.prose);
});

const passage = (id, occurredAt, patch = {}) => ({ id, occurredAt, type: 'QUIET_TIME_BEGIN',
  location: 'mi6', room: 'the music room', participants: ['ashai'], register: 'prose',
  description: 'Ashai sat at the piano.', prose: 'Ashai let the last note die before she lifted her hand.', ...patch });

test('the novel keeps a quiet character passage once, while unchanged routine stays in the world', () => {
  const first = passage('first', 10), repeated = passage('repeat', 20);
  const meal = passage('meal', 30, { type: 'MEAL_BEGIN' });
  const weather = passage('weather', 40, { type: 'WEATHER_CHANGE' });
  const result = forwardReadingEvents([first, repeated, meal, weather]);
  assert.deepEqual(result.map(row => row.readerWeight), [2, 0, 0, 0]);
  assert.equal(result[0].readerProse, first.prose);
  assert.equal(result[1].readerOmission, 'repeated');
  assert.equal(result[2].readerOmission, 'routine');
  assert.equal(narrativeWeight(result[2]), 0);
  assert.equal(meal.prose, first.prose, 'the complete source is still available to the activity toggle');
  assert.equal(meal.readerWeight, undefined);
});

test('a new occurrence of a familiar consequence keeps its fact and accessible origin', () => {
  const first = passage('first', 10, { type: 'GROUND_WORK_COMPLETED',
    prose: 'The last check was done. The outdoor training ground reopened.',
    description: 'The outdoor training ground reopened.' });
  const second = { ...first, id: 'second', occurredAt: 20,
    contextBridge: { originEventId: 'this-attempt', snippet: 'Their later check had begun.' } };
  const result = forwardReadingEvents([second, first]);
  assert.equal(result[1].readerWeight, 1);
  assert.equal(result[1].readerProse, '');
  assert.equal(result[1].readerDescription, second.description);
  assert.equal(result[1].contextBridge, second.contextBridge);
  assert.equal(second.prose, first.prose, 'never rewrite the repeated source paragraph');
});

test('repeated dialogue and accepted scene setup are never trimmed or demoted', () => {
  const first = passage('first', 10, { type: 'MEAL_BEGIN', lines: [{ who: 'ashai', text: 'Leave it there.' }] });
  const second = { ...first, id: 'second', occurredAt: 20 };
  const performed = passage('performed', 30, { cinematic: { scene: { openingNarration: 'The exact setting.',
    beats: [{ speaker: 'ashai', line: 'The exact line.' }], closingNarration: 'The exact ending.' } } });
  for (const result of forwardReadingEvents([first, second, performed])) {
    assert.equal(result.readerWeight, 3); assert.equal(result.readerProse, first.prose);
  }
});

test('public context retains an ordinary source for retrieval and orders same-time cause before response', () => {
  const source = passage('z-source', 10, { type: 'WEATHER_CHANGE', description: 'The rain arrived.' });
  const reaction = passage('a-reaction', 10, { type: 'MOMENT_NOTICED', contextBridge: { originEventId: source.id } });
  const result = forwardReadingEvents([reaction, source]);
  assert.deepEqual(result.map(row => row.id), [source.id, reaction.id]);
  assert.equal(result[0].readerWeight, 0, 'weather remains in the living world, not the novel opening');
  assert.equal(result[0].description, source.description);
  assert.equal(result[1].contextBridge.originEventId, source.id);
});

test('ordinary scene setup keeps a short recorded action when the next scene needs it', () => {
  const meal = passage('meal', 10, { type: 'MEAL_BEGIN', room: 'the lunch hall' });
  const exchange = passage('exchange', 1000, { type: 'CONVERSATION', room: 'the lunch hall',
    lines: [{ who: 'ashai', text: 'I kept your seat.' }] });
  const result = forwardReadingEvents([exchange, meal]);
  assert.equal(result[0].readerWeight, 1); assert.equal(result[0].readerProse, '');
  assert.equal(result[0].readerDescription, meal.description);
  assert.equal(result[1].readerSceneStart, false);
});

test('selection and scene boundaries agree across paging, duplicates, and reload order', () => {
  const rows = [passage('first', 10), passage('ordinary', 20, { type: 'PRACTICE_BEGIN', location: 'yard' }),
    passage('repeat', 30), passage('new', 40, { prose: 'She closed the lid.', room: 'the music room' })];
  const full = forwardReadingEvents(rows);
  const firstPage = forwardReadingEvents(rows.slice(0, 2), undefined, { history: rows, visible: rows });
  const nextPage = forwardReadingEvents(rows.slice(2), undefined, { history: rows, visible: rows });
  assert.deepEqual([...firstPage, ...nextPage], full);
  assert.deepEqual(forwardReadingEvents([...rows].reverse(), undefined, { history: rows }), full);
  assert.deepEqual(forwardReadingEvents([...rows, rows[0]], undefined, { history: rows }), full);
  assert.equal(full[3].readerSceneStart, false, 'hidden yard state does not create an invented return');
  assert.equal(full[3].readerSceneId, full[0].id);
  assert.equal(full[3].readerContext, '');
});

test('unshown editorial history suppresses stock but cannot supply the visible opening context', () => {
  const earlier = passage('earlier', 10, { location: 'sanctuary', room: 'the central hub' });
  const repeated = passage('repeat', 20);
  const firstVisible = passage('opening', 30, { prose: 'Ashai turned the page.' });
  const rows = forwardReadingEvents([repeated, firstVisible], undefined, { history: [earlier] });
  assert.equal(rows[0].readerWeight, 0, 'earlier public prose still supplies editorial comparison');
  assert.equal(rows[1].readerSceneStart, true);
  assert.ok(rows[1].readerChapter);
  assert.equal(rows[1].readerContext, 'mi6 · the music room');
});

test('chapters follow London calendar days and physical room changes start scenes', () => {
  const before = passage('before', Date.parse('2026-09-08T22:59:00Z'));
  const after = passage('after', Date.parse('2026-09-08T23:01:00Z'), { prose: 'She stepped away from the keys.' });
  const moved = passage('moved', Date.parse('2026-09-08T23:02:00Z'), { room: 'the corridor', prose: 'A light shone under the door.' });
  const rows = forwardReadingEvents([before, after, moved]);
  assert.equal(rows[0].readerChapter.label, 'Tuesday, 8 September');
  assert.equal(rows[1].readerChapter.label, 'Wednesday, 9 September');
  assert.equal(rows[2].readerChapter, null); assert.equal(rows[2].readerSceneStart, true);
  assert.equal(rows[2].readerContext, 'mi6 · the corridor');
});

test('proven unchanged continuation stays visual even when it supplies a quoted dependency', () => {
  const routine = passage('routine', 10, { type: 'OFFSCREEN_RESULT', routineContinuation: true,
    contextBridge: { originEventId: 'old-project' } });
  assert.equal(forwardReadingEvents([routine])[0].readerWeight, 0);
  const later = passage('later', 20, { memoryCallback: { originEventId: routine.id } });
  const projected = forwardReadingEvents([routine, later]);
  assert.equal(projected[0].readerWeight, 0);
  assert.equal(projected[0].description, routine.description);
  assert.equal(projected[1].memoryCallback.originEventId, routine.id);
  const dialogueRoutine = { ...routine, lines: [{ who: 'ashai', text: 'Something changed.' }] };
  assert.equal(forwardReadingEvents([dialogueRoutine])[0].readerWeight, 3);
});

test('unchanged rehearsal pairs cannot promote each other back into the novel through causal links', () => {
  const earned = passage('earned', 10, { type: 'OFFSCREEN_RESULT',
    prose: 'The last line found its ending.', description: 'Gabriel finished the verse.' });
  const start = passage('start', 20, { type: 'OFFSCREEN_START', routineContinuation: true,
    prose: '', description: 'Gabriel tried the finished verse from the beginning.' });
  const result = passage('result', 30, { type: 'OFFSCREEN_RESULT', routineContinuation: true,
    prose: '', description: 'The ending held again.',
    contextBridge: { originEventId: start.id, snippet: start.description }, earlierEventIds: [start.id, earned.id] });
  const encounter = passage('encounter', 40, { type: 'OFFSCREEN_ENCOUNTER',
    prose: 'Ashai waited for the last beat before speaking.',
    contextBridge: { originEventId: result.id, snippet: result.description } });
  const original = [earned, start, result, encounter];
  const projected = forwardReadingEvents(original);
  assert.deepEqual(projected.map(event => event.readerWeight), [2, 0, 0, 2]);
  assert.deepEqual(projected.map(event => event.id), original.map(event => event.id));
  assert.equal(projected[2].contextBridge, result.contextBridge);
  assert.equal(projected[3].contextBridge, encounter.contextBridge);
  assert.equal(projected[0].readerProse, earned.prose, 'the original earned progress still receives prose');
});

test('normalisation only compares exact surfaces; new action and altered actor remain intact', () => {
  const first = passage('first', 10, { prose: 'Ashai said, “There.”' });
  const same = passage('same', 20, { prose: '  ASHAI said, "There."  ' });
  const changed = passage('changed', 30, { prose: 'Ashai said, “Here.”' });
  const actor = passage('actor', 40, { prose: 'Goaden said, “There.”', participants: ['goaden'] });
  const rows = forwardReadingEvents([first, same, changed, actor]);
  assert.deepEqual(rows.map(row => row.readerWeight), [2, 0, 2, 2]);
  assert.equal(rows[2].readerProse, changed.prose); assert.equal(rows[3].readerProse, actor.prose);
});
