import { createHash } from 'node:crypto';

/**
 * 12 authored fictional World Voices commenting on the living chronicle.
 * These are presentation characters, never readers or measured activity.
 * Each possesses a distinct voice, lore alignment, Holy Item, and Guardian.
 */
export const WATCHERS = Object.freeze([
  {
    id: 'ember_vale',
    name: 'EmberVale',
    title: 'Sanctuary Regular • Romantic',
    avatar: '🌙',
    holyItem: 'The Hearth Censer',
    guardian: 'The Small Summoning',
    bio: 'Looking for the tender truth between the lines.',
    focus: ['romance', 'conversation', 'sanctuary', 'ashai', 'goaden'],
  },
  {
    id: 'archivist_vane',
    name: 'Archivist_Vane',
    title: 'MI6 Senior Scribe',
    avatar: '📜',
    holyItem: 'The Entropy Codex',
    guardian: 'The Unread',
    bio: 'Cross-referencing historical archives and London treaty dates.',
    focus: ['mi6', 'archive', 'protocol', 'briefing', 'records'],
  },
  {
    id: 'old_borough_dan',
    name: 'OldBoroughDan',
    title: 'Borough Hawker • Street Veteran',
    avatar: '☕',
    holyItem: 'Blackened Iron Token',
    guardian: 'Sproat, the Root Mind',
    bio: 'Fifty years walking London cobbles. Nothing stays hidden in the fog.',
    focus: ['cafe', 'street', 'rumor', 'fog', 'silver_spoon'],
  },
  {
    id: 'reeves_apprentice',
    name: 'ReevesApprentice',
    title: 'Alchemical Guild Neophyte',
    avatar: '⚡',
    holyItem: "The Conductor's Key",
    guardian: 'The Petal Between',
    bio: 'Tracking harmonic resonance in rail steel and clock alloy.',
    focus: ['streamliner', 'rail', 'alloy', 'big_ben_plaza', 'technomagic'],
  },
  {
    id: 'sanctuary_velvet',
    name: 'SanctuaryVelvet',
    title: 'Sky Lounge Hostess',
    avatar: '🍸',
    holyItem: 'The Attendant',
    guardian: 'Nixie, the Mirror Kitsune',
    bio: 'Pouring soul sips while high-society secrets drift past.',
    focus: ['sanctuary', 'nightclub', 'portal', 'music', 'velvet'],
  },
  {
    id: 'operative_echo',
    name: 'OperativeEcho',
    title: 'MEU Perimeter Scout',
    avatar: '🗡️',
    holyItem: 'Atraxis, the Rift-Born',
    guardian: 'Morvan, the Pale Hunter',
    bio: 'Watching the blind spots where the Holy Order treads.',
    focus: ['alert', 'scout', 'order', 'thames', 'perimeter'],
  },
  {
    id: 'father_caelen',
    name: 'FatherCaelen',
    title: 'Church Curfew Acolyte',
    avatar: '✦',
    holyItem: 'Aurelius',
    guardian: 'The Sovereign Seal',
    bio: 'Listening for the midnight chimes and the whisper of the Veil.',
    focus: ['church', 'veil', 'chime', 'prayer', 'curfew'],
  },
  {
    id: 'pennyworth_pip',
    name: 'Pennyworth_Pip',
    title: 'Silver Spoon Scullery Hand',
    avatar: '🥣',
    holyItem: 'Tea-Stained Ladle',
    guardian: 'Mochi, the Ancient',
    bio: 'Hearing every quiet confession over morning toast.',
    focus: ['cafe', 'tea', 'goaden', 'breakfast', 'quiet_break'],
  },
  {
    id: 'ragnor_skiff',
    name: 'Ragnor_Skiff',
    title: 'East Docks Waterman',
    avatar: '🌊',
    holyItem: "Maelstrom's Fang",
    guardian: 'Malveth, the Gatekeeper',
    bio: 'Rowing the dark reaches where the Thames glows violet.',
    focus: ['river', 'thames', 'anomaly', 'water', 'wapping'],
  },
  {
    id: 'night_shift_nurse',
    name: 'NightShiftNurse',
    title: "St. Jude's Ward Matron",
    avatar: '🌿',
    holyItem: 'The Verdant Witness',
    guardian: 'The Silver Born',
    bio: 'Keeping the bedside hearth lit through the damp hours.',
    focus: ['hospital', 'tait', 'resting', 'healing', 'vigil'],
  },
  {
    id: 'belfry_tuner',
    name: 'BelfryTuner',
    title: 'New Big Ben Clocksmith',
    avatar: '🔔',
    holyItem: 'Chimes of Renewal Sheet',
    guardian: 'Lumis, the Hollow Foal',
    bio: 'Tuning the belfry harmonics that soothe London wielders.',
    focus: ['big_ben_plaza', 'chime', 'tuning', 'clock', 'bells'],
  },
  {
    id: 'constable_holloway',
    name: 'ConstableHolloway',
    title: 'Southwark Watch Sergeant',
    avatar: '🛡️',
    holyItem: "The Warden's Verdict",
    guardian: 'Thornwrath, the Blighted',
    bio: 'Checking the lantern gates along the embankment wall.',
    focus: ['patrol', 'watch', 'curfew', 'borough', 'dusk'],
  },
]);

