#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/paint-journey-character.js'), 'utf8');
const controllerSource = fs.readFileSync(path.join(root, 'assets/paint-journey.js'), 'utf8');

function extractFunctionBody(script, name) {
  const signature = `function ${name}(`;
  const start = script.indexOf(signature);
  assert.notEqual(start, -1, `controller must define ${name}()`);
  const open = script.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < script.length; index += 1) {
    if (script[index] === '{') depth += 1;
    if (script[index] === '}') depth -= 1;
    if (depth === 0) return script.slice(start, index + 1);
  }
  throw new Error(`could not parse ${name}()`);
}

function evaluateControllerFunction(name, context) {
  const sandbox = Object.assign({ result: null }, context);
  const declaration = extractFunctionBody(controllerSource, name);
  vm.runInNewContext(`${declaration}\nresult = ${name}();`, sandbox);
  return sandbox.result;
}

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
  moveTo() {},
  quadraticCurveTo() {},
  stroke() {},
  fill() {},
  set fillStyle(value) {},
  set strokeStyle(value) {},
  set lineWidth(value) {},
  set lineCap(value) {}
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

function testPaintLeavesFromTheBucketEdge() {
  const { character } = createCharacter();
  const lip = character.root.getObjectByName('bucketLip');
  const spout = character.root.getObjectByName('paint-spout');
  const spoutForm = character.root.getObjectByName('bucket-spout-form');

  assert.ok(spout, 'bucket must expose a physical paint spout');
  assert.ok(spoutForm instanceof Mesh,
    'the pouring edge must have visible dimensional geometry rather than only an invisible origin point');
  assert.equal(spoutForm.parent, lip, 'the visible spout must move with the bucket rim');
  assert.equal(character.paintSpout, spout, 'particle origin must use the exposed spout transform');
  assert.equal(spout.parent, lip, 'paint spout must follow the open bucket rim');
  assert.ok(Math.abs(spout.position.x) >= 6,
    'paint spout must sit on the pouring edge instead of the rim centre');
}

