import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { openWorld } from '../src/world.mjs';
import { DEFAULT_SEED, createFixture, incidentActions, weatherForDay, factionsForDay } from '../src/fixture.mjs';
import { atLondon, nextLondonDay, londonDate } from '../src/time.mjs';
import { baselinePressure, pressureValue, pressureLevel, PRESSURE_BANDS, PRESSURE_LEVELS,
  PRESSURE_RULES, REPERTOIRE, CONSEQUENCE, reachableSeverities, chooseIncident,
  incidentChance, aftermathFor } from '../src/pressure.mjs';
import { assertNoSpoiler } from '../src/spoilers.mjs';
import { applyChange } from '../src/ledger.mjs';

const START = atLondon('2026-09-04', '00:00');
const DAYS = 180;
let END_DAY = '2026-09-04';
for (let i = 0; i < DAYS; i++) END_DAY = nextLondonDay(END_DAY);

let shared = null;
function run(t) {
  if (shared) return shared;
  const directory = mkdtempSync(join(tmpdir(), 'silver-clouds-pressure-test-'));
  const world = openWorld({ dbPath: join(directory, 'w.sqlite'), seed: DEFAULT_SEED, startMs: START });
  t.after(() => {
    world.close();
    const resolved = realpathSync(directory);
    if (dirname(resolved) !== realpathSync(tmpdir()) || !basename(resolved).startsWith('silver-clouds-pressure-test-')) {
      throw new Error(`Refusing unexpected cleanup target: ${resolved}`);
    }
    rmSync(resolved, { recursive: true, force: true });
  });
  world.advance(atLondon(END_DAY, '00:00'));
  shared = world.semanticSnapshot();
  return shared;
}

test('pressure is a real 0-1 read off public posture, and the bands are ordered', () => {
  assert.deepEqual(PRESSURE_LEVELS, ['low', 'medium', 'high', 'critical']);
  assert.ok(PRESSURE_BANDS.medium < PRESSURE_BANDS.high && PRESSURE_BANDS.high < PRESSURE_BANDS.critical);
  assert.equal(baselinePressure({ factions: { arcane: 'low', mi6: 'routine', order: 'quiet', church: 'quiet' } }), 0.05);
  const worst = baselinePressure({ factions: { arcane: 'high', mi6: 'elevated', order: 'active_in_city', church: 'veil_cycle' }, veilPhase: 'underway' });
  assert.equal(worst, 1);
  for (let day = '2026-09-04', count = 0; count < 200; count++, day = nextLondonDay(day)) {
    const value = baselinePressure({ factions: factionsForDay(day, DEFAULT_SEED) });
    assert.ok(value >= 0 && value <= 1, `${day}: ${value}`);
    assert.ok(PRESSURE_LEVELS.includes(pressureLevel(value)));
  }
});

test('pressure carries: a floor, not a sum, so it survives a decay and a replay', () => {
  // The same idiom the relationship model uses, and for the same reasons. An
  // increment cannot survive a nightly decay of its own size, and a maximum is
  // idempotent so replaying an incident changes nothing.
  assert.equal(pressureValue(0.2, 0.66), 0.66, 'residue should hold the value up');
  assert.equal(pressureValue(0.8, 0.66), 0.8, 'the day can still be worse than the residue');
  assert.equal(pressureValue(0.66, 0.66), 0.66, 'idempotent');
  assert.equal(pressureValue(2, 0), 1, 'clamped');
  assert.ok(PRESSURE_RULES.dailyDecay > 0 && PRESSURE_RULES.dailyDecay < 0.5);
  // A confrontation must still be readable days later.
  let carried = PRESSURE_RULES.incidentFloor.critical;
  let days = 0;
  while (pressureLevel(carried) !== 'low' && days < 20) { carried -= PRESSURE_RULES.dailyDecay; days++; }
  assert.ok(days >= 4, `a critical night stopped mattering after ${days} days`);
});

