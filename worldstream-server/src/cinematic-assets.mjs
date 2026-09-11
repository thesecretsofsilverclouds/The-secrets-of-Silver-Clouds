// The asset director is metadata, not filename inference.  A generated scene
// receives only the small vocabulary selected here and cannot ask the browser
// for an arbitrary file.

const EMOTION_TAGS = Object.freeze({
  idle: ['conversation', 'social', 'mystery'], neutral: ['conversation', 'social', 'mystery'],
  annoyed: ['friction', 'banter'], cheeky: ['banter', 'social'], happy: ['social', 'repair'],
  intense: ['danger', 'anomaly'], observation: ['mystery', 'conversation'], sad: ['emotion', 'aftermath'],
  curious: ['mystery', 'anomaly'], grin: ['banter', 'social'], smirk: ['banter', 'deflection'],
  surprised: ['anomaly', 'danger'], smolder: ['social'], smolder2: ['social'],
  frown: ['friction'], humble: ['conversation', 'repair'], impressed: ['social', 'anomaly'],
  laughing: ['banter', 'social'], 'showing-off': ['banter'], thinking: ['mystery', 'conversation'],
  disgust: ['friction', 'anomaly'], shock: ['anomaly', 'danger'], stern: ['danger', 'conversation'],
});
const plate = (id, character, emotion, file, {
  intensity = 2, energy = 'steady', suitableFor = null, facing = 'centre',
} = {}) => Object.freeze({
  id, character, emotion, intensity, energy,
  suitableFor: Object.freeze([...(suitableFor ?? EMOTION_TAGS[emotion] ?? ['conversation'])]),
  pose: 'standing', facing, file,
});

