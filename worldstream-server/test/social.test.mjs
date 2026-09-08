import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { openSocialStore, normalizeReaction } from '../src/social-store.mjs';
import {
  WATCHERS,
  classifyEventTier,
  generateWatcherComments,
  selectWatchersForEvent,
} from '../src/watchers.mjs';
import { createApp } from '../server.mjs';

const NOW = Date.parse('2026-09-04T13:23:00.000Z');

test('WATCHERS catalog contains 12 authored fictional World Voices', () => {
  assert.equal(WATCHERS.length, 12);
  for (const watcher of WATCHERS) {
    assert.ok(watcher.id, 'watcher has id');
    assert.ok(watcher.name, 'watcher has name');
    assert.ok(watcher.title, 'watcher has title');
    assert.ok(watcher.holyItem, 'watcher has Holy Item');
    assert.ok(watcher.guardian, 'watcher has Guardian');
    assert.ok(watcher.bio, 'watcher has bio');
    assert.ok(Array.isArray(watcher.focus) && watcher.focus.length > 0, 'watcher has focus tags');
  }
});

test('classifyEventTier categorizes events correctly', () => {
  assert.equal(classifyEventTier(null), 'quiet');
  assert.equal(classifyEventTier({ type: 'ACTIVITY_START', description: 'Taking a quiet walk' }), 'quiet');
  assert.equal(
    classifyEventTier({
      type: 'CONVERSATION',
      lines: [{ who: 'goaden', text: 'Quiet night.' }],
    }),
    'banter'
  );
  assert.equal(
    classifyEventTier({
      type: 'ALERT',
      description: 'MEU perimeter sensor alert at Wapping Reach',
    }),
    'alert'
  );
  assert.equal(
    classifyEventTier({
      type: 'ENCOUNTER',
      description: 'Goaden spotted an Order scout on the viaduct',
    }),
    'alert'
  );
});

test('selectWatchersForEvent and generateWatcherComments produce contextual comments', () => {
  const event = {
    id: 'evt:cafe-talk',
    location: 'cafe',
    description: 'Ashai and Goaden shared hot cinnamon tea at the Silver Spoon Cafe.',
    occurredAt: 1788500000000,
    lines: [
      { who: 'ashai', text: 'Did you hear the bells?' },
      { who: 'goaden', text: 'Three chimes flat.' },
    ],
  };

  const selected = selectWatchersForEvent(event);
  assert.ok(selected.length >= 1 && selected.length <= 3);

  const comments = generateWatcherComments(event);
  assert.equal(comments.length, selected.length);
  for (const c of comments) {
    assert.equal(c.eventId, event.id);
    assert.ok(c.authorName);
    assert.ok(c.authorHolyItem);
    assert.ok(c.authorGuardian);
    assert.ok(c.authorTitle);
    assert.ok(c.text.length > 5);
    assert.ok(c.createdAt > event.occurredAt, 'comment is timestamped after event');
    assert.equal(c.isWatcher, 1);
  }
});

test('normalizeReaction handles emojis and aliases', () => {
  assert.equal(normalizeReaction('love'), 'love');
  assert.equal(normalizeReaction('❤️'), 'love');
  assert.equal(normalizeReaction('heart'), 'love');
  assert.equal(normalizeReaction('😂'), 'laugh');
  assert.equal(normalizeReaction('laugh'), 'laugh');
  assert.equal(normalizeReaction('😮'), 'wow');
  assert.equal(normalizeReaction('shock'), 'wow');
  assert.equal(normalizeReaction('👀'), 'eyes');
  assert.equal(normalizeReaction('watch'), 'eyes');
  assert.equal(normalizeReaction('invalid'), null);
  assert.equal(normalizeReaction(''), null);
  assert.equal(normalizeReaction(null), null);
});

test('social reads preserve fiction without inventing audience activity or changing stored records', (t) => {
  const store = openSocialStore({ dbPath: ':memory:' });
  t.after(() => store.close());
  const event = { id: 'evt:truthful-audience', type: 'ALERT', description: 'An anomaly at MI6.', occurredAt: NOW - 60_000 };
  const authored = store.addComment(event.id, { text: 'An authored World Voice.', isWatcher: true, createdAt: NOW - 1_000 });
  const firstRead = store.getSocial(event.id, event, NOW);
  assert.equal(firstRead.reactions.total, 0);
  assert.equal(firstRead.totalComments, 0);
  assert.ok(firstRead.comments.some(comment => comment.id === authored.id));
  assert.ok(firstRead.comments.every(comment => comment.isWatcher === 1));
  assert.equal(Object.hasOwn(firstRead, 'watching'), false);
  assert.equal(store.getTodayHighlight([event], '2026-09-04', NOW).eventId, null,
    'fictional commentary alone cannot create a most-discussed badge');

  store.addReaction(event.id, 'love');
  const reader = store.addComment(event.id, { text: 'A reader response.', createdAt: NOW });
  const storedBefore = store.getComments(event.id);
  for (const at of [NOW, NOW + 60_000, NOW + 6 * 60 * 60_000]) {
    const social = store.getSocial(event.id, event, at);
    assert.deepEqual(social.reactions, { love: 1, laugh: 0, wow: 0, eyes: 0, total: 1 });
    assert.equal(social.totalComments, 1);
    assert.ok(social.comments.some(comment => comment.id === reader.id));
    assert.equal(Object.hasOwn(social, 'watching'), false);
  }
  assert.deepEqual(store.getComments(event.id), storedBefore, 'reads never rewrite user or fictional records');
  const highlight = store.getTodayHighlight([event], '2026-09-04', NOW);
  assert.equal(highlight.eventId, event.id);
  assert.equal(highlight.totalInteractions, 3, 'one reaction and one reader comment weighted twice');
  assert.equal(highlight.totalComments, 1);
});

