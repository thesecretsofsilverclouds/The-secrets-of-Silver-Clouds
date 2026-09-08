// Browser-only reading state. Fetching a world does not mean somebody read it.
const fingerprint = event => JSON.stringify([event.description, event.prose, event.lines, event.cinematic]);
const descending = (a, b) => Number(b.occurredAt) - Number(a.occurredAt) || b.id.localeCompare(a.id);

// A change of reading viewpoint, never a change to the canonical world.
export function passageEffectPlan(event, world) {
  if (!event?.id) return null;
  const elsewhere = /^OFFSCREEN_(START|RESULT)$/.test(event.type)
    && Array.isArray(world?.characters) && world.characters.length > 0
    && world.characters.every(person => person.location !== event.location);
  const image = elsewhere && /^\/scene\/[a-zA-Z0-9_.-]+\.(?:jpg|jpeg|png|webp)$/.test(event.backgroundUrl ?? '')
    ? event.backgroundUrl : null;
  const words = String(event.prose || event.cinematic?.scene?.openingNarration || '').trim().split(/\s+/).length;
  return { key: `${world?.continuityId || world?.worldId || 'world'}:${event.id}`, image,
    holdMs: Math.min(30000, Math.max(12000, words * 280)) };
}

export function createPassageEffects({ document = globalThis.document, runtime = {} } = {}) {
  const card = document.querySelector('#latest-passage');
  if (!card) return { update() {}, destroy() {} };
  const win = runtime.window ?? globalThis.window;
  const later = runtime.setTimeout ?? globalThis.setTimeout, clear = runtime.clearTimeout ?? globalThis.clearTimeout;
  const Intersection = runtime.IntersectionObserver ?? globalThis.IntersectionObserver;
  const Mutation = runtime.MutationObserver ?? globalThis.MutationObserver;
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
  let storage; try { storage = win.sessionStorage; } catch {}
  let seen; try { seen = new Set(JSON.parse(storage?.getItem('silver-clouds-passage-effects') || '[]')); } catch { seen = new Set(); }
  let plan = null, visible = false, timer = null, active = null;
  const stop = () => { clear(timer); timer = null; active = null;
    card.classList.remove('passage-spotlight', 'passage-elsewhere'); };
  const allowed = () => visible && !card.hidden && !document.hidden && document.body.dataset.reading === 'true'
    && !document.body.classList.contains('scene-open') && !document.body.classList.contains('atmosphere-still') && !motion.matches;
  const sync = () => {
    document.body.dataset.readingFxHidden = String(document.hidden);
    if (!plan || !allowed()) { stop(); return; }
    if (active === plan.key || seen.has(plan.key)) return;
    stop(); active = plan.key; seen.add(plan.key); seen = new Set([...seen].slice(-80));
    try { storage?.setItem('silver-clouds-passage-effects', JSON.stringify([...seen])); } catch {}
    if (plan.image) card.style.setProperty('--passage-art', `url("${plan.image}")`);
    card.classList.add('passage-spotlight');
    card.classList.toggle('passage-elsewhere', Boolean(plan.image));
    timer = later(stop, plan.holdMs);
  };
  const observer = typeof Intersection === 'function' ? new Intersection(entries => {
    const entry = entries.find(row => row.target === card);
    if (entry) { visible = entry.isIntersecting && (entry.intersectionRatio >= .35 || entry.intersectionRect.height >= 200); sync(); }
  }, { threshold: [0, .35, .6] }) : null;
  observer?.observe(card);
  const changes = typeof Mutation === 'function' ? new Mutation(sync) : null;
  changes?.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-reading'] });
  document.addEventListener('visibilitychange', sync); motion.addEventListener?.('change', sync);
  return {
    update(event, world) {
      const next = passageEffectPlan(event, world);
      if (next?.key !== plan?.key || next?.image !== plan?.image) stop();
      plan = next;
      const label = card.querySelector('.passage-label');
      if (label) label.textContent = plan?.image ? 'Elsewhere · latest passage' : 'Latest passage';
      sync();
    },
    destroy() { stop(); observer?.disconnect(); changes?.disconnect();
      document.removeEventListener('visibilitychange', sync); motion.removeEventListener?.('change', sync); }
  };
}

