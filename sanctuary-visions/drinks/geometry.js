/* Public, painted Soul Sip geometry only. No recipe, name, URL or storage access.
 * Mask channels: R=current liquid; G=painted vessel alpha; B=visible spirit art.
 * Coordinates use the canvas target's top-left, normalized to its CSS bounds.
 * Rebuild on layout/state changes, not on animation frames.
 */
(() => {
  'use strict';
  const vessels = ['crystal-shot', 'misted-glass', 'glowing-vial', 'bone-glass', 'celestial-tankard', 'duskkin-tankard'];
  // Painted rim landmarks in the existing vessel artwork's coordinates. The
  // widest point of a vial/goblet is below its mouth, so a path bbox alone would
  // put its meniscus light outside the neck. Liquid coverage still uses SVG d.
  const paintedRims = [[627, 225, 357], [627, 114, 224], [627.5, 165, 102.5], [627, 115, 202], [538, 185, 288], [521.5, 200, 283.5]];
  const imageCache = new Map();
  const clamp = value => Math.max(0, Math.min(1, value));
  const neutralA = [0.76, 0.83, 1];
  const neutralB = [1, 0.85, 0.60];

  function colour(value, fallback) {
    const text = String(value || '').trim();
    const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) {
      const full = hex[1].length === 3 ? [...hex[1]].map(c => c + c).join('') : hex[1];
      return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255);
    }
    const rgb = text.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
    return rgb ? rgb.slice(1, 4).map(c => clamp(Number(c) / 255)) : [...fallback];
  }

  function surface(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    return canvas;
  }

  function publicImage(href, target) {
    let address;
    try {
      address = new URL(href, document.baseURI);
      if (address.origin !== location.origin || !['http:', 'https:', 'file:'].includes(address.protocol)) return null;
    } catch { return null; }
    let record = imageCache.get(address.href);
    if (!record) {
      const image = new Image();
      image.decoding = 'async';
      record = { image, listeners: new Set(), ready: false, failed: false };
      imageCache.set(address.href, record);
      image.addEventListener('load', () => {
        record.ready = image.naturalWidth > 0;
        const listeners = [...record.listeners];
        record.listeners.clear();
        for (const element of listeners) {
          if (element.isConnected) element.dispatchEvent(new CustomEvent('soul-sip-magic:geometry', { bubbles: true }));
        }
      }, { once: true });
      image.addEventListener('error', () => { record.failed = true; record.listeners.clear(); }, { once: true });
      image.src = address.href;
      record.ready = image.complete && image.naturalWidth > 0;
    }
    if (!record.ready && !record.failed) record.listeners.add(target);
    return record.ready ? record.image : null;
  }

  function matrixFor(element, rect, sx, sy) {
    const m = element?.getScreenCTM?.();
    if (!m || ![m.a, m.b, m.c, m.d, m.e, m.f].every(Number.isFinite)) return null;
    return { a: m.a * sx, b: m.b * sy, c: m.c * sx, d: m.d * sy, e: (m.e - rect.left) * sx, f: (m.f - rect.top) * sy };
  }

  function transformed(x, y, m) { return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]; }
  function setMatrix(ctx, m) { ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f); }
  function boxOf(x, y, width, height, m, cw, ch) {
    const points = [[x, y], [x + width, y], [x, y + height], [x + width, y + height]].map(p => transformed(p[0], p[1], m));
    const left = Math.min(...points.map(p => p[0]));
    const top = Math.min(...points.map(p => p[1]));
    return [left / cw, top / ch, (Math.max(...points.map(p => p[0])) - left) / cw, (Math.max(...points.map(p => p[1])) - top) / ch];
  }

  function clipFor(svg) {
    for (const group of svg.querySelectorAll('g[clip-path]')) {
      const reference = group.getAttribute('clip-path').match(/^url\(["']?#([^"')]+)["']?\)$/);
      if (!reference) continue;
      const clip = [...svg.querySelectorAll('clipPath')].find(element => element.id === reference[1]);
      const path = clip?.querySelector('path');
      if (path?.getAttribute('d')) return { group, path };
    }
    return null;
  }

  function addSpirits(ctx, target, rect, sx, sy, legacy, sealed) {
    if (sealed || (legacy ? !target.querySelector('.ss-spirits.ss-visible') : !target.classList.contains('sip-awake'))) return;
    const selector = legacy ? '.ss-spirits .ss-spirit' : '.sip-spirit-cloud .sip-spirit';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (const spirit of target.querySelectorAll(selector)) {
      if (spirit instanceof HTMLImageElement && !spirit.getAttribute('src')) continue;
      const bounds = spirit.getBoundingClientRect();
      if (!bounds.width || !bounds.height) continue;
      const x = (bounds.left - rect.left) * sx, y = (bounds.top - rect.top) * sy;
      const w = bounds.width * sx, h = bounds.height * sy;
      // Portrait-only ovals leave the adjacent private-joke names unlit and legible.
      const glow = ctx.createRadialGradient(x + w * .5, y + h * .45, 0, x + w * .5, y + h * .45, Math.max(w, h) * .55);
      glow.addColorStop(0, '#0000ff'); glow.addColorStop(.55, '#0000a0'); glow.addColorStop(1, '#000000');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.ellipse(x + w * .5, y + h * .47, w * .47, h * .48, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  function measure(target, canvasWidth, canvasHeight) {
    const width = Math.max(1, Math.round(canvasWidth || 1)), height = Math.max(1, Math.round(canvasHeight || 1));
    const maskCanvas = surface(width, height), ctx = maskCanvas.getContext('2d', { alpha: false });
    const fallback = { maskCanvas, rim: [.5, .55, .15, .88], glassBox: [.2, .5, .6, .45], fill: 0, colorA: [...neutralA], colorB: [...neutralB], index: 0, surface: .88 };
    if (!ctx) return fallback;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);
    if (!target?.isConnected) return fallback;
    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) return fallback;
    const sx = width / rect.width, sy = height / rect.height;
    const legacy = target.classList.contains('ss-stage');
    const host = legacy ? target.closest('.ss-widget') : target;
    const sealed = Boolean(target.closest('.sealed-glass'));
    const style = getComputedStyle(host || target);
    const colorA = sealed ? [...neutralA] : colour(style.getPropertyValue(legacy ? '--ss-accent' : '--sip-color'), neutralA);
    const colorB = sealed ? [...neutralB] : colour(style.getPropertyValue(legacy ? '--ss-second' : '--sip-second'), colorA);
    const index = legacy ? 0 : Math.max(0, vessels.findIndex(vessel => target.classList.contains('sip-' + vessel)));
    const svg = target.querySelector(legacy ? '.ss-liquid svg' : '.sip-vessel');
    const clipped = svg ? clipFor(svg) : null;
    if (!clipped) return { ...fallback, colorA, colorB, index };
    const clipMatrix = matrixFor(clipped.group, rect, sx, sy);
    if (!clipMatrix) return { ...fallback, colorA, colorB, index };
    let bounds, path;
    try { bounds = clipped.path.getBBox(); path = new Path2D(clipped.path.getAttribute('d')); }
    catch { return { ...fallback, colorA, colorB, index }; }
    const cupBox = boxOf(bounds.x, bounds.y, bounds.width, bounds.height, clipMatrix, width, height);
    const landmark = legacy ? [bounds.x + bounds.width / 2, bounds.y, bounds.width / 2] : paintedRims[index];
    const top = transformed(landmark[0], landmark[1], clipMatrix);
    const bottom = transformed(bounds.x + bounds.width / 2, bounds.y + bounds.height, clipMatrix);
    const radius = Math.hypot(clipMatrix.a, clipMatrix.b) * landmark[2] / width;
    const rim = [top[0] / width, top[1] / height, radius, bottom[1] / height];
    let glassBox = cupBox;

    // Green is existing painted alpha, including handles. Until the cached public
    // vessel is ready, its own exact interior outline provides a safe fallback.
    const art = legacy ? null : svg.querySelector('image');
    const href = art?.getAttribute('href') || art?.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
    const painted = href ? publicImage(href, target) : null;
    const artMatrix = art ? matrixFor(art, rect, sx, sy) : null;
    if (art && artMatrix) {
      const x = Number(art.getAttribute('x') || 0), y = Number(art.getAttribute('y') || 0);
      const w = Number(art.getAttribute('width') || 0), h = Number(art.getAttribute('height') || 0);
      if (w > 0 && h > 0) glassBox = boxOf(x, y, w, h, artMatrix, width, height);
      if (painted && w > 0 && h > 0) {
        const green = surface(width, height), gc = green.getContext('2d');
        if (gc) {
          setMatrix(gc, artMatrix); gc.drawImage(painted, x, y, w, h);
          gc.setTransform(1, 0, 0, 1, 0, 0); gc.globalCompositeOperation = 'source-in'; gc.fillStyle = '#00ff00'; gc.fillRect(0, 0, width, height);
          ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(green, 0, 0);
        }
      }
    }
    if (!painted || !artMatrix) {
      ctx.save(); setMatrix(ctx, clipMatrix); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#00ff00'; ctx.fill(path); ctx.restore();
    }

    let fill = 0, actualSurface = rim[3];
    const fluid = legacy ? clipped.group.querySelector('.ss-fluid-body rect') : clipped.group.querySelector('rect');
    const hasLiquid = !sealed && (legacy ? Number(host?.querySelector('.ss-fill-track')?.getAttribute('aria-valuenow') || 0) > 0 : Boolean(fluid));
    const fluidMatrix = hasLiquid ? matrixFor(fluid, rect, sx, sy) : null;
    if (fluid && fluidMatrix && hasLiquid) {
      const x = Number(fluid.getAttribute('x') || 0), y = Number(fluid.getAttribute('y') || 0);
      const w = Number(fluid.getAttribute('width') || 0), h = Number(fluid.getAttribute('height') || 0);
      actualSurface = transformed(x + w * .5, y, fluidMatrix)[1] / height;
      fill = clamp((rim[3] - actualSurface) / Math.max(.0001, rim[3] - rim[1]));
      ctx.save(); setMatrix(ctx, clipMatrix); ctx.clip(path);
      // The clip lives on the referencing group, not its path in <defs>. This
      // matrix also includes root SVG letterboxing and the legacy fluid transform.
      setMatrix(ctx, fluidMatrix); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ff0000'; ctx.fillRect(x, y, w, h); ctx.restore();
    }
    addSpirits(ctx, target, rect, sx, sy, legacy, sealed);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over';
    return { maskCanvas, rim, glassBox, fill, colorA, colorB, index, surface: actualSurface };
  }

  window.SoulSipMagicGeometry = Object.freeze({ measure });
})();
