(function () {
  // Flag: skip the shrine panel on quiz/holy-gift pages (they handle it natively).
  // The Glory system still runs on ALL pages.
  const isShrinePage = !(window.location.pathname.includes('faction-quiz') || window.location.pathname.includes('holy-gift'));

  if (isShrinePage) {

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
      let cleanFilename = filename.split('/').pop();
      // Prefer WebP (backward compat: old localStorage may store .png names)
      cleanFilename = cleanFilename.replace(/\.png$/i, '.webp');
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
      const creatureFile = '/gift-assets/' + gift.creature.file.split('/').pop().replace(/\.png$/i, '.webp');
      const weaponFile = '/gift-assets/' + gift.weapon.file.split('/').pop().replace(/\.png$/i, '.webp');
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

      // Award Glory for sharing the gift card
      if (window.GloryTracker) window.GloryTracker.increment('shareGift');

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

  } // end if (isShrinePage)

  // ══════════════════════════════════════════════════════════════════
  // ██  FACTION GLORY SYSTEM (Phase 2 — Firebase backend)         ██
  // ══════════════════════════════════════════════════════════════════

  const FACTIONS = {
    D: { name: "Demon's Legion", color: '#e74c3c', rune: '⚔' },
    O: { name: 'The Order', color: '#9b59b6', rune: '📜' },
    C: { name: 'The Church', color: '#f1c40f', rune: '✦' },
    M: { name: 'MI6', color: '#2ecc71', rune: '◈' },
    R: { name: 'Ragnorir', color: '#6fa3d0', rune: 'ᚢ' }
  };

  // ── Firebase Configuration ────────────────────────────────────
  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyBEXLzWqxJA3cAQ7VlGSoa5VROw-xJPsYk',
    authDomain: 'silver-clouds-glory.firebaseapp.com',
    projectId: 'silver-clouds-glory',
    storageBucket: 'silver-clouds-glory.firebasestorage.app',
    messagingSenderId: '201443263330',
    appId: '1:201443263330:web:0b4fd2f81131fd1413623b'
  };

  // Load Firebase SDK asynchronously (non-blocking)
  (async function loadFirebaseSDK() {
    try {
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js');
      const {
        getFirestore, doc, updateDoc, increment, collection, getDocs
      } = await import('https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js');

      const app = initializeApp(FIREBASE_CONFIG);
      const db = getFirestore(app);

      // Attach Firestore helpers to GloryTracker
      GloryTracker._fs = { doc, updateDoc, increment, collection, getDocs, db };
    } catch (e) {
      console.warn('[Glory] Firebase failed to load, using localStorage only:', e);
    }
  })();

  // ── Glory Tracker ─────────────────────────────────────────────
  const GloryTracker = {
    KEY: 'factionGlory',

    getStore() {
      try {
        return JSON.parse(localStorage.getItem(this.KEY)) || null;
      } catch { return null; }
    },

    saveStore(store) {
      localStorage.setItem(this.KEY, JSON.stringify(store));
    },

    /** Create a new store when the user first completes the quiz */
    create(factionKey) {
      const store = {
        faction: factionKey,
        personal: 0,
        lastLoreVisit: '',
        lastMapVisit: '',
        lastReturnVisit: '',
        sharedGift: false,
        sharedAllegiance: false,
        quizCompleted: false
      };
      this.saveStore(store);
      return store;
    },

    /**
     * Increment glory for an action.
     * @param {string} action - one of: quiz, shareGift, shareAllegiance, lore, map, returnVisit
     * @returns {boolean} true if points were actually awarded
     */
    increment(action) {
      const store = this.getStore();
      if (!store) return false;
      const today = new Date().toISOString().slice(0, 10);
      let awarded = false;

      switch (action) {
        case 'quiz':
          if (!store.quizCompleted) { store.quizCompleted = true; store.personal++; awarded = true; }
          break;
        case 'shareGift':
          if (!store.sharedGift) { store.sharedGift = true; store.personal++; awarded = true; }
          break;
        case 'shareAllegiance':
          if (!store.sharedAllegiance) { store.sharedAllegiance = true; store.personal++; awarded = true; }
          break;
        case 'lore':
          if (store.lastLoreVisit !== today) { store.lastLoreVisit = today; store.personal++; awarded = true; }
          break;
        case 'map':
          if (store.lastMapVisit !== today) { store.lastMapVisit = today; store.personal++; awarded = true; }
          break;
        case 'returnVisit':
          if (store.lastReturnVisit !== today) { store.lastReturnVisit = today; store.personal++; awarded = true; }
          break;
      }

      if (awarded) {
        this.saveStore(store);
        this._syncToFirestore(store.faction);
      }
      return awarded;
    },

    /** Push +1 to the faction's Firestore counter (fire-and-forget) */
    _syncToFirestore(factionKey) {
      if (!this._fs) return;
      const { doc, updateDoc, db } = this._fs;
      const fsInc = this._fs.increment;
      const ref = doc(db, 'factions', factionKey);
      updateDoc(ref, { glory: fsInc(1) })
        .catch(e => console.warn('[Glory] Firestore sync failed:', e));
    },

    /** Simple string hash for deterministic simulated scores (fallback) */
    _hash(str) {
      let h = 0;
      for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h |= 0;
      }
      return Math.abs(h);
    },

    /** Get the user's faction and personal score from localStorage */
    getScores() {
      const store = this.getStore();
      if (!store) return null;
      // Simulated fallback scores in case Firestore is unavailable
      const today = new Date().toISOString().slice(0, 10);
      const seed = this._hash(today);
      const scores = {};
      const keys = Object.keys(FACTIONS);
      keys.forEach((f, i) => {
        if (f === store.faction) {
          scores[f] = store.personal;
        } else {
          scores[f] = 2400 + ((seed * (i + 1) * 7) % 600);
        }
      });
      return { faction: store.faction, personal: store.personal, scores };
    },

    /** Fetch live faction scores from Firestore */
    async fetchLiveScores() {
      if (!this._fs) return null;
      try {
        const { collection, getDocs, db } = this._fs;
        const snapshot = await getDocs(collection(db, 'factions'));
        const scores = {};
        snapshot.forEach(d => { scores[d.id] = d.data().glory || 0; });
        return scores;
      } catch (e) {
        console.warn('[Glory] Firestore read failed:', e);
        return null;
      }
    }
  };

  // Expose for cross-file access (faction-quiz.html)
  window.GloryTracker = GloryTracker;

  // ── Glory CSS ─────────────────────────────────────────────────
  const gloryStyle = document.createElement('style');
  gloryStyle.textContent = `
    /* Glory Nav Widget */
    #glory-widget {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 0.4rem 0.9rem;
      background: rgba(0,0,0,0.35);
      border: 1px solid rgba(200,160,20,0.5);
      border-radius: 20px;
      color: #e8c040;
      font-family: 'Cinzel', serif;
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.3s ease;
      user-select: none;
      white-space: nowrap;
      text-decoration: none;
      box-shadow: 0 0 8px rgba(200,160,20,0.15);
      animation: gloryPulse 3s ease-in-out infinite;
    }
    #glory-widget:hover {
      background: rgba(200,160,20,0.2);
      border-color: #e8c040;
      box-shadow: 0 0 16px rgba(200,160,20,0.35);
      transform: translateY(-1px);
    }
    @keyframes gloryPulse {
      0%,100% { box-shadow: 0 0 8px rgba(200,160,20,0.15); }
      50%     { box-shadow: 0 0 14px rgba(200,160,20,0.3); }
    }
    .glory-rune { font-size: 1rem; }
    .glory-count { font-weight: bold; }

    /* Glory Leaderboard Overlay */
    #glory-overlay {
      display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      z-index: 10000; background: rgba(0,0,0,0.8);
      justify-content: center; align-items: center;
      backdrop-filter: blur(4px);
    }
    #glory-overlay.open { display: flex; }

    .glory-board {
      background: linear-gradient(180deg, #0e0c06 0%, #161008 100%);
      border: 1px solid rgba(200,160,20,0.5);
      border-radius: 14px;
      width: min(420px, 92vw);
      padding: 1.5rem;
      font-family: 'Cinzel', serif;
      color: #e0d0a8;
      box-shadow: 0 0 40px rgba(200,160,20,0.15);
    }
    .glory-board-title {
      text-align: center; font-size: 0.8rem; letter-spacing: 4px;
      text-transform: uppercase; color: #a07010; margin-bottom: 1.2rem;
    }

    .glory-row {
      display: flex; align-items: center; gap: 10px;
      padding: 0.55rem 0.8rem; border-radius: 8px;
      margin-bottom: 6px; transition: background 0.2s;
    }
    .glory-row.highlight {
      background: rgba(200,160,20,0.1);
      border: 1px solid rgba(200,160,20,0.25);
    }
    .glory-row-rune { font-size: 1.1rem; width: 24px; text-align: center; flex-shrink: 0; }
    .glory-row-name { font-size: 0.8rem; width: 120px; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .glory-row-bar-wrap {
      flex: 1; height: 10px; background: rgba(255,255,255,0.06);
      border-radius: 5px; overflow: hidden;
    }
    .glory-row-bar {
      height: 100%; border-radius: 5px;
      transition: width 0.8s cubic-bezier(0.22,1,0.36,1);
    }
    .glory-row-score { font-size: 0.8rem; width: 50px; text-align: right; flex-shrink: 0; color: #c8a030; }

    .glory-personal {
      text-align: center; margin-top: 1rem; padding-top: 0.8rem;
      border-top: 1px solid rgba(200,160,20,0.15);
      font-size: 0.75rem; color: #8a6820; letter-spacing: 1px;
    }
    .glory-personal strong { color: #e8c040; }

    /* Floating pill for pages with no nav */
    #glory-widget.glory-floating {
      position: fixed; top: 16px; right: 16px;
      z-index: 9002;
    }

    /* Extra scroll room so floating pill doesn't cover bottom text */
    body.has-glory-floating { padding-bottom: 0; }

    /* Lore nav integration */
    .lore-nav #glory-widget {
      margin-left: auto;
    }

    @media (max-width: 768px) {
      .glory-board { padding: 1.2rem; }
      .glory-row-name { width: 90px; font-size: 0.7rem; }
      .glory-row-score { width: 40px; font-size: 0.7rem; }
      #glory-widget.glory-floating { top: 12px; right: 10px; font-size: 0.75rem; padding: 0.3rem 0.7rem; }
    }
  `;
  document.head.appendChild(gloryStyle);

  // ── Glory Overlay HTML ────────────────────────────────────────
  const overlayDiv = document.createElement('div');
  overlayDiv.id = 'glory-overlay';
  overlayDiv.innerHTML = `
    <div class="glory-board">
      <div class="glory-board-title">✦ Faction Glory ✦</div>
      <div id="glory-rows"></div>
      <div class="glory-personal" id="glory-personal"></div>
    </div>
  `;
  document.body.appendChild(overlayDiv);

  // Close overlay on background click
  overlayDiv.addEventListener('click', (e) => {
    if (e.target === overlayDiv) overlayDiv.classList.remove('open');
  });

  // ── Glory Widget Injection ────────────────────────────────────
  function injectGloryWidget(data) {
    // Prevent double-injection
    if (document.getElementById('glory-widget')) return;

    const fm = FACTIONS[data.faction];
    if (!fm) return;

    const widget = document.createElement('button');
    widget.id = 'glory-widget';
    widget.innerHTML = `<span class="glory-rune" style="color:${fm.color}">${fm.rune}</span> <span class="glory-count">${data.personal}</span> <span>Glory</span>`;
    widget.style.borderColor = fm.color;

    widget.addEventListener('click', async () => {
      overlayDiv.classList.add('open');
      await renderLeaderboard(data);
    });

    // Detect nav pattern and inject
    const mainNav = document.getElementById('mainNav');
    const loreNav = document.querySelector('.lore-nav');

    if (mainNav) {
      // Homepage: add as a new <li> at the end of the nav list
      const li = document.createElement('li');
      li.className = 'glory-nav-item';
      li.appendChild(widget);
      mainNav.appendChild(li);
    } else if (loreNav) {
      // Lore pages: append after the back button
      loreNav.appendChild(widget);
    } else {
      // No nav (world map, result pages): floating pill
      widget.classList.add('glory-floating');
      document.body.appendChild(widget);
    }
  }

  // ── Leaderboard Rendering (async — fetches live Firestore data) ─
  async function renderLeaderboard(data) {
    const rowsEl = document.getElementById('glory-rows');
    const personalEl = document.getElementById('glory-personal');
    if (!rowsEl) return;

    // Show loading state
    rowsEl.innerHTML = '<div style="text-align:center;color:#8a6820;font-size:0.8rem;padding:1rem;">Loading scores…</div>';

    // Try live Firestore scores, fall back to simulated
    const liveScores = await GloryTracker.fetchLiveScores();
    const scores = liveScores || data.scores;

    // Sort factions by score descending
    const sorted = Object.keys(FACTIONS)
      .map(k => ({ key: k, score: scores[k] || 0, ...FACTIONS[k] }))
      .sort((a, b) => b.score - a.score);

    const maxScore = sorted[0].score || 1;

    rowsEl.innerHTML = sorted.map(f => {
      const pct = Math.round((f.score / maxScore) * 100);
      const isUser = f.key === data.faction;
      return `
        <div class="glory-row ${isUser ? 'highlight' : ''}">
          <span class="glory-row-rune" style="color:${f.color}">${f.rune}</span>
          <span class="glory-row-name" style="${isUser ? 'color:' + f.color + ';font-weight:bold' : ''}">${f.name}</span>
          <div class="glory-row-bar-wrap">
            <div class="glory-row-bar" style="width:${pct}%;background:${f.color}"></div>
          </div>
          <span class="glory-row-score">${f.score.toLocaleString()}</span>
        </div>
      `;
    }).join('');

    const fm = FACTIONS[data.faction];
    personalEl.innerHTML = `You've earned <strong>${data.personal}</strong> Glory for <strong style="color:${fm.color}">${fm.name}</strong>`;

    // Animate bars after render
    setTimeout(() => {
      rowsEl.querySelectorAll('.glory-row-bar').forEach(bar => {
        bar.style.width = bar.style.width; // trigger reflow
      });
    }, 50);
  }

  // ── Glory Auto-Award & Widget Init ────────────────────────────
  function initGlory() {
    // Migration: auto-create Glory store for users who took the quiz before this update
    if (!GloryTracker.getStore()) {
      const fateGift = localStorage.getItem('fateGift');
      if (fateGift) {
        try {
          const gift = JSON.parse(fateGift);
          if (gift.faction) {
            GloryTracker.create(gift.faction);
            GloryTracker.increment('quiz');
          }
        } catch (e) { /* ignore corrupt data */ }
      }
    }

    const data = GloryTracker.getScores();
    if (!data) return; // User hasn't taken the quiz yet

    // Auto-award daily glory based on current page
    const path = window.location.pathname;
    const isLorePage = document.querySelector('.lore-header') || document.querySelector('.lore-nav');
    const isMapPage = path.includes('world-map');

    if (isLorePage) {
      GloryTracker.increment('lore');
    } else if (isMapPage) {
      GloryTracker.increment('map');
    }

    // Award return visit glory (once per day, any page)
    GloryTracker.increment('returnVisit');

    // Re-read scores after potential auto-awards
    const freshData = GloryTracker.getScores();
    if (freshData) injectGloryWidget(freshData);
  }

  // Expose for quiz page to trigger widget after quiz completes
  window.initGlory = initGlory;

  // Wait for DOM then init Glory
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGlory);
  } else {
    initGlory();
  }

})();
