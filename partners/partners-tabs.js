/* Keep each partnership experience independent; mount audio only when opened. */
(() => {
  'use strict';
  const host = document.getElementById('audio-pitch-content');
  const template = document.getElementById('audio-pitch-template');
  const tabs = [...document.querySelectorAll('.partner-tabs [role="tab"]')];
  const panels = new Map(tabs.map(tab => [tab.dataset.partnerTab, document.getElementById(tab.getAttribute('aria-controls'))]));
  let root = null;
  function replaceHash(hash) { const url = new URL(location.href); url.hash = hash; history.replaceState(null,'',url.href); }
  function mountAudio() {
    if (root || !host || !template) return;
    root = host.attachShadow({mode:'open'});
    root.append(template.content.cloneNode(true));
    document.dispatchEvent(new Event('sc:audio-ready'));
    root.querySelector('link[rel="stylesheet"]')?.addEventListener('load', readLocation, {once:true});
    root.addEventListener('click', event => {
      const anchor = event.composedPath().find(item => item instanceof HTMLAnchorElement);
      if (!anchor?.getAttribute('href')?.startsWith('#')) return;
      const target = root.getElementById(anchor.getAttribute('href').slice(1));
      if (!target) return;
      event.preventDefault();
      target.tabIndex = -1;
      target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
      target.focus({preventScroll:true});
      replaceHash(target.id);
    });
  }
  function select(name, {updateUrl=false,focus=false}={}) {
    if (!panels.has(name)) name = 'overview';
    if (name === 'audio') mountAudio();
    else root?.querySelector('audio')?.pause();
    panels.forEach((panel,key) => { if (panel) panel.hidden = key !== name; });
    tabs.forEach(tab => {
      const selected = tab.dataset.partnerTab === name;
      tab.setAttribute('aria-selected',String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    });
    if (updateUrl) replaceHash(name);
    document.dispatchEvent(new CustomEvent('sc:partner-tab',{detail:{name}}));
  }
  function readLocation() {
    const hash = location.hash.slice(1);
    if (hash === 'main') return;
    if (hash === 'build' || hash.startsWith('build?')) { select('build'); return; }
    const audioIds = [...(template?.content.querySelectorAll('[id]') || [])].map(el => el.id);
    const inAudio = hash === 'audio' || audioIds.includes(hash) || Boolean(root?.getElementById(hash));
    select(inAudio ? 'audio' : 'overview');
    if (inAudio && hash !== 'audio') {
      if (!root.querySelector('link[rel="stylesheet"]')?.sheet) return;
      const target = root.getElementById(hash);
      if (target) { target.tabIndex = -1; target.scrollIntoView({block:'start'}); target.focus({preventScroll:true}); }
    }
  }
  tabs.forEach((tab,index) => {
    tab.addEventListener('click', () => select(tab.dataset.partnerTab,{updateUrl:true}));
    tab.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      let next;
      if (event.key === 'ArrowRight') next = (index+1)%tabs.length;
      if (event.key === 'ArrowLeft') next = (index+tabs.length-1)%tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length-1;
      if (next === undefined) return;
      event.preventDefault();
      select(tabs[next].dataset.partnerTab,{updateUrl:true,focus:true});
    });
  });
  addEventListener('hashchange',readLocation);
  readLocation();
})();
