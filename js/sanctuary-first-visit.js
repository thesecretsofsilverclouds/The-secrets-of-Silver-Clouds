/* A first-visit hint for the existing narrated scene. Never starts any media. */
(() => {
  'use strict';

  function mount() {
    const host = document.getElementById('soul-sips-bar');
    const track = host?.querySelector('.ss-room-track');
    const entries = [
      ...document.querySelectorAll('#ss-sanctuary-story [data-room-entry]'),
      ...document.querySelectorAll('#soul-sips-bar .ss-room-enter')
    ];
    if (!host || !track || !entries.length || host.dataset.firstVisitHintReady === 'true') return;
    host.dataset.firstVisitHintReady = 'true';

    // The flag says only that the initial visit happened. No listening position,
    // recipe, name or interaction history is saved or sent anywhere.
    const key = 'silver-clouds:sanctuary:first-visit:v1';
    try {
      if (localStorage.getItem(key) === '1') return;
      localStorage.setItem(key, '1');
    } catch { /* The hint still works for this document if storage is disabled. */ }
    if (!track.paused && !track.ended) return;

    const quiet = host.querySelector('.ss-room-quiet');
    let active = true;
    entries.forEach(button => button.classList.add('sc-sanctuary-first-visit'));

    function pauseWhenAway() {
      entries.forEach(button => button.classList.toggle('sc-sanctuary-hint-away', document.hidden));
    }
    function stop() {
      if (!active) return;
      active = false;
      entries.forEach(button => button.classList.remove('sc-sanctuary-first-visit', 'sc-sanctuary-hint-away'));
      track.removeEventListener('playing', stop);
      quiet?.removeEventListener('click', stop);
      document.removeEventListener('keydown', dismiss);
      document.removeEventListener('visibilitychange', pauseWhenAway);
      document.removeEventListener('ss:room-claim', roomChoice);
      window.removeEventListener('pagehide', stop);
    }
    function dismiss(event) {
      if (event.key === 'Escape' && !event.defaultPrevented) stop();
    }
    function roomChoice(event) {
      if (event.detail?.owner === 'quiet' || event.detail?.owner === 'jukebox') stop();
    }

    track.addEventListener('playing', stop);
    quiet?.addEventListener('click', stop);
    document.addEventListener('keydown', dismiss);
    document.addEventListener('visibilitychange', pauseWhenAway);
    document.addEventListener('ss:room-claim', roomChoice);
    window.addEventListener('pagehide', stop);
    pauseWhenAway();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