/**
 * Deterministic integer hash for repeatable distribution.
 */
function eventHash(eventId, salt = 0) {
  const hash = createHash('sha256').update(`${eventId}:${salt}`).digest('hex');
  return parseInt(hash.slice(0, 8), 16);
}

/**
 * Categorize event intensity without implying any audience activity.
 */
export function classifyEventTier(event) {
  if (!event) return 'quiet';
  if (Array.isArray(event.lines) && event.lines.length > 0) {
    return 'banter';
  }
  const text = `${event.type || ''} ${event.description || ''} ${event.location || ''}`.toLowerCase();
  if (
    event.type === 'ALERT'
    || /anomaly|threat|order\s+scout|breach|standby|covert|viaduct\s+standoff|spike|curfew/i.test(text)
  ) {
    return 'alert';
  }
  return 'quiet';
}

/**
 * Deterministically select 1 to 3 watchers whose themes align with the event.
 */
export function selectWatchersForEvent(event, maxCount = 3) {
  const eventId = typeof event === 'string' ? event : event?.id || 'evt:default';
  const desc = `${event?.description || ''} ${event?.location || ''} ${event?.room || ''}`.toLowerCase();
  const hasLines = Array.isArray(event?.lines) && event.lines.length > 0;

  // Score watchers by relevance
  const scored = WATCHERS.map((watcher, index) => {
    let score = 0;
    for (const tag of watcher.focus) {
      if (desc.includes(tag)) score += 3;
    }
    if (hasLines && (watcher.id === 'ember_vale' || watcher.id === 'pennyworth_pip')) {
      score += 4;
    }
    if (desc.includes('ashai') && watcher.focus.includes('ashai')) score += 2;
    if (desc.includes('goaden') && watcher.focus.includes('goaden')) score += 2;
    // Add deterministic pseudo-random jitter so different events pick varied watchers
    const jitter = (eventHash(eventId, index + 10) % 10) / 10;
    return { watcher, score: score + jitter };
  });

  scored.sort((a, b) => b.score - a.score);

  // Number of comments: 1 to 3
  const count = 1 + (eventHash(eventId, 99) % maxCount);
  return scored.slice(0, Math.min(count, maxCount)).map((s) => s.watcher);
}

/**
 * Watcher in-character commentary corpus tailored to live novel scenes.
 */