test('socialStore handles reactions atomically and accurately', () => {
  const store = openSocialStore({ dbPath: ':memory:' });
  const eventId = 'evt:atomic-test';

  const initial = store.getReactions(eventId);
  assert.deepEqual(initial, { love: 0, laugh: 0, wow: 0, eyes: 0, total: 0 });

  store.addReaction(eventId, 'love');
  store.addReaction(eventId, '❤️'); // alias
  store.addReaction(eventId, '😂');
  store.addReaction(eventId, 'wow');
  store.addReaction(eventId, 'eyes', 3);

  const updated = store.getReactions(eventId);
  assert.equal(updated.love, 2);
  assert.equal(updated.laugh, 1);
  assert.equal(updated.wow, 1);
  assert.equal(updated.eyes, 3);
  assert.equal(updated.total, 7);

  // Concurrency test: 30 increments
  for (let i = 0; i < 30; i++) {
    store.addReaction(eventId, 'love', 1);
  }
  const finalReactions = store.getReactions(eventId);
  assert.equal(finalReactions.love, 32);
  assert.equal(finalReactions.total, 37);

  // Decrement test: toggle / unreact with delta: -1
  store.addReaction(eventId, 'love', -1);
  assert.equal(store.getReactions(eventId).love, 31);

  // Floor at 0 test: decrementing past 0 never yields negative counts
  const zeroEventId = 'evt:zero-floor-test';
  store.addReaction(zeroEventId, 'laugh', 1);
  store.addReaction(zeroEventId, 'laugh', -1);
  assert.equal(store.getReactions(zeroEventId).laugh, 0);
  store.addReaction(zeroEventId, 'laugh', -1);
  assert.equal(store.getReactions(zeroEventId).laugh, 0);
  // Negative delta on non-existent row inserts 0 count
  store.addReaction(zeroEventId, 'wow', -5);
  assert.equal(store.getReactions(zeroEventId).wow, 0);

  store.close();
});

test('socialStore handles traveller comments and sanitization', () => {
  const store = openSocialStore({ dbPath: ':memory:' });
  const eventId = 'evt:comment-test';

  // Empty comment should be rejected
  assert.throws(() => {
    store.addComment(eventId, { text: '   ' });
  }, /empty/i);

  // Valid comment with traveller profile flair
  const comment = store.addComment(eventId, {
    text: ' Ashai left the tea untouched... something is wrong! ',
    traveller: {
      name: ' StarlightScout ',
      holyItem: 'Astra',
      guardian: 'Nyx',
      title: 'MI6 Archivist',
      avatar: '🌙',
      bio: 'Watching the stars over London',
    },
  });

  assert.equal(comment.eventId, eventId);
  assert.equal(comment.text, 'Ashai left the tea untouched... something is wrong!');
  assert.equal(comment.authorName, 'StarlightScout');
  assert.equal(comment.authorHolyItem, 'Astra');
  assert.equal(comment.authorGuardian, 'Nyx');
  assert.equal(comment.authorTitle, 'MI6 Archivist');
  assert.equal(comment.authorAvatar, '🌙');
  assert.equal(comment.isWatcher, 0);

  // Whitespace author name and Holy Item fall back to defaults
  const fallbackComment = store.addComment(eventId, {
    text: 'A quiet voice speaks.',
    traveller: {
      name: '   ',
      holyItem: '   ',
      guardian: '   ',
      title: '   ',
    },
  });
  assert.equal(fallbackComment.authorName, 'Anonymous Traveller');
  assert.equal(fallbackComment.authorHolyItem, 'Pendant of Mist');
  assert.equal(fallbackComment.authorGuardian, 'The Silver Born');
  assert.equal(fallbackComment.authorTitle, 'London Observer');

  const list = store.getComments(eventId);
  assert.equal(list.length, 2);
  assert.equal(list[0].id, comment.id);
  assert.equal(list[1].id, fallbackComment.id);

  // Authored commentary remains visible, separately from reader activity.
  const social = store.getSocial(eventId, { id: eventId, description: 'Quiet event' }, NOW);
  assert.equal(social.reactions.total, 0);
  assert.equal(social.totalComments, 2);
  assert.ok(social.comments.length > social.totalComments, 'fictional comments do not count as reader discussion');
  assert.ok(social.comments.some((c) => c.id === comment.id));
  assert.ok(social.comments.some((c) => c.isWatcher));
  assert.equal(Object.hasOwn(social, 'watching'), false);

  store.close();
});

