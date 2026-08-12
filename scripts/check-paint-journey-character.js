#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/paint-journey-character.js'), 'utf8');

class Vector {
  constructor(x = 0, y = 0, z = 0) {
    this.set(x, y, z);
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  clone() {
    return new Vector(this.x, this.y, this.z);
  }

  copy(vector) {
    return this.set(vector.x, vector.y, vector.z);
  }
}

class Object3D {
  constructor() {
    this.name = '';
    this.position = new Vector();
    this.rotation = new Vector();
    this.scale = new Vector(1, 1, 1);
    this.children = [];
    this.parent = null;
  }

  add(object) {
    object.parent = this;
    this.children.push(object);
  }

  remove(object) {
    this.children = this.children.filter((child) => child !== object);
    object.parent = null;
  }

  traverse(callback) {
    callback(this);
    this.children.forEach((child) => child.traverse(callback));
  }

  getObjectByName(name) {
    if (this.name === name) return this;
    for (const child of this.children) {
      const match = child.getObjectByName(name);
      if (match) return match;
    }
    return undefined;
  }
}

class Geometry {
  constructor() {
    this.disposeCount = 0;
  }

  dispose() {
    this.disposeCount += 1;
  }
}

class Material {
  constructor(options = {}) {
    Object.assign(this, options);
    if (typeof this.color === 'number') {
      this.color = {
        hue: null,
        setHSL(hue, saturation, lightness) {
          this.hue = hue;
          this.saturation = saturation;
          this.lightness = lightness;
        }
      };
    }
    this.disposeCount = 0;
  }

  clone() {
    return new this.constructor({ color: this.color });
  }

  dispose() {
    this.disposeCount += 1;
  }
}

class CanvasTexture {
  constructor() {
    this.isTexture = true;
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

class Light extends Object3D {
  constructor(color, intensity) {
    super();
    this.color = color;
    this.intensity = intensity;
  }
}

class HemisphereLight extends Light {
  constructor(skyColor, groundColor, intensity) {
    super(skyColor, intensity);
    this.groundColor = groundColor;
  }
}

class DirectionalLight extends Light {
  constructor(color, intensity) {
    super(color, intensity);
    this.target = new Object3D();
  }
}

const THREE = {
  Object3D,
  Mesh,
  CapsuleGeometry: Geometry,
  CylinderGeometry: Geometry,
  SphereGeometry: Geometry,
  BoxGeometry: Geometry,
  CircleGeometry: Geometry,
  TorusGeometry: Geometry,
  MeshStandardMaterial: Material,
  MeshPhysicalMaterial: Material,
  CanvasTexture,
  HemisphereLight,
  DirectionalLight
};

const canvasContext = {
  fillRect() {},
  beginPath() {},
  arc() {},
  fill() {},
  set fillStyle(value) {}
};
const document = {
  createElement() {
    return { getContext() { return canvasContext; } };
  }
};

function createCharacter() {
  const window = {};
  const scene = new Object3D();
  vm.runInNewContext(source, { window, document, Math, Number, Object, Array, Error });
  return { scene, character: window.PaintJourney.createCharacter({ THREE, scene }) };
}

function worldPoint2D(object) {
  const chain = [];
  for (let node = object; node; node = node.parent) chain.unshift(node);
  let x = 0;
  let y = 0;
  let angle = 0;
  for (const node of chain) {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    x += node.position.x * cosine - node.position.y * sine;
    y += node.position.x * sine + node.position.y * cosine;
    angle += node.rotation.z;
  }
  return { x, y };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function testWalkPlantsAlternatingSupportFeet() {
  const { character } = createCharacter();
  const leftAnkle = character.root.getObjectByName('left-ankle');
  const rightAnkle = character.root.getObjectByName('right-ankle');

  character.setPose('walk', 0, 0);
  const leftPlant = worldPoint2D(leftAnkle);
  const rightPlant = worldPoint2D(rightAnkle);

  character.setPose('walk', 0.125, 0);
  assert.ok(distance(worldPoint2D(rightAnkle), rightPlant) < 0.05,
    'right support ankle must remain planted through the first half-cycle');

  character.setPose('walk', 0.625, 0);
  assert.ok(distance(worldPoint2D(leftAnkle), leftPlant) < 0.05,
    'left support ankle must remain planted through the second half-cycle');
}

function testBucketFollowsStrideWithPhaseLag() {
  const { character } = createCharacter();
  const bucketPose = character.root.getObjectByName('bucket-pose');

  character.setPose('walk', 0.25, 0);
  const atStridePeak = Math.abs(bucketPose.rotation.z);
  character.setPose('walk', 0.34, 0);
  const afterStridePeak = Math.abs(bucketPose.rotation.z);

  assert.ok(afterStridePeak > atStridePeak + 0.01,
    'bucket swing peak must follow the leg stride peak instead of mirroring it');
}

function testLightsStayInsideCharacterRig() {
  const { scene, character } = createCharacter();
  const lighting = character.root.getObjectByName('rig-lighting');
  const key = character.root.getObjectByName('rig-key-light');
  const rim = character.root.getObjectByName('rig-rim-light');

  assert.ok(lighting && key instanceof HemisphereLight && rim instanceof DirectionalLight,
    'character must include hemispheric key and directional rim lights');
  assert.equal(lighting.parent, character.root, 'lighting group must be parented to character root');
  assert.equal(key.parent, lighting, 'key light must remain local to the lighting group');
  assert.equal(rim.parent, lighting, 'rim light must remain local to the lighting group');
  assert.deepEqual(scene.children, [character.root], 'lights must not be added as scene-global children');
}

function testBucketPaintSurfaceTracksSpectrumHue() {
  const { character } = createCharacter();
  const surface = character.root.getObjectByName('paint-surface');

  assert.ok(surface, 'bucket must expose a visible paint surface');
  assert.equal(typeof character.setPaintHue, 'function', 'character must expose paint hue control');
  character.setPaintHue(270);
  assert.equal(surface.material.color.hue, 0.75, 'paint surface must use the requested spectrum hue');
}

testWalkPlantsAlternatingSupportFeet();
testBucketFollowsStrideWithPhaseLag();
testLightsStayInsideCharacterRig();
testBucketPaintSurfaceTracksSpectrumHue();

console.log('PASS: paint journey character behavior');
