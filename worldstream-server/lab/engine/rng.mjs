import { createHash } from 'node:crypto';

// Every choice this lab makes is a pure function of (seed, rules version, key).
// Nothing calls Math.random. Praxish's demos use `randNth` and
// `weightedRandomChoice` off the global RNG; both are unusable here, because
// Worldstream's whole audit rests on replaying a day and getting it back.
export const ENGINE_VERSION = 'moment-lab-v1';

export const hash = key =>
  createHash('sha256').update(`${ENGINE_VERSION}|${key}`).digest().readUInt32BE(0);

/** A stable [0,1) from a key. */
export const unit = key => hash(key) / 0x1_0000_0000;

/** Deterministic pick. Ties in the caller are broken before this is reached. */
export const pick = (items, key) => items.length ? items[hash(key) % items.length] : null;

/** Small, bounded, reproducible jitter for scores that would otherwise tie. */
export const jitter = (key, amplitude = 0.001) => (unit(key) - 0.5) * 2 * amplitude;
