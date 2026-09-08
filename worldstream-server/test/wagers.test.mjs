import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import {
  ACCOLADES,
  ALL_ACCOLADES,
  calculatePercentages,
  detectWagerForEvent,
  answerAlreadyPublic,
  buildWagerOptionsWithVotes,
} from '../src/wagers.mjs';
import { openSocialStore } from '../src/social-store.mjs';
import { createApp } from '../server.mjs';

const NOW = Date.parse('2026-09-04T14:00:00.000Z');

test('ACCOLADES catalog contains all 4 Phase 2 titles', () => {
  assert.equal(ALL_ACCOLADES.length, 4);
  assert.equal(ACCOLADES.MI6_INTUITIVE, 'MI6 Intuitive');
  assert.equal(ACCOLADES.SANCTUARY_ORACLE, 'Sanctuary Oracle');
  assert.equal(ACCOLADES.CHIMEWATCHER, 'Chimewatcher');
  assert.equal(ACCOLADES.BOROUGH_SLEUTH, 'Borough Sleuth');
});

test('calculatePercentages rounds actual votes to 100% and leaves an empty poll at zero', () => {
  // Edge case 1: all zero counts
  const zeros = calculatePercentages([
    { id: '1', text: 'A', count: 0 },
    { id: '2', text: 'B', count: 0 },
    { id: '3', text: 'C', count: 0 },
  ]);
  const sumZeros = zeros.reduce((acc, it) => acc + it.percent, 0);
  assert.equal(sumZeros, 0, 'no votes means no audience distribution');
  assert.ok(zeros.every(option => option.count === 0 && option.percent === 0));

  // Edge case 2: fractional splits (e.g. 1, 1, 1 -> 34, 33, 33)
  const thirds = calculatePercentages([
    { id: '1', text: 'A', count: 1 },
    { id: '2', text: 'B', count: 1 },
    { id: '3', text: 'C', count: 1 },
  ]);
  const sumThirds = thirds.reduce((acc, it) => acc + it.percent, 0);
  assert.equal(sumThirds, 100, 'thirds sum to 100%');

  // Varied distribution across 20 iterations
  for (let i = 1; i <= 20; i++) {
    const items = [
      { id: '1', text: 'A', count: i * 3 },
      { id: '2', text: 'B', count: i * 7 },
      { id: '3', text: 'C', count: i * 2 + 1 },
      { id: '4', text: 'D', count: i * 5 },
    ];
    const res = calculatePercentages(items);
    const sum = res.reduce((acc, it) => acc + it.percent, 0);
    assert.equal(sum, 100, `iteration ${i} sums to 100%`);
    for (const it of res) {
      assert.ok(it.percent >= 0 && it.percent <= 100, 'percent in [0, 100]');
    }
  }
});

test('wager options expose submitted counts without a synthetic baseline', () => {
  const wager = { id: 'test-vote-totals', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] };
  assert.deepEqual(buildWagerOptionsWithVotes(wager), [
    { id: 'a', text: 'A', count: 0, userVotes: 0, percent: 0 },
    { id: 'b', text: 'B', count: 0, userVotes: 0, percent: 0 },
  ]);
  assert.deepEqual(buildWagerOptionsWithVotes(wager, { a: 3, b: 1 }), [
    { id: 'a', text: 'A', count: 3, userVotes: 3, percent: 75 },
    { id: 'b', text: 'B', count: 1, userVotes: 1, percent: 25 },
  ]);
  assert.ok(buildWagerOptionsWithVotes(wager, { a: -1, b: Infinity }).every(option => option.count === 0));
});