test('a quiet world can be strange but never dangerous', () => {
  // The severity ceiling is the whole point of the axis. Low pressure may only
  // ever reach for unease; combat is reserved for a world that has earned it.
  assert.deepEqual(reachableSeverities('low'), ['unease']);
  for (const level of ['low', 'medium']) {
    assert.ok(!reachableSeverities(level).includes('critical'), `${level} can turn critical`);
  }
  assert.ok(!reachableSeverities('low').includes('medium'));
  assert.ok(reachableSeverities('critical').includes('critical'));
  // Every level is weighted toward unease, so even a bad day is mostly strange.
  for (const level of PRESSURE_LEVELS) {
    const bank = reachableSeverities(level);
    const uneaseShare = bank.filter(item => item === 'unease').length / bank.length;
    assert.ok(uneaseShare >= 0.2, `${level} is only ${(uneaseShare * 100).toFixed(0)}% unease`);
  }
  // And the rate rises with the level, which is what exposure multiplies.
  assert.ok(incidentChance('critical') > incidentChance('high'));
  assert.ok(incidentChance('high') > incidentChance('low'));
});

test('what an incident is allowed to cost is bounded in one place', () => {
  // Unbounded severity was the author's call; unbounded *consequence* was not.
  // An incident may take an evening, a night or a plan and may leave them
  // shaken. Nothing here injures anybody or explains itself.
  assert.equal(CONSEQUENCE.unease.interrupts, false);
  assert.equal(CONSEQUENCE.unease.concern, 0);
  for (const severity of ['medium', 'high', 'critical']) {
    assert.ok(CONSEQUENCE[severity].interrupts, severity);
    assert.ok(CONSEQUENCE[severity].concern >= 1, severity);
  }
  assert.ok(CONSEQUENCE.critical.concern > CONSEQUENCE.medium.concern);
  assert.ok(CONSEQUENCE.high.aftermath && CONSEQUENCE.critical.aftermath);
  assert.ok(!CONSEQUENCE.medium.aftermath, 'a medium incident should not follow them into the morning');
});

test('the repertoire is written and never generated, and none of it spoils anything', () => {
  let lines = 0;
  for (const [severity, bank] of Object.entries(REPERTOIRE)) {
    assert.ok(bank.length >= 3, `${severity} has only ${bank.length} incidents`);
    const kinds = new Set();
    for (const item of bank) {
      assert.ok(item.kind && item.text, JSON.stringify(item));
      assert.ok(!kinds.has(item.kind), `duplicate kind ${item.kind}`);
      kinds.add(item.kind);
      assertNoSpoiler(item.text, `${severity}/${item.kind}`);
      // Nothing resolves. An incident that explains itself is a plot.
      assert.ok(!/because|it turned out|which meant that|the reason/i.test(item.text),
        `${severity}/${item.kind} explains itself`);
      lines++;
    }
  }
  assert.ok(lines >= 20, `expected a real repertoire, saw ${lines}`);
  for (const bank of Object.values(REPERTOIRE)) {
    for (const item of bank) assertNoSpoiler(aftermathFor(item.kind), `aftermath/${item.kind}`);
  }
});

test('selection is seeded, and never casts an incident the day cannot hold', () => {
  for (const level of PRESSURE_LEVELS) {
    const once = chooseIncident({ level, recent: [] }, DEFAULT_SEED, 'k');
    const twice = chooseIncident({ level, recent: [] }, DEFAULT_SEED, 'k');
    assert.deepEqual(once, twice, `${level} is not deterministic`);
    assert.ok(reachableSeverities(level).includes(once.severity), `${level} reached ${once.severity}`);
  }
  // A day they cannot be out on never produces a street incident.
  for (const key of ['a', 'b', 'c', 'd', 'e', 'f']) {
    const indoors = chooseIncident({ level: 'critical', recent: [], outdoors: false }, DEFAULT_SEED, key);
    if (indoors) assert.notEqual(indoors.at, 'city', 'a street incident on a day they never left the building');
  }
});

