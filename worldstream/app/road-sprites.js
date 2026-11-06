// Decorative companions at the page edge. They follow London's light, but do
// not occupy the characters' room or represent additional canonical events.
export function roadSpriteMode(context, { enabled = true, sceneOpen = false } = {}) {
  if (!enabled || sceneOpen || !['dawn', 'day', 'dusk', 'night'].includes(context?.dayPhase)) return 'off';
  return context.dayPhase === 'night' ? 'sleep' : 'run';
}

export function spriteFrame(elapsedMs, runner) {
  return Math.floor(Math.max(0, elapsedMs) * runner.fps / 1000) % runner.frames;
}

export function createRoadSpriteLayer({ layer, manifestUrl = '/worldstream/app/ambient/road-sprites.json' } = {}) {
  if (!layer) return { update() {}, destroy() {} };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = document.createElement('canvas');
  const paint = canvas.getContext('2d');
  const sleepers = document.createElement('div');
  sleepers.className = 'road-sleepers';
  canvas.className = 'road-runway';
  layer.append(canvas, sleepers);
  let manifest = null, requested = false, dead = false, mode = 'off';
  let context = null, options = {}, timer = null, frame = null, running = null;
  let last = 0, elapsed = 0, index = 0;
  const images = new Map();
  const active = () => !dead && !document.hidden;
  const moving = () => active() && options.motion !== false && !reduced.matches;

  function stop() {
    clearTimeout(timer); timer = null;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null; running = null;
    paint?.clearRect(0, 0, canvas.width, canvas.height);
  }
  function schedule(delay = 32_000 + Math.random() * 32_000) {
    if (!moving() || mode !== 'run' || !manifest?.runners.length || !paint) return;
    clearTimeout(timer);
    timer = setTimeout(startRun, delay);
  }
  function startRun() {
    timer = null;
    if (!moving() || mode !== 'run') return;
    const runner = manifest.runners[index++ % manifest.runners.length];
    const image = images.get(runner.url);
    if (!image?.complete || !image.naturalWidth) { schedule(); return; }
    const ratio = Math.min(1.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(140 * ratio);
    paint.setTransform(ratio, 0, 0, ratio, 0, 0);
    running = { runner, image, reverse: index % 2 === 0 };
    last = performance.now(); elapsed = 0;
    frame = requestAnimationFrame(step);
  }
  function step(now) {
    frame = null;
    if (!moving() || mode !== 'run' || !running) { stop(); return; }
    const delta = now - last;
    if (delta < 1000 / 24) { frame = requestAnimationFrame(step); return; }
    last = now; elapsed += Math.min(delta, 100);
    const { runner, image, reverse } = running;
    const height = window.innerWidth < 520 ? 76 : 88;
    const width = height * runner.frameWidth / runner.frameHeight;
    const travel = elapsed * .087; // 87 CSS pixels/second, independent of monitor refresh.
    if (travel > window.innerWidth + width * 2) { stop(); schedule(); return; }
    const x = reverse ? window.innerWidth + width - travel : -width + travel;
    const current = spriteFrame(elapsed, runner);
    paint.clearRect(0, 0, window.innerWidth, 140);
    paint.save();
    paint.globalAlpha = .83;
    paint.translate(x + (reverse ? width : 0), 140 - height - 4);
    if (reverse) paint.scale(-1, 1);
    paint.drawImage(image, current * runner.frameWidth, 0, runner.frameWidth, runner.frameHeight, 0, 0, width, height);
    paint.restore();
    frame = requestAnimationFrame(step);
  }
  function showSleepers() {
    sleepers.replaceChildren();
    for (const [slot, asset] of (manifest?.sleepers ?? []).slice(0, 2).entries()) {
      const bed = document.createElement('div');
      bed.className = `road-sleeper road-sleeper-${slot}`;
      const image = new Image(); image.src = asset.url; image.alt = ''; image.decoding = 'async';
      image.width = asset.width; image.height = asset.height;
      bed.append(image);
      if (!asset.bakedZzz) {
        const zzz = document.createElement('span'); zzz.className = 'road-zzz'; zzz.textContent = 'z z Z'; bed.append(zzz);
      }
      sleepers.append(bed);
    }
  }
  function apply() {
    const next = active() ? roadSpriteMode(context, options) : 'off';
    layer.dataset.mode = next;
    layer.classList.toggle('is-still', !moving());
    if (next !== mode) {
      mode = next; stop();
      canvas.hidden = mode !== 'run'; sleepers.hidden = mode !== 'sleep';
      if (mode === 'sleep') showSleepers();
    }
    if (!moving()) stop();
    if (mode === 'run' && moving() && !timer && !running) schedule(8_000);
    if (mode !== 'off' && !requested) {
      requested = true;
      fetch(manifestUrl).then(r => r.ok ? r.json() : null).then(value => {
        // Sprite paths are relative to the manifest that lists them, so the
        // same file works wherever the app is mounted. They used to be
        // site-absolute `/ambient/...`, which broke the moment the app moved
        // from the site root to /worldstream/app/ — the runners simply stopped
        // drawing, with no error anywhere.
        if (value) {
          const base = new URL(manifestUrl, location.href);
          const resolve = (path) => (path ? new URL(path, base).pathname : path);
          for (const runner of value.runners ?? []) {
            runner.url = resolve(runner.url);
            runner.fallback = resolve(runner.fallback);
          }
          for (const sleeper of value.sleepers ?? []) sleeper.url = resolve(sleeper.url);
        }
        if (dead || !value) return;
        manifest = value;
        for (const runner of manifest.runners) {
          const image = new Image(); image.src = runner.url; image.decoding = 'async'; images.set(runner.url, image);
        }
        if (mode === 'sleep') showSleepers();
        if (mode === 'run') schedule(8_000);
      }).catch(() => {});
    }
    layer.hidden = mode === 'off';
  }
  document.addEventListener('visibilitychange', apply);
  reduced.addEventListener('change', apply);
  const resized = () => { stop(); apply(); };
  window.addEventListener('resize', resized);
  return {
    update(value, prefs = {}) { context = value; options = prefs; apply(); },
    destroy() { dead = true; stop(); layer.replaceChildren(); document.removeEventListener('visibilitychange', apply);
      reduced.removeEventListener('change', apply); window.removeEventListener('resize', resized); images.clear(); },
  };
}
