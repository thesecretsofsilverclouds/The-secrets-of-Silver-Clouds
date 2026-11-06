/* Measure a guide link click, not a completed read or a sale. */
(() => {
  'use strict';
  document.addEventListener('click', event => {
    const link = event.target.closest('a[data-guide-kind]');
    if (!link || typeof window.gtag !== 'function') return;
    window.gtag('event', 'guide_link_click', {
      guide_id: 'animantasy',
      link_kind: link.dataset.guideKind,
      book_slug: link.dataset.guideBook
    });
  });
})();