test('momentum is real: the roll can see what has already happened', t => {
  // This is the bug the axis exists to avoid. The roll used to live in
  // dayActions, which is a pure function of the calendar and cannot see state,
  // so the carried pressure it was meant to respond to never reached it —
  // momentum was stored and then ignored, and a confrontation could arrive out
  // of a clear sky.
  // Scanned rather than pinned. An earlier version named one date, which meant
  // the assertion quietly stopped testing anything the moment a rules bump
  // reshuffled the calendar underneath it.
  const severityOf = actions => actions.map(item => item.severity ?? 'unease');
  let differed = 0, checked = 0;
  for (let day = '2026-09-04', count = 0; count < 120; count++, day = nextLondonDay(day)) {
    const weather = weatherForDay(day, DEFAULT_SEED);
    const factions = factionsForDay(day, DEFAULT_SEED, weather);
    const calm = incidentActions(day, DEFAULT_SEED, weather, factions, 0);
    const afterAWeekOfHell = incidentActions(day, DEFAULT_SEED, weather, factions, 0.95);
    // Deterministic either way, on every day.
    assert.deepEqual(incidentActions(day, DEFAULT_SEED, weather, factions, 0.95), afterAWeekOfHell, day);
    assert.ok(afterAWeekOfHell.length <= PRESSURE_RULES.maxIncidentsPerDay, day);
    if (JSON.stringify(severityOf(calm)) !== JSON.stringify(severityOf(afterAWeekOfHell))) differed++;
    checked++;
  }
  assert.equal(checked, 120);
  assert.ok(differed > 10,
    `carried pressure changed the day on only ${differed} of ${checked} days, so momentum is barely real`);
});

test('over six months the world is strange constantly and violent rarely', t => {
  const snapshot = run(t);
  const of = type => snapshot.events.filter(event => event.type === type && !event.payload?.outcome);
  const unease = of('UNEASE'), incidents = of('INCIDENT');
  const bySeverity = {};
  for (const event of incidents) bySeverity[event.payload.severity] = (bySeverity[event.payload.severity] ?? 0) + 1;

  // Ordinary life is always present; weirdness is constantly brushing it.
  const strangeDays = new Set([...unease, ...incidents].map(event => londonDate(event.occurredAt)));
  assert.ok(strangeDays.size / DAYS > 0.6,
    `only ${strangeDays.size}/${DAYS} days had anything strange`);
  // But the loud end stays rare, or it is a theme park.
  assert.ok((bySeverity.critical ?? 0) / DAYS < 0.12, `critical ran at ${bySeverity.critical}/${DAYS}`);
  assert.ok((bySeverity.high ?? 0) / DAYS < 0.3, `high ran at ${bySeverity.high}/${DAYS}`);
  assert.ok(unease.length > (bySeverity.high ?? 0), 'the quiet strangeness should outnumber the loud');
  // Common incidents should still occur. A specific seed cannot guarantee a
  // rare critical encounter AND require the pair to be awake together outside:
  // the old lower bound was being satisfied by invalid indoor incidents. Keep
  // the upper rarity bounds above; test EVERY definition's legitimate execution
  // separately below instead of making a critical event into a calendar quota.
  for (const severity of ['medium', 'high']) {
    assert.ok(bySeverity[severity] > 0, `${severity} never happened in ${DAYS} days`);
  }
});

test('an incident costs something, and unease costs nothing', t => {
  const snapshot = run(t);
  for (const event of snapshot.events.filter(item => item.type === 'UNEASE' && !item.payload?.outcome)) {
    // Ambient, like an institution notice — which is why it cannot make a quiet
    // afternoon look busy to the director.
    assert.deepEqual(event.participants, [], 'unease was attributed to somebody');
    for (const change of event.changes) {
      assert.ok(['director', 'pressure'].includes(change.entity)
        || change.entity === 'story' && change.id === 'narrativeSignals' && change.field === 'narrativeSignals',
      'unease moved the world');
    }
  }
  let interrupted = 0;
  for (const event of snapshot.events.filter(item => item.type === 'INCIDENT' && item.payload?.severity)) {
    assert.ok(event.participants.length >= 1);
    // It really happened to them: somebody learned it, with provenance.
    const learned = event.changes.some(change => change.field === 'knowledge');
    assert.ok(learned, `nobody carried ${event.id}`);
    if (event.changes.some(change => change.field === 'activity')) interrupted++;
  }
  assert.ok(interrupted > 0, 'no incident ever interrupted anything');

  // Nobody is ever hurt. The only conditions this world has are tiredness and
  // being shaken, and both wear off.
  for (const actor of Object.values(snapshot.characters)) {
    for (const condition of actor.conditions) {
      assert.ok(['ordinary_fatigue', 'shaken'].includes(condition.kind), condition.kind);
    }
  }
});

