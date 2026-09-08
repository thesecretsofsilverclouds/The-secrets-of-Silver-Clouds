// Cosmetic rendering only. No fetches, canonical writes, world clocks or timers
// that invent weather. The public projection (or pinned scene) owns the context.
const CODES = new Set(['clear', 'cloudy', 'light_rain', 'heavy_rain', 'storm', 'fog', 'snow']);
const PHASES = new Set(['dawn', 'day', 'dusk', 'night']);
const RAIN = { light_rain: .34, heavy_rain: .72, storm: 1 };
const OUTDOOR_ROOMS = new Set(['training', 'training grounds', 'the training grounds', 'outdoor training grounds', 'outdoor yard', 'plaza', 'open air']);
const INTERIORS = new Set(['mi6', 'sanctuary', 'enchanted_ink', 'cafe']);
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const normal = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const mod = (number, divisor) => ((number % divisor) + divisor) % divisor;

// Reviewed art can be more specific than an event's location. Training events
// currently sometimes use an MI6 interior fallback: never rain through that art.
export function artworkExposure(url) {
  // Keyed on the file, not the path. The app moved from the site root to
  // /worldstream/app/, and hardcoding either prefix makes this silently wrong
  // for the other — which is what a passing rain layer over a rooftop looks
  // like. The question is which artwork it is, and the basename answers it.
  const art = String(url ?? '').split('/').pop();
  // `world-mi6-training.jpg` is here because the world says so: `mi6/training`
  // is `indoors: false` in places.mjs, and it has its own artwork rather than
  // borrowing an interior. It was being treated as sheltered, so the busiest
  // outdoor location in the simulation never saw weather — which is most of
  // what the weather layer was built for.
  if (['world-london-day.jpg', 'world-london-night.jpg', 'mi6rooftop.jpg',
    'world-mi6-training.jpg'].includes(art)) return 'outdoor';
  if (['world-streamliner-day.jpg', 'world-streamliner-night.jpg'].includes(art)) return 'transit';
  return 'sheltered';
}

/**
 * Pure public-context selection. sceneContext, when non-null, fully replaces
 * live inputs: {location, room|area, weather:{code}|weatherCode,
 * time:{daylight,dayPhase}|daylight|dayPhase, eventId?}. Missing historical
 * weather stays neutral; it never inherits today's rain. No caller is mutated.
 * Daylight is the published continuous London solar value, never local time.
 */
export function deriveAtmosphere(world = {}, sceneContext = null) {
  const pinned = sceneContext != null;
  const source = pinned ? sceneContext : world;
  const code = source.weather?.code ?? source.weatherCode;
  const weatherCode = CODES.has(code) ? code : 'cloudy';
  let location, room;
  if (pinned) {
    location = normal(source.location ?? source.scene?.location) || 'london';
    room = normal(source.room ?? source.area);
  } else {
    const people = Array.isArray(world.characters) ? world.characters : [];
    const first = people[0];
    const journey = first?.journey;
    const sharedTransit = journey && people.every(actor => actor.journey
      && actor.journey.from === journey.from && actor.journey.to === journey.to
      && actor.journey.departedAt === journey.departedAt && actor.journey.arrivesAt === journey.arrivesAt);
    const sharedPlace = first && people.every(actor => !actor.journey && actor.location === first.location);
    location = sharedTransit ? 'streamliner' : sharedPlace ? normal(first.location)
      : people.length ? 'london' : normal(world.scene?.location) || 'london';
    const rooms = sharedPlace ? people.map(actor => normal(actor.room ?? actor.area)) : [];
    room = rooms.length && rooms.every(value => value === rooms[0]) ? rooms[0] : '';
  }
  const exposure = pinned && ['outdoor', 'sheltered', 'transit'].includes(source.exposure) ? source.exposure
    : location === 'streamliner' ? 'transit'
    : OUTDOOR_ROOMS.has(room) || !INTERIORS.has(location) ? 'outdoor' : 'sheltered';
  const publishedPhase = source.time?.dayPhase ?? source.dayPhase;
  const fallbackPhase = source.daypart === 'night' ? 'night' : 'day';
  const dayPhase = PHASES.has(publishedPhase) ? publishedPhase : fallbackPhase;
  const daylight = clamp(finite(source.time?.daylight ?? source.daylight,
    { night: 0, dawn: .35, dusk: .2, day: 1 }[dayPhase]));
  return { source: pinned ? 'scene' : 'live', weatherCode, daylight, dayPhase, location, room, exposure,
    rain: exposure === 'outdoor' ? RAIN[weatherCode] ?? 0 : 0,
    wetness: RAIN[weatherCode] ?? (weatherCode === 'snow' ? .16 : 0),
    fog: exposure === 'outdoor' && weatherCode === 'fog' ? .48 : 0,
    lightning: exposure === 'outdoor' && weatherCode === 'storm',
    // Solar updates and observer/request IDs must not restart a weather blend.
    contextKey: JSON.stringify([pinned ? 'scene' : 'live', pinned ? source.eventId ?? null : null,
      weatherCode, location, room, exposure]),
  };
}

