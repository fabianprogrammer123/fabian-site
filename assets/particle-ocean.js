(() => {
  'use strict';

  /*
    THESIS: the page slowly crosses from paper into an endless nocturnal ocean.
    OWN-WORLD: a perspective field of luminous points behaves like a living surface,
    never a decorative overlay. STORY: scrolling develops the ocean from a trace at
    the top into the page's dominant atmosphere at the bottom. FIRST VIEWPORT: the
    original white page remains calm and immediately legible. FORM: directional
    swells, irregular interference, crest-biased light, deep negative space, and a
    small cursor wake create the feeling of spectral water without pretending to be
    a physically exact FFT simulation.
  */

  const GRID_DESKTOP_X = 320;
  const GRID_DESKTOP_Y = 220;
  const GRID_MOBILE_X = 200;
  const GRID_MOBILE_Y = 140;
  const MOBILE_BREAKPOINT = 720;
  const MAX_PIXEL_RATIO = 2;

  function normalizeScroll(scrollY, documentHeight, viewportHeight) {
    const range = Math.max(0, documentHeight - viewportHeight);
    if (range === 0) return 0;
    return Math.min(1, Math.max(0, scrollY / range));
  }

  function smoothstep(edge0, edge1, value) {
    const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  function choppyWaveProfile(phase) {
    const fundamental = Math.sin(phase);
    return fundamental
      + Math.sin(phase * 2 - 0.52) * 0.31
      + Math.sin(phase * 3 - 1.08) * 0.095
      + Math.pow(Math.max(0, fundamental * 0.5 + 0.5), 9) * 0.22;
  }

  function sampleChoppySurface(fieldX, fieldY, time) {
    const phaseWarp = Math.sin(fieldX * 0.31 + time * 0.09) * 0.72
      + Math.sin(fieldX * 0.13 - fieldY * 0.17 - time * 0.055) * 0.46;
    const primaryGroup = 0.97 + Math.sin(fieldX * 0.19 - fieldY * 0.11 + time * 0.075 + 0.2) * 0.25;
    const supportingGroup = 0.97 + Math.sin(fieldX * 0.19 - fieldY * 0.11 + time * 0.075 + 2.3) * 0.25;
    const primary = choppyWaveProfile((fieldX * 0.14 + fieldY * 0.99015) * 0.78 + time * 0.31 + 0.2 + phaseWarp)
      * 0.62 * primaryGroup;
    const supporting = choppyWaveProfile((fieldX * -0.10 + fieldY * 0.995) * 1.17 + time * 0.39 + 2.3 + phaseWarp * 0.52)
      * 0.27 * supportingGroup;
    const crossing = choppyWaveProfile((fieldX * 0.31 + fieldY * 0.951) * 1.69 + time * 0.51 + 4.1 + phaseWarp * 0.28)
      * 0.15;
    const chop = choppyWaveProfile((fieldX * -0.48 + fieldY * 0.877) * 2.75 + time * 0.76 + 1.4 + phaseWarp * 0.13)
      * 0.065;
    return primary + supporting + crossing + chop;
  }

  window.ParticleOceanModel = { normalizeScroll, sampleChoppySurface };

  const initialCanvas = document.getElementById('particle-ocean');
  if (!initialCanvas) return;

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarsePointerQuery = window.matchMedia('(pointer: coarse)');
  let canvas = initialCanvas;
  let renderer = null;
  let frameRequest = 0;
  let staticFrameRequest = 0;
  let isVisible = !document.hidden;
  let lastFrameTime = performance.now();
  let targetScroll = readScrollProgress();
  let displayScroll = targetScroll;
  let darkTheme = false;

  const pointer = {
    x: 0.5,
    y: 0.58,
    targetX: 0.5,
    targetY: 0.58,
    energy: 0,
    targetEnergy: 0,
    lastX: 0.5,
    lastY: 0.58,
    lastMoveTime: performance.now(),
    active: false
  };

  const vertexShaderSource = `#version 300 es
    precision highp float;

    uniform vec2 uGrid;
    uniform vec2 uPointer;
    uniform float uPointerEnergy;
    uniform float uTime;
    uniform float uScroll;
    uniform float uPixelRatio;

    out float vAlpha;
    out float vCrest;
    out float vDepth;

    const vec2 DOMINANT_WAVE_DIRECTION = vec2(0.14, 0.99015);

    vec4 choppyWave(
      vec2 point,
      vec2 direction,
      float frequency,
      float speed,
      float phaseOffset,
      float amplitude,
      float steepness,
      float phaseWarp
    ) {
      float phase = dot(point, direction) * frequency + uTime * speed + phaseOffset + phaseWarp;
      float fundamental = sin(phase);
      float profile = fundamental
        + sin(phase * 2.0 - 0.52) * 0.31
        + sin(phase * 3.0 - 1.08) * 0.095;
      float crest = pow(max(0.0, fundamental * 0.5 + 0.5), 9.0);
      float group = mix(0.72, 1.22, smoothstep(-1.0, 1.0,
        sin(point.x * 0.19 - point.y * 0.11 + uTime * 0.075 + phaseOffset)));
      float height = (profile + crest * 0.22) * amplitude * group;
      vec2 horizontalDisplacement = direction * cos(phase) * amplitude * steepness * group;
      return vec4(horizontalDisplacement.x, height, horizontalDisplacement.y, crest * amplitude * group);
    }

    vec4 oceanSurface(vec2 point) {
      float phaseWarp = sin(point.x * 0.31 + uTime * 0.09) * 0.72
        + sin(point.x * 0.13 - point.y * 0.17 - uTime * 0.055) * 0.46;
      vec4 surface = choppyWave(point, DOMINANT_WAVE_DIRECTION, 0.78, 0.31, 0.2, 0.62, 0.48, phaseWarp);
      surface += choppyWave(point, normalize(vec2(-0.10, 0.995)), 1.17, 0.39, 2.3, 0.27, 0.34, phaseWarp * 0.52);
      surface += choppyWave(point, normalize(vec2(0.31, 0.951)), 1.69, 0.51, 4.1, 0.15, 0.24, phaseWarp * 0.28);
      surface += choppyWave(point, normalize(vec2(-0.48, 0.877)), 2.75, 0.76, 1.4, 0.065, 0.12, phaseWarp * 0.13);
      surface += choppyWave(point, normalize(vec2(0.58, 0.815)), 4.35, 1.03, 5.2, 0.026, 0.07, 0.0);
      return surface;
    }

    void main() {
      float id = float(gl_VertexID);
      float column = mod(id, uGrid.x);
      float row = floor(id / uGrid.x);
      vec2 uv = vec2(column, row) / max(vec2(1.0), uGrid - 1.0);
      float depth = pow(uv.y, 0.82);

      vec2 field = vec2(mix(-7.2, 7.2, uv.x), mix(10.4, -2.7, depth));
      vec4 surfaceSample = oceanSurface(field);

      float pointerDepth = clamp((uPointer.y - 0.22) / 0.78, 0.0, 1.0);
      vec2 wakeDelta = vec2((uv.x - uPointer.x) * 1.62, depth - pointerDepth);
      float wakeDistance = length(wakeDelta);
      float wakeEnvelope = exp(-wakeDistance * 8.4) * smoothstep(0.03, 0.22, depth);
      float wakeRing = sin(wakeDistance * 52.0 - uTime * 5.4);
      float wake = wakeRing * wakeEnvelope * uPointerEnergy;

      float waveScale = mix(0.74, 1.12, uScroll);
      float height = surfaceSample.y * waveScale + wake * 0.54;
      float displacedDepth = clamp(depth + surfaceSample.z * mix(0.004, 0.038, depth), 0.0, 1.08);
      float horizon = mix(0.53, 0.60, uScroll);
      float projectedY = mix(horizon, -1.12, displacedDepth);
      projectedY += height * mix(0.022, 0.205, displacedDepth);

      float spread = mix(0.34, 1.36, pow(depth, 0.72));
      float horizontalDisplacement = surfaceSample.x * mix(0.004, 0.052, displacedDepth);
      float projectedX = (uv.x - 0.5) * 2.0 * spread + horizontalDisplacement;
      projectedX += (uPointer.x - 0.5) * uPointerEnergy * 0.012 * depth;

      float slopeLight = smoothstep(0.035, 0.30, length(surfaceSample.xz));
      float crest = smoothstep(0.035, 0.23, surfaceSample.w) + slopeLight * 0.28;
      crest += wakeEnvelope * uPointerEnergy * 0.45;
      crest = clamp(crest, 0.0, 1.0);
      float reveal = mix(0.012, 1.0, smoothstep(0.02, 0.50, uScroll));
      float horizonFade = smoothstep(0.0, 0.075, uv.y);
      float readingQuiet = mix(0.46, 1.0, smoothstep(0.22, 0.72, abs(projectedX)));
      float faceLight = mix(0.14, 0.48, depth);

      vAlpha = reveal * horizonFade * readingQuiet * (0.022 + faceLight * 0.30 + crest * 0.78);
      vCrest = crest;
      vDepth = depth;
      gl_PointSize = min(6.4, (mix(0.50, 1.58, depth) + crest * 2.05 + wakeEnvelope * uPointerEnergy * 0.82) * uPixelRatio);
      gl_Position = vec4(projectedX, projectedY, 0.0, 1.0);
    }
  `;

  const fragmentShaderSource = `#version 300 es
    precision highp float;

    in float vAlpha;
    in float vCrest;
    in float vDepth;
    out vec4 fragmentColor;

    void main() {
      vec2 centered = gl_PointCoord - 0.5;
      float radiusSquared = dot(centered, centered);
      if (radiusSquared > 0.25) discard;

      float core = smoothstep(0.25, 0.005, radiusSquared);
      float halo = exp(-radiusSquared * 13.0);
      float light = core * 0.74 + halo * (0.24 + vCrest * 0.28);
      vec3 quietSilver = vec3(0.67, 0.72, 0.75);
      vec3 coldWhite = vec3(0.93, 0.975, 1.0);
      vec3 color = mix(quietSilver, coldWhite, vCrest * 0.82 + vDepth * 0.09);
      fragmentColor = vec4(color * light, vAlpha * light);
    }
  `;

  class WebGLParticleOcean {
    constructor(targetCanvas) {
      this.canvas = targetCanvas;
      this.gl = targetCanvas.getContext('webgl2', {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        powerPreference: 'high-performance'
      });
      if (!this.gl) throw new Error('WebGL2 unavailable');

      const gl = this.gl;
      const vertexShader = this.compile(gl.VERTEX_SHADER, vertexShaderSource);
      const fragmentShader = this.compile(gl.FRAGMENT_SHADER, fragmentShaderSource);
      this.program = gl.createProgram();
      gl.attachShader(this.program, vertexShader);
      gl.attachShader(this.program, fragmentShader);
      gl.linkProgram(this.program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);

      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
        const message = gl.getProgramInfoLog(this.program) || 'Unable to link ocean shaders';
        gl.deleteProgram(this.program);
        throw new Error(message);
      }

      this.vertexArray = gl.createVertexArray();
      this.uniforms = {
        grid: gl.getUniformLocation(this.program, 'uGrid'),
        pointer: gl.getUniformLocation(this.program, 'uPointer'),
        pointerEnergy: gl.getUniformLocation(this.program, 'uPointerEnergy'),
        time: gl.getUniformLocation(this.program, 'uTime'),
        scroll: gl.getUniformLocation(this.program, 'uScroll'),
        pixelRatio: gl.getUniformLocation(this.program, 'uPixelRatio')
      };

      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.clearColor(0, 0, 0, 0);
      this.resize();
    }

    compile(type, source) {
      const gl = this.gl;
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader) || 'Unable to compile ocean shader';
        gl.deleteShader(shader);
        throw new Error(message);
      }
      return shader;
    }

    resize() {
      const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
      this.gridX = isMobile ? GRID_MOBILE_X : GRID_DESKTOP_X;
      this.gridY = isMobile ? GRID_MOBILE_Y : GRID_DESKTOP_Y;
      this.pixelRatio = Math.min(MAX_PIXEL_RATIO, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(window.innerWidth * this.pixelRatio));
      const height = Math.max(1, Math.round(window.innerHeight * this.pixelRatio));
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }
      this.gl.viewport(0, 0, width, height);
    }

    render(time, scroll, cursor) {
      const gl = this.gl;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.program);
      gl.bindVertexArray(this.vertexArray);
      gl.uniform2f(this.uniforms.grid, this.gridX, this.gridY);
      gl.uniform2f(this.uniforms.pointer, cursor.x, cursor.y);
      gl.uniform1f(this.uniforms.pointerEnergy, cursor.energy);
      gl.uniform1f(this.uniforms.time, time);
      gl.uniform1f(this.uniforms.scroll, scroll);
      gl.uniform1f(this.uniforms.pixelRatio, this.pixelRatio);
      gl.drawArrays(gl.POINTS, 0, this.gridX * this.gridY);
    }

    destroy() {
      const gl = this.gl;
      gl.deleteVertexArray(this.vertexArray);
      gl.deleteProgram(this.program);
    }
  }

  class Canvas2DParticleOcean {
    constructor(targetCanvas) {
      this.canvas = targetCanvas;
      this.context = targetCanvas.getContext('2d');
      if (!this.context) throw new Error('Canvas2D unavailable');
      this.resize();
    }

    resize() {
      this.pixelRatio = Math.min(MAX_PIXEL_RATIO, window.devicePixelRatio || 1);
      this.width = Math.max(1, window.innerWidth);
      this.height = Math.max(1, window.innerHeight);
      this.canvas.width = Math.round(this.width * this.pixelRatio);
      this.canvas.height = Math.round(this.height * this.pixelRatio);
      this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    }

    render(time, scroll, cursor) {
      const context = this.context;
      const width = this.width;
      const height = this.height;
      const mobile = width <= MOBILE_BREAKPOINT;
      const columns = mobile ? 92 : 148;
      const rows = mobile ? 58 : 82;
      const reveal = 0.012 + smoothstep(0.02, 0.5, scroll) * 0.988;
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = 'lighter';

      for (let row = 0; row < rows; row += 1) {
        const rawDepth = row / Math.max(1, rows - 1);
        const depth = Math.pow(rawDepth, 0.82);
        const horizon = height * (0.205 - scroll * 0.035);
        const baseY = horizon + depth * height * 0.84;
        const spread = 0.34 + Math.pow(depth, 0.72) * 1.02;

        for (let column = 0; column < columns; column += 1) {
          const u = column / Math.max(1, columns - 1);
          const fieldX = (u - 0.5) * 2 * spread;
          const fieldY = 10.4 + (-2.7 - 10.4) * depth;
          const surface = sampleChoppySurface(fieldX * 7.2, fieldY, time);
          const pointerDepth = Math.min(1, Math.max(0, (cursor.y - 0.22) / 0.78));
          const dx = (u - cursor.x) * 1.62;
          const dy = depth - pointerDepth;
          const distance = Math.hypot(dx, dy);
          const wakeEnvelope = Math.exp(-distance * 8.4) * smoothstep(0.03, 0.22, depth);
          const wake = Math.sin(distance * 52 - time * 5.4) * wakeEnvelope * cursor.energy;
          const wave = surface * (0.74 + scroll * 0.38) + wake * 0.54;
          const x = width * (0.5 + fieldX * 0.5);
          const y = baseY - wave * height * (0.011 + depth * 0.092);
          if (x < -4 || x > width + 4 || y < -4 || y > height + 4) continue;

          const crest = smoothstep(0.31, 0.91, wave + depth * 0.025);
          const readingQuiet = 0.46 + smoothstep(0.22, 0.72, Math.abs(fieldX)) * 0.54;
          const alpha = Math.min(0.92, reveal * readingQuiet * (0.022 + depth * 0.15 + crest * 0.66));
          const radius = 0.3 + depth * 0.62 + crest * 0.58;
          context.beginPath();
          context.fillStyle = `rgba(${Math.round(177 + crest * 60)}, ${Math.round(190 + crest * 54)}, ${Math.round(197 + crest * 58)}, ${alpha})`;
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fill();
        }
      }

      context.globalCompositeOperation = 'source-over';
    }

    destroy() {}
  }

  function readScrollProgress() {
    return normalizeScroll(
      window.scrollY || window.pageYOffset || 0,
      document.documentElement.scrollHeight,
      window.innerHeight
    );
  }

  function createFallbackCanvas() {
    const replacement = canvas.cloneNode(false);
    replacement.width = 1;
    replacement.height = 1;
    canvas.replaceWith(replacement);
    canvas = replacement;
    return replacement;
  }

  function createRenderer() {
    try {
      return new WebGLParticleOcean(canvas);
    } catch (error) {
      console.warn('[particle-ocean] WebGL2 unavailable; using the quiet Canvas2D rendering path.', error);
      try {
        const target = canvas.getContext('2d') ? canvas : createFallbackCanvas();
        return new Canvas2DParticleOcean(target);
      } catch (fallbackError) {
        console.warn('[particle-ocean] Rendering disabled.', fallbackError);
        return null;
      }
    }
  }

  function setExposure(progress) {
    const exposure = smoothstep(0.10, 0.92, progress) * 0.975;
    canvas.style.setProperty('--ocean-exposure', exposure.toFixed(3));

    if (!darkTheme && exposure > 0.56) {
      darkTheme = true;
      document.body.classList.add('is-ocean-dark');
    } else if (darkTheme && exposure < 0.46) {
      darkTheme = false;
      document.body.classList.remove('is-ocean-dark');
    }
  }

  function render(time) {
    setExposure(displayScroll);
    if (renderer) renderer.render(time * 0.00078, displayScroll, pointer);
  }

  function tick(now) {
    if (!isVisible || reducedMotionQuery.matches) return;
    const deltaSeconds = Math.min(0.05, Math.max(0.001, (now - lastFrameTime) / 1000));
    lastFrameTime = now;

    const scrollEase = 1 - Math.exp(-deltaSeconds * 4.8);
    const pointerEase = 1 - Math.exp(-deltaSeconds * 7.4);
    const energyEase = 1 - Math.exp(-deltaSeconds * (pointer.targetEnergy > pointer.energy ? 11 : 2.7));
    displayScroll += (targetScroll - displayScroll) * scrollEase;
    pointer.x += (pointer.targetX - pointer.x) * pointerEase;
    pointer.y += (pointer.targetY - pointer.y) * pointerEase;

    if (now - pointer.lastMoveTime > 100) pointer.targetEnergy *= Math.exp(-deltaSeconds * 2.8);
    pointer.energy += (pointer.targetEnergy - pointer.energy) * energyEase;
    if (!pointer.active && pointer.energy < 0.001) pointer.energy = 0;

    render(now);
    frameRequest = requestAnimationFrame(tick);
  }

  function renderReducedMotionFrame() {
    staticFrameRequest = 0;
    displayScroll = targetScroll;
    pointer.energy = 0;
    setExposure(displayScroll);
    if (renderer) renderer.render(7.75, displayScroll, pointer);
  }

  function scheduleReducedMotionFrame() {
    if (!reducedMotionQuery.matches || staticFrameRequest) return;
    staticFrameRequest = requestAnimationFrame(renderReducedMotionFrame);
  }

  function startAnimation() {
    cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    if (!isVisible) return;
    if (reducedMotionQuery.matches) {
      scheduleReducedMotionFrame();
      return;
    }
    lastFrameTime = performance.now();
    frameRequest = requestAnimationFrame(tick);
  }

  function handleScroll() {
    targetScroll = readScrollProgress();
    scheduleReducedMotionFrame();
  }

  function handlePointerMove(event) {
    if (coarsePointerQuery.matches || reducedMotionQuery.matches) return;
    const now = performance.now();
    const nextX = Math.min(1, Math.max(0, event.clientX / Math.max(1, window.innerWidth)));
    const nextY = Math.min(1, Math.max(0, event.clientY / Math.max(1, window.innerHeight)));
    const elapsed = Math.max(16, now - pointer.lastMoveTime);
    const distance = Math.hypot(nextX - pointer.lastX, nextY - pointer.lastY);
    const speed = distance * 1000 / elapsed;

    pointer.targetX = nextX;
    pointer.targetY = nextY;
    pointer.targetEnergy = Math.min(1, 0.18 + speed * 2.9);
    pointer.lastX = nextX;
    pointer.lastY = nextY;
    pointer.lastMoveTime = now;
    pointer.active = true;
  }

  function handlePointerLeave() {
    pointer.active = false;
    pointer.targetEnergy = 0;
  }

  function handleResize() {
    targetScroll = readScrollProgress();
    if (renderer) renderer.resize();
    if (reducedMotionQuery.matches) scheduleReducedMotionFrame();
  }

  function handleMotionPreference() {
    cancelAnimationFrame(frameRequest);
    cancelAnimationFrame(staticFrameRequest);
    frameRequest = 0;
    staticFrameRequest = 0;
    pointer.targetEnergy = 0;
    pointer.energy = 0;
    startAnimation();
  }

  renderer = createRenderer();
  setExposure(displayScroll);
  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', handleResize, { passive: true });
  window.addEventListener('pointermove', handlePointerMove, { passive: true });
  window.addEventListener('pointerleave', handlePointerLeave, { passive: true });
  reducedMotionQuery.addEventListener?.('change', handleMotionPreference);

  document.addEventListener('visibilitychange', () => {
    isVisible = !document.hidden;
    if (!isVisible) {
      cancelAnimationFrame(frameRequest);
      frameRequest = 0;
      return;
    }
    startAnimation();
  });

  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(frameRequest);
    cancelAnimationFrame(staticFrameRequest);
    renderer?.destroy();
  }, { once: true });

  window.ParticleOceanDebug = {
    getRenderer: () => renderer instanceof WebGLParticleOcean ? 'webgl2' : renderer ? 'canvas2d' : 'none',
    getScrollProgress: () => displayScroll,
    getPointerEnergy: () => pointer.energy
  };

  startAnimation();
})();
