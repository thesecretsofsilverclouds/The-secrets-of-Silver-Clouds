/* Progressive presentation only: no storage, canon, source URLs or game changes. */
(() => {
  'use strict';
  const main = document.querySelector('.lore-container');
  const nav = document.querySelector('.lore-nav');
  if (!main || !nav) return;
  const make = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text) el.textContent = text;
    return el;
  };
  const link = (text, href, cls = 'sc-lore-nav-link') => {
    const el = make('a', cls, text); el.href = href; return el;
  };
  main.id ||= 'sc-lore-main';
  main.tabIndex = -1;
  document.body.prepend(link('Skip to content', `#${main.id}`, 'sc-lore-skip'));
  const brand = link('SILVER CLOUDS', '/', 'sc-lore-wordmark');
  brand.prepend(make('small', '', 'THE SECRETS OF'));
  nav.prepend(brand);
  nav.setAttribute('aria-label', 'Silver Clouds navigation');
  nav.append(link('Worldstream', '/worldstream/app/', 'sc-lore-nav-link sc-lore-nav-secondary'));
  nav.append(link('Partners', '/partners/', 'sc-lore-nav-link sc-lore-nav-secondary'));
  nav.append(link('Read free', '/episode-one/', 'sc-lore-nav-link sc-lore-read'));

  const title = main.querySelector('.lore-title');
  const hero = main.querySelector('.lore-hero, .lore-video-hero');
  const sections = [...main.querySelectorAll(':scope > .lore-section')];
  const summary = sections.find(section => section.querySelector('h2')?.textContent.trim() === 'Summary');
  if (title && hero) {
    const opening = make('div', 'sc-lore-opening');
    const intro = make('div', 'sc-lore-intro');
    main.prepend(opening);
    intro.append(make('p', 'sc-lore-eyebrow', 'From the Silver Clouds Codex'), title);
    if (summary) { summary.classList.add('sc-lore-summary'); intro.append(summary); }
    intro.append(make('p', 'sc-lore-orientation', 'An introduction to the world. The full lore below may reveal story details.'));
    const actions = make('div', 'sc-lore-actions');
    actions.append(link('Start the story', '/episode-one/', 'sc-lore-nav-link sc-lore-read'), link('Explore the Codex', '/#codex'));
    intro.append(actions); opening.append(intro, hero);
  }

  sections.forEach(section => {
    const heading = section.querySelector('h2')?.textContent.trim();
    if (!['Description', 'History', 'Background', 'Origin'].includes(heading)) return;
    const details = make('details', 'sc-lore-detail');
    const toggle = make('summary', '', heading === 'Description' ? 'Read the full lore' : `Read the ${heading.toLowerCase()}`);
    toggle.append(make('span', '', 'May contain story spoilers'));
    section.before(details); details.append(toggle, section);
  });
  const revealHash = () => {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    let details = target.closest('details');
    while (details) { details.open = true; details = details.parentElement?.closest('details'); }
  };
  revealHash(); window.addEventListener('hashchange', revealHash);

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const poster = document.querySelector('.image-gallery img')?.getAttribute('src');
  main.querySelectorAll('video').forEach(video => {
    video.controls = true;
    if (!video.hasAttribute('aria-label')) video.setAttribute('aria-label', 'Character or location film. Playback is optional.');
    if (poster && !video.poster) video.poster = poster;
    const respectMotion = () => { if (reducedMotion.matches) { video.autoplay = false; video.pause(); } };
    respectMotion(); reducedMotion.addEventListener('change', respectMotion);
    const film = video.closest('.sc-lore-film');
    if (film) film.addEventListener('toggle', () => { if (!film.open) video.pause(); });
  });

  // Preserve the existing lightbox and image sources; add keyboard and focus support.
  const gallery = [...main.querySelectorAll('.gallery-item')];
  const lightbox = document.getElementById('lightbox');
  const lightboxImage = document.getElementById('lightbox-img');
  let lastFocus = null;
  gallery.forEach((item, index) => {
    const img = item.querySelector('img');
    if (img) { img.loading = 'lazy'; img.decoding = 'async'; }
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', `View artwork ${index + 1}: ${img?.alt || 'Silver Clouds'}`);
    item.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); item.click(); }
    });
    item.addEventListener('click', () => {
      lastFocus = item;
      if (item.dataset.fullSrc && lightbox && lightboxImage) {
        lightboxImage.src = item.dataset.fullSrc;
        lightboxImage.alt = img?.alt || 'Silver Clouds artwork';
        lightbox.classList.add('active');
      }
    });
  });
  if (lightbox && lightboxImage && gallery.length) {
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('aria-label', 'Silver Clouds artwork gallery');
    lightbox.tabIndex = -1;
    const close = lightbox.querySelector('.lightbox-close');
    if (close) {
      close.tabIndex = 0; close.setAttribute('role', 'button'); close.setAttribute('aria-label', 'Close artwork');
      close.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); close.click(); }
      });
    }
    const controls = make('div', 'sc-gallery-controls');
    const prev = make('button', '', '← Previous'); prev.type = 'button';
    const next = make('button', '', 'Next →'); next.type = 'button';
    const count = make('span'); count.setAttribute('aria-live', 'polite');
    const caption = make('p', 'sc-gallery-caption');
    controls.append(prev, count, next);
    const content = lightbox.querySelector('.lightbox-content') || lightbox;
    content.append(caption, controls);
    let index = 0;
    const sync = () => {
      const found = gallery.findIndex(item => new URL(item.dataset.fullSrc || item.querySelector('img')?.src, location.href).href === lightboxImage.src);
      if (found >= 0) index = found;
      count.textContent = `${index + 1} / ${gallery.length}`;
      caption.textContent = gallery[index].dataset.caption || gallery[index].querySelector('img')?.alt || 'Silver Clouds artwork';
    };
    const step = direction => {
      index = (index + direction + gallery.length) % gallery.length;
      const source = gallery[index].querySelector('img');
      if (source) { lightboxImage.src = gallery[index].dataset.fullSrc || source.src; lightboxImage.alt = source.alt; }
      sync();
    };
    prev.addEventListener('click', event => { event.stopPropagation(); step(-1); });
    next.addEventListener('click', event => { event.stopPropagation(); step(1); });
    content.addEventListener('click', event => event.stopPropagation());
    let wasOpen = false;
    let previousOverflow = '';
    new MutationObserver(() => {
      const open = lightbox.classList.contains('active');
      if (open && !wasOpen) {
        previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        sync(); (close || lightbox).focus();
      }
      if (!open && wasOpen) {
        document.body.style.overflow = previousOverflow;
        lastFocus?.focus();
      }
      wasOpen = open;
    }).observe(lightbox, {attributes:true, attributeFilter:['class']});
    lightbox.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
      if (event.key === 'Tab') {
        const targets = [close, prev, next].filter(Boolean);
        const current = targets.indexOf(document.activeElement);
        if (event.shiftKey && current <= 0) { event.preventDefault(); targets.at(-1).focus(); }
        else if (!event.shiftKey && (current === -1 || current === targets.length - 1)) { event.preventDefault(); targets[0].focus(); }
      }
    });
  }
  const footer = make('footer', 'sc-lore-footer');
  footer.append(make('p', '', 'The Secrets of Silver Clouds · Created by Silent Silver'), link('Read free', '/episode-one/', ''), link('Worldstream', '/worldstream/app/', ''), link('All experiences', '/read-play/', ''), link('Partners', '/partners/', ''));
  main.append(footer);
})();
