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
requirePattern(/if\s*\(!character\)[\s\S]{0,380}cleanupLiveLayer\(\)[\s\S]{0,180}discardTrailLayer\(\)/,
  'cancelling during Three.js loading must remove both empty rendering layers');
requirePattern(/PaintFinale\.pendingStart[\s\S]{0,220}staticOnly/,
  'a late load failure must not downgrade an already-static cancellation fallback');
requirePattern(/function\s+finishLoop\s*\([^)]*\)\s*\{[\s\S]{0,500}state\s*===\s*'cancelled-rest'[\s\S]{0,260}cleanupLiveLayer\(\{\s*preserveStage:\s*true\s*\}\)/,
  'a cancelled journey must dispose its WebGL layer after the resting pose');
requirePattern(/function\s+finishLoop\s*\([^)]*\)\s*\{[\s\S]{0,420}trail\.freeze\(\)/,
  'completed or cancelled journeys must stop persistent trail maintenance');
requirePattern(/function\s+failLive\s*\([^)]*\)\s*\{[\s\S]{0,360}trail\.freeze\(\)/,
  'a failed WebGL journey must stop trail maintenance before falling back');
requirePattern(/function\s+beginLoading[\s\S]{0,900}if\s*\(reducedMotion\)[\s\S]{0,260}drawStaticSpectrum\(waypoints\)[\s\S]{0,160}trail\.freeze\(\)/,
  'reduced-motion artwork must be created inside the shared bottom-trigger path and become inert');
requirePattern(/function\s+handleVisibilityChange\s*\([^)]*\)\s*\{[\s\S]{0,520}stateStarted\s*\+=\s*now\s*-\s*hiddenAt/,
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
requirePattern(/function\s+frame\s*\([^)]*\)[\s\S]{0,500}updateLiquidViewport\(\)[\s\S]{0,180}liquid\.update\(delta,\s*timestamp\s*\*\s*0\.001\)/,
  'every live frame must refresh document scroll uniforms before rendering the liquid target');
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
  const liveCanvas = { removeEventListener() {} };
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
      assert.equal(counts.drawStaticCalls, 1, 'reduced motion must draw its rich static field only at bottom');
      assert.equal(counts.freezeCalls, 1, 'the reduced-motion field must become inert immediately');
      assert.equal(counts.fallbackOptions && counts.fallbackOptions.staticOnly, true,
        'reduced motion must request only a static finale at the shared bottom trigger');
    } else {
      assert.equal(counts.loadThreeCalls, 1, 'normal motion must start one Three.js load at bottom');
    }
  }
}

(async function runBehaviorChecks() {
  testExactBottomLazilyStartsAnimatedAndReducedMotionPaths();
  await testEscapeDuringModuleLoadingUsesAStaticFallback();
  console.log('PASS: paint journey orchestrator contract');
}()).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
