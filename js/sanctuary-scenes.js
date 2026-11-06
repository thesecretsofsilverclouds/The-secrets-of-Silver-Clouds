/* Narration-led artwork. Manual previews never change the audio position. */
(() => {
  'use strict';
  const story = document.getElementById('ss-sanctuary-story');
  if (!story || story.dataset.scenesReady === 'true') return;

  const frame = story.querySelector('.ss-story-frame');
  const scenes = [...story.querySelectorAll('.ss-story-frame-item[data-scene]')]
    .map((element, index) => ({
      element,
      id: element.dataset.scene,
      at: Number.isFinite(Number(element.dataset.at)) ? Number(element.dataset.at) : [0, 90, 165][index] || 0,
      image: element.querySelector('img'),
      title: element.dataset.title || `Scene ${index + 1}`,
      caption: element.dataset.caption || element.querySelector('figcaption')?.textContent.trim() || '',
      state: 'idle',
      promise: null
    }))
    .sort((a, b) => a.at - b.at);
  if (!frame || !scenes.length) return;
  story.dataset.scenesReady = 'true';

  const track = document.querySelector('.ss-room-track');
  const widget = document.querySelector('.ss-widget');
  const caption = story.querySelector('.ss-story-caption');
  const kicker = story.querySelector('.ss-story-kicker');
  const followButton = story.querySelector('.ss-story-follow');
  const choices = [...story.querySelectorAll('[data-view-scene]')]
    .filter(button => scenes.some(scene => scene.id === button.dataset.viewScene));
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const announcement = document.createElement('p');
  announcement.className = 'ss-story-announcement';
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  story.append(announcement);

  let active = scenes.find(scene => scene.element.classList.contains('ss-scene-current')) || scenes[0];
  let wanted = null;
  let requestEpoch = 0;
  let follow = followButton?.getAttribute('aria-pressed') !== 'false';
  let inView = visibleBounds();
  let motionDisabled = false;
  const animations = new Set();

  function visibleBounds() {
    const rect = story.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 &&
      rect.top < window.innerHeight && rect.left < window.innerWidth;
  }

  function cancelAnimations() {
    for (const animation of animations) animation.cancel();
    animations.clear();
  }

  function updateMotion() {
    const disabled = Boolean(reducedMotion?.matches || widget?.classList.contains('ss-motion-off') || document.hidden || !inView);
    if (disabled && !motionDisabled) cancelAnimations();
    motionDisabled = disabled;
    story.classList.toggle('ss-story-motion-off', disabled);
  }

  function announce(text) {
    announcement.textContent = text;
  }

  function renderControls() {
    choices.forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.viewScene === active.id));
      button.setAttribute('aria-controls', frame.id || 'ss-sanctuary-scene-frame');
    });
    if (followButton) {
      followButton.setAttribute('aria-pressed', String(follow));
      followButton.setAttribute('aria-controls', frame.id || 'ss-sanctuary-scene-frame');
    }
    story.dataset.followAudio = String(follow);
  }

  function loadScene(scene) {
    if (scene.state === 'ready') return Promise.resolve();
    if (scene.promise) return scene.promise;
    if (scene.state === 'error') return Promise.reject(new Error('Scene image unavailable'));
    const image = scene.image;
    if (!image || !image.getAttribute('src')) {
      scene.state = 'error';
      return Promise.reject(new Error('Scene image missing'));
    }
    scene.state = 'loading';
    scene.promise = new Promise((resolve, reject) => {
      let finished = false;
      const cleanup = () => {
        image.removeEventListener('load', loaded);
        image.removeEventListener('error', failed);
      };
      const failed = () => {
        if (finished) return;
        finished = true;
        cleanup();
        reject(new Error('Scene image could not load'));
      };
      const loaded = () => {
        if (finished) return;
        if (!image.naturalWidth) { failed(); return; }
        finished = true;
        cleanup();
        let decoding;
        try { decoding = typeof image.decode === 'function' ? image.decode() : undefined; }
        catch (error) { reject(error); return; }
        Promise.resolve(decoding).then(resolve, reject);
      };
      image.addEventListener('load', loaded);
      image.addEventListener('error', failed);
      image.loading = 'eager';
      if (image.complete) {
        if (image.naturalWidth) loaded();
        else failed();
      }
    }).then(() => {
      scene.state = 'ready';
    }, error => {
      scene.state = 'error';
      throw error;
    });
    return scene.promise;
  }

  function commit(scene, { snap = false } = {}) {
    updateMotion();
    const animate = scene !== active && !snap && !motionDisabled && typeof scene.element.animate === 'function';
    const opacity = animate ? scenes.map(item => Number.parseFloat(getComputedStyle(item.element).opacity) || 0) : [];
    cancelAnimations();
    active = scene;
    scenes.forEach((item, index) => {
      const current = item === scene;
      item.element.classList.toggle('ss-scene-current', current);
      item.element.setAttribute('aria-hidden', String(!current));
      if (!animate) return;
      const to = current ? 1 : 0;
      if (Math.abs(opacity[index] - to) < 0.001) return;
      const animation = item.element.animate([{ opacity: opacity[index] }, { opacity: to }], {
        duration: 1500,
        easing: 'cubic-bezier(.22,.61,.36,1)',
        fill: 'none'
      });
      animations.add(animation);
      animation.finished.catch(() => {}).finally(() => animations.delete(animation));
    });
    if (caption) caption.textContent = scene.caption;
    if (kicker) kicker.textContent = scene.title;
    story.dataset.scene = scene.id;
    renderControls();
  }

  function requestScene(scene, { manual = false, followAnnouncement = false, snap = false, force = false } = {}) {
    if (!scene || (!force && wanted === scene)) return;
    wanted = scene;
    const token = ++requestEpoch;
    const tell = () => {
      if (manual) announce(`${scene.title}. Image preview selected.`);
      else if (followAnnouncement) announce(`Following the audiobook. ${scene.title}.`);
    };
    if (scene === active) {
      frame.removeAttribute('aria-busy');
      renderControls();
      tell();
      return;
    }
    frame.setAttribute('aria-busy', 'true');
    loadScene(scene).then(() => {
      if (token !== requestEpoch || wanted !== scene) return;
      frame.removeAttribute('aria-busy');
      commit(scene, { snap });
      tell();
    }).catch(() => {
      if (token !== requestEpoch || wanted !== scene) return;
      frame.removeAttribute('aria-busy');
      if (manual || followAnnouncement) announce(`This scene could not load. ${active.title} remains on view.`);
    });
  }

  function sceneAtAudioTime() {
    const time = Number.isFinite(track?.currentTime) ? track.currentTime : 0;
    return scenes.reduce((current, scene) => scene.at <= time ? scene : current, scenes[0]);
  }

  function syncFromTrack(options) {
    if (follow) requestScene(sceneAtAudioTime(), options);
  }

  function preview(button) {
    follow = false;
    renderControls();
    requestScene(scenes.find(scene => scene.id === button.dataset.viewScene), { manual: true, force: true });
  }

  if (!frame.id) frame.id = 'ss-sanctuary-scene-frame';
  commit(active, { snap: true });
  loadScene(active).catch(() => {});
  syncFromTrack({ snap: true });

  choices.forEach((button, index) => {
    button.addEventListener('click', () => preview(button));
    button.addEventListener('keydown', event => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      let next;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % choices.length;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + choices.length) % choices.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = choices.length - 1;
      else return;
      event.preventDefault();
      choices[next].focus({ preventScroll: true });
      preview(choices[next]);
    });
  });

  followButton?.addEventListener('click', () => {
    follow = !follow;
    renderControls();
    if (follow) syncFromTrack({ followAnnouncement: true, force: true });
    else {
      requestEpoch++;
      wanted = active;
      frame.removeAttribute('aria-busy');
      cancelAnimations();
      announce('Image held. Choose a scene or follow the audiobook.');
    }
  });

  if (track) {
    ['timeupdate', 'seeking', 'seeked', 'loadedmetadata', 'ended'].forEach(type => track.addEventListener(type, () => syncFromTrack()));
    track.addEventListener('play', () => {
      scenes.forEach(scene => loadScene(scene).catch(() => {}));
      syncFromTrack();
    });
  }

  reducedMotion?.addEventListener('change', updateMotion);
  if (widget) new MutationObserver(updateMotion).observe(widget, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', () => {
    updateMotion();
    if (!document.hidden) syncFromTrack();
  });
  window.addEventListener('pagehide', cancelAnimations);
  window.addEventListener('pageshow', () => {
    inView = visibleBounds();
    updateMotion();
    syncFromTrack({ snap: true });
  });
  if (typeof IntersectionObserver === 'function') {
    new IntersectionObserver(entries => {
      inView = entries[entries.length - 1].isIntersecting;
      updateMotion();
    }, { threshold: 0 }).observe(story);
  } else {
    const refreshBounds = () => { inView = visibleBounds(); updateMotion(); };
    window.addEventListener('scroll', refreshBounds, { passive: true, capture: true });
    window.addEventListener('resize', refreshBounds, { passive: true });
  }
})();
