import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import {
  isHighStakesEvent,
  formatHighStakesPing,
  scoreEventSalience,
  curateDailyEvents,
  buildFactionRoundup,
  buildLintelFlock,
  synthesizeLeadHeadline,
  formatDispatchPlainText,
  buildBroadsheet,
  getDispatchByDate,
  getLatestDispatch,
  formatLocationName,
  formatLondonTime,
  formatLondonDateFull,
} from '../src/dispatch.mjs';
import { atLondon, nextLondonDay, prevLondonDay, londonDate } from '../src/time.mjs';
import { openSocialStore } from '../src/social-store.mjs';
import { createApp } from '../server.mjs';

const NOW = Date.parse('2026-09-04T14:30:00.000Z');

// ============================================================================
// 1. High-Stakes Raven Filter (Urgent Courier Notifications)
// ============================================================================
test('isHighStakesEvent strictly rejects ordinary routines', () => {
  const routineEvents = [
    { id: 'ev1', type: 'MEAL_BEGIN', description: 'Goaden had breakfast at the MI6 mess.' },
    { id: 'ev2', type: 'MEAL_END', description: 'Ashai finished her morning tea.' },
    { id: 'ev3', type: 'PRACTICE_BEGIN', description: 'Goaden began form practice in the yard.' },
    { id: 'ev4', type: 'PRACTICE_END', description: 'Form practice completed.' },
    { id: 'ev5', type: 'REST_BEGIN', description: 'Ashai sat by the open window to rest.' },
    { id: 'ev6', type: 'WAIT_BEGIN', description: 'Waiting for the 14:00 courier.' },
    { id: 'ev7', type: 'QUIET_TIME_BEGIN', description: 'Quiet hour in the quarters.' },
    { id: 'ev8', type: 'TV_BEGIN', description: 'Goaden switched on the broadcast.' },
    { id: 'ev9', type: 'PIANO_BEGIN', description: 'Playing quiet chords on the upright.' },
    { id: 'ev10', type: 'MUSIC_LISTEN_BEGIN', description: 'Listening to an old record.' },
    { id: 'ev11', type: 'GAME_BEGIN', description: 'A game of Presence Chess opened.' },
    { id: 'ev12', type: 'GAME_PAUSE', description: 'Presence board set aside.' },
    { id: 'ev13', type: 'GAME_RESUME', description: 'Resumed the adjourned game.' },
    { id: 'ev14', type: 'ACTIVITY_COMPLETE', description: 'Routine duty concluded.' },
    { id: 'ev15', type: 'PRACTICE_SLOT_NOTICE', description: 'Sparring ring reserved for 16:00.' },
    { id: 'ev16', type: 'sleeping', description: 'Asleep in the barracks.' },
    { id: 'ev17', type: 'SLEEP_BEGIN', description: 'Goaden turned in for the night.' },
    { id: 'ev18', type: 'SLEEP_END', description: 'Waking with the dawn chime.' },
    { id: 'ev19', type: 'REST', description: 'Resting in the corner chair.' },
    { id: 'ev20', type: 'IDLE', description: 'Pausing in the hallway.' },
  ];

  for (const ev of routineEvents) {
    assert.equal(isHighStakesEvent(ev), false, `routine event ${ev.type} must be rejected`);
  }
});

