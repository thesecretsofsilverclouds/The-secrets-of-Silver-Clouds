import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { openWorld, semanticDigest } from '../src/world.mjs';
import { DEFAULT_SEED } from '../src/fixture.mjs';
import { atLondon } from '../src/time.mjs';

const START = atLondon('2026-09-04', '00:00');
const END = atLondon('2026-09-07', '00:00');
const WORLD_URL = new URL('../src/world.mjs', import.meta.url).href;

function storage(t) {
  const directory = mkdtempSync(join(tmpdir(), 'silver-clouds-phase0-persistence-'));
  const opened = [];
  t.after(() => {
    for (const world of opened) world.close();
    const resolved = realpathSync(directory);
    if (dirname(resolved) !== realpathSync(tmpdir())
      || !basename(resolved).startsWith('silver-clouds-phase0-persistence-')) {
      throw new Error(`Refusing unexpected cleanup target: ${resolved}`);
    }
    rmSync(resolved, { recursive: true, force: true });
  });
  return {
    path: join(directory, 'world.sqlite'),
    open(dbPath = join(directory, 'world.sqlite'), options = {}) {
      const world = openWorld({ dbPath, ...options });
      opened.push(world);
      return world;
    },
  };
}

function sameHistory(actual, expected) {
  assert.deepEqual(actual, expected);
  assert.equal(semanticDigest(actual), semanticDigest(expected));
  assert.equal(new Set(actual.events.map(event => event.id)).size, actual.events.length);
}

function readsAndDuplicatesArePure(world, target) {
  const before = world.semanticSnapshot();
  const projection = world.publicProjection();
  for (let i = 0; i < 3; i++) {
    assert.deepEqual(world.publicProjection(), projection);
    assert.equal(world.advance(target).appendedEvents, 0);
  }
  sameHistory(world.semanticSnapshot(), before);
}

// A new process receives only the database path and target times. It must recover
// the seed, original epoch, character facts and pending actions from SQLite.
function resumeInNewProcess(t, dbPath, targets) {
  const program = `
    import assert from 'node:assert/strict';
    import { openWorld, semanticDigest } from ${JSON.stringify(WORLD_URL)};
    const world = openWorld({ dbPath: ${JSON.stringify(dbPath)} });
    try {
      const beforeDigest = semanticDigest(world.semanticSnapshot());
      for (let i = 0; i < 3; i++) world.publicProjection();
      assert.equal(semanticDigest(world.semanticSnapshot()), beforeDigest);
      const advances = [];
      for (const target of ${JSON.stringify(targets)}) {
        const result = world.advance(target);
        const committedDigest = semanticDigest(world.semanticSnapshot());
        const duplicate = world.advance(target);
        assert.equal(duplicate.appendedEvents, 0);
        world.publicProjection();
        assert.equal(semanticDigest(world.semanticSnapshot()), committedDigest);
        advances.push({ target, result, duplicate });
      }
      const afterDigest = semanticDigest(world.semanticSnapshot());
      world.close();
      process.send({ pid: process.pid, beforeDigest, afterDigest, advances }, () => process.disconnect());
    } catch (error) {
      world.close();
      console.error(error.stack);
      process.exitCode = 1;
      process.disconnect();
    }
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', program], {
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'], windowsHide: true,
  });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  return new Promise((resolve, reject) => {
    let delivered, stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Restart process timed out: ${stderr}`));
    }, 20_000);
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('message', message => { delivered = message; });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('exit', code => {
      clearTimeout(timer);
      if (code === 0 && delivered) resolve(delivered);
      else reject(new Error(`Restart process exited ${code}: ${stderr}`));
    });
  });
}

