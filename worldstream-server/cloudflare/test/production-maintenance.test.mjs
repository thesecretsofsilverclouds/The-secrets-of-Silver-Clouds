import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { openFeedbackStore } from '../../src/feedback-store.mjs';
import {
  createMaintenanceController, MaintenanceDurableObject, MAINTENANCE_CONTROL_KEY,
  MAINTENANCE_IMPORT_KEY, encodeMaintenanceValue, decodeMaintenanceValue,
} from '../src/production-maintenance.mjs';

const TOKEN = 'test-maintenance-token-not-a-production-secret';
const digest = text => createHash('sha256').update(text).digest('hex');
const ENV = { WORLD_OPS_TOKEN_SHA256: digest(TOKEN), WORLD_WRITER_PAUSED: 'true' };
const EXPECTED = { seed: 'preserved-seed', rulesVersion: 'canon-ambient-p183-v29', resolvedThrough: 1788656400000 };

function setup(t, { existing = false, env = {}, bookmark = true } = {}) {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close());
  const writes = [], kv = new Map(); let alarm = 1788656460000;
  const storage = {
    sql: { exec(sql, ...bindings) {
      const statement = db.prepare(sql);
      const values = bindings.map(v => v instanceof ArrayBuffer ? new Uint8Array(v) : v);
      const result = /^\s*(SELECT|PRAGMA)/i.test(sql) ? statement.all(...values) : (statement.run(...values), []);
      return { toArray: () => result, *[Symbol.iterator]() { yield* result; } };
    } },
    async get(key) { return structuredClone(kv.get(key)); },
    async put(key, value) { writes.push(['put', key]); kv.set(key, structuredClone(value)); },
    async list(options = {}) { return new Map([...kv].sort(([a], [b]) => a.localeCompare(b)).slice(0, options.limit)); },
    async getAlarm() { return alarm; },
    async deleteAlarm() { writes.push(['deleteAlarm']); alarm = null; },
    transactionSync(fn) { db.exec('BEGIN'); try { const out = fn(); db.exec('COMMIT'); return out; } catch (error) { db.exec('ROLLBACK'); throw error; } },
    ...(bookmark ? { async getCurrentBookmark() { writes.push(['bookmark']); return 'bookmark-before-maintenance'; } } : {}),
  };
  if (existing) {
    db.exec('CREATE TABLE world_state(id INTEGER PRIMARY KEY,seed TEXT NOT NULL,rules_version TEXT NOT NULL,resolved_through INTEGER NOT NULL,state_json TEXT NOT NULL)');
    db.prepare('INSERT INTO world_state VALUES (1,?,?,?,?)').run(EXPECTED.seed, EXPECTED.rulesVersion, EXPECTED.resolvedThrough, '{"preserved":true}');
    db.exec('CREATE TABLE events(seq INTEGER PRIMARY KEY,kind TEXT,payload BLOB); CREATE TABLE audit(seq INTEGER PRIMARY KEY,event_seq INTEGER); CREATE INDEX event_kind ON events(kind); CREATE VIEW public_events AS SELECT seq,kind FROM events; CREATE TRIGGER record_event AFTER INSERT ON events BEGIN INSERT INTO audit(event_seq) VALUES(new.seq); END; CREATE TABLE _cf_internal(ignored TEXT)');
    db.prepare('INSERT INTO events(seq,kind,payload) VALUES (?,?,?)').run(7, 'SOURCE', Buffer.from([0, 255, 9]));
    db.prepare('INSERT INTO events(seq,kind,payload) VALUES (?,?,?)').run(21, null, null);
    kv.set('existing-bookmark', { nested: ['preserved', new Uint8Array([1, 2])], literal: { $type: 'bytes', base64: 'not-a-tag' } });
  }
  const ctx = { storage }, configured = { ...ENV, ...env };
  const control = createMaintenanceController(ctx, configured);
  const request = (path, value, { token = TOKEN, method = value === undefined ? 'GET' : 'POST' } = {}) => new Request(`https://maintenance.test${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(value === undefined ? {} : { body: JSON.stringify(value) }),
  });
  const call = async (path, value, options) => { const result = await control.handle(request(path, value, options));
    return result ? { status: result.status, body: await result.json() } : null; };
  return { db, storage, ctx, configured, control, writes, kv, request, call };
}

async function exportCopy(source) {
  assert.equal((await source.call('/__ops/pause', {})).status, 200);
  const schema = (await source.call('/__ops/export/schema')).body;
  const kv = (await source.call('/__ops/export/kv')).body.kv;
  const tableFingerprints = {}, data = {};
  for (const table of schema.tables) {
    const page = (await source.call(`/__ops/export/table?name=${encodeURIComponent(table.name)}&offset=0&limit=128`)).body;
    assert.equal(page.done, true);
    data[table.name] = page.rows;
    tableFingerprints[table.name] = { rowCount: page.rows.length, sha256: digest(page.rows.map(row => JSON.stringify(row) + '\n').join('')) };
  }
  return { schema: schema.schema, kv, expected: EXPECTED, tableFingerprints, data };
}
async function importCopy(target, copy) {
  assert.equal((await target.call('/__ops/import/start', copy)).status, 200);
  for (const [table, data] of Object.entries(copy.data)) if (data.length)
    assert.equal((await target.call('/__ops/import/rows', { table, offset: 0, rows: data })).status, 200);
  return target.call('/__ops/import/finish', {});
}

test('construction/status never initialize a runtime or SQL tables; auth fails before mutation', async t => {
  const h = setup(t);
  const controllerOnly = new MaintenanceDurableObject(h.ctx, h.configured);
  assert.equal((await controllerOnly.fetch(h.request('/api/observe'))).status, 503);
  assert.deepEqual(h.writes, []);
  assert.equal((await h.call('/__ops/status')).body.userTables, 0);
  assert.deepEqual(h.writes, []);
  assert.equal((await h.call('/__ops/pause', {}, { token: 'incorrect' })).status, 401);
  assert.equal((await h.call('/__ops/pause', {}, { method: 'GET' }).catch(() => ({ status: 405 }))).status, 405);
  assert.deepEqual(h.writes, []);
  const misconfigured = createMaintenanceController(h.ctx, { WORLD_OPS_TOKEN_SHA256: TOKEN });
  assert.equal((await misconfigured.handle(h.request('/__ops/pause', {}))).status, 401);
});

test('pause records pre-ops KV, original alarm and PITR bookmark before deleting the alarm, and survives restart', async t => {
  const h = setup(t, { existing: true });
  const original = h.db.prepare('SELECT * FROM world_state').get();
  const paused = await h.call('/__ops/pause', {});
  assert.equal(paused.status, 200);
  assert.equal(paused.body.originalAlarm, 1788656460000);
  assert.deepEqual(h.writes.slice(0, 3), [['bookmark'], ['put', MAINTENANCE_CONTROL_KEY], ['deleteAlarm']]);
  const snapshot = (await h.call('/__ops/export/kv')).body.kv;
  assert.deepEqual(decodeMaintenanceValue(snapshot[0].value), decodeMaintenanceValue(encodeMaintenanceValue(h.kv.get('existing-bookmark'))));
  h.kv.set('later-key', 'not part of pre-ops snapshot');
  await h.call('/__ops/pause', {});
  assert.deepEqual((await h.call('/__ops/export/kv')).body.kv, snapshot);
  assert.deepEqual(h.db.prepare('SELECT * FROM world_state').get(), original);
  assert.equal(await createMaintenanceController(h.ctx, { ...ENV, WORLD_WRITER_PAUSED: 'false' }).isPaused(), true);
});

test('missing PITR support fails closed before any pause mutation', async t => {
  const h = setup(t, { bookmark: false });
  assert.equal((await h.call('/__ops/pause', {})).status, 503);
  assert.deepEqual(h.writes, []);
  assert.equal(await h.storage.getAlarm(), 1788656460000);
});

test('current storage exports fresh identity, bookmark and complete KV without changing stale recovery receipts', async t => {
  const source = setup(t, { existing: true }), h = setup(t, { env: { WORLD_OPS_ALLOW_RESUME: 'true' } });
  const copy = await exportCopy(source);
  assert.equal((await importCopy(h, copy)).status, 200);
  assert.equal((await h.call('/__ops/resume', { smokeValidated: true, expected: EXPECTED, tableFingerprints: copy.tableFingerprints })).status, 200);
  const currentIdentity = { ...EXPECTED, resolvedThrough: EXPECTED.resolvedThrough + 60000 };
  h.db.prepare('UPDATE world_state SET resolved_through=?').run(currentIdentity.resolvedThrough);
  h.kv.set('existing-bookmark', { updated: true, bytes: new Uint8Array([8, 9]) });
  h.kv.set('later-key', new Map([['preserved', new Set([1, 2])]]));
  assert.equal((await h.call('/__ops/pause', {})).status, 200);
  h.storage.getCurrentBookmark = async () => 'bookmark-current-live-world';
  const historicalKv = (await h.call('/__ops/export/kv')).body;
  const kvBefore = JSON.stringify(encodeMaintenanceValue(await h.storage.list()));
  const sqlBefore = h.db.prepare('SELECT * FROM world_state').all();
  const writesBefore = structuredClone(h.writes);
  const result = await h.call('/__ops/export/current-storage');
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.format, 1);
  assert.equal(result.body.bookmark, 'bookmark-current-live-world');
  assert.equal(result.body.currentAlarm, null);
  assert.deepEqual(result.body.identity, currentIdentity);
  const decodedAll = new Map(result.body.allKv.map(({ key, value }) => [key, decodeMaintenanceValue(value)]));
  assert.deepEqual(encodeMaintenanceValue(decodedAll), encodeMaintenanceValue(await h.storage.list()));
  assert.deepEqual(result.body.userKv.map(({ key }) => key), ['existing-bookmark', 'later-key']);
  assert.deepEqual(decodeMaintenanceValue(result.body.userKv[1].value), h.kv.get('later-key'));
  assert.ok(decodedAll.has(MAINTENANCE_CONTROL_KEY));
  assert.ok(decodedAll.has(MAINTENANCE_IMPORT_KEY));
  assert.equal(decodedAll.get(MAINTENANCE_CONTROL_KEY).bookmark, 'bookmark-before-maintenance');
  assert.deepEqual(decodedAll.get(MAINTENANCE_IMPORT_KEY).expected, EXPECTED);
  assert.deepEqual((await h.call('/__ops/export/kv')).body, historicalKv, 'historical export remains unchanged');
  assert.equal(JSON.stringify(encodeMaintenanceValue(await h.storage.list())), kvBefore);
  assert.deepEqual(h.db.prepare('SELECT * FROM world_state').all(), sqlBefore);
  assert.deepEqual(h.writes, writesBefore, 'current export performs no storage mutation');
  assert.equal((await h.call('/__ops/resume', { smokeValidated: true, expected: currentIdentity, tableFingerprints: copy.tableFingerprints })).status, 409,
    'read-only export must not refresh the old import confirmation or enable resume');
});

test('current storage requires authentication, GET, a pause checkpoint, paused writer and no alarm', async t => {
  const h = setup(t, { existing: true });
  const path = '/__ops/export/current-storage';
  assert.equal((await h.call(path, undefined, { token: 'incorrect' })).status, 401);
  assert.equal((await h.call(path, {})).status, 405);
  assert.equal((await h.call(path)).status, 409, 'environment pause alone has no recovery checkpoint');
  assert.deepEqual(h.writes, []);
  assert.equal((await h.call('/__ops/pause', {})).status, 200);
  const writesBefore = structuredClone(h.writes);
  h.kv.get(MAINTENANCE_CONTROL_KEY).paused = false;
  assert.equal((await h.call(path)).status, 409);
  h.kv.get(MAINTENANCE_CONTROL_KEY).paused = true;
  h.storage.getAlarm = async () => 1788656460000;
  assert.equal((await h.call(path)).status, 409);
  assert.deepEqual(h.writes, writesBefore, 'rejected reads never delete an alarm or change recovery records');
  h.storage.getAlarm = async () => null;
  delete h.storage.getCurrentBookmark;
  assert.equal((await h.call(path)).status, 503);
  h.storage.getCurrentBookmark = async () => '';
  assert.equal((await h.call(path)).status, 503);
  assert.deepEqual(h.writes, writesBefore);
});

test('current storage fails closed if an alarm appears during its read', async t => {
  const h = setup(t, { existing: true });
  await h.call('/__ops/pause', {});
  const writesBefore = structuredClone(h.writes);
  h.storage.getCurrentBookmark = async () => {
    h.storage.getAlarm = async () => 1788656460000;
    return 'bookmark-with-concurrent-alarm';
  };
  const result = await h.call('/__ops/export/current-storage');
  assert.equal(result.status, 409);
  assert.match(result.body.error, /alarm changed/);
  assert.deepEqual(h.writes, writesBefore);
});

test('current storage bounds both KV entry reads and the complete encoded response', async t => {
  const h = setup(t);
  await h.call('/__ops/pause', {});
  h.storage.getCurrentBookmark = async () => 'current-bounded-bookmark';
  const writesBefore = structuredClone(h.writes);
  h.kv.set('large-user-value', 'x'.repeat(600 * 1024));
  const tooLarge = await h.call('/__ops/export/current-storage');
  assert.equal(tooLarge.status, 413, 'duplicated userKv plus allKv count toward the complete response limit');
  assert.match(tooLarge.body.error, /snapshot exceeds/);
  h.kv.delete('large-user-value');
  for (let i = 0; i < 256; i++) h.kv.set(`key-${i}`, i);
  const originalList = h.storage.list;
  let listedLimit;
  h.storage.list = async options => { listedLimit = options?.limit; return originalList(options); };
  const tooMany = await h.call('/__ops/export/current-storage');
  assert.equal(tooMany.status, 413);
  assert.match(tooMany.body.error, /entry count exceeds/);
  assert.equal(listedLimit, 257, 'one extra entry detects overflow without an unbounded list');
  assert.deepEqual(h.writes, writesBefore);
});

test('complete export preserves tables, indexes, triggers, views, blobs and deterministic primary-key ordering', async t => {
  const h = setup(t, { existing: true });
  const copy = await exportCopy(h);
  assert.ok(copy.schema.some(e => e.type === 'index' && e.name === 'event_kind'));
  assert.ok(copy.schema.some(e => e.type === 'trigger' && e.name === 'record_event'));
  assert.ok(copy.schema.some(e => e.type === 'view' && e.name === 'public_events'));
  assert.equal(copy.schema.some(e => e.name.startsWith('_cf_')), false);
  assert.deepEqual(copy.data.events.map(row => row[0]), [7, 21]);
  assert.deepEqual(copy.data.events[0][2], { $type: 'bytes', base64: 'AP8J' });
  assert.equal((await h.call('/__ops/export/table?name=events&limit=129')).status, 400);
  assert.equal((await h.call('/__ops/export/table?name=events%22%3BDELETE%20FROM%20world_state')).status, 404);
  assert.equal(h.db.prepare('SELECT count(*) n FROM world_state').get().n, 1);
});

test('empty-target import verifies every table and KV, keeps triggers inert until copied rows exist, and resumes only explicitly', async t => {
  const source = setup(t, { existing: true }), target = setup(t, { env: { WORLD_OPS_ALLOW_RESUME: 'true' } });
  const copy = await exportCopy(source), finished = await importCopy(target, copy);
  assert.equal(finished.status, 200, JSON.stringify(finished.body));
  assert.equal(finished.body.status, 'verified');
  assert.deepEqual(finished.body.identity, EXPECTED);
  assert.equal(target.db.prepare('SELECT count(*) n FROM audit').get().n, 2, 'row loading must not fire copied triggers');
  assert.equal(await target.control.isPaused(), true);
  assert.equal((await target.call('/__ops/resume', { expected: EXPECTED, tableFingerprints: copy.tableFingerprints })).status, 409);
  assert.equal((await target.call('/__ops/resume', { expected: EXPECTED, tableFingerprints: copy.tableFingerprints, smokeValidated: true })).status, 200);
  assert.equal(await createMaintenanceController(target.ctx, ENV).isPaused(), false, 'explicit stored resume wins default env pause');
  assert.equal((await target.call('/__ops/import/start', copy)).status, 409, 'imports cannot be repeated');
});

test('original populated targets and deployments without resume permission cannot overwrite or resume', async t => {
  const source = setup(t, { existing: true }), copy = await exportCopy(source);
  const existing = setup(t, { existing: true });
  assert.equal((await existing.call('/__ops/import/start', copy)).status, 409);
  assert.deepEqual(existing.writes, []);
  const target = setup(t);
  assert.equal((await importCopy(target, copy)).status, 200);
  assert.equal((await target.call('/__ops/resume', { expected: EXPECTED, tableFingerprints: copy.tableFingerprints, smokeValidated: true })).status, 409);
  assert.equal(await target.control.isPaused(), true);
});

test('bad chunks roll back atomically; wrong fingerprints and wrong identity leave import paused', async t => {
  const source = setup(t, { existing: true }), copy = await exportCopy(source), target = setup(t);
  assert.equal((await target.call('/__ops/import/start', copy)).status, 200);
  const duplicate = [copy.data.events[0], copy.data.events[0]];
  assert.equal((await target.call('/__ops/import/rows', { table: 'events', offset: 0, rows: duplicate })).status, 500);
  assert.equal(target.db.prepare('SELECT count(*) n FROM events').get().n, 0);
  assert.equal((await target.call('/__ops/import/rows', { table: 'events', offset: 1, rows: [copy.data.events[0]] })).status, 409);
  assert.equal((await target.call('/__ops/import/finish', {})).status, 409);
  for (const [table, data] of Object.entries(copy.data)) if (data.length)
    assert.equal((await target.call('/__ops/import/rows', { table, offset: 0, rows: data })).status, 200);
  target.db.prepare('UPDATE events SET kind=? WHERE seq=7').run('tampered');
  const mismatch = await target.call('/__ops/import/finish', {});
  assert.equal(mismatch.status, 409);
  assert.match(mismatch.body.error, /Fingerprint mismatch/);
  assert.equal(await target.control.isPaused(), true);
  assert.equal((await target.control.status()).importStatus, 'loading');
});

test('schema import rejects appended destructive SQL and ordinary callers cannot reach an arbitrary SQL endpoint', async t => {
  const source = setup(t, { existing: true }), copy = await exportCopy(source), target = setup(t);
  copy.schema[0].sql += '; DROP TABLE world_state';
  assert.equal((await target.call('/__ops/import/start', copy)).status, 400);
  assert.deepEqual(target.writes, []);
  assert.equal(await target.call('/__ops/sql', { sql: 'CREATE TABLE forged(x)' }), null);
  assert.equal((await target.control.status()).userTables, 0);
  assert.equal(target.kv.has(MAINTENANCE_IMPORT_KEY), false);
});

test('actual feedback schema imports foreign-key clauses and populated tables in parent-before-child order', async t => {
  const source = setup(t, { existing: true }), target = setup(t);
  source.db.exec('PRAGMA foreign_keys=ON');
  target.db.exec('PRAGMA foreign_keys=ON');
  openFeedbackStore({ db: source.db, runInTransaction: fn => source.storage.transactionSync(fn) });
  const pollId = source.db.prepare('SELECT poll_id FROM feedback_catalog').get().poll_id;
  source.db.prepare('INSERT INTO feedback_ballots VALUES (?,?,?,?,?,?,?)').run(pollId, 'preserved-voter', '{}', 10, 10, 10, 1);
  source.db.prepare('INSERT INTO feedback_answers VALUES (?,?,?,?)').run(pollId, 'preserved-voter', 'character', 'yukon');
  const copy = await exportCopy(source);
  assert.match(copy.schema.find(row => row.name === 'feedback_answers').sql, /ON DELETE CASCADE/);
  const started = await target.call('/__ops/import/start', copy);
  assert.equal(started.status, 200, JSON.stringify(started.body));
  const order = ['feedback_catalog', 'feedback_ballots', 'feedback_answers',
    ...Object.keys(copy.data).filter(name => !['feedback_catalog', 'feedback_ballots', 'feedback_answers'].includes(name))];
  for (const table of order) if (copy.data[table].length) {
    const inserted = await target.call('/__ops/import/rows', { table, offset: 0, rows: copy.data[table] });
    assert.equal(inserted.status, 200, JSON.stringify(inserted.body));
  }
  const finished = await target.call('/__ops/import/finish', {});
  assert.equal(finished.status, 200, JSON.stringify(finished.body));
  assert.deepEqual(target.db.prepare('PRAGMA foreign_key_check').all(), []);
  assert.equal(target.db.prepare('SELECT option_id FROM feedback_answers').get().option_id, 'yukon');
});

test('rowid gaps survive copying and real Cloudflare __cf_kv internal table stays excluded', async t => {
  const source = setup(t, { existing: true }), target = setup(t);
  source.db.exec('CREATE TABLE __cf_kv(key TEXT PRIMARY KEY,value BLOB); CREATE TABLE annotations(note TEXT)');
  source.db.prepare('INSERT INTO annotations(rowid,note) VALUES (?,?)').run(4, 'first');
  source.db.prepare('INSERT INTO annotations(rowid,note) VALUES (?,?)').run(91, 'after a gap');
  const copy = await exportCopy(source);
  assert.equal(copy.schema.some(row => row.name === '__cf_kv'), false);
  assert.deepEqual(copy.data.annotations, [[4, 'first'], [91, 'after a gap']]);
  assert.equal((await importCopy(target, copy)).status, 200);
  assert.deepEqual(target.db.prepare('SELECT rowid,note FROM annotations ORDER BY rowid').all().map(row => [row.rowid, row.note]), copy.data.annotations);
});

test('controlled smoke advancement preserves original receipt and requires current verified fingerprints before resume', async t => {
  const source = setup(t, { existing: true }), target = setup(t, {
    env: { WORLD_OPS_ALLOW_ADVANCE: 'true', WORLD_OPS_ALLOW_RESUME: 'true' },
  });
  const copy = await exportCopy(source);
  assert.equal((await importCopy(target, copy)).status, 200);
  const after = EXPECTED.resolvedThrough + 60000;
  target.db.prepare('INSERT INTO events(seq,kind,payload) VALUES (?,?,?)').run(30, 'LEGITIMATE_NEXT_EVENT', null);
  target.db.prepare('UPDATE world_state SET resolved_through=?').run(after);
  const receipt = await target.control.exclusive(() => target.control.recordSmokeAdvance({ before: EXPECTED.resolvedThrough, after, targetMs: after }));
  const status = await target.control.status();
  assert.deepEqual(status.importExpected, EXPECTED);
  assert.deepEqual(status.expected, { ...EXPECTED, resolvedThrough: after });
  assert.equal(receipt.tableFingerprints.events.rowCount, 3);
  assert.equal(receipt.tableFingerprints.audit.rowCount, 3, 'normal runtime trigger remains active after import');
  const stored = target.kv.get(MAINTENANCE_IMPORT_KEY);
  assert.deepEqual(stored.tableFingerprints, copy.tableFingerprints, 'original copy receipt remains intact');
  assert.equal((await target.call('/__ops/resume', { smokeValidated: true, expected: EXPECTED, tableFingerprints: copy.tableFingerprints })).status, 409);
  assert.equal((await target.call('/__ops/resume', { smokeValidated: true, ...receipt })).status, 200);
});

test('controlled smoke advancement refuses a rewritten event prefix and remains paused', async t => {
  const source = setup(t, { existing: true }), target = setup(t, { env: { WORLD_OPS_ALLOW_ADVANCE: 'true' } });
  const copy = await exportCopy(source);
  assert.equal((await importCopy(target, copy)).status, 200);
  const after = EXPECTED.resolvedThrough + 60000;
  target.db.prepare('UPDATE world_state SET resolved_through=?').run(after);
  target.db.prepare('UPDATE events SET kind=? WHERE seq=7').run('REWRITTEN_HISTORY');
  await assert.rejects(target.control.exclusive(() => target.control.recordSmokeAdvance({ before: EXPECTED.resolvedThrough, after, targetMs: after })), /rewrote preserved event history/);
  assert.equal(await target.control.isPaused(), true);
  assert.equal(target.kv.get(MAINTENANCE_IMPORT_KEY).resumeExpected, undefined);
});
