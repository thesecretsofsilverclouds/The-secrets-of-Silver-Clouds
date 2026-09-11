import { createAtmosphere } from './atmosphere.js';
import { apiUrl } from './api-base.js';
import { scoreMood } from './score-mood.js';
import { ScoreRotation } from './score-rotation.js';
import { deriveAtmosphere, artworkExposure } from './weather-layer.js';
import { ReadingFeedBuffer, reconcileReadingRows, captureReadingPosition, createReadingView, createPassageEffects, earlierReadingRows, atReadingLiveEdge, positionReadingNavigation } from './reading-view.js';
import { createReadingRecap } from './reading-recap.js';
import { loadReadingWindow } from './reading-history.js';
import { createStoryTrail } from './story-trails.js';
import { createNewcomerOrientation, forwardReadingEvents, narrativeWeight, loadedDialogueScenes } from './reader-narrative.js';
import { appendReadingScene } from './reader-scene.js';
import {
  AUTO_SCENE_MAX_MS, CinematicInbox, autoSceneExcerpt, cinematicLines, authoredSceneRecord,
  nextServerCursor, lineReadingHoldMs, SCENE_CLOSE_MS, PausableSceneTimer,
  SceneCloseLifecycle, SceneReadingPreferences,
} from './cinematic-player.js';

const elements = {
  clock: document.querySelector('#clock'),
  date: document.querySelector('#date'),
  phase: document.querySelector('#phase'),
  sun: document.querySelector('#sun'),
  weather: document.querySelector('#weather'),
  scene: document.querySelector('#scene'),
  status: document.querySelector('#world-status'),
  stories: document.querySelector('#stories'),
  storiesSection: document.querySelector('#stories-section'),
  continuity: document.querySelector('#continuity'),
  continuitySection: document.querySelector('#continuity-section'),
  places: document.querySelector('#places'),
  transit: document.querySelector('#transit'),
  veil: document.querySelector('#veil'),
  veilRow: document.querySelector('#veil-row'),
  factions: document.querySelector('#factions'),
  characters: document.querySelector('#characters'),
  events: document.querySelector('#events'),
  emptyEvents: document.querySelector('#empty-events'),
  lastVisit: document.querySelector('#last-visit'),
  olderHistory: document.querySelector('#older-history'),
  olderEvents: document.querySelector('#older-events'),
  olderHistoryButton: document.querySelector('#older-history-button'),
  historyStatus: document.querySelector('#history-status'),
  connection: document.querySelector('#connection'),
  refresh: document.querySelector('#refresh'),
  backdropLayers: [...document.querySelectorAll('.world-backdrop-layer')],
  savedMomentsBtn: document.querySelector('#saved-moments-btn'),
  savedCount: document.querySelector('#saved-count'),
  profileBtn: document.querySelector('#profile-btn'),
  headerAvatar: document.querySelector('#header-avatar'),
  headerProfileName: document.querySelector('#header-profile-name'),
  drawerBackdrop: document.querySelector('#drawer-backdrop'),
  discussionDrawer: document.querySelector('#discussion-drawer'),
  drawerClose: document.querySelector('#drawer-close'),
  drawerBeatTitle: document.querySelector('#drawer-beat-title'),
  drawerBeatExcerpt: document.querySelector('#drawer-beat-excerpt'),
  drawerReactionsBar: document.querySelector('#drawer-reactions-bar'),
  drawerComments: document.querySelector('#drawer-comments'),
  commentForm: document.querySelector('#comment-form'),
  commentText: document.querySelector('#comment-text'),
  commentSubmitBtn: document.querySelector('#comment-submit-btn'),
  signatureAvatar: document.querySelector('#signature-avatar'),
  signatureInfo: document.querySelector('#signature-info'),
  signatureFlair: document.querySelector('#signature-flair'),
  signatureEditBtn: document.querySelector('#signature-edit-btn'),
  savedDrawer: document.querySelector('#saved-drawer'),
  savedClose: document.querySelector('#saved-close'),
  savedList: document.querySelector('#saved-list'),
  cinematicArchiveBtn: document.querySelector('#cinematic-archive-btn'),
  cinematicArchiveDrawer: document.querySelector('#cinematic-archive-drawer'),
  cinematicArchiveClose: document.querySelector('#cinematic-archive-close'),
  cinematicArchiveBody: document.querySelector('#cinematic-archive-body'),
  dispatchBtn: document.querySelector('#dispatch-btn'),
  dispatchDrawer: document.querySelector('#dispatch-drawer'),
  dispatchClose: document.querySelector('#dispatch-close'),
  dispatchDismissBtn: document.querySelector('#dispatch-dismiss-btn'),
  dispatchShareBtn: document.querySelector('#dispatch-share-btn'),
  dispatchBody: document.querySelector('#dispatch-body'),
  dispatchGazetteTitle: document.querySelector('#dispatch-gazette-title'),
  dispatchTagline: document.querySelector('#dispatch-tagline'),
  clocksBtn: document.querySelector('#clocks-btn'),
  clocksCount: document.querySelector('#clocks-count'),
  clocksDrawer: document.querySelector('#clocks-drawer'),
  clocksClose: document.querySelector('#clocks-close'),
  clocksDismissBtn: document.querySelector('#clocks-dismiss-btn'),
  clocksRefreshBtn: document.querySelector('#clocks-refresh-btn'),
  clocksBody: document.querySelector('#clocks-body'),
  notifToggleBtn: document.querySelector('#notif-toggle-btn'),
  urgentToast: document.querySelector('#urgent-toast'),
  urgentToastText: document.querySelector('#urgent-toast-text'),
  urgentToastAction: document.querySelector('#urgent-toast-action'),
  urgentToastDismiss: document.querySelector('#urgent-toast-dismiss'),
  profileModal: document.querySelector('#profile-modal'),
  profileClose: document.querySelector('#profile-close'),
  profileCancel: document.querySelector('#profile-cancel'),
  profileForm: document.querySelector('#profile-form'),
  profileNameInput: document.querySelector('#profile-name-input'),
  profileHolyInput: document.querySelector('#profile-holy-input'),
  profileGuardianInput: document.querySelector('#profile-guardian-input'),
  profileTitleInput: document.querySelector('#profile-title-input'),
  profileBioInput: document.querySelector('#profile-bio-input'),
  fateSyncNotice: document.querySelector('#fate-sync-notice'),
  avatarPicker: document.querySelector('#avatar-picker'),
};

// A real browser session, used only for the active-viewer gate. It is not a
// player identity and it never enters simulation state. sessionStorage keeps a
// reload in the same tab continuous while a closed tab expires server-side.
const VIEWER_SESSION_KEY = 'silver-clouds-viewer-session';
const VIEWER_TOKEN_KEY = 'silver-clouds-viewer-token';
const viewerSessionId = (() => {
  try {
    const existing = sessionStorage.getItem(VIEWER_SESSION_KEY);
    if (existing) return existing;
    const id = globalThis.crypto?.randomUUID?.()
      ?? `viewer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(VIEWER_SESSION_KEY, id);
    return id;
  } catch {
    return `viewer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
})();
let viewerToken = (() => {
  try { return sessionStorage.getItem(VIEWER_TOKEN_KEY) || null; }
  catch { return null; }
})();

function viewerFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('X-Client-Id', viewerSessionId);
  if (viewerToken) headers.set('X-Viewer-Token', viewerToken);
  return fetch(url, { ...options, headers });
}

const clockFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});
const eventFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
});
const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false,
});
const placeNames = {
  mi6: 'MI6', sanctuary: 'Sanctuary', streamliner: 'Streamliner',
  enchanted_ink: 'Enchanted Ink', cafe: 'The Silver Spoon Cafe', big_ben_plaza: 'New Big Ben plaza',
};
const activityNames = {
  unhurried_time: 'Taking it easy',
  quiet_break: 'Taking a quiet break',
  sleeping: 'Asleep',
  watching_television: 'Watching television',
  playing_piano: 'Playing the piano',
  listening_to_music: 'Listening to music',
  training: 'Training',
  gaming: 'Gaming',
  eating: 'Eating',
  travelling: 'Travelling',
  resting: 'Resting',
  in_a_briefing: 'In an inner circle briefing',
  on_call: 'On call',
  visiting_enchanted_ink: 'At Enchanted Ink',
  getting_a_tattoo: 'Having the prowler design done',
  checking_training_ground: 'Checking the training grounds',
  clearing_training_ground: 'Clearing the training grounds',
  at_the_silver_spoon: 'At the Silver Spoon Cafe',
  walking_the_city: 'Walking the city',
};
// Existing authored art, prepared as restrained full-bleed scenery. The
// simulator publishes presentation keys; choosing and fading files remains a
// client concern and cannot alter the shared world's history.
const WORLD_BACKDROPS = Object.freeze({
  london_day: '/worldstream/app/scene/world-london-day.jpg',
  london_night: '/worldstream/app/scene/world-london-night.jpg',
  mi6_day: '/worldstream/app/scene/world-mi6-day.jpg',
  mi6_night: '/worldstream/app/scene/world-mi6-night.jpg',
  streamliner_day: '/worldstream/app/scene/world-streamliner-day.jpg',
  streamliner_night: '/worldstream/app/scene/world-streamliner-night.jpg',
  sanctuary_day: '/worldstream/app/scene/world-sanctuary-day.jpg',
  sanctuary_evening: '/worldstream/app/scene/world-sanctuary-evening.jpg',
  sanctuary_nightclub: '/worldstream/app/scene/world-sanctuary-night.jpg',
  sanctuary_closed: '/worldstream/app/scene/world-sanctuary-closed.jpg',
  enchanted_ink_day: '/worldstream/app/scene/world-enchanted-ink.jpg',
  enchanted_ink_night: '/worldstream/app/scene/world-enchanted-ink.jpg',
  legion_hideout_day: '/worldstream/app/scene/world-legion-hideout-day.jpg',
  legion_hideout_night: '/worldstream/app/scene/world-legion-hideout-night.jpg',
  cafe_day: '/worldstream/app/scene/world-cafe-day.jpg',
  cafe_evening: '/worldstream/app/scene/world-london-night.jpg',
  cafe_closed: '/worldstream/app/scene/world-london-night.jpg',
  big_ben_plaza_day: '/worldstream/app/scene/world-london-day.jpg',
  big_ben_plaza_night: '/worldstream/app/scene/world-london-night.jpg',
  mi6_lunch_hall: '/worldstream/app/scene/world-mi6-lunch-hall.jpg',
  mi6_gaming: '/worldstream/app/scene/world-mi6-gaming.jpg',
  mi6_ops: '/worldstream/app/scene/world-mi6-ops.jpg',
  mi6_music: '/worldstream/app/scene/world-mi6-music.jpg',
  mi6_briefing: '/worldstream/app/scene/world-mi6-briefing.jpg',
  mi6_training: '/worldstream/app/scene/world-mi6-training.jpg',
  mi6_indoor_yard: '/worldstream/app/scene/world-mi6-indoor-yard.jpg',
  mi6_sealed_door: '/worldstream/app/scene/world-mi6-sealed-door.jpg',
});

// MI6 was one picture. It is nine rooms in the simulation and eight of them
// now have their own artwork, so the join is the room name the world already
// publishes for each area — not a second list of places kept in the client.
// The corridors keep the general interior, because that is what it is a
// picture of. The sealed door will not appear on its own: the basement is a
// SEALED_AREA and nobody is ever scheduled into it, so the art waits.
const MI6_ROOM_ART = Object.freeze({
  'the lunch hall': { key: 'mi6_lunch_hall', file: 'world-mi6-lunch-hall', outdoors: false },
  'the gaming area': { key: 'mi6_gaming', file: 'world-mi6-gaming', outdoors: false },
  'the operations room': { key: 'mi6_ops', file: 'world-mi6-ops', outdoors: false },
  'the music room': { key: 'mi6_music', file: 'world-mi6-music', outdoors: false },
  'the assembly room': { key: 'mi6_briefing', file: 'world-mi6-briefing', outdoors: false },
  'the training grounds': { key: 'mi6_training', file: 'world-mi6-training', outdoors: true },
  'the covered training floor': { key: 'mi6_indoor_yard', file: 'world-mi6-indoor-yard', outdoors: false },
  'the basement': { key: 'mi6_sealed_door', file: 'world-mi6-sealed-door', outdoors: false },
});
// The outdoor yard is painted under an overcast afternoon, so after dark it
// hands back to the night exterior rather than pretending the sky is grey.
const mi6RoomArt = (room, afterDark) => {
  const art = MI6_ROOM_ART[String(room ?? "")];
  return art && !(art.outdoors && afterDark) ? art : null;
};

const worldBackdrop = (() => {
  const layers = elements.backdropLayers;
  let active = 0;
  let requested = '';
  let generation = 0;

  function set(source) {
    if (!source || layers.length !== 2 || source === requested) return;
    requested = source;
    const request = ++generation;
    const image = new Image();
    image.decoding = 'async';
    image.src = source;
    image.addEventListener('load', () => {
      if (request !== generation) return;
      const next = active === 0 ? 1 : 0;
      layers[next].style.backgroundImage = `url("${source}")`;
      requestAnimationFrame(() => {
        layers[active].classList.remove('is-visible');
        layers[next].classList.add('is-visible');
        active = next;
      });
    }, { once: true });
  }

  return { set };
})();

function nightLike(phase) {
  return phase === 'night' || phase === 'dusk';
}

function sharedJourney(characters) {
  if (!characters.length || characters.some(character => !character.journey)) return null;
  const first = characters[0].journey;
  return characters.every(character => {
    const journey = character.journey;
    return journey.from === first.from && journey.to === first.to
      && journey.departedAt === first.departedAt && journey.arrivesAt === first.arrivesAt;
  }) ? first : null;
}

function backdropSource(world) {
  const characters = Array.isArray(world.characters) ? world.characters : [];
  const phase = DAY_PHASES.has(world.time?.dayPhase) ? world.time.dayPhase : 'day';
  const neutral = nightLike(phase) ? 'london_night' : 'london_day';
  if (sharedJourney(characters)) {
    return WORLD_BACKDROPS[nightLike(phase) ? 'streamliner_night' : 'streamliner_day'];
  }
  const samePlace = characters.length > 0
    && characters.every(character => character.location === characters[0].location && !character.journey);
  if (!samePlace) return WORLD_BACKDROPS[neutral];
  if (characters[0].location === 'mi6') {
    // Both of them, in the same named room, or it stays the general view.
    const room = characters.every(character => character.room === characters[0].room) ? characters[0].room : null;
    const art = mi6RoomArt(room, nightLike(phase));
    if (art) return WORLD_BACKDROPS[art.key];
  }
  if (characters[0].location === 'mi6' && deriveAtmosphere(world).exposure === 'outdoor') return WORLD_BACKDROPS[neutral];
  const published = String(world.scene?.fallbackKey || world.scene?.backgroundKey || '').replace(/_rain$/, '');
  return WORLD_BACKDROPS[published] || WORLD_BACKDROPS[neutral];
}

function placeArtwork(place, phase, sceneState) {
  if (sceneState?.location === place) {
    const published = String(sceneState.fallbackKey || sceneState.backgroundKey || '').replace(/_rain$/, '');
    if (WORLD_BACKDROPS[published]) return WORLD_BACKDROPS[published];
  }
  const afterDark = nightLike(phase);
  if (place === 'mi6') return WORLD_BACKDROPS[afterDark ? 'mi6_night' : 'mi6_day'];
  if (place === 'streamliner') return WORLD_BACKDROPS[afterDark ? 'streamliner_night' : 'streamliner_day'];
  if (place === 'sanctuary') {
    if (phase === 'night') return WORLD_BACKDROPS.sanctuary_nightclub;
    if (phase === 'dusk') return WORLD_BACKDROPS.sanctuary_evening;
    return WORLD_BACKDROPS.sanctuary_day;
  }
  if (place === 'enchanted_ink') return WORLD_BACKDROPS.enchanted_ink_day;
  if (place === 'big_ben_plaza') return WORLD_BACKDROPS[afterDark ? 'london_night' : 'london_day'];
  if (place === 'cafe' && !afterDark) return WORLD_BACKDROPS.cafe_day;
  return '/worldstream/app/scene/place-cafe.jpg';
}
// The four solar phases, and the operating mode each place is currently running.
const DAY_PHASES = new Set(['dawn', 'day', 'dusk', 'night']);
const phaseNames = { dawn: 'Dawn', day: 'Daylight', dusk: 'Dusk', night: 'Night' };
const modeNames = {
  day_watch: 'Day watch', night_shift: 'Night shift',
  sacred_quiet: 'Sacred quiet', public_attraction: 'Open to visitors',
  evening_transition: 'Evening', nightlife: 'Open for the evening', closed_reset: 'Closed until morning',
  frequent_service: 'Frequent service', reduced_service: 'Reduced service', sparse_service: 'Night service',
  open: 'Open', shuttered: 'Shuttered', last_orders: 'Last orders', closed: 'Closed',
  open_air: 'Open air', quiet_streets: 'Quiet streets',
};
const factionNames = {
  mi6: 'MI6', order: 'The Holy Order', church: 'The Church',
  sanctuary: 'Sanctuary', streamliner: 'Streamliner', arcane: 'Arcane activity',
};
const factionLevels = {
  routine: 'Routine', briefings: 'Inner circle briefing', elevated: 'Heightened readiness',
  quiet: 'Quiet', watchful: 'Watchful', active_in_city: 'Operatives in the city',
  preparations: 'Celestial Veil preparations', veil_cycle: 'Next Veil cycle dated',
  invited_guests: 'Invited guests', private_event: 'Private event',
  normal: 'Normal service', minor_delays: 'Minor delays',
  low: 'Low', moderate: 'Above baseline', high: 'High',
};
const factionTones = {
  elevated: 'alert', active_in_city: 'alert', high: 'alert',
  briefings: 'notice', watchful: 'notice', preparations: 'notice', veil_cycle: 'notice',
  private_event: 'notice', minor_delays: 'notice', moderate: 'notice',
};
let serverClockOffset = 0;
let refreshing = false;
let hasWorld = false;
// Rebuilt with the character cards, then advanced every second between fetches.
let liveCards = [];
let liveCountdowns = [];
let liveJourneys = [];

let sceneAtmosphere = null;
const atmosphere = createAtmosphere({ onVolume: value => music.setVolume(value),
  onCreatures: enabled => lintelSky.setEnabled(enabled) });

