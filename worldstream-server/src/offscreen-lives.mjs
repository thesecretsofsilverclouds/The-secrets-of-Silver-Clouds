import { createHash } from 'node:crypto';
import { atLondon, londonDate, MINUTE_MS as MIN } from './time.mjs';
import { areaOf } from './places.mjs';
import { daypart } from './sky.mjs';

// Author-approved ambient staging, not additional Book One plot. Canon sources:
// manuscript.pdf pp64–65: Yukon's gaming; pp100–101: Gabriel's verse and Rose
// beside the drum kit; pp228–230: the Legion's Sanctuary reunion. Rose keeping
// a rhythm here does not replace Anarchy as the band's drummer. Zara's ordinary
// liaison work uses the explicit PHASE0-CONTINUITY / fixture ANCHORS exception,
// not knowledge from her later manuscript introduction. No reader count enters
// selection. Public narration can witness a life that neither lead knows about.
export const OFFSCREEN_EVENT_TYPES = Object.freeze(['OFFSCREEN_START', 'OFFSCREEN_RESULT', 'OFFSCREEN_ENCOUNTER',
  'OFFSCREEN_WITNESS']);

// One thing happening, seen from several rooms.
//
// The gap this fills: the Chimes rang stronger than usual through the morning
// hour, and Rose was working two miles up in the Sanctuary at the time, and the
// feed reported those as two unrelated items. A world where a loud public event
// reaches nobody in it is a set of parallel feeds wearing one masthead.
//
// So a shared moment interrupts whoever is mid-project when it lands. Everyone
// gets an authored line for that moment — not a template with the moment's name
// slotted in — because the whole value is in what it means to *that* person in
// *that* room. Rose hears it come up through the floor and looks up from a verse
// she is cutting. Zara does not look up at all, and that is Zara.
//
// It is lines and nothing else, on the same rail as every other ambient scene:
// no fact, no memory, no plan, no relationship. It cannot even end the work it
// interrupts. Somebody looked up. That is the whole of it.
export const SHARED_MOMENTS = Object.freeze({
  chimes_pulse: {
    label: 'the Chimes of Renewal',
    yukon: 'The Chimes reached the MI6 gaming room through a wall built to stop considerably worse, and Yukon paused the run to hear them out. Through the high window the note-shaped motes were going up over the river in a long ragged line. He watched them for the whole of it, controller loose in his hands, and lost the section anyway.',
    gabriel: 'Up in the Sanctuary central hub Gabriel stopped mid-line, because nobody competes with New Big Ben and he had visibly considered it. He went to the glass instead. The motes came up past the Sanctuary at eye level from there, close enough to see the shape of them, and for a moment he was just a man at a window taking notes.',
    rose: 'In the Legion warehouse Rose was up on the drum kit with the second verse across her knee. The Chimes came in through the hole in the roof they all call the vibe, and her stylus stalled halfway through a word. She looked out at motes shaped like musical notes going up over the rooftops, one after another, until the last of them cleared the skyline. The pigeon on the rail watched the whole thing too. Then she went back to the line and cut it.',
    emily: 'Emily was closer to the Chimes than anyone in London and did not cover her ears. She was on the swing at the edge of the gardens when they went, and she stopped kicking and let the arc die on its own, head right back, watching the motes come up off the tower and over her. Every other child in the gardens had been taken home by the second peal. She stayed until the last note cleared the roofline.',
    zara: 'In the MI6 operations room the Chimes registered as a change in the hum of the screens, and one camera on the plaza feed filled up with note-shaped motes drifting across the lens. Zara did not look up at the window. She looked at the feed, wrote the hour in the margin of the handover because the hour was the useful part, and carried on.',
  },
  arcane_surge: {
    label: 'the corridor surge',
    yukon: 'Everything with a Presence in it felt the pull, including Yukon, who swore at a screen that had not done anything. His shape slipped a little at the edges before he got hold of it. The section went unattempted for a minute.',
    gabriel: 'The surge went through the Sanctuary and Gabriel\'s wings came out on their own, which is not a thing he has ever admitted they do. He stood in the middle of the floor with the verse forgotten, half ready for a fight nobody was offering.',
    rose: 'The pull reached the Sanctuary. Rose put a hand flat on the drum kit until it passed, the florals on her arm going still the way they do, and said nothing at all. When it let go she read the verse back from the top.',
    emily: 'The pull crossed the plaza gardens and every shadow on the grass leaned the wrong way at once. Emily stopped the swing with one bare foot and looked down at her own, which had leaned further than the others and took a moment longer to come back. She considered it. Then she started swinging again.',
    zara: 'Operations lit up before the sound reached it. Zara was already reading the corridor figures off the screen when the pull went through her, and the only sign of it was that she stopped typing for two seconds.',
  },
  // A storm coming in off the estuary. The most ordinary shared moment there
  // is, and the one that reaches everybody at once regardless of what they are
  // doing — which is exactly why it earns a place beside the Chimes and the
  // corridor surge. Weather is the cheapest way a world proves it is one place.
  storm_breaks: {
    label: 'the storm coming up the river',
    yukon: 'The rain hit the gaming room window like gravel and Yukon did not look up, because the section was going well for once. Two minutes later the lights browned out and it was not going well any more. He blamed the weather, out loud, at length.',
    gabriel: 'The storm arrived at the Sanctuary from underneath, which is a thing that only happens up there. Gabriel went to the glass and watched the whole front come up the river at him, and got about four lines out of it before he lost them again.',
    rose: 'The rain came through the hole in the warehouse roof they all call the vibe, directly onto the drum kit, and Rose moved the second verse out of the way before she moved herself. Then she sat in the dry half and carried on cutting, with the kit ringing behind her every time it got hit.',
    emily: 'It came over the plaza gardens in one wall and everybody ran except Emily, who stayed on the swing until the chains were too wet to hold and then a little after that. Her hair went flat against her face. She kept going.',
    zara: 'Operations does not have windows, so the storm arrived as three amber lights on the transit board and a note about the eastern line. Zara moved two things in the handover, put a fourth item under them, and did not find out it was raining until she went up.',
  },
  // The Order working the boroughs, seen from four rooms none of which are the
  // one they are in. Nobody is threatened and nothing happens: a procession goes
  // past and the whole city adjusts around it, quietly, the way a city does.
  order_procession: {
    label: 'the Order in the streets',
    yukon: 'Word came round the barracks that the Order were walking the borough, and the gaming room emptied of everyone who had a window to look out of. Yukon kept playing. He also kept glancing at the door, which rather gave the game away.',
    gabriel: 'The Order colours went along the embankment below the Sanctuary and Gabriel watched them the whole way past with his arms folded and his wings very deliberately put away. He said something under his breath that would not have improved the afternoon if anybody had heard it.',
    rose: 'The Legion warehouse has one window that faces the road and Rose was at it before the first robe came level. She did not move, and she did not put the light on, and she stayed there until the last of them had gone by. Then she went back to the verse.',
    emily: 'The Order came through the plaza gardens on the long path and the swing went still. Emily watched them from under her hair, entirely unremarkable, one more child in a public park at four in the afternoon. Not one of them looked at her. She waited a good while after they had gone before she started swinging again.',
    zara: 'Operations had the procession on three cameras before it reached the bridge. Zara logged the route, the count, and the time, because that is what the handover is for, and did not write down the part where the borough went quiet around them.',
  },
  veil_notice: {
    label: 'the Veil dates',
    yukon: 'The Veil dates came up on the common screen. Yukon read them, worked out how many days that gave him, and returned to the section with slightly more urgency than it deserved.',
    gabriel: 'Word of the Veil dates reached the Sanctuary and Gabriel immediately began planning a set nobody had asked him for. The verse was abandoned in favour of the running order of an imaginary night.',
    rose: 'Somebody read the Veil dates out across the Sanctuary floor. Rose did the arithmetic without writing it down, decided the verse would be finished by then, and went back to it.',
    emily: 'The Church lanterns went up along the embankment while Emily was on the swing, and she counted them out loud on the forward arc, in twos, until she ran out of lanterns rather than numbers. Then she started again from the other end to check.',
    zara: 'The Veil dates arrived in the ordinary way, as a line in a circular. Zara moved three things in the handover to the other side of them and thought no more about it.',
  },
});
const MOMENT_KEYS = new Set(Object.keys(SHARED_MOMENTS));
export const OFFSCREEN_FACT_KINDS = Object.freeze(['offscreen_result', 'offscreen_help']);
export const OFFSCREEN_RULES = Object.freeze({ version: 1, dailyLimit: 2, duration: 22 * MIN,
  retryDelay: 30 * MIN, retries: 2, maxAttempts: 3, retainedProjects: 12, retainedActions: 128,
  encounterCooldown: 18 * 60 * MIN, transferInterval: 30 * MIN });
