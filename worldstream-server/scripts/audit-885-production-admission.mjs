// scripts/audit-885-production-admission.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { openWorld } from '../src/world.mjs';
import { atLondon, londonDate } from '../src/time.mjs';
import { SCENE_RESERVOIR_CATALOG, normalizeReservoirLocation, reservoirSourceHash } from '../src/scene-reservoir-catalog.mjs';
import { SCENE_RESERVOIR_REVIEWS } from '../src/scene-reservoir-data.mjs';
import { areaOf } from '../src/places.mjs';
import { daypart } from '../src/sky.mjs';
import { SIDE_CHARACTERS, LEGION_CAST, OUTSIDE_CAST, STREET_FAUNA } from '../src/cast.mjs';

const START_DATE = '2026-03-02';
const DAYS = 90;
const startMs = atLondon(START_DATE, '00:00');
const targetMs = startMs + DAYS * 86_400_000;
const SEEDS = ['silver-clouds-now-v1', 'seed-beta', 'seed-gamma'];

console.log('====================================================');
console.log('   885-SCENE PRODUCTION ADMISSION & REACHABILITY    ');
console.log('====================================================\n');

// 1. Load the 885 unique scenes
const rr = JSON.parse(readFileSync('data/scene-reservoir-ready-rare.json', 'utf8')).entries;
const mb = JSON.parse(readFileSync('reports/misbound-report.json', 'utf8')).scenes;
const b03 = JSON.parse(readFileSync('C:/Users/chris/Downloads/WORLDSTREAM_GROUNDED_SCENE_BATCH_03.json', 'utf8')).scenes;
const b04 = JSON.parse(readFileSync('C:/Users/chris/Downloads/MEGA_BATCH_04/WORLDSTREAM_CANON_READY_RESERVOIR_BATCH_04.json', 'utf8')).scenes;
const bMap = new Map([...b03, ...b04].map(s => [s.id, s]));

const allScenes = [
  ...rr.map(s => ({ ...s, sourceFile: 'scene-reservoir-ready-rare.json' })),
  ...mb.map(m => ({ ...bMap.get(m.id), ...m, sourceFile: 'misbound-report.json' }))
];

console.log(`Loaded ${allScenes.length} unique scenes for audit.`);

// 2. Index currently production-enabled scenes
const enabledSourceIds = new Set(SCENE_RESERVOIR_CATALOG.map(s => s.reservoir?.sourceId || s.id.replace(/^R:/, '')));
console.log(`Currently production-enabled scenes: ${enabledSourceIds.size}`);

// 3. Known cast and leads
const ACTORS = new Set(['goaden','ashai',...Object.keys(SIDE_CHARACTERS),...Object.keys(LEGION_CAST),
  ...Object.keys(OUTSIDE_CAST),...Object.keys(STREET_FAUNA)]);
const LEADS = new Set(['goaden','ashai']);

// 4. Simulate 90 days across 3 seeds to collect concrete simulation events
console.log('\n--- Simulating 90 days across 3 seeds ---');
const seedEvents = [];
for (const seed of SEEDS) {
  process.stdout.write(`Simulating seed ${seed}... `);
  const world = openWorld({ dbPath: ':memory:', startMs, seed });
  world.advance(targetMs);
  const rows = world.db.prepare(`
    SELECT seq, id, occurred_at, semantic_json FROM events
    WHERE json_extract(semantic_json, '$.visibility') = 'public'
    ORDER BY seq
  `).all().map(r => {
    const sem = JSON.parse(r.semantic_json);
    return {
      seq: r.seq,
      id: r.id,
      occurredAt: r.occurred_at,
      type: sem.type,
      location: sem.location,
      area: sem.area,
      participants: sem.participants || [],
      payload: sem.payload || {},
      daypart: daypart(r.occurred_at),
      weatherCode: sem.payload?.weatherCode || null,
      seed
    };
  });
  console.log(`${rows.length} public events.`);
  seedEvents.push(...rows);
  world.close();
}
console.log(`Total public simulation events indexed: ${seedEvents.length}\n`);