test('isHighStakesEvent flags narrative catalysts and rare Veil milestones', () => {
  // Catalysts
  const surge = {
    id: 'c1',
    type: 'ARCANE_SURGE',
    description: 'MEU scanners registered a sudden violet frequency spike along the Thames reach.',
  };
  assert.equal(isHighStakesEvent(surge), true, 'ARCANE_SURGE is high stakes');

  const broken = {
    id: 'c2',
    type: 'PLAN_BROKEN',
    description: 'Scheduled evening movements cancelled under emergency duty callout.',
  };
  assert.equal(isHighStakesEvent(broken), true, 'PLAN_BROKEN is high stakes');

  const cutShort = {
    id: 'c3',
    type: 'OUTING_CUT_SHORT',
    description: 'Ashai and Goaden cut short their visit to Enchanted Ink under operational recall.',
  };
  assert.equal(isHighStakesEvent(cutShort), true, 'OUTING_CUT_SHORT is high stakes');

  const standby = {
    id: 'c4',
    type: 'STANDBY_BEGIN',
    description: 'Whitehall issued a Code Amber standby order across Southwark.',
  };
  assert.equal(isHighStakesEvent(standby), true, 'STANDBY_BEGIN is high stakes');

  const briefing = {
    id: 'c5',
    type: 'BRIEFING_BEGIN',
    description: 'MI6 Inner Circle convened for an unannounced situational briefing.',
  };
  assert.equal(isHighStakesEvent(briefing), true, 'BRIEFING_BEGIN is high stakes');

  // Veil Milestones
  const veilMilestone = {
    id: 'v1',
    type: 'INSTITUTION_NOTICE',
    description: 'The Church opened annual Celestial Veil countdown rites at New Big Ben.',
    isVeilMilestone: true,
  };
  assert.equal(isHighStakesEvent(veilMilestone), true, 'isVeilMilestone is high stakes');

  const veilFaction = {
    id: 'v2',
    type: 'FACTION_STATUS',
    description: 'The Church announced the upcoming Celestial Veil cycle schedule.',
  };
  assert.equal(isHighStakesEvent(veilFaction), true, 'Veil cycle faction update is high stakes');

  // Alert
  const alertEvt = {
    id: 'a1',
    type: 'ALERT',
    description: 'MEU perimeter sensor breach flagged along Wapping Slipway.',
  };
  assert.equal(isHighStakesEvent(alertEvt), true, 'ALERT is high stakes');

  // Null / non-object edge cases
  assert.equal(isHighStakesEvent(null), false);
  assert.equal(isHighStakesEvent(undefined), false);
  assert.equal(isHighStakesEvent('not-an-event'), false);
});

test('formatHighStakesPing produces formatted in-world courier notices', () => {
  const pingSurge = formatHighStakesPing({ type: 'ARCANE_SURGE', description: 'Harmonic surge.' });
  assert.match(pingSurge, /⚡ URGENT DISPATCH/);
  assert.equal(pingSurge, '⚡ URGENT DISPATCH: Harmonic surge.');

  const pingBroken = formatHighStakesPing({ type: 'PLAN_BROKEN', description: 'Callout.' });
  assert.match(pingBroken, /⚡ URGENT DISPATCH/);
  assert.equal(pingBroken, '⚡ URGENT DISPATCH: Callout.');

  const pingOuting = formatHighStakesPing({ type: 'OUTING_CUT_SHORT', description: 'Curtailed.' });
  assert.match(pingOuting, /⚡ URGENT DISPATCH/);
  assert.equal(pingOuting, '⚡ URGENT DISPATCH: Curtailed.');

  assert.equal(formatHighStakesPing(null), null);
});

// ============================================================================
// 2. Salience Scoring & Deterministic Event Curation
// ============================================================================
test('scoreEventSalience orders catalysts over conversations over routines', () => {
  const surge = { type: 'ARCANE_SURGE', description: 'Arcane surge along the Thames' };
  const alert = { type: 'ALERT', description: 'Perimeter alert at Wapping' };
  const broken = { type: 'PLAN_BROKEN', description: 'Plan broken by duty callout' };
  const convo = { type: 'CONVERSATION', lines: [{ who: 'goaden', text: 'Check the gate.' }] };
  const routine = { type: 'MEAL_BEGIN', description: 'Breakfast at the barracks' };

  assert.ok(scoreEventSalience(surge) > scoreEventSalience(broken));
  assert.ok(scoreEventSalience(broken) > scoreEventSalience(convo));
  assert.ok(scoreEventSalience(convo) > scoreEventSalience(routine));
  assert.ok(scoreEventSalience(routine) <= 5);
});

