// A read-side index over recorded stories. It never advances the world, follows
// arbitrary causal edges, or groups nearby events into an invented narrative.
import { publicThreadSummaries } from './threads.mjs';
import { publicIntentSummaries } from './intent.mjs';
import { publicAgendaSummaries } from './faction-agendas.mjs';
import { publicSupportingSummaries } from './supporting-stories.mjs';
import { publicNightStories } from './night-stories.mjs';
import { publicOffscreenSummaries, OFFSCREEN_CAST } from './offscreen-lives.mjs';
import { PURSUIT_PURPOSES, PURPOSE_RULES } from './pursuit-purpose.mjs';
import { SCENE_BANK_BY_ID } from './scene-bank-catalog.mjs';
import { publicSceneBankPerformance } from './scene-bank-presentation.mjs';
import { createHash } from 'node:crypto';
import { editorialEvent, EDITORIAL_REVISION } from './editorial.mjs';

export const STORY_THREAD_TYPES = Object.freeze(['story', 'intention', 'operation']);
export const STORY_THREAD_LOOKUP_LIMIT = 32;
const TITLES = { game: 'A short game', practice: 'Shared practice', quiet: 'A quiet break' };
const terminal = status => ['resolved', 'deferred', 'failed', 'completed', 'declined', 'interrupted', 'kept', 'missed', 'cut_short', 'recovered', 'cancelled', 'shared', 'shelved'].includes(status);
const text = value => typeof value === 'string' && value.length > 0;
const own = (object, id) => Object.hasOwn(object ?? {}, id) ? object[id] : null;
const nowOf = snapshot => snapshot?.world?.resolvedThrough;
const past = (at, now) => Number.isSafeInteger(at) && at >= 0 && at <= now;
// Completion records own these IDs even after the source leaves the recent
// snapshot. A present private, future or mismatched row cannot serve as proof.
const recorded = (snapshot, id, at, now) => text(id) && past(at, now)
  && !(snapshot.events ?? []).some(event => event.id === id
    && (event.visibility !== 'public' || event.occurredAt !== at));

function purposeDescriptors(snapshot, now) {
  return Object.entries(snapshot.offscreenLives?.people ?? {}).flatMap(([guest, person]) => {
    const p = person.purpose, bank = own(PURSUIT_PURPOSES, guest), source = p?.source;
    const foundation = own(snapshot.facts, source?.factKey);
    if (!p || !bank || p.kind !== bank.kind || !text(p.id)
      || !recorded(snapshot, p.chosenEventId, p.chosenAt, now)
      || !recorded(snapshot, source?.sourceEventId, source?.establishedAt, now)
      || source.establishedAt >= p.chosenAt || foundation?.kind !== 'offscreen_result'
      || foundation.sourceEventId !== source.sourceEventId || foundation.createdAt !== source.establishedAt
      || foundation.value?.guest !== guest || foundation.value.outcome !== 'settled') return [];
    // Two exact fact keys retain an interrupted first attempt after a retry.
    // No memory text, arbitrary causal traversal or ledger scan is involved.
    const results = Array.from({ length: PURPOSE_RULES.maxAttempts }, (_, i) => own(snapshot.facts, `${p.id}:result:${i + 1}`))
      .filter(fact => fact?.kind === 'offscreen_purpose_result' && fact.value?.purposeId === p.id
        && fact.value.guest === guest && fact.value.completedWorkEventId === source.sourceEventId
        && recorded(snapshot, fact.sourceEventId, fact.createdAt, now));
    const request = p.request && p.request.at > p.chosenAt
      && recorded(snapshot, p.request.eventId, p.request.at, now) ? p.request : null;
    const result = results.at(-1), status = result?.value.outcome === 'shared' ? 'shared'
      : results.length === PURPOSE_RULES.maxAttempts && results.every(fact => fact.value.outcome === 'unheard') ? 'shelved'
        : request && (!result || request.at > result.createdAt) ? 'performing' : 'seeking';
    const record = { originEventId: source.sourceEventId,
      causalEventIds: [p.chosenEventId, ...results.flatMap(fact => [fact.value.requestEventId, fact.sourceEventId]), request?.eventId] };
    return [{ record, type: 'story', id: p.id, title: bank.choice, status,
      location: OFFSCREEN_CAST[guest].location, openedAt: source.establishedAt,
      eventId: result && (!request || result.createdAt >= request.at) ? result.sourceEventId : request?.eventId ?? p.chosenEventId }];
  });
}

