import test from 'node:test';
import assert from 'node:assert/strict';
import { SceneReservoirRefill, initialSceneRefillState, buildSceneRefillPacket,
  openAISceneRefillClient, SCENE_REFILL_LIMITS } from '../src/scene-reservoir-refill.mjs';

const START = Date.UTC(2026, 8, 10), MINUTE = 60_000, DAY = 86_400_000;
const archetypes = { quiet_break: { id: 'quiet_break', metadata: {
  cast: ['goaden', 'ashai'], location: 'mi6', area: 'common_room', activity: 'quiet_break', weather: null,
}, allowedFacts: ['Goaden and Ashai are taking a quiet break together in the MI6 common room.'] } };
const paragraphs = ['Goaden let the silence stand. Ashai was there with him in the common room, and for once neither of them had anything to add.'];
const candidate = changes => ({ archetypeId: 'quiet_break', metadata: structuredClone(archetypes.quiet_break.metadata),
  paragraphs: [...paragraphs], ...changes });
const deficits = [{ familyId: 'quiet_break', archetypeId: 'quiet_break', eligibleFreshCount: 0, recentExposureCount: 2 }];
function harness(options = {}) {
  let state = initialSceneRefillState(), calls = 0;
  const store = { load: () => structuredClone(state), save(value) { state = structuredClone(value); } };
  const client = (...args) => { calls += 1; return options.client ? options.client(...args)
    : Promise.resolve({ candidates: [candidate()] }); };
  const serviceOptions = { store, archetypes, validator: () => ({ ok: true }),
    config: { enabled: true }, ...options, client };
  const service = new SceneReservoirRefill(serviceOptions);
  return { service, serviceOptions, store, calls: () => calls, state: () => structuredClone(state),
    tick: (now = START, extra = {}) => service.tick({ now, deficits, ...extra }) };
}
async function generate(h, now = START) {
  // A deficit is recorded on first sight and spent once it has persisted. One
  // that has stood since yesterday is already old enough, so the first tick
  // of a new day may spend straight away.
  const first = h.tick(now);
  if (first.generation) return first.generation;
  assert.equal(first.status, 'recording_deficit');
  return h.tick(now + MINUTE).generation;
}

test('who is reading is not an input: an empty room spends the call, and default configuration spends none', async () => {
  // The old design refused to generate without a live audience. That made a
  // reader's presence the thing that unlocked a spend, so refill could never
  // run in the quiet. Now only health, a deficit that has persisted across
  // ticks, and the durable budget decide.
  const h = harness();
  assert.equal(h.tick(START).status, 'recording_deficit');
  assert.equal((await h.tick(START + MINUTE).generation).status, 'quarantined');
  assert.equal(h.calls(), 1);
  assert.equal('getPresence' in new SceneReservoirRefill(h.serviceOptions), false);
  const off = harness({ config: {} });
  assert.equal(off.tick().status, 'disabled'); assert.equal(off.tick(START + DAY).status, 'disabled');
  assert.equal(off.calls(), 0);
});

test('usable authored coverage never triggers a refill', () => {
  const h = harness();
  for (const candidateDeficits of [[], [{ ...deficits[0], eligibleFreshCount: 1 }],
    [{ ...deficits[0], recentExposureCount: 1 }], [{ ...deficits[0], archetypeId: 'invented' }]]) {
    assert.equal(h.tick(START, { deficits: candidateDeficits }).status, 'covered');
    assert.equal(h.tick(START + MINUTE, { deficits: candidateDeficits }).status, 'covered');
  }
  assert.equal(h.calls(), 0);
});

test('persisted deficit must recur on a later maintenance tick; reservation precedes the one batch call', async () => {
  const h = harness({ client(packet, { signal }) {
    assert.equal(h.state().attempts[0].status, 'reserved');
    assert.equal(packet.batchSize, 8); assert.equal(signal.aborted, false);
    return { candidates: [candidate()] };
  } });
  assert.equal(h.tick().status, 'recording_deficit');
  assert.equal(h.tick(START + MINUTE - 1).status, 'recording_deficit'); assert.equal(h.calls(), 0);
  const result = await h.tick(START + MINUTE).generation;
  assert.equal(result.status, 'quarantined'); assert.equal(result.accepted, 1);
  const cached = h.state().quarantine[0];
  assert.equal(cached.approved, false); assert.equal(cached.status, 'quarantined');
  assert.equal(h.tick(START + 2 * MINUTE).status, 'daily_budget'); assert.equal(h.calls(), 1);
});

test('concurrent maintenance ticks share one durable reservation', async () => {
  let resolve;
  const h = harness({ client: () => new Promise(done => { resolve = done; }) });
  h.tick();
  const first = h.tick(START + MINUTE);
  for (let i = 0; i < 100; i++) {
    const next = h.tick(START + MINUTE);
    assert.equal(next.generation, first.generation);
  }
  assert.equal(h.calls(), 1);
  resolve({ candidates: [candidate()] }); await first.generation;
});

test('durable reservations prevent duplicate spend across service restarts and uncertain failures', async () => {
  const h = harness({ client: () => { throw new Error('Unknown provider outcome'); } });
  await generate(h);
  const restarted = new SceneReservoirRefill(h.serviceOptions);
  assert.equal(restarted.tick({ now: START + 2 * MINUTE, deficits }).status, 'daily_budget');
  assert.equal(h.calls(), 1); assert.equal(h.state().attempts[0].status, 'failed');
  const s = h.state(); s.attempts[0].status = 'reserved'; h.store.save(s);
  assert.equal(restarted.tick({ now: START + 3 * MINUTE, deficits }).status, 'daily_budget');
  assert.equal(h.calls(), 1);
});