// Location normalization helper
function getLocations(scene) {
  let raw = scene.remap?.newLoc ? [scene.remap.newLoc] : (scene.locations || scene.location || []);
  if (!Array.isArray(raw)) raw = [raw];
  return raw.map(l => {
    let [loc, area] = (l || '').split('/');
    if (loc === 'mi6' && area === 'lunch_hall') area = 'common_room';
    if (loc === 'mi6' && (area === 'corridor' || area === 'lift' || area === 'security')) area = 'corridors';
    if (loc === 'streamliner' && !area) area = 'transit';
    if (loc === 'sanctuary' && !area) area = 'central_hub';
    if (loc === 'big_ben_plaza' && !area) area = 'venue';
    if (loc === 'cafe' && !area) area = 'venue';
    if (loc === 'enchanted_ink' && !area) area = 'venue';
    return { location: loc, area };
  }).filter(p => p.location && p.area);
}

// Trigger normalization helper
function getTriggers(scene) {
  let raw = scene.remap?.newTrigger || scene.triggerCandidates || scene.trigger_family || scene.triggerFamily || '';
  if (Array.isArray(raw)) return raw;
  return raw.split('|').map(t => t.trim()).filter(Boolean);
}

// Trigger matching helper
function triggerMatches(trigger, evType) {
  if (trigger === 'ANY') return true;
  if (trigger === 'MEAL' || trigger === 'MEAL_BEGIN') return evType === 'MEAL_BEGIN';
  if (trigger === 'TRAINING' || trigger === 'PRACTICE_END') return evType === 'PRACTICE_END' || evType === 'PRACTICE_BEGIN';
  if (trigger === 'TRAVEL') return evType === 'TRAVEL_DEPART' || evType === 'TRAVEL_ARRIVE';
  if (trigger === 'PIANO' || trigger === 'PIANO_BEGIN') return evType === 'PIANO_BEGIN';
  if (trigger === 'REST' || trigger === 'REST_BEGIN') return evType === 'REST_BEGIN';
  if (trigger === 'QUIET_TIME' || trigger === 'QUIET_TIME_BEGIN') return evType === 'QUIET_TIME_BEGIN';
  if (trigger === 'GAME' || trigger === 'GAME_BEGIN') return evType === 'GAME_BEGIN' || evType === 'GAME_PAUSE' || evType === 'GAME_RESUME';
  if (trigger === 'CROSS_PATHS') return evType === 'CROSS_PATHS';
  if (trigger === 'ACTIVITY_COMPLETE') return evType === 'ACTIVITY_COMPLETE';
  return evType === trigger;
}

// 10 Requested Audit Categories
const census = {
  'already production-enabled': [],
  'production-valid but simply not catalogued/enabled': [],
  'blocked by cast presence': [],
  'blocked by knowledge': [],
  'blocked by location/activity': [],
  'blocked by timing/weather': [],
  'source/hash/review mismatch': [],
  'genuinely impossible under current canon': [],
  'needs metadata repair only': [],
  'needs prose/canon repair': []
};