// Server integration tests
async function serverFixture(t) {
  const world = {
    advance() {},
    publicProjection() {
      return {
        worldId: 'shared-test-world',
        resolvedThrough: NOW,
        events: [
          {
            id: 'evt:server-test-1',
            occurredAt: NOW - 10_000,
            location: 'mi6',
            description: 'Ashai and Goaden in the briefing room.',
            lines: [{ who: 'goaden', text: 'The memo is redacted.' }],
          },
        ],
      };
    },
  };
  const socialStore = openSocialStore({ dbPath: ':memory:' });
  const server = createApp({ world, socialStore, now: () => NOW });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;

  t.after(async () => {
    socialStore.close();
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  return { base, socialStore };
}

test('social endpoints serve GET social, POST react, and POST comment correctly', async (t) => {
  const f = await serverFixture(t);
  const eventId = 'evt:server-test-1';

  // 1. GET /api/events/:id/social
  const resSocial = await fetch(`${f.base}/api/events/${encodeURIComponent(eventId)}/social`);
  assert.equal(resSocial.status, 200);
  const socialData = await resSocial.json();
  assert.equal(socialData.eventId, eventId);
  assert.equal(socialData.reactions.total, 0);
  assert.equal(socialData.totalComments, 0);
  assert.ok(Array.isArray(socialData.comments));
  assert.ok(socialData.comments.length >= 1);
  assert.equal(Object.hasOwn(socialData, 'watching'), false);

  // 2. POST /api/events/:id/react
  const resReact = await fetch(`${f.base}/api/events/${encodeURIComponent(eventId)}/react`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reaction: 'love' }),
  });
  assert.equal(resReact.status, 200);
  const reactData = await resReact.json();
  assert.equal(reactData.success, true);
  assert.equal(reactData.eventId, eventId);
  assert.equal(reactData.reactions.love, 1);
  assert.equal(reactData.reactions.total, 1);

  // 3. POST /api/events/:id/comment
  const resComment = await fetch(`${f.base}/api/events/${encodeURIComponent(eventId)}/comment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'Goaden is definitely hiding something in that report.',
      traveller: {
        name: 'CuriousSpectator',
        holyItem: 'Aurelius',
        guardian: 'The Sovereign Seal',
        title: 'Borough Sleuth',
      },
    }),
  });
  assert.equal(resComment.status, 200);
  const commentData = await resComment.json();
  assert.equal(commentData.success, true);
  assert.equal(commentData.comment.text, 'Goaden is definitely hiding something in that report.');
  assert.equal(commentData.comment.authorName, 'CuriousSpectator');
  assert.equal(commentData.totalComments, 1);

  // 4. Decrement / toggle reaction via API
  const resDecReact = await fetch(`${f.base}/api/events/${encodeURIComponent(eventId)}/react`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reaction: 'love', delta: -1 }),
  });
  assert.equal(resDecReact.status, 200);
  const decReactData = await resDecReact.json();
  assert.equal(decReactData.success, true);
  assert.equal(decReactData.reactions.total, 0);

  // 5. Invalid requests & method checks
  // Method not allowed on social
  const postSocial = await fetch(`${f.base}/api/events/${encodeURIComponent(eventId)}/social`, {
    method: 'POST',
  });
  assert.equal(postSocial.status, 405);

  // Method not allowed on react
  const getReact = await fetch(`${f.base}/api/events/${encodeURIComponent(eventId)}/react`);
  assert.equal(getReact.status, 405);

  // Empty comment payload
  const emptyComment = await fetch(`${f.base}/api/events/${encodeURIComponent(eventId)}/comment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: '  ' }),
  });
  assert.equal(emptyComment.status, 400);

  // Invalid JSON body
  const malformed = await fetch(`${f.base}/api/events/${encodeURIComponent(eventId)}/react`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not-json',
  });
  assert.equal(malformed.status, 400);

  // Malformed event ID encoding
  const badUri = await fetch(`${f.base}/api/events/%E0%A4%A/social`);
  assert.equal(badUri.status, 400);

  // Oversized payload (> 16KB) returns 413
  const hugeBody = JSON.stringify({ reaction: 'love', filler: 'x'.repeat(18_000) });
  const resHuge = await fetch(`${f.base}/api/events/${encodeURIComponent(eventId)}/react`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: hugeBody,
  });
  assert.equal(resHuge.status, 413);

  // Non-object JSON body returns 400
  const arrayBody = await fetch(`${f.base}/api/events/${encodeURIComponent(eventId)}/react`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '[1, 2, 3]',
  });
  assert.equal(arrayBody.status, 400);
});