test('the morning after only exists when somebody still carries the night', t => {
  const snapshot = run(t);
  const aftermaths = snapshot.events.filter(event => event.type === 'AFTERMATH' && !event.payload?.outcome);
  assert.ok(aftermaths.length > 0, 'nothing ever followed anybody home');
  const incidents = new Map(snapshot.events.filter(event => event.type === 'INCIDENT' && event.payload?.severity)
    .map(event => [event.id, event]));
  for (const event of aftermaths) {
    // It is caused, and it lands the following morning rather than the same one.
    assert.ok(event.causedBy.length, `${event.id} came from nowhere`);
    const cause = event.causedBy.map(id => incidents.get(id)).find(Boolean);
    if (!cause) continue;
    assert.ok(event.occurredAt > cause.occurredAt, 'an aftermath preceded its cause');
    assert.notEqual(londonDate(event.occurredAt), londonDate(cause.occurredAt),
      'the morning after happened on the same morning');
    assert.ok(CONSEQUENCE[cause.payload.severity].aftermath,
      `${cause.payload.severity} should not leave an aftermath`);
  }
});

function pressureFixture(kind, placements = {}, participantIds = ['goaden', 'ashai']) {
  const fixture = createFixture({ startMs: START });
  const state = fixture.initialState();
  const [severity, bank] = Object.entries(REPERTOIRE).find(([, entries]) => entries.some(item => item.kind === kind));
  const definition = bank.find(item => item.kind === kind);
  const now = atLondon('2026-09-04', '14:50');
  for (const actor of Object.values(state.characters)) Object.assign(actor, {
    location: 'big_ben_plaza', area: 'venue', activity: 'walking_the_city',
    activitySince: now - 10 * 60_000, activityUntil: now + 60 * 60_000,
    ...placements[actor.id],
  });
  const action = {
    id: `2026-09-04/phase0-${kind}`, day: '2026-09-04', dueAt: now, priority: 48,
    type: severity === 'unease' ? 'UNEASE' : 'INCIDENT', actors: participantIds,
    kind, severity, text: definition.text, factKey: `2026-09-04:phase0-${kind}`,
    validUntil: atLondon('2026-09-05', '23:00'), aftermath: CONSEQUENCE[severity].aftermath,
  };
  return { state, action, before: structuredClone(state),
    resolve: () => fixture.reduceAction(state, action, DEFAULT_SEED) };
}

function assertPressureRefused(fixture) {
  const result = fixture.resolve();
  assert.equal(result.event.payload.outcome, 'skipped');
  assert.equal(result.event.visibility, 'private');
  assert.equal(result.event.publicDescription, null);
  assert.deepEqual(result.followups, []);
  assert.deepEqual(fixture.state, fixture.before);
  return result;
}

test('phase 0: street incidents cannot occur at MI6, Sanctuary, or inside a city venue', () => {
  for (const kind of ['hostile_words', 'followed', 'confrontation']) {
    for (const [location, area] of [['mi6', 'common_room'], ['sanctuary', 'central_hub'],
      ['cafe', 'venue'], ['enchanted_ink', 'venue']]) {
      const placement = { location, area, activity: 'unhurried_time' };
      assertPressureRefused(pressureFixture(kind, { goaden: placement, ashai: placement }));
    }
  }
});

test('phase 0: shared incidents require every named participant at the same place', () => {
  assertPressureRefused(pressureFixture('confrontation', {
    ashai: { location: 'mi6', area: 'common_room', activity: 'unhurried_time' },
  }));
  assertPressureRefused(pressureFixture('confrontation', {}, ['goaden']));
  const atMi6 = { location: 'mi6', area: 'ops_room', activity: 'on_call' };
  assertPressureRefused(pressureFixture('breach', { goaden: atMi6 }));
});

test('phase 0: a sleeping or travelling character cannot silently witness an incident', () => {
  assertPressureRefused(pressureFixture('courier', {
    goaden: { location: 'mi6', area: 'quarters', activity: 'sleeping' },
  }));
  const transit = { location: 'streamliner', area: 'transit', activity: 'travelling',
    journey: { from: 'mi6', to: 'big_ben_plaza', arrivesAt: atLondon('2026-09-04', '15:00') } };
  assertPressureRefused(pressureFixture('confrontation', { goaden: transit, ashai: transit }));
});