export const OFFSCREEN_CAST = Object.freeze({
  yukon: { name: 'Yukon', family: 'game_retry', subject: 'the game section that keeps beating him', location: 'mi6', area: 'gaming_room',
    intention: 'Get through the section that keeps beating him.', helpMethod: 'shorter_section', help: 'take the section in halves rather than whole',
    told: { unfinished: 'It still had him, and he wanted that on the record as the game’s fault.',
      settled: 'He got through it on the fourth go and described all four.' },
    start: 'Yukon took another run at the game section that kept beating him.',
    unfinished: 'Yukon stopped at the same troublesome section. He left the next attempt for another day.',
    settled: 'Yukon got through the section on the fourth go and put the controller down before he could start another.' },
  gabriel: { name: 'Gabriel', family: 'verse_revision', subject: 'the crowded last line', location: 'sanctuary', area: 'central_hub',
    intention: 'Make the last line land without rushing it.', helpMethod: 'shorten_last_line', help: 'strip the last line back before trying the verse again',
    told: { unfinished: 'The ending was still arriving all at once, and he performed the problem rather than describing it.',
      settled: 'It lands now, he says, and he said so at some length.' },
    start: 'Gabriel worked through a verse at Sanctuary. The last line still had too much in it.',
    unfinished: 'Gabriel left the last line unfinished. He had cut words, but the ending still hurried past the beat.',
    settled: 'Gabriel brought the shortened verse to an ending that finally landed on the beat.' },
  // Rose was keeping a rhythm here, and it read as nothing at all: "the ending
  // of the repeated rhythm", left unfinished, repeated. Abstract nouns with no
  // object in them. It was also slightly wrong — Rose sits *on* the drum kit
  // [M101], Anarchy plays it [M228] — and it wasted the best thing about her,
  // which is that she says the fewest words and wins with them. So she writes
  // lyrics, and the work is cutting them. A verse getting shorter is something
  // a reader can picture; a rhythm refusing to settle is not.
  rose: { name: 'Rose', family: 'lyric_cutting', subject: 'the second verse, which keeps getting shorter', location: 'legion_hideout', area: 'venue',
    intention: 'Get the second verse down to what it actually needs.', helpMethod: 'say_it_out_loud', help: 'say the verse out loud instead of reading it back',
    told: { unfinished: 'Four lines. Three doing nothing. That was the entire account.',
      settled: 'Down to two lines, she said, and did not offer the two.' },
    start: 'Rose worked on the second verse of a new track at the Legion warehouse. It kept getting shorter.',
    unfinished: 'Rose left the second verse at four lines. Three of them were still doing nothing.',
    settled: 'Rose cut the second verse to two lines and stopped. They said what the four had been circling.' },
  // Measured over ninety days before this existed: Emily appeared nineteen
  // times, against Zara's one hundred and eighty-three. She is one of the two
  // most popular characters in the franchise and she was the least present
  // thing in the world, because she can only be met at a venue and the pair are
  // mostly at MI6. An offscreen life fixes that without putting an eleven-year-
  // old assassin in the barracks: she is simply somewhere, being somewhere.
  //
  // The project is deliberately powerless. Nothing she can do is on the page —
  // only a child alone in a public square with a bag of bread, being patient at
  // a bird that will not come, which is the most frightening thing about her
  // written the only way this side of the checkpoint can write it.
  // Everything here is out of the two Emily passages that sit before the
  // checkpoint. After she kills the man who walked her home she "stepped over
  // his corpse and shuffled into the garden", sat on a swing, and "swung with
  // her back to the house" [P00729-730]; her hands are on the swing chains
  // again when Peris finds her [P00993]. She carries a grey teddy-bear-shaped
  // bag [P00707] and goes barefoot [P01013]. The swing is hers, and a child
  // doing an ordinary thing in the wrong circumstances is the whole of her.
  //
  // Nothing after the checkpoint is touched: no Fade, no talisman, no Order, no
  // immortality, no games with anybody. She swings. That is the entire project,
  // and it is enough, because the reader supplies the rest.
  emily: { name: 'Emily', family: 'the_swing', subject: 'the swing at the edge of the plaza gardens', location: 'big_ben_plaza', area: 'venue',
    intention: 'Get the chains to go slack at the top, which is a rule she made up.',
    helpMethod: 'stop_counting', help: 'stop counting and just swing',
    told: { unfinished: 'She had not managed it. She described the rule at some length and the failure not at all.',
      settled: 'She got the chains to go slack, twice, and wanted that known.' },
    start: 'Emily was on the swing at the edge of the plaza gardens, working at getting the chains to go slack at the top.',
    unfinished: 'The chains never went slack. Emily stayed on the swing until the gardens emptied, and then a while after that.',
    settled: 'Emily got the chains to go slack at the top of the arc, twice, and sat very still afterwards.' },
  zara: { name: 'Zara', family: 'liaison_notes', subject: 'the handover entry nobody could read straight', location: 'mi6', area: 'ops_room',
    intention: 'Leave the next ordinary handover clearer than she found it.', helpMethod: 'separate_notes', help: 'lift the bad entry out and rewrite it on its own',
    told: { unfinished: 'Still ambiguous, still flagged, and still going to be somebody’s problem on the next shift.',
      settled: 'She pulled the muddled entry out and wrote a clean one, which she reported as a good afternoon.' },
    start: 'Zara cleared the handover notes she could finish. One entry nobody could read straight kept her at the desk.',
    unfinished: 'Zara flagged the bad entry for the morning and left the rest of the handover clean.',
    settled: 'Zara separated the muddled entry from the ordinary handover and left a clearer note in its place.' },
});
const IDS = Object.keys(OFFSCREEN_CAST), TYPES = new Set(OFFSCREEN_EVENT_TYPES), DAY = 24 * 60 * MIN;
const SOURCES = new Set(['SUPPORTING_ENCOUNTER', 'SUPPORTING_OUTCOME', 'VENUE_SCENE', 'LEGION_VISIT']);
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 24);
const of = state => state.offscreenLives ?? initialOffscreenLives();
const unique = values => [...new Set(values.filter(Boolean))];
const overlaps = (start, end, at, until) => start < until && at < end;
const personName = lead => lead === 'goaden' ? 'Goaden' : 'Ashai';

