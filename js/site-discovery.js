/* One quiet discovery layer for the homepage and Codex reading pages. */
(() => {
  'use strict';
  if (window.SoulSipPassage || document.documentElement.dataset.discoveryLoading === 'true') return;
  const path = location.pathname.replace(/\.html$/i, '').replace(/\/+$/, '') || '/';
  if (/(?:^|\/)(?:episode-one|episodeone|quiz|faction-quiz|holy-gift|press|partners(?:-local)?|audio-partners-local|pour|drink)(?:\/|$)/i.test(path)
    || /^\/worldstream(?:\/|$)/i.test(path)
    || /(?:^|\/)(?:sanctuary|soul-sips|streamliner)[^/]*(?:\/|$)/i.test(path)
    || document.querySelector('#soul-sips-bar, #maintenance-carriage')) return;
  if (!document.getElementById('home') && !document.querySelector('.lore-container, [data-codex-page], [data-passage-lore]')) return;
  document.documentElement.dataset.discoveryLoading = 'true';
  const version = '20261106';
  function style(path) {
    if ([...document.querySelectorAll('link[rel="stylesheet"]')].some(link => new URL(link.href, location.href).pathname === path)) return Promise.resolve();
    return new Promise((resolve, reject) => { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = path + '?v=' + version; link.onload = resolve; link.onerror = reject; document.head.append(link); });
  }
  function script(path) {
    return new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = path + '?v=' + version; script.async = false; script.onload = resolve; script.onerror = reject; document.head.append(script); });
  }
  Promise.all([style('/css/streamliner-passage.css'), style('/friends/glass.css'), style('/friends/passage.css')])
    .then(() => window.SoulSipGlass ? undefined : script('/friends/glass.js'))
    .then(() => script('/js/streamliner-passage.js'))
    .catch(() => { /* The ordinary links into both locations remain available. */ });
})();