for (const scene of allScenes) {
  const id = scene.id;
  const text = scene.prose || '';
  const cast = scene.cast || [];
  const family = scene.family || '';

  // Gate 1: already production-enabled
  if (enabledSourceIds.has(id)) {
    census['already production-enabled'].push({
      id, family, reason: 'Already reviewed, accepted, and enabled in SCENE_RESERVOIR_CATALOG.'
    });
    continue;
  }

  // Gate 2: genuinely impossible under current canon
  if (cast.includes('balthazar') && !cast.includes('anarchy')) {
    census['genuinely impossible under current canon'].push({
      id, family, reason: 'Balthazar requires Anarchy bonded manifestation; independent appearance violates canon.'
    });
    continue;
  }
  if (/blood ration|feeding prohibition enforcement|vampire black market/i.test(text) || family.includes('duskkin_enforcement')) {
    census['genuinely impossible under current canon'].push({
      id, family, reason: 'Uncommitted future Duskkin blood enforcement system.'
    });
    continue;
  }
  if (cast.includes('zara') && /mi6 administration|ops desk|security desk|duty log/i.test(text)) {
    census['genuinely impossible under current canon'].push({
      id, family, reason: 'Zara is a Duskkin warrior associated with Eirik, not an MI6 administrator.'
    });
    continue;
  }
  if (/magical london riot|faction protest|order skirmish/i.test(text)) {
    census['genuinely impossible under current canon'].push({
      id, family, reason: 'Uncommitted magical London street conflict.'
    });
    continue;
  }

  // Gate 3: needs prose/canon repair
  if (cast.includes('davis') && cast.includes('ashai')) {
    if (/you're lying to me|i know what you are|i don't trust you|we're enemies|charm betrayal/i.test(text)) {
      census['needs prose/canon repair'].push({
        id, family, reason: 'Pre-disclosure Davis/Ashai dialogue prematurely exposes manipulation/distrust.'
      });
      continue;
    }
  }
  if (/^\[.*\]/.test(text) && /TODO|placeholder/i.test(text)) {
    census['needs prose/canon repair'].push({
      id, family, reason: 'Prose contains placeholder or unresolved edit notes.'
    });
    continue;
  }

  // Gate 4: source/hash/review mismatch
  const review = SCENE_RESERVOIR_REVIEWS[id];
  if (review) {
    const hash = reservoirSourceHash(scene);
    if (review.sourceHash !== hash) {
      census['source/hash/review mismatch'].push({
        id, family, reason: `Source hash mismatch: expected ${review.sourceHash}, computed ${hash}`
      });
      continue;
    }
  }

  // Gate 5: needs metadata repair only (structural checks)
  const hasLead = cast.some(c => LEADS.has(c === 'hammond' ? 'kartel' : c));
  const rawLocs = scene.locations || scene.location;
  const isLocationsPlural = Boolean(scene.locations && !scene.location);
  const isTrigCandidates = Boolean(scene.triggerCandidates && !scene.trigger_family);
  const unmappedLocs = (Array.isArray(rawLocs) ? rawLocs : [rawLocs]).filter(l => l && (l.includes('lift') || l.includes('security') || l.includes('lunch_hall')));
  const unknownActors = cast.filter(c => c !== 'world' && !ACTORS.has(c === 'hammond' ? 'kartel' : c));

  if (!hasLead && cast.length > 0) {
    census['needs metadata repair only'].push({
      id, family, reason: `Cast lacks lead (Goaden/Ashai): [${cast.join(', ')}]; needs lead co-presence in review.`
    });
    continue;
  }
  if (cast.includes('world')) {
    census['needs metadata repair only'].push({
      id, family, reason: 'Cast includes "world"; needs character actor binding.'
    });
    continue;
  }
  if (unknownActors.length > 0) {
    census['needs metadata repair only'].push({
      id, family, reason: `Cast contains unknown runtime actors: ${unknownActors.join(', ')}`
    });
    continue;
  }

  // Gates 6-9: Production simulation eligibility
  const places = getLocations(scene);
  const triggers = getTriggers(scene);

  if (places.length === 0) {
    census['needs metadata repair only'].push({
      id, family, reason: 'No valid runtime location/area candidates.'
    });
    continue;
  }
  if (triggers.length === 0) {
    census['needs metadata repair only'].push({
      id, family, reason: 'No trigger candidates defined.'
    });
    continue;
  }

  // Evaluate against simulation events
  let matchedTrigger = false;
  let matchedLocation = false;
  let matchedCast = false;
  let matchedTimingWeather = false;
  let fullyReachable = false;
  let reachCount = 0;

  for (const ev of seedEvents) {
    const trigOk = triggers.some(t => triggerMatches(t, ev.type));
    if (!trigOk) continue;
    matchedTrigger = true;

    const locOk = places.some(p => p.location === ev.location && p.area === ev.area);
    if (!locOk) continue;
    matchedLocation = true;

    // Check cast presence in event
    const evCast = new Set([...ev.participants, ...(ev.payload?.cast || []), ...(ev.payload?.visitors || [])]);
    if (ev.payload?.who) evCast.add(ev.payload.who);

    const castOk = cast.every(actor => {
      const a = actor === 'hammond' ? 'kartel' : actor;
      if (a === 'kai') return cast.includes('goaden') && evCast.has('goaden');
      if (a === 'greah') return cast.includes('ashai') && evCast.has('ashai');
      return evCast.has(a);
    });
    if (!castOk) continue;
    matchedCast = true;

    // Check timing / daypart / weather
    if (scene.night || scene.tags?.includes('night') || family.includes('night')) {
      if (!['night', 'small_hours'].includes(ev.daypart)) continue;
    }
    if (scene.weatherCodes && !scene.weatherCodes.includes(ev.weatherCode)) continue;
    matchedTimingWeather = true;

    fullyReachable = true;
    reachCount++;
  }

  if (fullyReachable) {
    if (isLocationsPlural || isTrigCandidates || unmappedLocs.length > 0) {
      census['needs metadata repair only'].push({
        id, family, reachCount,
        reason: `Reachable in production (${reachCount} occurrences), but requires metadata normalization (property names locations/triggerCandidates/unaliased rooms).`
      });
    } else {
      census['production-valid but simply not catalogued/enabled'].push({
        id, family, reachCount,
        reason: `Production-valid and reachable (${reachCount} occurrences in 90 days); needs review/cataloguing.`
      });
    }
  } else if (!matchedTrigger || !matchedLocation) {
    census['blocked by location/activity'].push({
      id, family,
      reason: `Trigger/location combination [${triggers.join('|')}] at [${places.map(p=>p.location+'/'+p.area).join(',')}] never occurred in 90-day simulation.`
    });
  } else if (!matchedCast) {
    census['blocked by cast presence'].push({
      id, family,
      reason: `Required cast [${cast.join(', ')}] was never co-present at event location.`
    });
  } else if (!matchedTimingWeather) {
    census['blocked by timing/weather'].push({
      id, family,
      reason: 'Timing (daypart) or weather constraints never aligned with matching events.'
    });
  } else {
    census['blocked by knowledge'].push({
      id, family,
      reason: 'Prerequisite knowledge or state fact was never satisfied.'
    });
  }
}

// Summary Report
console.log('====================================================');
console.log('              AUDIT CENSUS RESULTS                  ');
console.log('====================================================\n');

let totalAudited = 0;
for (const [cat, list] of Object.entries(census)) {
  console.log(`  ${cat.padEnd(52)}: ${String(list.length).padStart(4)}`);
  totalAudited += list.length;
}
console.log(`\n  Total Audited                                       : ${String(totalAudited).padStart(4)}`);

const nProductionReachable = census['already production-enabled'].length + census['production-valid but simply not catalogued/enabled'].length;
console.log(`\n  N_production-reachable                              : ${nProductionReachable}`);
console.log(`  N_accepted-in-test-pool                             : 817 (acceptance harness)`);

// Save structured report
const reportObj = {
  auditDate: new Date().toISOString(),
  totalAudited,
  nProductionReachable,
  nAcceptedInTestPool: 817,
  censusSummary: Object.fromEntries(Object.entries(census).map(([k, v]) => [k, v.length])),
  breakdown: census
};

writeFileSync('reports/production-admission-audit.json', JSON.stringify(reportObj, null, 2) + '\n');
console.log('\nWrote complete audit report to reports/production-admission-audit.json');
