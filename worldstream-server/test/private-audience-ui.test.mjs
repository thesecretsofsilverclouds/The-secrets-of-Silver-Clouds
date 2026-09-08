import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const app = readFileSync(new URL('../../worldstream/app/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../worldstream/app/index.html', import.meta.url), 'utf8');
const css = ['style.css', 'reading-view.css'].map(name =>
  readFileSync(new URL(`../../worldstream/app/${name}`, import.meta.url), 'utf8')).join('\n');
const between = (start, end) => {
  const from = app.indexOf(start), to = app.indexOf(end, from);
  assert.ok(from >= 0 && to > from, 'client function boundaries exist');
  return app.slice(from, to);
};

test('public page has no audience counter or fabricated watcher fallback', () => {
  assert.doesNotMatch(html, /presence-(?:badge|count)|watching now|Active London Spectators/i);
  assert.doesNotMatch(app, /presence(?:Badge|Count)|watching(?:Label|Stat)|(?:data|world\.presence)\.watching|watching\s*:\s*\d/);
  assert.doesNotMatch(css, /\.presence-badge|\.watching-stat/);
});

test('Discord sits with existing footer links, without an embedded widget or joining automatically', () => {
  const footer = html.slice(html.indexOf('<footer>'), html.indexOf('</footer>'));
  assert.match(footer, /<a class="reader-support" href="https:\/\/discord\.gg\/x5mZqWFZn7" target="_blank" rel="noopener noreferrer">Discuss Worldstream on Discord ↗<\/a>/);
  assert.match(footer, /https:\/\/ko-fi\.com\/secretsofsilverclouds/);
  assert.doesNotMatch(html, /<iframe[^>]*discord|discord(?:app)?\.com\/widget/i);
});

test('reader totals never count fictional World Voices, including a confirmed newly submitted comment', async () => {
  const cached = { comments: [{ isWatcher: true }, { isWatcher: true }, { isWatcher: false }], reactions: { total: 0 } };
  const cache = new Map([['beat', cached]]);
  const count = { textContent: '' };
  const context = {
    cleanEventId: id => id,
    document: { getElementById: () => ({ querySelector: selector => selector === '.comment-count-label' ? count : null,
      querySelectorAll: () => [] }) },
    getStoredUserReactions: () => ({}), activeDiscussionEvent: { id: 'beat' },
    elements: { commentText: { value: 'A real reader thought.' }, commentSubmitBtn: { disabled: false } },
    travellerProfile: { name: 'Reader' }, socialCache: cache,
    renderDrawerReactions() {}, renderDiscussionComments() {},
    fetch: async () => ({ ok: true, json: async () => ({ comment: { isWatcher: false, text: 'A real reader thought.' } }) }),
  };
  const { update, submit } = runInNewContext(`${between('function readerCommentCount(data) {', 'async function handleReactionClick')}
    ${between('async function handleCommentSubmit(e) {', '// ---- Permalinks & Hash Routing')}
    ({ update: updateEventMetaUI, submit: handleCommentSubmit })`, context);
  update('beat', cached);
  assert.equal(count.textContent, '1 comment');
  await submit({ preventDefault() {} });
  assert.equal(cached.comments.length, 4, 'fictional flavour remains in the discussion');
  assert.equal(cached.totalComments, 2);
  assert.equal(count.textContent, '2 comments');
  update('beat', { ...cached, totalComments: 7 });
  assert.equal(count.textContent, '7 comments', 'authoritative reader total wins over a partial comment page');
});

