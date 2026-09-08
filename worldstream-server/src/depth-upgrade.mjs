import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createFixture, assertCanonState } from './fixture.mjs';
import { initialOutingRecovery } from './outing-recovery.mjs';
import { initialSupportingStories } from './supporting-stories.mjs';
import { initialNightStories } from './night-stories.mjs';
import { initialOffscreenLives } from './offscreen-lives.mjs';
import { backupWorld } from './world-operations.mjs';
import { londonDate } from './time.mjs';

const FROM = 'canon-ambient-p183-v21', TO = 'canon-ambient-p183-v22';
const identity = (fixture, version) => `fixture:${JSON.stringify([fixture.worldId, version,
  fixture.startMs, fixture.endMs, fixture.maxActions])}`;
const digest = rows => createHash('sha256').update(JSON.stringify(rows)).digest('hex');
const ledger = db => db.prepare('SELECT seq,id,occurred_at,semantic_json,recorded_at FROM events ORDER BY seq').all();

// This historical migration still stops at v22. Supply the later validator's
// empty field on a clone only; it must never become part of the v22 save.
function assertV22State(state) {
  if (Object.hasOwn(state, 'offscreenLives')) throw new Error('Unexpected later-release offscreenLives state');
  assertCanonState({ ...structuredClone(state), offscreenLives: initialOffscreenLives() });
}

// Explicit offline upgrade only. Starting the web service still fails closed on
// incompatible releases. No completed event, memory, seed or clock is rewritten.
export function upgradeWorldDepth({ directory, backupPath } = {}) {
  directory = resolve(directory);
  const manifestPath = join(directory, 'active-world.json'), databasePath = join(directory, 'world.sqlite');
  if (!existsSync(manifestPath) || !existsSync(databasePath)) throw new Error('An existing pinned world is required');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.format !== 1 || manifest.database !== 'world.sqlite') throw new Error('Unknown world manifest');
  const db = new DatabaseSync(databasePath);
  try {
    const before = db.prepare('SELECT * FROM world_state WHERE id=1').get();
    if (!before) throw new Error('World state is missing');
    const state = JSON.parse(before.state_json), fixture = createFixture({ startMs: state.meta.startMs });
    if (before.rules_version === identity(fixture, TO)) {
      // Repair the narrow crash window between SQLite commit and manifest rename.
      if (![FROM, TO].includes(manifest.rulesVersion)
        || !state.meta?.upgrades?.some(item => item.from === FROM && item.to === TO))
        throw new Error('No matching committed upgrade receipt');
      assertV22State(state);
      if (manifest.rulesVersion !== TO) saveManifest();
      return { status: 'already_upgraded', rulesVersion: TO };
    }
    if (manifest.rulesVersion !== FROM || before.rules_version !== identity(fixture, FROM))
      throw new Error('Only the pinned v21 release can be upgraded');
    for (const key of ['outingRecovery', 'supportingStories', 'nightStories', 'offscreenLives'])
      if (Object.hasOwn(state, key)) throw new Error(`Unexpected prior ${key} state`);
    if (!backupPath) throw new Error('Choose a new backup path before upgrading');
    const historyBefore = digest(ledger(db));
    const backup = backupWorld({ db }, backupPath);
    db.exec('BEGIN IMMEDIATE');
    let report;
    try {
      const locked = db.prepare('SELECT * FROM world_state WHERE id=1').get();
      if (JSON.stringify(locked) !== JSON.stringify(before) || digest(ledger(db)) !== historyBefore)
        throw new Error('The world changed during backup; stop its server before upgrading');
      state.outingRecovery = initialOutingRecovery();
      state.supportingStories = initialSupportingStories();
      state.nightStories = initialNightStories();
      const cutoverAt = before.resolved_through;
      state.meta.upgrades = [...(state.meta.upgrades ?? []), { from: FROM, to: TO, cutoverAt }];
      assertV22State(state);
      // New commitments begin after this release boundary. Missed historical
      // slots are never replayed and old pending activity/completion IDs survive.
      const action = { id: `depth-v22/activate/${cutoverAt}`, type: 'WORLD_DEPTH_ACTIVATE',
        day: londonDate(cutoverAt + 1), dueAt: cutoverAt + 1, priority: 1 };
      db.prepare('INSERT INTO scheduled_actions(id,due_at,priority,action_json) VALUES(?,?,?,?)')
        .run(action.id, action.dueAt, action.priority, JSON.stringify(action));
      const pending = db.prepare('SELECT id,action_json FROM scheduled_actions ORDER BY id').all()
        .map(row => JSON.parse(row.action_json));
      const repairedProposals = [];
      for (const meeting of pending.filter(a => a.type === 'CROSS_PATHS' && /-meeting$/.test(a.id))) {
        const stem = meeting.id.slice(0, -'-meeting'.length);
        const departure = pending.find(a => a.id === `${stem}-outbound` && a.type === 'TRAVEL_DEPART' && a.from === 'mi6');
        const activity = pending.find(a => a.id === `${stem}-activity` && a.type === 'CITY_ACTIVITY_BEGIN');
        if (!departure || !activity || meeting.outingRecovery) continue;
        const updated = { ...meeting, outingRecovery: { arrangementKey: departure.arrangementKey,
          kind: activity.kind, venue: departure.to, departureAt: departure.dueAt,
          travelMinutes: departure.duration, duration: 90 } };
        db.prepare('UPDATE scheduled_actions SET action_json=? WHERE id=?').run(JSON.stringify(updated), meeting.id);
        repairedProposals.push(meeting.id);
      }
      db.prepare('UPDATE world_state SET rules_version=?,state_json=? WHERE id=1')
        .run(identity(fixture, TO), JSON.stringify(state));
      if (digest(ledger(db)) !== historyBefore) throw new Error('Historical ledger changed during upgrade');
      report = { status: 'upgraded', from: FROM, rulesVersion: TO, cutoverAt,
        backupPath: resolve(backupPath), backup, historicalLedgerDigest: historyBefore,
        historicalEvents: backup.events, pendingBefore: backup.pending, repairedProposals,
        activationActionId: action.id };
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    saveManifest();
    return report;
  } finally { db.close(); }

  function saveManifest() {
    const temporary = `${manifestPath}.v22.tmp`;
    writeFileSync(temporary, JSON.stringify({ ...manifest, rulesVersion: TO }, null, 2) + '\n');
    renameSync(temporary, manifestPath);
  }
}
