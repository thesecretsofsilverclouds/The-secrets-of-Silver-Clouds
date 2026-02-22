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

    #gift-share-btn {
      margin-top: 8px; padding: 8px 20px;
      background: rgba(138,104,32,0.15); border: 1px solid rgba(200,160,20,0.4);
      border-radius: 6px; color: #c8a030; cursor: pointer;
      font-family: 'Cinzel', serif; font-size: 11px; letter-spacing: 2px;
      text-transform: uppercase; transition: all 0.3s ease; user-select: none;
    }
    #gift-share-btn:hover { background: rgba(200,160,20,0.25); border-color: #e8c040; color: #e8c040; }
    #gift-share-btn:active { transform: scale(0.97); }
    #gift-share-btn.sharing { opacity: 0.5; pointer-events: none; }

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
        <button id="gift-share-btn" onclick="window.giftShare()">✦ Share Your Gift ✦</button>
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

  // ── SHARE CARD ──────────────────────────────────
  const FACTION_IMAGES = {
    D: '/images/demons-legion.png',
    O: '/images/the-order.png',
    C: '/images/church.png',
    M: '/images/mi6.png',
    R: '/images/ragnorir.png'
  };

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load: ' + src));
      img.src = src;
    });
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = text.split(' ');
    let line = '';
    let lineCount = 0;
    const lines = [];
    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      if (ctx.measureText(testLine).width > maxWidth && line !== '') {
        lines.push(line.trim());
        line = words[i] + ' ';
      } else {
        line = testLine;
      }
    }
    lines.push(line.trim());
    for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
      let drawLine = lines[i];
      if (i === maxLines - 1 && lines.length > maxLines) {
        drawLine = drawLine.slice(0, -3) + '...';
      }
      ctx.fillText(drawLine, x, y + i * lineHeight);
      lineCount++;
    }
    return lineCount * lineHeight;
  }

  function drawCircleImage(ctx, img, cx, cy, radius) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    const size = radius * 2;
    const aspect = img.width / img.height;
    let sw = size, sh = size;
    if (aspect > 1) sh = size / aspect;
    else sw = size * aspect;
    ctx.drawImage(img, cx - sw / 2, cy - sh / 2, sw, sh);
    ctx.restore();
    // Border
    ctx.strokeStyle = 'rgba(200,160,20,0.7)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawRoundedImage(ctx, img, x, y, w, h, r) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.clip();
    const aspect = img.width / img.height;
    let sw = w, sh = h;
    if (aspect > 1) sh = w / aspect;
    else sw = h * aspect;
    ctx.drawImage(img, x + (w - sw) / 2, y + (h - sh) / 2, sw, sh);
    ctx.restore();
    ctx.strokeStyle = 'rgba(200,160,20,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.stroke();
  }

  async function generateShareCard() {
    const stored = localStorage.getItem('fateGift');
    if (!stored) return null;
    const gift = JSON.parse(stored);
    const fm = FACTIONS_META[gift.faction];
    if (!fm) return null;

    const W = 1080, H = 1350;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#0a0806';
    ctx.fillRect(0, 0, W, H);

    // Load images in parallel
    const creatureFile = '/gift-assets/' + gift.creature.file.split('/').pop();
    const weaponFile = '/gift-assets/' + gift.weapon.file.split('/').pop();
    const factionBgSrc = FACTION_IMAGES[gift.faction];

    let factionBgImg = null, creatureImg = null, weaponImg = null;
    try {
      [factionBgImg, creatureImg, weaponImg] = await Promise.all([
        loadImage(factionBgSrc),
        loadImage(creatureFile),
        loadImage(weaponFile)
      ]);
    } catch (e) {
      console.error('Share card image load failed:', e);
      return null;
    }

    // ── HEADER: Faction image background (top 35%) ──
    const headerH = 470;
    // Clip so faction image doesn't bleed into guardian section
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, headerH);
    ctx.clip();
    // Draw faction image cover-style
    const fAspect = factionBgImg.width / factionBgImg.height;
    let fDrawW = W, fDrawH = headerH;
    if (fAspect > W / headerH) {
      fDrawH = headerH;
      fDrawW = headerH * fAspect;
    } else {
      fDrawW = W;
      fDrawH = W / fAspect;
    }
    ctx.drawImage(factionBgImg, (W - fDrawW) / 2, (headerH - fDrawH) / 2, fDrawW, fDrawH);
    ctx.restore();

    // Dark gradient overlay
    const hGrad = ctx.createLinearGradient(0, 0, 0, headerH);
    hGrad.addColorStop(0, 'rgba(10,8,6,0.3)');
    hGrad.addColorStop(0.6, 'rgba(10,8,6,0.55)');
    hGrad.addColorStop(1, 'rgba(10,8,6,0.95)');
    ctx.fillStyle = hGrad;
    ctx.fillRect(0, 0, W, headerH);

    // Faction name + rune
    ctx.textAlign = 'center';
    ctx.fillStyle = fm.color;
    ctx.font = 'bold 28px Georgia, serif';
    ctx.fillText(fm.rune + '  ' + fm.name.toUpperCase() + '  ' + fm.rune, W / 2, headerH - 80);

    // "YOUR HOLY GIFT" title
    ctx.fillStyle = '#e8c040';
    ctx.font = 'bold 48px Georgia, serif';
    ctx.fillText('YOUR HOLY GIFT', W / 2, headerH - 30);

    // ── Thin gold separator ──
    const sepY = headerH + 10;
    const grad1 = ctx.createLinearGradient(100, 0, W - 100, 0);
    grad1.addColorStop(0, 'transparent');
    grad1.addColorStop(0.3, 'rgba(200,160,20,0.6)');
    grad1.addColorStop(0.7, 'rgba(200,160,20,0.6)');
    grad1.addColorStop(1, 'transparent');
    ctx.fillStyle = grad1;
    ctx.fillRect(100, sepY, W - 200, 2);

    // ── GUARDIAN SECTION ──
    const guardianY = sepY + 50;
    const imgSize = 180;
    const imgCenterX = 160;
    const textLeft = imgCenterX + imgSize / 2 + 40;
    const textMaxW = W - textLeft - 60;

    // "GUARDIAN" label
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8a6820';
    ctx.font = '20px Georgia, serif';
    ctx.letterSpacing = '3px';
    ctx.fillText('GUARDIAN', textLeft, guardianY + 10);

    // Guardian image (circle)
    drawCircleImage(ctx, creatureImg, imgCenterX, guardianY + imgSize / 2, imgSize / 2);

    // Guardian name
    ctx.fillStyle = '#e0d0a8';
    ctx.font = 'bold 30px Georgia, serif';
    const gNameY = guardianY + 50;
    wrapText(ctx, gift.creature.name, textLeft, gNameY, textMaxW, 36, 2);

    // Guardian lore
    ctx.fillStyle = '#8a7a5a';
    ctx.font = 'italic 22px Georgia, serif';
    wrapText(ctx, gift.creature.lore, textLeft, gNameY + 75, textMaxW, 30, 4);

    // ── Gold rune separator ──
    const sep2Y = guardianY + imgSize + 40;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(200,160,20,0.5)';
    ctx.font = '24px Georgia, serif';
    ctx.fillText('─────  ✦  ─────', W / 2, sep2Y);

    // ── HOLY ITEM SECTION ──
    const weaponY = sep2Y + 40;

    // "HOLY ITEM" label
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8a6820';
    ctx.font = '20px Georgia, serif';
    ctx.fillText('HOLY ITEM', textLeft, weaponY + 10);

    // Weapon image (rounded rect)
    drawRoundedImage(ctx, weaponImg, imgCenterX - imgSize / 2, weaponY, imgSize, imgSize, 20);

    // Weapon name
    ctx.fillStyle = '#e0d0a8';
    ctx.font = 'bold 30px Georgia, serif';
    const wNameY = weaponY + 50;
    wrapText(ctx, gift.weapon.name, textLeft, wNameY, textMaxW, 36, 2);

    // Weapon lore
    ctx.fillStyle = '#8a7a5a';
    ctx.font = 'italic 22px Georgia, serif';
    wrapText(ctx, gift.weapon.lore, textLeft, wNameY + 75, textMaxW, 30, 4);

    // ── FOOTER ──
    const footerY = H - 100;
    const grad2 = ctx.createLinearGradient(100, 0, W - 100, 0);
    grad2.addColorStop(0, 'transparent');
    grad2.addColorStop(0.3, 'rgba(200,160,20,0.4)');
    grad2.addColorStop(0.7, 'rgba(200,160,20,0.4)');
    grad2.addColorStop(1, 'transparent');
    ctx.fillStyle = grad2;
    ctx.fillRect(100, footerY, W - 200, 1);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#c8a030';
    ctx.font = 'bold 22px Georgia, serif';
    ctx.fillText('thesecretsofsilverclouds.com', W / 2, footerY + 40);
    ctx.fillStyle = '#6a5a3a';
    ctx.font = 'italic 20px Georgia, serif';
    ctx.fillText('Take the Faction Assessment to discover your own Holy Gift', W / 2, footerY + 72);

    // Outer border
    ctx.strokeStyle = 'rgba(200,160,20,0.3)';
    ctx.lineWidth = 3;
    ctx.strokeRect(20, 20, W - 40, H - 40);

    return canvas;
  }

  window.giftShare = async function () {
    const btn = document.getElementById('gift-share-btn');
    if (!btn) return;
    btn.classList.add('sharing');
    btn.textContent = 'Generating...';

    try {
      const canvas = await generateShareCard();
      if (!canvas) {
        btn.textContent = 'Error';
        setTimeout(() => { btn.textContent = '✦ Share Your Gift ✦'; btn.classList.remove('sharing'); }, 2000);
        return;
      }

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], 'my-holy-gift.png', { type: 'image/png' });

      // Try Web Share API (mobile native share sheet)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'My Holy Gift — The Secrets of Silver Clouds',
          text: 'I discovered my Holy Gift! Take the Faction Assessment to find yours.',
          files: [file]
        });
      } else {
        // Desktop fallback: download the image
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'my-holy-gift.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      // User cancelled share or error
      if (e.name !== 'AbortError') console.error('Share failed:', e);
    }

    btn.textContent = '✦ Share Your Gift ✦';
    btn.classList.remove('sharing');
  };

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
