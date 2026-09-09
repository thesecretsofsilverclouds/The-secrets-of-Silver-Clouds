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

// World Voices respond to the published passage. They are not additional
// witnesses: their commentary may express a view, never create an incident,
// a private conversation, an exact reading or somebody else's knowledge.
export function watcherEventKind(event) {
  const type = event?.type ?? '';
  const description = `${event?.description ?? event?.publicDescription ?? ''}`.toLowerCase();
  if (type === 'MOMENT_NOTICED' || type === 'OFFSCREEN_WITNESS' || description.includes('chimes of renewal')) return 'moment';
  if (['ARCANE_SURGE', 'INCIDENT', 'UNEASE', 'AFTERMATH', 'ALERT'].includes(type)) return 'trouble';
  if (type === 'LEGION_VISIT') return 'legion';
  if (type === 'VENUE_SCENE' || type === 'CITY_ACTIVITY_BEGIN') return 'outing';
  if (type.startsWith('OFFSCREEN_') || type.startsWith('SUPPORTING_')) return 'elsewhere';
  if (type === 'CONVERSATION' || Array.isArray(event?.lines) && event.lines.length) return 'talk';
  if (type === 'TRAVEL_DEPART' || type === 'TRAVEL_ARRIVE') return 'transit';
  if (type === 'INSTITUTION_NOTICE' || type === 'FACTION_STATUS') return 'notice';
  return 'routine';
}

// Narrow subject eligibility first, seeded variety second. A familiar name or
// random jitter cannot make a hospital matron witness a private MI6 scene.
const SUBJECTS = Object.freeze({
  ember_vale: /\bashai\b|\bgoaden\b/,
  archivist_vane: /\bmi6\b|barracks|briefing|notice|report|record/,
  old_borough_dan: /\bcafe\b|silver spoon|plaza|street|borough/,
  reeves_apprentice: /streamliner|rail|carriage|scanner|arcane/,
  sanctuary_velvet: /sanctuary/,
  operative_echo: /\bmi6\b|barracks|order|perimeter|alert/,
  father_caelen: /church|veil|chimes of renewal/,
  pennyworth_pip: /\bcafe\b|silver spoon|\btea\b|breakfast|meal/,
  ragnor_skiff: /river|thames|water|embankment/,
  night_shift_nurse: /rest|sleep|tired|fatigue|hospital|healing/,
  belfry_tuner: /big.ben|chimes of renewal|belfry|\bbells?\b/,
  constable_holloway: /street|plaza|borough|patrol|watch|curfew/,
});
const BY_KIND = {
  ember_vale: {
    talk: ['I could listen to these two all day. They would probably object.',
      'I am trying very hard not to take sides. Not succeeding, obviously.'],
    elsewhere: ['A little time for somebody else. I am very much in favour of that.',
      'The small things deserve their space too.'],
    outing: ['I am in favour of getting out. Especially for these two.',
      'Whatever else London has planned, I hope they get to enjoy some of it.'],
    moment: ['This is the sort of thing I would want to remember.',
      'Let the small moments have a little room.'],
  },
  archivist_vane: {
    notice: ['An official notice. I recommend reading the words before supplying the rumours.',
      'For once, let us distinguish what it says from what we suspect it means.'],
    trouble: ['I would rather have an incomplete account than an invented explanation.',
      'Questions first. Conclusions can wait their turn.'],
    elsewhere: ['Small work is still work. No special stamp required.',
      'A useful reminder that importance and noise are different measurements.'],
    talk: ['I shall resist drafting minutes. It would spoil the conversation.',
      'Not every exchange requires a heading and three copies.'],
  },
  old_borough_dan: {
    outing: ['A bit of time in the borough does a person good. Usually.',
      'London is easier to like when you are allowed to stop in it.'],
    notice: ['They can post what they like. I still prefer to read it before worrying.',
      'A notice is a notice. The extra three stories people attach are their own business.'],
    trouble: ['I would give that a bit of room. Experience talking, for once.',
      'Not keen on that. No, I do not need a longer word for it.'],
    transit: ['A journey is a perfectly good excuse to sit down. Take it.',
      'Getting somewhere is useful. Remembering why you went is the clever part.'],
  },
  reeves_apprentice: {
    transit: ['I remain unreasonably fond of rail travel. Yes, even with the noise.',
      'Some of us enjoy the journey as much as the destination. I know. Terrible habit.'],
    trouble: ['I would like a closer look. From considerably further away.',
      'Interesting is not the same as harmless. I am working on remembering that.'],
    notice: ['A reading deserves a question before it gets an explanation.',
      'I would prefer a measurement to a rumour. Unfashionable of me.'],
  },
  sanctuary_velvet: {
    outing: ['An invitation is worth enjoying. Preferably without making a speech about it.',
      'I favour a little elegance. It need not be sensible to be worthwhile.'],
    transit: ['The anticipation is part of an evening out. Try not to spend all of it fretting.',
      'A good destination ought to make the journey feel worthwhile.'],
    talk: ['I reserve the right to enjoy a conversation without explaining it.',
      'Some company is worth making time for.'],
  },
  operative_echo: {
    trouble: ['I prefer caution to a very confident guess.',
      'Watch what actually happened. Leave the extra shadows to somebody else.'],
    notice: ['Read the advisory. Then resist improving it in the retelling.',
      'I will take a plain account over an exciting rumour.'],
    talk: ['Time to talk has its uses. Not everything improves with an order.',
      'I am willing to leave a conversation as a conversation.'],
  },
  father_caelen: {
    moment: ['There are worse things to pause for.',
      'A little wonder need not account for itself.'],
    notice: ['Reading before interpreting would spare us a great deal of noise.',
      'Certainty comes remarkably easily to people who have not finished the notice.'],
    trouble: ['Courage need not mean rushing closer.',
      'May good sense arrive before the explanations.'],
  },
  pennyworth_pip: {
    talk: ['Conversation is easier to enjoy when nobody expects you to settle it.',
      'I will take company over a grand occasion. Less washing up, in principle.'],
    outing: ['A little time at a table is a respectable use of a day.',
      'I approve of stopping. People forget they are allowed to.'],
    routine: ['A meal need not justify itself by fixing the rest of the day.',
      'You cannot run on determination alone. Annoying, but there it is.'],
  },
  ragnor_skiff: {
    moment: ['London does have a way of making you look twice.',
      'I have no objection to wonder. I prefer it at a sensible distance.'],
    trouble: ['I would keep a little distance from that.',
      'A thing can be impressive without needing me any nearer to it.'],
    transit: ['Time spent crossing is still part of the day.',
      'I prefer journeys that leave room to look about.'],
  },
  night_shift_nurse: {
    routine: ['Rest is not a reward for finishing. It is allowed before that.',
      'A quiet hour is not a wasted hour. Write that down.'],
    elsewhere: ['Small things matter. A person does not need to save the city to deserve some time.',
      'I am in favour of a little breathing room.'],
    trouble: ['I hope they get a chance to rest after this.',
      'There is no shame in needing a little time afterwards.'],
  },
  belfry_tuner: {
    moment: ['I would happily stop for that. People can hurry around me.',
      'One need not understand a thing completely to enjoy it. Fortunately for all of us.'],
    notice: ['I prefer a notice that tells me something to one that sounds important.',
      'Let us not add a new theory every time a bell gets mentioned.'],
    outing: ['Looking up is a perfectly reasonable use of an afternoon.',
      'There is a great deal to like about this city, if you give it a moment.'],
  },
  constable_holloway: {
    notice: ['Read it properly. Saves having to hear six versions later.',
      'A little less embroidery in the retelling would be welcome.'],
    trouble: ['I am quite comfortable with caution. It is less paperwork than bravado.',
      'Nobody needs to make this more exciting.'],
    outing: ['People enjoying a bit of London. I am strongly in favour.',
      'An ordinary outing has much to recommend it.'],
  },
};

