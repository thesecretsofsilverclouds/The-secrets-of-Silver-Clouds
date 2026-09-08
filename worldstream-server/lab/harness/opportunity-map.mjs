import { writeFileSync, mkdirSync } from 'node:fs';
import { openWorld } from '../../src/world.mjs';
import { atLondon, londonDate, MINUTE_MS as MIN } from '../../src/time.mjs';
import { locateEveryone, FAMILIAR } from '../engine/adapter.mjs';
import { AREAS_BY_LOCATION, areaOf, INTERRUPTIBLE } from '../../src/places.mjs';
import { CITY_LOCATIONS } from '../../src/fixture.mjs';
import { PRACTICES } from '../grammar/practices.mjs';
import { CAST } from '../grammar/cast.mjs';
import { runWorld } from './run.mjs';

// TRACK C — read-only opportunity map.
//
// Measures what the world already offers, so the Opportunity Director is
// designed against evidence rather than intuition. **Nothing here alters a
// schedule, a location or a co-location.** It samples the same 90-day world the
// Moment Engine ran against and counts.
//
// The question underneath all of it: when the engine produced nothing, was that
// because the characters had nothing to say, or because they were never in the
// same room? Those want completely different fixes, and only one of them is a
// Director's business.

const START = atLondon('2026-03-02', '00:00');
const DAYS = 90;
const SAMPLE = 10 * MIN;          // resolution of the co-presence scan
const NEARLY = 60 * MIN;          // "within one flexible decision" window
const OUT = new URL('../runs/', import.meta.url).pathname.replace(/^\//, '');
mkdirSync(OUT, { recursive: true });

const CASTED = [...CAST.keys()];
const pairKey = (a, b) => [a, b].sort().join(' + ');

// ---------------------------------------------------------------- the scan
const world = openWorld({ dbPath: ':memory:', startMs: START });
const target = START + DAYS * 86_400_000;
let mark = START;
while (mark < target) mark = world.advance(Math.min(target, mark + 6 * 3_600_000)).resolvedThrough;
const readState = () => JSON.parse(world.db.prepare('SELECT state_json FROM world_state WHERE id=1').get().state_json);
const events = world.db.prepare('SELECT semantic_json FROM events ORDER BY seq').all()
  .map(row => JSON.parse(row.semantic_json));
world.close();

// Rebuild position over time from the event ledger, which is the only honest
// way to know where somebody was at 14:30 on day forty.
const track = new Map(CASTED.map(id => [id, []]));
const at = { goaden: null, ashai: null, emily: null, yukon: null };
let index = 0;
const samples = [];
for (let t = START; t < target; t += SAMPLE) {
  while (index < events.length && events[index].occurredAt <= t) {
    const event = events[index++];
    for (const change of event.changes ?? []) {
      if (change.entity !== 'character') continue;
      const who = change.id;
      if (!(who in at)) continue;
      at[who] ??= {};
      if (change.field === 'location' && 'after' in change) at[who] = { ...at[who], location: change.after };
      if (change.field === 'area' && 'after' in change) at[who] = { ...at[who], area: change.after };
      if (change.field === 'activity' && 'after' in change) at[who] = { ...at[who], activity: change.after };
      if (change.field === 'journey') at[who] = { ...at[who], journey: change.after ?? null };
    }
    // Offscreen guests are placed where offscreen-lives records them.
    if (event.type?.startsWith('OFFSCREEN') || event.type?.startsWith('SUPPORTING')) {
      for (const guest of event.payload?.cast ?? []) {
        if (guest in at) at[guest] = { location: event.location, area: event.area ?? 'venue',
          activity: 'unhurried_time', seenAt: event.occurredAt };
      }
    }
  }
  const here = {};
  for (const who of CASTED) {
    const spot = at[who];
    if (!spot?.location) continue;
    // A guest's recorded position goes stale; a lead's does not.
    const simulated = who === 'goaden' || who === 'ashai';
    if (!simulated && (!spot.seenAt || t - spot.seenAt > 45 * MIN)) continue;
    if (spot.journey) continue;
    here[who] = `${spot.location}/${spot.area ?? 'venue'}`;
  }
  samples.push({ t, here });
}

// ------------------------------------------------- 1. co-presence, actual
const coPresent = new Map();
const soloTime = Object.fromEntries(CASTED.map(id => [id, 0]));
const presentTime = Object.fromEntries(CASTED.map(id => [id, 0]));
const sameSite = new Map();       // same location, different room
for (const { here } of samples) {
  const ids = Object.keys(here);
  for (const id of ids) presentTime[id] += SAMPLE;
  for (let i = 0; i < ids.length; i += 1) {
    let shares = false;
    for (let j = 0; j < ids.length; j += 1) {
      if (i === j) continue;
      if (here[ids[i]] === here[ids[j]]) shares = true;
      const key = pairKey(ids[i], ids[j]);
      if (here[ids[i]] === here[ids[j]]) coPresent.set(key, (coPresent.get(key) ?? 0) + SAMPLE / 2);
      else if (here[ids[i]].split('/')[0] === here[ids[j]].split('/')[0])
        sameSite.set(key, (sameSite.get(key) ?? 0) + SAMPLE / 2);
    }
    if (!shares) soloTime[ids[i]] += SAMPLE;
  }
}

// ------------------------- 2. "within one flexible decision" of each other
//
// Deliberately conservative. A near-miss counts only when the two were at
// *different addresses* within an hour of each other, both free, and the
// distance between the addresses is one ordinary journey — that is, a single
// travel decision that the world already knows how to make would have put them
// together. Two people in different rooms of the same building are counted
// separately, because that is a room choice rather than a journey.
const REACHABLE = new Set(Object.keys(CITY_LOCATIONS ?? {}));
const nearMiss = new Map();
const nearMissDetail = [];
for (let s = 0; s < samples.length; s += 1) {
  const now = samples[s];
  const window = samples.slice(s, s + NEARLY / SAMPLE);
  for (const a of CASTED) for (const b of CASTED) {
    if (a >= b) continue;
    const spotA = now.here[a];
    if (!spotA) continue;
    const later = window.find(sample => sample.here[b]);
    if (!later) continue;
    const spotB = later.here[b];
    if (spotA === spotB) continue;                       // already together
    const siteA = spotA.split('/')[0], siteB = spotB.split('/')[0];
    if (siteA === siteB) continue;                       // same building, room choice
    if (!REACHABLE.has(siteA) && siteA !== 'mi6') continue;
    if (!REACHABLE.has(siteB) && siteB !== 'mi6') continue;
    const key = pairKey(a, b);
    nearMiss.set(key, (nearMiss.get(key) ?? 0) + 1);
    if (nearMissDetail.length < 2000) nearMissDetail.push({ t: now.t, a, b, siteA, siteB });
  }
}

// ------------------------------- 3. families that never fired, and why not
const run = runWorld({ days: DAYS, collectAudits: true });
const firedFamilies = new Set(run.moments.map(moment => `${moment.actor}:${moment.behaviour}`));
const chosenFamilies = new Set(run.actions.map(action => `${action.actor}:${action.behaviour}`));

// Every action every character could in principle reach, from the practice
// library, versus what actually happened.
const catalogue = [];
for (const practice of PRACTICES.values())
  for (const action of practice.actions)
    for (const who of CASTED) {
      const surface = action.surface ?? action.id;
      const grammar = CAST.get(who);
      const bank = grammar.quips[surface] ?? [];
      const banned = grammar.forbids.some(rule =>
        (rule.conditions ?? []).some(condition => String(typeof condition === 'string' ? condition : condition.if)
          .includes(`eq Surface ${surface}`)));
      catalogue.push({ who, practice: practice.id, action: action.id, surface,
        surfaceable: action.surfaceable !== false,
        lines: bank.length, banned,
        chosen: chosenFamilies.has(`${who}:${practice.id}:${action.id}`),
        fired: firedFamilies.has(`${who}:${practice.id}:${action.id}`) });
    }

// Why each never-fired family did not fire, from the audit rather than a guess.
const blockedReasons = new Map();
for (const audit of run.audits)
  for (const item of audit.blocked ?? []) {
    const key = `${item.actor}:${item.practice}:${item.action}`;
    const bucket = blockedReasons.get(key) ?? new Map();
    bucket.set(item.reason, (bucket.get(item.reason) ?? 0) + 1);
    blockedReasons.set(key, bucket);
  }
const forbiddenReasons = new Map();
for (const audit of run.audits)
  for (const item of audit.rejected ?? []) {
    const key = `${item.actor}:${item.practice}:${item.action}`;
    const bucket = forbiddenReasons.get(key) ?? new Map();
    bucket.set(item.reason, (bucket.get(item.reason) ?? 0) + 1);
    forbiddenReasons.set(key, bucket);
  }

// ------------------------------------- 4. where the flexibility actually is
//
// A choice is flexible only if the world already makes it more than one way,
// with no obligation attached. Counted from the ledger, not asserted.
const choiceCounts = { location: new Map(), area: new Map(), activity: new Map() };
for (const event of events) {
  for (const change of event.changes ?? []) {
    if (change.entity !== 'character' || !('after' in change)) continue;
    if (change.field === 'location') choiceCounts.location.set(change.after, (choiceCounts.location.get(change.after) ?? 0) + 1);
    if (change.field === 'area') choiceCounts.area.set(change.after, (choiceCounts.area.get(change.after) ?? 0) + 1);
    if (change.field === 'activity') choiceCounts.activity.set(change.after, (choiceCounts.activity.get(change.after) ?? 0) + 1);
  }
}

// ------------------------------------------------------------------ report
const hours = ms => (ms / 3_600_000).toFixed(1);
const lines = [];
const say = text => lines.push(text);

say(`# Opportunity map — ${DAYS} days, read-only`);
say('');
say('Measured against the same world the Moment Engine ran on. **No schedule,');
say('location or co-location was altered.** Sampled every 10 minutes.');
say('');
say('The question underneath: when the engine produced nothing, was it because');
say('nobody had anything to say, or because they were never in the same room?');
say('Those want different fixes and only one is a Director\'s business.');
say('');

say('## 1. Who was actually with whom');
say('');
say('| pair | co-present | same building, different room | near-misses (different address, within 1 h) |');
say('|---|---:|---:|---:|');
const pairs = [];
for (let i = 0; i < CASTED.length; i += 1) for (let j = i + 1; j < CASTED.length; j += 1)
  pairs.push(pairKey(CASTED[i], CASTED[j]));
for (const key of pairs)
  say(`| ${key} | ${hours(coPresent.get(key) ?? 0)} h | ${hours(sameSite.get(key) ?? 0)} h | ${nearMiss.get(key) ?? 0} |`);
say('');
say('| character | time present at all | time alone |');
say('|---|---:|---:|');
for (const who of CASTED)
  say(`| ${who} | ${hours(presentTime[who])} h | ${hours(soloTime[who])} h (${((soloTime[who] / Math.max(1, presentTime[who])) * 100).toFixed(0)}%) |`);
say('');

say('## 2. Grammar that never fired, and the reason from the audit');
say('');
say('| character | family | lines | ever chosen | ever shown | why not |');
say('|---|---|---:|---|---|---|');
for (const entry of catalogue.sort((a, b) => a.who.localeCompare(b.who) || a.action.localeCompare(b.action))) {
  if (entry.fired) continue;
  const key = `${entry.who}:${entry.practice}:${entry.action}`;
  const blocked = [...(blockedReasons.get(key) ?? new Map())].sort((a, b) => b[1] - a[1])[0];
  const forbidden = [...(forbiddenReasons.get(key) ?? new Map())].sort((a, b) => b[1] - a[1])[0];
  const why = entry.banned ? 'refused by their own grammar'
    : forbidden ? `refused: ${forbidden[0]} (${forbidden[1]}×)`
      : blocked ? `${blocked[0]} (${blocked[1]}×)`
        : entry.lines === 0 ? 'no authored surface'
          : !entry.surfaceable ? 'not surfaceable by design'
            : 'situation never occurred';
  say(`| ${entry.who} | ${entry.action} | ${entry.lines} | ${entry.chosen ? 'yes' : '—'} | — | ${why} |`);
}
say('');

say('## 3. Where the world already makes a real choice');
say('');
say('Counted from the ledger: a value the world already reaches more than one');
say('way, with no obligation attached, is a candidate for a *nudge*. A value it');
say('only ever reaches one way is not flexibility, it is a rail.');
say('');
for (const [field, counts] of Object.entries(choiceCounts)) {
  const sorted = [...counts].sort((a, b) => b[1] - a[1]);
  say(`**${field}** — ${sorted.length} distinct values over ${DAYS} days`);
  say('');
  say('| value | times chosen | share |');
  say('|---|---:|---:|');
  const total = sorted.reduce((sum, [, n]) => sum + n, 0);
  for (const [value, n] of sorted.slice(0, 12))
    say(`| ${value} | ${n} | ${((n / total) * 100).toFixed(1)}% |`);
  say('');
}

writeFileSync(`${OUT}/opportunity-map.md`, lines.join('\n') + '\n');
writeFileSync(`${OUT}/opportunity-map.json`, JSON.stringify({
  days: DAYS,
  coPresentHours: Object.fromEntries([...coPresent].map(([k, v]) => [k, +hours(v)])),
  sameSiteHours: Object.fromEntries([...sameSite].map(([k, v]) => [k, +hours(v)])),
  nearMisses: Object.fromEntries(nearMiss),
  presentHours: Object.fromEntries(Object.entries(presentTime).map(([k, v]) => [k, +hours(v)])),
  soloHours: Object.fromEntries(Object.entries(soloTime).map(([k, v]) => [k, +hours(v)])),
  catalogue,
  choiceCounts: Object.fromEntries(Object.entries(choiceCounts)
    .map(([k, v]) => [k, Object.fromEntries(v)])),
}, null, 1));
console.log(lines.join('\n'));
console.error('written: runs/opportunity-map.md + .json');