test('phase 0: a valid street confrontation keeps its real participants and location', () => {
  const f = pressureFixture('confrontation');
  const { event, followups } = f.resolve();
  assert.equal(event.visibility, 'public');
  assert.equal(event.location, 'big_ben_plaza');
  assert.equal(event.area, 'venue');
  assert.deepEqual(event.participants, ['goaden', 'ashai']);
  for (const actor of Object.values(f.state.characters)) {
    assert.equal(actor.location, 'big_ben_plaza');
    assert.equal(actor.area, 'venue');
    assert.ok(actor.knowledge.some(memory => memory.sourceEventId === event.id));
  }
  assert.equal(followups.filter(action => action.type === 'AFTERMATH').length, 1);
});

test('phase 0: every authored incident remains executable in its compatible physical setting', () => {
  for (const [severity, bank] of Object.entries(REPERTOIRE)) {
    for (const definition of bank) {
      const location = definition.at === 'city' ? 'big_ben_plaza' : definition.at;
      const area = location === 'mi6' ? definition.kind === 'unrecognised' ? 'corridors' : 'common_room'
        : location === 'streamliner' ? 'transit' : 'venue';
      // Environmental notices need no protagonist at their source. In
      // particular, do not put a test character on a train without a journey.
      const placement = severity === 'unease'
        ? { location: 'mi6', area: definition.kind === 'unrecognised' ? 'corridors' : 'common_room', activity: 'unhurried_time' }
        : { location, area, activity: 'unhurried_time' };
      const f = pressureFixture(definition.kind, { goaden: placement, ashai: placement });
      const { event, followups } = f.resolve();
      assert.equal(event.visibility, 'public', definition.kind);
      assert.equal(event.publicDescription, definition.text);
      assert.equal(event.location, location);
      if (severity === 'unease') {
        assert.deepEqual(event.participants, []);
        assert.deepEqual(f.state.characters, f.before.characters);
      } else {
        assert.ok(event.participants.length > 0);
        for (const who of event.participants) {
          assert.ok(f.state.characters[who].knowledge.some(memory => memory.sourceEventId === event.id));
        }
        assert.equal(followups.filter(action => action.type === 'AFTERMATH').length,
          CONSEQUENCE[severity].aftermath ? 1 : 0);
      }
    }
  }
});

test('phase 0: plural medium incidents teach both actual witnesses', () => {
  for (const kind of ['followed', 'sighting']) {
    const f = pressureFixture(kind);
    const { event } = f.resolve();
    assert.deepEqual(event.participants, ['goaden', 'ashai'], kind);
    for (const actor of Object.values(f.state.characters)) {
      assert.ok(actor.knowledge.some(memory => memory.sourceEventId === event.id), `${kind}/${actor.id}`);
    }
    assertPressureRefused(pressureFixture(kind, {}, ['goaden']));
  }
});

test('phase 0: a solo incident does not change an absent character or their feelings', () => {
  const f = pressureFixture('hostile_words', {
    ashai: { location: 'mi6', area: 'common_room', activity: 'gaming' },
  });
  const { event } = f.resolve();
  assert.deepEqual(event.participants, ['goaden']);
  assert.deepEqual(f.state.characters.ashai, f.before.characters.ashai);
  assert.deepEqual(f.state.relationships.find(pair => pair.from === 'ashai'),
    f.before.relationships.find(pair => pair.from === 'ashai'));
  assert.equal(f.state.facts[f.action.factKey].subject, 'goaden');
});

test('phase 0: a building-wide incident does not move witnesses between rooms', () => {
  const f = pressureFixture('breach', {
    goaden: { location: 'mi6', area: 'ops_room', activity: 'on_call' },
    ashai: { location: 'mi6', area: 'common_room', activity: 'gaming' },
  });
  const { event } = f.resolve();
  assert.equal(event.visibility, 'public');
  assert.equal(event.location, 'mi6');
  assert.equal(event.area, null);
  assert.equal(f.state.characters.goaden.area, 'ops_room');
  assert.equal(f.state.characters.ashai.area, 'common_room');
});

