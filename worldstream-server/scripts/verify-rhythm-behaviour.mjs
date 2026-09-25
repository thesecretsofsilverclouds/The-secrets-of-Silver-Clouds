import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openWorld, semanticDigest } from '../src/world.mjs';
import { createFixture, RULES_VERSION } from '../src/fixture.mjs';
import { RHYTHM_RULES, RHYTHM_TEMPLATES, assertRhythm } from '../src/rhythm.mjs';
import { applyChange, readChange, sideOf } from '../src/ledger.mjs';
import { atLondon, londonDate, nextLondonDay } from '../src/time.mjs';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ACCEPTANCE_START = atLondon('2026-09-05', '00:00');
const labelsByType = Object.fromEntries(Object.entries(RHYTHM_TEMPLATES).map(([label, row]) => [row.type, label]));
const byteLength = value => Buffer.byteLength(JSON.stringify(value), 'utf8');
const hash = value => createHash('sha256').update(value).digest('hex');
const round = value => Math.round(value * 1e6) / 1e6;
const succeeded = event => event.payload?.outcome !== 'skipped' && !event.payload?.skipped;
const stateOf = world => JSON.parse(world.db.prepare('SELECT state_json FROM world_state WHERE id=1').get().state_json);
const rhythmChanges = event => event.changes.filter(change => change.entity === 'story' && change.field === 'rhythm');

function sourceFingerprint() {
  return Object.fromEntries(['src/fixture.mjs', 'src/rhythm.mjs', 'src/morphos.mjs', 'src/intent.mjs',
    'src/canonical-fork.mjs', 'experiment-l/src/world.mjs'].map(path => [path, hash(readFileSync(join(project, path)))]));
}

/** Audit actual private choices, public starts and owned successful completions.
 * The report keeps those denominators separate: an interrupted choice is not a
 * completed habit and is never counted as one to improve a distribution. */
export function createRhythmAudit(initialState) {
  const replay = { rhythm: structuredClone(initialState.rhythm) }, initial = structuredClone(replay);
  const decisions = new Map(), starts = new Map(), changes = [], maxBytes = { ashai: 0, goaden: 0 };
  let events = 0, rhythmEvents = 0, habitIncrements = 0, skippedDecisions = 0;
  const bounds = () => {
    for (const [who, record] of Object.entries(replay.rhythm.actors)) {
      maxBytes[who] = Math.max(maxBytes[who], byteLength(record));
      assert.ok(maxBytes[who] <= RHYTHM_RULES.maxActorBytes, `${who} exceeds 4 KiB`);
    }
  };
  bounds();
  return {
    consume(event) {
      events++;
      if (event.type === 'RHYTHM_CHOOSE') {
        assert.equal(event.visibility, 'private');
        if (Array.isArray(event.payload.scores) && event.payload.scores.length) {
          const scores = event.payload.scores;
          assert.ok(scores.length <= 8);
          assert.ok(scores.some(row => row.type === event.payload.chosen), 'Choice was absent from the legal candidates');
          const who = event.participants[0];
          assert.ok(['ashai', 'goaden'].includes(who));
          decisions.set(event.id, { id: event.id, who, family: event.payload.family, slot: event.payload.slot,
            at: event.occurredAt, chosen: labelsByType[event.payload.chosen], eligible: scores.map(row => row.label),
            started: false, completed: false });
        } else skippedDecisions++;
      }
      if (labelsByType[event.type] && succeeded(event)) {
        const decision = event.causedBy.map(id => decisions.get(id)).find(Boolean);
        if (decision) {
          assert.equal(labelsByType[event.type], decision.chosen);
          assert.ok(event.participants.includes(decision.who));
          assert.ok(!decision.started, 'One decision started twice');
          decision.started = true; decision.startEventId = event.id;
          starts.set(event.id, decision);
        }
      }
      let completed = null;
      if (['ACTIVITY_COMPLETE', 'PRACTICE_END'].includes(event.type) && succeeded(event)) {
        completed = event.changes.filter(change => change.entity === 'character' && change.field === 'activityId')
          .map(change => starts.get(change.before)).find(Boolean);
        if (completed) { assert.ok(!completed.completed, 'One choice completed twice'); completed.completed = true; }
      }
      const before = structuredClone(replay.rhythm);
      const moved = rhythmChanges(event);
      if (moved.length) rhythmEvents++;
      for (const change of moved) {
        assert.deepEqual(readChange(replay, change), sideOf(change, 'before'), `RHYTHM replay before ${event.id}`);
        applyChange(replay, change, 'after'); changes.push(change);
      }
      for (const who of ['ashai', 'goaden']) for (const [label, value] of Object.entries(replay.rhythm.actors[who].habits)) {
        if (value <= before.actors[who].habits[label]) continue;
        habitIncrements++;
        assert.ok(completed && completed.who === who && completed.chosen === label,
          `Habit grew without its actual free-slot completion at ${event.id}: ${who}/${label}`);
      }
      assertRhythm(replay, event.occurredAt); bounds();
    },
    finish(finalState) {
      assert.deepEqual(replay.rhythm, finalState.rhythm, 'Forward RHYTHM ledger replay differs');
      const reverse = structuredClone(replay);
      for (const change of [...changes].reverse()) {
        assert.deepEqual(readChange(reverse, change), sideOf(change, 'after'), 'Reverse RHYTHM prior value differs');
        applyChange(reverse, change, 'before');
      }
      assert.deepEqual(reverse, initial, 'Reverse RHYTHM ledger replay differs');
      return { events, rhythmEvents, habitIncrements, skippedDecisions, maxActorBytes: maxBytes,
        choices: [...decisions.values()], replay: { forward: true, reverse: true } };
    },
  };
}

