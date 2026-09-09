// An author audit of disposable worlds. It never opens the running world's save.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { isDeepStrictEqual } from 'node:util';
import { openWorld, semanticDigest } from '../src/world.mjs';
import { DEFAULT_SEED, RULES_VERSION, assertCanonState, publicEvents } from '../src/fixture.mjs';
import { SCENE_BANK_MANIFEST, SCENE_BANK_BY_ID } from '../src/scene-bank-catalog.mjs';
import { applyChange, readChange, sideOf } from '../src/ledger.mjs';
import { atLondon, londonDate } from '../src/time.mjs';
import { forwardReadingEvents } from '../../worldstream/app/reader-narrative.js';
import { readingSceneParagraphs } from '../../worldstream/app/reader-scene.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const DAY = 86_400_000, HOUR = 3_600_000, startMs = atLondon('2026-09-04', '00:00');
const days = Number(process.env.FINAL_SIMULATION_DAYS || 210);
assert.ok(Number.isInteger(days) && days >= 180 && days <= 365);
const recheck = process.env.FINAL_SIMULATION_RECHECK ? realpathSync(process.env.FINAL_SIMULATION_RECHECK) : null;
if (recheck) assert.ok(dirname(recheck) === realpathSync(join(root, 'artifacts'))
  && basename(recheck).startsWith('final-simulation-'), 'Recheck must name a disposable audit artifact directory');
const output = recheck || join(root, 'artifacts', `final-simulation-${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}`);
mkdirSync(output, { recursive: true });
const json = (name, value) => writeFileSync(join(output, name), `${JSON.stringify(value, null, 2)}\n`);
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const count = (map, key) => { map[key] = (map[key] || 0) + 1; };
const sourcePaths = [...readdirSync(join(root, 'src')).filter(name => name.endsWith('.mjs')).map(name => `src/${name}`),
  'experiment-l/src/world.mjs'];
const sourceHashes = () => Object.fromEntries(sourcePaths.map(path => [path, hash(readFileSync(join(root, path), 'utf8'))]));
const sourcesAtStart = sourceHashes();
const priorReport = recheck ? JSON.parse(readFileSync(join(recheck, 'final-simulation.json'), 'utf8')) : null;
if (priorReport) {
  assert.equal(priorReport.startMs, startMs); assert.equal(priorReport.days, days); assert.equal(priorReport.seed, DEFAULT_SEED);
  assert.equal(priorReport.sourcesChangedDuringRun, false, 'A changing source tree needs a fresh simulation');
  assert.deepEqual(priorReport.sourceHashesAtStart, sourcesAtStart, 'Recheck cannot validate a save produced by different simulation code');
  writeFileSync(join(output, 'initial-auditor-report.json'), readFileSync(join(output, 'final-simulation.json')));
}
const originalFetch = globalThis.fetch;
let fetchCalls = 0;
globalThis.fetch = async () => { fetchCalls++; throw new Error('A zero-viewer simulation attempted network generation'); };
const rowState = world => JSON.parse(world.db.prepare('SELECT state_json FROM world_state WHERE id=1').get().state_json);
const saveIdentity = world => hash({ state: rowState(world), stats: world.operationalStats(),
  pending: world.db.prepare('SELECT action_json FROM scheduled_actions ORDER BY due_at,priority,id').all() });