test('failed durable claim cannot call the model', () => {
  const h = harness(); h.tick();
  const save = h.store.save;
  h.store.save = value => { if (value.attempts.length) throw new Error('Disk unavailable'); save(value); };
  assert.equal(h.tick(START + MINUTE).status, 'storage_unavailable'); assert.equal(h.calls(), 0);
});

test('daily, monthly and family limits hold across ticks', async () => {
  const h = harness(); await generate(h);
  assert.equal(h.tick(START + 3 * MINUTE).status, 'daily_budget');
  assert.equal(SCENE_REFILL_LIMITS.familyCooldownMs, DAY);
  for (let day = 1; day < 4; day++) await generate(h, START + day * (DAY + 3 * MINUTE));
  assert.equal(h.calls(), 4);
  assert.equal(h.tick(START + 4 * (DAY + 3 * MINUTE)).status, 'monthly_budget');
});

test('every tick for the rest of the day after a call is the daily budget', async () => {
  const h = harness(); await generate(h);
  for (let minute = 2; minute < 1440; minute++) assert.equal(h.tick(START + minute * MINUTE).status, 'daily_budget');
  assert.equal(h.calls(), 1);
});

test('a deficit health stops reporting is forgotten, so a recovered family cannot spend yesterday’s shortage', () => {
  const h = harness(); h.tick();
  assert.equal(h.tick(START + MINUTE, { deficits: [] }).status, 'covered');
  assert.equal(h.tick(START + 2 * MINUTE).status, 'recording_deficit'); assert.equal(h.calls(), 0);
});

test('a timeout aborts the request, consumes the allowance and never retries', async () => {
  let signal;
  const h = harness({ client: (packet, options) => { signal = options.signal; return new Promise(() => {}); },
    config: { enabled: true, timeoutMs: 10 } });
  assert.equal((await generate(h)).status, 'aborted'); assert.equal(signal.aborted, true);
  assert.equal(h.tick(START + 2 * MINUTE).status, 'daily_budget'); assert.equal(h.calls(), 1);
});

test('malformed batches, metadata contradictions and validator rejections cannot enter the cache', async () => {
  for (const output of ['not json', { candidates: Array(9).fill(candidate()) },
    { candidates: [candidate({ metadata: { ...archetypes.quiet_break.metadata, location: 'london' } })] },
    { candidates: [candidate({ newFact: 'A new power' })] }]) {
    const h = harness({ client: () => output }); await generate(h);
    assert.equal(h.state().quarantine.length, 0); assert.equal(h.calls(), 1);
  }
  const h = harness({ validator: () => ({ ok: false, reason: 'Invented knowledge' }) });
  assert.equal((await generate(h)).accepted, 0); assert.equal(h.state().quarantine.length, 0);
});

test('exact and near-trivial rewrites are rejected within a batch and against persistent cache', async () => {
  const h = harness({ client: () => ({ candidates: [candidate(), candidate(),
    candidate({ paragraphs: [paragraphs[0].replace('for once', 'for once again')] })] }) });
  const first = await generate(h);
  assert.equal(first.accepted, 1); assert.equal(first.rejected, 2);
  const second = await generate(h, START + DAY + MINUTE);
  assert.equal(second.accepted, 0); assert.equal(second.rejected, 3);
  assert.equal(h.state().quarantine.length, 1);
});

test('explicit reviewed admission preserves text, metadata and generated origin', async () => {
  const h = harness(); await generate(h);
  const before = h.state().quarantine[0];
  assert.equal(h.service.promoteCandidate(before.id, () => ({ ok: true })).status, 'quarantined');
  const result = h.service.promoteCandidate(before.id, copy => {
    copy.metadata.location = 'invented'; copy.paragraphs = ['Overwritten'];
    return { ok: true, approved: true, candidate: copy };
  }, { now: START + 2 * MINUTE });
  assert.equal(result.status, 'approved');
  assert.deepEqual(result.candidate.metadata, before.metadata); assert.deepEqual(result.candidate.paragraphs, before.paragraphs);
  assert.equal(result.candidate.provenance, before.provenance); assert.equal(result.candidate.generatedAt, before.generatedAt);
  const restarted = new SceneReservoirRefill(h.serviceOptions);
  assert.equal(restarted.promoteCandidate(before.id, () => ({ ok: true, approved: true })).status, 'approved');
});

test('bounded Responses client sends literal canonical schema and parses structured batch without provider storage', async () => {
  let sent;
  const client = openAISceneRefillClient({ apiKey: 'test-key', fetchImpl: async (url, request) => {
    sent = { url, ...request, body: JSON.parse(request.body) };
    return { ok: true, json: async () => ({ status: 'completed', output_text: JSON.stringify({ candidates: [candidate()] }),
      usage: { input_tokens: 120, output_tokens: 80 }, model: 'gpt-5-mini' }) };
  } });
  const output = await client(buildSceneRefillPacket(archetypes.quiet_break, 'quiet_break'));
  assert.equal(sent.url, 'https://api.openai.com/v1/responses'); assert.equal(sent.body.store, false);
  assert.equal(sent.body.max_output_tokens, 4800); assert.equal(sent.body.text.format.strict, true);
  const schema = sent.body.text.format.schema.properties.candidates.items.properties;
  assert.deepEqual(schema.metadata.properties.location.enum, ['mi6']); assert.equal(output.candidates.length, 1);
  assert.deepEqual(output.usage, { input_tokens: 120, output_tokens: 80 });
});
