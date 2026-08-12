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

  function createContext(recordOperations) {
    const record = recordOperations ? operations : [];
    return {
      save() {},
      restore() {},
      beginPath() {},
      rect(...args) { record.push(['rect', ...args]); },
      clip() {},
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
      drawImage() {},
      setTransform(...args) { record.push(['setTransform', ...args]); },
      set lineWidth(value) { record.push(['lineWidth', value]); },
      set strokeStyle(value) { record.push(['strokeStyle', value]); },
      set fillStyle(value) { record.push(['fillStyle', value]); }
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
    documentElement: { scrollWidth: 1000, scrollHeight: 2000, clientWidth: 800, clientHeight: 600 },
    body: { scrollWidth: 1000, scrollHeight: 2000 },
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
      ? 800
      : Math.max(800, Number.parseFloat(canvas.style.width) || 0);
    Object.defineProperty(document.documentElement, 'scrollWidth', { get: measuredWidth });
    Object.defineProperty(document.body, 'scrollWidth', { get: measuredWidth });
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
  const trail = window.PaintJourney.createTrail({ canvas });
  return {
    operations,
    canvas,
    trail,
    selectorQueryCount: () => selectorQueries,
    journeyContent,
    resizeObserverTarget: () => resizeObserverTarget,
    triggerContentResize() {
      if (resizeObserverCallback) resizeObserverCallback([{ target: journeyContent }]);
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

function testResizeCanShrinkPastTheOldCanvasWidth() {
  const harness = createHarness({ dynamicDocumentWidth: true });
  harness.canvas.style.width = '1280px';

  harness.trail.resize();

  assert.equal(harness.canvas.style.width, '800px',
    'measurement must exclude the old backing canvas so a narrower viewport can shrink cleanly');
}

function testStaticSpectrumUsesLocalExclusions() {
  const harness = createHarness({
    contentRect: { left: 15, top: 83, width: 16, height: 20 }
  });
  harness.operations.length = 0;

  harness.trail.drawStaticSpectrum([{ y: 100 }, { y: 200 }]);

  const firstArc = harness.operations.find((operation) => operation[0] === 'arc');
  assert.deepEqual(firstArc.slice(1, 3), [12, 95], 'edge lane must move below a local exclusion zone');
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

function testFullDocumentCanvasUsesAPixelBudget() {
  assert.match(source, /pixelBudget/,
    'the persistent full-page trail must clamp its backing store with a pixel budget');
}

function testWhorlDrawsConnectedFullSpectrumStroke() {
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

testDocumentCoordinatesUseCanvasOrigin();
testStampsReuseExclusionsUntilResize();
testResizeCanShrinkPastTheOldCanvasWidth();
testStaticSpectrumUsesLocalExclusions();
testScrollRefreshesExclusionsOncePerFrame();
testContentResizeRefreshesExclusions();
testDetailsToggleRefreshesExclusions();
testFullDocumentCanvasUsesAPixelBudget();
testWhorlDrawsConnectedFullSpectrumStroke();
testImpactCreatesWetPoolDripsAndSatelliteSplatter();
testVeilSpreadsTranslucentPaintAcrossThePage();

console.log('PASS: paint journey trail behavior');