export const CHARACTER_PLATES = Object.freeze({
  nimbus: Object.freeze(['angry','happy','showoff','smile','surprised','wink']
    .map(emotion => plate(`nimbus_${emotion}`, 'nimbus', emotion, `/scene/nimbus-${emotion}.png`,
      {suitableFor:['conversation','social','banter','anomaly','danger','wonder']}))),
  goaden: Object.freeze([
    plate('goaden_idle', 'goaden', 'guarded', '/scene/goaden-idle.png', { intensity: 1, energy: 'contained', facing: 'right' }),
    plate('goaden_smirk', 'goaden', 'amused', '/scene/goaden-smirk.png', { intensity: 2, energy: 'dry', suitableFor: ['banter', 'social', 'deflection'], facing: 'right' }),
    plate('goaden_surprised', 'goaden', 'surprised', '/scene/goaden-surprised.png', { intensity: 3, energy: 'alert', suitableFor: ['anomaly', 'danger', 'reveal'], facing: 'right' }),
  ]),
  ashai: Object.freeze([
    plate('ashai_neutral', 'ashai', 'neutral', '/scene/ashai-neutral.png', { intensity: 1, energy: 'observant', facing: 'left' }),
    plate('ashai_soft_smile', 'ashai', 'warm', '/scene/ashai-soft_smile.png', { intensity: 2, energy: 'open', suitableFor: ['social', 'repair', 'banter'], facing: 'left' }),
    plate('ashai_amused', 'ashai', 'amused', '/scene/ashai-amused.png', { intensity: 2, energy: 'wry', suitableFor: ['banter', 'social'], facing: 'left' }),
    plate('ashai_thoughtful', 'ashai', 'thoughtful', '/scene/ashai-thoughtful.png', { intensity: 2, energy: 'observant', suitableFor: ['mystery', 'conversation'], facing: 'left' }),
    plate('ashai_vulnerable', 'ashai', 'vulnerable', '/scene/ashai-vulnerable.png', { intensity: 3, energy: 'open', suitableFor: ['emotion', 'aftermath'], facing: 'left' }),
    plate('ashai_tired', 'ashai', 'tired', '/scene/ashai-tired.png', { intensity: 2, energy: 'low', suitableFor: ['aftermath', 'night'], facing: 'left' }),
    plate('ashai_surprised', 'ashai', 'surprised', '/scene/ashai-surprised.png', { intensity: 3, energy: 'alert', suitableFor: ['anomaly', 'danger', 'reveal'], facing: 'left' }),
    plate('ashai_guarded', 'ashai', 'guarded', '/scene/ashai-guarded.png', { intensity: 3, energy: 'contained', suitableFor: ['danger', 'friction', 'mystery'], facing: 'left' }),
  ]),
  rose: Object.freeze(['idle', 'annoyed', 'cheeky', 'happy', 'intense', 'observation', 'sad']
    .map((emotion) => plate(`rose_${emotion}`, 'rose', emotion, `/scene/rose-${emotion}.png`))),
  anarchy: Object.freeze(['idle', 'curious', 'grin', 'intense', 'smirk', 'surprised']
    .map((emotion) => plate(`anarchy_${emotion}`, 'anarchy', emotion, `/scene/anarchy-${emotion}.png`))),
  balthazar: Object.freeze(['idle', 'smirk', 'smolder', 'smolder2']
    .map((emotion) => plate(`balthazar_${emotion}`, 'balthazar', emotion, `/scene/balthazar-${emotion}.png`))),
  gabriel: Object.freeze(['annoyed', 'frown', 'humble', 'impressed', 'laughing', 'showing-off', 'surprised', 'thinking']
    .map((emotion) => plate(`gabriel_${emotion.replaceAll('-', '_')}`, 'gabriel', emotion, `/scene/gabriel-${emotion}.png`))),
  truth: Object.freeze(['annoyed', 'disgust', 'laughing', 'shock', 'stern', 'idle']
    .map((emotion) => plate(`truth_${emotion}`, 'truth', emotion, `/scene/truth-${emotion}.png`))),
  damien: Object.freeze([
    plate('damien_idle', 'damien', 'idle', '/scene/damien-idle.png'),
  ]),
  emily: Object.freeze(['annoyed', 'curious', 'laughing', 'leans-in-sad', 'mocking', 'sad', 'thinking']
    .map((emotion) => plate(`emily_${emotion.replaceAll('-', '_')}`, 'emily', emotion, `/scene/emily-${emotion}.png`))),
  zara: Object.freeze(['angry', 'happy', 'idle', 'sad', 'shocked', 'smile', 'smiling']
    .map((emotion) => plate(`zara_${emotion}`, 'zara', emotion, `/scene/zara-${emotion}.png`))),

  // Three characters whose artwork has been sitting in /scene unregistered.
  // Found while wiring the mimic, which needs a plate of Yukon to return to
  // and a plate of whoever he is impersonating.
  //
  // Davis carries the rivalry with Ashai (manuscript [P00667]-[P00713]); the
  // close-up is registered at higher intensity because that is what a close-up
  // is for, not because she has a second mood.
  davis: Object.freeze([
    plate('davis_idle', 'davis', 'idle', '/scene/davis-idle.png'),
    plate('davis_closeup', 'davis', 'intense', '/scene/davis-closeup.png',
      { intensity: 3, suitableFor: ['reveal', 'conversation', 'deflection'] }),
  ]),
  // **One plate only**, and he now has six practices. Flagged rather than
  // worked around: `yukon-irritated` will be doing every register he has,
  // including the ones canon describes as bubbly.
  yukon: Object.freeze([
    plate('yukon_irritated', 'yukon', 'annoyed', '/scene/yukon-irritated.png'),
  ]),
  // Cliff Henderson. Canon has him as Ashai's mentor and the reason Goaden
  // joined MI6 at all; the world already walks him through as a SIDE_PRESENCE.
  henderson: Object.freeze([
    plate('henderson_idle', 'henderson', 'idle', '/scene/henderson-idle.png'),
    plate('henderson_waiting', 'henderson', 'thoughtful', '/scene/henderson-waiting.png'),
  ]),
  // Greah and Kai already speak in authored scenes and ride with the pair.
  // The plates were sitting in /scene; they were never generated for this pass.
  greah: Object.freeze(['annoyed', 'cheeky', 'happy', 'sad', 'surprised', 'warm-greeting']
    .map((emotion) => plate(`greah_${emotion.replaceAll('-', '_')}`, 'greah', emotion, `/scene/greah-${emotion}.png`,
      { suitableFor: ['conversation', 'social', 'banter', 'emotion'] }))),
  kai: Object.freeze(['annoyed', 'greeting', 'happy', 'sad', 'surprised']
    .map((emotion) => plate(`kai_${emotion}`, 'kai', emotion, `/scene/kai-${emotion}.png`,
      { suitableFor: ['conversation', 'social', 'banter', 'emotion'] }))),
});