// --------------------------------------------------------- night residence
//
// Where a tracked figure sleeps. Deliberately **not** a timetable: one place,
// one activity, and only in the dark. The Moment Engine's shadow run showed
// Yukon present at 30 opportunities across four worlds and all 30 in
// `mi6/gaming_room`, because the only place the world ever put him was his
// project. He works and games at MI6; canon puts the connected barracks there
// (manuscript pp.63-64) and `quarters` already permits `sleeping`.
//
// This declares capability, not behaviour. Nothing in the running world calls
// it yet, it commits no event, invents no journey and writes no `lastSeen` —
// `noteOffscreenPresence` remains the only thing that records an appearance,
// and it still requires a committed public event.
export const NIGHT_RESIDENCE = Object.freeze({
  yukon: Object.freeze({ location: 'mi6', area: 'quarters', activity: 'sleeping' }),
});

export const NIGHT_PRESENCE_RULES = Object.freeze({
  // Where he is: the quarters, from the evening through to the small hours.
  dayparts: Object.freeze(['night', 'small_hours']),
  // When he can be *up*: the small hours only. `night` starts at 19:00, so
  // allowing wakefulness across the whole residence window made him available
  // for nine hours a stretch — which is an evening routine, not the rare thing
  // that was asked for. Being awake at eight in the evening is also not the
  // situation any of this exists to produce.
  awakeDayparts: Object.freeze(['small_hours']),
  // Deterministic, and roughly one night in eleven. A figure reliably up at
  // three has a timetable, which is the thing to avoid.
  awakeDivisor: 11,
});

/** Where `id` is during the dark hours, or null if they have no residence. */
export function offscreenNightPlace(id, at) {
  const home = NIGHT_RESIDENCE[id];
  if (!home || !Number.isSafeInteger(at)) return null;
  const part = daypart(at);
  if (!NIGHT_PRESENCE_RULES.dayparts.includes(part)) return null;
  // `night` begins at 19:00, and reporting somebody as asleep at seven in the
  // evening is simply wrong. One distinction, not a schedule: in his room in
  // the evening, asleep in the small hours. Both are permitted activities of
  // the quarters and both read as `asleep` to the grammar.
  return part === 'small_hours' ? home : { ...home, activity: 'resting' };
}

/**
 * Whether `id` is awake at this hour of the night. Deterministic in the seed
 * and the calendar day, so a run replays exactly and a rare night stays the
 * same rare night.
 */
export function offscreenAwakeAtNight(id, at, seed = '') {
  if (!offscreenNightPlace(id, at)) return false;
  if (!NIGHT_PRESENCE_RULES.awakeDayparts.includes(daypart(at))) return false;
  const key = `${seed}|night-presence-v1|${id}|${londonDate(at)}`;
  return parseInt(hash(key).slice(0, 8), 16) % NIGHT_PRESENCE_RULES.awakeDivisor === 0;
}

