import { tensionOf } from './director.mjs';

/**
 * Five editorial views of current conditions and committed developments.
 * A segment summarises its evidence; it never creates an incident, a physical
 * instrument, or somebody's private thoughts merely to fill the clock.
 */
export const PLOT_CLOCKS = Object.freeze({
  veil: {
    id: 'veil',
    name: 'The Celestial Veil Astrolabe',
    domain: 'Church & The Aether',
    icon: '🕊️',
    color: '#38bdf8', // sky cyan
    totalSegments: 6,
    accoladeTitle: 'Sanctuary Oracle',
    description: 'The approach of the Celestial Veil.',
    segments: [
      { index: 1, title: 'On the Distant Horizon', detail: 'There is still time before the Veil.' },
      { index: 2, title: 'The Veil Draws Nearer', detail: 'The date is drawing closer.' },
      { index: 3, title: 'The Approaching Veil', detail: 'The approach of the Veil gives the coming days their shape.' },
      { index: 4, title: 'Within the Week', detail: 'The Veil is close now.' },
      { index: 5, title: 'The Last Few Days', detail: 'The long approach is almost over.' },
      { index: 6, title: 'The Celestial Veil Underway', detail: 'The Veil has begun.' },
    ],
  },
  mi6_net: {
    id: 'mi6_net',
    name: 'The MI6 Directorate Net',
    domain: 'Whitehall & Security',
    icon: '🛡️',
    color: '#f59e0b', // amber gold
    totalSegments: 4,
    accoladeTitle: 'MI6 Intuitive',
    description: 'MI6’s current footing and recent operational developments.',
    segments: [
      { index: 1, title: 'Routine Footing', detail: 'Ordinary duties still count as duties.' },
      { index: 2, title: 'Briefings and Preparations', detail: 'Attention turns towards the work ahead.' },
      { index: 3, title: 'Heightened Readiness', detail: 'Readiness leaves less room for an unhurried day.' },
      { index: 4, title: 'Operational Pressure', detail: 'Operational demands weigh on the day.' },
    ],
  },
  arcane_resonance: {
    id: 'arcane_resonance',
    name: 'The Thames Harmonic Resonance',
    domain: 'Arcane Ecology & Sky',
    icon: '⚡',
    color: '#a855f7', // arcane purple
    totalSegments: 4,
    accoladeTitle: 'Chimewatcher',
    description: 'The city’s current arcane conditions and recent disturbances.',
    segments: [
      { index: 1, title: 'Low Arcane Activity', detail: 'Low activity leaves room to notice the smaller strangenesses.' },
      { index: 2, title: 'Familiar Drift', detail: 'There is more to the London sky than weather.' },
      { index: 3, title: 'Unsettled Resonance', detail: 'The city’s arcane conditions bear watching.' },
      { index: 4, title: 'High Arcane Activity', detail: 'Arcane pressure is high.' },
    ],
  },
  order_vigil: {
    id: 'order_vigil',
    name: 'The Holy Order Shadow Vigil',
    domain: 'Order & Espionage',
    icon: '🗡️',
    color: '#ef4444', // crimson
    totalSegments: 4,
    accoladeTitle: 'Borough Sleuth',
    description: 'The Holy Order’s current posture and reported activity.',
    segments: [
      { index: 1, title: 'A Quiet Posture', detail: 'Quiet is not the same thing as reassuring.' },
      { index: 2, title: 'A Watchful Posture', detail: 'The Order’s attention is seldom a comfort.' },
      { index: 3, title: 'Active in the City', detail: 'The Order remains a presence in London.' },
      { index: 4, title: 'Heightened Order Pressure', detail: 'The Order’s activity bears closer attention.' },
    ],
  },
  inner_rapport: {
    id: 'inner_rapport',
    name: 'Inner Circle Rapport',
    domain: 'Ashai & Goaden',
    icon: '☕',
    color: '#10b981', // emerald
    totalSegments: 4,
    accoladeTitle: 'London Observer',
    description: 'The moments Ashai and Goaden have actually shared.',
    segments: [
      { index: 1, title: 'Their Separate Days', detail: 'A life has more in it than the moments two people share.' },
      { index: 2, title: 'Time in Company', detail: 'Ordinary company belongs in their story too.' },
      { index: 3, title: 'An Exchange Between Them', detail: 'Their own words carry the moment.' },
      { index: 4, title: 'A Shared Demand', detail: 'The same demands can fall on both of them.' },
    ],
  },
});

