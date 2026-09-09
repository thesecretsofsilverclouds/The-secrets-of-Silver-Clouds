// A local presentation channel: this module cannot observe/advance the world,
// create events, or choose music. It only interprets an already-public context.
const PREFERENCE_KEY = 'silver-clouds-ambient-audio';
const RAIN_LOOP_OVERLAP_MS = 400;
const isRainBed = key => key === 'rain_heavy' || key === 'rain_sheltered';
const clamp = (value, fallback = 0) => Number.isFinite(Number(value))
  ? Math.min(1, Math.max(0, Number(value))) : fallback;
const sourceFor = (sources, key) => {
  const item = sources?.[key];
  if (typeof item === 'string') return { url: item, automatic: true };
  return item?.url && item.automatic !== false ? item : null;
};

/** Unknown interiors and the canonically quiet Streamliner never get traffic. */
export function selectAmbientPlan(context = {}, sources = {}) {
  const exposure = context.travelling || context.location === 'streamliner' ? 'transit'
    : context.exposure ?? (context.sheltered === false ? 'outdoor' : 'sheltered');
  // Streamliner noise-cancellation charms: no invented engine/rain bed.
  if (exposure === 'transit') return { key: null, gain: 0, exposure };
  const rainfall = { rain: 0.55, light_rain: 0.35, heavy_rain: 0.8, storm: 1 }[context.weatherCode] ?? 0;
  if (rainfall > 0) {
    const amount = exposure === 'sheltered' ? context.wetness : context.rain;
    const rain = Number.isFinite(amount) ? clamp(amount) : rainfall;
    const key = exposure === 'sheltered' && sourceFor(sources, 'rain_sheltered')
      ? 'rain_sheltered' : sourceFor(sources, 'rain_heavy') ? 'rain_heavy' : null;
    // Gain attenuation is intentional; this is not a claim that the recording
    // itself has window acoustics. No ambiguous bus/building clip is selected.
    return { key, gain: key ? (0.18 + rain * 0.52) * (exposure === 'sheltered' ? 0.23 : 1) : 0, exposure };
  }
  if (exposure === 'outdoor' && sourceFor(sources, 'city')) return { key: 'city', gain: 0.24, exposure };
  return { key: null, gain: 0, exposure };
}

/**
 * createAmbientAudio({sources,onState})
 * apply({weatherCode,location,exposure,rain}) consumes only public atmosphere.
 * setEnabled/resume should be called from a user gesture. Remembered preference
 * may encounter autoplay blocking; state().status then becomes 'blocked' until
 * resume or an explicit enable. Hidden tabs pause immediately and restart only
 * when visible; scene ducking affects this channel independently from music.
 * runtime is optional dependency injection for tests (Audio/storage/timers).
 */
