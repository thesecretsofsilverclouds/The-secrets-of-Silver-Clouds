import { createWeatherLayer, deriveAtmosphere } from './weather-layer.js';
import { createAmbientAudio } from './ambient-audio.js';
import { createRoadSpriteLayer } from './road-sprites.js';

// The whole layer only consumes public projections. It has no world-write API.
export function createAtmosphere({ root = document, onVolume = () => {}, onCreatures = () => {} } = {}) {
  const query = selector => root.querySelector(selector);
  const motion = query('#atmosphere-motion');
  const flashes = query('#atmosphere-flashes');
  const creatures = query('#atmosphere-creatures');
  const sound = query('#ambience-enabled');
  const volume = query('#ambience-volume');
  const scoreVolume = query('#score-volume');
  const soundStatus = query('#ambience-status');
  let prefs = { motion: true, flashes: false, creatures: true, scoreVolume: .34 };
  try { prefs = { ...prefs, ...JSON.parse(localStorage.getItem('worldstream-atmosphere') || '{}') }; } catch {}
  prefs.scoreVolume = Number.isFinite(prefs.scoreVolume) ? Math.max(0, Math.min(1, prefs.scoreVolume)) : .34;
  const save = () => { try { localStorage.setItem('worldstream-atmosphere', JSON.stringify(prefs)); } catch {} };
  const weather = createWeatherLayer({ canvas: query('#weather-canvas'), environment: query('#world-backdrop'),
    readingColumn: query('main'), flashesOff: !prefs.flashes });
  const sceneWeather = createWeatherLayer({ canvas: query('#scene-weather-canvas'),
    environment: query('#scene-layer .stage'), readingColumn: query('#scene-layer .dialogue'), flashesOff: !prefs.flashes });
  const sprites = createRoadSpriteLayer({ layer: query('#road-sprite-layer') });
  let world = null, scene = null, audio = null, destroyed = false;

  function apply() {
    if (!world) return;
    const context = deriveAtmosphere(world, scene);
    document.body.dataset.weather = context.weatherCode;
    weather.setEnabled(prefs.motion && !scene);
    weather.update(world);
    sceneWeather.setEnabled(prefs.motion && Boolean(scene));
    if (scene) sceneWeather.update(world, scene);
    sprites.update(deriveAtmosphere(world), { enabled: prefs.creatures, motion: prefs.motion, sceneOpen: Boolean(scene) });
    onCreatures(prefs.creatures && prefs.motion && !scene && !['heavy_rain', 'storm'].includes(context.weatherCode));
    audio?.apply(context);
    audio?.setDucked(Boolean(scene));
    document.body.classList.toggle('atmosphere-still', !prefs.motion);
  }
  const listeners = [];
  function listen(element, event, callback) {
    element?.addEventListener(event, callback);
    if (element) listeners.push(() => element.removeEventListener(event, callback));
  }
  if (motion) motion.checked = prefs.motion;
  if (flashes) flashes.checked = prefs.flashes;
  if (creatures) creatures.checked = prefs.creatures;
  if (scoreVolume) scoreVolume.value = Math.round(prefs.scoreVolume * 100);
  listen(motion, 'change', () => { prefs.motion = motion.checked; save(); apply(); });
  listen(flashes, 'change', () => { prefs.flashes = flashes.checked; save();
    weather.setFlashesOff(!prefs.flashes); sceneWeather.setFlashesOff(!prefs.flashes); });
  listen(creatures, 'change', () => { prefs.creatures = creatures.checked; save(); apply(); });
  listen(scoreVolume, 'input', () => { prefs.scoreVolume = Number(scoreVolume.value) / 100; save(); onVolume(prefs.scoreVolume); });
  listen(sound, 'change', () => audio?.setEnabled(sound.checked));
  listen(volume, 'input', () => audio?.setVolume(Number(volume.value) / 100));
  // Media is never requested until the reader has opted in to this channel.
  fetch('/api/ambient-sources').then(r => r.ok ? r.json() : null).then(data => {
    if (destroyed || !data?.sources) return;
    audio = createAmbientAudio({ sources: data.sources, onState(state) {
      if (sound) sound.checked = state.enabled;
      if (volume) volume.value = Math.round(state.volume * 100);
      if (soundStatus) soundStatus.textContent = !state.enabled ? 'Sound is off.'
        : state.status === 'blocked' ? 'Tap Sounds again to allow playback.'
        : state.hidden ? 'Paused while this tab is hidden.'
        : state.playing ? 'Environmental sound on.' : 'Quiet here.';
    } });
    apply();
  }).catch(() => { if (soundStatus) soundStatus.textContent = 'Environmental sound unavailable.'; });
  // A remembered choice can resume on a gesture; a browser rejection stays honest.
  listen(document, 'pointerdown', () => audio?.resume());
  listen(document, 'visibilitychange', () => {
    document.body.classList.toggle('page-hidden', document.hidden);
    audio?.setHidden(document.hidden);
  });

  return {
    update(value) { world = value; apply(); },
    setScene(value) { scene = value; apply(); },
    scoreVolume: () => prefs.scoreVolume,
    destroy() { destroyed = true; listeners.forEach(fn => fn()); weather.destroy(); sceneWeather.destroy(); sprites.destroy(); audio?.destroy(); },
  };
}