export function initialOffscreenLives() {
  return { version: 1, people: Object.fromEntries(IDS.map(id => [id, { currentProjectId: null,
    lastStartedAt: null, startedCount: 0, projectCount: 0, commitment: null, lastSeen: null, knowledge: [], encounters: {} }])),
  projects: {}, issued: {}, counts: {} };
}
export function offscreenAvailable(state, id, { atMs, until = atMs + 1, location } = {}) {
  if (!IDS.includes(id)) return true;
  if (!Number.isSafeInteger(atMs) || !Number.isSafeInteger(until) || until <= atMs) return false;
  const record = of(state).people[id], lastSeen = record?.lastSeen, held = record?.commitment;
  if (lastSeen && (lastSeen.at > atMs || location && lastSeen.location !== location
    && atMs - lastSeen.at < OFFSCREEN_RULES.transferInterval)) return false;
  return !held || !overlaps(held.startAt, held.until, atMs, until);
}
// Inspect existing reservations directly to avoid a circular import when those
// modules use offscreenAvailable themselves. Interval checks cover commitments
// which start after this probe, not merely figures who are busy at this instant.
function otherAvailable(state, guest, at, until, encounter = null) {
  const agenda = state.agendas?.supporting?.[guest]?.commitment;
  if (agenda && overlaps(agenda.startAt, agenda.until, at, until)) return false;
  for (const row of Object.values(state.supportingStories?.instances ?? {})) {
    if (!['promised', 'met', 'interrupting'].includes(row.status) || !row.guests?.includes(guest)
      || !overlaps(row.openedAt, row.deadlineAt, at, until)) continue;
    if (encounter && row.lead === encounter.lead && row.location === encounter.location && row.area === encounter.area
      && row.causalEventIds?.includes(encounter.eventId)) continue;
    return false;
  }
  const held = state.encounter;
  if (held?.until > at && [held.cast, held.visitors, held.guests].flat().includes(guest)
    && (!encounter || held.area !== encounter.area)) return false;
  return true;
}
function roomOpen(guest, at) {
  const place = OFFSCREEN_CAST[guest];
  return ['midday', 'evening'].includes(daypart(at)) && areaOf(place.location, place.area)?.dayparts.includes(daypart(at));
}
const shape = action => ({ type: action.type, dueAt: action.dueAt, priority: action.priority, day: action.day,
  version: action.version, projectId: action.projectId ?? null, token: action.token ?? null,
  retry: action.retry ?? 0, guest: action.guest ?? null, actors: action.actors ?? [],
  encounter: action.encounter ?? null, moment: action.moment ?? null });
const proposal = (id, at, type = 'OFFSCREEN_START', extra = {}) => ({ id, type, dueAt: at,
  priority: 29, day: londonDate(at), version: 1, actors: [], ...extra });
function sourceCast(event) {
  return unique([...(event.payload?.cast ?? []), ...(event.payload?.visitors ?? []),
    ...(event.payload?.who ? [event.payload.who] : [])]);
}
// A conservative gap between witnessed places prevents a figure appearing at
// MI6 and Sanctuary ten minutes apart. This records only an actual appearance;
// it creates no journey, ETA, invented visit, or continuous movement tick.
export function noteOffscreenPresence(ctx) {
  if (ctx.event.visibility !== 'public' || ctx.event.id !== ctx.id || ctx.event.occurredAt !== ctx.now
    || !Number.isSafeInteger(ctx.now) || !areaOf(ctx.event.location, ctx.event.area)) return;
  for (const guest of sourceCast(ctx.event).filter(id => IDS.includes(id))) {
    const before = of(ctx.state).people[guest].lastSeen;
    if (before && before.at > ctx.now) continue;
    const lastSeen = { at: ctx.now, location: ctx.event.location, area: ctx.event.area, eventId: ctx.id };
    if (before?.eventId === ctx.id) {
      if (JSON.stringify(before) !== JSON.stringify(lastSeen)) throw new Error('An offscreen appearance changed its physical location');
      continue;
    }
    person(ctx, guest, { lastSeen });
  }
}
function ownedEncounter(ctx, proof) {
  return proof && ctx.event.visibility === 'public' && SOURCES.has(ctx.event.type)
    && proof.eventId === ctx.id && proof.occurredAt === ctx.now && proof.type === ctx.event.type
    && proof.location === ctx.event.location && proof.area === ctx.event.area
    && sourceCast(ctx.event).includes(proof.guest) && ctx.event.participants.includes(proof.lead);
}
export function issueOffscreenActions(ctx, proposals) {
  const result = [];
  for (const action of proposals) {
    if (!TYPES.has(action.type) || action.version !== 1 || !Number.isSafeInteger(action.dueAt) || action.dueAt <= ctx.now
      || action.day !== londonDate(action.dueAt) || action.type === 'OFFSCREEN_ENCOUNTER' && !ownedEncounter(ctx, action.encounter))
      throw new Error('Offscreen action requires an owned, strictly future causal source');
    const current = of(ctx.state); if (current.issued[action.id]) continue;
    const issued = Object.fromEntries(Object.entries(current.issued).filter(([, row]) => row.shape.dueAt >= ctx.now - 4 * DAY));
    if (Object.keys(issued).length >= OFFSCREEN_RULES.retainedActions) throw new Error('Offscreen action budget exceeded');
    issued[action.id] = { shape: shape(action), sourceEventId: ctx.id, consumed: false };
    ctx.ops.setOffscreenLives({ ...current, issued }); result.push(action);
  }
  return result;
}
/**
 * The follow-ups for a shared moment: one per person currently mid-project.
 *
 * Called from whatever published the moment, so the witnessing is caused by the
 * event rather than scheduled alongside it — the ledger shows the Chimes, then
 * shows Rose looking up because of them.
 */