// Lintels drifting over the page.
//
// THIS IS A PORT, NOT A NEW ANIMATION — the same rule the Codex's soul-sip-lure
// followed. Every motion constant below is the game's own `_spawn_floating_familiar`
// (webgame/scripts/main.gd), by way of the site's port: 140 px, 114 px/s drift,
// 26 px bob over 1.7 s, 3 frames at 0.26 s. The creature drifting over this page
// is measurably the one on the Codex and the one in the Hub.
//
// How many are overhead is the world's business, not the page's: lintels feed off
// ambient magical energy, so the count follows the MEU reading the projection
// sends. A quiet day has one; a day the scanners are flagging draws a crowd.
const lintelSky = (() => {
  const SIZE = 140;        // px, the game's TextureRect size
  const SPEED = 114;       // px/s (game: -160 -> 1440 over 14.0 s)
  const BOB_AMP = 26;      // px
  const BOB_HALF = 1.7;    // s per half cycle, sine ease-in-out
  const FRAME_MS = 260;    // 0.26 s per drift frame
  // Mount-absolute, like the scene and ambient artwork. These were the last
  // three site-root paths in the app and they simply 404'd once it moved to
  // /worldstream/app/ — the drift layer built its nodes and drew nothing.
  const FRAMES = ['/worldstream/app/lintel-drift-1.png',
    '/worldstream/app/lintel-drift-2.png', '/worldstream/app/lintel-drift-3.png'];
  const TOP_MIN = 70, TOP_MAX = 260;   // the game's start_y range
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const layer = document.querySelector('#lintel-layer');
  const drifting = new Set();
  let wanted = 0, allowed = true, tickTimer = null;

  function drift() {
    if (!layer || !allowed || reducedMotion.matches || document.hidden || drifting.size >= wanted) return;
    const node = document.createElement('img');
    node.className = 'lintel';
    node.alt = '';
    node.decoding = 'async';
    let frame = 0;
    node.src = FRAMES[0];
    node.style.top = `${TOP_MIN + Math.random() * (TOP_MAX - TOP_MIN)}px`;
    layer.append(node);
    drifting.add(node);

    const span = window.innerWidth + SIZE * 2;
    const started = performance.now();
    const bobPhase = Math.random() * Math.PI * 2;
    let lastFrame = started;
    const step = now => {
      const seconds = (now - started) / 1000;
      const x = -SIZE + SPEED * seconds;
      if (x > span || !node.isConnected) {
        node.remove();
        drifting.delete(node);
        return;
      }
      // Sine ease-in-out over a 1.7 s half cycle, the game's bob.
      const bob = Math.sin(bobPhase + (Math.PI * seconds) / BOB_HALF) * BOB_AMP;
      node.style.transform = `translate3d(${x}px, ${bob}px, 0)`;
      if (now - lastFrame >= FRAME_MS) {
        frame = (frame + 1) % FRAMES.length;
        node.src = FRAMES[frame];
        lastFrame = now;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // Spread arrivals out rather than releasing a flock at once. The next tick is
  // scheduled first and unconditionally: a throw inside drift would otherwise
  // break the chain once and empty the sky for the rest of the session.
  function tick() {
    clearTimeout(tickTimer);
    tickTimer = null;
    if (!allowed || document.hidden || reducedMotion.matches) return;
    tickTimer = setTimeout(tick, 4_000 + Math.random() * 9_000);
    // A node can leave the page without step retiring it — a frame callback that
    // never runs while the tab is not compositing is the ordinary case. Prune
    // first, or the set fills to the wanted count and nothing ever drifts again.
    for (const node of drifting) if (!node.isConnected) drifting.delete(node);
    if (document.visibilityState === 'visible') drift();
  }
  function reconcile() {
    if (!allowed || document.hidden || reducedMotion.matches) {
      clearTimeout(tickTimer); tickTimer = null;
      for (const node of drifting) node.remove();
      drifting.clear();
    } else if (layer && tickTimer === null) tick();
  }
  document.addEventListener('visibilitychange', reconcile);
  reducedMotion.addEventListener('change', reconcile);
  reconcile();
  return {
    set(count) { wanted = Number.isFinite(count) ? Math.max(0, Math.min(2, count)) : 0; },
    setEnabled(value) { if (allowed !== value) { allowed = value; reconcile(); } },
  };
})();

function readable(value) {
  if (typeof value !== 'string' || !value.length) return '—';
  const words = value.replaceAll('_', ' ').replaceAll('-', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function locationName(value) {
  return placeNames[value] || readable(value);
}

function asTime(value) {
  const timestamp = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function timeLabel(value) {
  const timestamp = asTime(value);
  return timestamp === null ? '—' : eventFormat.format(timestamp);
}

function node(tag, text, className) {
  const result = document.createElement(tag);
  if (text !== undefined) result.textContent = text;
  if (className) result.className = className;
  return result;
}

function updateClock() {
  const timestamp = Date.now() + serverClockOffset;
  elements.clock.textContent = clockFormat.format(timestamp);
  elements.date.textContent = dateFormat.format(timestamp);
}

// One glance: where each of them is, and whether they are moving. The order is
// the world's own — MI6, then the rail, then everywhere the rail reaches.
const PLACE_ORDER = ['mi6', 'streamliner', 'sanctuary', 'enchanted_ink', 'cafe', 'big_ben_plaza'];

function whereabouts(characters, world) {
  const phase = DAY_PHASES.has(world.time?.dayPhase) ? world.time.dayPhase : 'day';
  const list = elements.places;
  const here = new Map(PLACE_ORDER.map(place => [place, []]));
  for (const character of characters) {
    if (here.has(character.location)) here.get(character.location).push(character);
  }
  list.replaceChildren(...PLACE_ORDER.map(place => {
    const item = node('li', undefined, 'place');
    item.style.backgroundImage = `url("${placeArtwork(place, phase, world.scene)}")`;
    const occupants = here.get(place);
    item.dataset.occupied = occupants.length ? 'yes' : 'no';
    const label = node('span', locationName(place), 'place-name');
    const who = node('span', undefined, 'place-who');
    const activitySummary = occupants.map(character =>
      `${character.name}: ${activityNames[character.activity] || readable(character.activity)}`).join('; ');
    item.setAttribute('aria-label', occupants.length
      ? `${locationName(place)}. Here now: ${activitySummary}`
      : `${locationName(place)}. Neither Goaden nor Ashai is here now.`);
    item.title = occupants.length ? activitySummary : locationName(place);
    for (const character of occupants) {
      const marker = document.createElement('img');
      marker.className = 'marker';
      marker.src = `/worldstream/app/scene/${character.id}-icon.png`;
      marker.alt = '';
      marker.title = `${character.name} — ${activityNames[character.activity] || readable(character.activity)}`;
      who.append(marker);
    }
    item.append(label);
    if (occupants.length) {
      const live = node('span', 'LIVE', 'place-live');
      live.setAttribute('aria-hidden', 'true');
      const names = node('span', occupants.map(character => character.name.split(' ')[0]).join(' + '), 'place-people');
      names.setAttribute('aria-hidden', 'true');
      item.append(live, who, names);
    } else {
      item.append(who);
    }
    return item;
  }));

  // A journey is the one thing a still list cannot show, so it gets its own line.
  const travelling = characters.filter(character => character.journey);
  if (!travelling.length) {
    elements.transit.hidden = true;
    return;
  }
  const leg = travelling[0].journey;
  const companions = travelling.filter(character => {
    const journey = character.journey;
    return journey.from === leg.from && journey.to === leg.to
      && journey.departedAt === leg.departedAt && journey.arrivesAt === leg.arrivesAt;
  });
  const names = companions.map(character => character.name.split(' ')[0]).join(' and ');
  const status = node('strong', `${names} in transit`);
  const eta = node('span', '', 'transit-eta');
  const summary = node('span', undefined, 'transit-summary');
  summary.append(status, eta);
  const origin = node('span', locationName(leg.from), 'transit-endpoint');
  const destination = node('span', locationName(leg.to), 'transit-endpoint');
  const track = node('span', undefined, 'transit-track');
  const progress = node('span', undefined, 'transit-progress');
  const travellers = node('span', undefined, 'transit-travellers');
  for (const character of companions) {
    const portrait = document.createElement('img');
    portrait.src = `/worldstream/app/scene/${character.id}-icon.png`;
    portrait.alt = '';
    travellers.append(portrait);
  }
  track.append(progress, travellers);
  const rail = node('span', undefined, 'transit-rail');
  rail.append(origin, track, destination);
  elements.transit.replaceChildren(summary, rail);
  elements.transit.hidden = false;
  elements.transit.dataset.from = leg.from;
  elements.transit.dataset.to = leg.to;
  liveJourneys.push({ ...leg, names, container: elements.transit, status, eta, progress, travellers });
}

// Whole minutes, spoken the way a person would say them.
function spellMinutes(totalMinutes) {
  const minutes = Math.max(0, Math.round(totalMinutes));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

// The world only speaks when something happens, and that can be an hour apart.
// Between those moments the page carries the present itself: how far into the
// current activity each character is, counted against the world's own clock.
// This invents nothing — both instants come from the projection.
function liveProgress(live, worldNow) {
  const since = asTime(live.since);
  const until = asTime(live.until);
  if (since === null || worldNow < since) return { fraction: null, text: '' };
  const elapsed = (worldNow - since) / 60_000;
  if (until === null || until <= since) {
    // Open-ended: sleeping until morning, or an activity with no set finish.
    return { fraction: null, text: `${spellMinutes(elapsed)} so far` };
  }
  const span = (until - since) / 60_000;
  const remaining = (until - worldNow) / 60_000;
  // The world advances a minute behind the page's clock, so a just-finished
  // activity would otherwise count downwards past zero.
  if (remaining <= 0) return { fraction: 1, text: `${spellMinutes(span)} · finishing` };
  return {
    fraction: Math.min(1, Math.max(0, elapsed / span)),
    text: `${spellMinutes(elapsed)} in · ${spellMinutes(remaining)} left`,
  };
}

function updateLiveState() {
  const worldNow = Date.now() + serverClockOffset;
  for (const live of liveCards) {
    const { fraction, text } = liveProgress(live, worldNow);
    live.text.textContent = text;
    live.track.hidden = fraction === null;
    if (fraction !== null) {
      live.bar.style.width = `${(fraction * 100).toFixed(2)}%`;
      live.track.setAttribute('aria-valuenow', Math.round(fraction * 100));
    }
  }
  // A journey in progress counts down like everything else, so the strip shows
  // them actually crossing rather than simply being labelled "travelling".
  for (const leg of liveJourneys) {
    const departedAt = asTime(leg.departedAt);
    const arrivesAt = asTime(leg.arrivesAt);
    if (departedAt === null || arrivesAt === null || arrivesAt <= departedAt) continue;
    const remaining = (arrivesAt - worldNow) / 60_000;
    const fraction = Math.min(1, Math.max(0, (worldNow - departedAt) / (arrivesAt - departedAt)));
    leg.progress.style.width = `${(fraction * 100).toFixed(2)}%`;
    leg.travellers.style.left = `${(fraction * 100).toFixed(2)}%`;
    leg.status.textContent = remaining <= 0 ? `${leg.names} arriving` : `${leg.names} in transit`;
    leg.eta.textContent = remaining <= 0 ? 'arriving now' : `${spellMinutes(remaining)} remaining`;
    leg.container.setAttribute('aria-label', remaining <= 0
      ? `${leg.names} arriving at ${locationName(leg.to)}`
      : `${leg.names}, ${locationName(leg.from)} to ${locationName(leg.to)}, ${spellMinutes(remaining)} remaining`);
  }
  // Anticipation is the other half of a world that feels like it is running:
  // the wait until the next thing shortens while you watch it.
  for (const countdown of liveCountdowns) {
    const remaining = (countdown.at - worldNow) / 60_000;
    countdown.element.textContent = remaining <= 0 ? 'due now' : `in ${spellMinutes(remaining)}`;
  }
}

// The announced plan and the ordinary routine are one list: the next thing is
// the next thing, whichever it is.
function upcomingList(character) {
  const items = (Array.isArray(character.upcoming) ? character.upcoming : [])
    .filter(item => asTime(item.at) !== null && typeof item.description === 'string');
  const next = character.nextTransition;
  if (next && asTime(next.at) !== null && typeof next.description === 'string'
    && !items.some(item => item.at === next.at)) {
    items.push({ at: next.at, description: next.description });
  }
  return items.sort((first, second) => first.at - second.at).slice(0, 4);
}

// What a state looks like when it is happening rather than merely labelled.
// Each is a small stack of drifting glyphs, staggered so they never move in
// lockstep. The CSS holds the motion; this only says which marks and how many.
const ACTIVITY_GLYPHS = Object.freeze({
  sleeping: { mark: 'Z', count: 3, kind: 'drift' },
  resting: { mark: '·', count: 3, kind: 'drift' },
  playing_piano: { mark: '♪', count: 3, kind: 'drift' },
  listening_to_music: { mark: '♫', count: 3, kind: 'drift' },
  training: { mark: '', count: 1, kind: 'pulse' },
  on_call: { mark: '', count: 1, kind: 'pulse' },
  in_a_briefing: { mark: '', count: 1, kind: 'pulse' },
});
function activityGlyph(activity) {
  const spec = ACTIVITY_GLYPHS[activity];
  if (!spec) return null;
  const wrap = node('span', undefined, `activity-glyph is-${spec.kind}`);
  wrap.dataset.activity = activity;
  wrap.setAttribute('aria-hidden', 'true');
  for (let index = 0; index < spec.count; index++) {
    const mark = node('span', spec.mark, 'glyph-mark');
    mark.style.setProperty('--index', String(index));
    wrap.append(mark);
  }
  return wrap;
}

// The traces for a place, as a sentence. Named rooms rather than a global list,
// because the moment Goaden is at MI6 and Ashai is at Sanctuary a single array
// is answering the wrong question.
function tracesFor(locationId) {
  const all = lastWorld?.narrative?.tracesByLocation ?? {};
  return Object.entries(all)
    .filter(([place]) => place.startsWith(`${locationId}:`))
    .flatMap(([, list]) => list);
}

function characterCard(character) {
  const card = node('article', undefined, 'character');
  const hero = document.createElement('img');
  hero.className = 'hero';
  hero.src = `/worldstream/app/scene/${character.id}-anime.png`;
  hero.alt = '';
  hero.decoding = 'async';
  // A scrim between the art and the words. Without it the small metadata sits
  // directly on whatever the character is wearing, which is where the card
  // stopped being readable.
  card.append(hero, node('span', undefined, 'card-scrim'), node('h3', character.name));
  card.dataset.activity = character.activity || 'unknown';
  const details = node('dl');
  for (const [label, value] of [
    ['Location', locationName(character.location)],
    ['Activity', activityNames[character.activity] || readable(character.activity)],
  ]) {
    const row = node('div');
    const value_ = node('dd', value);
    // The room rides under the location, because it is the same fact at a finer
    // grain — "MI6" and then which part of it.
    if (label === 'Location' && typeof character.room === 'string' && character.room) {
      value_.append(node('span', character.room, 'room'));
    }
    row.append(node('dt', label), value_);
    details.append(row);
  }
  card.append(details);
  const inkResult=lastWorld?.storyResults?.find(result=>result.owner===character.id&&result.kind==='cosmetic_tattoo');
  if(inkResult) card.append(node('p', inkResult.description, 'carrying'));
  // A visible sign of what they are actually doing, so a glance at the card
  // reads before the words do. Purely presentational: every one of these is
  // driven by the activity the projection already states.
  const glyph = activityGlyph(character.activity);
  if (glyph) card.append(glyph);
  if (asTime(character.activitySince) !== null) {
    const track = node('div', undefined, 'progress');
    track.role = 'progressbar';
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', '100');
    track.setAttribute('aria-label', `Progress through ${activityNames[character.activity] || readable(character.activity)}`);
    const bar = node('span');
    track.append(bar);
    const text = node('p', undefined, 'elapsed');
    card.append(track, text);
    liveCards.push({ since: character.activitySince, until: character.activityUntil, track, bar, text });
    const until = asTime(character.activityUntil);
    card.append(node('p', until === null
      ? `Since ${timeLabel(character.activitySince)}`
      : `${timeLabel(character.activitySince)} — ${timeFormat.format(until)}`, 'since'));
  }
  // What they are carrying, as one line of prose under the activity. No emoji,
  // no label, no badge: the author's note was that this should read like a
  // sentence somebody wrote rather than a stat the page is tracking. It only
  // appears when there is something to say.
  const carrying = lastWorld?.narrative?.carrying?.[character.id];
  if (carrying?.echo) {
    const line = node('p', carrying.echo, 'carrying');
    if (carrying.because?.summary) line.title = `Since ${carrying.because.summary}`;
    card.append(line);
  }
  const upcoming = upcomingList(character);
  if (upcoming.length) {
    card.append(node('h4', 'Coming up', 'upcoming-heading'));
    const list = node('ol', undefined, 'upcoming');
    for (const item of upcoming) {
      const row = node('li');
      const when = node('time', timeFormat.format(asTime(item.at)));
      when.dateTime = new Date(asTime(item.at)).toISOString();
      const countdown = node('span', undefined, 'countdown');
      liveCountdowns.push({ at: asTime(item.at), element: countdown });
      row.append(when, node('span', item.description, 'upcoming-what'), countdown);
      list.append(row);
    }
    card.append(list);
  }
  return card;
}

function factionRow([faction, level]) {
  const row = node('li', undefined, 'faction');
  row.append(node('span', factionNames[faction] || readable(faction), 'faction-name'));
  const value = node('span', factionLevels[level] || readable(level), 'faction-level');
  value.dataset.tone = factionTones[level] || 'calm';
  row.append(value);
  return row;
}

const veilPhaseNames = {
  distant: 'Dates set', announced: 'Preparations opened',
  preparing: 'Halls being fitted out', imminent: 'Final week', underway: 'Underway',
};

function veilLabel(veil) {
  const phase = veilPhaseNames[veil.phase] || readable(veil.phase);
  if (veil.phase === 'underway') return 'At the Sanctuary in the sky, today';
  const days = veil.daysAway;
  const away = days === 1 ? 'tomorrow' : `in ${days} days`;
  return `${phase} · ${away}`;
}

const speakerNames = { goaden: 'Goaden', ashai: 'Ashai',
  rose: 'Rose', anarchy: 'Anarchy', balthazar: 'Balthazar', gabriel: 'Gabriel',
  truth: 'Truth', emily: 'Emily', zara: 'Zara',
  damien: 'Damien', davis: 'Agent Davis', henderson: 'General Henderson',
  sprite_orange: 'Orange', sprite_shades: 'Shades', sprite_purple: 'Purple', sprite_blue: 'Blue',
  lintel: 'The lintel', nimbus: 'Nimbus', yukon: 'Yukon', greah: 'Greah', kai: 'Kai' };

function cinematicRecordForEvent(event) {
  const value = event?.cinematic;
  if (!value || typeof value !== 'object') return null;
  return value.scene ? { ...value, eventId: value.eventId ?? event.id }
    : { eventId: event.id, occurredAt: event.occurredAt, scene: value };
}

function cinematicSummary(value) {
  const record = value?.scene ? value : cinematicRecordForEvent(value);
  return record?.chronicleSummary ?? record?.scene?.chronicleSummary ?? null;
}

function eventDisplayText(event) {
  // The reading feed gets the passage. An accepted scene's short metadata
  // summary must not hide that passage merely because a replay is available.
  return event?.prose || cinematicSummary(event) || event?.description || '';
}

function appendProseParagraphs(container, text, className = 'event-prose') {
  if (typeof text !== 'string' || !text.trim()) return;
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  for (const p of paragraphs) {
    container.append(node('p', p, className));
  }
}

// A conversation reads as an exchange rather than a log line: each speaker on
// their own side, which is also the shape the two-plate overlay will take.
function exchange(lines) {
  const list = node('ol', undefined, 'exchange');
  for (const line of lines) {
    if (!line || typeof line.text !== 'string') continue;
    const row = node('li', undefined, 'said');
    row.dataset.who = line.who === 'ashai' ? 'ashai' : 'goaden';
    row.append(node('span', speakerNames[line.who] || readable(line.who), 'said-who'),
      node('p', line.text, 'said-text'));
    list.append(row);
  }
  return list;
}

// The conversation as a scene: a backdrop, two plates, and the one who is not
// speaking dimmed back.
//
// PORTED FROM `anarchy_pact_cinematic.gd` — "Two in the Chair". Every number
// below is that scene's: plates 405 wide against a 1280 stage at x=8 and x=867,
// a 0.7 s cubic-out slide with a 0.5 s fade, a 0.28 s tint change between
// speakers, and text typed at 44 characters a second. The one number not kept
// is the listener tint: see DIM below. Sides are no longer fixed to anybody
// either, because a Legion scene can have three voices and need not include
// Goaden or Ashai at all.
const scene = (() => {
  const STAGE_W = 1280, STAGE_H = 720;
  const PLATE_W = 405, LEFT_X = 8, RIGHT_X = 867;
  const SLIDE_MS = 700, FADE_MS = 500, TINT_MS = 280;
  const TYPE_PER_SECOND = 44, TYPE_MIN_MS = 200;
  // Whoever is listening steps back. It must NOT recolour them: the original
  // port carried hue-rotate(200deg), which is roughly the width of the colour
  // wheel from green to magenta, and Anarchy's green flames, green eyes and
  // green vest came out pink with blue-grey skin every time he was not the one
  // talking. That was invisible while the only two people in the world were
  // Goaden and Ashai; with a cast whose identities are colour-coded it turns a
  // character into a different character. Brightness and a little desaturation
  // read as "further away" on their own and leave the art alone.
  const DIM = 'brightness(0.5) saturate(0.6)';
  // Goaden's three plates stand in for the eight the writing asks for until the
  // replacement set lands; each falls back to the nearest one he actually has.
  const GOADEN_FALLBACK = {
    idle:'idle', smirk:'smirk', amused:'smirk', deflect:'idle',
    guarded:'idle', concerned:'idle', surprised:'surprised', tired:'idle',
  };
  const ASHAI_PLATES = new Set(['neutral','soft_smile','amused','thoughtful','vulnerable','tired','surprised','guarded']);
  // Every plate the world actually owns, per character. A written line can ask
  // for an expression somebody does not have art for, so each set carries the
  // one it falls back to. Gabriel has no neutral plate at all, which is very
  // much in character, so his resting face is `thinking`.
  const PLATE_SETS = {
    goaden:{ has:new Set(['idle','smirk','surprised']), map:GOADEN_FALLBACK, fallback:'idle' },
    ashai:{ has:ASHAI_PLATES, fallback:'neutral' },
    rose:{ has:new Set(['idle','annoyed','cheeky','happy','intense','observation','sad']), fallback:'idle' },
    anarchy:{ has:new Set(['idle','curious','grin','intense','smirk','surprised']), fallback:'idle' },
    balthazar:{ has:new Set(['idle','smirk','smolder','smolder2']), fallback:'idle' },
    gabriel:{ has:new Set(['annoyed','frown','humble','impressed','laughing','showing-off','surprised','thinking']), fallback:'thinking' },
    truth:{ has:new Set(['annoyed','disgust','laughing','shock','stern','idle']), fallback:'stern' },
    damien:{ has:new Set(['idle']), fallback:'idle' },
    // MI6 colleagues who used to exist only as a line in the corridor.
    davis:{ has:new Set(['idle','closeup']), fallback:'idle' },
    henderson:{ has:new Set(['idle','waiting']), fallback:'idle' },
    emily:{ has:new Set(['annoyed','curious','laughing','leans-in-sad','mocking','sad','thinking']), fallback:'curious' },
    zara:{ has:new Set(['angry','happy','idle','sad','shocked','smile','smiling']), fallback:'idle' },
    // A band of road sprites [P02147] and the drifting lintels of [P00040].
    // Both are street fauna rather than cast, so each carries the one look the
    // plate actually shows and every other expression falls back to it.
    sprite_orange:{ has:new Set(['idle','asleep']), fallback:'idle' },
    sprite_shades:{ has:new Set(['idle','asleep']), fallback:'idle' },
    sprite_purple:{ has:new Set(['idle']), fallback:'idle' },
    sprite_blue:{ has:new Set(['idle']), fallback:'idle' },
    lintel:{ has:new Set(['idle','curious','bright','content']), fallback:'idle' },
    nimbus:{ has:new Set(['angry','happy','showoff','smile','surprised','wink']), fallback:'smile' },
    yukon:{ has:new Set(['irritated']), fallback:'irritated' },
    // Guardians already attached to the pair; the plates were in /scene unused.
    greah:{ has:new Set(['annoyed','cheeky','happy','sad','surprised','warm-greeting']), fallback:'happy' },
    kai:{ has:new Set(['annoyed','greeting','happy','sad','surprised']), fallback:'greeting' },
  };
  // Which room the scene is played in, from the location mode the world reports.
  const BACKDROPS = {
    mi6_night:'world-mi6-night', mi6_day:'world-mi6-day',
    sanctuary_nightclub:'world-sanctuary-night', sanctuary_evening:'world-sanctuary-evening',
    sanctuary_day:'world-sanctuary-day', sanctuary_closed:'world-sanctuary-closed',
    streamliner_day:'world-streamliner-day', streamliner_night:'world-streamliner-night',
    enchanted_ink_day:'world-enchanted-ink', enchanted_ink_night:'world-enchanted-ink',
    legion_hideout_day:'world-legion-hideout-day', legion_hideout_night:'world-legion-hideout-night',
    cafe_day:'world-cafe-day', cafe_evening:'world-london-night', cafe_closed:'world-london-night',
    big_ben_plaza_day:'world-london-day', big_ben_plaza_night:'world-london-night',
  };

  const root = document.querySelector('#scene-layer');
  if (!root) return { play() {}, playCinematic() { return false; }, close() {}, isOpen: () => false,
    autoScenesEnabled: () => true, autoScenesVersion: () => 0, suspend() {}, resume() {} };
  const stage = root.querySelector('.stage');
  const backdrop = root.querySelector('.backdrop');
  // Two stage positions, and whoever is speaking is put in one of them. Until
  // v14 these were hardwired to Goaden and Ashai, which was fine while they were
  // the only two people in the world — a Legion scene can have three speakers
  // and need not include either of the pair.
  const slotNodes = { left: root.querySelector('.plate-left'), right: root.querySelector('.plate-right') };
  let slotOccupant = { left:null, right:null }, lastSpoke = {};
  const nameEl = root.querySelector('.speaker');
  const textEl = root.querySelector('.line');
  const hintEl = root.querySelector('.hint');
  const announcerEl = root.querySelector('.scene-announcer');
  const pauseButton = root.querySelector('.scene-pause');
  const nextButton = root.querySelector('.scene-next');
  const closeButton = root.querySelector('.scene-close');
  const excerptEl = root.querySelector('.scene-excerpt-note');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let readingStorage = null;
  try { readingStorage = localStorage; } catch {}
  const reading = new SceneReadingPreferences(readingStorage);
  const autoScenesControl = document.querySelector('#reading-auto-scenes');
  const instantTextControl = document.querySelector('#reading-instant-text');
  if (autoScenesControl) autoScenesControl.checked = reading.get().autoScenes;
  if (instantTextControl) instantTextControl.checked = reading.get().instantText;
  autoScenesControl?.addEventListener('change', () => {
    reading.set({ autoScenes: autoScenesControl.checked });
    if (!reading.get().autoScenes && autoplay) close();
    drainCinematicQueue();
  });
  instantTextControl?.addEventListener('change', () => {
    reading.set({ instantText: instantTextControl.checked });
    if (open && !closing && typing !== null && reading.get().instantText) completeCurrentLine();
  });
  textEl.setAttribute('tabindex', '0');
  const autoTimer = new PausableSceneTimer(), hardStopTimer = new PausableSceneTimer();
  let lines = [], at = -1, typing = null, open = false, closing = false, lineShownInstantly = false;
  let autoplay = false, paused = false, suppliedAssets = null, suppliedBackground = null;
  let previousFocus = null, excerpted = false, drainOnClose = true;
  const closeLifecycle = new SceneCloseLifecycle({
    onStart() {
      root.classList.add('is-closing');
      if (document.hidden) { root.classList.add('is-suspended'); queueMicrotask(() => closeLifecycle.pause()); }
      if (pauseButton) pauseButton.disabled = true;
      if (nextButton) nextButton.disabled = true;
      hintEl.textContent = 'Returning to the world · Escape or Skip closes immediately';
    },
    onFinish: finishClose,
  });

  const plateSrc = (who, expression, plateId = null) => {
    const supplied = plateId && suppliedAssets?.plates?.[plateId]?.url;
    if (supplied) return supplied;
    const spec = PLATE_SETS[who];
    if (!spec) return null;
    const wanted = spec.map ? (spec.map[expression] || spec.fallback) : expression;
    return `/worldstream/app/scene/${who}-${spec.has.has(wanted) ? wanted : spec.fallback}.png`;
  };
  // Who stands where. A speaker already on stage keeps their side; a new one
  // takes a free side, and once both are full they replace whoever has been
  // quiet longest — which is how a three-hander reads without a third plate.
  function slotFor(who) {
    if (slotOccupant.left === who) return 'left';
    if (slotOccupant.right === who) return 'right';
    if (!slotOccupant.left) { slotOccupant.left = who; return 'left'; }
    if (!slotOccupant.right) { slotOccupant.right = who; return 'right'; }
    const side = (lastSpoke[slotOccupant.left] ?? -1) <= (lastSpoke[slotOccupant.right] ?? -1) ? 'left' : 'right';
    slotOccupant[side] = who;
    return side;
  }

  function fit() {
    const box = root.getBoundingClientRect();
    const compact = box.width <= 900 || box.height <= 560;
    root.classList.toggle('is-compact', compact);
    if (compact) {
      stage.style.transform = 'none';
      return;
    }
    // The stage keeps the pact scene's 16:9 so the ported geometry stays true.
    const scale = Math.min(box.width / STAGE_W, box.height / STAGE_H);
    stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }

  function autoHold(line) {
    return lineReadingHoldMs(line, { instantText: lineShownInstantly, final: at === lines.length - 1 });
  }

  function beginAutoBudget() {
    if (!autoplay || paused || closing || document.hidden) return;
    hardStopTimer.resume();
  }

  function stopAutoBudget() {
    hardStopTimer.pause();
  }

  function scheduleAdvance(delay = autoHold(lines[at])) {
    autoTimer.clear();
    if (autoplay && !paused && !closing && !document.hidden) autoTimer.set(advance, delay);
  }

  function completeCurrentLine({ schedule = true } = {}) {
    const line = lines[at];
    if (!line) return;
    clearTimeout(typing);
    typing = null;
    lineShownInstantly = true;
    textEl.textContent = line.text;
    if (schedule) scheduleAdvance();
  }

  function show(index) {
    const line = lines[index];
    if (!line) return close({ immediate: false });
    at = index;
    autoTimer.clear();
    clearTimeout(typing);
    typing = null;
    textEl.scrollTop = 0;
    const narration = line.kind === 'narration';
    const src = plateSrc(line.who, line.expression, line.plate);
    if (src) {
      const side = slotFor(line.who);
      const plate = slotNodes[side];
      if (!plate) return advance();
      lastSpoke[line.who] = index;
      plate.src = src;
      plate.alt = `${speakerNames[line.who] || readable(line.who)} expression`;
      for (const [where, node] of Object.entries(slotNodes)) {
        const speaking = where === side;
        node.style.filter = speaking ? 'none' : DIM;
        node.style.zIndex = speaking ? '2' : '1';
        node.style.opacity = slotOccupant[where] ? '1' : '0';
      }
    } else for (const node of Object.values(slotNodes)) node.style.filter = DIM;
    // A silent visual action can display its plate without becoming speech.
    // A voice without a portrait still keeps every word in the performance.
    nameEl.textContent = narration ? 'Worldstream' : speakerNames[line.who] || readable(line.who);
    nameEl.dataset.who = narration ? 'narrator' : line.who;
    // Assistive technology receives one complete utterance. The visible line may
    // type in, but its individual characters are deliberately not a live region.
    if (announcerEl) announcerEl.textContent = `${nameEl.textContent}: ${line.text}`;
    // Typed rather than pasted, at the pact scene's 44 characters a second.
    lineShownInstantly = reducedMotion.matches || reading.get().instantText || Boolean(line.instant) || document.hidden;
    if (lineShownInstantly) {
      textEl.textContent = line.text;
      scheduleAdvance();
    } else {
      const duration = Math.max(TYPE_MIN_MS, (line.text.length / TYPE_PER_SECOND) * 1000);
      const started = performance.now();
      textEl.textContent = '';
      const type = () => {
        const ratio = Math.min(1, (performance.now() - started) / duration);
        textEl.textContent = line.text.slice(0, Math.ceil(line.text.length * ratio));
        if (ratio < 1) typing = setTimeout(type, 16);
        else { typing = null; scheduleAdvance(); }
      };
      type();
    }
    hintEl.textContent = autoplay
      ? (index === lines.length - 1 ? 'A moment to linger · P pauses · Escape or S skips' : 'Playing live · Space continues · P pauses · S skips')
      : (index === lines.length - 1 ? 'Click or press Escape to close' : 'Click, or press Space, to continue');
    if (pauseButton) {
      pauseButton.hidden = !autoplay;
      pauseButton.textContent = paused ? 'Resume' : 'Pause';
      pauseButton.setAttribute('aria-pressed', String(paused));
    }
    if (nextButton) nextButton.textContent = index === lines.length - 1 ? 'Finish' : 'Next';
  }

  function advance() {
    if (!open || closing) return;
    autoTimer.clear();
    const line = lines[at];
    // A part-typed line completes first, the way the game lets you skip the type.
    if (line && textEl.textContent.length < line.text.length) {
      // Completing a part-typed line must re-arm autoplay. Previously this
      // branch cleared the only timer and left a live scene stalled forever.
      completeCurrentLine();
      return;
    }
    if (at >= lines.length - 1) close({ immediate: false }); else show(at + 1);
  }

  function togglePause() {
    if (!open || !autoplay || closing) return;
    paused = !paused;
    if (paused) {
      autoTimer.pause();
      if (typing !== null) completeCurrentLine({ schedule: false });
      stopAutoBudget();
    } else {
      beginAutoBudget();
      if (autoTimer.callback) autoTimer.resume();
      else if (typing === null && textEl.textContent === lines[at]?.text) scheduleAdvance();
    }
    if (pauseButton) {
      pauseButton.textContent = paused ? 'Resume' : 'Pause';
      pauseButton.setAttribute('aria-pressed', String(paused));
    }
    if (announcerEl) announcerEl.textContent = paused ? 'Scene paused.' : 'Scene resumed.';
  }

  function close({ immediate = true, drainQueue = true } = {}) {
    if (!open) return;
    drainOnClose = drainQueue;
    closing = true;
    clearTimeout(typing); typing = null;
    autoTimer.clear(); hardStopTimer.clear();
    closeLifecycle.begin({ immediate, reducedMotion: reducedMotion.matches });
  }

  function finishClose() {
    if (!open) return;
    open = false;
    clearTimeout(typing);
    typing = null;
    autoTimer.clear(); hardStopTimer.clear();
    root.hidden = true;
    root.classList.remove('is-closing', 'is-suspended');
    closing = false;
    document.body.classList.remove('scene-open');
    sceneAtmosphere = null;
    atmosphere.setScene(null);
    music.update(lastWorld);
    try { music.undim(); } catch {}
    for (const node of Object.values(slotNodes)) node.removeAttribute('style');
    slotOccupant = { left:null, right:null };
    lastSpoke = {};
    autoplay = false;
    paused = false;
    excerpted = false;
    suppliedAssets = null;
    suppliedBackground = null;
    const setupDetails = root.querySelector('.scene-setup-details');
    if (setupDetails) {
      setupDetails.hidden = true;
      setupDetails.open = false;
    }
    const restore = previousFocus;
    previousFocus = null;
    if (restore && typeof restore.focus === 'function' && restore.isConnected) restore.focus();
    if (drainOnClose) queueMicrotask(() => drainCinematicQueue());
  }

  function play(event, { auto = false } = {}) {
    const authored = authoredSceneRecord(event);
    const performance = authored ? cinematicLines(authored) : event.lines;
    if (!Array.isArray(performance) || !performance.length) return;
    if (open) return false;
    closeLifecycle.reset();
    closing = false; drainOnClose = true; pausedForVisibility = false;
    root.classList.remove('is-closing', 'is-suspended');
    if (pauseButton) pauseButton.disabled = false;
    if (nextButton) nextButton.disabled = false;
    lines = performance;
    autoplay = auto;
    paused = false;
    excerpted = Boolean(event.excerpted);
    suppliedAssets = event.assets || null;
    const eventPhase = event.sceneTime?.dayPhase || event.atmosphere?.time?.dayPhase || lastWorld?.time?.dayPhase || 'day';
    const roomArt = event.location === 'mi6' ? mi6RoomArt(event.room, nightLike(eventPhase)) : null;
    suppliedBackground = event.backgroundUrl || event.assets?.background?.url
      || (roomArt ? WORLD_BACKDROPS[roomArt.key] : null)
      || placeArtwork(event.location, eventPhase, null);
    open = true;
    previousFocus = document.activeElement;
    const label = root.querySelector('.scene-live-mark');
    if (label) {
      const place = event.location || event.atmosphere?.location;
      const at = asTime(event.occurredAt);
      label.textContent = [auto ? 'LIVE FROM SILVER CLOUDS' : 'FROM THE WORLDSTREAM ARCHIVE',
        place ? locationName(place) : null, at === null ? null : timeLabel(at)].filter(Boolean).join(' · ');
    }
    root.hidden = false;
    document.body.classList.add('scene-open');
    // A scene playing live is happening in today's weather, so it carries it.
    // Without this the atmosphere context has no weather at all, and
    // `deriveAtmosphere` correctly applies its archive rule — "missing
    // historical weather stays neutral" — to a scene that is not an archive.
    // Everything downstream then saw `cloudy`: the scene's rain canvas never
    // sized or drew, and the ambient bed dropped rain the moment a scene opened.
    // A manual replay of an earlier beat still inherits nothing, which is what
    // that rule is for.
    sceneAtmosphere = { ...(event.atmosphere || { location: event.location, room: event.room, eventType: event.type, time: event.sceneTime }),
      eventId: event.id, exposure: artworkExposure(suppliedBackground),
      ...(auto && lastWorld?.weather ? { weather: lastWorld.weather } : {}) };
    atmosphere.setScene(sceneAtmosphere);
    music.update(lastWorld);
    const key = document.body.dataset.scene || '';
    // A scene played at MI6 uses the artwork for the room it happened in, which
    // the event already records. Everywhere else keeps the published key.
    backdrop.style.backgroundImage = suppliedBackground
      ? `url("${suppliedBackground}")`
      : `url("/worldstream/app/scene/${roomArt ? roomArt.file : (BACKDROPS[key.replace(/_rain$/, '')] || 'mi6corridor')}.jpg")`;
    // The first two distinct voices take the stage; anybody later swaps in.
    slotOccupant = { left:null, right:null };
    lastSpoke = {};
    const order = [];
    for (const line of lines) if (PLATE_SETS[line.who] && !order.includes(line.who)) order.push(line.who);
    slotOccupant.left = order[0] ?? null;
    slotOccupant.right = order[1] ?? null;
    fit();
    // Both plates start off their own edge and slide home, as the pact scene does.
    for (const [where, node] of Object.entries(slotNodes)) {
      const who = slotOccupant[where];
      const compact = root.classList.contains('is-compact');
      const compactWidth = Math.min(stage.clientWidth * .62, 340);
      const homeX = compact ? (where === 'left' ? 0 : Math.max(0, stage.clientWidth - compactWidth))
        : (where === 'left' ? LEFT_X : RIGHT_X);
      const first = who ? lines.find((line) => line.who === who) : null;
      const src = who ? plateSrc(who, first?.expression ?? PLATE_SETS[who].fallback, first?.plate) : null;
      node.alt = who ? `${speakerNames[who] || readable(who)} expression` : '';
      if (src) node.src = src;
      node.style.transition = 'none';
      node.style.opacity = '0';
      const travel = compact ? compactWidth : PLATE_W;
      node.style.left = `${homeX + (where === 'left' ? -travel : travel)}px`;
      void node.offsetWidth;
      node.style.transition = reducedMotion.matches ? 'none'
        : `left ${SLIDE_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity ${FADE_MS}ms ease, filter ${TINT_MS}ms ease`;
      node.style.left = `${homeX}px`;
      node.style.opacity = who ? '1' : '0';
    }
    if (excerptEl) {
      excerptEl.hidden = !excerpted;
      excerptEl.textContent = excerpted ? 'Live excerpt · the complete accepted scene remains in the archive.' : '';
    }
    const setupDetails = root.querySelector('.scene-setup-details');
    const setupSummary = root.querySelector('.scene-setup-summary');
    const setupSnippet = root.querySelector('.scene-setup-snippet');
    if (setupDetails && setupSummary && setupSnippet) {
      const setup = event.setup || (!authored && event.prose ? { originSnippet: event.prose,
        originTimeLabel: `${timeLabel(event.occurredAt)} · ${locationName(event.location)}` } : event.contextBridge
          ? { originSnippet: event.contextBridge.snippet, originTimeLabel: event.contextBridge.timeLabel } : null);
      if (setup?.originSnippet) {
        const label = setup.originTimeLabel || 'Earlier';
        setupSummary.textContent = `↩ ${label}`;
        setupSnippet.textContent = setup.originSnippet;
        setupDetails.open = false;
        setupDetails.hidden = false;
      } else {
        setupDetails.hidden = true;
        setupDetails.open = false;
      }
    }
    show(0);
    hardStopTimer.clear();
    if (autoplay) hardStopTimer.set(() => close({ immediate: false }),
      AUTO_SCENE_MAX_MS - (reducedMotion.matches ? 0 : SCENE_CLOSE_MS));
    if (document.hidden) { stopAutoBudget(); pausedForVisibility = true; paused = autoplay; }
    beginAutoBudget();
    // The bed drops back so the typed lines carry.
    try { music.duck(); } catch {}
    closeButton?.focus();
    return true;
  }

  function playCinematic(record, { auto = true } = {}) {
    if (auto && !reading.get().autoScenes) return false;
    const performed = record?.scene;
    if (!performed) return false;
    const complete = cinematicLines(record);
    const prepared = auto ? autoSceneExcerpt(complete) : { lines: complete, excerpted: false };
    return play({ id: record.eventId, occurredAt: record.occurredAt, location: record.atmosphere?.location,
      room: record.atmosphere?.room,
      lines: prepared.lines, excerpted: prepared.excerpted,
      assets: performed.assets, backgroundUrl: performed.assets?.background?.url, atmosphere: record.atmosphere || {},
      setup: record.setup || record.packet?.event?.setup || null }, { auto });
  }

  root.addEventListener('click', event => {
    if (event.target.closest('button, a, summary, details')) return;
    advance();
  });
  pauseButton?.addEventListener('click', togglePause);
  nextButton?.addEventListener('click', advance);
  closeButton?.addEventListener('click', close);
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches && open) {
      if (closing) close();
      else if (typing !== null) completeCurrentLine();
    }
  });
  window.addEventListener('resize', () => { if (open) fit(); });
  document.addEventListener('keydown', keyEvent => {
    if (!open) return;
    if (keyEvent.target.closest('button') && [' ', 'Enter'].includes(keyEvent.key)) return;
    if (keyEvent.key === 'Tab') {
      const focusable = [...root.querySelectorAll('button:not([hidden]):not([disabled]), [href], summary, [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0], last = focusable.at(-1);
      if (keyEvent.shiftKey && document.activeElement === first) { keyEvent.preventDefault(); last.focus(); }
      else if (!keyEvent.shiftKey && document.activeElement === last) { keyEvent.preventDefault(); first.focus(); }
      return;
    }
    if (keyEvent.key === 'Escape') { keyEvent.preventDefault(); close(); }
    if (keyEvent.key === ' ' || keyEvent.key === 'Enter') { keyEvent.preventDefault(); advance(); }
    if (keyEvent.key.toLowerCase() === 'p') { keyEvent.preventDefault(); togglePause(); }
    if (keyEvent.key.toLowerCase() === 's') { keyEvent.preventDefault(); close(); }
  });

  let pausedForVisibility = false;
  return { play, playCinematic, close, advance, togglePause, isOpen: () => open,
    autoScenesEnabled: () => reading.get().autoScenes,
    autoScenesVersion: () => reading.autoVersion(),
    suspend() {
      if (!open) return;
      root.classList.add('is-suspended'); closeLifecycle.pause();
      if (!paused && !closing) {
        pausedForVisibility = true;
        if (autoplay) togglePause();
        else if (typing !== null) completeCurrentLine({ schedule: false });
      }
    },
    resume() {
      root.classList.remove('is-suspended'); closeLifecycle.resume();
      if (pausedForVisibility && open && paused && !closing) togglePause();
      pausedForVisibility = false;
    },
  };
})();

let lastRenderedEvents = [];
// The last projection the page drew, so the score can pick a mood the moment
// the reader turns it on rather than waiting for the next minute's refresh.
let lastWorld = null;

// ---- The score ------------------------------------------------------------
//
// Music that follows the world rather than shuffling at it. The tracks are
// grouped into four moods, and which mood is playing is derived from the same
// public state the page already draws: what the pair are doing, what hour it
// is, and what the city's footing is. A track therefore changes because
// something changed, which is the only reason ambient music is ever worth
// having — otherwise it is a radio playing over a window.
//
// Everything here is presentation. It reads the projection and never writes to
// it, and if it were deleted the world would run identically.
const music = (() => {
  const FADE_MS = 2200;          // matches the backdrop crossfade's unhurried feel
  const BED_VOLUME = 0.34;       // it is a bed, not a performance
  const DUCK_VOLUME = 0.12;      // under a dialogue scene, so the lines carry
  const STORE_KEY = 'silver-clouds-score';
  const NOW_PLAYING_MS = 6000;   // how long the title stays legible before receding

  // Which tracks belong to which mood. Slugs are the server's, derived from the
  // filenames in Assets/. A mood with several tracks rotates through them so a
  // long stretch in one state does not become one song on repeat.
  // Anything on disk that no mood claims joins this one. The small hours are
  // the state most in need of a second track and the least likely to be hurt by
  // an unexpected one, so dropping an ambient file into Assets/ is the whole
  // job — no code change, no restart of anything but the server.
  const UNCLAIMED_JOIN = 'night';
  // No mood may be left looping a short pool. Where a mood is short it tops up
  // from the neighbour named here, which is a stopgap rather than a preference:
  // as soon as enough real tracks exist the borrow stops happening on its own,
  // and a file dropped in for the small hours displaces the one night borrows.
  //
  // Four, not two, and the two was doing real damage. Measured over thirty days
  // of world state: `pressure` holds 30% of all listening time and had exactly
  // two tracks, so the guard never fired for the mood that needed it most. Two
  // tracks is three minutes thirty-six of music against stretches up to
  // forty-eight hours — eight hundred times through the pool, strictly
  // alternating. See lab/MUSIC-CHECK.md.
  const MIN_TRACKS = 4;
  const NEIGHBOUR = { night: 'ordinary', play: 'ordinary', pressure: 'play', ordinary: 'play' };
  const MOODS = {
    // The small hours are the only time this world is reliably still, and the
    // state a reader is most likely to sit in for an hour, so it gets the two
    // longest tracks in the score.
    night: ['midnight-static-loop', 'floating-night', 'little-star'],
    // The gaming area at the rear of the lunch hall, and the nights the Legion
    // are round. Arcade music for the room the manuscript puts arcade machines
    // and a sofa full of sweet wrappers in.
    play: ['arcade-after-dark', 'neon-arcade-hustle', 'dunk-no-jutsu', 'touchscreen-drift'],
    // The city leaning on them: an elevated footing, a high MEU reading, the
    // Order working the boroughs. Tiny Rebel lives here and only here — it is
    // the closest thing in the score to an edge, and this is the mood with an
    // edge in it.
    pressure: ['glitch-pocket-riot', 'tiny-rebel', 'mowtown-towers', 'mowtown-towers3'],
    // Everything else, which is most of it. Tiny Rebel used to double here as
    // well; serving both of the two largest moods made it the most-played track
    // in the score by 44%, at a hundred and fifty-six hours a month against
    // seven for each of the arcade tracks.
    ordinary: ['legends-of-dawn', 'oracle', 'magic', 'silver-clouds'],
  };

  const btn = document.querySelector('#music-btn');
  const chip = document.querySelector('#now-playing');
  const chipTitle = document.querySelector('#now-playing-title');
  const players = [document.querySelector('#score-a'), document.querySelector('#score-b')];
  if (!btn || !players[0] || !players[1]) return { update() {}, duck() {}, undim() {} };

  let titles = new Map();
  // Each mood has a remembered shuffle bag; reopening the book does not replay
  // the same opening song. Only successful playback commits listening history.
  let on = true, current = 0, playing = null, mood = null;
  const rotation = new ScoreRotation({ storage: {
    getItem: key => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
  } });
  let playSequence = 0, acceptedSequence = -1;
  let fadeTimer = null, chipTimer = null, ducked = false;

  // The server knows the real titles, because they are the filenames the author
  // gave the tracks. Asking beats hardcoding a second copy that can drift.
  // Pools are the mood table reconciled against what is actually on disk: a
  // slug with no file is dropped rather than played into silence, and a file no
  // mood names is added to UNCLAIMED_JOIN rather than shipped unheard.
  let pools = { ...MOODS };
  fetch('/api/tracks', { cache: 'no-store' })
    .then(response => (response.ok ? response.json() : null))
    .then(data => {
      const onDisk = new Set();
      for (const track of data?.tracks ?? []) { titles.set(track.slug, track.title); onDisk.add(track.slug); }
      if (!onDisk.size) return;
      const claimed = new Set(Object.values(MOODS).flat());
      const next = {};
      for (const [name, list] of Object.entries(MOODS)) next[name] = list.filter(slug => onDisk.has(slug));
      for (const slug of onDisk) if (!claimed.has(slug)) next[UNCLAIMED_JOIN].push(slug);
      // Top up anything short, from its neighbour first and then from whatever
      // else exists, so nothing ever ends up as a single track on repeat.
      for (const name of Object.keys(next)) {
        const borrow = [...(next[NEIGHBOUR[name]] ?? []), ...onDisk];
        for (const slug of borrow) {
          if (next[name].length >= MIN_TRACKS) break;
          if (!next[name].includes(slug)) next[name].push(slug);
        }
      }
      pools = next;
    })
    .catch(() => {});

  const titleOf = slug => {
    const raw = titles.get(slug) || slug;
    return raw
      .replace(/([a-zA-Z])(\d)/g, '$1 $2')
      .replace(/[-_]/g, ' ')
      .replace(/\b[a-z]/g, letter => letter.toUpperCase());
  };

  // The mood of the moment, from public state only.
  const moodFor = world => scoreMood(world, sceneAtmosphere);

  function showTitle(slug) {
    if (!chip || !chipTitle) return;
    chipTitle.textContent = titleOf(slug);
    chip.hidden = false;
    // Legible for a few seconds, then it recedes to almost nothing rather than
    // vanishing — still there to glance at, never asking to be read.
    chip.classList.add('is-announcing');
    clearTimeout(chipTimer);
    chipTimer = setTimeout(() => chip.classList.remove('is-announcing'), NOW_PLAYING_MS);
  }

  let chosenVolume = atmosphere.scoreVolume();
  const volumeTarget = () => chosenVolume * (ducked ? DUCK_VOLUME / BED_VOLUME : 1);
  function retire(player) {
    player.pause();
    player.removeAttribute('src');
    player.load();
    player.volume = 0;
  }

  function startPlayer(player) {
    const sequence = playSequence;
    const started = player.play();
    if (started && typeof started.then === 'function') started.then(() => {
      if (sequence !== playSequence || player !== players[current] || !playing || acceptedSequence === sequence) return;
      rotation.played(mood, playing, bankFor(mood));
      acceptedSequence = sequence;
    }).catch(() => {});
  }

  // A linear crossfade on two elements. Two things it has to get right, both of
  // which the first cut got wrong: a fade interrupted by another mood change
  // must not leave the older track still playing underneath — with only two
  // elements the incoming one reclaims the slot the outgoing one was using —
  // and the target volume has to be read live, because ducking for a dialogue
  // scene halfway through a fade was being overwritten on the very next tick by
  // a target captured when the fade began.
  function fadeTo(slug) {
    // Finish any fade already running, instantly, before starting another.
    if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; retire(players[current ^ 1]); }
    const next = players[current ^ 1], previous = players[current];
    next.src = `/worldstream/app/audio/${slug}.mp3`;
    next.volume = 0;
    const from = previous.volume, begun = performance.now();
    current ^= 1;
    playing = slug;
    playSequence += 1;
    startPlayer(next);
    fadeTimer = setInterval(() => {
      const ratio = Math.min(1, (performance.now() - begun) / FADE_MS);
      next.volume = volumeTarget() * ratio;
      previous.volume = from * (1 - ratio);
      if (ratio >= 1) {
        clearInterval(fadeTimer);
        fadeTimer = null;
        retire(previous);
        next.volume = volumeTarget();
      }
    }, 50);
    showTitle(slug);
  }

  function stop() {
    clearInterval(fadeTimer);
    fadeTimer = null;
    for (const player of players) retire(player);
    playing = null;
    mood = null;
    if (chip) chip.hidden = true;
  }

  function paint() {
    btn.setAttribute('aria-pressed', String(on));
    btn.classList.toggle('is-on', on);
    btn.textContent = on ? '♪ Score' : '♪ Score off';
    btn.title = on && playing ? `Now playing: ${titleOf(playing)}` : 'Play the score';
  }

  const bankFor = name => (pools[name]?.length ? pools[name] : (pools.ordinary || MOODS.ordinary));
  // Step to the next track of whichever mood is running.
  function advance(name) {
    const bank = bankFor(name);
    const slug = rotation.next(name, bank);
    if (slug) fadeTo(slug);
  }

  // Called on every world render. Changes track only when the mood changes, so
  // a quiet afternoon is not a playlist.
  function update(world) {
    if (!on || document.hidden) return;
    const wanted = world ? moodFor(world) : rotation.lastMood() || moodFor(world);
    if (wanted === mood && playing) return;
    mood = wanted;
    if (playing && bankFor(wanted).includes(playing)) { paint(); return; }
    advance(wanted);
    paint();
  }

  // A mood outlasts its tracks — the small hours run for hours and the two
  // night tracks come to six minutes between them — so the score has to move
  // itself. Ending a track steps to the next one in the same mood; a mood with
  // only one track simply repeats it, which is what `loop` used to do for
  // everything and why nothing ever changed while the world stood still.
  for (const player of players) {
    player.addEventListener('ended', () => {
      if (!on || document.hidden || !mood || player !== players[current]) return;
      if (bankFor(mood).length < 2) { player.currentTime = 0; startPlayer(player); return; }
      advance(mood);
      paint();
    });
  }

  // Under a dialogue scene the bed drops back so the typed lines carry.
  function setDuck(value) {
    ducked = value;
    // Only when no fade is running; a fade reads volumeTarget() itself and will
    // land on the ducked level on its own.
    const active = players[current];
    if (playing && !fadeTimer && !active.paused) active.volume = volumeTarget();
  }
  // What the score believes it is doing, so a check does not have to guess by
  // sniffing which element happens to be unpaused mid-crossfade.
  const state = () => ({ on, mood, playing, fading: Boolean(fadeTimer),
    volume: players[current].volume, element: current });

  btn.addEventListener('click', () => {
    on = !on;
    try { localStorage.setItem(STORE_KEY, on ? 'on' : 'off'); } catch {}
    if (on) update(lastWorld); else stop();
    paint();
  });

  // Start with the score enabled; an intentional mute still survives reload.
  // A rejected autoplay attempt already selected a track, so update() alone
  // would return early. Retry that paused element inside the actual gesture.
  try { on = localStorage.getItem(STORE_KEY) !== 'off'; } catch {}
  paint();
  const resume = () => {
    if (!on || document.hidden) return;
    if (!playing) { update(lastWorld); return; }
    const active = players[current];
    if (active.paused) {
      if (!fadeTimer) active.volume = volumeTarget();
      startPlayer(active);
    }
  };
  document.addEventListener('pointerdown', resume);
  document.addEventListener('click', resume);
  document.addEventListener('keydown', resume);
  update(lastWorld);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(fadeTimer); fadeTimer = null;
      retire(players[current ^ 1]);
      players[current].pause();
    } else if (on) {
      update(lastWorld);
      if (playing && players[current].ended) advance(mood);
      else resume();
    }
  });
  return { update, duck: () => setDuck(true), undim: () => setDuck(false), state,
    setVolume(value) { chosenVolume = Math.max(0, Math.min(1, value)); setDuck(ducked); },
  };
})();

const socialCache = new Map();
let activeDiscussionEvent = null;
let activeAvatar = '👤';

// ---- Memory & Traces drawer ------------------------------------------------
//
// The card carries one line. This is where anybody who cares can see the
// working: what each of them remembers, what they remember together, what the
// rooms still show, and a link back to the event each of it came from.
//
// In a novel continuity is implicit in the author's prose. Here it is something
// the engine preserves and can be asked to justify, which is the part that
// makes it a world stream rather than a story with a schedule.
const memory = (() => {
  const btn = document.querySelector('#memory-btn');
  const drawer = document.querySelector('#memory-drawer');
  const body = document.querySelector('#memory-body');
  const rapportEl = document.querySelector('#memory-rapport');
  const close = document.querySelector('#memory-close');
  if (!btn || !drawer || !body) return { open() {}, close() {} };

  const VIA = { witnessed: 'witnessed it', told: 'was told', public: 'read it', inferred: 'worked it out' };

  function memoryRow(item) {
    const row = node('div', undefined, 'memory-row');
    row.append(node('span', item.summary, 'memory-what'));
    const meta = node('span', undefined, 'memory-meta');
    meta.append(node('span', VIA[item.acquiredVia] ?? item.acquiredVia, 'memory-via'));
    meta.append(node('span', timeLabel(item.at), 'memory-when'));
    if (item.expired) meta.append(node('span', 'past', 'memory-expired'));
    row.append(meta);
    // A link back to the moment, when the moment was public. It always is —
    // a memory of a private event never reaches this drawer at all.
    if (item.sourceEvent) {
      const link = node('a', item.recalls ?? 'see the moment', 'memory-source');
      link.href = `#beat-${cleanEventId(item.sourceEvent)}`;
      link.addEventListener('click', () => closeAllDrawers());
      row.append(link);
    }
    return row;
  }

  function section(title, note) {
    const wrap = node('section', undefined, 'memory-section');
    wrap.append(node('h4', title, 'memory-heading'));
    if (note) wrap.append(node('p', note, 'memory-note'));
    return wrap;
  }

  function render() {
    const narrative = lastWorld?.narrative;
    body.replaceChildren();
    if (!narrative) { body.append(node('p', 'Nothing yet.', 'empty-comments')); return; }

    const rapport = narrative.carrying?.rapport;
    if (rapportEl) {
      rapportEl.textContent = rapport
        ? `${rapport.label} — an interpretation of recent shared events, not a fact about them.` : '';
    }

    for (const [id, name] of [['goaden', 'What Goaden remembers'], ['ashai', 'What Ashai remembers']]) {
      const list = narrative.memories?.[id] ?? [];
      const carrying = narrative.carrying?.[id];
      const wrap = section(name, carrying?.echo ?? null);
      if (!list.length) wrap.append(node('p', 'Nothing recent enough to matter.', 'memory-note'));
      for (const item of list) wrap.append(memoryRow(item));
      body.append(wrap);
    }

    const shared = narrative.memories?.shared ?? [];
    const sharedWrap = section('Between them', shared.length
      ? 'Moments both of them hold.' : 'Nothing they both carry just now.');
    for (const item of shared) sharedWrap.append(memoryRow(item));
    body.append(sharedWrap);

    const places = Object.entries(narrative.tracesByLocation ?? {});
    const traceWrap = section('What the rooms still show', places.length
      ? null : 'Everything has been tidied away.');
    for (const [place, list] of places) {
      const [locationId] = place.split(':');
      for (const trace of list) {
        const row = node('div', undefined, 'memory-row');
        row.append(node('span', trace.text, 'memory-what'));
        const meta = node('span', undefined, 'memory-meta');
        meta.append(node('span', `${trace.room ?? locationName(locationId)}`, 'memory-via'));
        meta.append(node('span', `since ${timeLabel(trace.createdAt)}`, 'memory-when'));
        row.append(meta);
        const link = node('a', 'what left it', 'memory-source');
        link.href = `#beat-${cleanEventId(trace.createdByEventId)}`;
        link.addEventListener('click', () => closeAllDrawers());
        row.append(link);
        traceWrap.append(row);
      }
    }
    body.append(traceWrap);
  }

  function open() {
    render();
    drawer.hidden = false;
    if (elements.drawerBackdrop) elements.drawerBackdrop.hidden = false;
    document.body.classList.add('drawer-open');
  }
  function shut() {
    drawer.hidden = true;
    closeAllDrawers();
  }
  btn.addEventListener('click', () => (drawer.hidden ? open() : shut()));
  close?.addEventListener('click', shut);
  return { open, close: shut, render };
})();

// ---- Traveller Identity ---------------------------------------------------
let travellerProfile = null;

function loadTravellerProfile() {
  try {
    const raw = localStorage.getItem('traveller_profile');
    if (raw) travellerProfile = JSON.parse(raw);
  } catch {}

  if (!travellerProfile) {
    let fateGift = null;
    try {
      const rawFate = localStorage.getItem('fateGift');
      if (rawFate) fateGift = JSON.parse(rawFate);
    } catch {}

    if (fateGift) {
      const weapon = fateGift.weapon?.name || fateGift.weapon || 'Astra';
      const creature = fateGift.creature?.name || fateGift.creature || 'The Silver Born';
      const faction = typeof fateGift.faction === 'string'
        ? (fateGift.faction.charAt(0).toUpperCase() + fateGift.faction.slice(1) + ' Initiate')
        : 'London Observer';

      travellerProfile = {
        name: 'Wayfarer',
        avatar: '🗡️',
        holyItem: weapon,
        guardian: creature,
        title: faction,
        bio: 'Attuned through the Faction Quiz.',
        fromFateGift: true,
      };
    } else {
      travellerProfile = {
        name: 'SilentTraveller',
        avatar: '👤',
        holyItem: 'Pendant of Mist',
        guardian: 'The Silver Born',
        title: 'London Observer',
        bio: 'Walking the quiet edges of London.',
        fromFateGift: false,
      };
    }
  }

  if (!travellerProfile) {
    travellerProfile = {};
  }
  if (!travellerProfile.id) {
    travellerProfile.id = 'traveller_' + Math.random().toString(36).slice(2, 11);
  }
  if (!Array.isArray(travellerProfile.accolades)) {
    travellerProfile.accolades = [];
  }
  saveTravellerProfile();
  activeAvatar = travellerProfile.avatar || '👤';
  updateProfileUI();
}

function saveTravellerProfile() {
  try {
    localStorage.setItem('traveller_profile', JSON.stringify(travellerProfile));
  } catch {}
  updateProfileUI();
}

function updateProfileUI() {
  if (!travellerProfile) return;
  if (!travellerProfile.id) {
    travellerProfile.id = 'traveller_' + Math.random().toString(36).slice(2, 11);
  }
  if (!Array.isArray(travellerProfile.accolades)) {
    travellerProfile.accolades = [];
  }
  if (elements.headerAvatar) elements.headerAvatar.textContent = travellerProfile.avatar || '👤';
  if (elements.headerProfileName) elements.headerProfileName.textContent = travellerProfile.name || 'Traveller';
  if (elements.signatureAvatar) elements.signatureAvatar.textContent = travellerProfile.avatar || '👤';
  if (elements.signatureInfo) {
    elements.signatureInfo.innerHTML = `Posting as <strong>${escapeHtml(travellerProfile.name || 'Traveller')}</strong>`;
  }
  if (elements.signatureFlair) {
    const parts = [];
    if (Array.isArray(travellerProfile.accolades) && travellerProfile.accolades.length > 0) {
      parts.push(`🏆 ${travellerProfile.accolades[travellerProfile.accolades.length - 1]}`);
    }
    if (travellerProfile.holyItem) parts.push(`Holy Item: ${travellerProfile.holyItem}`);
    if (travellerProfile.guardian) parts.push(`Guardian: ${travellerProfile.guardian}`);
    if (travellerProfile.title) parts.push(travellerProfile.title);
    elements.signatureFlair.textContent = parts.join(' • ') || 'Observer';
  }
  const accoladesContainer = document.querySelector('#profile-accolades-list');
  if (accoladesContainer) {
    accoladesContainer.replaceChildren();
    if (Array.isArray(travellerProfile.accolades) && travellerProfile.accolades.length > 0) {
      for (const title of travellerProfile.accolades) {
        accoladesContainer.append(node('span', `🏆 ${title}`, 'profile-accolade-chip'));
      }
    } else {
      accoladesContainer.append(node('span', 'No accolades unlocked yet. Foresee beat outcomes with Prophecy Wagers to earn titles.', 'no-accolades-hint'));
    }
  }
}

function openProfileModal() {
  if (!elements.profileModal) return;
  if (elements.profileNameInput) elements.profileNameInput.value = travellerProfile.name || '';
  if (elements.profileHolyInput) elements.profileHolyInput.value = travellerProfile.holyItem || '';
  if (elements.profileGuardianInput) elements.profileGuardianInput.value = travellerProfile.guardian || '';
  if (elements.profileTitleInput) elements.profileTitleInput.value = travellerProfile.title || '';
  if (elements.profileBioInput) elements.profileBioInput.value = travellerProfile.bio || '';
  if (elements.fateSyncNotice) elements.fateSyncNotice.hidden = !travellerProfile.fromFateGift;

  activeAvatar = travellerProfile.avatar || '👤';
  if (elements.avatarPicker) {
    elements.avatarPicker.querySelectorAll('.avatar-option').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.avatar === activeAvatar);
    });
  }
  elements.profileModal.hidden = false;
}