function sceneDescriptors(snapshot, now) {
  const entries = Object.entries(snapshot.sceneBank?.completed ?? {}).flatMap(([id, completed]) => {
    const scene = own(SCENE_BANK_BY_ID, id);
    return scene && scene.status !== 'excluded' && recorded(snapshot, completed?.eventId, completed?.at, now)
      ? [{ id, scene, eventId: completed.eventId, at: completed.at }] : [];
  }).sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const opening = entries.find(row => row.id === 'P1'), nimbus = entries.filter(row => row.id.startsWith('P') && row.at >= (opening?.at ?? Infinity));
  const ordinary = entries.filter(row => !row.id.startsWith('P')).map(row => ({
    record: { originEventId: row.eventId }, type: 'story', id: `scene-bank:${row.id}`, title: row.scene.title,
    status: 'completed', location: row.scene.location, openedAt: row.at, eventId: row.eventId,
  }));
  if (opening) ordinary.push({ record: { originEventId: opening.eventId, causalEventIds: nimbus.map(row => row.eventId) },
    type: 'story', id: `nimbus:${opening.eventId}`, title: opening.scene.title,
    status: nimbus.some(row => row.id === 'P22') ? 'completed' : 'active', location: opening.scene.location,
    openedAt: opening.at, eventId: nimbus.at(-1).eventId });
  return ordinary;
}

function descriptors(snapshot) {
  const now = nowOf(snapshot);
  if (!Number.isSafeInteger(now)) return [];
  const stories = publicThreadSummaries(snapshot, now).map(item => {
    const record = own(snapshot.threads?.instances, item.id);
    return { record, type: 'story', id: item.id, title: item.title, status: item.status,
      location: item.location, openedAt: item.openedAt, eventId: item.eventId ?? record?.originEventId };
  });
  const intentions = publicIntentSummaries(snapshot, now).map(item => {
    const record = own(snapshot.intent?.instances, item.id);
    return { record, type: 'intention', id: item.id, title: TITLES[item.activity] ?? 'Time together',
      status: item.status, location: 'mi6', openedAt: record?.openedAt, eventId: item.eventId };
  });
  const depthStories = [...publicSupportingSummaries(snapshot, now), ...publicNightStories(snapshot, now), ...publicOffscreenSummaries(snapshot, now)].map(item => {
    const night = own(snapshot.nightStories?.episodes, item.id);
    const record = own(snapshot.offscreenLives?.projects, item.id) ?? own(snapshot.supportingStories?.instances, item.id) ?? (night ? { ...night,
      originEventId:night.requestEventId,causalEventIds:night.eventIds } : null);
    return { record, type: 'story', id: item.id, title: item.title, status: item.status,
      location: item.location, openedAt: item.openedAt, eventId: item.eventId ?? record?.originEventId };
  });
  const publicOperations = publicAgendaSummaries(snapshot, now);
  const operations = Object.values(snapshot.agendas?.operations ?? {}).filter(record => record.startedAt <= now)
    .sort((a, b) => b.startedAt - a.startedAt).slice(0, 3).map((record, index) => {
      const item = publicOperations[index];
      return { record, type: 'operation', id: record.id, title: item.title, status: item.status,
        location: item.location, openedAt: record.startedAt, eventId: item.eventId ?? record.originEventId };
    });
  return [...stories, ...depthStories, ...purposeDescriptors(snapshot, now), ...sceneDescriptors(snapshot, now), ...intentions, ...operations].filter(item => item.record && text(item.id)
    && Number.isSafeInteger(item.openedAt) && item.openedAt <= now);
}