function testFigureUsesCompactHumanProportions() {
  const { character } = createCharacter();
  const shoulder = character.root.getObjectByName('throwing-shoulder');
  const upperArm = character.root.getObjectByName('throwing-upper-arm');
  const forearm = character.root.getObjectByName('throwing-forearm');
  const thigh = character.root.getObjectByName('left-thigh');
  const shin = character.root.getObjectByName('left-shin');
  const face = character.root.getObjectByName('dotted-face');
  const head = character.root.getObjectByName('head');
  const leftAnkle = character.root.getObjectByName('left-ankle');
  const hand = character.root.getObjectByName('throwing-hand');
  const apron = character.root.getObjectByName('apron');
  const neckForm = character.root.getObjectByName('neck-form');
  const shoulderCap = character.root.getObjectByName('throwing-shoulder-cap');
  const elbowCap = character.root.getObjectByName('throwing-elbow-cap');

  assert.ok(Math.abs(shoulder.position.x) <= 12.5,
    'cute shoulders must sit close to the torso instead of reading as a dangling stick rig');
  const upperArmLength = Number(upperArm.segmentLength) || upperArm.scale.y;
  const forearmLength = Number(forearm.segmentLength) || forearm.scale.y;
  const thighLength = Number(thigh.segmentLength) || thigh.scale.y;
  const shinLength = Number(shin.segmentLength) || shin.scale.y;
  assert.ok(upperArmLength <= 17 && forearmLength <= 15,
    'both arm segments must use compact, rounded proportions');
  assert.ok(thighLength <= 22 && shinLength <= 20,
    'leg segments must stay compact enough to avoid a marionette silhouette');
  assert.ok(face.scale.x >= 14.8 && face.scale.y >= 15.8,
    'the face must be slightly oversized to give the small painter a warm, cute silhouette');
  const figureTop = worldPoint2D(head).y + face.scale.y;
  const figureBottom = worldPoint2D(leftAnkle).y - 5.2;
  assert.ok((face.scale.x * 2) / (figureTop - figureBottom) >= 0.25,
    'the head width must occupy at least one quarter of the projected figure height');
  assert.ok(hand && hand.scale.x >= 6.4 && hand.scale.y >= 6.6,
    'rounded mitt-like hands must remain readable at the small rendered scale');
  assert.ok(apron && apron.material === neckForm.material,
    'the charcoal overalls must include a contrasting warm-white apron');
  assert.ok(shoulderCap.scale.x <= 6.4,
    'joint caps must not overpower the shorter limbs');
  assert.equal(shoulderCap.material, upperArm.material,
    'shoulder caps must merge into their adjacent upper arms');
  assert.equal(elbowCap.material, upperArm.material,
    'elbow caps and both arm segments must share one matte material instead of contrasting at the joint');
  assert.equal(forearm.material, upperArm.material,
    'arms must read as continuous overlapping capsules rather than disjoint puppet pieces');
  assert.match(source, /quadraticCurveTo\(/,
    'the face must use a small curved expression rather than a flat mechanical mouth');
}

function testCharacterMaterialsStaySmoothAndMatte() {
  const { character } = createCharacter();
  const paint = character.root.getObjectByName('paint-surface');
  const materials = new Set();
  character.root.traverse((object) => {
    if (object.material) materials.add(object.material);
  });

  for (const material of materials) {
    assert.notEqual(material.flatShading, true,
      'small character surfaces must stay smoothly shaded instead of faceted');
    if (material !== paint.material) {
      assert.ok(!Number.isFinite(material.clearcoat) || material.clearcoat === 0,
        'clearcoat must be reserved for the wet paint in the bucket');
    }
  }
  assert.ok(paint.material.clearcoat >= 0.65,
    'the wet paint must remain the one glossy material in the character rig');
}

function sampledRotations(character) {
  return [
    'pelvis', 'spine', 'head',
    'throwing-shoulder', 'throwing-elbow', 'throwing-wrist',
    'bucket-shoulder', 'bucket-elbow', 'bucket-wrist', 'bucket-pose',
    'left-hip', 'left-knee', 'right-hip', 'right-knee'
  ].map((name) => {
    const rotation = character.root.getObjectByName(name).rotation;
    return [rotation.x, rotation.y, rotation.z];
  }).flat();
}

function maxPoseDeltaAt60Hz(character, pose, duration, phase) {
  let previous = null;
  let maximum = 0;
  const frames = Math.ceil(duration * 60);
  for (let frame = 0; frame <= frames; frame += 1) {
    character.setPose(pose, frame / frames, phase);
    const sample = sampledRotations(character);
    if (previous) {
      for (let index = 0; index < sample.length; index += 1) {
        maximum = Math.max(maximum, Math.abs(sample[index] - previous[index]));
      }
    }
    previous = sample;
  }
  return maximum;
}

function testFourBeatPourIsCausalAndContinuous() {
  const { character } = createCharacter();
  assert.equal(typeof character.getPourAmount, 'function',
    'the character must expose a causal bucket-pour amount');

  character.setPose('paint-swing', 0.15, 0);
  assert.equal(character.getPourAmount(), 0,
    'anticipation must not emit paint before the bucket tips');
  character.setPose('paint-swing', 0.35, 0);
  assert.equal(character.getPourAmount(), 0,
    'the lift beat must remain dry until the committed tip begins');
  character.setPose('paint-swing', 0.56, 0);
  assert.ok(character.getPourAmount() > 0.75,
    'the committed 40-82% beat must produce a strong bucket-driven pour');
  character.setPose('paint-swing', 0.8, 0);
  assert.ok(character.getPourAmount() > 0.75,
    'the bucket must remain committed through the end of the main pour beat');
  character.setPose('paint-swing', 1, 0);
  assert.equal(character.getPourAmount(), 0,
    'the completed recovery must leave no residual emission');

  const maximumJointDelta = maxPoseDeltaAt60Hz(character, 'paint-swing', 1.75, 0);
  assert.ok(maximumJointDelta < 0.1,
    `the four pour beats must keep every sampled joint below a 0.10-radian 60Hz step; observed ${maximumJointDelta}`);
}

function testCommittedPourUsesBothHandsAndLooksTowardTheFlow() {
  const { character } = createCharacter();
  const hand = character.root.getObjectByName('throwing-wrist');
  const grip = character.root.getObjectByName('bucket-handle-grip');
  const head = character.root.getObjectByName('head');
  assert.ok(grip, 'the bucket must expose a physical grip target for the free hand');
  for (let step = 0; step <= 12; step += 1) {
    const progress = 0.4 + (0.42 * step / 12);
    character.setPose('paint-swing', progress, 0);
    const handGap = distance(worldPoint2D(hand), worldPoint2D(grip));
    assert.ok(handGap <= 13.8,
      `both hands must stay joined to the bucket through the committed pour at ${progress.toFixed(3)}; gap ${handGap.toFixed(2)}`);
    assert.ok(Math.abs(head.rotation.y) >= 0.025,
      'the painter must look toward the advancing liquid during commitment');
  }
}

function testLandingStartsOnlyAtPositivePourFromExactSpout() {
  const body = extractFunctionBody(controllerSource, 'updateLandingLiquid');
  assert.match(body,
    /var\s+pourAmount\s*=\s*characterPourAmount\(progress\)[\s\S]*?if\s*\(pourAmount\s*<=\s*0\.015\)[\s\S]*?return;[\s\S]*?if\s*\(!landingId\)\s*ensureLandingGesture\(documentPoint\)/,
    'the controller must wait for positive physical bucket tilt before creating a landing gesture');
  const configure = extractFunctionBody(controllerSource, 'configureLandingPath');
  assert.match(configure, /landingOrigin\.x\s*=\s*documentPoint\.x/,
    'the first broad gesture x origin must exactly match the projected paint spout');
  assert.match(configure, /landingOrigin\.y\s*=\s*documentPoint\.y/,
    'the first broad gesture y origin must exactly match the projected paint spout');
  assert.doesNotMatch(configure, /landingOrigin\.[xy]\s*=\s*documentPoint\.[xy]\s*[+-]/,
    'the first broad gesture must not visually offset itself from the physical spout');
}

function testOnlyThePhysicalSpoutCanEmit() {
  const { character } = createCharacter();
  const spout = character.root.getObjectByName('paint-spout');
  const spoutForm = character.root.getObjectByName('bucket-spout-form');
  const projectedGap = distance(worldPoint2D(spout), worldPoint2D(spoutForm)) * 0.82;

  assert.ok(projectedGap <= 3,
    'the first liquid sample must land within three projected pixels of the visible bucket spout');
  const origins = controllerSource.match(/character\.[\w]+\.getWorldPosition\(bucketOrigin\)/g) || [];
  assert.ok(origins.length >= 2, 'the controller must sample the bucket for both liquid and droplets');
  origins.forEach((origin) => assert.equal(origin,
    'character.paintSpout.getWorldPosition(bucketOrigin)',
    'all live paint origins must use the physical spout'));

  for (const pose of ['walk', 'deploy-ladder', 'climb-ladder', 'retrieve-ladder', 'rest', 'vanish']) {
    character.setPose(pose, 0.5, 5);
    assert.equal(character.getPourAmount(), 0,
      `${pose} must not leak paint while the bucket is not in a pour pose`);
  }
}

function testControllerUsesRequestedScaleAndRightLane() {
  const mobileLane = evaluateControllerFunction('laneX', {
    window: { innerWidth: 390 }, documentWidth: () => 390
  });
  const desktopLane = evaluateControllerFunction('laneX', {
    window: { innerWidth: 1280 }, documentWidth: () => 1280
  });
  assert.equal(390 - mobileLane, 34,
    'the mobile lane must retain about 34px of right-edge breathing room');
  assert.equal(1280 - desktopLane, 82,
    'the desktop lane must retain about 82px of right-edge breathing room');
  assert.ok(Math.abs(evaluateControllerFunction('characterScale', { isMobileViewport: () => true }) - 0.6) < 1e-9,
    'the mobile painter must render at the requested compact 0.60 scale');
  assert.ok(Math.abs(evaluateControllerFunction('characterScale', { isMobileViewport: () => false }) - 0.82) < 1e-9,
    'the desktop painter must render at the requested readable 0.82 scale');
  const frameBody = controllerSource.match(/function\s+frame\([^)]*\)\s*\{([\s\S]*?)\n  \}/);
  assert.ok(frameBody, 'the controller must expose one frame loop');
  assert.equal((frameBody[1].match(/updateJourney\(timestamp,\s*delta\)/g) || []).length, 1,
    'each animation frame must advance the pose once instead of double-stepping the rig');
}