function closeProfileModal() {
  if (elements.profileModal) elements.profileModal.hidden = true;
}

// ---- Saved Moments (Bookmarks) -------------------------------------------
function getSavedMoments() {
  try {
    const raw = localStorage.getItem('saved_moments');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function isSavedMoment(eventId) {
  return getSavedMoments().some(item => item.eventId === eventId);
}

function toggleSavedMoment(event, btn) {
  let list = getSavedMoments();
  const exists = list.some(item => item.eventId === event.id);
  if (exists) {
    list = list.filter(item => item.eventId !== event.id);
  } else {
    list.push({
      eventId: event.id,
      description: eventDisplayText(event),
      location: locationName(event.location),
      occurredAt: event.occurredAt,
      savedAt: Date.now(),
    });
  }
  try {
    localStorage.setItem('saved_moments', JSON.stringify(list));
  } catch {}
  updateSavedUI();
  if (btn) btn.classList.toggle('is-active', !exists);
  return !exists;
}

function updateSavedUI() {
  const list = getSavedMoments();
  if (elements.savedCount) elements.savedCount.textContent = list.length;
  renderSavedList();
}

function cleanEventId(id) {
  return String(id || '').replace(/:/g, '-');
}

function updateDrawerBackdrop() {
  const anyDrawerOpen = !elements.discussionDrawer?.hidden
    || !elements.savedDrawer?.hidden
    || !elements.cinematicArchiveDrawer?.hidden
    || !elements.dispatchDrawer?.hidden
    || !elements.clocksDrawer?.hidden;
  if (!anyDrawerOpen && elements.drawerBackdrop) {
    elements.drawerBackdrop.hidden = true;
  }
}

function openSavedDrawer() {
  closeDiscussionDrawer();
  closeDispatchDrawer();
  closeClocksDrawer();
  closeProfileModal();
  renderSavedList();
  if (elements.savedDrawer) elements.savedDrawer.hidden = false;
  if (elements.drawerBackdrop) elements.drawerBackdrop.hidden = false;
}

function closeSavedDrawer() {
  if (elements.savedDrawer) elements.savedDrawer.hidden = true;
  updateDrawerBackdrop();
}

function renderSavedList() {
  if (!elements.savedList) return;
  const list = getSavedMoments();
  elements.savedList.replaceChildren();
  if (list.length === 0) {
    elements.savedList.append(node('p', 'No saved beats yet. Click 🔖 on any beat to bookmark it.', 'empty-saved'));
    return;
  }
  for (const item of list.slice().reverse()) {
    const card = node('a', undefined, 'saved-item');
    const cleanId = cleanEventId(item.eventId);
    card.href = `#beat-${cleanId}`;
    const header = node('div', undefined, 'saved-item-header');
    header.append(
      node('span', timeLabel(item.occurredAt)),
      node('span', item.location || 'London')
    );
    const desc = node('p', item.description, 'saved-item-desc');
    card.append(header, desc);
    card.addEventListener('click', (e) => {
      closeAllDrawers();
      if (window.location.hash === `#beat-${cleanId}`) {
        e.preventDefault();
        handleHashRoute({ force: true });
      }
    });
    elements.savedList.append(card);
  }
}

// ---- Accepted Worldstream scenes -----------------------------------------
// This is a public transcript shelf, not a generation surface. Both reads below
// consume already-accepted cache entries and retain the canonical event id used
// by saved moments, reactions and discussion.
function transcriptFor(record) {
  const sceneRecord = record?.scene;
  const list = node('div', undefined, 'cinematic-transcript');
  if (!sceneRecord) return list;
  if (sceneRecord.openingNarration) list.append(node('p', sceneRecord.openingNarration, 'cinematic-narration'));
  for (const beat of sceneRecord.beats ?? []) {
    const line = node('p', undefined, 'cinematic-line');
    line.append(node('strong', `${speakerNames[beat.speaker] || readable(beat.speaker)}: `),
      document.createTextNode(beat.line));
    list.append(line);
  }
  if (sceneRecord.closingNarration) list.append(node('p', sceneRecord.closingNarration, 'cinematic-narration'));
  return list;
}

function playArchivedCinematic(record) {
  closeCinematicArchive();
  const start = () => scene.playCinematic(record, { auto: false });
  if (scene.isOpen()) { scene.close({ drainQueue: false }); queueMicrotask(start); }
  else start();
}

function cinematicArchiveCard(record) {
  const card = node('article', undefined, 'cinematic-archive-card');
  const title = node('h4', cinematicSummary(record) || 'An accepted Worldstream scene');
  const occurredAt = asTime(record.occurredAt);
  const meta = node('p', occurredAt === null ? 'Silver Clouds' : eventFormat.format(occurredAt), 'cinematic-archive-meta');
  const details = node('details', undefined, 'cinematic-transcript-details');
  details.append(node('summary', 'Read full transcript'), transcriptFor(record));
  const actions = node('div', undefined, 'cinematic-archive-actions');
  const watch = node('button', 'Watch scene', 'replay');
  watch.type = 'button';
  watch.addEventListener('click', () => playArchivedCinematic(record));
  const link = node('button', 'Copy scene link', 'replay');
  link.type = 'button';
  link.addEventListener('click', () => {
    const url = `${window.location.origin}${window.location.pathname}#scene=${encodeURIComponent(record.eventId)}`;
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(() => showCopiedFeedback(link)).catch(() => prompt('Scene link:', url));
    else prompt('Scene link:', url);
  });
  actions.append(watch, link);
  const setupSource = record.setup || record.packet?.event?.setup;
  if (setupSource?.originSnippet) {
    const setupDetails = node('details', undefined, 'cinematic-setup-details');
    const label = setupSource.originTimeLabel || 'Earlier';
    setupDetails.append(
      node('summary', `↩ ${label}`, 'cinematic-setup-summary'),
      node('p', setupSource.originSnippet, 'cinematic-setup-snippet')
    );
    card.append(meta, title, setupDetails, details, actions);
  } else {
    card.append(meta, title, details, actions);
  }
  return card;
}

async function loadCinematicArchive() {
  if (!elements.cinematicArchiveBody) return;
  elements.cinematicArchiveBody.replaceChildren(node('p', 'Loading scenes…', 'empty-saved'));
  try {
    const response = await viewerFetch('/api/cinematics/archive', {
      cache: 'no-store', signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error('Archive unavailable');
    const body = await response.json();
    const records = Array.isArray(body?.cinematics) ? body.cinematics : [];
    const dialogue = loadedDialogueScenes([...lastRenderedEvents, ...olderRows.values()], records);
    elements.cinematicArchiveBody.replaceChildren();
    if (!records.length && !dialogue.length) {
      elements.cinematicArchiveBody.append(node('p', 'No archived scenes or dialogue in the passages loaded here yet.', 'empty-saved'));
      return;
    }
    for (const record of records) if (record?.eventId && record?.scene) {
      elements.cinematicArchiveBody.append(cinematicArchiveCard(record));
    }
    if (dialogue.length) elements.cinematicArchiveBody.append(node('h4', 'Dialogue in your loaded passages'));
    for (const event of dialogue) {
      const card = node('article', undefined, 'cinematic-archive-card');
      card.append(node('p', `${timeLabel(event.occurredAt)} · ${locationName(event.location)}`, 'cinematic-archive-meta'),
        node('h4', event.type === 'SCENE_BANK_BEAT' ? event.sceneTitle || 'A scene from Silver Clouds' : event.description));
      const transcript = node('details', undefined, 'cinematic-transcript-details');
      transcript.append(node('summary', 'Read scene and setup'));
      if (event.type === 'SCENE_BANK_BEAT') appendReadingScene(transcript, event,
        { speakerLabel: who => speakerNames[who] || readable(who) });
      else {
        if (event.prose) appendProseParagraphs(transcript, event.prose, 'cinematic-narration');
        transcript.append(exchange(event.lines));
      }
      const watch = node('button', 'Play dialogue scene', 'replay'); watch.type = 'button';
      watch.addEventListener('click', () => { closeCinematicArchive(); scene.play(event); });
      card.append(transcript, watch); elements.cinematicArchiveBody.append(card);
    }
  } catch {
    elements.cinematicArchiveBody.replaceChildren(node('p', 'The scene archive is temporarily unavailable.', 'empty-saved'));
  }
}

function openCinematicArchive() {
  closeDiscussionDrawer();
  closeSavedDrawer();
  closeDispatchDrawer();
  closeClocksDrawer();
  closeProfileModal();
  if (elements.cinematicArchiveDrawer) elements.cinematicArchiveDrawer.hidden = false;
  if (elements.drawerBackdrop) elements.drawerBackdrop.hidden = false;
  loadCinematicArchive();
  elements.cinematicArchiveClose?.focus();
}

function closeCinematicArchive() {
  if (elements.cinematicArchiveDrawer) elements.cinematicArchiveDrawer.hidden = true;
  updateDrawerBackdrop();
}

async function replayCinematicEvent(eventId) {
  if (!eventId) return;
  try {
    const response = await viewerFetch(`/api/cinematics/events/${encodeURIComponent(eventId)}`, {
      cache: 'no-store', signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return;
    const body = await response.json();
    const record = body?.cinematic ?? body;
    if (record?.eventId && record?.scene) playArchivedCinematic(record);
  } catch {}
}

function closeAllDrawers() {
  closeDiscussionDrawer();
  closeSavedDrawer();
  closeCinematicArchive();
  closeDispatchDrawer();
  closeClocksDrawer();
  closeProfileModal();
  if (elements.drawerBackdrop) elements.drawerBackdrop.hidden = true;
}

// ---- Reaction Storage ----------------------------------------------------
function getStoredUserReactions(eventId) {
  try {
    const raw = localStorage.getItem(`event_reactions_${eventId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setStoredUserReaction(eventId, reactionType, selected = true) {
  const current = getStoredUserReactions(eventId);
  if (selected) {
    current[reactionType] = true;
  } else {
    delete current[reactionType];
  }
  try {
    localStorage.setItem(`event_reactions_${eventId}`, JSON.stringify(current));
  } catch {}
}

async function fetchEventSocial(eventId) {
  try {
    const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/social`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    socialCache.set(eventId, data);
    updateEventMetaUI(eventId, data);
    return data;
  } catch {
    return null;
  }
}

function renderDrawerReactions(eventId, data) {
  if (!elements.drawerReactionsBar) return;
  elements.drawerReactionsBar.replaceChildren();
  const reactions = [
    { type: 'love', emoji: '❤️', label: 'Love' },
    { type: 'laugh', emoji: '😂', label: 'Humour' },
    { type: 'wow', emoji: '😮', label: 'Shock' },
    { type: 'eyes', emoji: '👀', label: 'Watching' },
  ];
  const userReactions = getStoredUserReactions(eventId);
  for (const r of reactions) {
    const count = data?.reactions?.[r.type] ?? 0;
    const btn = node('button', `${r.emoji} ${count}`, 'react-btn');
    btn.type = 'button';
    btn.dataset.reaction = r.type;
    btn.title = r.label;
    btn.classList.toggle('is-selected', Boolean(userReactions[r.type]));
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const evt = activeDiscussionEvent || { id: eventId };
      handleReactionClick(evt, r.type, btn);
    });
    elements.drawerReactionsBar.append(btn);
  }
  const total = data?.reactions?.total ?? 0;
  if (total > 0) elements.drawerReactionsBar.append(
    node('span', `World reaction: ${total}`, 'world-reaction-stat')
  );
}

function readerCommentCount(data) {
  if (Number.isSafeInteger(data?.totalComments) && data.totalComments >= 0) return data.totalComments;
  return Array.isArray(data?.comments) ? data.comments.filter(comment => !comment.isWatcher).length : 0;
}

function updateEventMetaUI(eventId, data) {
  const cleanId = cleanEventId(eventId);
  const row = document.getElementById(`beat-${cleanId}`) || document.querySelector(`[data-event-id="${eventId}"]`);
  if (row) {
    const countLabel = row.querySelector('.comment-count-label');
    const comments = readerCommentCount(data);
    if (countLabel) countLabel.textContent = comments > 0
      ? `${comments} comment${comments === 1 ? '' : 's'}` : 'Discuss';

    const reactionLabel = row.querySelector('.reaction-total-label');
    const reactionTotal = data.reactions?.total ?? 0;
    if (reactionLabel) reactionLabel.textContent = reactionTotal;
    const reactionStat = row.querySelector('.world-reaction-stat');
    if (reactionStat) reactionStat.hidden = !(reactionTotal > 0);

    const userReactions = getStoredUserReactions(eventId);
    row.querySelectorAll('.react-btn').forEach(btn => {
      const r = btn.dataset.reaction;
      btn.classList.toggle('is-selected', Boolean(userReactions[r]));
    });
  }

  if (activeDiscussionEvent?.id === eventId) {
    renderDrawerReactions(eventId, data);
  }
}

async function handleReactionClick(event, reactionType, btn) {
  const eventId = event.id;
  const userReactions = getStoredUserReactions(eventId);
  const alreadyReacted = Boolean(userReactions[reactionType]);
  const delta = alreadyReacted ? -1 : 1;

  setStoredUserReaction(eventId, reactionType, !alreadyReacted);

  // Optimistic UI update
  let cached = socialCache.get(eventId);
  if (!cached) {
    cached = {
      eventId,
      reactions: { love: 0, laugh: 0, wow: 0, eyes: 0, total: 0 },
      comments: [],
    };
    socialCache.set(eventId, cached);
  }
  cached.reactions[reactionType] = Math.max(0, (cached.reactions[reactionType] || 0) + delta);
  cached.reactions.total = Math.max(0, (cached.reactions.total || 0) + delta);
  updateEventMetaUI(eventId, cached);

  try {
    const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reaction: reactionType, delta }),
    });
    if (res.ok) {
      const result = await res.json();
      if (result.reactions) {
        cached.reactions = result.reactions;
        socialCache.set(eventId, cached);
        updateEventMetaUI(eventId, cached);
      }
    }
  } catch {}
}

// ---- Off-Canvas Discussion Drawer ----------------------------------------
function openDiscussionDrawer(event) {
  closeSavedDrawer();
  closeDispatchDrawer();
  closeProfileModal();
  activeDiscussionEvent = event;
  if (elements.drawerBeatTitle) {
    elements.drawerBeatTitle.textContent = `${timeLabel(event.occurredAt)} · ${locationName(event.location)}`;
  }
  if (elements.drawerBeatExcerpt) {
    elements.drawerBeatExcerpt.textContent = eventDisplayText(event);
  }

  if (elements.discussionDrawer) elements.discussionDrawer.hidden = false;
  if (elements.drawerBackdrop) elements.drawerBackdrop.hidden = false;

  const cached = socialCache.get(event.id);
  renderDrawerReactions(event.id, cached || { reactions: { total: 0 } });
  if (cached && cached.comments) {
    renderDiscussionComments(cached.comments);
  } else if (elements.drawerComments) {
    elements.drawerComments.innerHTML = '<p class="empty-comments">Loading reflections…</p>';
  }

  const drawerWagerSlot = document.querySelector('#drawer-wager-container');
  if (drawerWagerSlot) {
    drawerWagerSlot.replaceChildren();
    drawerWagerSlot.hidden = true;
    fetchEventWager(event.id).then((wager) => {
      if (activeDiscussionEvent?.id === event.id && wager) {
        drawerWagerSlot.hidden = false;
        renderWagerCard(wager, drawerWagerSlot, event);
      }
    });
  }

  fetchEventSocial(event.id).then(data => {
    if (activeDiscussionEvent?.id === event.id && data) {
      renderDrawerReactions(event.id, data);
      if (data.comments) {
        renderDiscussionComments(data.comments);
      }
    }
  });
}

function closeDiscussionDrawer() {
  activeDiscussionEvent = null;
  if (elements.discussionDrawer) elements.discussionDrawer.hidden = true;
  updateDrawerBackdrop();
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderDiscussionComments(comments) {
  if (!elements.drawerComments) return;
  elements.drawerComments.replaceChildren();
  if (!Array.isArray(comments) || comments.length === 0) {
    elements.drawerComments.append(node('p', 'No reflections yet. Be the first to observe.', 'empty-comments'));
    return;
  }

  for (const c of comments) {
    const card = node('article', undefined, 'comment-card' + (c.isWatcher ? ' is-watcher' : ''));
    const header = node('div', undefined, 'comment-card-header');
    const authorWrap = node('div', undefined, 'comment-author-wrap');
    authorWrap.append(
      node('span', c.authorAvatar || '👤', 'comment-avatar'),
      node('strong', c.authorName || 'Traveller', 'comment-author')
    );
    if (c.isWatcher) {
      authorWrap.append(node('span', '✦ Fictional World Voice', 'comment-watcher-tag'));
    }
    const knownAccolades = ['MI6 Intuitive', 'Sanctuary Oracle', 'Chimewatcher', 'Borough Sleuth'];
    if (c.authorTitle && knownAccolades.some(a => c.authorTitle.includes(a))) {
      const matched = knownAccolades.find(a => c.authorTitle.includes(a));
      authorWrap.append(node('span', `🏆 ${matched}`, 'accolade-badge'));
    }
    const time = node('time', timeLabel(c.createdAt), 'comment-time');
    header.append(authorWrap, time);

    const flairParts = [];
    if (c.authorHolyItem) flairParts.push(`Holy Item: ${c.authorHolyItem}`);
    if (c.authorGuardian) flairParts.push(`Guardian: ${c.authorGuardian}`);
    if (c.authorTitle && !knownAccolades.some(a => c.authorTitle === a)) flairParts.push(c.authorTitle);
    const flair = node('p', flairParts.join(' • ') || 'Observer', 'comment-flair');
    const text = node('p', c.text, 'comment-text');

    card.append(header, flair, text);
    elements.drawerComments.append(card);
  }
  elements.drawerComments.scrollTop = elements.drawerComments.scrollHeight;
}

async function handleCommentSubmit(e) {
  e.preventDefault();
  if (!activeDiscussionEvent || !elements.commentText) return;
  const text = elements.commentText.value.trim();
  if (!text) return;

  if (elements.commentSubmitBtn) elements.commentSubmitBtn.disabled = true;
  const eventId = activeDiscussionEvent.id;

  const displayTitle = (Array.isArray(travellerProfile.accolades) && travellerProfile.accolades.length > 0)
    ? travellerProfile.accolades[travellerProfile.accolades.length - 1]
    : (travellerProfile.title || 'London Observer');

  try {
    const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        traveller: {
          name: travellerProfile.name,
          avatar: travellerProfile.avatar,
          holyItem: travellerProfile.holyItem,
          guardian: travellerProfile.guardian,
          title: displayTitle,
          bio: travellerProfile.bio,
        },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      elements.commentText.value = '';

      // Update cached comments
      const cached = socialCache.get(eventId) || { eventId, comments: [], reactions: { total: 0 } };
      if (data.comment) {
        const previousReaderCount = readerCommentCount(cached);
        cached.comments.push(data.comment);
        cached.totalComments = Number.isSafeInteger(data.totalComments) && data.totalComments >= 0
          ? data.totalComments : previousReaderCount + (data.comment.isWatcher ? 0 : 1);
        socialCache.set(eventId, cached);
        if (activeDiscussionEvent?.id === eventId) {
          renderDiscussionComments(cached.comments);
        }
        updateEventMetaUI(eventId, cached);
      }
    }
  } catch {} finally {
    if (elements.commentSubmitBtn) elements.commentSubmitBtn.disabled = false;
  }
}

// ---- Permalinks & Hash Routing -------------------------------------------
function copyBeatPermalink(event, btn) {
  const cleanId = cleanEventId(event.id);
  const url = `${window.location.origin}${window.location.pathname}#beat-${cleanId}`;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      showCopiedFeedback(btn);
    }).catch(() => {
      prompt('Copy Beat Permalink:', url);
    });
  } else {
    prompt('Copy Beat Permalink:', url);
  }
}

