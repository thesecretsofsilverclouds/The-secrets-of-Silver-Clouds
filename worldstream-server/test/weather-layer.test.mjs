import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveAtmosphere, createWeatherLayer } from '../../worldstream/app/weather-layer.js';

function projection(code = 'heavy_rain', location = 'big_ben_plaza', room = 'the plaza') {
  return { weather: { code, description: 'Published weather' }, time: { daylight: .18, dayPhase: 'dusk' },
    scene: { location }, characters: ['goaden', 'ashai'].map(id => ({ id, location, room, journey: null })),
    resolvedThrough: 1_789_000_000_000 };
}

function target(properties = {}) {
  const handlers = new Map();
  return { ...properties,
    addEventListener(name, fn) { if (!handlers.has(name)) handlers.set(name, new Set()); handlers.get(name).add(fn); },
    removeEventListener(name, fn) { handlers.get(name)?.delete(fn); },
    emit(name) { for (const fn of handlers.get(name) ?? []) fn(); },
    listenerCount() { return [...handlers.values()].reduce((sum, list) => sum + list.size, 0); },
  };
}

function host({ reduced = false, hidden = false, width = 1400, height = 900, dpr = 1 } = {}) {
  let time = 0, nextId = 0, seed = 7421;
  const frames = new Map(), variables = new Map();
  const document = target({ visibilityState: hidden ? 'hidden' : 'visible' });
  const mediaQuery = target({ matches: reduced });
  const window = target({ innerWidth: width, innerHeight: height, devicePixelRatio: dpr });
  const context = { segments: [], globalAlpha: 1, strokeStyle: '', lineWidth: 1,
    clearRect() { this.segments = []; }, setTransform(...values) { this.transform = values; },
    beginPath() {}, moveTo(x, y) { this.start = [x, y]; },
    lineTo(x, y) { this.end = [x, y]; },
    stroke() { this.segments.push({ start: [...this.start], end: [...this.end], alpha: this.globalAlpha, width: this.lineWidth }); },
  };
  const canvas = { width: 0, height: 0, getContext: () => context,
    getBoundingClientRect: () => ({ left: 0, top: 0, width, height }) };
  const environment = { dataset: {}, style: { setProperty: (key, value) => variables.set(key, value) } };
  const runtime = { window, document, mediaQuery, now: () => time,
    random() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; },
    requestAnimationFrame(fn) { const id = ++nextId; frames.set(id, fn); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
  };
  return { canvas, context, environment, runtime, document, mediaQuery, window, variables,
    tick(at) { time = at; const ready = [...frames.values()]; frames.clear(); for (const callback of ready) callback(at); },
    setTime(at) { time = at; }, frames,
    layer(options = {}) { return createWeatherLayer({ canvas, environment, runtime, ...options }); },
  };
}

test('public location, actual room and shared journey determine exposure without mutating the world', () => {
  const outside = projection(), before = structuredClone(outside);
  assert.equal(deriveAtmosphere(outside).exposure, 'outdoor');
  const mi6 = projection('heavy_rain', 'mi6', 'the common room');
  const indoors = deriveAtmosphere(mi6);
  assert.equal(indoors.exposure, 'sheltered'); assert.equal(indoors.rain, 0); assert.ok(indoors.wetness > 0);
  assert.equal(deriveAtmosphere(projection('light_rain', 'mi6', 'the training grounds')).exposure, 'outdoor');
  mi6.characters[0].room = 'the training grounds';
  assert.equal(deriveAtmosphere(mi6).exposure, 'sheltered', 'mixed rooms do not imply a shared outdoor viewpoint');
  const transit = projection('storm', 'streamliner', 'the carriage');
  const journey = { from: 'mi6', to: 'sanctuary', departedAt: 10, arrivesAt: 20 };
  transit.characters.forEach(actor => { actor.journey = { ...journey }; });
  assert.equal(deriveAtmosphere(transit).exposure, 'transit'); assert.equal(deriveAtmosphere(transit).lightning, false);
  transit.characters[1].journey.to = 'mi6';
  assert.equal(deriveAtmosphere(transit).location, 'london', 'separate journeys use the neutral city viewpoint');
  assert.deepEqual(outside, before);
});