export function createAmbientAudio({ sources = {}, onState = () => {}, runtime = {} } = {}) {
  const makeAudio = runtime.createAudio ?? (() => new Audio());
  const now = runtime.now ?? (() => performance.now());
  const every = runtime.setInterval ?? ((fn, ms) => setInterval(fn, ms));
  const clear = runtime.clearInterval ?? (id => clearInterval(id));
  const fadeMs = Math.max(0, runtime.fadeMs ?? 1600);
  const doc = runtime.document === undefined ? globalThis.document : runtime.document;
  let storage = runtime.storage;
  if (storage === undefined) { try { storage = globalThis.localStorage; } catch { storage = null; } }
  let saved = {};
  try { saved = JSON.parse(storage?.getItem(PREFERENCE_KEY) ?? '{}') ?? {}; } catch { /* Private browsing. */ }
  let enabled = saved.enabled === true;
  let volume = typeof saved.volume === 'number' ? clamp(saved.volume, 0.35) : 0.35;
  let hidden = Boolean(doc?.hidden), ducked = false, destroyed = false;
  let blocked = false, failed = false, context = {}, desired = { key: null, gain: 0 };
  let timer = null, transition = null, lastNotice = '';
  const slots = [0, 1].map(() => ({ audio: null, key: null, ready: false, loading: false, level: 0,
    token: 0, errorListener: null, loopListener: null, retiring: false, loopAttempted: false }));

  function state() {
    const playing = slots.find(slot => slot.ready && slot.level > 0)?.key ?? null;
    return {
      enabled, volume, hidden, ducked, playing, desired: desired.key,
      status: destroyed ? 'destroyed' : !enabled ? 'off' : hidden ? 'paused'
        : blocked ? 'blocked' : failed ? 'unavailable' : slots.some(slot => slot.loading) ? 'loading'
          : playing ? 'playing' : 'quiet',
      fading: timer !== null,
    };
  }
  function notify() {
    const current = state(), encoded = JSON.stringify(current);
    if (encoded === lastNotice) return;
    lastNotice = encoded;
    try { onState(current); } catch { /* A control cannot break playback cleanup. */ }
  }
  function persist() {
    try { storage?.setItem(PREFERENCE_KEY, JSON.stringify({ enabled, volume })); } catch { /* Optional preference. */ }
  }
  function level(slot, value) {
    slot.level = clamp(value);
    if (slot.audio) slot.audio.volume = slot.level;
  }
  function release(slot) {
    slot.token += 1;
    if (slot.audio) {
      slot.audio.removeEventListener?.('error', slot.errorListener);
      slot.audio.removeEventListener?.('timeupdate', slot.loopListener);
      slot.audio.pause();
      slot.audio.removeAttribute('src');
      slot.audio.load();
    }
    Object.assign(slot, { key: null, ready: false, loading: false, level: 0, errorListener: null,
      loopListener: null, retiring: false, loopAttempted: false });
  }
  function cancelFade() {
    if (timer !== null) clear(timer);
    timer = null; transition = null;
  }
  function stopAll() { cancelFade(); slots.forEach(release); }
  // Scene dialogue stays clear without making an outdoor storm inaudible.
  function wantedGain() { return desired.gain * volume * (ducked ? isRainBed(desired.key) ? 0.6 : 0.24 : 1); }
  function fadeTo(key, duration = fadeMs) {
    const targets = slots.map(slot => slot.key === key && slot.ready && !slot.retiring ? wantedGain() : 0);
    if (transition?.key === key && transition.targets.every((value, index) => value === targets[index])) return;
    cancelFade();
    const starts = slots.map(slot => slot.level), started = now();
    const finish = () => {
      slots.forEach((slot, index) => {
        level(slot, targets[index]);
        if (!targets[index] && (slot.key !== key || slot.retiring) && !slot.loading) release(slot);
      });
      cancelFade(); notify();
    };
    if (!duration || starts.every((value, index) => value === targets[index])) { finish(); return; }
    transition = { key, targets };
    timer = every(() => {
      const fraction = Math.min(1, (now() - started) / duration);
      slots.forEach((slot, index) => level(slot, starts[index] + (targets[index] - starts[index]) * fraction));
      if (fraction >= 1) finish();
    }, 40);
    notify();
  }
  function fail(slot, token, error) {
    if (slot.token !== token || destroyed || !enabled || hidden) return;
    blocked = error?.name === 'NotAllowedError'; failed = !blocked;
    stopAll(); notify();
  }
  function watchRainLoop(slot) {
    if (!isRainBed(slot.key)) return;
    slot.loopListener = () => {
      const { audio } = slot;
      if (audio.currentTime < 1) slot.loopAttempted = false;
      const remaining = (audio.duration - audio.currentTime) * 1000;
      if (!Number.isFinite(remaining) || audio.duration < 2 || remaining <= 0
        || remaining > RAIN_LOOP_OVERLAP_MS || slot.loopAttempted || slot.retiring
        || !slot.ready || slot.key !== desired.key || timer !== null
        || destroyed || !enabled || hidden || slots.some(item => item.loading)) return;
      const next = slots.find(item => item !== slot && item.key === null);
      if (!next) return;
      // Reuse the channel's spare player for one short handoff. Native looping
      // remains the fallback if loading is late or playback is refused.
      slot.loopAttempted = true;
      release(next);
      if (!next.audio) next.audio = makeAudio();
      const token = next.token, key = slot.key;
      next.key = key; next.loading = true;
      next.audio.loop = true; next.audio.preload = 'auto'; level(next, 0);
      const loopFailed = error => {
        if (next.token !== token) return;
        if (slot.ready && slot.key === key) {
          release(next); slot.retiring = false; fadeTo(desired.key, 100); notify();
        } else fail(next, token, error);
      };
      next.errorListener = () => loopFailed({ name: 'MediaError' });
      next.audio.addEventListener?.('error', next.errorListener);
      next.audio.src = sourceFor(sources, key).url;
      let playback;
      try { playback = next.audio.play(); } catch (error) { loopFailed(error); return; }
      Promise.resolve(playback).then(() => {
        if (next.token !== token || destroyed || !enabled || hidden) return;
        if (desired.key !== key) { release(next); return; }
        next.ready = true; next.loading = false; slot.retiring = true;
        watchRainLoop(next);
        fadeTo(key, Math.max(40, Math.min(RAIN_LOOP_OVERLAP_MS,
          (audio.duration - audio.currentTime) * 1000)));
        notify();
      }, loopFailed);
    };
    slot.audio.addEventListener?.('timeupdate', slot.loopListener);
  }
  function reconcile(short = false) {
    desired = selectAmbientPlan(context, sources);
    if (destroyed || !enabled || hidden || volume === 0) { stopAll(); notify(); return; }
    if (blocked || failed) { notify(); return; }
    const key = desired.key;
    for (const slot of slots) if (slot.loading && slot.key !== key) release(slot);
    if (!key) { fadeTo(null, short ? 350 : fadeMs); notify(); return; }
    const current = slots.find(slot => slot.key === key && !slot.retiring);
    if (current?.ready) { fadeTo(key, short ? 350 : fadeMs); notify(); return; }
    if (current?.loading) { notify(); return; }
    cancelFade();
    const slot = slots.find(item => item.key === null) ?? [...slots].sort((a, b) => a.level - b.level)[0];
    release(slot);
    if (!slot.audio) slot.audio = makeAudio();
    const token = slot.token;
    slot.key = key; slot.loading = true;
    slot.audio.loop = true; slot.audio.preload = 'auto'; level(slot, 0);
    slot.errorListener = () => fail(slot, token, { name: 'MediaError' });
    slot.audio.addEventListener?.('error', slot.errorListener);
    slot.audio.src = sourceFor(sources, key).url;
    // Call synchronously so the browser still recognises an enable/resume gesture.
    let playback;
    try { playback = slot.audio.play(); } catch (error) { fail(slot, token, error); return; }
    Promise.resolve(playback).then(() => {
      if (slot.token !== token || destroyed || !enabled || hidden) return;
      slot.ready = true; slot.loading = false;
      watchRainLoop(slot);
      fadeTo(desired.key); notify();
    }, error => fail(slot, token, error));
    notify();
  }
  function setHidden(value) {
    if (destroyed || hidden === Boolean(value)) return;
    hidden = Boolean(value); reconcile();
  }
  const visibility = () => setHidden(doc.hidden);
  doc?.addEventListener?.('visibilitychange', visibility);
  notify();
  return Object.freeze({
    apply(next = {}) {
      if (destroyed) return;
      context = { ...next };
      if (typeof next.hidden === 'boolean') hidden = next.hidden;
      reconcile();
    },
    setEnabled(value) {
      if (destroyed) return;
      enabled = Boolean(value); blocked = false; failed = false; persist(); reconcile();
    },
    setVolume(value) {
      if (destroyed) return;
      volume = clamp(value, volume); persist(); reconcile(true);
    },
    setDucked(value) {
      if (destroyed || ducked === Boolean(value)) return;
      ducked = Boolean(value); reconcile(true);
    },
    setHidden,
    resume() { if (!destroyed && enabled) { blocked = false; failed = false; reconcile(); } },
    state,
    destroy() {
      if (destroyed) return;
      destroyed = true; stopAll(); doc?.removeEventListener?.('visibilitychange', visibility); notify();
    },
  });
}
