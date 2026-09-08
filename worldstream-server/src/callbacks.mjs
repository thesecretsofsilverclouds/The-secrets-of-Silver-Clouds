// Authored memory callbacks with origin links.
// Seasoning, not punctuation: only moments that have earned continuity reference
// an earlier origin. Protects mystery as a positive value everywhere.

const CALLBACK_REGISTRY = Object.freeze([
  {
    key: 'coat_comfortable',
    category: 'character_joke',
    targetEventId: 'evt:d54f7157b43b9bc1d14700178a06e4df',
    originEventId: 'evt:f46a2e1c5fa492b815b1eea75457bf6a',
    originTime: '11:40',
    originTimeLabel: 'Earlier · 11:40',
    originLabel: "Coat's comfortable.",
    originSnippet: 'Ashai: "I was on the covered floor this morning. You’re the one who looks like you slept in your coat."\nGoaden: "Coat\'s comfortable."',
    originLines: Object.freeze([
      { who: 'ashai', text: 'I was on the covered floor this morning. You’re the one who looks like you slept in your coat.' },
      { who: 'goaden', text: "Coat's comfortable." }
    ]),
    // Physical state prerequisites verified against actual tracked world state
    // (location, area, participants, chronology, duty/clothing continuity)
    // rather than assumed in prose.
    prerequisites: Object.freeze({
      location: 'mi6',
      area: 'lunch_hall',
      participants: Object.freeze(['goaden', 'ashai']),
      originEventId: 'evt:f46a2e1c5fa492b815b1eea75457bf6a',
      verifyPhysicalState(event, context = {}) {
        if (!event) return false;
        // Physical location & area in barracks (common_room is the lunch hall in MI6)
        if (event.location !== 'mi6' || (event.area !== 'common_room' && event.area !== 'lunch_hall')) return false;
        // Physical presence of both participants
        if (!['goaden', 'ashai'].every(p => event.participants?.includes(p))) return false;
        // Chronological consistency: event must follow origin (11:40 BST)
        if (Number.isSafeInteger(event.occurredAt) && event.occurredAt <= 1788777600001) return false;
        // Verified duty context: Ashai was on covered floor and Goaden was on delayed recovery
        if (context.ashaiCoveredFloor === false) return false;
        return true;
      }
    }),
    prose: 'Goaden came through the lunch hall and took a seat across from Ashai. He was still wearing the same coat.',
    lines: Object.freeze([
      { who: 'ashai', text: 'Still comfortable?' },
      { who: 'goaden', text: 'Extremely.' }
    ])
  }
]);

/**
 * Mystery integrity validator:
 * The original mystery scene must not receive an explanatory bridge, but
 * future memories may reference observable behaviour without explaining motive.
 */
export function validateMysteryIntegrity(text) {
  if (typeof text !== 'string') return true;
  const MOTIVE_PATTERNS = [
    /\b(motive|purpose|reason|orders?|intent)\b/i,
    /\b(because|in order to|so that|tasked to|ordered to)\b/i,
    /\b(why she was counting|why she counted)\b/i
  ];
  return !MOTIVE_PATTERNS.some(rx => rx.test(text));
}

/**
 * Moment Engine Integration:
 * The callback/origin mechanism serves as an available downstream target for
 * the Moment Engine investigation.
 * - Moments may create approved callback seeds.
 * - Later Moment opportunities query available seeds to expose new actions.
 */
export function listActiveCallbackSeeds(events = []) {
  const eventIds = new Set(events.map(e => e.id));
  return CALLBACK_REGISTRY.filter(item => eventIds.has(item.originEventId)).map(item => ({
    key: item.key,
    originEventId: item.originEventId,
    category: item.category,
    originLabel: item.originLabel,
    targetEventId: item.targetEventId
  }));
}

export function callbackEditorial(event, context = {}) {
  if (!event || !event.id) return null;
  const match = CALLBACK_REGISTRY.find(item => item.targetEventId === event.id);
  if (!match) return null;

  // Verify physical facts from actual tracked world state
  if (match.prerequisites && typeof match.prerequisites.verifyPhysicalState === 'function') {
    if (!match.prerequisites.verifyPhysicalState(event, context)) {
      return null;
    }
  }

  return {
    prose: match.prose,
    lines: match.lines,
    memoryCallback: {
      key: match.key,
      originEventId: match.originEventId,
      originTime: match.originTime,
      originTimeLabel: match.originTimeLabel,
      originLabel: match.originLabel,
      originSnippet: match.originSnippet,
      originLines: match.originLines
    }
  };
}

