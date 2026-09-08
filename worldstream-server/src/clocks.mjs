import { tensionOf } from './director.mjs';

/**
 * The 5 Canonical London Plot Clocks
 * Each clock represents an escalating narrative arc grounded in Book One canon
 * and the physical p.183 checkpoint.
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
    description: 'An ancient brass astrolabe in the Church cloisters, tracking the approach of the Celestial Veil.',
    segments: [
      { index: 1, title: 'Distant Whispers', detail: 'A rumour on the autumn horizon. The Church has said nothing official, which from the Church is itself an announcement.' },
      { index: 2, title: 'Church Proclamation', detail: 'The notices are up and the formal prayers have begun, at volume, from six in the morning.' },
      { index: 3, title: 'Sanctuary Retrofit', detail: 'Carpenters and ward-weavers all over the Sanctuary. Nobody has ever hung a festival that far up before, and it shows.' },
      { index: 4, title: 'Relic Attunement', detail: 'Censers and aether lenses out for calibration. You can smell the calibration from the ground.' },
      { index: 5, title: 'Final Bell Imminence', detail: 'The final week. Every borough now has a firmly held opinion about the rigging.' },
      { index: 6, title: 'The Celestial Veil Underway', detail: 'Open, above the Sanctuary, where it has never once been held. Half of London is looking up and the other half is pretending not to.' },
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
    description: 'The operational readiness indicator in General Henderson’s Whitehall communications chamber.',
    segments: [
      { index: 1, title: 'Whitehall Nominal', detail: 'Corridors quiet. The rota is on the wall and nobody has touched it since Tuesday.' },
      { index: 2, title: 'Inner Circle Briefing', detail: 'The General has called the inner circle in. Somebody has put the good biscuits out, which is never a good sign.' },
      { index: 3, title: 'Barracks Standby Footing', detail: 'Operatives held in quarters with their boots on, doing nothing whatsoever at considerable intensity.' },
      { index: 4, title: 'Thames Corridor Intercept', detail: 'Everyone who can be spared is on the river. So is everyone who cannot.' },
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
    description: 'A delicate mercury galvanometer monitoring micro-electric aether fluctuations over the Thames.',
    segments: [
      { index: 1, title: 'Harmonic Equilibrium', detail: 'Readings flat. The MEU are out doing what the MEU mostly do, which is paperwork about magic.' },
      { index: 2, title: 'Vapor Runoff & Familiar Drift', detail: 'Lintels gathering along the Embankment, feeding on whatever is going. Nobody has ever successfully asked one to move along.' },
      { index: 3, title: 'Thames Channel Spike', detail: 'Sharp oscillations on the corridor. Every handheld in the borough is making the noise they make.' },
      { index: 4, title: 'Harmonic Arcane Surge', detail: 'Full surge. Church bells ringing off-pitch across three boroughs and not one official willing to say why.' },
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
    description: 'Intelligence pin-board recording clandestine Holy Order movements across London boroughs.',
    segments: [
      { index: 1, title: 'Shadows Dormant in Southwark', detail: 'The Order are in their compounds being quiet about it. That is their normal and it is not restful.' },
      { index: 2, title: 'Borough Surveillance Noticed', detail: 'Plainclothes at the tram stops. They are not hiding especially hard, which is the message.' },
      { index: 3, title: 'Sanctuary Perimeter Encirclement', detail: 'Watchers on the lift carriages and outside the Ink. The Ink moved this week. They found it anyway.' },
      { index: 4, title: 'Direct Midnight Confrontation', detail: 'Contact. Whatever the Order came for, they have stopped pretending otherwise.' },
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
    description: 'The unspoken psychological alignment and trust between Ashai and Goaden.',
    segments: [
      { index: 1, title: 'Barracks Formal Distance', detail: 'Professional, correct, and about as warm as the corridor they are standing in.' },
      { index: 2, title: 'Silver Spoon Tea & Unhurried Hours', detail: 'The corner table at the Spoon, again. Neither of them has admitted out loud that it is a habit.' },
      { index: 3, title: 'Unspoken Mutual Caution', detail: 'Both of them have noticed the building noticing them. Neither has raised it.' },
      { index: 4, title: 'Formed Operational Pact', detail: 'Whatever this is, they are going into it together, and nobody put it to a vote.' },
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
  const events = Array.isArray(proj?.events) ? proj.events : [];
  const factions = proj?.factions || {};
  const weather = proj?.weather || {};
  const sky = proj?.sky || {};
  const characters = Array.isArray(proj?.characters) ? proj.characters : [];
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
  results.push(evaluateRapportClock(characters, events, tension));

  return results;
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
    currentDetail: segInfo.detail,
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
  const hasRecall = events.slice(-30).some((e) => e.type === 'PLAN_BROKEN' || (e.description || '').toLowerCase().includes('recall'));
  const hasStandby = events.slice(-30).some((e) => e.type === 'STANDBY_BEGIN' || (e.description || '').toLowerCase().includes('standby'));
  const hasBriefing = events.slice(-30).some((e) => e.type === 'BRIEFING_BEGIN' || (e.description || '').toLowerCase().includes('briefing'));

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
    currentDetail: segInfo.detail,
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
  if (hasSurge || posture === 'high') {
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
    currentDetail: segInfo.detail,
    accoladeTitle: cfg.accoladeTitle,
    lastAdvancedEventId: lastEvent?.id || null,
    lastAdvancedAt: lastEvent?.occurredAt || null,
    allSegments: cfg.segments,
  };
}

function evaluateOrderClock(factions, events) {
  const cfg = PLOT_CLOCKS.order_vigil;
  const posture = factions.order || 'quiet';

  const hasConfrontation = events.slice(-30).some((e) => (e.description || '').toLowerCase().includes('confrontation') || (e.description || '').toLowerCase().includes('intercepted'));
  const hasScoutPerimeter = events.slice(-30).some((e) =>
    (e.description || '').toLowerCase().includes('order scout') ||
    (e.description || '').toLowerCase().includes('watching the sanctuary')
  );
  const hasBoroughSurveillance = events.slice(-30).some((e) =>
    (e.description || '').toLowerCase().includes('order') ||
    (e.description || '').toLowerCase().includes('scout')
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
  const lastEvent = findLatestEvent(events, (e) => (e.description || '').toLowerCase().includes('order'));

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
    currentDetail: segInfo.detail,
    accoladeTitle: cfg.accoladeTitle,
    lastAdvancedEventId: lastEvent?.id || null,
    lastAdvancedAt: lastEvent?.occurredAt || null,
    allSegments: cfg.segments,
  };
}

function evaluateRapportClock(characters, events, tension) {
  const cfg = PLOT_CLOCKS.inner_rapport;

  const hasPact = events.slice(-30).some((e) =>
    (e.type === 'PLAN_BROKEN' || e.type === 'STANDBY_BEGIN') &&
    (e.description || '').toLowerCase().includes('ashai') &&
    (e.description || '').toLowerCase().includes('goaden')
  );
  const hasDeepConvo = events.slice(-30).some((e) =>
    e.type === 'CONVERSATION' &&
    Array.isArray(e.lines) && e.lines.length >= 2 &&
    (e.description || '').toLowerCase().includes('discussed')
  );
  const hasTeaOrMeal = events.slice(-30).some((e) =>
    (e.location === 'cafe' || e.type === 'MEAL_BEGIN' || (e.description || '').toLowerCase().includes('tea')) &&
    (e.description || '').toLowerCase().includes('ashai')
  );

  let currentSegment = 1;
  if (hasPact) {
    currentSegment = 4;
  } else if (hasDeepConvo || tension >= 0.45) {
    currentSegment = 3;
  } else if (hasTeaOrMeal) {
    currentSegment = 2;
  } else {
    currentSegment = 1;
  }

  const segInfo = cfg.segments[currentSegment - 1];
  const lastEvent = findLatestEvent(events, (e) =>
    (e.description || '').toLowerCase().includes('ashai') &&
    (e.description || '').toLowerCase().includes('goaden')
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
    currentDetail: segInfo.detail,
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