test('curateDailyEvents deterministically selects top 3–5 highest-salience events', () => {
  const targetDate = '2026-09-04';
  const baseTime = atLondon(targetDate, '08:00');

  const mixedEvents = [
    { id: 'e_meal_1', occurredAt: baseTime + 10_000, type: 'MEAL_BEGIN', description: 'Breakfast.' },
    { id: 'e_practice_1', occurredAt: baseTime + 20_000, type: 'PRACTICE_BEGIN', description: 'Form practice.' },
    { id: 'e_convo_1', occurredAt: baseTime + 30_000, type: 'CONVERSATION', lines: [{ who: 'ashai', text: 'Look at the bells.' }] },
    { id: 'e_standby', occurredAt: baseTime + 40_000, type: 'STANDBY_BEGIN', description: 'Standby ordered in Whitehall.' },
    { id: 'e_surge', occurredAt: baseTime + 50_000, type: 'ARCANE_SURGE', description: 'Thames harmonic surge.' },
    { id: 'e_broken', occurredAt: baseTime + 60_000, type: 'PLAN_BROKEN', description: 'Evening plan broken.' },
    { id: 'e_scout', occurredAt: baseTime + 70_000, type: 'ENCOUNTER', description: 'Holy Order scout spotted by viaduct.' },
    { id: 'e_meal_2', occurredAt: baseTime + 80_000, type: 'MEAL_BEGIN', description: 'Evening tea.' },
    { id: 'e_sleep', occurredAt: baseTime + 90_000, type: 'SLEEP_BEGIN', description: 'Sleep.' },
  ];

  const curated = curateDailyEvents(mixedEvents, targetDate);

  // Must select 3–5 events
  assert.ok(curated.length >= 3 && curated.length <= 5, `curated count ${curated.length} in [3, 5]`);

  // Top events MUST be the high-salience ones
  const curatedIds = curated.map((e) => e.id);
  assert.ok(curatedIds.includes('e_surge'), 'contains surge');
  assert.ok(curatedIds.includes('e_broken'), 'contains broken plan');
  assert.ok(curatedIds.includes('e_standby'), 'contains standby order');
  assert.ok(curatedIds.includes('e_scout'), 'contains Order scout encounter');

  // Routine events MUST be excluded when higher salience events exist
  assert.ok(!curatedIds.includes('e_meal_1'), 'excludes breakfast');
  assert.ok(!curatedIds.includes('e_meal_2'), 'excludes tea');
  assert.ok(!curatedIds.includes('e_sleep'), 'excludes sleep');

  // Deterministic Repeatability
  const repeat = curateDailyEvents(mixedEvents, targetDate);
  assert.deepEqual(repeat, curated, 'curation is 100% deterministic and repeatable');
});

test('curateDailyEvents handles small event counts gracefully', () => {
  const targetDate = '2026-09-04';
  const baseTime = atLondon(targetDate, '10:00');

  // Case 1: exactly 2 events exist
  const twoEvents = [
    { id: 'ev_a', occurredAt: baseTime, type: 'ARCANE_SURGE', description: 'Surge.' },
    { id: 'ev_b', occurredAt: baseTime + 1000, type: 'CONVERSATION', lines: [{ who: 'ashai', text: 'Cold.' }] },
  ];
  const resTwo = curateDailyEvents(twoEvents, targetDate);
  assert.equal(resTwo.length, 2);

  // Case 2: exactly 4 events exist
  const fourEvents = [
    { id: 'ev_1', occurredAt: baseTime, type: 'ARCANE_SURGE', description: 'Surge.' },
    { id: 'ev_2', occurredAt: baseTime + 1000, type: 'STANDBY_BEGIN', description: 'Standby.' },
    { id: 'ev_3', occurredAt: baseTime + 2000, type: 'PLAN_BROKEN', description: 'Broken.' },
    { id: 'ev_4', occurredAt: baseTime + 3000, type: 'CONVERSATION', lines: [{ who: 'goaden', text: 'Go.' }] },
  ];
  const resFour = curateDailyEvents(fourEvents, targetDate);
  assert.equal(resFour.length, 4);

  // Case 3: 0 events exist
  assert.deepEqual(curateDailyEvents([], targetDate), []);
  assert.deepEqual(curateDailyEvents(null, targetDate), []);
});

