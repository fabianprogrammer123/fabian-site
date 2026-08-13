#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const modelSource = fs.readFileSync(path.join(root, 'assets/paint-journey-liquid-model.js'), 'utf8');
const fieldSource = fs.readFileSync(path.join(root, 'assets/paint-journey-liquid.js'), 'utf8');

function createThreeHarness() {
  const records = {
    targets: [],
    geometries: [],
    materials: [],
    meshes: [],
    renderCalls: []
  };

  class Scene {
    constructor() { this.children = []; }
    add(object) {
      object.parent = this;
      this.children.push(object);
    }
    remove(object) {
      object.parent = null;
      this.children = this.children.filter((child) => child !== object);
    }
  }

  class OrthographicCamera {
    constructor(...values) { this.values = values; }
  }

  class PlaneGeometry {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      this.disposeCount = 0;
      records.geometries.push(this);
    }
    dispose() { this.disposeCount += 1; }
  }

  class ShaderMaterial {
    constructor(options) {
      Object.assign(this, options);
      this.disposeCount = 0;
      records.materials.push(this);
    }
    dispose() { this.disposeCount += 1; }
  }

  class MeshBasicMaterial {
    constructor(options) {
      Object.assign(this, options);
      this.disposeCount = 0;
      records.materials.push(this);
    }
    dispose() { this.disposeCount += 1; }
  }

  class Mesh {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
      this.scale = { x: 1, y: 1, z: 1, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
      this.parent = null;
      records.meshes.push(this);
    }
  }

  class WebGLRenderTarget {
    constructor(width, height, options) {
      this.width = width;
      this.height = height;
      this.options = options;
      this.texture = {};
      this.disposeCount = 0;
      records.targets.push(this);
    }
    setSize(width, height) {
      this.width = width;
      this.height = height;
    }
    dispose() { this.disposeCount += 1; }
  }

  const THREE = {
    Scene,
    OrthographicCamera,
    PlaneGeometry,
    ShaderMaterial,
    MeshBasicMaterial,
    Mesh,
    WebGLRenderTarget,
    LinearFilter: 'linear',
    RGBAFormat: 'rgba',
    UnsignedByteType: 'ubyte',
    NormalBlending: 'normal',
    NoBlending: 'none'
  };

  return { THREE, records };
}

function makeGesture(id = 'landing:thoughts') {
  return {
    id,
    from: { x: 980, y: 1600 },
    control: { x: 560, y: 1480 },
    to: { x: 100, y: 1540 },
    width: 260,
    palettePhase: 0.62,
    seed: 4,
    reveal: 0.65,
    spread: 1,
    kind: 0
  };
}

function createFieldHarness(mobile = false) {
  const { THREE, records } = createThreeHarness();
  const window = {};
  const context = { window, Math, Number, Object, Array, Map, Float32Array, Error };
  vm.runInNewContext(modelSource, context);
  vm.runInNewContext(fieldSource, context);

  const renderer = {
    currentTarget: null,
    getPixelRatio() { return 3; },
    getRenderTarget() { return this.currentTarget; },
    setRenderTarget(target) { this.currentTarget = target; },
    render(scene, camera) { records.renderCalls.push({ scene, camera, target: this.currentTarget }); }
  };
  const scene = new THREE.Scene();
  const model = window.PaintJourney.createLiquidModel({ maxGestures: 12 });
  model.upsertGesture(makeGesture());
  const field = window.PaintJourney.createLiquidField({ THREE, renderer, scene, model, mobile });

  return { THREE, records, renderer, scene, model, field };
}

function testOneBoundedSurfaceAndFixedUniformPacket() {
  const harness = createFieldHarness(false);
  const { records, scene, field } = harness;

  assert.equal(records.targets.length, 1, 'one field must allocate one low-resolution render target');
  assert.equal(scene.children.length, 1, 'the actor scene must receive exactly one liquid composite plane');
  assert.equal(scene.children[0].position.z, 4, 'the liquid composite must occupy the authored depth-four plane');
  assert.ok(scene.children[0].renderOrder < 5, 'the liquid composite must remain behind the crisp actor layers');
  assert.equal(records.meshes.length, 2,
    'all gestures must share one private field mesh and one composite mesh');

  const shader = records.materials.find((material) => material.fragmentShader);
  assert.ok(shader, 'the private liquid scene must use one shader material');
  assert.equal(shader.uniforms.uGestureStartControl.value.length, 48,
    'twelve gestures must use one fixed vec4 start/control array');
  assert.equal(shader.uniforms.uGestureEndShape.value.length, 48,
    'twelve gestures must use one fixed vec4 endpoint/shape array');
  assert.equal(shader.uniforms.uGestureStyle.value.length, 48,
    'twelve gestures must use one fixed vec4 palette/style array');

  field.setViewport({
    width: 1280, height: 720, scrollX: 0, scrollY: 1000,
    documentWidth: 1280, documentHeight: 1800
  });
  const target = records.targets[0];
  assert.ok(target.width <= Math.floor(1280 * 0.72) && target.height <= Math.floor(720 * 0.72),
    'desktop internal resolution must stay below one CSS pixel even when renderer DPR is high');
  assert.ok(target.width * target.height <= 900000, 'the private target must respect the global pixel cap');

  field.setViewport({
    width: 5000, height: 3200, scrollX: 0, scrollY: 0,
    documentWidth: 5000, documentHeight: 9000
  });
  assert.ok(target.width * target.height <= 900000,
    'oversized viewports must scale down without reallocating the target');
  assert.equal(records.targets.length, 1, 'viewport changes must resize instead of creating more targets');

  field.setEmitter({
    active: true,
    origin: { x: 980, y: 1600 },
    front: { x: 720, y: 1540 },
    pressure: 0.8,
    palettePhase: 0.62
  });
  assert.equal(field.update(1 / 60, 1.2), true, 'a live update must render the private surface');
  assert.equal(records.meshes.length, 2, 'uploading gestures must never create per-gesture meshes');
  assert.equal(records.renderCalls.at(-1).target, target, 'the private scene must render into its bounded target');
  assert.equal(harness.renderer.currentTarget, null, 'field rendering must restore the caller render target');
}