const WATCHER_DIALOGUE_PATTERNS = {
  ember_vale: [
    'The way Ashai glanced back before stepping onto the platform... Goaden definitely noticed.',
    'I swear these two communicate more through silence than half the borough does with words.',
    'That tone in the parlour wasn’t protocol. Not even close.',
    'Keeping track of every glance. The living novel is peaking tonight.',
  ],
  archivist_vane: [
    'Section 4B of the Embankment Accords explicitly restricts passage after the fourth chime. Bold move.',
    'Check the dates on that registry docket. That seal hasn’t been valid since the late ceasefire.',
    'Filing this into the classified stacks under London anomaly logs.',
    'Notice the shift in cadence. An official inquiry is brewing.',
  ],
  old_borough_dan: [
    'Thames mist is thick as mutton broth tonight. You couldn’t spot an Order scout ten yards out on the cobbles.',
    'Silver Spoon kettle’s been whistling since dawn. When the borough gets restless, the tea gets stronger.',
    'I’ve seen thirty winters in Southwark, and that sound off the viaduct wasn’t the wind.',
    'Mind your boots on the wet flagstones. Something stirred beneath the grates.',
  ],
  reeves_apprentice: [
    'That frequency hum off the third carriage rail isn’t standard alchemical alloy. Someone re-tuned the copper.',
    'The Lintels are flocking low toward the belfry again. Always happens right before an aether drop.',
    'The harmonic waveform on the MEU scanner peaked right at 22:15. Pure celestial resonance.',
    'If the steam pressure holds, the transit from Sanctuary will arrive right on the hour.',
  ],
  sanctuary_velvet: [
    'The velvet lounge is packed to the arches tonight. If Ashai comes through the portal, good luck keeping it quiet.',
    'Soul sips taste sharper when the river mist rises like this.',
    'High altitude, low gossip, and someone just ordered the midnight vintage.',
    'The chimes sound different from up here. Much clearer, much more dangerous.',
  ],
  operative_echo: [
    'Perimeter sweep clear on Sector 2, but the shadows along the south viaduct are deeper than usual.',
    'Goaden’s posture is guarded. He’s listening for footfalls, not just watching the street.',
    'Order scout sightings confirmed near the outer slipway. Stay sharp.',
    'Movement in the fog near the embankment stairs. Logging coordinates.',
  ],
  father_caelen: [
    'The chimes ring for renewal, yet unrest lingers in the alleys. Let the faithful remain vigilant.',
    'The Veil draws nearer with each setting sun. Are our spirits attuned?',
    'A solemn hour. The sanctuary lanterns flicker with purpose.',
    'May the Holy Items hold fast against whatever stirs in the dark.',
  ],
  pennyworth_pip: [
    'He took two cups of black tea to the back corner again. Didn’t even touch the sugar biscuits.',
    'Goaden dropped his brass counter on the saucer. Hand was cold from the rain, or something else on his mind.',
    'Cook says anyone ordering hot cinnamon at midnight is either tracking someone or being followed.',
    'Wiped down the corner table three times. That napkin had writing on it before he folded it away.',
  ],
  ragnor_skiff: [
    'Tide’s running strange near Wapping. Something’s disturbing the underwater aether channels.',
    'No boatman in his right mind rows the reach when the water glows violet like that.',
    'The current picked up after the second bell. River spirits don’t lie.',
    'Keep your lantern low along the pier. We aren’t the only ones watching the water.',
  ],
  night_shift_nurse: [
    'The draughts from the hospital courtyard are cold tonight. I hope Tait’s hearth is kept stoked.',
    'Rest is what heals a weary spirit, not wandering the damp embankment.',
    'Amy was reading by the bedside until the third bell. Quiet devotion runs deep.',
    'A peaceful breath between hospital shifts. Praying for gentle hours.',
  ],
  belfry_tuner: [
    'Tuning the copper alloy before midnight. You can feel the vibration in your teeth.',
    'The harmonic chimes soothe every wielder within three miles of the river.',
    'Scaffolding held through the squall. New Big Ben stands firm.',
    'Fourth bell struck a fraction flat. I’ll need the heavy brass wrench before dawn.',
  ],
  constable_holloway: [
    'Lantern check complete on Southwark gate. Curfew is holding, but barely.',
    'Keep moving on the bridge. No loitering while the mist rolls in.',
    'Watch patrols are doubled along the rail viaduct tonight.',
    'Orderly streets make for a quiet city. Let’s keep it that way.',
  ],
};

/**
 * Generate in-character comments for an event from World Voices.
 */