const readerSamples = priorReport?.readerSamples || [];
function readerSample(world, name, at, { from = null } = {}) {
  const projection = world.publicProjection();
  const projected = from === null ? projection.events : publicEvents({
    events: world.db.prepare('SELECT semantic_json FROM events WHERE occurred_at>=? AND occurred_at<=? ORDER BY seq')
      .all(from, at).map(row => JSON.parse(row.semantic_json)),
    eventById: id => world.eventById(id), publicSourcesForEvent: event => world.publicDialogueSources(event),
  }, Infinity);
  const plan = forwardReadingEvents(projected, place => ({ mi6: 'MI6', big_ben_plaza: 'Big Ben Plaza' })[place]
    || String(place ?? '').replaceAll('_', ' '));
  const passages = plan.filter(event => event.readerWeight > 0).map(event => ({
    eventId: event.id, type: event.type, at: event.occurredAt, chapter: event.readerChapter?.label,
    setting: event.readerContext, paragraphs: readingSceneParagraphs(event),
  }));
  const paragraphs = passages.flatMap(passage => passage.paragraphs.map(paragraph => ({
    ...paragraph, eventId: passage.eventId, at: passage.at }))), counts = new Map();
  for (const paragraph of paragraphs) {
    const normal = paragraph.text.toLowerCase().replace(/\s+/g, ' ').trim();
    if (normal.length < 60) continue;
    const entry = counts.get(normal) || { text: paragraph.text, count: 0, events: [] };
    entry.count++; entry.events.push(paragraph.eventId); counts.set(normal, entry);
  }
  const repeats = [...counts.values()].filter(entry => entry.count > 1).sort((a, b) => b.count - a.count);
  const summary = { name, at, from, inputEvents: projected.length, visiblePassages: passages.length,
    visibleParagraphs: paragraphs.length, words: paragraphs.reduce((sum, paragraph) => sum + paragraph.text.split(/\s+/).length, 0),
    earliestEventAt: passages[0]?.at ?? null, latestEventAt: passages.at(-1)?.at ?? null,
    latestPassageAgeMinutes: passages.length ? (at - passages.at(-1).at) / 60_000 : null,
    repeatedLongParagraphTexts: repeats.length, extraLongParagraphOccurrences: repeats.reduce((sum, row) => sum + row.count - 1, 0),
    repeats: repeats.slice(0, 8) };
  readerSamples.push(summary);
  json(`reader-${name}.json`, { summary, passages });
  writeFileSync(join(output, `reader-${name}.md`), `# Committed reader sample: ${name}\n\n`
    + 'Direct publicEvents → forwardReadingEvents → readingSceneParagraphs; no model performance or invented connective text.\n\n'
    + passages.map(passage => `${passage.chapter ? `## ${passage.chapter}\n\n` : ''}`
      + `${passage.setting ? `*${passage.setting}*\n\n` : ''}`
      + passage.paragraphs.map(paragraph => paragraph.text).join('\n\n')).join('\n\n') + '\n');
  return summary;
}
let activeWorld = null;

