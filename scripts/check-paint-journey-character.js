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
  constructor(...args) {
    this.args = args;
    this.disposeCount = 0;
  }

  dispose() {
    this.disposeCount += 1;
  }
}

class Material {
  constructor(options = {}) {
    Object.assign(this, options);
    for (const property of ['color', 'emissive']) {
      if (typeof this[property] !== 'number') continue;
      this[property] = {
        hue: null,
        rgb: null,
        setHSL(hue, saturation, lightness) {
          this.hue = hue;
          this.saturation = saturation;
          this.lightness = lightness;
        },
        setRGB(red, green, blue) {
          this.rgb = [red, green, blue];
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
  const window = {
    PaintJourney: {
      pigmentRgb() { return { r: 47, g: 72, b: 166 }; }
    }
  };
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
  assert.deepEqual(surface.material.color.rgb, [47 / 255, 72 / 255, 166 / 255],
    'paint surface must use the same grounded pigment RGB as the emitted paint');
  assert.equal(surface.material.color.hue, null,
    'bucket color must not fall back to synthetic HSL neon');
}

function testFigureUsesCompactHumanProportions() {
  const { character } = createCharacter();
  const shoulder = character.root.getObjectByName('throwing-shoulder');
  const upperArm = character.root.getObjectByName('throwing-upper-arm');
  const thigh = character.root.getObjectByName('left-thigh');

  assert.ok(Math.abs(shoulder.position.x) <= 16,
    'shoulders must sit closer to the torso instead of reading as a dangling stick rig');
  assert.ok(upperArm.scale.y <= 25,
    'arms must use a compact adult proportion');
  assert.ok(thigh.scale.x >= 6.6,
    'legs must have enough mass to read as a human figure');
}

function testWalkAndLadderClimbStayControlled() {
  const { character } = createCharacter();
  const pelvis = character.root.getObjectByName('pelvis');
  const leftHip = character.root.getObjectByName('left-hip');
  const throwingShoulder = character.root.getObjectByName('throwing-shoulder');

  character.setPose('walk', 0.25, 0);
  assert.ok(Math.abs(leftHip.rotation.z) <= 0.4,
    'walk stride must stay compact and planted');
  assert.ok(Math.abs(throwingShoulder.rotation.z) <= 0.3,
    'walk arm swing must not make the figure look dangly');
  assert.ok(pelvis.position.y <= 67,
    'walk bounce must remain subtle');

  character.setPose('deploy-ladder', 1, 0);
  assert.ok(Math.abs(throwingShoulder.rotation.z) <= 1.15,
    'ladder deployment must keep the arm bent close to the body instead of forming a T-pose');

  character.setPose('climb-ladder', 0.35, 0);
  assert.ok(Math.abs(leftHip.rotation.z) <= 0.36,
    'ladder steps must keep the hips under the torso');
  assert.ok(Math.abs(throwingShoulder.rotation.z) <= 3.05,
    'ladder reach must remain within a natural shoulder range');
}

function testLadderPoseTransitionsStayContinuous() {
  const { character } = createCharacter();
  const throwingShoulder = character.root.getObjectByName('throwing-shoulder');
  const bucketShoulder = character.root.getObjectByName('bucket-shoulder');

  character.setPose('deploy-ladder', 1, 0);
  const deployed = [throwingShoulder.rotation.z, bucketShoulder.rotation.z];
  character.setPose('climb-ladder', 0, 3);
  assert.ok(Math.abs(throwingShoulder.rotation.z - deployed[0]) < 0.02,
    'climb must begin from the deployed arm pose without snapping');
  assert.ok(Math.abs(bucketShoulder.rotation.z - deployed[1]) < 0.02,
    'bucket arm must enter the climb without snapping');

  character.setPose('climb-ladder', 1, 3);
  const climbed = [throwingShoulder.rotation.z, bucketShoulder.rotation.z];
  character.setPose('retrieve-ladder', 0, 0);
  assert.ok(Math.abs(throwingShoulder.rotation.z - climbed[0]) < 0.02,
    'ladder retrieval must begin from the final climbing pose');
  assert.ok(Math.abs(bucketShoulder.rotation.z - climbed[1]) < 0.02,
    'bucket arm must leave the climb without snapping');
}

function testCharacterCanFadeCompletelyAtTheTop() {
  const { character } = createCharacter();
  assert.equal(typeof character.setOpacity, 'function',
    'character must expose opacity control for the final disappearance');

  character.setOpacity(0.35);
  assert.equal(character.root.visible, true, 'partial fade must keep the figure visible');
  const torso = character.root.getObjectByName('torso');
  assert.ok(torso.material.opacity <= 0.35,
    'partial fade must affect the rendered body materials');

  character.setOpacity(0);
  assert.equal(character.root.visible, false, 'zero opacity must remove the figure from view');
}

testWalkPlantsAlternatingSupportFeet();
testBucketFollowsStrideWithPhaseLag();
testLightsStayInsideCharacterRig();
testBucketPaintSurfaceTracksSpectrumHue();
testFigureUsesCompactHumanProportions();
testWalkAndLadderClimbStayControlled();
testLadderPoseTransitionsStayContinuous();
testCharacterCanFadeCompletelyAtTheTop();

console.log('PASS: paint journey character behavior');