function showCopiedFeedback(btn) {
  const orig = btn.textContent;
  btn.textContent = '✓ Copied';
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = orig;
    btn.disabled = false;
  }, 1600);
}

// ---- High-Stakes Raven Pings (Urgent Courier Notifications) --------------
const seenHighStakesEvents = new Set();
let urgentToastTimer = null;

function isHighStakesEvent(event) {
  if (!event || typeof event !== 'object') return false;
  const type = event.type || '';
  const desc = (event.description || '').toLowerCase();

  const routineTypes = new Set([
    'MEAL_BEGIN', 'MEAL_END', 'PRACTICE_BEGIN', 'PRACTICE_END',
    'REST_BEGIN', 'WAIT_BEGIN', 'QUIET_TIME_BEGIN', 'TV_BEGIN',
    'PIANO_BEGIN', 'MUSIC_LISTEN_BEGIN', 'GAME_BEGIN', 'GAME_PAUSE',
    'GAME_RESUME', 'ACTIVITY_COMPLETE', 'PRACTICE_SLOT_NOTICE',
    'SLEEP_BEGIN', 'SLEEP_END', 'sleeping', 'REST', 'IDLE',
  ]);
  if (routineTypes.has(type)) return false;

  if (
    type === 'ARCANE_SURGE' || type === 'PLAN_BROKEN' ||
    type === 'OUTING_CUT_SHORT' || type === 'STANDBY_BEGIN' ||
    type === 'BRIEFING_BEGIN'
  ) {
    return true;
  }

  if (event.isVeilMilestone) return true;
  if (
    (type === 'INSTITUTION_NOTICE' || type === 'FACTION_STATUS') &&
    (/veil\s+cycle|celestial\s+veil\s+countdown|annual\s+veil\s+festival/i.test(desc) || event.payload?.veilMilestone)
  ) {
    return true;
  }
  if (type === 'ALERT' || (desc.includes('perimeter') && desc.includes('alert'))) return true;

  return false;
}

