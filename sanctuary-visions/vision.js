/* Sanctuary: Rose's words become Ashai's thoughts. The narration is the ONLY clock.
   Optional, decorative, lazy-loaded and input-transparent. No audio commands, persistence or analytics. */
(() => {
  'use strict';
  const story = document.getElementById('ss-sanctuary-story');
  const track = document.querySelector('.ss-room-track');
  const bar = document.querySelector('.ss-widget');
  const model = window.SanctuaryVisionTimeline;
  if (!story || !track || !bar || !model || document.querySelector('.ss-narration-vision')) return;
  const { cues, clamp, smooth } = model;
  const figure = story.querySelector('[data-scene="1"]');
  const sceneImage = figure?.querySelector('img');
  const sweet = document.getElementById('ss-tab-melters');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = document.createElement('canvas');
  canvas.className = 'ss-narration-vision';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.hidden = true;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;
  document.body.append(canvas);
  const images = new Map();
  const plants = ['flower-bruised', 'flower-bud', 'flower-opening', 'flower-half-open', 'flower-bloom'];
  const assets = [...plants, 'watering-can', ...Array.from({ length: 5 }, (_, i) => `thorn-0${i + 1}`), ...Array.from({ length: 6 }, (_, i) => `petal-0${i + 1}`)];
  const visible = new Map();
  let loading = null, ready = false, failed = false, frame = 0, away = false;
  let polish = null, polishTried = false;
  let width = innerWidth, height = innerHeight, dpr = 1;
  let geometry = null, dirty = true, mood = false, lastCalmTime = null;
  const time = () => Number.isFinite(track.currentTime) ? track.currentTime : 0;
  const calm = () => reduced.matches || bar.classList.contains('ss-motion-off');
  const boundsVisible = el => {
    const b = el.getBoundingClientRect();
    return b.width > 0 && b.height > 0 && b.bottom > 80 && b.top < innerHeight && b.right > 0 && b.left < innerWidth;
  };
  const surfaceVisible = () => boundsVisible(story) || boundsVisible(bar);
  function resize() {
    width = innerWidth; height = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 1.75, 1800 / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dirty = true;
  }
  function prepare() {
    if (loading) return loading;
    if (!polishTried) {
      polishTried = true;
      import('/sanctuary-visions/shader.js').then(module => module.createPolish()).then(layer => {
        polish = layer; dirty = true; lastCalmTime = null; update();
      }).catch(() => { /* The existing transparent vision is the complete fallback. */ });
    }
    loading = Promise.all(assets.map(async name => {
      const img = new Image();
      img.decoding = 'async';
      const loaded = new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
      img.src = `/sanctuary-visions/assets/${name}.webp`;
      await loaded;
      await img.decode?.();
      images.set(name, img);
    })).then(() => { ready = true; dirty = true; update(); }).catch(() => {
      failed = true; reset(); // A missing decorative asset must never affect the scene or audio.
    });
    return loading;
  }
  function paintedRect() {
    const box = figure.getBoundingClientRect();
    const ratio = sceneImage.naturalWidth / sceneImage.naturalHeight || .8;
    let w = box.width, h = box.height;
    if (w / h > ratio) w = h * ratio; else h = w / ratio;
    return { x: box.left + (box.width - w) / 2, y: box.top + (box.height - h) / 2, w, h };
  }
  function place() {
    const painting = paintedRect();
    const dance = figure.classList.contains('ss-scene-current') && boundsVisible(figure) &&
      Math.min(painting.y + painting.h, height) - Math.max(painting.y, 80) > Math.min(200, painting.h * .35);
    if (dance) {
      const h = Math.min(painting.h * .60, Math.max(80,(height-130)/1.22), width * .70, 410);
      const x = clamp(painting.x + painting.w * .57, h * .43 + 12, width - h * .75 - 12);
      const y = clamp(painting.y + painting.h * .84, h * 1.20 + 88, height - 25);
      return { x, y, h, painting, dance,
        a: { x: painting.x + painting.w * .36, y: painting.y + painting.h * .16 },
        b: { x: painting.x + painting.w * .68, y: painting.y + painting.h * .14 },
        heart: { x: painting.x + painting.w * .27, y: painting.y + painting.h * .29 } };
    }
    // When the visitor is at the bar, the thought hangs over the existing illustrated glass.
    // It never becomes a new audio surface or a fixed screen-filling panel.
    const surface = bar.querySelector('.ss-stage') || bar;
    const box = surface.getBoundingClientRect();
    if (!boundsVisible(surface)) return null;
    const h = Math.min(290, width * .62, Math.max(80,(height-140)/1.22));
    const x = clamp(box.left + box.width * .5, h * .45 + 12, width - h * .75 - 12);
    const y = clamp(box.top + Math.min(box.height * .65, height * .65), h * 1.20 + 88, height - 35);
    return { x, y, h, dance: false, painting,
      a: { x: x - h * .5, y: y - h * .8 }, b: { x: x + h * .5, y: y - h * .83 },
      heart: { x: x - h * .4, y: y - h * .5 } };
  }
  function sprite(name, x, y, w, alpha = 1, angle = 0, ratio) {
    const img = images.get(name);
    if (!img || alpha <= .001) return;
    const h = w / (ratio || img.width / img.height);
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.globalAlpha *= clamp(alpha);
    ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore();
  }
  function glow(x, y, radius, color, alpha) {
    if (alpha <= .001) return;
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha *= clamp(alpha);
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, color); g.addColorStop(.3, color.replace(/[^,]+\)$/, '0.15)')); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2); ctx.restore();
  }
  function star(x, y, size, alpha, color = '#ffe6ba') {
    if (alpha <= .001) return;
    ctx.save(); ctx.globalAlpha *= clamp(alpha); ctx.translate(x, y);
    ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = size * 2;
    ctx.beginPath(); ctx.moveTo(0, -size); ctx.quadraticCurveTo(size * .15, -size * .12, size * .65, 0);
    ctx.quadraticCurveTo(size * .15, size * .12, 0, size); ctx.quadraticCurveTo(-size * .15, size * .12, -size * .65, 0);
    ctx.quadraticCurveTo(-size * .15, -size * .12, 0, -size); ctx.fill(); ctx.restore();
  }
  const cubic = (a, b, c, d, p) => (1-p)**3*a + 3*(1-p)**2*p*b + 3*(1-p)*p*p*c + p**3*d;
  const auraTextures = new Map();
  function auraTexture(color) {
    if (auraTextures.has(color)) return auraTextures.get(color);
    const texture = document.createElement('canvas'); texture.width = texture.height = 96;
    const brush = texture.getContext('2d');
    const rgb = [1,3,5].map(index => parseInt(color.slice(index,index+2),16)).join(',');
    const light = brush.createRadialGradient(48,48,0,48,48,48);
    light.addColorStop(0,`rgba(${rgb},.65)`);
    light.addColorStop(.25,`rgba(${rgb},.28)`);
    light.addColorStop(.60,`rgba(${rgb},.07)`);
    light.addColorStop(1,`rgba(${rgb},0)`);
    brush.fillStyle=light;brush.fillRect(0,0,96,96);auraTextures.set(color,texture);return texture;
  }
  function thread(from, to, bend, color, alpha, t, direction = 1) {
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const c1 = { x: from.x + bend, y: from.y - Math.min(180, distance * .55) };
    const c2 = { x: to.x - bend, y: to.y - Math.min(180, distance * .5) };
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const brush = auraTexture(color);
    // Overlapping soft brush marks make an exchanging breath of light, with no line core.
    for (let i = 0; i <= 22; i++) {
      const p = i / 22;
      const breath = Math.sin(p * Math.PI);
      const x = cubic(from.x,c1.x,c2.x,to.x,p) + Math.sin(p*9+t*.6)*breath*8;
      const y = cubic(from.y,c1.y,c2.y,to.y,p) + Math.cos(p*7+t*.5)*breath*5;
      const radius = clamp(distance * .10,16,35) * (.7 + breath * .55);
      ctx.globalAlpha = alpha * (.08 + breath * .075);
      ctx.drawImage(brush,x-radius,y-radius,radius*2,radius*2);
    }
    for (let i = 0; i < 3; i++) {
      let p = ((t * .07 + i / 3) % 1 + 1) % 1;
      if (direction < 0) p = 1 - p;
      const x = cubic(from.x, c1.x, c2.x, to.x, p), y = cubic(from.y, c1.y, c2.y, to.y, p);
      const radius = clamp(distance*.13,20,43);
      ctx.globalAlpha = alpha * Math.sin(p*Math.PI) * .32;
      ctx.drawImage(brush,x-radius,y-radius,radius*2,radius*2);
    }
    ctx.restore();
  }
  function atmosphere(g, s, t) {
    const { x, y, h } = g;
    glow(x, y - h * .55, h * .8, s.silver > .5 ? 'rgba(175,195,225,0.30)' : s.warmth > .5 ? 'rgba(233,149,201,0.30)' : 'rgba(131,112,204,0.28)', s.presence * .72);
    // A few sparks escape the illustration into the surrounding page, like the train's trail.
    for (let i = 0; i < 22; i++) {
      const seed = i * 2.39996;
      const drift = ((t * .023 + i * .137) % 1);
      const px = x + Math.sin(seed) * h * (.35 + drift * .55);
      const py = y - drift * h * 1.18;
      star(px, py, 1.2 + i % 3, s.presence * .42 * Math.sin(drift * Math.PI) ** 2, s.silver > .5 ? '#d1e3ff' : '#e7c6f2');
    }
  }
  function drawThreads(g, s, t) {
    if (s.threads <= .001) return;
    const join = { x: g.x, y: g.y - g.h * .80 };
    thread(g.a, join, -g.h * .32, '#a8baff', s.threads * .85, t);
    thread(g.b, join, g.h * .32, '#ffc9d9', s.threads * .85, t, t >= cues.memories && t < cues.trust ? -1 : 1);
    if (s.friends > .001) {
      thread(g.a, g.b, g.h * .20, '#e3d5ff', s.friends * .6, t * 1.4);
    }
  }
  function flower(g, s, t) {
    if (s.flower <= .001) return;
    const sway = t >= cues.sway ? Math.sin((t - cues.sway) * 1.35) * .020 : 0;
    const shrink = 1 - s.gather * .16;
    const h = g.h * shrink;
    const x = g.x + (g.heart.x - g.x) * s.gather * .22;
    const y = g.y + (g.heart.y - g.y) * s.gather * .15;
    ctx.save(); ctx.translate(x, y); ctx.rotate(sway + s.sag * .065);
    ctx.globalAlpha = s.flower * .94;
    ctx.shadowColor = s.recover > .5 ? '#efb6e9' : '#837caa'; ctx.shadowBlur = s.recover > .5 ? 15 : 5;
    const growth = smooth(cues.bruise, 102.4, t);
    ctx.beginPath(); ctx.rect(-h, -h * growth, h * 2, h * (growth + .08)); ctx.clip();
    plants.forEach((name, i) => {
      const img = images.get(name), w = h * .8;
      if (s.frames[i] > .001 && img) {
        ctx.save(); ctx.globalAlpha *= s.frames[i];
        ctx.drawImage(img, -w / 2, -h * .95, w, h); ctx.restore();
      }
    });
    if (s.cracks > .001) {
      ctx.save(); ctx.globalAlpha *= s.cracks * .7; ctx.strokeStyle = '#ad8cc6'; ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const cx = (i - 1.5) * h * .046, cy = -h * (.65 + (i % 2) * .05);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + h * .023, cy + h * .03);
        ctx.lineTo(cx - h * .007, cy + h * .05); ctx.lineTo(cx + h * .018, cy + h * .075); ctx.stroke();
      }
      ctx.restore();
    }
    if (s.thorns > .001) {
      // Stem points are measured on the shared 512x640 bloom canvas. Each silver
      // thorn grows from its opaque root, never the centre of its padded sprite.
      const attachments = [
        { stem: [255, 336], root: [99, 164], tip: [199, 19], side: -1, size: .085 },
        { stem: [259, 399], root: [82, 140], tip: [235, 43], side: 1, size: .080 },
        { stem: [278, 465], root: [126, 190], tip: [176, 19], side: -1, size: .080 },
        { stem: [274, 541], root: [204, 116], tip: [22, 208], side: 1, size: .075 },
        { stem: [260, 582], root: [88, 85], tip: [234, 232], side: -1, size: .070 }
      ];
      attachments.forEach(({ stem, root, tip, side, size }, i) => {
        const img = images.get(`thorn-0${i + 1}`);
        if (!img) return;
        const tx = (stem[0] / 512 - .5) * h * .8;
        const ty = (stem[1] / 640 - .95) * h;
        const w = h * size;
        const angle = Math.atan2(-.48, side) - Math.atan2(tip[1] - root[1], tip[0] - root[0]);
        ctx.save(); ctx.translate(tx, ty); ctx.rotate(angle);
        ctx.globalAlpha *= s.thorns * .9;
        ctx.shadowColor = '#d7dcf3'; ctx.shadowBlur = h * .012;
        ctx.drawImage(img, -w * root[0] / 256, -w * root[1] / 256, w, w);
        ctx.restore();
        star(tx, ty, 1.3, s.thorns * (.28 + .18 * Math.sin(t * 1.7 + i)), '#e5efff');
      });
    }
    ctx.restore();
  }
  function trust(g, s, t) {
    if (s.word <= .001) return;
    const size = clamp(g.h * .15, 27, 60), x = g.x - g.h * .15, y = g.y - g.h * .83;
    ctx.save(); ctx.globalAlpha = s.word; ctx.translate(x,y); ctx.rotate(-.10);
    ctx.font = `italic ${size}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const extent = ctx.measureText('Trust').width + 24;
    ctx.beginPath(); ctx.rect(-extent / 2 - 20, -size, (extent + 40) * smooth(cues.trust, cues.trust + 1.15, t), size * 2); ctx.clip();
    ctx.shadowColor = '#e7b0eb'; ctx.shadowBlur = 22;
    const ink = ctx.createLinearGradient(0, -size * .5, 0, size * .5);
    ink.addColorStop(0,'#fff4e2'); ink.addColorStop(.55,'#f4d4ec'); ink.addColorStop(1,'#ba99e2');
    ctx.fillStyle = ink; ctx.fillText('Trust',0,0); ctx.restore();
  }
  function water(g, s, t) {
    if (s.can <= .001) return;
    const w = g.h * .57, ratio = 488 / 768;
    // Rotation is around the handle; spout position is transformed by the same matrix as the art.
    const tip = smooth(cues.water - .35, cues.water + .5, t) * (1 - smooth(139.45, 140.45, t));
    const angle = -.24 * tip;
    const px = g.x + g.h * .47, py = g.y - g.h * 1.05 + (1 - s.can) * 18;
    const ax = 431 / 768, ay = 342 / 488;
    const can = images.get('watering-can');
    ctx.save(); ctx.translate(px,py); ctx.rotate(angle); ctx.globalAlpha = s.can * .94;
    ctx.shadowColor = '#d1b3f4'; ctx.shadowBlur = 13;
    if (can) ctx.drawImage(can, -w * ax, -w * ratio * ay, w, w * ratio);
    ctx.restore();
    const sx = (58 / 768 - ax) * w, sy = (152 / 488 - ay) * w * ratio;
    const spout = { x: px + Math.cos(angle) * sx - Math.sin(angle) * sy, y: py + Math.sin(angle) * sx + Math.cos(angle) * sy };
    const target = { x: g.x - g.h * .10, y: g.y - g.h * .81 };
    glow(spout.x, spout.y, 18, 'rgba(225,204,255,0.6)', s.water * .65);
    if (s.water > .001) {
      ctx.save(); ctx.globalAlpha = s.water * .38; ctx.strokeStyle = '#e7d6ff';
      ctx.shadowColor = '#c6b4ff'; ctx.shadowBlur = 9; ctx.lineWidth = .9;
      ctx.beginPath(); ctx.moveTo(spout.x, spout.y);
      ctx.quadraticCurveTo((spout.x + target.x) / 2, spout.y, target.x, target.y); ctx.stroke();
      const ripple = (t * 1.8) % 1;
      ctx.globalAlpha = s.water * (1 - ripple) * .7;
      ctx.beginPath(); ctx.ellipse(target.x,target.y,5+ripple*19,2+ripple*5,-.1,0,Math.PI*2);ctx.stroke();
      ctx.restore();
    }
    for (let i = 0; i < 14; i++) {
      const birth = cues.water + i * .115;
      const elapsed = t - birth;
      if (elapsed < 0 || s.water <= .001) continue;
      const p = (elapsed % .72) / .72;
      const x = spout.x + (target.x - spout.x) * p + Math.sin(i * 4.2) * p * 6;
      const y = spout.y + (target.y - spout.y) * p * p;
      ctx.save(); ctx.globalAlpha = s.water * Math.sin(Math.PI * p) * .95;
      ctx.fillStyle = '#e3d4ff'; ctx.shadowColor = '#d5bfff'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.ellipse(x,y,2.2,4.1, -.2,0,Math.PI*2); ctx.fill(); ctx.restore();
      if (p > .8) star(target.x + Math.sin(i * 3) * 15, target.y + Math.cos(i * 3) * 8, 3, s.water * (p - .8) * 3);
    }
    for (let i = 0; i < 7; i++) star(px + Math.sin(i * 5.4) * w * .53, py + Math.cos(i * 4.3) * w * .31, 2, s.can * (1 - s.can) * 3);
  }
  function protection(g, s, t, front = false) {
    if (s.ring <= .001) return;
    const h = g.h, formed = smooth(cues.guard,143.4,t);
    ctx.save();ctx.translate(g.x,g.y-h*.48);ctx.rotate(-.04);
    ctx.scale(.91+formed*.09,.93+formed*.07);ctx.globalAlpha=s.ring;
    ctx.globalCompositeOperation='screen';
    const shape = () => {
      ctx.beginPath();ctx.moveTo(0,-h*.52);
      ctx.bezierCurveTo(-h*.12,-h*.40,-h*.29,-h*.34,-h*.39,-h*.37);
      ctx.bezierCurveTo(-h*.40,h*.06,-h*.29,h*.34,0,h*.55);
      ctx.bezierCurveTo(h*.29,h*.34,h*.40,h*.06,h*.39,-h*.37);
      ctx.bezierCurveTo(h*.29,-h*.34,h*.12,-h*.40,0,-h*.52);ctx.closePath();
    };
    shape();
    if (!front) {
      const glass=ctx.createLinearGradient(-h*.4,0,h*.4,0);
      glass.addColorStop(0,'rgba(180,172,255,.13)');glass.addColorStop(.24,'rgba(203,216,255,.035)');
      glass.addColorStop(.55,'rgba(249,220,239,.018)');glass.addColorStop(1,'rgba(174,192,255,.17)');
      ctx.fillStyle=glass;ctx.fill();
      ctx.save();ctx.clip();
      const shift=(formed*1.6-.8)*h;
      const shine=ctx.createLinearGradient(shift-h*.35,-h*.4,shift+h*.35,h*.3);
      shine.addColorStop(0,'rgba(227,229,255,0)');shine.addColorStop(.45,'rgba(227,229,255,0)');
      shine.addColorStop(.53,'rgba(232,235,255,.095)');shine.addColorStop(.65,'rgba(227,229,255,0)');shine.addColorStop(1,'rgba(227,229,255,0)');
      ctx.fillStyle=shine;ctx.fillRect(-h*.5,-h*.6,h,h*1.2);ctx.restore();
      shape();ctx.strokeStyle='rgba(174,179,255,.30)';ctx.lineWidth=h*.016;
      ctx.shadowColor='#b7b9ff';ctx.shadowBlur=24;ctx.stroke();
    } else {
      const edge=ctx.createLinearGradient(-h*.3,-h*.5,h*.3,h*.55);
      edge.addColorStop(0,'rgba(236,235,255,.75)');edge.addColorStop(.3,'rgba(202,197,255,.24)');
      edge.addColorStop(.6,'rgba(243,222,250,.53)');edge.addColorStop(1,'rgba(186,210,255,.73)');
      ctx.strokeStyle=edge;ctx.lineWidth=clamp(h*.004,1,1.8);ctx.shadowColor='#c3c9ff';ctx.shadowBlur=12;ctx.stroke();
    }
    ctx.restore();
  }
  function gathering(g, s, t) {
    if (!g.dance || s.pendant <= .001) return;
    glow(g.heart.x,g.heart.y,25,'rgba(200,224,255,0.7)',s.pendant * .55);
    star(g.heart.x,g.heart.y,6,s.pendant*.8,'#ddeaff');
    thread({x:g.x,y:g.y-g.h*.72},g.heart,g.h*.1,'#dce0ff',s.pendant*.7,t*1.25);
  }
  function petals(g, s, t) {
    if (s.petals <= .001) return;
    const age = Math.max(0,t-cues.collision);
    for (let i=0;i<6;i++) {
      const direction = (i-2.5)*.36;
      const drift = Math.min(age,1.6);
      const x=g.x+Math.sin(direction)*g.h*.34*drift+Math.sin(age*.9+i)*age*8;
      const y=g.y-g.h*.74-Math.cos(direction)*g.h*.08*Math.min(age,1)+age*age*5.4;
      ctx.save(); if (age>.5) ctx.filter='saturate(.22) brightness(1.18)';
      sprite(`petal-0${i+1}`,x,y,g.h*(.11+(i%2)*.025),s.petals*.86,age*(i%2?-.4:.35)+i);
      ctx.restore();
    }
    for (let side=-1;side<=1;side+=2) {
      for (let i=0;i<9;i++) {
        const p=clamp(age/2), x=g.x+side*p*g.h*(.18+i*.028), y=g.y-g.h*.77-Math.sin(p*Math.PI)*g.h*.18+i*3;
        star(x,y,2.2,s.petals*(1-p)*.65,'#e0e8ff');
      }
    }
  }
  function setMood(s) {
    if (!mood) { story.classList.add('ss-vision-mood'); mood=true; }
    story.style.setProperty('--vision-saturation', String(1 - s.sag*.24 + s.warmth*.10 - s.silver*.18));
    story.style.setProperty('--vision-brightness', String(1 - s.sag*.08 + s.warmth*.035));
    story.style.setProperty('--vision-aura', String(s.presence*.10));
  }
  function reset() {
    canvas.hidden=true;
    ctx.clearRect(0,0,width,height);
    if (mood) {
      story.classList.remove('ss-vision-mood');
      ['--vision-saturation','--vision-brightness','--vision-aura'].forEach(key=>story.style.removeProperty(key));
      mood=false;
    }
    lastCalmTime=null;
  }
  function render() {
    const t=time(), isCalm=calm(), s=model.sample(t,isCalm);
    sweet?.classList.toggle('ss-vision-sweet', s.sweet>.02 && boundsVisible(bar));
    if (failed || !ready || !s.active || document.hidden || away || !surfaceVisible()) { reset(); return false; }
    if (dirty) { geometry=place(); dirty=false; }
    if (!geometry) { reset(); return false; }
    // Reduced motion uses one still illustration per narration cue.
    if (isCalm && lastCalmTime===s.t && !canvas.hidden) return false;
    lastCalmTime=isCalm?s.t:null;
    canvas.hidden=false; ctx.clearRect(0,0,width,height);
    setMood(s);
    atmosphere(geometry,s,s.t); drawThreads(geometry,s,s.t);
    canvas.dataset.shader='base';
    if (polish && !bar.classList.contains('ss-vision-base-only')) {
      try {
        const light = polish.render(geometry,s,{width,height});
        if (light) {
          ctx.save();
          try {ctx.globalCompositeOperation='screen';ctx.drawImage(light.canvas,light.x,light.y,light.width,light.height);}
          finally {ctx.restore();}
          canvas.dataset.shader='webgl2';
        }
      } catch {
        polish.dispose();polish=null;
      }
    }
    protection(geometry,s,s.t); flower(geometry,s,s.t); protection(geometry,s,s.t,true);
    trust(geometry,s,s.t); water(geometry,s,s.t);
    gathering(geometry,s,s.t); petals(geometry,s,s.t);
    canvas.dataset.moment=String(s.t.toFixed(2));
    return true;
  }
  function stop() { if(frame) cancelAnimationFrame(frame); frame=0; }
  function runnable() {
    return ready&&!failed&&!away&&!document.hidden&&!track.paused&&!track.ended&&!track.seeking&&
      time()>=cues.begin-.7&&time()<cues.finish&&surfaceVisible();
  }
  function tick() { frame=0; render(); if(runnable()&&!calm()) frame=requestAnimationFrame(tick); }
  function update() {
    stop();
    if (time()>=cues.prepare && time()<cues.finish && !document.hidden && surfaceVisible()) prepare();
    render();
    if (runnable()&&!calm()) frame=requestAnimationFrame(tick);
  }
  function moved() { dirty=true; lastCalmTime=null; update(); }
  ['play','playing','pause','timeupdate','seeking','seeked','loadedmetadata','ratechange','ended','emptied','error'].forEach(name=>track.addEventListener(name,update));
  // One observer handles manual scene holds, follow mode and the user's ambient-motion switch.
  const changes=new MutationObserver(moved);
  changes.observe(story,{attributes:true,attributeFilter:['data-scene','data-follow-audio']});
  changes.observe(bar,{attributes:true,attributeFilter:['class','data-mode']});
  reduced.addEventListener('change',moved);
  window.addEventListener('resize',()=>{resize();moved();},{passive:true});
  window.addEventListener('scroll',moved,{passive:true,capture:true});
  document.addEventListener('visibilitychange',update);
  window.addEventListener('pagehide',()=>{away=true;stop();reset();});
  window.addEventListener('pageshow',()=>{away=false;resize();moved();});
  if (typeof IntersectionObserver==='function') {
    const observer=new IntersectionObserver(entries=>{for(const entry of entries)visible.set(entry.target,entry.isIntersecting);moved();});
    observer.observe(story);observer.observe(bar);
  }
  if(typeof ResizeObserver==='function')new ResizeObserver(moved).observe(story);
  resize(); update();
})();