test('fictional comments are explicitly labelled while a reader is not given that label', () => {
  const nodes = [];
  const node = (tag, text, classes) => {
    const item = { tag, text, classes, children: [], append(...items) { this.children.push(...items); } };
    nodes.push(item); return item;
  };
  const container = { replaceChildren() {}, append() {} };
  const render = runInNewContext(`${between('function renderDiscussionComments(comments) {', 'async function handleCommentSubmit')}\nrenderDiscussionComments`, {
    node, elements: { drawerComments: container }, timeLabel: () => '12:00',
  });
  render([{ authorName: 'In-world voice', isWatcher: true, text: 'A fictional remark.' },
    { authorName: 'Actual reader', isWatcher: false, text: 'A reader remark.' }]);
  const labels = nodes.filter(item => item.classes === 'comment-watcher-tag');
  assert.equal(labels.length, 1);
  assert.equal(labels[0].text, '✦ Fictional World Voice');
  const cards = nodes.filter(item => item.tag === 'article');
  assert.equal(cards.length, 2);
  assert.ok(cards[0].children[0].children[0].children.includes(labels[0]));
  assert.ok(!cards[1].children[0].children[0].children.includes(labels[0]));
});

test('a rendered event retains actual social controls without showing viewer counts', () => {
  const nodes = [];
  function node(tag, text, classes = '') {
    const names = new Set(classes.split(' ').filter(Boolean));
    const item = { tag, text, classes: names, dataset: {}, style: {}, children: [],
      classList: { add: (...values) => values.forEach(value => names.add(value)) },
      append(...values) { this.children.push(...values); },
      addEventListener() {} };
    nodes.push(item);
    return item;
  }
  const render = runInNewContext(`${between('function eventRow(event) {', 'function loadSocialForVisibleEvents')}\neventRow`, {
    node, cleanEventId: id => id, timeLabel: () => '12:00', asTime: value => value,
    currentHighlight: null, latestClocks: [], cinematicRecordForEvent: () => null,
    cinematicSummary: () => null, locationName: () => 'MI6',
    getStoredUserReactions: () => ({}), isSavedMoment: () => false,
  });
  const row = render({ id: 'public-beat', occurredAt: 1, location: 'mi6', description: 'A quiet moment.' });
  assert.equal(row.dataset.eventId, 'public-beat');
  const meta = nodes.find(item => item.classes.has('event-meta'));
  assert.equal(meta.children.length, 5);
  for (const name of ['discuss-btn', 'world-reaction-stat', 'reaction-palette', 'bookmark-btn', 'share-btn']) {
    assert.ok(meta.children.some(item => item.classes.has(name)), `${name} remains available`);
  }
  assert.equal(nodes.filter(item => item.classes.has('react-btn')).length, 4);
  assert.match(nodes.find(item => item.classes.has('discuss-btn')).innerHTML, />Discuss<\/span>/);
  assert.equal(nodes.find(item => item.classes.has('world-reaction-stat')).hidden, true);
  assert.ok(nodes.every(item => !/watching|spectator|viewer/i.test(item.innerHTML ?? '')));
});

test('quiet social controls invite discussion, then show and remove actual counts as updates arrive', () => {
  const comments = { textContent: '' }, reactions = { textContent: '' }, summary = { hidden: false };
  const selectors = { '.comment-count-label': comments, '.reaction-total-label': reactions, '.world-reaction-stat': summary };
  const context = {
    cleanEventId: id => id, activeDiscussionEvent: null, getStoredUserReactions: () => ({}),
    document: { getElementById: () => ({ querySelector: selector => selectors[selector] ?? null, querySelectorAll: () => [] }) },
  };
  const update = runInNewContext(`${between('function readerCommentCount(data) {', 'async function handleReactionClick')}\nupdateEventMetaUI`, context);
  update('beat', { totalComments: 0, comments: [{ isWatcher: true }], reactions: { total: 0 } });
  assert.equal(comments.textContent, 'Discuss'); assert.equal(summary.hidden, true);
  update('beat', { totalComments: 1, reactions: { total: 3 } });
  assert.equal(comments.textContent, '1 comment'); assert.equal(reactions.textContent, 3); assert.equal(summary.hidden, false);
  update('beat', { totalComments: 4, reactions: { total: 5 } });
  assert.equal(comments.textContent, '4 comments'); assert.equal(reactions.textContent, 5); assert.equal(summary.hidden, false);
  update('beat', { totalComments: 0, reactions: { total: 0 } });
  assert.equal(comments.textContent, 'Discuss'); assert.equal(summary.hidden, true);
});