/**
 * Pure Deterministic Evaluation:
 * Computes all 5 Plot Clocks from the current world projection and historical events.
 */
export function evaluatePlotClocks(world, serverTime = Date.now()) {
  if (!world) return [];

  const proj = typeof world.publicProjection === 'function' ? world.publicProjection() : world;
  const events = (Array.isArray(proj?.events) ? proj.events : [])
    .filter(event => event?.id && event.visibility !== 'private' && Number.isFinite(event.occurredAt)
      && event.occurredAt <= serverTime && event.occurredAt >= serverTime - 24 * 60 * 60_000
      && publishedText(event))
    .map(event => ({ ...event, description: publishedText(event) }))
    .sort((a, b) => a.occurredAt - b.occurredAt || a.id.localeCompare(b.id));
  const factions = proj?.factions || {};
  const sky = proj?.sky || {};
  const veil = proj?.veil || {};

  const tension = tensionOf({ factions, relationships: [] });
  const results = [];

  // 1. The Celestial Veil Astrolabe (6 segments)
  results.push(evaluateVeilClock(veil, events));

  // 2. The MI6 Directorate Net (4 segments)
  results.push(evaluateMI6Clock(factions, events, tension));

  // 3. The Thames Harmonic Resonance (4 segments)
  results.push(evaluateArcaneClock(factions, sky, events));

  // 4. The Holy Order Shadow Vigil (4 segments)
  results.push(evaluateOrderClock(factions, events));

  // 5. Inner Circle Rapport (4 segments)
  results.push(evaluateRapportClock(events));

  return results;
}

function publishedText(event) {
  return typeof event?.publicDescription === 'string' ? event.publicDescription
    : typeof event?.description === 'string' ? event.description : '';
}
function withRecentEvent(current, event) {
  return event ? `${current}\n\nRecently: ${publishedText(event)}` : current;
}

function evaluateVeilClock(veil, events) {
  const cfg = PLOT_CLOCKS.veil;
  const days = typeof veil.daysAway === 'number' ? veil.daysAway : 45;
  const phase = veil.phase || 'distant';

  let currentSegment = 1;
  if (phase === 'underway' || days === 0) currentSegment = 6;
  else if (phase === 'imminent' || days <= 3) currentSegment = 5;
  else if (days <= 7) currentSegment = 4;
  else if (phase === 'preparing' || days <= 30) currentSegment = 3;
  else if (phase === 'announced' || days <= 60) currentSegment = 2;
  else currentSegment = 1;

  const segInfo = cfg.segments[currentSegment - 1];
  const lastEvent = findLatestEvent(events, (e) =>
    e.type === 'INSTITUTION_NOTICE' && (e.description || '').toLowerCase().includes('veil')
  );

  return {
    id: cfg.id,
    name: cfg.name,
    domain: cfg.domain,
    icon: cfg.icon,
    color: cfg.color,
    totalSegments: cfg.totalSegments,
    currentSegment,
    isPenultimate: currentSegment === cfg.totalSegments - 1,
    isComplete: currentSegment >= cfg.totalSegments,
    status: currentSegment >= cfg.totalSegments ? 'climax' : (currentSegment === cfg.totalSegments - 1 ? 'imminent' : 'ticking'),
    currentTitle: segInfo.title,
    currentDetail: withRecentEvent(Number.isFinite(veil.daysAway)
      ? `The Celestial Veil is ${veil.daysAway === 0 ? 'underway' : `${veil.daysAway} days away`}.`
      : segInfo.detail, lastEvent),
    accoladeTitle: cfg.accoladeTitle,
    lastAdvancedEventId: lastEvent?.id || null,
    lastAdvancedAt: lastEvent?.occurredAt || null,
    allSegments: cfg.segments,
  };
}

