import test from 'node:test';
import assert from 'node:assert/strict';
import { createReaderFeedback } from '../../worldstream/app/reader-feedback.js';
import { createReadingView } from '../../worldstream/app/reading-view.js';

const KEY = 'silver-clouds-reader-feedback';
const TOKEN = 'deadbeef-cafe-4bad-8bee-000000000001';
const POLL = 'reader-test-v1';
const summary = () => ({ pollId: POLL, title: 'Reader priorities', description: 'Optional reader feedback.', totalBallots: 0,
  questions: [{ id: 'next_improvement', prompt: 'What would you like next?', required: true, totalResponses: 0,
    options: [{ id: 'continuing_threads', label: 'Continuing stories', count: 0 }, { id: 'night_stories', label: 'Night stories', count: 0 }] },
  { id: 'character', prompt: 'A familiar character?', required: false, totalResponses: 0,
    options: [{ id: 'ashai', label: 'Ashai', count: 0 }, { id: 'goaden', label: 'Goaden', count: 0 }] }] });
const response = data => ({ ok: true, status: 200, json: async () => structuredClone(data) });
const confirmation = (answers = { next_improvement: 'continuing_threads' }) => {
  const result = summary(); result.totalBallots = 1;
  for (const question of result.questions) if (answers[question.id]) {
    question.totalResponses = 1; question.options.find(option => option.id === answers[question.id]).count = 1;
  }
  return { ballot: { pollId: POLL, answers }, summary: result };
};
const walk = root => [root, ...root.children.flatMap(walk)];
const tick = () => new Promise(resolve => setImmediate(resolve));

class Element {
  constructor(tag, doc) { this.tag = tag; this.ownerDocument = doc; this.children = []; this.handlers = new Map();
    this.attrs = {}; this.dataset = {}; this.value = ''; this.open = false; this.classList = { contains: () => false }; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = [...children]; }
  setAttribute(key, value) { this.attrs[key] = value; }
  removeAttribute(key) { delete this.attrs[key]; }
  addEventListener(type, handler) { this.handlers.set(type, handler); }
  removeEventListener(type) { this.handlers.delete(type); }
  emit(type, event = { preventDefault() {} }) { return this.handlers.get(type)?.(event); }
  reportValidity() { return walk(this).filter(item => item.tag === 'select').every(item => !item.required || item.value !== ''); }
  querySelector(selector) { return walk(this).find(item => selector.startsWith('.')
    ? item.className?.split(' ').includes(selector.slice(1)) : item.tag === selector) ?? null; }
}
function harness({ initial, fetcher, storage: existingStorage, crypto: providedCrypto } = {}) {
  const calls = [], writes = [], values = new Map(initial ? [[KEY, JSON.stringify(initial)]] : []);
  values.set('silver-clouds-reading-view', 'on'); values.set('silver-clouds-weather-effects', 'reduced');
  const storage = existingStorage ?? { getItem: key => values.get(key) ?? null,
    setItem(key, value) { writes.push([key, value]); values.set(key, value); } };
  let uuidCalls = 0;
  const crypto = providedCrypto ?? { randomUUID() { uuidCalls++; return TOKEN; } };
  const doc = { createElement: tag => new Element(tag, doc) }, root = doc.createElement('details');
  const body = doc.createElement('div'); body.className = 'reader-feedback-body'; root.append(body);
  const reader = createReaderFeedback({ root, storage, crypto, fetcher: async (url, options = {}) => {
    calls.push({ url, method: options.method ?? 'GET', options });
    return fetcher ? fetcher(url, options, calls.length) : response(summary());
  } });
  return { calls, writes, values, storage, root, body, reader, doc, uuidCalls: () => uuidCalls,
    async open() { root.open = true; root.emit('toggle'); await tick(); },
    form: () => body.querySelector('form'), select: name => walk(body).find(item => item.tag === 'select' && item.name === name),
    status: () => walk(body).find(item => item.attrs.role === 'status')?.textContent ?? '',
    saved: () => JSON.parse(storage.getItem(KEY) ?? 'null'),
    submitButton: () => walk(body).find(item => item.tag === 'button' && item.type === 'submit'),
  };
}

