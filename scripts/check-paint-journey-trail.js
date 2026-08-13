#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/paint-journey-trail.js'), 'utf8');
const defaultSelectorBlock = source.match(/DEFAULT_CONTENT_SELECTORS\s*=\s*\[([\s\S]*?)\]/)?.[1] || '';

assert.doesNotMatch(defaultSelectorBlock, /'p'|'li'|'a'/,
  'body copy and links must not be hard-erased from the broad paint field');
assert.doesNotMatch(defaultSelectorBlock, /'\.photo'/,
  'the portrait must sit over the paint without a hard rectangular erasure');

function createHarness(options = {}) {
  const operations = [];
  const animationFrames = new Map();
  const documentListeners = new Map();
  const windowListeners = new Map();
  const journeyContent = {};
  let nextAnimationFrame = 1;
  let resizeObserverCallback = null;
  let resizeObserverTarget = null;
  let selectorQueries = 0;
  let layoutWidth = options.layoutWidth || 800;
  let layoutHeight = options.layoutHeight || 2000;
  let anchorYs = (options.anchorYs || []).slice();

  function createContext(recordOperations) {
    const record = recordOperations ? operations : [];
    return {
      save() { record.push(['save']); },
      restore() { record.push(['restore']); },
      beginPath() { record.push(['beginPath']); },
      rect(...args) { record.push(['rect', ...args]); },
      clip() { record.push(['clip']); },
      clearRect(...args) { record.push(['clearRect', ...args]); },
      createRadialGradient() {
        return { addColorStop(position, color) { record.push(['colorStop', position, color]); } };
      },
      arc(...args) { record.push(['arc', ...args]); },
      ellipse(...args) { record.push(['ellipse', ...args]); },
      moveTo(...args) { record.push(['moveTo', ...args]); },
      lineTo(...args) { record.push(['lineTo', ...args]); },
      bezierCurveTo(...args) { record.push(['bezierCurveTo', ...args]); },
      quadraticCurveTo(...args) { record.push(['quadraticCurveTo', ...args]); },
      closePath() { record.push(['closePath']); },
      stroke() { record.push(['stroke']); },
      fill() { record.push(['fill']); },
      fillRect(...args) { record.push(['fillRect', ...args]); },
      drawImage(...args) { record.push(['drawImage', ...args]); },
      setTransform(...args) { record.push(['setTransform', ...args]); },
      set lineWidth(value) { record.push(['lineWidth', value]); },
      set strokeStyle(value) { record.push(['strokeStyle', value]); },
      set fillStyle(value) { record.push(['fillStyle', value]); },
      set globalCompositeOperation(value) { record.push(['composite', value]); },
      set globalAlpha(value) { record.push(['globalAlpha', value]); },
      set lineCap(value) { record.push(['lineCap', value]); },
      set lineJoin(value) { record.push(['lineJoin', value]); },
      set shadowColor(value) { record.push(['shadowColor', value]); },
      set shadowBlur(value) { record.push(['shadowBlur', value]); },
      set shadowOffsetX(value) { record.push(['shadowOffsetX', value]); },
      set shadowOffsetY(value) { record.push(['shadowOffsetY', value]); }
    };
  }

  const context = createContext(true);
  const canvas = {
    width: 0,
    height: 0,
    style: {},
    getContext() { return context; },
    getBoundingClientRect() {
      return { left: 11, top: 40, width: 1000, height: 2000 };
    }
  };
  const content = {
    getBoundingClientRect() {
      return typeof options.contentRect === 'function'
        ? options.contentRect()
        : options.contentRect || { left: 111, top: 140, width: 20, height: 10 };
    }
  };
  const document = {
    documentElement: { scrollWidth: 1000, scrollHeight: layoutHeight, clientWidth: layoutWidth, clientHeight: 600 },
    body: { scrollWidth: 1000, scrollHeight: layoutHeight },
    querySelectorAll() {
      selectorQueries += 1;
      return [content];
    },
    querySelector(selector) {
      return selector === '.journey-content' ? journeyContent : null;
    },
    addEventListener(type, callback) {
      const listeners = documentListeners.get(type) || [];
      listeners.push(callback);
      documentListeners.set(type, listeners);
    },
    removeEventListener(type, callback) {
      const listeners = documentListeners.get(type) || [];
      documentListeners.set(type, listeners.filter((listener) => listener !== callback));
    },
    createElement() {
      return { width: 0, height: 0, getContext() { return createContext(false); } };
    }
  };
  if (options.dynamicDocumentWidth) {
    const measuredWidth = () => canvas.style.display === 'none'
      ? layoutWidth
      : Math.max(layoutWidth, Number.parseFloat(canvas.style.width) || 0);
    Object.defineProperty(document.documentElement, 'scrollWidth', { get: measuredWidth });
    Object.defineProperty(document.body, 'scrollWidth', { get: measuredWidth });
  }
  if (options.dynamicDocumentHeight) {
    const measuredHeight = () => layoutHeight;
    Object.defineProperty(document.documentElement, 'scrollHeight', { get: measuredHeight });
    Object.defineProperty(document.body, 'scrollHeight', { get: measuredHeight });
  }
  const window = {
    PaintJourney: {},
    devicePixelRatio: 2,
    scrollX: 5,
    scrollY: 7,
    pageXOffset: 5,
    pageYOffset: 7,
    ResizeObserver: function ResizeObserver(callback) {
      resizeObserverCallback = callback;
      this.observe = function observe(target) { resizeObserverTarget = target; };
      this.disconnect = function disconnect() { resizeObserverTarget = null; };
    },
    requestAnimationFrame(callback) {
      const frame = nextAnimationFrame;
      nextAnimationFrame += 1;
      animationFrames.set(frame, callback);
      return frame;
    },
    cancelAnimationFrame(frame) { animationFrames.delete(frame); },
    addEventListener(type, callback) {
      const listeners = windowListeners.get(type) || [];
      listeners.push(callback);
      windowListeners.set(type, listeners);
    },
    removeEventListener(type, callback) {
      const listeners = windowListeners.get(type) || [];
      windowListeners.set(type, listeners.filter((listener) => listener !== callback));
    }
  };

  vm.runInNewContext(source, { window, document });
  const trail = window.PaintJourney.createTrail({
    canvas,
    getAnchors: options.anchorYs ? () => anchorYs.map((y) => ({ y })) : undefined
  });
  return {
    operations,
    canvas,
    trail,
    selectorQueryCount: () => selectorQueries,
    journeyContent,
    resizeObserverTarget: () => resizeObserverTarget,
    triggerContentResize() {
      if (resizeObserverCallback && resizeObserverTarget) resizeObserverCallback([{ target: journeyContent }]);
    },
    fireWindowEvent(type) {
      for (const listener of windowListeners.get(type) || []) listener({ type });
    },
    setScroll(x, y) {
      window.scrollX = x;
      window.pageXOffset = x;
      window.scrollY = y;
      window.pageYOffset = y;
    },
    setLayoutWidth(width) {
      layoutWidth = width;
      document.documentElement.clientWidth = width;
    },
    setLayoutHeight(height) {
      layoutHeight = height;
    },
    setAnchorYs(nextAnchors) {
      anchorYs = nextAnchors.slice();
    },
    fireDocumentEvent(type) {
      for (const listener of documentListeners.get(type) || []) listener({ type });
    },
    flushAnimationFrames() {
      const pending = Array.from(animationFrames.values());
      animationFrames.clear();
      for (const callback of pending) callback();
    }
  };
}