function descriptor(row, snapshot) {
  const ids = new Set(sourceIds(row.type, row.record));
  const visible = (snapshot.events ?? []).filter(event => ids.has(event.id)
    && publicEvent(event, event.id, row.openedAt, nowOf(snapshot))).map(event => event.id).sort();
  const revision = createHash('sha256').update(JSON.stringify([EDITORIAL_REVISION, row.status, visible])).digest('hex').slice(0, 24);
  // In particular, never spread the canonical record or summary payload here.
  return { type: row.type, id: row.id, title: row.title, status: row.status,
    location: row.location, openedAt: row.openedAt, revision,
    ...(text(row.eventId) ? { eventId: row.eventId } : {}) };
}

export function listStoryThreads(snapshot) { return descriptors(snapshot).map(row => descriptor(row, snapshot)); }

function sourceIds(type, record) {
  // These fields are explicit ownership records, not guesses from time, cast or
  // location. Intention action sources include a response before its next step
  // executes, so an unanswered counteroffer is already readable.
  return [...new Set([record.originEventId,
    ...(type === 'intention' ? [record.acceptanceEventId, record.startEventId, record.interruptionEventId,
      record.resultEventId, ...Object.values(record.actions ?? {}).map(action => action.sourceEventId)]
      : [...(record.causalEventIds ?? []), record.lastEventId, record.result?.sourceEventId]),
  ].filter(text))].slice(0, STORY_THREAD_LOOKUP_LIMIT);
}

function publicEvent(event, requestedId, floor, ceiling) {
  if (event?.id !== requestedId || event.visibility !== 'public' || !text(event.publicDescription)
    || !text(event.type) || !Number.isSafeInteger(event.occurredAt)
    || event.occurredAt < floor || event.occurredAt > ceiling) return null;
  event = editorialEvent(event);
  return { id: event.id, occurredAt: event.occurredAt, type: event.type,
    location: typeof event.location === 'string' ? event.location : null,
    description: event.publicDescription, ...(text(event.prose) ? { prose: event.prose } : {}),
    ...(Array.isArray(event.lines) && event.lines.length ? { lines: event.lines } : {}),
    ...publicSceneBankPerformance(event),
    ...(event.contextBridge ? { contextBridge: event.contextBridge } : {}) };
}

/** Exact, bounded reads. eventById returns a canonical ledger row, not an action. */
export function buildStoryThread(snapshot, request, { eventById } = {}) {
  if (!STORY_THREAD_TYPES.includes(request?.type) || !text(request?.id) || request.id.length > 200) return null;
  const row = descriptors(snapshot).find(item => item.type === request.type && item.id === request.id);
  if (!row) return null;
  const ids = sourceIds(row.type, row.record), wanted = new Set(ids), cache = new Map();
  // presentationSnapshot is already bounded by the service; no full ledger read.
  for (const event of snapshot.events ?? []) if (wanted.has(event.id)) cache.set(event.id, event);
  const events = ids.flatMap(id => {
    const event = cache.get(id) ?? (typeof eventById === 'function' ? eventById(id) : null);
    const projected = publicEvent(event, id, row.openedAt, nowOf(snapshot));
    return projected ? [{ projected, seq: Number.isSafeInteger(event.seq) ? event.seq : 0 }] : [];
  }).sort((a, b) => a.projected.occurredAt - b.projected.occurredAt || a.seq - b.seq
    || a.projected.id.localeCompare(b.projected.id)).map(item => item.projected);
  const beginning = events.find(event => event.id === row.record.originEventId);
  const rest = events.filter(event => event !== beginning), latest = rest.at(-1);
  const development = latest ? rest.slice(0, -1) : [];
  const stage = (key, label, records, missing) => ({ key, label,
    state: records.length ? 'recorded' : 'not_recorded', eventIds: records.map(event => event.id),
    ...(!records.length ? { message: missing } : {}) });
  const concluded = terminal(row.status);
  return { ...descriptor(row, snapshot), concluded, resolvedThrough: nowOf(snapshot),
    stages: [stage('beginning', 'Beginning', beginning ? [beginning] : [], 'The opening public record is not available.'),
      stage('development', 'How it developed', development, 'No separate public development is recorded.'),
      stage('latest', concluded ? 'Latest consequence' : 'Latest recorded turn', latest ? [latest] : [],
        'No later public turn is recorded yet.')], events };
}
