(function paintJourneyController(window, document) {
  'use strict';

  window.PaintJourneyControllerClaimed = true;

  var THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.min.js';
  var LEVEL_ORDER = ['thoughts', 'background', 'now', 'why-this-site', 'portrait'];
  var DURATIONS = {
    entering: 0.8,
    'bottom-paint': 2.2,
    walk: 0.9,
    'coil-rope': 0.6,
    'throw-rope': 0.8,
    brace: 0.45,
    climb: 2.35,
    'pull-bucket': 0.85,
    'paint-swing': 1.45
  };
  var NAVIGATION_KEYS = {
    ' ': true,
    Spacebar: true,
    PageUp: true,
    PageDown: true,
    Home: true,
    End: true,
    ArrowUp: true,
    ArrowDown: true,
    ArrowLeft: true,
    ArrowRight: true
  };

  var stage = document.getElementById('paint-finale');
  var fallbackCanvas = document.getElementById('paint-finale-canvas');
  var liveCanvas = document.getElementById('journey-webgl-layer');
  var trailCanvas = document.getElementById('journey-paint-layer');
  var PaintJourney = window.PaintJourney || {};
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var trail = null;
  var waypoints = [];
  var bottomObserver = null;
  var layoutFrame = 0;
  var frameRequest = 0;
  var active = false;
  var failed = false;
  var guidanceEnabled = true;
  var programmaticScroll = false;
  var state = 'idle';
  window.PaintJourneyState = state;
  var stateStarted = 0;
  var previousTimestamp = 0;
  var targetIndex = 1;
  var stateFrom = { x: 0, y: 0 };
  var stateTo = { x: 0, y: 0 };
  var currentPoint = { x: 0, y: 0 };
  var cancelPoint = { x: 0, y: 0 };
  var ropeThrown = false;
  var paintBurstEmitted = false;
  var emissionCarry = 0;
  var inputListenersAttached = false;

  var THREE = null;
  var renderer = null;
  var camera = null;
  var scene = null;
  var character = null;
  var rope = null;
  var particles = null;
  var ropeOrigin = null;
  var ropeAnchor = null;
  var bucketOrigin = null;
  var previousBucketOrigin = null;
  var bucketVelocity = null;
  var paintVelocity = null;

  function setState(nextState, timestamp) {
    state = nextState;
    stateStarted = Number(timestamp) || window.performance.now();
    window.PaintJourneyState = state;
    ropeThrown = false;
    paintBurstEmitted = false;
    emissionCarry = 0;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function ease(value) {
    value = clamp(value, 0, 1);
    return value * value * (3 - 2 * value);
  }

  function mix(from, to, progress) {
    return from + (to - from) * progress;
  }

  function documentWidth() {
    var root = document.documentElement;
    var body = document.body;
    return Math.max(root.clientWidth, root.scrollWidth, body ? body.scrollWidth : 0);
  }

  function scrollX() {
    return window.scrollX || window.pageXOffset || 0;
  }

  function scrollY() {
    return window.scrollY || window.pageYOffset || 0;
  }

  function laneX(index) {
    var inset = window.innerWidth <= 520 ? 18 : 30;
    return index % 2 === 0 ? inset : documentWidth() - inset;
  }

  function computeWaypoints() {
    if (!stage) return [];
    var stageRect = stage.getBoundingClientRect();
    var next = [{
      name: 'bottom',
      element: stage,
      x: laneX(1),
      y: stageRect.top + scrollY() + stageRect.height - 18
    }];

    for (var index = 0; index < LEVEL_ORDER.length; index += 1) {
      var name = LEVEL_ORDER[index];
      var element = document.querySelector('[data-journey-level="' + name + '"]');
      if (!element) continue;
      var rect = element.getBoundingClientRect();
      next.push({
        name: name,
        element: element,
        x: laneX(index),
        y: rect.top + scrollY() + rect.height * 0.55
      });
    }
    waypoints = next;
    return waypoints;
  }

  function requestFallback(options) {
    var PaintFinale = window.PaintFinale = window.PaintFinale || {};
    if (typeof PaintFinale.startFallback === 'function') {
      PaintFinale.startFallback(options || {});
      return;
    }
    PaintFinale.pendingStart = options || {};
  }

  function setLiveStage(isLive) {
    var walker = stage && stage.querySelector('.finale-walker');
    if (walker) walker.style.visibility = isLive ? 'hidden' : '';
    if (fallbackCanvas) fallbackCanvas.style.visibility = isLive ? 'hidden' : '';
  }

  function buildTrail() {
    if (!trailCanvas || typeof PaintJourney.createTrail !== 'function') {
      throw new Error('Paint journey trail is unavailable');
    }
    trail = PaintJourney.createTrail({ canvas: trailCanvas });
    computeWaypoints();
  }

  function targetIsVisible(index) {
    var waypoint = waypoints[index];
    if (!waypoint || !waypoint.element) return false;
    var rect = waypoint.element.getBoundingClientRect();
    return rect.bottom > window.innerHeight * 0.08 && rect.top < window.innerHeight * 0.9;
  }

  function scenePointFromDocument(point, output, depth) {
    output.set(
      point.x - scrollX(),
      window.innerHeight - (point.y - scrollY()),
      Number(depth) || 0
    );
    return output;
  }

  function particlesToDocument(scenePoint, output) {
    output.x = scenePoint.x + scrollX();
    output.y = window.innerHeight - scenePoint.y + scrollY();
    return output;
  }

  function resizeRenderer() {
    if (!renderer || !camera) return;
    var width = Math.max(1, window.innerWidth);
    var height = Math.max(1, window.innerHeight);
    renderer.setPixelRatio(Math.min(width <= 520 ? 1.35 : 1.75, window.devicePixelRatio || 1));
    renderer.setSize(width, height, false);
    camera.left = 0;
    camera.right = width;
    camera.top = height;
    camera.bottom = 0;
    camera.updateProjectionMatrix();
  }

  function recomputeLayout() {
    layoutFrame = 0;
    computeWaypoints();
    resizeRenderer();
  }

  function scheduleLayout() {
    if (reducedMotion) {
      computeWaypoints();
      if (trail) {
        trail.clear();
        trail.drawStaticSpectrum(waypoints);
      }
      return;
    }
    if (layoutFrame) return;
    layoutFrame = window.requestAnimationFrame(recomputeLayout);
  }

  function disableGuidance() {
    guidanceEnabled = false;
    programmaticScroll = false;
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      cancelJourney();
      return;
    }
    if (NAVIGATION_KEYS[event.key]) disableGuidance();
  }

  function attachInputListeners() {
    if (inputListenersAttached) return;
    inputListenersAttached = true;
    window.addEventListener('wheel', disableGuidance, { passive: true });
    window.addEventListener('touchstart', disableGuidance, { passive: true });
    window.addEventListener('pointerdown', disableGuidance, { passive: true });
    window.addEventListener('keydown', handleKeydown);
  }

  function detachInputListeners() {
    if (!inputListenersAttached) return;
    inputListenersAttached = false;
    window.removeEventListener('wheel', disableGuidance);
    window.removeEventListener('touchstart', disableGuidance);
    window.removeEventListener('pointerdown', disableGuidance);
    window.removeEventListener('keydown', handleKeydown);
  }

  function guideTowardTarget(target, delta) {
    if (!guidanceEnabled || !target) return;
    var maximumScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    var desired = clamp(target.y - window.innerHeight * 0.58, 0, maximumScroll);
    var current = scrollY();
    var step = Math.max(2, Math.min(Math.abs(desired - current), delta * 520));
    if (Math.abs(desired - current) < 1) return;
    programmaticScroll = true;
    window.scrollTo({ top: current + Math.sign(desired - current) * step, behavior: 'auto' });
    window.setTimeout(function () { programmaticScroll = false; }, 0);
  }

  function characterScale() {
    return window.innerWidth <= 520 ? 0.62 : 0.88;
  }

  function positionCharacter(point, facing) {
    currentPoint.x = point.x;
    currentPoint.y = point.y;
    character.setScreenPose({
      x: point.x - scrollX(),
      y: window.innerHeight - (point.y - scrollY()),
      scale: characterScale(),
      facing: facing,
      depth: 32
    });
  }

  function updateRopeEndpoints(target) {
    scene.updateMatrixWorld(true);
    character.throwingHand.getWorldPosition(ropeOrigin);
    scenePointFromDocument(target, ropeAnchor, 34);
    rope.setEndpoints(ropeOrigin, ropeAnchor);
  }

  function emitPaint(count, wide, progress, delta) {
    scene.updateMatrixWorld(true);
    character.bucketLip.getWorldPosition(bucketOrigin);
    if (previousBucketOrigin.lengthSq() > 0 && delta > 0) {
      bucketVelocity.copy(bucketOrigin).sub(previousBucketOrigin).multiplyScalar(1 / delta);
    } else {
      bucketVelocity.set(0, 0, 0);
    }
    previousBucketOrigin.copy(bucketOrigin);
    paintVelocity.set(
      wide ? (targetIndex % 2 ? -165 : 165) : -55,
      wide ? 65 + Math.sin(progress * Math.PI) * 85 : 15,
      wide ? -205 : -145
    );
    var config = {
      origin: bucketOrigin,
      velocity: paintVelocity,
      bucketVelocity: bucketVelocity,
      count: count
    };
    if (wide) particles.burst(config);
    else particles.emit(config);
  }

  function emitStream(rate, wide, progress, delta) {
    emissionCarry += rate * delta;
    var count = Math.floor(emissionCarry);
    if (count <= 0) return;
    emissionCarry -= count;
    emitPaint(count, wide, progress, delta);
  }

  function enterWalk(timestamp) {
    var target = waypoints[targetIndex];
    if (!target) {
      setState('portrait-rest', timestamp);
      return;
    }
    stateFrom.x = currentPoint.x;
    stateFrom.y = currentPoint.y;
    stateTo.x = target.x;
    stateTo.y = currentPoint.y;
    setState('walk', timestamp);
  }

  function advanceState(timestamp) {
    switch (state) {
      case 'entering': setState('bottom-paint', timestamp); break;
      case 'bottom-paint':
        if (guidanceEnabled || targetIsVisible(targetIndex)) enterWalk(timestamp);
        break;
      case 'walk': setState('coil-rope', timestamp); break;
      case 'coil-rope': setState('throw-rope', timestamp); break;
      case 'throw-rope': setState('brace', timestamp); break;
      case 'brace':
        stateFrom.x = currentPoint.x;
        stateFrom.y = currentPoint.y;
        stateTo.x = waypoints[targetIndex].x;
        stateTo.y = waypoints[targetIndex].y;
        setState('climb', timestamp);
        break;
      case 'climb': setState('pull-bucket', timestamp); break;
      case 'pull-bucket':
        if (rope) rope.hide();
        setState('paint-swing', timestamp);
        break;
      case 'paint-swing':
        if (targetIndex >= waypoints.length - 1) {
          setState('portrait-rest', timestamp);
        } else if (guidanceEnabled || targetIsVisible(targetIndex + 1)) {
          targetIndex += 1;
          enterWalk(timestamp);
        }
        break;
    }
  }

  function updateJourney(timestamp, delta) {
    var duration = DURATIONS[state] || 1;
    var progress = clamp((timestamp - stateStarted) / (duration * 1000), 0, 1);
    var eased = ease(progress);
    var target = waypoints[targetIndex] || waypoints[waypoints.length - 1];
    var facing = target && target.x < currentPoint.x ? -1 : 1;

    if (state === 'entering') {
      positionCharacter({ x: mix(stateFrom.x, stateTo.x, eased), y: mix(stateFrom.y, stateTo.y, eased) }, -1);
      character.setPose('walk', progress, timestamp * 0.008);
    } else if (state === 'bottom-paint') {
      positionCharacter(stateTo, -1);
      character.setPose('paint-swing', progress, timestamp * 0.003);
      if (progress < 1) emitStream(36, false, progress, delta);
      if (progress > 0.68 && progress < 1 && !paintBurstEmitted) {
        paintBurstEmitted = true;
        emitPaint(34, true, progress, delta);
      }
    } else if (state === 'walk') {
      positionCharacter({ x: mix(stateFrom.x, stateTo.x, eased), y: stateFrom.y }, facing);
      character.setPose('walk', progress, timestamp * 0.009);
    } else if (state === 'coil-rope') {
      positionCharacter(stateTo, facing);
      character.setPose('coil-rope', progress, timestamp * 0.006);
    } else if (state === 'throw-rope') {
      positionCharacter(stateTo, facing);
      character.setPose('throw-rope', progress, timestamp * 0.006);
      scene.updateMatrixWorld(true);
      if (!ropeThrown) {
        ropeThrown = true;
        character.throwingHand.getWorldPosition(ropeOrigin);
        scenePointFromDocument(target, ropeAnchor, 34);
        rope.throwBetween(ropeOrigin, ropeAnchor, DURATIONS['throw-rope'] * 0.88);
      }
    } else if (state === 'brace') {
      positionCharacter(stateTo, facing);
      character.setPose('brace', progress, timestamp * 0.004);
      updateRopeEndpoints(target);
    } else if (state === 'climb') {
      guideTowardTarget(target, delta);
      positionCharacter({ x: mix(stateFrom.x, stateTo.x, eased), y: mix(stateFrom.y, stateTo.y, eased) }, facing);
      character.setPose('climb', progress, timestamp * 0.007);
      updateRopeEndpoints(target);
    } else if (state === 'pull-bucket') {
      positionCharacter(stateTo, facing);
      character.setPose('pull-bucket', progress, timestamp * 0.004);
      updateRopeEndpoints(target);
    } else if (state === 'paint-swing') {
      positionCharacter(stateTo, facing);
      character.setPose('paint-swing', progress, timestamp * 0.003);
      if (progress < 1) emitStream(42, false, progress, delta);
      if (progress > 0.5 && progress < 1 && !paintBurstEmitted) {
        paintBurstEmitted = true;
        emitPaint(44, true, progress, delta);
      }
    } else if (state === 'portrait-rest') {
      positionCharacter(waypoints[waypoints.length - 1], 1);
      character.setPose('rest', 1, timestamp * 0.0015);
    } else if (state === 'cancelled-rest') {
      var settle = ease(clamp((timestamp - stateStarted) / 550, 0, 1));
      positionCharacter({ x: mix(stateFrom.x, cancelPoint.x, settle), y: mix(stateFrom.y, cancelPoint.y, settle) }, cancelPoint.x < stateFrom.x ? -1 : 1);
      character.setPose('rest', settle, timestamp * 0.0015);
    }

    character.update(delta);
    rope.update(delta);
    particles.update(delta);

    if (DURATIONS[state] && progress >= 1) advanceState(timestamp);
  }

  function finishLoop() {
    active = false;
    if (frameRequest) window.cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    removeRuntimeListeners();
  }

  function frame(timestamp) {
    frameRequest = 0;
    if (!active || !renderer) return;
    var delta = previousTimestamp ? Math.min(0.05, (timestamp - previousTimestamp) / 1000) : 0.016;
    previousTimestamp = timestamp;

    try {
      updateJourney(timestamp, delta);
      renderer.render(scene, camera);
    } catch (error) {
      failLive();
      return;
    }

    if (state === 'portrait-rest' && particles.activeCount === 0) {
      finishLoop();
      return;
    }
    if (state === 'cancelled-rest') {
      var cancelledFor = timestamp - stateStarted;
      if ((cancelledFor > 350 && particles.activeCount === 0) || cancelledFor > 1400) {
        finishLoop();
        return;
      }
    }
    frameRequest = window.requestAnimationFrame(frame);
  }

  function cancelJourney() {
    disableGuidance();
    if (particles) particles.clear();
    if (!character || state === 'portrait-rest' || state === 'cancelled-rest') return;
    if (rope) rope.hide();
    stateFrom.x = currentPoint.x;
    stateFrom.y = currentPoint.y;
    cancelPoint.x = Math.abs(currentPoint.x - laneX(0)) <= Math.abs(currentPoint.x - laneX(1)) ? laneX(0) : laneX(1);
    cancelPoint.y = currentPoint.y;
    setState('cancelled-rest', window.performance.now());
    if (!active) {
      active = true;
      frameRequest = window.requestAnimationFrame(frame);
    }
  }

  function removeRuntimeListeners() {
    detachInputListeners();
    window.removeEventListener('resize', scheduleLayout);
    window.removeEventListener('orientationchange', scheduleLayout);
    document.removeEventListener('toggle', scheduleLayout, true);
    if (layoutFrame) window.cancelAnimationFrame(layoutFrame);
    layoutFrame = 0;
  }

  function cleanupLiveLayer() {
    active = false;
    if (frameRequest) window.cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    removeRuntimeListeners();
    if (liveCanvas) liveCanvas.removeEventListener('webglcontextlost', handleContextLost);
    if (rope) rope.dispose();
    if (particles) particles.dispose();
    if (character) character.dispose();
    if (renderer) renderer.dispose();
    rope = null;
    particles = null;
    character = null;
    renderer = null;
    scene = null;
    camera = null;
    setLiveStage(false);
    if (liveCanvas && liveCanvas.parentNode) liveCanvas.parentNode.removeChild(liveCanvas);
  }

  function failLive() {
    if (failed) return;
    failed = true;
    if (bottomObserver) bottomObserver.disconnect();
    cleanupLiveLayer();
    requestFallback();
  }

  function handleContextLost(event) {
    event.preventDefault();
    failLive();
  }

  function initializeThree(module) {
    THREE = module;
    if (!THREE || !liveCanvas || !trail || typeof PaintJourney.createCharacter !== 'function' ||
        typeof PaintJourney.createRope !== 'function' || typeof PaintJourney.createParticles !== 'function') {
      throw new Error('Paint journey runtime is unavailable');
    }

    renderer = new THREE.WebGLRenderer({ canvas: liveCanvas, alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(0, window.innerWidth, window.innerHeight, 0, 0.1, 1000);
    camera.position.set(0, 0, 500);
    camera.lookAt(0, 0, 0);
    resizeRenderer();

    character = PaintJourney.createCharacter({ THREE: THREE, scene: scene });
    rope = PaintJourney.createRope({ THREE: THREE, scene: scene, segments: 20 });
    particles = PaintJourney.createParticles({
      THREE: THREE,
      scene: scene,
      trail: trail,
      mobile: window.innerWidth <= 520,
      capacity: window.innerWidth <= 520 ? 260 : 600,
      pagePlaneZ: 0,
      toDocument: particlesToDocument
    });
    ropeOrigin = new THREE.Vector3();
    ropeAnchor = new THREE.Vector3();
    bucketOrigin = new THREE.Vector3();
    previousBucketOrigin = new THREE.Vector3();
    bucketVelocity = new THREE.Vector3();
    paintVelocity = new THREE.Vector3();

    liveCanvas.addEventListener('webglcontextlost', handleContextLost, false);
    window.addEventListener('resize', scheduleLayout, { passive: true });
    window.addEventListener('orientationchange', scheduleLayout, { passive: true });
    document.addEventListener('toggle', scheduleLayout, true);
    attachInputListeners();
    computeWaypoints();
    if (waypoints.length !== LEVEL_ORDER.length + 1) throw new Error('Paint journey waypoints are incomplete');

    var start = waypoints[0];
    currentPoint.x = start.x + 180;
    currentPoint.y = start.y;
    stateFrom.x = currentPoint.x;
    stateFrom.y = currentPoint.y;
    stateTo.x = start.x;
    stateTo.y = start.y;
    targetIndex = 1;
    setLiveStage(true);
    setState('entering', window.performance.now());
    active = true;
    previousTimestamp = 0;
    frameRequest = window.requestAnimationFrame(frame);
  }

  function beginLoading() {
    if (state !== 'idle') return;
    if (bottomObserver) bottomObserver.disconnect();
    setState('loading', window.performance.now());
    import(THREE_URL).then(initializeThree).catch(failLive);
  }

  if (!stage || !liveCanvas || !trailCanvas) {
    requestFallback();
    return;
  }

  try {
    buildTrail();
  } catch (error) {
    requestFallback({ staticOnly: reducedMotion });
    return;
  }

  if (reducedMotion) {
    trail.drawStaticSpectrum(waypoints);
    requestFallback({ staticOnly: true });
    return;
  }

  if ('IntersectionObserver' in window) {
    bottomObserver = new window.IntersectionObserver(function (entries) {
      for (var index = 0; index < entries.length; index += 1) {
        if (entries[index].isIntersecting) {
          beginLoading();
          return;
        }
      }
    }, { rootMargin: '0px 0px 40% 0px', threshold: 0.05 });
    bottomObserver.observe(stage);
  } else {
    beginLoading();
  }
}(window, document));
