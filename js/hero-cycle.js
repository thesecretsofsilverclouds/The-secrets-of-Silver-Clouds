/* A quiet, progressively enhanced rotation of the three selected artworks. */
(() => {
  'use strict';
  const art = document.querySelector('[data-hero-cycle]');
  if (!art) return;
  const slides = [...art.querySelectorAll('.hero-slide')];
  const controls = art.querySelector('.hero-cycle-controls');
  const choices = [...art.querySelectorAll('[data-hero-scene]')];
  const toggle = art.querySelector('[data-hero-toggle]');
  const caption = art.closest('.home-hero').querySelector('.hero-caption');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0;
  let paused = motion.matches;
  let visible = true;
  let busy = false;
  let timer;
  const failed = new Set();
  const loads = new Map();
  const canRotate = () => !paused && !motion.matches && visible && !document.hidden && !document.querySelector('dialog[open]');

  function renderToggle() {
    const stopped = paused || motion.matches;
    toggle.setAttribute('aria-label', stopped ? 'Resume artwork rotation' : 'Pause artwork rotation');
    toggle.querySelector('[data-hero-toggle-text]').textContent = stopped ? 'Resume' : 'Pause';
    toggle.querySelector('[data-hero-toggle-icon]').textContent = stopped ? '▷' : 'Ⅱ';
    // Reduced motion keeps manual scene selection, without automatic changes.
    toggle.hidden = motion.matches;
  }

  function schedule() {
    clearTimeout(timer);
    if (canRotate()) timer = setTimeout(advance, 9000);
  }

  function loadSlide(index) {
    if (loads.has(index)) return loads.get(index);
    const img = slides[index];
    const ready = new Promise((resolve, reject) => {
      const loaded = () => {
        if (!img.naturalWidth) { reject(new Error('Artwork unavailable')); return; }
        if (img.decode) img.decode().then(resolve, resolve); else resolve();
      };
      img.addEventListener('load', loaded, {once:true});
      img.addEventListener('error', reject, {once:true});
      if (img.dataset.src) {
        img.sizes = img.dataset.sizes;
        img.srcset = img.dataset.srcset;
        img.src = img.dataset.src;
      }
      if (img.complete && img.naturalWidth) loaded();
    });
    loads.set(index, ready);
    return ready;
  }

  async function show(index, manual = false) {
    if (busy || index === current || failed.has(index)) { schedule(); return; }
    busy = true;
    clearTimeout(timer);
    try {
      await loadSlide(index);
      if (!manual && !canRotate()) return;
      slides[current].classList.remove('is-active');
      slides[current].setAttribute('aria-hidden', 'true');
      slides[index].classList.add('is-active');
      slides[index].removeAttribute('aria-hidden');
      current = index;
      choices.forEach((button, i) => button.setAttribute('aria-pressed', String(i === current)));
      caption.textContent = slides[index].dataset.caption;
    } catch {
      // Keep the current artwork if a connection or an asset fails.
      failed.add(index);
      choices[index].disabled = true;
    } finally {
      busy = false;
      schedule();
    }
  }

  function advance() {
    if (!canRotate()) { schedule(); return; }
    for (let step = 1; step < slides.length; step++) {
      const next = (current + step) % slides.length;
      if (!failed.has(next)) { show(next); return; }
    }
  }

  choices.forEach((button, index) => button.addEventListener('click', () => {
    paused = true;
    renderToggle();
    show(index, true);
  }));
  toggle.addEventListener('click', () => {
    paused = !paused;
    renderToggle();
    schedule();
  });
  // Keyboard visitors can inspect the controls without an automatic change.
  art.addEventListener('focusin', event => {
    if (art.contains(event.relatedTarget) || !event.target.matches(':focus-visible')) return;
    paused = true;
    renderToggle();
    schedule();
  });
  document.addEventListener('visibilitychange', schedule);
  document.addEventListener('play', schedule, true);
  document.addEventListener('close', schedule, true);
  motion.addEventListener('change', () => {
    paused = motion.matches;
    renderToggle();
    schedule();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      schedule();
    }, {threshold:0.15}).observe(art);
  }
  controls.hidden = false;
  renderToggle();
  loadSlide(0).then(schedule, () => {});
})();
