#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const ladderPath = path.join(root, 'assets/paint-journey-ladder.js');
assert.ok(fs.existsSync(ladderPath), 'missing assets/paint-journey-ladder.js');
const source = fs.readFileSync(ladderPath, 'utf8');

class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(value) { return this.set(value.x, value.y, value.z); }
  clone() { return new Vector3(this.x, this.y, this.z); }
  subVectors(a, b) { return this.set(a.x - b.x, a.y - b.y, a.z - b.z); }
  addVectors(a, b) { return this.set(a.x + b.x, a.y + b.y, a.z + b.z); }
  multiplyScalar(value) { this.x *= value; this.y *= value; this.z *= value; return this; }
  length() { return Math.hypot(this.x, this.y, this.z); }
}

class Quaternion {
  constructor() { this.alignmentCount = 0; }
  setFromUnitVectors() { this.alignmentCount += 1; return this; }
  copy(value) { this.alignmentCount = value.alignmentCount; return this; }
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
  add(object) { object.parent = this; this.children.push(object); }
  remove(object) { object.parent = null; this.children = this.children.filter((child) => child !== object); }
  updateMatrix() {
    this.matrix = {
      position: this.position.clone(),
      scale: this.scale.clone(),
      quaternion: { alignmentCount: this.quaternion.alignmentCount }
    };
  }
}

class Group extends Object3D {}
class Geometry {
  constructor(...args) { this.args = args; this.disposeCount = 0; }
  dispose() { this.disposeCount += 1; }
}
class Material {
  constructor(options = {}) { Object.assign(this, options); this.disposeCount = 0; }
  dispose() { this.disposeCount += 1; }
}
class Mesh extends Object3D {
  constructor(geometry, material) { super(); this.geometry = geometry; this.material = material; }
}
class InstancedMesh extends Mesh {
  constructor(geometry, material, capacity) {
    super(geometry, material);
    this.capacity = capacity;
    this.count = 0;
    this.matrices = [];
    this.instanceMatrix = { needsUpdate: false };
  }
  setMatrixAt(index, matrix) {
    this.matrices[index] = {
      position: matrix.position.clone(),
      scale: matrix.scale.clone(),
      quaternion: { alignmentCount: matrix.quaternion.alignmentCount }
    };
  }
}

const THREE = {
  Vector3,
  Group,
  Object3D,
  Mesh,
  InstancedMesh,
  CylinderGeometry: Geometry,
  MeshStandardMaterial: Material,
  MeshBasicMaterial: Material
};

function createLadder(overrides = {}) {
  const window = {};
  const scene = new Group();
  vm.runInNewContext(source, { window, Math, Number, Object, Array, Error });
  return {
    ladder: window.PaintJourney.createLadder({
      THREE,
      scene,
      maxRungs: 12,
      width: 24,
      rungSpacing: 20,
      ...overrides
    }),
    scene
  };
}

function testLadderUsesDimensionalRailsAndRungs() {
  const { scene } = createLadder();
  const group = scene.children[0];
  const railBodies = group.children.filter((child) => child.name.startsWith('ladder-rail-body'));
  const rungBodies = group.children.filter((child) => child.name === 'ladder-rungs');

  assert.ok(group instanceof Group, 'ladder root must be a Three.js group');
  assert.equal(group.name, 'paint-journey-ladder');
  assert.equal(railBodies.length, 2, 'ladder must have two dimensional rails');
  assert.equal(rungBodies.length, 1, 'all ladder rungs must share one instanced draw call');
  assert.ok(rungBodies[0] instanceof InstancedMesh,
    'dense ladder rungs must use Three.js instancing');
  assert.ok(railBodies.concat(rungBodies).every((mesh) => mesh instanceof Mesh),
    'rails and rungs must render as real meshes');
  assert.ok(rungBodies[0].capacity >= 64,
    'the one instanced rung pool must cover long mobile climbs without allocating new meshes');
}