const background = (id, location, file, {
  area = null, dayparts = ['morning', 'midday', 'evening', 'night', 'small_hours'],
  suitableFor = ['conversation'],
} = {}) => Object.freeze({
  id, location, area, file, dayparts: Object.freeze([...dayparts]),
  suitableFor: Object.freeze([...suitableFor]),
});

export const CINEMATIC_BACKGROUNDS = Object.freeze([
  background('mi6_day', 'mi6', '/scene/world-mi6-day.jpg', { dayparts: ['morning', 'midday'], suitableFor: ['work', 'social', 'anomaly'] }),
  background('mi6_night', 'mi6', '/scene/world-mi6-night.jpg', { dayparts: ['evening', 'night', 'small_hours'], suitableFor: ['night', 'danger', 'aftermath', 'anomaly'] }),
  background('mi6_corridor', 'mi6', '/scene/mi6corridor.jpg', { area: 'corridors', suitableFor: ['encounter', 'anomaly', 'danger'] }),
  background('mi6_rooftop', 'mi6', '/scene/mi6rooftop.jpg', { area: 'rooftop', suitableFor: ['conversation', 'mystery', 'aftermath'] }),
  background('mi6_quarters', 'mi6', '/scene/mi6bedroom.jpg', { area: 'quarters', suitableFor: ['night', 'aftermath', 'quiet'] }),
  background('sanctuary_day', 'sanctuary', '/scene/world-sanctuary-day.jpg', { dayparts: ['morning', 'midday'], suitableFor: ['social', 'invitation', 'wonder'] }),
  background('sanctuary_evening', 'sanctuary', '/scene/world-sanctuary-evening.jpg', { dayparts: ['evening'], suitableFor: ['social', 'transition', 'wonder'] }),
  background('sanctuary_night', 'sanctuary', '/scene/world-sanctuary-night.jpg', { dayparts: ['night'], suitableFor: ['social', 'music', 'banter', 'wonder'] }),
  background('sanctuary_closed', 'sanctuary', '/scene/world-sanctuary-closed.jpg', { dayparts: ['small_hours'], suitableFor: ['quiet', 'mystery'] }),
  background('streamliner_day', 'streamliner', '/scene/world-streamliner-day.jpg', { dayparts: ['morning', 'midday', 'evening'], suitableFor: ['travel', 'anomaly'] }),
  background('streamliner_night', 'streamliner', '/scene/world-streamliner-night.jpg', { dayparts: ['night', 'small_hours'], suitableFor: ['travel', 'mystery', 'danger'] }),
  background('enchanted_ink', 'enchanted_ink', '/scene/world-enchanted-ink.jpg', { suitableFor: ['social', 'banter', 'wonder', 'anomaly'] }),
  background('silver_spoon', 'cafe', '/scene/world-cafe-day.jpg', { dayparts: ['morning', 'midday', 'evening'], suitableFor: ['social', 'banter', 'quiet'] }),
  background('london_day', 'big_ben_plaza', '/scene/world-london-day.jpg', { dayparts: ['morning', 'midday', 'evening'], suitableFor: ['city', 'travel', 'anomaly'] }),
  background('london_night', 'big_ben_plaza', '/scene/world-london-night.jpg', { dayparts: ['night', 'small_hours'], suitableFor: ['city', 'danger', 'mystery'] }),
  background('legion_hideout_day', 'legion_hideout', '/scene/world-legion-hideout-day.jpg', { dayparts: ['morning', 'midday', 'evening'], suitableFor: ['social', 'banter', 'conversation'] }),
  background('legion_hideout_night', 'legion_hideout', '/scene/world-legion-hideout-night.jpg', { dayparts: ['night', 'small_hours'], suitableFor: ['social', 'mystery', 'quiet'] }),
]);