function formatHighStakesPing(event) {
  if (!event) return '';
  const type = event.type || '';
  const desc = event.description || '';
  if (type === 'ARCANE_SURGE' || /surge/i.test(desc)) {
    return '⚡ URGENT DISPATCH: MEU corridor anomaly flagged along the Thames corridor.';
  }
  if (type === 'PLAN_BROKEN') {
    return '⚡ URGENT DISPATCH: Scheduled night movements broken by emergency duty recall.';
  }
  if (type === 'OUTING_CUT_SHORT') {
    return '⚡ URGENT DISPATCH: Evening borough excursion cut short under operational advisory.';
  }
  if (type === 'STANDBY_BEGIN') {
    return '⚡ URGENT DISPATCH: Heightened readiness order active across Southwark perimeter.';
  }
  if (type === 'BRIEFING_BEGIN') {
    return '⚡ URGENT DISPATCH: MI6 Inner Circle convened for classified situational briefing.';
  }
  return `⚡ URGENT DISPATCH: ${desc}`;
}

function showUrgentToast(event) {
  if (!elements.urgentToast || !elements.urgentToastText) return;
  const msg = formatHighStakesPing(event);
  elements.urgentToastText.textContent = msg.replace(/^⚡\s*/, '');
  elements.urgentToast.hidden = false;

  const cleanId = cleanEventId(event.id);
  if (elements.urgentToastAction) {
    elements.urgentToastAction.onclick = () => {
      dismissUrgentToast();
      window.location.hash = `#beat-${cleanId}`;
      handleHashRoute({ force: true });
    };
  }

  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Silver Clouds — Urgent Dispatch', {
        body: msg,
        icon: '/worldstream/app/scene/goaden-icon.png',
      });
    }
  } catch {}

  clearTimeout(urgentToastTimer);
  urgentToastTimer = setTimeout(dismissUrgentToast, 8500);
}

function dismissUrgentToast() {
  if (elements.urgentToast) elements.urgentToast.hidden = true;
}

// ---- The London Plot Clocks ----------------------------------------------
let latestClocks = [];

function getAttunedClocks() {
  try {
    const raw = localStorage.getItem('attuned_clocks');
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function toggleAttunedClock(clockId, btn) {
  const set = getAttunedClocks();
  const exists = set.has(clockId);
  if (exists) {
    set.delete(clockId);
  } else {
    set.add(clockId);
  }
  try {
    localStorage.setItem('attuned_clocks', JSON.stringify([...set]));
  } catch {}
  if (btn) {
    btn.classList.toggle('is-active', !exists);
    btn.textContent = !exists ? '✓ Attuned' : '🔔 Attune';
    btn.title = !exists ? 'Attuned to this Plot Clock' : 'Attune to receive advance alerts';
  }
  return !exists;
}

function createClockDialSvg(clock) {
  const size = 104;
  const strokeWidth = 8;
  const radius = 40;
  const circumference = 2 * Math.PI * radius; // ~251.327
  const total = clock.totalSegments || 4;
  const current = Math.min(total, Math.max(0, clock.currentSegment || 1));
  const color = clock.color || '#38bdf8';

  const gapPx = 4;
  const segmentArc = (circumference - total * gapPx) / total;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('class', 'clock-dial-svg');

  const center = size / 2;

  // Background track segments
  for (let i = 0; i < total; i++) {
    const offset = -(i * (segmentArc + gapPx));
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', center);
    circle.setAttribute('cy', center);
    circle.setAttribute('r', radius);
    circle.setAttribute('class', 'clock-dial-track');
    circle.setAttribute('stroke-width', strokeWidth);
    circle.setAttribute('stroke-dasharray', `${segmentArc} ${circumference - segmentArc}`);
    circle.setAttribute('stroke-dashoffset', offset);
    svg.appendChild(circle);
  }

  // Filled active segments
  for (let i = 0; i < current; i++) {
    const offset = -(i * (segmentArc + gapPx));
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', center);
    circle.setAttribute('cy', center);
    circle.setAttribute('r', radius);
    circle.setAttribute('class', 'clock-dial-fill');
    circle.setAttribute('stroke', color);
    circle.setAttribute('stroke-width', strokeWidth + 1);
    circle.setAttribute('stroke-dasharray', `${segmentArc} ${circumference - segmentArc}`);
    circle.setAttribute('stroke-dashoffset', offset);
    if (i === current - 1) {
      circle.style.filter = `drop-shadow(0 0 5px ${color})`;
    }
    svg.appendChild(circle);
  }

  const wrap = node('div', undefined, 'clock-dial-wrap');
  wrap.appendChild(svg);

  const centerText = node('div', undefined, 'clock-dial-center-text');
  const fraction = node('span', `${current}/${total}`, 'clock-dial-fraction');
  const pct = Math.round((current / total) * 100);
  const percent = node('span', `${pct}%`, 'clock-dial-percent');
  centerText.append(fraction, percent);
  wrap.appendChild(centerText);

  return wrap;
}

function renderClocksUI(clocks) {
  if (!elements.clocksBody) return;
  elements.clocksBody.replaceChildren();

  if (!Array.isArray(clocks) || clocks.length === 0) {
    elements.clocksBody.append(node('p', 'No active Plot Clocks in London at this hour.', 'empty-clocks'));
    return;
  }

  const attuned = getAttunedClocks();

  for (const clock of clocks) {
    const card = node('article', undefined, 'clock-card' + (attuned.has(clock.id) ? ' is-attuned' : ''));
    card.id = `clock-card-${clock.id}`;

    // Header
    const header = node('div', undefined, 'clock-card-header');
    const metaWrap = node('div', undefined, 'clock-meta-wrap');
    const domain = node('span', clock.domain || 'London', 'clock-domain-badge');
    const nameRow = node('div', undefined, 'clock-name-row');
    const icon = node('span', clock.icon || '⏱️', 'clock-icon');
    const name = node('h4', clock.name, 'clock-name');
    nameRow.append(icon, name);
    metaWrap.append(domain, nameRow);

    const attuneBtn = node('button', attuned.has(clock.id) ? '✓ Attuned' : '🔔 Attune', 'attune-btn');
    attuneBtn.type = 'button';
    if (attuned.has(clock.id)) attuneBtn.classList.add('is-active');
    attuneBtn.title = attuned.has(clock.id) ? 'Attuned to this Plot Clock' : 'Attune to receive advance alerts';
    attuneBtn.addEventListener('click', () => {
      const isNowAttuned = toggleAttunedClock(clock.id, attuneBtn);
      card.classList.toggle('is-attuned', isNowAttuned);
    });

    header.append(metaWrap, attuneBtn);
    card.append(header);

    // Layout row with Dial & Current Milestone
    const layoutRow = node('div', undefined, 'clock-layout-row');
    const dial = createClockDialSvg(clock);
    const infoWrap = node('div', undefined, 'clock-info-wrap');

    const desc = node('p', clock.currentDetail, 'clock-desc');
    const milestone = node('div', undefined, 'clock-current-milestone');
    milestone.style.borderLeftColor = clock.color || '#38bdf8';
    milestone.innerHTML = `<strong>Stage ${clock.currentSegment} of ${clock.totalSegments}:</strong> ${escapeHtml(clock.currentTitle)}`;
    infoWrap.append(desc, milestone);
    layoutRow.append(dial, infoWrap);
    card.append(layoutRow);

    // Stepper
    if (Array.isArray(clock.allSegments)) {
      const stepper = node('div', undefined, 'clock-stepper');
      for (const seg of clock.allSegments) {
        const isComp = seg.index < clock.currentSegment;
        const isCurr = seg.index === clock.currentSegment;
        const stepItem = node('div', undefined, 'clock-step-item' + (isComp ? ' is-completed' : (isCurr ? ' is-current' : '')));
        const num = node('span', isComp ? '✓' : String(seg.index), 'clock-step-num');
        const text = node('span', `${seg.title} — ${seg.detail}`);
        stepItem.append(num, text);
        stepper.append(stepItem);
      }
      card.append(stepper);
    }

    elements.clocksBody.append(card);
  }
}

async function openClocksDrawer(focusClockId = null) {
  closeDiscussionDrawer();
  closeSavedDrawer();
  closeDispatchDrawer();
  closeProfileModal();

  if (elements.clocksDrawer) elements.clocksDrawer.hidden = false;
  if (elements.drawerBackdrop) elements.drawerBackdrop.hidden = false;

  if (latestClocks.length > 0) {
    renderClocksUI(latestClocks);
  } else {
    try {
      const res = await fetch('/api/clocks', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.clocks)) {
          latestClocks = data.clocks;
          renderClocksUI(latestClocks);
        }
      }
    } catch {}
  }

  if (focusClockId) {
    setTimeout(() => {
      const el = document.querySelector(`#clock-card-${focusClockId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  }
}

function closeClocksDrawer() {
  if (elements.clocksDrawer) elements.clocksDrawer.hidden = true;
  updateDrawerBackdrop();
}

// ---- The Morning Borough Dispatch (Daily Broadsheet Ritual) ---------------
let currentDispatch = null;

async function openDispatchDrawer(targetDate = null) {
  closeDiscussionDrawer();
  closeSavedDrawer();
  closeClocksDrawer();
  closeProfileModal();

  if (elements.dispatchDrawer) elements.dispatchDrawer.hidden = false;
  if (elements.drawerBackdrop) elements.drawerBackdrop.hidden = false;

  const endpoint = (targetDate && targetDate !== 'latest')
    ? `/api/dispatch/${encodeURIComponent(targetDate)}`
    : '/api/dispatch/latest';

  try {
    if (elements.dispatchBody) {
      elements.dispatchBody.innerHTML = '<p class="empty-dispatch">Consulting the morning presses…</p>';
    }
    const res = await fetch(endpoint, { cache: 'no-store' });
    if (!res.ok) throw new Error('Dispatch unavailable');
    const dispatch = await res.json();
    currentDispatch = dispatch;
    renderBroadsheetUI(dispatch);
  } catch {
    if (elements.dispatchBody) {
      elements.dispatchBody.innerHTML = '<p class="empty-dispatch">The morning broadsheet is temporarily delayed. Please try again shortly.</p>';
    }
  }
}

function closeDispatchDrawer() {
  if (elements.dispatchDrawer) elements.dispatchDrawer.hidden = true;
  updateDrawerBackdrop();
}

function renderBroadsheetUI(dispatch) {
  if (!elements.dispatchBody || !dispatch) return;
  elements.dispatchBody.replaceChildren();

  const card = node('article', undefined, 'broadsheet-card');

  // Masthead
  const masthead = node('header', undefined, 'broadsheet-masthead');
  const pubName = node('h2', dispatch.masthead.publication, 'broadsheet-pub-name');
  const subTitle = node('p', dispatch.masthead.subtitle, 'broadsheet-sub-title');
  const folioBar = node('div', undefined, 'broadsheet-folio-bar');
  const issueText = `${dispatch.issueNumber} • ${dispatch.formattedDate}`;
  const weatherText = `${dispatch.masthead.weather.description}, ${dispatch.masthead.weather.temperatureC}°C`;
  folioBar.append(
    node('span', issueText),
    node('span', dispatch.masthead.dayPhase),
    node('span', weatherText)
  );
  masthead.append(pubName, subTitle, folioBar);
  card.append(masthead);

  // Lead Headline & Story
  const leadSec = node('section', undefined, 'broadsheet-lead-section');
  const leadBadge = node('span', 'LEAD DISPATCH', 'broadsheet-lead-badge');
  const leadHead = node('h3', dispatch.leadHeadline, 'broadsheet-lead-headline');
  const leadBrief = node('p', dispatch.chronicleBriefs?.[0]?.text || 'Civic order holds steady across the Thames basin.', 'broadsheet-lead-brief');
  leadSec.append(leadBadge, leadHead, leadBrief);
  card.append(leadSec);

  // Chronicle Briefs
  const briefsSec = node('section', undefined, 'broadsheet-briefs-section');
  briefsSec.append(node('h4', 'Chronicle Briefs', 'broadsheet-section-title'));
  const briefsList = node('div', undefined, 'broadsheet-briefs-list');

  for (const brief of dispatch.chronicleBriefs || []) {
    const item = node('div', undefined, 'broadsheet-brief-item');
    const meta = node('div', undefined, 'broadsheet-brief-meta');
    const timeSpan = node('span', `${brief.time} • ${brief.location}`, 'broadsheet-brief-time');
    const tierSpan = node('span', brief.salienceTier, `broadsheet-brief-tier is-${brief.salienceTier}`);
    meta.append(timeSpan, tierSpan);

    const head = node('h5', brief.headline, 'broadsheet-brief-headline');
    const text = node('p', brief.text, 'broadsheet-brief-text');
    item.append(meta, head, text);

    if (brief.eventId && brief.eventId !== 'civic-calm') {
      const cleanId = cleanEventId(brief.eventId);
      const inspectBtn = node('button', 'Inspect Beat 🔗', 'meta-btn');
      inspectBtn.type = 'button';
      inspectBtn.style.marginTop = '4px';
      inspectBtn.style.alignSelf = 'flex-start';
      inspectBtn.onclick = () => {
        closeDispatchDrawer();
        window.location.hash = `#beat-${cleanId}`;
        handleHashRoute({ force: true });
      };
      item.append(inspectBtn);
    }
    briefsList.append(item);
  }
  briefsSec.append(briefsList);
  card.append(briefsSec);

  // Faction Roundup
  const factionsSec = node('section', undefined, 'broadsheet-factions-section');
  factionsSec.append(node('h4', 'Across the Boroughs (Faction Status)', 'broadsheet-section-title'));
  const factionGrid = node('div', undefined, 'broadsheet-faction-grid');

  for (const f of Object.values(dispatch.factionRoundup || {})) {
    const fCard = node('div', undefined, 'broadsheet-faction-card' + (f.tone === 'alert' ? ' is-alert' : ''));
    const fHeader = node('div', undefined, 'broadsheet-faction-header');
    fHeader.append(node('span', f.name, 'broadsheet-faction-name'));
    const fStatus = node('p', f.status, 'broadsheet-faction-status');
    fCard.append(fHeader, fStatus);
    // The official line, and then what the paper actually thinks of it.
    if (f.note) fCard.append(node('p', f.note, 'broadsheet-faction-note'));
    factionGrid.append(fCard);
  }
  factionsSec.append(factionGrid);
  card.append(factionsSec);

  // Notices — the only column anybody reads.
  if (Array.isArray(dispatch.notices) && dispatch.notices.length) {
    const noticesSec = node('section', undefined, 'broadsheet-notices-section');
    noticesSec.append(node('h4', 'Notices, Corrections & Lost Property', 'broadsheet-section-title'));
    const list = node('ul', undefined, 'broadsheet-notices-list');
    for (const notice of dispatch.notices) list.append(node('li', notice, 'broadsheet-notice'));
    noticesSec.append(list);
    card.append(noticesSec);
  }

  // The London Plot Clocks
  if (Array.isArray(dispatch.plotClocks) && dispatch.plotClocks.length > 0) {
    const clocksSec = node('section', undefined, 'broadsheet-clocks-section');
    clocksSec.append(node('h4', 'The London Plot Clocks (Active Timelines)', 'broadsheet-section-title'));
    const clocksList = node('div', undefined, 'broadsheet-briefs-list');
    for (const clock of dispatch.plotClocks) {
      const item = node('div', undefined, 'broadsheet-brief-item');
      const meta = node('div', undefined, 'broadsheet-brief-meta');
      const timeSpan = node('span', `${clock.domain} • ${clock.currentSegment}/${clock.totalSegments} Segments`);
      const tierSpan = node('span', clock.status, `broadsheet-brief-tier is-${clock.status === 'imminent' || clock.status === 'climax' ? 'critical' : 'civic'}`);
      meta.append(timeSpan, tierSpan);

      const head = node('h5', `${clock.icon} ${clock.name}: ${clock.currentTitle}`, 'broadsheet-brief-headline');
      const text = node('p', clock.currentDetail, 'broadsheet-brief-text');
      item.append(meta, head, text);

      const inspectClockBtn = node('button', 'Inspect Clock ⏱️', 'meta-btn');
      inspectClockBtn.type = 'button';
      inspectClockBtn.style.marginTop = '4px';
      inspectClockBtn.style.alignSelf = 'flex-start';
      inspectClockBtn.onclick = () => {
        closeDispatchDrawer();
        openClocksDrawer(clock.id);
      };
      item.append(inspectClockBtn);

      clocksList.append(item);
    }
    clocksSec.append(clocksList);
    card.append(clocksSec);
  }

  // Lintel Flock Observation
  const lintelSec = node('section', undefined, 'broadsheet-lintel-section');
  const lintelBox = node('div', undefined, 'broadsheet-lintel-box');
  const lIcon = node('span', '🕊️', 'broadsheet-lintel-icon');
  const lBody = node('div', undefined, 'broadsheet-lintel-body');
  lBody.append(
    node('span', `Lintel Flock Observation • ${dispatch.lintelFlock.count} Familiar(s) Overhead (${dispatch.lintelFlock.reading})`, 'broadsheet-lintel-title'),
    node('p', dispatch.lintelFlock.observation, 'broadsheet-lintel-obs')
  );
  lintelBox.append(lIcon, lBody);
  lintelSec.append(lintelBox);
  card.append(lintelSec);

  elements.dispatchBody.append(card);
}

function copyDispatchSummary(btn) {
  if (!currentDispatch) return;
  let summary = currentDispatch.plainTextSummary || `${currentDispatch.leadHeadline}\n${window.location.href}`;
  if (window.location.origin && summary.includes('http://127.0.0.1:4317')) {
    summary = summary.replaceAll('http://127.0.0.1:4317', window.location.origin);
  }
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(summary).then(() => {
      showCopiedFeedback(btn);
    }).catch(() => {
      prompt('Share Broadsheet Dispatch:', summary);
    });
  } else {
    prompt('Share Broadsheet Dispatch:', summary);
  }
}

