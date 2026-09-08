// Pure helpers for the Worldstream cinematic player.  Keeping timing, excerpt
// selection and inbox behaviour free of DOM state makes the expensive edge
// cases testable without a browser or a model call.

export const AUTO_SCENE_MAX_MS = 60_000;
export const TYPE_CHARACTERS_PER_SECOND = 44;
export const SCENE_CLOSE_MS = 1_600;
const READING_WORDS_PER_MINUTE = 210;

export function lineReadingHoldMs(line, { instantText = false, final = false } = {}) {
  const text = typeof line?.text === 'string' ? line.text : '';
  const words = text.trim() ? text.trim().split(/\s+/u).length : 0;
  const reading = words / READING_WORDS_PER_MINUTE * 60_000;
  const minimum = final ? 4_500
    : line?.kind === 'narration' ? 2_600 : 2_200;
  // Complete text receives a reading allowance in either presentation mode.
  // Completing a typewriter is never a one-second flash or a budget penalty.
  return Math.ceil(Math.max(minimum, reading + (final ? 1_600 : 900)));
}

export function linePlaybackMs(line, options = {}) {
  const text = typeof line?.text === 'string' ? line.text : '';
  const typing = options.instantText || line?.instant ? 0
    : Math.max(200, text.length / TYPE_CHARACTERS_PER_SECOND * 1_000) + 32;
  return Math.ceil(typing + lineReadingHoldMs(line, options));
}

function excerptDuration(lines, closeMs) {
  // Reserve enough for either local reading preference, including a preference
  // change halfway through playback. The canonical transcript stays untouched.
  return lines.reduce((sum, line, index) => sum + Math.max(
    linePlaybackMs(line, { final: index === lines.length - 1 }),
    linePlaybackMs(line, { final: index === lines.length - 1, instantText: true }),
  ), lines.length ? closeMs : 0);
}

export function cinematicLines(record) {
  const performed = record?.scene ?? record;
  if (!performed || typeof performed !== 'object') return [];
  const result = [];
  if (typeof performed.openingNarration === 'string' && performed.openingNarration.trim()) {
    result.push({ kind: 'narration', text: performed.openingNarration.trim() });
  }
  for (const beat of Array.isArray(performed.beats) ? performed.beats : []) {
    if (!beat || typeof beat.speaker !== 'string' || typeof beat.line !== 'string' || !beat.line.trim()) continue;
    result.push({ who: beat.speaker, plate: beat.plate ?? null,
      expression: beat.expression ?? 'idle', text: beat.line.trim() });
  }
  if (typeof performed.closingNarration === 'string' && performed.closingNarration.trim()) {
    result.push({ kind: 'narration', text: performed.closingNarration.trim() });
  }
  return result;
}

/**
 * Choose a live excerpt made only from complete accepted lines.  The archive
 * keeps the full scene; automatic presentation never slices prose or asks a
 * client to invent a bridge.  Opening and closing narration are retained when
 * they fit, then dialogue is admitted in source order.
 */
export function autoSceneExcerpt(source, maxMs = AUTO_SCENE_MAX_MS) {
  const lines = Array.isArray(source) ? source.filter((line) => line && typeof line.text === 'string') : [];
  const totalMs = excerptDuration(lines, SCENE_CLOSE_MS);
  if (totalMs <= maxMs) return { lines: lines.map((line) => ({ ...line })), durationMs: totalMs, excerpted: false };

  const opening = lines[0]?.kind === 'narration' ? lines[0] : null;
  const closing = lines.length > 1 && lines.at(-1)?.kind === 'narration' ? lines.at(-1) : null;
  const middleStart = opening ? 1 : 0;
  const middleEnd = closing ? lines.length - 1 : lines.length;
  const chosen = [];
  // An oversized first line remains available manually. Do not flash it instantly
  // or substitute an isolated ending merely to fill the automatic slot.
  if (lines.length && excerptDuration([lines[0]], SCENE_CLOSE_MS) > maxMs) {
    return { lines: [], durationMs: 0, excerpted: true };
  }
  if (opening) chosen.push({ ...opening });
  const reserveClosing = closing && excerptDuration([...chosen, closing], SCENE_CLOSE_MS) <= maxMs;
  for (let index = middleStart; index < middleEnd; index += 1) {
    if (excerptDuration([...chosen, lines[index], ...(reserveClosing ? [closing] : [])], SCENE_CLOSE_MS) > maxMs) break;
    chosen.push({ ...lines[index] });
  }
  if (reserveClosing) chosen.push({ ...closing });
  return { lines: chosen, durationMs: excerptDuration(chosen, SCENE_CLOSE_MS), excerpted: chosen.length < lines.length };
}