/**
 * createWeatherLayer({canvas, environment, readingColumn?, flashesOff=true,
 *   maxParticles=144, maxDpr=1.5, runtime?})
 * environment MUST be a scenery-only element, never the text/body surface.
 * It receives --atmosphere-daylight, --weather-wetness, --weather-fog and the
 * brief --weather-flash (<=.055), plus data-weather-code/exposure/motion.
 * API: update(world, sceneContext?), setFlashesOff(bool), setEnabled(bool),
 * resize(), destroy(), getState(). Reuse the instance; polling is idempotent.
 * runtime optionally injects window/document/mediaQuery, now, random and RAF
 * for a host or deterministic tests. No global browser access at import time.
 */
export function createWeatherLayer({ canvas, environment, readingColumn = null, flashesOff = true,
  maxParticles = 144, maxDpr = 1.5, runtime = {} } = {}) {
  const win = runtime.window ?? globalThis.window;
  const doc = runtime.document ?? globalThis.document;
  const media = runtime.mediaQuery ?? win?.matchMedia?.('(prefers-reduced-motion: reduce)');
  const now = runtime.now ?? (() => globalThis.performance?.now?.() ?? 0);
  const random = runtime.random ?? Math.random;
  const raf = runtime.requestAnimationFrame ?? win?.requestAnimationFrame?.bind(win);
  const cancel = runtime.cancelAnimationFrame ?? win?.cancelAnimationFrame?.bind(win);
  const context = canvas?.getContext?.('2d') ?? null;
  const cap = Math.floor(clamp(finite(maxParticles, 144), 0, 180));
  const dprCap = clamp(finite(maxDpr, 1.5), .5, 2);
  let enabled = true, destroyed = false, frame = null, target = null, current = { rain: 0, wetness: 0, fog: 0 };
  let transition = null, lastFrame = null, elapsed = 0, width = 1, height = 1, ratio = 1, needsMeasure = true;
  let particles = [], column = null, flash = 0, flashStart = null, nextFlash = 55_000 + random() * 45_000;
  const paused = () => destroyed || !enabled || doc?.visibilityState === 'hidden' || Boolean(media?.matches);
  const setVar = (key, value) => environment?.style?.setProperty(key, String(Math.round(value * 10_000) / 10_000));
  const clear = () => context?.clearRect(0, 0, width, height);

  function valuesAt(at) {
    if (!transition) return { ...current };
    const progress = smooth((at - transition.startedAt) / 10_000);
    const value = Object.fromEntries(['rain', 'wetness', 'fog'].map(key => [key,
      transition.from[key] + (transition.to[key] - transition.from[key]) * progress]));
    if (progress >= 1) { current = value; transition = null; }
    return value;
  }

  function paintEnvironment(values = current) {
    if (!target) return;
    setVar('--atmosphere-daylight', target.daylight);
    setVar('--weather-wetness', enabled ? values.wetness : 0);
    setVar('--weather-fog', enabled ? values.fog : 0);
    setVar('--weather-flash', paused() || flashesOff ? 0 : flash);
    if (environment?.dataset) {
      environment.dataset.weatherCode = target.weatherCode;
      environment.dataset.weatherExposure = target.exposure;
      environment.dataset.weatherMotion = !enabled ? 'off' : media?.matches ? 'reduced'
        : doc?.visibilityState === 'hidden' ? 'paused' : 'on';
    }
  }

  function sizeParticles() {
    // Absolute visible-time positions make motion independent of frame count.
    const count = Math.min(cap, Math.round(cap * clamp(width * height / 1_200_000, .3, 1)));
    if (particles.length !== count) particles = Array.from({ length: count }, (_, i) => ({
      x: random(), y: random(), phase: random() * Math.PI * 2,
      near: i >= Math.round(count * .78), speed: i >= Math.round(count * .78) ? 590 + random() * 90 : 220 + random() * 60,
    }));
  }

  function measure() {
    if (destroyed) return;
    const rect = canvas?.getBoundingClientRect?.();
    width = clamp(finite(rect?.width, win?.innerWidth ?? 1) || 1, 1, 8192);
    height = clamp(finite(rect?.height, win?.innerHeight ?? 1) || 1, 1, 8192);
    ratio = Math.min(dprCap, Math.max(.25, finite(win?.devicePixelRatio, 1)), Math.sqrt(3_000_000 / (width * height)));
    if (canvas && context) {
      canvas.width = Math.max(1, Math.floor(width * ratio)); canvas.height = Math.max(1, Math.floor(height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
    const reading = readingColumn?.getBoundingClientRect?.();
    column = reading && Number.isFinite(reading.left) && Number.isFinite(reading.right)
      ? { left: reading.left - (rect?.left ?? 0), right: reading.right - (rect?.left ?? 0) }
      : { left: width * .29, right: width * .71 };
    sizeParticles();
  }

  function resize() {
    if (destroyed) return;
    measure();
    // The scene player may fit its stage later in this same resize event.
    // Measure once more on the next visible frame, after layout has settled.
    needsMeasure = true;
  }

  function readingWeight(x, near) {
    const outside = Math.max(column.left - x, x - column.right, 0);
    const edge = smooth(outside / Math.min(160, width * .15));
    return (near ? .025 : .075) + (1 - (near ? .025 : .075)) * edge;
  }

  function drawRain(values) {
    clear();
    if (!context || !target || target.exposure !== 'outdoor' || values.rain < .002) return;
    const night = 1 - target.daylight;
    context.strokeStyle = `rgb(${Math.round(86 + 100 * night)},${Math.round(108 + 96 * night)},${Math.round(139 + 93 * night)})`;
    const seconds = elapsed / 1000;
    for (let i = 0; i < particles.length; i++) {
      const drop = particles[i];
      // Fade a stable set in both depths, without recreating it on every poll.
      const indexInDepth = drop.near ? i - Math.round(particles.length * .78) : i;
      const depthCount = drop.near ? particles.length - Math.round(particles.length * .78) : Math.round(particles.length * .78);
      const strength = clamp(values.rain * depthCount - indexInDepth);
      if (strength === 0) continue;
      const length = (drop.near ? 18 : 8) * (.8 + values.rain * .35);
      const x = mod(drop.x * (width + 60) - drop.speed * seconds * .095
        + Math.sin(seconds / 11 + drop.phase) * 7, width + 60) - 30;
      const y = mod(drop.y * (height + 48) + drop.speed * seconds, height + 48) - 24;
      context.globalAlpha = strength * (drop.near ? .22 : .17) * readingWeight(x, drop.near);
      context.lineWidth = drop.near ? 1.05 : .65;
      context.beginPath(); context.moveTo(x, y); context.lineTo(x - length * .13, y + length); context.stroke();
    }
    context.globalAlpha = 1;
  }

  function animateFlash() {
    if (flashesOff || !target?.lightning || paused()) { flash = 0; flashStart = null; return; }
    if (flashStart == null && elapsed >= nextFlash) {
      flashStart = elapsed; nextFlash = elapsed + 55_000 + random() * 45_000;
    }
    if (flashStart == null) { flash = 0; return; }
    const t = (elapsed - flashStart) / 1400;
    flash = t < 1 ? Math.sin(Math.PI * t) ** 2 * .055 : 0;
    if (t >= 1) flashStart = null;
  }

  function schedule() {
    if (frame != null || paused() || !target || !raf) return;
    if (transition || (context && Math.max(current.rain, target.rain) > .002)
      || (!flashesOff && target.lightning)) frame = raf(step);
  }

  function step(timestamp) {
    frame = null;
    if (paused()) return;
    if (needsMeasure) { measure(); needsMeasure = false; }
    const at = finite(timestamp, now());
    if (lastFrame != null) elapsed += clamp(at - lastFrame, 0, 100);
    lastFrame = at;
    current = valuesAt(at); animateFlash(); paintEnvironment(current); drawRain(current); schedule();
  }

  function stopMotion() {
    if (frame != null) cancel?.(frame);
    frame = null; lastFrame = null; flash = 0; flashStart = null;
    nextFlash = elapsed + 55_000 + random() * 45_000;
    clear(); setVar('--weather-flash', 0);
  }

  function reconcile() {
    stopMotion();
    needsMeasure = true;
    if (target) {
      current = { rain: target.rain, wetness: target.wetness, fog: target.fog }; transition = null;
      paintEnvironment(current);
    }
    // Returning to a tab uses the present context, not a replay of missed rain.
    if (!paused()) schedule();
  }

  function update(world, sceneContext = null) {
    if (destroyed) return null;
    const next = deriveAtmosphere(world, sceneContext), at = now();
    const value = valuesAt(at);
    const enteringScene = next.source === 'scene' && target?.contextKey !== next.contextKey;
    const returningLive = target?.source === 'scene' && next.source === 'live';
    if (!target || paused() || enteringScene || returningLive) {
      current = { rain: next.rain, wetness: next.wetness, fog: next.fog }; transition = null;
    } else if (target.contextKey !== next.contextKey) {
      // No precipitation through an interior during its location dissolve.
      const from = { ...value, ...(next.exposure !== 'outdoor' ? { rain: 0, fog: 0 } : {}) };
      const to = { rain: next.rain, wetness: next.wetness, fog: next.fog };
      transition = ['rain', 'wetness', 'fog'].some(key => from[key] !== to[key]) ? { from, to, startedAt: at } : null;
      current = transition ? from : to;
    }
    const wasLightning = target?.lightning;
    target = next;
    if (target.lightning !== wasLightning) {
      flash = 0; flashStart = null; nextFlash = elapsed + 55_000 + random() * 45_000;
    }
    paintEnvironment(valuesAt(at));
    if (paused() || target.exposure !== 'outdoor') clear();
    if (paused()) stopMotion(); else schedule();
    return { ...target };
  }

  function setFlashesOff(value) {
    flashesOff = Boolean(value); flash = 0; flashStart = null;
    nextFlash = elapsed + 55_000 + random() * 45_000;
    setVar('--weather-flash', 0); schedule();
  }
  function setEnabled(value) {
    if (destroyed || enabled === Boolean(value)) return;
    enabled = Boolean(value); reconcile();
  }
  function destroy() {
    if (destroyed) return;
    destroyed = true; stopMotion();
    win?.removeEventListener?.('resize', resize); doc?.removeEventListener?.('visibilitychange', reconcile);
    if (media?.removeEventListener) media.removeEventListener('change', reconcile); else media?.removeListener?.(reconcile);
    for (const key of ['--weather-wetness', '--weather-fog', '--weather-flash']) setVar(key, 0);
  }
  function getState() {
    return { atmosphere: target ? { ...target } : null, rendered: valuesAt(now()), paused: paused(), enabled,
      reducedMotion: Boolean(media?.matches), flashesOff, framePending: frame != null, transitionActive: Boolean(transition),
      particleCount: particles.length, width, height, dpr: ratio, canvasPixels: (canvas?.width ?? 0) * (canvas?.height ?? 0),
      elapsedMs: elapsed, flash };
  }
  resize();
  win?.addEventListener?.('resize', resize); doc?.addEventListener?.('visibilitychange', reconcile);
  if (media?.addEventListener) media.addEventListener('change', reconcile); else media?.addListener?.(reconcile);
  return { update, setFlashesOff, setEnabled, resize, destroy, getState };
}
