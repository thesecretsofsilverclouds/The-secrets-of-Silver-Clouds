// Modelling fixes against the measured hours, so the choice is arithmetic.
const HOURS = { ordinary: 239, night: 238, pressure: 216, play: 28 };
const show = (label, moods) => {
  const exposure = {};
  for (const [mood, tracks] of Object.entries(moods))
    for (const t of tracks) exposure[t] = (exposure[t] ?? 0) + HOURS[mood] / tracks.length;
  const sorted = Object.entries(exposure).sort((a, b) => b[1] - a[1]);
  const heard = sorted.filter(([, h]) => h >= 20);
  console.log(`\n${label}`);
  console.log('  ' + sorted.map(([t, h]) => `${t} ${h.toFixed(0)}h`).join(' · '));
  console.log(`  most-played ${sorted[0][1].toFixed(0)}h · least ${sorted.at(-1)[1].toFixed(0)}h · ratio ${(sorted[0][1] / sorted.at(-1)[1]).toFixed(0)}x`
    + ` · spread among regularly-heard tracks ${(heard[0][1] / heard.at(-1)[1]).toFixed(1)}x`);
};

show('CURRENT', {
  night: ['midnight-static-loop', 'floating-night', 'little-star'],
  play: ['arcade-after-dark', 'neon-arcade-hustle', 'dunk-no-jutsu', 'touchscreen-drift'],
  pressure: ['glitch-pocket-riot', 'tiny-rebel'],
  ordinary: ['tiny-rebel', 'legends-of-dawn', 'oracle', 'magic', 'silver-clouds'],
});

show('FIX A — one character: MIN_TRACKS 2 -> 4 (pressure borrows from play)', {
  night: ['midnight-static-loop', 'floating-night', 'little-star', 'arcade-after-dark'],
  play: ['arcade-after-dark', 'neon-arcade-hustle', 'dunk-no-jutsu', 'touchscreen-drift'],
  pressure: ['glitch-pocket-riot', 'tiny-rebel', 'arcade-after-dark', 'neon-arcade-hustle'],
  ordinary: ['tiny-rebel', 'legends-of-dawn', 'oracle', 'magic', 'silver-clouds'],
});

show('FIX B — A, plus tiny-rebel stops double-booking (out of ordinary)', {
  night: ['midnight-static-loop', 'floating-night', 'little-star'],
  play: ['arcade-after-dark', 'neon-arcade-hustle', 'dunk-no-jutsu', 'touchscreen-drift'],
  pressure: ['glitch-pocket-riot', 'tiny-rebel', 'neon-arcade-hustle', 'touchscreen-drift'],
  ordinary: ['legends-of-dawn', 'oracle', 'magic', 'silver-clouds'],
});

show('FIX C — B, plus night gets a fourth from ordinary (silver-clouds)', {
  night: ['midnight-static-loop', 'floating-night', 'little-star', 'silver-clouds'],
  play: ['arcade-after-dark', 'neon-arcade-hustle', 'dunk-no-jutsu', 'touchscreen-drift'],
  pressure: ['glitch-pocket-riot', 'tiny-rebel', 'neon-arcade-hustle', 'touchscreen-drift'],
  ordinary: ['legends-of-dawn', 'oracle', 'magic', 'silver-clouds'],
});