test('an archive context stays pinned when live weather, daylight and character locations change', () => {
  const historical = { eventId: 'earlier-scene', location: 'enchanted_ink', room: 'venue',
    weather: { code: 'clear' }, time: { daylight: .8, dayPhase: 'day' } };
  const world = projection('storm'), before = structuredClone(historical);
  const first = deriveAtmosphere(world, historical);
  world.weather.code = 'snow'; world.time.daylight = 0; world.characters = [];
  assert.deepEqual(deriveAtmosphere(world, historical), first);
  assert.equal(first.weatherCode, 'clear'); assert.equal(first.daylight, .8); assert.equal(first.exposure, 'sheltered');
  const unknownHistoricWeather = deriveAtmosphere(projection('storm'), { location: 'big_ben_plaza', dayPhase: 'night' });
  assert.equal(unknownHistoricWeather.weatherCode, 'cloudy'); assert.equal(unknownHistoricWeather.rain, 0);
  assert.equal(unknownHistoricWeather.daylight, 0); assert.deepEqual(historical, before);
});

test('ten-second weather blend is not restarted by polling or solar updates; archive entry is immediate', () => {
  const h = host(), layer = h.layer();
  const rain = projection('heavy_rain'); layer.update(rain); h.tick(0);
  assert.equal(layer.getState().transitionActive, false, 'arrival starts in the current recorded weather');
  h.setTime(1000); const clear = projection('clear'); layer.update(clear);
  h.setTime(6000); const midpoint = layer.getState().rendered.rain;
  assert.ok(midpoint > 0 && midpoint < .72);
  clear.resolvedThrough += 5000; clear.time.daylight = .181;
  layer.setEnabled(true); layer.update(clear); // The integration reapplies controls on every poll.
  assert.equal(layer.getState().rendered.rain, midpoint);
  h.tick(11_000); assert.equal(layer.getState().rendered.rain, 0);
  assert.equal(layer.getState().transitionActive, false); assert.equal(h.frames.size, 0);
  layer.update(projection('storm')); h.tick(11_010);
  layer.update(projection('storm'), { eventId: 'archive', location: 'big_ben_plaza', weatherCode: 'clear', dayPhase: 'day' });
  assert.equal(layer.getState().rendered.rain, 0); assert.equal(layer.getState().transitionActive, false);
  layer.update(projection('heavy_rain', 'mi6', 'the quarters'));
  assert.equal(layer.getState().rendered.rain, 0); assert.equal(h.context.segments.length, 0);
  layer.destroy();
});

test('two rain depths protect the reading column and have bounded backing pixels and particles', () => {
  const h = host({ width: 2400, height: 1600, dpr: 4 }), layer = h.layer({ maxParticles: 10_000, maxDpr: 4 });
  layer.update(projection('storm')); h.tick(0); h.tick(16);
  assert.ok(layer.getState().particleCount <= 180);
  assert.ok(layer.getState().dpr <= 2); assert.ok(layer.getState().canvasPixels <= 3_000_000);
  const lines = h.context.segments;
  assert.ok(lines.some(line => line.width < 1) && lines.some(line => line.width > 1), 'both depths are drawn');
  const centre = lines.filter(line => line.start[0] > 2400 * .3 && line.start[0] < 2400 * .7);
  const edges = lines.filter(line => line.start[0] < 2400 * .2 || line.start[0] > 2400 * .8);
  assert.ok(centre.length && edges.length);
  assert.ok(Math.max(...edges.map(line => line.alpha)) > Math.max(...centre.map(line => line.alpha)) * 5);
  layer.destroy();
});

test('rain travels the same distance at 30 and 120 frames per second', () => {
  function frameAt(fps) {
    const h = host(), layer = h.layer(); layer.update(projection()); h.tick(0);
    for (let i = 1; i <= fps; i++) h.tick(i * 1000 / fps);
    const positions = h.context.segments.map(line => line.start.map(value => Math.round(value * 1e6) / 1e6));
    layer.destroy(); return positions;
  }
  assert.deepEqual(frameAt(30), frameAt(120));
});