function testDocumentCoordinatesUseCanvasOrigin() {
  const harness = createHarness();
  harness.operations.length = 0;

  harness.trail.stamp({ x: 116, y: 147, hue: 180 });

  const arc = harness.operations.find((operation) => operation[0] === 'arc');
  const exclusion = harness.operations.find((operation) =>
    operation[0] === 'rect' && operation[3] === 48 && operation[4] === 38
  );
  assert.deepEqual(arc.slice(1, 3), [100, 100], 'stamp must subtract the canvas document origin');
  assert.deepEqual(exclusion.slice(1), [86, 86, 48, 38], 'exclusions must use the same canvas-local origin');
}

function testStampsReuseExclusionsUntilResize() {
  const harness = createHarness();
  assert.equal(harness.selectorQueryCount(), 1, 'initial resize must build exclusions once');

  harness.trail.stamp({ x: 30, y: 70, hue: 20 });
  harness.trail.stamp({ x: 60, y: 90, hue: 40 });
  assert.equal(harness.selectorQueryCount(), 1, 'stamps must use cached exclusions');

  harness.trail.resize();
  assert.equal(harness.selectorQueryCount(), 2, 'resize must rebuild exclusions once');
  harness.trail.stamp({ x: 90, y: 110, hue: 60 });
  assert.equal(harness.selectorQueryCount(), 2, 'stamps must reuse the rebuilt cache');
}

