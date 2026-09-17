/* Presentation only. Existing reader, game, quiz and Worldstream state is untouched. */
(() => {
  'use strict';
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.getElementById('mainNav');
  function closeMenu() { nav?.classList.remove('is-open'); toggle?.setAttribute('aria-expanded', 'false'); }
  toggle?.addEventListener('click', () => { const open = toggle.getAttribute('aria-expanded') !== 'true'; toggle.setAttribute('aria-expanded', String(open)); nav?.classList.toggle('is-open', open); });
  nav?.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav?.classList.contains('is-open')) { closeMenu(); toggle.focus(); } });
  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
  const intro = document.getElementById('intro-dialog');
  const introVideo = document.getElementById('intro-video');
  const franchise = document.getElementById('franchise-dialog');
  const franchiseVideo = document.getElementById('franchise-video');
  document.querySelectorAll('[data-watch-franchise]').forEach(button => button.addEventListener('click', () => {
    if (!franchiseVideo.src) { franchiseVideo.src = franchiseVideo.dataset.src; franchiseVideo.load(); }
    franchise.showModal();
  }));
  franchise?.addEventListener('close', () => { franchiseVideo.pause(); });
  franchise?.addEventListener('click', e => { if (e.target === franchise) franchise.close(); });
  document.querySelector('[data-replay-original]')?.addEventListener('click', () => {
    franchise.close();
    if (!introVideo.src) { introVideo.src = window.innerWidth < 768 ? '/videos/intro-mobile.mp4' : '/videos/intro.mp4'; introVideo.load(); }
    intro.showModal();
  });
  document.querySelectorAll('[data-watch-intro]').forEach(button => button.addEventListener('click', () => {
    if (!introVideo.src) { introVideo.src = window.innerWidth < 768 ? '/videos/intro-mobile.mp4' : '/videos/intro.mp4'; introVideo.load(); }
    intro.showModal();
  }));
  document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  intro?.addEventListener('click', e => { if (e.target === intro) intro.close(); });
  intro?.addEventListener('close', () => { introVideo.pause(); try { sessionStorage.setItem('sc_intro_seen_v1', '1'); } catch {} });
  document.querySelector('[data-load-game]')?.addEventListener('click', e => {
    const frame = document.getElementById('gameIframe');
    frame.src = frame.dataset.src; frame.hidden = false; e.currentTarget.hidden = true;
    document.querySelector('[data-game-controls]').hidden = false;
    document.getElementById('game-status').textContent = 'Loading Lintelgotchi. If it does not appear, use Open in new tab below.';
  });
  document.querySelector('[data-fullscreen-game]')?.addEventListener('click', () => {
    const frame = document.getElementById('gameIframe');
    if (frame.requestFullscreen) frame.requestFullscreen().catch(() => { document.getElementById('game-status').textContent = 'Fullscreen is unavailable. You can open the game in a new tab.'; });
  });
  document.querySelector('[data-load-contact]')?.addEventListener('click', e => {
    const frame = document.getElementById('contact-frame'); frame.src = frame.dataset.src; frame.hidden = false; e.currentTarget.hidden = true;
  });
  // Honor one sound source at a time, even when both films have been opened.
  document.querySelectorAll('video').forEach(video => video.addEventListener('play', () => { document.querySelectorAll('video').forEach(other => { if (other !== video) other.pause(); }); }));
})();
