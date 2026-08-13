(function paintJourneyController(window, document) {
  'use strict';

  window.PaintJourneyControllerClaimed = true;

  var THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.min.js';
  var LEVEL_ORDER = ['thoughts', 'background', 'now', 'why-this-site', 'portrait'];
  var DURATIONS = {
    entering: 1.35,
    'bottom-paint': 2.35,
    'deploy-ladder': 1.05,
    'climb-ladder': 2.2,
    'retrieve-ladder': 0.85,
    'paint-swing': 1.75,
    vanish: 1.05
  };
  var PAINT_RATES = { lip: 10, commitment: 6 };
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
  var state = 'idle';
  window.PaintJourneyState = state;
  var stateStarted = 0;
  var previousTimestamp = 0;
  var hiddenAt = 0;
  var targetIndex = 1;
  var stateFrom = { x: 0, y: 0 };
  var stateTo = { x: 0, y: 0 };
  var currentPoint = { x: 0, y: 0 };
  var cancelPoint = { x: 0, y: 0 };
  var paintBurstEmitted = false;
  var emissionCarry = 0;
  var inputListenersAttached = false;
  var pausedUntilVisible = false;
  var landingId = '';
  var landingNeedsRebase = false;
  var landingPalettePhase = 0;
  var landingOrigin = { x: 0, y: 0 };
  var landingControl = { x: 0, y: 0 };
  var landingDestination = { x: 0, y: 0 };
  var landingSequence = 0;
  var connectorId = '';
  var connectorOrigin = { x: 0, y: 0 };
  var connectorControl = { x: 0, y: 0 };
  var connectorDestination = { x: 0, y: 0 };
  var paintHue = 0;
  var climbDuration = DURATIONS['climb-ladder'];
  var climbCycles = 2;
  var responsiveMobile = null;

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
  var liquidModel = null;
  var liquid = null;
  var staticContourDrawn = false;

  function setState(nextState, timestamp) {
    state = nextState;
    stateStarted = Number(timestamp) || window.performance.now();
    window.PaintJourneyState = state;
    if (stage) stage.setAttribute('data-journey-state', state);
    paintBurstEmitted = false;
    emissionCarry = 0;
    if (nextState === 'bottom-paint' || nextState === 'paint-swing') {
      landingId = '';
      landingNeedsRebase = false;
    }
    if (nextState === 'deploy-ladder') {
      connectorId = '';
    }
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

  function documentHeight() {
    var root = document.documentElement;
    var body = document.body;
    return Math.max(root.clientHeight || 0, root.scrollHeight, body ? body.scrollHeight : 0);
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
    var inset = window.innerWidth <= 520 ? 12 : 66;
    var silhouetteInset = window.innerWidth <= 520 ? 22 : 16;
    return documentWidth() - inset - silhouetteInset;
  }

  function portraitPoint(element, rect) {
    return {
      name: 'portrait',
      element: element,
      x: laneX(),
      y: rect.top + scrollY() + rect.height * 0.82
    };
  }

  function measureWaypoints() {
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
    return next;
  }

  function computeWaypoints() {
    waypoints = measureWaypoints();
    return waypoints;
  }

  function requestFallback(options) {
    var PaintFinale = window.PaintFinale = window.PaintFinale || {};
    options = options || {};
    if ((PaintFinale.pendingStart && PaintFinale.pendingStart.staticOnly) ||
        cancelledBeforeInitialization || state === 'cancelled-rest') {
      options.staticOnly = true;
    }
    if (typeof PaintFinale.startFallback === 'function') {
      PaintFinale.startFallback(options);
      return;
    }
    PaintFinale.pendingStart = options;
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
    trail = PaintJourney.createTrail({
      canvas: trailCanvas,
      getAnchors: measureWaypoints
    });
    computeWaypoints();
  }

  function drawStaticContourFallback() {
    if (staticContourDrawn || !trail) return false;
    trail.clear();
    trail.drawStaticSpectrum(waypoints);
    if (typeof trail.freeze === 'function') trail.freeze();
    staticContourDrawn = true;
    return true;
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

  function updateLiquidViewport() {
    if (!liquid) return;
    liquid.setViewport({
      width: Math.max(1, window.innerWidth),
      height: Math.max(1, window.innerHeight),
      scrollX: scrollX(),
      scrollY: scrollY(),
      documentWidth: documentWidth(),
      documentHeight: documentHeight()
    });
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
    updateLiquidViewport();
  }

  function isMobileViewport() {
    return window.innerWidth <= 520;
  }

  function responsiveLadderMetrics(mobile) {
    return mobile
      ? { width: 22, rungSpacing: 18, railRadius: 1.35, rungRadius: 0.95 }
      : { width: 28, rungSpacing: 21, railRadius: 1.8, rungRadius: 1.25 };
  }

  function applyResponsiveMetrics() {
    var mobile = isMobileViewport();
    if (responsiveMobile === mobile) return;
    responsiveMobile = mobile;
    if (ladder && typeof ladder.setMetrics === 'function') {
      ladder.setMetrics(responsiveLadderMetrics(mobile));
    }
    if (particles && typeof particles.setMobile === 'function') particles.setMobile(mobile);
    if (liquid && typeof liquid.setMobile === 'function') liquid.setMobile(mobile);
  }

  function recomputeLayout() {
    layoutFrame = 0;
    var layoutTimestamp = window.performance.now();
    var climbProgressBeforeLayout = state === 'climb-ladder'
      ? clamp((layoutTimestamp - stateStarted) / (climbDuration * 1000), 0, 1)
      : 0;
    var previousWaypoints = waypoints.slice();
    var oldTarget = previousWaypoints[targetIndex];
    var oldSource = previousWaypoints[Math.max(0, targetIndex - 1)];
    var oldBottom = previousWaypoints[0];
    computeWaypoints();
    resizeRenderer();
    applyResponsiveMetrics();
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
    if ((state === 'bottom-paint' || state === 'paint-swing') && landingId) {
      landingNeedsRebase = true;
    }
    if (connectorId && nextSource && oldSource) {
      connectorOrigin.x += nextSource.x - oldSource.x;
      connectorOrigin.y += nextSource.y - oldSource.y;
    }
    if (state === 'deploy-ladder' || state === 'climb-ladder') {
      configureClimbCadence(Math.abs(stateTo.y - stateFrom.y));
      if (state === 'climb-ladder') {
        stateStarted = layoutTimestamp - climbProgressBeforeLayout * climbDuration * 1000;
      }
    }
    if (state !== 'idle' && state !== 'loading' && state !== 'complete') resetBucketMotion();
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

  function handleVisibilityChange() {
    var now = window.performance.now();
    if (document.hidden) {
      hiddenAt = now;
      previousTimestamp = 0;
      return;
    }
    if (!hiddenAt) return;
    stateStarted += now - hiddenAt;
    hiddenAt = 0;
    previousTimestamp = 0;
  }

  function guideTowardTarget(target, delta) {
    if (!guidanceEnabled || !target) return;
    var maximumScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    var desired = clamp(target.y - window.innerHeight * 0.58, 0, maximumScroll);
    var current = scrollY();
    var step = Math.max(2, Math.min(Math.abs(desired - current), delta * 520));
    if (Math.abs(desired - current) < 1) return;
    window.scrollTo({ top: current + Math.sign(desired - current) * step, behavior: 'auto' });
  }

  function characterScale() {
    var baseScale = isMobileViewport() ? 0.44 : 0.68;
    var headReadabilityScale = isMobileViewport() ? 0.16 : 0.14;
    return baseScale + headReadabilityScale;
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
  }

  function configureLandingPath(documentPoint, canvasWidth, mobile, sequence) {
    var sweepDistance = canvasWidth * (mobile ? 0.82 : 0.86);
    var bend = (targetIndex % 2 === 0 ? -1 : 1) * (mobile ? 34 : 58);
    landingOrigin.x = documentPoint.x;
    landingOrigin.y = documentPoint.y;
    landingDestination.x = clamp(landingOrigin.x - sweepDistance, 28, canvasWidth - 28);
    landingDestination.y = clamp(documentPoint.y + bend, 28, documentHeight() - 28);
    landingControl.x = mix(landingOrigin.x, landingDestination.x, 0.46);
    landingControl.y = clamp(documentPoint.y - bend * 0.55 + ((sequence % 3) - 1) * 16,
      28, documentHeight() - 28);
  }

  function characterPourAmount(progress) {
    if (character && typeof character.getPourAmount === 'function') {
      return clamp(character.getPourAmount(), 0, 1);
    }
    return clamp((progress - 0.16) / 0.24, 0, 1) * clamp((0.92 - progress) / 0.1, 0, 1);
  }

  function activePigmentHue() {
    return landingId ? landingPalettePhase * 360 : paintHue;
  }

  function syncActivePigmentHue() {
    var hue = activePigmentHue();
    if (character && character.setPaintHue) character.setPaintHue(hue);
    if (particles) particles.setHue(hue);
  }

  function ensureLandingGesture(documentPoint) {
    if (!liquidModel) return '';
    var canvasWidth = documentWidth();
    var mobile = isMobileViewport();
    var landingIndex = state === 'bottom-paint' ? 0 : targetIndex;
    var waypoint = waypoints[landingIndex] || { name: 'bottom' };
    landingId = 'landing:' + waypoint.name;
    landingPalettePhase = (landingSequence * 0.157 + 0.61) % 1;
    configureLandingPath(documentPoint, canvasWidth, mobile, landingSequence);
    liquidModel.upsertGesture({
      id: landingId,
      from: { x: landingOrigin.x, y: landingOrigin.y },
      control: { x: landingControl.x, y: landingControl.y },
      to: { x: landingDestination.x, y: landingDestination.y },
      width: clamp(canvasWidth * 0.28, mobile ? 124 : 190, mobile ? 230 : 390),
      palettePhase: landingPalettePhase,
      seed: 19 + landingSequence * 37,
      reveal: 0,
      spread: 1,
      kind: 0
    });
    landingSequence += 1;
    return landingId;
  }

  function updateLandingLiquid(progress) {
    if (!liquid || !liquidModel || !bucketOrigin || !character) return;
    scene.updateMatrixWorld(true);
    character.paintSpout.getWorldPosition(bucketOrigin);
    var documentPoint = { x: 0, y: 0 };
    particlesToDocument(bucketOrigin, documentPoint);
    var pourAmount = characterPourAmount(progress);
    if (pourAmount <= 0.015) {
      liquid.setEmitter({ active: false, origin: documentPoint, front: documentPoint, pressure: 0,
        palettePhase: landingPalettePhase });
      return;
    }
    if (!landingId) ensureLandingGesture(documentPoint);
    syncActivePigmentHue();
    if (landingNeedsRebase && landingId) {
      configureLandingPath(documentPoint, documentWidth(), isMobileViewport(), landingSequence - 1);
      liquidModel.reflow(landingId, {
        from: { x: landingOrigin.x, y: landingOrigin.y },
        control: { x: landingControl.x, y: landingControl.y },
        to: { x: landingDestination.x, y: landingDestination.y },
        width: clamp(documentWidth() * 0.28, isMobileViewport() ? 124 : 190,
          isMobileViewport() ? 230 : 390)
      });
      landingNeedsRebase = false;
    }
    var gestureProgress = clamp((progress - 0.16) / 0.66, 0, 1);
    var causalReveal = ease(gestureProgress) * pourAmount;
    liquidModel.setReveal(landingId, causalReveal);
    liquid.setEmitter({
      active: pourAmount > 0.015,
      origin: documentPoint,
      front: {
        x: mix(landingOrigin.x, landingDestination.x, ease(gestureProgress)),
        y: mix(landingOrigin.y, landingDestination.y, ease(gestureProgress))
      },
      pressure: pourAmount,
      palettePhase: landingPalettePhase
    });
  }

  function updateClimbConnector(progress) {
    if (!liquidModel || !liquid || !character || !bucketOrigin || targetIndex <= 0) return;
    scene.updateMatrixWorld(true);
    character.paintSpout.getWorldPosition(bucketOrigin);
    var documentPoint = { x: 0, y: 0 };
    particlesToDocument(bucketOrigin, documentPoint);
    var source = waypoints[targetIndex - 1];
    var target = waypoints[targetIndex];
    if (!source || !target) return;
    if (!connectorId) {
      connectorId = 'connector:' + source.name + ':' + target.name;
      connectorOrigin.x = landingId ? landingOrigin.x : source.x;
      connectorOrigin.y = landingId ? landingOrigin.y : source.y;
      connectorControl.x = connectorOrigin.x - (isMobileViewport() ? 16 : 28);
      connectorControl.y = mix(connectorOrigin.y, target.y, 0.5);
      connectorDestination.x = documentPoint.x;
      connectorDestination.y = documentPoint.y;
      liquidModel.upsertGesture({
        id: connectorId,
        from: { x: connectorOrigin.x, y: connectorOrigin.y },
        control: { x: connectorControl.x, y: connectorControl.y },
        to: { x: connectorDestination.x, y: connectorDestination.y },
        width: isMobileViewport() ? 48 : 68,
        palettePhase: landingPalettePhase,
        seed: 71 + targetIndex * 29,
        reveal: clamp(progress, 0, 1),
        spread: 0.88,
        kind: 1
      });
    }
    connectorDestination.x = documentPoint.x;
    connectorDestination.y = documentPoint.y;
    connectorControl.x = mix(connectorOrigin.x, connectorDestination.x, 0.48) -
      (isMobileViewport() ? 14 : 24);
    connectorControl.y = mix(connectorOrigin.y, connectorDestination.y, 0.5);
    liquidModel.reflow(connectorId, {
      from: { x: connectorOrigin.x, y: connectorOrigin.y },
      control: { x: connectorControl.x, y: connectorControl.y },
      to: { x: connectorDestination.x, y: connectorDestination.y },
      width: isMobileViewport() ? 48 : 68
    });
    liquidModel.setReveal(connectorId, clamp(progress, 0, 1));
    liquid.setEmitter({ active: false, origin: documentPoint, front: documentPoint, pressure: 0,
      palettePhase: landingPalettePhase });
  }

  function updateLadderSpan(progress, anchor) {
    if (!ladder) return;
    scenePointFromDocument(stateFrom, ladderBottom, 23);
    scenePointFromDocument(stateTo, ladderTop, 23);
    var ladderReach = (window.innerWidth <= 520 ? 82 : 110);
    ladderBottom.y -= window.innerWidth <= 520 ? 7 : 10;
    ladderTop.y += ladderReach;
    ladder.setSpan(ladderBottom, ladderTop, {
      progress: progress,
      anchor: anchor || 'bottom'
    });
  }

  function emitPaint(count, wide, progress, delta) {
    scene.updateMatrixWorld(true);
    character.paintSpout.getWorldPosition(bucketOrigin);
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
      hue: activePigmentHue()
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

  function configureClimbCadence(distance) {
    var rungSpacing = isMobileViewport() ? 18 : 21;
    climbCycles = clamp(Math.round(Math.abs(distance) / (rungSpacing * 5)), 2, 9);
    climbDuration = clamp(climbCycles * 0.62, 1.8, 5.6);
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
    configureClimbCadence(Math.abs(stateTo.y - stateFrom.y));
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
    syncActivePigmentHue();

    if (state === 'entering') {
      positionCharacter({ x: mix(stateFrom.x, stateTo.x, eased), y: mix(stateFrom.y, stateTo.y, eased) });
      character.setPose('walk', progress, 0);
    } else if (state === 'bottom-paint') {
      positionCharacter(stateTo);
      character.setPose('paint-swing', progress, 1);
      updateLandingLiquid(progress);
      var bottomPourAmount = characterPourAmount(progress);
      if (bottomPourAmount > 0.04) emitStream(PAINT_RATES.lip, false, progress, delta);
      if (bottomPourAmount > 0.78 && !paintBurstEmitted) {
        paintBurstEmitted = true;
        emitPaint(PAINT_RATES.commitment, true, progress, delta);
      }
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
      updateClimbConnector(eased);
    } else if (state === 'retrieve-ladder') {
      positionCharacter(stateTo);
      character.setPose('retrieve-ladder', progress, timestamp * 0.004);
      updateLadderSpan(1 - eased, 'top');
    } else if (state === 'paint-swing') {
      positionCharacter(stateTo);
      character.setPose('paint-swing', progress, 0);
      updateLandingLiquid(progress);
      var swingPourAmount = characterPourAmount(progress);
      if (swingPourAmount > 0.04) emitStream(PAINT_RATES.lip, false, progress, delta);
      if (swingPourAmount > 0.78 && !paintBurstEmitted) {
        paintBurstEmitted = true;
        emitPaint(PAINT_RATES.commitment, true, progress, delta);
      }
    } else if (state === 'vanish') {
      positionCharacter({ x: mix(stateFrom.x, stateTo.x, eased), y: mix(stateFrom.y, stateTo.y, eased) });
      character.setPose('vanish', progress, 0);
      character.setOpacity(1 - eased);
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
    if (state === 'complete' || state === 'cancelled-rest') {
      if (trail && typeof trail.freeze === 'function') trail.freeze();
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
      updateLiquidViewport();
      liquid.update(delta, timestamp * 0.001);
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
      setState('cancelled-rest', window.performance.now());
      cleanupLiveLayer();
      discardTrailLayer();
      requestFallback({ staticOnly: true });
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
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('scroll', resumeIfTargetVisible);
    if (layoutFrame) window.cancelAnimationFrame(layoutFrame);
    layoutFrame = 0;
    hiddenAt = 0;
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
    if (liquid) liquid.dispose();
    if (renderer) renderer.dispose();
    ladder = null;
    particles = null;
    character = null;
    liquid = null;
    liquidModel = null;
    renderer = null;
    scene = null;
    camera = null;
    if (!options.preserveStage) setLiveStage(false);
    if (liveCanvas && liveCanvas.parentNode) liveCanvas.parentNode.removeChild(liveCanvas);
  }

  function discardTrailLayer() {
    if (trail && typeof trail.destroy === 'function') trail.destroy();
    trail = null;
    if (trailCanvas) {
      trailCanvas.width = 1;
      trailCanvas.height = 1;
      if (trailCanvas.parentNode) trailCanvas.parentNode.removeChild(trailCanvas);
    }
  }

  function failLive() {
    if (failed) return;
    failed = true;
    if (bottomObserver) bottomObserver.disconnect();
    cleanupLiveLayer();
    if (cancelledBeforeInitialization || state === 'cancelled-rest') {
      discardTrailLayer();
      requestFallback({ staticOnly: true });
      return;
    }
    drawStaticContourFallback();
    requestFallback({ staticOnly: true, paintOwnedByTrail: true });
  }

  function handleContextLost(event) {
    event.preventDefault();
    failLive();
  }

  function initializeThree(module) {
    if (cancelledBeforeInitialization || state === 'cancelled-rest') return;
    THREE = module;
    if (!THREE || !liveCanvas || !trail || typeof PaintJourney.createCharacter !== 'function' ||
        typeof PaintJourney.createLadder !== 'function' || typeof PaintJourney.createParticles !== 'function' ||
        typeof PaintJourney.createLiquidModel !== 'function' ||
        typeof PaintJourney.createLiquidField !== 'function') {
      throw new Error('Paint journey runtime is unavailable');
    }

    renderer = new THREE.WebGLRenderer({ canvas: liveCanvas, alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(0, window.innerWidth, window.innerHeight, 0, 0.1, 1000);
    camera.position.set(0, 0, 500);
    camera.lookAt(0, 0, 0);
    resizeRenderer();

    var mobile = isMobileViewport();
    liquidModel = PaintJourney.createLiquidModel({ maxGestures: 12 });
    liquid = PaintJourney.createLiquidField({
      THREE: THREE,
      renderer: renderer,
      scene: scene,
      model: liquidModel,
      mobile: mobile
    });
    updateLiquidViewport();

    character = PaintJourney.createCharacter({ THREE: THREE, scene: scene });
    var ladderMetrics = responsiveLadderMetrics(mobile);
    ladder = PaintJourney.createLadder({
      THREE: THREE,
      scene: scene,
      maxRungs: 128,
      width: ladderMetrics.width,
      rungSpacing: ladderMetrics.rungSpacing,
      railRadius: ladderMetrics.railRadius,
      rungRadius: ladderMetrics.rungRadius
    });
    particles = PaintJourney.createParticles({
      THREE: THREE,
      scene: scene,
      trail: trail,
      mobile: mobile,
      capacity: 600,
      pagePlaneZ: 0,
      toDocument: particlesToDocument
    });
    responsiveMobile = mobile;
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
    document.addEventListener('visibilitychange', handleVisibilityChange);
    if (document.hidden) hiddenAt = window.performance.now();
    computeWaypoints();
    if (waypoints.length !== LEVEL_ORDER.length + 1) throw new Error('Paint journey waypoints are incomplete');

    var start = waypoints[0];
    currentPoint.x = start.x + 96;
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
    setState('loading', window.performance.now());
    try {
      buildTrail();
    } catch (error) {
      requestFallback({ staticOnly: reducedMotion });
      return;
    }
    if (reducedMotion) {
      drawStaticContourFallback();
      requestFallback({ staticOnly: true, paintOwnedByTrail: true });
      setState('complete', window.performance.now());
      return;
    }
    attachInputListeners();
    var request = typeof PaintJourney.loadThree === 'function'
      ? PaintJourney.loadThree(THREE_URL)
      : import(THREE_URL);
    Promise.resolve(request).then(initializeThree).catch(failLive);
  }

  function watchForBottom() {
    if (state !== 'idle' || !bottomStageNear || !atDocumentBottom()) return;
    beginLoading();
  }

  if (!stage || !liveCanvas || !trailCanvas) {
    requestFallback();
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
