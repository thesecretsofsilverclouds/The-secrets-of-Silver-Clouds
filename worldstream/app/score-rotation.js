// Listening history is local presentation state, never part of the world.
const MOODS = new Set(['ordinary', 'night', 'play', 'pressure']);
const clean = list => [...new Set((Array.isArray(list) ? list : [])
  .filter(slug => typeof slug === 'string' && /^[a-z0-9-]{1,100}$/.test(slug)))].slice(0, 256);
const family = slug => slug?.replace(/-?\d+$/, '');

export class ScoreRotation {
  constructor({ storage = null, random = Math.random, key = 'silver-clouds-score-rotation' } = {}) {
    Object.assign(this, { storage, random, key, moods: {}, recent: [], acceptedMood: null, pending: {} });
    try {
      const saved = JSON.parse(storage?.getItem(key) ?? 'null');
      if (saved?.version !== 1) return;
      this.recent = clean(saved.recent).slice(0, 32);
      this.acceptedMood = MOODS.has(saved.lastMood) ? saved.lastMood : null;
      for (const name of MOODS) if (saved.moods?.[name]) this.moods[name] = {
        known: clean(saved.moods[name].known), remaining: clean(saved.moods[name].remaining),
      };
    } catch { /* Private browsing still gets an in-memory rotation. */ }
  }

  lastMood() { return this.acceptedMood; }

  pool(name, source) {
    const bank = clean(source), old = this.moods[name];
    const remaining = old ? old.remaining.filter(slug => bank.includes(slug)) : [];
    for (const slug of bank) if (!old?.known.includes(slug) && !remaining.includes(slug)) remaining.push(slug);
    const entry = { known: bank, remaining: remaining.length ? remaining : [...bank] };
    this.moods[name] = entry;
    return entry;
  }

  next(name, source) {
    if (!MOODS.has(name)) return null;
    const entry = this.pool(name, source), bank = entry.known;
    if (!bank.length) return null;
    const signature = JSON.stringify(bank);
    if (this.pending[name]?.signature === signature) return this.pending[name].slug;
    let options = [...entry.remaining];
    const different = options.filter(slug => slug !== this.recent[0]);
    // A borrowed track may already have played in another mood. Do not repeat
    // it immediately just to finish this mood's old bag.
    options = different.length ? different : bank.filter(slug => slug !== this.recent[0]);
    if (!options.length) options = [...bank];
    const otherThemes = options.filter(slug => family(slug) !== family(this.recent[0]));
    if (otherThemes.length) options = otherThemes;
    // Keep enough separators for two versions of a theme later in the bag,
    // instead of leaving both Mowtown tracks to play together at the end.
    const separable = options.filter(slug => {
      const rest = entry.remaining.filter(item => item !== slug), counts = new Map();
      for (const item of rest) counts.set(family(item), (counts.get(family(item)) ?? 0) + 1);
      return [...counts].every(([theme, count]) => count <=
        (theme === family(slug) ? Math.floor(rest.length / 2) : Math.ceil(rest.length / 2)));
    });
    if (separable.length) options = separable;
    const recent = this.recent.slice(0, Math.min(2, bank.length - 1));
    const fresh = options.filter(slug => !recent.includes(slug));
    if (fresh.length) options = fresh;
    const roll = Number(this.random());
    const index = Math.min(options.length - 1, Math.floor((Number.isFinite(roll) ? Math.max(0, roll) : 0) * options.length));
    const slug = options[index];
    this.pending[name] = { signature, slug };
    return slug;
  }

  played(name, slug, source) {
    if (!MOODS.has(name) || !clean(source).includes(slug)) return;
    const entry = this.pool(name, source);
    entry.remaining = entry.remaining.filter(item => item !== slug);
    // Another mood's provisional choice must be reconsidered against this
    // newly heard track, especially where the pools borrow the same music.
    this.pending = {};
    this.recent = [slug, ...this.recent.filter(item => item !== slug)].slice(0, 32);
    this.acceptedMood = name;
    try { this.storage?.setItem(this.key, JSON.stringify({ version: 1,
      moods: this.moods, recent: this.recent, lastMood: name })); } catch { /* Optional storage. */ }
  }
}
