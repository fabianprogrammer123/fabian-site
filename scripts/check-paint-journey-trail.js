#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/paint-journey-trail.js'), 'utf8');

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
        return { addColorStop() {} };
      },
      arc(...args) { record.push(['arc', ...args]); },
      fill() {},
      fillRect(...args) { record.push(['fillRect', ...args]); },
      drawImage() {},
      setTransform(...args) { record.push(['setTransform', ...args]); }
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

testDocumentCoordinatesUseCanvasOrigin();
testStampsReuseExclusionsUntilResize();
testStaticSpectrumUsesLocalExclusions();
testScrollRefreshesExclusionsOncePerFrame();
testContentResizeRefreshesExclusions();
testDetailsToggleRefreshesExclusions();

console.log('PASS: paint journey trail behavior');