test('detectWagerForEvent detects departure, standby, order scout, and arrangement beats', () => {
  // 1. Departure beat: Goaden and Ashai boarded the Streamliner to Sanctuary
  const departEvent = {
    id: 'evt:depart-sanctuary',
    type: 'TRAVEL_DEPART',
    description: 'Goaden and Ashai boarded the Streamliner on their way to Sanctuary.',
    occurredAt: NOW,
    payload: { from: 'mi6', to: 'sanctuary', arrivesAt: NOW + 25 * 60 * 1000 },
  };
  const departWager = detectWagerForEvent(departEvent, null, NOW);
  assert.ok(departWager, 'wager detected for departure');
  assert.equal(departWager.eventId, departEvent.id);
  assert.equal(departWager.accoladeTitle, ACCOLADES.SANCTUARY_ORACLE);
  assert.equal(departWager.status, 'open');
  assert.equal(departWager.closesAt, NOW + 25 * 60 * 1000);
  // It no longer asks where they are going, because the sentence it sits under
  // says where they are going. It asks the thing that is actually unsettled.
  assert.ok(!/where/i.test(departWager.question), departWager.question);
  assert.match(departWager.question, /afternoon they planned/i);
  assert.deepEqual(departWager.options.map(option => option.id).sort(), ['opt_kept', 'opt_recalled']);
  assert.equal(departWager.winningOptionId, 'opt_kept', 'no recall was queued, so the outing holds');

  // 2. Departure to Silver Spoon Cafe
  const cafeDepartEvent = {
    id: 'evt:depart-cafe',
    type: 'TRAVEL_DEPART',
    description: 'Goaden and Ashai boarded the Streamliner on their way to the Silver Spoon Cafe.',
    occurredAt: NOW,
    payload: { from: 'mi6', to: 'cafe', arrivesAt: NOW + 15 * 60 * 1000 },
  };
  const cafeWager = detectWagerForEvent(cafeDepartEvent, null, NOW);
  assert.ok(cafeWager);
  assert.equal(cafeWager.accoladeTitle, ACCOLADES.CHIMEWATCHER);
  assert.equal(cafeWager.winningOptionId, 'opt_kept');
  // With a recall already queued, the world's answer flips — and a viewer who
  // has noticed the Order is out could have called it.
  const recalled = detectWagerForEvent(cafeDepartEvent,
    { pendingActions: [{ type: 'OUTING_CUT_SHORT', dueAt: NOW + 30 * 60 * 1000 }] }, NOW);
  assert.equal(recalled.winningOptionId, 'opt_recalled');

  // 3. Standby / Alert beat: MEU scanners registered a surge
  const surgeEvent = {
    id: 'evt:surge-1',
    type: 'ARCANE_SURGE',
    description: 'MEU scanners registered a surge along the Thames corridor, and Goaden was called to stand by.',
    occurredAt: NOW,
  };
  const surgeWager = detectWagerForEvent(surgeEvent, null, NOW);
  assert.ok(surgeWager);
  assert.equal(surgeWager.accoladeTitle, ACCOLADES.MI6_INTUITIVE);
  assert.ok(surgeWager.closesAt > NOW);

  // 4. Order scout investigation beat
  const scoutEvent = {
    id: 'evt:scout-1',
    type: 'ENCOUNTER',
    description: 'Goaden spotted an Order scout watching from the arcade.',
    occurredAt: NOW,
  };
  const scoutWager = detectWagerForEvent(scoutEvent, null, NOW);
  assert.ok(scoutWager);
  assert.equal(scoutWager.accoladeTitle, ACCOLADES.BOROUGH_SLEUTH);

  // 5. Non-wager routine event returns null
  const quietEvent = {
    id: 'evt:quiet-meal',
    type: 'MEAL_BEGIN',
    description: 'Goaden stopped for breakfast.',
    occurredAt: NOW,
  };
  assert.equal(detectWagerForEvent(quietEvent, null, NOW), null);
});

