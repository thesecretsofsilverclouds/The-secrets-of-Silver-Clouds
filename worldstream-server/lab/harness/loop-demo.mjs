import { runWorld } from './run.mjs';
import { createDesk, consider, reconcile, publicKnowledgeAffordances } from '../gazette/gazette.mjs';
import { viewFrom } from '../engine/engine.mjs';
import { explain, renderExplanation } from './explain.mjs';
import { londonDate } from '../../src/time.mjs';
import { factionsForDay, weatherForDay } from '../../src/fixture.mjs';

// The loop, end to end and with no inference anywhere in it:
//
//   Worldstream commits a public event
//     -> the Gazette decides it is worth printing and makes a claim
//        -> reality contradicts the claim; the paper runs a correction
//           -> the failed prediction becomes an affordance
//              -> a character has an action that did not exist before
//
// This is the thing the whole architecture is for. Everything above it is
// machinery; this is the output.

const SEED = 'silver-clouds-now-v1';
const run = runWorld({ days: 30, momentEngine: false });
const desk = createDesk();
const byDay = new Map();
for (const event of run.events) {
  const day = londonDate(event.occurredAt);
  (byDay.get(day) ?? byDay.set(day, []).get(day)).push(event);
}
const printed = [];
let firstCorrection = null;
for (const [day, events] of byDay) {
  const factions = factionsForDay(day, SEED, weatherForDay(day, SEED));
  for (const event of events) {
    const corrections = reconcile(desk, event, day);
    if (corrections.length && !firstCorrection) firstCorrection = { day, corrections, event };
    const item = consider(desk, event, { day, factions });
    if (item) printed.push(item);
  }
}

console.log('STEP 1 — Worldstream commits public events. The Gazette prints and makes a claim.');
const claim = desk.claims.find(c => c.retracted);
const story = printed.find(i => i.id === claim.itemId);
console.log(`  ${story.day}  ${story.headline}`);
console.log(`     ${story.attribution ?? ''} ${story.body}`);
console.log(`     claim on the record: "${claim.text}" (${claim.kind})`);
console.log();
console.log('STEP 2 — reality disagrees. The paper corrects itself; the simulation does not change.');
console.log(`  ${claim.retracted}  ${desk.corrections.find(c => c.aboutItem === claim.itemId)?.text}`);
console.log(`     (the event that contradicted it was committed by Worldstream, not by the paper)`);
console.log();
console.log('STEP 3 — the failed prediction becomes an affordance the Moment Engine can see.');
const affordances = publicKnowledgeAffordances(desk, claim.retracted).filter(a => a.contradicted);
console.log(`  ${affordances.length} contradicted claims quotable on ${claim.retracted}:`);
for (const a of affordances.slice(0, 3)) console.log(`     callback.${a.key}  topic=${a.topic}  "${a.text}"`);
console.log();
console.log('STEP 4 — an action exists for Goaden that did not exist yesterday.');
const key = affordances[0].key;
const facts = who => [
  'world.daypart.midday', 'world.weather.heavy_rain', 'world.faction.arcane.low',
  'char.goaden', 'char.ashai', 'here.goaden.streamliner_transit', 'here.ashai.streamliner_transit',
  'free.goaden', 'free.ashai', 'waiting.goaden', 'waiting.ashai',
  'activity.goaden.waiting', 'activity.ashai.waiting',
  'familiar.goaden.ashai', 'familiar.ashai.goaden',
  'trait.goaden.watchful', 'trait.goaden.deadpan', 'trait.goaden.unbothered', 'trait.goaden.deflects_concern',
  'trait.ashai.protective', 'trait.ashai.norm_compliant', 'trait.ashai.finishes_the_movement',
  'practice.shared_wait.streamliner_transit',
  ...(who === 'after' ? [
    `callback.${key}.by.goaden`, `callback.${key}.about.ashai`,
    `callback.${key}.topic.failed_prediction`] : []),
];
for (const phase of ['before', 'after']) {
  const result = explain({ view: viewFrom(facts(phase)), actor: 'goaden' });
  const has = result.ranked.some(c => c.action.id === 'call_back_earlier');
  console.log(`  ${phase.padEnd(6)} — reference_failed_prediction available: ${has}`);
  if (!has) {
    const blocked = result.blocked.find(b => b.action === 'call_back_earlier');
    console.log(`           because: ${blocked?.reason}`);
  }
}
