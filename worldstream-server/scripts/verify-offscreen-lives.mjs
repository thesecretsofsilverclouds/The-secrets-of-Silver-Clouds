import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { openWorld, semanticDigest } from '../src/world.mjs';
import { createFixture, DEFAULT_SEED, publicEvents, publicProjection, RULES_VERSION } from '../src/fixture.mjs';
import { OFFSCREEN_CAST, OFFSCREEN_RULES } from '../src/offscreen-lives.mjs';
import { listStoryThreads, buildStoryThread } from '../src/story-threads.mjs';
import { atLondon, londonDate } from '../src/time.mjs';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = value => createHash('sha256').update(value).digest('hex');
const json = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
const overlap = (a, b) => a.startAt < b.until && b.startAt < a.until;
const owned = ['promised', 'met', 'interrupting'];
const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', dateStyle: 'medium', timeStyle: 'short' });
const memoryKey = memory => `${memory.factKey}|${memory.sourceEventId}|${memory.acquisitionEventId}`;

// Audit the real reduced ledger, including intermediate reservations and first
// acquisition, rather than inferring continuity from the final prose paragraphs.
export function auditOffscreenHistory(snapshot, { requireCoverage = true } = {}) {
  const byId = new Map(snapshot.events.map(event => [event.id, event]));
  const state = createFixture({ startMs: snapshot.meta.startMs }).initialState();
  const counts = { starts: 0, results: 0, resumed: 0, heard: 0, helped: 0, recalled: 0,
    unfinished: 0, settled: 0, helpedSettled: 0, acquisitions: 0, checkedReservations: 0, checkedTransfers: 0 };
  const cast = Object.fromEntries(Object.keys(OFFSCREEN_CAST).map(id => [id, 0])), days = {};
  const acquisitionRows = [], helpedResults = [], seenAt = {};
  function publicSource(id, at) {
    const source = byId.get(id);
    assert.ok(source && source.visibility === 'public' && source.publicDescription, `Missing public source ${id}`);
    assert.ok(source.occurredAt <= at, `Future source ${id}`);
    return source;
  }
  for (const event of snapshot.events) {
    if (event.visibility === 'public') {
      const present = new Set([...(event.payload.cast ?? []), ...(event.payload.visitors ?? []),
        ...(event.payload.who ? [event.payload.who] : [])]);
      for (const guest of Object.keys(OFFSCREEN_CAST).filter(id => present.has(id))) {
        const previous = seenAt[guest];
        if (previous && previous.location !== event.location) {
          counts.checkedTransfers++;
          assert.ok(event.occurredAt - previous.at >= OFFSCREEN_RULES.transferInterval,
            `${guest} moved from ${previous.location} to ${event.location} without the minimum transfer interval at ${event.id}`);
        }
        seenAt[guest] = { location: event.location, at: event.occurredAt, eventId: event.id };
      }
    }
    if (event.type === 'OFFSCREEN_ENCOUNTER' && event.visibility === 'public' && event.payload.stage !== 'heard') {
      const data = event.payload, sourceId = data.recalledSourceEventId ?? data.sourceEventId;
      const source = publicSource(sourceId, event.occurredAt), acquisition = publicSource(data.acquisitionEventId, event.occurredAt);
      const memory = state.characters[data.lead].knowledge.find(row => row.sourceEventId === sourceId
        && row.acquisitionEventId === acquisition.id);
      assert.ok(memory && memory.learnedAt < event.occurredAt, 'Recollection must precede this encounter');
      assert.equal(source.type, 'OFFSCREEN_RESULT');
      assert.ok(acquisition.occurredAt < event.occurredAt && source.occurredAt <= acquisition.occurredAt);
      assert.ok(event.causedBy.includes(source.id) && event.causedBy.includes(acquisition.id), 'Recollection needs both source and acquisition edges');
      assert.ok(acquisition.participants.includes(data.lead));
      assert.equal(data.acquiredAt, memory.learnedAt);
      if (data.stage === 'helped') assert.equal(source.payload.outcome, 'unfinished');
    }
    for (const change of event.changes) {
      if (change.entity === 'character') state.characters[change.id][change.field] = structuredClone(change.after);
      else if (change.entity === 'relationship') {
        const pair = state.relationships.find(row => `${row.from}->${row.to}` === change.id);
        if (pair) pair[change.field] = structuredClone(change.after);
      } else if (['world', 'director', 'pressure'].includes(change.entity)) state[change.field] = structuredClone(change.after);
    }
    for (const change of event.changes.filter(row => row.entity === 'character' && row.field === 'knowledge')) {
      const before = new Set((change.before ?? []).map(memoryKey));
      for (const memory of change.after.filter(row => !before.has(memoryKey(row)))) {
        const fact = state.facts[memory.factKey];
        if (!['offscreen_result', 'offscreen_help'].includes(fact?.kind)) continue;
        const source = publicSource(memory.sourceEventId, memory.learnedAt);
        assert.equal(event.visibility, 'public'); assert.equal(event.type, 'OFFSCREEN_ENCOUNTER');
        assert.equal(memory.acquisitionEventId, event.id); assert.equal(memory.learnedAt, event.occurredAt);
        assert.equal(fact.sourceEventId, source.id); assert.ok(fact.createdAt <= memory.learnedAt);
        assert.ok(event.participants.includes(change.id), 'Learning requires actual participation');
        assert.ok(['told_by_participant', 'participated'].includes(memory.provenance));
        acquisitionRows.push({ actor: change.id, factKey: memory.factKey, sourceEventId: source.id,
          sourceOccurredAt: source.occurredAt, acquisitionEventId: event.id, learnedAt: memory.learnedAt,
          provenance: memory.provenance });
        counts.acquisitions++;
      }
    }
    for (const [guest, person] of Object.entries(state.offscreenLives.people)) {
      const held = person.commitment; if (!held || held.until <= event.occurredAt) continue;
      counts.checkedReservations++;
      const agenda = state.agendas?.supporting?.[guest]?.commitment;
      assert.ok(!agenda || !overlap(held, agenda), `${guest} double-booked with an agenda at ${event.id}`);
      for (const story of Object.values(state.supportingStories?.instances ?? {})) {
        if (!owned.includes(story.status) || !story.guests.includes(guest)) continue;
        assert.ok(!overlap(held, { startAt: story.openedAt, until: story.deadlineAt }), `${guest} double-booked with a supporting story at ${event.id}`);
      }
    }
    if (!event.type.startsWith('OFFSCREEN_') || event.visibility !== 'public') continue;
    const data = event.payload;
    if (event.type === 'OFFSCREEN_START' || event.type === 'OFFSCREEN_RESULT') {
      assert.deepEqual(event.participants, [], 'Autonomous work cannot imply either lead attended');
      const date = londonDate(event.occurredAt); days[date] = (days[date] ?? 0) + 1;
      assert.ok(days[date] <= OFFSCREEN_RULES.dailyLimit * 2, `Too many autonomous public beats on ${date}`);
    }
    if (event.type === 'OFFSCREEN_START') {
      counts.starts++; cast[data.guest]++;
      if (data.stage === 'resumed') {
        counts.resumed++;
        const prior = publicSource(data.previousResultEventId, event.occurredAt);
        assert.equal(prior.type, 'OFFSCREEN_RESULT'); assert.equal(prior.payload.outcome, 'unfinished');
        assert.equal(prior.payload.offscreenStoryId, data.offscreenStoryId, 'A return must continue the same project');
        assert.equal(data.attempt, prior.payload.attempt + 1); assert.ok(event.causedBy.includes(prior.id));
      }
    } else if (event.type === 'OFFSCREEN_RESULT') {
      counts.results++; counts[data.outcome]++;
      if (data.helpSourceEventId) {
        const help = publicSource(data.helpSourceEventId, event.occurredAt);
        assert.equal(help.type, 'OFFSCREEN_ENCOUNTER'); assert.equal(help.payload.stage, 'helped');
        assert.equal(help.payload.offscreenStoryId, data.offscreenStoryId);
        assert.equal(data.outcome, 'settled', 'Recorded useful help must affect an uninterrupted next attempt');
        assert.ok(event.causedBy.includes(help.id)); counts.helpedSettled++; helpedResults.push(event.id);
      }
    } else {
      assert.ok(['heard', 'helped', 'recalled'].includes(data.stage)); counts[data.stage]++;
      const source = publicSource(data.sourceEventId, event.occurredAt);
      assert.equal(source.type, 'OFFSCREEN_RESULT'); assert.equal(data.sourceOccurredAt, source.occurredAt);
      if (data.stage === 'heard') assert.equal(data.acquisitionEventId, event.id);
    }
  }
  assert.ok(Object.keys(snapshot.offscreenLives.projects).length <= OFFSCREEN_RULES.retainedProjects);
  assert.ok(Object.keys(snapshot.offscreenLives.issued).length <= OFFSCREEN_RULES.retainedActions);
  if (requireCoverage) {
    for (const [guest, count] of Object.entries(cast)) assert.ok(count > 0, `${guest} never lived independently`);
    for (const name of ['resumed', 'heard', 'helped', 'settled', 'helpedSettled', 'acquisitions', 'checkedReservations', 'checkedTransfers'])
      assert.ok(counts[name] > 0, `No natural ${name} coverage; do not pass unreachable story branches`);
  }
  return { counts, cast, autonomousPublicBeatsByDay: days, acquisitionRows, helpedResults };
}

