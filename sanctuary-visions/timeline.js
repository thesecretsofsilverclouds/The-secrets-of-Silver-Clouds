/* Word anchors from the shipped Sanctuary recording. All values are seconds on the media clock. */
(function (root) {
  'use strict';
  const cues = Object.freeze({
    prepare: 80, begin: 93.64, bruise: 100.44, betrayal: 105.18,
    balm: 107.84, soften: 111.16, sway: 114.88, memories: 118.10,
    trust: 127.60, bloomWords: 128.74, tended: 135.04, water: 136.52,
    love: 137.06, guard: 141.34, friends: 144.88, strength: 146.72,
    collision: 153.46, finish: 162.0, sweet: 78.26
  });
  const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const envelope = (t, a, b, c, d) => smooth(a, b, t) * (1 - smooth(c, d, t));
  // Trigger on the spoken word, then hold a representative completed drawing.
  const calmMoments = [[cues.begin,96.4],[cues.bruise,102.42],[cues.betrayal,106.3],
    [cues.balm,108.68],[cues.soften,113.56],[cues.memories,120.16],[cues.trust,129.58],
    [cues.tended,135.8],[cues.water,137.38],[cues.guard,143.62],[cues.friends,145.8],
    [cues.strength,149.68],[cues.collision,155.38],[159.3,160.5]];
  function sample(time, calm = false) {
    const realTime = Number.isFinite(time) ? Math.max(0, time) : 0;
    const t = calm && realTime >= cues.begin && realTime < cues.finish
      ? calmMoments.reduce((last, [trigger, moment]) => trigger <= realTime ? moment : last, cues.begin) : realTime;
    const recover = smooth(cues.trust, 130.4, t);
    const opening = smooth(cues.water, 137.7, t);
    const half = smooth(137.8, 139.3, t);
    const bloom = smooth(139.4, 141.7, t);
    const gather = smooth(cues.strength, 151.3, t);
    const snap = smooth(cues.collision, cues.collision + .65, t);
    const flowerFade = 1 - smooth(cues.collision, cues.collision + 1.15, t);
    return {
      t, realTime, active: realTime >= cues.begin && realTime < cues.finish,
      sweet: envelope(realTime, cues.sweet, cues.sweet + .5, 81.2, 83),
      presence: envelope(t, cues.begin, cues.begin + 1.5, 159, cues.finish),
      threads: envelope(t, cues.begin, 96.4, cues.collision, cues.collision + 1.3),
      flower: smooth(cues.bruise, 102.4, t) * flowerFade,
      sag: envelope(t, cues.betrayal, 106.2, cues.trust, 130.4),
      warmth: smooth(cues.balm, 113.56, t) * (1 - snap),
      cracks: envelope(t, cues.betrayal, 106.3, cues.soften, 114),
      recover, gather, snap,
      can: envelope(t, cues.tended, cues.water, 140.0, 141.2),
      water: envelope(t, cues.water, cues.water + .3, 139.45, 140.0),
      word: envelope(t, cues.trust, cues.trust + 1.15, 140.1, 142),
      thorns: smooth(cues.guard, 143.6, t) * flowerFade,
      ring: envelope(t, cues.guard, 143.3, cues.strength, 151.1),
      friends: envelope(t, cues.friends, 146.2, 148.3, 150.1),
      petals: envelope(t, cues.collision, cues.collision + .35, 159.3, cues.finish),
      pendant: envelope(t, cues.strength, 148.8, 151.6, 154),
      silver: smooth(cues.collision, cues.collision + .7, t),
      frames: [1 - recover, recover * (1 - opening), opening * (1 - half), half * (1 - bloom), bloom]
    };
  }
  const api = Object.freeze({ cues, sample, clamp, smooth, envelope });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SanctuaryVisionTimeline = api;
})(typeof window === 'undefined' ? globalThis : window);
