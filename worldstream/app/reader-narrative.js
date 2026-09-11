// Reader presentation only. Inputs are committed public projections, never a
// scheduler, private memory, inferred motive or generation request.
const ACTIVE = new Set(['active', 'unfinished', 'promised', 'met', 'interrupting',
  'requested', 'called', 'working', 'recovering', 'offered', 'renegotiating', 'reserved', 'started', 'failed']);
const VISUAL = new Set(['WEATHER_CHANGE', 'FACTION_STATUS', 'PRACTICE_END', 'ACTIVITY_COMPLETE']);
const ROUTINE = new Set(['MEAL_BEGIN', 'REST_BEGIN', 'PRACTICE_BEGIN', 'TRAVEL_DEPART', 'TRAVEL_ARRIVE']);
const SCENE = new Set(['VENUE_SCENE', 'LEGION_VISIT', 'SCENE_BANK_BEAT', 'INCIDENT', 'ARC_BEAT', 'NIGHT_WORK_BEGIN', 'NIGHT_WORK_END']);
const ORDINARY = new Set([...VISUAL, ...ROUTINE, 'CROSS_PATHS', 'BRIEFING_BEGIN',
  'COMMS_CHECK_BEGIN', 'WAIT_BEGIN', 'STANDBY_BEGIN', 'LOCATION_MODE', 'DAY_PHASE', 'LINTELS', 'FAUNA',
  'FACTION_NOTICE', 'INSTITUTION_NOTICE']);
const STORY = /^(?:ARC_|INK_|THREAD_|INTENT_|AGENDA_|GROUND_|SUPPORTING_|NIGHT_|OFFSCREEN_)/;
const CHANGE = new Set(['INCIDENT', 'AFTERMATH', 'ARCANE_SURGE', 'MINOR_ANOMALY',
  'PLAN_BROKEN', 'PLAN_CHANGE', 'OUTING_CUT_SHORT', 'ANNOUNCE_ARRANGEMENT',
  'INVITATION_ACCEPTED', 'SMALL_DISAGREEMENT', 'GAME_PAUSE', 'GAME_RESUME']);
const ROUTINE_MAINTENANCE = /^(?:GROUND_RESTRICTION|GROUND_PREPARATION|GROUND_PREPARED|GROUND_WORK_INTERRUPTED|GROUND_WORK_OPPORTUNITY)$/;
const MUNDANE_BEATS = new Set(['CROSS_PATHS', 'PLAN_CHANGE', 'ANNOUNCE_ARRANGEMENT', 'SMALL_DISAGREEMENT', 'GAME_PAUSE', 'GAME_RESUME']);
const DAY_FORMAT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London',
  year: 'numeric', month: '2-digit', day: '2-digit' });
const CHAPTER_FORMAT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London',
  weekday: 'long', day: 'numeric', month: 'long' });