// What kind of moment a watcher is looking at.
//
// The fault this fixes: a watcher's lines were picked by hash from a fixed bank
// of four, with no reference to the event they were attached to. EmberVale would
// say "the way Ashai glanced back before stepping onto the platform" underneath
// a passage about Rose cutting a verse in the Legion warehouse. The voices were
// good and they were answering a different page.
//
// They are people who live here, so they get to react to the thing in front of
// them. An unwritten combination falls back to the watcher's general bank rather
// than inventing, so a new event type is never a blank comment.
export function watcherEventKind(event) {
  const type = event?.type ?? '';
  const description = `${event?.description ?? event?.publicDescription ?? ''}`.toLowerCase();
  if (type === 'MOMENT_NOTICED' || type === 'OFFSCREEN_WITNESS' || description.includes('chimes of renewal')) return 'moment';
  if (type === 'ARCANE_SURGE' || type === 'INCIDENT' || type === 'UNEASE' || type === 'AFTERMATH') return 'trouble';
  // Type before text, always. Reading "legion" out of the description first
  // classified Rose working alone in the Legion warehouse as a Legion visit,
  // and the Sky Lounge hostess commented on a crowd that was not there.
  if (type === 'LEGION_VISIT') return 'legion';
  if (type === 'VENUE_SCENE' || type === 'CITY_ACTIVITY_BEGIN') return 'outing';
  if (type.startsWith('OFFSCREEN_') || type.startsWith('SUPPORTING_')) return 'elsewhere';
  if (!type && description.includes('legion')) return 'legion';
  if (type === 'CONVERSATION' || Array.isArray(event?.lines) && event.lines.length) return 'talk';
  if (type === 'TRAVEL_DEPART' || type === 'TRAVEL_ARRIVE') return 'transit';
  if (type === 'INSTITUTION_NOTICE' || type === 'FACTION_STATUS') return 'notice';
  return 'routine';
}

