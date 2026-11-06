/* A third seat at the Sanctuary bar, isolated in a same-origin composer. */
(() => {
  'use strict';
  function mount() {
    const host = document.getElementById('soul-sips-bar');
    const tablist = host?.querySelector('.ss-bar-tabs');
    const sips = document.getElementById('ss-tab-sips');
    const melters = document.getElementById('ss-tab-melters');
    const oldPanels = [document.getElementById('ss-panel-sips'), document.getElementById('ss-panel-melters')];
    if (!host || !tablist || !sips || !melters || oldPanels.some(panel => !panel) || document.getElementById('ss-tab-friends')) return;
    const sourceParams = new URLSearchParams(location.search);
    const approved = new Set((window.SoulSipContent?.feelings || []).map(row => row.id));
    if (!approved.size) ['nostalgia', 'joy', 'love', 'homecoming', 'glory', 'sadness', 'anger'].forEach(id => approved.add(id));
    const selectedFeeling = approved.has(sourceParams.get('feeling')) ? sourceParams.get('feeling') : '';
    const frameURL = new URL('/pour/', location.origin);
    frameURL.searchParams.set('embed', '1');
    if (selectedFeeling) frameURL.searchParams.set('feeling', selectedFeeling);
    if (sourceParams.get('house') === '1') frameURL.searchParams.set('house', '1');
    const standaloneURL = new URL(frameURL);
    standaloneURL.searchParams.delete('embed');

    const friend = document.createElement('button');
    friend.type = 'button';
    friend.id = 'ss-tab-friends';
    friend.setAttribute('role', 'tab');
    friend.setAttribute('aria-controls', 'ss-panel-friends');
    friend.setAttribute('aria-selected', 'false');
    friend.tabIndex = -1;
    friend.innerHTML = '<span aria-hidden="true">✦</span> Pour for someone <small>Keep them a seat</small>';
    tablist.append(friend);
    const panel = document.createElement('div');
    panel.id = 'ss-panel-friends';
    panel.className = 'ss-friends-panel';
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', friend.id);
    panel.tabIndex = 0;
    panel.hidden = true;
    const loading = document.createElement('p');
    loading.className = 'ss-friends-loading';
    loading.setAttribute('role', 'status');
    loading.textContent = 'Keeping someone a seat…';
    panel.append(loading);
    const fallback = document.createElement('p');
    fallback.className = 'ss-friends-fallback';
    const alternate = document.createElement('a');
    alternate.href = standaloneURL.pathname + standaloneURL.search;
    alternate.target = '_blank';
    alternate.rel = 'noopener noreferrer';
    alternate.textContent = 'Open a separate seat ↗';
    alternate.setAttribute('aria-label', 'Open the friend’s bar in a new tab');
    fallback.append(alternate);
    oldPanels[1].insertAdjacentElement('afterend', panel);
    host.classList.add('ss-friends-enabled');
    const tabs = [sips, melters, friend];
    let iframe = null;
    let activatingFriends = false;

    function tellChild(visible) {
      iframe?.contentWindow?.postMessage({ type: 'soul-sips:visibility', visible: Boolean(visible) }, location.origin);
    }
    function updateLocation(friends) {
      const url = new URL(location.href);
      if (friends) url.searchParams.set('pour', '1');
      else url.searchParams.delete('pour');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
    function showOld(tab) {
      panel.hidden = true;
      const mode = tab === melters ? 'melters' : 'sips';
      host.dataset.mode = mode;
      delete document.body.dataset.soulSipMode;
      tabs.forEach(button => {
        const current = button === tab;
        button.setAttribute('aria-selected', String(current));
        button.tabIndex = current ? 0 : -1;
      });
      oldPanels.forEach((old, index) => { old.hidden = index !== (mode === 'melters' ? 1 : 0); });
      tellChild(false);
      if (!activatingFriends) updateLocation(false);
    }
    // These listeners are added after the existing two-tab module's listeners.
    sips.addEventListener('click', () => showOld(sips));
    melters.addEventListener('click', () => showOld(melters));

    function prepareFrame() {
      if (iframe) return;
      iframe = document.createElement('iframe');
      iframe.className = 'ss-friends-frame';
      iframe.title = 'Pour a Soul Sip for someone at the Sanctuary';
      iframe.setAttribute('allow', 'clipboard-write');
      iframe.referrerPolicy = 'no-referrer';
      iframe.style.height = '1100px';
      iframe.style.visibility = 'hidden';
      iframe.addEventListener('load', () => {
        loading.hidden = true;
        iframe.style.visibility = 'visible';
        tellChild(!panel.hidden);
      });
      iframe.addEventListener('error', () => { loading.textContent = 'This seat could not open. Try the separate bar below.'; });
      iframe.src = frameURL.pathname + frameURL.search;
      panel.append(iframe, fallback);
    }
    function showFriends({ scroll = false, focus = false } = {}) {
      if (host.dataset.mode !== 'friends') {
        // Let the original module close any live Mind Melter connection cleanly.
        activatingFriends = true;
        sips.click();
        activatingFriends = false;
      }
      oldPanels.forEach(old => { old.hidden = true; });
      host.dataset.mode = 'friends';
      document.body.dataset.soulSipMode = 'friends';
      panel.hidden = false;
      tabs.forEach(button => {
        const current = button === friend;
        button.setAttribute('aria-selected', String(current));
        button.tabIndex = current ? 0 : -1;
      });
      prepareFrame();
      tellChild(true);
      updateLocation(true);
      if (scroll) host.scrollIntoView({ block: 'start', behavior: 'instant' });
      if (focus) friend.focus({ preventScroll: true });
    }
    friend.addEventListener('click', () => showFriends());
    tablist.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const current = tabs.indexOf(event.target.closest('[role="tab"]'));
      if (current < 0) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
        : (current + (event.key === 'ArrowLeft' ? -1 : 1) + tabs.length) % tabs.length;
      tabs[index].click();
      tabs[index].focus({ preventScroll: true });
    }, true);
    addEventListener('message', event => {
      if (!iframe || event.origin !== location.origin || event.source !== iframe.contentWindow) return;
      const data = event.data;
      if (!data || typeof data !== 'object' || Array.isArray(data) || data.type !== 'soul-sips:height'
        || typeof data.height !== 'number' || !Number.isFinite(data.height)) return;
      const height = Math.ceil(Math.max(400, Math.min(18000, data.height))) + 8;
      if (Math.abs(parseInt(iframe.style.height, 10) - height) > 1) iframe.style.height = `${height}px`;
    });
    document.querySelector('.ss-friends-invitation a')?.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const url = new URL(location.href);
      url.hash = 'soul-sips-bar';
      history.replaceState(null, '', url.pathname + url.search + url.hash);
      showFriends({ scroll: true, focus: true });
    });
    addEventListener('pagehide', () => tellChild(false));
    addEventListener('pageshow', () => { if (iframe) tellChild(!panel.hidden); });
    if (sourceParams.get('pour') === '1') showFriends({ scroll: true, focus: true });
  }
  // Deferred bridge is injected last. DOMContentLoaded also covers delayed old modules.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
