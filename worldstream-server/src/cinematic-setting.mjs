// Public setting texture, not a source of events, permissions or secret knowledge.
// Manuscript physical page numbers were checked against the saved PDF extraction.
const detail = (id, text, source) => Object.freeze({ id, text, source });
const SETTINGS = Object.freeze({
  streamliner: Object.freeze([
    detail('streamliner_seating', 'The Streamliner has plush seats and views of the passing city.', 'canon/manuscript.pdf:physical-page-25'),
    detail('streamliner_symbols', 'Embedded arcane symbols give the interior a gentle glow.', 'canon/manuscript.pdf:physical-page-26'),
    detail('streamliner_quiet', 'Noise-cancellation charms make the interior unusually quiet.', 'canon/manuscript.pdf:physical-page-26; canon/The Secrets of Silver Clouds Codex.txt:62'),
  ]),
  sanctuary: Object.freeze([
    detail('sanctuary_clouds', 'The Sanctuary is a nightclub suspended above London on a foundation of clouds.', 'canon/manuscript.pdf:physical-page-57'),
    detail('sanctuary_air', 'Its protective anti-flight spell makes the surrounding air shimmer.', 'canon/manuscript.pdf:physical-page-57'),
  ]),
  enchanted_ink: Object.freeze([
    detail('ink_moving_shop', 'Enchanted Ink is a moving tattoo parlour in London.', 'site/The-secrets-of-Silver-Clouds-main/enchanted-ink.html:349-354'),
    detail('ink_walls', 'Animated tattoo designs move across the parlour walls.', 'site/The-secrets-of-Silver-Clouds-main/enchanted-ink.html:358'),
    detail('living_ink', 'Magical ink can form moving designs on skin.', 'canon/manuscript.pdf:physical-page-101'),
  ]),
});

export function settingForPerformance(location) {
  return { details: [...(SETTINGS[location] ?? [])],
    rule: 'Use these only for narrator atmosphere in the current location. They do not establish a new event, permission, tattoo, passenger, room visit or character discovery. Keep unexplained magic unexplained.' };
}

export const SCENE_LOCATION_ALIASES = Object.freeze({ enchanted_ink: Object.freeze(['Ink']) });