test('phase 0: environmental unease is located at its source, not at the protagonists', () => {
  for (const [kind, location, area] of [['wrong_platform', 'streamliner', 'transit'],
    ['clock_disagreement', 'big_ben_plaza', 'venue'], ['ink_relocation', 'enchanted_ink', 'venue']]) {
    const atMi6 = { location: 'mi6', area: 'common_room', activity: 'unhurried_time' };
    const f = pressureFixture(kind, { goaden: atMi6, ashai: atMi6 });
    const { event } = f.resolve();
    assert.equal(event.location, location, kind);
    assert.equal(event.area, area, kind);
    assert.deepEqual(event.participants, []);
    assert.deepEqual(f.state.characters, f.before.characters);
    assert.deepEqual(f.state.facts, f.before.facts);
  }
});

test('phase 0: incident definitions reject unknown kinds and unapproved text before mutation', () => {
  for (const change of [{ kind: 'unwritten_incident' }, { text: 'An unapproved outcome was substituted.' }]) {
    const f = pressureFixture('confrontation');
    Object.assign(f.action, change);
    assert.throws(() => f.resolve(), /Unknown incident|Incident text differs/);
    assert.deepEqual(f.state, f.before);
  }
});

test('phase 0: resolving the same incident twice cannot bank concern or another aftermath', () => {
  const f = pressureFixture('confrontation');
  f.resolve();
  const committed = structuredClone(f.state);
  const duplicate = f.resolve();
  assert.deepEqual(f.state, committed);
  assert.deepEqual(duplicate.followups, []);
  assert.equal(duplicate.event.payload.outcome, 'skipped');
});

test('phase 0: named corridor unease cannot place Goaden there while he is elsewhere', () => {
  assertPressureRefused(pressureFixture('unrecognised'));
  const f = pressureFixture('unrecognised', {
    goaden: { location: 'mi6', area: 'corridors', activity: 'unhurried_time' },
  });
  const { event } = f.resolve();
  assert.equal(event.visibility, 'public');
  assert.equal(event.location, 'mi6');
  assert.equal(event.area, 'corridors');
  assert.deepEqual(event.participants, []);
  assert.deepEqual(f.state.characters, f.before.characters);
});

test('phase 0: malformed incident costs or knowledge lifetimes fail without mutations', () => {
  for (const change of [{ severity: 'medium' }, { factKey: '' }, { validUntil: 0 },
    { validUntil: NaN }, { aftermath: false }]) {
    const f = pressureFixture('confrontation');
    Object.assign(f.action, change);
    assert.throws(() => f.resolve(), /Unknown incident|Incident requires|Incident aftermath differs/);
    assert.deepEqual(f.state, f.before);
  }
  assertPressureRefused(pressureFixture('confrontation', {}, ['goaden', 'goaden', 'ashai']));
});

test('phase 0: a full ledger binds every incident to its actual witnesses without moving them', t => {
  const snapshot = run(t);
  const people = structuredClone(snapshot.characters);
  const definitions = new Map(Object.values(REPERTOIRE).flat().map(item => [item.kind, item]));
  let checked = 0;
  // Reconstruct each actor immediately BEFORE each committed event. This check
  // observes the real scheduler/reducer together, including later interruptions.
  for (const event of [...snapshot.events].reverse()) {
    for (const change of [...event.changes].reverse()) {
      if (change.entity === 'character') applyChange(people[change.id], change, 'before');
    }
    if (event.type !== 'INCIDENT' || event.visibility !== 'public') continue;
    const definition = definitions.get(event.payload.kind);
    assert.equal(event.location, definition.at === 'city' ? 'big_ben_plaza' : definition.at);
    if (['high', 'critical'].includes(event.payload.severity) || ['followed', 'sighting'].includes(definition.kind)) {
      assert.deepEqual(event.participants, ['goaden', 'ashai']);
    }
    for (const who of event.participants) {
      assert.equal(people[who].location, event.location, `${event.id}/${who} was elsewhere`);
      assert.ok(!people[who].journey);
      assert.ok(!['sleeping', 'travelling'].includes(people[who].activity));
      if (definition.at === 'city') assert.equal(people[who].area, 'venue');
    }
    const moved = event.changes.filter(change => change.entity === 'character'
      && ['location', 'area', 'journey'].includes(change.field));
    assert.deepEqual(moved, [], `${event.id} moved somebody to fit its prose`);
    const absentChanges = event.changes.filter(change => change.entity === 'character'
      && !event.participants.includes(change.id));
    assert.deepEqual(absentChanges, [], `${event.id} changed an absent character`);
    checked++;
  }
  assert.ok(checked > 0, 'No actual incidents were checked');
});
