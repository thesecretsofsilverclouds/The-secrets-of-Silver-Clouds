/* Streamliner and Sanctuary discoveries share one clock and one stage. */
(() => {
  'use strict';
  if (window.SoulSipPassage) return;

  const path = location.pathname.replace(/\.html$/i, '').replace(/\/+$/, '') || '/';
  const excluded = /(?:^|\/)(?:episode-one|episodeone|quiz|faction-quiz|holy-gift|press|partners(?:-local)?|audio-partners-local|pour|drink)(?:\/|$)/i.test(path)
    || /^\/worldstream(?:\/|$)/i.test(path)
    // Their own experiences never advertise themselves.
    || /(?:^|\/)(?:sanctuary|soul-sips|streamliner)[^/]*(?:\/|$)/i.test(path)
    || Boolean(document.querySelector('#soul-sips-bar, #maintenance-carriage'));
  if (excluded || document.querySelector('[data-soul-sip-passage]')) return;

  const home = Boolean(document.getElementById('home')) || path === '/';
  const lore = document.body.dataset.passagePage === 'lore'
    || Boolean(document.querySelector('.lore-container, [data-codex-page], [data-passage-lore]'));
  if (!home && !lore) return;

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const quietKey = 'silver-clouds:house-invitation:quiet:v1';
  const feelings = ['nostalgia', 'joy', 'love', 'homecoming', 'glory', 'sadness', 'anger'];
  const colors = { nostalgia: '#76b7ff', joy: '#f4ca69', love: '#ed89bc', homecoming: '#78d3b1', glory: '#f29a61', sadness: '#a5a6ec', anger: '#e87785' };
  const wait = lore && !home ? 45000 : 8000;
  const duration = 26000;
  const returnWait = 100000;
  const trainUrl = '/images/streamliner-discovery/streamliner-passing.png';
  let glassQuiet = false;
  try { glassQuiet = sessionStorage.getItem(quietKey) === '1'; } catch { /* A page-local dismissal still works in private browsing. */ }

  const make = (tag, className) => Object.assign(document.createElement(tag), { className });
  const stage = make('div', 'ss-passage-stage');
  stage.dataset.soulSipPassage = '';
  stage.dataset.state = 'idle';
  stage.hidden = true;
  const card = make('div', 'ss-passage-card');
  const link = make('a', 'ss-passage-link');
  link.tabIndex = -1;
  const visual = make('span', 'ss-passage-visual');
  visual.setAttribute('aria-hidden', 'true');
  const invitation = make('span', 'ss-passage-invitation');
  const dismiss = make('button', 'ss-passage-dismiss');
  dismiss.type = 'button';
  dismiss.textContent = '×';
  dismiss.tabIndex = -1;
  dismiss.setAttribute('aria-label', 'Dismiss this invitation');
  dismiss.title = 'Dismiss invitation';
  link.append(visual, invitation);
  card.append(link, dismiss);
  const rails = make('div', 'sc-passage-rails');
  const entry = make('div', 'sc-passage-seam sc-passage-seam--entry');
  const exit = make('div', 'sc-passage-seam sc-passage-seam--exit');
  [rails, entry, exit].forEach(node => node.setAttribute('aria-hidden', 'true'));
  stage.append(rails, entry, exit, card);
  document.body.append(stage);

  // A lore visitor may simply be reading; their quiet 45 seconds still count.
  let engaged = lore || scrollY > 10;
  let suspended = false;
  let active = null;
  let pending = null;
  let hovered = false;
  let focused = false;
  let done = false;
  let hasCrossed = false;
  let glassPasses = 0;
  let trainPasses = 0;
  let idleElapsed = 0;
  let lastFrame = null;
  let raf = 0;
  let timer = 0;
  let assetIdle = 0;
  let assetLoad = null;
  let trainReady = false;
  let trainFailed = false;
  let width = 300;
  let viewport = innerWidth;
  let x = 0;
  let priorFocus = null;
  const trainImage = new Image();
  trainImage.alt = '';
  trainImage.className = 'sc-passage-art';
  trainImage.decoding = 'async';
  trainImage.fetchPriority = 'low';
  trainImage.draggable = false;

  function kindNow() {
    if (lore && !home) return 'glass';
    const hour = new Date().getHours();
    return hour >= 7 && hour < 19 ? 'train' : 'glass';
  }
  function allowedKind() {
    const kind = pending?.kind || kindNow();
    if (kind === 'train' && trainFailed) return null;
    if (kind === 'glass' && glassQuiet && !pending?.force) return null;
    return kind;
  }
  function obstruction() {
    if (document.querySelector('dialog[open], .lightbox.active, .ssd-lintel.ssd-on, #glory-overlay.open')) return true;
    return [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].some(dialog => {
      if (dialog.hidden || dialog.getAttribute('aria-hidden') === 'true') return false;
      const style = getComputedStyle(dialog);
      return style.display !== 'none' && style.visibility !== 'hidden' && dialog.getClientRects().length > 0;
    });
  }
  function blocked() { return suspended || document.hidden || obstruction(); }
  function stopClock() {
    if (raf) cancelAnimationFrame(raf);
    if (timer) clearTimeout(timer);
    raf = timer = 0;
  }
  function stopAssetWait() {
    if (assetIdle && window.cancelIdleCallback) cancelIdleCallback(assetIdle);
    if (assetLoad) removeEventListener('load', assetLoad);
    assetIdle = 0;
    assetLoad = null;
  }
  function requestTrain(immediate = false) {
    if (trainReady || trainFailed || trainImage.src || !engaged || blocked()) return;
    const load = () => {
      stopAssetWait();
      if (!blocked()) trainImage.src = trainUrl;
    };
    if (immediate) load();
    else if (!assetIdle && !assetLoad) {
      if (document.readyState !== 'complete') {
        assetLoad = () => { assetLoad = null; requestTrain(); };
        addEventListener('load', assetLoad, { once: true });
      } else if (window.requestIdleCallback) assetIdle = requestIdleCallback(load, { timeout: 1200 });
      else load();
    }
  }
  function schedule() {
    if (raf || timer || done || suspended || document.hidden || (!engaged && !pending)) return;
    // A quiet night must not leave the homepage asleep when daytime arrives.
    // Lore has no day/night rotation, and explicit calls can wake it themselves.
    const waitingForBoundary = !active && !allowedKind();
    if (waitingForBoundary && !home) return;
    if (lastFrame === null) lastFrame = performance.now();
    if (active && !active.still && !hovered && !focused && !obstruction()) raf = requestAnimationFrame(tick);
    else timer = setTimeout(() => { timer = 0; tick(performance.now()); }, waitingForBoundary ? 1000 : active?.still ? 750 : 250);
  }
  function set(name, value) { stage.style.setProperty(`--ss-passage-${name}`, String(value)); }
  function measure() {
    viewport = document.documentElement.clientWidth || innerWidth;
    const kind = active?.kind || pending?.kind || kindNow();
    width = kind === 'train' ? Math.min(840, Math.max(320, viewport * .68)) : Math.min(380, viewport - 24);
    const height = kind === 'train' ? width / 3 : stage.dataset.delivery === 'courier' ? 300 : 220;
    let y = Math.max(height / 2 + 30, innerHeight - height / 2 - (viewport < 640 ? 38 : 44));
    if (kind === 'train') {
      y = Math.max(100, Math.min(innerHeight * .58, innerHeight - height / 2 - 40));
      const hero = viewport <= 980 ? document.querySelector('#home .hero-art')?.getBoundingClientRect() : null;
      if (hero && hero.height > height * 1.45 && hero.bottom > height + 110 && hero.top < innerHeight * .6) y = hero.bottom - height * .68 - 8;
      y = Math.max(height / 2 + 24, Math.min(y, innerHeight - height / 2 - 40));
    }
    set('width', `${width}px`);
    set('height', `${height}px`);
    set('y', `${y.toFixed(2)}px`);
    if (active) render();
  }
  const ease = value => {
    const v = Math.min(1, Math.max(0, value));
    return v * v * (3 - 2 * v);
  };
  function render() {
    if (!active) return;
    const p = active.still ? (active.kind === 'train' ? .5 : .45) : Math.min(1, active.elapsed / duration);
    const center = (viewport - width) / 2;
    if (active.kind === 'glass') {
      // Glide in, rest long enough to read, then drift onward. No jump at either join.
      x = p < .32 ? (-width - 48) + (center + width + 48) * ease(p / .32)
        : p <= .60 ? center : center + (viewport + 48 - center) * ease((p - .60) / .40);
    } else x = -width - 80 + p * (viewport + width + 160);
    const visibility = active.still ? 1 : ease(p / .10) * ease((1 - p) / .10);
    let phase = 0, mark = 50;
    if (active.kind === 'train' && !active.still) {
      for (const [from, to] of [[.25,.39],[.64,.78]]) {
        if (p < from || p > to) continue;
        const fraction = (p - from) / (to - from);
        phase = Math.sin(fraction * Math.PI); mark = fraction * 100;
      }
    }
    set('x', `${x.toFixed(2)}px`);
    set('opacity', visibility.toFixed(3));
    set('phase', Math.max(0, phase).toFixed(3));
    set('phase-mark', `${mark.toFixed(2)}%`);
    set('phase-alpha', (1 - phase * .83).toFixed(3));
    set('entry', active.kind === 'train' && !active.still ? (Math.sin(Math.PI * Math.min(1, p / .27)) * .65).toFixed(3) : 0);
    set('exit', active.kind === 'train' && !active.still ? (Math.sin(Math.PI * Math.max(0, (p - .73) / .27)) * .65).toFixed(3) : 0);
    const lean = active.kind === 'glass' && !active.still
      ? p < .32 ? -6 * (1 - ease(p / .32)) : p > .60 ? 5 * ease((p - .60) / .40) : 0 : 0;
    set('lean', `${lean.toFixed(2)}deg`);
    set('lift', `${active.kind === 'glass' && !active.still ? (-4 * Math.sin(p * Math.PI)).toFixed(2) : 0}px`);
    stage.dataset.resting = String(active.still || active.kind === 'glass' && p >= .32 && p <= .60);
  }
  function reveal() {
    const hidden = !active || blocked();
    stage.hidden = hidden;
    link.tabIndex = dismiss.tabIndex = hidden ? -1 : 0;
  }
  function restoreFocus() {
    const target = priorFocus?.isConnected && priorFocus !== document.body ? priorFocus
      : document.getElementById('catch-streamliner') || document.querySelector('main, #main, h1');
    if (!target) return;
    if (!target.hasAttribute('tabindex') && !target.matches('a,button,input,select,textarea')) target.tabIndex = -1;
    target.focus({ preventScroll: true });
  }
  function finish({ dismissVisit = false, returnFocus = false } = {}) {
    const kind = active?.kind;
    if (dismissVisit && kind === 'glass') {
      glassQuiet = true;
      try { sessionStorage.setItem(quietKey, '1'); } catch { /* No recipe or names are saved. */ }
    }
    active = null;
    pending = null;
    hovered = focused = false;
    if (kind) hasCrossed = true;
    // Both formats return naturally. Closing either quiets this document; only
    // the Sanctuary invitation remembers that preference across this tab session.
    done = dismissVisit;
    stage.dataset.state = 'idle';
    stopClock();
    lastFrame = null;
    idleElapsed = 0;
    reveal();
    if (returnFocus) restoreFocus();
    schedule();
  }
  function glassMarkup(feeling) {
    if (stage.dataset.delivery === 'courier') return courierMarkup(feeling);
    const drink = { glass: 'crystal-shot', ingredients: [{ id: feeling, parts: 3 }], stirred: true };
    const fallbackVessel = '<svg class="ss-passage-fallback-vessel" viewBox="0 0 110 150" focusable="false" aria-hidden="true"><path class="ss-passage-liquid" d="M26 66H84L75 122Q55 134 35 122Z"/><path class="ss-passage-glass-outline" d="M23 56Q55 45 87 56L76 126Q55 139 34 126ZM23 56Q55 69 87 56M55 68V131M29 89L80 112M81 88L30 112"/><ellipse cx="55" cy="56" rx="32" ry="8" class="ss-passage-glass-rim"/></svg>';
    const body = window.SoulSipGlass?.renderMini
      ? window.SoulSipGlass.renderMini(drink, { className: 'ss-passage-mini' })
      : `<span class="ss-passage-fallback"><img src="/images/soul-sips-mixer/spirit-${feeling}.webp" alt="" loading="eager">${fallbackVessel}</span>`;
    const reflection = window.SoulSipGlass?.svg ? window.SoulSipGlass.svg(drink) : fallbackVessel;
    return `${glassEffects()}<span class="ss-passage-reflection">${reflection}</span><span class="ss-passage-glass-body">${body}</span>`;
  }
  function courierMarkup(feeling) {
    const crew = stage.dataset.sprite === 'shades' ? 'shades' : 'orange';
    const [cx,cy,cw,ch] = crew === 'shades' ? [21,48,383,901] : [798,66,374,883];
    const cup = window.SoulSipGlass?.renderMini?.({glass:'crystal-shot',ingredients:[{id:feeling,parts:2}],stirred:true},{labels:false}) || '';
    const clip = `ss-courier-${crew}-portrait`;
    return `<span class="ss-courier" data-crew="${crew}"><svg class="ss-courier-road" viewBox="0 0 620 300" aria-hidden="true"><defs><linearGradient id="ss-courier-road-light"><stop stop-color="#a9bcff" stop-opacity="0"/><stop offset=".75" stop-color="#bfddff"/><stop offset="1" stop-color="#efdfad" stop-opacity=".2"/></linearGradient></defs><path class="ss-courier-road-glow" d="M-200 267C-95 255 18 280 130 265S310 263 440 267"/><path class="ss-courier-road-line" d="M-200 267C-95 255 18 280 130 265S310 263 440 267"/><ellipse cx="90" cy="267" rx="72" ry="13"/><path class="ss-courier-sparks" d="m28 224 2-6 2 6 6 2-6 2-2 6-2-6-6-2Zm113 27 2-5 2 5 5 2-5 2-2 5-2-5-5-2Z"/></svg><span class="ss-courier-runner"><span class="ss-courier-steps"></span><svg class="ss-courier-standing" viewBox="${cx} ${cy} ${cw} ${ch}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><clipPath id="${clip}"><rect x="${cx}" y="${cy}" width="${cw}" height="${ch}"/></clipPath></defs><image href="/friends/assets/courier-crew-plate.webp" width="1586" height="992" clip-path="url(#${clip})"/></svg></span><span class="ss-courier-cup">${cup}</span><span class="ss-courier-balance" aria-hidden="true">✦</span></span>`;
  }
  function glassEffects() {
    // Vector light and transparent vapour: no rectangular glow bitmap or canvas.
    return `<svg class="ss-passage-glass-wake" viewBox="0 0 900 300" focusable="false" aria-hidden="true"><defs><linearGradient id="ss-passage-wake-gradient"><stop stop-color="#99b4ff" stop-opacity="0"/><stop offset=".3" stop-color="#bab0ff" stop-opacity=".3"/><stop offset=".78" stop-color="#9eeaff"/><stop offset="1" stop-color="#f1faff" stop-opacity=".15"/></linearGradient></defs><g class="ss-passage-wake-glow"><path d="M0 226C168 188 290 249 426 225S578 230 638 204"/></g><g class="ss-passage-wake-lines" stroke="url(#ss-passage-wake-gradient)"><path d="M0 226C168 188 290 249 426 225S578 230 638 204"/><path d="M76 245C222 201 326 271 469 239S586 235 644 213"/><path d="M210 208C362 243 473 196 635 207C698 210 744 230 816 215"/></g><g class="ss-passage-wake-sparks"><path d="m430 222 3-8 3 8 8 3-8 3-3 8-3-8-8-3Z"/><path d="m550 216 2-6 2 6 6 2-6 2-2 6-2-6-6-2Z"/><path d="m296 228 2-5 2 5 5 2-5 2-2 5-2-5-5-2Z"/></g></svg>
    <svg class="ss-passage-glass-seal" viewBox="0 0 220 100" focusable="false" aria-hidden="true"><ellipse class="ss-passage-seal-glow" cx="110" cy="50" rx="86" ry="28"/><g class="ss-passage-seal-lines"><ellipse cx="110" cy="50" rx="86" ry="28"/><ellipse cx="110" cy="50" rx="74" ry="22"/><path d="M18 50h16m152 0h16M110 16v12m0 44v12M48 28l7 8m110 28 7 8M48 72l7-8m110-28 7-8"/></g><path class="ss-passage-seal-star" d="m110 34 5 11 14 5-14 5-5 11-5-11-14-5 14-5Z"/></svg>
    <svg class="ss-passage-glass-wisps" viewBox="0 0 220 300" focusable="false" aria-hidden="true"><g class="ss-passage-vapour-soft"><path d="M112 252C23 221 193 190 116 151S64 98 119 47C146 22 123 9 109-9"/><path d="M110 246C174 225 54 190 106 158S171 113 128 77S99 24 131 5"/></g><g class="ss-passage-vapour-lines"><path d="M112 252C23 221 193 190 116 151S64 98 119 47C146 22 123 9 109-9"/><path d="M110 246C174 225 54 190 106 158S171 113 128 77S99 24 131 5"/><path d="M112 244C175 218 127 206 147 183S181 137 162 109"/></g></svg>
    <svg class="ss-passage-glass-orbit" viewBox="0 0 200 240" focusable="false" aria-hidden="true"><ellipse class="ss-passage-orbit-path" cx="100" cy="140" rx="83" ry="32"/><g class="ss-passage-orbit-sparks"><path d="m28 118 3-8 3 8 8 3-8 3-3 8-3-8-8-3Z"/><path d="m171 148 2-6 2 6 6 2-6 2-2 6-2-6-6-2Z"/><path d="m85 44 2-5 2 5 5 2-5 2-2 5-2-5-5-2Z"/></g></svg>`;
  }
  function trainMarkup() {
    return `<svg class="sc-passage-aura" viewBox="0 0 1200 400" aria-hidden="true" focusable="false"><defs>
      <linearGradient id="sc-passage-energy" x1="0%" y1="70%" x2="100%" y2="35%">
        <stop offset="0" stop-color="#9976ff" stop-opacity="0"/>
        <stop offset=".23" stop-color="#b09aff"/>
        <stop offset=".55" stop-color="#8feeff"/>
        <stop offset=".83" stop-color="#eefcff"/>
        <stop offset="1" stop-color="#8feeff" stop-opacity=".35"/>
      </linearGradient>
    </defs>
    <g class="sc-passage-corona" stroke="url(#sc-passage-energy)">
      <path d="M-100 303 C190 350 655 389 1080 351 C1195 342 1256 291 1196 214"/>
      <path d="M-90 250 C215 184 479 140 710 54 C867 -14 1033 -12 1147 96"/>
    </g>
    <g class="sc-passage-flames" fill="url(#sc-passage-energy)" stroke="none">
      <path d="M-90 291 C126 330 329 345 575 345 L501 360 C251 362 65 347 -130 316 L27 317Z"/>
      <path d="M91 224 C375 137 647 68 899 6 C678 89 439 161 123 239 L198 211Z"/>
      <path d="M1034 65 C1176 99 1252 191 1235 280 C1274 177 1204 87 1074 42Z"/>
    </g>
    <g class="sc-passage-ribbons" stroke="url(#sc-passage-energy)">
      <path class="sc-passage-ribbon" d="M-100 303 C190 350 655 389 1080 351 C1195 342 1256 291 1196 214" pathLength="100"/>
      <path class="sc-passage-ribbon sc-passage-ribbon--high" d="M-90 250 C215 184 479 140 710 54 C867 -14 1033 -12 1147 96" pathLength="100"/>
      <path class="sc-passage-ribbon sc-passage-ribbon--thin" d="M-70 318 C188 375 550 383 842 372 C1066 365 1215 333 1218 268" pathLength="100"/>
    </g>
    <g class="sc-passage-motes">
      <path d="M148 230 l3 -9 3 9 9 3 -9 3 -3 9 -3 -9 -9 -3Z"/>
      <path d="M345 201 l2 -7 2 7 7 2 -7 2 -2 7 -2 -7 -7 -2Z"/>
      <path d="M624 124 l3 -10 3 10 10 3 -10 3 -3 10 -3 -10 -10 -3Z"/>
      <path d="M939 51 l2 -8 2 8 8 2 -8 2 -2 8 -2 -8 -8 -2Z"/>
      <path d="M413 366 l2 -7 2 7 7 2 -7 2 -2 7 -2 -7 -7 -2Z"/>
    </g></svg><img class="sc-passage-echo sc-passage-echo--1" src="${trainUrl}" alt="" draggable="false"><img class="sc-passage-echo sc-passage-echo--2" src="${trainUrl}" alt="" draggable="false"><svg class="sc-passage-energy-edge" viewBox="0 0 1200 400" aria-hidden="true" focusable="false"><path d="M968 94 C1091 115 1185 235 1189 307 C1186 337 1141 353 1080 351" pathLength="100"/></svg>`;
  }
  function start(kind, manual = {}) {
    if (active || blocked() || kind === 'train' && !trainReady) return;
    if (kind === 'glass' && glassQuiet && !manual.force) return;
    priorFocus = document.activeElement;
    const feeling = feelings.includes(manual.feeling) ? manual.feeling : feelings[(Math.floor(Date.now() / 86400000) + glassPasses) % feelings.length];
    active = { kind, still: motion.matches, elapsed: manual.focus && !motion.matches ? duration * (kind === 'train' ? .5 : .45) : 0 };
    stage.dataset.kind = kind;
    stage.dataset.state = active.still ? 'still' : 'crossing';
    stage.style.setProperty('--ss-passage-color', colors[feeling]);
    if (kind === 'glass') {
      const pass = glassPasses++;
      stage.dataset.delivery = pass % 2 === 1 ? 'courier' : 'solo';
      stage.dataset.sprite = (Math.floor(pass / 2)) % 2 === 0 ? 'orange' : 'shades';
      visual.innerHTML = glassMarkup(feeling);
      link.href = `/sanctuary-in-the-sky?pour=1&house=1&feeling=${encodeURIComponent(feeling)}#soul-sips-bar`;
      link.setAttribute('aria-label', 'This one’s on the house — mix a Soul Sip');
      invitation.innerHTML = '<small>A little feeling, above London.</small><strong>This one’s on the house <span aria-hidden="true">→</span></strong>';
      if(stage.dataset.delivery === 'courier') invitation.innerHTML = '<small>“They’re pouring feelings upstairs.”</small><strong>This one’s on the house <span aria-hidden="true">→</span></strong><span class="ss-courier-destination">THE SANCTUARY BAR</span>';
    } else {
      trainPasses++;
      stage.dataset.delivery = 'solo';
      delete stage.dataset.sprite;
      visual.innerHTML = trainMarkup();
      const body = make('span', 'sc-passage-body');
      body.append(trainImage);
      visual.append(body);
      link.href = '/streamliner#maintenance-carriage';
      link.setAttribute('aria-label', 'Catch the Streamliner — step aboard');
      invitation.innerHTML = '<strong>Catch the Streamliner <span aria-hidden="true">→</span></strong>';
    }
    hovered = focused = false;
    measure();
    reveal();
    if (manual.focus) link.focus({ preventScroll: true });
  }
  function tick(now) {
    raf = 0;
    const delta = lastFrame === null ? 0 : Math.max(0, now - lastFrame);
    lastFrame = now;
    const isBlocked = blocked();
    if (active) {
      reveal();
      const paused = isBlocked || hovered || focused;
      stage.dataset.state = active.still ? 'still' : paused ? 'paused' : 'crossing';
      if (!paused && !active.still) active.elapsed += Math.min(250, delta);
      if (!active.still && active.elapsed >= duration) finish();
      else render();
    } else if (!isBlocked && engaged) {
      const kind = allowedKind();
      if (kind === 'train') requestTrain(Boolean(pending));
      if (kind && (kind !== 'train' || trainReady)) {
        idleElapsed += Math.min(1000, delta);
        if (pending || idleElapsed >= (hasCrossed ? returnWait : wait)) {
          const call = pending || {};
          pending = null;
          start(kind, call);
        }
      }
    }
    schedule();
  }
  function engage() {
    if (engaged) return;
    engaged = true;
    engagementEvents.forEach(type => removeEventListener(type, engage, true));
    lastFrame = null;
    if (allowedKind() === 'train') requestTrain();
    schedule();
  }
  const engagementEvents = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'];
  if (!engaged) engagementEvents.forEach(type => addEventListener(type, engage, { capture: true, passive: true }));
  card.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'touch') { hovered = true; if (active && !active.still) stage.dataset.state = 'paused'; stopClock(); lastFrame = null; schedule(); }
  });
  card.addEventListener('pointerleave', () => { hovered = false; if (active && !active.still && !focused) stage.dataset.state = 'crossing'; stopClock(); lastFrame = null; schedule(); });
  card.addEventListener('focusin', () => {
    focused = true;
    if (active && !active.still) stage.dataset.state = 'paused';
    if (active && !active.still && (x < 20 || x + width > viewport - 20)) { active.elapsed = duration * (active.kind === 'train' ? .5 : .45); render(); }
    stopClock(); lastFrame = null; schedule();
  });
  card.addEventListener('focusout', event => { focused = card.contains(event.relatedTarget); if (active && !active.still && !focused && !hovered) stage.dataset.state = 'crossing'; stopClock(); lastFrame = null; schedule(); });
  dismiss.addEventListener('click', () => finish({ dismissVisit: true, returnFocus: true }));
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented || !active || obstruction()) return;
    finish({ dismissVisit: true, returnFocus: card.contains(document.activeElement) });
  });
  function call(detail = {}) {
    const kind = ['train', 'glass'].includes(detail.kind) ? detail.kind : kindNow();
    if (active) { if (detail.focus) link.focus({ preventScroll: true }); return; }
    if (kind === 'train' && trainFailed) return;
    if (kind === 'glass' && glassQuiet && detail.force !== true) return;
    engaged = true;
    done = false;
    pending = { ...detail, kind, force: detail.force === true };
    if (kind === 'train') requestTrain(true);
    stopClock(); lastFrame = null; schedule();
  }
  document.addEventListener('streamliner:call', event => call({ ...event.detail, kind: 'train', force: true }));
  document.addEventListener('soulsip:call', event => call({ ...event.detail, kind: 'glass', force: true }));
  function wake() {
    stopClock(); stopAssetWait(); lastFrame = null;
    reveal();
    if (!document.hidden && !suspended) {
      if (allowedKind() === 'train') requestTrain(Boolean(pending));
      schedule();
    }
  }
  document.addEventListener('visibilitychange', wake);
  addEventListener('pagehide', () => { suspended = true; wake(); });
  addEventListener('pageshow', () => { suspended = false; measure(); wake(); });
  addEventListener('resize', measure, { passive: true });
  addEventListener('scroll', () => { if (active?.kind === 'train') measure(); }, { passive: true });
  const changeMotion = () => {
    if (active) { active.still = motion.matches; active.elapsed = duration * (active.kind === 'train' ? .5 : .45); render(); }
    wake();
  };
  if (motion.addEventListener) motion.addEventListener('change', changeMotion);
  else motion.addListener(changeMotion);
  trainImage.addEventListener('load', () => { trainReady = trainImage.naturalWidth > 0; schedule(); });
  trainImage.addEventListener('error', () => {
    trainFailed = true;
    if (pending?.kind === 'train') pending = null;
    if (active?.kind === 'train') finish({ returnFocus: card.contains(document.activeElement) });
    else { stopClock(); lastFrame = null; schedule(); }
  });
  window.SoulSipPassage = Object.freeze({
    call,
    dismiss: () => finish({ dismissVisit: true, returnFocus: card.contains(document.activeElement) }),
    getState: () => ({ kind: active?.kind || null, state: stage.dataset.state, delivery: active?.kind === 'glass' ? stage.dataset.delivery : null, sprite: active?.kind === 'glass' ? stage.dataset.sprite : null, glassPasses, trainPasses, quiet: glassQuiet, reducedMotion: motion.matches, elapsed: Math.round(active?.elapsed ?? idleElapsed), eligible: home ? 'home' : 'lore' })
  });
  measure();
  if (engaged && allowedKind() === 'train') requestTrain();
  schedule();
})();