try {
  const short = priorReport?.shortRuns || [];
  const end7 = startMs + 7 * DAY;
  const run7 = (seed, targets) => {
    const world = openWorld({ dbPath: ':memory:', seed, startMs });
    try {
      const before = performance.now();
      for (const target of targets) world.advance(target);
      const snapshot = world.semanticSnapshot();
      const publicStory = snapshot.events.filter(event => event.visibility === 'public')
        .map(event => ({ type: event.type, at: event.occurredAt, location: event.location,
          text: event.prose || event.publicDescription }));
      const result = { seed, advances: targets.length, days: 7, elapsedMs: performance.now() - before,
        digest: semanticDigest(snapshot), storyDigest: hash(publicStory), eventCount: snapshot.events.length };
      short.push(result);
      return { result, snapshot, publicStory };
    } finally { world.close(); }
  };
  let changedStoryRows = priorReport?.changedStoryRows;
  if (!priorReport) {
    const baseline = run7(DEFAULT_SEED, [end7]);
    const irregular = run7(DEFAULT_SEED, [startMs + HOUR, startMs + 29 * HOUR,
      startMs + 29 * HOUR, startMs + 28 * HOUR, startMs + 87 * HOUR, end7]);
    assert.deepEqual(irregular.snapshot, baseline.snapshot, 'one-shot and irregular absence histories differ');
    const alternate = run7(`${DEFAULT_SEED}:final-audit-second-seed`, [end7]);
    assert.notEqual(alternate.result.storyDigest, baseline.result.storyDigest,
      'different seeds changed identifiers without changing the observed story');
    changedStoryRows = baseline.publicStory.reduce((sum, row, index) =>
      sum + Number(!isDeepStrictEqual(row, alternate.publicStory[index])), 0);
    json('seven-day-comparison.json', { result: 'PASS', runs: short, changedStoryRows });
    console.log(JSON.stringify({ phase: 'seven-day-comparison', result: 'PASS', runs: short, changedStoryRows }));
  }

  const dbPath = join(output, 'isolated-author-world.sqlite');
  activeWorld = openWorld({ dbPath, seed: DEFAULT_SEED, startMs });
  const initial = priorReport ? JSON.parse(JSON.stringify(activeWorld.fixture.initialState())) : rowState(activeWorld),
    checkpoints = priorReport?.checkpoints || [];
  let restartIdentical = priorReport?.restartAtDay90Identical ?? null;
  const targets = priorReport ? [] : [...new Set([HOUR, DAY, 7 * DAY, 28 * DAY, 90 * DAY, 180 * DAY, days * DAY])].sort((a, b) => a - b);
  for (const offset of targets) {
    const target = startMs + offset, before = performance.now();
    const advance = activeWorld.advance(target);
    const elapsedMs = performance.now() - before;
    const state = rowState(activeWorld), beforeReads = saveIdentity(activeWorld);
    activeWorld.publicProjection(); activeWorld.publicHistory(); activeWorld.publicProjection();
    assert.equal(saveIdentity(activeWorld), beforeReads, 'readers changed authoritative history');
    assert.equal(activeWorld.advance(target).appendedEvents, 0);
    assert.equal(activeWorld.advance(target - 60_000).appendedEvents, 0);
    assert.equal(saveIdentity(activeWorld), beforeReads, 'duplicate/stale catch-up changed the save');
    const departures = activeWorld.db.prepare("SELECT occurred_at FROM events WHERE json_extract(semantic_json,'$.type')='TRAVEL_DEPART'").all();
    const checkpoint = { fictionalDays: offset / DAY, elapsedMs, ...advance,
      events: activeWorld.operationalStats().eventCount,
      travelDepartures: departures.length, travelDays: [...new Set(departures.map(row => londonDate(row.occurred_at)))],
      completedBankScenes: Object.keys(state.sceneBank?.completed || {}).length,
      completedNimbusScenes: Object.keys(state.sceneBank?.completed || {}).filter(id => /^P\d+$/.test(id)).length,
      pursuitPurposes: Object.fromEntries(Object.entries(state.offscreenLives?.people || {})
        .filter(([, person]) => person.purpose).map(([who, person]) => [who, person.purpose.status])) };
    checkpoints.push(checkpoint);
    if ([HOUR, DAY, 7 * DAY, 28 * DAY, days * DAY].includes(offset))
      readerSample(activeWorld, offset === HOUR ? '1h-live' : `day${offset / DAY}-live`, target);
    if ([7 * DAY, 28 * DAY, days * DAY].includes(offset))
      readerSample(activeWorld, `day${offset / DAY}-preceding-week`, target, { from: target - 7 * DAY });
    console.log(JSON.stringify({ phase: 'long-checkpoint', ...checkpoint }));
    json('checkpoints.json', checkpoints);
    if (offset === 90 * DAY) {
      activeWorld.close(); activeWorld = openWorld({ dbPath });
      restartIdentical = saveIdentity(activeWorld) === beforeReads;
      assert.equal(restartIdentical, true, 'reopening lost an owned action, memory or world state');
    }
  }

  const final = rowState(activeWorld), now = startMs + days * DAY;
  const replay = structuredClone(initial), byId = new Map(), examples = {}, violations = {}, warnings = {};
  const add = (bag, kind, value) => { bag[kind] ??= { count: 0, examples: [] }; bag[kind].count++;
    if (bag[kind].examples.length < 12) bag[kind].examples.push(value); };
  const eventTypes = {}, publicTypes = {}, lateTypes = {}, lateParagraphs = new Set(), bankOccurrences = {}, purposeStages = {}, relationshipResponses = {};
  let priorAt = startMs, events = 0, publicCount = 0, changedLeaves = 0, memories = 0;
  const actualLedgerHash = createHash('sha256');
  const exampleTests = {
    mundane: event => ['ACTIVITY_START', 'ACTIVITY_COMPLETE', 'OFFSCREEN_START'].includes(event.type),
    travel: event => /TRAVEL|JOURNEY|ARRIVAL|DEPARTURE/.test(event.type),
    interaction: event => event.type === 'SUPPORTING_ENCOUNTER',
    weather: event => /WEATHER|RAIN|STORM/.test(event.type),
    background: event => event.type === 'SCENE_BANK_BEAT',
    arcGathered: event => event.type === 'ARC_CONFRONTATION' && event.payload?.stage === 'gathered',
    arc: event => event.type === 'ARC_CONFRONTATION' && event.payload?.stage === 'confrontation' && event.participants?.length,
  };
  for (const row of activeWorld.db.prepare('SELECT semantic_json FROM events ORDER BY seq').iterate()) {
    actualLedgerHash.update(row.semantic_json);
    const event = JSON.parse(row.semantic_json); events++; count(eventTypes, event.type);
    if (byId.has(event.id)) add(violations, 'duplicate_event_id', { id: event.id });
    if (event.occurredAt < priorAt || event.occurredAt > now) add(violations, 'event_time', { id: event.id });
    for (const id of event.causedBy || []) if (!id.startsWith('canon-seed:')) {
      const source = byId.get(id);
      if (!source || source.occurredAt > event.occurredAt) add(violations, 'missing_or_future_cause', { id: event.id, sourceId: id });
    }
    const visible = event.visibility === 'public' && event.publicDescription;
    if (visible) {
      publicCount++; count(publicTypes, event.type);
      for (const [kind, matches] of Object.entries(exampleTests)) if (!examples[kind] && matches(event))
        examples[kind] = { eventId: event.id, type: event.type, occurredAt: event.occurredAt,
          seed: DEFAULT_SEED, startMs, location: event.location, area: event.area,
          prose: event.prose || event.publicDescription };
      if (event.occurredAt >= now - 14 * DAY) {
        count(lateTypes, event.type); if (event.prose) lateParagraphs.add(event.prose);
      }
      if (event.type === 'SCENE_BANK_BEAT') {
        const id = event.payload.sceneBankId, scene = SCENE_BANK_BY_ID[id]; count(bankOccurrences, id);
        if (!scene || scene.status === 'excluded') add(violations, 'disabled_bank_scene_played', { id, eventId: event.id });
        if (event.payload.sceneBeats?.some(beat => beat.who === 'nimbus' && beat.kind === 'dialogue'))
          add(violations, 'nimbus_speech', { id });
        if (id === 'P21' && !isDeepStrictEqual(event.participants, ['emily', 'nimbus']))
          add(violations, 'private_emily_nimbus_witness', { eventId: event.id, participants: event.participants });
        const age = event.occurredAt - (replay.sceneBank?.nimbus?.arrivedAt || event.occurredAt);
        if (scene?.minAgeDays && age < scene.minAgeDays * DAY) add(violations, 'nimbus_age_gate', { id, age });
      }
      if (event.payload?.purposeStage) count(purposeStages, `${event.payload.guest}:${event.payload.purposeStage}:${event.payload.purposeOutcome || ''}`);
      if (event.payload?.relationshipChoice) {
        const choice = event.payload.relationshipChoice; count(relationshipResponses, `${choice.response}:${choice.reason}`);
        for (const item of choice.evidence || []) for (const field of ['sourceEventId', 'acquisitionEventId']) {
          const source = byId.get(item[field]);
          if (!source || source.occurredAt > event.occurredAt)
            add(violations, 'relationship_future_or_absent_memory', { eventId: event.id, field, id: item[field] });
        }
      }
      if (event.type === 'ARC_CONFRONTATION' && event.payload?.stage === 'confrontation') {
        const started = (event.causedBy || []).map(id => byId.get(id)).find(source => source?.type === 'ARC_CONFRONTATION'
          && source.stage === 'gathered' && source.arcInstanceId === event.payload.arcInstanceId && source.occurredAt < event.occurredAt);
        if (!started) add(violations, 'arc_outcome_without_owned_start', { eventId: event.id });
      }
      if (['ARC_BEAT', 'ARC_CONFRONTATION'].includes(event.type)) {
        for (const who of ['goaden', 'ashai']) {
          const actor = replay.characters[who], named = new RegExp(`\\b${who}\\b`, 'i').test(event.prose || event.publicDescription || '');
          if (named && (actor.location !== event.location || actor.area !== event.area || actor.journey))
            add(warnings, 'arc_named_actor_presence_review', { eventId: event.id, type: event.type,
              at: event.occurredAt, who, actorLocation: actor.location, actorArea: actor.area, activity: actor.activity,
              eventLocation: event.location, eventArea: event.area, participants: event.participants,
              text: (event.prose || event.publicDescription).slice(0, 750) });
        }
      }
    }
    const session = replay.sceneBank?.session;
    for (const change of event.changes || []) {
      if (session && event.occurredAt >= session.startAt && event.occurredAt < session.until
        && !event.type.startsWith('SCENE_BANK_') && change.entity === 'character'
        && session.cast.includes(change.id) && ['activity', 'location', 'area'].includes(change.field))
        add(warnings, 'scene_session_changed_by_other_action', { eventId: event.id, type: event.type,
          who: change.id, field: change.field, session: session.sceneId, before: change.before, after: change.after });
      const target = ['world', 'director', 'pressure', 'story'].includes(change.entity) ? replay
        : change.entity === 'character' ? replay.characters[change.id]
          : replay.relationships.find(pair => `${pair.from}->${pair.to}` === change.id);
      assert.ok(target, `Unknown ledger entity ${change.entity}/${change.id}`);
      if (!isDeepStrictEqual(readChange(target, change), sideOf(change, 'before')))
        add(violations, 'ledger_before_value', { eventId: event.id, entity: change.entity, field: change.field });
      applyChange(target, change, 'after'); changedLeaves++;
    }
    byId.set(event.id, { occurredAt: event.occurredAt, seq: event.seq, visibility: event.visibility, type: event.type,
      ...(event.type.startsWith('ARC_') ? { stage: event.payload?.stage, arcInstanceId: event.payload?.arcInstanceId } : {}),
      ...(event.type === 'SCENE_BANK_BEAT' ? { participants: event.participants } : {}) });
    priorAt = event.occurredAt;
  }
  assert.deepEqual(replay, final, 'the complete ledger did not reconstruct the final stored world');
  assertCanonState(final);
  assert.deepEqual(final.meta.canonAnchors, initial.meta.canonAnchors);
  const knowledgeHolders = [
    ...Object.values(final.characters),
    ...Object.entries(final.offscreenLives?.people || {}).map(([id, person]) => ({ ...person, id: `offscreen:${id}` })),
    ...Object.entries(final.supportingStories?.people || {}).map(([id, person]) => ({ ...person, id: `supporting:${id}` })),
    ...Object.entries(final.agendas?.supporting || {}).map(([id, person]) => ({ ...person, id: `agenda:${id}` })),
  ];
  for (const actor of knowledgeHolders) for (const memory of actor.knowledge || []) {
    memories++;
    if (memory.provenance === 'canon_seed' && memory.sourceEventId.startsWith('canon-seed:')) continue;
    const source = byId.get(memory.sourceEventId), acquisition = byId.get(memory.acquisitionEventId);
    if (!source || !acquisition || source.occurredAt > memory.learnedAt || source.seq > acquisition.seq
      || acquisition.occurredAt !== memory.learnedAt || memory.learnedAt > now)
      add(violations, 'invalid_knowledge_path', { who: actor.id, factKey: memory.factKey });
  }
  for (const [who, known] of Object.entries(final.sceneBank?.knowledge || {})) for (const [sceneId, memory] of Object.entries(known)) {
    memories++;
    const source = byId.get(memory.sourceEventId);
    if (!source || source.occurredAt !== memory.learnedAt || memory.learnedAt > now || !source.participants?.includes(who))
      add(violations, 'scene_bank_knowledge_without_participation', { who, sceneId, sourceEventId: memory.sourceEventId });
  }
  let reversedLeaves = 0;
  for (const row of activeWorld.db.prepare('SELECT semantic_json FROM events ORDER BY seq DESC').iterate()) {
    const event = JSON.parse(row.semantic_json);
    for (const change of [...(event.changes || [])].reverse()) {
      const target = ['world', 'director', 'pressure', 'story'].includes(change.entity) ? replay
        : change.entity === 'character' ? replay.characters[change.id]
          : replay.relationships.find(pair => `${pair.from}->${pair.to}` === change.id);
      assert.ok(target, `Unknown reverse ledger entity ${change.entity}/${change.id}`);
      if (!isDeepStrictEqual(readChange(target, change), sideOf(change, 'after')))
        add(violations, 'ledger_reverse_after_value', { eventId: event.id, entity: change.entity, field: change.field });
      applyChange(target, change, 'before'); reversedLeaves++;
    }
  }
  assert.deepEqual(replay, initial, 'reverse ledger reconstruction did not restore the original world');
  for (const [id, count] of Object.entries(bankOccurrences)) if (count !== 1)
    add(violations, 'bank_scene_replayed', { id, count });
  const pending = activeWorld.presentationSnapshot().pendingActions;
  for (const action of pending) if (action.dueAt <= now) add(violations, 'overdue_pending_action', { id: action.id });
  const publicView = activeWorld.publicProjection();
  for (const key of ['facts', 'knowledge', 'intent', 'agendas', 'pendingActions'])
    if (key in publicView) add(violations, 'private_state_in_public_projection', { key });
  assert.equal(fetchCalls, 0);
  const enabled = SCENE_BANK_MANIFEST.filter(scene => scene.status === 'enabled').map(scene => scene.id);
  const sourcesAtEnd = sourceHashes();
  const report = { result: Object.keys(violations).length ? 'FAIL' : 'PASS', generatedAt: new Date().toISOString(),
    auditorVersion: 2, ...(priorReport ? { recheckedExistingLedger: true, simulationGeneratedAt: priorReport.generatedAt,
      auditorCorrection: 'The initial auditor wrongly treated satisfied prerequisite_gated scenes as excluded. The original report is preserved; this recheck reconstructs the complete saved ledger without advancing it.' } : {}),
    output, dbPath, rulesVersion: RULES_VERSION, seed: DEFAULT_SEED, startMs, days,
    zeroViewer: { viewers: 0, modelClientsCreated: 0, interceptedFetchCalls: fetchCalls,
      boundary: 'Direct authoritative reducer and SQLite only; HTTP spectator/model scheduling is separately audited.' },
    shortRuns: short, changedStoryRows, restartAtDay90Identical: restartIdentical, checkpoints,
    ledger: { events, publicCount, changedLeaves, reversedLeaves, replayMatchesStoredState: true,
      reverseReplayMatchesInitialState: true, checkedMemories: memories,
      hash: actualLedgerHash.digest('hex'), eventTypes, publicTypes },
    authored: { enabled: enabled.length, performed: Object.keys(bankOccurrences).length, occurrences: bankOccurrences,
      unperformedEnabled: enabled.filter(id => !bankOccurrences[id]),
      nimbusCount: Object.keys(bankOccurrences).filter(id => /^P\d+$/.test(id)).length,
      bounty: final.sceneBank?.nimbus?.bounty,
      explanation: 'Finite authored scenes are consumed once; no repetition is fabricated to fill a schedule.' },
    purposeStages, relationshipResponses,
    lateWorld: { finalDays: 14, publicEventsByType: lateTypes, distinctParagraphs: lateParagraphs.size,
      pendingActions: pending.length }, readerSamples, examples, violations, warnings,
    sourceHashesAtStart: sourcesAtStart, sourceHashesAtEnd: sourcesAtEnd,
    sourcesChangedDuringRun: !isDeepStrictEqual(sourcesAtStart, sourcesAtEnd) };
  json('final-simulation.json', report); json('browser-moments.json', examples);
  console.log(JSON.stringify({ phase: 'completed', result: report.result, output, events, publicCount,
    nimbusScenes: report.authored.nimbusCount, unperformedEnabled: report.authored.unperformedEnabled,
    violations: Object.fromEntries(Object.entries(violations).map(([key, value]) => [key, value.count])),
    warnings: Object.fromEntries(Object.entries(warnings).map(([key, value]) => [key, value.count])),
    sourcesChangedDuringRun: report.sourcesChangedDuringRun }));
  if (report.result !== 'PASS') process.exitCode = 1;
} catch (error) {
  json('failed.json', { result: 'FAIL', error: error.stack, output, fetchCalls });
  console.error(error.stack); process.exitCode = 1;
} finally {
  activeWorld?.close(); globalThis.fetch = originalFetch;
}