// Written per voice, per kind. Two apiece: enough that the same watcher on the
// same kind of day does not repeat within a session, few enough that every one
// can be worth reading.
const BY_KIND = {
  ember_vale: {
    moment: ['Everyone stopped at once. Half of London looked up and none of them said anything. I love this city.',
      'The Chimes go and the whole borough holds still for eleven seconds. Nobody has ever explained why eleven.'],
    talk: ['They said about four things and meant eleven. I have read whole novels with less in them.',
      'Nobody raised their voice and something still shifted. That is the good stuff.'],
    trouble: ['He went first. He always goes first. One of these days she is going to say something about it.',
      'The scanners go and you can see exactly who in this city has somewhere to run to.'],
    elsewhere: ['I like that the world keeps going when they are not in the room. Somebody is always working on something.',
      'A whole little life happening two miles away that neither of them will ever hear about.'],
    outing: ['An afternoon off, and they spent it near each other on purpose. Note it down.',
      'The pair of them out in daylight like ordinary people. It never lasts and I take what I get.'],
  },
  archivist_vane: {
    notice: ['Filed. The wording is identical to the notice of the ninth, which tells you who wrote it.',
      'Cross-referenced against the standing register. The date is the only new part.'],
    moment: ['The Renewal peal is logged as a fixed interval. It has now run long four times this quarter.',
      'Recording the hour. The Chimes are supposed to be regular; the record says otherwise.'],
    trouble: ['Corridor readings of that order require a written report within the day. Somebody is up late.',
      'This will appear in next week\'s summary as "a minor fluctuation". It was not.'],
    elsewhere: ['Noted for completeness. The archive does not distinguish between important and small.',
      'Everything gets a line eventually, including this.'],
  },
  old_borough_dan: {
    outing: ['Silver Spoon was heaving by two. Always is when the weather turns civil.',
      'Saw them go past the arches. Neither of them was in a hurry, which round here is worth a mention.'],
    moment: ['Felt it in the flagstones before I heard it. That is how you know it is a big one.',
      'Whole market stopped. Pigeons went up off the roofs in one lot. Grand, that.'],
    notice: ['They can post what they like. Borough will do what the borough does.',
      'Third notice this fortnight. Somebody in an office is very busy indeed.'],
    trouble: ['Cleared the street in under a minute. Fifty years and I still cannot tell you how word travels that fast.',
      'Shutters came down along the row. Nobody said anything. Nobody had to.'],
  },
  reeves_apprentice: {
    moment: ['The motes come off the peal at a fixed interval and nobody in the Guild can tell me why they are note-shaped.',
      'Counted them going up. Same number as last time, which cannot be a coincidence and is.'],
    transit: ['Third carriage was running warm again. I have written in about it twice.',
      'Rail hum was half a tone flat the whole way across. Somebody has been at the copper.'],
    trouble: ['Corridor readings like that put the Lintels on the roofs for a day afterwards. Watch for it.',
      'That is not a spike, that is a standing wave. Different thing entirely and much more interesting.'],
  },
  sanctuary_velvet: {
    legion: ['They were in earlier. Nothing broken this time, which I am choosing to call progress.',
      'You always know the Legion have arrived before you see them. It comes up through the floor.'],
    outing: ['If they had come up here instead I would have given them the good table. Their loss.',
      'Half the room asked me who they were. I said nobody, which is what I always say.'],
    moment: ['You get the Chimes up here about a second late. Best view of them in London and nobody looks.',
      'Whole lounge went to the glass. First time all week the music was the second loudest thing.'],
  },
  operative_echo: {
    moment: ['Peal ran long. Everything on the perimeter board went amber for the duration and came back clean. Noted.',
      'Chimes like that are useful cover, and everyone who works a perimeter knows it. Eyes up during, not after.'],
    trouble: ['Corridor lit up and the blind spots along the Thames went dark for ninety seconds. That is the bit nobody reports.',
      'A surge is the only time you can walk the perimeter unobserved. Somebody always does.'],
    notice: ['If they are posting the advisory, the sighting is at least two days old. That is how advisories work.',
      'Read the advisory. Then read where it does not mention.'],
    outing: ['Two of ours out in the open in daylight. No cover, no comms, no complaints from me — that is a day off and they have earned it.',
      'Watched them cross the plaza and nobody was watching them but me. Good.'],
  },
  father_caelen: {
    moment: ['The Renewal peal ran beyond its measure. The bells know things before the calendar does.',
      'The motes rose and the faithful stopped where they stood, and so did everyone else, which is the point of a bell.'],
    notice: ['The dates are set. Begin the fast when the lanterns go up, not when the notice says.',
      'The Church has spoken and the boroughs will now spend a fortnight pretending to have listened.'],
    trouble: ['The river was loud tonight in a way the river should not be. Light a candle and do not go down to look.',
      'Something crossed the corridor and the chapel candles all leaned east. I have written it in the book.'],
    elsewhere: ['Everyone is somewhere, and the Veil counts them all the same. A small evening is still an evening spent.',
      'There is grace in an unremarkable hour. Most of them are.'],
  },
  pennyworth_pip: {
    outing: ['They had the window table for an hour and left the second pot untouched. That never happens.',
      'Cook clocked them coming in and had the good cups out before they sat down. She would deny it.'],
    talk: ['You hear everything over the toast rack and understand about a third of it. This was one of the good thirds.',
      'They were talking quietly, which in here means they were talking about something.'],
    moment: ['The cups went in the saucers all at once when the Chimes came. Same every time. Cook says it is the floor.',
      'Whole café stopped mid-sentence. Then everyone said something about it, and then everyone carried on.'],
    routine: ['Same order, same table, same hour. I could set the urn by them.',
      'He came in early and sat with it going cold, which he only does when he is thinking.'],
  },
  ragnor_skiff: {
    trouble: ['Water went wrong under the boat for about a minute. Not waves. Wrong.',
      'The reach off Wapping glowed violet to the bottom and every fish in it left at once. I went home.'],
    moment: ['Heard the peal off the water, which is the best place to hear it. The motes come down the river as well as up.',
      'Chimes carry three miles downstream on a still night. Half the watermen stop rowing for it and none of them admit it.'],
    notice: ['They can post what they like upstream. The river has its own arrangements.',
      'Advisory says the boroughs. Nothing about the water, as usual.'],
    transit: ['The rail bridge hums when the Streamliner crosses and the hum goes into the hull. You get used to it.',
      'Saw the carriage go over about four. Half empty, going east.'],
  },
  night_shift_nurse: {
    moment: ['The peal came through the ward and three of mine woke and one of them smiled. I will take that.',
      'They can hear it in here, faintly. On the bad nights I open a window for it.'],
    trouble: ['We felt it on the ward before the alarms went. Two beds started shaking and I have no explanation to offer anybody.',
      'Every wielder in St Jude\'s sat up at once. That is how you know it was a real one.'],
    routine: ['Somebody in that building is not sleeping enough. I can tell from here.',
      'Rest is not a reward for finishing. I say this every week and nobody listens.'],
    elsewhere: ['People keep going with small things while the city does big ones. That is most of nursing.',
      'A quiet hour spent on something small is not a wasted hour. Write that down.'],
  },
  belfry_tuner: {
    moment: ['She ran nine seconds long. That is the third time this quarter and I have adjusted nothing.',
      'The harmonic came off the second bell clean and the motes formed on the overtone, exactly as they should, which after last month is a relief.'],
    notice: ['We tune to the Veil dates, so when the Church moves them, I move. Somebody might tell me first one day.',
      'The notice affects the belfry more than it affects anybody reading it.'],
    trouble: ['A corridor event puts the bells out by a fraction and nobody hears it but me. I hear it.',
      'The whole frame rang sympathetically with something that was not me. I did not enjoy that.'],
    outing: ['Somebody stood under her for a full hour today. Good. She is worth an hour.',
      'People walk past a thousand-tonne instrument and never look up. Two of them looked up.'],
  },
  constable_holloway: {
    notice: ['Advisory received, lantern gates checked, nothing to report on my stretch of the wall.',
      'Third notice this month. I have stopped forwarding them and started just walking the wall.'],
    trouble: ['Cleared the embankment inside two minutes. Nobody argued, which tells you they had felt it too.',
      'Called it in, walked the stretch, found nothing. Found nothing rather loudly, if I am honest.'],
    moment: ['Peal ran long and the whole borough stopped where it stood. Easiest two minutes of policing all week.',
      'You can see the motes from the wall better than anywhere. Not that I am paid to look at them.'],
    outing: ['Two out-of-borough faces on my stretch this afternoon, both known, both behaving. Logged and left alone.',
      'Saw them by the arches. Nodded. Got a nod. That is the whole incident report.'],
  },
};
export function watcherLineFor(watcherId, kind) {
  return BY_KIND[watcherId]?.[kind] ?? null;
}
export const ALL_WATCHER_KIND_LINES = Object.freeze(
  Object.values(BY_KIND).flatMap(byKind => Object.values(byKind).flat()));

