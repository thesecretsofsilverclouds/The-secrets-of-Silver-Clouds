import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { WorldStore } from '../experiment-l/src/world.mjs';
import { createFixture, eventId, RULES_VERSION } from '../src/fixture.mjs';
import { initialLivingPlacesState } from '../src/living-places.mjs';
import { openPinnedWorld } from '../src/world-operations.mjs';
import { upgradeLivingPlaces } from '../src/living-places-upgrade.mjs';
import { upgradeV28 } from '../src/v28-upgrade.mjs';
import { upgradeRhythm } from '../src/rhythm-upgrade.mjs';
import { upgradeNarrativeSystems } from '../src/narrative-upgrade.mjs';
import { atLondon } from '../src/time.mjs';

const OLD = 'canon-ambient-p183-v26', NEXT = 'canon-ambient-p183-v27';
const day = '2026-09-05', start = atLondon(day, '00:00'), cutover = atLondon(day, '12:00');
const hash = value => createHash('sha256').update(value).digest('hex');
const events = db => db.prepare('SELECT * FROM events ORDER BY seq').all();
const pending = db => db.prepare('SELECT * FROM scheduled_actions ORDER BY id').all();
const stateRow = db => db.prepare('SELECT * FROM world_state WHERE id=1').get();
const manifestPath = f => join(f.directory, 'active-world.json');
const readManifest = f => JSON.parse(readFileSync(manifestPath(f), 'utf8'));
const setManifest = (f, version) => writeFileSync(manifestPath(f), JSON.stringify({
  format: 1, database: 'world.sqlite', rulesVersion: version, note: 'Existing continuity' }));
const snapshot = f => ({ row: stateRow(f.db), events: events(f.db), pending: pending(f.db), manifest: readManifest(f) });

function legacy(t) {
  const directory = mkdtempSync(join(tmpdir(), 'sc-living-places-upgrade-'));
  const dbPath = join(directory, 'world.sqlite'), backupPath = join(directory, 'before-v27.sqlite');
  const current = createFixture({ startMs: start }), initial = current.initialState();
  delete initial.livingPlaces;
  delete initial.narrativeSignals;
  delete initial.rhythm;
  initial.meta.upgrades = [
    { from: 'canon-ambient-p183-v22', to: 'canon-ambient-p183-v23', cutoverAt: start,
      activatedAt: start + 1, activationActionId: `lives-v23/activate/${start}` },
    { from: 'canon-ambient-p183-v23', to: 'canon-ambient-p183-v24', cutoverAt: start,
      activatedAt: start + 1, activationActionId: `meu-v24/activate/${start}` },
    { from: 'canon-ambient-p183-v24', to: 'canon-ambient-p183-v25', cutoverAt: start,
      activatedAt: start + 1, activationActionId: `legion-v25/activate/${start}` },
    { from: 'canon-ambient-p183-v25', to: OLD, cutoverAt: start,
      activatedAt: start + 1, activationActionId: `duskkin-v26/activate/${start}` },
  ];
  const fixture = { ...current, rulesVersion: OLD, initialState: () => structuredClone(initial),
    initialActions: () => [
      { id: 'existing-notice', dueAt: start + 1, priority: 0, type: 'INSTITUTION_NOTICE' },
      { id: `${day}/old-quiet`, dueAt: atLondon(day, '15:00'), priority: 40,
        type: 'QUIET_TIME_BEGIN', day, actor: 'goaden', duration: 20 },
    ], reduceAction(state, action, seed) {
      return { event: { id: eventId(seed, action.id), type: action.type, occurredAt: action.dueAt,
        location: 'mi6', participants: [], causedBy: [], payload: {}, changes: [], visibility: 'public',
        publicDescription: 'A previously recorded test notice.' }, followups: [] };
    } };
  const world = new WorldStore({ dbPath, seed: 'living-places-migration-test', fixture });
  world.advance(cutover); world.close();
  const db = new DatabaseSync(dbPath); t.after(() => db.close());
  const f = { directory, dbPath, backupPath, db }; setManifest(f, OLD);
  return f;
}

