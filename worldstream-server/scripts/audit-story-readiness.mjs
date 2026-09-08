import { DatabaseSync } from 'node:sqlite';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Author-only diagnostics. Open the saved ledger read-only: never import a
// fixture, advance time, instantiate the service, or open the presentation DB.
const root = fileURLToPath(new URL('../', import.meta.url));
const databasePath = resolve(process.argv[2] ?? join(root, 'data/worldstream-final-review-v21/world.sqlite'));
const outputPath = resolve(process.argv[3] ?? join(root, 'artifacts/story-readiness.json'));
if (databasePath === outputPath) throw new Error('The report must not overwrite the database');
const limit = 100_000;
const db = new DatabaseSync(databasePath, { readOnly: true });
let snapshot, events, totalEvents, pendingCount;
try {
  db.exec('BEGIN');
  snapshot = db.prepare('SELECT rules_version, resolved_through FROM world_state WHERE id = 1').get();
  if (!snapshot) throw new Error('Missing canonical world snapshot');
  totalEvents = db.prepare('SELECT count(*) AS n FROM events').get().n;
  pendingCount = db.prepare('SELECT count(*) AS n FROM scheduled_actions').get().n;
  events = db.prepare('SELECT semantic_json FROM events ORDER BY seq DESC LIMIT ?').all(limit)
    .reverse().map(row => JSON.parse(row.semantic_json));
  db.exec('COMMIT');
} finally { db.close(); }

const countBy = (rows, key) => Object.fromEntries(Object.entries(rows.reduce((out, row) => {
  const value = String(key(row) ?? 'unspecified'); out[value] = (out[value] ?? 0) + 1; return out;
}, {})).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const calendar = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London',
  year: 'numeric', month: '2-digit', day: '2-digit' });
const isNight = event => { const hour = Number(clock.format(event.occurredAt).slice(0, 2)); return hour >= 22 || hour < 7; };
const publicEvents = events.filter(event => event.visibility === 'public' && event.publicDescription);
const scenes = publicEvents.filter(event => Array.isArray(event.payload?.lines) && event.payload.lines.length);
const castOf = event => [...new Set([...(event.payload?.cast ?? []), ...(event.payload?.visitors ?? []),
  ...(event.payload?.lines ?? []).map(line => line.who), ...(event.payload?.who ? [event.payload.who] : [])])]
  .filter(who => typeof who === 'string');
const familyOf = event => /^(INK|THREAD|INTENT|AGENDA|GROUND)_/.exec(event.type)?.[1] ?? null;
const ticks = events.filter(event => event.type === 'DIRECTOR_TICK');
const brief = event => ({ id: event.id, type: event.type, occurredAt: new Date(event.occurredAt).toISOString(),
  londonDate: calendar.format(event.occurredAt), londonTime: clock.format(event.occurredAt),
  location: event.location, area: event.area, visibility: event.visibility,
  description: event.publicDescription ?? null, reason: event.payload?.reason ?? null,
  kind: event.payload?.kind ?? null, durationMinutes: event.payload?.durationMinutes ?? null });