const dateParts = (formatter, at) => Object.fromEntries(formatter.formatToParts(at)
  .filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
const chapterDate = at => {
  const day = dateParts(DAY_FORMAT, at), label = dateParts(CHAPTER_FORMAT, at);
  return { key: `${day.year}-${day.month}-${day.day}`, label: `${label.weekday}, ${label.day} ${label.month}` };
};
const normalise = value => String(value ?? '').normalize('NFKC').replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase();
const authoredSurface = event => event.prose || event.description || '';
const dialogue = event => Boolean(event.lines?.length || event.sceneBeats?.length || event.cinematic?.scene);
const hasContext = event => Boolean(event.memoryCallback || event.contextBridge);
const consequence = event => STORY.test(event.type) || CHANGE.has(event.type);
const origins = event => [event.memoryCallback?.originEventId, event.contextBridge?.originEventId,
  ...(event.contextBridge?.origins ?? []).map(origin => origin.eventId)].filter(Boolean);
const cast = event => new Set(event.participants ?? []);
const sameCast = (a, b) => {
  const first = cast(a), second = cast(b);
  return first.size === 0 && second.size === 0 || [...first].some(id => second.has(id));
};
const samePlace = (a, b) => a.location === b.location && (!a.room || !b.room || a.room === b.room);
const storyKey = event => event.storyRef?.id ? `${event.storyRef.type}:${event.storyRef.id}` : null;

export function loadedDialogueScenes(events = [], accepted = []) {
  const ids = new Set(accepted.map(record => record.eventId));
  return [...new Map(events.filter(event => event.id && (event.lines?.length || event.sceneBeats?.length) && !ids.has(event.id))
    .map(event => [event.id, event])).values()].sort((a, b) => b.occurredAt - a.occurredAt);
}

export function narrativeWeight(event) {
  if (Number.isInteger(event?.readerWeight) && event.readerWeight >= 0 && event.readerWeight <= 3) return event.readerWeight;
  if (event?.cinematic?.scene || event?.lines?.length || SCENE.has(event?.type)) return 3;
  if (event?.memoryCallback || event?.contextBridge) return 2;
  if (VISUAL.has(event?.type)) return 0;
  if (ROUTINE.has(event?.type)) return 1;
  return event?.register === 'prose' || event?.prose ? 2 : 1;
}

export function newcomerOrientation(world = {}) {
  const now = world.resolvedThrough;
  const threads = (world.storyThreads || []).filter(item => ACTIVE.has(item.status)
    && typeof item.title === 'string' && Number.isSafeInteger(item.openedAt)
    && Number.isSafeInteger(now) && item.openedAt <= now);
  return { status: world.worldStatus || '',
    people: (world.characters || []).filter(person => ['goaden', 'ashai'].includes(person.id))
      .map(({ id, name, location, activity }) => ({ id, name, location, activity })),
    threads: [...new Map(threads.map(item => [`${item.type}:${item.id}`, item])).values()].slice(0, 3) };
}

export function createNewcomerOrientation({ container, locationLabel, activityLabel, onThread = () => {}, storage } = {}) {
  if (!container) return { update() {} };
  if (storage === undefined) { try { storage = globalThis.localStorage; } catch {} }
  const doc = container.ownerDocument;
  const body = container.querySelector('.newcomer-body');
  const element = (tag, text) => { const node = doc.createElement(tag); node.textContent = text; return node; };
  let seen = false, signature = '';
  try { seen = storage?.getItem('silver-clouds-newcomer-seen') === '1'; } catch {}
  container.open = !seen;
  // Seen means explicitly dismissed, not merely fetched in a hidden tab.
  container.addEventListener('toggle', () => {
    if (!container.open) { try { storage?.setItem('silver-clouds-newcomer-seen', '1'); } catch {} }
  });
  return { update(world) {
    const model = newcomerOrientation(world), next = JSON.stringify(model);
    if (next === signature) return; signature = next;
    const nodes = [element('p', 'Worldstream is a living fantasy novel unfolding in real time. The people of Silver Clouds carry on with their lives whether you are watching or not.')];
    const introduction = element('p', '');
    const personLink = (name, path) => { const link = element('a', name); link.href = `../../${path}`; return link; };
    introduction.append(personLink('Goaden Reeves', 'goaden-reeves.html'),
      doc.createTextNode(' is an MI6 liaison and former leader of Demon’s Legion. '),
      personLink('Ashai Bennet', 'ashai-bennet.html'),
      doc.createTextNode(' works with MI6 and has celestial powers. The '),
      personLink('MEU', 'magical-enforcement-unit.html'),
      doc.createTextNode(' is MI6’s Magical Enforcement Unit.'));
    nodes.push(introduction);
    if (model.status) {
      const status = element('p', ''); status.append(element('strong', 'Right now · '), doc.createTextNode(model.status)); nodes.push(status);
    }
    for (const person of model.people) {
      const row = element('p', ''); row.append(element('strong', `${person.name} · `),
        doc.createTextNode(`${locationLabel(person.location)} · ${activityLabel(person.activity)}`)); nodes.push(row);
    }
    nodes.push(element('strong', 'Open threads'));
    const list = element('ul', '');
    for (const thread of model.threads) {
      const row = element('li', ''), link = element('button', thread.title); link.type = 'button';
      link.addEventListener('click', () => onThread({ kind: 'thread', type: thread.type, threadId: thread.id, eventId: thread.eventId }));
      row.append(link); list.append(row);
    }
    nodes.push(model.threads.length ? list : element('p', 'No open thread is recorded here just now.'));
    body.replaceChildren(...nodes);
  } };
}

// This is a deterministic edit of public history. Keep the ledger intact and
// return every row: the ordinary-record toggle can still recover every event.
// Replaying the same history yields the same selection across pages and polls;
// no session counter, cooldown, randomness, generated prose or inferred motive.
// Callers paging the book must supply their complete loaded editorial history
// and the shared visible sequence to both pages. Unloaded history is not guessed
// to have been read or repeated. Only visible rows determine scene geometry.
export function forwardReadingEvents(events = [], locationLabel = value => value, { history = [], visible = events } = {}) {
  const requested = new Set(events.map(event => event.id));
  const visibleIds = new Set([...visible, ...events].map(event => event.id));
  const source = [...new Map([...history, ...events].filter(event => event?.id)
    .map(event => [event.id, event])).values()];
  const chronological = source.sort((a, b) => a.occurredAt - b.occurredAt
    || (Number.isSafeInteger(a.narrativeOrder) && Number.isSafeInteger(b.narrativeOrder)
      ? a.narrativeOrder - b.narrativeOrder : 0) || a.id.localeCompare(b.id));
  // Explicit earlier references can share a millisecond with their response.
  // Resolve only that tie, never move an event across its recorded timestamp.
  const ordered = [], visiting = new Set(), visited = new Set();
  const byId = new Map(chronological.map(event => [event.id, event]));
  const visit = event => {
    if (visited.has(event.id) || visiting.has(event.id)) return;
    visiting.add(event.id);
    for (const id of origins(event)) {
      const origin = byId.get(id);
      if (origin && origin.occurredAt === event.occurredAt) visit(origin);
    }
    visiting.delete(event.id); visited.add(event.id); ordered.push(event);
  };
  chronological.forEach(visit);

  // Resolve look-ahead once for the monthly history, rather than copying and
  // searching the remaining history again for every ordinary passage.
  const nextScenes = new Array(ordered.length);
  let nextScene = null;
  for (let index = ordered.length - 1; index >= 0; index--) {
    nextScenes[index] = nextScene;
    if (!ORDINARY.has(ordered[index].type) && (dialogue(ordered[index]) || SCENE.has(ordered[index].type)))
      nextScene = ordered[index];
  }

  const surfaces = new Set(), decisions = new Map();
  const neededOrigins = new Set(ordered.filter(event => dialogue(event) || hasContext(event) || consequence(event))
    .flatMap(origins));
  const lastMundaneBeat = new Map();
  for (let index = 0; index < ordered.length; index++) {
    const event = ordered[index], surface = normalise(authoredSurface(event));
    const repeated = Boolean(surface && surfaces.has(surface));
    let weight = narrativeWeight({ ...event, readerWeight: undefined });
    let prose = event.prose || '', description = event.description || '', omission = null;
    const cinematic = event.cinematic;
    if (!dialogue(event)) {
      // Ordinary activity belongs to the living-world layer unless this exact
      // occurrence supplies a scene's setup or a recorded callback's origin.
      // A new piano passage or quiet character action still earns its prose.
      const ordinary = ORDINARY.has(event.type) || event.routineContinuation === true;
      const next = nextScenes[index];
      const setup = !event.routineContinuation && next && next.occurredAt - event.occurredAt <= 15 * 60_000
        && samePlace(event, next) && sameCast(event, next);

      const isMundane = MUNDANE_BEATS.has(event.type);
      const beatKey = `${[...(event.participants || [])].sort().join(',')}:${event.type}`;
      const lastBeatAt = lastMundaneBeat.get(beatKey) || 0;
      const recentMundane = isMundane && (event.occurredAt - lastBeatAt < 20 * 3600_000);

      const isRoutineMaintenance = ROUTINE_MAINTENANCE.test(event.type);
      const hasRealOrigin = origins(event).length > 0;

      if (VISUAL.has(event.type)) {
        // Weather and completed routine remain discoverable as earlier context
        // and in the world view; being a source does not make them an opening.
        weight = 0; prose = ''; omission = 'routine';
      } else if (event.routineContinuation === true) {
        // The world explicitly says this is unchanged practice. A routine can
        // cause another routine or be recalled later without becoming fresh
        // fiction itself. Keep its source and context addressable, but do not
        // let dependency chains promote each rehearsal back into the novel.
        weight = 0; prose = ''; omission = 'routine';
      } else if (isRoutineMaintenance && repeated && !hasRealOrigin && !neededOrigins.has(event.id) && !setup) {
        // Repeated routine maintenance cycles stay in living-world, omitted from novel prose
        weight = 0; prose = ''; omission = 'repeated';
      } else if (ordinary && !hasContext(event) && !neededOrigins.has(event.id)) {
        if (recentMundane && event.type === 'CROSS_PATHS') {
          weight = 0; prose = ''; omission = 'routine';
        } else {
          weight = setup ? 1 : 0; prose = ''; omission = setup ? null : 'routine';
        }
      } else if (ordinary && neededOrigins.has(event.id)) {
        if (recentMundane && !setup) {
          weight = 0; prose = ''; omission = 'routine';
        } else {
          weight = 1; prose = '';
        }
      } else if (recentMundane && !setup && !hasRealOrigin && !neededOrigins.has(event.id)) {
        // Cooldown for ungrounded mundane beats
        weight = 0; prose = ''; omission = 'routine';
      } else if (repeated) {
        // Do not splice sentences out of a passage: that can orphan a pronoun,
        // a punch line, or a revelation. A recurring change keeps its already
        // committed factual description and its public context, without
        // performing the same paragraph as another new scene.
        prose = '';
        weight = consequence(event) || hasContext(event) || neededOrigins.has(event.id) ? 1 : 0;
        omission = weight === 0 ? 'repeated' : null;
      }

      if (weight > 0 && isMundane) {
        lastMundaneBeat.set(beatKey, event.occurredAt);
      }
    }

    // Keep the committed wording. Event type alone cannot prove a game result,
    // a lunch-hall encounter or any other variant's prerequisites. Selecting a
    // stock passage by loaded-family count also rewrote the same event whenever
    // an older page loaded. Context-validated surfaces arrive from the existing
    // public projection; this reader only decides how much of them to show.

    if (weight > 0 && surface) surfaces.add(surface);
    decisions.set(event.id, { ...event, cinematic, readerWeight: weight, readerProse: prose,
      readerDescription: description, readerOmission: omission });
  }

  // A shared recovery has two character records. Give it one paragraph in the
  // book, while retaining both original records and anchors for quiet activity.
  // Require the same committed episode, phase, place and time; names alone do
  // not make two people's nights the same night.
  const sharedRecovery = (first, second) => {
    if (storyKey(first) && storyKey(second)) return storyKey(first) === storyKey(second);
    // Legacy projections still carry exact public causal edges when the old
    // ledger did not expose its episode key. Both must name the same completed
    // joint check, which must actually be present in the loaded history.
    const secondCauses = new Set(second.earlierEventIds ?? origins(second));
    return (first.earlierEventIds ?? origins(first)).some(id => {
      const source = byId.get(id);
      return secondCauses.has(id) && source?.type === 'NIGHT_WORK_END'
        && source.occurredAt <= first.occurredAt && source.occurredAt <= second.occurredAt
        && ['goaden', 'ashai'].every(who => source.participants?.includes(who));
    });
  };
  for (let index = 0; index < ordered.length - 1; index++) {
    const first = decisions.get(ordered[index].id), second = decisions.get(ordered[index + 1].id);
    if (!['NIGHT_RETURN', 'NIGHT_RECOVERED'].includes(first.type) || first.type !== second.type
      || !sharedRecovery(first, second) || !samePlace(first, second)
      || second.occurredAt !== first.occurredAt || dialogue(first) || dialogue(second)
      || first.participants?.length !== 1 || second.participants?.length !== 1
      || new Set([...first.participants, ...second.participants]).size !== 2
      || ![...first.participants, ...second.participants].every(id => ['goaden', 'ashai'].includes(id))
      || !visibleIds.has(first.id) || !visibleIds.has(second.id)) continue;
    first.readerProse = first.type === 'NIGHT_RETURN'
      ? 'Goaden and Ashai returned to their separate quarters after the night check. Both needed rest.'
      : 'By the time Goaden and Ashai were up again, MI6 was already at work. They had rested after the night check and could return to their day.';
    first.readerWeight = 2;
    first.readerCombinedIds = [first.id, second.id];
    second.readerWeight = 0; second.readerOmission = 'shared-recovery';
  }

  let previous = null, sceneId = null;
  const presented = ordered.map(sourceEvent => {
    const event = decisions.get(sourceEvent.id);
    if (event.readerWeight === 0 || !visibleIds.has(event.id)) return { ...event, readerContext: '', readerSceneStart: false,
      readerChapter: null, readerSceneId: null };
    const chapter = chapterDate(event.occurredAt), day = chapter.key;
    const chapterStart = !previous || day !== previous.day;
    const separateStory = previous && storyKey(previous.event) && storyKey(event)
      && storyKey(previous.event) !== storyKey(event);
    const sceneStart = chapterStart || separateStory || !samePlace(previous.event, event) || !sameCast(previous.event, event)
      || event.occurredAt - previous.event.occurredAt > 90 * 60_000;
    const participants = cast(event), leads = participants.has('goaden') || participants.has('ashai');
    const place = locationLabel(event.location) || '';
    const room = event.room && normalise(event.room) !== normalise(place) ? event.room : '';
    const setting = [place, room].filter(Boolean).join(' · ');
    let context = '';
    if (sceneStart) {
      if (!previous || chapterStart) context = setting;
      else if (previous.event.location !== event.location || previous.leads !== leads)
        context = `${leads ? 'Back at' : 'Elsewhere ·'} ${setting}`;
      else context = setting;
      sceneId = event.id;
    }
    const result = { ...event, readerContext: context, readerSetting: setting, readerDay: chapter, readerSceneStart: sceneStart,
      readerSceneId: sceneId, readerChapter: chapterStart ? chapter : null };
    previous = { event, day, leads };
    return result;
  });
  const visibleSources = new Map();
  let lastVisible = null;
  for (const event of presented) {
    if (event.readerWeight === 0 || !visibleIds.has(event.id)) continue;
    const alreadyInChapter = id => Boolean(id && visibleSources.get(id) === event.readerDay.key);
    event.readerContextVisible = alreadyInChapter(event.contextBridge?.originEventId);
    event.readerMemoryVisible = alreadyInChapter(event.memoryCallback?.originEventId);
    if (lastVisible) lastVisible.readerSceneEnd = lastVisible.readerSceneId !== event.readerSceneId;
    event.readerSceneEnd = true;
    for (const id of event.readerCombinedIds ?? [event.id]) visibleSources.set(id, event.readerDay.key);
    lastVisible = event;
  }
  return presented.filter(event => requested.has(event.id));
}