// ---- Presence Updates ----------------------------------------------------
let presenceInFlight = null;
async function updatePresence() {
  if (document.visibilityState !== 'visible') return;
  // Startup, focus and visibility can overlap before the first token arrives.
  // Share that handshake so one tab cannot register as several readers.
  if (presenceInFlight) return presenceInFlight;
  presenceInFlight = (async () => {
    try {
      const res = await viewerFetch('/api/presence/ping', {
        method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: viewerSessionId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.viewerToken === 'string' && data.viewerToken) {
          viewerToken = data.viewerToken;
          try { sessionStorage.setItem(VIEWER_TOKEN_KEY, viewerToken); } catch {}
          // A tab can leave while its first heartbeat is still in flight.
          // Retire the newly issued token as well as any previous one.
          if (document.visibilityState !== 'visible') leaveWatching();
        }
      }
    } catch {}
  })().finally(() => { presenceInFlight = null; });
  return presenceInFlight;
}

// Every viewer polls the same cache. The server's event-specific lock means
// twenty open pages can receive a scene while only one model call is made.
const CINEMATIC_CURSOR_KEY = 'silver-clouds-cinematic-cursor';
const CINEMATIC_PENDING_KEY = 'silver-clouds-cinematic-pending';
let cinematicCursor = (() => {
  try {
    const stored = Number(sessionStorage.getItem(CINEMATIC_CURSOR_KEY));
    return Number.isSafeInteger(stored) && stored > 0 ? stored : null;
  } catch { return null; }
})();
const cinematicInbox = new CinematicInbox();
try {
  const pending = JSON.parse(sessionStorage.getItem(CINEMATIC_PENDING_KEY) || '[]');
  if (Array.isArray(pending)) for (const item of pending) cinematicInbox.enqueue(item);
} catch {}
let cinematicPolling = false;

function persistCinematicState() {
  try {
    if (cinematicCursor !== null) sessionStorage.setItem(CINEMATIC_CURSOR_KEY, String(cinematicCursor));
    sessionStorage.setItem(CINEMATIC_PENDING_KEY, JSON.stringify(cinematicInbox.items));
  } catch {}
}

// A remembered opt-out also consumes pending records restored from this tab.
if (!scene.autoScenesEnabled()) {
  cinematicInbox.discard();
  persistCinematicState();
}

function drainCinematicQueue() {
  if (!scene.autoScenesEnabled()) {
    cinematicInbox.discard();
    persistCinematicState();
    return;
  }
  if (document.visibilityState !== 'visible') return;
  if (scene.isOpen()) return;
  const item = cinematicInbox.take();
  persistCinematicState();
  if (!item) return;
  if (!scene.playCinematic(item, { auto: true })) queueMicrotask(drainCinematicQueue);
}

async function liveCinematicAfter(after) {
  const response = await viewerFetch(`/api/cinematics/live?after=${after}`, {
    cache: 'no-store', signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  return response.json();
}

async function pollCinematic() {
  if (cinematicPolling || document.visibilityState !== 'visible') return;
  cinematicPolling = true;
  // A request begun while automatic scenes are off acknowledges its result
  // even if the reader re-enables them before the response arrives.
  const queueThisPoll = scene.autoScenesEnabled();
  const queuePolicyVersion = scene.autoScenesVersion();
  try {
    // A fresh tab drains the short live window and stages only its newest scene.
    // Its initial cursor therefore comes from serverTime, never the browser clock.
    const joining = cinematicCursor === null;
    let after = cinematicCursor ?? 0;
    let newest = null;
    let serverTime = null;
    for (let reads = 0; reads < (joining ? 32 : 1); reads += 1) {
      const body = await liveCinematicAfter(after);
      if (!body) return;
      if (Number.isSafeInteger(body.serverTime)) serverTime = body.serverTime;
      const item = body.cinematic;
      if (!item || !Number.isSafeInteger(item.acceptedAt)) break;
      newest = item;
      after = nextServerCursor(after, { acceptedAt: item.acceptedAt, serverTime });
      if (!joining) break;
    }
    if (joining) {
      cinematicCursor = newest ? after : nextServerCursor(0, { serverTime });
      if (newest) cinematicInbox.enqueue(newest, { queue: queueThisPoll && scene.autoScenesEnabled()
        && queuePolicyVersion === scene.autoScenesVersion() });
    } else if (newest) {
      cinematicCursor = nextServerCursor(cinematicCursor, {
        acceptedAt: newest.acceptedAt, serverTime,
      });
      cinematicInbox.enqueue(newest, { queue: queueThisPoll && scene.autoScenesEnabled()
        && queuePolicyVersion === scene.autoScenesVersion() });
    } else if (Number.isSafeInteger(serverTime) && cinematicCursor > serverTime) {
      // Repair legacy cursors that were seeded from a fast client clock.
      cinematicCursor = serverTime;
    }
    persistCinematicState();
    drainCinematicQueue();
  } catch {}
  finally { cinematicPolling = false; }
}

// The hash a route has already been acted on for. A permalink stays in the
// address bar after you follow it, and this function runs at the end of every
// world render — so without this guard, one visit to a beat permalink reopened
// the discussion drawer over the top of the page every single minute, wherever
// the reader had scrolled to since. Navigation should happen when you navigate,
// not on a timer.
let handledRoute = null;
function handleHashRoute({ force = false } = {}) {
  const hash = window.location.hash;
  if (!hash) { handledRoute = null; return; }
  if (!force && hash === handledRoute) return;
  handledRoute = hash;

  // 0. Scene routing: #scene=evt:... or #scene-evt:...
  if (hash.startsWith('#scene=') || hash.startsWith('#scene-')) {
    const sceneId = decodeURIComponent(hash.replace(/^#scene[=-]/, ''));
    replayCinematicEvent(sceneId);
    return;
  }

  // 1. Broadsheet Dispatch routing: #dispatch, #dispatch-latest, #dispatch-YYYY-MM-DD
  if (hash === '#dispatch' || hash === '#dispatch-latest') {
    openDispatchDrawer('latest');
    return;
  }
  if (hash.startsWith('#dispatch-')) {
    const dateStr = hash.replace('#dispatch-', '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      openDispatchDrawer(dateStr);
      return;
    }
  }

  // 2. Beat routing. Two different intents, deliberately two different links:
  //    #beat-evt-...    go and look at it
  //    #discuss-evt-... go and look at it, and open the discussion
  // Conflating them meant every permalink — every bookmark, every copied link,
  // every "inspect" — forced a modal drawer open on arrival, which is not what
  // "take me to this moment" should do.
  if (hash.startsWith('#beat-') || hash.startsWith('#discuss-')) {
    const wantsDiscussion = hash.startsWith('#discuss-');
    const rawSuffix = hash.slice(wantsDiscussion ? 9 : 6);
    const cleanSuffix = cleanEventId(rawSuffix);
    let el = document.getElementById(`beat-${cleanSuffix}`)
      || document.getElementById(hash.slice(1))
      || document.querySelector(`[data-event-id="${rawSuffix}"]`);
    if (!el && Array.isArray(lastRenderedEvents)) {
      const matched = lastRenderedEvents.find((e) => cleanEventId(e.id) === cleanSuffix || e.id === rawSuffix);
      if (matched) {
        el = document.getElementById(`beat-${cleanEventId(matched.id)}`)
          || document.querySelector(`[data-event-id="${matched.id}"]`);
      }
    }
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.remove('is-highlighted');
        void el.offsetWidth;
        el.classList.add('is-highlighted');
      }, 60);

      if (wantsDiscussion) {
        const eventId = el.dataset.eventId;
        if (eventId && lastRenderedEvents.length) {
          const evt = lastRenderedEvents.find((e) => e.id === eventId || cleanEventId(e.id) === cleanEventId(eventId));
          if (evt) openDiscussionDrawer(evt);
        }
      }
    }
  }

  // 3. Plot Clocks routing: #clocks, #clock-:id
  if (hash === '#clocks') {
    openClocksDrawer();
    return;
  }
  if (hash.startsWith('#clock-')) {
    const clockId = hash.replace('#clock-', '');
    openClocksDrawer(clockId);
    return;
  }
}

// ---- Prophecy Wagers & Daily Highlights ----------------------------------
const wagerCache = new Map();
let currentHighlight = null;

async function fetchTodayHighlight() {
  try {
    const res = await fetch('/api/highlights/today', { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (res.ok) {
      currentHighlight = await res.json();
    }
  } catch {}
}

async function fetchEventWager(eventId) {
  if (wagerCache.has(eventId)) return wagerCache.get(eventId);
  try {
    const tId = travellerProfile?.id || '';
    const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/wager?travellerId=${encodeURIComponent(tId)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.wager) {
      wagerCache.set(eventId, data.wager);
      return data.wager;
    }
    return null;
  } catch {
    return null;
  }
}

function updateCountdownElement(el, closesAt) {
  const remaining = Number(closesAt) - (Date.now() + serverClockOffset);
  if (remaining <= 0) {
    el.textContent = 'Voting Closed';
    el.classList.add('is-closed');
  } else {
    const totalSecs = Math.floor(remaining / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    el.textContent = `⏳ Closes in ${mins}m ${String(secs).padStart(2, '0')}s`;
    el.classList.remove('is-closed');
  }
}

function updateAllWagerCountdowns() {
  document.querySelectorAll('.wager-countdown').forEach((el) => {
    const closesAt = el.dataset.closesAt;
    if (closesAt) updateCountdownElement(el, closesAt);
  });
}

function renderWagerCard(wager, container, event) {
  if (!wager || !container) return;
  container.replaceChildren();

  const card = node('div', undefined, 'prophecy-wager-card');
  card.id = `wager-${wager.id}`;

  const header = node('div', undefined, 'wager-header');
  const tag = node('span', '🔮 Prophecy Wager', 'wager-tag');
  const accolade = node('span', `🏆 ${wager.accoladeTitle}`, 'wager-accolade-preview');

  const countdown = node('span', '', 'wager-countdown');
  countdown.dataset.closesAt = wager.closesAt;
  updateCountdownElement(countdown, wager.closesAt);

  header.append(tag, accolade, countdown);

  const question = node('p', wager.question, 'wager-question');
  const optionsList = node('div', undefined, 'wager-options-list');

  const isClosed = wager.status === 'closed' || wager.status === 'resolved' || (Number(wager.closesAt) <= (Date.now() + serverClockOffset));

  for (const opt of wager.options || []) {
    const btn = node('button', undefined, 'wager-option');
    btn.type = 'button';
    btn.dataset.optionId = opt.id;

    if (wager.userVote === opt.id) {
      btn.classList.add('is-selected');
    }
    if (wager.status === 'resolved' && wager.winningOptionId === opt.id) {
      btn.classList.add('is-winner');
    }

    if (isClosed) {
      btn.disabled = true;
    }

    const bar = node('div', undefined, 'wager-option-bar');
    bar.style.width = `${opt.percent || 0}%`;

    const labelWrap = node('span', undefined, 'wager-option-label');
    labelWrap.append(document.createTextNode(opt.text));
    if (wager.userVote === opt.id) {
      labelWrap.append(node('span', '✓ Your Prediction', 'wager-user-tag'));
    }

    const stat = node('span', `${opt.percent || 0}%`, 'wager-option-stat');

    btn.append(bar, labelWrap, stat);

    if (!isClosed) {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await submitWagerVote(wager.eventId, wager.id, opt.id, container, event);
      });
    }

    optionsList.append(btn);
  }

  card.append(header, question, optionsList);

  if (wager.status === 'resolved') {
    if (wager.userWon) {
      const banner = node('div', undefined, 'accolade-unlock-banner');
      banner.innerHTML = `🎉 <strong>Prophecy Fulfilled!</strong> You unlocked the 🏆 <strong>${escapeHtml(wager.accoladeTitle)}</strong> Accolade!`;
      card.append(banner);

      if (travellerProfile && Array.isArray(travellerProfile.accolades)) {
        if (!travellerProfile.accolades.includes(wager.accoladeTitle)) {
          travellerProfile.accolades.push(wager.accoladeTitle);
          saveTravellerProfile();
        }
      }
    } else {
      const winnerOpt = wager.options?.find((o) => o.id === wager.winningOptionId);
      const banner = node('div', undefined, 'accolade-unlock-banner');
      banner.style.background = 'rgba(234, 179, 8, .12)';
      banner.style.borderColor = 'rgba(234, 179, 8, .3)';
      banner.innerHTML = `★ <strong>Resolved:</strong> ${escapeHtml(winnerOpt?.text || 'Prediction window resolved')}`;
      card.append(banner);
    }
  }

  container.append(card);
}

async function submitWagerVote(eventId, wagerId, optionId, container, event) {
  try {
    const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/wager/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        travellerId: travellerProfile?.id || 'traveller_anon',
        optionId,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.wager) {
        wagerCache.set(eventId, data.wager);
        renderWagerCard(data.wager, container, event);
        const cleanId = cleanEventId(eventId);
        const listSlot = document.querySelector(`#beat-${cleanId} .event-wager-slot`);
        if (listSlot && listSlot !== container) {
          renderWagerCard(data.wager, listSlot, event);
        }
        const drawerWagerSlot = document.querySelector('#drawer-wager-container');
        if (drawerWagerSlot && drawerWagerSlot !== container && activeDiscussionEvent?.id === eventId) {
          renderWagerCard(data.wager, drawerWagerSlot, event);
        }
      }
    }
  } catch {}
}

// ---- Event Row with Discreet Meta-Bar ------------------------------------
function eventRow(event) {
  const row = node('li', undefined, 'event');
  const cleanId = cleanEventId(event.id);
  row.id = `beat-${cleanId}`;
  row.dataset.eventId = event.id;
  row.dataset.readingAnchor = event.id;

  const when = node('time', timeLabel(event.occurredAt));
  const timestamp = asTime(event.occurredAt);
  if (timestamp !== null) when.dateTime = new Date(timestamp).toISOString();

  const detail = node('div');
  row.dataset.narrativeWeight = String(event.readerWeight ?? narrativeWeight(event));
  row.dataset.readerContext = String(Boolean(event.readerContext));
  row.dataset.readerSceneStart = String(Boolean(event.readerSceneStart));
  row.dataset.readerSceneEnd = String(event.readerSceneEnd !== false);
  if (event.readerSceneId) row.dataset.readerScene = event.readerSceneId;
  if (event.readerChapter) detail.append(node('h3', event.readerChapter.label, 'reader-chapter'));
  if (event.readerContext) detail.append(node('p', event.readerContext, 'reader-context'));
  if (currentHighlight && currentHighlight.eventId === event.id) {
    detail.append(node('span', '🔥 Most discussed today', 'highlight-chip'));
  }
  const advancedClock = latestClocks.find((c) => c.lastAdvancedEventId === event.id);
  if (advancedClock) {
    const chip = node('button', `⏱️ ${advancedClock.name} (${advancedClock.currentSegment}/${advancedClock.totalSegments})`, 'clock-advance-chip');
    chip.type = 'button';
    chip.title = `Advanced: ${advancedClock.currentTitle} — tap to inspect Plot Clock`;
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      openClocksDrawer(advancedClock.id);
    });
    detail.append(chip);
  }
  const acceptedCinematic = cinematicRecordForEvent(event);
  const acceptedSummary = cinematicSummary(acceptedCinematic);
  const isReading = typeof document !== 'undefined' && document?.body?.dataset?.reading === 'true';
  const performedScene = acceptedCinematic?.scene;
  const addProseParagraphs = (container, text, className = 'event-prose') => {
    if (typeof text !== 'string' || !text.trim()) return;
    const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    for (const p of paragraphs) {
      container.append(node('p', p, className));
    }
  };

  if (isReading || event.type === 'SCENE_BANK_BEAT') {
    row.classList.add('is-prose');
    if (performedScene) row.classList.add('has-cinematic');
    if (performedScene?.beats?.length || event.lines?.length || event.sceneBeats?.length) row.classList.add('has-exchange');
    appendReadingScene(detail, event, { scene: performedScene,
      speakerLabel: who => speakerNames[who] || readable(who) });
  } else {
    // In default dashboard/overview mode: show summary card with game badge and machine record
    if (acceptedSummary) {
      row.classList.add('is-prose', 'has-cinematic');
      detail.append(node('span', 'WORLDSTREAM SCENE', 'cinematic-chip'));
      const passage = eventDisplayText(event);
      detail.append(node('p', passage, 'event-prose cinematic-summary'));
      if (event.description !== passage) detail.append(node('p', event.description, 'event-canonical'));
    } else if (event.register === 'prose' && event.prose) {
      row.classList.add('is-prose');
      addProseParagraphs(detail, event.prose, 'event-prose');
      // The canonical line only earns its place when it says something the
      // passage did not. An arc beat sets `prose` and publishes the same
      // sentence as its description, so without this the reader gets the
      // paragraph twice — once plain, once italic. The accepted-scene branch
      // above already guards this; this one did not.
      if (event.description && event.description !== event.prose) {
        detail.append(node('p', event.description, 'event-canonical'));
      }
    } else {
      if (event.register === 'prose') row.classList.add('is-prose');
      detail.append(node('p', event.description));
    }
  }

  if (event.contextBridge && !(isReading && event.readerContextVisible)) {
    const bridge = event.contextBridge;
    const bridgeEl = node('details', undefined, 'context-bridge');
    const bridgeSummary = node('summary', bridge.timeLabel || `Earlier · ${bridge.time}`, 'context-bridge-summary');
    const bridgeSnippet = node('p', bridge.snippet, 'context-bridge-snippet');
    bridgeEl.append(bridgeSummary, bridgeSnippet);
    if (bridge.originEventId) {
      const origin = node('button', 'Read what led here', 'recap-link'); origin.type = 'button';
      origin.addEventListener('click', () => void continueReading({ kind: 'event', eventId: bridge.originEventId,
        occurredAt: bridge.originOccurredAt }));
      bridgeEl.append(origin);
    }
    detail.append(bridgeEl);
  }

  if (event.storyRef && !event.contextBridge && !event.memoryCallback) {
    const earlier = node('button', 'Earlier in this story', 'recap-link'); earlier.type = 'button';
    earlier.addEventListener('click', () => void continueReading({ kind: 'context', eventId: event.id }));
    detail.append(earlier);
  }

  if (event.memoryCallback && !(isReading && event.readerMemoryVisible)) {
    const cb = event.memoryCallback;
    const cbEl = node('details', undefined, 'memory-callback');
    const cbSummary = node('summary', `↩ Earlier: “${cb.originLabel}”`, 'memory-callback-summary');
    const cbBody = node('div', undefined, 'memory-callback-body');
    if (cb.originTimeLabel) {
      cbBody.append(node('span', cb.originTimeLabel, 'memory-callback-time'));
    }
    if (Array.isArray(cb.originLines) && cb.originLines.length > 0) {
      cbBody.append(exchange(cb.originLines));
    } else if (cb.originSnippet) {
      cbBody.append(node('p', cb.originSnippet, 'memory-callback-snippet'));
    }
    if (cb.originEventId) {
      const jumpBtn = node('button', 'View original moment', 'memory-callback-jump-btn');
      jumpBtn.type = 'button';
      jumpBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        void continueReading({ kind: 'event', eventId: cb.originEventId });
      });
      cbBody.append(jumpBtn);
    }
    cbEl.append(cbSummary, cbBody);
    detail.append(cbEl);
  }

  // A passage that leaves the protagonists says so. This is an editorial cue
  // rather than a system: the world already records who was in an event, so a
  // beat with neither of the pair in it is by definition happening somewhere
  // else, and a reader should be told that in the same breath as the place.
  const elsewhere = Array.isArray(event.participants)
    && !event.participants.includes('goaden') && !event.participants.includes('ashai');
  const place = node('p', elsewhere ? `Elsewhere · ${locationName(event.location)}` : locationName(event.location),
    elsewhere ? 'event-location is-elsewhere' : 'event-location');
  detail.append(place);

  if (acceptedCinematic) {
    row.classList.add('has-exchange');
    const setupSource = acceptedCinematic.setup || acceptedCinematic.packet?.event?.setup;
    if (setupSource?.originSnippet) {
      const feedSetup = node('details', undefined, 'cinematic-setup-details feed-cinematic-setup');
      const label = setupSource.originTimeLabel || 'Earlier';
      feedSetup.append(
        node('summary', `↩ ${label}`, 'cinematic-setup-summary'),
        node('p', setupSource.originSnippet, 'cinematic-setup-snippet')
      );
      detail.append(feedSetup);
    }
    const replay = node('button', isReading ? 'Watch scene animation' : 'Watch the Worldstream scene', 'replay cinematic-replay');
    replay.type = 'button';
    replay.addEventListener('click', () => {
      if (acceptedCinematic.scene?.beats) playArchivedCinematic(acceptedCinematic);
      else replayCinematicEvent(event.id);
    });
    detail.append(replay);
  } else if (event.type === 'SCENE_BANK_BEAT' && event.sceneBeats?.length) {
    const replay = node('button', 'Play the scene', 'replay');
    replay.type = 'button';
    replay.addEventListener('click', () => scene.play(event));
    detail.append(replay);
  } else if (!isReading && Array.isArray(event.lines) && event.lines.length) {
    row.classList.add('has-exchange');
    detail.append(exchange(event.lines));
    const replay = node('button', 'Play the scene', 'replay');
    replay.type = 'button';
    replay.addEventListener('click', () => scene.play(event));
    detail.append(replay);
  } else if (isReading && Array.isArray(event.lines) && event.lines.length) {
    const replay = node('button', 'Play the scene', 'replay');
    replay.type = 'button';
    replay.addEventListener('click', () => scene.play(event));
    detail.append(replay);
  }

  // Wager slot directly beneath beat description
  const wagerSlot = node('div', undefined, 'event-wager-slot');
  detail.append(wagerSlot);

  // Single discreet meta-line beneath each event
  const metaBar = node('div', undefined, 'event-meta');

  // Discussion Drawer trigger
  const discussBtn = node('button', undefined, 'meta-btn discuss-btn');
  discussBtn.type = 'button';
  discussBtn.innerHTML = `💬 <span class="comment-count-label">Discuss</span>`;
  discussBtn.title = 'Open discussion and reactions';
  discussBtn.addEventListener('click', () => openDiscussionDrawer(event));

  // World reaction count
  const reactionStat = node('span', undefined, 'world-reaction-stat');
  reactionStat.innerHTML = `World reaction <span class="reaction-total-label">…</span>`;
  reactionStat.hidden = true;
  reactionStat.style.cursor = 'pointer';
  reactionStat.title = 'Open discussion and reactions';
  reactionStat.addEventListener('click', () => openDiscussionDrawer(event));

  // Quick reaction palette
  const palette = node('span', undefined, 'reaction-palette');
  const reactions = [
    { type: 'love', emoji: '❤️', label: 'Love' },
    { type: 'laugh', emoji: '😂', label: 'Humour' },
    { type: 'wow', emoji: '😮', label: 'Shock' },
    { type: 'eyes', emoji: '👀', label: 'Watching' },
  ];
  const userReactions = getStoredUserReactions(event.id);
  for (const r of reactions) {
    const rBtn = node('button', r.emoji, 'react-btn');
    rBtn.type = 'button';
    rBtn.dataset.reaction = r.type;
    rBtn.title = r.label;
    if (userReactions[r.type]) rBtn.classList.add('is-selected');
    rBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleReactionClick(event, r.type, rBtn);
    });
    palette.append(rBtn);
  }

  // Save Beat Bookmark button
  const bookmarkBtn = node('button', '🔖', 'meta-btn bookmark-btn');
  bookmarkBtn.type = 'button';
  bookmarkBtn.title = isSavedMoment(event.id) ? 'Remove bookmark' : 'Save Beat';
  if (isSavedMoment(event.id)) bookmarkBtn.classList.add('is-active');
  bookmarkBtn.addEventListener('click', () => {
    toggleSavedMoment(event, bookmarkBtn);
  });

  // Permalink copy button
  const shareBtn = node('button', '🔗', 'meta-btn share-btn');
  shareBtn.type = 'button';
  shareBtn.title = 'Copy Beat permalink';
  shareBtn.addEventListener('click', () => copyBeatPermalink(event, shareBtn));

  metaBar.append(discussBtn, reactionStat, palette, bookmarkBtn, shareBtn);
  detail.append(metaBar);

  row.append(when, detail);
  return row;
}