const collisions = events.filter(event => event.type === 'CROSS_PATHS'
  && event.payload?.reason === 'One of them is doing something that cannot be interrupted').map(event => {
  const opening = [...events].reverse().find(row => row.type === 'GROUND_WORK_OPPORTUNITY'
    && row.visibility === 'public' && row.occurredAt < event.occurredAt
    && row.occurredAt + (row.payload?.durationMinutes ?? 0) * 60_000 > event.occurredAt);
  if (!opening) return null;
  const departure = events.find(row => row.type === 'TRAVEL_DEPART'
    && row.payload?.reason === 'No valid agreed departure' && row.occurredAt > event.occurredAt
    && row.occurredAt <= event.occurredAt + 60 * 60_000);
  if (!departure) return null;
  return { occupiedBy: brief(opening), missedMeeting: brief(event), failedDeparture: brief(departure),
    trace: events.filter(row => row.occurredAt >= opening.occurredAt && row.occurredAt <= departure.occurredAt
      && ['GROUND_WORK_OPPORTUNITY', 'CROSS_PATHS', 'OFFER_ACTIVITY', 'ACCEPT_ACTIVITY',
        'ANNOUNCE_ARRANGEMENT', 'GROUND_WORK_COMPLETED', 'GROUND_WORK_INTERRUPTED', 'TRAVEL_DEPART'].includes(row.type)).map(brief) };
}).filter(Boolean).slice(-12);
const night = publicEvents.filter(isNight);
const sceneSignatures = countBy(scenes, event => JSON.stringify(event.payload.lines));
const report = {
  audit: 'author-only story readiness; canonical database opened read-only',
  recordedAt: new Date().toISOString(), databasePath,
  rulesVersion: snapshot.rules_version, resolvedThrough: new Date(snapshot.resolved_through).toISOString(),
  coverage: { totalEvents, inspectedEvents: events.length, maximumRows: limit, truncated: totalEvents > limit,
    firstOccurrence: events.length ? new Date(events[0].occurredAt).toISOString() : null,
    lastOccurrence: events.length ? new Date(events.at(-1).occurredAt).toISOString() : null },
  pendingCount,
  public: { total: publicEvents.length, byLondonDate: countBy(publicEvents, event => calendar.format(event.occurredAt)),
    byType: countBy(publicEvents, event => event.type), byRegister: countBy(publicEvents, event => event.register),
    causalFamilyTypes: countBy(publicEvents.filter(familyOf), event => event.type),
    authoredDialogueScenes: scenes.length, distinctDialogueScripts: Object.keys(sceneSignatures).length,
    repeatedDialogueUses: Object.values(sceneSignatures).reduce((sum, count) => sum + Math.max(0, count - 1), 0),
    explicitSceneOrCameoCast: countBy(publicEvents.flatMap(castOf), who => who),
    castCountScope: 'Explicit public payload cast/visitors/lines/who only; does not count names in prose, Guardians in ambient descriptions, or Davis/Zara work mentioned in agenda summaries.',
    repeatedDescriptions: Object.entries(countBy(publicEvents, event => event.publicDescription))
      .filter(([, count]) => count > 3).slice(0, 30).map(([description, count]) => ({ description, count })) },
  director: { ticks: ticks.length, byReason: countBy(ticks, event => event.payload?.reason),
    stagedFamilies: countBy(ticks.filter(event => event.payload?.family), event => event.payload.family),
    longestBusyRejectedQuietMinutes: Math.max(0, ...ticks.filter(event => event.payload?.reason === 'world_is_busy')
      .map(event => event.payload.quietMinutes ?? 0)) },
  night: { londonHours: '22:00 inclusive to 07:00 exclusive', publicTypes: countBy(night, event => event.type),
    actorEventsExcludingSleep: night.filter(event => event.type !== 'REST_BEGIN'
      && event.participants?.some(who => ['goaden', 'ashai'].includes(who))).map(brief),
    proposedIncidents: events.filter(event => event.type === 'INCIDENT' && isNight(event)).map(brief) },
  incidents: { proposals: events.filter(event => event.type === 'INCIDENT').map(brief) },
  outingGroundCollisions: collisions,
  constraints: ['No fixture was loaded or changed.', 'No simulation advance or migration was performed.',
    'No private knowledge, raw state, action payloads, or credentials are included.',
    'This measures this saved continuity and bounded ledger window; it does not prove rates for every seed.',
    'Public registers describe ledger classification, not guaranteed cinematic playback or prose generation.'],
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ report: outputPath, through: report.resolvedThrough, publicEvents: publicEvents.length,
  dialogueScenes: scenes.length, cast: report.public.explicitSceneOrCameoCast,
  director: report.director, nightActorEvents: report.night.actorEventsExcludingSleep.length,
  outingCollisions: collisions.length }, null, 2));
