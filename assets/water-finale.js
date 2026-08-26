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
  var canvas = document.getElementById('water-screen');
  var actor = document.getElementById('water-actor');
  var nozzle = document.getElementById('water-nozzle');
  if (!stage || !canvas || !actor || !nozzle || !canvas.getContext) return;

  var context = canvas.getContext('2d');
  if (!context) {
    stage.classList.add('is-fallback');
    stage.setAttribute('data-water-state', 'settling');
    return;
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

  function sizeCanvas() {
    viewportWidth = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
    viewportHeight = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
    mobile = viewportWidth <= MOBILE_BREAKPOINT;
    activeParticleLimit = mobile ? MAX_PARTICLES_MOBILE : MAX_PARTICLES_DESKTOP;
    pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.6);
    canvas.width = Math.round(viewportWidth * pixelRatio);
    canvas.height = Math.round(viewportHeight * pixelRatio);
    canvas.style.width = viewportWidth + 'px';
    canvas.style.height = viewportHeight + 'px';
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
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
    var splashCount = Math.round((mobile ? 5 : 9) * strength * (slowFrameScore > 10 ? 0.55 : 1));
    for (var index = 0; index < splashCount; index += 1) {
      var direction = (random() - 0.5) * Math.PI * 0.95 - Math.PI * 0.5;
      var speed = (110 + random() * 210) * (0.55 + strength * 0.45);
      spawnParticle(1, x + (random() - 0.5) * 14, y - 2,
        Math.cos(direction) * speed,
        Math.sin(direction) * speed,
        1.8 + random() * 3.5,
        0.5 + random() * 0.72,
        0.6 + random() * 0.35);
    }
    for (var foamIndex = 0; foamIndex < Math.ceil(splashCount * 0.45); foamIndex += 1) {
      spawnParticle(2, x + (random() - 0.5) * 42, y - random() * 3,
        (random() - 0.5) * 24,
        0,
        2 + random() * 4,
        1.8 + random() * 2.5,
        0.42 + random() * 0.35);
    }
  }

  function emitJet(delta) {
    if (pressure <= 0.01) return;
    updateImpactPoint();
    var rate = (mobile ? 92 : 158) * pressure * (slowFrameScore > 10 ? 0.62 : 1);
    emissionCarry += rate * delta;
    var travel = 0.42;
    var gravity = 920;
    var baseVx = (impactPoint.x - nozzlePoint.x) / travel;
    var baseVy = (impactPoint.y - nozzlePoint.y - 0.5 * gravity * travel * travel) / travel;

    while (emissionCarry >= 1) {
      emissionCarry -= 1;
      var edge = random() - 0.5;
      spawnParticle(0,
        nozzlePoint.x + edge * 4,
        nozzlePoint.y + edge * 3,
        baseVx * (0.96 + random() * 0.08) + edge * 34,
        baseVy * (0.96 + random() * 0.08) + edge * 24,
        1.6 + random() * 2.7,
        0.72,
        0.66 + random() * 0.3);
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
          var impactStrength = particle.type === 0 ? 1 : 0.28;
          if (particle.type !== 0 || random() < 0.28) {
            surface.inject(particle.x / viewportWidth, -1.25 * impactStrength, -0.36 * impactStrength);
          }
          if (particle.type === 0 && random() < 0.14 + pressure * 0.08) {
            emitSplash(particle.x, surfaceYAt(particle.x), 0.42 + pressure * 0.46);
          }
          particle.active = false;
          continue;
        }
      } else if (particle.type === 2) {
        particle.x += particle.vx * delta;
        particle.vx *= Math.pow(0.982, delta * 60);
        particle.y = surfaceYAt(particle.x) - 1.5 - Math.sin(particle.phase + ambientClock * 2) * 1.2;
      } else {
        particle.y -= 12 * delta;
        particle.x += Math.sin(particle.phase + ambientClock) * 4 * delta;
        if (particle.y <= surfaceYAt(particle.x) + 4) particle.active = false;
      }

      if (particle.x < -40 || particle.x > viewportWidth + 40 || particle.y > viewportHeight + 50) {
        particle.active = false;
      }
    }
    return activeCount;
  }

  function traceSurface(offset) {
    var firstY = surfaceYAt(0) + offset;
    context.beginPath();
    context.moveTo(0, firstY);
    var previousX = 0;
    var previousY = firstY;
    for (var index = 1; index < surface.count; index += 1) {
      var x = index / (surface.count - 1) * viewportWidth;
      var y = surfaceYAt(x) + offset;
      var middleX = (previousX + x) * 0.5;
      var middleY = (previousY + y) * 0.5;
      context.quadraticCurveTo(previousX, previousY, middleX, middleY);
      previousX = x;
      previousY = y;
    }
    context.quadraticCurveTo(previousX, previousY, viewportWidth, previousY);
  }

  function waterBodyPath() {
    traceSurface(0);
    context.lineTo(viewportWidth, viewportHeight + 2);
    context.lineTo(0, viewportHeight + 2);
    context.closePath();
  }

  function drawCaustics() {
    context.save();
    waterBodyPath();
    context.clip();
    context.globalCompositeOperation = 'screen';
    context.lineCap = 'round';

    for (var band = 0; band < 6; band += 1) {
      var bandY = meanSurfaceY() + 32 + band * Math.max(34, (viewportHeight - meanSurfaceY()) / 6.5);
      context.beginPath();
      context.moveTo(-30, bandY);
      for (var x = -30; x <= viewportWidth + 40; x += 36) {
        var wave = Math.sin(x * 0.014 + ambientClock * (0.44 + band * 0.04) + band * 1.3) * (8 + band * 1.2);
        context.lineTo(x, bandY + wave);
      }
      context.strokeStyle = 'rgba(189, 239, 255, ' + (0.08 + band * 0.008) + ')';
      context.lineWidth = 5 + band * 1.6;
      context.stroke();
    }
    context.restore();
  }

  function drawWaterBody() {
    if (fill <= 0.001) return;
    var surfaceY = meanSurfaceY();
    var gradient = context.createLinearGradient(0, surfaceY, 0, viewportHeight);
    gradient.addColorStop(0, 'rgba(121, 220, 255, 0.72)');
    gradient.addColorStop(0.13, 'rgba(46, 160, 211, 0.78)');
    gradient.addColorStop(0.55, 'rgba(11, 117, 170, 0.88)');
    gradient.addColorStop(1, 'rgba(6, 79, 120, 0.94)');
    waterBodyPath();
    context.fillStyle = gradient;
    context.fill();

    drawCaustics();

    traceSurface(5);
    context.strokeStyle = 'rgba(4, 83, 126, 0.38)';
    context.lineWidth = 8;
    context.stroke();
    traceSurface(0);
    context.strokeStyle = 'rgba(234, 250, 255, 0.9)';
    context.lineWidth = 2.2;
    context.stroke();
    traceSurface(-3);
    context.strokeStyle = 'rgba(121, 220, 255, 0.34)';
    context.lineWidth = 1;
    context.stroke();
  }

  function drawStream() {
    if (pressure <= 0.01 || state === 'draining') return;
    updateImpactPoint();
    var controlX = nozzlePoint.x + (impactPoint.x - nozzlePoint.x) * 0.52;
    var controlY = Math.min(nozzlePoint.y, impactPoint.y) - 42 - pressure * 18;
    var streamGradient = context.createLinearGradient(nozzlePoint.x, nozzlePoint.y, impactPoint.x, impactPoint.y);
    streamGradient.addColorStop(0, 'rgba(234, 250, 255, 0.95)');
    streamGradient.addColorStop(0.35, 'rgba(121, 220, 255, 0.9)');
    streamGradient.addColorStop(1, 'rgba(38, 149, 204, 0.84)');

    context.save();
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(nozzlePoint.x, nozzlePoint.y);
    context.quadraticCurveTo(controlX, controlY, impactPoint.x, impactPoint.y);
    context.strokeStyle = 'rgba(6, 79, 120, 0.18)';
    context.lineWidth = (mobile ? 10 : 15) * pressure;
    context.stroke();

    context.beginPath();
    context.moveTo(nozzlePoint.x, nozzlePoint.y);
    context.quadraticCurveTo(controlX, controlY, impactPoint.x, impactPoint.y);
    context.strokeStyle = streamGradient;
    context.lineWidth = (mobile ? 6 : 9) * pressure;
    context.stroke();

    context.setLineDash([3, 13]);
    context.lineDashOffset = -ambientClock * 70;
    context.beginPath();
    context.moveTo(nozzlePoint.x, nozzlePoint.y - 1);
    context.quadraticCurveTo(controlX, controlY - 2, impactPoint.x, impactPoint.y - 2);
    context.strokeStyle = 'rgba(255, 255, 255, 0.82)';
    context.lineWidth = Math.max(1, (mobile ? 1.5 : 2.2) * pressure);
    context.stroke();
    context.restore();
  }

  function drawParticles() {
    for (var index = 0; index < activeParticleLimit; index += 1) {
      var particle = particles[index];
      if (!particle.active) continue;
      var lifeRatio = clamp(particle.life / Math.max(0.001, particle.maximumLife), 0, 1);
      var alpha = particle.alpha * Math.min(1, lifeRatio * 2.4);

      if (particle.type === 0) {
        context.fillStyle = 'rgba(218, 246, 255, ' + alpha + ')';
        context.beginPath();
        context.ellipse(particle.x, particle.y, particle.radius * 0.72, particle.radius * 1.8, Math.atan2(particle.vy, particle.vx), 0, Math.PI * 2);
        context.fill();
      } else if (particle.type === 1) {
        context.fillStyle = 'rgba(188, 235, 252, ' + alpha + ')';
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius * lifeRatio, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = 'rgba(255, 255, 255, ' + alpha * 0.72 + ')';
        context.beginPath();
        context.arc(particle.x - particle.radius * 0.22, particle.y - particle.radius * 0.28, Math.max(0.7, particle.radius * 0.28), 0, Math.PI * 2);
        context.fill();
      } else if (particle.type === 2) {
        context.strokeStyle = 'rgba(238, 252, 255, ' + alpha + ')';
        context.lineWidth = 1.2;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.stroke();
      } else {
        context.strokeStyle = 'rgba(218, 246, 255, ' + alpha * 0.72 + ')';
        context.lineWidth = 1;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.stroke();
      }
    }
  }

  function draw() {
    context.clearRect(0, 0, viewportWidth, viewportHeight);
    if (fill <= 0.001 && pressure <= 0.001) return;
    drawWaterBody();
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
      surface.inject(0.62, -5, 0);
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
      context.clearRect(0, 0, viewportWidth, viewportHeight);
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
      surface.inject(impactPoint.x / viewportWidth, -7, -2.5);
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

    if (state === 'spraying' && random() < delta * 2.8) {
      surface.inject(impactPoint.x / viewportWidth, -0.8 - random() * 1.2, -0.22 - random() * 0.35);
    } else if (state === 'settling' && targetFill > 0 && ambientClock % 2.4 < delta) {
      surface.inject(0.16 + random() * 0.68, -0.5 - random() * 0.8, 0);
    }

    var settledThrottle = state === 'settling' && pressure < 0.01;
    if (!settledThrottle || timestamp - lastSettledDraw >= (mobile ? 66 : 40)) {
      draw();
      lastSettledDraw = timestamp;
    }

    if (state === 'draining' && fill <= 0.001 && particleCount === 0) {
      fill = 0;
      surface.clear();
      context.clearRect(0, 0, viewportWidth, viewportHeight);
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