export function offscreenWitnessActions(ctx, moment) {
  if (!MOMENT_KEYS.has(moment)) return [];
  const current = of(ctx.state), at = ctx.now + 2 * MIN;
  if (londonDate(at) !== londonDate(ctx.now)) return [];
  const active = Object.values(current.projects)
    .filter(project => project.status === 'active' && SHARED_MOMENTS[moment][project.guest]
      && project.attemptStartedAt <= ctx.now && ctx.now < project.attemptStartedAt + OFFSCREEN_RULES.duration)
    .sort((a, b) => a.guest.localeCompare(b.guest));
  return issueOffscreenActions(ctx, active.map(project =>
    proposal(`${ctx.id}/witness/${project.guest}`, at, 'OFFSCREEN_WITNESS',
      { projectId: project.id, token: project.token, moment })));
}
export function offscreenDayActions({ state, day, now, parentActionId, parentEventId }) {
  if (!parentActionId || !parentEventId) return [];
  return ['12:48', '18:18'].map(time => proposal(`${day}/offscreen/${time.replace(':', '')}`, atLondon(day, time)))
    .filter(action => action.dueAt > now && !of(state).issued[action.id]);
}
const usableMemory = (state, lead, fact, now) => fact && fact.createdAt <= now
  && state.characters[lead]?.knowledge?.find(row => row.factKey === fact.key && row.sourceEventId === fact.sourceEventId
    && row.learnedAt <= now && row.acquisitionEventId && (row.validUntil == null || row.validUntil > now));
