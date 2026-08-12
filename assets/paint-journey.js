(function paintJourneyController(window, document) {
  'use strict';

  window.PaintJourneyControllerClaimed = true;

  var THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.min.js';
  var LEVEL_ORDER = ['thoughts', 'background', 'now', 'why-this-site', 'portrait'];
  var DURATIONS = {
    entering: 0.72,
    'bottom-paint': 2.35,
    'deploy-ladder': 0.82,
    'climb-ladder': 2.2,
    'retrieve-ladder': 0.58,
    'paint-swing': 1.55,
    vanish: 1.05
  };
  var PAINT_RATES = { pour: 96, swing: 112, drip: 5 };
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
  var bottomStageNear = false;
  var layoutFrame = 0;
  var frameRequest = 0;
  var active = false;
  var failed = false;
  var cancelledBeforeInitialization = false;
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
  var paintBurstEmitted = false;
  var vanishBurstEmitted = false;
  var emissionCarry = 0;
  var flowCarry = 0;
  var inputListenersAttached = false;
  var pausedUntilVisible = false;
  var paintedLandingIndex = -1;
  var landingSequence = 0;
  var paintHue = 0;
  var climbDuration = DURATIONS['climb-ladder'];
  var climbCycles = 2;
  var previousFlowPoint = { x: 0, y: 0, ready: false };

  var THREE = null;
  var renderer = null;
  var camera = null;
  var scene = null;
  var character = null;
  var ladder = null;
  var particles = null;
  var ladderBottom = null;
  var ladderTop = null;
  var bucketOrigin = null;
  var previousBucketOrigin = null;
  var bucketVelocity = null;
  var paintVelocity = null;

  function setState(nextState, timestamp) {
    state = nextState;
    stateStarted = Number(timestamp) || window.performance.now();
    window.PaintJourneyState = state;
    if (stage) stage.setAttribute('data-journey-state', state);
    paintBurstEmitted = false;
    vanishBurstEmitted = false;
    emissionCarry = 0;
    flowCarry = 0;
    previousFlowPoint.ready = false;
    if (nextState === 'bottom-paint' || nextState === 'paint-swing') paintedLandingIndex = -1;
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

  function atDocumentBottom() {
    var root = document.documentElement;
    var body = document.body;
    var documentHeight = Math.max(root.scrollHeight, body ? body.scrollHeight : 0);
    var maximumScroll = Math.max(0, documentHeight - window.innerHeight);
    return maximumScroll - scrollY() <= 2;
  }

  function laneX() {
    var inset = window.innerWidth <= 520 ? 54 : 66;
    return documentWidth() - inset;
  }

  function portraitPoint(element, rect) {
    return {
      name: 'portrait',
      element: element,
      x: laneX(),
      y: rect.top + scrollY() + rect.height * 0.82
    };
  }

  function computeWaypoints() {
    if (!stage) return [];
    var stageRect = stage.getBoundingClientRect();
    var next = [{
      name: 'bottom',
      element: stage,
      x: laneX(),
      y: stageRect.top + scrollY() + stageRect.height - 18
    }];

    for (var index = 0; index < LEVEL_ORDER.length; index += 1) {
      var name = LEVEL_ORDER[index];
      var element = document.querySelector('[data-journey-level="' + name + '"]');
      if (!element) continue;
      var rect = element.getBoundingClientRect();
      if (name === 'portrait') {
        next.push(portraitPoint(element, rect));
        continue;
      }
      next.push({
        name: name,
        element: element,
        x: laneX(),
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
    if (stage) stage.classList.toggle('is-live', isLive);
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
    var previousWaypoints = waypoints.slice();
    var oldTarget = previousWaypoints[targetIndex];
    var oldSource = previousWaypoints[Math.max(0, targetIndex - 1)];
    var oldBottom = previousWaypoints[0];
    computeWaypoints();
    resizeRenderer();
    var nextTarget = waypoints[targetIndex];
    var nextSource = waypoints[Math.max(0, targetIndex - 1)];
    var nextBottom = waypoints[0];
    if (nextTarget && oldTarget && nextSource && oldSource) {
      var laneDeltaX = nextTarget.x - oldTarget.x;
      var sourceDeltaY = nextSource.y - oldSource.y;
      var targetDeltaY = nextTarget.y - oldTarget.y;

      if (state !== 'idle' && state !== 'loading' && state !== 'complete') {
        currentPoint.x += laneDeltaX;
        stateFrom.x += laneDeltaX;
        stateTo.x += laneDeltaX;
      }

      if (state === 'entering' || state === 'bottom-paint') {
        var bottomDeltaY = nextBottom && oldBottom ? nextBottom.y - oldBottom.y : 0;
        currentPoint.y += bottomDeltaY;
        stateFrom.y += bottomDeltaY;
        stateTo.y += bottomDeltaY;
      } else if (state === 'await-target') {
        currentPoint.y += sourceDeltaY;
      } else if (state === 'deploy-ladder' || state === 'climb-ladder') {
        var oldSpan = oldTarget.y - oldSource.y;
        var pathProgress = Math.abs(oldSpan) > 0.001
          ? clamp((currentPoint.y - oldSource.y) / oldSpan, 0, 1)
          : 0;
        currentPoint.y = mix(nextSource.y, nextTarget.y, pathProgress);
        stateFrom.y += sourceDeltaY;
        stateTo.y += targetDeltaY;
      } else if (state === 'retrieve-ladder' || state === 'paint-swing') {
        currentPoint.y += targetDeltaY;
        stateFrom.y += sourceDeltaY;
        stateTo.y += targetDeltaY;
      } else if (state === 'vanish') {
        currentPoint.y += targetDeltaY;
        stateFrom.y += targetDeltaY;
        stateTo.y += targetDeltaY;
      }
    }
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

  function resumeIfTargetVisible() {
    if (!pausedUntilVisible || !targetIsVisible(targetIndex)) return;
    pausedUntilVisible = false;
    window.removeEventListener('scroll', resumeIfTargetVisible);
    if (!active && renderer) {
      enterDeploy(window.performance.now());
      active = true;
      previousTimestamp = 0;
      frameRequest = window.requestAnimationFrame(frame);
    }
  }

  function pauseUntilTargetVisible() {
    if (pausedUntilVisible || guidanceEnabled || targetIsVisible(targetIndex)) return false;
    if (particles && particles.activeCount > 0) return false;
    pausedUntilVisible = true;
    active = false;
    frameRequest = 0;
    window.addEventListener('scroll', resumeIfTargetVisible, { passive: true });
    return true;
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
    return window.innerWidth <= 520 ? 0.5 : 0.68;
  }

  function positionCharacter(point) {
    currentPoint.x = point.x;
    currentPoint.y = point.y;
    character.setScreenPose({
      x: point.x - scrollX(),
      y: window.innerHeight - (point.y - scrollY()),
      scale: characterScale(),
      facing: -1,
      depth: 32
    });
  }

  function resetBucketMotion() {
    if (previousBucketOrigin) previousBucketOrigin.set(0, 0, 0);
    if (bucketVelocity) bucketVelocity.set(0, 0, 0);
    previousFlowPoint.ready = false;
  }

  function landingPaint(progress) {
    if (!trail || !bucketOrigin || !character || progress < 0.26 || paintedLandingIndex === targetIndex) return;
    scene.updateMatrixWorld(true);
    character.bucketLip.getWorldPosition(bucketOrigin);
    var documentPoint = { x: 0, y: 0 };
    particlesToDocument(bucketOrigin, documentPoint);
    var canvasWidth = documentWidth();
    var mobile = window.innerWidth <= 520;
    var landingMode = landingSequence % 3;
    var sweepDistance = canvasWidth * ((mobile ? 0.62 : 0.72) + landingMode * 0.07);
    var sweepY = documentPoint.y + (targetIndex % 2 === 0 ? -1 : 1) * (mobile ? 42 : 68) * (0.8 + landingMode * 0.18);
    var landingHue = (paintHue + landingSequence * 83) % 360;
    var scaleVariation = 0.88 + (landingSequence % 3) * 0.07;
    trail.impact({
      x: clamp(documentPoint.x - (mobile ? 12 : 22) - landingMode * (mobile ? 8 : 16), 22, canvasWidth - 22),
      y: documentPoint.y + (mobile ? 12 : 18) + (landingMode - 1) * (mobile ? 5 : 9),
      hue: landingHue,
      radius: (mobile ? 42 : 60) * scaleVariation,
      direction: -1
    });
    trail.veil({
      from: { x: documentPoint.x - 6, y: documentPoint.y + 4 },
      to: {
        x: clamp(documentPoint.x - sweepDistance, 28, canvasWidth - 28),
        y: clamp(sweepY, 28, document.documentElement.scrollHeight - 28)
      },
      hue: landingHue + 38,
      width: (mobile ? 82 : 130) * scaleVariation,
      alpha: mobile ? 0.12 : 0.15
    });
    if (landingMode === 1) {
      trail.spray({
        x: clamp(documentPoint.x - (mobile ? 76 : 142), 28, canvasWidth - 28),
        y: documentPoint.y + (targetIndex % 2 ? 22 : -18),
        hue: landingHue + 128,
        radius: mobile ? 76 : 126,
        count: mobile ? 24 : 36
      });
    } else {
      trail.whorl({
        x: clamp(documentPoint.x - (mobile ? 44 : 82) - landingMode * (mobile ? 10 : 22), 28, canvasWidth - 28),
        y: documentPoint.y + (targetIndex % 2 ? 18 : -10) + landingMode * (mobile ? 8 : 12),
        hue: landingHue + 126,
        radius: (mobile ? 30 : 43) * scaleVariation,
        turns: landingMode === 2 ? 1.16 : 0.76,
        width: mobile ? 5 : 7,
        direction: landingMode === 2 ? 1 : -1,
        progress: 1
      });
    }
    landingSequence += 1;
    paintedLandingIndex = targetIndex;
  }

  function updateLadderSpan(progress, anchor) {
    if (!ladder) return;
    scenePointFromDocument(stateFrom, ladderBottom, 23);
    scenePointFromDocument(stateTo, ladderTop, 23);
    var ladderReach = (window.innerWidth <= 520 ? 48 : 66);
    ladderBottom.y -= window.innerWidth <= 520 ? 7 : 10;
    ladderTop.y += ladderReach;
    ladder.setSpan(ladderBottom, ladderTop, {
      progress: progress,
      anchor: anchor || 'bottom'
    });
  }

  function emitPaint(count, wide, progress, delta) {
    scene.updateMatrixWorld(true);
    character.bucketLip.getWorldPosition(bucketOrigin);
    if (previousBucketOrigin.lengthSq() > 0 && delta > 0) {
      bucketVelocity.copy(bucketOrigin).sub(previousBucketOrigin).multiplyScalar(1 / delta);
      var bucketSpeed = bucketVelocity.length();
      if (bucketSpeed > 280) bucketVelocity.multiplyScalar(280 / bucketSpeed);
    } else {
      bucketVelocity.set(0, 0, 0);
    }
    previousBucketOrigin.copy(bucketOrigin);
    paintVelocity.set(
      wide ? -190 : -62,
      wide ? 65 + Math.sin(progress * Math.PI) * 85 : 15,
      wide ? -205 : -145
    );
    var config = {
      origin: bucketOrigin,
      velocity: paintVelocity,
      bucketVelocity: bucketVelocity,
      count: count,
      hue: paintHue
    };
    if (wide) particles.burst(config);
    else particles.emit(config);

    flowCarry += delta;
    if (flowCarry >= (window.innerWidth <= 520 ? 0.13 : 0.09)) {
      var documentPoint = { x: 0, y: 0 };
      particlesToDocument(bucketOrigin, documentPoint);
      if (previousFlowPoint.ready) {
        trail.ribbon({
          from: { x: previousFlowPoint.x, y: previousFlowPoint.y },
          to: { x: documentPoint.x - (wide ? 24 : 8), y: documentPoint.y + (wide ? 18 : 8) },
          hue: paintHue,
          width: wide ? (window.innerWidth <= 520 ? 10 : 15) : (window.innerWidth <= 520 ? 5 : 8),
          alpha: wide ? 0.48 : 0.34
        });
      }
      previousFlowPoint.x = documentPoint.x;
      previousFlowPoint.y = documentPoint.y;
      previousFlowPoint.ready = true;
      flowCarry = 0;
    }
  }

  function emitStream(rate, wide, progress, delta) {
    emissionCarry += rate * delta;
    var count = Math.floor(emissionCarry);
    if (count <= 0) return;
    emissionCarry -= count;
    emitPaint(count, wide, progress, delta);
  }

  function enterDeploy(timestamp) {
    var target = waypoints[targetIndex];
    if (!target) {
      setState('vanish', timestamp);
      return;
    }
    stateFrom.x = currentPoint.x;
    stateFrom.y = currentPoint.y;
    stateTo.x = target.x;
    stateTo.y = target.y;
    climbDuration = clamp(Math.abs(stateTo.y - stateFrom.y) / 150, 1.45, 3.15);
    var rungSpacing = window.innerWidth <= 520 ? 18 : 21;
    climbCycles = clamp(Math.round(Math.abs(stateTo.y - stateFrom.y) / (rungSpacing * 2)), 2, 6);
    resetBucketMotion();
    setState('deploy-ladder', timestamp);
  }

  function awaitTarget(timestamp) {
    setState('await-target', timestamp);
  }

  function enterVanish(timestamp) {
    stateFrom.x = currentPoint.x;
    stateFrom.y = currentPoint.y;
    stateTo.x = currentPoint.x;
    stateTo.y = currentPoint.y - (window.innerWidth <= 520 ? 24 : 38);
    setState('vanish', timestamp);
  }

  function advanceState(timestamp) {
    switch (state) {
      case 'entering':
        resetBucketMotion();
        setState('bottom-paint', timestamp);
        break;
      case 'bottom-paint':
        if (guidanceEnabled || targetIsVisible(targetIndex)) enterDeploy(timestamp);
        else awaitTarget(timestamp);
        break;
      case 'deploy-ladder':
        setState('climb-ladder', timestamp);
        break;
      case 'climb-ladder':
        setState('retrieve-ladder', timestamp);
        break;
      case 'retrieve-ladder':
        if (ladder) ladder.hide();
        resetBucketMotion();
        setState('paint-swing', timestamp);
        break;
      case 'paint-swing':
        if (targetIndex >= waypoints.length - 1) {
          enterVanish(timestamp);
        } else {
          targetIndex += 1;
          if (guidanceEnabled || targetIsVisible(targetIndex)) enterDeploy(timestamp);
          else awaitTarget(timestamp);
        }
        break;
      case 'vanish':
        if (character) character.setOpacity(0);
        if (ladder) ladder.hide();
        setState('complete', timestamp);
        break;
    }
  }

  function updateJourney(timestamp, delta) {
    var frameState = state;
    var duration = state === 'climb-ladder' ? climbDuration : (DURATIONS[state] || 1);
    var progress = clamp((timestamp - stateStarted) / (duration * 1000), 0, 1);
    var eased = ease(progress);
    var target = waypoints[targetIndex] || waypoints[waypoints.length - 1];

    paintHue = (paintHue + delta * 76) % 360;
    if (character && character.setPaintHue) character.setPaintHue(paintHue);
    if (particles) particles.setHue(paintHue);

    if (state === 'entering') {
      positionCharacter({ x: mix(stateFrom.x, stateTo.x, eased), y: mix(stateFrom.y, stateTo.y, eased) });
      character.setPose('walk', progress, timestamp * 0.008);
    } else if (state === 'bottom-paint') {
      positionCharacter(stateTo);
      character.setPose('paint-swing', progress, timestamp * 0.003);
      if (progress < 1) emitStream(PAINT_RATES.pour, false, progress, delta);
      if (progress > 0.68 && progress < 1 && !paintBurstEmitted) {
        paintBurstEmitted = true;
        emitPaint(window.innerWidth <= 520 ? 44 : 72, true, progress, delta);
      }
      landingPaint(progress);
    } else if (state === 'await-target') {
      positionCharacter(currentPoint);
      character.setPose('rest', 1, timestamp * 0.0015);
      if (targetIsVisible(targetIndex)) enterDeploy(timestamp);
    } else if (state === 'deploy-ladder') {
      positionCharacter(stateFrom);
      character.setPose('deploy-ladder', progress, timestamp * 0.004);
      updateLadderSpan(eased, 'bottom');
    } else if (state === 'climb-ladder') {
      guideTowardTarget(target, delta);
      updateLadderSpan(1, 'bottom');
      positionCharacter({ x: mix(stateFrom.x, stateTo.x, eased), y: mix(stateFrom.y, stateTo.y, eased) });
      character.setPose('climb-ladder', progress, climbCycles);
      if (progress > 0.08 && progress < 0.94) emitStream(PAINT_RATES.drip, false, progress, delta);
    } else if (state === 'retrieve-ladder') {
      positionCharacter(stateTo);
      character.setPose('retrieve-ladder', progress, timestamp * 0.004);
      updateLadderSpan(1 - eased, 'top');
    } else if (state === 'paint-swing') {
      positionCharacter(stateTo);
      character.setPose('paint-swing', progress, timestamp * 0.003);
      if (progress < 1) emitStream(PAINT_RATES.swing, false, progress, delta);
      if (progress > 0.5 && progress < 1 && !paintBurstEmitted) {
        paintBurstEmitted = true;
        emitPaint(window.innerWidth <= 520 ? 52 : 78, true, progress, delta);
      }
      landingPaint(progress);
    } else if (state === 'vanish') {
      positionCharacter({ x: mix(stateFrom.x, stateTo.x, eased), y: mix(stateFrom.y, stateTo.y, eased) });
      character.setPose('rest', 1, timestamp * 0.0015);
      character.setOpacity(1 - eased);
      if (progress > 0.16 && !vanishBurstEmitted) {
        vanishBurstEmitted = true;
        emitPaint(window.innerWidth <= 520 ? 24 : 40, true, progress, delta);
      }
    } else if (state === 'complete') {
      character.setOpacity(0);
      if (ladder) ladder.hide();
    } else if (state === 'cancelled-rest') {
      var settle = ease(clamp((timestamp - stateStarted) / 550, 0, 1));
      positionCharacter({ x: mix(stateFrom.x, cancelPoint.x, settle), y: mix(stateFrom.y, cancelPoint.y, settle) });
      character.setPose('rest', settle, timestamp * 0.0015);
    }

    character.update(delta);
    particles.update(delta);

    if (state === frameState && DURATIONS[state] && progress >= 1) advanceState(timestamp);
    if (state === 'await-target') pauseUntilTargetVisible();
  }

  function finishLoop() {
    if (state === 'complete') {
      cleanupLiveLayer({ preserveStage: true });
      return;
    }
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

    if (!active) return;
    if (state === 'complete' && particles.activeCount === 0) {
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
    if (!character) {
      cancelledBeforeInitialization = true;
      if (bottomObserver) bottomObserver.disconnect();
      detachInputListeners();
      setState('cancelled-rest', window.performance.now());
      requestFallback();
      return;
    }
    if (!character || state === 'complete' || state === 'cancelled-rest') return;
    if (ladder) ladder.hide();
    stateFrom.x = currentPoint.x;
    stateFrom.y = currentPoint.y;
    cancelPoint.x = laneX();
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
    window.removeEventListener('scroll', resumeIfTargetVisible);
    if (layoutFrame) window.cancelAnimationFrame(layoutFrame);
    layoutFrame = 0;
  }

  function cleanupLiveLayer(options) {
    options = options || {};
    active = false;
    if (frameRequest) window.cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    removeRuntimeListeners();
    if (liveCanvas) liveCanvas.removeEventListener('webglcontextlost', handleContextLost);
    if (ladder) ladder.dispose();
    if (particles) particles.dispose();
    if (character) character.dispose();
    if (renderer) renderer.dispose();
    ladder = null;
    particles = null;
    character = null;
    renderer = null;
    scene = null;
    camera = null;
    if (!options.preserveStage) setLiveStage(false);
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
    if (cancelledBeforeInitialization || state === 'cancelled-rest') return;
    THREE = module;
    if (!THREE || !liveCanvas || !trail || typeof PaintJourney.createCharacter !== 'function' ||
        typeof PaintJourney.createLadder !== 'function' || typeof PaintJourney.createParticles !== 'function') {
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
    ladder = PaintJourney.createLadder({
      THREE: THREE,
      scene: scene,
      maxRungs: window.innerWidth <= 520 ? 24 : 36,
      width: window.innerWidth <= 520 ? 22 : 28,
      rungSpacing: window.innerWidth <= 520 ? 18 : 21,
      railRadius: window.innerWidth <= 520 ? 1.35 : 1.8,
      rungRadius: window.innerWidth <= 520 ? 0.95 : 1.25
    });
    particles = PaintJourney.createParticles({
      THREE: THREE,
      scene: scene,
      trail: trail,
      mobile: window.innerWidth <= 520,
      capacity: window.innerWidth <= 520 ? 260 : 600,
      pagePlaneZ: 0,
      toDocument: particlesToDocument
    });
    ladderBottom = new THREE.Vector3();
    ladderTop = new THREE.Vector3();
    bucketOrigin = new THREE.Vector3();
    previousBucketOrigin = new THREE.Vector3();
    bucketVelocity = new THREE.Vector3();
    paintVelocity = new THREE.Vector3();

    liveCanvas.addEventListener('webglcontextlost', handleContextLost, false);
    window.addEventListener('resize', scheduleLayout, { passive: true });
    window.addEventListener('orientationchange', scheduleLayout, { passive: true });
    document.addEventListener('toggle', scheduleLayout, true);
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
    window.removeEventListener('scroll', watchForBottom);
    window.removeEventListener('resize', watchForBottom);
    attachInputListeners();
    setState('loading', window.performance.now());
    import(THREE_URL).then(initializeThree).catch(failLive);
  }

  function watchForBottom() {
    if (state !== 'idle' || !bottomStageNear || !atDocumentBottom()) return;
    beginLoading();
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
      bottomStageNear = false;
      for (var index = 0; index < entries.length; index += 1) {
        if (entries[index].isIntersecting) {
          bottomStageNear = true;
          break;
        }
      }
      watchForBottom();
    }, { rootMargin: '0px', threshold: 0.05 });
    bottomObserver.observe(stage);
  } else {
    bottomStageNear = true;
  }
  window.addEventListener('scroll', watchForBottom, { passive: true });
  window.addEventListener('resize', watchForBottom, { passive: true });
  watchForBottom();
}(window, document));
