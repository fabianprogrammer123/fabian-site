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
  const MAX_WAKE_NODES = 8;
  const WAKE_EMIT_DISTANCE = 0.012;
  const WAKE_LIFETIME = 1.72;
  const WAKE_DRIFT_SPEED = 0.075;
  const WAKE_VELOCITY_DAMPING = 2.2;
  const TOP_OCEAN_REVEAL = 0.085;
  const TOP_OCEAN_EXPOSURE = 0.012;
  const TOP_BLEND_PROGRESS = 0.08;

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

  function clamp01(value) {
    return Math.min(1, Math.max(0, value));
  }

  function createWakeField() {
    const nodes = Array.from({ length: MAX_WAKE_NODES }, () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      age: 0,
      energy: 0,
      initialEnergy: 0,
      active: false
    }));
    return {
      nodes,
      count: 0,
      hasAnchor: false,
      anchorX: 0,
      anchorY: 0
    };
  }

  function copyWakeNode(target, source) {
    target.x = source.x;
    target.y = source.y;
    target.vx = source.vx;
    target.vy = source.vy;
    target.age = source.age;
    target.energy = source.energy;
    target.initialEnergy = source.initialEnergy;
    target.active = source.active;
  }

  function emitWakeImpulse(field, x, y, velocityX, velocityY, energy) {
    const nextX = clamp01(x);
    const nextY = clamp01(y);
    if (!field.hasAnchor) {
      field.hasAnchor = true;
      field.anchorX = nextX;
      field.anchorY = nextY;
      return false;
    }

    const travelX = nextX - field.anchorX;
    const travelY = nextY - field.anchorY;
    const travel = Math.hypot(travelX, travelY);
    if (travel < WAKE_EMIT_DISTANCE) return false;

    let directionX = Number.isFinite(velocityX) ? velocityX : travelX;
    let directionY = Number.isFinite(velocityY) ? velocityY : travelY;
    let directionLength = Math.hypot(directionX, directionY);
    if (directionLength < 0.0001) {
      directionX = travelX;
      directionY = travelY;
      directionLength = Math.max(0.0001, travel);
    }

    let targetIndex = field.count;
    if (field.count === MAX_WAKE_NODES) {
      for (let index = 1; index < MAX_WAKE_NODES; index += 1) {
        copyWakeNode(field.nodes[index - 1], field.nodes[index]);
      }
      targetIndex = MAX_WAKE_NODES - 1;
    } else {
      field.count += 1;
    }

    const node = field.nodes[targetIndex];
    node.x = nextX;
    node.y = nextY;
    node.vx = directionX / directionLength;
    node.vy = directionY / directionLength;
    node.age = 0;
    node.energy = clamp01(energy);
    node.initialEnergy = node.energy;
    node.active = true;
    field.anchorX = nextX;
    field.anchorY = nextY;
    return true;
  }

  function advanceWakeField(field, deltaSeconds) {
    const elapsed = Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : 0);
    let writeIndex = 0;
    for (let readIndex = 0; readIndex < field.count; readIndex += 1) {
      const node = field.nodes[readIndex];
      node.age += elapsed;
      if (node.age >= WAKE_LIFETIME) {
        node.active = false;
        node.energy = 0;
        continue;
      }

      node.x = clamp01(node.x + node.vx * WAKE_DRIFT_SPEED * elapsed);
      node.y = clamp01(node.y + node.vy * WAKE_DRIFT_SPEED * elapsed);
      const damping = Math.exp(-WAKE_VELOCITY_DAMPING * elapsed);
      node.vx *= damping;
      node.vy *= damping;
      const lifeProgress = node.age / WAKE_LIFETIME;
      node.energy = node.initialEnergy * (1 - smoothstep(0.03, 1, lifeProgress));

      if (writeIndex !== readIndex) copyWakeNode(field.nodes[writeIndex], node);
      field.nodes[writeIndex].active = true;
      writeIndex += 1;
    }

    for (let index = writeIndex; index < field.count; index += 1) {
      field.nodes[index].active = false;
      field.nodes[index].energy = 0;
    }
    field.count = writeIndex;
    return field;
  }

  function mapWakePointToWorld(x, y, aspect) {
    const rawDepth = clamp01((y - 0.18) / 0.82);
    const depth = Math.pow(rawDepth, 0.78);
    const z = OCEAN_FAR + (OCEAN_NEAR - OCEAN_FAR) * depth;
    const viewDepth = Math.sin(CAMERA_PITCH) * CAMERA_HEIGHT
      + Math.cos(CAMERA_PITCH) * z;
    const halfWidth = viewDepth * TAN_HALF_FOV * Math.max(0.45, aspect || 1) * OCEAN_OVERSCAN;
    return { x: (clamp01(x) - 0.5) * 2 * halfWidth, z };
  }

  function sampleWakeDisplacement(worldX, worldZ, field, aspect, time, output) {
    const displacement = output || { x: 0, y: 0, z: 0, highlight: 0 };
    displacement.x = 0;
    displacement.y = 0;
    displacement.z = 0;
    displacement.highlight = 0;
    const safeAspect = Math.max(0.45, aspect || 1);
    const phaseTime = Number.isFinite(time) ? time : 0;
    const depth = clamp01((OCEAN_FAR - worldZ) / (OCEAN_FAR - OCEAN_NEAR));
    const depthEnvelope = smoothstep(0.02, 0.24, depth);
    for (let index = 0; index < field.count; index += 1) {
      const node = field.nodes[index];
      const nodeRawDepth = clamp01((node.y - 0.18) / 0.82);
      const nodeDepth = Math.pow(nodeRawDepth, 0.78);
      const nodeWorldZ = OCEAN_FAR + (OCEAN_NEAR - OCEAN_FAR) * nodeDepth;
      const nodeViewDepth = Math.sin(CAMERA_PITCH) * CAMERA_HEIGHT
        + Math.cos(CAMERA_PITCH) * nodeWorldZ;
      const nodeHalfWidth = nodeViewDepth * TAN_HALF_FOV * safeAspect * OCEAN_OVERSCAN;
      const nodeWorldX = (node.x - 0.5) * 2 * nodeHalfWidth;
      const deltaX = (worldX - nodeWorldX) * 0.34;
      const deltaZ = (worldZ - nodeWorldZ) * 0.52;
      const distance = Math.hypot(deltaX, deltaZ);
      const envelope = Math.exp(-distance * 1.42) * depthEnvelope * node.energy;
      if (envelope < 0.0001) continue;

      const radialScale = distance > 0.0001 ? 1 / distance : 0;
      const directionLength = Math.max(0.0001, Math.hypot(node.vx * safeAspect, node.vy));
      const directionX = node.vx * safeAspect / directionLength;
      const directionZ = -node.vy / directionLength;
      const ripple = Math.sin(distance * 7.8 - node.age * 5.4 - phaseTime * 0.55);
      displacement.x += (directionX * 0.34
        + deltaX * radialScale * (0.12 + ripple * 0.06)) * envelope;
      displacement.z += (directionZ * 0.34
        + deltaZ * radialScale * (0.12 + ripple * 0.06)) * envelope;
      displacement.y += (0.11 + ripple * 0.32) * envelope;
      displacement.highlight += envelope;
    }
    return displacement;
  }

  function getWakeEnergy(field) {
    let energy = 0;
    for (let index = 0; index < field.count; index += 1) {
      energy += field.nodes[index].energy;
    }
    return energy;
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

  window.ParticleOceanModel = {
    MAX_WAKE_NODES,
    WAKE_EMIT_DISTANCE,
    WAKE_LIFETIME,
    TOP_OCEAN_REVEAL,
    normalizeScroll,
    sampleObliqueSurface,
    projectOceanPoint,
    createWakeField,
    emitWakeImpulse,
    advanceWakeField,
    mapWakePointToWorld,
    sampleWakeDisplacement,
    getWakeEnergy
  };

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
  const wakeField = createWakeField();

  const vertexShaderSource = `#version 300 es
    precision highp float;

    uniform vec2 uGrid;
    uniform vec2 uPointer;
    uniform float uPointerEnergy;
    const int MAX_WAKE_NODES = 8;
    uniform vec4 uWakeNodes[MAX_WAKE_NODES];
    uniform vec2 uWakeVelocity[MAX_WAKE_NODES];
    uniform int uWakeCount;
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

      float waveScale = mix(0.72, 1.14, uScroll);
      worldPosition += surfaceSample.displacement * waveScale;
      vec3 wakeDisplacement = vec3(0.0);
      float wakeHighlight = 0.0;
      for (int wakeIndex = 0; wakeIndex < MAX_WAKE_NODES; wakeIndex += 1) {
        if (wakeIndex >= uWakeCount) break;
        vec4 wakeNode = uWakeNodes[wakeIndex];
        float wakeRawDepth = clamp((wakeNode.y - 0.18) / 0.82, 0.0, 1.0);
        float wakeDepth = pow(wakeRawDepth, 0.78);
        float wakeWorldDepth = mix(OCEAN_FAR, OCEAN_NEAR, wakeDepth);
        float wakeViewDepth = sinPitch * CAMERA_HEIGHT + cosPitch * wakeWorldDepth;
        float wakeHalfWidth = wakeViewDepth * TAN_HALF_FOV * uAspect * OCEAN_OVERSCAN;
        float wakeWorldX = (wakeNode.x - 0.5) * 2.0 * wakeHalfWidth;
        vec2 wakeDelta = vec2(
          (worldPosition.x - wakeWorldX) * 0.34,
          (worldPosition.z - wakeWorldDepth) * 0.52
        );
        float wakeDistance = length(wakeDelta);
        float wakeEnvelope = exp(-wakeDistance * 1.42)
          * smoothstep(0.02, 0.24, depth) * wakeNode.w;
        vec2 wakeRadial = wakeDistance > 0.0001 ? wakeDelta / wakeDistance : vec2(0.0);
        vec2 wakeVelocity = uWakeVelocity[wakeIndex];
        vec2 wakeDirection = normalize(vec2(wakeVelocity.x * uAspect, -wakeVelocity.y));
        float wakeRing = sin(wakeDistance * 7.8 - wakeNode.z * 5.4 - uTime * 0.55);
        wakeDisplacement.xz += (wakeDirection * 0.34
          + wakeRadial * (0.12 + wakeRing * 0.06)) * wakeEnvelope;
        wakeDisplacement.y += (0.11 + wakeRing * 0.32) * wakeEnvelope;
        wakeHighlight += wakeEnvelope;
      }
      worldPosition.xz += wakeDisplacement.xz;
      worldPosition.y += wakeDisplacement.y;

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
      crest += wakeHighlight * (0.10 + uPointerEnergy * 0.025);
      crest = clamp(crest, 0.0, 1.0);
      float reveal = mix(0.085, 1.0, smoothstep(0.02, 0.50, uScroll));
      float horizonFade = smoothstep(0.0, 0.055, uv.y);
      float horizonTrace = (1.0 - smoothstep(0.0, 0.12, uv.y)) * crest * 0.05;
      float readingQuiet = mix(0.34, 1.0, smoothstep(0.24, 0.76, abs(projected.x)));
      float depthLight = mix(0.42, 1.0, smoothstep(0.02, 0.88, depth));
      float faceLight = mix(0.08, 0.31, depth) * mix(0.68, 1.0, surfaceNormal.y);
      float perspectiveScale = clamp(1.0 / viewZ, 0.03, 0.72);

      vAlpha = reveal * horizonFade * readingQuiet * depthLight
        * (0.012 + faceLight + crest * 0.76) + horizonTrace * readingQuiet;
      vCrest = crest;
      vDepth = depth;
      gl_PointSize = min(6.2, (0.44 + perspectiveScale * 2.05 + crest * 1.58
        + wakeHighlight * 0.18) * uPixelRatio);
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
      this.wakeNodeUniformData = new Float32Array(MAX_WAKE_NODES * 4);
      this.wakeVelocityUniformData = new Float32Array(MAX_WAKE_NODES * 2);
      this.uniforms = {
        grid: gl.getUniformLocation(this.program, 'uGrid'),
        pointer: gl.getUniformLocation(this.program, 'uPointer'),
        pointerEnergy: gl.getUniformLocation(this.program, 'uPointerEnergy'),
        wakeNodes: gl.getUniformLocation(this.program, 'uWakeNodes[0]'),
        wakeVelocity: gl.getUniformLocation(this.program, 'uWakeVelocity[0]'),
        wakeCount: gl.getUniformLocation(this.program, 'uWakeCount'),
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

    render(time, scroll, cursor, wake) {
      const gl = this.gl;
      if (scroll < TOP_BLEND_PROGRESS) {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      } else {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      }
      this.wakeNodeUniformData.fill(0);
      this.wakeVelocityUniformData.fill(0);
      for (let index = 0; index < wake.count; index += 1) {
        const node = wake.nodes[index];
        const nodeOffset = index * 4;
        const velocityOffset = index * 2;
        this.wakeNodeUniformData[nodeOffset] = node.x;
        this.wakeNodeUniformData[nodeOffset + 1] = node.y;
        this.wakeNodeUniformData[nodeOffset + 2] = node.age;
        this.wakeNodeUniformData[nodeOffset + 3] = node.energy;
        this.wakeVelocityUniformData[velocityOffset] = node.vx;
        this.wakeVelocityUniformData[velocityOffset + 1] = node.vy;
      }
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.program);
      gl.bindVertexArray(this.vertexArray);
      gl.uniform2f(this.uniforms.grid, this.gridX, this.gridY);
      gl.uniform2f(this.uniforms.pointer, cursor.x, cursor.y);
      gl.uniform1f(this.uniforms.pointerEnergy, cursor.energy);
      gl.uniform4fv(this.uniforms.wakeNodes, this.wakeNodeUniformData);
      gl.uniform2fv(this.uniforms.wakeVelocity, this.wakeVelocityUniformData);
      gl.uniform1i(this.uniforms.wakeCount, wake.count);
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
      this.wakeDisplacement = { x: 0, y: 0, z: 0, highlight: 0 };
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

    render(time, scroll, cursor, wake) {
      const context = this.context;
      const width = this.width;
      const height = this.height;
      const mobile = width <= MOBILE_BREAKPOINT;
      const columns = mobile ? 92 : 148;
      const rows = mobile ? 58 : 82;
      const reveal = TOP_OCEAN_REVEAL
        + smoothstep(0.02, 0.5, scroll) * (1 - TOP_OCEAN_REVEAL);
      const aspect = width / Math.max(1, height);
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = scroll < TOP_BLEND_PROGRESS ? 'source-over' : 'lighter';

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
          const wakeDisplacement = sampleWakeDisplacement(
            worldX,
            worldDepth,
            wake,
            aspect,
            time,
            this.wakeDisplacement
          );
          surface.x += wakeDisplacement.x;
          surface.height += wakeDisplacement.y;
          surface.z += wakeDisplacement.z;
          const projected = projectOceanPoint(u, rawDepth, surface, scroll, aspect);
          const x = projected.x * width;
          const y = projected.y * height;
          if (x < -4 || x > width + 4 || y < -4 || y > height + 4) continue;

          const normalLength = Math.hypot(surface.slopeX, 1, surface.slopeZ);
          const slopeLight = Math.pow(Math.max(0,
            (surface.slopeX * 0.34 + 0.86 + surface.slopeZ * 0.38) / normalLength), 5);
          const crest = Math.min(1, smoothstep(0.035, 0.3, surface.crest)
            + slopeLight * 0.34 + wakeDisplacement.highlight * 0.125);
          const readingQuiet = 0.34
            + smoothstep(0.24, 0.76, Math.abs(projected.x * 2 - 1)) * 0.66;
          const depthLight = 0.42 + smoothstep(0.02, 0.88, depth) * 0.58;
          const faceLight = (0.08 + depth * 0.23) * (0.68 + 0.32 / normalLength);
          const horizonTrace = (1 - smoothstep(0, 0.12, rawDepth)) * crest * 0.05;
          const alpha = Math.min(0.92, reveal * readingQuiet * depthLight
            * (0.012 + faceLight + crest * 0.76) + horizonTrace * readingQuiet);
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
    const exposure = TOP_OCEAN_EXPOSURE
      + smoothstep(0.10, 0.92, progress) * (0.975 - TOP_OCEAN_EXPOSURE);
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
    if (renderer) renderer.render(time * 0.00078, displayScroll, pointer, wakeField);
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
    advanceWakeField(wakeField, deltaSeconds);

    render(now);
    frameRequest = requestAnimationFrame(tick);
  }

  function renderReducedMotionFrame() {
    staticFrameRequest = 0;
    displayScroll = targetScroll;
    pointer.energy = 0;
    wakeField.count = 0;
    setExposure(displayScroll);
    if (renderer) renderer.render(7.75, displayScroll, pointer, wakeField);
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
    const directionLength = Math.max(0.0001, distance);

    pointer.targetX = nextX;
    pointer.targetY = nextY;
    pointer.targetEnergy = Math.min(1, 0.18 + speed * 2.9);
    emitWakeImpulse(
      wakeField,
      nextX,
      nextY,
      (nextX - pointer.lastX) / directionLength,
      (nextY - pointer.lastY) / directionLength,
      pointer.targetEnergy
    );
    pointer.lastX = nextX;
    pointer.lastY = nextY;
    pointer.lastMoveTime = now;
    pointer.active = true;
  }

  function handlePointerLeave() {
    pointer.active = false;
    pointer.targetEnergy = 0;
    wakeField.hasAnchor = false;
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
    wakeField.count = 0;
    wakeField.hasAnchor = false;
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

  const getRendererName = () => renderer instanceof WebGLParticleOcean
    ? 'webgl2'
    : renderer ? 'canvas2d' : 'none';

  window.ParticleOceanDebug = {
    getState: () => ({
      renderer: getRendererName(),
      scroll: displayScroll,
      pointerEnergy: pointer.energy,
      wakeCount: wakeField.count,
      wakeEnergy: getWakeEnergy(wakeField)
    }),
    getRenderer: getRendererName,
    getScrollProgress: () => displayScroll,
    getPointerEnergy: () => pointer.energy,
    getWakeCount: () => wakeField.count,
    getWakeEnergy: () => getWakeEnergy(wakeField)
  };

  startAnimation();
})();
