// Planning experiment only. Nothing in production imports this file.
// Run: node --test lab/harness/three-addons-feasibility.test.mjs
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { createFixture, DEFAULT_SEED, weatherForDay } from '../../src/fixture.mjs';
import { openWorld, semanticDigest } from '../../src/world.mjs';
import { atLondon } from '../../src/time.mjs';
import { SCENE_RESERVOIR_CATALOG } from '../../src/scene-reservoir-catalog.mjs';
import { SCENE_BANK_CATALOG } from '../../src/scene-bank-catalog.mjs';

const report = { scope: 'Feasibility experiments, not implemented addons or reader-quality proof', tests: {} };
const near = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const norm = x => Math.hypot(...x);
const tau = rho => rho > 0 && rho < 1 ? -1 / Math.log(rho) : null;

test('SPECTRA: recovery arithmetic and non-normal amplification are different', () => {
  const times = Object.fromEntries([.487, .839, .998, .621, .963].map(r => [r, tau(r)]));
  near(times[.998], 499.4998331664548);
  assert.equal(tau(1), null);
  // Both eigenvalues are .8, yet this input initially grows more than fourfold.
  let x = [0, 1]; const gains = [];
  for (let h = 0; h < 8; h++) { x = [.8 * x[0] + 4 * x[1], .8 * x[1]]; gains.push(norm(x)); }
  assert.ok(gains[0] > 4);
  report.tests.spectralArithmetic = { timesInSteps: times, stableEigenvalues: [.8, .8], transientGains: gains };
});

test('SPECTRA: actual Worldstream reducer exposes a neutral derivative without a tipping point', () => {
  const startMs = atLondon('2026-09-04', '00:00'), fixture = createFixture({ startMs });
  const a = fixture.initialState(), b = structuredClone(a), eps = 1e-5;
  a.pressure.carried = .9; b.pressure.carried = .9 + eps;
  const invalid = structuredClone(a);
  invalid.relationships[0].trust += eps;
  assert.throws(() => fixture.reduceAction(invalid, fixture.initialActions()[0], DEFAULT_SEED), /Relationship bounds/);
  b.relationships[0].trust += 1; // Legal discrete intervention, not a Jacobian column.
  const before = JSON.stringify(a);
  fixture.reduceAction(a, fixture.initialActions()[0], DEFAULT_SEED);
  fixture.reduceAction(b, fixture.initialActions()[0], DEFAULT_SEED);
  assert.notEqual(JSON.stringify(a), before);
  const pressureDerivative = (b.pressure.carried - a.pressure.carried) / eps;
  const retainedTrustStep = b.relationships[0].trust - a.relationships[0].trust;
  near(pressureDerivative, 1); near(retainedTrustStep, 1);
  near(a.pressure.carried, .76);
  report.tests.actualReducer = { pressureDerivative, retainedTrustStep, fractionalTrustRejected: true, pressureAfterDay: a.pressure.carried,
    conclusion: 'Pressure derivative one is ordinary additive decay; trust is integer-only. Neither proves instability.' };
});

// Conservative graph-shaped motif memory, not a claim of Turing instability.
// Fixed 15-minute steps; P is row stochastic, with isolated nodes self-looped.
const STEP = .25;
const mix = (z, graph, rate) => z.map((v, i) => {
  const neighbors = graph[i];
  const mean = neighbors.length ? neighbors.reduce((sum, j) => sum + z[j], 0) / neighbors.length : v;
  return (1 - STEP * rate) * v + STEP * rate * mean;
});
const evolve = (fields, graph) => ({
  a: mix(fields.a, graph, .2).map(v => v * Math.exp(-STEP / 8)),
  i: mix(fields.i, graph, .5).map(v => v * Math.exp(-STEP / 2)),
});
const settle = fields => Math.max(...fields.a, ...fields.i) < 1e-6
  ? { a: fields.a.map(() => 0), i: fields.i.map(() => 0) } : fields;
const graph = [[1], [0, 2], [1], []];

test('MORPHOS: bounded local pulse, delayed positive affinity, isolated node and extinction', () => {
  let f = { a: [.6, 0, 0, 0], i: [1, 0, 0, 0] };
  const scores = [f.a[0] - f.i[0]];
  const opportunityWindowAffinity = {};
  for (let step = 0; step < 30 * 96; step++) {
    f = settle(evolve(f, graph));
    assert.ok([...f.a, ...f.i].every(v => Number.isFinite(v) && v >= 0 && v <= 1));
    assert.equal(f.a[3], 0); assert.equal(f.i[3], 0);
    if (step < 32) scores.push(f.a[0] - f.i[0]);
    if ([48, 144].includes(step + 1)) opportunityWindowAffinity[(step + 1) / 4] = f.a[0] - f.i[0];
  }
  assert.ok(scores[0] < 0 && scores.some(v => v > .02));
  assert.ok(Math.max(...f.a, ...f.i) < 1e-30);
  report.tests.motifPulse = { initialAffinity: scores[0], peakFirst8Hours: Math.max(...scores),
    residualAfter30Days: Math.max(...f.a, ...f.i), isolatedNode: f.a[3], opportunityWindowAffinity };
});

