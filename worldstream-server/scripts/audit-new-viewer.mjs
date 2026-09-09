import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorldDurableObject } from '../cloudflare/src/world-durable-object.mjs';
import { createMockSqlStorage } from '../cloudflare/src/sqlite-adapter.mjs';
import { DEFAULT_SEED, RULES_VERSION, publicEvents } from '../src/fixture.mjs';
import { atLondon, londonDate } from '../src/time.mjs';
import { scoreCinematicEvent } from '../src/cinematics.mjs';
import { buildReadingRecap } from '../../worldstream/app/reading-recap.js';
import { forwardReadingEvents } from '../../worldstream/app/reader-narrative.js';

// Offline reader audit. Uses the integrated Durable Object's real reducer,
// projection, cinematic ingestion and recap; SQLite storage is the test adapter.
// Nothing opens a persisted DB; network requests are forbidden in this process.
const HOUR = 3_600_000, DAY = 24 * HOUR;
const root = fileURLToPath(new URL('../', import.meta.url));
const digest = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const norm = value => String(value ?? '').normalize('NFKC').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase();
const sentences = value => String(value ?? '').match(/[^.!?]+(?:[.!?]+[”"']?|$)/g)?.map(s => s.trim()).filter(Boolean) ?? [];
const countBy = (rows, key) => Object.fromEntries(Object.entries(rows.reduce((out, row) => {
  const k = String(key(row) ?? 'unspecified'); out[k] = (out[k] ?? 0) + 1; return out;
}, {})).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
const words = text => norm(text).replace(/[^\p{L}\p{N}' ]/gu, '').split(/\s+/).filter(Boolean);
const skeleton = text => norm(text)
  .replace(/\b(?:goaden|ashai|emily|yukon|gabriel|rose|zara|kai|greah|general henderson)\b/g, '{person}')
  .replace(/\b(?:enchanted ink|new big ben|big ben plaza|the sanctuary|sanctuary|the silver spoon|silver spoon cafe|mi6|the streamliner|streamliner)\b/g, '{place}')
  .replace(/\b\d+(?::\d+)?\b/g, '{number}');

const ROUTINE = /^(?:PRACTICE_BEGIN|PRACTICE_END|REST_BEGIN|MEAL_BEGIN|PIANO_BEGIN|MUSIC_LISTEN_BEGIN|TV_BEGIN|QUIET_TIME_BEGIN|ACTIVITY_COMPLETE|TRAVEL_DEPART|TRAVEL_ARRIVE|CITY_ACTIVITY_BEGIN|COMMS_CHECK_BEGIN|WAIT_BEGIN|GAME_BEGIN|GAME_RESUME|BRIEFING_BEGIN|STANDBY_BEGIN)$/;
const VISUAL = /^(?:WEATHER_CHANGE|FACTION_STATUS|LOCATION_MODE|DAY_PHASE|LINTELS|FAUNA|TRAVEL_DEPART|TRAVEL_ARRIVE)$/;
const DEVELOPMENT = /^(?:ARC_BEAT|ARC_CONFRONTATION|ARC_CLOSED|INCIDENT|AFTERMATH|PLAN_BROKEN|OUTING_CUT_SHORT|INK_APPOINTMENT_|THREAD_DELIVERY_|INTENT_(?:RESPONSE|RENEGOTIATE|COMPLETE|INTERRUPTED)|AGENDA_(?:OPERATION_START|RESOLVE|DEADLINE)|GROUND_(?:RESTRICTION|WORK_COMPLETED|WORK_INTERRUPTED)|SUPPORTING_(?:COMMITMENT|OUTCOME|CALLBACK)|NIGHT_(?:CALL|WORK_BEGIN|WORK_END|DEBRIEF|RETURN)|OFFSCREEN_(?:START|RESULT|ENCOUNTER))/;
const STORY = /^(?:ARC_|INK_|THREAD_|INTENT_|AGENDA_|GROUND_|SUPPORTING_|NIGHT_|OFFSCREEN_)/;

export function readingSurface(event) {
  // app.js eventRow Reading View branches, copied conceptually, no DOM needed.
  if (event.readerWeight === 0) return [];
  const prose = event.readerProse ?? event.prose;
  const description = event.readerDescription ?? event.description;
  if (event.readerWeight === 1) return [description || ''];
  const scene = event.cinematic?.scene;
  if (scene) {
    const parts = [scene.openingNarration, ...(scene.beats ?? []).map(b => b.line), scene.closingNarration].filter(Boolean);
    return parts.length ? parts : [prose || description || ''];
  }
  if (event.register === 'prose' && prose)
    return [prose, ...(event.lines ?? []).map(line => line.text)].filter(Boolean);
  return [description || '', ...(event.readerWeight === undefined ? [] : event.lines ?? []).map(line => line.text)].filter(Boolean);
}

export function tagsFor(event) {
  const tags = [];
  if (ROUTINE.test(event.type)) tags.push('routine');
  if (!STORY.test(event.type) && !ROUTINE.test(event.type) && !event.lines?.length) tags.push('texture');
  if (event.type === 'MOMENT_NOTICED' || /^MOMENT_/.test(event.type)) tags.push('Moments');
  if (event.lines?.length || event.cinematic?.scene?.beats?.length) tags.push('dialogue');
  if (event.register === 'prose' && !ROUTINE.test(event.type)) tags.push('authored_prose');
  if (/^ARC_/.test(event.type)) tags.push('arc_beats');
  if (event.memoryCallback || /CALLBACK|DEBRIEF|OFFSCREEN_ENCOUNTER/.test(event.type)) tags.push('callbacks');
  if (/^OFFSCREEN_(?:START|RESULT|WITNESS)$/.test(event.type)) tags.push('Elsewhere_family');
  if (DEVELOPMENT.test(event.type)) tags.push('development_proxy');
  if (event.cinematic) tags.push('accepted_cinematic');
  return tags;
}

function repetition(rows, key, limit = 20) {
  const map = new Map();
  for (const row of rows) {
    const k = key(row.text); if (!k) continue;
    const bucket = map.get(k) ?? { key: k, count: 0, examples: [], events: new Set(), types: new Set(), days: new Set() };
    bucket.count++; bucket.events.add(row.event.id); bucket.types.add(row.event.type); bucket.days.add(londonDate(row.event.occurredAt));
    if (!bucket.examples.some(e => e.text === row.text) && bucket.examples.length < 3)
      bucket.examples.push({ text: row.text, eventId: row.event.id, occurredAt: row.event.occurredAt });
    map.set(k, bucket);
  }
  const all = [...map.values()];
  return { total: all.reduce((n, b) => n + b.count, 0), inputRows: rows.length, unique: all.length, repeatedOccurrences: all.reduce((s, b) => s + Math.max(0, b.count - 1), 0),
    repeatedGroups: all.filter(b => b.count > 1).length,
    top: all.filter(b => b.count > 1).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)).slice(0, limit)
      .map(b => ({ ...b, events: b.events.size, days: b.days.size, types: [...b.types] })) };
}

function gaps(events, start, end) {
  const points = [start, ...events.map(e => e.occurredAt), end].sort((a, b) => a - b);
  const intervals = points.slice(1).map((to, i) => ({ from: points[i], to, hours: (to - points[i]) / HOUR }))
    .sort((a, b) => b.hours - a.hours);
  return { countOverTwoHours: intervals.filter(g => g.hours >= 2).length,
    countOverSixHours: intervals.filter(g => g.hours >= 6).length, maximumHours: intervals[0]?.hours ?? 0, top: intervals.slice(0, 10) };
}

function fixFor(row) {
  const types = row.types.join(' ');
  if (/WEATHER|FACTION|TRAVEL/.test(types)) return 'turn ordinary state into visual/UI; preserve a causal journey when needed';
  if (/MEAL|PRACTICE|ACTIVITY_COMPLETE|REST/.test(types)) return 'combine paired duplicate routine beats; suppress low-value narration';
  if (/MOMENT|OFFSCREEN_WITNESS/.test(types)) return 'combine duplicate witness reactions; add semantic variation only for a distinct consequence';
  if (/CALLBACK|DEBRIEF/.test(types)) return 'keep accessible origin; vary consequence/context, not merely callback synonyms';
  if (/ARC|NIGHT|SUPPORTING|OFFSCREEN/.test(types)) return 'more authored situation/outcome breadth, not a longer cooldown or paraphrase bank';
  if (/CONVERSATION|VENUE|LEGION/.test(types)) return 'more character-specific authored exchange families and semantic context guards';
  return 'suppress if unchanged; otherwise more semantic variation';
}

export function analyse(events, raw, start, end, cinematics = []) {
  const fragments = events.flatMap(event => readingSurface(event).map(text => ({ event, text })));
  const lines = fragments.flatMap(row => sentences(row.text).map(text => ({ ...row, text })));
  const exact = repetition(lines, norm);
  const byTag = countBy(events.flatMap(event => tagsFor(event)), tag => tag);
  const rawById = new Map(raw.map(e => [e.id, e]));
  const causalReturns = [];
  for (const event of events) for (const id of rawById.get(event.id)?.causedBy ?? []) {
    const source = rawById.get(id);
    if (source?.visibility === 'public' && event.occurredAt - source.occurredAt >= DAY)
      causalReturns.push({ eventId: event.id, type: event.type, description: event.description, sourceId: id,
        sourceType: source.type, sourceDescription: source.publicDescription, daysLater: (event.occurredAt - source.occurredAt) / DAY });
  }
  const switches = [];
  for (let i = 1; i < events.length - 1; i++) {
    const [before, event, after] = [events[i - 1], events[i], events[i + 1]];
    if (before.location && before.location === after.location && event.location && event.location !== before.location
      && after.occurredAt - before.occurredAt <= 60 * 60_000)
      switches.push({ before: { id: before.id, type: before.type, location: before.location, text: readingSurface(before).join('\n') },
        interruption: { id: event.id, type: event.type, location: event.location, text: readingSurface(event).join('\n'), bridge: event.contextBridge ?? null },
        after: { id: after.id, type: after.type, location: after.location, text: readingSurface(after).join('\n') } });
  }
  const dialogue = events.filter(e => e.lines?.length);
  const samples = Object.values(Object.groupBy(events, e => e.type)).flatMap(rows => rows.slice(0, 2)).slice(0, 100)
    .map(e => ({ id: e.id, at: e.occurredAt, type: e.type, text: readingSurface(e).join('\n'), location: e.location,
      contextBridge: e.contextBridge ?? null, recognisablyCharacterSpecific: null, coherentFromContext: null,
      nonRepetitive: null, worthSurfacing: null, keep: null, reviewStatus: 'author review pending' }));
  return { publicEvents: events.length, words: fragments.reduce((s, r) => s + words(r.text).length, 0),
    tags: byTag, byType: countBy(events, e => e.type), byDay: countBy(events, e => londonDate(e.occurredAt)),
    levelsSuggested: countBy(events, e => VISUAL.test(e.type) ? '1_visual_only' : ROUTINE.test(e.type) ? '2_short_routine'
      : e.lines?.length || /^ARC_(?:CONFRONTATION|CLOSED)$/.test(e.type) || /^NIGHT_WORK_END$/.test(e.type) ? '4_scene' : '3_notable_character_or_context'),
    exactSentences: exact, structuralSentences: repetition(lines, skeleton),
    openings: repetition(fragments, text => words(text).slice(0, 4).join(' ')),
    endings: repetition(fragments, text => words(text).slice(-4).join(' ')),
    wholePassages: repetition(fragments, norm),
    subjectVerbOpenings: repetition(fragments.filter(r => /^(Goaden|Ashai)\b/.test(r.text)), text => words(text).slice(0, 2).join(' ')),
    repetitionByFamily: Object.fromEntries(['routine', 'Moments', 'dialogue', 'arc_beats', 'callbacks', 'Elsewhere_family'].map(tag =>
      [tag, repetition(lines.filter(r => tagsFor(r.event).includes(tag)), norm, 5)])),
    dialogue: { scenes: dialogue.length, distinctScripts: new Set(dialogue.map(e => digest(e.lines.map(l => [l.who, l.text])))).size,
      distinctLines: new Set(dialogue.flatMap(e => e.lines.map(l => norm(l.text)))).size },
    prose: { events: events.filter(e => e.prose).length, distinct: new Set(events.filter(e => e.prose).map(e => norm(e.prose))).size },
    cinematicWorthyProxy: events.filter(e => scoreCinematicEvent(rawById.get(e.id) ?? e).score >= 50).length,
    actualAcceptedCinematics: cinematics.filter(e => e.occurred_at >= start && e.occurred_at < end).length,
    developmentGaps: gaps(events.filter(e => DEVELOPMENT.test(e.type)), start, end),
    wakingDevelopmentGaps: Array.from({ length: Math.round((end - start) / DAY) }, (_, day) => {
      const from = start + day * DAY + 7 * HOUR, to = start + day * DAY + 22 * HOUR;
      return { day: londonDate(from), ...gaps(events.filter(e => DEVELOPMENT.test(e.type) && e.occurredAt >= from && e.occurredAt <= to), from, to) };
    }).sort((a, b) => b.maximumHours - a.maximumHours),
    authoredSceneGaps: gaps(events.filter(e => e.lines?.length || /^ARC_/.test(e.type) || e.cinematic), start, end),
    causalReturns: { edgesAtLeastOneDay: causalReturns.length, edgesAtLeastThreeDays: causalReturns.filter(e => e.daysLater >= 3).length,
      distinctReturningEvents: new Set(causalReturns.map(e => e.eventId)).size, examples: causalReturns.slice(0, 20) },
    adjacencyInterruptions: { potentialABAWithinHour: switches.length, examples: switches.slice(0, 16),
      caveat: 'Location A/B/A is a review candidate, not proof of error; Elsewhere labels and narrative cause may justify it.' },
    top20EditorialTriage: exact.top.map((r, i) => ({ rankByFrequency: i + 1, sentence: r.examples[0].text,
      count: r.count, days: r.days, types: r.types, annoyanceProxy: r.count >= 20 ? 'high' : r.count >= 8 ? 'medium' : 'review',
      recommendedAction: fixFor(r), intentionalMotif: 'human review required; recurrence alone cannot establish intent' })),
    authorReviewSample: samples };
}

export async function runAudit({ out = resolve(root, 'reports/new-viewer-baseline.json'), baselineEmptyArchive = false, applyReaderPolicy = false, startDay = '2026-09-08', seeds = [DEFAULT_SEED, `${DEFAULT_SEED}:new-viewer-b`, `${DEFAULT_SEED}:new-viewer-c`] } = {}) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Network/LLM forbidden in offline newcomer audit'); };
  const start = atLondon(startDay, '00:00'), runs = [], sourceHashes = {};
  for (const relative of ['src/fixture.mjs', 'src/arcs.mjs', 'src/editorial.mjs', 'cloudflare/src/world-durable-object.mjs', '../worldstream/app/app.js'])
    sourceHashes[relative] = digest(await readFile(resolve(root, relative)));
  try {
    for (const seed of seeds) {
      const db = new DatabaseSync(':memory:');
      const ctx = { storage: { sql: createMockSqlStorage(db), async getAlarm() { return null; }, async setAlarm() {}, async deleteAlarm() {} },
        getWebSockets() { return []; }, acceptWebSocket() {} };
      const world = new WorldDurableObject(ctx, { WORLD_SEED: seed, START_MS: start, PRESENTATION_ENABLED: 'false', CINEMATIC_ENABLED: 'false' });
      // Baseline ran before the packet-key bug was fixed and accepted zero
      // cinematics for all three seeds. Reproduce that observed read-side state
      // explicitly if the independent fix has landed while this audit runs.
      if (baselineEmptyArchive) world.maybeIngestCinematic = () => {};
      const observed = new Map(), daily = [], returns = [];
      for (let hour = 1; hour <= 30 * 24; hour++) {
        const now = start + hour * HOUR;
        world.advance(now);
        const projection = world.publicWorldForApi();
        for (const e of projection.events) if (e.occurredAt < now) observed.set(e.id, e);
        if ([12, 14, 24, 36, 168, 180, 720].includes(hour)) {
          for (const absence of [2, 24, 168].filter(n => n < hour)) {
            const at = now - absence * HOUR, stored = { version: 2, boundary: { at, eventId: null, kind: 'acknowledged' }, viewed: [], lastViewed: null };
            const loaded = buildReadingRecap(projection, { events: projection.events, completeSince: projection.events[0]?.occurredAt ?? now }, stored);
            returns.push({ now, absenceHours: absence, latest40Only: loaded });
          }
        }
        if (hour % 24 === 0) daily.push({ through: now, stories: projection.stories, storyThreads: projection.storyThreads,
          intentions: projection.intentions, operations: projection.operations });
      }
      const raw = db.prepare('SELECT semantic_json FROM events ORDER BY seq').all().map(r => JSON.parse(r.semantic_json));
      const allPublic = publicEvents({ events: raw }, Infinity).filter(e => e.occurredAt < start + 30 * DAY);
      const events = allPublic.map(e => observed.get(e.id) ?? e);
      const cinematics = db.prepare('SELECT event_id,occurred_at,score,band,status FROM cinematics ORDER BY occurred_at').all();
      const windows = {}, readerWindows = {};
      for (const days of [1, 7, 30]) {
        const end = start + days * DAY, rows = events.filter(e => e.occurredAt < end);
        windows[days] = analyse(rows, raw, start, end, cinematics);
        if (applyReaderPolicy) readerWindows[days] = analyse(forwardReadingEvents(rows).filter(e => e.readerWeight > 0), raw, start, end, cinematics);
      }
      const provenance = raw.filter(e => e.visibility === 'public').map(e => ({ id: e.id, type: e.type, occurredAt: e.occurredAt,
        location: e.location, participants: e.participants, causedBy: e.causedBy,
        family: Object.fromEntries(Object.entries(e.payload ?? {}).filter(([k, v]) => typeof v === 'string' &&
          /^(?:kind|mood|outcome|activity|arcId|arcKey|storyId|family|practiceId|supportingStoryId|offscreenStoryId|nightStoryId|sceneId)$/.test(k))) }));
      runs.push({ seed, start, end: start + 30 * DAY, rulesVersion: RULES_VERSION,
        canonicalEventsDigest: digest(raw), finalStateDigest: digest(db.prepare('SELECT state_json FROM world_state WHERE id=1').get().state_json),
        rawEvents: raw.length, observedHourlyPublicEvents: observed.size, publicHistoryEvents: events.length,
        unobservedByHourlyPoll: allPublic.filter(e => !observed.has(e.id)).length, windows, readerWindows, returns, daily,
        publicEvents: events, publicProvenance: provenance, cinematicRecords: cinematics });
      db.close();
      console.log(JSON.stringify({ seed, public: events.length, sevenDay: windows[7].tags, thirtyDay: windows[30].tags,
        repeatedSentences: windows[30].exactSentences.repeatedOccurrences, sentences: windows[30].exactSentences.total,
        maximumDevelopmentGapHours: windows[30].developmentGaps.maximumHours, cinematics: cinematics.length }));
    }
  } finally { globalThis.fetch = originalFetch; }
  const report = { version: 1, measuredAt: new Date().toISOString(), sourceHashes,
    methodology: { baselineEmptyArchive, applyReaderPolicy, adapter: 'Integrated Cloudflare WorldDurableObject; production reducer and publicWorldForApi. SQLite mock from existing Cloudflare tests, entirely :memory:.',
      windows: `One common thirty-day continuity per seed; nested 1/7/30-day windows from ${startDay} London midnight. ${seeds.length} independent seed(s); no restart/reset between days.`,
      pace: 'advance and observe once per simulated hour; canonical due actions retain their scheduled times. Real service alarms every minute. No timing/performance claim.',
      text: 'Each unique public event counted once, using app.js Reading View precedence. Hourly enriched latest40 projection union; history projection fills any missed rows. Re-reading/hero repetition not counted.',
      repeat: 'Exact = NFKC + case/whitespace/curly quote folding. Sentence split on .!?. Structure = exact after person/place/number masking, a conservative template proxy, NOT an embedding/grammar judgement. Openings/endings = four tokens.',
      tags: 'Overlapping event-type proxy tags; not all tags sum to event total. Authored_prose means projected nonroutine prose register, not independently author-approved scene. Meaningful development is an explicit state/story event-type proxy, not literary quality.',
      limits: ['Not live-world persistence or production traffic. Does not exercise real Cloudflare alarms/storage limits/WebSockets.',
        'No author keep-rate asserted: review sample fields are null. No all-seed reachability proof.',
        'No LLM execution: global fetch forbidden. Cinematic fallback ingestion is unchanged production code.',
        'The return samples here deliberately use latest40 only. The fixed-window reader pagination is verified separately by the history/return test suites.',
        'No runtime Moment lab/shadow promotion; measures only currently integrated public renderer.',
        'Annoyance ranking is frequency-based editorial triage, not a user survey.'] }, runs };
  await mkdir(dirname(out), { recursive: true }); await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Saved ${out}`);
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const flag = process.argv.indexOf('--out');
  await runAudit({ baselineEmptyArchive: process.argv.includes('--baseline-empty-archive'), applyReaderPolicy: process.argv.includes('--reader-policy'), ...(flag >= 0 ? { out: resolve(process.argv[flag + 1]) } : {}) });
}