function testSupportFootChangeUsesADoubleSupportBlend() {
  const { character } = createCharacter();
  const pelvis = character.root.getObjectByName('pelvis');

  character.setPose('walk', 0.399, 0);
  const before = pelvis.position.clone();
  character.setPose('walk', 0.401, 0);
  const after = pelvis.position.clone();

  assert.ok(Math.hypot(after.x - before.x, after.y - before.y) < 0.8,
    'support-foot changes must blend through double support without a lateral pelvis pop');
}

function testNaturalWalkHasQuietFollowThroughAndBentBucketArm() {
  const { character } = createCharacter();
  const pelvis = character.root.getObjectByName('pelvis');
  const head = character.root.getObjectByName('head');
  const throwingShoulder = character.root.getObjectByName('throwing-shoulder');
  const bucketElbow = character.root.getObjectByName('bucket-elbow');

  character.setPose('walk', 0.2, 0);

  assert.ok(Math.abs(throwingShoulder.rotation.z) <= 0.2,
    'walking arms must counter-swing gently rather than dangle');
  assert.ok(Math.abs(bucketElbow.rotation.z) >= 0.26,
    'the bucket arm must stay visibly bent while carrying paint');
  assert.ok(Math.abs(head.rotation.z) >= 0.006 && Math.abs(head.rotation.z) <= 0.08,
    'the head must add a quiet delayed follow-through instead of remaining mechanically fixed');
  assert.ok(pelvis.position.y <= 62,
    'the shorter figure must keep a low, grounded centre of mass');
}