function evaluateMI6Clock(factions, events, tension) {
  const cfg = PLOT_CLOCKS.mi6_net;
  const posture = factions.mi6 || 'routine';

  // Check recent catalyst events in last 24h
  const mi6Events = events.filter(event => event.location === 'mi6');
  const hasRecall = mi6Events.slice(-30).some((e) => e.type === 'PLAN_BROKEN' && /\brecall\b/i.test(e.description));
  const hasStandby = mi6Events.slice(-30).some((e) => e.type === 'STANDBY_BEGIN');
  const hasBriefing = mi6Events.slice(-30).some((e) => e.type === 'BRIEFING_BEGIN');

  let currentSegment = 1;
  if (hasRecall || (posture === 'elevated' && tension >= 0.6)) {
    currentSegment = 4;
  } else if (hasStandby || posture === 'elevated') {
    currentSegment = 3;
  } else if (hasBriefing || posture === 'briefings' || tension >= 0.35) {
    currentSegment = 2;
  } else {
    currentSegment = 1;
  }

  const segInfo = cfg.segments[currentSegment - 1];
  const lastEvent = findLatestEvent(events, (e) =>
    (e.location === 'mi6' && ['BRIEFING_BEGIN', 'STANDBY_BEGIN', 'PLAN_BROKEN'].includes(e.type)) ||
    (e.description || '').toLowerCase().includes('mi6')
  );

  return {
    id: cfg.id,
    name: cfg.name,
    domain: cfg.domain,
    icon: cfg.icon,
    color: cfg.color,
    totalSegments: cfg.totalSegments,
    currentSegment,
    isPenultimate: currentSegment === cfg.totalSegments - 1,
    isComplete: currentSegment >= cfg.totalSegments,
    status: currentSegment >= cfg.totalSegments ? 'climax' : (currentSegment === cfg.totalSegments - 1 ? 'imminent' : 'ticking'),
    currentTitle: segInfo.title,
    currentDetail: withRecentEvent(({ routine: 'MI6 is on its routine footing.', briefings: 'MI6 is in a period of briefings.',
      elevated: 'MI6 remains at heightened readiness.' })[posture] ?? 'MI6’s recent activity is recorded here.', lastEvent),
    accoladeTitle: cfg.accoladeTitle,
    lastAdvancedEventId: lastEvent?.id || null,
    lastAdvancedAt: lastEvent?.occurredAt || null,
    allSegments: cfg.segments,
  };
}

function evaluateArcaneClock(factions, sky, events) {
  const cfg = PLOT_CLOCKS.arcane_resonance;
  const posture = factions.arcane || 'low';
  const lintels = Number.isFinite(sky.lintels) ? sky.lintels : 1;

  const hasSurge = events.slice(-30).some((e) => e.type === 'ARCANE_SURGE' || (e.description || '').toLowerCase().includes('surge'));
  const hasAnomaly = events.slice(-30).some((e) => e.type === 'MINOR_ANOMALY' || (e.description || '').toLowerCase().includes('meu'));

  let currentSegment = 1;
  if (posture === 'high' || !Object.hasOwn(factions, 'arcane') && hasSurge) {
    currentSegment = 4;
  } else if (hasAnomaly || posture === 'moderate' || lintels >= 3) {
    currentSegment = 3;
  } else if (lintels >= 2 || (events.length > 0 && events.slice(-10).some((e) => (e.description || '').toLowerCase().includes('chimes')))) {
    currentSegment = 2;
  } else {
    currentSegment = 1;
  }

  const segInfo = cfg.segments[currentSegment - 1];
  const lastEvent = findLatestEvent(events, (e) =>
    e.type === 'ARCANE_SURGE' || e.type === 'MINOR_ANOMALY' || (e.description || '').toLowerCase().includes('chimes')
  );

  return {
    id: cfg.id,
    name: cfg.name,
    domain: cfg.domain,
    icon: cfg.icon,
    color: cfg.color,
    totalSegments: cfg.totalSegments,
    currentSegment,
    isPenultimate: currentSegment === cfg.totalSegments - 1,
    isComplete: currentSegment >= cfg.totalSegments,
    status: currentSegment >= cfg.totalSegments ? 'climax' : (currentSegment === cfg.totalSegments - 1 ? 'imminent' : 'ticking'),
    currentTitle: segInfo.title,
    currentDetail: withRecentEvent(({ low: 'Arcane activity is low.', moderate: 'Arcane activity is moderate.',
      high: 'Arcane activity is high.' })[posture] ?? 'The recent arcane conditions are recorded here.', lastEvent),
    accoladeTitle: cfg.accoladeTitle,
    lastAdvancedEventId: lastEvent?.id || null,
    lastAdvancedAt: lastEvent?.occurredAt || null,
    allSegments: cfg.segments,
  };
}