export class CinematicInbox {
  constructor() {
    this.items = [];
    this.known = new Set();
  }

  enqueue(record, { queue = true } = {}) {
    const id = String(record?.eventId ?? '').trim();
    if (!id || this.known.has(id)) return false;
    this.known.add(id);
    if (queue) this.items.push(record);
    return true;
  }

  take() {
    return this.items.shift() ?? null;
  }

  get size() {
    return this.items.length;
  }

  discard() {
    const count = this.items.length;
    this.items.length = 0;
    return count;
  }
}

/** Local accessibility preferences are unrelated to the shared scene cache. */
export class SceneReadingPreferences {
  constructor(storage = null) {
    this.storage = storage;
    this.key = 'silver-clouds-scene-reading';
    this.value = { autoScenes: true, instantText: false };
    this.autoRevision = 0;
    try { this.apply(JSON.parse(storage?.getItem(this.key) ?? '{}')); } catch { /* Optional storage. */ }
  }
  apply(value) {
    for (const key of ['autoScenes', 'instantText']) if (typeof value?.[key] === 'boolean') {
      if (key === 'autoScenes' && this.value[key] !== value[key]) this.autoRevision += 1;
      this.value[key] = value[key];
    }
  }
  get() { return { ...this.value }; }
  autoVersion() { return this.autoRevision; }
  set(value) {
    this.apply(value);
    try { this.storage?.setItem(this.key, JSON.stringify(this.value)); } catch { /* Private browsing. */ }
    return this.get();
  }
}

/** A timer counts visible, unpaused time; replacement and clear invalidate it. */
export class PausableSceneTimer {
  constructor({ now = () => performance.now(),
    setTimeout: schedule = (callback, delay) => globalThis.setTimeout(callback, delay),
    clearTimeout: cancel = handle => globalThis.clearTimeout(handle) } = {}) {
    Object.assign(this, { now, schedule, cancel, handle: null, callback: null, remaining: 0, started: null, paused: false, version: 0 });
  }
  set(callback, delay) {
    this.clear(); this.callback = callback; this.remaining = Math.max(0, delay); this.resume();
  }
  pause() {
    if (this.handle !== null) {
      this.cancel(this.handle); this.handle = null;
      this.remaining = Math.max(0, this.remaining - (this.now() - this.started));
    }
    this.started = null; this.paused = true; this.version += 1;
  }
  resume() {
    this.paused = false;
    if (!this.callback || this.handle !== null) return;
    this.started = this.now();
    const version = ++this.version;
    this.handle = this.schedule(() => {
      if (version !== this.version || this.paused) return;
      const callback = this.callback;
      this.handle = null; this.callback = null; this.started = null; this.remaining = 0;
      callback?.();
    }, this.remaining);
  }
  clear() {
    if (this.handle !== null) this.cancel(this.handle);
    this.handle = null; this.callback = null; this.remaining = 0; this.started = null; this.paused = false; this.version += 1;
  }
  remainingMs() { return this.handle === null ? this.remaining : Math.max(0, this.remaining - (this.now() - this.started)); }
}

export class SceneCloseLifecycle {
  constructor({ onStart = () => {}, onFinish = () => {}, runtime } = {}) {
    this.timer = new PausableSceneTimer(runtime); this.onStart = onStart; this.onFinish = onFinish; this.phase = 'idle';
  }
  begin({ immediate = false, reducedMotion = false } = {}) {
    if (this.phase === 'closed') return;
    if (immediate || reducedMotion) return this.finish();
    if (this.phase === 'closing') return;
    this.phase = 'closing'; this.onStart(); this.timer.set(() => this.finish(), SCENE_CLOSE_MS);
  }
  finish() {
    if (this.phase === 'closed') return;
    this.timer.clear(); this.phase = 'closed'; this.onFinish();
  }
  pause() { if (this.phase === 'closing') this.timer.pause(); }
  resume() { if (this.phase === 'closing') this.timer.resume(); }
  reset() { this.timer.clear(); this.phase = 'idle'; }
}

export function nextServerCursor(current, { acceptedAt = null, serverTime = null } = {}) {
  const safeCurrent = Number.isSafeInteger(current) && current >= 0 ? current : 0;
  if (Number.isSafeInteger(acceptedAt) && acceptedAt >= 0) return Math.max(safeCurrent, acceptedAt);
  if (Number.isSafeInteger(serverTime) && serverTime >= 0) return Math.max(safeCurrent, serverTime);
  return safeCurrent;
}