function assertPublicOnly(value) {
  const forbidden = new Set(['payload', 'changes', 'knowledge', 'facts', 'offscreenLives', 'issued', 'token', 'privateReason']);
  if (Array.isArray(value)) { for (const item of value) assertPublicOnly(item); }
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) {
    assert.ok(!forbidden.has(key), `Private field in public projection: ${key}`); assertPublicOnly(item);
  }
}
function rawDigest(world) {
  const digest = createHash('sha256');
  for (const query of ['SELECT * FROM world_state WHERE id=1', 'SELECT * FROM events ORDER BY seq',
    'SELECT * FROM scheduled_actions ORDER BY id']) {
    digest.update(query);
    for (const row of world.db.prepare(query).iterate()) digest.update(JSON.stringify(row));
  }
  return digest.digest('hex');
}
function verifyReads(world) {
  const before = rawDigest(world), reading = world.presentationSnapshot(), publicRead = world.publicProjection();
  const trails = listStoryThreads(reading).map(request => buildStoryThread(reading, request, { eventById: id => world.eventById(id) }));
  assertPublicOnly(publicRead); assertPublicOnly(trails);
  const poison = structuredClone(reading), marker = '__PRIVATE_OFFSCREEN_SENTINEL__';
  poison.offscreenLives.privateReason = marker;
  for (const person of Object.values(poison.offscreenLives.people)) person.privateReason = marker;
  for (const row of Object.values(poison.offscreenLives.projects)) row.intention = marker;
  for (const actor of Object.values(poison.characters)) {
    actor.privateReason = marker;
    for (const memory of actor.knowledge) memory.privateReason = marker;
  }
  for (const event of poison.events) { event.payload.privateReason = marker; }
  const redacted = [publicProjection(poison), listStoryThreads(poison).map(request => buildStoryThread(poison, request))];
  assert.equal(JSON.stringify(redacted).includes(marker), false, 'Private inner life leaked into presentation');
  for (let i = 0; i < 5; i++) {
    world.publicProjection(); world.publicHistory({ limit: 100 });
    for (const request of listStoryThreads(reading)) buildStoryThread(reading, request, { eventById: id => world.eventById(id) });
  }
  assert.equal(rawDigest(world), before, 'Reads altered history, knowledge or pending work');
  return { repeatedReads: 5, trailsChecked: trails.length, privateSentinelAbsent: true, rawDigestUnchanged: true };
}

