import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import {
  PLOT_CLOCKS,
  evaluatePlotClocks,
} from '../src/clocks.mjs';
import {
  detectPlotClockClimaxWager,
  ACCOLADES,
} from '../src/wagers.mjs';
import {
  buildBroadsheet,
  formatDispatchPlainText,
} from '../src/dispatch.mjs';
import { openSocialStore } from '../src/social-store.mjs';
import { createApp } from '../server.mjs';

const NOW = Date.parse('2026-09-04T14:00:00.000Z');

test('PLOT_CLOCKS catalog contains all 5 canonical London clocks', () => {
  const keys = Object.keys(PLOT_CLOCKS);
  assert.equal(keys.length, 5);
  assert.ok(PLOT_CLOCKS.veil, 'Celestial Veil clock exists');
  assert.ok(PLOT_CLOCKS.mi6_net, 'MI6 Directorate Net clock exists');
  assert.ok(PLOT_CLOCKS.arcane_resonance, 'Thames Harmonic Resonance clock exists');
  assert.ok(PLOT_CLOCKS.order_vigil, 'Holy Order Shadow Vigil clock exists');
  assert.ok(PLOT_CLOCKS.inner_rapport, 'Inner Circle Rapport clock exists');

  for (const clock of Object.values(PLOT_CLOCKS)) {
    assert.ok(typeof clock.id === 'string' && clock.id.length > 0);
    assert.ok(typeof clock.name === 'string' && clock.name.length > 0);
    assert.ok(typeof clock.domain === 'string' && clock.domain.length > 0);
    assert.ok(typeof clock.icon === 'string' && clock.icon.length > 0);
    assert.ok(typeof clock.color === 'string' && clock.color.startsWith('#'));
    assert.ok(typeof clock.totalSegments === 'number' && clock.totalSegments >= 4);
    assert.equal(clock.segments.length, clock.totalSegments);
  }
});

test('evaluatePlotClocks computes pure deterministic clocks from world state', () => {
  const world = {
    publicProjection() {
      return {
        factions: { mi6: 'routine', arcane: 'low', order: 'quiet' },
        sky: { lintels: 1 },
        weather: { code: 'clear' },
        veil: { daysAway: 70, phase: 'distant' },
        events: [],
        characters: [],
      };
    },
  };

  const clocks = evaluatePlotClocks(world, NOW);
  assert.equal(clocks.length, 5);

  const veil = clocks.find((c) => c.id === 'veil');
  assert.equal(veil.currentSegment, 1, 'Veil is at segment 1 (distant)');
  assert.equal(veil.isPenultimate, false);
  assert.equal(veil.isComplete, false);

  const mi6 = clocks.find((c) => c.id === 'mi6_net');
  assert.equal(mi6.currentSegment, 1, 'MI6 Net is nominal');

  const arcane = clocks.find((c) => c.id === 'arcane_resonance');
  assert.equal(arcane.currentSegment, 1, 'Arcane resonance is equilibrium');

  const order = clocks.find((c) => c.id === 'order_vigil');
  assert.equal(order.currentSegment, 1, 'Order is dormant in Southwark');

  const rapport = clocks.find((c) => c.id === 'inner_rapport');
  assert.equal(rapport.currentSegment, 1, 'Rapport is barracks distance');
});

test('evaluatePlotClocks advances MI6 Net through catalyst thresholds', () => {
  // Stage 2: Briefings summoned
  const worldBriefing = {
    factions: { mi6: 'briefings', arcane: 'low', order: 'quiet' },
    events: [{ id: 'ev-b', occurredAt: NOW, type: 'BRIEFING_BEGIN', location: 'mi6', description: 'Command called an inner circle briefing.' }],
  };
  const clocks2 = evaluatePlotClocks(worldBriefing, NOW);
  const mi6_2 = clocks2.find((c) => c.id === 'mi6_net');
  assert.equal(mi6_2.currentSegment, 2);
  assert.equal(mi6_2.isPenultimate, false);

  // Stage 3: Standby footing (penultimate)
  const worldStandby = {
    factions: { mi6: 'elevated', arcane: 'low', order: 'quiet' },
    events: [{ id: 'ev-s', occurredAt: NOW, type: 'STANDBY_BEGIN', location: 'mi6', description: 'Operatives placed on operational standby.' }],
  };
  const clocks3 = evaluatePlotClocks(worldStandby, NOW);
  const mi6_3 = clocks3.find((c) => c.id === 'mi6_net');
  assert.equal(mi6_3.currentSegment, 3);
  assert.equal(mi6_3.isPenultimate, true, 'Stage 3 of 4 is penultimate');
  assert.equal(mi6_3.status, 'imminent');

  // Stage 4: Climax (Operational recall / intercept)
  const worldRecall = {
    factions: { mi6: 'elevated', arcane: 'low', order: 'quiet' },
    events: [{ id: 'ev-r', occurredAt: NOW, type: 'PLAN_BROKEN', location: 'mi6', description: 'Night patrol cancelled under operational recall.' }],
  };
  const clocks4 = evaluatePlotClocks(worldRecall, NOW);
  const mi6_4 = clocks4.find((c) => c.id === 'mi6_net');
  assert.equal(mi6_4.currentSegment, 4);
  assert.equal(mi6_4.isComplete, true);
  assert.equal(mi6_4.status, 'climax');
});