export const BACKGROUND_BY_ID = Object.freeze(Object.fromEntries(CINEMATIC_BACKGROUNDS.map((item) => [item.id, item])));
export const PLATE_BY_ID = Object.freeze(Object.fromEntries(Object.values(CHARACTER_PLATES).flat().map((item) => [item.id, item])));

const EXPRESSION_ALIASES = Object.freeze({
  goaden: Object.freeze({ smirk: 'goaden_smirk', amused: 'goaden_smirk', deflect: 'goaden_idle', guarded: 'goaden_idle', concerned: 'goaden_idle', tired: 'goaden_idle' }),
});

export function plateForExpression(character, expression) {
  const exact = CHARACTER_PLATES[character]?.find((item) => item.emotion === expression)?.id;
  return exact ?? EXPRESSION_ALIASES[character]?.[expression]
    ?? CHARACTER_PLATES[character]?.[0]?.id ?? null;
}

export const cinematicSpeakers = (event = {}) => {
  const lines = event.lines ?? event.payload?.lines ?? [];
  const ordered = [...lines.map((line) => line?.who), ...(event.participants ?? [])];
  return [...new Set(ordered)].filter((id) => CHARACTER_PLATES[id]);
};

function roomKey(room = '') {
  const value = String(room).toLowerCase();
  if (value.includes('roof')) return 'rooftop';
  if (value.includes('quarter') || value.includes('bed')) return 'quarters';
  if (value.includes('corridor')) return 'corridors';
  return null;
}

/** Select a narrow, deterministic vocabulary before a model is called. */
export function selectVisualVocabulary({ event, daypart = 'midday', room = null } = {}) {
  const location = event?.location ?? 'mi6';
  const area = event?.area ?? roomKey(room);
  let candidates = CINEMATIC_BACKGROUNDS.filter((item) => item.location === location
    && item.dayparts.includes(daypart));
  const areaMatches = candidates.filter((item) => item.area && item.area === area);
  if (areaMatches.length) candidates = areaMatches;
  else candidates = candidates.filter((item) => item.area === null);
  if (!candidates.length) candidates = CINEMATIC_BACKGROUNDS.filter((item) => item.id === (daypart === 'night' || daypart === 'small_hours' ? 'london_night' : 'london_day'));
  const speakers = cinematicSpeakers(event);
  const tags = event.type === 'INCIDENT' || event.type === 'ARCANE_SURGE' ? ['danger', 'anomaly', 'deflection']
    : event.type === 'AFTERMATH' ? ['aftermath', 'emotion']
    : ['UNEASE', 'MINOR_ANOMALY'].includes(event.type) ? ['mystery', 'anomaly']
    : event.payload?.mood === 'friction' || event.payload?.mood === 'strained' ? ['friction', 'conversation']
    : event.payload?.mood === 'repair' ? ['repair', 'emotion', 'social']
    : ['LEGION_VISIT', 'VENUE_SCENE'].includes(event.type) ? ['banter', 'social']
    : ['conversation', 'social'];
  return Object.freeze({
    backgrounds: Object.freeze(candidates.map((item) => item.id)),
    plates: Object.freeze(Object.fromEntries(speakers.map((id) => [id,
      Object.freeze(CHARACTER_PLATES[id].filter((item, index) => index === 0
        || item.suitableFor.some(tag => tags.includes(tag))).map((item) => item.id))]))),
  });
}

export function validateVisualChoice(scene, visuals) {
  if (!visuals?.backgrounds?.includes(scene?.background)) return { ok: false, reason: 'invalid_background' };
  for (const beat of scene?.beats ?? []) {
    if (!visuals.plates?.[beat.speaker]?.includes(beat.plate)) return { ok: false, reason: `invalid_plate:${beat.speaker}` };
  }
  return { ok: true, reason: null };
}

export function publicAssetManifest(scene) {
  const background = BACKGROUND_BY_ID[scene.background];
  const plateIds = [...new Set((scene.beats ?? []).map((beat) => beat.plate))];
  return {
    background: background ? { id: background.id, url: background.file } : null,
    plates: Object.fromEntries(plateIds.map((id) => [id, PLATE_BY_ID[id]])
      .filter(([, item]) => item).map(([id, item]) => [id, { id, character: item.character, url: item.file }])),
  };
}
