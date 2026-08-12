#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/paint-journey-rope.js'), 'utf8');

class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.set(x, y, z);
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  copy(value) {
    return this.set(value.x, value.y, value.z);
  }

  clone() {
    return new Vector3(this.x, this.y, this.z);
  }

  lerp(value, amount) {
    this.x += (value.x - this.x) * amount;
    this.y += (value.y - this.y) * amount;
    this.z += (value.z - this.z) * amount;
    return this;
  }

  subVectors(a, b) {
    return this.set(a.x - b.x, a.y - b.y, a.z - b.z);
  }

  addVectors(a, b) {
    return this.set(a.x + b.x, a.y + b.y, a.z + b.z);
  }

  multiplyScalar(value) {
    this.x *= value;
    this.y *= value;
    this.z *= value;
    return this;
  }

  length() {
    return Math.hypot(this.x, this.y, this.z);
  }

  normalize() {
    const length = this.length() || 1;
    return this.multiplyScalar(1 / length);
  }
}

class Quaternion {
  constructor() {
    this.alignmentCount = 0;
  }

  setFromUnitVectors() {
    this.alignmentCount += 1;
    return this;
  }

  copy(value) {
    this.alignmentCount = value.alignmentCount;
    return this;
  }
}

class Object3D {
  constructor() {
    this.name = '';
    this.position = new Vector3();
    this.scale = new Vector3(1, 1, 1);
    this.quaternion = new Quaternion();
    this.children = [];
    this.parent = null;
    this.visible = true;
  }

  add(object) {
    object.parent = this;
    this.children.push(object);
  }

  remove(object) {
    object.parent = null;
    this.children = this.children.filter((child) => child !== object);
  }
}

class Group extends Object3D {}

class Geometry {
  constructor(...args) {
    this.args = args;
    this.disposeCount = 0;
  }

  dispose() {
    this.disposeCount += 1;
  }
}

class BufferGeometry extends Geometry {
  constructor() {
    super();
    this.attributes = {};
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  setDrawRange() {}

  computeBoundingSphere() {}
}

class BufferAttribute {
  constructor(array, itemSize) {
    this.array = array;
    this.itemSize = itemSize;
    this.needsUpdate = false;
  }
}

class Material {
  constructor(options = {}) {
    Object.assign(this, options);
    this.disposeCount = 0;
  }

  dispose() {
    this.disposeCount += 1;
  }
}

class Mesh extends Object3D {
  constructor(geometry, material) {
    super();
    this.geometry = geometry;
    this.material = material;
  }
}

class Line extends Object3D {
  constructor(geometry, material) {
    super();
    this.geometry = geometry;
    this.material = material;
  }
}

class CatmullRomCurve3 {
  constructor(points) {
    this.points = points;
  }

  getPoint(progress, target) {
    const scaled = progress * (this.points.length - 1);
    const index = Math.min(this.points.length - 2, Math.floor(scaled));
    const amount = scaled - index;
    return target.copy(this.points[index]).lerp(this.points[index + 1], amount);
  }
}

const THREE = {
  Vector3,
  Group,
  Object3D,
  Mesh,
  CylinderGeometry: Geometry,
  MeshStandardMaterial: Material,
  MeshBasicMaterial: Material,
  BufferGeometry,
  BufferAttribute,
  LineBasicMaterial: Material,
  Line,
  CatmullRomCurve3
};

function createRope() {
  const window = {};
  const scene = new Group();
  vm.runInNewContext(source, {
    window,
    Math,
    Number,
    Object,
    Float32Array,
    Error
  });
  return {
    rope: window.PaintJourney.createRope({ THREE, scene, segments: 8 }),
    scene
  };
}

function testRopeUsesDimensionalSegmentMeshes() {
  const { scene } = createRope();
  const ropeGroup = scene.children[0];

  assert.ok(ropeGroup instanceof Group, 'rope root must be a Three.js group');
  assert.equal(ropeGroup.name, 'paint-journey-rope');
  assert.equal(ropeGroup.children.length, 16, 'each curve span needs a body and highlight mesh');
  assert.ok(ropeGroup.children.every((child) => child instanceof Mesh),
    'the rope must render with dimensional meshes instead of one-pixel lines');
  assert.ok(ropeGroup.children[0].geometry.args[0] > 1,
    'the rope body needs a visible world-space radius');
  assert.ok(ropeGroup.children[0].material instanceof Material,
    'the rope body needs a light-reactive material');
  assert.ok(ropeGroup.children[1].material.color !== ropeGroup.children[0].material.color,
    'the highlight stripe must contrast with the rope body');
}

function testThrowUpdatesVisibleSegmentsAndCatches() {
  const { rope, scene } = createRope();
  const ropeGroup = scene.children[0];

  rope.throwBetween({ x: 10, y: 20, z: 3 }, { x: 130, y: 180, z: 5 }, 0.1);
  rope.update(0.05);

  assert.equal(ropeGroup.visible, true, 'throwing must reveal the rope group');
  assert.ok(ropeGroup.children.every((segment) => segment.visible),
    'every pooled span must be visible during a throw');
  assert.ok(ropeGroup.children[0].scale.y > 1,
    'segment length must follow the sampled curve');
  assert.ok(ropeGroup.children[0].quaternion.alignmentCount > 0,
    'segments must align their cylinder axis to the curve');

  rope.update(0.05);
  assert.equal(rope.caught, true, 'the rope must catch when its ballistic throw completes');
}

function testHideReuseAndDispose() {
  const { rope, scene } = createRope();
  const ropeGroup = scene.children[0];
  const geometries = new Set(ropeGroup.children.map((child) => child.geometry));
  const materials = new Set(ropeGroup.children.map((child) => child.material));

  rope.hide();
  assert.equal(ropeGroup.visible, false, 'hide must remove the rope from view');

  rope.setEndpoints({ x: 4, y: 5, z: 0 }, { x: 45, y: 85, z: 0 });
  rope.update(0.016);
  assert.equal(ropeGroup.visible, true, 'setEndpoints must reuse and reveal the pool');

  rope.dispose();
  assert.equal(scene.children.length, 0, 'dispose must remove the rope group from its scene');
  geometries.forEach((geometry) => assert.equal(geometry.disposeCount, 1));
  materials.forEach((material) => assert.equal(material.disposeCount, 1));
}

testRopeUsesDimensionalSegmentMeshes();
testThrowUpdatesVisibleSegmentsAndCatches();
testHideReuseAndDispose();

console.log('PASS: paint journey rope behavior');