export function summarizeChoices(choices) {
  const groups = {};
  for (const row of choices) {
    const key = `${row.who}/${row.family}`;
    const group = groups[key] ??= { decisions: 0, started: 0, completed: 0, labels: {} };
    group.decisions++; group.started += Number(row.started); group.completed += Number(row.completed);
    for (const label of row.eligible) {
      const counts = group.labels[label] ??= { eligible: 0, chosen: 0, started: 0, completed: 0, eligibleCompletedSlots: 0 };
      counts.eligible++;
      if (row.completed) counts.eligibleCompletedSlots++;
      if (label === row.chosen) { counts.chosen++; counts.started += Number(row.started); counts.completed += Number(row.completed); }
    }
  }
  for (const group of Object.values(groups)) for (const counts of Object.values(group.labels)) {
    counts.chosenShare = round(counts.chosen / group.decisions);
    counts.completedShare = group.completed ? round(counts.completed / group.completed) : null;
    counts.chosenWhenEligible = round(counts.chosen / counts.eligible);
    counts.completedWhenEligible = counts.eligibleCompletedSlots ? round(counts.completed / counts.eligibleCompletedSlots) : null;
  }
  return groups;
}

export function behaviourGates(summary) {
  const gates = [];
  for (const [group, counts] of Object.entries(summary).filter(([key]) => key.endsWith('/evening_leisure'))) {
    for (const [label, row] of Object.entries(counts.labels)) for (const metric of ['chosenWhenEligible', 'completedWhenEligible'])
      gates.push({ name: `${group}/${label}/${metric} in [0.05,0.70]`, actual: row[metric],
        pass: row[metric] !== null && row[metric] >= .05 && row[metric] <= .70 });
  }
  const tv = summary['ashai/evening_leisure']?.labels.watching_television;
  for (const metric of ['chosenShare', 'completedShare']) gates.push({ name: `ashai/evening TV ${metric} in [0.35,0.60]`,
    actual: tv?.[metric] ?? null, pass: typeof tv?.[metric] === 'number' && tv[metric] >= .35 && tv[metric] <= .60 });
  return gates;
}

// Daily bounded reads keep the 90-day audit from materialising a mature ledger.
// Reduction is the production SQLite WorldStore and production fixture.
export function simulateRhythm({ seed, days = 14, startMs = ACCEPTANCE_START, progress = null }) {
  const world = openWorld({ dbPath: ':memory:', seed, startMs });
  const audit = createRhythmAudit(stateOf(world));
  let seq = 0, date = londonDate(startMs), state, ledgerHash = createHash('sha256');
  try {
    for (let day = 0; day < days; day++) {
      date = nextLondonDay(date); world.advance(atLondon(date, '00:00'));
      for (const row of world.db.prepare('SELECT seq,semantic_json FROM events WHERE seq>? ORDER BY seq').iterate(seq)) {
        const event = JSON.parse(row.semantic_json); audit.consume(event); ledgerHash.update(row.semantic_json); seq = row.seq;
      }
      state = stateOf(world); assertRhythm(state, atLondon(date, '00:00'));
      progress?.({ day: day + 1, events: seq });
    }
    const result = audit.finish(state);
    const before = JSON.stringify(state.rhythm), projection = JSON.stringify(world.publicProjection());
    for (const row of result.choices) assert.ok(!projection.includes(row.id), 'Private choice ID leaked into public projection');
    for (const field of ['needsAt', 'habits', 'satiety', 'RHYTHM_CHOOSE']) assert.ok(!projection.includes(`"${field}"`), `Private ${field} leaked`);
    assert.equal(JSON.stringify(stateOf(world).rhythm), before, 'Public read changed RHYTHM');
    return { seed, days, ...result, stateDigest: semanticDigest(state), ledgerDigest: ledgerHash.digest('hex'),
      summary: summarizeChoices(result.choices) };
  } finally { world.close(); }
}