function liveV26Pinned(t, { days = 3, seed = 'live-living-places-upgrade-copy' } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'sc-living-places-live-'));
  const dbPath = join(directory, 'world.sqlite'), backupPath = join(directory, 'before-v27.sqlite');
  const current = createFixture({ startMs: start }), initial = current.initialState();
  delete initial.livingPlaces;
  delete initial.narrativeSignals;
  delete initial.rhythm;
  initial.meta.upgrades = [
    { from: 'canon-ambient-p183-v22', to: 'canon-ambient-p183-v23', cutoverAt: start,
      activatedAt: start + 1, activationActionId: `lives-v23/activate/${start}` },
    { from: 'canon-ambient-p183-v23', to: 'canon-ambient-p183-v24', cutoverAt: start,
      activatedAt: start + 1, activationActionId: `meu-v24/activate/${start}` },
    { from: 'canon-ambient-p183-v24', to: 'canon-ambient-p183-v25', cutoverAt: start,
      activatedAt: start + 1, activationActionId: `legion-v25/activate/${start}` },
    { from: 'canon-ambient-p183-v25', to: OLD, cutoverAt: start,
      activatedAt: start + 1, activationActionId: `duskkin-v26/activate/${start}` },
  ];
  const fixture = {
    ...current,
    rulesVersion: OLD,
    initialState: () => structuredClone(initial),
    initialActions: () => current.initialActions(),
    reduceAction: (state, action, seedValue) => current.reduceAction(state, action, seedValue),
  };
  const world = new WorldStore({ dbPath, seed, fixture });
  world.advance(start + days * 24 * 3600_000);
  world.close();
  const db = new DatabaseSync(dbPath); t.after(() => db.close());
  const f = { directory, dbPath, backupPath, db, seed }; setManifest(f, OLD);
  return f;
}

test('v26 to v27 preserves old ledger bytes, memories, clock, seed and every existing pending action', t => {
  const f = legacy(t), before = snapshot(f);
  assert.ok([NEXT, 'canon-ambient-p183-v28', 'canon-ambient-p183-v29', 'canon-ambient-p183-v30'].includes(RULES_VERSION));
  assert.throws(() => openPinnedWorld({ directory: f.directory }), /differs/);
  const result = upgradeLivingPlaces(f), after = snapshot(f);
  assert.equal(result.status, 'upgraded'); assert.equal(result.rulesVersion, NEXT);
  assert.equal(result.cutoverAt, cutover); assert.equal(result.historicalEvents, before.events.length);
  assert.deepEqual(after.events, before.events);
  for (const key of ['id', 'seed', 'resolved_through']) assert.equal(after.row[key], before.row[key], key);
  const original = JSON.parse(before.row.state_json), state = JSON.parse(after.row.state_json);
  for (const [key, value] of Object.entries(original)) if (key !== 'meta') assert.deepEqual(state[key], value, key);
  for (const [key, value] of Object.entries(original.meta)) if (key !== 'upgrades') assert.deepEqual(state.meta[key], value, key);
  assert.deepEqual(state.meta.upgrades.slice(0, -1), original.meta.upgrades);
  assert.deepEqual(state.livingPlaces, initialLivingPlacesState());
  assert.equal(after.pending.length, before.pending.length + 1);
  assert.deepEqual(after.pending.filter(row => row.id !== result.activationActionId), before.pending);
  const activation = JSON.parse(after.pending.find(row => row.id === result.activationActionId).action_json);
  assert.deepEqual(activation, { id: `living-places-v27/activate/${cutover}`, type: 'WORLD_LIVING_PLACES_ACTIVATE',
    day, dueAt: cutover + 1, priority: 1 });
});

test('v27 upgrade is idempotent and activation is prospective', t => {
  const f = legacy(t);
  const result = upgradeLivingPlaces(f);
  assert.equal(result.status, 'upgraded');
  const second = upgradeLivingPlaces(f);
  assert.equal(second.status, 'already_upgraded');
  assert.equal(second.rulesVersion, NEXT);
  assert.equal(second.cutoverAt, result.cutoverAt);
  assert.ok(existsSync(result.backupPath));

  if (['canon-ambient-p183-v28', 'canon-ambient-p183-v29', 'canon-ambient-p183-v30'].includes(RULES_VERSION)) {
    assert.throws(() => openPinnedWorld({ directory: f.directory }), /differs/);
    upgradeV28({ directory: f.directory, backupPath: join(f.directory, 'before-v28.sqlite') });
  }
  if (['canon-ambient-p183-v29', 'canon-ambient-p183-v30'].includes(RULES_VERSION)) {
    assert.throws(() => openPinnedWorld({ directory: f.directory }), /differs/);
    upgradeNarrativeSystems({ directory: f.directory, backupPath: join(f.directory, 'before-v29.sqlite') });
  }
  if (RULES_VERSION === 'canon-ambient-p183-v30') {
    assert.throws(() => openPinnedWorld({ directory: f.directory }), /differs/);
    upgradeRhythm({ directory: f.directory, backupPath: join(f.directory, 'before-v30.sqlite') });
  }

  const world = openPinnedWorld({ directory: f.directory });
  world.advance(cutover + 2 * 60 * 60000);
  const snap = world.semanticSnapshot();
  world.close();
  assert.ok(snap.events.some(e => e.type === 'WORLD_LIVING_PLACES_ACTIVATE'), 'Activation action must execute');
  assert.ok(snap.meta.upgrades.some(u => u.to === NEXT && u.activatedAt), 'Upgrade receipt must record activation time');
});

