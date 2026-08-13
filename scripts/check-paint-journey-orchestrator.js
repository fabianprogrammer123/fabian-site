#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/paint-journey.js'), 'utf8');

function requirePattern(pattern, message) {
  assert.match(source, pattern, message);
}

requirePattern(/entering:\s*1\.35/,
  'the opening walk must use a readable human pace');
requirePattern(/currentPoint\.x\s*=\s*start\.x\s*\+\s*96/,
  'the opening walk distance must stay proportionate to the compact figure');
requirePattern(/setPose\('walk',\s*progress,\s*0\)/,
  'the character rig must own one deliberate gait clock instead of double-counting walk progress');

requirePattern(/function\s+portraitPoint\s*\(/,
  'portrait must use a dedicated element-derived waypoint');
requirePattern(/previousBucketOrigin\.set\(0,\s*0,\s*0\)/,
  'each new paint phase must reset bucket velocity history');
requirePattern(/character\.paintSpout\.getWorldPosition\(bucketOrigin\)/,
  'paint particles and marks must originate at the bucket pouring edge');
assert.doesNotMatch(source, /character\.bucketLip\.getWorldPosition\(bucketOrigin\)/,
  'paint must not originate from the centre of the bucket rim');
requirePattern(/character\.setPose\('paint-swing',\s*progress,\s*0\)/,
  'paint swings must use deterministic state-local timing');
requirePattern(/state\s*===\s*'bottom-paint'[\s\S]{0,180}character\.setPose\('paint-swing',\s*progress,\s*1\)/,
  'the first bucket swing must blend from the walking pose');
requirePattern(/cancelledBeforeInitialization/,
  'Escape must cancel a journey while Three.js is still loading');
requirePattern(/if\s*\(!character\)[\s\S]{0,380}disposeLiveLayer\(\)[\s\S]{0,180}discardTrailLayer\(\)/,
  'cancelling during Three.js loading must remove both empty rendering layers');
requirePattern(/PaintFinale\.pendingStart[\s\S]{0,220}staticOnly/,
  'a late load failure must not downgrade an already-static cancellation fallback');
requirePattern(/function\s+finishLoop\s*\([^)]*\)\s*\{[\s\S]{0,500}state\s*===\s*'cancelled-rest'[\s\S]{0,260}disposeLiveLayer\(\{\s*preserveStage:\s*true\s*\}\)/,
  'a cancelled journey must dispose its WebGL layer after the resting pose');
requirePattern(/function\s+finishLoop\s*\([^)]*\)\s*\{[\s\S]{0,420}trail\.freeze\(\)/,
  'completed or cancelled journeys must stop persistent trail maintenance');
requirePattern(/function\s+drawStaticContourFallback\s*\([^)]*\)\s*\{[\s\S]{0,420}trail\.clear\(\)[\s\S]{0,220}trail\.drawStaticSpectrum\(waypoints\)[\s\S]{0,180}trail\.freeze\(\)/,
  'one idempotent fallback helper must clear residue, draw the contour field, and freeze it');
requirePattern(/function\s+failLive\s*\([^)]*\)\s*\{[\s\S]{0,520}drawStaticContourFallback\(\)[\s\S]{0,180}paintOwnedByTrail:\s*true/,
  'a failed WebGL journey must replace residue with the full-page static contour field');
requirePattern(/function\s+beginLoading[\s\S]{0,1100}if\s*\(reducedMotion\)[\s\S]{0,260}drawStaticContourFallback\(\)[\s\S]{0,180}paintOwnedByTrail:\s*true/,
  'reduced-motion artwork must use the shared contour helper inside the bottom-trigger path');
requirePattern(/function\s+handleVisibilityChange\s*\([^)]*\)\s*\{[\s\S]{0,700}stateStarted\s*\+=\s*now\s*-\s*hiddenAt/,
  'returning to a hidden tab must preserve the current animation phase');
requirePattern(/document\.addEventListener\('visibilitychange',\s*handleVisibilityChange\)/,
  'the live journey must monitor page visibility');
requirePattern(/document\.removeEventListener\('visibilitychange',\s*handleVisibilityChange\)/,
  'live cleanup must remove the page visibility listener');
requirePattern(/function\s+atDocumentBottom\s*\([^)]*\)[\s\S]{0,500}maximumScroll[\s\S]{0,300}<=\s*2/,
  'the live journey must wait until the visitor is truly at the document bottom');
requirePattern(/addEventListener\('scroll',\s*watchForBottom/,
  'the bottom trigger must keep watching after the finale first enters the viewport');
requirePattern(/rootMargin:\s*'0px'/,
  'the finale observer must not expand its viewport trigger area');
assert.doesNotMatch(source, /rootMargin:\s*'0px 0px 40% 0px'/,
  'a positive bottom observer margin starts the finale before the visitor reaches the bottom');
requirePattern(/function\s+pauseUntilTargetVisible\s*\(/,
  'manual guidance cancellation must pause an offscreen journey');
requirePattern(/function\s+pauseUntilTargetVisible\s*\([^)]*\)\s*\{[\s\S]{0,500}activeCount/,
  'offscreen pausing must let airborne paint drain before stopping the renderer');
requirePattern(/function\s+resumeIfTargetVisible\s*\(/,
  'a paused journey must resume when its next waypoint becomes visible');
requirePattern(/function\s+laneX\s*\([^)]*\)[\s\S]{0,220}return\s+documentWidth\(\)\s*-\s*inset/,
  'every waypoint must stay on one right-side lane');
requirePattern(/var\s+inset\s*=\s*window\.innerWidth\s*<=\s*520\s*\?\s*12\s*:\s*66/,
  'the mobile figure must stay tight to the outside edge');
requirePattern(/function\s+characterScale\s*\([^)]*\)[\s\S]{0,120}\?\s*0\.44\s*:\s*0\.68/,
  'the mobile figure must remain compact beside the content');
requirePattern(/currentPoint\.x\s*\+=\s*laneDeltaX[\s\S]{0,220}stateFrom\.x\s*\+=\s*laneDeltaX[\s\S]{0,220}stateTo\.x\s*\+=\s*laneDeltaX/,
  'a responsive resize must keep the active character and ladder on the right-side lane');
requirePattern(/function\s+applyResponsiveMetrics\s*\([^)]*\)[\s\S]{0,500}ladder\.setMetrics[\s\S]{0,300}particles\.setMobile[\s\S]{0,220}liquid\.setMobile/,
  'a breakpoint-crossing resize must update the ladder, particles, and bounded liquid target');
