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
  const CAMERA_HEIGHT = 2.8;
  const CAMERA_PITCH = 0.36;
  const TAN_HALF_FOV = 0.68;
  const OCEAN_NEAR = 1.55;
  const OCEAN_FAR = 24;
  const OCEAN_OVERSCAN = 1.12;

  const OBLIQUE_WAVES = [
    [0.91, 0.414, 0.52, 0.31, 0.74, 0.72, 0.62],
    [-0.76, 0.65, 0.76, -0.24, 0.38, 0.46, 2.1],
    [0.58, -0.815, 1.22, 0.44, 0.24, 0.31, 4.0],
    [-0.93, -0.368, 2.15, -0.67, 0.12, 0.16, 1.2],
    [0.33, 0.944, 3.7, 0.93, 0.055, 0.08, 5.0]
  ];

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
    const crestBase = Math.max(0, fundamental * 0.5 + 0.5);
    return fundamental
      + Math.sin(phase * 2 - 0.52) * 0.31
      + Math.sin(phase * 3 - 1.08) * 0.095
      + Math.pow(crestBase, 9) * 0.22;
  }

  function choppyWaveDerivative(phase) {
    const fundamental = Math.sin(phase);
    const crestBase = Math.max(0, fundamental * 0.5 + 0.5);
    const crestDerivative = crestBase > 0
      ? 4.5 * Math.pow(crestBase, 8) * Math.cos(phase)
      : 0;
    return Math.cos(phase)
      + Math.cos(phase * 2 - 0.52) * 0.62
      + Math.cos(phase * 3 - 1.08) * 0.285
      + crestDerivative * 0.22;
  }

  function sampleObliqueSurface(worldX, worldZ, time) {
    const phaseWarp = Math.sin(worldX * 0.11 + worldZ * 0.06 + time * 0.07) * 0.47
      + Math.sin(worldX * 0.07 - worldZ * 0.14 - time * 0.045) * 0.26;
    const sample = { x: 0, height: 0, z: 0, slopeX: 0, slopeZ: 0, crest: 0 };

    for (let index = 0; index < OBLIQUE_WAVES.length; index += 1) {
      const [directionX, directionZ, frequency, speed, amplitude, steepness, offset] = OBLIQUE_WAVES[index];
      const warpStrength = [1, 0.62, 0.34, 0.16, 0][index];
      const phase = (worldX * directionX + worldZ * directionZ) * frequency
        + time * speed + offset + phaseWarp * warpStrength;
      const group = 0.98 + Math.sin(worldX * 0.075 - worldZ * 0.052 + time * 0.055 + offset) * 0.18;
      const profile = choppyWaveProfile(phase);
      const horizontal = Math.cos(phase) * amplitude * steepness * group;
      const slope = choppyWaveDerivative(phase) * amplitude * group * frequency;
      const crestBase = Math.max(0, Math.sin(phase) * 0.5 + 0.5);

      sample.x += directionX * horizontal;
      sample.height += profile * amplitude * group;
      sample.z += directionZ * horizontal;
      sample.slopeX += directionX * slope;
      sample.slopeZ += directionZ * slope;
      sample.crest += Math.pow(crestBase, 9) * amplitude * group;
    }

    return sample;
  }

  function projectOceanPoint(u, rawDepth, sample, scroll, aspect) {
    const depth = Math.pow(Math.min(1, Math.max(0, rawDepth)), 0.78);
    const baseDepth = OCEAN_FAR + (OCEAN_NEAR - OCEAN_FAR) * depth;
    const safeAspect = Math.max(0.45, aspect || 1);
    const sinPitch = Math.sin(CAMERA_PITCH);
    const cosPitch = Math.cos(CAMERA_PITCH);
    const baseViewDepth = sinPitch * CAMERA_HEIGHT + cosPitch * baseDepth;
    const halfWidth = baseViewDepth * TAN_HALF_FOV * safeAspect * OCEAN_OVERSCAN;
    const waveScale = 0.72 + Math.min(1, Math.max(0, scroll)) * 0.42;
    const worldX = (u - 0.5) * 2 * halfWidth + sample.x * waveScale;
    const worldY = sample.height * waveScale;
    const worldZ = Math.max(0.55, baseDepth + sample.z * waveScale);
    const relativeY = worldY - CAMERA_HEIGHT;
    const viewY = cosPitch * relativeY + sinPitch * worldZ;
    const viewZ = Math.max(0.35, -sinPitch * relativeY + cosPitch * worldZ);
    const clipX = worldX / (viewZ * TAN_HALF_FOV * safeAspect);
    const clipY = viewY / (viewZ * TAN_HALF_FOV);

    return {
      x: 0.5 + clipX * 0.5,
      y: 0.5 - clipY * 0.5,
      perspectiveScale: 1 / viewZ,
      viewDepth: viewZ,
      worldX,
      worldZ,
      depth
    };
  }

  window.ParticleOceanModel = { normalizeScroll, sampleObliqueSurface, projectOceanPoint };

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
    uniform float uAspect;

    out float vAlpha;
    out float vCrest;
    out float vDepth;

    const float CAMERA_HEIGHT = 2.8;
    const float CAMERA_PITCH = 0.36;
    const float TAN_HALF_FOV = 0.68;
    const float OCEAN_NEAR = 1.55;
    const float OCEAN_FAR = 24.0;
    const float OCEAN_OVERSCAN = 1.12;
    const vec2 PRIMARY_SWELL_DIRECTION = normalize(vec2(0.91, 0.414));

    struct OceanSample {
      vec3 displacement;
      vec2 slope;
      float crest;
    };

    vec4 choppyWave(
      vec2 point,
      vec2 direction,
      float frequency,
      float speed,
      float phaseOffset,
      float amplitude,
      float steepness,
      float phaseWarp,
      out vec2 slope
    ) {
      float phase = dot(point, direction) * frequency + uTime * speed + phaseOffset + phaseWarp;
      float fundamental = sin(phase);
      float crestBase = max(0.0, fundamental * 0.5 + 0.5);
      float profile = fundamental
        + sin(phase * 2.0 - 0.52) * 0.31
        + sin(phase * 3.0 - 1.08) * 0.095;
      float crest = pow(crestBase, 9.0);
      float crestDerivative = crestBase > 0.0
        ? 4.5 * pow(crestBase, 8.0) * cos(phase)
        : 0.0;
      float profileDerivative = cos(phase)
        + cos(phase * 2.0 - 0.52) * 0.62
        + cos(phase * 3.0 - 1.08) * 0.285
        + crestDerivative * 0.22;
      float group = 0.98
        + sin(point.x * 0.075 - point.y * 0.052 + uTime * 0.055 + phaseOffset) * 0.18;
      float height = (profile + crest * 0.22) * amplitude * group;
      vec2 horizontalDisplacement = direction * cos(phase) * amplitude * steepness * group;
      slope = direction * frequency * profileDerivative * amplitude * group;
      return vec4(horizontalDisplacement.x, height, horizontalDisplacement.y, crest * amplitude * group);
    }

    OceanSample oceanSurface(vec2 point) {
      float phaseWarp = sin(point.x * 0.11 + point.y * 0.06 + uTime * 0.07) * 0.47
        + sin(point.x * 0.07 - point.y * 0.14 - uTime * 0.045) * 0.26;
      OceanSample surface;
      surface.displacement = vec3(0.0);
      surface.slope = vec2(0.0);
      surface.crest = 0.0;
      vec2 waveSlope;
      vec4 wave = choppyWave(point, PRIMARY_SWELL_DIRECTION, 0.52, 0.31, 0.62, 0.74, 0.72, phaseWarp, waveSlope);
      surface.displacement += wave.xyz;
      surface.slope += waveSlope;
      surface.crest += wave.w;
      wave = choppyWave(point, normalize(vec2(-0.76, 0.65)), 0.76, -0.24, 2.1, 0.38, 0.46, phaseWarp * 0.62, waveSlope);
      surface.displacement += wave.xyz;
      surface.slope += waveSlope;
      surface.crest += wave.w;
      wave = choppyWave(point, normalize(vec2(0.58, -0.815)), 1.22, 0.44, 4.0, 0.24, 0.31, phaseWarp * 0.34, waveSlope);
      surface.displacement += wave.xyz;
      surface.slope += waveSlope;
      surface.crest += wave.w;
      wave = choppyWave(point, normalize(vec2(-0.93, -0.368)), 2.15, -0.67, 1.2, 0.12, 0.16, phaseWarp * 0.16, waveSlope);
      surface.displacement += wave.xyz;
      surface.slope += waveSlope;
      surface.crest += wave.w;
      wave = choppyWave(point, normalize(vec2(0.33, 0.944)), 3.7, 0.93, 5.0, 0.055, 0.08, 0.0, waveSlope);
      surface.displacement += wave.xyz;
      surface.slope += waveSlope;
      surface.crest += wave.w;
      return surface;
    }

    void main() {
      float id = float(gl_VertexID);
      float column = mod(id, uGrid.x);
      float row = floor(id / uGrid.x);
      vec2 uv = vec2(column, row) / max(vec2(1.0), uGrid - 1.0);
      float depth = pow(uv.y, 0.78);
      float worldDepth = mix(OCEAN_FAR, OCEAN_NEAR, depth);
      float sinPitch = sin(CAMERA_PITCH);
      float cosPitch = cos(CAMERA_PITCH);
      float baseViewDepth = sinPitch * CAMERA_HEIGHT + cosPitch * worldDepth;
      float halfWidth = baseViewDepth * TAN_HALF_FOV * uAspect * OCEAN_OVERSCAN;
      vec3 worldPosition = vec3((uv.x - 0.5) * 2.0 * halfWidth, 0.0, worldDepth);
      OceanSample surfaceSample = oceanSurface(worldPosition.xz);

      float pointerRawDepth = clamp((uPointer.y - 0.18) / 0.82, 0.0, 1.0);
      float pointerDepth = pow(pointerRawDepth, 0.78);
      float pointerWorldDepth = mix(OCEAN_FAR, OCEAN_NEAR, pointerDepth);
      float pointerViewDepth = sinPitch * CAMERA_HEIGHT + cosPitch * pointerWorldDepth;
      float pointerHalfWidth = pointerViewDepth * TAN_HALF_FOV * uAspect * OCEAN_OVERSCAN;
      float pointerWorldX = (uPointer.x - 0.5) * 2.0 * pointerHalfWidth;
      vec2 wakeDelta = vec2(
        (worldPosition.x - pointerWorldX) * 0.34,
        (worldPosition.z - pointerWorldDepth) * 0.52
      );
      float wakeDistance = length(wakeDelta);
      float wakeEnvelope = exp(-wakeDistance * 1.42) * smoothstep(0.02, 0.24, depth);
      float wakeRing = sin(wakeDistance * 7.8 - uTime * 4.2);
      float wake = wakeRing * wakeEnvelope * uPointerEnergy;

      float waveScale = mix(0.72, 1.14, uScroll);
      worldPosition += surfaceSample.displacement * waveScale;
      worldPosition.y += wake * 0.46;

      vec3 relative = worldPosition - vec3(0.0, CAMERA_HEIGHT, 0.0);
      float viewY = cosPitch * relative.y + sinPitch * relative.z;
      float viewZ = max(0.35, -sinPitch * relative.y + cosPitch * relative.z);
      vec2 projected = vec2(
        relative.x / (viewZ * TAN_HALF_FOV * uAspect),
        viewY / (viewZ * TAN_HALF_FOV)
      );

      vec3 surfaceNormal = normalize(vec3(
        -surfaceSample.slope.x * waveScale,
        1.0,
        -surfaceSample.slope.y * waveScale
      ));
      vec3 lightDirection = normalize(vec3(-0.34, 0.86, -0.38));
      float slopeLight = pow(max(0.0, dot(surfaceNormal, lightDirection)), 5.0);
      float grazingLight = pow(1.0 - abs(dot(surfaceNormal,
        normalize(vec3(-worldPosition.x, CAMERA_HEIGHT - worldPosition.y, -worldPosition.z)))), 3.0);
      float crestBreakup = smoothstep(-0.56, 0.76,
        sin(worldPosition.x * 0.63 + worldPosition.z * 0.18 + uTime * 0.17)
        + sin(worldPosition.x * 1.71 - worldPosition.z * 0.11 - uTime * 0.13) * 0.32);
      float crest = smoothstep(0.035, 0.30, surfaceSample.crest) * mix(0.56, 1.0, crestBreakup);
      crest += slopeLight * 0.34 + grazingLight * crest * 0.18;
      crest += wakeEnvelope * uPointerEnergy * 0.38;
      crest = clamp(crest, 0.0, 1.0);
      float reveal = mix(0.012, 1.0, smoothstep(0.02, 0.50, uScroll));
      float horizonFade = smoothstep(0.0, 0.055, uv.y);
      float readingQuiet = mix(0.34, 1.0, smoothstep(0.24, 0.76, abs(projected.x)));
      float depthLight = mix(0.42, 1.0, smoothstep(0.02, 0.88, depth));
      float faceLight = mix(0.08, 0.31, depth) * mix(0.68, 1.0, surfaceNormal.y);
      float perspectiveScale = clamp(1.0 / viewZ, 0.03, 0.72);

      vAlpha = reveal * horizonFade * readingQuiet * depthLight
        * (0.012 + faceLight + crest * 0.76);
      vCrest = crest;
      vDepth = depth;
      gl_PointSize = min(6.2, (0.44 + perspectiveScale * 2.05 + crest * 1.58
        + wakeEnvelope * uPointerEnergy * 0.62) * uPixelRatio);
      gl_Position = vec4(projected, 0.0, 1.0);
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
        pixelRatio: gl.getUniformLocation(this.program, 'uPixelRatio'),
        aspect: gl.getUniformLocation(this.program, 'uAspect')
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
      this.aspect = Math.max(0.45, window.innerWidth / Math.max(1, window.innerHeight));
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
      gl.uniform1f(this.uniforms.aspect, this.aspect);
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
      const aspect = width / Math.max(1, height);
      const pointerRawDepth = Math.min(1, Math.max(0, (cursor.y - 0.18) / 0.82));
      const pointerDepth = Math.pow(pointerRawDepth, 0.78);
      const pointerWorldDepth = OCEAN_FAR + (OCEAN_NEAR - OCEAN_FAR) * pointerDepth;
      const pointerBaseViewDepth = Math.sin(CAMERA_PITCH) * CAMERA_HEIGHT
        + Math.cos(CAMERA_PITCH) * pointerWorldDepth;
      const pointerHalfWidth = pointerBaseViewDepth * TAN_HALF_FOV * aspect * OCEAN_OVERSCAN;
      const pointerWorldX = (cursor.x - 0.5) * 2 * pointerHalfWidth;
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = 'lighter';

      for (let row = 0; row < rows; row += 1) {
        const rawDepth = row / Math.max(1, rows - 1);
        const depth = Math.pow(rawDepth, 0.78);
        const worldDepth = OCEAN_FAR + (OCEAN_NEAR - OCEAN_FAR) * depth;
        const baseViewDepth = Math.sin(CAMERA_PITCH) * CAMERA_HEIGHT
          + Math.cos(CAMERA_PITCH) * worldDepth;
        const halfWidth = baseViewDepth * TAN_HALF_FOV * aspect * OCEAN_OVERSCAN;

        for (let column = 0; column < columns; column += 1) {
          const u = column / Math.max(1, columns - 1);
          const worldX = (u - 0.5) * 2 * halfWidth;
          const surface = sampleObliqueSurface(worldX, worldDepth, time);
          const wakeDistance = Math.hypot(
            (worldX - pointerWorldX) * 0.34,
            (worldDepth - pointerWorldDepth) * 0.52
          );
          const wakeEnvelope = Math.exp(-wakeDistance * 1.42) * smoothstep(0.02, 0.24, depth);
          const wake = Math.sin(wakeDistance * 7.8 - time * 4.2) * wakeEnvelope * cursor.energy;
          surface.height += wake * 0.46;
          const projected = projectOceanPoint(u, rawDepth, surface, scroll, aspect);
          const x = projected.x * width;
          const y = projected.y * height;
          if (x < -4 || x > width + 4 || y < -4 || y > height + 4) continue;

          const normalLength = Math.hypot(surface.slopeX, 1, surface.slopeZ);
          const slopeLight = Math.pow(Math.max(0,
            (surface.slopeX * 0.34 + 0.86 + surface.slopeZ * 0.38) / normalLength), 5);
          const crest = Math.min(1, smoothstep(0.035, 0.3, surface.crest)
            + slopeLight * 0.34 + wakeEnvelope * cursor.energy * 0.38);
          const readingQuiet = 0.34
            + smoothstep(0.24, 0.76, Math.abs(projected.x * 2 - 1)) * 0.66;
          const depthLight = 0.42 + smoothstep(0.02, 0.88, depth) * 0.58;
          const faceLight = (0.08 + depth * 0.23) * (0.68 + 0.32 / normalLength);
          const alpha = Math.min(0.92,
            reveal * readingQuiet * depthLight * (0.012 + faceLight + crest * 0.76));
          const perspectiveSize = smoothstep(0.035, 0.42, projected.perspectiveScale);
          const radius = 0.22 + perspectiveSize * 0.56 + crest * 0.46;
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
      const webglRenderer = new WebGLParticleOcean(canvas);
      canvas.dataset.oceanRenderer = 'webgl2';
      return webglRenderer;
    } catch (error) {
      console.warn('[particle-ocean] WebGL2 unavailable; using the quiet Canvas2D rendering path.', error);
      try {
        const target = canvas.getContext('2d') ? canvas : createFallbackCanvas();
        const canvasRenderer = new Canvas2DParticleOcean(target);
        canvas.dataset.oceanRenderer = 'canvas2d';
        return canvasRenderer;
      } catch (fallbackError) {
        console.warn('[particle-ocean] Rendering disabled.', fallbackError);
        canvas.dataset.oceanRenderer = 'none';
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
