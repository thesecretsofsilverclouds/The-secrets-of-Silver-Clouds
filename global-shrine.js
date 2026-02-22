(function () {
  // Check if we are on the quiz page. If so, we don't need the global shrine because the quiz handles it natively upon completion.
  if (window.location.pathname.includes('faction-quiz.html') || window.location.pathname.includes('holy-gift.html')) {
    return;
  }

  // 1. Inject CSS
  const style = document.createElement('style');
  style.textContent = `
    #gift-shimmer {
      position: fixed; inset: 0; pointer-events: none; z-index: 9000; opacity: 0;
      background: radial-gradient(ellipse at center,rgba(255,220,80,0.18) 0%,rgba(255,180,20,0.06) 50%,transparent 70%);
    }
    #gift-shimmer.active { animation: giftShimmerFade 2.4s ease-out forwards; }
    @keyframes giftShimmerFade { 0% { opacity: 1; } 100% { opacity: 0; } }

    #gift-panel {
      position: fixed; bottom: 0; right: 20px; /* Positioned bottom right */
      width: min(340px, 90vw); z-index: 9001; display: none;
      font-family: 'Cinzel', serif; /* Matching site typography */
    }
    #gift-panel.visible { display: block; }
    @keyframes giftPanelReveal {
      from { opacity: 0; transform: translateY(40px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    #gift-panel.reveal { animation: giftPanelReveal 0.7s cubic-bezier(0.22,1,0.36,1) forwards; }

    #gift-header {
      background: linear-gradient(135deg,#120e04 0%,#2e2208 50%,#120e04 100%);
      border: 1px solid #a07010; border-bottom: none; border-radius: 14px 14px 0 0;
      padding: 11px 22px; cursor: pointer; display: flex; align-items: center;
      justify-content: center; gap: 12px; user-select: none; transition: background 0.25s;
    }
    #gift-header:hover { background: linear-gradient(135deg,#1e1808 0%,#443210 50%,#1e1808 100%); }
    .gh-rune  { color: #c8a030; font-size: 14px; }
    .gh-label { color: #e8c040; font-size: 12px; letter-spacing: 3px; text-transform: uppercase; }
    .gh-chevron { color: #a07010; font-size: 10px; transition: transform 0.35s cubic-bezier(0.4,0,0.2,1); }
    #gift-panel.open .gh-chevron { transform: rotate(180deg); }

    #gift-body {
      background: linear-gradient(180deg,#0e0c06 0%,#161008 100%);
      border: 1px solid #a07010; border-top: none; border-radius: 0 0 4px 4px;
      overflow: hidden; max-height: 0;
      transition: max-height 0.42s cubic-bezier(0.4,0,0.2,1), padding 0.42s ease;
      padding: 0 24px; display: flex; flex-direction: column; align-items: center; gap: 0;
    }
    #gift-panel.open #gift-body { max-height: 50vh; padding: 16px 24px 20px; overflow-y: auto; overflow-x: hidden; }
    
    /* Scrollbar for the Shrine */
    #gift-body::-webkit-scrollbar { width: 6px; }
    #gift-body::-webkit-scrollbar-track { background: rgba(0,0,0,0.4); border-radius: 4px; }
    #gift-body::-webkit-scrollbar-thumb { background: #8a6820; border-radius: 4px; }
    #gift-body::-webkit-scrollbar-thumb:hover { background: #c8a030; }

    #gc-faction {
      font-size: 10px; letter-spacing: 3px; text-transform: uppercase;
      color: #7a6820; text-align: center; width: 100%; margin-bottom: 12px; transition: color 0.5s;
    }

    #gift-row { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; width: 100%; gap: 16px; }

    .gc { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .gc-tag  { font-size: 10px; letter-spacing: 3px; color: #8a6820; text-transform: uppercase; }
    .gc-name { font-size: 14px; color: #e0d0a8; text-align: center; max-width: 100%; line-height: 1.4; font-weight: bold; }
    .gc-name-wrap { display: flex; align-items: center; justify-content: center; gap: 5px; max-width: 100%; }
    .gc-rename-btn { background: none; border: none; color: rgba(138,104,32,0.5); cursor: pointer; font-size: 13px; padding: 2px 4px; line-height: 1; transition: color 0.2s; flex-shrink: 0; }
    .gc-rename-btn:hover { color: #e0d0a8; }
    .gc-rename-form { display: none; align-items: center; gap: 5px; margin-top: 3px; }
    /* iOS ZOOM BUG FIX: font-size must be at least 16px */
    .gc-rename-form input { background: rgba(255,255,255,0.05); border: 1px solid rgba(138,104,32,0.4); color: #e0d0a8; padding: 4px 8px; border-radius: 3px; font-family: inherit; font-size: 16px; width: 160px; text-align: center; }
    .gc-rename-form input:focus { outline: none; border-color: rgba(224,208,168,0.6); }
    .gc-rename-form button { background: rgba(138,104,32,0.2); border: 1px solid rgba(138,104,32,0.4); color: #e0d0a8; cursor: pointer; border-radius: 3px; padding: 4px 8px; font-size: 13px; }
    .gc-rename-form button:hover { background: rgba(138,104,32,0.4); }
    .gc-lore { font-size: 11px; color: #8a7a5a; text-align: center; max-width: 100%; line-height: 1.55; font-style: italic; font-family: 'Raleway', sans-serif;}

    .sprite-box { position: relative; flex-shrink: 0; overflow: hidden; }
    .sprite-box img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .sprite-box.creature {
      width: 100px; height: 100px; border-radius: 50%;
      border: 2px solid rgba(200,160,20,0.55);
      box-shadow: inset 0 0 20px rgba(0,0,0,0.7), 0 0 14px rgba(200,160,20,0.2);
      animation: giftBob 3.2s ease-in-out infinite;
    }
    .sprite-box.weapon { width: 100px; height: 100px; border-radius: 14px; border: 1px solid rgba(200,160,20,0.3); }
    .sprite-box.weapon img { animation: giftGlow 3s ease-in-out infinite; }

    @keyframes giftBob {
      0%,100% { transform: translateY(0px) scale(1); }
      50%      { transform: translateY(-4px) scale(1.02); }
    }
    @keyframes giftGlow {
      0%,100% { filter: brightness(1) drop-shadow(0 0 4px rgba(220,180,40,0.3)); }
      50%      { filter: brightness(1.08) drop-shadow(0 0 14px rgba(220,180,40,0.8)); }
    }

    .gift-sep {
      width: 80%; height: 1px; margin: 4px 0; flex-shrink: 0;
      background: linear-gradient(to right, transparent 0%, rgba(180,130,20,0.5) 30%, rgba(180,130,20,0.5) 70%, transparent 100%);
    }

    /* Mobile adjustments: keep it flush with the bottom edge on small screens */
    @media (max-width: 768px) {
      #gift-panel {
        right: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 100%;
        max-width: 400px;
      }
      #gift-panel.reveal {
        animation: giftPanelRevealMobile 0.7s cubic-bezier(0.22,1,0.36,1) forwards;
      }
      #gift-panel.open #gift-body { max-height: 50vh; overflow-y: auto; overflow-x: hidden; }
      @keyframes giftPanelRevealMobile {
        from { opacity: 0; transform: translateX(-50%) translateY(40px); }
        to   { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
    }
  `;
  document.head.appendChild(style);

  // 2. Inject HTML
  const container = document.createElement('div');
  container.innerHTML = `
    <div id="gift-shimmer"></div>
    <div id="gift-panel">
      <div id="gift-header" onclick="window.giftToggle()">
        <span class="gh-rune">✦</span>
        <span class="gh-label">Your Holy Gift</span>
        <span class="gh-rune">✦</span>
        <span class="gh-chevron">▲</span>
      </div>
      <div id="gift-body">
        <div id="gc-faction"></div>
        <div id="gift-row">
          <div class="gc">
            <span class="gc-tag">Guardian</span>
            <div class="sprite-box creature"><img id="gc-creature" src="" alt=""></div>
            <div class="gc-name-wrap">
              <span class="gc-name" id="gc-creature-name">—</span>
              <button class="gc-rename-btn" id="gc-rename-btn" title="Name your guardian">✎</button>
            </div>
            <div class="gc-rename-form" id="gc-rename-form">
              <input type="text" id="gc-rename-input" maxlength="40" placeholder="Enter a name…">
              <button id="gc-rename-confirm">✓</button>
            </div>
            <span class="gc-lore" id="gc-creature-lore"></span>
          </div>
          <div class="gift-sep"></div>
          <div class="gc">
            <span class="gc-tag">Holy Item</span>
            <div class="sprite-box weapon"><img id="gc-weapon" src="" alt=""></div>
            <span class="gc-name" id="gc-weapon-name">—</span>
            <span class="gc-lore" id="gc-weapon-lore"></span>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(container);

  // 3. Application Logic
  const IMAGE_BASE = '/gift-assets/'; // Images are mapped directly to /gift-assets/

  const FACTIONS_META = {
    D: { name: "Demon's Legion", color: '#e74c3c', rune: '⚔' },
    O: { name: 'The Order', color: '#9b59b6', rune: '📜' },
    C: { name: 'The Church', color: '#f1c40f', rune: '✦' },
    M: { name: 'MI6', color: '#2ecc71', rune: '◈' },
    R: { name: 'Ragnorir', color: '#6fa3d0', rune: 'ᚢ' }
  };

  const panel = document.getElementById('gift-panel');
  const shimmer = document.getElementById('gift-shimmer');

  function setImage(imgEl, filename) {
    const base = IMAGE_BASE;
    // Strip everything before the actual filename (e.g. 'gift-assets/', './', '/images/')
    // This allows it to work universally since we prefix it with the absolute BASE
    const cleanFilename = filename.split('/').pop();
    imgEl.src = base + cleanFilename;
  }

  function render(gift) {
    const creatureImg = document.getElementById('gc-creature');
    const weaponImg = document.getElementById('gc-weapon');
    if (!creatureImg) return;
    setImage(creatureImg, gift.creature.file);
    creatureImg.alt = gift.creature.name;
    setImage(weaponImg, gift.weapon.file);
    weaponImg.alt = gift.weapon.name;
    document.getElementById('gc-creature-name').textContent = gift.creature.name;
    document.getElementById('gc-weapon-name').textContent = gift.weapon.name;
    document.getElementById('gc-creature-lore').textContent = gift.creature.lore;
    document.getElementById('gc-weapon-lore').textContent = gift.weapon.lore;
    const fEl = document.getElementById('gc-faction');
    if (gift.faction && FACTIONS_META[gift.faction]) {
      const fm = FACTIONS_META[gift.faction];
      fEl.textContent = fm.rune + '  ' + fm.name + '  ' + fm.rune;
      fEl.style.color = fm.color;
    } else {
      fEl.textContent = '';
    }
    initGuardianRename(gift);
  }

  function initGuardianRename(gift) {
    const btn = document.getElementById('gc-rename-btn');
    const form = document.getElementById('gc-rename-form');
    const input = document.getElementById('gc-rename-input');
    const confirm = document.getElementById('gc-rename-confirm');
    const nameEl = document.getElementById('gc-creature-name');
    if (!btn) return;

    if (gift.guardianRenamed) {
      btn.style.display = 'none';
      return;
    }

    if (btn.dataset.renameInit) return;
    btn.dataset.renameInit = '1';

    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent toggling the panel if clicking on pencil
      input.value = nameEl.textContent;
      form.style.display = 'flex';
      btn.style.display = 'none';
      input.focus();
      input.select();
    });

    // Stop propagation on the form so clicking it doesn't close/toggle the header
    form.addEventListener('click', (e) => e.stopPropagation());

    function commitRename(e) {
      if (e) e.stopPropagation();
      const newName = input.value.trim();
      if (!newName) return;
      nameEl.textContent = newName;
      form.style.display = 'none';
      const stored = localStorage.getItem('fateGift');
      if (stored) {
        const saved = JSON.parse(stored);
        saved.creature.name = newName;
        saved.guardianRenamed = true;
        localStorage.setItem('fateGift', JSON.stringify(saved));
      }
    }

    confirm.addEventListener('click', commitRename);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') commitRename(e);
      if (e.key === 'Escape') { form.style.display = 'none'; btn.style.display = 'inline-block'; }
    });
  }

  function showPanel(animate) {
    document.body.style.paddingBottom = '65px'; // Prevents shrine from covering bottom text
    panel.classList.add('visible');
    if (animate) {
      panel.classList.add('reveal');
      panel.addEventListener('animationend', () => panel.classList.remove('reveal'), { once: true });
      shimmer.classList.add('active');
      shimmer.addEventListener('animationend', () => shimmer.classList.remove('active'), { once: true });
    }
    // Automatically open slightly delayed if requested (not typical for global inject, we usually keep it closed)
    // setTimeout(() => panel.classList.add('open'), animate ? 500 : 100);
  }

  // ── PUBLIC API ────────────────────────────────
  window.giftToggle = () => panel.classList.toggle('open');

  // ── INIT ──────────────────────────────────────
  function init() {
    const stored = localStorage.getItem('fateGift');
    if (stored) {
      const gift = JSON.parse(stored);
      render(gift);
      showPanel(true); // animate in
    }
  }

  // Wait for the DOM to be ready before initializing to prevent layout thrashing
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