export function watcherLineFor(watcherId, kind) {
  return BY_KIND[watcherId]?.[kind] ?? null;
}
export const ALL_WATCHER_KIND_LINES = Object.freeze(
  Object.values(BY_KIND).flatMap(byKind => Object.values(byKind).flat()));

export function selectWatchersForEvent(event, maxCount = 3) {
  if (!event || typeof event !== 'object' || !event.id || event.visibility === 'private') return [];
  const description = event.description ?? event.publicDescription ?? '';
  if (!description.trim()) return [];
  const subject = `${description} ${event.location ?? ''} ${event.room ?? ''}`.toLowerCase();
  const kind = watcherEventKind(event);
  const limit = Number.isFinite(maxCount) ? Math.max(0, Math.min(3, Math.trunc(maxCount))) : 3;
  if (!limit) return [];
  const eligible = WATCHERS.filter(watcher => SUBJECTS[watcher.id].test(subject)
    && watcherLineFor(watcher.id, kind));
  eligible.sort((a, b) => eventHash(event.id, WATCHERS.indexOf(a) + 10)
    - eventHash(event.id, WATCHERS.indexOf(b) + 10));
  const count = Math.min(eligible.length, 1 + eventHash(event.id, 99) % limit);
  return eligible.slice(0, count);
}

export function generateWatcherComments(event) {
  const baseTime = typeof event?.occurredAt === 'number' ? event.occurredAt : Date.parse(event?.occurredAt);
  if (!Number.isFinite(baseTime)) return [];
  return selectWatchersForEvent(event).map((watcher, idx) => {
    const patterns = watcherLineFor(watcher.id, watcherEventKind(event));
    const text = patterns[eventHash(event.id, idx + 50) % patterns.length];
    const delayMs = (idx + 1) * (30_000 + eventHash(event.id, idx + 70) % 60_000);
    return {
      id: `comment-w-${createHash('sha256').update(`${event.id}:${watcher.id}`).digest('hex').slice(0, 16)}`,
      eventId: event.id,
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