test('MORPHOS: fixed-step chunking and save/load cannot change the result', () => {
  let continuous = { a: [.6, 0, 0, 0], i: [1, 0, 0, 0] }, chunked = structuredClone(continuous);
  for (let n = 0; n < 96; n++) continuous = evolve(continuous, graph);
  for (let batch = 0; batch < 4; batch++) {
    for (let n = 0; n < 24; n++) chunked = evolve(chunked, graph);
    chunked = JSON.parse(JSON.stringify(chunked));
  }
  assert.deepEqual(chunked, continuous);
});

// Corrected CSV: normalized late average, positive denominator floor, fixed
// subsystem grouping. These are synthetic trajectories, NOT world forecasts.
function csv(immediate, trajectory, { optionsBefore = 0, optionsAfter = 0, quality = 1, times = [1, 2, 4, 6] } = {}) {
  assert.equal(times.length, trajectory.length);
  assert.ok(times.every((t, h) => Number.isFinite(t) && t > (times[h - 1] ?? 0)));
  const H = times.at(-1), d = trajectory[0].length;
  const magnitudes = trajectory.map(norm), z = Array(d).fill(0);
  let late = 0, lateWeights = 0, persistent = 0, total = 0;
  trajectory.forEach((delta, h) => {
    const w = (times[h] - (times[h - 1] ?? 0)) * Math.exp(-(times[h] - times[0]) / 6);
    total += w; persistent += w * Number(magnitudes[h] > .01);
    delta.forEach((v, j) => { z[j] += w * Math.abs(v); });
    const lw = w * times[h] / H; late += lw * magnitudes[h]; lateWeights += lw;
  });
  const sum = z.reduce((a, b) => a + b, 0);
  if (!sum) return 0;
  const entropy = -z.filter(v => v > 0).reduce((a, v) => a + v / sum * Math.log(v / sum), 0);
  const breadth = Math.exp(entropy) / d;
  const optionGain = Math.max(0, Math.log((1 + optionsAfter) / (1 + optionsBefore)));
  return quality * persistent / total * breadth * Math.log1p((late / lateWeights) / (.05 + norm(immediate)))
    * (1 + Math.min(.5, optionGain));
}

test('CSV: delayed consequence beats fading disturbance; null, microscopic and cosmetic value remain zero', () => {
  const routine = [[.1, 0, 0, 0], [.05, 0, 0, 0], [.02, 0, 0, 0], [0, 0, 0, 0]];
  const seed = [[.01, 0, 0, 0], [.03, .02, 0, 0], [.08, .06, .04, 0], [.15, .1, .1, .1]];
  const loud = [[.8, .5, .4, .2], [.6, .3, .3, .1], [.3, .2, .1, 0], [.1, 0, 0, 0]];
  const scores = { routine: csv(routine[0], routine), seed: csv(seed[0], seed), loud: csv(loud[0], loud) };
  assert.ok(scores.seed > scores.loud && scores.loud > scores.routine);
  assert.equal(csv([0,0,0,0], Array.from({ length: 4 }, () => [0, 0, 0, 0])), 0);
  assert.equal(csv([0,0,0,0], Array.from({ length: 4 }, () => [1e-8, 0, 0, 0])), 0);
  assert.equal(csv(seed[0], seed, { quality: 0 }), 0);
  report.tests.syntheticCSV = scores;
});

test('CSV is unsigned sensitivity: a separate reviewed benefit is required for any choice bias', () => {
  const delta = [.1,.1,.1,.1], future = Array.from({length:4}, () => delta);
  const positive = csv(delta, future);
  const negative = csv(delta.map(x=>-x), future.map(row=>row.map(x=>-x)));
  near(positive, negative);
  const reviewedBias = (score, gain) => Number.isFinite(gain) && gain > 0 ? Math.min(Math.log(1.25), score * Math.min(1, gain)) : 0;
  assert.equal(reviewedBias(negative, -1), 0);
  assert.equal(reviewedBias(positive, undefined), 0);
  assert.ok(reviewedBias(positive, 1) > 0);
  report.tests.unsignedSensitivity = { positive, negative, withoutReviewedBenefit: 0,
    caveat: 'A benefit registry is not implemented. This demonstrates why divergence alone cannot rank choices.' };
});

