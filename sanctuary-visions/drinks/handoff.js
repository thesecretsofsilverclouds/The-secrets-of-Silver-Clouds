/* A doorway from a shared Soul Sip into the narrated room.
 * No recipe parsing, storage, analytics, messages or automatic media playback.
 */
(() => {
  'use strict';
  const STORY = '/sanctuary-in-the-sky?story=arrival#ss-sanctuary-story';

  function decorateDoor(link) {
    link.classList.add('sip-story-door');
    link.href = STORY;
    // The maker can be embedded in the Sanctuary. Enter the room in the same
    // browser tab rather than loading an entire Sanctuary inside that iframe.
    link.target = '_top';
    link.referrerPolicy = 'no-referrer';
    const title = document.createElement('span');
    title.className = 'sip-story-door-title';
    title.textContent = 'Stay for another story';
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = ' ↗';
    title.append(arrow);
    const subtitle = document.createElement('small');
    subtitle.textContent = 'Step inside Sanctuary in the Sky';
    link.replaceChildren(title, subtitle);
    return link;
  }

  function mountDoors() {
    // This does not reveal or move any ending controls: the original eight
    // visible seconds of the chosen last line still belong to the recipient.
    for (const link of document.querySelectorAll('.place-link, .bar-footer a[href^="/sanctuary-in-the-sky"]')) {
      decorateDoor(link);
    }
    const reading = document.getElementById('mix-reading');
    if (reading && !reading.querySelector('.sip-story-door')) {
      reading.append(decorateDoor(document.createElement('a')));
    }
  }

  function mountStoryArrival() {
    if (new URLSearchParams(location.search).get('story') !== 'arrival') return;
    const story = document.getElementById('ss-sanctuary-story');
    const entry = story?.querySelector('[data-room-entry]');
    const audio = document.querySelector('#soul-sips-bar .ss-room-track');
    if (!story || !entry || !audio) return;

    const note = document.createElement('p');
    note.id = 'sip-story-arrival-note';
    note.className = 'sip-story-arrival-note';
    note.textContent = 'A complete narrated scene. Choose “Enter with sound” when you’re ready.';
    story.querySelector('.ss-story-controls')?.append(note);
    const description = entry.getAttribute('aria-describedby');
    entry.setAttribute('aria-describedby', [description, note.id].filter(Boolean).join(' '));

    let active = true;
    function stop() {
      active = false;
      entry.classList.remove('sip-story-arrival-glow', 'sip-story-arrival-away');
      audio.removeEventListener('playing', stop);
      document.removeEventListener('keydown', dismiss);
      document.removeEventListener('ss:room-claim', roomChoice);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', stop);
    }
    function dismiss(event) { if (event.key === 'Escape') stop(); }
    function roomChoice(event) {
      if (['quiet', 'jukebox'].includes(event.detail?.owner)) stop();
    }
    function visibility() {
      if (active) entry.classList.toggle('sip-story-arrival-away', document.hidden);
    }
    if (audio.paused || audio.ended) {
      entry.classList.add('sip-story-arrival-glow');
      audio.addEventListener('playing', stop, { once: true });
      document.addEventListener('keydown', dismiss);
      document.addEventListener('ss:room-claim', roomChoice);
      document.addEventListener('visibilitychange', visibility);
      window.addEventListener('pagehide', stop, { once: true });
      visibility();
    }
    // This is intentionally only a visual invitation. Navigation is not a
    // reliable mobile audio gesture; the existing entry button starts sound.
  }

  function mount() {
    if (document.documentElement.dataset.sipStoryHandoff === 'ready') return;
    document.documentElement.dataset.sipStoryHandoff = 'ready';
    mountDoors();
    mountStoryArrival();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