test('discussion drawer keeps all reaction buttons usable while omitting an empty aggregate', () => {
  const bar = { children: [], replaceChildren() { this.children = []; }, append(...items) { this.children.push(...items); } };
  const node = (tag, text, classes) => ({ tag, text, classes, dataset: {}, classList: { toggle() {} }, addEventListener() {} });
  const render = runInNewContext(`${between('function renderDrawerReactions(eventId, data) {', 'function readerCommentCount')}\nrenderDrawerReactions`, {
    node, elements: { drawerReactionsBar: bar }, getStoredUserReactions: () => ({}),
  });
  render('beat', { reactions: { total: 0 } });
  assert.equal(bar.children.length, 4);
  assert.ok(bar.children.every(item => item.tag === 'button' && item.title && item.type === 'button'));
  render('beat', { reactions: { love: 2, total: 2 } });
  assert.equal(bar.children.length, 5);
  assert.equal(bar.children.at(-1).text, 'World reaction: 2');
  render('beat', { reactions: { total: 0 } });
  assert.equal(bar.children.length, 4);
});

test('visible readers still authenticate presence; hidden readers send no heartbeat', async () => {
  const calls = [], saved = [];
  const context = {
    document: { visibilityState: 'visible' }, viewerSessionId: 'test-session', viewerToken: null,
    VIEWER_TOKEN_KEY: 'token-key', sessionStorage: { setItem: (...args) => saved.push(args) },
    viewerFetch: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => ({ viewerToken: 'signed-token' }) };
    },
  };
  const update = runInNewContext(`${between('let presenceInFlight = null;', '// Every viewer polls')}\nupdatePresence`, context);
  await update();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/presence/ping');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), { clientId: 'test-session' });
  assert.equal(context.viewerToken, 'signed-token');
  assert.deepEqual(saved, [['token-key', 'signed-token']]);
  context.document.visibilityState = 'hidden';
  await update();
  assert.equal(calls.length, 1);
});

test('overlapping presence calls share one handshake and failure permits a new attempt', async () => {
  const requests = [], stored = [];
  const context = {
    document: { visibilityState: 'visible' }, viewerSessionId: 'one-tab', viewerToken: null,
    VIEWER_TOKEN_KEY: 'token-key', sessionStorage: { setItem: (...args) => stored.push(args) },
    viewerFetch: () => new Promise((resolve, reject) => requests.push({ resolve, reject })),
  };
  const update = runInNewContext(`${between('let presenceInFlight = null;', '// Every viewer polls')}\nupdatePresence`, context);
  const startup = update(), focus = update(), visible = update();
  assert.equal(requests.length, 1);
  requests[0].reject(new Error('Temporary network failure'));
  await Promise.all([startup, focus, visible]);
  assert.equal(context.viewerToken, null);
  const retry = update(), concurrentRetry = update();
  assert.equal(requests.length, 2, 'failure clears the in-flight guard');
  requests[1].resolve({ ok: true, json: async () => ({ viewerToken: 'one-signed-token' }) });
  await Promise.all([retry, concurrentRetry]);
  assert.equal(context.viewerToken, 'one-signed-token');
  assert.deepEqual(stored, [['token-key', 'one-signed-token']]);
  const heartbeat = update();
  assert.equal(requests.length, 3, 'success also permits a later heartbeat');
  requests[2].resolve({ ok: false });
  await heartbeat;
});

test('leaving still ends authenticated presence and suspends the scene', async () => {
  let suspended = 0;
  const beacons = [];
  const context = { viewerToken: 'signed-token', Blob,
    scene: { suspend: () => suspended++ },
    navigator: { sendBeacon: (...args) => beacons.push(args) } };
  const leave = runInNewContext(`${between('function leaveWatching() {', 'elements.refresh.addEventListener')}\nleaveWatching`, context);
  leave();
  assert.equal(suspended, 1);
  assert.equal(beacons.length, 1);
  assert.equal(beacons[0][0], '/api/presence/leave');
  assert.deepEqual(JSON.parse(await beacons[0][1].text()), { viewerToken: 'signed-token' });
  context.viewerToken = null;
  leave();
  assert.equal(beacons.length, 1, 'no unauthenticated departure request');
});