export class ReadingFeedBuffer {
  constructor() { this.scope = null; this.shown = []; this.incoming = []; }
  update(scope, incoming) {
    if (this.scope !== scope) { this.scope = scope; this.shown = []; this.incoming = []; }
    this.incoming = [...new Map([...this.incoming, ...incoming].map(event => [event.id, event])).values()].sort(descending).slice(0, 200);
    if (!this.shown.length) this.shown = this.incoming;
    return this.state();
  }
  state() {
    const known = new Map(this.shown.map(event => [event.id, event]));
    const added = this.incoming.filter(event => !known.has(event.id)).length;
    const revised = this.incoming.some(event => known.has(event.id) && fingerprint(event) !== fingerprint(known.get(event.id)));
    return { events: this.shown, added, revised, pending: added > 0 || revised };
  }
  reveal() {
    // An explicit request may update passages. Keep earlier rendered rows so
    // opening the newest moment does not destroy the rest of this visit.
    const merged = new Map([...this.shown, ...this.incoming].map(event => [event.id, event]));
    this.shown = [...merged.values()].sort(descending).slice(0, 200);
    return this.state();
  }
}

// Stable event nodes preserve selection, focus, expanded controls and media.
// Matching rows are never detached/reinserted merely because a poll completed.
export function reconcileReadingRows(container, events, render, { replaceChanged = false } = {}) {
  const existing = new Map([...container.children].map(row => [row.dataset.eventId, row]));
  const desired = new Set(events.map(event => event.id));
  let cursor = container.firstElementChild;
  for (const event of events) {
    let row = existing.get(event.id);
    const signature = fingerprint(event);
    if (row && replaceChanged && row.dataset.readingSignature !== signature) {
      const replacement = render(event); row.replaceWith(replacement); if (cursor === row) cursor = replacement; row = replacement;
    }
    if (!row) row = render(event);
    row.dataset.readingSignature = signature;
    row.dataset.readingAnchor = event.id;
    if (row !== cursor) container.insertBefore(row, cursor);
    cursor = row.nextElementSibling;
  }
  for (const row of [...container.children]) if (!desired.has(row.dataset.eventId)) row.remove();
}

export function captureReadingPosition(doc = document, win = window) {
  const selection = doc.getSelection?.();
  const selected = selection && !selection.isCollapsed ? selection.anchorNode?.parentElement?.closest('[data-reading-anchor]') : null;
  if (!selected && win.scrollY < 100) return () => {};
  const anchor = selected || [...doc.querySelectorAll('[data-reading-anchor]')].find(element => {
    const box = element.getBoundingClientRect(); return box.bottom > 70 && box.top < win.innerHeight - 80;
  });
  if (!anchor) return () => {};
  const top = anchor.getBoundingClientRect().top;
  return () => {
    if (!anchor.isConnected) return;
    const delta = anchor.getBoundingClientRect().top - top;
    if (Math.abs(delta) > .5) win.scrollBy({ top: delta, behavior: 'instant' });
  };
}