function knownEarlierAttempt(state, project, lead, now) {
  // A familiar difficulty need not be the identical sheet of notes or verse.
  // What carries over is an explicitly learned ordinary result for this guest
  // and this authored activity, never arbitrary private facts or other people.
  return Object.values(state.facts).filter(row => row.kind === 'offscreen_result'
    && row.value?.guest === project.guest && row.value.family === project.family && row.value.outcome === 'unfinished'
    && row.createdAt < project.result.completedAt && usableMemory(state, lead, row, now))
    .sort((a, b) => b.createdAt - a.createdAt || a.key.localeCompare(b.key))[0];
}
// A modest preference for an already eligible guest can let a remembered life
// cross the foreground again. This grants neither a room nor a free interval.
export function offscreenEncounterInterest(state, lead, guest, now) {
  if (!IDS.includes(guest) || !['goaden', 'ashai'].includes(lead)) return 0;
  const person = of(state).people[guest], project = of(state).projects[person.currentProjectId];
  if (!project?.result || project.status !== 'waiting' || project.help
    || person.encounters[lead] && now - person.encounters[lead].at < OFFSCREEN_RULES.encounterCooldown) return 0;
  return usableMemory(state, lead, state.facts[project.result.factKey], now)
    || knownEarlierAttempt(state, project, lead, now) ? 1 : 0;
}
function readyLead(state, proof, now) {
  const actor = state.characters?.[proof.lead];
  return actor && !actor.journey && !['sleeping', 'training', 'in_a_briefing', 'on_call', 'receiving_tattoo'].includes(actor.activity)
    && actor.location === proof.location && actor.area === proof.area
    && areaOf(actor.location, actor.area)?.social && areaOf(actor.location, actor.area).dayparts.includes(daypart(now));
}
export function offscreenEncounterActions({ state, now, parentActionId, parentEventId, cast = [], participants = [],
  location, area, sourceType }) {
  if (!parentActionId || !parentEventId || !SOURCES.has(sourceType)) return [];
  const current = of(state), choices = IDS.filter(guest => cast.includes(guest))
    .flatMap(guest => participants.filter(lead => ['goaden', 'ashai'].includes(lead)).map(lead => ({ guest, lead })))
    .filter(({ guest, lead }) => {
      const person = current.people[guest], project = current.projects[person.currentProjectId];
      const prior = person.encounters[lead];
      return project?.result && project.result.completedAt < now && (!prior || now - prior.at >= OFFSCREEN_RULES.encounterCooldown)
        && readyLead(state, { lead, location, area }, now) && offscreenAvailable(state, guest, { atMs: now, until: now + 2, location });
    }).sort((a, b) => (current.people[a.guest].encounters[a.lead]?.at ?? -1)
      - (current.people[b.guest].encounters[b.lead]?.at ?? -1) || `${a.guest}:${a.lead}`.localeCompare(`${b.guest}:${b.lead}`));
  // One small reference per actual encounter, not a chorus of exposition.
  const choice = choices[0]; if (!choice) return [];
  const project = current.projects[current.people[choice.guest].currentProjectId];
  return [proposal(`${parentActionId}/offscreen/${choice.guest}/${choice.lead}`, now + 1, 'OFFSCREEN_ENCOUNTER', {
    guest: choice.guest, projectId: project.id, token: project.token,
    encounter: { eventId: parentEventId, occurredAt: now, type: sourceType, location, area, ...choice },
  })];
}
function save(ctx, patch) { ctx.ops.setOffscreenLives({ ...of(ctx.state), ...patch }); }
function person(ctx, guest, patch) {
  save(ctx, { people: { ...of(ctx.state).people, [guest]: { ...of(ctx.state).people[guest], ...patch } } });
}
function touch(ctx, project, patch) {
  const next = { ...project, ...patch, lastEventId: ctx.id,
    causalEventIds: unique([...project.causalEventIds, ctx.id]).slice(-18) };
  save(ctx, { projects: { ...of(ctx.state).projects, [project.id]: next } }); return next;
}
function guestLearns(ctx, guest, fact) {
  const current = of(ctx.state).people[guest];
  if (current.knowledge.some(row => row.factKey === fact.key && row.sourceEventId === fact.sourceEventId)) return;
  person(ctx, guest, { knowledge: [...current.knowledge, { factKey: fact.key, sourceEventId: fact.sourceEventId,
    acquisitionEventId: ctx.id, learnedAt: ctx.now, validUntil: fact.validUntil }].slice(-12) });
}
function publish(ctx, project, stage, description, extra = {}) {
  ctx.event.location = project.location; ctx.event.area = project.area; ctx.event.participants = [];
  ctx.event.payload = { offscreenStoryId: project.id, guest: project.guest, cast: [project.guest],
    family: project.family, subject: OFFSCREEN_CAST[project.guest].subject, stage, attempt: project.attempt,
    projectNumber: project.projectNumber, continuation: project.attempt > 1,
    ...(stage === 'started' ? { newProject: true } : {}),
    ...(project.previousResult ? { previousOutcome: project.previousResult.outcome,
      previousResultEventId: project.previousResult.sourceEventId } : {}), ...extra };
  ctx.ops.publish(description);
}
function retry(ctx) {
  const at = ctx.now + OFFSCREEN_RULES.retryDelay, retries = ctx.action.retry ?? 0;
  if (retries >= OFFSCREEN_RULES.retries || londonDate(at) !== ctx.action.day || !['midday', 'evening'].includes(daypart(at))) return;
  ctx.followups.push(...issueOffscreenActions(ctx, [proposal(`${ctx.action.id}/retry`, at, 'OFFSCREEN_START', { retry: retries + 1 })]));
}
export function resolveOffscreenAction(ctx) {
  const { state, action, now, ops } = ctx;
  if (!TYPES.has(action.type)) return false;
  const refuse = reason => { ops.skip(reason); return true; }, current = of(state), issued = current.issued[action.id];
  if (!issued || issued.consumed || now !== action.dueAt || JSON.stringify(issued.shape) !== JSON.stringify(shape(action)))
    return refuse('No owned offscreen action');
  let project = action.projectId ? current.projects[action.projectId] : null;
  if (action.type !== 'OFFSCREEN_START' && (!project || project.token !== action.token)) return refuse('No matching offscreen life');
  save(ctx, { issued: { ...current.issued, [action.id]: { ...issued, consumed: true } } });
  ctx.event.causedBy.push(issued.sourceEventId);
  if (action.type === 'OFFSCREEN_WITNESS') {
    // Somebody looked up. It cannot finish the work, cannot teach anybody
    // anything and cannot move the attempt along — if the project ended in the
    // two minutes between the moment and this, the moment simply passes unseen.
    const line = SHARED_MOMENTS[action.moment]?.[project.guest];
    if (!line || project.status !== 'active') return refuse('The moment passed them by');
    publish(ctx, project, 'witness', line, { moment: action.moment });
    return true;
  }
  if (action.type === 'OFFSCREEN_START') {
    const day = londonDate(now), count = of(state).counts[day] ?? 0;
    if (count >= OFFSCREEN_RULES.dailyLimit) return refuse('The day already has its offscreen work');
    const options = IDS.filter(guest => {
      const record = of(state).people[guest], pending = of(state).projects[record.currentProjectId];
      return (record.lastStartedAt == null || londonDate(record.lastStartedAt) !== day)
        && pending?.status !== 'active' && roomOpen(guest, now) && roomOpen(guest, now + OFFSCREEN_RULES.duration)
        && offscreenAvailable(state, guest, { atMs: now, until: now + OFFSCREEN_RULES.duration + 1, location: OFFSCREEN_CAST[guest].location })
        && otherAvailable(state, guest, now, now + OFFSCREEN_RULES.duration + 1);
    }).sort((a, b) => of(state).people[a].startedCount - of(state).people[b].startedCount
      || (of(state).people[a].lastStartedAt ?? -1) - (of(state).people[b].lastStartedAt ?? -1)
      || hash(`${ctx.seed}|${action.id}|${a}`).localeCompare(hash(`${ctx.seed}|${action.id}|${b}`)));
    const guest = options[0]; if (!guest) { retry(ctx); return refuse('Their other commitments leave no room yet'); }
    const record = of(state).people[guest], authored = OFFSCREEN_CAST[guest], previous = of(state).projects[record.currentProjectId];
    if (previous?.status === 'waiting') {
      project = touch(ctx, previous, { status: 'active', attempt: previous.attempt + 1,
        attemptStartedAt: now, attemptStartEventId: ctx.id, previousResult: previous.result, result: null });
      ctx.event.causedBy.push(previous.result.sourceEventId);
    } else {
      const id = `life:${hash(`${ctx.id}|${guest}`)}`;
      project = { id, token: `${ctx.id}:offscreen-v1`, guest, family: authored.family, location: authored.location,
        area: authored.area, intention: authored.intention, status: 'active', attempt: 1, openedAt: now,
        attemptStartedAt: now, attemptStartEventId: ctx.id, originEventId: ctx.id, lastEventId: ctx.id,
        causalEventIds: [ctx.id], result: null, previousResult: null, help: null, projectNumber: (record.projectCount ?? 0) + 1 };
      const liveIds = new Set(Object.values(of(state).people).map(row => row.currentProjectId));
      const retained = Object.values(of(state).projects).filter(row => row.status !== 'settled' || liveIds.has(row.id))
        .sort((a, b) => b.openedAt - a.openedAt).slice(0, OFFSCREEN_RULES.retainedProjects - 1);
      save(ctx, { projects: { ...Object.fromEntries(retained.map(row => [row.id, row])), [id]: project } });
    }
    person(ctx, guest, { currentProjectId: project.id, lastStartedAt: now, startedCount: record.startedCount + 1,
      projectCount: project.projectNumber,
      commitment: { projectId: project.id, token: project.token, startAt: now, until: now + OFFSCREEN_RULES.duration + 1,
        location: project.location, area: project.area } });
    save(ctx, { counts: { ...Object.fromEntries(Object.entries(of(state).counts).filter(([date]) => date >= londonDate(now - 3 * DAY))), [day]: count + 1 } });
    const resumed = project.attempt > 1;
    const fresh = { yukon: 'Yukon chose a different section of the game for his next attempt.',
      gabriel: 'Gabriel began work on a new verse at Sanctuary. This one needed its own ending.',
      rose: 'Rose began tapping a different rhythm at Sanctuary, listening for where this one wanted to stop.',
      zara: 'Zara opened the next ordinary handover. A different unclear entry needed her attention.' };
    publish(ctx, project, resumed ? 'resumed' : 'started', resumed
      ? `${authored.name} returned to ${authored.subject}, picking up the part left unfinished.`
      : project.projectNumber > 1 ? fresh[guest] : authored.start);
    if (project.help) ctx.event.causedBy.push(project.help.sourceEventId);
    ctx.followups.push(...issueOffscreenActions(ctx, [proposal(`${project.id}/result/${project.attempt}`,
      now + OFFSCREEN_RULES.duration, 'OFFSCREEN_RESULT', { projectId: project.id, token: project.token })]));
  } else if (action.type === 'OFFSCREEN_RESULT') {
    const held = of(state).people[project.guest].commitment;
    if (project.status !== 'active' || held?.projectId !== project.id || held.token !== project.token
      || now !== project.attemptStartedAt + OFFSCREEN_RULES.duration) return refuse('This attempt no longer owns the room');
    const authored = OFFSCREEN_CAST[project.guest], helped = project.help && of(state).people[project.guest].knowledge.some(row =>
      row.factKey === project.help.factKey && row.sourceEventId === project.help.sourceEventId && row.learnedAt < now);
    const disrupted = !otherAvailable(state, project.guest, project.attemptStartedAt, now + 1);
    const outcome = !disrupted && (helped || project.attempt >= OFFSCREEN_RULES.maxAttempts
      || Number.parseInt(hash(`${ctx.seed}|${project.id}|${project.attempt}`).slice(0, 2), 16) % 3 === 0) ? 'settled' : 'unfinished';
    const description = authored[outcome], key = `${project.id}:result:${project.attempt}`;
    const fact = ops.createFact(key, 'offscreen_result', project.guest,
      { storyId: project.id, guest: project.guest, family: project.family, outcome, attempt: project.attempt, presentationText: description }, null);
    const result = { outcome, factKey: key, sourceEventId: ctx.id, completedAt: now };
    project = touch(ctx, project, { status: outcome === 'settled' ? 'settled'
      : project.attempt >= OFFSCREEN_RULES.maxAttempts ? 'deferred' : 'waiting', result });
    guestLearns(ctx, project.guest, fact); person(ctx, project.guest, { commitment: null });
    publish(ctx, project, 'result', description, { outcome, sourceEventId: ctx.id,
      ...(helped ? { helpSourceEventId: project.help.sourceEventId, helpMethod: authored.helpMethod, recalledSourceEventId: project.help.rememberedSourceEventId,
        acquisitionEventId: project.help.acquisitionEventId } : {}) });
    ctx.event.causedBy.push(project.attemptStartEventId, ...(helped ? [project.help.sourceEventId] : []));
  } else {
    const proof = action.encounter, guest = project.guest, record = of(state).people[guest], lead = proof?.lead;
    if (!proof || proof.guest !== guest || now !== proof.occurredAt + 1 || !readyLead(state, proof, now)
      || !offscreenAvailable(state, guest, { atMs: now, location: proof.location }) || !otherAvailable(state, guest, now, now + 1, proof)
      || record.currentProjectId !== project.id || !project.result || project.result.completedAt >= proof.occurredAt
      || record.encounters[lead] && now - record.encounters[lead].at < OFFSCREEN_RULES.encounterCooldown)
      return refuse('The actual encounter no longer contains this conversation');
    const fact = state.facts[project.result.factKey];
    if (!fact || fact.sourceEventId !== project.result.sourceEventId || fact.createdAt > now) return refuse('No completed public result to discuss');
    // Requiring knowledge of only the newest result would erase continuity
    // whenever the guest tried again. Familiar ordinary trouble can be recalled
    // across attempts, and across later projects in the same activity.
    const earlier = knownEarlierAttempt(state, project, lead, now);
    const recalledFact = usableMemory(state, lead, fact, now) ? fact : earlier;
    const memory = usableMemory(state, lead, recalledFact, now), authored = OFFSCREEN_CAST[guest];
    let stage = 'heard', description, acquired = ctx.id;
    if (!memory) {
      ops.learn(lead, fact, 'told_by_participant');
      // The second sentence used to be one of two generic clauses shared by
      // everybody — "it was still waiting for another attempt" told a reader
      // nothing about whose work it was or what it consisted of. Each guest
      // reports their own result now, in their own register.
      description = `${personName(lead)} heard from ${authored.name} about ${authored.subject}. ${
        authored.told?.[project.result.outcome]
        ?? (project.result.outcome === 'unfinished' ? 'It was still waiting for another attempt.'
          : 'It had finally been settled.')}`;
    } else {
      const used = ops.useMemory(lead, recalledFact.key);
      if (!used || used.sourceEventId !== recalledFact.sourceEventId || memory.learnedAt >= proof.occurredAt)
        return refuse('The earlier result was not yet known before this encounter');
      acquired = memory.acquisitionEventId;
      // They learn any intervening result in this actual conversation; its
      // existence in the public ledger never made it their knowledge earlier.
      if (recalledFact.key !== fact.key) ops.learn(lead, fact, 'told_by_participant');
      if (project.status === 'waiting' && !project.help) {
        stage = 'helped';
        description = recalledFact.value.storyId === project.id
          ? `${personName(lead)} remembered ${authored.name}’s unfinished attempt and suggested they ${authored.help}. ${authored.name} kept that approach for the next attempt.`
          : `${personName(lead)} remembered a difficulty ${authored.name} had run into before. For this new attempt, they suggested they ${authored.help}. ${authored.name} kept the suggestion.`;
        const helpFact = ops.createFact(`${project.id}:help`, 'offscreen_help', guest,
          { storyId: project.id, guest, lead, rememberedSourceEventId: recalledFact.sourceEventId,
            acquisitionEventId: memory.acquisitionEventId, presentationText: description }, null);
        ops.learn(lead, helpFact, 'participated'); guestLearns(ctx, guest, helpFact);
        project = touch(ctx, project, { help: { factKey: helpFact.key, sourceEventId: ctx.id, lead,
          rememberedSourceEventId: recalledFact.sourceEventId, acquisitionEventId: memory.acquisitionEventId } });
      } else {
        stage = 'recalled';
        description = `${personName(lead)} asked ${authored.name} about ${authored.subject} without needing the beginning again. ${project.result.outcome === 'settled'
          ? 'This time they could talk about what had worked.' : 'The next attempt already had a different approach waiting.'}`;
      }
    }
    touch(ctx, project, {});
    const old = of(state).people[guest].encounters[lead];
    person(ctx, guest, { encounters: { ...of(state).people[guest].encounters, [lead]: { at: now,
      eventId: ctx.id, sourceEventId: fact.sourceEventId, acquisitionEventId: acquired, stage,
      familiarity: Math.min(8, (old?.familiarity ?? 0) + (memory ? 1 : 0)) } } });
    publish(ctx, project, stage, description, { lead, sourceEventId: fact.sourceEventId, sourceOccurredAt: fact.createdAt,
      acquisitionEventId: acquired, acquiredAt: memory?.learnedAt ?? now, outcome: project.result.outcome,
      ...(memory ? { recalledSourceEventId: recalledFact.sourceEventId, recalledOccurredAt: recalledFact.createdAt,
        recalledStoryId: recalledFact.value.storyId, memoryScope: recalledFact.value.storyId === project.id ? 'same_project' : 'earlier_project' } : {}),
      ...(stage === 'helped' ? { helpSourceEventId: ctx.id, helpMethod: authored.helpMethod } : {}) });
    ctx.event.location = proof.location; ctx.event.area = proof.area; ctx.event.participants = [lead];
    ctx.event.payload.cast = [lead, guest];
    ctx.event.causedBy.push(proof.eventId, fact.sourceEventId, ...(memory ? [acquired] : []));
  }
  return true;
}