function testLadderClimbUsesOneHandAndKeepsTheBucketTucked() {
  const { character } = createCharacter();
  const throwingShoulder = character.root.getObjectByName('throwing-shoulder');
  const throwingElbow = character.root.getObjectByName('throwing-elbow');
  const bucketShoulder = character.root.getObjectByName('bucket-shoulder');
  const bucketElbow = character.root.getObjectByName('bucket-elbow');
  const leftHip = character.root.getObjectByName('left-hip');
  const rightHip = character.root.getObjectByName('right-hip');
  const leftKnee = character.root.getObjectByName('left-knee');
  const rightKnee = character.root.getObjectByName('right-knee');
  const head = character.root.getObjectByName('head');

  character.setPose('climb-ladder', 0.35, 5);

  assert.ok(throwingShoulder.rotation.z >= 1.3 && throwingShoulder.rotation.z <= 1.75,
    'the gripping arm must stay in a compact rung-reaching shoulder range');
  assert.ok(Math.abs(throwingElbow.rotation.z) >= 0.5 && Math.abs(throwingElbow.rotation.z) <= 0.88,
    'the gripping arm must remain visibly bent');
  assert.ok(Math.abs(bucketShoulder.rotation.z) <= 0.4,
    'the bucket shoulder must remain tucked beside the torso while climbing');
  assert.ok(Math.abs(bucketElbow.rotation.z) >= 0.28 && Math.abs(bucketElbow.rotation.z) <= 0.62,
    'the bucket elbow must brace the load close to the body');
  assert.ok(Math.sign(leftHip.rotation.z) !== Math.sign(rightHip.rotation.z),
    'climbing legs must alternate instead of swinging together');
  assert.ok(leftKnee.rotation.z < -0.08 && rightKnee.rotation.z < -0.08,
    'both knees must retain believable flex on the ladder');
  assert.ok(Math.sign(head.rotation.z) !== Math.sign(leftHip.rotation.z),
    'the head must quietly counter-tilt against the active climbing step');

  assert.doesNotMatch(source,
    /throwingArm\.shoulder\.rotation\.z\s*=[^;]*\btravel\b/,
    'the gripping shoulder must not rotate farther overhead as root travel increases');
  assert.match(source,
    /clamp01\(progress\s*\/\s*0\.13\)[\s\S]{0,100}clamp01\(\(1\s*-\s*progress\)\s*\/\s*0\.13\)/,
    'climbing motion must use a compact 13% ease envelope while its rung clock stays raw');
  assert.ok(maxPoseDeltaAt60Hz(character, 'climb-ladder', 5.6, 9) < 0.1,
    'even the longest nine-cycle climb must keep 60Hz joint steps below 0.10 radians');
}