function loadSocialForVisibleEvents(events) {
  for (const evt of events) {
    fetchEventSocial(evt.id);
    const cleanId = cleanEventId(evt.id);
    const slot = document.querySelector(`#beat-${cleanId} .event-wager-slot`);
    if (slot) {
      fetchEventWager(evt.id).then((wager) => {
        if (wager) renderWagerCard(wager, slot, evt);
      });
    }
  }
}

const intentionTitles = { game: 'A short game', practice: 'Shared practice', quiet: 'A quiet break' };
const continuityStatuses = { offered: 'Offer made', renegotiating: 'Making other plans', reserved: 'Agreed',
  started: 'Under way', completed: 'Completed', declined: 'Declined', interrupted: 'Interrupted',
  interrupting: 'Interrupted', active: 'Under review', resolved: 'Review complete', failed: 'A check remains outstanding' };
const operationOutcomes = { cleared: 'The records matched and the review closed.',
  followup_required: 'A discrepancy remains. Another record check is needed.',
  unverified: 'The checking window ended without a complete review.' };

const storyTrails = createStoryTrail({ locationLabel: locationName, preservePosition: captureReadingPosition });
const newcomer = createNewcomerOrientation({ container: document.querySelector('#newcomer-orientation'),
  locationLabel: locationName, activityLabel: activity => activityNames[activity] || readable(activity),
  onThread: target => void continueReading(target) });
const readingFeed = new ReadingFeedBuffer();
const passageEffects = createPassageEffects();
const readingRecap = createReadingRecap({ container: document.querySelector('#reading-recap'),
  onContinue: target => void continueReading(target) });
const readingView = createReadingView({ onViewed: event => {
  const restore = captureReadingPosition();
  readingRecap.markViewed(event);
  restore();
} });
const newReading = document.querySelector('#reading-new');
const readingLiveStatus = document.querySelector('#reading-live-status');
const readingLiveTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London',
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
let passageSignature = '', openingPassageId = null, recapCompleteSince = null, recapAttempt = null, recapLoading = false;
let initialReadingWindow = null, recapWindowCursor = null, recapWindowThrough = null, recapWindowAfter = null;
let displayedHistoryAfter = 0;
let readingWindowWait = Promise.resolve();

function readingHistoryRows() {
  return [...new Map([...(olderRequested ? earlierReadingRows(olderRows.values(), readingFeed.shown, displayedHistoryAfter) : []), ...readingFeed.shown]
    .map(event => [event.id, event])).values()];
}

function readingPlan(events = readingHistoryRows()) {
  return forwardReadingEvents(events, locationName, { history: [...olderRows.values(), ...readingFeed.shown], visible: readingHistoryRows() });
}

function renderReadingPair(world) {
  const container = document.querySelector('#reading-pair');
  const signature = JSON.stringify(world.characters.map(({ id, location, activity }) => [id, location, activity]));
  if (container.dataset.signature === signature) return;
  container.dataset.signature = signature;
  container.replaceChildren(...world.characters.map(person => {
    const item = node('div', undefined, 'reading-person');
    const image = new Image(); image.src = `/worldstream/app/scene/${person.id}-icon.png`; image.alt = '';
    const text = node('div'); text.append(node('strong', person.name.split(' ')[0]),
      node('span', `${locationName(person.location)} · ${activityNames[person.activity] || readable(person.activity)}`));
    item.append(image, text); return item;
  }));
}

function renderLatestPassage(events) {
  const container = document.querySelector('#latest-passage');
  // The opening must precede the next paragraph, even when the world has moved
  // on. The old newest-first spotlight spoiled the end before the beginning.
  const first = events.find(item => item.readerWeight > 0);
  const event = first && first.readerWeight >= 2 && !first.lines?.length
    && (first.readerProse || first.cinematic?.scene) ? first : null;
  openingPassageId = event?.id ?? null;
  const signature = event ? JSON.stringify([event.id, event.readerProse, event.cinematic, event.readerDay, event.readerSetting]) : '';
  if (signature === passageSignature) return;
  passageSignature = signature;
  container.hidden = !event;
  if (!event) { container.replaceChildren(); delete container.dataset.eventId; return; }
  container.dataset.eventId = event.id;
  const performed = event.cinematic?.scene;
  const content = [node('p', 'Begin here', 'passage-label'),
    node('p', `${timeLabel(event.occurredAt)} · ${event.readerSetting || locationName(event.location)}`, 'passage-time')];
  if (event.readerChapter?.label) content.splice(1, 0, node('h3', event.readerChapter.label, 'reader-chapter'));
  const paragraphs = node('div', undefined, 'passage-text');
  appendReadingScene(paragraphs, event, { scene: performed, className: 'passage-prose',
    speakerLabel: who => speakerNames[who] || readable(who) });
  content.push(paragraphs);
  const actions = node('div', undefined, 'passage-actions');
  const source = node('button', 'Continue reading'); source.type = 'button';
  source.addEventListener('click', () => {
    const next = readingPlan().find(item => item.readerWeight > 0 && item.id !== event.id);
    if (next) void continueReading({ kind: 'event', eventId: next.id });
  }); actions.append(source);
  if (event.contextBridge?.originEventId || event.memoryCallback?.originEventId) {
    const context = node('button', 'Read what led here'); context.type = 'button';
    context.addEventListener('click', () => void continueReading({ kind: 'event',
      eventId: event.contextBridge?.originEventId || event.memoryCallback?.originEventId })); actions.append(context);
  }
  if (event.cinematic?.scene) {
    const replay = node('button', 'Watch the scene'); replay.type = 'button';
    replay.addEventListener('click', () => scene.playCinematic(event.cinematic, { auto: false })); actions.append(replay);
  }
  content.push(actions); container.replaceChildren(...content);
}

function isProtagonistStory(item) {
  if (!item) return false;
  const id = String(item.id || '');
  if (['thread:', 'night:', 'nimbus:', 'scene-bank:'].some(prefix => id.startsWith(prefix))) return true;
  if (id.startsWith('supporting:')) {
    return id.includes('goaden') || id.includes('ashai');
  }
  return false;
}

function storyOrientation(item) {
  if (!item || isProtagonistStory(item)) return null;
  const titleParts = String(item.title || '').split('·').map(s => s.trim());
  const character = titleParts[0] || 'Supporting character';
  const place = locationName(item.location);
  const subject = titleParts[1] || item.status || 'Active in London';
  return `${character} · ${place} · ${subject}`;
}

function renderSummaryCards(container, entries, scope) {
  const existing = new Map([...container.children].map(card => [card.dataset.storyKey, card]));
  const desired = new Set(); let cursor = container.firstElementChild;
  for (const item of entries) {
    const key = item.key || `${item.type}:${item.id}`; desired.add(key);
    let card = existing.get(key);
    if (!card) {
      card = node('article', undefined, 'story-card'); card.dataset.storyKey = key; card.dataset.readingAnchor = `story:${key}`;
      card.append(node('div', undefined, 'story-card-summary'));
    }
    const signature = JSON.stringify([item.title, item.status, item.at, item.description, item.orientation]);
    if (card.dataset.summary !== signature) {
      card.dataset.summary = signature;
      const body = card.querySelector('.story-card-summary');
      const nodes = [node('h3', item.title)];
      if (item.orientation) nodes.push(node('p', item.orientation, 'story-orientation secondary'));
      nodes.push(node('p', `${item.status}${asTime(item.at) === null ? '' : ` · ${timeLabel(item.at)}`}`, 'secondary'));
      if (typeof item.description === 'string') nodes.push(node('p', item.description));
      body.replaceChildren(...nodes);
    }
    if (item.type && item.id) storyTrails.attach(card, { type: item.type, id: item.id, scope, revision: item.revision || signature });
    if (card !== cursor) container.insertBefore(card, cursor);
    cursor = card.nextElementSibling;
  }
  for (const card of [...container.children]) if (!desired.has(card.dataset.storyKey)) card.remove();
}

function descriptorFor(world, type, item) {
  return (world.storyThreads ?? []).find(row => row.type === type && (item.id ? row.id === item.id
    : item.eventId ? row.eventId === item.eventId : row.title === item.title && row.openedAt === item.startedAt));
}

function renderCityStories(world) {
  const published = Array.isArray(world.stories) ? world.stories : [];
  const rawStories = [...published, ...(world.storyThreads ?? []).filter(item => item.type === 'story'
    && ['nimbus:', 'scene-bank:', 'purpose:'].some(prefix => item.id.startsWith(prefix))
    && !published.some(story => story.id === item.id))];
  document.querySelector('#story-index').hidden = rawStories.length === 0;
  elements.storiesSection.hidden = rawStories.length === 0;
  // Prioritize protagonist stories anchored on Goaden and Ashai for the primary hero slot
  const stories = [...rawStories].sort((a, b) => {
    const aLead = isProtagonistStory(a);
    const bLead = isProtagonistStory(b);
    if (aLead !== bLead) return bLead ? 1 : -1;
    return 0;
  });
  renderSummaryCards(elements.stories, stories.map(item => ({ ...item, type: 'story',
    orientation: storyOrientation(item),
    revision: descriptorFor(world, 'story', item)?.revision,
    status: `${locationName(item.location)} · ${['active','unfinished','promised','met','interrupting','requested','called','working','recovering','seeking','performing'].includes(item.status) ? 'Unfolding' : 'Concluded'}`,
    at: item.completedAt ?? item.openedAt })), world.continuityId || world.worldId);
}

function paintReadingFeed({ replaceChanged = false } = {}) {
  const state = readingFeed.state();
  lastRenderedEvents = state.events;
  const reading = document.body.dataset.reading === 'true';
  const plan = readingPlan();
  renderLatestPassage(plan);
  const rows = reading ? readingPlan(state.events) : state.events;
  reconcileReadingRows(elements.events, rows, eventRow, { replaceChanged });
  for (const row of elements.events.children) row.dataset.openingPassage = String(row.dataset.eventId === openingPassageId);
  newReading.hidden = !state.pending;
  newReading.textContent = state.added ? 'The story continues · Read on' : 'Updated passages · Read on';
  if (readingLiveStatus) {
    const through = Number.isSafeInteger(lastWorld?.resolvedThrough) ? readingLiveTime.format(lastWorld.resolvedThrough) : null;
    const newest = [...plan].reverse().find(event => event.readerWeight > 0);
    readingLiveStatus.textContent = state.added ? 'New passages have arrived. Read on when you’re ready.'
      : state.pending ? 'Updated passages are waiting. Read on to refresh the text on this page.'
      : through ? `${newest ? `Latest passage · ${readingLiveTime.format(newest.occurredAt)}. ` : ''}You’re at the latest page. The world is current through ${through}.`
      : 'Waiting for the living story…';
  }
  passageEffects.update(plan.find(item => item.id === openingPassageId), lastWorld);
  readingView.observe([...state.events, ...olderRows.values()]);
}

function revealLatestReading({ includeRevisions = true } = {}) {
  const previous = readingFeed.shown;
  readingFeed.reveal({ includeRevisions });
  const retained = new Set(readingFeed.shown.map(event => event.id));
  for (const event of previous) if (!retained.has(event.id)) olderRows.set(event.id, event);
  paintReadingFeed({ replaceChanged: includeRevisions }); renderOlderHistory();
  loadSocialForVisibleEvents(lastRenderedEvents);
}
newReading?.addEventListener('click', async () => {
  if (newReading.disabled) return;
  const scope = historyScope, generation = historyGeneration;
  const shown = new Set(readingHistoryRows().map(event => event.id));
  const last = readingFeed.shown[0];
  newReading.disabled = true;
  try {
    if (readingFeed.state().gap && last) {
      if (readingLiveStatus) readingLiveStatus.textContent = 'Loading the intervening passages…';
      const complete = await backfillReadingRecap(last.occurredAt);
      if (scope !== historyScope || generation !== historyGeneration) return;
      if (!complete) {
        if (readingLiveStatus) readingLiveStatus.textContent = 'Some intervening pages still need to load. Read on again to continue loading.';
        return;
      }
      readingFeed.update(scope, [...olderRows.values()].filter(event => event.occurredAt >= last.occurredAt));
    }
    revealLatestReading();
    const next = readingPlan().find(event => !shown.has(event.id) && event.readerWeight > 0
      && (!last || event.occurredAt >= last.occurredAt));
    if (next) void continueReading({ kind: 'event', eventId: next.id });
  } finally { newReading.disabled = false; }
});
document.querySelector('#reading-routine-toggle')?.addEventListener('change', event => {
  document.body.dataset.quietRecords = String(event.target.checked);
});
document.querySelector('#reading-view-toggle')?.addEventListener('click', () => {
  // Mode-specific rows must repaint immediately, not wait for a future poll.
  elements.events.replaceChildren(); elements.olderEvents?.replaceChildren();
  paintReadingFeed(); renderOlderHistory();
});

