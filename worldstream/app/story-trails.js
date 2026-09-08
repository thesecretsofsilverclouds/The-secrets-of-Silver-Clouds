// Presentation only: one lazy GET per expanded story revision. Reattach the same
// keyed <details> to a replacement card so normal world polling cannot close it.
const dateFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London',
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const validTypes = new Set(['story', 'intention', 'operation']);
export const storyTrailKey = ({ type, id, scope = '' }) => JSON.stringify([scope, type, id]);

export function createStoryTrail({ document = globalThis.document, fetcher = globalThis.fetch,
  endpoint = '/api/story-thread', formatTime = at => dateFormat.format(at), preservePosition = () => () => {},
  locationLabel = location => String(location ?? '').replaceAll('_', ' ') } = {}) {
  const entries = new Map();
  let currentScope = null;
  const element = (tag, content, className) => {
    const result = document.createElement(tag);
    if (content !== undefined) result.textContent = content;
    if (className) result.className = className;
    return result;
  };

  function render(entry, result) {
    const restore = preservePosition();
    const byId = new Map(result.events.map(event => [event.id, event]));
    const nodes = [];
    for (const stage of result.stages) {
      if (!stage.eventIds.length) continue;
      const section = element('section', undefined, 'story-trail-stage');
      section.append(element('h4', stage.label));
      const list = element('ol', undefined, 'story-trail-events');
      for (const id of stage.eventIds) {
        const event = byId.get(id);
        if (!event) continue;
        const hasProse = typeof event.prose === 'string' && event.prose.trim().length > 0;
        const item = element('li', undefined, hasProse ? 'story-trail-event has-prose' : 'story-trail-event');
        item.dataset.eventId = event.id;
        item.dataset.readingAnchor = `story-source:${entry.key}:${event.id}`;
        item.id = `story-source-${entry.type}-${entry.id}-${event.id}`;
        const when = element('time', formatTime(event.occurredAt));
        when.dateTime = new Date(event.occurredAt).toISOString();
        const source = element('a', 'Source record', 'story-trail-source');
        // The exact source remains addressable even when its older beat is no
        // longer in the main feed. Never send the reader to an absent row.
        source.href = `#${encodeURIComponent(item.id)}`;
        source.setAttribute('aria-label', `Source record, ${formatTime(event.occurredAt)}`);
        item.append(when, element('span', locationLabel(event.location), 'event-location'),
          element('p', event.description, 'story-trail-description'), source);
        if (hasProse) item.append(element('p', event.prose, 'event-prose'));
        list.append(item);
      }
      section.append(list);
      nodes.push(section);
    }
    entry.body.replaceChildren(...nodes);
    restore();
  }

  async function load(entry) {
    if (entry.loading || entry.loadedRevision === entry.revision || !entry.details.open) return;
    entry.loading = true;
    const revision = entry.revision;
    entry.body.setAttribute('aria-busy', 'true');
    if (!entry.loaded) entry.body.replaceChildren(element('p', 'Loading the public story…', 'secondary'));
    try {
      const params = new URLSearchParams({ type: entry.type, id: entry.id });
      const response = await fetcher(`${endpoint}?${params}`, { method: 'GET', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Unavailable public story');
      const result = await response.json();
      if (entries.get(entry.key) !== entry) return;
      if (result?.type !== entry.type || result?.id !== entry.id || !Array.isArray(result.events)
        || !Array.isArray(result.stages)) throw new Error('Invalid public story');
      render(entry, result);
      entry.loaded = true;
      entry.loadedRevision = revision;
    } catch {
      if (entries.get(entry.key) !== entry) return;
      const retry = element('button', 'Try again', 'story-trail-retry');
      retry.type = 'button';
      retry.addEventListener('click', () => load(entry));
      entry.body.replaceChildren(element('p', 'The public story could not be loaded.', 'secondary'), retry);
    } finally {
      entry.loading = false;
      entry.body.removeAttribute('aria-busy');
      // Only chase a revision that actually changed while this request ran.
      if (entry.loaded && entry.loadedRevision === revision && entry.revision !== revision
        && entries.get(entry.key) === entry) void load(entry);
    }
  }

  function attach(card, { type, id, revision = '', scope = '' } = {}) {
    if (!card || !validTypes.has(type) || typeof id !== 'string' || !id) return null;
    if (currentScope !== scope) { reset(); currentScope = scope; }
    const key = storyTrailKey({ type, id, scope });
    let entry = entries.get(key);
    if (!entry) {
      const details = element('details', undefined, 'story-trail');
      details.dataset.storyTrail = `${type}:${id}`;
      const summary = element('summary', 'Follow this story');
      const body = element('div', undefined, 'story-trail-body');
      body.setAttribute('aria-live', 'polite');
      details.append(summary, body);
      entry = { key, type, id, details, body, revision, loadedRevision: null, loaded: false, loading: false };
      entries.set(key, entry);
      details.addEventListener('toggle', () => { if (details.open) void load(entry); });
      // Bound detached history. Currently visible public descriptors number <10.
      if (entries.size > 32) {
        const oldest = entries.keys().next().value;
        if (oldest !== key) entries.delete(oldest);
      }
    }
    entry.revision = revision;
    if (entry.details.parentNode !== card) card.append(entry.details);
    if (entry.details.open) void load(entry);
    return entry.details;
  }
  function reset() { entries.clear(); }
  return { attach, reset };
}