test('evaluatePlotClocks advances Arcane Resonance through MEU thresholds', () => {
  // Stage 2: Lintels gathering (2+ lintels)
  const world2 = {
    factions: { arcane: 'low' },
    sky: { lintels: 2 },
    events: [{ id: 'ev-c', description: 'Cathedral bells chimed across the Thames.' }],
  };
  const c2 = evaluatePlotClocks(world2, NOW).find((c) => c.id === 'arcane_resonance');
  assert.equal(c2.currentSegment, 2);

  // Stage 3: Anomaly / Moderate (penultimate)
  const world3 = {
    factions: { arcane: 'moderate' },
    sky: { lintels: 3 },
    events: [{ id: 'ev-a', type: 'MINOR_ANOMALY', description: 'MEU sensors detected high atmospheric vibration.' }],
  };
  const c3 = evaluatePlotClocks(world3, NOW).find((c) => c.id === 'arcane_resonance');
  assert.equal(c3.currentSegment, 3);
  assert.equal(c3.isPenultimate, true);

  // Stage 4: Harmonic Surge (climax)
  const world4 = {
    factions: { arcane: 'high' },
    events: [{ id: 'ev-s', type: 'ARCANE_SURGE', description: 'MEU scanners registered a surge along the Thames corridor.' }],
  };
  const c4 = evaluatePlotClocks(world4, NOW).find((c) => c.id === 'arcane_resonance');
  assert.equal(c4.currentSegment, 4);
  assert.equal(c4.isComplete, true);
});

test('detectPlotClockClimaxWager generates Climax Wagers for penultimate clocks', () => {
  const mi6Penultimate = {
    id: 'mi6_net',
    totalSegments: 4,
    currentSegment: 3,
    isPenultimate: true,
  };
  const wagerMI6 = detectPlotClockClimaxWager(mi6Penultimate, { id: 'evt-standby', occurredAt: NOW }, NOW);
  assert.ok(wagerMI6, 'wager generated for penultimate MI6 clock');
  assert.equal(wagerMI6.clockId, 'mi6_net');
  assert.match(wagerMI6.question, /culminate in an emergency Thames intercept/i);
  assert.equal(wagerMI6.accoladeTitle, ACCOLADES.MI6_INTUITIVE);
  assert.equal(wagerMI6.status, 'open');
  assert.ok(wagerMI6.options.length >= 2);

  const arcanePenultimate = {
    id: 'arcane_resonance',
    totalSegments: 4,
    currentSegment: 3,
    isPenultimate: true,
  };
  const wagerArcane = detectPlotClockClimaxWager(arcanePenultimate, { id: 'evt-anomaly', occurredAt: NOW }, NOW);
  assert.ok(wagerArcane);
  assert.equal(wagerArcane.clockId, 'arcane_resonance');
  assert.match(wagerArcane.question, /crest into a full Thames Arcane Surge/i);
  assert.equal(wagerArcane.accoladeTitle, ACCOLADES.CHIMEWATCHER);

  // Non-penultimate clock returns null
  const mi6Stage1 = { id: 'mi6_net', totalSegments: 4, currentSegment: 1, isPenultimate: false };
  assert.equal(detectPlotClockClimaxWager(mi6Stage1, null, NOW), null);
});

test('clock prose reports current conditions without manufacturing proclamations, patrols or private feelings', () => {
  const world = { factions: { mi6: 'routine', arcane: 'moderate', order: 'active_in_city', church: 'quiet' },
    veil: { phase: 'announced', daysAway: 45 }, sky: { lintels: 3 }, events: [] };
  const clocks = evaluatePlotClocks(world, NOW), byId = Object.fromEntries(clocks.map(clock => [clock.id, clock]));
  assert.match(byId.veil.currentDetail, /45 days away/);
  assert.match(byId.arcane_resonance.currentDetail, /moderate/);
  assert.match(byId.order_vigil.currentDetail, /active in the city/);
  assert.equal(byId.inner_rapport.currentSegment, 1, 'world tension cannot supply a shared emotional event');
  assert.doesNotMatch(JSON.stringify(clocks), /six in the morning|notices are up|good biscuits|every handheld|lift carriages|Ink moved|building noticing|Encirclement|formal prayers|bells ringing off-pitch/i);
  assert.ok(clocks.every(clock => clock.lastAdvancedEventId === null));
});

