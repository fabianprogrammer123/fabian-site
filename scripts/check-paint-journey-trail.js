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
      return options.contentRect || { left: 111, top: 140, width: 20, height: 10 };
    }
  };
  const document = {
    documentElement: { scrollWidth: 1000, scrollHeight: 2000, clientWidth: 800, clientHeight: 600 },
    body: { scrollWidth: 1000, scrollHeight: 2000 },
    querySelectorAll() {
      selectorQueries += 1;
      return [content];
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
    requestAnimationFrame() { return 1; },
    cancelAnimationFrame() {},
    addEventListener() {},
    removeEventListener() {}
  };

  vm.runInNewContext(source, { window, document });
  const trail = window.PaintJourney.createTrail({ canvas });
  return { operations, trail, selectorQueryCount: () => selectorQueries };
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

testDocumentCoordinatesUseCanvasOrigin();
testStampsReuseExclusionsUntilResize();
testStaticSpectrumUsesLocalExclusions();

console.log('PASS: paint journey trail behavior');