test('copied live v26 world activates v27 prospectively without reseed, backfill, or lost continuity', t => {
  const f = liveV26Pinned(t, { days: 3 });
  const before = snapshot(f);
  const beforeState = JSON.parse(before.row.state_json);
  const history = events(f.db);
  const priorSources = history.map(row => JSON.parse(row.semantic_json))
    .filter(e => e.type === 'INCIDENT' || e.type === 'ARCANE_SURGE').map(e => e.id);
  assert.throws(() => openPinnedWorld({ directory: f.directory }), /differs/);

  const result = upgradeLivingPlaces(f), after = snapshot(f);
  assert.equal(result.status, 'upgraded');
  assert.equal(after.row.seed, before.row.seed);
  assert.equal(after.row.id, before.row.id);
  assert.equal(after.row.resolved_through, before.row.resolved_through);
  assert.deepEqual(after.events, before.events);
  const afterState = JSON.parse(after.row.state_json);
  assert.equal(afterState.meta.startMs, beforeState.meta.startMs);
  assert.deepEqual(afterState.livingPlaces, initialLivingPlacesState());
  assert.equal(after.pending.length, before.pending.length + 1);
  assert.deepEqual(after.pending.filter(row => row.id !== result.activationActionId), before.pending);

  if (['canon-ambient-p183-v28', 'canon-ambient-p183-v29', 'canon-ambient-p183-v30'].includes(RULES_VERSION)) {
    assert.throws(() => openPinnedWorld({ directory: f.directory }), /differs/);
    upgradeV28({ directory: f.directory, backupPath: join(f.directory, 'before-v28.sqlite') });
  }
  if (['canon-ambient-p183-v29', 'canon-ambient-p183-v30'].includes(RULES_VERSION)) {
    assert.throws(() => openPinnedWorld({ directory: f.directory }), /differs/);
    upgradeNarrativeSystems({ directory: f.directory, backupPath: join(f.directory, 'before-v29.sqlite') });
  }
  if (RULES_VERSION === 'canon-ambient-p183-v30') {
    assert.throws(() => openPinnedWorld({ directory: f.directory }), /differs/);
    upgradeRhythm({ directory: f.directory, backupPath: join(f.directory, 'before-v30.sqlite') });
  }

  const world = openPinnedWorld({ directory: f.directory });
  try {
    assert.equal(world.semanticSnapshot().world.rulesVersion, RULES_VERSION);
    world.advance(before.row.resolved_through + 1);
    const activated = world.semanticSnapshot();
    assert.equal(activated.events.filter(e => e.type === 'WORLD_LIVING_PLACES_ACTIVATE').length, 1);
    assert.equal(activated.events.filter(e => e.type.startsWith('SITE_') || e.type.startsWith('ONARI_')).length, 0,
      'activation must not backfill site disturbances from historical incidents');
    world.advance(before.row.resolved_through + 14 * 24 * 3600_000);
    const later = world.semanticSnapshot();
    assert.equal(later.world.seed ?? f.seed, f.seed);
    for (const siteEvent of later.events.filter(e => e.type === 'SITE_IMPACT_REGISTER')) {
      assert.ok(!priorSources.includes(siteEvent.payload.sourceEventId),
        'historical incidents must not become site disturbance sources after upgrade');
    }
  } finally {
    world.close();
  }
});

test('Cloudflare-shaped v26 (bare rules_version) upgrades without losing epoch, seed, watermark or pending', t => {
  const f = legacy(t);
  f.db.prepare('UPDATE world_state SET rules_version=? WHERE id=1').run(OLD);
  const before = snapshot(f);

  const report = upgradeLivingPlaces(f);
  assert.equal(report.status, 'upgraded');
  const after = snapshot(f);
  assert.equal(after.row.seed, before.row.seed);
  assert.equal(after.row.resolved_through, before.row.resolved_through);
  assert.deepEqual(after.events, before.events);
});

test('v27 upgrade does not rewrite existing Living Places state if already present', t => {
  const f = legacy(t);
  const customPlaces = { ...initialLivingPlacesState(), nextNoticeEligibleAt: 999999 };
  const original = JSON.parse(stateRow(f.db).state_json);
  original.livingPlaces = customPlaces;
  f.db.prepare('UPDATE world_state SET state_json=? WHERE id=1').run(JSON.stringify(original));

  const report = upgradeLivingPlaces(f);
  assert.equal(report.status, 'upgraded');
  const afterState = JSON.parse(stateRow(f.db).state_json);
  assert.equal(afterState.livingPlaces.nextNoticeEligibleAt, 999999);
});