test('socialStore manages wagers, votes, accolades, and strict closesAt enforcement', () => {
  const store = openSocialStore({ dbPath: ':memory:' });
  const eventId = 'evt:store-wager-test';

  const wagerData = {
    id: 'wager-test-1',
    eventId,
    question: 'Where is Ashai heading?',
    options: [
      { id: 'opt_sanctuary', text: 'Sanctuary in the Sky' },
      { id: 'opt_cafe', text: 'The Silver Spoon Cafe' },
      { id: 'opt_ink', text: 'Enchanted Ink' },
    ],
    closesAt: NOW + 30 * 60 * 1000,
    accoladeTitle: ACCOLADES.SANCTUARY_ORACLE,
    winningOptionId: 'opt_sanctuary',
    status: 'open',
    createdAt: NOW,
  };

  const created = store.createWager(wagerData);
  assert.equal(created.id, 'wager-test-1');
  assert.equal(created.status, 'open');
  assert.equal(created.options.length, 3);
  assert.equal(created.options.reduce((acc, o) => acc + o.percent, 0), 0);
  assert.equal(created.options.reduce((acc, o) => acc + o.count, 0), 0);

  // 1. Voting before closesAt works
  const vote1 = store.castWagerVote(created.id, 'traveller_alice', 'opt_sanctuary', NOW + 10_000);
  assert.equal(vote1.userVote, 'opt_sanctuary');
  assert.equal(vote1.options.find(option => option.id === 'opt_sanctuary').percent, 100);
  assert.equal(vote1.options.reduce((sum, option) => sum + option.count, 0), 1);

  const vote2 = store.castWagerVote(created.id, 'traveller_bob', 'opt_cafe', NOW + 20_000);
  assert.equal(vote2.userVote, 'opt_cafe');

  // Traveller Alice changes vote
  const vote1Updated = store.castWagerVote(created.id, 'traveller_alice', 'opt_ink', NOW + 30_000);
  assert.equal(vote1Updated.userVote, 'opt_ink');
  assert.equal(vote1Updated.options.reduce((sum, option) => sum + option.count, 0), 2,
    'changing a submitted vote does not increase the number of votes');
  assert.equal(vote1Updated.options.find(option => option.id === 'opt_sanctuary').count, 0);

  // Change back to winning prediction
  store.castWagerVote(created.id, 'traveller_alice', 'opt_sanctuary', NOW + 40_000);

  // 2. Strict Rule: Rejecting votes after closesAt
  const pastClosesAt = wagerData.closesAt + 1_000;
  assert.throws(() => {
    store.castWagerVote(created.id, 'traveller_late', 'opt_sanctuary', pastClosesAt);
  }, /WAGER_CLOSED/);

  // 3. Reject invalid option
  assert.throws(() => {
    store.castWagerVote(created.id, 'traveller_charlie', 'opt_invalid', NOW + 10_000);
  }, /INVALID_OPTION/);

  // 4. Reject empty travellerId
  assert.throws(() => {
    store.castWagerVote(created.id, '   ', 'opt_sanctuary', NOW + 10_000);
  }, /travellerId is required/);

  // 5. Evaluation and Accolade distribution
  const resResolved = store.resolveWager(created.id, 'opt_sanctuary', 'evt:resolving-arrival', pastClosesAt);
  assert.equal(resResolved.wager.status, 'resolved');
  assert.equal(resResolved.wager.winningOptionId, 'opt_sanctuary');
  assert.ok(resResolved.winners.includes('traveller_alice'));
  assert.ok(!resResolved.winners.includes('traveller_bob'), 'bob guessed cafe so does not win');

  // Verify Alice received the accolade
  const aliceAccolades = store.getAccolades('traveller_alice');
  assert.ok(aliceAccolades.includes(ACCOLADES.SANCTUARY_ORACLE));

  // Bob did not receive the accolade
  const bobAccolades = store.getAccolades('traveller_bob');
  assert.equal(bobAccolades.length, 0);

  // Querying wager with travellerId indicates userWon
  const aliceWagerView = store.getWager(created.id, 'traveller_alice', pastClosesAt);
  assert.equal(aliceWagerView.userWon, true);

  const bobWagerView = store.getWager(created.id, 'traveller_bob', pastClosesAt);
  assert.equal(bobWagerView.userWon, false);

  store.close();
});