test('poll stays offline until expanded, loads with GET only, and editing or revealing totals does not submit', async () => {
  let resolveGet;
  const h = harness({ fetcher: () => new Promise(resolve => { resolveGet = resolve; }) });
  assert.deepEqual(h.calls, []); assert.deepEqual(h.writes, []);
  h.root.emit('toggle'); assert.equal(h.calls.length, 0);
  await h.open(); await h.open();
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].method, 'GET');
  assert.equal(h.calls[0].url, '/api/feedback'); assert.equal(h.calls[0].options.body, undefined);
  resolveGet(response(summary())); await tick();
  h.select('next_improvement').value = 'night_stories'; h.select('next_improvement').emit('change');
  const totals = walk(h.body).find(item => item.textContent === 'See reader priorities'); totals.emit('click'); totals.emit('click');
  h.root.open = false; h.root.emit('toggle'); await h.open();
  assert.equal(h.calls.length, 1); assert.equal(h.uuidCalls(), 0); assert.deepEqual(h.writes, []);
});

test('invalid required form sends no POST, creates no identity and does not claim a saved vote', async () => {
  const h = harness(); await h.open();
  let prevented = false;
  await h.form().emit('submit', { preventDefault() { prevented = true; } });
  assert.equal(prevented, true); assert.equal(h.calls.length, 1);
  assert.equal(h.uuidCalls(), 0); assert.equal(h.saved(), null); assert.deepEqual(h.writes, []);
  assert.doesNotMatch(h.status(), /is saved/);
});

test('explicit submission stores only confirmed answers, prevents duplicate inflight submits, and restores confirmation after reload', async () => {
  let finish;
  const h = harness({ fetcher: (_url, options) => options.method === 'POST'
    ? new Promise(resolve => { finish = resolve; }) : response(summary()) });
  await h.open(); h.select('next_improvement').value = 'night_stories'; h.select('character').value = 'ashai';
  const saving = h.form().emit('submit'); await tick();
  assert.equal(h.calls.length, 2); assert.equal(h.submitButton().disabled, true);
  assert.deepEqual(h.saved(), { voterToken: TOKEN }, 'an inflight request must not store unconfirmed answers');
  assert.deepEqual(JSON.parse(h.calls[1].options.body), { pollId: POLL, voterToken: TOKEN,
    answers: { next_improvement: 'night_stories', character: 'ashai' } });
  await h.form().emit('submit'); assert.equal(h.calls.length, 2);
  h.select('next_improvement').value = 'continuing_threads'; h.select('character').value = 'goaden';
  const confirmed = { next_improvement: 'night_stories', character: 'ashai' };
  finish(response(confirmation(confirmed))); await saving;
  assert.deepEqual(h.saved(), { voterToken: TOKEN, pollId: POLL, answers: confirmed });
  assert.match(h.status(), /feedback is saved/); assert.equal(h.submitButton().disabled, false);
  assert.equal(h.body.querySelector('.reader-feedback-results').hidden, false);
  assert.equal(h.values.get('silver-clouds-weather-effects'), 'reduced');
  const reload = harness({ storage: h.storage }); await reload.open();
  assert.equal(reload.select('next_improvement').value, confirmed.next_improvement);
  assert.equal(reload.select('character').value, confirmed.character);
  assert.equal(reload.submitButton().textContent, 'Update feedback');
  assert.equal(reload.uuidCalls(), 0); assert.equal(reload.calls.length, 1);
});

test('failed or rate-limited POST preserves previous confirmed answers and never reports success', async () => {
  for (const code of [500, 429]) {
    const prior = { voterToken: TOKEN, pollId: POLL, answers: { next_improvement: 'continuing_threads' } };
    const h = harness({ initial: prior, fetcher: (_url, options) => options.method === 'POST'
      ? { ok: false, status: code } : response(summary()) });
    await h.open(); h.select('next_improvement').value = 'night_stories'; await h.form().emit('submit');
    assert.deepEqual(h.saved(), prior); assert.equal(h.uuidCalls(), 0);
    assert.equal(h.submitButton().disabled, false); assert.doesNotMatch(h.status(), /is saved/);
    assert.match(h.status(), code === 429 ? /wait a little/ : /could not be saved/);
  }
});

test('lost POST response keeps the same voter identity for retry and does not save the attempted answer', async () => {
  const h = harness({ fetcher: (_url, options) => {
    if (options.method === 'POST') throw new Error('Response lost');
    return response(summary());
  } });
  await h.open(); h.select('next_improvement').value = 'night_stories'; await h.form().emit('submit');
  assert.deepEqual(h.saved(), { voterToken: TOKEN }); assert.doesNotMatch(h.status(), /is saved/);
  const attempted = JSON.parse(h.calls[1].options.body);
  const retry = harness({ storage: h.storage, fetcher: (_url, options) => options.method === 'POST'
    ? response(confirmation({ next_improvement: 'night_stories' })) : response(summary()) });
  await retry.open(); assert.equal(retry.select('next_improvement').value, '');
  retry.select('next_improvement').value = 'night_stories'; await retry.form().emit('submit');
  assert.deepEqual(JSON.parse(retry.calls[1].options.body), attempted);
  assert.equal(retry.uuidCalls(), 0); assert.match(retry.status(), /feedback is saved/);
});