/** Same real world through one catch-up, irregular chunks and a SQLite restart. */
export function verifyRhythmDeterminism({ seed = 'rhythm-acceptance-00', days = 3, startMs = ACCEPTANCE_START } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'worldstream-rhythm-'));
  const end = startMs + days * 86_400_000, snapshots = {}, chunks = [.17, .31, .67, 1];
  try {
    for (const mode of ['single', 'chunked', 'restarted']) {
      const dbPath = mode === 'restarted' ? join(directory, 'restart.sqlite') : ':memory:';
      let world = openWorld({ dbPath, seed, startMs });
      try {
        for (const fraction of mode === 'single' ? [1] : chunks) {
          world.advance(Math.round(startMs + (end - startMs) * fraction));
          if (mode === 'restarted' && fraction < 1) { world.close(); world = openWorld({ dbPath }); }
        }
        snapshots[mode] = world.semanticSnapshot();
      } finally { world.close(); }
    }
    const digests = Object.fromEntries(Object.entries(snapshots).map(([key, snapshot]) => [key, semanticDigest(snapshot)]));
    assert.equal(digests.chunked, digests.single, 'Chunked full canonical world differs');
    assert.equal(digests.restarted, digests.single, 'Restarted full canonical world differs');
    const audit = createRhythmAudit(createFixture({ startMs }).initialState());
    for (const event of snapshots.single.events) audit.consume(event);
    const result = audit.finish(snapshots.single);
    assert.ok(result.choices.length > 0, 'Determinism check must exercise real choices');
    return { seed, days, events: result.events, choices: result.choices.length, digests, ...result.replay };
  } finally {
    const target = resolve(directory), base = resolve(tmpdir());
    assert.ok(target.startsWith(base + sep) && target !== base, 'Temporary cleanup escaped its directory');
    rmSync(target, { recursive: true, force: true });
  }
}

export async function runRhythmAcceptance({ seeds = 30, days = 14, longDays = 90,
  output = join(project, 'RHYTHM-ACCEPTANCE.json'), progress = message => console.log(message) } = {}) {
  const began = Date.now(), sources = sourceFingerprint(), originalFetch = globalThis.fetch;
  let fetchAttempts = 0;
  globalThis.fetch = () => { fetchAttempts++; throw new Error('Network/model call forbidden in RHYTHM acceptance'); };
  const report = { version: 1, rulesVersion: RULES_VERSION, startedAt: new Date(began).toISOString(), sources,
    parameters: { startMs: ACCEPTANCE_START, seeds, days, longDays }, worlds: [], complete: false, pass: false };
  try {
    const choices = [];
    for (let index = 0; index < seeds; index++) {
      const seed = `rhythm-acceptance-${String(index).padStart(2, '0')}`;
      const result = simulateRhythm({ seed, days });
      choices.push(...result.choices);
      report.worlds.push({ ...result, choices: undefined });
      progress(`RHYTHM ${index + 1}/${seeds}: ${result.events} events, ${result.choices.length} choices`);
    }
    report.distribution = summarizeChoices(choices); report.behaviourGates = behaviourGates(report.distribution);
    report.determinism = verifyRhythmDeterminism({ days: Math.min(days, 7) });
    progress('RHYTHM chunking/restart/replay passed; starting long-run bound');
    const longRun = simulateRhythm({ seed: 'rhythm-acceptance-long', days: longDays,
      progress: row => { if (row.day % 10 === 0) progress(`RHYTHM long run: ${row.day}/${longDays} days, ${row.events} events`); } });
    report.longRun = { ...longRun, choices: undefined };
    assert.equal(fetchAttempts, 0); assert.deepEqual(sourceFingerprint(), sources, 'Core source changed during acceptance; rerun stable code');
    report.complete = true; report.pass = report.behaviourGates.every(gate => gate.pass);
  } catch (error) { report.error = { message: error.message, stack: error.stack }; }
  finally {
    globalThis.fetch = originalFetch;
    report.fetchAttempts = fetchAttempts; report.elapsedSeconds = round((Date.now() - began) / 1000);
    writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = { '--seeds': 'seeds', '--days': 'days', '--long-days': 'longDays', '--output': 'output' }[args[i]];
    if (!key || !args[i + 1]) throw new Error('Usage: verify-rhythm-behaviour.mjs [--seeds 30] [--days 14] [--long-days 90] [--output path]');
    options[key] = key === 'output' ? resolve(args[i + 1]) : Number(args[i + 1]);
    if (key !== 'output') assert.ok(Number.isSafeInteger(options[key]) && options[key] > 0);
  }
  const report = await runRhythmAcceptance(options);
  console.log(JSON.stringify({ complete: report.complete, pass: report.pass, elapsedSeconds: report.elapsedSeconds,
    failedGates: report.behaviourGates?.filter(gate => !gate.pass), error: report.error?.message }));
  if (!report.pass) process.exitCode = 1;
}