function evaluateOrderClock(factions, events) {
  const cfg = PLOT_CLOCKS.order_vigil;
  const posture = factions.order || 'quiet';

  const orderEvent = e => /\b(?:holy order|the order|order scout)\b/i.test(e.description || '');
  const hasConfrontation = events.slice(-30).some((e) => orderEvent(e)
    && /\b(?:confrontation|intercepted)\b/i.test(e.description || ''));
  const hasScoutPerimeter = events.slice(-30).some((e) => orderEvent(e) && (
    (e.description || '').toLowerCase().includes('order scout') ||
    (e.description || '').toLowerCase().includes('watching the sanctuary'))
  );
  const hasBoroughSurveillance = events.slice(-30).some((e) =>
    orderEvent(e)
  );

  let currentSegment = 1;
  if (hasConfrontation || (posture === 'active_in_city' && hasScoutPerimeter)) {
    currentSegment = 4;
  } else if (hasScoutPerimeter || posture === 'active_in_city') {
    currentSegment = 3;
  } else if (hasBoroughSurveillance || posture === 'watchful') {
    currentSegment = 2;
  } else {
    currentSegment = 1;
  }

  const segInfo = cfg.segments[currentSegment - 1];
  const lastEvent = findLatestEvent(events, orderEvent);

  return {
    id: cfg.id,
    name: cfg.name,
    domain: cfg.domain,
    icon: cfg.icon,
    color: cfg.color,
    totalSegments: cfg.totalSegments,
    currentSegment,
    isPenultimate: currentSegment === cfg.totalSegments - 1,
    isComplete: currentSegment >= cfg.totalSegments,
    status: currentSegment >= cfg.totalSegments ? 'climax' : (currentSegment === cfg.totalSegments - 1 ? 'imminent' : 'ticking'),
    currentTitle: segInfo.title,
    currentDetail: withRecentEvent(({ quiet: 'The Holy Order’s posture is quiet.', watchful: 'The Holy Order remains watchful.',
      active_in_city: 'The Holy Order is active in the city.' })[posture] ?? 'Recent Order activity is recorded here.', lastEvent),
    accoladeTitle: cfg.accoladeTitle,
    lastAdvancedEventId: lastEvent?.id || null,
    lastAdvancedAt: lastEvent?.occurredAt || null,
    allSegments: cfg.segments,
  };
}

function evaluateRapportClock(events) {
  const cfg = PLOT_CLOCKS.inner_rapport;
  const shared = events.filter(event => ['ashai', 'goaden'].every(who =>
    [...(event.participants ?? []), ...(event.payload?.cast ?? [])].includes(who)));

  const hasPact = shared.slice(-30).some((e) =>
    (e.type === 'PLAN_BROKEN' || e.type === 'STANDBY_BEGIN')
  );
  const hasDeepConvo = shared.slice(-30).some((e) =>
    e.type === 'CONVERSATION' || e.type === 'SCENE_BANK_BEAT'
  );
  const hasTeaOrMeal = shared.slice(-30).some((e) =>
    (e.location === 'cafe' || e.type === 'MEAL_BEGIN' || /\btea\b/i.test(e.description || ''))
  );

  let currentSegment = 1;
  if (hasPact) {
    currentSegment = 4;
  } else if (hasDeepConvo) {
    currentSegment = 3;
  } else if (hasTeaOrMeal) {
    currentSegment = 2;
  } else {
    currentSegment = 1;
  }

  const segInfo = cfg.segments[currentSegment - 1];
  const lastEvent = shared.at(-1);

  return {
    id: cfg.id,
    name: cfg.name,
    domain: cfg.domain,
    icon: cfg.icon,
    color: cfg.color,
    totalSegments: cfg.totalSegments,
    currentSegment,
    isPenultimate: currentSegment === cfg.totalSegments - 1,
    isComplete: currentSegment >= cfg.totalSegments,
    status: currentSegment >= cfg.totalSegments ? 'climax' : (currentSegment === cfg.totalSegments - 1 ? 'imminent' : 'ticking'),
    currentTitle: segInfo.title,
    currentDetail: lastEvent ? publishedText(lastEvent) : segInfo.detail,
    accoladeTitle: cfg.accoladeTitle,
    lastAdvancedEventId: lastEvent?.id || null,
    lastAdvancedAt: lastEvent?.occurredAt || null,
    allSegments: cfg.segments,
  };
}

function findLatestEvent(events, predicate) {
  if (!Array.isArray(events)) return null;
  for (let i = events.length - 1; i >= 0; i--) {
    if (predicate(events[i])) return events[i];
  }
  return null;
}
