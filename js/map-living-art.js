/* Plays a location's painted still with a small shader on top, in the world map's detail panel.
   The still is the fallback: without WebGL2, or if a shader fails, readers simply see the painting.
   Nothing loads until a location is opened, and nothing draws once the panel is closed. */
(() => {
  'use strict';

  const VERTEX = '#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.0-1.0,0.0,1.0);}\n';
  const PREFIX = '#version 300 es\nprecision highp float;\nprecision highp int;\n' +
    'uniform vec3 iResolution;uniform float iTime;uniform int iFrame;uniform sampler2D iChannel0;uniform sampler2D iChannel1;\nout vec4 labOut;\n';
  const SUFFIX = '\nvoid main(){mainImage(labOut,gl_FragCoord.xy);labOut.a=1.0;}\n';
  const MAX_PIXELS = 720;

  const reducedMotion = () => Boolean(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const programs = new Map();
  const sources = new Map();
  let host = null, still = null, canvas = null, gl = null, vao = null, texture = null, motionTexture = null;
  let current = null, program = null, loc = {};
  let raf = 0, time = 0, frame = 0, last = 0, tapTime = -100, showId = 0, visible = true;

  const stopLoop = () => { cancelAnimationFrame(raf); raf = 0; };

  const fit = () => {
    if (!canvas || !host) return;
    const rect = host.getBoundingClientRect();
    if (!rect.width) return;
    const size = Math.round(Math.min(rect.width * Math.min(window.devicePixelRatio || 1, 2), MAX_PIXELS));
    if (canvas.width !== size) { canvas.width = size; canvas.height = size; }
  };

  const draw = () => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform3f(loc.iResolution, canvas.width, canvas.height, 1);
    gl.uniform1f(loc.iTime, time);
    gl.uniform1i(loc.iFrame, frame);
    gl.uniform1i(loc.iChannel0, 0);
    gl.uniform1i(loc.iChannel1, 1);
    if (loc.TAP_TIME) gl.uniform1f(loc.TAP_TIME, tapTime);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const tick = (now) => {
    raf = requestAnimationFrame(tick);
    const dt = (now - last) / 1000;
    last = now;
    if (!visible) return;
    time += Math.min(dt, 0.1);
    frame += 1;
    draw();
  };

  const startLoop = () => {
    stopLoop();
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };

  const showCanvas = (on) => { if (canvas) canvas.style.display = on ? 'block' : 'none'; };

  const buildProgram = (fragmentText) => {
    const compile = (type, text) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, text);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    };
    const made = gl.createProgram();
    gl.attachShader(made, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(made, compile(gl.FRAGMENT_SHADER, PREFIX + fragmentText + SUFFIX));
    gl.linkProgram(made);
    if (!gl.getProgramParameter(made, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(made));
    return made;
  };

  const prepareGl = () => {
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // Motion maps hold data, not colour, so they must arrive unaltered and need no mipmaps.
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.activeTexture(gl.TEXTURE1);
    motionTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, motionTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.activeTexture(gl.TEXTURE0);
  };

  const ensureContext = () => {
    if (gl) return true;
    canvas = document.createElement('canvas');
    canvas.className = 'detail-living';
    canvas.style.display = 'none';
    host.appendChild(canvas);
    gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) { canvas.remove(); canvas = null; return false; }
    prepareGl();

    // Only while it's moving: a reader on reduced motion keeps one calm frame.
    canvas.addEventListener('click', () => { if (raf) tapTime = time; });
    // A lost context leaves the painting showing. If the browser restores it, this rebuilds.
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      stopLoop();
      showCanvas(false);
      programs.clear();
    });
    canvas.addEventListener('webglcontextrestored', () => {
      prepareGl();
      if (current) show(current);
    });
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(host);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; }).observe(canvas);
    }
    return true;
  };

  async function show(data) {
    const id = ++showId;
    current = data;
    stopLoop();
    showCanvas(false);
    still.alt = data.name;
    still.src = data.still;
    still.hidden = false;

    if (!ensureContext()) return;
    try {
      await still.decode();
      let motion = null;
      if (data.motion) {
        motion = new Image();
        motion.src = data.motion;
        await motion.decode();
      }
      if (!sources.has(data.shader)) {
        const response = await fetch(data.shader);
        if (!response.ok) throw new Error('Shader file returned ' + response.status);
        sources.set(data.shader, await response.text());
      }
      if (id !== showId) return;

      if (!programs.has(data.shader)) programs.set(data.shader, buildProgram(sources.get(data.shader)));
      program = programs.get(data.shader);
      gl.useProgram(program);
      loc = {};
      ['iResolution', 'iTime', 'iFrame', 'iChannel0', 'iChannel1', 'TAP_TIME'].forEach((n) => { loc[n] = gl.getUniformLocation(program, n); });

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, still);
      gl.generateMipmap(gl.TEXTURE_2D);
      if (motion) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, motionTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, motion);
        gl.activeTexture(gl.TEXTURE0);
      }

      fit();
      time = data.shaderStart || 0;
      frame = 0;
      tapTime = -100;
      showCanvas(true);
      canvas.style.cursor = loc.TAP_TIME && !reducedMotion() ? 'pointer' : '';
      if (data.shaderLabel) {
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', data.shaderLabel);
      }

      if (reducedMotion()) {
        // One still moment with the light on it, and no movement.
        time += 1.8;
        draw();
      } else {
        draw();
        startLoop();
      }
    } catch (error) {
      if (id !== showId) return; // The panel moved on while this was loading.
      // The painting is already showing, which is the right fallback.
      console.warn('Map living art fell back to the still:', error);
      showCanvas(false);
    }
  }

  function hide() {
    showId += 1;
    current = null;
    stopLoop();
    showCanvas(false);
    if (still) { still.hidden = true; still.removeAttribute('src'); }
  }

  window.MapLivingArt = {
    attach(container) {
      host = container;
      still = document.createElement('img');
      still.className = 'detail-living';
      still.hidden = true;
      still.decoding = 'async';
      host.appendChild(still);
    },
    show,
    hide,
    // Read-only state, for checking it from a browser console.
    inspect: () => ({ compiled: Boolean(program), running: Boolean(raf), time, tapTime, width: canvas && canvas.width }),
  };
})();
