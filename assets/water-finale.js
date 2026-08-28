(function waterFinaleController(window, document) {
  'use strict';

  var MAX_PARTICLES_DESKTOP = 520;
  var MAX_PARTICLES_MOBILE = 240;
  var SURFACE_MIN = 72;
  var SURFACE_MAX = 220;
  var MOBILE_BREAKPOINT = 620;

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function createSurface(requestedCount) {
    var count = clamp(Math.round(requestedCount), 72, 220);
    var heights = new Float32Array(count);
    var velocities = new Float32Array(count);
    var nextVelocities = new Float32Array(count);

    function inject(normalizedX, displacement, force) {
      var center = clamp(Math.round(clamp(normalizedX, 0, 1) * (count - 1)), 0, count - 1);
      for (var offset = -4; offset <= 4; offset += 1) {
        var index = clamp(center + offset, 0, count - 1);
        var weight = 1 - Math.abs(offset) / 5;
        heights[index] = clamp(heights[index] + displacement * weight, -52, 52);
        velocities[index] = clamp(velocities[index] + force * weight, -14, 14);
      }
    }

    function step(delta) {
      var scaledDelta = clamp(delta, 0, 1 / 30) * 60;
      if (scaledDelta <= 0) return;

      for (var index = 0; index < count; index += 1) {
        var leftIndex = index > 0 ? index - 1 : 1;
        var rightIndex = index < count - 1 ? index + 1 : count - 2;
        var laplacian = heights[leftIndex] + heights[rightIndex] - 2 * heights[index];
        var acceleration = laplacian * 0.105 - heights[index] * 0.0065;
        nextVelocities[index] = (velocities[index] + acceleration * scaledDelta) * Math.pow(0.986, scaledDelta);
      }

      for (var cursor = 0; cursor < count; cursor += 1) {
        velocities[cursor] = clamp(nextVelocities[cursor], -14, 14);
        heights[cursor] = clamp(heights[cursor] + velocities[cursor] * scaledDelta, -52, 52);
        if (Math.abs(heights[cursor]) < 0.00001 && Math.abs(velocities[cursor]) < 0.00001) {
          heights[cursor] = 0;
          velocities[cursor] = 0;
        }
      }
    }

    function sample(index) {
      return heights[clamp(Math.round(index), 0, count - 1)];
    }

    function energy() {
      var total = 0;
      for (var index = 0; index < count; index += 1) {
        total += Math.abs(heights[index]) + Math.abs(velocities[index]);
      }
      return total;
    }

    function clear() {
      heights.fill(0);
      velocities.fill(0);
      nextVelocities.fill(0);
    }

    return {
      count: count,
      inject: inject,
      step: step,
      sample: sample,
      energy: energy,
      clear: clear
    };
  }

  window.WaterFinaleModel = { createSurface: createSurface };

  var stage = document.getElementById('water-finale');
  var materialCanvas = document.getElementById('water-screen');
  var sprayCanvas = document.getElementById('water-spray');
  var actor = document.getElementById('water-actor');
  var nozzle = document.getElementById('water-nozzle');
  if (!stage || !materialCanvas || !sprayCanvas || !actor || !nozzle ||
      !materialCanvas.getContext || !sprayCanvas.getContext) return;

  var gl = materialCanvas.getContext('webgl2', {
    alpha: true,
    antialias: true,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false
  });
  var sprayContext = sprayCanvas.getContext('2d');
  var materialContext = gl ? null : materialCanvas.getContext('2d');

  if (!sprayContext || (!gl && !materialContext)) {
    stage.classList.add('is-fallback');
    stage.setAttribute('data-water-state', 'settling');
    return;
  }

  function compileShader(glContext, type, source) {
    var shader = glContext.createShader(type);
    glContext.shaderSource(shader, source);
    glContext.compileShader(shader);
    if (!glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) {
      var message = glContext.getShaderInfoLog(shader) || 'Unknown water shader error';
      glContext.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  function createWaterMaterial(glContext) {
    var vertexShaderSource = [
      '#version 300 es',
      'precision highp float;',
      'out vec2 vUv;',
      'void main() {',
      '  vec2 position = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));',
      '  vUv = position;',
      '  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);',
      '}'
    ].join('\n');

    var fragmentShaderSource = [
      '#version 300 es',
      'precision highp float;',
      'in vec2 vUv;',
      'out vec4 outColor;',
      'uniform vec2 uViewport;',
      'uniform float uPixelRatio;',
      'uniform float uMeanSurface;',
      'uniform float uSurface[220];',
      'uniform int uSurfaceCount;',
      'uniform float uTime;',
      'uniform float uPressure;',
      'uniform float uImpactX;',
      '',
      'float hash21(vec2 point) {',
      '  point = fract(point * vec2(123.34, 345.45));',
      '  point += dot(point, point + 34.345);',
      '  return fract(point.x * point.y);',
      '}',
      '',
      'float valueNoise(vec2 point) {',
      '  vec2 cell = floor(point);',
      '  vec2 local = fract(point);',
      '  local = local * local * (3.0 - 2.0 * local);',
      '  float a = hash21(cell);',
      '  float b = hash21(cell + vec2(1.0, 0.0));',
      '  float c = hash21(cell + vec2(0.0, 1.0));',
      '  float d = hash21(cell + vec2(1.0, 1.0));',
      '  return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);',
      '}',
      '',
      'float domainWarp(vec2 point) {',
      '  vec2 first = vec2(valueNoise(point + vec2(uTime * 0.07, -uTime * 0.05)),',
      '                    valueNoise(point + vec2(4.7, 8.3) + vec2(-uTime * 0.04, uTime * 0.06)));',
      '  vec2 second = vec2(valueNoise(point * 1.7 + first * 2.4 + vec2(1.8, 5.2)),',
      '                     valueNoise(point * 1.7 + first * 2.4 + vec2(7.4, 2.6)));',
      '  return valueNoise(point + first * 1.8 + second * 0.9);',
      '}',
      '',
      'float cellEdge(vec2 point) {',
      '  vec2 base = floor(point);',
      '  vec2 local = fract(point);',
      '  float closest = 9.0;',
      '  float secondClosest = 9.0;',
      '  for (int y = -1; y <= 1; y++) {',
      '    for (int x = -1; x <= 1; x++) {',
      '      vec2 neighbor = vec2(float(x), float(y));',
      '      vec2 cell = base + neighbor;',
      '      float phase = hash21(cell);',
      '      vec2 feature = neighbor + vec2(hash21(cell + 1.7), hash21(cell + 9.2));',
      '      feature += 0.16 * sin(vec2(phase * 6.283 + uTime * 0.36, phase * 5.17 - uTime * 0.29));',
      '      float distanceToFeature = length(feature - local);',
      '      if (distanceToFeature < closest) {',
      '        secondClosest = closest;',
      '        closest = distanceToFeature;',
      '      } else if (distanceToFeature < secondClosest) {',
      '        secondClosest = distanceToFeature;',
      '      }',
      '    }',
      '  }',
      '  return secondClosest - closest;',
      '}',
      '',
      'float sampleSurface(float normalizedX) {',
      '  float position = clamp(normalizedX, 0.0, 1.0) * float(uSurfaceCount - 1);',
      '  int leftIndex = int(floor(position));',
      '  int rightIndex = min(uSurfaceCount - 1, leftIndex + 1);',
      '  return mix(uSurface[leftIndex], uSurface[rightIndex], fract(position));',
      '}',
      '',
      'void main() {',
      '  vec2 screen = vec2(gl_FragCoord.x / uPixelRatio,',
      '                     uViewport.y - gl_FragCoord.y / uPixelRatio);',
      '  vec2 uv = screen / uViewport;',
      '  float stepX = 1.0 / max(1.0, uViewport.x);',
      '  float wave = sampleSurface(uv.x);',
      '  float surfaceTexture = (domainWarp(vec2(screen.x * 0.017, uTime * 0.11)) - 0.5) * 3.4;',
      '  surfaceTexture += sin(screen.x * 0.052 - uTime * 1.35) * 0.48;',
      '  float surfaceY = uMeanSurface + wave + surfaceTexture;',
      '  float depth = screen.y - surfaceY;',
      '  if (depth < 0.0) discard;',
      '',
      '  float leftWave = sampleSurface(uv.x - stepX * 3.0);',
      '  float rightWave = sampleSurface(uv.x + stepX * 3.0);',
      '  float slope = (rightWave - leftWave) / 6.0;',
      '  float micro = domainWarp(screen * 0.012 + vec2(0.0, uTime * 0.025)) - 0.5;',
      '  vec3 normal = normalize(vec3(-slope * 1.7, micro * 0.34, 1.0));',
      '  vec3 viewDirection = vec3(0.0, 0.0, 1.0);',
      '  vec3 lightDirection = normalize(vec3(-0.42, -0.36, 1.0));',
      '',
      '  vec3 absorption = vec3(0.0090, 0.0028, 0.00125);',
      '  vec3 transmission = exp(-absorption * depth);',
      '  vec3 transmittedLight = vec3(0.82, 0.96, 1.0) * transmission;',
      '  vec3 inScatter = vec3(0.01, 0.16, 0.25) * (1.0 - transmission);',
      '  vec3 color = transmittedLight + inScatter;',
      '  float deepFog = 1.0 - exp(-depth * 0.0038);',
      '  color = mix(color, vec3(0.012, 0.11, 0.19), deepFog * 0.42);',
      '',
      '  vec2 warpedPoint = screen * vec2(0.019, 0.016);',
      '  float warp = domainWarp(warpedPoint * 0.72);',
      '  float edgeA = cellEdge(warpedPoint + vec2(warp * 1.5, -warp * 1.15));',
      '  float edgeB = cellEdge(warpedPoint * 1.73 + vec2(-warp * 1.1, warp * 1.45) + 7.3);',
      '  float causticA = 1.0 - smoothstep(0.018, 0.082, edgeA);',
      '  float causticB = 1.0 - smoothstep(0.014, 0.062, edgeB);',
      '  float caustics = max(causticA * 0.64, causticB * 0.28);',
      '  float causticBreakup = smoothstep(0.34, 0.72, domainWarp(warpedPoint * 0.23 + 13.7));',
      '  caustics *= mix(0.12, 1.0, causticBreakup);',
      '  caustics *= exp(-depth * 0.0046) * smoothstep(9.0, 42.0, depth);',
      '  color += vec3(0.28, 0.69, 0.73) * caustics * 0.17;',
      '  float volumetricLight = smoothstep(0.48, 0.82, domainWarp(vec2(screen.x * 0.004 + uTime * 0.014, depth * 0.0022 - uTime * 0.012)));',
      '  color += vec3(0.04, 0.13, 0.14) * volumetricLight * exp(-depth * 0.0034) * 0.18;',
      '',
      '  float fresnel = 0.025 + 0.975 * pow(1.0 - max(0.0, dot(normal, viewDirection)), 5.0);',
      '  float specular = pow(max(0.0, dot(normal, lightDirection)), 76.0);',
      '  float surfaceRim = exp(-depth * 0.19);',
      '  float underside = exp(-abs(depth - 3.5) * 0.42);',
      '  float impact = exp(-pow((screen.x - uImpactX) / 82.0, 2.0)) * surfaceRim * uPressure;',
      '  float brokenFoam = smoothstep(0.16, 0.62, abs(slope) + abs(micro) * 0.35) * surfaceRim;',
      '  color += vec3(0.64, 0.86, 0.90) * fresnel * (0.2 + surfaceRim * 0.38);',
      '  color += vec3(1.0, 0.98, 0.91) * specular * (0.36 + surfaceRim * 0.5);',
      '  color += vec3(0.64, 0.96, 0.98) * surfaceRim * 0.18;',
      '  color += vec3(0.82, 0.96, 0.96) * (impact * 0.42 + brokenFoam * 0.22);',
      '  color -= vec3(0.02, 0.08, 0.09) * underside * 0.09;',
      '',
      '  float alpha = mix(0.22, 0.89, 1.0 - exp(-depth * 0.0075));',
      '  alpha += surfaceRim * 0.08 + impact * 0.05;',
      '  outColor = vec4(clamp(color, 0.0, 1.0), clamp(alpha, 0.0, 0.94));',
      '}'
    ].join('\n');

    var vertexShader = compileShader(glContext, glContext.VERTEX_SHADER, vertexShaderSource);
    var fragmentShader = compileShader(glContext, glContext.FRAGMENT_SHADER, fragmentShaderSource);
    var program = glContext.createProgram();
    glContext.attachShader(program, vertexShader);
    glContext.attachShader(program, fragmentShader);
    glContext.linkProgram(program);
    glContext.deleteShader(vertexShader);
    glContext.deleteShader(fragmentShader);
    if (!glContext.getProgramParameter(program, glContext.LINK_STATUS)) {
      var linkMessage = glContext.getProgramInfoLog(program) || 'Unknown water material link error';
      glContext.deleteProgram(program);
      throw new Error(linkMessage);
    }

    var surfaceUpload = new Float32Array(SURFACE_MAX);
    var vao = glContext.createVertexArray();
    var locations = {
      viewport: glContext.getUniformLocation(program, 'uViewport'),
      pixelRatio: glContext.getUniformLocation(program, 'uPixelRatio'),
      meanSurface: glContext.getUniformLocation(program, 'uMeanSurface'),
      surface: glContext.getUniformLocation(program, 'uSurface[0]'),
      surfaceCount: glContext.getUniformLocation(program, 'uSurfaceCount'),
      time: glContext.getUniformLocation(program, 'uTime'),
      pressure: glContext.getUniformLocation(program, 'uPressure'),
      impactX: glContext.getUniformLocation(program, 'uImpactX')
    };

    glContext.disable(glContext.DEPTH_TEST);
    glContext.disable(glContext.CULL_FACE);
    glContext.enable(glContext.BLEND);
    glContext.blendEquation(glContext.FUNC_ADD);
    glContext.blendFunc(glContext.SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA);

    function clear() {
      glContext.viewport(0, 0, glContext.canvas.width, glContext.canvas.height);
      glContext.clearColor(0, 0, 0, 0);
      glContext.clear(glContext.COLOR_BUFFER_BIT);
    }

    function render(options) {
      clear();
      if (options.fill <= 0.001) return;

      surfaceUpload.fill(0);
      for (var index = 0; index < options.surface.count; index += 1) {
        surfaceUpload[index] = options.surface.sample(index);
      }

      glContext.useProgram(program);
      glContext.bindVertexArray(vao);
      glContext.uniform2f(locations.viewport, options.width, options.height);
      glContext.uniform1f(locations.pixelRatio, options.pixelRatio);
      glContext.uniform1f(locations.meanSurface, options.meanSurface);
      glContext.uniform1fv(locations.surface, surfaceUpload);
      glContext.uniform1i(locations.surfaceCount, options.surface.count);
      glContext.uniform1f(locations.time, options.time);
      glContext.uniform1f(locations.pressure, options.pressure);
      glContext.uniform1f(locations.impactX, options.impactX);
      glContext.drawArrays(glContext.TRIANGLES, 0, 3);
      glContext.bindVertexArray(null);
    }

    return { clear: clear, render: render };
  }

  var waterMaterial = null;
  if (gl) {
    try {
      waterMaterial = createWaterMaterial(gl);
      stage.classList.add('is-webgl');
    } catch (error) {
      var replacementCanvas = materialCanvas.cloneNode(false);
      materialCanvas.parentNode.replaceChild(replacementCanvas, materialCanvas);
      materialCanvas = replacementCanvas;
      materialContext = materialCanvas.getContext('2d');
      gl = null;
      stage.classList.add('is-fallback');
      window.WaterFinaleShaderError = String(error && error.message ? error.message : error);
    }
  } else {
    stage.classList.add('is-fallback');
  }

  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var viewportWidth = 1;
  var viewportHeight = 1;
  var pixelRatio = 1;
  var mobile = false;
  var surface = createSurface(SURFACE_MIN);
  var particles = [];
  var spawnCursor = 0;
  var activeParticleLimit = MAX_PARTICLES_DESKTOP;
  var fill = 0;
  var targetFill = 0;
  var pressure = 0;
  var state = 'idle';
  var stateStarted = 0;
  var started = false;
  var cancelled = false;
  var frameRequest = 0;
  var lastTimestamp = 0;
  var emissionCarry = 0;
  var ambientClock = 0;
  var slowFrameScore = 0;
  var lastSettledDraw = 0;
  var nozzlePoint = { x: 0, y: 0 };
  var impactPoint = { x: 0, y: 0 };
  var randomSeed = 13579;

  for (var particleIndex = 0; particleIndex < MAX_PARTICLES_DESKTOP; particleIndex += 1) {
    particles.push({
      active: false,
      type: 0,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 0,
      life: 0,
      maximumLife: 0,
      alpha: 0,
      phase: 0
    });
  }

  function random() {
    randomSeed = (randomSeed * 1664525 + 1013904223) >>> 0;
    return randomSeed / 4294967296;
  }

  function scrollY() {
    return window.scrollY || window.pageYOffset || 0;
  }

  function atDocumentBottom() {
    var root = document.documentElement;
    var body = document.body;
    var documentHeight = Math.max(root.scrollHeight, body ? body.scrollHeight : 0);
    var maximumScroll = Math.max(0, documentHeight - window.innerHeight);
    return maximumScroll - scrollY() <= 2;
  }

  function setState(nextState, timestamp) {
    if (state === nextState) return;
    state = nextState;
    stateStarted = Number(timestamp) || window.performance.now();
    stage.setAttribute('data-water-state', state);
    stage.classList.toggle('is-active', state !== 'idle');
    window.WaterFinaleState = state;
  }

  function surfaceColumnCount() {
    var spacing = mobile ? 11 : 8;
    return clamp(Math.round(viewportWidth / spacing), SURFACE_MIN, SURFACE_MAX);
  }

  function sizeLayer(layer) {
    layer.width = Math.round(viewportWidth * pixelRatio);
    layer.height = Math.round(viewportHeight * pixelRatio);
    layer.style.width = viewportWidth + 'px';
    layer.style.height = viewportHeight + 'px';
  }

  function sizeCanvas() {
    viewportWidth = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
    viewportHeight = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
    mobile = viewportWidth <= MOBILE_BREAKPOINT;
    activeParticleLimit = mobile ? MAX_PARTICLES_MOBILE : MAX_PARTICLES_DESKTOP;
    pixelRatio = Math.min(window.devicePixelRatio || 1,
      gl ? (mobile ? 1 : 1.35) : (mobile ? 1.25 : 1.6));
    sizeLayer(materialCanvas);
    sizeLayer(sprayCanvas);
    sprayContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    if (materialContext) materialContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    surface = createSurface(surfaceColumnCount());
    measureNozzle();
  }

  function measureNozzle() {
    var rect = nozzle.getBoundingClientRect();
    nozzlePoint.x = rect.left + rect.width * 0.5;
    nozzlePoint.y = rect.top + rect.height * 0.5;
    updateImpactPoint();
  }

  function meanSurfaceY() {
    return viewportHeight + 18 - fill * viewportHeight * 0.62;
  }

  function surfaceYAt(x) {
    var normalized = clamp(x / Math.max(1, viewportWidth), 0, 1);
    var index = normalized * (surface.count - 1);
    var lower = Math.floor(index);
    var upper = Math.min(surface.count - 1, lower + 1);
    var blend = index - lower;
    var displacement = surface.sample(lower) * (1 - blend) + surface.sample(upper) * blend;
    return meanSurfaceY() + displacement;
  }

  function updateImpactPoint() {
    impactPoint.x = clamp(Math.min(viewportWidth * 0.66, nozzlePoint.x - viewportWidth * 0.12), viewportWidth * 0.28, viewportWidth - 40);
    impactPoint.y = surfaceYAt(impactPoint.x);
  }

  function particleSlot() {
    for (var attempt = 0; attempt < activeParticleLimit; attempt += 1) {
      var index = (spawnCursor + attempt) % activeParticleLimit;
      if (!particles[index].active) {
        spawnCursor = (index + 1) % activeParticleLimit;
        return particles[index];
      }
    }
    var fallback = particles[spawnCursor % activeParticleLimit];
    spawnCursor = (spawnCursor + 1) % activeParticleLimit;
    return fallback;
  }

  function spawnParticle(type, x, y, vx, vy, radius, life, alpha) {
    var particle = particleSlot();
    particle.active = true;
    particle.type = type;
    particle.x = x;
    particle.y = y;
    particle.vx = vx;
    particle.vy = vy;
    particle.radius = radius;
    particle.life = life;
    particle.maximumLife = life;
    particle.alpha = alpha;
    particle.phase = random() * Math.PI * 2;
    return particle;
  }

  function emitSplash(x, y, strength) {
    var splashCount = Math.round((mobile ? 4 : 7) * strength * (slowFrameScore > 10 ? 0.55 : 1));
    for (var index = 0; index < splashCount; index += 1) {
      var direction = (random() - 0.5) * Math.PI * 0.9 - Math.PI * 0.5;
      var speed = (100 + random() * 190) * (0.55 + strength * 0.45);
      spawnParticle(1, x + (random() - 0.5) * 18, y - 2,
        Math.cos(direction) * speed,
        Math.sin(direction) * speed,
        1.2 + random() * 2.7,
        0.44 + random() * 0.58,
        0.42 + random() * 0.34);
    }
    for (var foamIndex = 0; foamIndex < Math.ceil(splashCount * 0.55); foamIndex += 1) {
      spawnParticle(2, x + (random() - 0.5) * 48, y - random() * 3,
        (random() - 0.5) * 30,
        0,
        1.8 + random() * 4.4,
        1.5 + random() * 2.2,
        0.28 + random() * 0.3);
    }
    var bubbleCount = Math.max(1, Math.round(splashCount * 0.32));
    for (var bubbleIndex = 0; bubbleIndex < bubbleCount; bubbleIndex += 1) {
      spawnParticle(3, x + (random() - 0.5) * 34, y + 8 + random() * 30,
        (random() - 0.5) * 12,
        0,
        1 + random() * 2.2,
        1.15 + random() * 1.5,
        0.24 + random() * 0.28);
    }
  }

  function emitJet(delta) {
    if (pressure <= 0.01) return;
    updateImpactPoint();
    var rate = (mobile ? 68 : 108) * pressure * (slowFrameScore > 10 ? 0.62 : 1);
    emissionCarry += rate * delta;
    var travel = 0.42;
    var gravity = 920;
    var baseVx = (impactPoint.x - nozzlePoint.x) / travel;
    var baseVy = (impactPoint.y - nozzlePoint.y - 0.5 * gravity * travel * travel) / travel;

    while (emissionCarry >= 1) {
      emissionCarry -= 1;
      var edge = random() - 0.5;
      spawnParticle(0,
        nozzlePoint.x + edge * 5,
        nozzlePoint.y + edge * 3,
        baseVx * (0.965 + random() * 0.07) + edge * 42,
        baseVy * (0.965 + random() * 0.07) + edge * 30,
        1.1 + random() * 2.1,
        0.72,
        0.38 + random() * 0.36);
    }
  }

  function updateParticles(delta) {
    var activeCount = 0;
    for (var index = 0; index < activeParticleLimit; index += 1) {
      var particle = particles[index];
      if (!particle.active) continue;
      activeCount += 1;
      particle.life -= delta;
      if (particle.life <= 0) {
        particle.active = false;
        continue;
      }

      if (particle.type === 0 || particle.type === 1) {
        particle.vy += (particle.type === 0 ? 920 : 760) * delta;
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        particle.vx *= Math.pow(0.996, delta * 60);

        if (particle.y >= surfaceYAt(particle.x) && fill > 0.015) {
          var impactStrength = particle.type === 0 ? 1 : 0.24;
          if (particle.type !== 0 || random() < 0.16) {
            surface.inject(particle.x / viewportWidth, -0.34 * impactStrength, -0.09 * impactStrength);
          }
          if (particle.type === 0 && random() < 0.08 + pressure * 0.07) {
            emitSplash(particle.x, surfaceYAt(particle.x), 0.38 + pressure * 0.38);
          }
          particle.active = false;
          continue;
        }
      } else if (particle.type === 2) {
        particle.x += particle.vx * delta;
        particle.vx *= Math.pow(0.982, delta * 60);
        particle.y = surfaceYAt(particle.x) - 0.8 - Math.sin(particle.phase + ambientClock * 1.7) * 0.8;
      } else if (particle.type === 3) {
        particle.y -= (15 + particle.radius * 7) * delta;
        particle.x += (particle.vx + Math.sin(particle.phase + ambientClock * 2.4) * 5) * delta;
        if (particle.y <= surfaceYAt(particle.x) + 2) particle.active = false;
      }

      if (particle.x < -40 || particle.x > viewportWidth + 40 || particle.y > viewportHeight + 50) {
        particle.active = false;
      }
    }
    return activeCount;
  }

  function traceFallbackSurface(offset) {
    var firstY = surfaceYAt(0) + offset;
    materialContext.beginPath();
    materialContext.moveTo(0, firstY);
    var previousX = 0;
    var previousY = firstY;
    for (var index = 1; index < surface.count; index += 1) {
      var x = index / (surface.count - 1) * viewportWidth;
      var y = surfaceYAt(x) + offset;
      var middleX = (previousX + x) * 0.5;
      var middleY = (previousY + y) * 0.5;
      materialContext.quadraticCurveTo(previousX, previousY, middleX, middleY);
      previousX = x;
      previousY = y;
    }
    materialContext.quadraticCurveTo(previousX, previousY, viewportWidth, previousY);
  }

  function fallbackWaterPath() {
    traceFallbackSurface(0);
    materialContext.lineTo(viewportWidth, viewportHeight + 2);
    materialContext.lineTo(0, viewportHeight + 2);
    materialContext.closePath();
  }

  function drawFallbackWaterBody() {
    if (!materialContext || fill <= 0.001) return;
    var surfaceY = meanSurfaceY();
    var gradient = materialContext.createLinearGradient(0, surfaceY, 0, viewportHeight);
    gradient.addColorStop(0, 'rgba(155, 225, 232, 0.58)');
    gradient.addColorStop(0.12, 'rgba(63, 169, 190, 0.72)');
    gradient.addColorStop(0.62, 'rgba(13, 93, 133, 0.9)');
    gradient.addColorStop(1, 'rgba(5, 47, 78, 0.96)');
    fallbackWaterPath();
    materialContext.fillStyle = gradient;
    materialContext.fill();

    materialContext.save();
    fallbackWaterPath();
    materialContext.clip();
    materialContext.globalCompositeOperation = 'screen';
    for (var glint = 0; glint < 22; glint += 1) {
      var phase = glint * 2.399 + ambientClock * (0.11 + glint % 3 * 0.025);
      var glintX = (Math.sin(phase * 1.31) * 0.5 + 0.5) * viewportWidth;
      var glintY = surfaceY + 24 + (Math.cos(phase * 0.83) * 0.5 + 0.5) * Math.max(20, viewportHeight - surfaceY - 42);
      materialContext.strokeStyle = 'rgba(194, 243, 240, 0.075)';
      materialContext.lineWidth = 1.2 + glint % 4;
      materialContext.beginPath();
      materialContext.ellipse(glintX, glintY, 18 + glint % 5 * 7, 5 + glint % 3 * 3, phase, 0, Math.PI * 1.55);
      materialContext.stroke();
    }
    materialContext.restore();

    traceFallbackSurface(0);
    materialContext.strokeStyle = 'rgba(231, 253, 250, 0.82)';
    materialContext.lineWidth = 2;
    materialContext.stroke();
    traceFallbackSurface(5);
    materialContext.strokeStyle = 'rgba(8, 78, 108, 0.24)';
    materialContext.lineWidth = 7;
    materialContext.stroke();
  }

  function pourPoint(progress, lateralOffset, phase) {
    var controlX = nozzlePoint.x + (impactPoint.x - nozzlePoint.x) * 0.51;
    var controlY = Math.min(nozzlePoint.y, impactPoint.y) - 39 - pressure * 17;
    var inverse = 1 - progress;
    var x = inverse * inverse * nozzlePoint.x +
      2 * inverse * progress * controlX +
      progress * progress * impactPoint.x;
    var y = inverse * inverse * nozzlePoint.y +
      2 * inverse * progress * controlY +
      progress * progress * impactPoint.y;
    var tangentX = 2 * inverse * (controlX - nozzlePoint.x) +
      2 * progress * (impactPoint.x - controlX);
    var tangentY = 2 * inverse * (controlY - nozzlePoint.y) +
      2 * progress * (impactPoint.y - controlY);
    var tangentLength = Math.sqrt(tangentX * tangentX + tangentY * tangentY) || 1;
    var normalX = -tangentY / tangentLength;
    var normalY = tangentX / tangentLength;
    var flutter = Math.sin(progress * 19 + ambientClock * 13.5 + phase) *
      (0.32 + progress * progress * 1.8);
    var breakup = Math.sin(progress * 43 - ambientClock * 9.2 + phase * 1.7) *
      progress * progress * 0.75;
    var offset = lateralOffset + flutter + breakup;
    return { x: x + normalX * offset, y: y + normalY * offset };
  }

  function drawPourStrand(lateralOffset, width, alpha, phase) {
    sprayContext.beginPath();
    for (var step = 0; step <= 30; step += 1) {
      var progress = step / 30;
      var point = pourPoint(progress, lateralOffset, phase);
      if (step === 0) sprayContext.moveTo(point.x, point.y);
      else sprayContext.lineTo(point.x, point.y);
    }
    var gradient = sprayContext.createLinearGradient(nozzlePoint.x, nozzlePoint.y, impactPoint.x, impactPoint.y);
    gradient.addColorStop(0, 'rgba(238, 255, 252, ' + alpha + ')');
    gradient.addColorStop(0.45, 'rgba(133, 221, 229, ' + alpha * 0.92 + ')');
    gradient.addColorStop(1, 'rgba(46, 151, 180, ' + alpha * 0.72 + ')');
    sprayContext.strokeStyle = gradient;
    sprayContext.lineWidth = width;
    sprayContext.stroke();
  }

  function drawStream() {
    if (pressure <= 0.01 || state === 'draining') return;
    updateImpactPoint();
    var pressurePulse = pressure * (0.965 + Math.sin(ambientClock * 16.2) * 0.035);
    var streamWidth = (mobile ? 7.4 : 10.8) * pressurePulse;

    sprayContext.save();
    sprayContext.lineCap = 'round';
    sprayContext.lineJoin = 'round';
    sprayContext.globalAlpha = clamp(pressure * 1.2, 0, 1);
    sprayContext.shadowColor = 'rgba(32, 125, 158, 0.18)';
    sprayContext.shadowBlur = 5;
    drawPourStrand(0.8, streamWidth * 1.55, 0.12, 0.3);
    sprayContext.shadowBlur = 0;
    drawPourStrand(0, streamWidth, 0.68, 1.1);
    drawPourStrand(-streamWidth * 0.2, streamWidth * 0.34, 0.38, 3.7);
    drawPourStrand(streamWidth * 0.22, streamWidth * 0.22, 0.7, 5.2);
    drawPourStrand(-streamWidth * 0.08, Math.max(0.8, streamWidth * 0.09), 0.88, 2.4);
    sprayContext.restore();
  }

  function drawParticles() {
    for (var index = 0; index < activeParticleLimit; index += 1) {
      var particle = particles[index];
      if (!particle.active) continue;
      var lifeRatio = clamp(particle.life / Math.max(0.001, particle.maximumLife), 0, 1);
      var alpha = particle.alpha * Math.min(1, lifeRatio * 2.4);

      if (particle.type === 0) {
        sprayContext.fillStyle = 'rgba(186, 235, 238, ' + alpha * 0.7 + ')';
        sprayContext.beginPath();
        sprayContext.ellipse(
          particle.x,
          particle.y,
          particle.radius * 1.5,
          particle.radius * 0.52,
          Math.atan2(particle.vy, particle.vx),
          0,
          Math.PI * 2
        );
        sprayContext.fill();
      } else if (particle.type === 1) {
        sprayContext.fillStyle = 'rgba(174, 228, 231, ' + alpha + ')';
        sprayContext.beginPath();
        sprayContext.ellipse(
          particle.x,
          particle.y,
          particle.radius * lifeRatio,
          particle.radius * lifeRatio * 0.72,
          particle.phase,
          0,
          Math.PI * 2
        );
        sprayContext.fill();
        sprayContext.fillStyle = 'rgba(255, 255, 246, ' + alpha * 0.68 + ')';
        sprayContext.beginPath();
        sprayContext.arc(
          particle.x - particle.radius * 0.25,
          particle.y - particle.radius * 0.3,
          Math.max(0.5, particle.radius * 0.22),
          0,
          Math.PI * 2
        );
        sprayContext.fill();
      } else if (particle.type === 2) {
        sprayContext.fillStyle = 'rgba(231, 249, 244, ' + alpha * 0.52 + ')';
        sprayContext.beginPath();
        sprayContext.ellipse(
          particle.x,
          particle.y,
          particle.radius * (1.2 + (1 - lifeRatio) * 0.8),
          Math.max(0.5, particle.radius * 0.28),
          particle.phase * 0.2,
          0,
          Math.PI * 2
        );
        sprayContext.fill();
      } else if (particle.type === 3) {
        sprayContext.strokeStyle = 'rgba(211, 244, 241, ' + alpha * 0.72 + ')';
        sprayContext.lineWidth = Math.max(0.7, particle.radius * 0.24);
        sprayContext.beginPath();
        sprayContext.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        sprayContext.stroke();
        sprayContext.fillStyle = 'rgba(255, 255, 246, ' + alpha * 0.55 + ')';
        sprayContext.beginPath();
        sprayContext.arc(particle.x - particle.radius * 0.28, particle.y - particle.radius * 0.32,
          Math.max(0.35, particle.radius * 0.18), 0, Math.PI * 2);
        sprayContext.fill();
      }
    }
  }

  function clearMaterial() {
    if (waterMaterial) {
      waterMaterial.clear();
    } else if (materialContext) {
      materialContext.clearRect(0, 0, viewportWidth, viewportHeight);
    }
  }

  function draw() {
    sprayContext.clearRect(0, 0, viewportWidth, viewportHeight);
    if (fill <= 0.001 && pressure <= 0.001) {
      clearMaterial();
      return;
    }

    if (waterMaterial) {
      waterMaterial.render({
        fill: fill,
        width: viewportWidth,
        height: viewportHeight,
        pixelRatio: pixelRatio,
        meanSurface: meanSurfaceY(),
        surface: surface,
        time: ambientClock,
        pressure: pressure,
        impactX: impactPoint.x
      });
    } else {
      clearMaterial();
      drawFallbackWaterBody();
    }
    drawStream();
    drawParticles();
  }

  function activeParticleCount() {
    var count = 0;
    for (var index = 0; index < activeParticleLimit; index += 1) {
      if (particles[index].active) count += 1;
    }
    return count;
  }

  function clearParticles() {
    for (var index = 0; index < particles.length; index += 1) {
      particles[index].active = false;
    }
    emissionCarry = 0;
  }

  function ensureFrame() {
    if (!frameRequest && !document.hidden && !reducedMotion) {
      frameRequest = window.requestAnimationFrame(frame);
    }
  }

  function beginAtBottom() {
    if (cancelled) return;
    targetFill = 1;
    stage.classList.add('is-active');

    if (reducedMotion) {
      started = true;
      fill = 1;
      pressure = 0;
      setState('settling');
      measureNozzle();
      surface.inject(0.62, -2.2, 0);
      draw();
      return;
    }

    if (!started) {
      started = true;
      setState('entering');
    } else if (fill < 0.995 && state !== 'entering' && state !== 'aiming') {
      setState('spraying');
      measureNozzle();
    } else if (fill >= 0.995) {
      setState('settling');
    }
    ensureFrame();
  }

  function beginDrain() {
    if (!started && fill <= 0) return;
    targetFill = 0;
    pressure = 0;
    if (reducedMotion) {
      fill = 0;
      surface.clear();
      clearMaterial();
      sprayContext.clearRect(0, 0, viewportWidth, viewportHeight);
      setState('idle');
      stage.classList.remove('is-active');
      return;
    }
    setState('draining');
    ensureFrame();
  }

  function updateChoreography(timestamp, delta) {
    var elapsed = Math.max(0, timestamp - stateStarted) / 1000;
    if (state === 'entering' && elapsed >= 0.7) {
      setState('aiming', timestamp);
    } else if (state === 'aiming' && elapsed >= 0.65) {
      setState('spraying', timestamp);
      measureNozzle();
      surface.inject(impactPoint.x / viewportWidth, -3.8, -1.15);
    }

    if (targetFill > fill) {
      fill = Math.min(targetFill, fill + delta * 0.17);
    } else if (targetFill < fill) {
      fill = Math.max(targetFill, fill - delta * 0.9);
    }

    if (state === 'spraying') {
      pressure += (1 - pressure) * Math.min(1, delta * 5.5);
      if (fill >= 0.995) setState('settling', timestamp);
    } else {
      pressure += (0 - pressure) * Math.min(1, delta * (state === 'draining' ? 10 : 2.8));
    }

    if (state === 'settling' && targetFill > 0) {
      pressure = Math.max(0, pressure - delta * 0.7);
    }
  }

  function frame(timestamp) {
    frameRequest = 0;
    if (document.hidden) return;
    if (!lastTimestamp) lastTimestamp = timestamp;
    var rawDelta = Math.max(0, timestamp - lastTimestamp) / 1000;
    var delta = Math.min(rawDelta, 0.05);
    lastTimestamp = timestamp;

    if (rawDelta * 1000 > 24) slowFrameScore = Math.min(30, slowFrameScore + 1);
    else slowFrameScore = Math.max(0, slowFrameScore - 0.35);

    updateChoreography(timestamp, delta);
    ambientClock += delta;
    updateImpactPoint();
    emitJet(delta);
    var particleCount = updateParticles(delta);
    surface.step(delta);

    if (state === 'spraying' && random() < delta * 2.1) {
      surface.inject(impactPoint.x / viewportWidth, -0.32 - random() * 0.42, -0.08 - random() * 0.1);
    } else if (state === 'settling' && targetFill > 0 && ambientClock % 3.2 < delta) {
      surface.inject(0.16 + random() * 0.68, -0.22 - random() * 0.34, 0);
    }

    var settledThrottle = state === 'settling' && pressure < 0.01;
    if (!settledThrottle || timestamp - lastSettledDraw >= (mobile ? 66 : 40)) {
      draw();
      lastSettledDraw = timestamp;
    }

    if (state === 'draining' && fill <= 0.001 && particleCount === 0) {
      fill = 0;
      surface.clear();
      clearMaterial();
      sprayContext.clearRect(0, 0, viewportWidth, viewportHeight);
      setState('idle', timestamp);
      stage.classList.remove('is-active');
      return;
    }

    if (state !== 'idle' || fill > 0.001 || pressure > 0.001 || particleCount > 0) ensureFrame();
  }

  function handleScroll() {
    if (atDocumentBottom()) beginAtBottom();
    else beginDrain();
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      cancelled = true;
      clearParticles();
      beginDrain();
    }
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      if (frameRequest) window.cancelAnimationFrame(frameRequest);
      frameRequest = 0;
      lastTimestamp = 0;
      return;
    }
    lastTimestamp = 0;
    if (state !== 'idle') ensureFrame();
  }

  function handleResize() {
    var preservedFill = fill;
    sizeCanvas();
    fill = preservedFill;
    if (state !== 'idle') draw();
  }

  function handlePageHide() {
    if (frameRequest) window.cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    window.removeEventListener('scroll', handleScroll);
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('pagehide', handlePageHide);
  }

  window.WaterFinaleDebug = {
    getState: function () { return state; },
    getFill: function () { return fill; },
    getSurfaceY: function () { return meanSurfaceY(); },
    getActiveParticles: activeParticleCount,
    getRenderer: function () { return waterMaterial ? 'webgl2' : 'canvas2d'; },
    cancel: function () {
      cancelled = true;
      beginDrain();
    }
  };

  sizeCanvas();
  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', handleResize);
  window.addEventListener('keydown', handleKeyDown);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pagehide', handlePageHide);
  handleScroll();
})(window, document);