export function generateWatcherComments(event) {
  const eventId = typeof event === 'string' ? event : event?.id || 'evt:default';
  const rawOccurred = event?.occurredAt;
  const baseTime = typeof rawOccurred === 'number' && Number.isFinite(rawOccurred)
    ? rawOccurred
    : (typeof rawOccurred === 'string' && !Number.isNaN(Date.parse(rawOccurred)) ? Date.parse(rawOccurred) : Date.now());
  const watchers = selectWatchersForEvent(event, 3);

  return watchers.map((watcher, idx) => {
    const kind = watcherEventKind(event);
    const patterns = watcherLineFor(watcher.id, kind)
      ?? WATCHER_DIALOGUE_PATTERNS[watcher.id]
      ?? ['Observing London from the shadows.'];
    const textIndex = eventHash(eventId, idx + 50) % patterns.length;
    const text = patterns[textIndex];
    // Stagger comment timestamps slightly after the event
    const delayMs = (idx + 1) * (30_000 + (eventHash(eventId, idx + 70) % 60_000));

    return {
      id: `comment-w-${createHash('sha256').update(`${eventId}:${watcher.id}`).digest('hex').slice(0, 16)}`,
      eventId,
      authorName: watcher.name,
      authorHolyItem: watcher.holyItem,
      authorGuardian: watcher.guardian,
      authorTitle: watcher.title,
      authorAvatar: watcher.avatar,
      authorBio: watcher.bio,
      text,
      createdAt: baseTime + delayMs,
      isWatcher: 1,
    };
  });
}