requirePattern(/capacity:\s*600/,
  'a mobile-started journey must retain capacity to expand safely onto desktop');
requirePattern(/sourceDeltaY[\s\S]{0,900}targetDeltaY/,
  'responsive layout changes must track source and target heights independently');
requirePattern(/landingNeedsRebase\s*=\s*true/,
  'an active bucket gesture must rebase its remaining path after responsive layout changes');
requirePattern(/landingNeedsRebase[\s\S]{0,500}liquidModel\.reflow\(landingId,/,
  'a responsive landing reflow must update its stable gesture without duplicating paint');
requirePattern(/function\s+recomputeLayout\s*\([^)]*\)[\s\S]{0,3000}resetBucketMotion\(\)/,
  'responsive reflow must clear stale bucket velocity and ribbon history');
requirePattern(/getAnchors:\s*measureWaypoints/,
  'trail reflow must read semantic anchors without mutating live orchestrator waypoints');
assert.doesNotMatch(source, /getAnchors:\s*function\s*\([^)]*\)\s*\{\s*return\s+computeWaypoints\(\)/,
  'trail resize must not erase the old live layout before the character can rebase');
requirePattern(/createLadder/,
  'the live journey must construct a 3D ladder');
requirePattern(/ladderReach\s*=\s*\(window\.innerWidth\s*<=\s*520\s*\?\s*82\s*:\s*110\)/,
  'the ladder rails must extend beyond the climbing hands');
requirePattern(/climbCycles\s*=\s*clamp\([\s\S]{0,220}rungSpacing\s*\*\s*5[\s\S]{0,120},\s*2,\s*9\)/,
  'climb cadence must stay measured even across long ladder spans');
requirePattern(/climbDuration\s*=\s*clamp\(climbCycles\s*\*\s*0\.62,\s*1\.8,\s*5\.6\)/,
  'climb duration must grow with the number of deliberate rung contacts');
requirePattern(/character\.setPose\('climb-ladder',\s*progress,\s*climbCycles\)/,
  'climbing limbs must use a steady raw clock while root travel eases spatially');
requirePattern(/var\s+climbProgressBeforeLayout[\s\S]{0,5000}stateStarted\s*=\s*layoutTimestamp\s*-\s*climbProgressBeforeLayout\s*\*\s*climbDuration\s*\*\s*1000/,
  'a responsive cadence reflow must preserve normalized climb time instead of snapping the figure');
requirePattern(/deploy-ladder[\s\S]{0,1200}climb-ladder[\s\S]{0,1200}retrieve-ladder/,
  'the state machine must deploy, climb, and retrieve the ladder');