test('Zero Railroading Invariant: community wager votes never alter simulation outcome', () => {
  const store = openSocialStore({ dbPath: ':memory:' });

  const wager = store.createWager({
    id: 'wager-no-railroad',
    eventId: 'evt:unrailroaded',
    question: 'Where is the Streamliner heading?',
    options: [
      { id: 'opt_sanctuary', text: 'Sanctuary in the Sky' },
      { id: 'opt_cafe', text: 'The Silver Spoon Cafe' },
    ],
    closesAt: NOW + 10_000,
    winningOptionId: 'opt_cafe', // Simulation canon truth: destination is cafe!
    accoladeTitle: ACCOLADES.CHIMEWATCHER,
    status: 'open',
  });

  // 100 travellers overwhelmingly vote for Sanctuary (99% votes)
  for (let i = 0; i < 100; i++) {
    store.castWagerVote(wager.id, `traveller_${i}`, 'opt_sanctuary', NOW + 1_000);
  }
  // Only 1 lone traveller votes for the actual canon truth (Cafe)
  store.castWagerVote(wager.id, 'lone_prophet', 'opt_cafe', NOW + 1_000);

  // Simulation resolves to what actually happened (Cafe), completely ignoring vote popularity
  const resolution = store.resolveWager(wager.id, 'opt_cafe', 'evt:arrived-cafe', NOW + 15_000);
  assert.equal(resolution.wager.winningOptionId, 'opt_cafe');
  assert.equal(resolution.winners.length, 1);
  assert.equal(resolution.winners[0], 'lone_prophet');

  // The 100 travellers who voted for Sanctuary did not derail the story and did not win
  assert.equal(store.getAccolades('traveller_0').length, 0);
  assert.ok(store.getAccolades('lone_prophet').includes(ACCOLADES.CHIMEWATCHER));

  store.close();
});

test('getTodayHighlight identifies the beat with highest interaction velocity for current London date', () => {
  const store = openSocialStore({ dbPath: ':memory:' });
  const dateStr = '2026-09-04';

  const events = [
    { id: 'evt:today-quiet', occurredAt: Date.parse('2026-09-04T09:00:00Z'), description: 'Quiet tea.' },
    { id: 'evt:today-hot', occurredAt: Date.parse('2026-09-04T12:00:00Z'), description: 'Viaduct standoff.' },
    { id: 'evt:yesterday', occurredAt: Date.parse('2026-09-03T18:00:00Z'), description: 'Yesterday event.' },
  ];

  // Add 10 reactions to hot event
  for (let i = 0; i < 10; i++) {
    store.addReaction('evt:today-hot', 'love', 1);
  }
  // Add 3 comments to hot event
  store.addComment('evt:today-hot', { text: 'Incredible suspense!' });
  store.addComment('evt:today-hot', { text: 'Will Goaden draw Vega?!' });
  store.addComment('evt:today-hot', { text: 'Order scouts are everywhere.' });

  // Add huge interactions to yesterday's event (should NOT be picked for today's highlight)
  for (let i = 0; i < 50; i++) {
    store.addReaction('evt:yesterday', 'love', 1);
  }

  const highlight = store.getTodayHighlight(events, dateStr, Date.parse('2026-09-04T15:00:00Z'));
  assert.equal(highlight.date, dateStr);
  assert.equal(highlight.eventId, 'evt:today-hot');
  assert.equal(highlight.totalInteractions, 16, '10 submitted reactions and 3 reader comments, weighted twice');
  assert.equal(highlight.totalComments, 3);
  assert.equal(highlight.event.id, 'evt:today-hot');

  store.close();
});

