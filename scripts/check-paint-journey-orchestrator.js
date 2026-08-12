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

requirePattern(/entering:\s*1\.25/,
  'the opening walk must use a readable human pace');
requirePattern(/currentPoint\.x\s*=\s*start\.x\s*\+\s*96/,
  'the opening walk distance must stay proportionate to the compact figure');
requirePattern(/setPose\('walk',\s*progress,\s*progress\s*\*\s*Math\.PI\s*\*\s*4\)/,
  'the opening travel must use enough short strides to avoid a single sliding step');

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
requirePattern(/if\s*\(reducedMotion\)[\s\S]{0,260}drawStaticSpectrum\(waypoints\)[\s\S]{0,160}trail\.freeze\(\)/,
  'the reduced-motion artwork must become inert after it is drawn');
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
requirePattern(/function\s+applyResponsiveMetrics\s*\([^)]*\)[\s\S]{0,500}ladder\.setMetrics[\s\S]{0,300}particles\.setMobile/,
  'a breakpoint-crossing resize must update the existing ladder and particle system');
requirePattern(/capacity:\s*600/,
  'a mobile-started journey must retain capacity to expand safely onto desktop');
requirePattern(/sourceDeltaY[\s\S]{0,900}targetDeltaY/,
  'responsive layout changes must track source and target heights independently');
requirePattern(/landingNeedsRebase\s*=\s*true/,
  'an active bucket gesture must rebase its remaining path after responsive layout changes');
requirePattern(/landingPathStartStep\s*=\s*landingPaintStep/,
  'a rebased bucket gesture must continue from its next undrawn segment');
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
requirePattern(/climbCycles\s*=\s*clamp\([\s\S]{0,180}rungSpacing[\s\S]{0,120},\s*2,\s*24\)/,
  'climb cadence must scale across long ladder spans instead of capping at six cycles');
requirePattern(/character\.setPose\('climb-ladder',\s*eased,\s*climbCycles\)/,
  'climbing limbs and root travel must use the same eased step clock');
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
requirePattern(/trail\.impact\(/,
  'each landing must create a pooled paint impact');
requirePattern(/trail\.veil\(/,
  'each landing must cast a broad translucent paint veil across the site');
requirePattern(/landingSequence\s*\*\s*83/,
  'successive landings must rotate through materially different pigment families');
requirePattern(/landingMode\s*=\s*landingSequence\s*%\s*5/,
  'the six landings must rotate through at least five distinct gesture signatures');
requirePattern(/LANDING_SEGMENTS\s*=\s*6/,
  'broad page paint must grow out from the bucket in progressive segments');
requirePattern(/while\s*\(landingPaintStep\s*<\s*visibleStep\)/,
  'a landing must accumulate its broad gesture instead of appearing all at once');
requirePattern(/landingMode\s*===\s*1[\s\S]{0,500}trail\.spray\(/,
  'one landing composition must favor a loose artist-style sprinkle field');
requirePattern(/PAINT_RATES\s*=\s*\{[\s\S]{0,160}pour:\s*(?:[89]\d|\d{3,})[\s\S]{0,120}swing:\s*(?:[89]\d|\d{3,})/,
  'bucket pours and swings must emit a visibly connected stream');
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

(async function runBehaviorChecks() {
  await testEscapeDuringModuleLoadingUsesAStaticFallback();
  console.log('PASS: paint journey orchestrator contract');
}()).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