requirePattern(/climbCycles\s*=\s*clamp\([\s\S]{0,180}rungSpacing/,
  'climb cadence must derive from the climb distance and ladder rung spacing');
requirePattern(/state === 'vanish'[\s\S]{0,1200}setOpacity\(1\s*-\s*eased\)/,
  'the figure must fade out after reaching the top');
requirePattern(/state\s*===\s*'vanish'[\s\S]{0,360}character\.setPose\('vanish',\s*progress,\s*0\)/,
  'the final figure pose must settle continuously while fading');
requirePattern(/setState\('complete'/,
  'the top disappearance must end in a complete state');
requirePattern(/liquidModel\s*=\s*PaintJourney\.createLiquidModel\(\{\s*maxGestures:\s*12\s*\}\)/,
  'the live runtime must construct one bounded document-space liquid model');
requirePattern(/liquid\s*=\s*PaintJourney\.createLiquidField\(\{[\s\S]{0,300}model:\s*liquidModel[\s\S]{0,160}mobile:\s*mobile/,
  'the live runtime must bind one liquid field to the shared Three.js scene');
requirePattern(/function\s+ensureLandingGesture\s*\(/,
  'each semantic landing must be represented by one stable liquid gesture');
requirePattern(/landingIndex\s*=\s*state\s*===\s*'bottom-paint'\s*\?\s*0\s*:\s*targetIndex/,
  'the opening bottom pour and the first upper landing must keep distinct stable gesture IDs');
requirePattern(/id:\s*landingId[\s\S]{0,260}from:\s*\{\s*x:\s*landingOrigin\.x,\s*y:\s*landingOrigin\.y\s*\}[\s\S]{0,220}control:\s*\{\s*x:\s*landingControl\.x,\s*y:\s*landingControl\.y\s*\}[\s\S]{0,220}to:\s*\{\s*x:\s*landingDestination\.x,\s*y:\s*landingDestination\.y\s*\}/,
  'a landing must be one broad quadratic from the captured bucket spout');
requirePattern(/function\s+updateClimbConnector\s*\(/,
  'each climb must grow one stable connector from the bucket lane');
requirePattern(/['"]connector:['"]/,
  'climb gesture IDs must be semantic and stable');
requirePattern(/liquidModel\.reflow\(connectorId,/,
  'a climb connector must update geometry in place instead of adding segments');
requirePattern(/typeof\s+character\.getPourAmount\s*===\s*['"]function['"][\s\S]{0,160}character\.getPourAmount\(\)/,
  'liquid reveal must use the character bucket tilt when that causal API is available');
requirePattern(/liquidModel\.setReveal\(landingId,\s*causalReveal\)/,
  'the broad field must reveal monotonically from the bucket gesture');
requirePattern(/liquid\.setEmitter\(\{[\s\S]{0,260}origin:\s*documentPoint[\s\S]{0,220}pressure:\s*pourAmount/,
  'the only live liquid emitter must stay attached to the projected bucket spout');
requirePattern(/function\s+activePigmentHue\s*\([^)]*\)\s*\{[\s\S]{0,160}landingId\s*\?\s*landingPalettePhase\s*\*\s*360\s*:\s*paintHue/,
  'one helper must own the active gesture pigment family');
requirePattern(/hue:\s*activePigmentHue\(\)/,
  'bucket lip and commitment particles must use the same pigment helper as the liquid field');
assert.doesNotMatch(source, /hue:\s*paintHue/,
  'particle emission must never bypass the active landing palette with the drifting preview hue');
requirePattern(/if\s*\(!landingId\)\s*ensureLandingGesture\(documentPoint\);[\s\S]{0,500}syncActivePigmentHue\(\)/,
  'the newly initialized landing palette must reach the bucket and particles before emission');
requirePattern(/state\s*===\s*'bottom-paint'[\s\S]{0,220}updateLandingLiquid\(progress\)[\s\S]{0,180}emitStream/,
  'the opening surface gesture must lock its pigment before emitting bucket droplets');
requirePattern(/state\s*===\s*'paint-swing'[\s\S]{0,220}updateLandingLiquid\(progress\)[\s\S]{0,180}emitStream/,
  'each upper surface gesture must lock its pigment before emitting bucket droplets');
requirePattern(/function\s+updateLiquidViewport\s*\(/,
  'the liquid surface must have one document-to-viewport update path');
requirePattern(/function\s+measureReadingLane\s*\([^)]*\)[\s\S]{0,900}\.journey-content[\s\S]{0,900}readingLane\.left[\s\S]{0,260}readingLane\.right[\s\S]{0,260}readingLane\.feather[\s\S]{0,260}readingLane\.opacity/,
  'the liquid viewport must include a softly protected central reading lane');
requirePattern(/function\s+updateLiquidViewport\s*\([^)]*\)[\s\S]{0,800}contentLeft:\s*readingLane\.left[\s\S]{0,260}contentRight:\s*readingLane\.right/,
  'the liquid viewport must reuse cached reading-lane bounds without a per-frame layout read');
requirePattern(/function\s+frame\s*\([^)]*\)[\s\S]{0,600}liquidTime\s*\+=\s*delta[\s\S]{0,220}updateLiquidViewport\(\)[\s\S]{0,180}liquid\.update\(delta,\s*liquidTime\)/,
  'every live frame must refresh document scroll uniforms and advance only accumulated visible time');
requirePattern(/function\s+cleanupActorLayer\s*\([^)]*\)[\s\S]{0,700}ladder\.dispose\(\)[\s\S]{0,180}particles\.dispose\(\)[\s\S]{0,180}character\.dispose\(\)/,
  'completion must have an actor-only disposal path');
requirePattern(/function\s+settleLiquidLayer\s*\([^)]*\)[\s\S]{0,800}liquid\.setAmbient\(true\)[\s\S]{0,220}cleanupActorLayer\(\)[\s\S]{0,220}attachSettledListeners\(\)/,
  'completion must preserve the liquid and enter the settled listener lifecycle');
requirePattern(/function\s+renderAmbientLiquid\s*\([^)]*\)[\s\S]{0,900}liquid\.update\(delta,\s*liquidTime\)[\s\S]{0,120}renderer\.render\(scene,\s*camera\)/,
  'ambient rendering must honor the liquid field throttle before compositing');
requirePattern(/function\s+reflowCompletedLiquid\s*\([^)]*\)[\s\S]{0,2400}liquidModel\.getGesture\('landing:'[\s\S]{0,1000}liquidModel\.getGesture\([\s\S]{0,900}'connector:'/,
  'settled layout changes must reflow stable semantic landings and connectors');
requirePattern(/function\s+recomputeLayout\s*\([^)]*\)[\s\S]{0,600}computeWaypoints\(\)[\s\S]{0,260}reflowCompletedLiquid\(previousWaypoints,\s*waypoints\)/,
  'active resize and details changes must also reflow every previously completed gesture');
requirePattern(/window\.addEventListener\('pagehide',\s*handlePageHide\)/,
  'the retained renderer must be released during page navigation');
assert.doesNotMatch(source, /LANDING_SEGMENTS|landingPaintStep|landingPathStartStep/,
  'the controller must not retain segmented broad-stroke state');
assert.doesNotMatch(source, /trail\.(?:flow|veil|whorl|spray)\s*\(/,
  'the live controller must not layer translucent broad Canvas2D marks over the liquid field');
assert.equal((source.match(/liquidModel\.upsertGesture\s*\(/g) || []).length, 2,
  'the controller must have exactly one landing insertion path and one connector insertion path');
requirePattern(/PAINT_RATES\s*=\s*\{\s*lip:\s*(?:[4-9]|1\d),\s*commitment:\s*(?:[2-9]|1\d)\s*\}/,
  'the remaining particle system must stay a small lip stream and one commitment splash');
assert.doesNotMatch(source, /\brope\b|throw-rope|coil-rope|portrait-rest/,
  'the revised live journey must not retain rope or lingering portrait-rest behavior');

async function testEscapeDuringModuleLoadingUsesAStaticFallback() {
  const windowListeners = new Map();
  let fallbackOptions = null;
  let liveCanvasRemoved = false;
  let trailCanvasRemoved = false;
  let rejectThree;
  const threeRequest = new Promise((resolve, reject) => { rejectThree = reject; });

  const stage = {
    classList: { toggle() {} },
    querySelector() { return null; },
    setAttribute() {},
    getBoundingClientRect() { return { top: 1900, height: 100 }; }
  };
  const liveCanvas = {
    parentNode: { removeChild() { liveCanvasRemoved = true; } },
    addEventListener() {},
    removeEventListener() {}
  };
  const fallbackCanvas = { style: {} };
  const trailCanvas = {
    width: 1000,
    height: 2000,
    parentNode: { removeChild() { trailCanvasRemoved = true; } }
  };
  const level = {
    getBoundingClientRect() { return { top: 200, height: 100 }; }
  };
  const trail = {
    freezeCalled: false,
    destroyCalled: false,
    freeze() { this.freezeCalled = true; },
    destroy() { this.destroyCalled = true; }
  };
  const document = {
    documentElement: { scrollWidth: 1000, scrollHeight: 2000, clientWidth: 1000 },
    body: { scrollWidth: 1000, scrollHeight: 2000 },
    hidden: false,
    getElementById(id) {
      return {
        'paint-finale': stage,
        'paint-finale-canvas': fallbackCanvas,
        'journey-webgl-layer': liveCanvas,
        'journey-paint-layer': trailCanvas
      }[id] || null;
    },
    querySelector() { return level; },
    addEventListener() {},
    removeEventListener() {}
  };
  const window = {
    PaintJourney: {
      createTrail() { return trail; },
      loadThree() { return threeRequest; }
    },
    PaintFinale: { startFallback(options) { fallbackOptions = options; } },
    PaintJourneyState: 'idle',
    innerWidth: 1000,
    innerHeight: 600,
    scrollX: 0,
    pageXOffset: 0,
    scrollY: 1400,
    pageYOffset: 1400,
    performance: { now() { return 100; } },
    matchMedia() { return { matches: false }; },
    addEventListener(type, callback) {
      const listeners = windowListeners.get(type) || [];
      listeners.push(callback);
      windowListeners.set(type, listeners);
    },
    removeEventListener(type, callback) {
      const listeners = windowListeners.get(type) || [];
      windowListeners.set(type, listeners.filter((listener) => listener !== callback));
    },
    IntersectionObserver: function IntersectionObserver(callback) {
      this.observe = function observe() { callback([{ isIntersecting: true }]); };
      this.disconnect = function disconnect() {};
    }
  };

  vm.runInNewContext(source, { window, document });

  assert.equal(window.PaintJourneyState, 'loading',
    'the harness must pause with the Three.js import in flight');
  const keyListeners = windowListeners.get('keydown') || [];
  assert.equal(keyListeners.length, 1, 'loading must attach the Escape listener');
  keyListeners[0]({ key: 'Escape' });

  assert.equal(fallbackOptions && fallbackOptions.staticOnly, true,
    'Escape during module loading must not replace cancellation with another animation');
  assert.equal(trail.destroyCalled, true,
    'loading-time cancellation must release the still-blank document-sized trail');
  assert.equal(trailCanvasRemoved, true,
    'loading-time cancellation must remove the unused trail canvas');
  assert.equal(liveCanvasRemoved, true, 'loading-time cancellation must remove the unused WebGL canvas');
  assert.equal(window.PaintJourneyState, 'cancelled-rest', 'loading-time cancellation must remain cancelled');

  rejectThree(new Error('blocked CDN'));
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(fallbackOptions && fallbackOptions.staticOnly, true,
    'a late import failure must not downgrade an Escape cancellation into an animated fallback');
}

function createBottomTriggerHarness({ reduced = false } = {}) {
  const listeners = new Map();
  let createTrailCalls = 0;
  let loadThreeCalls = 0;
  let drawStaticCalls = 0;
  let clearCalls = 0;
  let freezeCalls = 0;
  let fallbackOptions = null;
  let createLiquidModelCalls = 0;
  let createLiquidFieldCalls = 0;
  const stage = {
    classList: { toggle() {} },
    querySelector() { return null; },
    setAttribute() {},
    getBoundingClientRect() { return { top: 1900, height: 100 }; }
  };
  const liveCanvas = { addEventListener() {}, removeEventListener() {} };
  const fallbackCanvas = { style: {} };
  const trailCanvas = {};
  const level = { getBoundingClientRect() { return { top: 200, height: 100 }; } };
  const document = {
    documentElement: { scrollWidth: 1000, scrollHeight: 2000, clientWidth: 1000 },
    body: { scrollWidth: 1000, scrollHeight: 2000 },
    hidden: false,
    getElementById(id) {
      return {
        'paint-finale': stage,
        'paint-finale-canvas': fallbackCanvas,
        'journey-webgl-layer': liveCanvas,
        'journey-paint-layer': trailCanvas
      }[id] || null;
    },
    querySelector() { return level; },
    addEventListener() {},
    removeEventListener() {}
  };
  const trail = {
    clear() { clearCalls += 1; },
    drawStaticSpectrum() { drawStaticCalls += 1; },
    freeze() { freezeCalls += 1; }
  };
  const window = {
    PaintJourney: {
      createTrail() { createTrailCalls += 1; return trail; },
      createLiquidModel() { createLiquidModelCalls += 1; return {}; },
      createLiquidField() { createLiquidFieldCalls += 1; return {}; },
      loadThree() { loadThreeCalls += 1; return new Promise(() => {}); }
    },
    PaintFinale: { startFallback(options) { fallbackOptions = options; } },
    innerWidth: 1000,
    innerHeight: 600,
    scrollX: 0,
    pageXOffset: 0,
    scrollY: 1397,
    pageYOffset: 1397,
    performance: { now() { return 100; } },
    matchMedia() { return { matches: reduced }; },
    addEventListener(type, callback) {
      const callbacks = listeners.get(type) || [];
      callbacks.push(callback);
      listeners.set(type, callbacks);
    },
    removeEventListener(type, callback) {
      const callbacks = listeners.get(type) || [];
      listeners.set(type, callbacks.filter((listener) => listener !== callback));
    },
    IntersectionObserver: function IntersectionObserver(callback) {
      this.observe = function observe() { callback([{ isIntersecting: true }]); };
      this.disconnect = function disconnect() {};
    }
  };
  vm.runInNewContext(source, { window, document });
  return {
    window,
    document,
    setHeight(height) {
      document.documentElement.scrollHeight = height;
      document.body.scrollHeight = height;
    },
    setScroll(y) {
      window.scrollY = y;
      window.pageYOffset = y;
    },
    fire(type) {
      for (const callback of listeners.get(type) || []) callback({ type });
    },
    counts() {
      return {
        createTrailCalls,
        createLiquidModelCalls,
        createLiquidFieldCalls,
        loadThreeCalls,
        clearCalls,
        drawStaticCalls,
        freezeCalls,
        fallbackOptions
      };
    }
  };
}

function testExactBottomLazilyStartsAnimatedAndReducedMotionPaths() {
  for (const reduced of [false, true]) {
    const harness = createBottomTriggerHarness({ reduced });
    assert.deepEqual(harness.counts(), {
      createTrailCalls: 0,
      createLiquidModelCalls: 0,
      createLiquidFieldCalls: 0,
      loadThreeCalls: 0,
      clearCalls: 0,
      drawStaticCalls: 0,
      freezeCalls: 0,
      fallbackOptions: null
    }, 'finale visibility alone and a position three pixels above bottom must remain completely idle');

    harness.setHeight(2100);
    harness.setScroll(1398);
    harness.fire('scroll');
    assert.equal(harness.counts().createTrailCalls, 0,
      'the bottom boundary must use the current document height instead of a stale maximum scroll');

    harness.setScroll(1498);
    harness.fire('scroll');
    harness.fire('scroll');
    const counts = harness.counts();
    assert.equal(counts.createTrailCalls, 1, 'reaching the two-pixel bottom tolerance must initialize once');
    assert.equal(counts.createLiquidModelCalls, 0,
      'the liquid model must stay unconstructed until the lazily loaded Three.js runtime resolves');
    assert.equal(counts.createLiquidFieldCalls, 0,
      'the liquid render target must stay unconstructed until the lazily loaded Three.js runtime resolves');
    if (reduced) {
      assert.equal(counts.loadThreeCalls, 0, 'reduced motion must never load the 3D runtime');
      assert.equal(counts.clearCalls, 1, 'the static contour path must clear prior paint exactly once');
      assert.equal(counts.drawStaticCalls, 1, 'reduced motion must draw its rich static field only at bottom');
      assert.equal(counts.freezeCalls, 1, 'the reduced-motion field must become inert immediately');
      assert.equal(counts.fallbackOptions && counts.fallbackOptions.staticOnly, true,
        'reduced motion must request only a static finale at the shared bottom trigger');
      assert.equal(counts.fallbackOptions && counts.fallbackOptions.paintOwnedByTrail, true,
        'the legacy finale must know that the full-page contour trail owns the paint');
    } else {
      assert.equal(counts.loadThreeCalls, 1, 'normal motion must start one Three.js load at bottom');
    }
  }
}

async function createLiveLifecycleHarness({ mobile = false, hidden = false } = {}) {
  const windowListeners = new Map();
  const documentListeners = new Map();
  const canvasListeners = new Map();
  const animationFrames = new Map();
  const resizeObservers = [];
  const records = {
    actorDisposals: 0,
    ladderDisposals: 0,
    particleDisposals: 0,
    liquidDisposals: 0,
    rendererDisposals: 0,
    canvasRemovals: 0,
    trailFreezes: 0,
    trailDestroys: 0,
    staticDraws: 0,
    rendererRenders: 0,
    liquidAmbient: [],
    liquidUpdates: [],
    liquidViewports: [],
    modelReflows: [],
    fallbackOptions: null
  };
  let now = 100;
  let nextFrameId = 1;
  let intersectionCallback = null;
  const width = mobile ? 390 : 1000;
  const height = mobile ? 720 : 600;
  const levelTops = {
    thoughts: 1600,
    background: 1300,
    now: 1000,
    'why-this-site': 700,
    portrait: 300
  };

  function addListener(store, type, callback) {
    const callbacks = store.get(type) || [];
    callbacks.push(callback);
    store.set(type, callbacks);
  }

  function removeListener(store, type, callback) {
    const callbacks = store.get(type) || [];
    store.set(type, callbacks.filter((listener) => listener !== callback));
  }

  function makeLevel(name) {
    return {
      getBoundingClientRect() {
        return { top: levelTops[name] - window.scrollY, bottom: levelTops[name] - window.scrollY + 100,
          height: 100 };
      }
    };
  }

  const levels = Object.fromEntries(Object.keys(levelTops).map((name) => [name, makeLevel(name)]));
  const journeyContent = {
    getBoundingClientRect() {
      return { left: 170, right: width - 170, width: width - 340, top: 0, bottom: 1800 };
    }
  };
  const stage = {
    classList: { toggle() {} },
    querySelector() { return null; },
    setAttribute() {},
    getBoundingClientRect() {
      return { top: 1900 - window.scrollY, bottom: 2000 - window.scrollY, height: 100 };
    }
  };
  const liveCanvas = {
    parentNode: {
      removeChild() {
        records.canvasRemovals += 1;
        liveCanvas.parentNode = null;
      }
    },
    addEventListener(type, callback) { addListener(canvasListeners, type, callback); },
    removeEventListener(type, callback) { removeListener(canvasListeners, type, callback); }
  };
  const fallbackCanvas = { style: {} };
  const trailCanvas = {};
  const document = {
    documentElement: { scrollWidth: width, scrollHeight: 2000, clientWidth: width, clientHeight: height },
    body: { scrollWidth: width, scrollHeight: 2000 },
    hidden,
    getElementById(id) {
      return {
        'paint-finale': stage,
        'paint-finale-canvas': fallbackCanvas,
        'journey-webgl-layer': liveCanvas,
        'journey-paint-layer': trailCanvas
      }[id] || null;
    },
    querySelector(selector) {
      if (selector === '.journey-content') return journeyContent;
      const match = selector.match(/^\[data-journey-level="([^"]+)"\]$/);
      return match ? levels[match[1]] : null;
    },
    addEventListener(type, callback) { addListener(documentListeners, type, callback); },
    removeEventListener(type, callback) { removeListener(documentListeners, type, callback); },
    createElement() { return {}; }
  };

  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    copy(other) { return this.set(other.x, other.y, other.z); }
    sub(other) { this.x -= other.x; this.y -= other.y; this.z -= other.z; return this; }
    multiplyScalar(value) { this.x *= value; this.y *= value; this.z *= value; return this; }
    lengthSq() { return this.x * this.x + this.y * this.y + this.z * this.z; }
    length() { return Math.sqrt(this.lengthSq()); }
  }

  class Scene {
    constructor() { this.children = []; }
    add(object) { this.children.push(object); object.parent = this; }
    remove(object) { this.children = this.children.filter((child) => child !== object); object.parent = null; }
    updateMatrixWorld() {}
  }

  class OrthographicCamera {
    constructor() {
      this.position = { set() {} };
    }
    lookAt() {}
    updateProjectionMatrix() {}
  }

  class WebGLRenderer {
    setClearColor() {}
    setPixelRatio() {}
    setSize() {}
    render() { records.rendererRenders += 1; }
    dispose() { records.rendererDisposals += 1; }
  }

  const THREE = { Vector3, Scene, OrthographicCamera, WebGLRenderer };
  const gestures = new Map();
  const liquidModel = {
    upsertGesture(payload) {
      gestures.set(payload.id, JSON.parse(JSON.stringify(payload)));
      return gestures.get(payload.id);
    },
    setReveal(id, reveal) {
      const gesture = gestures.get(id);
      if (gesture) gesture.reveal = Math.max(gesture.reveal || 0, reveal);
    },
    reflow(id, geometry) {
      const gesture = gestures.get(id);
      if (!gesture) return null;
      Object.assign(gesture, JSON.parse(JSON.stringify(geometry)));
      records.modelReflows.push({ id, geometry: JSON.parse(JSON.stringify(geometry)) });
      return JSON.parse(JSON.stringify(gesture));
    },
    getGesture(id) {
      const gesture = gestures.get(id);
      return gesture ? JSON.parse(JSON.stringify(gesture)) : null;
    }
  };
  const liquid = {
    setViewport(viewport) { records.liquidViewports.push({ ...viewport }); return true; },
    setEmitter() { return true; },
    setMobile() {},
    update(delta, time) { records.liquidUpdates.push({ delta, time }); return true; },
    setAmbient(value) { records.liquidAmbient.push(value); },
    dispose() { records.liquidDisposals += 1; }
  };
  let characterProgress = 0;
  let characterPose = '';
  const character = {
    paintSpout: {
      getWorldPosition(output) { output.set(width - (mobile ? 46 : 84), 84, 0); return output; }
    },
    setScreenPose() {},
    setPose(name, progress) { characterPose = name; characterProgress = progress; },
    getPourAmount() {
      return characterPose === 'paint-swing' && characterProgress >= 0.25 && characterProgress <= 0.82 ? 1 : 0;
    },
    setPaintHue() {},
    setOpacity() {},
    update() {},
    dispose() { records.actorDisposals += 1; }
  };
  const ladder = {
    setMetrics() {}, setSpan() {}, hide() {},
    dispose() { records.ladderDisposals += 1; }
  };
  const particles = {
    activeCount: 0,
    setMobile() {}, setHue() {}, emit() {}, burst() {}, update() {}, clear() {},
    dispose() { records.particleDisposals += 1; }
  };
  const trail = {
    clear() {},
    drawStaticSpectrum() { records.staticDraws += 1; },
    freeze() { records.trailFreezes += 1; },
    destroy() { records.trailDestroys += 1; }
  };
  const window = {
    PaintJourney: {
      createTrail() { return trail; },
      loadThree() { return Promise.resolve(THREE); },
      createLiquidModel() { return liquidModel; },
      createLiquidField() { return liquid; },
      createCharacter() { return character; },
      createLadder() { return ladder; },
      createParticles() { return particles; }
    },
    PaintFinale: { startFallback(options) { records.fallbackOptions = options; } },
    innerWidth: width,
    innerHeight: height,
    devicePixelRatio: 1,
    scrollX: 0,
    pageXOffset: 0,
    scrollY: 2000 - height,
    pageYOffset: 2000 - height,
    performance: { now() { return now; } },
    matchMedia() { return { matches: false }; },
    scrollTo(options) { this.scrollY = options.top; this.pageYOffset = options.top; },
    requestAnimationFrame(callback) {
      const id = nextFrameId++;
      animationFrames.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) { animationFrames.delete(id); },
    addEventListener(type, callback) { addListener(windowListeners, type, callback); },
    removeEventListener(type, callback) { removeListener(windowListeners, type, callback); },
    ResizeObserver: class ResizeObserver {
      constructor(callback) { this.callback = callback; this.disconnected = false; resizeObservers.push(this); }
      observe(target) { this.target = target; }
      disconnect() { this.disconnected = true; }
    },
    IntersectionObserver: function IntersectionObserver(callback) {
      this.observe = function observe() { intersectionCallback = callback; };
      this.disconnect = function disconnect() {};
    }
  };

  vm.runInNewContext(source, { window, document });
  intersectionCallback([{ isIntersecting: true }]);
  await Promise.resolve();
  await Promise.resolve();

  function fire(store, type, event = {}) {
    for (const callback of [...(store.get(type) || [])]) callback({ type, ...event });
  }

  function step(milliseconds) {
    now += milliseconds;
    const pending = [...animationFrames.entries()];
    assert.ok(pending.length, 'the lifecycle harness expected a queued animation frame');
    const [id, callback] = pending[0];
    animationFrames.delete(id);
    callback(now);
  }

  function advanceCurrentState() {
    const duration = {
      entering: 1350,
      'bottom-paint': 2350,
      'deploy-ladder': 1050,
      'climb-ladder': 1800,
      'retrieve-ladder': 850,
      'paint-swing': 1750,
      vanish: 1050
    }[window.PaintJourneyState] || 1000;
    step(duration * 0.52);
    step(duration * 0.58);
  }

  function completeJourney() {
    let guard = 0;
    while (window.PaintJourneyState !== 'complete' && guard < 24) {
      advanceCurrentState();
      guard += 1;
    }
    assert.equal(window.PaintJourneyState, 'complete', 'the lifecycle harness must reach the settled state');
  }

  return {
    window,
    document,
    liveCanvas,
    records,
    gestures,
    animationFrames,
    resizeObservers,
    completeJourney,
    step,
    setNow(value) { now = value; },
    shiftLevel(name, amount) {
      levelTops[name] += amount;
      document.documentElement.scrollHeight += amount;
      document.body.scrollHeight += amount;
    },
    fireWindow(type, event) { fire(windowListeners, type, event); },
    fireDocument(type, event) { fire(documentListeners, type, event); },
    fireCanvas(type, event) { fire(canvasListeners, type, event); },
    listenerCount(storeName, type) {
      const store = storeName === 'window' ? windowListeners : documentListeners;
      return (store.get(type) || []).length;
    },
    listeners(storeName, type) {
      const store = storeName === 'window' ? windowListeners : documentListeners;
      return [...(store.get(type) || [])];
    }
  };
}

async function testCompletionRetainsOnlyAmbientLiquid() {
  const harness = await createLiveLifecycleHarness();
  const staleEscapeListener = harness.listeners('window', 'keydown')[0];
  harness.completeJourney();

  assert.equal(harness.records.actorDisposals, 1, 'completion must dispose the painter once');
  assert.equal(harness.records.ladderDisposals, 1, 'completion must dispose the ladder once');
  assert.equal(harness.records.particleDisposals, 1, 'completion must dispose the droplet system once');
  assert.equal(harness.records.liquidDisposals, 0, 'completion must retain the procedural liquid field');
  assert.equal(harness.records.rendererDisposals, 0, 'completion must retain the renderer for ambient liquid');
  assert.equal(harness.records.canvasRemovals, 0, 'completion must retain the WebGL canvas');
  assert.deepEqual(harness.records.liquidAmbient, [true], 'completion must enter ambient mode exactly once');
  assert.equal(harness.records.trailFreezes, 1, 'completion must freeze the small persistent droplet trail');
  assert.equal(harness.listenerCount('window', 'keydown'), 0,
    'completion must detach Escape and all active journey input listeners');
  assert.equal(harness.listenerCount('window', 'scroll'), 1,
    'completion must install one passive settled scroll listener');
  assert.equal(harness.listenerCount('window', 'resize'), 1,
    'completion must replace the active resize listener with one settled listener');
  assert.equal(harness.listenerCount('document', 'toggle'), 1,
    'completion must replace the active toggle listener with one settled reflow listener');
  const protectedViewport = harness.records.liquidViewports.at(-1);
  assert.equal(protectedViewport.contentLeft, 170,
    'the liquid field must receive the live content-column left edge');
  assert.equal(protectedViewport.contentRight, 830,
    'the liquid field must receive the live content-column right edge');
  assert.ok(protectedViewport.contentOpacity >= 0.5 && protectedViewport.contentOpacity <= 0.7,
    'the reading lane must soften pigment without erasing it');

  staleEscapeListener({ key: 'Escape' });
  assert.equal(harness.window.PaintJourneyState, 'complete',
    'an already-dispatched stale Escape callback must not reclassify a settled journey as loading cancellation');
  assert.equal(harness.records.liquidDisposals, 0,
    'a stale Escape callback after completion must leave the retained liquid untouched');

  const rendersBefore = harness.records.rendererRenders;
  harness.step(50);
  assert.ok(harness.records.rendererRenders > rendersBefore,
    'the retained liquid must continue rendering at its bounded ambient cadence');
}

async function testHiddenAmbientTimePausesWithoutJumping() {
  const harness = await createLiveLifecycleHarness();
  harness.completeJourney();
  harness.step(50);
  const beforeHide = harness.records.liquidUpdates.at(-1).time;

  harness.document.hidden = true;
  harness.fireDocument('visibilitychange');
  assert.equal(harness.animationFrames.size, 0, 'hiding the document must cancel the ambient frame');

  harness.setNow(900000);
  harness.document.hidden = false;
  harness.fireDocument('visibilitychange');
  assert.equal(harness.animationFrames.size, 1, 'returning to the page must schedule one ambient frame');
  harness.step(0);
  const afterShow = harness.records.liquidUpdates.at(-1).time;
  assert.equal(afterShow, beforeHide,
    'the first resumed ambient frame must preserve shader time instead of jumping across hidden time');
}

async function testHiddenInitializationWaitsForVisibility() {
  const harness = await createLiveLifecycleHarness({ hidden: true });
  assert.equal(harness.animationFrames.size, 0,
    'initialization in a hidden document must not queue a live rendering frame');
  assert.equal(harness.records.liquidUpdates.length, 0,
    'initialization in a hidden document must not advance the liquid phase');

  harness.setNow(500000);
  harness.document.hidden = false;
  harness.fireDocument('visibilitychange');
  assert.equal(harness.animationFrames.size, 1,
    'the first visible transition must start exactly one journey frame');
  harness.step(0);
  assert.equal(harness.records.liquidUpdates.at(-1).time, 0,
    'the first visible frame after hidden initialization must start at liquid phase zero');
}

async function testSettledScrollResizeAndDetailsReflow() {
  const harness = await createLiveLifecycleHarness();
  harness.completeJourney();
  const expectedIds = [
    'landing:bottom', 'landing:thoughts', 'landing:background', 'landing:now',
    'landing:why-this-site', 'landing:portrait',
    'connector:bottom:thoughts', 'connector:thoughts:background', 'connector:background:now',
    'connector:now:why-this-site', 'connector:why-this-site:portrait'
  ];
  assert.deepEqual([...harness.gestures.keys()].sort(), expectedIds.slice().sort(),
    'the completed harness must retain all six semantic landings and five connectors');

  const bottomBeforeNoopReflow = JSON.parse(JSON.stringify(harness.gestures.get('landing:bottom')));
  harness.fireDocument('toggle');
  harness.step(20);
  assert.deepEqual(harness.gestures.get('landing:bottom'), bottomBeforeNoopReflow,
    'a no-op settled layout pass must not make the bottom contour jump');

  harness.window.scrollY = 280;
  harness.window.pageYOffset = 280;
  harness.fireWindow('scroll');
  harness.step(20);
  assert.equal(harness.records.liquidViewports.at(-1).scrollY, 280,
    'settled scroll must immediately align the document-space liquid viewport');

  harness.records.modelReflows.length = 0;
  harness.shiftLevel('background', 180);
  harness.fireDocument('toggle');
  harness.step(20);
  assert.deepEqual([...new Set(harness.records.modelReflows.map((entry) => entry.id))].sort(),
    expectedIds.slice().sort(),
    'details/layout changes must semantically reflow every retained landing and connector');

  harness.records.modelReflows.length = 0;
  harness.window.innerWidth = 820;
  harness.fireWindow('resize');
  harness.step(20);
  assert.deepEqual([...new Set(harness.records.modelReflows.map((entry) => entry.id))].sort(),
    expectedIds.slice().sort(),
    'settled resize must reflow the entire document-space field without recreating gestures');
}

async function testContextLossFallsBackAndPageHideDisposesIdempotently() {
  const contextHarness = await createLiveLifecycleHarness();
  contextHarness.completeJourney();
  let prevented = false;
  contextHarness.fireCanvas('webglcontextlost', { preventDefault() { prevented = true; } });
  assert.equal(prevented, true, 'context loss must prevent the browser default restoration race');
  assert.equal(contextHarness.records.liquidDisposals, 1, 'context loss must dispose the retained liquid');
  assert.equal(contextHarness.records.rendererDisposals, 1, 'context loss must dispose the renderer');
  assert.equal(contextHarness.records.staticDraws, 1,
    'context loss must replace the live surface with one static contour field');
  assert.equal(contextHarness.records.fallbackOptions && contextHarness.records.fallbackOptions.paintOwnedByTrail,
    true, 'context loss must keep legacy fallback paint suppressed');

  const pageHarness = await createLiveLifecycleHarness();
  pageHarness.completeJourney();
  pageHarness.fireWindow('pagehide');
  pageHarness.fireWindow('pagehide');
  assert.equal(pageHarness.records.actorDisposals, 1, 'pagehide must not double-dispose the actor layer');
  assert.equal(pageHarness.records.liquidDisposals, 1, 'pagehide must dispose the liquid exactly once');
  assert.equal(pageHarness.records.rendererDisposals, 1, 'pagehide must dispose the renderer exactly once');
  assert.equal(pageHarness.records.canvasRemovals, 1, 'pagehide must remove the WebGL canvas exactly once');
  assert.equal(pageHarness.records.trailDestroys, 1, 'pagehide must release the document-sized trail once');
  assert.equal(pageHarness.records.fallbackOptions, null,
    'pagehide teardown must not start replacement artwork while navigating away');
}

async function testPageHideDuringLoadingIgnoresLateThreeResult() {
  for (const settleAs of ['resolve', 'reject']) {
    const listeners = new Map();
    let fallbackCalls = 0;
    let createCharacterCalls = 0;
    let liveCanvasRemoved = 0;
    let trailCanvasRemoved = 0;
    let settleThree;
    let rejectThree;
    const threeRequest = new Promise((resolve, reject) => {
      settleThree = resolve;
      rejectThree = reject;
    });
    const stage = {
      classList: { toggle() {} }, querySelector() { return null; }, setAttribute() {},
      getBoundingClientRect() { return { top: 1900, height: 100 }; }
    };
    const liveCanvas = {
      parentNode: { removeChild() { liveCanvasRemoved += 1; liveCanvas.parentNode = null; } },
      addEventListener() {},
      removeEventListener() {}
    };
    const trailCanvas = {
      width: 1000, height: 2000,
      parentNode: { removeChild() { trailCanvasRemoved += 1; trailCanvas.parentNode = null; } }
    };
    const document = {
      documentElement: { scrollWidth: 1000, scrollHeight: 2000, clientWidth: 1000, clientHeight: 600 },
      body: { scrollWidth: 1000, scrollHeight: 2000 },
      hidden: false,
      getElementById(id) {
        return {
          'paint-finale': stage,
          'paint-finale-canvas': { style: {} },
          'journey-webgl-layer': liveCanvas,
          'journey-paint-layer': trailCanvas
        }[id] || null;
      },
      querySelector() { return { getBoundingClientRect() { return { top: 200, height: 100 }; } }; },
      addEventListener() {}, removeEventListener() {}
    };
    const window = {
      PaintJourney: {
        createTrail() { return { destroy() {}, freeze() {} }; },
        loadThree() { return threeRequest; },
        createCharacter() { createCharacterCalls += 1; return {}; }
      },
      PaintFinale: { startFallback() { fallbackCalls += 1; } },
      innerWidth: 1000, innerHeight: 600, scrollX: 0, pageXOffset: 0, scrollY: 1400, pageYOffset: 1400,
      performance: { now() { return 100; } },
      matchMedia() { return { matches: false }; },
      addEventListener(type, callback) {
        const callbacks = listeners.get(type) || [];
        callbacks.push(callback);
        listeners.set(type, callbacks);
      },
      removeEventListener(type, callback) {
        const callbacks = listeners.get(type) || [];
        listeners.set(type, callbacks.filter((listener) => listener !== callback));
      },
      IntersectionObserver: function IntersectionObserver(callback) {
        this.observe = function observe() { callback([{ isIntersecting: true }]); };
        this.disconnect = function disconnect() {};
      }
    };

    vm.runInNewContext(source, { window, document });
    assert.equal(window.PaintJourneyState, 'loading', 'the pagehide race harness must pause during module loading');
    for (const callback of listeners.get('pagehide') || []) callback({ type: 'pagehide' });
    if (settleAs === 'resolve') settleThree({ WebGLRenderer: function WebGLRenderer() {} });
    else rejectThree(new Error('late CDN rejection'));
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(createCharacterCalls, 0,
      'a late Three.js resolution after pagehide must not initialize the actor layer');
    assert.equal(fallbackCalls, 0,
      'a late Three.js rejection after pagehide must not start artwork during navigation');
    assert.equal(liveCanvasRemoved, 1, 'pagehide during loading must remove the live canvas once');
    assert.equal(trailCanvasRemoved, 1, 'pagehide during loading must remove the trail canvas once');
  }
}

async function testContextLossDuringLoadingUsesOneStaticFallback() {
  const listeners = new Map();
  let fallbackOptions = null;
  let drawStaticCalls = 0;
  let settleThree;
  const stage = {
    classList: { toggle() {} }, querySelector() { return null; }, setAttribute() {},
    getBoundingClientRect() { return { top: 1900, height: 100 }; }
  };
  const liveCanvas = {
    parentNode: { removeChild() { liveCanvas.parentNode = null; } },
    addEventListener(type, callback) {
      const callbacks = listeners.get(type) || [];
      callbacks.push(callback);
      listeners.set(type, callbacks);
    },
    removeEventListener() {}
  };
  const document = {
    documentElement: { scrollWidth: 1000, scrollHeight: 2000, clientWidth: 1000, clientHeight: 600 },
    body: { scrollWidth: 1000, scrollHeight: 2000 }, hidden: false,
    getElementById(id) {
      return {
        'paint-finale': stage,
        'paint-finale-canvas': { style: {} },
        'journey-webgl-layer': liveCanvas,
        'journey-paint-layer': { parentNode: { removeChild() {} } }
      }[id] || null;
    },
    querySelector() { return { getBoundingClientRect() { return { top: 200, height: 100 }; } }; },
    addEventListener() {}, removeEventListener() {}
  };
  const window = {
    PaintJourney: {
      createTrail() {
        return { clear() {}, drawStaticSpectrum() { drawStaticCalls += 1; }, freeze() {}, destroy() {} };
      },
      loadThree() { return new Promise((resolve) => { settleThree = resolve; }); }
    },
    PaintFinale: { startFallback(options) { fallbackOptions = options; } },
    innerWidth: 1000, innerHeight: 600, scrollX: 0, pageXOffset: 0, scrollY: 1400, pageYOffset: 1400,
    performance: { now() { return 100; } }, matchMedia() { return { matches: false }; },
    addEventListener(type, callback) {
      const callbacks = listeners.get(type) || [];
      callbacks.push(callback);
      listeners.set(type, callbacks);
    },
    removeEventListener(type, callback) {
      const callbacks = listeners.get(type) || [];
      listeners.set(type, callbacks.filter((listener) => listener !== callback));
    },
    IntersectionObserver: function IntersectionObserver(callback) {
      this.observe = function observe() { callback([{ isIntersecting: true }]); };
      this.disconnect = function disconnect() {};
    }
  };

  vm.runInNewContext(source, { window, document });
  let prevented = false;
  for (const callback of listeners.get('webglcontextlost') || []) {
    callback({ preventDefault() { prevented = true; } });
  }
  assert.equal(prevented, true, 'the loading context-loss test must invoke the live loss handler');
  assert.equal(drawStaticCalls, 1, 'context loss during loading must draw one static contour fallback');
  assert.equal(fallbackOptions && fallbackOptions.paintOwnedByTrail, true,
    'context loss during loading must suppress legacy paint under the shared static field');

  settleThree({ WebGLRenderer: function WebGLRenderer() {} });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(window.PaintJourneyState, 'loading',
    'a late module result after loading-time context loss must not restart the live journey');
}

(async function runBehaviorChecks() {
  testExactBottomLazilyStartsAnimatedAndReducedMotionPaths();
  await testEscapeDuringModuleLoadingUsesAStaticFallback();
  await testCompletionRetainsOnlyAmbientLiquid();
  await testHiddenAmbientTimePausesWithoutJumping();
  await testHiddenInitializationWaitsForVisibility();
  await testSettledScrollResizeAndDetailsReflow();
  await testContextLossFallsBackAndPageHideDisposesIdempotently();
  await testPageHideDuringLoadingIgnoresLateThreeResult();
  await testContextLossDuringLoadingUsesOneStaticFallback();
  console.log('PASS: paint journey orchestrator contract');
}()).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