async function continueReading(target) {
  if (target.kind === 'thread') {
    const card = [...document.querySelectorAll('[data-story-key]')].find(item => item.dataset.storyKey === `${target.type}:${target.threadId}`);
    if (card) {
      const index = card.closest('#story-index'); if (index) index.open = true;
      const overview = card.closest('#world-overview'); if (overview) overview.open = true;
      const trail = card.querySelector('.story-trail'); if (trail) trail.open = true;
      card.scrollIntoView({ behavior: 'instant', block: 'start' }); return;
    }
  }
  if (target.kind === 'history') {
    if (readingRecap.getState().historyGap && !recapLoading) {
      await backfillReadingRecap(readingRecap.getState().boundaryAt);
    }
    olderRequested = true; renderOlderHistory();
    await loadOlderHistory(); elements.olderHistory?.scrollIntoView({ behavior: 'instant', block: 'start' }); return;
  }
  if (target.eventId) {
    if (target.kind !== 'context' && target.eventId === openingPassageId && document.body.dataset.reading === 'true') {
      document.querySelector('#latest-passage').scrollIntoView({ behavior: 'instant', block: 'start' }); return;
    }
    let element = target.kind === 'context' ? null : document.getElementById(`beat-${cleanEventId(target.eventId)}`);
    if (target.kind !== 'context' && !element && readingFeed.incoming.some(event => event.id === target.eventId)) { revealLatestReading(); element = document.getElementById(`beat-${cleanEventId(target.eventId)}`); }
    if (target.kind !== 'context' && !element && olderRows.has(target.eventId)) {
      olderRequested = true;
      displayedHistoryAfter = Math.min(displayedHistoryAfter, olderRows.get(target.eventId).occurredAt);
      paintReadingFeed({ replaceChanged: true }); renderOlderHistory();
      element = document.getElementById(`beat-${cleanEventId(target.eventId)}`);
      if (target.eventId === openingPassageId && document.body.dataset.reading === 'true') {
        document.querySelector('#latest-passage').scrollIntoView({ behavior: 'instant', block: 'start' }); return;
      }
    }
    if (!element) {
      const scope = historyScope, generation = historyGeneration;
      try {
        elements.historyStatus.textContent = 'Finding your passage…';
        const response = await fetch(`/api/events/${encodeURIComponent(target.eventId)}/context`,
          { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
        if (!response.ok) throw new Error('Passage unavailable');
        const result = await response.json();
        if (scope !== historyScope || generation !== historyGeneration) return;
        if (result.continuityId !== scope) throw new Error('The story continuity changed');
        const source = result.event;
        if (!source || source.id !== target.eventId || typeof source.description !== 'string'
          || !Number.isSafeInteger(source.occurredAt) || source.occurredAt > lastWorld.resolvedThrough)
          throw new Error('Invalid passage');
        // A fetched origin is a separate excerpt. It is not proof that the
        // intervening history has been loaded, and never fills a coverage gap.
        showReadingContext(source, result.causes ?? result.events ?? []);
        elements.historyStatus.textContent = '';
        return;
      } catch {
        if (scope === historyScope && generation === historyGeneration)
          elements.historyStatus.textContent = 'This passage could not be loaded. Your place is still saved; please try again.';
        return;
      }
    }
    if (element) {
      if (element.dataset.narrativeWeight === '0') {
        document.body.dataset.quietRecords = 'true';
        document.querySelector('#reading-routine-toggle').checked = true;
      }
      element.scrollIntoView({ behavior: 'instant', block: 'center' }); return;
    }
  }
  document.querySelector('#world-overview').open = true;
  document.querySelector('#world-overview').scrollIntoView({ behavior: 'instant', block: 'start' });
}

function showReadingContext(source, causes) {
  const scope = historyScope, generation = historyGeneration;
  const restoreBook = captureReadingPosition();
  const container = document.querySelector('#reading-context');
  const heading = node('h3', 'Earlier in the story', 'reader-chapter');
  const close = node('button', 'Back to the book'); close.type = 'button';
  close.addEventListener('click', () => { container.hidden = true; container.replaceChildren(); restoreBook(); });
  const list = node('ol', undefined, 'events');
  const rows = [...new Map([...(Array.isArray(causes) ? causes : []), source]
    .filter(event => event && typeof event.id === 'string' && typeof event.description === 'string'
      && event.visibility !== 'private' && Number.isSafeInteger(event.occurredAt) && event.occurredAt <= source.occurredAt)
    .map(event => [event.id, event])).values()];
  const plan = forwardReadingEvents(rows, locationName);
  for (const event of plan) {
    const row = eventRow({ ...event, readerWeight: Math.max(2, event.readerWeight), readerProse: event.prose,
      readerSceneStart: true, readerContext: [locationName(event.location), event.room].filter(Boolean).join(' · '), readerChapter: null });
    // Keep source navigation unique when this excerpt overlaps the book.
    row.id = `context-${cleanEventId(event.id)}`;
    list.append(row);
  }
  const resume = node('button', 'Continue from this passage'); resume.type = 'button';
  const status = node('p', '', 'secondary'); status.setAttribute('role', 'status');
  resume.addEventListener('click', async () => {
    resume.disabled = true;
    try {
      status.textContent = 'Loading the story from here…';
      const complete = await backfillReadingRecap(source.occurredAt);
      if (scope !== historyScope || generation !== historyGeneration) return;
      if (!complete) { status.textContent = 'The intervening pages are not all loaded yet. Try again to continue loading.'; return; }
      olderRows.set(source.id, source); olderRequested = true;
      displayedHistoryAfter = Math.min(displayedHistoryAfter, source.occurredAt);
      container.hidden = true; container.replaceChildren();
      paintReadingFeed({ replaceChanged: true }); renderOlderHistory();
      void continueReading({ kind: 'event', eventId: source.id });
    } finally { resume.disabled = false; }
  });
  container.replaceChildren(heading, close, list, resume, status); container.hidden = false;
  container.scrollIntoView({ behavior: 'instant', block: 'start' });
}

function updateReadingRecap() {
  if (!lastWorld) return;
  const retained = readingFeed.scope === historyScope ? [...readingFeed.shown, ...readingFeed.incoming] : [];
  const events = [...new Map([...olderRows.values(), ...retained, ...lastWorld.events].map(event => [event.id, event])).values()];
  const model = readingRecap.update(lastWorld, { events, completeSince: recapCompleteSince });
  if (initialReadingWindow !== historyScope && !recapLoading) {
    initialReadingWindow = historyScope;
    // Earlier PUBLIC passages inform repetition selection without placing a
    // month's prose on the page. The opening itself remains the recent day.
    void backfillReadingRecap(Math.max(0, Math.min(model?.boundaryAt ?? Infinity,
      lastWorld.resolvedThrough - 30 * 24 * 60 * 60 * 1000)), true);
  }
  else if (model?.historyGap && !recapLoading && recapAttempt !== historyScope) void backfillReadingRecap(model.boundaryAt);
}

async function backfillReadingRecap(boundaryAt, opening = false) {
  const scope = historyScope, generation = historyGeneration;
  while (recapLoading) {
    await readingWindowWait;
    if (scope !== historyScope || generation !== historyGeneration) return false;
  }
  let finishWaiting;
  readingWindowWait = new Promise(resolve => { finishWaiting = resolve; });
  recapAttempt = scope; recapLoading = true;
  if (recapWindowAfter !== boundaryAt) {
    recapWindowAfter = boundaryAt; recapWindowCursor = null; recapWindowThrough = null;
  }
  const through = recapWindowThrough ?? lastWorld.resolvedThrough;
  if (recapWindowThrough === null) recapWindowThrough = through;
  let complete = false;
  try {
    const result = await loadReadingWindow({ after: boundaryAt, through, before: recapWindowCursor, continuityId: scope,
      signal: AbortSignal.timeout(45_000), onPage: page => {
        if (scope !== historyScope || generation !== historyGeneration) return;
        for (const event of page.events) olderRows.set(event.id, event);
        if (page.completeSince !== null) recapCompleteSince = Math.min(recapCompleteSince ?? Infinity, page.completeSince);
        recapWindowCursor = page.nextCursor;
      } });
    complete = result.complete;
  } catch { /* The recap honestly retains its history-gap notice. */ }
  finally {
    if (scope === historyScope && generation === historyGeneration) {
      recapLoading = false;
      const restore = captureReadingPosition();
      if (opening) olderRequested = true;
      updateReadingRecap();
      paintReadingFeed({ replaceChanged: opening }); renderOlderHistory(); restore();
    }
    finishWaiting();
  }
  return complete && scope === historyScope && generation === historyGeneration;
}

function renderContinuity(world) {
  const entries = [];
  for (const item of (world.placeConditions ?? []).slice(0, 2)) entries.push({
    key: 'condition:' + item.location + ':' + item.room, title: locationName(item.location) + ' · ' + item.room,
    description: item.description, status: 'Until the work is finished' });
  for (const item of (world.intentions ?? []).slice(-2).reverse()) entries.push({ ...item, type: 'intention',
    title: intentionTitles[item.activity] || 'Time together', revision: descriptorFor(world, 'intention', item)?.revision,
    status: continuityStatuses[item.status] || readable(item.status),
    at: ['offered', 'renegotiating', 'reserved'].includes(item.status) ? item.startAt : item.endAt });
  for (const item of (world.operations ?? []).slice(0, 3)) {
    const descriptor = descriptorFor(world, 'operation', item);
    entries.push({ ...item, key: 'operation:' + (descriptor?.id || item.eventId || item.title), type: 'operation',
      id: descriptor?.id, revision: descriptor?.revision, description: item.description || operationOutcomes[item.outcome],
      status: continuityStatuses[item.status] || readable(item.status), at: item.completedAt ?? item.startedAt });
  }
  elements.continuitySection.hidden = entries.length === 0;
  renderSummaryCards(elements.continuity, entries, world.continuityId || world.worldId);
}

// A local reading bookmark. It changes only what this browser highlights; it
// never enters the shared simulation or the active-viewer request body.
let historyScope = null, previousViewEvents = [], historyGeneration = 0;
let olderCursor = null, olderHasMore = true, olderLoading = false, olderRequested = false;
const olderRows = new Map();
function syncReadingBookmark(world, recent) {
  const scope = String(world.continuityId || world.worldId || 'silver-clouds');
  if (historyScope !== scope) {
    historyGeneration++; recapLoading = false;
    historyScope = scope; previousViewEvents = [];
    olderCursor = null; olderHasMore = true; olderLoading = false; olderRequested = false;
    olderRows.clear(); recapCompleteSince = null; recapAttempt = null;
    displayedHistoryAfter = Math.max(0, world.resolvedThrough - 24 * 60 * 60 * 1000);
    initialReadingWindow = null; recapWindowCursor = null; recapWindowThrough = null; recapWindowAfter = null;
    document.querySelector('#reading-context').hidden = true;
    if (elements.historyStatus) elements.historyStatus.textContent = '';
  }
  const newestIds = new Set(recent.map(event => event.id));
  if (previousViewEvents.length && recent.length && !previousViewEvents.some(event => newestIds.has(event.id))) {
    // A long absence can leave an unread interval between two cached pages.
    historyGeneration++; recapLoading = false; recapAttempt = null; recapCompleteSince = null;
    recapWindowCursor = null; recapWindowThrough = null; recapWindowAfter = null;
    olderLoading = false; olderCursor = null; olderHasMore = true;
    elements.olderEvents?.setAttribute('aria-busy', 'false');
  }
  const earliest = Math.min(...recent.map(event => asTime(event.occurredAt)).filter(at => at !== null));
  if (Number.isFinite(earliest)) recapCompleteSince = Math.min(recapCompleteSince ?? earliest, earliest);
  if (elements.lastVisit) elements.lastVisit.hidden = true;
  if (olderRequested) {
    const currentIds = new Set(recent.map(event => event.id));
    if (previousViewEvents.length && !previousViewEvents.some(event => currentIds.has(event.id))) {
      olderCursor = null; olderHasMore = true;
    }
    for (const event of previousViewEvents) if (!currentIds.has(event.id)) olderRows.set(event.id, event);
  }
  previousViewEvents = recent;
  updateReadingRecap();
}

function renderOlderHistory() {
  if (!elements.olderEvents || !elements.olderHistory) return;
  const current = new Set(lastRenderedEvents.map(event => event.id));
  const rows = earlierReadingRows(olderRows.values(), lastRenderedEvents, displayedHistoryAfter)
    .sort((a, b) => asTime(b.occurredAt) - asTime(a.occurredAt) || b.id.localeCompare(a.id));
  const reading = document.body.dataset.reading === 'true';
  if (reading) elements.events.before(elements.olderHistory);
  else elements.events.after(elements.olderHistory);
  positionReadingNavigation(document, reading);
  reconcileReadingRows(elements.olderEvents, olderRequested ? (reading ? readingPlan(rows) : rows) : [], eventRow, { replaceChanged: true });
  for (const row of elements.olderEvents.children) row.dataset.openingPassage = String(row.dataset.eventId === openingPassageId);
  elements.olderHistory.hidden = !olderRequested || rows.length === 0;
  readingView.observe([...lastRenderedEvents, ...olderRows.values()]);
  if (elements.olderHistoryButton) {
    const cachedHidden = (!olderRequested && rows.length > 0)
      || [...olderRows.values()].some(event => event.occurredAt < displayedHistoryAfter);
    elements.olderHistoryButton.disabled = olderLoading || !olderHasMore && !cachedHidden || !hasWorld;
    elements.olderHistoryButton.textContent = olderLoading ? 'Loading earlier passages…'
      : olderHasMore || cachedHidden ? 'Read earlier passages' : 'You’ve reached the beginning';
  }
}

async function loadOlderHistory() {
  if (olderLoading || !hasWorld) return;
  const cachedEarlier = [...olderRows.values()].filter(event => event.occurredAt < displayedHistoryAfter);
  if (cachedEarlier.length) {
    const restore = captureReadingPosition();
    displayedHistoryAfter = Math.max(0, Math.min(displayedHistoryAfter - 24 * 60 * 60 * 1000,
      Math.max(...cachedEarlier.map(event => event.occurredAt))));
    olderRequested = true; paintReadingFeed({ replaceChanged: true }); renderOlderHistory(); restore(); return;
  }
  if (!olderRequested && olderRows.size) {
    olderRequested = true; paintReadingFeed({ replaceChanged: true }); renderOlderHistory(); return;
  }
  if (!olderHasMore) return;
  const restoreReading = captureReadingPosition();
  olderLoading = true; olderRequested = true;
  const scope = historyScope, generation = historyGeneration, additions = [], viewedThrough = asTime(lastWorld?.resolvedThrough);
  elements.olderEvents?.setAttribute('aria-busy', 'true');
  if (elements.historyStatus) elements.historyStatus.textContent = '';
  renderOlderHistory();
  try {
    // The first server page can be the same forty events as the live feed.
    // Follow its opaque cursor once so the first click actually reveals history.
    for (let page = 0; page < 2; page++) {
      const url = olderCursor === null ? '/api/history' : `/api/history?before=${encodeURIComponent(olderCursor)}`;
      const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error('History unavailable');
      const data = await response.json();
      if (historyScope !== scope || historyGeneration !== generation) return;
      if (data.continuityId !== scope) throw new Error('The story continuity changed');
      if (!Array.isArray(data.events) || data.events.length > 40
        || !(data.nextCursor === null || Number.isSafeInteger(data.nextCursor) && data.nextCursor > 0))
        throw new Error('Invalid history page');
      const current = new Set(lastRenderedEvents.map(event => event.id));
      for (const event of data.events) if (typeof event.id === 'string' && typeof event.description === 'string'
        && asTime(event.occurredAt) !== null && (viewedThrough === null || asTime(event.occurredAt) <= viewedThrough)
        && !current.has(event.id) && !olderRows.has(event.id)) {
        olderRows.set(event.id, event); additions.push(event);
      }
      if (additions.length) displayedHistoryAfter = Math.min(displayedHistoryAfter, ...additions.map(event => event.occurredAt));
      olderCursor = data.nextCursor; olderHasMore = olderCursor !== null;
      const earliest = Math.min(...data.events.map(event => asTime(event.occurredAt)).filter(at => at !== null));
      if (Number.isFinite(earliest)) recapCompleteSince = Math.min(recapCompleteSince ?? earliest, earliest);
      if (!olderHasMore && readingRecap.getState().boundaryAt !== null)
        recapCompleteSince = Math.min(recapCompleteSince ?? Infinity, readingRecap.getState().boundaryAt);
      if (additions.length || !olderHasMore) break;
    }
    if (elements.historyStatus) elements.historyStatus.textContent = additions.length
      ? `${additions.length} earlier events added.` : olderHasMore ? 'Continue for earlier activity.'
        : 'All available public history is shown.';
  } catch {
    if (historyScope === scope && historyGeneration === generation && elements.historyStatus)
      elements.historyStatus.textContent = 'Earlier activity could not be loaded. Please try again.';
  } finally {
    if (historyScope === scope && historyGeneration === generation) {
      olderLoading = false;
      elements.olderEvents?.setAttribute('aria-busy', 'false');
      paintReadingFeed({ replaceChanged: true });
      renderOlderHistory();
      loadSocialForVisibleEvents(additions);
      updateReadingRecap();
      restoreReading();
    }
  }
}

elements.olderHistoryButton?.addEventListener('click', loadOlderHistory);

function render(world) {
  const followingLiveEnd = hasWorld && atReadingLiveEdge();
  const previousWorldTime = asTime(lastWorld?.resolvedThrough);
  const restoreReading = captureReadingPosition();
  lastWorld = world;
  const serverTime = asTime(world.serverTime);
  if (serverTime !== null) serverClockOffset = serverTime - Date.now();
  updateClock();
  // Daylight is the world's own day phase. Weather only dresses the scene, so a
  // wet afternoon still renders as an afternoon.
  const phase = DAY_PHASES.has(world.time?.dayPhase) ? world.time.dayPhase : 'day';
  document.body.dataset.phase = phase;
  elements.phase.textContent = phaseNames[phase];
  const sunrise = asTime(world.time?.sunrise);
  const sunset = asTime(world.time?.sunset);
  elements.sun.textContent = sunrise !== null && sunset !== null
    ? `Sunrise ${timeFormat.format(sunrise)} · Sunset ${timeFormat.format(sunset)}`
    : '';
  const temperature = Number.isFinite(world.weather?.temperatureC) ? `, ${world.weather.temperatureC}°C` : '';
  elements.weather.textContent = `${world.weather?.description || 'No weather update'}${temperature}`;
  atmosphere.update(world);
  if (world.scene) {
    // The key selects presentation art; its weather suffix can fall back to the
    // same dry plate because rain is already rendered over the whole page.
    document.body.dataset.scene = String(world.scene.backgroundKey || '');
    elements.scene.textContent = `${locationName(world.scene.location)} · ${modeNames[world.scene.mode] || readable(world.scene.mode)}`;
  }
  worldBackdrop.set(backdropSource(world));
  // How many lintels the day's ambient energy has drawn in.
  lintelSky.set(world.sky?.lintels);
  // The season. A real date, a real countdown; the festival itself is the book's.
  if (world.veil && typeof world.veil.daysAway === 'number') {
    elements.veil.textContent = veilLabel(world.veil);
    elements.veil.dataset.phase = world.veil.phase || 'distant';
    elements.veilRow.hidden = false;
  } else {
    elements.veilRow.hidden = true;
  }
  elements.status.textContent = world.worldStatus || 'A quiet moment in Silver Clouds.';
  newcomer.update(world);
  renderReadingPair(world);
  renderCityStories(world);
  renderContinuity(world);
  const factions = world.factions && typeof world.factions === 'object' ? Object.entries(world.factions) : [];
  elements.factions.replaceChildren(...factions.map(factionRow));
  liveCards = [];
  liveCountdowns = [];
  liveJourneys = [];
  whereabouts(world.characters, world);
  elements.characters.replaceChildren(...world.characters.map(characterCard));
  updateLiveState();
  // The shared API returns chronological history. Show the most recent entries first.
  const recent = world.events.slice(-50).reverse();
  for (const event of [...recent].reverse()) {
    const authored = authoredSceneRecord(event);
    if (!authored) continue;
    cinematicInbox.enqueue(authored, { queue: hasWorld && scene.autoScenesEnabled()
      && document.body.dataset.reading !== 'true' && previousWorldTime !== null
      && event.occurredAt > previousWorldTime && event.occurredAt >= world.resolvedThrough - 180_000 });
  }
  persistCinematicState();
  drainCinematicQueue();
  syncReadingBookmark(world, recent);
  const feedUpdate = readingFeed.update(historyScope, recent);
  if (followingLiveEnd && feedUpdate.added && !feedUpdate.gap && !readingRecap.getState().historyGap) {
    // Append forward arrivals at the live end; retain existing prose and the
    // reader's viewport. An editorial revision still requires explicit reveal.
    const previous = readingFeed.shown;
    readingFeed.reveal({ includeRevisions: false });
    const retained = new Set(readingFeed.shown.map(event => event.id));
    for (const event of previous) if (!retained.has(event.id)) olderRows.set(event.id, event);
  }

  // Check for newly arriving high-stakes narrative catalysts
  if (!hasWorld) {
    for (const evt of recent) {
      if (isHighStakesEvent(evt)) {
        seenHighStakesEvents.add(evt.id);
      }
    }
  } else {
    for (const evt of recent) {
      if (isHighStakesEvent(evt) && !seenHighStakesEvents.has(evt.id)) {
        seenHighStakesEvents.add(evt.id);
        showUrgentToast(evt);
        break;
      }
    }
  }

  if (Array.isArray(world.clocks)) {
    const prevClocks = latestClocks;
    latestClocks = world.clocks;
    if (elements.clocksCount) {
      elements.clocksCount.textContent = world.clocks.length;
    }
    if (hasWorld && prevClocks.length > 0) {
      const attuned = getAttunedClocks();
      for (const clock of world.clocks) {
        if (attuned.has(clock.id)) {
          const old = prevClocks.find((c) => c.id === clock.id);
          if (old && clock.currentSegment > old.currentSegment) {
            showUrgentToast({
              description: `PLOT CLOCK ADVANCED: ${clock.name} reached Stage ${clock.currentSegment}/${clock.totalSegments} (${clock.currentTitle})!`,
              isVeilMilestone: true,
            });
          }
        }
      }
    }
    if (elements.clocksDrawer && !elements.clocksDrawer.hidden) {
      renderClocksUI(latestClocks);
    }
  }

  paintReadingFeed();
  elements.emptyEvents.hidden = recent.length > 0;
  elements.emptyEvents.textContent = 'Nothing new to report yet.';
  elements.connection.textContent = `Updated through ${timeLabel(world.resolvedThrough)}. Refreshes while this page is open.`;
  elements.connection.dataset.state = 'ready';
  hasWorld = true;
  renderOlderHistory();
  music.update(world);
  loadSocialForVisibleEvents(lastRenderedEvents);
  restoreReading();
  handleHashRoute();
}

async function refreshWorld() {
  if (refreshing || document.visibilityState !== 'visible') return;
  refreshing = true;
  elements.refresh.disabled = true;
  elements.refresh.textContent = 'Refreshing…';
  try {
    // The world poll runs once a minute, so a single dropped request on the
    // very first load used to leave the reader looking at an error for a full
    // minute before anything tried again — with nothing on the page to fall
    // back on. Once a world has arrived that is the right behaviour (keep
    // showing the last one, retry on the next tick); before one has, it is
    // worth a couple more attempts. First impressions are the load most likely
    // to hit a cold backend.
    const attempts = hasWorld ? 1 : 3;
    let response = null;
    let failure = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (attempt) await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
      if (document.visibilityState !== 'visible') return;
      try {
        response = await viewerFetch('/api/observe', {
          method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(10_000),
        });
        if (response.ok) break;
        failure = new Error('World unavailable');
        response = null;
      } catch (error) { failure = error; response = null; }
    }
    if (!response) throw failure ?? new Error('World unavailable');
    const world = await response.json();
    if (!world || !Array.isArray(world.characters) || !Array.isArray(world.events)) {
      throw new Error('Invalid world response');
    }
    render(world);
    // A separate highlights request must never hold up successfully received
    // world/story updates, even if that optional endpoint stops responding.
    void fetchTodayHighlight();
    // The model runs after the canonical response has returned. A first poll
    // catches a fast scene; the short interval below catches a slower one.
    pollCinematic();
  } catch (error) {
    console.error('Worldstream refresh failed', error);
    elements.connection.textContent = hasWorld
      ? 'Unable to refresh. Showing the last received world state.'
      : 'Unable to reach the local world. Try Refresh when the server is available.';
    elements.connection.dataset.state = 'error';
    if (readingLiveStatus) readingLiveStatus.textContent = hasWorld
      ? `Updates are paused. Your passage is still here; retrying shortly. Last world update · ${readingLiveTime.format(lastWorld.resolvedThrough)}.`
      : 'The story could not be reached yet. Refresh to try again.';
  } finally {
    refreshing = false;
    elements.refresh.disabled = false;
    elements.refresh.textContent = 'Refresh';
  }
}

function setupCourierNotificationToggle() {
  if (!elements.notifToggleBtn) return;
  if (!('Notification' in window)) {
    elements.notifToggleBtn.hidden = true;
    return;
  }
  if (Notification.permission === 'granted') {
    elements.notifToggleBtn.classList.add('is-active');
    elements.notifToggleBtn.title = 'Courier Alerts: Enabled';
  }
  elements.notifToggleBtn.addEventListener('click', async () => {
    if (Notification.permission !== 'granted') {
      const p = await Notification.requestPermission();
      if (p === 'granted') {
        elements.notifToggleBtn.classList.add('is-active');
        elements.notifToggleBtn.title = 'Courier Alerts: Enabled';
        try {
          new Notification('Silver Clouds — Courier Attuned', {
            body: 'Courier alerts attuned. Urgent catalysts will notify you.',
            icon: '/worldstream/app/scene/ashai-icon.png',
          });
        } catch {}
      }
    }
  });
}

// Header actions & drawer event wiring
if (elements.profileBtn) elements.profileBtn.addEventListener('click', openProfileModal);
if (elements.profileClose) elements.profileClose.addEventListener('click', closeProfileModal);
if (elements.profileCancel) elements.profileCancel.addEventListener('click', closeProfileModal);
if (elements.signatureEditBtn) elements.signatureEditBtn.addEventListener('click', openProfileModal);

if (elements.savedMomentsBtn) elements.savedMomentsBtn.addEventListener('click', openSavedDrawer);
if (elements.savedClose) elements.savedClose.addEventListener('click', closeSavedDrawer);

if (elements.dispatchBtn) elements.dispatchBtn.addEventListener('click', () => openDispatchDrawer('latest'));
if (elements.dispatchClose) elements.dispatchClose.addEventListener('click', closeDispatchDrawer);
if (elements.dispatchDismissBtn) elements.dispatchDismissBtn.addEventListener('click', closeDispatchDrawer);
if (elements.dispatchShareBtn) elements.dispatchShareBtn.addEventListener('click', (e) => copyDispatchSummary(e.currentTarget));

if (elements.clocksBtn) elements.clocksBtn.addEventListener('click', () => openClocksDrawer());
if (elements.clocksClose) elements.clocksClose.addEventListener('click', closeClocksDrawer);

// The Scenes drawer. `openCinematicArchive` and `loadCinematicArchive` both
// existed and were both correct; nothing was ever wired to call them, so the
// button did nothing and the drawer kept the "Loading accepted scenes…"
// placeholder its markup ships with. Every other drawer in this block had its
// pair of listeners and this one did not.
if (elements.cinematicArchiveBtn) elements.cinematicArchiveBtn.addEventListener('click', openCinematicArchive);
if (elements.cinematicArchiveClose) elements.cinematicArchiveClose.addEventListener('click', closeCinematicArchive);
if (elements.clocksDismissBtn) elements.clocksDismissBtn.addEventListener('click', closeClocksDrawer);
if (elements.clocksRefreshBtn) elements.clocksRefreshBtn.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/clocks', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.clocks)) {
        latestClocks = data.clocks;
        renderClocksUI(latestClocks);
      }
    }
  } catch {}
});
if (elements.urgentToastDismiss) elements.urgentToastDismiss.addEventListener('click', dismissUrgentToast);

if (elements.drawerClose) elements.drawerClose.addEventListener('click', closeDiscussionDrawer);
if (elements.drawerBackdrop) elements.drawerBackdrop.addEventListener('click', closeAllDrawers);

if (elements.commentForm) elements.commentForm.addEventListener('submit', handleCommentSubmit);

if (elements.avatarPicker) {
  elements.avatarPicker.addEventListener('click', (e) => {
    const btn = e.target.closest('.avatar-option');
    if (!btn) return;
    activeAvatar = btn.dataset.avatar || '👤';
    elements.avatarPicker.querySelectorAll('.avatar-option').forEach(b => {
      b.classList.toggle('is-active', b === btn);
    });
  });
}

if (elements.profileForm) {
  elements.profileForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!travellerProfile) travellerProfile = {};
    travellerProfile.name = elements.profileNameInput?.value.trim() || 'Traveller';
    travellerProfile.avatar = activeAvatar || '👤';
    travellerProfile.holyItem = elements.profileHolyInput?.value.trim() || '';
    travellerProfile.guardian = elements.profileGuardianInput?.value.trim() || '';
    travellerProfile.title = elements.profileTitleInput?.value.trim() || '';
    travellerProfile.bio = elements.profileBioInput?.value.trim() || '';
    saveTravellerProfile();
    closeProfileModal();
  });
}

window.addEventListener('hashchange', () => handleHashRoute({ force: true }));
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAllDrawers();
});
loadTravellerProfile();
updateSavedUI();
setupCourierNotificationToggle();

async function resumeWatching() {
  if (document.visibilityState !== 'visible') return;
  await updatePresence();
  if (document.visibilityState !== 'visible') return;
  scene.resume();
  await refreshWorld();
}
function leaveWatching() {
  scene.suspend();
  if (!viewerToken) return;
  const url = apiUrl('/api/presence/leave');
  // A simple body reaches a separate backend without an unload-time preflight.
  // Both servers parse the token from JSON independently of the content type.
  const body = JSON.stringify({ viewerToken });
  try { if (navigator.sendBeacon?.(url, body)) return; } catch {}
  fetch(url, { method: 'POST', body, keepalive: true, credentials: 'omit',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' } }).catch(() => {});
}
elements.refresh.addEventListener('click', resumeWatching);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') resumeWatching();
  else leaveWatching();
});
window.addEventListener('pagehide', leaveWatching);
window.addEventListener('focus', resumeWatching);
setInterval(refreshWorld, 60_000);
setInterval(updatePresence, 25_000);
setInterval(pollCinematic, 4_000);
// The world is fetched once a minute; the present is carried forward every second.
setInterval(() => { updateClock(); updateLiveState(); updateAllWagerCountdowns(); }, 1_000);
updateClock();
(async () => {
  // The server-issued presence token makes this tab a real cinematic viewer.
  // Establish it before the first observe so the resulting event may be staged.
  await updatePresence();
  await refreshWorld();
})();