// Server REST API Integration Tests
async function wagerServerFixture(t) {
  const eventDeparture = {
    id: 'evt:api-depart-1',
    type: 'TRAVEL_DEPART',
    occurredAt: NOW,
    location: 'streamliner',
    description: 'Goaden and Ashai boarded the Streamliner on their way to Sanctuary.',
    payload: { from: 'mi6', to: 'sanctuary', arrivesAt: NOW + 15 * 60 * 1000 },
  };
  const eventRoutine = {
    id: 'evt:api-routine-1',
    type: 'MEAL_BEGIN',
    occurredAt: NOW - 30 * 60 * 1000,
    location: 'mi6',
    description: 'Quiet meal at the barracks.',
  };

  const world = {
    advance() {},
    publicProjection() {
      return {
        worldId: 'test-wager-world',
        resolvedThrough: NOW,
        events: [eventRoutine, eventDeparture],
      };
    },
    semanticSnapshot() {
      return {
        events: [eventRoutine, eventDeparture],
        pendingActions: [
          {
            id: 'arrival-action-1',
            type: 'TRAVEL_ARRIVE',
            dueAt: NOW + 15 * 60 * 1000,
            to: 'sanctuary',
            departureEventId: eventDeparture.id,
          },
        ],
      };
    },
  };

  const socialStore = openSocialStore({ dbPath: ':memory:' });
  let serverTime = NOW;
  const server = createApp({ world, socialStore, now: () => serverTime });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;

  t.after(async () => {
    socialStore.close();
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  return {
    base,
    socialStore,
    eventDeparture,
    eventRoutine,
    setServerTime: (t) => { serverTime = t; },
  };
}

test('server endpoints support GET wager, POST wager/vote, and GET highlights/today', async (t) => {
  const f = await wagerServerFixture(t);
  const departId = f.eventDeparture.id;

  // 1. GET /api/events/:id/wager for event with prophecy wager
  const resWager = await fetch(`${f.base}/api/events/${encodeURIComponent(departId)}/wager?travellerId=spec_1`);
  assert.equal(resWager.status, 200);
  const dataWager = await resWager.json();
  assert.ok(dataWager.wager);
  assert.equal(dataWager.wager.eventId, departId);
  assert.equal(dataWager.wager.status, 'open');
  assert.equal(dataWager.wager.accoladeTitle, ACCOLADES.SANCTUARY_ORACLE);
  // Two, not three: the journey question is now a yes/no about whether the
  // outing survives, rather than a five-way guess at a destination the feed
  // has already printed.
  assert.equal(dataWager.wager.options.length, 2);
  assert.ok(!/where/i.test(dataWager.wager.question), dataWager.wager.question);
  assert.equal(dataWager.wager.userVote, null);
  assert.ok(dataWager.wager.options.every(option => option.count === 0 && option.percent === 0));

  // 2. GET /api/events/:id/wager for routine event returns { wager: null }
  const resNoWager = await fetch(`${f.base}/api/events/${encodeURIComponent(f.eventRoutine.id)}/wager`);
  assert.equal(resNoWager.status, 200);
  const dataNoWager = await resNoWager.json();
  assert.equal(dataNoWager.wager, null);

  // 3. POST /api/events/:id/wager/vote casts vote
  const resVote = await fetch(`${f.base}/api/events/${encodeURIComponent(departId)}/wager/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      travellerId: 'spec_1',
      optionId: 'opt_kept',
    }),
  });
  assert.equal(resVote.status, 200);
  const dataVote = await resVote.json();
  assert.equal(dataVote.success, true);
  assert.equal(dataVote.userVote, 'opt_kept');
  assert.ok(dataVote.wager);

  // Verify that GET with travellerId now reflects userVote
  const resWagerUpdated = await fetch(`${f.base}/api/events/${encodeURIComponent(departId)}/wager?travellerId=spec_1`);
  const dataWagerUpdated = await resWagerUpdated.json();
  assert.equal(dataWagerUpdated.wager.userVote, 'opt_kept');
  assert.equal(dataWagerUpdated.wager.options.find(option => option.id === 'opt_kept').count, 1);
  assert.equal(dataWagerUpdated.wager.options.find(option => option.id === 'opt_kept').percent, 100);
  assert.equal(dataWagerUpdated.wager.options.find(option => option.id === 'opt_recalled').count, 0);

  // 4. Strict Rule: Reject late vote after closesAt
  f.setServerTime(NOW + 20 * 60 * 1000); // 20 mins later, past 15 min closesAt
  const resLateVote = await fetch(`${f.base}/api/events/${encodeURIComponent(departId)}/wager/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      travellerId: 'spec_late',
      optionId: 'opt_kept',
    }),
  });
  assert.equal(resLateVote.status, 400);
  const lateError = await resLateVote.json();
  assert.match(lateError.error, /closed/i);

  // 5. GET /api/highlights/today
  const resHighlight = await fetch(`${f.base}/api/highlights/today`);
  assert.equal(resHighlight.status, 200);
  const dataHighlight = await resHighlight.json();
  assert.ok(dataHighlight.date);

  // 6. GET /api/travellers/:id/accolades
  const resAccolades = await fetch(`${f.base}/api/travellers/spec_1/accolades`);
  assert.equal(resAccolades.status, 200);
  const dataAccolades = await resAccolades.json();
  assert.equal(dataAccolades.travellerId, 'spec_1');
  assert.ok(Array.isArray(dataAccolades.accolades));
});

test('calculatePercentages edge cases: empty input returns empty array', () => {
  assert.deepEqual(calculatePercentages([]), []);
  assert.deepEqual(calculatePercentages(null), []);
});