test('CSV uses elapsed time, immediate disruption, and fixed raw-unit normalization', () => {
  const future = Array.from({length:4}, () => [.1, .2, 0, 0]);
  assert.ok(csv([.5,0,0,0], future) < csv([.01,0,0,0], future));
  assert.throws(()=>csv([0,0,0,0],future,{times:[1,2,2,6]}));
  const normalizedHours = [2/8, 1/5, 0, 0], normalizedMinutes = [120/480, 1/5, 0, 0];
  near(csv(normalizedHours, future), csv(normalizedMinutes, future));
});

test('Combined bias: per-system caps alone permit excessive odds multiplication', () => {
  const original = 2 * 1.7 * 1.8;
  const totalLogBias = Math.min(Math.log(2), Math.log(2) + Math.log(1.7) + Math.log(1.8));
  near(original, 6.12); near(Math.exp(totalLogBias), 2);
  // For a 10% base candidate the new probability is bp/(1-p+bp), not bp.
  report.tests.selector = { originalMultiplier: original, combinedCap: Math.exp(totalLogBias),
    tenPercentAfterOriginal: original * .1 / (.9 + original * .1), tenPercentAfterCap: .2 / 1.1 };
});

test('Weighted ranking shares legacy hash order; equal and tiny biases do not reshuffle it', () => {
  const draws = [.1, .3, .8];
  const choose = raw => {
    const floor = Math.min(...raw), span = Math.max(...raw) - floor;
    const factor = span > Math.log(2) ? Math.log(2) / span : 1;
    const b = raw.map(v => (v-floor)*factor);
    const clocks = draws.map((u,i)=>-Math.log1p(-u)/Math.exp(b[i]));
    return { index: clocks.indexOf(Math.min(...clocks)), ratio: Math.exp(Math.max(...b)) };
  };
  assert.equal(choose([0,0,0]).index, 0);
  assert.equal(choose([.2,.2,.2]).index, 0);
  assert.equal(choose([0,1e-9,0]).index, 0);
  assert.ok(choose([0,.01,0]).ratio < 1.02);
  near(choose([0,4,8]).ratio, 2);
});

test('Current catalog: count real enabled surface vocabulary; no invented causal effects', () => {
  const enabled = SCENE_RESERVOIR_CATALOG.filter(s => s.status === 'enabled');
  assert.ok(enabled.length > 0);
  assert.ok(enabled.every(s => s.effectPolicy === 'surface_only'));
  report.tests.catalog = { bankRows: SCENE_BANK_CATALOG.length, enabledReservoirRows: enabled.length,
    reservoirFamilies: new Set(enabled.map(s => s.reservoir.family)).size,
    contextSignatures: new Set(enabled.map(s => JSON.stringify([s.location, s.area, [...s.cast].sort(),
      s.reservoir.triggerTypes, s.reservoir.activitiesByActor, s.reservoir.weatherCodes, s.reservoir.dayparts]))).size };
});

test('Real 24-hour world: stepped catch-up equals one advance; reads leave history unchanged', () => {
  const startMs = atLondon('2026-09-04', '00:00');
  const make = () => openWorld({ dbPath: ':memory:', startMs, seed: 'three-addons-feasibility' });
  const a = make(), b = make();
  try {
    const start = performance.now(); const advance = a.advance(startMs + 86_400_000); const ms = performance.now() - start;
    for (let h = 1; h <= 24; h++) { b.advance(startMs + h * 3_600_000); b.publicProjection(); }
    const snapshot = a.semanticSnapshot(), digest = semanticDigest(snapshot);
    assert.equal(semanticDigest(b.semanticSnapshot()), digest);
    for (let n = 0; n < 10; n++) a.publicProjection();
    assert.equal(semanticDigest(a.semanticSnapshot()), digest);
    // Existing weather draw is key-based, so unrelated draws do not shift it.
    const weather = weatherForDay('2026-09-04', DEFAULT_SEED);
    weatherForDay('2026-09-05', DEFAULT_SEED);
    assert.deepEqual(weatherForDay('2026-09-04', DEFAULT_SEED), weather);
    report.tests.actual24Hours = { committedEvents: snapshot.events.length, processedActions: advance.processedActions, advanceMs: ms,
      equalSteppedHistory: true, readOnlyProjection: true,
      caveat: 'Node in-memory database; not Cloudflare CPU or candidate-rollout benchmark' };
  } finally { a.close(); b.close(); }
});

after(() => {
  writeFileSync(new URL('../THREE-ADDONS-FEASIBILITY.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
});
