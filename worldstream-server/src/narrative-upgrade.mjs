import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createFixture, RULES_VERSION, assertCanonState } from './fixture.mjs';
import { backupWorld } from './world-operations.mjs';
import { fixtureIdentity, matchesRulesIdentity } from './world-identity.mjs';
import { londonDate } from './time.mjs';

const FROM = 'canon-ambient-p183-v28', TO = 'canon-ambient-p183-v29';
const events = db => db.prepare('SELECT * FROM events ORDER BY seq').all();
const pending = db => db.prepare('SELECT * FROM scheduled_actions ORDER BY id').all();
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

// Explicit offline operation, also usable on an exported Durable Object SQLite
// with a pinned manifest. No new field or behaviour before the owned activation.
export function upgradeNarrativeSystems({ directory, backupPath } = {}) {
  if (!directory || ![TO, 'canon-ambient-p183-v30'].includes(RULES_VERSION)) throw new Error('A pinned v28 directory and v29 or v30 code are required');
  directory = resolve(directory);
  const manifestPath = join(directory, 'active-world.json'), dbPath = join(directory, 'world.sqlite');
  if (!existsSync(manifestPath) || !existsSync(dbPath)) throw new Error('Existing pinned world required');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.format !== 1 || manifest.database !== 'world.sqlite') throw new Error('Unknown world manifest');
  const db = new DatabaseSync(dbPath);
  try {
    const before = db.prepare('SELECT * FROM world_state WHERE id=1').get();
    if (!before) throw new Error('Missing world');
    const state = JSON.parse(before.state_json), fixture = createFixture({ startMs: state.meta?.startMs });
    const receipts = state.meta.upgrades?.filter(r => r.to === TO) ?? [], receipt = receipts[0];
    if (matchesRulesIdentity(before.rules_version, fixture, TO)) {
      if (![FROM, TO].includes(manifest.rulesVersion) || receipts.length !== 1 || receipt?.from !== FROM
        || !Number.isSafeInteger(receipt.cutoverAt) || receipt.cutoverAt < fixture.startMs || receipt.cutoverAt > before.resolved_through
        || receipt.activationActionId !== `narrative-v29/activate/${receipt.cutoverAt}`)
        throw new Error('Missing valid narrative upgrade receipt');
      assertCanonState(state);
      const activation = pending(db).filter(row => row.id === receipt.activationActionId);
      if (receipt.activatedAt ? !state.narrativeSignals || activation.length : state.narrativeSignals || activation.length !== 1)
        throw new Error('Narrative activation receipt/state mismatch');
      saveManifest();
      return { status: 'already_upgraded', rulesVersion: TO, cutoverAt: receipt.cutoverAt };
    }
    if (manifest.rulesVersion !== FROM || !matchesRulesIdentity(before.rules_version, fixture, FROM)
      || receipt || state.narrativeSignals) throw new Error('Only an unmodified v28 save can be upgraded');
    assertCanonState(state);
    const cutoverAt = before.resolved_through;
    if (!Number.isSafeInteger(cutoverAt) || cutoverAt < fixture.startMs || cutoverAt + 1 >= fixture.endMs)
      throw new Error('Invalid release cutover');
    if (!backupPath) throw new Error('A new backup path is required');
    const oldEvents = digest(events(db)), oldQueue = pending(db);
    if (oldQueue.some(row => row.due_at <= cutoverAt || JSON.parse(row.action_json).type === 'WORLD_NARRATIVE_ACTIVATE'))
      throw new Error('Pending queue is not a valid cutover');
    const action = { id: `narrative-v29/activate/${cutoverAt}`, type: 'WORLD_NARRATIVE_ACTIVATE',
      dueAt: cutoverAt + 1, day: londonDate(cutoverAt + 1), priority: -1 };
    const backup = backupWorld({ db }, backupPath);
    db.exec('BEGIN IMMEDIATE');
    try {
      if (JSON.stringify(db.prepare('SELECT * FROM world_state WHERE id=1').get()) !== JSON.stringify(before)
        || digest(events(db)) !== oldEvents || JSON.stringify(pending(db)) !== JSON.stringify(oldQueue))
        throw new Error('World changed during backup; stop its writer before upgrading');
      state.meta.upgrades = [...(state.meta.upgrades ?? []), { from: FROM, to: TO, cutoverAt,
        activationActionId: action.id, historicalLedgerDigest: oldEvents, backupPath: resolve(backupPath), backupSha256: backup.sha256 }];
      db.prepare('INSERT INTO scheduled_actions(id,due_at,priority,action_json) VALUES(?,?,?,?)')
        .run(action.id, action.dueAt, action.priority, JSON.stringify(action));
      db.prepare('UPDATE world_state SET rules_version=?,state_json=? WHERE id=1')
        .run(fixtureIdentity(fixture, TO), JSON.stringify(state));
      if (digest(events(db)) !== oldEvents || JSON.stringify(pending(db).filter(row => row.id !== action.id)) !== JSON.stringify(oldQueue))
        throw new Error('Historical events or existing queue changed');
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    saveManifest();
    return { status: 'upgraded', from: FROM, rulesVersion: TO, cutoverAt, activationActionId: action.id,
      backupPath: resolve(backupPath), backup, historicalLedgerDigest: oldEvents, pendingBefore: oldQueue.length };
  } finally { db.close(); }

  function saveManifest() {
    const path = `${manifestPath}.v29.tmp`;
    writeFileSync(path, JSON.stringify({ ...manifest, rulesVersion: TO }, null, 2) + '\n');
    renameSync(path, manifestPath);
  }
}