test('clock source echoes require a dated public event and actual shared participation', () => {
  const current = { id: 'shared', occurredAt: NOW - 1, type: 'CONVERSATION', participants: ['ashai', 'goaden'],
    description: 'Ashai and Goaden talked over breakfast.' };
  const noise = [
    { ...current, id: 'private', visibility: 'private', occurredAt: NOW, description: 'PRIVATE PLAN' },
    { ...current, id: 'future', occurredAt: NOW + 1, description: 'FUTURE PLAN' },
    { ...current, id: 'undated', occurredAt: undefined, description: 'UNDATED PLAN' },
    { id: 'old-surge', type: 'ARCANE_SURGE', occurredAt: NOW - 25 * 60 * 60_000, description: 'OLD SURGE' },
    { id: 'coffee', occurredAt: NOW, type: 'MEAL_BEGIN', participants: ['ashai'], description: 'Ashai ordered coffee.' },
  ];
  const clocks = evaluatePlotClocks({ events: [current, ...noise], factions: { arcane: 'low', order: 'quiet' } }, NOW);
  const rapport = clocks.find(clock => clock.id === 'inner_rapport');
  assert.equal(rapport.currentDetail, current.description);
  assert.equal(rapport.lastAdvancedEventId, current.id);
  assert.equal(clocks.find(clock => clock.id === 'arcane_resonance').currentSegment, 1);
  assert.equal(clocks.find(clock => clock.id === 'order_vigil').currentSegment, 1, 'ordered coffee is not Holy Order surveillance');
  assert.doesNotMatch(JSON.stringify(clocks), /PRIVATE PLAN|FUTURE PLAN|UNDATED PLAN|OLD SURGE/);
  const absent = evaluatePlotClocks({ events: [{ ...current, participants: ['ashai'] }] }, NOW)
    .find(clock => clock.id === 'inner_rapport');
  assert.equal(absent.currentSegment, 1, 'names in prose cannot replace actual shared attendance');
});

test('Morning Broadsheet includes The London Plot Clocks column', () => {
  const events = [
    {
      id: 'evt-1',
      occurredAt: NOW - 3600_000,
      location: 'mi6',
      type: 'STANDBY_BEGIN',
      description: 'Goaden stood by at Whitehall as the inner circle convened.',
    },
  ];

  const broadsheet = buildBroadsheet({
    events,
    date: '2026-09-04',
    serverTime: NOW,
    world: {
      publicProjection() {
        return {
          events,
          factions: { mi6: 'elevated', arcane: 'low', order: 'quiet' },
          sky: { lintels: 2 },
          veil: { daysAway: 20, phase: 'preparing' },
        };
      },
    },
  });

  assert.ok(Array.isArray(broadsheet.plotClocks), 'broadsheet includes plotClocks');
  assert.equal(broadsheet.plotClocks.length, 5);

  const plainText = formatDispatchPlainText(broadsheet, 'http://127.0.0.1:4317/#dispatch-2026-09-04');
  assert.match(plainText, /THE LONDON PLOT CLOCKS:/);
  assert.match(plainText, /The MI6 Directorate Net: \[/);
  assert.match(plainText, /The Celestial Veil Astrolabe: \[/);
});

test('server endpoints serve GET /api/clocks and embed clocks in /api/world and /api/observe', async (t) => {
  const events = [
    { id: 'ev-test', occurredAt: NOW, location: 'sanctuary', type: 'NOTICE', description: 'London morning.' },
  ];
  const world = {
    advance() {},
    publicProjection() {
      return {
        worldId: 'clocks-test-world',
        resolvedThrough: NOW,
        factions: { mi6: 'routine', arcane: 'moderate', order: 'watchful' },
        sky: { lintels: 3 },
        characters: [],
        events,
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

  // 1. GET /api/clocks
  const resClocks = await fetch(`${base}/api/clocks`);
  assert.equal(resClocks.status, 200);
  const clocksData = await resClocks.json();
  assert.ok(Array.isArray(clocksData.clocks));
  assert.equal(clocksData.clocks.length, 5);

  // 2. GET /api/world includes clocks
  const resWorld = await fetch(`${base}/api/world`);
  assert.equal(resWorld.status, 200);
  const worldData = await resWorld.json();
  assert.ok(Array.isArray(worldData.clocks));
  assert.equal(worldData.clocks.length, 5);

  // 3. POST /api/observe includes clocks
  const resObserve = await fetch(`${base}/api/observe`, { method: 'POST' });
  assert.equal(resObserve.status, 200);
  const observeData = await resObserve.json();
  assert.ok(Array.isArray(observeData.clocks));
  assert.equal(observeData.clocks.length, 5);
});