// ============================================================================
// 3. Broadsheet Data Structure & Faction Roundup
// ============================================================================
test('buildFactionRoundup includes all 6 canonical factions and reflects world state', () => {
  const factionsData = {
    mi6: 'elevated',
    order: 'active_in_city',
    church: 'veil_cycle',
    sanctuary: 'invited_guests',
    streamliner: 'minor_delays',
    arcane: 'high',
  };

  const roundup = buildFactionRoundup(factionsData, [{ type: 'ARCANE_SURGE', description: 'Thames surge' }]);

  // Check all 6 factions exist
  assert.ok(roundup.mi6, 'MI6 present');
  assert.ok(roundup.order, 'The Holy Order present');
  assert.ok(roundup.church, 'The Church present');
  assert.ok(roundup.sanctuary, 'Sanctuary present');
  assert.ok(roundup.streamliner, 'The Streamliner present');
  assert.ok(roundup.arcane, 'Arcane present');

  // Verify status content
  assert.equal(roundup.mi6.tone, 'alert');
  assert.match(roundup.mi6.status, /Heightened/i);

  assert.equal(roundup.order.tone, 'alert');
  assert.match(roundup.order.status, /Active In City/i);

  assert.match(roundup.church.status, /Veil Cycle/i);
  assert.match(roundup.sanctuary.status, /Sky Lounge/i);
  assert.match(roundup.streamliner.status, /Minor delays/i);
  assert.match(roundup.arcane.status, /High arcane activity/i);
});

test('buildLintelFlock derives flock observation from sky and arcane resonance', () => {
  // Calm baseline
  const flockCalm = buildLintelFlock({ lintels: 1 }, {}, []);
  assert.equal(flockCalm.count, 1);
  assert.match(flockCalm.observation, /Solitary Lintel/i);

  // Arcane surge state
  const flockSurge = buildLintelFlock({ lintels: 4 }, {}, [{ type: 'ARCANE_SURGE' }]);
  assert.ok(flockSurge.count >= 4);
  assert.match(flockSurge.observation, /4 Lintels/i);
  assert.equal(flockSurge.reading, 'Over London');
});