export function createReadingView({ onViewed = () => {}, runtime = {} } = {}) {
  const document = runtime.document ?? globalThis.document;
  const storage = runtime.storage ?? (() => { try { return globalThis.localStorage; } catch { return null; } })();
  const Intersection = runtime.IntersectionObserver ?? globalThis.IntersectionObserver;
  const Mutation = runtime.MutationObserver ?? globalThis.MutationObserver;
  const later = runtime.setTimeout ?? globalThis.setTimeout;
  const clearLater = runtime.clearTimeout ?? globalThis.clearTimeout;
  const toggle = document.querySelector('#reading-view-toggle');
  const overview = document.querySelector('#world-overview');
  let enabled = true;
  try { enabled = storage?.getItem('silver-clouds-reading-view') !== 'off'; } catch {}
  function paint() {
    document.body.dataset.reading = String(enabled);
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(enabled));
      toggle.textContent = enabled ? 'Cinematic mode' : 'Reading view';
      toggle.title = enabled ? 'Switch to Cinematic mode' : 'Switch to Reading view';
      toggle.setAttribute('aria-label', enabled ? 'Switch to Cinematic mode' : 'Switch to Reading view');
    }
    if (overview) overview.open = !enabled;
    const history = document.querySelector('.history');
    if (overview && history) {
      if (enabled && history.nextElementSibling !== overview) overview.before(history);
      if (!enabled && overview.nextElementSibling !== history) overview.after(history);
    }
  }
  const toggleReading = () => {
    enabled = !enabled; paint();
    try { storage?.setItem('silver-clouds-reading-view', enabled ? 'on' : 'off'); } catch {}
  };
  toggle?.addEventListener('click', toggleReading);
  paint();
  const visible = new Map(), waiting = new Map(), observed = new WeakSet(), contentIds = new Map();
  let byId = new Map();
  const cancel = element => { clearLater(waiting.get(element)?.timer); waiting.delete(element); };
  const arm = element => {
    cancel(element);
    if (document.hidden || document.body.classList.contains('scene-open')) return;
    const ticket = { eventId: element.dataset.eventId, timer: null };
    ticket.timer = later(() => {
      if (waiting.get(element) !== ticket) return;
      waiting.delete(element);
      if (!document.hidden && !document.body.classList.contains('scene-open') && element.isConnected
        && visible.get(element) && element.dataset.eventId === ticket.eventId) {
        const event = byId.get(ticket.eventId); if (event) onViewed(event);
      }
    }, 1800);
    waiting.set(element, ticket);
  };
  const observer = typeof Intersection === 'function' ? new Intersection(entries => {
    for (const entry of entries) {
      const enough = entry.isIntersecting && (entry.intersectionRatio >= .5 || entry.intersectionRect.height >= 240);
      visible.set(entry.target, enough);
      if (enough) arm(entry.target); else cancel(entry.target);
    }
  }, { threshold: [0, .25, .5, .75, 1], rootMargin: '0px 0px -75px 0px' }) : null;
  const visibility = () => {
    for (const element of waiting.keys()) cancel(element);
    if (!document.hidden) for (const [element, enough] of visible) if (enough) arm(element);
  };
  document.addEventListener('visibilitychange', visibility);
  let sceneOpen = document.body.classList.contains('scene-open');
  const sceneObserver = typeof Mutation === 'function' ? new Mutation(() => {
    const next = document.body.classList.contains('scene-open');
    if (next === sceneOpen) return;
    sceneOpen = next; visibility();
  }) : null;
  sceneObserver?.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  return {
    observe(events) {
      byId = new Map(events.map(event => [event.id, event]));
      for (const element of document.querySelectorAll('.event[data-event-id], #latest-passage[data-event-id]')) {
        if (!observed.has(element)) { observed.add(element); observer?.observe(element); }
        if (contentIds.get(element) !== element.dataset.eventId) {
          contentIds.set(element, element.dataset.eventId);
          cancel(element);
          if (visible.get(element)) arm(element);
        }
      }
      for (const element of contentIds.keys()) if (!element.isConnected) {
        cancel(element); visible.delete(element); contentIds.delete(element); observer?.unobserve(element);
      }
    },
    destroy() {
      observer?.disconnect(); sceneObserver?.disconnect();
      for (const element of waiting.keys()) cancel(element);
      contentIds.clear(); visible.clear(); document.removeEventListener('visibilitychange', visibility);
      toggle?.removeEventListener('click', toggleReading);
    },
  };
}
