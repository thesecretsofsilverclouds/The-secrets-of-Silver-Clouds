/* Shared, self-contained Blood Resonance exhibit for the Zara and Duskkin entries. */
(() => {
  'use strict';
  const forms = [
    { id: 'base', name: 'Duskkin', title: 'The hunter within', source: 'Baseline · no blood sample', color: '#ef5267', rgb: '239, 82, 103', effect: 'blood', role: 'Instinct. Steel. Restraint.', summary: 'Before the blood changes her, Zara is already a predator. Black armour, a crimson core, and a shadow companion at her side.', traits: ['Blood circuitry', 'Hunter instinct', 'Shadow bond'], companion: 'Shadow companion', lore: 'Sanguine forging turns mythical blood into energy. Each hunt can change the armour, the abilities, and the shape of the hunter. The first choice is what to let in.', best: 'The beginning of every hunt.' },
    { id: 'phoenix', name: 'Phoenix', title: 'Rise in fire', source: 'Phoenix blood', color: '#ffb553', rgb: '255, 181, 83', effect: 'fire', role: 'Aerial burst · fire pressure', summary: 'The core ignites. Wings of living flame unfold, turning the hunter into a storm of embers.', traits: ['Flame wings', 'Ember surge', 'Burning assault'], companion: 'Ember wolf', lore: 'In this manifestation, phoenix essence races through the armour channels as molten light. Zara and her companion burn with the same resonance; the whole hunt takes on the colour of fire.', best: 'Taking the fight into the air.' },
    { id: 'mistwraith', name: 'Mistwraith', title: 'Become the unseen', source: 'Mistwraith Stag blood', color: '#d7e8f4', rgb: '215, 232, 244', effect: 'mist', role: 'Evasion · spectral pursuit', summary: 'Edges unravel into silver mist. The hunter slips between shadows, with a spectral wolf following her trail.', traits: ['Spectral veil', 'Mist step', 'Silent pursuit'], companion: 'Spectral wolf', lore: 'Mistwraith Stags move between tangible and spectral states. Their resonance is imagined here as a veil across Zara’s armour: luminous, elusive, and almost impossible to hold in sight.', best: 'Leaving nothing for an enemy to strike.' },
    { id: 'ironbloom', name: 'Iron Bloom', title: 'Stand unbroken', source: 'Iron Bloom Behemoth blood', color: '#74acff', rgb: '116, 172, 255', effect: 'storm', role: 'Resilience · armoured force', summary: 'Electric blue floods the circuitry. Dense metallic armour turns every step into a declaration of strength.', traits: ['Metallic hide', 'Dense armour', 'Power surge'], companion: 'Armoured storm wolf', lore: 'The Iron Bloom Behemoth’s blood carries resilience. Duskkin hunters can take on a metallic sheen and formidable strength; here that inheritance becomes blue-lit plating and a companion forged for the same pressure.', best: 'Holding ground when the hunt hits back.' },
    { id: 'basilisk', name: 'Basilisk', title: 'Let venom speak', source: 'Basilisk blood', color: '#b4e66e', rgb: '180, 230, 110', effect: 'venom', role: 'Precision · venom pressure', summary: 'Acid green winds through the armour. Serpentine edges and a venom-lit companion make every approach feel lethal.', traits: ['Venom channels', 'Scale plating', 'Predator gaze'], companion: 'Venom wolf', lore: 'This manifestation gives basilisk essence a sharp, reptilian language: green circuitry, scaled armour, and a blade that seems to carry the creature’s malice.', best: 'Making a single opening count.' },
    { id: 'kraken', name: 'Baby Kraken', title: 'Reach into the abyss', source: 'Baby Kraken blood', color: '#65d7ff', rgb: '101, 215, 255', effect: 'water', role: 'Extended reach · crowd control', summary: 'Luminous tendrils unfurl behind Zara. Even a young kraken lends the hunter a reach no blade can match.', traits: ['Abyssal tendrils', 'Aquatic surge', 'Extended reach'], companion: 'Abyssal wolf', lore: 'A small sample, an enormous change. This form imagines young kraken essence as fluid appendages woven through the armour, with sea-blue light running through hunter and companion alike.', best: 'Turning a crowded battlefield into her territory.' },
    { id: 'dragon', name: 'Dragon', title: 'Bring the inferno', source: 'Dragon blood', color: '#ff7153', rgb: '255, 113, 83', effect: 'fire', role: 'Destructive force · overwhelming pressure', summary: 'Scale armour fractures with molten light. Draconic wings rise as the companion takes on an infernal silhouette.', traits: ['Dragon wings', 'Scale armour', 'Infernal force'], companion: 'Infernal drake-wolf', lore: 'Dragon essence is imagined as power barely contained: ember-red fissures, predatory wings, and a companion that looks born from the same furnace.', best: 'Making the enemy feel the weight of the hunt.' },
    { id: 'waternymph', name: 'Water Nymph', title: 'Move like the tide', source: 'Water Nymph blood', color: '#99ecf2', rgb: '153, 236, 242', effect: 'water', role: 'Fluid movement · water shaping', summary: 'Cool blue sweeps across the armour. Flowing water coils around Zara and a luminous, tide-marked wolf.', traits: ['Flowing guard', 'Water shaping', 'Tidal movement'], companion: 'Tide wolf', lore: 'Where kraken resonance reaches outward, this manifestation flows. Water nymph essence gives the armour a liquid rhythm, carrying Zara and her companion through a moonlit surge.', best: 'Flowing through a fight instead of meeting it head-on.' },
    { id: 'forbidden', name: 'Human Blood', title: 'The price of hunger', source: 'Forbidden human blood', color: '#ff3c60', rgb: '255, 60, 96', effect: 'unstable', role: 'Forbidden · addiction, not power', summary: 'The sacred law is broken. This is a portrait of bloodlust taking control, not another upgrade for the hunter.', traits: ['Broken restraint', 'Blood addiction', 'Unstable state'], companion: 'The shadow of bloodlust', lore: '“Mythical creature blood grants great power… Human blood comes with addiction.” Zara’s history makes that distinction personal. The Duskkin prohibit feeding on humans; this archive visualises the cost of losing that restraint.', best: 'An archive of what Zara fights to overcome.' }
  ];
  const asset = (kind, id) => `/images/blood-resonance/${kind}-${id}.webp`;
  const icon = (name) => ({ shuffle: '↝', compare: '◧', sound: '♪', share: '↗', replay: '⟳', reset: '◇', close: '×' }[name] || '');
  const host = document.querySelector('[data-blood-resonance]');
  if (!host) return;
  host.classList.add('br');
  host.id = 'blood-resonance';
  host.setAttribute('aria-labelledby', 'br-title');
  const pageHeader = document.querySelector('.lore-header');
  const alignAnchor = () => {
    const padding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    host.style.scrollMarginTop = `${Math.max(16, (pageHeader?.getBoundingClientRect().height || 0) + 16 - padding)}px`;
  };
  alignAnchor();
  if (pageHeader && window.ResizeObserver) new ResizeObserver(alignAnchor).observe(pageHeader);
  host.innerHTML = `
    <header class="br-header">
      <div><p class="br-eyebrow"><span class="br-status-dot"></span> Duskkin archive <span class="br-divider">/</span> Sanguine forging</p>
      <h2 id="br-title">Blood Resonance <span>System</span></h2>
      <p class="br-intro">One hunter. Many manifestations. Choose what runs through her veins.</p></div>
      <div class="br-header-mark" aria-hidden="true">IX<span>MANIFESTATIONS</span></div>
    </header>
    <div class="br-console">
      <aside class="br-samples" aria-label="Blood samples">
        <div class="br-panel-label"><span>01 / Choose a vial</span><span class="br-discovered">0 / 8</span></div>
        <button type="button" class="br-baseline" data-form="base" aria-pressed="true"><span aria-hidden="true">◇</span> Original Duskkin <span class="br-baseline-state">BASE</span></button>
        <div class="br-vials" role="group" aria-label="Choose blood to transform Zara">${forms.slice(1).map(form => `
          <button type="button" class="br-vial${form.id === 'forbidden' ? ' br-vial-forbidden' : ''}" data-form="${form.id}" aria-pressed="false" aria-label="${form.id === 'forbidden' ? 'Inspect forbidden human blood archive' : `Inject ${form.source}`}" style="--vial-color:${form.color};--vial-rgb:${form.rgb}">
            <span class="br-vial-halo" aria-hidden="true"></span><img src="${asset('vial', form.id)}" width="200" height="330" alt="" loading="lazy" decoding="async">
            <span class="br-vial-name">${form.name}</span><span class="br-vial-note">${form.id === 'forbidden' ? 'SEALED ARCHIVE' : 'BLOOD SAMPLE'}</span><span class="br-vial-check" aria-hidden="true">✓</span>
          </button>`).join('')}</div>
        <p class="br-selector-hint">A different blood. A different hunt.</p>
        <button type="button" class="br-reset" data-action="reset">Reset discoveries</button>
      </aside>
      <div class="br-viewer">
        <div class="br-stage" data-effect="blood" role="group" aria-label="Zara transformation artwork">
          <div class="br-art">
            <img class="br-art-current" src="${asset('form', 'base')}" width="1200" height="1800" alt="Zara in black Duskkin armour with a crimson core beside her shadow wolf, in a moonlit gothic city." loading="lazy" decoding="async" draggable="false">
            <img class="br-art-next" src="${asset('form', 'base')}" width="1200" height="1800" alt="" aria-hidden="true" draggable="false">
            <div class="br-compare-base" hidden><img src="${asset('form', 'base')}" width="1200" height="1800" alt="Original Duskkin form for comparison." loading="lazy" decoding="async" draggable="false"></div>
            <div class="br-compare-line" hidden></div>
          </div>
          <div class="br-stage-shade" aria-hidden="true"></div>
          <div class="br-particles" aria-hidden="true">${Array.from({length:16}, (_, i) => `<i style="--i:${i};--x:${(i * 29 + 7) % 100}%;--delay:${-(i * 0.7)}s;--duration:${5 + i % 6}s"></i>`).join('')}</div>
          <div class="br-resonance-fx" aria-hidden="true"><div class="br-energy-thread"></div><div class="br-core-ring"></div><div class="br-scan"></div></div>
          <div class="br-stage-top"><span class="br-live-label"><i></i> HUNTER LINK ACTIVE</span><span class="br-stage-index">FORM 00 / 08</span></div>
          <div class="br-stage-bottom"><p class="br-stage-kicker">ZARA + SHADOW COMPANION</p><p class="br-stage-title">The hunter within</p><p class="br-stage-prompt">Choose a vial to awaken a new form</p></div>
          <div class="br-loading" role="status" hidden>Drawing essence…</div>
          <div class="br-compare-labels" hidden><span>ORIGINAL</span><span class="br-compare-form">SELECTED FORM</span></div>
        </div>
        <div class="br-comparison" hidden><label for="br-comparison-range">Reveal original <span aria-hidden="true">↔</span> transformed</label><input id="br-comparison-range" type="range" min="0" max="100" value="50" aria-label="Original form reveal percentage" aria-describedby="br-comparison-hint"><p id="br-comparison-hint" class="br-comparison-hint">Drag across the artwork or use the slider.</p></div>
        <div class="br-viewer-tools"><button type="button" data-action="compare" aria-pressed="false" disabled><span aria-hidden="true">${icon('compare')}</span> Compare</button><button type="button" data-action="replay"><span aria-hidden="true">${icon('replay')}</span> Replay</button><button type="button" data-action="sound" aria-pressed="false" aria-label="Enable resonance sound"><span aria-hidden="true">${icon('sound')}</span> Sound off</button></div>
        <a class="br-art-link" href="${asset('form', 'base')}" target="_blank" rel="noopener" aria-label="View full Duskkin artwork">View full artwork <span aria-hidden="true">↗</span></a>
      </div>
      <aside class="br-dossier" aria-label="Current manifestation">
        <div class="br-panel-label"><span>02 / Manifestation</span><span class="br-dossier-symbol" aria-hidden="true">✧</span></div>
        <div class="br-form-heading"><p class="br-source">Baseline · no blood sample</p><h3 class="br-form-name">Duskkin</h3><p class="br-role">Instinct. Steel. Restraint.</p></div>
        <p class="br-summary">${forms[0].summary}</p>
        <div class="br-traits" aria-label="Form characteristics"></div>
        <div class="br-companion"><span class="br-mini-label">THE BONDED BEAST</span><p class="br-companion-name">Shadow companion</p><p>One resonance. Two predators.</p></div>
        <div class="br-seal" hidden><p class="br-mini-label">A LAW, NOT A LIMIT</p><h4>Some doors cost too much.</h4><p>Human blood brings addiction, not power. Open this sealed artwork to see what the Duskkin forbid.</p><button type="button" data-action="unseal">Open forbidden archive <span aria-hidden="true">↗</span></button><button type="button" class="br-seal-cancel" data-action="cancel-seal">Leave it sealed</button></div>
        <details class="br-lore"><summary>Inside the resonance <span aria-hidden="true">+</span></summary><p class="br-lore-copy"></p><p class="br-best"></p></details>
        <div class="br-dossier-actions"><button type="button" class="br-random" data-action="random"><span aria-hidden="true">${icon('shuffle')}</span> Inject random blood</button><button type="button" class="br-share" data-action="share"><span aria-hidden="true">${icon('share')}</span> Copy form link</button></div>
      </aside>
    </div>
    <footer class="br-footer"><span><i class="br-footer-dot"></i> <span class="br-system-status">Awaiting blood sample</span></span><span>Interactive form concepts <span aria-hidden="true">·</span> Explore the blood. Discover the hunter.</span></footer>
    <p class="br-announcement br-sr-only" role="status" aria-live="polite" aria-atomic="true"></p>
    <div class="br-share-fallback" hidden><label for="br-share-url">Copy this form link</label><input id="br-share-url" type="text" readonly><button type="button" data-action="close-share" aria-label="Close form link">×</button></div>
  `;
  const $ = selector => host.querySelector(selector);
  const $$ = selector => [...host.querySelectorAll(selector)];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const currentImage = $('.br-art-current');
  const nextImage = $('.br-art-next');
  const stage = $('.br-stage');
  const announce = message => { $('.br-announcement').textContent = message; };
  let selected = forms[0];
  let comparing = false;
  let soundEnabled = false;
  let audioContext;
  let request = 0;
  let busy = false;
  let comparisonDrag = null;
  let discovered = new Set();
  try { discovered = new Set(JSON.parse(localStorage.getItem('sc-blood-resonance-discovered') || '[]').filter(id => forms.some(f => f.id === id && id !== 'base'))); } catch { /* Storage is optional. */ }
  const cache = new Map();
  const artDescription = form => form.id === 'forbidden' ? 'Zara consumed by forbidden human bloodlust in red, fractured armour. A depiction of addiction, not power.' : `Zara’s ${form.name} manifestation with ${form.companion.toLowerCase()}, in a moonlit gothic city. ${form.summary}`;
  const stableStatus = () => selected.id === 'base' ? 'Awaiting blood sample' : selected.id === 'forbidden' ? 'Archive open · human blood is forbidden' : `Resonance stable · ${selected.name}`;
  function setBusy(value) {
    busy = value;
    if (busy) endComparisonDrag();
    $('[data-action="compare"]').disabled = busy || selected.id === 'base';
    $('[data-action="replay"]').disabled = busy;
  }
  function loadArt(form) {
    if (!cache.has(form.id)) {
      const picture = new Image();
      const promise = new Promise((resolve, reject) => { picture.onload = async () => { try { await picture.decode(); } catch { /* Loaded images can still display without explicit decode. */ } resolve(picture); }; picture.onerror = () => { cache.delete(form.id); reject(new Error('Artwork unavailable')); }; });
      picture.src = asset('form', form.id);
      cache.set(form.id, promise);
    }
    return cache.get(form.id);
  }
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  function playResonance(form) {
    if (!soundEnabled) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      audioContext.resume();
      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = form.effect === 'storm' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(85, now);
      oscillator.frequency.exponentialRampToValueAtTime(form.effect === 'mist' ? 320 : 180, now + .65);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(.075, now + .08);
      gain.gain.exponentialRampToValueAtTime(.001, now + 1.1);
      oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(now); oscillator.stop(now + 1.15);
    } catch { soundEnabled = false; updateSoundButton(); announce('Sound is unavailable in this browser.'); }
  }
  function updateSoundButton() {
    const button = $('[data-action="sound"]');
    button.innerHTML = `<span aria-hidden="true">♪</span> Sound ${soundEnabled ? 'on' : 'off'}`;
    button.setAttribute('aria-pressed', String(soundEnabled));
    button.setAttribute('aria-label', soundEnabled ? 'Mute resonance sound' : 'Enable resonance sound');
  }
  function updateDiscovery() {
    $('.br-discovered').textContent = `${discovered.size} / 8`;
    $('.br-discovered').title = `${discovered.size} of 8 blood samples discovered`;
    $$('[data-form]').forEach(button => button.classList.toggle('br-sampled', discovered.has(button.dataset.form)));
  }
  function compare(enable) {
    endComparisonDrag();
    comparing = enable && selected.id !== 'base';
    host.classList.toggle('br-comparing', comparing);
    $('[data-action="compare"]').setAttribute('aria-pressed', String(comparing));
    for (const selector of ['.br-compare-base', '.br-compare-line', '.br-compare-labels', '.br-comparison']) $(selector).hidden = !comparing;
    $('.br-compare-form').textContent = selected.name.toUpperCase();
    host.style.setProperty('--compare', `${$('#br-comparison-range').value}%`);
  }
  function render(form) {
    host.dataset.form = form.id;
    host.style.setProperty('--br-accent', form.color);
    host.style.setProperty('--br-rgb', form.rgb);
    stage.dataset.effect = form.effect;
    $('.br-source').textContent = form.source;
    $('.br-form-name').textContent = form.name;
    $('.br-role').textContent = form.role;
    $('.br-summary').textContent = form.summary;
    $('.br-traits').replaceChildren(...form.traits.map(trait => { const item = document.createElement('span'); item.textContent = trait; return item; }));
    $('.br-companion-name').textContent = form.companion;
    $('.br-companion').hidden = form.id === 'forbidden';
    $('.br-lore-copy').textContent = form.lore;
    $('.br-best').textContent = form.best;
    $('.br-stage-title').textContent = form.title;
    $('.br-stage-prompt').textContent = form.id === 'base' ? 'Choose a vial to awaken a new form' : form.id === 'forbidden' ? 'FORBIDDEN ARCHIVE · THE COST OF BLOODLUST' : `${form.source} · ${form.companion}`;
    $('.br-stage-index').textContent = `FORM ${String(forms.indexOf(form)).padStart(2, '0')} / 08`;
    $('.br-live-label').innerHTML = `<i></i> ${form.id === 'forbidden' ? 'FORBIDDEN ARCHIVE' : 'HUNTER LINK ACTIVE'}`;
    $('[data-action="compare"]').disabled = busy || form.id === 'base';
    $$('[data-form]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.form === form.id)));
  }
  function updateUrl(form) {
    const url = new URL(location.href);
    url.searchParams.set('blood', form.id);
    try { history.replaceState(null, '', url); } catch { /* File previews still work. */ }
  }
  async function select(form, { initial = false, replay = false } = {}) {
    if (!form) return;
    if (form.id === selected.id && !initial && !replay && !busy && $('.br-seal').hidden) return;
    const token = ++request;
    const unsealing = !$('.br-seal').hidden;
    $('.br-seal').hidden = true;
    host.classList.remove('br-sealed', 'br-transforming', 'br-crossfade');
    $('.br-loading').hidden = true;
    render(selected);
    setBusy(false);
    compare(false);
    if (unsealing) $('[data-form="forbidden"]').focus({ preventScroll: true });
    if (form.id === selected.id && !initial && !replay) {
      $('.br-system-status').textContent = stableStatus();
      return;
    }
    setBusy(true);
    if (form.id !== selected.id || replay) $('.br-loading').hidden = false;
    $('.br-system-status').textContent = 'Drawing essence…';
    try { await loadArt(form); } catch {
      if (token !== request) return;
      $('.br-loading').hidden = true;
      setBusy(false);
      render(selected);
      $('.br-system-status').textContent = 'Sample unavailable · try another vial';
      announce(`${form.name} artwork could not load. Choose another vial or retry.`);
      return;
    }
    if (token !== request) return;
    $('.br-loading').hidden = true;
    render(form);
    if (!initial && !motion.matches) {
      nextImage.src = asset('form', form.id);
      host.classList.add('br-transforming');
      playResonance(form);
      await sleep(400);
      if (token !== request) return;
      host.classList.add('br-crossfade');
      await sleep(800);
      if (token !== request) return;
    } else if (!initial) playResonance(form);
    currentImage.src = asset('form', form.id);
    currentImage.alt = artDescription(form);
    $('.br-art-link').href = asset('form', form.id);
    $('.br-art-link').setAttribute('aria-label', `View full ${form.name} artwork`);
    selected = form;
    setBusy(false);
    render(selected);
    host.classList.remove('br-transforming', 'br-crossfade');
    if (form.id !== 'base') {
      discovered.add(form.id);
      try { localStorage.setItem('sc-blood-resonance-discovered', JSON.stringify([...discovered])); } catch { /* Browsing without storage is supported. */ }
    }
    updateDiscovery();
    $('.br-system-status').textContent = stableStatus();
    if (!initial) updateUrl(form);
    announce(form.id === 'forbidden' ? 'Forbidden archive open. Human blood causes addiction, not power.' : `${form.name} form ready. ${form.role}.`);
  }
  function showSeal() {
    ++request;
    host.classList.remove('br-transforming', 'br-crossfade');
    setBusy(false);
    render(selected);
    compare(false);
    $('.br-loading').hidden = true;
    host.classList.add('br-sealed');
    $('.br-seal').hidden = false;
    $('.br-system-status').textContent = 'Sealed archive · human blood is forbidden';
    announce('Human blood archive is sealed. Open the forbidden archive or leave it sealed.');
    $('[data-action="unseal"]').focus();
  }
  for (const button of $$('[data-form]')) {
    const form = forms.find(item => item.id === button.dataset.form);
    button.addEventListener('click', () => form.id === 'forbidden' && selected.id !== 'forbidden' ? showSeal() : select(form));
    for (const event of ['pointerenter', 'focus']) button.addEventListener(event, () => loadArt(form).catch(() => {}), { passive: true });
    button.addEventListener('keydown', event => {
      const buttons = $$('[data-form]');
      const index = buttons.indexOf(button);
      const step = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
      if (step) { event.preventDefault(); buttons[(index + step + buttons.length) % buttons.length].focus(); }
      if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); buttons[event.key === 'Home' ? 0 : buttons.length - 1].focus(); }
    });
  }
  host.addEventListener('click', async event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'random') {
      const pool = forms.filter(form => !['base', 'forbidden', selected.id].includes(form.id));
      select(pool[Math.floor(Math.random() * pool.length)]);
    }
    if (action === 'reset') {
      discovered.clear();
      try { localStorage.removeItem('sc-blood-resonance-discovered'); } catch { /* Storage is optional. */ }
      updateDiscovery();
      announce('Discoveries reset. Choose a new vial to begin again.');
    }
    if (action === 'compare') { compare(!comparing); announce(comparing ? 'Comparison open. Move the reveal slider to compare original and transformed Zara.' : 'Comparison closed.'); }
    if (action === 'replay') select(selected, { replay: true });
    if (action === 'sound') { soundEnabled = !soundEnabled; updateSoundButton(); if (soundEnabled) playResonance(selected); else audioContext?.suspend(); }
    if (action === 'unseal') select(forms.find(form => form.id === 'forbidden'));
    if (action === 'cancel-seal') { $('.br-seal').hidden = true; host.classList.remove('br-sealed'); $('.br-system-status').textContent = stableStatus(); $('[data-form="forbidden"]').focus({preventScroll:true}); }
    if (action === 'close-share') { $('.br-share-fallback').hidden = true; $('[data-action="share"]').focus({preventScroll:true}); }
    if (action === 'share') {
      const url = new URL(location.href); url.searchParams.set('blood', selected.id); url.hash = 'blood-resonance';
      try { await navigator.clipboard.writeText(url.href); announce('Form link copied.'); $('.br-system-status').textContent = `${selected.name} link copied`; }
      catch { $('.br-share-fallback').hidden = false; $('#br-share-url').value = url.href; $('#br-share-url').focus({preventScroll:true}); $('#br-share-url').select(); announce('Select and copy the form link below.'); }
    }
  });
  const comparisonRange = $('#br-comparison-range');
  const comparisonArt = $('.br-art');
  function endComparisonDrag() {
    const pointer = comparisonDrag;
    comparisonDrag = null;
    host.classList.remove('br-dragging');
    if (pointer) {
      try { if (comparisonArt.hasPointerCapture(pointer.id)) comparisonArt.releasePointerCapture(pointer.id); } catch { /* Pointer capture may already have ended. */ }
    }
  }
  function revealAt(clientX) {
    const bounds = comparisonArt.getBoundingClientRect();
    if (!bounds.width) return;
    comparisonRange.value = String(Math.round(Math.max(0, Math.min(100, (clientX - bounds.left) / bounds.width * 100))));
    host.style.setProperty('--compare', `${comparisonRange.value}%`);
  }
  comparisonRange.addEventListener('input', event => host.style.setProperty('--compare', `${event.target.value}%`));
  comparisonArt.addEventListener('pointerdown', event => {
    if (!comparing || busy) return;
    if (!event.isPrimary || event.button !== 0) { endComparisonDrag(); return; }
    endComparisonDrag();
    comparisonDrag = { id: event.pointerId, x: event.clientX, y: event.clientY, active: false };
  });
  comparisonArt.addEventListener('pointermove', event => {
    const pointer = comparisonDrag;
    if (!pointer || pointer.id !== event.pointerId || !comparing || busy) return;
    if (event.pointerType === 'mouse' && !(event.buttons & 1)) { endComparisonDrag(); return; }
    if (!pointer.active) {
      const dx = Math.abs(event.clientX - pointer.x);
      const dy = Math.abs(event.clientY - pointer.y);
      if (Math.max(dx, dy) < 8) return;
      if (dy > dx) { endComparisonDrag(); return; }
      pointer.active = true;
      host.classList.add('br-dragging');
      try { comparisonArt.setPointerCapture(event.pointerId); } catch { /* Browsers without capture still support dragging within the image. */ }
    }
    if (event.cancelable) event.preventDefault();
    revealAt(event.clientX);
  });
  comparisonArt.addEventListener('pointerup', event => {
    if (comparisonDrag?.id !== event.pointerId) return;
    if (comparisonDrag.active && comparing && !busy) revealAt(event.clientX);
    endComparisonDrag();
  });
  for (const event of ['pointercancel', 'lostpointercapture']) comparisonArt.addEventListener(event, endComparisonDrag);
  const readLink = () => {
    const id = new URL(location.href).searchParams.get('blood');
    const form = forms.find(form => form.id === id) || forms[0];
    if (form.id === 'forbidden') showSeal(); else select(form, {initial:true});
  };
  window.addEventListener('popstate', readLink);
  host.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!$('.br-seal').hidden) $('[data-action="cancel-seal"]').click();
    if (!$('.br-share-fallback').hidden) $('[data-action="close-share"]').click();
    if (comparing) compare(false);
  });
  motion.addEventListener('change', () => { host.classList.remove('br-transforming', 'br-crossfade'); });
  render(selected);
  updateDiscovery();
  readLink();
})();