test('a wager is never asked when the feed has already answered it', () => {
  // The defect: the Streamliner wager derived its winner from the event's own
  // description — `desc.includes('ink')` — so the audience was asked to guess
  // something the line directly above the poll had just told them.
  const plazaEvent = {
    id: 'evt:depart-plaza',
    type: 'TRAVEL_DEPART',
    description: 'Goaden and Ashai boarded the Streamliner on their way to the New Big Ben plaza.',
    occurredAt: NOW,
    payload: { from: 'mi6', to: 'big_ben_plaza', arrivesAt: NOW + 10 * 60 * 1000 },
  };
  const wager = detectWagerForEvent(plazaEvent, null, NOW);
  assert.ok(wager, 'a journey should still carry a question');
  assert.ok(!wager.options.some(option => /plaza|big ben/i.test(option.text)),
    'the poll still offers the destination it just announced');

  // The gate itself, on a constructed case: an option whose distinctive words
  // are all already in print is refused outright.
  const giveaway = {
    id: 'evt:giveaway', type: 'TRAVEL_DEPART', occurredAt: NOW,
    description: 'Goaden and Ashai boarded the Streamliner on their way to Enchanted Ink.',
  };
  assert.equal(answerAlreadyPublic(
    { winningOptionId: 'a', options: [{ id: 'a', text: 'Enchanted Ink' }] }, giveaway, null), true);
  assert.equal(answerAlreadyPublic(
    { winningOptionId: 'a', options: [{ id: 'a', text: 'Sanctuary in the Sky' }] }, giveaway, null), false);
  // Earlier published events count too — the answer being two lines up is no
  // better than it being one line up.
  const snapshot = { events: [{ visibility: 'public', occurredAt: NOW - 1000,
    description: 'Goaden and Ashai arranged a visit to Enchanted Ink, the moving tattoo parlour.' }] };
  assert.equal(answerAlreadyPublic(
    { winningOptionId: 'a', options: [{ id: 'a', text: 'Enchanted Ink' }] },
    { id: 'x', description: 'They boarded the Streamliner.', occurredAt: NOW }, snapshot), true);
});

test('a return journey carries no wager at all', () => {
  // There is nothing to ask about going home.
  const home = {
    id: 'evt:return', type: 'TRAVEL_DEPART', occurredAt: NOW,
    description: 'Goaden and Ashai boarded the Streamliner on their return to MI6.',
    payload: { from: 'cafe', to: 'mi6', arrivesAt: NOW + 10 * 60 * 1000 },
  };
  assert.equal(detectWagerForEvent(home, null, NOW), null);
});

test('getTodayHighlight returns null eventId when no candidate events match the date', () => {
  const store = openSocialStore({ dbPath: ':memory:' });
  const dateStr = '2026-09-04';
  const events = [
    { id: 'evt:yesterday', occurredAt: Date.parse('2026-09-03T18:00:00Z'), description: 'Yesterday event.' },
  ];

  const highlight = store.getTodayHighlight(events, dateStr, Date.parse('2026-09-04T15:00:00Z'));
  assert.equal(highlight.date, dateStr);
  assert.equal(highlight.eventId, null, 'no highlight event if no events match today');
  assert.equal(highlight.totalInteractions, 0);
  assert.equal(highlight.event, null);

  store.close();
});

test('castWagerVote rejects votes on wagers that have already resolved', () => {
  const store = openSocialStore({ dbPath: ':memory:' });
  const wager = store.createWager({
    id: 'wager-already-resolved',
    eventId: 'evt:resolved-test',
    question: 'What happens?',
    options: [
      { id: 'opt_1', text: 'Option 1' },
      { id: 'opt_2', text: 'Option 2' },
    ],
    closesAt: NOW + 30 * 60 * 1000,
    status: 'open',
    createdAt: NOW,
  });

  // Resolve wager early
  store.resolveWager(wager.id, 'opt_1', 'evt:resolution-1', NOW + 5_000);

  // Attempt to vote before closesAt, but after resolution
  assert.throws(() => {
    store.castWagerVote(wager.id, 'traveller_late', 'opt_1', NOW + 10_000);
  }, /WAGER_CLOSED/);

  store.close();
});