function testClimbUsesTheControllerCycleCountAsARawLimbClock() {
  const { character } = createCharacter();
  const shoulder = character.root.getObjectByName('throwing-shoulder');

  character.setPose('climb-ladder', 0.23, 2);
  const twoCycleReach = shoulder.rotation.z;
  character.setPose('climb-ladder', 0.23, 3);
  const threeCycleReach = shoulder.rotation.z;

  assert.ok(Math.abs(twoCycleReach - threeCycleReach) > 0.12,
    'the limb clock must consume the controller-provided 2-9 raw cycle count rather than easing progress twice');
}

function transitionSnapshot(character) {
  return [
    'pelvis', 'spine', 'head',
    'throwing-shoulder', 'throwing-elbow',
    'bucket-shoulder', 'bucket-elbow', 'bucket-pose',
    'left-hip', 'left-knee', 'right-hip', 'right-knee'
  ].map((name) => {
    const node = character.root.getObjectByName(name);
    return [node.position.x, node.position.y, node.rotation.x, node.rotation.y, node.rotation.z];
  }).flat();
}

function assertPoseBoundary(character, outgoing, incoming, message) {
  character.setPose(outgoing.name, outgoing.progress, outgoing.phase);
  const before = transitionSnapshot(character);
  character.setPose(incoming.name, incoming.progress, incoming.phase);
  const after = transitionSnapshot(character);
  const maximum = Math.max(...before.map((value, index) => Math.abs(value - after[index])));
  assert.ok(maximum < 0.02, `${message}; observed ${maximum}`);
}