test('Phase 0: an accepted knowledge-backed promise and its consequences survive a real process restart', async t => {
  const stores = storage(t);
  const uninterrupted = stores.open(':memory:', { startMs: START, seed: DEFAULT_SEED });
  uninterrupted.advance(END);
  const expected = uninterrupted.semanticSnapshot();

  // Discover an actual committed promise rather than injecting an arrangement or
  // predicting that an intended schedule action was necessarily eligible.
  const found = Object.entries(expected.arrangements).find(([, arrangement]) =>
    arrangement.status === 'completed' && arrangement.knowledgeSource && arrangement.acceptanceEventId);
  assert.ok(found, 'The bounded canon fixture must contain a completed knowledge-backed promise');
  const [key, completed] = found;
  const acceptance = expected.events.find(event => event.id === completed.acceptanceEventId);
  assert.equal(acceptance.type, 'ACCEPT_ACTIVITY');

  let resumed = stores.open(stores.path, { startMs: START, seed: DEFAULT_SEED });
  resumed.advance(acceptance.occurredAt);
  const paused = resumed.semanticSnapshot();
  const promise = paused.arrangements[key];
  assert.equal(promise.status, 'accepted');
  assert.equal(promise.public, false, 'Checkpoint is before the public announcement');
  assert.deepEqual(promise.knowledgeSource, completed.knowledgeSource);
  assert.ok(paused.events.some(event => event.id === promise.knowledgeSource.sourceEventId));
  assert.ok(paused.events.some(event => event.id === promise.knowledgeSource.acquisitionEventId));
  const pending = paused.pendingActions.filter(action => action.arrangementKey === key);
  assert.ok(pending.some(action => action.type === 'ANNOUNCE_ARRANGEMENT'));
  assert.ok(pending.some(action => action.type === 'ACKNOWLEDGE_ARRANGEMENT'));
  assert.ok(pending.some(action => action.dueAt === promise.startAt));
  assert.ok(!JSON.stringify(resumed.publicProjection()).includes(promise.acceptanceEventId),
    'A private acceptance must not become a public event just because it was persisted');
  readsAndDuplicatesArePure(resumed, acceptance.occurredAt);
  resumed.close();

  const processResult = await resumeInNewProcess(t, stores.path, [promise.startAt, END]);
  assert.notEqual(processResult.pid, process.pid);
  assert.equal(processResult.beforeDigest, semanticDigest(paused));
  assert.equal(processResult.afterDigest, semanticDigest(expected));
  assert.ok(processResult.advances[0].result.appendedEvents > 0);
  resumed = stores.open();
  const final = resumed.semanticSnapshot();
  sameHistory(final, expected);
  assert.deepEqual(final.arrangements[key], completed);
  const acknowledgement = final.events.find(event => event.type === 'ACKNOWLEDGE_ARRANGEMENT'
    && event.causedBy.includes(completed.acceptanceEventId)
    && event.causedBy.includes(completed.startedEventId));
  assert.ok(acknowledgement, 'The resumed promise must actually be kept');
  for (const eventId of [completed.knowledgeSource.sourceEventId, completed.knowledgeSource.acquisitionEventId]) {
    assert.ok(acknowledgement.causedBy.includes(eventId), 'The remembered reason must still cause the outcome');
  }
  assert.ok(acknowledgement.changes.some(change => change.entity === 'relationship'),
    'Keeping the promise must retain its relationship consequence');
  readsAndDuplicatesArePure(resumed, END);
});

test('Phase 0: reopening during Streamliner travel retains the journey and exactly one causal arrival', t => {
  const stores = storage(t);
  const uninterrupted = stores.open(':memory:', { startMs: START, seed: DEFAULT_SEED });
  uninterrupted.advance(END);
  const expected = uninterrupted.semanticSnapshot();
  const departure = expected.events.find(event => event.type === 'TRAVEL_DEPART'
    && event.changes.some(change => change.entity === 'character' && change.field === 'journey' && change.after));
  assert.ok(departure, 'The bounded canon fixture must contain committed travel');
  const plannedJourney = departure.changes.find(change => change.id === 'goaden' && change.field === 'journey').after;
  const midway = Math.floor((plannedJourney.departedAt + plannedJourney.arrivesAt) / 2);
  assert.ok(midway > plannedJourney.departedAt && midway < plannedJourney.arrivesAt);

  let resumed = stores.open(stores.path, { startMs: START, seed: DEFAULT_SEED });
  resumed.advance(midway);
  const travelling = resumed.semanticSnapshot();
  for (const character of ['goaden', 'ashai']) {
    assert.equal(travelling.characters[character].location, 'streamliner');
    assert.equal(travelling.characters[character].activity, 'travelling');
    assert.deepEqual(travelling.characters[character].journey, plannedJourney);
  }
  const arrivals = travelling.pendingActions.filter(action => action.type === 'TRAVEL_ARRIVE'
    && action.departureEventId === departure.id);
  assert.equal(arrivals.length, 1, 'The two travellers share one committed arrival follow-up');
  assert.equal(arrivals[0].dueAt, plannedJourney.arrivesAt);
  const publicWhileTravelling = resumed.publicProjection();
  readsAndDuplicatesArePure(resumed, midway);
  resumed.close();

  resumed = stores.open();
  sameHistory(resumed.semanticSnapshot(), travelling);
  assert.deepEqual(resumed.publicProjection(), publicWhileTravelling);
  readsAndDuplicatesArePure(resumed, midway);
  resumed.advance(plannedJourney.arrivesAt);
  const arrived = resumed.semanticSnapshot();
  for (const character of ['goaden', 'ashai']) {
    assert.equal(arrived.characters[character].location, plannedJourney.to);
    assert.equal(arrived.characters[character].journey, null);
  }
  const committedArrivals = arrived.events.filter(event => event.type === 'TRAVEL_ARRIVE'
    && event.causedBy.includes(departure.id));
  assert.equal(committedArrivals.length, 1);
  assert.equal(committedArrivals[0].occurredAt, plannedJourney.arrivesAt);
  assert.equal(committedArrivals[0].location, plannedJourney.to);
  assert.ok(!arrived.pendingActions.some(action => action.id === arrivals[0].id));
  readsAndDuplicatesArePure(resumed, plannedJourney.arrivesAt);
  resumed.advance(END);
  sameHistory(resumed.semanticSnapshot(), expected);
  readsAndDuplicatesArePure(resumed, END);
});