test('malformed or mismatched confirmation cannot overwrite saved answers or show success', async () => {
  for (const malformed of [
    { ballot: { pollId: 'different', answers: {} }, summary: summary() },
    { ballot: { pollId: POLL }, summary: summary() },
    { ballot: { pollId: POLL, answers: {} }, summary: summary() },
    { ballot: { pollId: POLL, answers: { next_improvement: 'not-an-option' } }, summary: summary() },
    { ballot: { pollId: POLL, answers: { next_improvement: 'continuing_threads' } }, summary: summary() },
  ]) {
    const prior = { voterToken: TOKEN, pollId: POLL, answers: { next_improvement: 'continuing_threads' } };
    const h = harness({ initial: prior, fetcher: (_url, options) => options.method === 'POST'
      ? response(malformed) : response(summary()) });
    await h.open(); h.select('next_improvement').value = 'night_stories'; await h.form().emit('submit');
    assert.deepEqual(h.saved(), prior);
    assert.doesNotMatch(h.status(), /is saved/); assert.match(h.status(), /could not be saved/);
  }
});

test('a stale tab reuses a newly saved browser identity and preserves its confirmed ballot when its own edit fails', async () => {
  const h = harness({ fetcher: (_url, options) => options.method === 'POST'
    ? { ok: false, status: 503 } : response(summary()) });
  await h.open();
  const prior = { voterToken: TOKEN, pollId: POLL, answers: { next_improvement: 'continuing_threads' } };
  h.storage.setItem(KEY, JSON.stringify(prior)); // Another tab confirms a vote after this form opened.
  h.select('next_improvement').value = 'night_stories'; await h.form().emit('submit');
  assert.equal(JSON.parse(h.calls[1].options.body).voterToken, TOKEN);
  assert.equal(h.uuidCalls(), 0);
  assert.deepEqual(h.saved(), prior);
  assert.match(h.status(), /could not be saved/);
});

test('a failed catalog load is retryable, including malformed question data', async () => {
  for (const first of [{ ok: false, status: 503 }, response({ ...summary(), questions: [null] })]) {
    let attempts = 0;
    const h = harness({ fetcher: () => ++attempts === 1 ? first : response(summary()) });
    await h.open(); assert.equal(h.form(), null);
    const button = walk(h.body).find(item => item.tag === 'button'); assert.ok(button);
    await button.emit('click'); await tick();
    assert.ok(h.form()); assert.equal(h.calls.length, 2);
    assert.ok(h.calls.every(call => call.method === 'GET')); assert.equal(h.writes.length, 0);
  }
});

test('reading preferences and unsent poll selections remain local and never enter world requests', async t => {
  const accidentalRequests = [];
  t.mock.method(globalThis, 'fetch', async (...args) => { accidentalRequests.push(args); throw new Error('Unexpected global request'); });
  const h = harness(), toggle = h.doc.createElement('button'), body = h.doc.createElement('body');
  h.doc.body = body; h.doc.hidden = false;
  h.doc.querySelector = selector => selector === '#reading-view-toggle' ? toggle : null;
  h.doc.querySelectorAll = () => [];
  h.doc.addEventListener = () => {}; h.doc.removeEventListener = () => {};
  const reading = createReadingView({ runtime: { document: h.doc, storage: h.storage } });
  t.after(() => reading.destroy());
  toggle.emit('click'); assert.equal(h.storage.getItem('silver-clouds-reading-view'), 'off');
  assert.equal(h.calls.length, 0); assert.deepEqual(accidentalRequests, []);
  await h.open(); h.select('next_improvement').value = 'night_stories'; h.select('character').value = 'ashai';
  toggle.emit('click'); assert.equal(h.storage.getItem('silver-clouds-reading-view'), 'on');
  assert.deepEqual(h.calls.map(call => [call.url, call.method]), [['/api/feedback', 'GET']]);
  assert.deepEqual(accidentalRequests, []); assert.equal(h.saved(), null);
});