function causalExample(snapshot, resultId) {
  const byId = new Map(snapshot.events.map(event => [event.id, event])), selected = new Map();
  const result = byId.get(resultId), projectId = result.payload.offscreenStoryId;
  const visit = event => {
    if (!event || selected.has(event.id) || event.visibility !== 'public' || !event.type.startsWith('OFFSCREEN_')) return;
    selected.set(event.id, event);
    for (const id of [...event.causedBy, event.payload.acquisitionEventId, event.payload.recalledSourceEventId]) visit(byId.get(id));
  };
  for (const event of snapshot.events) if (event.payload.offscreenStoryId === projectId && event.occurredAt <= result.occurredAt) visit(event);
  // A remembered earlier project may have finished before this new one began.
  // Include its actual intervening outcome too, so the readable excerpt does
  // not misleadingly leave a completed piece hanging between the two projects.
  let previousSize;
  do {
    previousSize = selected.size;
    const projects = new Set([...selected.values()].map(event => event.payload.offscreenStoryId));
    for (const event of snapshot.events) if (projects.has(event.payload.offscreenStoryId)
      && event.occurredAt <= result.occurredAt) visit(event);
  } while (selected.size !== previousSize);
  return publicEvents({ events: [...selected.values()].sort((a, b) => a.seq - b.seq) }, Infinity);
}

// A presentation-only refresh can update the prose artifact after an editorial
// revision, without rerunning the simulated world or replacing its test receipt.
export function writeOffscreenCausalExample({ output, snapshot, helpedResults }) {
  const results = helpedResults.map(id => snapshot.events.find(event => event.id === id));
  const selected = ['rose', 'gabriel', 'yukon', 'zara'].map(guest => results.find(event => event.payload.guest === guest)).find(Boolean);
  const example = causalExample(snapshot, selected.id);
  assert.ok(example.some(event => event.type === 'OFFSCREEN_RESULT') && example.some(event => event.type === 'OFFSCREEN_ENCOUNTER'));
  json(join(output, 'public-causal-example.json'), example);
  writeFileSync(join(output, 'PUBLIC-CAUSAL-EXAMPLE.md'), '# A life continued beyond the camera\n\n'
    + 'An actual completed causal thread from the isolated 28-day seeded world, including the finish of remembered earlier work. Public prose only; no invented bridge events. Times Europe/London.\n\n'
    + example.map(event => `**${fmt.format(event.occurredAt)} · ${event.location}**\n\n${event.prose ?? event.description}\n\n`).join(''));
  return example;
}