test('a hidden scene canvas is remeasured after opening and the player fits its stage', () => {
  const h = host(); let stageSize = { width: 0, height: 0 };
  h.canvas.getBoundingClientRect = () => ({ left: 100, top: 80, ...stageSize });
  const layer = h.layer(); layer.setEnabled(false);
  assert.equal(layer.getState().width, 1);
  stageSize = { width: 1280, height: 720 }; layer.setEnabled(true);
  layer.update({}, { location: 'big_ben_plaza', weatherCode: 'heavy_rain' });
  // fit() runs after atmosphere.setScene(), before the browser's next frame.
  stageSize = { width: 800, height: 450 }; h.tick(0);
  assert.equal(layer.getState().width, 800); assert.equal(layer.getState().height, 450);
  assert.ok(h.canvas.width > 1 && h.context.segments.some(line => line.start[0] > 100));
  h.window.emit('resize'); // Weather listener runs before the player's fit listener.
  stageSize = { width: 600, height: 338 }; h.tick(16);
  assert.equal(layer.getState().width, 600); assert.equal(layer.getState().height, 338);
  layer.destroy();
});

test('hidden/reduced-motion changes stop work, clear rain and resume without jumping through missed time', () => {
  const h = host(), layer = h.layer({ flashesOff: false }); layer.update(projection('storm')); h.tick(0); h.tick(50);
  assert.equal(h.frames.size, 1); const before = layer.getState().elapsedMs;
  h.document.visibilityState = 'hidden'; h.document.emit('visibilitychange');
  assert.equal(h.frames.size, 0); assert.equal(h.context.segments.length, 0); assert.equal(h.variables.get('--weather-flash'), '0');
  h.setTime(3_600_000); layer.update(projection('light_rain')); assert.equal(h.frames.size, 0);
  h.document.visibilityState = 'visible'; h.document.emit('visibilitychange'); h.tick(3_600_000);
  assert.equal(layer.getState().elapsedMs, before); assert.equal(layer.getState().rendered.rain, .34);
  h.mediaQuery.matches = true; h.mediaQuery.emit('change');
  assert.equal(h.frames.size, 0); assert.equal(layer.getState().reducedMotion, true); assert.equal(h.context.segments.length, 0);
  h.mediaQuery.matches = false; h.mediaQuery.emit('change'); assert.equal(h.frames.size, 1);
  layer.setEnabled(false); assert.equal(h.frames.size, 0); assert.equal(h.variables.get('--weather-fog'), '0');
  layer.destroy(); assert.equal(h.window.listenerCount() + h.document.listenerCount() + h.mediaQuery.listenerCount(), 0);
  layer.update(projection('storm')); assert.equal(h.frames.size, 0);
});

test('reduced motion at creation and dry weather consume no animation frames', () => {
  const reduced = host({ reduced: true }), first = reduced.layer(); first.update(projection('storm'));
  assert.equal(reduced.frames.size, 0); assert.equal(reduced.context.segments.length, 0);
  const dry = host(), second = dry.layer(); second.update(projection('clear'));
  for (let n = 0; n < 8; n++) { dry.setTime(n * 5000); second.update(projection('clear')); }
  assert.equal(dry.frames.size, 0); assert.equal(second.getState().transitionActive, false);
  first.destroy(); second.destroy();
});

test('lightning is rare, scenery-only, restrained and immediately disabled by flashes-off', () => {
  const h = host(), layer = h.layer(); layer.update(projection('storm'));
  assert.equal(layer.getState().flashesOff, true, 'flashes default off');
  layer.setFlashesOff(false); h.tick(0);
  let maximum = 0, starts = 0, previous = 0;
  for (let at = 50; at <= 110_000; at += 50) {
    if (at % 5000 === 0) { layer.setEnabled(true); layer.update(projection('storm')); }
    h.tick(at); const value = Number(h.variables.get('--weather-flash'));
    if (value > 0 && previous === 0) starts++;
    maximum = Math.max(maximum, value); previous = value;
  }
  assert.ok(starts >= 1 && starts <= 2); assert.ok(maximum > 0 && maximum <= .055);
  layer.setFlashesOff(true); assert.equal(h.variables.get('--weather-flash'), '0');
  for (let at = 110_050; at < 180_000; at += 50) h.tick(at);
  assert.equal(h.variables.get('--weather-flash'), '0');
  layer.setFlashesOff(false); layer.update(projection('storm', 'streamliner', 'carriage'));
  assert.equal(layer.getState().atmosphere.lightning, false); assert.equal(h.variables.get('--weather-flash'), '0');
  layer.destroy();
});