function testDeploymentExtendsFromTheGround() {
  const { ladder, scene } = createLadder();
  const group = scene.children[0];
  const bottom = { x: 120, y: 30, z: 4 };
  const top = { x: 120, y: 270, z: 4 };

  ladder.setSpan(bottom, top, { progress: 0.5, anchor: 'bottom' });
  const rungInstances = group.children.find((child) => child.name === 'ladder-rungs');
  const rails = group.children.filter((child) => child.name.startsWith('ladder-rail-body'));

  assert.equal(group.visible, true, 'deployment must reveal the ladder');
  assert.ok(rungInstances.count >= 4 && rungInstances.count < 12,
    'partial deployment must reveal only reached rungs');
  assert.ok(rails.every((rail) => rail.scale.y > 100 && rail.scale.y < 140),
    'rail length must reflect partial vertical deployment');
  assert.ok(rails.every((rail) => rail.quaternion.alignmentCount > 0),
    'rails must align to the climb span');
}

function testTopAnchoredRetractionHideAndDispose() {
  const { ladder, scene } = createLadder();
  const group = scene.children[0];
  ladder.setSpan({ x: 90, y: 20, z: 2 }, { x: 90, y: 220, z: 2 }, { progress: 0.4, anchor: 'top' });
  const rungInstances = group.children.find((child) => child.name === 'ladder-rungs');
  assert.ok(rungInstances.count > 0, 'top-anchored retraction must keep upper rungs visible');

  ladder.hide();
  assert.equal(group.visible, false, 'hide must remove the ladder from view');
  ladder.dispose();
  assert.equal(scene.children.length, 0, 'dispose must remove the ladder from the scene');
}

function testSpanAnimationReusesScratchVectors() {
  assert.doesNotMatch(source, /direction\.clone\(\)/,
    'ladder deployment must not allocate cloned vectors on every animation frame');
}

function testLongSpanKeepsClimbableRungDensity() {
  const { ladder, scene } = createLadder({ rungSpacing: 18 });
  const group = scene.children[0];

  ladder.setSpan(
    { x: 80, y: 20, z: 2 },
    { x: 80, y: 1040, z: 2 },
    { progress: 1, anchor: 'bottom' }
  );

  const rungInstances = group.children.find((child) => child.name === 'ladder-rungs');
  const visibleRungs = rungInstances.matrices
    .slice(0, rungInstances.count)
    .sort((a, b) => a.position.y - b.position.y);

  assert.ok(visibleRungs.length >= 50,
    'a 1020px climb must retain at least 50 visible rungs');

  const gaps = visibleRungs.slice(1).map((rung, index) =>
    rung.position.y - visibleRungs[index].position.y);
  assert.ok(gaps.every((gap) => gap >= 16 && gap <= 20),
    'long-span rung gaps must stay within the climbable 16-20px range');
}

function testResponsiveMetricsUpdateTheExistingInstancedLadder() {
  const { ladder, scene } = createLadder({ rungSpacing: 21, width: 28 });
  const group = scene.children[0];
  const rungInstances = group.children.find((child) => child.name === 'ladder-rungs');

  assert.equal(typeof ladder.setMetrics, 'function',
    'the active ladder must adapt when the viewport crosses the mobile breakpoint');
  ladder.setMetrics({ rungSpacing: 18, width: 22, railRadius: 1.35, rungRadius: 0.95 });
  ladder.setSpan(
    { x: 80, y: 20, z: 2 },
    { x: 80, y: 380, z: 2 },
    { progress: 1, anchor: 'bottom' }
  );

  assert.equal(rungInstances.count, 20,
    'mobile metrics must immediately use mobile rung cadence');
  assert.ok(rungInstances.matrices[0].scale.y < 25,
    'mobile metrics must narrow the existing ladder without rebuilding meshes');
}

testLadderUsesDimensionalRailsAndRungs();
testDeploymentExtendsFromTheGround();
testTopAnchoredRetractionHideAndDispose();
testSpanAnimationReusesScratchVectors();
testLongSpanKeepsClimbableRungDensity();
testResponsiveMetricsUpdateTheExistingInstancedLadder();

console.log('PASS: paint journey ladder behavior');