function testWholeBodyPoseBoundariesStayContinuous() {
  const { character } = createCharacter();
  assertPoseBoundary(character,
    { name: 'deploy-ladder', progress: 1, phase: 0 },
    { name: 'climb-ladder', progress: 0, phase: 5 },
    'deployment must hand shoulders, hips and bucket continuously into the climb');
  assertPoseBoundary(character,
    { name: 'climb-ladder', progress: 1, phase: 5 },
    { name: 'retrieve-ladder', progress: 0, phase: 0 },
    'the completed climb must hand shoulders, hips and bucket continuously into retrieval');
  assertPoseBoundary(character,
    { name: 'retrieve-ladder', progress: 1, phase: 0 },
    { name: 'paint-swing', progress: 0, phase: 0 },
    'retrieval must settle the whole body into the pour without a snap');
  assertPoseBoundary(character,
    { name: 'paint-swing', progress: 1, phase: 0 },
    { name: 'deploy-ladder', progress: 0, phase: 0 },
    'the recovered pour must return hips and arms to the next ladder-deploy pose');
  assertPoseBoundary(character,
    { name: 'paint-swing', progress: 1, phase: 0 },
    { name: 'vanish', progress: 0, phase: 0 },
    'the final recovered pour must enter the disappearing pose continuously');
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
  assert.ok(Math.abs(throwingShoulder.rotation.z) <= 1.55,
    'ladder deployment must end in the same compact bent-arm rung reach used by the climb');

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

function testRetrievalBlendsIntoPaintSwing() {
  const { character } = createCharacter();
  const throwingShoulder = character.root.getObjectByName('throwing-shoulder');
  const bucketShoulder = character.root.getObjectByName('bucket-shoulder');

  character.setPose('retrieve-ladder', 1, 0);
  const retrieved = [throwingShoulder.rotation.z, bucketShoulder.rotation.z];
  character.setPose('paint-swing', 0, 0);

  assert.ok(Math.abs(throwingShoulder.rotation.z - retrieved[0]) < 0.02,
    'paint swing must begin from the retrieved throwing-arm pose');
  assert.ok(Math.abs(bucketShoulder.rotation.z - retrieved[1]) < 0.02,
    'paint swing must begin from the retrieved bucket-arm pose');
}

function testWalkBlendsIntoTheFirstPaintSwing() {
  const { character } = createCharacter();
  const throwingShoulder = character.root.getObjectByName('throwing-shoulder');
  const bucketShoulder = character.root.getObjectByName('bucket-shoulder');

  character.setPose('walk', 1, 0);
  const walked = [throwingShoulder.rotation.z, bucketShoulder.rotation.z];
  character.setPose('paint-swing', 0, 1);

  assert.ok(Math.abs(throwingShoulder.rotation.z - walked[0]) < 0.02,
    'the first bucket swing must begin from the completed walking pose');
  assert.ok(Math.abs(bucketShoulder.rotation.z - walked[1]) < 0.02,
    'the bucket arm must enter the first swing without snapping');
}

function testPaintSwingBlendsIntoLadderDeployment() {
  const { character } = createCharacter();
  const throwingShoulder = character.root.getObjectByName('throwing-shoulder');
  const bucketShoulder = character.root.getObjectByName('bucket-shoulder');
  const bucketElbow = character.root.getObjectByName('bucket-elbow');

  character.setPose('paint-swing', 1, 0);
  const painted = [throwingShoulder.rotation.z, bucketShoulder.rotation.x, bucketElbow.rotation.z];
  character.setPose('deploy-ladder', 0, 0);

  assert.ok(Math.abs(throwingShoulder.rotation.z - painted[0]) < 0.02,
    'ladder deployment must begin from the finished throwing-arm pose');
  assert.ok(Math.abs(bucketShoulder.rotation.x - painted[1]) < 0.02,
    'bucket shoulder must not snap out of the swing plane during ladder deployment');
  assert.ok(Math.abs(bucketElbow.rotation.z - painted[2]) < 0.02,
    'bucket arm must move into ladder deployment without snapping');
}

function testFinalPaintSwingBlendsIntoVanish() {
  const { character } = createCharacter();
  const bucketShoulder = character.root.getObjectByName('bucket-shoulder');
  const throwingElbow = character.root.getObjectByName('throwing-elbow');

  character.setPose('paint-swing', 1, 0);
  const painted = [bucketShoulder.rotation.z, bucketShoulder.rotation.x, throwingElbow.rotation.z];
  character.setPose('vanish', 0, 0);

  assert.ok(Math.abs(bucketShoulder.rotation.z - painted[0]) < 0.02,
    'the final bucket arm must enter the disappearance without snapping');
  assert.ok(Math.abs(bucketShoulder.rotation.x - painted[1]) < 0.02,
    'the bucket shoulder must not snap out of plane as the figure disappears');
  assert.ok(Math.abs(throwingElbow.rotation.z - painted[2]) < 0.02,
    'the final throwing arm must enter the disappearance without snapping');
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
testPaintLeavesFromTheBucketEdge();
testFigureUsesCompactHumanProportions();
testCharacterMaterialsStaySmoothAndMatte();
testFourBeatPourIsCausalAndContinuous();
testCommittedPourUsesBothHandsAndLooksTowardTheFlow();
testLandingStartsOnlyAtPositivePourFromExactSpout();
testOnlyThePhysicalSpoutCanEmit();
testControllerUsesRequestedScaleAndRightLane();
testSupportFootChangeUsesADoubleSupportBlend();
testNaturalWalkHasQuietFollowThroughAndBentBucketArm();
testLadderClimbUsesOneHandAndKeepsTheBucketTucked();
testClimbUsesTheControllerCycleCountAsARawLimbClock();
testWholeBodyPoseBoundariesStayContinuous();
testWalkAndLadderClimbStayControlled();
testLadderPoseTransitionsStayContinuous();
testRetrievalBlendsIntoPaintSwing();
testWalkBlendsIntoTheFirstPaintSwing();
testPaintSwingBlendsIntoLadderDeployment();
testFinalPaintSwingBlendsIntoVanish();
testCharacterCanFadeCompletelyAtTheTop();

console.log('PASS: paint journey character behavior');