test('buildBroadsheet formats complete Victorian gazette structure', () => {
  const targetDate = '2026-09-04';
  const baseTime = atLondon(targetDate, '14:00');

  const events = [
    {
      id: 'evt:surge-99',
      occurredAt: baseTime,
      location: 'streamliner',
      type: 'ARCANE_SURGE',
      description: 'MEU scanners registered a harmonic surge across the Thames corridor.',
    },
    {
      id: 'evt:standby-99',
      occurredAt: baseTime + 10 * 60 * 1000,
      location: 'mi6',
      type: 'STANDBY_BEGIN',
      description: 'Whitehall sentries were placed on heightened alert.',
    },
    {
      id: 'evt:convo-99',
      occurredAt: baseTime + 20 * 60 * 1000,
      location: 'cafe',
      type: 'CONVERSATION',
      description: 'Goaden and Ashai spoke quietly over cinnamon tea.',
      lines: [{ who: 'goaden', text: 'The river was humming.' }],
    },
  ];

  const worldMock = {
    publicProjection() {
      return {
        weather: { code: 'heavy_rain', description: 'Heavy rain', temperatureC: 11 },
        sky: { lintels: 4 },
        factions: { mi6: 'elevated', order: 'watchful', church: 'preparations', sanctuary: 'routine', streamliner: 'normal', arcane: 'high' },
      };
    },
  };

  const broadsheet = buildBroadsheet({
    events,
    date: targetDate,
    serverTime: atLondon(targetDate, '15:00'),
    world: worldMock,
    clientOrigin: 'http://127.0.0.1:4317',
  });

  // 1. Core metadata
  assert.equal(broadsheet.id, 'dispatch-2026-09-04');
  assert.equal(broadsheet.date, targetDate);
  assert.equal(broadsheet.formattedDate, 'Friday, 4 September 2026');
  assert.match(broadsheet.issueNumber, /^#\d+$/);

  // 2. Masthead
  assert.equal(broadsheet.masthead.publication, 'The London Borough Gazette');
  assert.equal(broadsheet.masthead.subtitle, 'MI6 Morning Intelligence & Civic Broadsheet');
  assert.equal(broadsheet.masthead.weather.description, 'Heavy rain');
  assert.equal(broadsheet.masthead.weather.temperatureC, 11);
  assert.match(broadsheet.masthead.dayPhase, /Morning Edition/i);

  // 3. Lead Headline
  assert.match(broadsheet.leadHeadline, /THAMES HARMONIC SURGE/i);

  // 4. Chronicle Briefs
  assert.equal(broadsheet.chronicleBriefs.length, 3);
  for (const b of broadsheet.chronicleBriefs) {
    assert.ok(b.eventId, 'brief has eventId');
    assert.ok(b.time, 'brief has time');
    assert.ok(b.location, 'brief has location');
    assert.ok(b.headline, 'brief has headline');
    assert.ok(b.text, 'brief has text');
    assert.ok(['critical', 'notable', 'civic'].includes(b.salienceTier));
  }

  // 5. Faction Roundup
  assert.equal(Object.keys(broadsheet.factionRoundup).length, 6);
  assert.equal(broadsheet.factionRoundup.mi6.tone, 'alert');

  // 6. Lintel Flock
  assert.equal(broadsheet.lintelFlock.count, 4);

  // 7. Plain Text Summary (for "Share Dispatch" button)
  assert.ok(broadsheet.plainTextSummary.length > 50);
  assert.match(broadsheet.plainTextSummary, /THE LONDON BOROUGH GAZETTE/);
  assert.match(broadsheet.plainTextSummary, /LEAD:/);
  assert.match(broadsheet.plainTextSummary, /CHRONICLE BRIEFS:/);
  assert.match(broadsheet.plainTextSummary, /FACTION STATUS ROUNDUP:/);
  assert.match(broadsheet.plainTextSummary, /LINTEL FLOCK OBSERVATION:/);
  assert.match(broadsheet.plainTextSummary, /http:\/\/127\.0\.0\.1:4317\/#dispatch-2026-09-04/);
});

// ============================================================================
// Server Endpoints Integration Tests (private audience tests are separate)
// ============================================================================
async function dispatchServerFixture(t) {
  const testDate = '2026-09-04';
  const baseTime = atLondon(testDate, '12:00');

  const events = [
    {
      id: 'evt:dispatch-surge-1',
      occurredAt: baseTime + 10_000,
      location: 'streamliner',
      type: 'ARCANE_SURGE',
      description: 'MEU perimeter scanners registered an arcane surge at Wapping Reach.',
    },
    {
      id: 'evt:dispatch-broken-1',
      occurredAt: baseTime + 20_000,
      location: 'mi6',
      type: 'PLAN_BROKEN',
      description: 'Goaden cancelled night patrol under operational recall.',
    },
    {
      id: 'evt:dispatch-convo-1',
      occurredAt: baseTime + 30_000,
      location: 'cafe',
      type: 'CONVERSATION',
      description: 'Ashai and Goaden discussed the unusual church chimes.',
      lines: [{ who: 'ashai', text: 'Three bells off key.' }],
    },
  ];

  const world = {
    advance() {},
    publicProjection() {
      return {
        worldId: 'dispatch-test-world',
        resolvedThrough: baseTime + 40_000,
        weather: { code: 'light_rain', description: 'Light rain', temperatureC: 12 },
        sky: { lintels: 3 },
        factions: {
          mi6: 'elevated',
          order: 'watchful',
          church: 'preparations',
          sanctuary: 'routine',
          streamliner: 'normal',
          arcane: 'high',
        },
        characters: [],
        events,
      };
    },
    // The dispatch reads the whole log through the fixture's public allowlist
    // rather than the forty-event feed, so the archive does not go blank three
    // days back. That means the stub has to hand back *semantic* events —
    // visibility and publicDescription and all — rather than feed-shaped ones,
    // or it is not exercising the path the server actually takes.
    semanticSnapshot() {
      return {
        events: events.map(event => ({
          ...event, visibility: 'public', publicDescription: event.description,
          participants: event.participants ?? [], area: event.area ?? null,
          payload: event.lines ? { lines: event.lines } : (event.payload ?? {}),
        })),
        pendingActions: [],
      };
    },
  };

  const socialStore = openSocialStore({ dbPath: ':memory:' });
  let serverTime = atLondon(testDate, '13:00'); // The source events have occurred.
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
    world,
    socialStore,
    events,
    setServerTime: (t) => { serverTime = t; },
  };
}

test('server endpoints serve GET /api/dispatch/latest and GET /api/dispatch/:date', async (t) => {
  const f = await dispatchServerFixture(t);

  // 1. GET /api/dispatch/latest
  const resLatest = await fetch(`${f.base}/api/dispatch/latest`);
  assert.equal(resLatest.status, 200);
  const latestData = await resLatest.json();
  assert.equal(latestData.date, '2026-09-04');
  assert.equal(latestData.masthead.publication, 'The London Borough Gazette');
  assert.match(latestData.leadHeadline, /ARCANE SURGE/i);
  assert.ok(latestData.chronicleBriefs.length >= 3);
  assert.equal(Object.keys(latestData.factionRoundup).length, 6);
  assert.ok(latestData.plainTextSummary.length > 50);

  // 2. GET /api/dispatch/:date for valid date
  const resDate = await fetch(`${f.base}/api/dispatch/2026-09-04`);
  assert.equal(resDate.status, 200);
  const dateData = await resDate.json();
  assert.equal(dateData.date, '2026-09-04');
  assert.equal(dateData.id, 'dispatch-2026-09-04');

  // 3. GET /api/dispatch/:date with invalid date format returns 400
  const resBadDate = await fetch(`${f.base}/api/dispatch/invalid-date-format`);
  assert.equal(resBadDate.status, 400);
  const badDateError = await resBadDate.json();
  assert.match(badDateError.error, /Invalid date format/i);

  // 4. Method not allowed (POST to dispatch/latest) returns 405
  const resPost = await fetch(`${f.base}/api/dispatch/latest`, { method: 'POST' });
  assert.equal(resPost.status, 405);
});

test('public presence acknowledges liveness without revealing or fabricating audience counts', async (t) => {
  const f = await dispatchServerFixture(t);

  // 1. GET /api/presence
  const resPresence = await fetch(`${f.base}/api/presence`);
  assert.equal(resPresence.status, 200);
  const pData = await resPresence.json();
  assert.equal(pData.ok, true);
  assert.deepEqual(Object.keys(pData).sort(), ['ok', 'serverTime']);

  // 2. POST /api/presence/ping records activity
  const resPing = await fetch(`${f.base}/api/presence/ping`, {
    method: 'POST',
    headers: { 'x-client-id': 'spectator-client-2' },
  });
  assert.equal(resPing.status, 200);
  const pingData = await resPing.json();
  assert.equal(typeof pingData.viewerToken, 'string');
  assert.deepEqual(Object.keys(pingData).sort(), ['ok', 'serverTime', 'viewerToken']);

  // 3. GET /api/world does not expose audience telemetry.
  const resWorld = await fetch(`${f.base}/api/world`);
  assert.equal(resWorld.status, 200);
  const worldData = await resWorld.json();
  assert.equal(Object.hasOwn(worldData, 'presence'), false);
});

test('GET /api/dispatch/latest serves completed previous day dispatch in early small hours', () => {
  const worldMock = {
    publicProjection() {
      return {
        events: [
          {
            id: 'evt:yesterday-1',
            occurredAt: atLondon('2026-09-04', '21:00'),
            type: 'ARCANE_SURGE',
            description: 'Night surge.',
          },
        ],
      };
    },
  };

  // At 03:30 AM on 5 Sept, targetDate should be 4 Sept (yesterday's completed chronicle)
  const timeSmallHours = atLondon('2026-09-05', '03:30');
  const dispatch = getLatestDispatch(worldMock, timeSmallHours);
  assert.equal(dispatch.date, '2026-09-04', 'small hours serves previous day morning broadsheet');
  assert.equal(dispatch.id, 'dispatch-2026-09-04');
});

// ============================================================================
// 6. Refresh Persistence & Hash URL Contract Verification
// ============================================================================
test('social interactions, wagers, and accolades persist across server restarts / reloads', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const tempDir = mkdtempSync(join(tmpdir(), 'silver-clouds-refresh-test-'));
  const dbPath = join(tempDir, 'persist.sqlite');

  try {
    // 1. First session: User reacts, comments, votes on wager, receives accolade
    const store1 = openSocialStore({ dbPath });
    const eventId = 'evt:refresh-test-1';

    store1.addReaction(eventId, 'love', 2);
    store1.addReaction(eventId, 'wow', 1);
    store1.addComment(eventId, {
      text: 'Observing the viaduct before midnight.',
      traveller: { name: 'PersistenceTester', holyItem: 'Astra', guardian: 'Nyx', title: 'MI6 Archivist' },
    });

    const wager = store1.createWager({
      id: 'wager:refresh-1',
      eventId,
      question: 'Where is the Streamliner heading?',
      options: [
        { id: 'opt_sanctuary', text: 'Sanctuary in the Sky' },
        { id: 'opt_cafe', text: 'The Silver Spoon Cafe' },
      ],
      closesAt: NOW + 10_000,
      winningOptionId: 'opt_sanctuary',
      accoladeTitle: 'Sanctuary Oracle',
    });

    store1.castWagerVote(wager.id, 'traveller_persist', 'opt_sanctuary', NOW + 1_000);
    store1.resolveWager(wager.id, 'opt_sanctuary', 'evt:resolve-1', NOW + 15_000);

    const accolades1 = store1.getAccolades('traveller_persist');
    assert.ok(accolades1.includes('Sanctuary Oracle'));

    store1.close();

    // 2. Second session (Page Refresh / Server Reopen)
    const store2 = openSocialStore({ dbPath });

    // Reactions strictly preserved
    const reactions2 = store2.getReactions(eventId);
    assert.equal(reactions2.love, 2);
    assert.equal(reactions2.wow, 1);
    assert.equal(reactions2.total, 3);

    // Comments strictly preserved
    const comments2 = store2.getComments(eventId);
    assert.equal(comments2.length, 1);
    assert.equal(comments2[0].authorName, 'PersistenceTester');
    assert.equal(comments2[0].text, 'Observing the viaduct before midnight.');

    // Wager & user vote strictly preserved
    const wager2 = store2.getWager(wager.id, 'traveller_persist', NOW + 20_000);
    assert.equal(wager2.status, 'resolved');
    assert.equal(wager2.userVote, 'opt_sanctuary');
    assert.equal(wager2.userWon, true);

    // Accolade strictly preserved
    const accolades2 = store2.getAccolades('traveller_persist');
    assert.ok(accolades2.includes('Sanctuary Oracle'));

    store2.close();
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('hash routing formats and clean IDs match client expectations', () => {
  // Test event ID clean formatting for hash links (#beat-evt-1234)
  const eventId = 'evt:surge:wapping-1';
  const cleanId = eventId.replace(/:/g, '-');
  assert.equal(cleanId, 'evt-surge-wapping-1');
  assert.equal(`#beat-${cleanId}`, '#beat-evt-surge-wapping-1');

  // Test multi-colon event ID
  const multiColon = 'evt:2026-09-04:mi6:briefing';
  const cleanMulti = multiColon.replace(/:/g, '-');
  assert.equal(cleanMulti, 'evt-2026-09-04-mi6-briefing');
  assert.equal(cleanMulti.includes(':'), false);

  // Test dispatch hash link formatting
  const dateStr = '2026-09-04';
  assert.equal(`#dispatch-${dateStr}`, '#dispatch-2026-09-04');
});

test('curateDailyEvents pools candidates from previous London day when target date has < 3 events (morning dispatch ritual)', () => {
  const targetDate = '2026-09-05';
  const prevDate = '2026-09-04';

  const events = [
    // Previous day high-salience narrative events (afternoon / evening)
    { id: 'ev_prev_surge', occurredAt: atLondon(prevDate, '14:00'), type: 'ARCANE_SURGE', description: 'Thames harmonic surge.' },
    { id: 'ev_prev_standby', occurredAt: atLondon(prevDate, '16:00'), type: 'STANDBY_BEGIN', description: 'Standby readiness ordered.' },
    { id: 'ev_prev_broken', occurredAt: atLondon(prevDate, '19:00'), type: 'PLAN_BROKEN', description: 'Duty recall cancelled patrol.' },
    { id: 'ev_prev_convo', occurredAt: atLondon(prevDate, '20:30'), type: 'CONVERSATION', lines: [{ who: 'ashai', text: 'Watch the river.' }] },
    // Today early morning routine (only 1 event before 07:00)
    { id: 'ev_today_wake', occurredAt: atLondon(targetDate, '06:30'), type: 'SLEEP_END', description: 'Woke with the morning chime.' },
  ];

  const curated = curateDailyEvents(events, targetDate);

  // Must pool from previous day to deliver 3–5 highest-salience events
  assert.ok(curated.length >= 3 && curated.length <= 5, `curated count ${curated.length} in [3, 5]`);

  // Top events must be the high-salience events from previous 24 hours
  const curatedIds = curated.map((e) => e.id);
  assert.ok(curatedIds.includes('ev_prev_surge'), 'contains previous day surge');
  assert.ok(curatedIds.includes('ev_prev_broken'), 'contains previous day broken plan');
  assert.ok(curatedIds.includes('ev_prev_standby'), 'contains previous day standby');
  assert.equal(curated[0].id, 'ev_prev_surge', 'highest salience event is first');
});

test('isHighStakesEvent strictly rejects routine church and institutional notices', () => {
  // Routine church notice (should NOT trigger high-stakes raven alert)
  const routineChurch = {
    type: 'INSTITUTION_NOTICE',
    description: 'The Church continued Celestial Veil preparations at the Sanctuary in the sky.',
  };
  assert.equal(isHighStakesEvent(routineChurch), false, 'routine church preparations must be rejected');

  // Routine general rounds notice
  const routineRounds = {
    type: 'INSTITUTION_NOTICE',
    description: 'General Henderson walked the MI6 corridors.',
  };
  assert.equal(isHighStakesEvent(routineRounds), false, 'general rounds must be rejected');

  // Genuine rare Veil milestone
  const veilMilestone = {
    type: 'INSTITUTION_NOTICE',
    description: 'The Church confirmed dates for the next Celestial Veil cycle.',
  };
  assert.equal(isHighStakesEvent(veilMilestone), true, 'Veil cycle confirmation is high stakes');
});

test('presence accepts a heartbeat body but returns only the issued session token and acknowledgement', async (t) => {
  const f = await dispatchServerFixture(t);

  // Send ping with JSON body
  const resPingBody = await fetch(`${f.base}/api/presence/ping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: 'custom-spectator-body-99' }),
  });
  assert.equal(resPingBody.status, 200);
  const dataPing = await resPingBody.json();
  assert.equal(dataPing.ok, true);
  assert.equal(typeof dataPing.viewerToken, 'string');
  assert.deepEqual(Object.keys(dataPing).sort(), ['ok', 'serverTime', 'viewerToken']);
});

test('dispatch endpoints include request host in clientOrigin permalinks', async (t) => {
  const f = await dispatchServerFixture(t);

  // Request with valid localhost Host header
  const port = new URL(f.base).port;
  const customHost = `localhost:${port}`;
  const resLatest = await fetch(`http://${customHost}/api/dispatch/latest`);
  assert.equal(resLatest.status, 200);
  const data = await resLatest.json();

  assert.ok(data.permalink.startsWith(`http://${customHost}/#dispatch-`));
  assert.ok(data.plainTextSummary.includes(`http://${customHost}/#dispatch-`));
});