function testStampBatchSharesOneProtectionPass() {
  const harness = createHarness();
  const points = Array.from({ length: 100 }, (_, index) => ({
    x: 30 + index,
    y: 70 + index,
    hue: index * 3,
    radius: 4,
    alpha: 0.4
  }));
  harness.operations.length = 0;

  assert.equal(typeof harness.trail.stampBatch, 'function', 'trail must expose batched particle impacts');
  harness.trail.stampBatch(points, points.length);

  assert.equal(harness.operations.filter((operation) => operation[0] === 'clip').length, 1,
    'one collision frame must share one content-protection clip');
  assert.equal(harness.operations.filter((operation) => operation[0] === 'arc').length, 100,
    'batching must preserve every landed paint mark');
}

function testResizeCanShrinkPastTheOldCanvasWidth() {
  const harness = createHarness({ dynamicDocumentWidth: true });
  harness.canvas.style.width = '1280px';

  harness.trail.resize();

  assert.equal(harness.canvas.style.width, '800px',
    'measurement must exclude the old backing canvas so a narrower viewport can shrink cleanly');
}

function testSameSizeResizeKeepsTheExistingBackingStore() {
  const harness = createHarness();
  const firstWidth = harness.canvas.width;
  const firstHeight = harness.canvas.height;
  harness.operations.length = 0;

  harness.trail.resize();

  assert.equal(harness.canvas.width, firstWidth, 'same-size resize must keep the existing backing width');
  assert.equal(harness.canvas.height, firstHeight, 'same-size resize must keep the existing backing height');
  assert.equal(harness.operations.filter((operation) => operation[0] === 'drawImage').length, 0,
    'same-size resize must not allocate and copy a document-sized temporary canvas');
}

function testContourFieldUsesOneOpaqueNestedSurface() {
  const harness = createHarness();
  harness.operations.length = 0;

  assert.equal(typeof harness.trail.contourField, 'function',
    'trail must expose a coherent still contour-field primitive');
  harness.trail.contourField({
    from: { x: 980, y: 400 },
    to: { x: 80, y: 460 },
    width: 280,
    hue: 228,
    seed: 3,
    layers: 6
  });

  const clips = harness.operations.filter((operation) => operation[0] === 'clip');
  const curves = harness.operations.filter((operation) => operation[0] === 'bezierCurveTo');
  const strokes = harness.operations.filter((operation) => operation[0] === 'stroke');
  const widths = harness.operations.filter((operation) => operation[0] === 'lineWidth')
    .map((operation) => operation[1]);
  const colors = harness.operations.filter((operation) => operation[0] === 'strokeStyle')
    .map((operation) => String(operation[1]));
  const composites = harness.operations.filter((operation) => operation[0] === 'composite')
    .map((operation) => operation[1]);
  const shadowBlur = harness.operations.filter((operation) => operation[0] === 'shadowBlur')
    .map((operation) => operation[1]);

  assert.equal(clips.length, 1,
    'one complete contour surface must share one content-protection clip');
  assert.equal(curves.length, 1,
    'all nested strata must reuse one stable cubic centerline');
  assert.equal(strokes.length, 8,
    'one outer shadow, six pigment strata, and one restrained highlight must form the surface');
  assert.ok(widths.slice(1, 7).every((value, index, values) => index === 0 || value < values[index - 1]),
    'the six opaque pigment strata must descend cleanly from broad to narrow');
  assert.ok(colors.every((color) => color.startsWith('rgb(') && !color.startsWith('rgba(')),
    'the still field must use opaque grounded RGB pigments instead of translucent accumulation');
  assert.ok(new Set(colors.slice(1, 7)).size >= 5,
    'neighboring contour strata must carry materially distinct pigments');
  assert.ok(shadowBlur.some((value) => value > 0),
    'the outer contour must receive one dimensional wet shadow');
  assert.ok(widths.at(-1) <= 10,
    'the pearlescent highlight must stay narrow and restrained');
  assert.ok(!composites.includes('multiply'),
    'the coherent fallback body must not compound overlapping multiply strokes');
}

