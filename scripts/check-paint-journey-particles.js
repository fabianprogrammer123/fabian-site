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
  static colorSpaces = [];

  setRGB(red, green, blue, colorSpace) {
    this.r = red;
    this.g = green;
    this.b = blue;
    Color.colorSpaces.push(colorSpace);
  }

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

const THREE = {
  BufferAttribute,
  BufferGeometry,
  PointsMaterial,
  Points,
  Color,
  Vector3,
  SRGBColorSpace: 'srgb'
};

function createParticles(options = {}) {
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
  const trail = {
    stamps: [],
    batches: [],
    stamp(point) { this.stamps.push({ ...point }); },
    stampBatch(points, count) {
      this.batches.push(Array.from(points).slice(0, count).map((point) => ({ ...point })));
    }
  };
  vm.runInNewContext(source, { window, Math, Number, Object, Boolean, Float32Array, Error });
  return {
    particles: window.PaintJourney.createParticles({ THREE, scene, trail, capacity: 12, ...options }),
    scene,
    trail
  };
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

function testActivePaintUsesVisibleDropletScaleAndCohesivePigmentBurst() {
  Color.colorSpaces.length = 0;
  const { particles, scene } = createParticles();
  const points = scene.children[0];

  assert.ok(points.material.size >= 7, 'desktop paint droplets must read as a viscous stream, not pixel confetti');
  assert.ok(points.material.opacity >= 0.92, 'active paint must remain richly saturated');
  particles.burst({ origin: { x: 5, y: 8, z: 10 }, count: 12, hue: 0 });
  const values = Array.from(points.geometry.attributes.color.array);
  const reds = values.filter((value, index) => index % 3 === 0);
  const greens = values.filter((value, index) => index % 3 === 1);
  const blues = values.filter((value, index) => index % 3 === 2);
  assert.ok(Math.max(...reds) - Math.min(...reds) > 0.08,
    'one bucket swing must contain natural red pigment variation');
  assert.ok(Math.max(...greens) - Math.min(...greens) > 0.12,
    'one bucket swing must contain natural green pigment variation');
  assert.ok(Math.max(...blues) - Math.min(...blues) > 0.08,
    'one bucket swing must contain natural blue pigment variation');
  assert.ok(Math.max(...greens) < 0.72 && Math.max(...blues) < 0.62,
    'one warm bucket gesture must stay in a cohesive pigment family');
  assert.doesNotMatch(source, /360\s*\/\s*Math\.max\(1,\s*count\)/,
    'individual bursts must not independently cycle through a synthetic full rainbow');
  assert.ok(Color.colorSpaces.length > 0 && Color.colorSpaces.every((value) => value === THREE.SRGBColorSpace),
    'particle pigments must use the same sRGB interpretation as the bucket and 2D trail');
}

function testResponsiveParticleModeUpdatesWithoutReallocatingThePool() {
  const { particles, scene } = createParticles();
  const points = scene.children[0];

  assert.equal(typeof particles.setMobile, 'function',
    'live particles must adapt when the viewport crosses the mobile breakpoint');
  particles.setMobile(true);
  assert.equal(points.material.size, 5.8,
    'desktop-to-mobile resize must immediately use the smaller droplet size');
  particles.setMobile(false);
  assert.equal(points.material.size, 7.8,
    'mobile-to-desktop resize must restore the desktop droplet size');
}

function testSimultaneousCollisionsUseOneTrailBatch() {
  const { particles, trail } = createParticles();
  particles.burst({
    origin: { x: 5, y: 8, z: 1 },
    velocity: { x: 0, y: 0, z: -120 },
    count: 12,
    hue: 30
  });

  particles.update(0.05);

  assert.equal(trail.batches.length, 1, 'all collisions in one update must share one trail batch');
  assert.equal(trail.batches[0].length, 12, 'batching must preserve every collision');
  assert.equal(trail.stamps.length, 0, 'batched collisions must not fall back to per-droplet clipping');
}

function testFluidCollisionCallbackReplacesLegacyCanvasStamps() {
  const impactBatches = [];
  const { particles, trail } = createParticles({
    toDocument(scenePoint, output) {
      output.x = scenePoint.x + 100;
      output.y = 500 - scenePoint.y;
      return output;
    },
    onImpactBatch(points, count) {
      impactBatches.push(Array.from(points).slice(0, count).map((point) => ({
        ...point,
        velocity: { ...point.velocity }
      })));
    }
  });
  particles.burst({
    origin: { x: 5, y: 8, z: 1 },
    velocity: { x: 24, y: -16, z: -120 },
    count: 12,
    hue: 30
  });

  particles.update(0.05);

  assert.equal(impactBatches.length, 1,
    'one collision frame must enter the fluid through one bounded callback batch');
  assert.equal(impactBatches[0].length, 12,
    'the fluid callback must receive every collision in the frame');
  assert.equal(trail.batches.length, 0,
    'fluid-owned collisions must not stamp the legacy Canvas batch');
  assert.equal(trail.stamps.length, 0,
    'fluid-owned collisions must not stamp per-droplet Canvas circles');
  assert.ok(impactBatches[0].every((impact) => impact.x >= 100 && impact.y > 400),
    'collision impacts must be projected into document coordinates before delivery');
  assert.ok(impactBatches[0].every((impact) =>
    Number.isFinite(impact.velocity.x) && Number.isFinite(impact.velocity.y)),
  'each fluid impact must retain the causal projected particle velocity');
}

testClearImmediatelyRetiresActiveParticlesWithoutDisposal();
testActivePaintUsesVisibleDropletScaleAndCohesivePigmentBurst();
testResponsiveParticleModeUpdatesWithoutReallocatingThePool();
testSimultaneousCollisionsUseOneTrailBatch();
testFluidCollisionCallbackReplacesLegacyCanvasStamps();

console.log('PASS: paint journey particle behavior');
