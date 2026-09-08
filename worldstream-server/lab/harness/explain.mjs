import { scoreCandidates } from '../engine/score.mjs';
import { PRACTICES } from '../grammar/practices.mjs';
import { CAST } from '../grammar/cast.mjs';

// "Why did Emily use Fade here?" and "why could Goaden not?", answered from the
// same data structure the decision was made with.
//
// This is the capability that made the investigation worth doing. Praxish
// tracks which condition killed each candidate action and exposes it as
// `impossibleActions`; the idea is excellent and about fifteen lines. What is
// reimplemented rather than adopted is the presentation: Praxish reports the
// raw condition string, so the answer to "why not?" is `char.Actor.ability.fade`
// rather than "Ashai does not possess Fade". A `because` on the condition turns
// a debugging aid into something an author can read at three in the morning.

const pad = (text, width) => String(text).padEnd(width);

/** A full decision trace for one actor in one situation. */
export function explain({ view, actor, seed = 'explain' }) {
  const grammar = CAST.get(actor);
  const { ranked, blocked, rejected } = scoreCandidates({ view, practices: PRACTICES,
    actor, grammar, seed });
  return { actor, ranked, blocked, rejected };
}

export function renderExplanation({ actor, ranked, blocked, rejected }, { limit = 6 } = {}) {
  const lines = [];
  lines.push(`${actor} — what was available, and what it was worth`);
  if (!ranked.length) lines.push('  (nothing available)');
  for (const candidate of ranked.slice(0, limit)) {
    const bound = Object.entries(candidate.bindings)
      .filter(([key]) => ['Thing', 'Obstacle', 'Other', 'Helper', 'Key'].includes(key))
      .map(([key, value]) => `${key}=${value}`).join(' ');
    lines.push(`  ${pad(candidate.action.id, 22)} ${String(candidate.score).padStart(5)}  ${bound}`);
    for (const sway of candidate.sways.sort((a, b) => b.score - a.score)) {
      const sign = sway.priority ? `[${sway.priority}]` : `${sway.score >= 0 ? '+' : ''}${sway.score}`;
      lines.push(`      ${pad(sign, 6)} ${sway.name}`);
    }
  }
  if (rejected.length) {
    lines.push(`  refused outright:`);
    for (const item of rejected) lines.push(`      ${pad(item.action, 22)} ${item.reason}`);
  }
  if (blocked.length) {
    lines.push(`  unavailable:`);
    const seen = new Set();
    for (const item of blocked) {
      const key = `${item.action}:${item.reason}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`      ${pad(item.action, 22)} ${item.reason}`);
    }
  }
  return lines.join('\n');
}