function testMobileResolutionAndAmbientFrameBudgets() {
  const desktop = createFieldHarness(false);
  desktop.field.setViewport({
    width: 1280, height: 720, scrollX: 0, scrollY: 1000,
    documentWidth: 1280, documentHeight: 1800
  });
  desktop.field.update(1 / 60, 0);
  desktop.records.renderCalls.length = 0;
  desktop.field.setAmbient(true);
  for (let frame = 1; frame <= 60; frame += 1) desktop.field.update(1 / 60, frame / 60);
  assert.ok(desktop.records.renderCalls.length >= 23 && desktop.records.renderCalls.length <= 25,
    'desktop ambient morphing must be intentionally throttled to about 24fps');

  const mobile = createFieldHarness(true);
  mobile.field.setViewport({
    width: 390, height: 844, scrollX: 0, scrollY: 900,
    documentWidth: 390, documentHeight: 2600
  });
  const target = mobile.records.targets[0];
  assert.ok(target.width <= Math.floor(390 * 0.55) && target.height <= Math.floor(844 * 0.55),
    'mobile internal resolution must use the smaller 0.55 CSS-pixel scale');
  mobile.field.update(1 / 60, 0);
  mobile.records.renderCalls.length = 0;
  mobile.field.setAmbient(true);
  for (let frame = 1; frame <= 60; frame += 1) mobile.field.update(1 / 60, frame / 60);
  assert.ok(mobile.records.renderCalls.length >= 14 && mobile.records.renderCalls.length <= 16,
    'mobile ambient morphing must be intentionally throttled to about 15fps');
}

function testFreezeAndDisposalAreStable() {
  const harness = createFieldHarness(false);
  harness.field.setViewport({
    width: 1280, height: 720, scrollX: 0, scrollY: 1000,
    documentWidth: 1280, documentHeight: 1800
  });
  harness.field.update(1 / 60, 1.2);
  const shader = harness.records.materials.find((material) => material.fragmentShader);
  harness.field.freeze();
  const frozenTime = shader.uniforms.uTime.value;
  harness.field.update(1, 99);
  assert.equal(shader.uniforms.uTime.value, frozenTime, 'freeze must stop liquid morphology time');

  harness.field.dispose();
  harness.field.dispose();
  assert.equal(harness.records.targets[0].disposeCount, 1, 'double disposal must release the target once');
  assert.ok(harness.records.geometries.every((geometry) => geometry.disposeCount === 1),
    'double disposal must release each shared geometry once');
  assert.ok(harness.records.materials.every((material) => material.disposeCount === 1),
    'double disposal must release each shared material once');
  assert.equal(harness.scene.children.length, 0, 'disposal must remove the composite from the actor scene');
}

function testShaderContainsTheContinuousLiquidMaterial() {
  assert.match(fieldSource, /quadraticPoint\s*\(/,
    'the shader must measure the authored quadratic centerline');
  assert.match(fieldSource, /for\s*\(\s*int\s+sampleIndex\s*=\s*0\s*;\s*sampleIndex\s*<\s*9\s*;/,
    'quadratic distance sampling must use a compile-time bounded loop');
  assert.match(fieldSource, /smoothMinPolynomial\s*\(/,
    'gestures must merge with a polynomial smooth-min instead of exposing capsule overlaps');
  assert.match(fieldSource, /domainWarp\s*\(/,
    'the surface boundary must receive low-frequency organic warping');
  assert.match(fieldSource, /CONTOUR_BANDS\s*=\s*6/,
    'the liquid body must shade six nested contour strata');
  assert.match(fieldSource, /if\s*\(\s*endShape\.w\s*>\s*0\.0001\s*\)/,
    'a zero-reveal gesture must not render a full-width starting blob');
  assert.match(fieldSource, /capillaryEdge/,
    'the material must define a dark capillary edge');
  assert.match(fieldSource, /selfShadow/,
    'the material must include dimensional self-shadow');
  assert.match(fieldSource, /pearlGlint/,
    'the material must include a restrained pearlescent glint');
}

testOneBoundedSurfaceAndFixedUniformPacket();
testMobileResolutionAndAmbientFrameBudgets();
testFreezeAndDisposalAreStable();
testShaderContainsTheContinuousLiquidMaterial();

console.log('PASS: paint journey liquid field behavior');
