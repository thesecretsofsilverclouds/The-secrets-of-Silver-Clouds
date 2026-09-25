import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createFixture, RULES_VERSION, assertCanonState } from './fixture.mjs';
import { backupWorld } from './world-operations.mjs';
import { fixtureIdentity, matchesRulesIdentity } from './world-identity.mjs';
import { londonDate } from './time.mjs';
import { assertProspectiveActivation, NARRATIVE_ACTIVATION, RHYTHM_ACTIVATION } from './prospective-activation.mjs';

const FROM = RHYTHM_ACTIVATION.from, TO = RHYTHM_ACTIVATION.to;
const events = db => db.prepare('SELECT * FROM events ORDER BY seq').all();
const pending = db => db.prepare('SELECT * FROM scheduled_actions ORDER BY id').all();
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

// Run explicitly on a stopped, copied pinned v29 world. No old action is
// rescheduled, no history is folded into habit, and no field exists early.
export function upgradeRhythm({ directory, backupPath } = {}) {
  if (typeof directory !== 'string' || !directory.trim() || RULES_VERSION !== TO)
    throw new Error('A pinned v29 directory and v30 code are required');
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
    assertCanonState(state);
    const queue = pending(db), activationContext = { state, pending: queue, resolvedThrough: before.resolved_through };
    assertProspectiveActivation({ ...activationContext, ...NARRATIVE_ACTIVATION });
    if (matchesRulesIdentity(before.rules_version, fixture, TO)) {
      if (![FROM, TO].includes(manifest.rulesVersion)) throw new Error('Invalid rhythm manifest');
      const receipt = assertProspectiveActivation({ ...activationContext, ...RHYTHM_ACTIVATION });
      if (!receipt) throw new Error('Missing rhythm upgrade receipt');
      saveManifest();
      return { status: 'already_upgraded', rulesVersion: TO, cutoverAt: receipt.cutoverAt, activationActionId: receipt.activationActionId };
    }
    if (manifest.rulesVersion !== FROM || !matchesRulesIdentity(before.rules_version, fixture, FROM)
      || Object.hasOwn(state, 'rhythm') || state.meta.upgrades?.some(item => item.to === TO))
      throw new Error('Only an unmodified v29 save can be upgraded');
    const cutoverAt = before.resolved_through;
    if (!Number.isSafeInteger(cutoverAt) || cutoverAt < fixture.startMs || cutoverAt + 1 >= fixture.endMs)
      throw new Error('Invalid release cutover');
    if (typeof backupPath !== 'string' || !backupPath.trim()) throw new Error('A new backup path is required');
    if (queue.some(row => row.due_at <= cutoverAt || row.id.startsWith('rhythm-v30/activate/')
      || JSON.parse(row.action_json).type === 'WORLD_RHYTHM_ACTIVATE')) throw new Error('Pending queue is not a valid cutover');
    const oldEvents = digest(events(db));
    const action = { id: `rhythm-v30/activate/${cutoverAt}`, type: 'WORLD_RHYTHM_ACTIVATE',
      dueAt: cutoverAt + 1, day: londonDate(cutoverAt + 1), priority: -1 };
    const backup = backupWorld({ db }, backupPath);
    db.exec('BEGIN IMMEDIATE');
    try {
      if (JSON.stringify(db.prepare('SELECT * FROM world_state WHERE id=1').get()) !== JSON.stringify(before)
        || digest(events(db)) !== oldEvents || JSON.stringify(pending(db)) !== JSON.stringify(queue))
        throw new Error('World changed during backup; stop its writer before upgrading');
      state.meta.upgrades = [...(state.meta.upgrades ?? []), { from: FROM, to: TO, cutoverAt,
        activationActionId: action.id, historicalLedgerDigest: oldEvents, backupPath: resolve(backupPath), backupSha256: backup.sha256 }];
      db.prepare('INSERT INTO scheduled_actions(id,due_at,priority,action_json) VALUES(?,?,?,?)')
        .run(action.id, action.dueAt, action.priority, JSON.stringify(action));
      db.prepare('UPDATE world_state SET rules_version=?,state_json=? WHERE id=1')
        .run(fixtureIdentity(fixture, TO), JSON.stringify(state));
      assertProspectiveActivation({ state, pending: pending(db), resolvedThrough: cutoverAt, ...RHYTHM_ACTIVATION });
      if (digest(events(db)) !== oldEvents || JSON.stringify(pending(db).filter(row => row.id !== action.id)) !== JSON.stringify(queue))
        throw new Error('Historical events or existing queue changed');
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    saveManifest();
    return { status: 'upgraded', from: FROM, rulesVersion: TO, cutoverAt, activationActionId: action.id,
      backupPath: resolve(backupPath), backup, historicalLedgerDigest: oldEvents, pendingBefore: queue.length };
  } finally { db.close(); }
  function saveManifest() {
    const temporary = `${manifestPath}.v30.tmp`;
    writeFileSync(temporary, JSON.stringify({ ...manifest, rulesVersion: TO }, null, 2) + '\n');
    renameSync(temporary, manifestPath);
  }
}
