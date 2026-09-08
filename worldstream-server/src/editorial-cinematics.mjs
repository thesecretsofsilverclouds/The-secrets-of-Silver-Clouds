import { cinematicRecordForApi, setupBeatFor } from './cinematics.mjs';
import { correctEditorialText, editorialEvent, EDITORIAL_REVISION } from './editorial.mjs';

// Cinematic packets and accepted performances are immutable cache records. This
// adapter runs only at the public read boundary; it never replaces a packet,
// changes an acceptance cursor, or requests a fresh performance.
function publicSource(record, event) {
  const source = record.packet?.event;
  if (event?.visibility === 'public' && event.id === record.eventId
    && event.occurredAt === record.occurredAt
    && (!source?.location || event.location === source.location)
    && typeof event.publicDescription === 'string') return event;

  // Old cached packets omit outcome payloads. Retain only their public event
  // fields; in particular, never infer outcomes from characters' knownFacts or
  // copy packet.world, callback memories, or provider narration into an event.
  if (!source || source.id !== record.eventId
    || source.occurredAt !== record.occurredAt
    || source.visibility === 'private'
    || typeof source.canonicalSummary !== 'string') return null;
  return {
    id: source.id, type: source.type, occurredAt: source.occurredAt,
    visibility: 'public', location: source.location,
    area: source.area ?? null, room: source.room ?? source.area ?? null,
    participants: [...(source.participants ?? [])], payload: {},
    publicDescription: source.canonicalSummary,
    prose: source.canonicalProse ?? null,
    lines: (source.canonicalLines ?? []).map(line => ({ ...line })),
  };
}

/** Public display revision of a stored cinematic; the input is never mutated.
 * Pass the actual raw public event when available to retain outcome-specific
 * prose. Without it, editorialEvent receives only the packet's public facts.
 */
export function editorialCinematicRecordForApi(record, { event, snapshot } = {}) {
  const api = cinematicRecordForApi(record);
  if (!api) return null;
  let setup = api.setup;
  if (!setup && snapshot) {
    const ev = event || record.packet?.event;
    if (ev) {
      const derived = setupBeatFor(ev, snapshot);
      if (derived) {
        setup = {
          originEventId: derived.originEventId,
          originType: derived.originType,
          originOccurredAt: derived.originOccurredAt,
          originTimeLabel: derived.originTimeLabel,
          originSnippet: derived.originSnippet,
        };
      }
    }
  }
  if (!api.scene) return { ...api, setup, editorialRevision: EDITORIAL_REVISION };
  const source = publicSource(record, event);
  const revised = source ? editorialEvent(source, { presentation: 'cinematic' }) : null;
  const authored = api.scene.source === 'canonical';
  const summary = revised?.publicDescription ?? api.scene.chronicleSummary;
  const scene = {
    ...api.scene,
    openingNarration: correctEditorialText(authored && revised
      ? revised.prose || revised.publicDescription || api.scene.openingNarration
      : api.scene.openingNarration),
    // Accepted model scenes already use the canonical event description for
    // their chronicle summary. Updating that metadata does not rewrite their
    // independent performance, which is retained apart from the known typo.
    chronicleSummary: correctEditorialText(summary),
    closingNarration: correctEditorialText(api.scene.closingNarration),
    beats: api.scene.beats.map(beat => ({ ...beat, line: correctEditorialText(beat.line) })),
  };
  return { ...api, setup, scene, chronicleSummary: scene.chronicleSummary,
    editorialRevision: EDITORIAL_REVISION };
}
