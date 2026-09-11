import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { WorldStore } from '../experiment-l/src/world.mjs';
import { createFixture, eventId, RULES_VERSION } from '../src/fixture.mjs';
import { openPinnedWorld } from '../src/world-operations.mjs';
import { upgradeWorldDepth } from '../src/depth-upgrade.mjs';
import { upgradeOffscreenLives } from '../src/lives-upgrade.mjs';
import { upgradeMeuCases } from '../src/meu-upgrade.mjs';
import { atLondon } from '../src/time.mjs';

const OLD = 'canon-ambient-p183-v21', DEPTH = 'canon-ambient-p183-v22', day = '2026-09-05', start = atLondon(day,'00:00');
// Structural v21 migration fixture: a pre-existing ledger entry and pending
// native activities. It deliberately contains no newly enabled story machinery.
function legacy(t) {
  const directory = mkdtempSync(join(tmpdir(), 'silver-clouds-depth-upgrade-'));
  const dbPath = join(directory, 'world.sqlite'), backupPath = join(directory, 'backup.sqlite');
  const current = createFixture({ startMs:start }), initial = current.initialState();
  for (const key of ['outingRecovery','supportingStories','nightStories','offscreenLives']) delete initial[key];
  const fixture = { ...current, rulesVersion:OLD, initialState:()=>structuredClone(initial),
    initialActions:()=>[
      {id:'old-notice',dueAt:start+1,priority:0,type:'INSTITUTION_NOTICE'},
      {id:`${day}/city-meeting`,dueAt:atLondon(day,'13:20'),priority:40,type:'CROSS_PATHS',day,actors:['goaden','ashai'],area:'common_room'},
      {id:`${day}/city-outbound`,dueAt:atLondon(day,'14:00'),priority:40,type:'TRAVEL_DEPART',day,actors:['goaden','ashai'],from:'mi6',to:'cafe',duration:10,arrangementKey:`${day}:city`},
      {id:`${day}/city-activity`,dueAt:atLondon(day,'14:15'),priority:40,type:'CITY_ACTIVITY_BEGIN',day,actors:['goaden','ashai'],location:'cafe',kind:'cafe_outing',arrangementKey:`${day}:city`},
    ], reduceAction(state, action, seed) { return {event:{id:eventId(seed,action.id),type:action.type,
      occurredAt:action.dueAt,location:'mi6',participants:[],causedBy:[],payload:{},changes:[],
      visibility:'public',publicDescription:'A previously recorded test notice.'},followups:[]}; } };
  const old = new WorldStore({ dbPath, seed:'migration-test', fixture });
  old.advance(atLondon(day,'12:00')); old.close();
  writeFileSync(join(directory,'active-world.json'),JSON.stringify({format:1,database:'world.sqlite',rulesVersion:OLD}));
  const db = new DatabaseSync(dbPath); t.after(()=>db.close());
  return { directory, backupPath, db };
}
const events = db => db.prepare('SELECT * FROM events ORDER BY seq').all();
const stateRow = db => db.prepare('SELECT * FROM world_state WHERE id=1').get();