function testStaticSpectrumUsesOneFieldPerSemanticBandAndConnector() {
  const harness = createHarness();
  harness.operations.length = 0;

  harness.trail.drawStaticSpectrum([
    { y: 120 }, { y: 430 }, { y: 760 },
    { y: 1090 }, { y: 1420 }, { y: 1750 }
  ]);

  const broadStrokes = harness.operations.filter((operation) =>
    operation[0] === 'lineWidth' && operation[1] >= 110
  );
  const cubicPaths = harness.operations.filter((operation) => operation[0] === 'bezierCurveTo');
  const clips = harness.operations.filter((operation) => operation[0] === 'clip');
  assert.ok(broadStrokes.length >= 6,
    'the reduced-motion composition must wash broad pigment through every semantic page band');
  assert.equal(cubicPaths.length, 11,
    'six semantic bands and five adjacent connectors must each use one stable cubic field');
  assert.equal(clips.length, 11,
    'every bounded field must use exactly one protection pass');

  const staticStart = source.indexOf('function drawStaticSpectrum');
  const staticEnd = source.indexOf('function clear', staticStart);
  const staticBody = source.slice(staticStart, staticEnd);
  assert.match(staticBody, /contourField\s*\(/,
    'the still spectrum must be composed from coherent contour surfaces');
  assert.doesNotMatch(staticBody, /\bflow\s*\(/,
    'the still spectrum must not recreate translucent capsule accumulation');
}

function testScrollRefreshesExclusionsOncePerFrame() {
  const fixedRect = { left: 111, top: 50, width: 20, height: 10 };
  const harness = createHarness({ contentRect: () => fixedRect });
  assert.equal(harness.selectorQueryCount(), 1, 'initial resize must build exclusions once');

  harness.setScroll(5, 107);
  harness.fireWindowEvent('scroll');
  harness.fireWindowEvent('scroll');
  assert.equal(harness.selectorQueryCount(), 1, 'scroll refresh must wait for animation frame');

  harness.flushAnimationFrames();
  assert.equal(harness.selectorQueryCount(), 2, 'scroll events in one frame must share one refresh');
  const refreshedClear = harness.operations.filter((operation) => operation[0] === 'clearRect').at(-1);
  assert.deepEqual(refreshedClear.slice(1), [86, 96, 48, 38], 'fixed exclusion must follow scroll position');
  harness.trail.stamp({ x: 40, y: 80, hue: 80 });
  assert.equal(harness.selectorQueryCount(), 2, 'paint must reuse the refreshed exclusions');
}

function testContentResizeRefreshesExclusions() {
  const harness = createHarness();
  assert.equal(harness.resizeObserverTarget(), harness.journeyContent, 'journey content must be observed');

  harness.triggerContentResize();
  assert.equal(harness.selectorQueryCount(), 1, 'content resize must wait for animation frame');
  harness.flushAnimationFrames();
  assert.equal(harness.selectorQueryCount(), 2, 'content resize must rebuild exclusions');
}

function testDetailsToggleRefreshesExclusions() {
  const harness = createHarness();

  harness.fireDocumentEvent('toggle');
  assert.equal(harness.selectorQueryCount(), 1, 'details toggle must wait for animation frame');
  harness.flushAnimationFrames();
  assert.equal(harness.selectorQueryCount(), 2, 'details toggle must rebuild exclusions');
}

function testFreezeStopsContentMaintenanceButKeepsCanvasResponsive() {
  const harness = createHarness({
    dynamicDocumentWidth: true,
    dynamicDocumentHeight: true,
    layoutWidth: 1200,
    layoutHeight: 2000
  });
  const height = harness.canvas.height;
  const queryCount = harness.selectorQueryCount();

  assert.equal(typeof harness.trail.freeze, 'function', 'persistent trail must expose maintenance shutdown');
  harness.trail.freeze();
  harness.fireWindowEvent('scroll');
  harness.fireDocumentEvent('toggle');
  harness.triggerContentResize();
  harness.flushAnimationFrames();

  assert.equal(harness.selectorQueryCount(), queryCount,
    'frozen trail must stop observer, scroll, and content exclusion work');
  assert.equal(harness.canvas.height, height, 'freeze must retain the painted backing store');

  harness.operations.length = 0;
  harness.setLayoutHeight(2400);
  harness.triggerContentResize();
  harness.flushAnimationFrames();

  assert.equal(harness.canvas.style.height, '2400px',
    'completed paint must extend its backing canvas when content grows');
  const heightPreservation = harness.operations.find((operation) => operation[0] === 'drawImage');
  assert.deepEqual(heightPreservation.slice(-2), [1200, 2000],
    'content growth must preserve existing document-y coordinates instead of stretching the artwork');
  assert.equal(harness.selectorQueryCount(), queryCount,
    'post-completion content sizing must remain independent of exclusion scans');

  harness.operations.length = 0;
  harness.setLayoutWidth(400);
  harness.fireWindowEvent('resize');
  harness.flushAnimationFrames();

  assert.equal(harness.canvas.style.width, '400px',
    'a frozen trail must shrink with the viewport instead of creating horizontal overflow');
  assert.equal(harness.selectorQueryCount(), queryCount,
    'post-completion viewport maintenance must not resume costly exclusion scanning');
  const preservedPaint = harness.operations.find((operation) => operation[0] === 'drawImage');
  assert.ok(preservedPaint,
    'responsive resizing must preserve the completed paint rather than clearing it');
  assert.equal(preservedPaint.length, 10,
    'responsive preservation must proportionally map the full old canvas into the new canvas');
  assert.deepEqual(preservedPaint.slice(-2), [400, 2400],
    'horizontal remapping must retain right-edge paint without distorting document-y positions');
}

function testCompletedPaintReflowsBetweenSemanticAnchors() {
  const harness = createHarness({
    dynamicDocumentWidth: true,
    dynamicDocumentHeight: true,
    layoutWidth: 390,
    layoutHeight: 2200,
    anchorYs: [120, 520, 980, 1500, 1900, 2160]
  });
  const queryCount = harness.selectorQueryCount();

  harness.trail.freeze();
  harness.operations.length = 0;
  harness.setLayoutHeight(2580);
  harness.setAnchorYs([120, 520, 980, 1500, 2280, 2540]);
  harness.triggerContentResize();
  harness.flushAnimationFrames();

  const copies = harness.operations.filter((operation) => operation[0] === 'drawImage');
  assert.ok(copies.length >= 6,
    'settled artwork must be remapped in semantic page bands rather than copied as one detached bitmap');
  const bottomBand = copies.at(-1);
  assert.deepEqual(bottomBand.slice(-4), [0, 2493, 390, 87],
    'paint at the old finale must follow the finale below newly expanded content');
  assert.equal(harness.selectorQueryCount(), queryCount,
    'semantic reflow must stay lightweight after completion');
}

function testFullDocumentCanvasUsesAPixelBudget() {
  assert.match(source, /pixelBudget/,
    'the persistent full-page trail must clamp its backing store with a pixel budget');
}

function testWhorlDrawsConnectedPigmentStroke() {
  const harness = createHarness();
  harness.operations.length = 0;

  harness.trail.whorl({ x: 60, y: 90, hue: 25, radius: 48, turns: 1.4, width: 14 });

  const moves = harness.operations.filter((operation) => operation[0] === 'moveTo');
  const lines = harness.operations.filter((operation) => operation[0] === 'lineTo');
  const strokes = harness.operations.filter((operation) => operation[0] === 'stroke');
  assert.ok(moves.length >= 12, 'whorl must build multiple connected spectrum segments');
  assert.ok(lines.length >= 12, 'whorl must draw connected line segments');
  assert.ok(strokes.length >= 12, 'whorl must advance color along the spectrum');
}

function testImpactCreatesWetPoolDripsAndSatelliteSplatter() {
  const harness = createHarness();
  harness.operations.length = 0;

  assert.equal(typeof harness.trail.impact, 'function', 'trail must expose an impact painter');
  harness.trail.impact({ x: 90, y: 120, hue: 22, radius: 64, direction: -1 });

  const ellipses = harness.operations.filter((operation) => operation[0] === 'ellipse');
  const strokes = harness.operations.filter((operation) => operation[0] === 'stroke');
  const colors = harness.operations.filter((operation) => operation[0] === 'colorStop');
  assert.ok(ellipses.length >= 8, 'impact must combine a pooled body with satellite droplets');
  assert.ok(strokes.length >= 3, 'impact must create gravity-driven wet drips');
  assert.ok(colors.some((operation) => String(operation[2]).startsWith('rgba(')),
    'paint must use a grounded pigment palette rather than synthetic HSL neon');
}

function testVeilSpreadsTranslucentPaintAcrossThePage() {
  const harness = createHarness();
  harness.operations.length = 0;

  assert.equal(typeof harness.trail.veil, 'function', 'trail must expose a broad spray veil');
  harness.trail.veil({
    from: { x: 920, y: 160 },
    to: { x: 280, y: 205 },
    hue: 190,
    width: 150,
    alpha: 0.22
  });

  const ellipses = harness.operations.filter((operation) => operation[0] === 'ellipse');
  const curves = harness.operations.filter((operation) => operation[0] === 'bezierCurveTo');
  const lineWidths = harness.operations.filter((operation) => operation[0] === 'lineWidth');
  assert.ok(ellipses.length >= 16, 'veil must layer enough translucent pigment to read as a broad field');
  assert.ok(curves.length >= 1, 'veil must include a directional gestural sweep');
  assert.ok(lineWidths.every((operation) => operation[1] <= 24),
    'veil must read as atomized pigment rather than a repeated opaque bar');
  assert.doesNotMatch(source, /hue\s*\+\s*mote\s*\*\s*11\.5/,
    'veil droplets must follow the gesture color instead of becoming random rainbow confetti');
  assert.doesNotMatch(source, /hue\s*\+\s*satellite\s*\*\s*19/,
    'impact satellites must remain in the pool pigment family for realistic paint behavior');
}

function testFluidCurrentLayersRichWetPigmentAtBoundedCost() {
  const harness = createHarness();
  harness.operations.length = 0;

  assert.equal(typeof harness.trail.flow, 'function',
    'trail must expose one authored fluid-current primitive');
  harness.trail.flow({
    from: { x: 960, y: 180 },
    to: { x: 90, y: 260 },
    hue: 226,
    width: 280,
    progress: 0.72,
    seed: 4
  });

  const curves = harness.operations.filter((operation) => operation[0] === 'bezierCurveTo');
  const strokes = harness.operations.filter((operation) => operation[0] === 'stroke');
  const widths = harness.operations.filter((operation) => operation[0] === 'lineWidth').map((operation) => operation[1]);
  const colors = harness.operations.filter((operation) => operation[0] === 'strokeStyle').map((operation) => operation[1]);
  const composites = harness.operations.filter((operation) => operation[0] === 'composite').map((operation) => operation[1]);
  const ellipses = harness.operations.filter((operation) => operation[0] === 'ellipse');

  assert.ok(curves.length >= 4, 'underwash, pigment body, wet edge, and glint must share a fluid cubic path');
  assert.ok(strokes.length >= 4 && strokes.length <= 10,
    'a fluid current must be visibly layered while retaining a fixed drawing budget');
  assert.ok(Math.max(...widths) >= 220 && Math.min(...widths) <= 24,
    'the current must combine site-wide coverage with a fine wet highlight');
  assert.ok(colors.every((color) => String(color).startsWith('rgba(')),
    'all fluid layers must use the grounded RGB pigment palette');
  assert.ok(new Set(colors).size >= 4,
    'the pigment body, edge, underwash, and glint must carry distinct tonal depth');
  assert.ok(composites.includes('multiply') && composites.includes('screen'),
    'wet pigment depth must combine absorbent multiply layers with a restrained surface glint');
  assert.ok(ellipses.length >= 3 && ellipses.length <= 16,
    'the current needs a few bounded eddies and droplets rather than random confetti');
}

testDocumentCoordinatesUseCanvasOrigin();
testStampsReuseExclusionsUntilResize();
testStampBatchSharesOneProtectionPass();
testResizeCanShrinkPastTheOldCanvasWidth();
testSameSizeResizeKeepsTheExistingBackingStore();
testContourFieldUsesOneOpaqueNestedSurface();
testStaticSpectrumUsesOneFieldPerSemanticBandAndConnector();
testScrollRefreshesExclusionsOncePerFrame();
testContentResizeRefreshesExclusions();
testDetailsToggleRefreshesExclusions();
testFreezeStopsContentMaintenanceButKeepsCanvasResponsive();
testCompletedPaintReflowsBetweenSemanticAnchors();
testFullDocumentCanvasUsesAPixelBudget();
testWhorlDrawsConnectedPigmentStroke();
testImpactCreatesWetPoolDripsAndSatelliteSplatter();
testVeilSpreadsTranslucentPaintAcrossThePage();
testFluidCurrentLayersRichWetPigmentAtBoundedCost();

console.log('PASS: paint journey trail behavior');
