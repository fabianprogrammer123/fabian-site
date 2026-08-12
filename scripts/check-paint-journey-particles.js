#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/paint-journey-particles.js'), 'utf8');

class BufferAttribute {
  constructor(array, itemSize) {
    this.array = array;
    this.itemSize = itemSize;
    this.needsUpdate = false;
  }
}

class BufferGeometry {
  constructor() {
    this.attributes = {};
    this.drawRange = { start: 0, count: 0 };
  }

  setAttribute(name, attribute) {
    this.attributes[name] = attribute;
  }

  setDrawRange(start, count) {
    this.drawRange = { start, count };
  }

  dispose() {}
}

class PointsMaterial {
  constructor(options = {}) {
    Object.assign(this, options);
  }

  dispose() {}
}

class Points {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.parent = null;
  }
}

class Color {
  setHSL(hue, saturation, lightness) {
    this.r = hue;
    this.g = saturation;
    this.b = lightness;
  }
}

class Vector3 {
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
}

const THREE = { BufferAttribute, BufferGeometry, PointsMaterial, Points, Color, Vector3 };

function createParticles() {
  const window = {};
  const scene = {
    children: [],
    add(object) {
      object.parent = this;
      this.children.push(object);
    },
    remove(object) {
      object.parent = null;
      this.children = this.children.filter((child) => child !== object);
    }
  };
  const trail = { stamp() {} };
  vm.runInNewContext(source, { window, Math, Number, Object, Boolean, Float32Array, Error });
  return { particles: window.PaintJourney.createParticles({ THREE, scene, trail, capacity: 12 }), scene };
}

function testClearImmediatelyRetiresActiveParticlesWithoutDisposal() {
  const { particles, scene } = createParticles();

  particles.emit({ origin: { x: 5, y: 8, z: 10 }, count: 5 });
  assert.equal(particles.activeCount, 5, 'fixture must contain active particles before cancellation');

  particles.clear();

  assert.equal(particles.activeCount, 0, 'clear must immediately retire every live particle');
  assert.equal(scene.children.length, 1, 'clear must preserve the particle renderer for the resting pose');

  particles.emit({ origin: { x: 5, y: 8, z: 10 }, count: 2 });
  assert.equal(particles.activeCount, 2, 'the pool must remain reusable after clear');
}

function testActivePaintUsesVisibleDropletScaleAndFullSpectrumBurst() {
  const { particles, scene } = createParticles();
  const points = scene.children[0];

  assert.ok(points.material.size >= 7, 'desktop paint droplets must read as a viscous stream, not pixel confetti');
  assert.ok(points.material.opacity >= 0.92, 'active paint must remain richly saturated');
  particles.burst({ origin: { x: 5, y: 8, z: 10 }, count: 12, hue: 0 });
  const hues = Array.from(points.geometry.attributes.color.array).filter((value, index) => index % 3 === 0);
  assert.ok(Math.max(...hues) - Math.min(...hues) > 0.6, 'one strong bucket swing must visibly span most of the spectrum');
}

testClearImmediatelyRetiresActiveParticlesWithoutDisposal();
testActivePaintUsesVisibleDropletScaleAndFullSpectrumBurst();

console.log('PASS: paint journey particle behavior');