async function runVariants() {
  let stdout = '', stderr = '';
  const child = spawn(process.execPath, [join(project, 'src', 'run-verification.mjs')], { cwd: project, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', chunk => { stdout += chunk; process.stdout.write(chunk); });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  assert.equal(code, 0, stderr || 'A–E verifier failed');
  const start = stdout.lastIndexOf('\n{\n  "result": "PASS"');
  assert.ok(start >= 0, 'A–E output receipt missing');
  const receipt = JSON.parse(stdout.slice(start));
  const comparison = JSON.parse(readFileSync(join(receipt.output, 'comparison.json'), 'utf8'));
  return { directory: receipt.output, comparison };
}

export async function verifyOffscreenLives({ withVariants = false, seed = DEFAULT_SEED, output } = {}) {
  output ??= join(project, 'artifacts', `offscreen-lives-${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}`);
  mkdirSync(output, { recursive: true });
  if (existsSync(join(output, 'coverage.sqlite'))) throw new Error('Verification requires a fresh output directory; keep earlier receipts intact');
  const core = resolve(project, '..', 'experiment-l', 'src', 'world.mjs');
  const coreBefore = hash(readFileSync(core));
  assert.equal(coreBefore, 'a136195e198ffac1d985efb2e7626303d3bb232811a79cc980f88488f75c8713', 'Proven deterministic core changed');
  const startMs = atLondon('2026-09-04', '00:00'), endMs = atLondon('2026-10-02', '00:00');
  const world = openWorld({ dbPath: join(output, 'coverage.sqlite'), seed, startMs });
  let report;
  try {
    const began = performance.now(), result = world.advance(endMs), elapsedMs = performance.now() - began;
    const snapshot = world.semanticSnapshot(), audit = auditOffscreenHistory(snapshot), reads = verifyReads(world);
    writeOffscreenCausalExample({ output, snapshot, helpedResults: audit.helpedResults });
    report = { result: 'PASS', rulesVersion: RULES_VERSION, seed, startMs, endMs, fictionalDays: 28,
      events: snapshot.events.length, publicEvents: snapshot.events.filter(event => event.visibility === 'public').length,
      elapsedMs, processedActions: result.processedActions, semanticDigest: semanticDigest(snapshot),
      audit, reads, example: 'PUBLIC-CAUSAL-EXAMPLE.md', coreSha256: coreBefore };
  } catch (error) {
    json(join(output, 'failure.json'), { result: 'FAIL', rulesVersion: RULES_VERSION, seed, message: error.message, stack: error.stack });
    throw error;
  } finally { world.close(); }
  try {
    if (withVariants) report.variants = await runVariants();
    assert.equal(hash(readFileSync(core)), coreBefore);
  } catch (error) {
    json(join(output, 'failure.json'), { result: 'FAIL', phase: 'variants', rulesVersion: RULES_VERSION,
      seed, message: error.message, stack: error.stack });
    throw error;
  }
  json(join(output, 'comparison.json'), report);
  writeFileSync(join(output, 'RESULTS.md'), `# Off-screen lives verification: PASS\n\n`
    + `28 fictional days, 4 September–2 October 2026, Europe/London. Seed: ${seed}. Rules: ${RULES_VERSION}.\n\n`
    + `All four autonomous supporting lives appeared. ${report.audit.counts.resumed} returns continued the same unfinished project; `
    + `${report.audit.counts.heard} first hearings, ${report.audit.counts.helped} informed interventions and ${report.audit.counts.helpedSettled} subsequent resolutions were recorded.\n\n`
    + `Every acquisition had an earlier public source and its own actual encounter. Recollections carried both source and acquisition event IDs. Existing reservations did not overlap. Known public appearances in different locations allowed at least ${OFFSCREEN_RULES.transferInterval / 60000} minutes between them. Autonomous work stayed within four public beats per day.\n\n`
    + `Public feed and story-trail reads did not acquire knowledge or mutate the database. Private state and injected private markers remained absent from projection. The Experiment L engine hash is unchanged.\n\n`
    + (report.variants ? `A–E full semantic snapshots all match; digest ${report.variants.comparison.variants[0].digest}. Six-hour catch-up: ${report.variants.comparison.benchmark.processedActions} actions, median ${report.variants.comparison.benchmark.medianMs.toFixed(3)} ms, p95 ${report.variants.comparison.benchmark.p95Ms.toFixed(3)} ms.\n\n` : 'A–E and benchmark were not requested in this coverage-only run.\n\n')
    + 'The public causal example contains actual edited ledger events. These checks establish causal continuity and read safety; literary quality still needs author judgment.\n');
  console.log(JSON.stringify({ result: 'PASS', output, counts: report.audit.counts, cast: report.audit.cast }, null, 2));
  return { output, report };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await verifyOffscreenLives({ withVariants: process.argv.includes('--with-variants') });
}
