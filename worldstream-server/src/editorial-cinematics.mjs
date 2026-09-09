import { cinematicRecordForApi, setupBeatFor, deterministicFallbackScene } from './cinematics.mjs';
import { correctEditorialText, editorialEvent, EDITORIAL_REVISION } from './editorial.mjs';
import { selectVisualVocabulary } from './cinematic-assets.mjs';
import { daypart } from './sky.mjs';
import { correctLegacyWakeDialogue } from './dialogue.mjs';

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
    lines: (source.canonicalLines ?? []).map(line => ({ who: line.speaker,
      expression: line.expression, text: line.line })),
  };
}

/** Public display revision of a stored cinematic; the input is never mutated.
 * Pass the actual raw public event when available to retain outcome-specific
 * prose. Without it, editorialEvent receives only the packet's public facts.
 */
export function editorialCinematicRecordForApi(record, { event, snapshot, publicSourcesForEvent } = {}) {
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
  const rawSource = publicSource(record, event);
  const source = rawSource ? correctLegacyWakeDialogue(rawSource, () => typeof publicSourcesForEvent === 'function'
    ? publicSourcesForEvent(rawSource) : snapshot?.events ?? []) : null;
  const revised = source ? editorialEvent(source, { presentation: 'cinematic' }) : null;
  const authored = api.scene.source === 'canonical';
  const summary = revised?.publicDescription ?? api.scene.chronicleSummary;
  // A canonical performance is a rendering of its public source, including
  // dialogue and room. Updating only the narration left obsolete cache lines,
  // speakers and backgrounds attached to a corrected passage. Recompose the
  // public rendering without touching the accepted packet/cursor or invoking a
  // provider. Model performances keep their separately accepted text below.
  let canonical = null;
  if (authored && revised) {
    const lines = revised.lines ?? revised.payload?.lines ?? [];
    const packet = { ...record.packet, event: { ...record.packet?.event,
      canonicalSummary: revised.publicDescription, canonicalProse: revised.prose ?? null,
      canonicalLines: lines.filter(line => typeof line?.who === 'string' && typeof line?.text === 'string')
        .map(line => ({ speaker: line.who, expression: line.expression ?? null, line: line.text })),
    }, visuals: selectVisualVocabulary({ event: revised, daypart: daypart(revised.occurredAt),
      room: revised.room ?? revised.area ?? null }) };
    canonical = cinematicRecordForApi({ ...record, scene: deterministicFallbackScene(packet) }).scene;
  }
  const performance = canonical ?? api.scene;
  const scene = {
    ...performance,
    openingNarration: correctEditorialText(authored && revised
      ? revised.prose || revised.publicDescription || api.scene.openingNarration
      : performance.openingNarration),
    // Accepted model scenes already use the canonical event description for
    // their chronicle summary. Updating that metadata does not rewrite their
    // independent performance, which is retained apart from the known typo.
    chronicleSummary: correctEditorialText(summary),
    closingNarration: correctEditorialText(performance.closingNarration),
    beats: performance.beats.map(beat => ({ ...beat, line: correctEditorialText(beat.line) })),
  };
  return { ...api, setup, scene, chronicleSummary: scene.chronicleSummary,
    ...(canonical && revised ? { atmosphere: { ...api.atmosphere,
      location: revised.location ?? null, room: revised.room ?? revised.area ?? null } } : {}),
    editorialRevision: EDITORIAL_REVISION };
}