export function publicOffscreenSummaries(state, now) {
  return Object.values(of(state).projects).filter(row => row.openedAt <= now && row.attemptStartedAt <= now)
    .sort((a, b) => b.attemptStartedAt - a.attemptStartedAt || a.id.localeCompare(b.id)).slice(0, 3).map(row => {
      const result = row.result && row.result.completedAt <= now ? row.result : null;
      return {
      id: row.id, title: `${OFFSCREEN_CAST[row.guest].name} · ${OFFSCREEN_CAST[row.guest].subject}`,
      location: row.location, status: !result ? 'active' : result.outcome === 'settled' ? 'resolved' : 'unfinished',
      openedAt: row.openedAt, eventId: result?.sourceEventId ?? row.attemptStartEventId,
      description: result ? OFFSCREEN_CAST[row.guest][result.outcome] : row.attempt > 1
        ? `${OFFSCREEN_CAST[row.guest].name} returned to the part left unfinished.` : OFFSCREEN_CAST[row.guest].start,
      ...(result ? { outcome: result.outcome, completedAt: result.completedAt } : {}) }; });
}
export function assertOffscreenLives(state) {
  const current = state.offscreenLives;
  if (!current || current.version !== 1 || Object.keys(current.projects).length > OFFSCREEN_RULES.retainedProjects
    || Object.keys(current.issued).length > OFFSCREEN_RULES.retainedActions
    || Object.values(current.counts).some(n => !Number.isInteger(n) || n < 0 || n > 2)) throw new Error('Invalid offscreen life state');
  for (const [guest, row] of Object.entries(current.people)) {
    if (!IDS.includes(guest) || !Number.isSafeInteger(row.startedCount) || row.startedCount < 0 || row.knowledge.length > 12
      || row.currentProjectId && current.projects[row.currentProjectId]?.guest !== guest) throw new Error('Invalid offscreen person');
    if (row.commitment) {
      const project = current.projects[row.commitment.projectId];
      if (!project || project.status !== 'active' || project.guest !== guest || project.token !== row.commitment.token
        || row.commitment.startAt !== project.attemptStartedAt
        || row.commitment.until !== project.attemptStartedAt + OFFSCREEN_RULES.duration + 1) throw new Error('Unowned offscreen reservation');
    }
    if (row.lastSeen && (!Number.isSafeInteger(row.lastSeen.at) || !row.lastSeen.eventId
      || !areaOf(row.lastSeen.location, row.lastSeen.area))) throw new Error('Offscreen appearance lacks a real place and time');
    for (const memory of row.knowledge) {
      const fact = state.facts[memory.factKey];
      if (!fact || fact.sourceEventId !== memory.sourceEventId || memory.learnedAt < fact.createdAt || !memory.acquisitionEventId)
        throw new Error('Offscreen memory has no acquired source');
    }
    for (const [lead, memory] of Object.entries(row.encounters)) if (!['goaden', 'ashai'].includes(lead)
      || !memory.eventId || !memory.acquisitionEventId || !memory.sourceEventId
      || memory.familiarity < 0 || memory.familiarity > 8) throw new Error('Invalid remembered encounter');
  }
  for (const project of Object.values(current.projects)) {
    const cast = OFFSCREEN_CAST[project.guest];
    if (!cast || project.location !== cast.location || project.area !== cast.area || project.family !== cast.family
      || !['active', 'waiting', 'settled', 'deferred'].includes(project.status) || !project.originEventId || !project.token
      || !Number.isInteger(project.attempt) || project.attempt < 1 || project.attempt > OFFSCREEN_RULES.maxAttempts
      || !Number.isSafeInteger(project.projectNumber) || project.projectNumber < 1
      || project.causalEventIds.length > 18) throw new Error('Invalid offscreen project');
    if (project.status !== 'active') {
      const result = project.result, fact = result && state.facts[result.factKey];
      if (!fact || fact.sourceEventId !== result.sourceEventId || fact.value.storyId !== project.id
        || result.completedAt < project.attemptStartedAt || (project.status === 'settled') !== (result.outcome === 'settled'))
        throw new Error('Offscreen result has no actual attempt');
    }
    if (project.help) {
      const fact = state.facts[project.help.factKey], learned = state.characters[project.help.lead]?.knowledge.find(row =>
        row.sourceEventId === project.help.rememberedSourceEventId && row.acquisitionEventId === project.help.acquisitionEventId);
      if (!fact || fact.sourceEventId !== project.help.sourceEventId || !learned || learned.learnedAt >= fact.createdAt)
        throw new Error('Offscreen help used knowledge before it was learned');
    }
  }
}