test('v21 upgrade preserves every old ledger byte, seed, clock, character and pending identity',t=>{
  const f = legacy(t), before = stateRow(f.db), history = events(f.db);
  const pending = f.db.prepare('SELECT * FROM scheduled_actions ORDER BY id').all();
  assert.throws(()=>openPinnedWorld({directory:f.directory}),/differs/);
  const result = upgradeWorldDepth(f);
  assert.equal(result.status,'upgraded'); assert.equal(result.historicalEvents,history.length);
  assert.deepEqual(events(f.db),history); assert.ok(existsSync(f.backupPath));
  const after = stateRow(f.db), state = JSON.parse(after.state_json), original = JSON.parse(before.state_json);
  assert.equal(after.seed,before.seed); assert.equal(after.resolved_through,before.resolved_through);
  for(const [key,value] of Object.entries(original)) if(key!=='meta') assert.deepEqual(state[key],value,key);
  assert.deepEqual(state.meta.canonAnchors,original.meta.canonAnchors);
  for(const row of pending) {
    const updated = f.db.prepare('SELECT * FROM scheduled_actions WHERE id=?').get(row.id);
    assert.equal(updated.due_at,row.due_at); assert.equal(updated.priority,row.priority);
    const action=JSON.parse(updated.action_json), oldAction=JSON.parse(row.action_json);
    for(const [key,value] of Object.entries(oldAction)) assert.deepEqual(action[key],value);
  }
  assert.deepEqual(result.repairedProposals,[`${day}/city-meeting`]);
  assert.equal(result.rulesVersion, DEPTH);
  assert.equal(Object.hasOwn(state, 'offscreenLives'), false, 'historical upgrade must stop at v22');
  assert.equal(upgradeWorldDepth(f).status,'already_upgraded');
  // Opening the current service still requires the separate, backed-up v23
  // release boundary. Both pending activation actions must then remain valid.
  assert.throws(()=>openPinnedWorld({directory:f.directory}),/differs/);
  const v23=upgradeOffscreenLives({directory:f.directory,backupPath:join(f.directory,'before-v23.sqlite')});
  assert.equal(v23.rulesVersion,'canon-ambient-p183-v23');
  assert.throws(()=>openPinnedWorld({directory:f.directory}),/differs/);
  const next=upgradeMeuCases({directory:f.directory,backupPath:join(f.directory,'before-v24.sqlite')});
  assert.equal(next.rulesVersion,RULES_VERSION);
  assert.deepEqual(events(f.db),history);
  const world = openPinnedWorld({directory:f.directory});
  const continuity = world.publicProjection().continuityId;
  world.advance(before.resolved_through+1);
  assert.equal(world.semanticSnapshot().events.length,history.length+3);
  assert.equal(world.publicProjection().continuityId,continuity);
  assert.ok(world.semanticSnapshot().pendingActions.every(a=>a.dueAt>before.resolved_through+1));
  world.close();
  assert.throws(()=>upgradeWorldDepth(f),/Only the pinned/);
});

test('event IDs survive a rules release and a manifest crash can be repaired without a second activation',t=>{
  const f=legacy(t);
  const expected=`evt:${createHash('sha256').update(`${OLD}|migration-test|old-notice`).digest('hex').slice(0,32)}`;
  assert.equal(eventId('migration-test','old-notice'),expected);
  upgradeWorldDepth(f);
  const before=stateRow(f.db), pending=f.db.prepare('SELECT * FROM scheduled_actions ORDER BY id').all();
  writeFileSync(join(f.directory,'active-world.json'),JSON.stringify({format:1,database:'world.sqlite',rulesVersion:OLD}));
  assert.equal(upgradeWorldDepth(f).status,'already_upgraded');
  assert.deepEqual(stateRow(f.db),before);
  assert.deepEqual(f.db.prepare('SELECT * FROM scheduled_actions ORDER BY id').all(),pending);
  assert.equal(JSON.parse(readFileSync(join(f.directory,'active-world.json'),'utf8')).rulesVersion,DEPTH);
});

test('unknown releases and invalid states fail closed without changing history',t=>{
  const f=legacy(t), before=stateRow(f.db), history=events(f.db);
  writeFileSync(join(f.directory,'active-world.json'),JSON.stringify({format:1,database:'world.sqlite',rulesVersion:'other'}));
  assert.throws(()=>upgradeWorldDepth(f),/Only the pinned/);
  assert.deepEqual(stateRow(f.db),before); assert.deepEqual(events(f.db),history);
  writeFileSync(join(f.directory,'active-world.json'),JSON.stringify({format:1,database:'world.sqlite',rulesVersion:OLD}));
  const state=JSON.parse(before.state_json);state.characters.goaden.location='unknown-place';
  f.db.prepare('UPDATE world_state SET state_json=? WHERE id=1').run(JSON.stringify(state));
  const invalid=stateRow(f.db);
  assert.throws(()=>upgradeWorldDepth(f));
  assert.deepEqual(stateRow(f.db),invalid); assert.deepEqual(events(f.db),history);
});
