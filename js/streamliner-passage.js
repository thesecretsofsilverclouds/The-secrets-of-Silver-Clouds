/* Local prototype: the homepage's occasional, silent Streamliner passage. */
(() => {
    'use strict';

    if (!document.getElementById('home') || document.querySelector('[data-streamliner-passage]')) return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const localHost = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    const preview = localHost && new URLSearchParams(location.search).get('train') === 'preview';
    const firstWait = preview ? 1400 : 8000;
    const returnWait = 100000;
    const crossingDuration = 24000;
    const stillDuration = 20000;
    const spriteUrl = '/images/streamliner-discovery/streamliner-passing.png';

    const make = (tag, className) => {
        const node = document.createElement(tag);
        node.className = className;
        return node;
    };
    const stage = make('div', 'sc-passage-stage');
    stage.setAttribute('data-streamliner-passage', '');
    stage.dataset.state = 'idle';
    stage.hidden = true;

    const rails = make('div', 'sc-passage-rails');
    const entry = make('div', 'sc-passage-seam sc-passage-seam--entry');
    const exit = make('div', 'sc-passage-seam sc-passage-seam--exit');
    [rails, entry, exit].forEach(node => node.setAttribute('aria-hidden', 'true'));

    const train = make('a', 'sc-passage-link');
    train.href = '/streamliner#maintenance-carriage';
    train.setAttribute('aria-label', 'Catch the Streamliner — step aboard');
    train.tabIndex = -1;

    // Draw the aura as light, not another bitmap: the approved train stays intact.
    const svgNS = 'http://www.w3.org/2000/svg';
    const aura = document.createElementNS(svgNS, 'svg');
    aura.setAttribute('class', 'sc-passage-aura');
    aura.setAttribute('viewBox', '0 0 1200 400');
    aura.setAttribute('aria-hidden', 'true');
    aura.setAttribute('focusable', 'false');
    aura.innerHTML = `<defs>
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
    </g>`;
    const edge = document.createElementNS(svgNS, 'svg');
    edge.setAttribute('class', 'sc-passage-energy-edge');
    edge.setAttribute('viewBox', '0 0 1200 400');
    edge.setAttribute('aria-hidden', 'true');
    edge.setAttribute('focusable', 'false');
    edge.innerHTML = '<path d="M968 94 C1091 115 1185 235 1189 307 C1186 337 1141 353 1080 351" pathLength="100"/>';

    const art = make('img', 'sc-passage-art');
    art.alt = '';
    art.decoding = 'async';
    art.fetchPriority = 'low';
    art.draggable = false;
    const body = make('div', 'sc-passage-body');
    body.setAttribute('aria-hidden', 'true');
    body.append(art);
    const echoes = [1, 2].map(number => {
        const echo = make('img', `sc-passage-echo sc-passage-echo--${number}`);
        echo.alt = '';
        echo.setAttribute('aria-hidden', 'true');
        echo.draggable = false;
        echo.decoding = 'async';
        echo.fetchPriority = 'low';
        return echo;
    });
    const invitation = make('span', 'sc-passage-invitation');
    invitation.textContent = 'Catch the Streamliner →';
    train.append(aura, ...echoes, body, edge, invitation);
    stage.append(rails, entry, exit, train);
    document.body.append(stage);

    let assetReady = false;
    let assetFailed = false;
    let assetStarted = false;
    let assetIdle = 0;
    let assetAfterLoad = false;
    let engaged = preview || window.scrollY > 10;
    let suspended = false;
    let raf = 0;
    let idleTimer = 0;
    let lastFrame = null;
    let idleElapsed = 0;
    let hasCrossed = false;
    let active = null;
    let pendingCall = null;
    let hovered = false;
    let focused = false;
    let viewportWidth = 0;
    let trainWidth = 0;
    let trainX = 0;

    const set = (name, value) => stage.style.setProperty(`--sc-passage-${name}`, String(value));
    const ease = value => {
        const clipped = Math.min(1, Math.max(0, value));
        return clipped * clipped * (3 - 2 * clipped);
    };
    function placeVertically() {
        const trainHeight = trainWidth / 3;
        let y = Math.max(100, Math.min(window.innerHeight * 0.58, window.innerHeight - trainHeight / 2 - 35));
        // The narrow hero stacks its introduction below the art. Keep the first
        // encounter inside that illustration instead of crossing the text.
        const hero = viewportWidth <= 980 ? document.querySelector('#home .hero-art')?.getBoundingClientRect() : null;
        if (hero && hero.height > trainHeight * 1.45 && hero.bottom > trainHeight + 110 && hero.top < window.innerHeight * 0.6) {
            y = Math.max(100 + trainHeight / 2, hero.bottom - trainHeight * 0.68 - 8);
        }
        y = Math.max(trainHeight / 2 + 24, Math.min(y, window.innerHeight - trainHeight / 2 - 35));
        set('y', `${y.toFixed(2)}px`);
    }
    function measure() {
        viewportWidth = document.documentElement.clientWidth || window.innerWidth;
        trainWidth = Math.min(840, Math.max(320, viewportWidth * 0.68));
        const trainHeight = trainWidth / 3;
        set('width', `${trainWidth}px`);
        set('height', `${trainHeight}px`);
        placeVertically();
        if (active) render();
    }

    function obstruction() {
        if (document.querySelector('dialog[open], .lightbox.active, .ssd-lintel.ssd-on, #glory-overlay.open')) return true;
        return [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].some(dialog => {
            if (dialog.hidden || dialog.getAttribute('aria-hidden') === 'true') return false;
            const style = getComputedStyle(dialog);
            return style.display !== 'none' && style.visibility !== 'hidden' && dialog.getClientRects().length > 0;
        });
    }

    function cancelScheduled() {
        if (raf) window.cancelAnimationFrame(raf);
        if (idleTimer) window.clearTimeout(idleTimer);
        raf = 0;
        idleTimer = 0;
    }

    function cancelImageWait() {
        if (assetIdle) window.cancelIdleCallback(assetIdle);
        if (assetAfterLoad) window.removeEventListener('load', afterLoad);
        assetIdle = 0;
        assetAfterLoad = false;
    }

    function loadAssets() {
        if (assetStarted || assetFailed || document.hidden || suspended) return;
        if (!engaged || (motion.matches && !pendingCall)) return;
        cancelImageWait();
        assetStarted = true;
        art.src = spriteUrl;
        echoes.forEach(echo => { echo.src = spriteUrl; });
        assetReady = art.complete && art.naturalWidth > 0;
        schedule();
    }

    function afterLoad() {
        assetAfterLoad = false;
        requestAssets();
    }

    function requestAssets(immediate = false) {
        if (assetStarted || assetFailed || !engaged || document.hidden || suspended) return;
        if (motion.matches && !pendingCall) return;
        if (immediate || preview) {
            cancelImageWait();
            loadAssets();
        } else if (!assetIdle && !assetAfterLoad) {
            if (document.readyState !== 'complete') {
                assetAfterLoad = true;
                window.addEventListener('load', afterLoad, { once: true });
            } else if (window.requestIdleCallback) {
                assetIdle = window.requestIdleCallback(() => {
                    assetIdle = 0;
                    loadAssets();
                }, { timeout: 1200 });
            } else loadAssets();
        }
    }

    function schedule() {
        if (raf || idleTimer || suspended || document.hidden || assetFailed) return;
        if (!engaged && !pendingCall && !active) return;
        if (motion.matches && !pendingCall && !active) return;
        if (lastFrame === null) lastFrame = performance.now();
        if (active) raf = window.requestAnimationFrame(tick);
        else idleTimer = window.setTimeout(() => {
            idleTimer = 0;
            tick(performance.now());
        }, 250);
    }

    function reveal(blocked) {
        stage.hidden = !active || blocked || suspended || document.hidden;
        train.tabIndex = stage.hidden ? -1 : 0;
    }

    function finish(returnFocus = false) {
        active = null;
        hovered = false;
        focused = false;
        cancelScheduled();
        lastFrame = null;
        idleElapsed = 0;
        hasCrossed = true;
        stage.dataset.state = 'idle';
        reveal(false);
        if (returnFocus) document.getElementById('catch-streamliner')?.focus({ preventScroll: true });
        schedule();
    }

    function start(manual) {
        const still = motion.matches;
        placeVertically();
        active = {
            still,
            elapsed: manual && !still ? crossingDuration / 2 : 0,
            duration: still ? stillDuration : crossingDuration,
            focusWhenVisible: Boolean(manual?.focus)
        };
        hovered = false;
        focused = false;
        stage.dataset.state = 'crossing';
        render();
        reveal(false);
        if (active.focusWhenVisible) {
            active.focusWhenVisible = false;
            train.focus({ preventScroll: true });
        }
    }

    function render() {
        if (!active) return;
        const progress = active.still ? 0.5 : Math.min(1, active.elapsed / active.duration);
        const x = -trainWidth - 80 + progress * (viewportWidth + trainWidth + 160);
        trainX = x;
        const veil = ease(progress / 0.12) * ease((1 - progress) / 0.12);
        let strength = 0;
        let mark = 50;
        if (!active.still) {
            for (const [from, to] of [[0.25, 0.39], [0.64, 0.78]]) {
                if (progress < from || progress > to) continue;
                const local = (progress - from) / (to - from);
                strength = Math.sin(local * Math.PI);
                mark = local * 100;
            }
        }
        set('x', `${x.toFixed(2)}px`);
        set('veil', veil.toFixed(3));
        set('phase', strength.toFixed(3));
        set('phase-mark', `${mark.toFixed(2)}%`);
        set('phase-alpha', (1 - strength * 0.83).toFixed(3));
        set('entry', active.still ? 0 : (Math.sin(Math.PI * Math.min(1, progress / 0.27)) * 0.65).toFixed(3));
        set('exit', active.still ? 0 : (Math.sin(Math.PI * Math.max(0, (progress - 0.73) / 0.27)) * 0.65).toFixed(3));
    }

    function tick(now) {
        raf = 0;
        const delta = lastFrame === null ? 0 : Math.max(0, now - lastFrame);
        const elapsed = active ? Math.min(250, delta) : delta;
        lastFrame = now;
        const blocked = obstruction();
        const allowed = !blocked && !document.hidden && !suspended;

        if (active) {
            reveal(blocked);
            const paused = !allowed || hovered || focused;
            stage.dataset.state = paused ? 'paused' : 'crossing';
            if (!paused) active.elapsed += elapsed;
            if (active.elapsed >= active.duration) finish();
            else render();
        } else if (allowed) {
            if (pendingCall) {
                if (assetReady) {
                    const call = pendingCall;
                    pendingCall = null;
                    start(call);
                }
            } else if (engaged && !motion.matches) {
                idleElapsed += elapsed;
                if (assetReady && idleElapsed >= (hasCrossed ? returnWait : firstWait)) start(null);
            }
        }
        schedule();
    }

    const engagementEvents = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'];
    function engage() {
        engaged = true;
        engagementEvents.forEach(type => window.removeEventListener(type, engage, true));
        lastFrame = null;
        requestAssets();
        schedule();
    }
    if (!engaged) engagementEvents.forEach(type => window.addEventListener(type, engage, { capture: true, passive: true }));

    train.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') hovered = true; });
    train.addEventListener('pointerleave', () => { hovered = false; });
    train.addEventListener('focusin', () => {
        focused = true;
        // A keyboard catch at either edge must not freeze the train off screen.
        if (active && !active.still && (trainX < 24 || trainX + trainWidth > viewportWidth - 24)) {
            active.elapsed = active.duration / 2;
            render();
        }
    });
    train.addEventListener('focusout', event => { focused = train.contains(event.relatedTarget); });

    // The caller retains its semantic <a href>. Dispatch on document; optional detail: { focus: true }.
    document.addEventListener('streamliner:call', event => {
        if (assetFailed) return;
        engaged = true;
        if (active) {
            if (event.detail?.focus && !obstruction() && !document.hidden && !suspended) train.focus({ preventScroll: true });
            return;
        }
        pendingCall = { focus: Boolean(event.detail?.focus) };
        cancelScheduled();
        lastFrame = null;
        requestAssets(true);
        schedule();
    });

    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || event.defaultPrevented || !active || obstruction()) return;
        const returnFocus = train.contains(document.activeElement);
        pendingCall = null;
        finish(returnFocus);
    });

    function wake() {
        lastFrame = null;
        if (document.hidden || suspended) {
            cancelScheduled();
            cancelImageWait();
            reveal(true);
        } else {
            reveal(obstruction());
            if (engaged) requestAssets(Boolean(pendingCall));
            schedule();
        }
    }
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('pagehide', () => { suspended = true; wake(); });
    window.addEventListener('pageshow', () => { suspended = false; measure(); wake(); });
    window.addEventListener('resize', measure, { passive: true });
    window.addEventListener('scroll', () => { if (active) placeVertically(); }, { passive: true });
    const changeMotion = () => {
        cancelScheduled();
        cancelImageWait();
        if (active) finish(train.contains(document.activeElement));
        lastFrame = null;
        if (engaged) requestAssets(Boolean(pendingCall));
        schedule();
    };
    if (motion.addEventListener) motion.addEventListener('change', changeMotion);
    else motion.addListener(changeMotion);

    art.addEventListener('load', () => { assetReady = true; schedule(); });
    art.addEventListener('error', () => {
        assetFailed = true;
        pendingCall = null;
        cancelScheduled();
        cancelImageWait();
        finish(train.contains(document.activeElement));
    });
    measure();
    if (engaged) requestAssets(preview);
    schedule();
})();
