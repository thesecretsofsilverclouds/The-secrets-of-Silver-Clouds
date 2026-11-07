/* The world map's living layer, drawn by small shaders on the map's existing WebGL canvas.
   The map reveals itself outward from New Big Ben, light runs along the coast, silver haze drifts over it,
   and choosing a place sends a wave across the map in that place's colour.

   Keeping it fast: no textures or downloads are added, and the motes animate on the GPU. Hover checks run
   at most once a frame. Quality steps down by itself on a slow device, and the map stops drawing while a
   full-screen panel covers it. Readers who ask for reduced motion get the finished map, with nothing moving. */
(() => {
  'use strict';

  const reduced = Boolean(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const REVEAL_SECONDS = 2.2;
  const REVEAL_REACH = 2.7;
  const noRaycast = () => {};

  // One clock shared by every material, so a frame only updates a single value.
  const shared = { uTime: { value: 0 }, uMotion: { value: reduced ? 0 : 1 } };

  const SURFACE_VERTEX = `
    varying vec2 vUv;
    varying vec2 vWorld;
    void main() {
      vUv = uv;
      vec4 world = modelMatrix * vec4(position, 1.0);
      vWorld = world.xz;
      gl_Position = projectionMatrix * viewMatrix * world;
    }`;

  const SURFACE_FRAGMENT = `
    uniform sampler2D map;
    uniform float uTime, uMotion, uReveal, uWaveAge;
    uniform vec2 uRevealOrigin, uWaveOrigin;
    uniform vec3 uWaveColor;
    varying vec2 vUv;
    varying vec2 vWorld;

    void main() {
      vec4 tex = texture2D(map, vUv);
      if (tex.a < 0.01) discard;
      float lum = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
      float line = smoothstep(0.35, 0.85, lum);

      // Slow currents of light along the map's bright coast and rivers.
      float path = vWorld.x * 1.3 + vWorld.y * 1.9 + 0.35 * sin(vWorld.y * 5.0 + vWorld.x * 3.0);
      float current = 0.5 + 0.5 * sin(path * 4.0 - uTime * 0.7);
      current = current * current * current * current;
      current *= current;
      vec3 col = tex.rgb * (1.0 + line * current * 1.1 * uMotion);

      // Silver haze drifting over the land, from layered sines so it needs no noise texture.
      vec2 h = vWorld * 1.6;
      float haze = 0.5 + 0.5 * sin(h.x * 3.1 + sin(h.y * 2.3 + uTime * 0.05) * 1.7 + uTime * 0.04)
                             * sin(h.y * 2.7 + sin(h.x * 1.9 - uTime * 0.03) * 1.9);
      col = mix(col, col * 0.84 + vec3(0.055, 0.065, 0.085), smoothstep(0.55, 0.95, haze) * 0.5 * uMotion);

      // The wave from a chosen place, strongest where it crosses the bright lines.
      float dWave = distance(vWorld, uWaveOrigin);
      float bandWave = (dWave - uWaveAge * 1.1) / 0.06;
      float wave = exp(-bandWave * bandWave) * (1.0 - smoothstep(0.0, 2.2, uWaveAge)) * uMotion;
      col += uWaveColor * wave * (0.22 + line * 1.4);

      // The opening reveal, with a bright edge.
      float dReveal = distance(vWorld, uRevealOrigin);
      float shown = 1.0 - smoothstep(uReveal - 0.22, uReveal, dReveal);
      float bandEdge = (dReveal - uReveal + 0.06) / 0.07;
      col += vec3(0.45, 0.75, 1.0) * exp(-bandEdge * bandEdge) * (0.35 + line) * step(uReveal, 50.0);

      gl_FragColor = vec4(col, tex.a * shown);
    }`;

  const RING_VERTEX = `
    varying vec2 vP;
    void main() {
      vP = uv * 2.0 - 1.0;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`;

  const RING_FRAGMENT = `
    uniform vec3 uColor;
    uniform float uTime, uMotion, uHover, uSelected, uBirth, uSeed;
    varying vec2 vP;

    void main() {
      float r = length(vP);
      if (r >= 1.0) discard;
      float attention = max(uHover, uSelected);
      float ring = 1.0 - smoothstep(0.012, 0.03, abs(r - 0.42));
      float bandGlow = (r - 0.42) / 0.11;
      float glow = exp(-bandGlow * bandGlow) * 0.3;

      float t = fract(uTime / 3.6 + uSeed);
      float bandRipple = (r - (0.42 + t * 0.52)) / 0.018;
      float ripple = exp(-bandRipple * bandRipple) * (1.0 - t) * (1.0 - t) * uMotion * (0.45 + attention * 0.9);

      // Three arcs slowly turn around a place while it has your attention.
      float arcs = 0.0;
      if (attention > 0.005) {
        float angle = atan(vP.y, vP.x + 0.0001);
        arcs = step(0.6, fract(angle / 6.28318 * 3.0 + uTime * 0.06 + uSeed));
        arcs *= (1.0 - smoothstep(0.01, 0.024, abs(r - 0.6))) * attention;
      }

      float alpha = (ring * (0.85 + attention * 0.4) + glow * (1.0 + attention) + ripple + arcs * 0.8) * uBirth;
      alpha *= 1.0 - smoothstep(0.9, 1.0, r);
      gl_FragColor = vec4(uColor, min(alpha, 1.0));
    }`;

  // A soft column from the ground to the floating icon. It turns to face the camera in the vertex shader.
  const BEAM_VERTEX = `
    uniform float uHeight;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
      vec4 world = modelMatrix * vec4(0.0, uv.y * uHeight, 0.0, 1.0);
      world.xyz += right * (uv.x - 0.5) * 0.05;
      gl_Position = projectionMatrix * viewMatrix * world;
    }`;

  const BEAM_FRAGMENT = `
    uniform vec3 uColor;
    uniform float uHover, uSelected, uBirth;
    varying vec2 vUv;
    void main() {
      float x = vUv.x * 2.0 - 1.0;
      float core = 1.0 - x * x;
      core = core * core * core;
      float fade = smoothstep(0.0, 0.12, vUv.y) * (1.0 - vUv.y * 0.5);
      gl_FragColor = vec4(uColor, core * fade * (0.14 + uHover * 0.35 + uSelected * 0.6) * uBirth);
    }`;

  // Drifting motes. All the movement happens here on the GPU, so JavaScript does nothing per mote.
  const MOTE_VERTEX = `
    attribute float aSeed;
    uniform float uTime, uScale;
    varying float vFade;
    void main() {
      float life = fract(uTime * (0.012 + aSeed * 0.015) + aSeed);
      vec3 p = position;
      p.x += sin(uTime * 0.07 + aSeed * 40.0) * 0.12;
      p.z += cos(uTime * 0.05 + aSeed * 70.0) * 0.12;
      p.y += life * 0.75;
      vFade = sin(life * 3.14159) * (0.35 + 0.65 * fract(aSeed * 91.7));
      vec4 view = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * view;
      gl_PointSize = uScale * (0.6 + aSeed) / -view.z;
    }`;

  const MOTE_FRAGMENT = `
    varying float vFade;
    void main() {
      float a = 1.0 - smoothstep(0.0, 0.5, length(gl_PointCoord - 0.5));
      gl_FragColor = vec4(0.75, 0.85, 1.0, a * a * vFade * 0.55);
    }`;

  // The sky: one painted frame and a motion map, drawn small and only every other frame.
  const SKY = {
    shader: 'shaders/map/sky-painted.glsl',
    still: 'shaders/map/sky-painted.webp',
    motion: 'shaders/map/sky-painted-motion.webp',
  };
  const SKY_SCALES = [0.75, 0.6, 0.5, 0.4];
  const SKY_VERTEX = 'in vec3 position;\nvoid main() { gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const SKY_PREFIX = 'precision highp float;\nprecision highp int;\n' +
    'uniform vec3 iResolution;\nuniform float iTime;\nuniform int iFrame;\nuniform sampler2D iChannel0;\nuniform sampler2D iChannel1;\nout vec4 skyOut;\n';
  const SKY_SUFFIX = '\nvoid main() { mainImage(skyOut, gl_FragCoord.xy); skyOut.a = 1.0; }\n';

  const easeOutBack = (x) => { const k = x - 1; return 1 + 2.7 * k * k * k + 1.7 * k * k; };
  const clamp01 = (x) => Math.min(Math.max(x, 0), 1);

  let scene, camera, renderer, controls;
  let surfaceUniforms = null, motes = null, label = null, land = null, sky = null;
  let revealPending = false, revealStart = -1, revealDone = reduced;
  let introTween = null, waveStart = -1, lastElapsed = 0;
  let coverAt = Infinity, hoverDirty = false, hovered = null, selected = null, userMoved = false, resizeTimer = 0;
  let ratios = [1], level = 0, frames = 0, slowness = 0;
  const places = [];
  const placeByGroup = new Map();
  const placeBySprite = new Map();
  const sprites = [];
  const raycaster = new THREE.Raycaster();
  const hoverPoint = new THREE.Vector2();
  const worldPoint = new THREE.Vector3();
  const topPoint = new THREE.Vector3();
  const quad = new THREE.PlaneGeometry(1, 1);

  function init(parts) {
    ({ scene, camera, renderer, controls } = parts);
    const base = renderer.getPixelRatio();
    ratios = [base, Math.min(base, 1.5), Math.min(base, 1.25), 1];

    if (!reduced) addMotes(Math.min(window.innerWidth, window.innerHeight) < 600 ? 110 : 240);
    loadSky();

    label = document.createElement('div');
    label.className = 'map-label';
    label.setAttribute('aria-hidden', 'true');
    label.innerHTML = '<span class="map-label-name"></span><small></small>';
    document.body.appendChild(label);

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => {
      hoverDirty = false;
      setHover(null);
    });
    renderer.domElement.addEventListener('pointerdown', takeControl);
    renderer.domElement.addEventListener('wheel', takeControl, { passive: true });
    window.addEventListener('resize', onResize);

    if (window.matchMedia && matchMedia('(pointer: coarse)').matches) {
      const hint = document.querySelector('p.subtitle');
      if (hint) {
        // Phones hide this line to save room, so it shows only until the first touch.
        hint.textContent = 'Drag to rotate \u2022 Pinch to zoom \u2022 Tap a location';
        hint.classList.add('touch-hint');
        const dismiss = () => hint.classList.remove('touch-hint');
        renderer.domElement.addEventListener('pointerdown', dismiss, { once: true });
        setTimeout(dismiss, 9000);
      }
    }
  }

  async function loadSky() {
    // Without WebGL2, the painted still behind the canvas stays as the sky.
    if (!renderer.capabilities.isWebGL2) return;
    try {
      const response = await fetch(SKY.shader);
      if (!response.ok) throw new Error('Sky shader returned ' + response.status);
      const loader = new THREE.TextureLoader();
      const [body, still, motion] = await Promise.all([response.text(), loader.loadAsync(SKY.still), loader.loadAsync(SKY.motion)]);
      // Near the edges the drift can reach past the painting, so it mirrors rather than smears.
      still.wrapS = THREE.MirroredRepeatWrapping;
      still.wrapT = THREE.MirroredRepeatWrapping;
      motion.generateMipmaps = false;
      motion.minFilter = THREE.LinearFilter;
      const uniforms = {
        iResolution: { value: new THREE.Vector3(4, 4, 1) },
        iTime: { value: 20 },
        iFrame: { value: 0 },
        iChannel0: { value: still },
        iChannel1: { value: motion },
        TAP_TIME: { value: -100 },
        TINT_AMOUNT: { value: 0 },
        TINT_R: { value: 1 },
        TINT_G: { value: 1 },
        TINT_B: { value: 1 },
        VIEW_X: { value: 0 },
        VIEW_Y: { value: 0 },
      };
      const material = new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        uniforms,
        vertexShader: SKY_VERTEX,
        fragmentShader: SKY_PREFIX + body + SKY_SUFFIX,
        depthTest: false,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
      mesh.frustumCulled = false;
      const skyScene = new THREE.Scene();
      skyScene.add(mesh);
      sky = {
        uniforms, scene: skyScene, camera: new THREE.Camera(), tick: 0, tintTarget: 0, needsDraw: true, showing: false,
        target: new THREE.WebGLRenderTarget(4, 4, { depthBuffer: false, stencilBuffer: false }),
      };
      resizeSky();
    } catch (error) {
      console.warn('Map sky fell back to the still:', error);
    }
  }

  function resizeSky() {
    if (!sky) return;
    const scale = SKY_SCALES[Math.min(level, SKY_SCALES.length - 1)];
    const width = Math.min(1600, Math.round(window.innerWidth * Math.min(window.devicePixelRatio || 1, 2) * scale));
    const height = Math.max(1, Math.round((width * window.innerHeight) / window.innerWidth));
    sky.target.setSize(width, height);
    sky.uniforms.iResolution.value.set(width, height, 1);
    sky.needsDraw = true;
  }

  function updateSky(dt, elapsed) {
    if (!sky) return;
    sky.tick += 1;
    // Slow clouds don't need every frame, and with reduced motion one frame is enough.
    if (!sky.needsDraw && (reduced || sky.tick % 2)) return;
    sky.needsDraw = false;
    const u = sky.uniforms;
    u.iTime.value = reduced ? 20 : elapsed;
    u.iFrame.value = sky.tick;
    u.TINT_AMOUNT.value += (sky.tintTarget - u.TINT_AMOUNT.value) * (1 - Math.exp(-dt * 5));
    u.VIEW_X.value = Math.sin(controls.getAzimuthalAngle());
    u.VIEW_Y.value = Math.min(Math.max((controls.getPolarAngle() - Math.PI / 4) / 0.6, -1), 1);
    renderer.setRenderTarget(sky.target);
    renderer.render(sky.scene, sky.camera);
    if (!sky.showing) {
      // A shader that failed to compile draws nothing, so check before showing it. The still stays otherwise.
      const pixel = new Uint8Array(4);
      renderer.readRenderTargetPixels(sky.target, 0, 0, 1, 1, pixel);
      if (pixel[3] === 255) {
        sky.showing = true;
        scene.background = sky.target.texture;
      } else {
        console.warn('Map sky fell back to the still: it did not draw.');
        sky.target.dispose();
        sky = null;
      }
    }
    renderer.setRenderTarget(null);
  }

  function addMotes(count) {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 3.2;
      positions[i * 3 + 1] = 0.03 + Math.random() * 0.22;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 1.8;
      seeds[i] = Math.random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: { uTime: shared.uTime, uScale: { value: 14 * renderer.getPixelRatio() } },
      vertexShader: MOTE_VERTEX,
      fragmentShader: MOTE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    motes = new THREE.Points(geometry, material);
    motes.frustumCulled = false;
    motes.renderOrder = 3;
    motes.raycast = noRaycast;
    scene.add(motes);
  }

  // Finds where the land sits in the map image, from a tiny copy of its transparency.
  function measureLand(image) {
    try {
      const w = 64, h = 36;
      const probe = document.createElement('canvas');
      probe.width = w;
      probe.height = h;
      const ctx = probe.getContext('2d');
      ctx.drawImage(image, 0, 0, w, h);
      const pixels = ctx.getImageData(0, 0, w, h).data;
      let left = w, right = -1, top = h, bottom = -1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (pixels[(y * w + x) * 4 + 3] > 60) {
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
        }
      }
      if (right < 0) return null;
      return { minX: (left / w - 0.5) * 3.2, maxX: ((right + 1) / w - 0.5) * 3.2, minZ: (top / h - 0.5) * 1.8, maxZ: ((bottom + 1) / h - 0.5) * 1.8 };
    } catch (error) {
      return null; // Framing falls back to the markers alone.
    }
  }

  // The view that frames the land and every place on this screen, tilted 45 degrees.
  function homeView() {
    let minX = land ? land.minX : Infinity, maxX = land ? land.maxX : -Infinity;
    let minZ = land ? land.minZ : Infinity, maxZ = land ? land.maxZ : -Infinity;
    for (const place of places) {
      minX = Math.min(minX, place.group.position.x);
      maxX = Math.max(maxX, place.group.position.x);
      minZ = Math.min(minZ, place.group.position.z);
      maxZ = Math.max(maxZ, place.group.position.z);
    }
    const halfFov = Math.tan((camera.fov * Math.PI) / 360);
    const width = maxX - minX + 0.5;
    const height = (maxZ - minZ) * Math.SQRT1_2 + 0.5;
    const distance = Math.min(Math.max(Math.max(width / (2 * halfFov * camera.aspect), height / (2 * halfFov)) * 1.08, 1.6), 5);
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const lift = distance * Math.SQRT1_2;
    return { position: { x: centerX, y: lift, z: centerZ + lift }, target: { x: centerX, y: 0, z: centerZ } };
  }

  function surface(tex) {
    tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    land = measureLand(tex.image);
    surfaceUniforms = {
      map: { value: tex },
      uTime: shared.uTime,
      uMotion: shared.uMotion,
      uReveal: { value: revealDone ? 99 : 0 },
      uRevealOrigin: { value: new THREE.Vector2(0.42, 0.35) }, // New Big Ben
      uWaveOrigin: { value: new THREE.Vector2() },
      uWaveColor: { value: new THREE.Color() },
      uWaveAge: { value: 99 },
    };
    revealPending = !revealDone;
    if (revealDone) {
      const home = homeView();
      camera.position.set(home.position.x, home.position.y, home.position.z);
      controls.target.set(home.target.x, home.target.y, home.target.z);
    }
    return new THREE.ShaderMaterial({
      uniforms: surfaceUniforms,
      vertexShader: SURFACE_VERTEX,
      fragmentShader: SURFACE_FRAGMENT,
      transparent: true,
      side: THREE.DoubleSide,
    });
  }

  // If the map image can't load, nothing should wait for a reveal that will never come.
  function skipIntro() {
    revealPending = false;
    revealDone = true;
  }

  function takeControl() {
    userMoved = true;
    stopIntro();
  }

  // Rotating a phone changes what fits. Re-frame, unless the reader has chosen their own view.
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeSky();
      if (selected || userMoved || !surfaceUniforms) return;
      stopIntro();
      const home = homeView();
      camera.position.set(home.position.x, home.position.y, home.position.z);
      controls.target.set(home.target.x, home.target.y, home.target.z);
    }, 150);
  }

  function stopIntro() {
    if (introTween) { introTween.stop(); introTween = null; }
  }

  function marker(group, loc, ringY, flyY) {
    const color = new THREE.Color(loc.color);
    const ringUniforms = {
      uColor: { value: color },
      uTime: shared.uTime,
      uMotion: shared.uMotion,
      uHover: { value: 0 },
      uSelected: { value: 0 },
      uBirth: { value: revealDone ? 1 : 0 },
      uSeed: { value: Math.random() },
    };
    const ring = new THREE.Mesh(quad, new THREE.ShaderMaterial({
      uniforms: ringUniforms,
      vertexShader: RING_VERTEX,
      fragmentShader: RING_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = ringY;
    ring.scale.setScalar(0.52);
    ring.renderOrder = 1;
    ring.raycast = noRaycast;
    group.add(ring);

    const beamUniforms = {
      uColor: { value: color },
      uHeight: { value: flyY },
      uHover: ringUniforms.uHover,
      uSelected: ringUniforms.uSelected,
      uBirth: ringUniforms.uBirth,
    };
    const beam = new THREE.Mesh(quad, new THREE.ShaderMaterial({
      uniforms: beamUniforms,
      vertexShader: BEAM_VERTEX,
      fragmentShader: BEAM_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    }));
    beam.frustumCulled = false;
    beam.renderOrder = 1;
    beam.raycast = noRaycast;
    group.add(beam);

    const dx = group.position.x - 0.42;
    const dz = group.position.z - 0.35;
    const place = {
      loc, group, color, ringUniforms, sprite: null, scale: 0,
      delay: Math.sqrt(dx * dx + dz * dz) * 0.6, birth: revealDone ? 1 : 0, hover: 0, selected: 0,
    };
    places.push(place);
    placeByGroup.set(group, place);
  }

  function spriteReady(group, sprite, scale) {
    const place = placeByGroup.get(group);
    if (!place) return;
    place.sprite = sprite;
    place.scale = scale;
    sprite.renderOrder = 2;
    sprites.push(sprite);
    placeBySprite.set(sprite, place);
  }

  function select(group) {
    stopIntro();
    selected = placeByGroup.get(group) || null;
    setHover(null);
    if (selected && surfaceUniforms) {
      surfaceUniforms.uWaveOrigin.value.set(group.position.x, group.position.z);
      surfaceUniforms.uWaveColor.value.copy(selected.color);
      waveStart = lastElapsed;
      if (sky && !reduced) {
        // The sky catches the colour of the chosen place, with a brief surge of light.
        sky.uniforms.TINT_R.value = selected.color.r;
        sky.uniforms.TINT_G.value = selected.color.g;
        sky.uniforms.TINT_B.value = selected.color.b;
        sky.uniforms.TAP_TIME.value = lastElapsed;
        sky.tintTarget = 0.41;
      }
    }
    // On a phone the panel fills the screen, so the map can rest once the panel has slid in.
    const panel = document.getElementById('detail-panel');
    coverAt = panel && panel.getBoundingClientRect().width >= window.innerWidth - 2 ? lastElapsed + 0.8 : Infinity;
  }

  function clear() {
    selected = null;
    if (sky) sky.tintTarget = 0;
    userMoved = false;
    coverAt = Infinity;
  }

  function onPointerMove(event) {
    if (event.pointerType !== 'mouse') return;
    if (event.buttons || event.target !== renderer.domElement) {
      hoverDirty = false;
      setHover(null);
      return;
    }
    hoverPoint.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
    hoverDirty = true;
  }

  function setHover(place) {
    if (hovered === place) return;
    hovered = place;
    renderer.domElement.style.cursor = place ? 'pointer' : '';
    label.classList.toggle('show', Boolean(place));
    if (place) {
      label.querySelector('.map-label-name').textContent = place.loc.name;
      label.querySelector('small').textContent = place.loc.faction;
      label.style.setProperty('--label-color', '#' + place.color.getHexString());
    }
  }

  function placeLabel() {
    const sprite = hovered.sprite;
    sprite.getWorldPosition(worldPoint);
    topPoint.copy(worldPoint);
    topPoint.y += sprite.scale.y * 0.55;
    topPoint.project(camera);
    const x = (topPoint.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-topPoint.y * 0.5 + 0.5) * window.innerHeight;
    const halfWidth = label.offsetWidth / 2 + 8;
    const safeX = Math.min(Math.max(x, halfWidth), window.innerWidth - halfWidth);
    label.style.transform = `translate3d(${safeX.toFixed(1)}px, ${Math.max(y, label.offsetHeight + 8).toFixed(1)}px, 0) translate(-50%, -100%)`;
  }

  function adaptQuality(dt, elapsed) {
    if (dt > 0.25 || elapsed < 3) return; // Ignore load-time hitches and returning from another tab.
    slowness = slowness * 0.95 + dt * 0.05;
    frames += 1;
    if (frames < 120) return;
    frames = 0;
    if (slowness > 1 / 30 && level < ratios.length - 1) {
      level += 1;
      renderer.setPixelRatio(ratios[level]);
      resizeSky();
      if (motes) {
        motes.material.uniforms.uScale.value = 14 * ratios[level];
        if (level >= 2) motes.visible = false;
      }
    }
  }

  // Called once a frame. Returns false when the map can't be seen and needn't be drawn.
  function frame(dt, elapsed) {
    lastElapsed = elapsed;
    if (!reduced) shared.uTime.value = elapsed;

    if (revealPending) {
      revealPending = false;
      revealStart = elapsed;
      const home = homeView();
      controls.target.set(home.target.x, home.target.y, home.target.z);
      camera.position.set(home.position.x - 1.1, home.position.y * 0.55, home.position.z + home.position.y * 1.2);
      introTween = new TWEEN.Tween(camera.position)
        .to(home.position, 2600)
        .easing(TWEEN.Easing.Cubic.Out)
        .onComplete(() => { introTween = null; })
        .start();
    }
    if (!revealDone && revealStart >= 0 && surfaceUniforms) {
      const t = clamp01((elapsed - revealStart) / REVEAL_SECONDS);
      surfaceUniforms.uReveal.value = t * (2 - t) * REVEAL_REACH;
      if (t >= 1) {
        revealDone = true;
        surfaceUniforms.uReveal.value = 99;
      }
    }
    if (surfaceUniforms && waveStart >= 0) surfaceUniforms.uWaveAge.value = elapsed - waveStart;

    if (hoverDirty) {
      hoverDirty = false;
      raycaster.setFromCamera(hoverPoint, camera);
      const hits = raycaster.intersectObjects(sprites, false);
      const next = hits.length ? placeBySprite.get(hits[0].object) : null;
      setHover(next && next !== selected ? next : null);
    }

    const ease = 1 - Math.exp(-dt * 10);
    for (const place of places) {
      place.birth = revealDone ? 1 : (revealStart < 0 ? 0 : clamp01((elapsed - revealStart - place.delay) / 0.45));
      place.hover += ((place === hovered ? 1 : 0) - place.hover) * ease;
      place.selected += ((place === selected ? 1 : 0) - place.selected) * ease;
      place.ringUniforms.uHover.value = place.hover;
      place.ringUniforms.uSelected.value = place.selected;
      place.ringUniforms.uBirth.value = place.birth;
      if (place.sprite) {
        const size = place.scale * easeOutBack(place.birth) * (1 + place.hover * 0.16 + place.selected * 0.1);
        place.sprite.scale.set(size, size, size);
      }
    }

    if (hovered && hovered.sprite) placeLabel();
    if (!reduced) adaptQuality(dt, elapsed);
    const visible = elapsed < coverAt;
    if (visible) updateSky(dt, elapsed);
    return visible;
  }

  window.MapExperience = {
    init, surface, skipIntro, marker, spriteReady, select, clear, frame, homeView,
    motion: reduced ? 0 : 1,
    // Read-only state, for checking it from a browser console.
    inspect: () => ({
      intro: Boolean(introTween), land, revealDone, revealStart, hovered: hovered ? hovered.loc.name : null, selected: selected ? selected.loc.name : null,
      places: places.length, sprites: sprites.length, pixelRatio: renderer.getPixelRatio(), level,
      sky: sky ? { showing: sky.showing, size: [sky.target.width, sky.target.height], tint: +sky.uniforms.TINT_AMOUNT.value.toFixed(2), view: [+sky.uniforms.VIEW_X.value.toFixed(2), +sky.uniforms.VIEW_Y.value.toFixed(2)] } : null,
      rendering: lastElapsed < coverAt, motes: motes ? motes.visible : false,
    }),
  };
})();
