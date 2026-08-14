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
  const records = { targets: [], geometries: [], materials: [], meshes: [], renderCalls: [] };

  class Scene {
    constructor() { this.children = []; }
    add(object) { object.parent = this; this.children.push(object); }
    remove(object) {
      object.parent = null;
      this.children = this.children.filter((candidate) => candidate !== object);
    }
  }
  class OrthographicCamera { constructor(...values) { this.values = values; } }
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
      this.name = '';
      this.disposeCount = 0;
      records.materials.push(this);
    }
    dispose() { this.disposeCount += 1; }
  }
  class MeshBasicMaterial {
    constructor(options) { Object.assign(this, options); records.materials.push(this); }
  }
  class Mesh {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
      this.scale = { x: 1, y: 1, z: 1, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
      this.parent = null;
      this.renderOrder = 0;
      records.meshes.push(this);
    }
  }
  class WebGLRenderTarget {
    constructor(width, height, options) {
      this.width = width;
      this.height = height;
      this.options = options;
      this.texture = { colorSpace: null, generateMipmaps: true, name: '' };
      this.setSizeCount = 0;
      this.disposeCount = 0;
      records.targets.push(this);
    }
    setSize(width, height) { this.width = width; this.height = height; this.setSizeCount += 1; }
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
    ClampToEdgeWrapping: 'clamp',
    RGBAFormat: 'rgba',
    RedFormat: 'red',
    HalfFloatType: 'half-float',
    NoColorSpace: 'no-color-space',
    NormalBlending: 'normal',
    NoBlending: 'none'
  };
  return { THREE, records };
}

function gesture(id = 'landing:thoughts', reveal = 0.65) {
  return {
    id,
    from: { x: 980, y: 1600 },
    control: { x: 560, y: 1480 },
    to: { x: 100, y: 1540 },
    width: 128,
    palettePhase: 0.62,
    seed: 4,
    reveal,
    spread: 1,
    kind: 0
  };
}

function createFieldHarness(mobile = false, extensionAvailable = true, initialReveal = 0.65) {
  const { THREE, records } = createThreeHarness();
  const window = {};
  vm.runInNewContext(modelSource, { window, Math, Number, Object, Array, Map, Float32Array, Error });
  vm.runInNewContext(fieldSource, { window, Math, Number, Object, Array, Map, Float32Array, Error });

  const renderer = {
    currentTarget: null,
    capabilities: { maxTextureSize: 1024 },
    extensions: { has(name) { return name === 'EXT_color_buffer_float' && extensionAvailable; } },
    getRenderTarget() { return this.currentTarget; },
    setRenderTarget(target) { this.currentTarget = target; },
    render(scene, camera) {
      const material = scene.children[0] && scene.children[0].material;
      const impactCount = material && material.uniforms && material.uniforms.uImpactCount
        ? material.uniforms.uImpactCount.value
        : 0;
      records.renderCalls.push({
        scene,
        camera,
        target: this.currentTarget,
        material,
        materialName: material && material.name,
        impactCount,
        impactPointRadius: impactCount && material.uniforms.uImpactPointRadius
          ? Array.from(material.uniforms.uImpactPointRadius.value.slice(0, impactCount * 4))
          : [],
        impactVelocityPhase: impactCount && material.uniforms.uImpactVelocityPhase
          ? Array.from(material.uniforms.uImpactVelocityPhase.value.slice(0, impactCount * 4))
          : []
      });
    }
  };
  const scene = new THREE.Scene();
  const model = window.PaintJourney.createLiquidModel({ maxGestures: 12 });
  model.upsertGesture(gesture('landing:thoughts', initialReveal));
  const field = window.PaintJourney.createLiquidField({ THREE, renderer, scene, model, mobile });
  return { THREE, records, renderer, scene, model, field };
}

function setDesktopViewport(field, overrides = {}) {
  field.setViewport({
    width: 1280,
    height: 720,
    scrollX: 0,
    scrollY: 1000,
    documentWidth: 1280,
    documentHeight: 3600,
    contentLeft: 290,
    contentRight: 990,
    contentFeather: 92,
    ...overrides
  });
}

function testAllocationAndCompositeContracts() {
  const harness = createFieldHarness();
  const { THREE, records, scene, field } = harness;
  assert.equal(records.targets.length, 7,
    'one field must allocate seven full-document half-float solver targets');
  assert.equal(records.targets.filter((target) => target.options.format === THREE.RGBAFormat).length, 4,
    'velocity and pigment ping-pong targets must use RGBAFormat');
  assert.equal(records.targets.filter((target) => target.options.format === THREE.RedFormat).length, 3,
    'pressure ping-pong and divergence targets must use RedFormat');
  records.targets.forEach((target) => {
    assert.equal(target.options.type, THREE.HalfFloatType, 'every target must use HalfFloatType');
    assert.equal(target.options.minFilter, THREE.LinearFilter, 'every target must be linearly sampled');
    assert.equal(target.options.magFilter, THREE.LinearFilter, 'every target must be linearly sampled');
    assert.equal(target.options.wrapS, THREE.ClampToEdgeWrapping, 'targets must clamp horizontally');
    assert.equal(target.options.wrapT, THREE.ClampToEdgeWrapping, 'targets must clamp vertically');
    assert.equal(target.options.depthBuffer, false, 'targets need no depth buffer');
    assert.equal(target.options.stencilBuffer, false, 'targets need no stencil buffer');
    assert.equal(target.options.samples, 0, 'targets must not allocate MSAA samples');
    assert.equal(target.texture.colorSpace, THREE.NoColorSpace, 'solver textures must remain linear data');
    assert.equal(target.texture.generateMipmaps, false, 'solver textures must not generate mipmaps');
  });
  assert.equal(scene.children.length, 1, 'the actor scene receives one composite plane');
  assert.equal(records.meshes.length, 2, 'all solver passes share one quad plus one composite plane');
  const composite = scene.children[0];
  assert.equal(composite.position.z, 4, 'the composite occupies authored depth four');
  assert.equal(composite.renderOrder, -10, 'the composite stays behind the actor');
  assert.ok(composite.material instanceof THREE.ShaderMaterial, 'the composite uses a custom ShaderMaterial');
  assert.equal(composite.material.blending, THREE.NormalBlending, 'the composite uses normal alpha blending');
  assert.equal(composite.material.depthTest, true, 'the composite participates in authored depth');
  assert.equal(composite.material.depthWrite, false, 'the transparent composite must not write depth');
  assert.ok(!records.materials.some((material) => material instanceof THREE.MeshBasicMaterial),
    'MeshBasicMaterial must not flatten the wet material');
  assert.equal(typeof field.addImpactBatch, 'function', 'the field exposes batched physical impacts');
}

function testFullDocumentSizingAndStableScroll() {
  const { records, field } = createFieldHarness();
  setDesktopViewport(field);
  const [velocityA, velocityB, pressureA, pressureB, divergence, pigmentA, pigmentB] = records.targets;
  [velocityA, velocityB, pressureA, pressureB, divergence].forEach((target) => {
    assert.ok(target.width <= Math.floor(1280 * 0.18), 'desktop velocity grid uses at most 0.18 document scale');
    assert.ok(target.height <= Math.floor(3600 * 0.18), 'desktop velocity grid uses at most 0.18 document scale');
    assert.ok(target.width * target.height <= 300000, 'desktop velocity grid respects 300k cap');
    assert.ok(target.width <= 1024 && target.height <= 1024, 'velocity grid respects maxTextureSize');
  });
  [pigmentA, pigmentB].forEach((target) => {
    assert.ok(target.width <= Math.floor(1280 * 0.38), 'desktop pigment grid uses at most 0.38 document scale');
    assert.ok(target.height <= Math.floor(3600 * 0.38), 'desktop pigment grid uses at most 0.38 document scale');
    assert.ok(target.width * target.height <= 720000, 'desktop pigment grid respects 720k cap');
    assert.ok(target.width <= 1024 && target.height <= 1024, 'pigment grid respects maxTextureSize');
  });

  const resizeCounts = records.targets.map((target) => target.setSizeCount);
  setDesktopViewport(field, { scrollY: 1700 });
  assert.deepEqual(records.targets.map((target) => target.setSizeCount), resizeCounts,
    'pure scrolling must not resize or reseed document-space targets');
  assert.deepEqual(
    [field._debug.compositeUniforms.uViewport.value[0], field._debug.compositeUniforms.uViewport.value[1]],
    [0, 1700],
    'scroll still updates the document sampling origin'
  );
}

function testSolverPassesCausalRevealAndReset() {
  const { records, renderer, model, field } = createFieldHarness();
  setDesktopViewport(field);
  field.setEmitter({
    active: true,
    origin: { x: 970, y: 1580 },
    front: { x: 730, y: 1520 },
    pressure: 0.84,
    palettePhase: 0.62
  });
  assert.equal(field.update(1 / 30, 1), true, 'the initial reveal runs a solver step');
  const names = records.renderCalls.map((call) => call.materialName);
  assert.ok(names.includes('paint-source-velocity'), 'impacts inject local momentum');
  assert.ok(names.includes('paint-source-pigment'), 'impacts inject pigment');
  assert.ok(names.includes('paint-advect-viscoplastic-velocity'), 'velocity is semi-Lagrangian advected');
  assert.ok(names.includes('paint-divergence'), 'the solver measures divergence');
  assert.equal(names.filter((name) => name === 'paint-pressure-jacobi').length, 8,
    'desktop uses eight pressure Jacobi iterations per step');
  assert.ok(names.includes('paint-gradient-subtract'), 'pressure projection removes divergence');
  assert.ok(names.includes('paint-advect-pigment'), 'pigment is advected through velocity');
  assert.ok(names.indexOf('paint-source-pigment') < names.indexOf('paint-advect-viscoplastic-velocity'),
    'fresh paint enters the velocity and pigment fields before the solver advects it');
  assert.equal(renderer.currentTarget, null, 'the solver restores the caller render target');

  const revealSources = records.renderCalls.filter((call) => call.materialName === 'paint-source-pigment');
  const revealCount = revealSources.reduce((total, call) => total + call.impactCount, 0);
  assert.ok(revealCount >= 12, 'a revealed river uses enough overlapping union sources to stay continuous');
  assert.ok(revealCount <= 256, 'one reveal update must stay inside the bounded physical source budget');
  const revealRadii = revealSources.flatMap((call) => call.impactPointRadius.filter((value, index) => index % 4 === 2));
  assert.ok(new Set(revealRadii.map((radius) => radius.toFixed(2))).size >= 4,
    'subtle deterministic radius variation keeps the outer river edge organic');
  assert.ok(revealRadii.filter((radius) => radius >= 18 && radius <= 68).length >= revealCount - 1,
    'authored sources span one curated river cross-section rather than separate bead lanes');
  const revealPhases = revealSources.flatMap((call) =>
    call.impactVelocityPhase.filter((value, index) => index % 4 === 2));
  assert.ok(revealPhases.every((phase) => phase >= 2 && phase < 3),
    'authored sources carry a packed ribbon tag while preserving their palette phase');
  const revealSpeeds = revealSources.flatMap((call) => {
    const speeds = [];
    for (let index = 0; index < call.impactVelocityPhase.length; index += 4) {
      speeds.push(Math.hypot(call.impactVelocityPhase[index], call.impactVelocityPhase[index + 1]));
    }
    return speeds;
  });
  assert.ok(revealSpeeds.filter((speed) => speed <= 58).length >= revealCount - 1,
    'authored reveal momentum remains restrained enough for viscous paint to pool');

  field.setEmitter({ active: false, origin: { x: 970, y: 1580 }, pressure: 0, palettePhase: 0.62 });
  records.renderCalls.length = 0;
  setDesktopViewport(field, { scrollY: 1200 });
  field.update(1 / 30, 1.04);
  assert.ok(!records.renderCalls.some((call) => call.materialName === 'paint-clear'),
    'scrolling alone must never clear/reseed paint');
  assert.ok(!records.renderCalls.some((call) => call.materialName === 'paint-source-pigment'),
    'an unchanged reveal must not be injected twice');

  records.renderCalls.length = 0;
  model.setReveal('landing:thoughts', 0.82);
  field.update(1 / 30, 1.08);
  assert.ok(records.renderCalls.some((call) => call.materialName === 'paint-source-pigment'),
    'only the newly revealed interval is causally injected');
  assert.ok(field._debug.lastRevealIntervals.some((interval) =>
    interval.id === 'landing:thoughts' && interval.from > 0.64 && interval.to === 0.82),
  'the reveal source begins at the prior reveal, not at the gesture origin');

  records.renderCalls.length = 0;
  model.reflow('landing:thoughts', { to: { x: 180, y: 1320 } });
  field.update(1 / 30, 1.12);
  assert.equal(records.renderCalls.filter((call) => call.materialName === 'paint-clear').length, 7,
    'a layout revision clears every solver target exactly once');
  assert.ok(records.renderCalls.some((call) => call.materialName === 'paint-source-pigment'),
    'a layout revision reseeds the current revealed geometry once');
}

function testImpactBatchFixedStepAndMobileBudget() {
  const desktop = createFieldHarness();
  setDesktopViewport(desktop.field);
  desktop.field.update(1 / 30, 0);
  desktop.records.renderCalls.length = 0;
  assert.equal(desktop.field.addImpactBatch([
    { origin: { x: 900, y: 1500 }, velocity: { x: -180, y: 40 }, radius: 48, amount: 0.7, palettePhase: 0.1 },
    { origin: { x: 840, y: 1515 }, velocity: { x: -120, y: 90 }, radius: 35, amount: 0.5, palettePhase: 0.72 }
  ]), 2, 'valid impacts are queued as one batch');
  desktop.field.update(1, 1);
  assert.ok(desktop.records.renderCalls.filter((call) =>
    call.materialName === 'paint-advect-viscoplastic-velocity').length <= 2,
  'desktop catch-up is capped at two fixed 1/30 steps');
  const sourceUniform = desktop.records.materials.find((material) => material.name === 'paint-source-pigment').uniforms;
  assert.deepEqual(Array.from(sourceUniform.uImpactPointRadius.value.slice(0, 2)), [900, 1500],
    'the source is centered exactly at the submitted local origin');

  const mobile = createFieldHarness(true);
  mobile.field.setViewport({ width: 390, height: 844, scrollX: 0, scrollY: 900,
    documentWidth: 390, documentHeight: 5000 });
  const velocity = mobile.records.targets[0];
  const pigment = mobile.records.targets[5];
  assert.ok(velocity.width <= Math.floor(390 * 0.14) && velocity.height <= Math.floor(5000 * 0.14),
    'mobile velocity uses the 0.14 document scale');
  assert.ok(velocity.width * velocity.height <= 160000, 'mobile velocity respects the 160k cap');
  assert.ok(pigment.width <= Math.floor(390 * 0.46) && pigment.height <= Math.floor(5000 * 0.46),
    'mobile pigment uses the sharper 0.46 document scale');
  assert.ok(pigment.width * pigment.height <= 420000, 'mobile pigment respects the 420k cap');
  mobile.field.update(1, 1);
  assert.equal(mobile.records.renderCalls.filter((call) =>
    call.materialName === 'paint-advect-viscoplastic-velocity').length, 1,
  'mobile catch-up is capped at one fixed 1/20 step');
  assert.equal(mobile.records.renderCalls.filter((call) => call.materialName === 'paint-pressure-jacobi').length, 4,
    'mobile uses four pressure Jacobi iterations');
}

function revealPayloadForStepCount(stepCount) {
  const harness = createFieldHarness(false, true, 0);
  setDesktopViewport(harness.field);
  harness.field.update(1 / 30, 0);
  harness.records.renderCalls.length = 0;
  for (let step = 1; step <= stepCount; step += 1) {
    harness.model.setReveal('landing:thoughts', step / stepCount);
    harness.field.update(1 / 30, step / 30);
  }
  const calls = harness.records.renderCalls.filter((call) =>
    call.materialName === 'paint-source-pigment' && call.impactCount > 0);
  return calls.flatMap((call) => {
    const payload = [];
    for (let index = 0; index < call.impactCount; index += 1) {
      payload.push({
        pointRadius: call.impactPointRadius.slice(index * 4, index * 4 + 4),
        velocityPhaseSeed: call.impactVelocityPhase.slice(index * 4, index * 4 + 4)
      });
    }
    return payload;
  });
}

function testRevealSamplingIsRefreshRateIndependent() {
  const once = revealPayloadForStepCount(1);
  const thirty = revealPayloadForStepCount(30);
  const oneTwenty = revealPayloadForStepCount(120);
  assert.ok(once.length >= 20 && once.length <= 64,
    'one complete landing uses a bounded deterministic source ordinal set');
  assert.deepEqual(thirty, once,
    'thirty reveal updates inject exactly the same geometry, mass, palette, and seeds as one update');
  assert.deepEqual(oneTwenty, once,
    'a 120Hz-style reveal cannot manufacture extra paint or repeated stamps');
  assert.ok(new Set(once.map((impact) => impact.velocityPhaseSeed[3].toFixed(6))).size > once.length * 0.8,
    'stable impact ordinals still provide varied organic edge seeds');
}

function testEmitterFlowAndProjectedMomentum() {
  const harness = createFieldHarness();
  setDesktopViewport(harness.field);
  harness.model.setReveal('landing:thoughts', 0);
  harness.field.update(1 / 30, 0);
  harness.records.renderCalls.length = 0;

  harness.field.setEmitter({
    active: true,
    origin: { x: 700, y: 1450 },
    front: { x: 620, y: 1470 },
    pressure: 0.8,
    flow: 0.24,
    velocity: { x: -90, y: 36 },
    palettePhase: 0.44
  });
  harness.field.update(1 / 30, 1);
  const firstSource = harness.records.renderCalls.find((call) =>
    call.materialName === 'paint-source-velocity' && call.impactCount === 1);
  assert.ok(firstSource, 'a flowing emitter uploads one local physical source');
  const firstMomentum = firstSource.impactVelocityPhase.slice(0, 2);
  const firstMass = firstSource.impactPointRadius[3];
  assert.ok(firstSource.impactPointRadius[2] <= 10,
    'the live bucket source stays a narrow stream instead of building a giant origin pool');
  assert.ok(firstSource.impactVelocityPhase[2] >= 2 && firstSource.impactVelocityPhase[2] < 3,
    'the live bucket source is tagged as a non-additive ribbon union');
  assert.ok(firstSource.impactVelocityPhase[3] >= 0 && firstSource.impactVelocityPhase[3] < 1,
    'the bucket source retains a stable organic-edge seed beside its ribbon tag');

  harness.records.renderCalls.length = 0;
  harness.field.setEmitter({
    active: true,
    origin: { x: 700, y: 1450 },
    front: { x: 620, y: 1470 },
    pressure: 0.8,
    flow: 0.78,
    velocity: { x: 420, y: -270 },
    palettePhase: 0.44
  });
  harness.field.update(1 / 30, 1.04);
  const secondSource = harness.records.renderCalls.find((call) =>
    call.materialName === 'paint-source-velocity' && call.impactCount === 1);
  assert.notDeepEqual(secondSource.impactVelocityPhase.slice(0, 2), firstMomentum,
    'projected spout velocity changes the physical momentum uploaded to the field');
  assert.ok(Math.hypot(...secondSource.impactVelocityPhase.slice(0, 2)) <= 260.0001,
    'combined spout and pour momentum remains bounded for viscous pooling');
  assert.ok(secondSource.impactPointRadius[3] > firstMass,
    'higher normalized flow deposits more pigment mass');

  harness.records.renderCalls.length = 0;
  harness.field.setEmitter({
    active: true,
    origin: { x: 700, y: 1450 },
    front: { x: 620, y: 1470 },
    pressure: 0.8,
    flow: 0.78,
    velocity: { x: Infinity, y: NaN },
    palettePhase: 0.44
  });
  harness.field.update(1 / 30, 1.06);
  const malformedSource = harness.records.renderCalls.find((call) =>
    call.materialName === 'paint-source-velocity' && call.impactCount === 1);
  assert.ok(malformedSource.impactVelocityPhase.slice(0, 2).every(Number.isFinite),
    'malformed projected velocity is sanitized before reaching shader uniforms');

  harness.records.renderCalls.length = 0;
  harness.field.setEmitter({ active: false, origin: { x: 700, y: 1450 }, front: { x: 700, y: 1450 },
    pressure: 0, flow: 0, velocity: { x: 0, y: 0 }, palettePhase: 0.44 });
  harness.field.update(1 / 30, 1.08);
  assert.ok(!harness.records.renderCalls.some((call) => call.materialName === 'paint-source-pigment'),
    'zero flow explicitly closes the physical source');
}

function testAmbientFreezeFeatureGateAndDisposal() {
  assert.throws(() => createFieldHarness(false, false), /EXT_color_buffer_float/,
    'the field rejects devices without renderable floating-point targets');

  const harness = createFieldHarness();
  setDesktopViewport(harness.field);
  harness.field.update(1 / 30, 0);
  harness.records.renderCalls.length = 0;
  harness.field.setAmbient(true);
  for (let frame = 1; frame <= 60; frame += 1) harness.field.update(1 / 60, frame / 60);
  const steps = harness.records.renderCalls.filter((call) =>
    call.materialName === 'paint-advect-viscoplastic-velocity').length;
  assert.ok(steps >= 23 && steps <= 25, 'desktop ambient simulation runs at about 24fps');

  harness.field.freeze();
  harness.records.renderCalls.length = 0;
  harness.field.update(1, 99);
  assert.equal(harness.records.renderCalls.length, 0, 'freeze stops the solver completely');
  harness.field.dispose();
  harness.field.dispose();
  assert.ok(harness.records.targets.every((target) => target.disposeCount === 1),
    'double disposal releases every target exactly once');
  assert.ok(harness.records.geometries.every((geometry) => geometry.disposeCount === 1),
    'double disposal releases shared geometry exactly once');
  assert.ok(harness.records.materials.every((material) => material.disposeCount === 1),
    'double disposal releases each shader exactly once');
  assert.equal(harness.scene.children.length, 0, 'disposal removes the visible composite');
}

function testQuietSettlementAndWakeup() {
  const harness = createFieldHarness();
  setDesktopViewport(harness.field);
  harness.field.update(1 / 30, 0);
  harness.field.setAmbient(true);
  harness.records.renderCalls.length = 0;

  for (let frame = 1; frame <= 13 * 60; frame += 1) {
    harness.field.update(1 / 60, frame / 60);
  }
  const settledPassCount = harness.records.renderCalls.filter((call) =>
    call.materialName === 'paint-advect-viscoplastic-velocity').length;
  assert.ok(settledPassCount >= 280 && settledPassCount <= 290,
    'the field physically relaxes for about twelve seconds before becoming still');

  harness.records.renderCalls.length = 0;
  for (let frame = 1; frame <= 120; frame += 1) {
    assert.equal(harness.field.update(1 / 60, 13 + frame / 60), false,
      'a settled field performs no hidden solver work');
  }
  assert.equal(harness.records.renderCalls.length, 0, 'settlement stops every offscreen pass');

  setDesktopViewport(harness.field, { scrollY: 1550 });
  assert.equal(harness.field.update(0, 15.1), true,
    'scrolling a settled field requests a composite redraw');
  assert.equal(harness.records.renderCalls.length, 0,
    'scroll-only redraw samples the retained document texture without restarting the solver');
  assert.equal(harness.field.update(0, 15.2), false,
    'the scroll redraw dirty flag is consumed exactly once');

  harness.field.addImpactBatch([
    { origin: { x: 850, y: 1510 }, velocity: { x: -55, y: 18 }, radius: 38, amount: 0.5, palettePhase: 0.2 }
  ]);
  assert.equal(harness.field.update(1 / 60, 15.3), true, 'new paint wakes a settled field');
  assert.ok(harness.records.renderCalls.some((call) => call.materialName === 'paint-source-pigment'),
    'wakeup injects the new physical source');
  assert.ok(harness.records.renderCalls.some((call) => call.materialName === 'paint-advect-pigment'),
    'wakeup resumes pigment advection');
}

function testShaderAndSourceContracts() {
  const harness = createFieldHarness();
  const material = (name) => harness.records.materials.find((candidate) => candidate.name === name);
  const sourcePigmentShader = material('paint-source-pigment').fragmentShader;
  const advectPigmentShader = material('paint-advect-pigment').fragmentShader;
  const compositeShader = harness.scene.children[0].material.fragmentShader;
  const velocityMaterial = material('paint-advect-viscoplastic-velocity');
  const pigmentMaterial = material('paint-advect-pigment');

  assert.doesNotMatch(fieldSource, /CONTOUR_BANDS|quadraticDistanceSample|smoothMinPolynomial|MeshBasicMaterial/,
    'the fake contour/SDF ribbon renderer must be absent');
  assert.match(fieldSource, /getSimulationPacket\s*\(/,
    'the field consumes full simulation packets for causal reveal intervals');
  assert.match(fieldSource, /yieldStress|viscoplastic/i, 'velocity advection models a paint yield stress');
  assert.match(fieldSource, /uDivergence/, 'pressure solves from a divergence texture');
  assert.match(fieldSource, /uPressure/, 'the projection pass samples pressure');
  assert.match(fieldSource, /gravity|drip/i, 'pigment advection includes gravity-driven drips');
  assert.match(advectPigmentShader, /uGravity\s*\*\s*uDelta\s*\*\s*dripMobility/,
    'pigment gravity is integrated in seconds and cannot accelerate once per frame');
  assert.doesNotMatch(advectPigmentShader, /uGravity\s*\*\s*\(\s*0\.16/,
    'pigment advection has no frame-rate-dependent constant gravity kick');
  assert.match(advectPigmentShader, /pigmentDiffusion\s*=\s*\(0\.00018\s*\+\s*0\.00042\s*\*\s*dripMobility\)/,
    'pigment diffusion remains low enough to preserve clean wet color seams');
  assert.doesNotMatch(sourcePigmentShader, /float\s+core\s*=\s*exp\s*\(/,
    'pigment mass is not deposited as an airbrush Gaussian');
  assert.match(sourcePigmentShader, /superellipse|edgeNoise|flatCore/,
    'pigment sources form flat-bodied irregular wet pools');
  assert.match(sourcePigmentShader, /orientedOffset[\s\S]*dot\(offset,\s*tangent\)[\s\S]*dot\(offset,\s*normal\)/,
    'source pools orient their organic long axis to the physical impact tangent');
  assert.match(sourcePigmentShader, /float\s+superellipseExponent\s*=\s*2\.1[0-9]?/,
    'source pools use a rounded superellipse instead of an axis-aligned rectangular stamp');
  assert.match(sourcePigmentShader, /elongation/,
    'impact momentum modestly elongates each liquid lobe along its travel direction');
  assert.doesNotMatch(sourcePigmentShader, /smoothstep\(1\.04[^,]*,\s*0\.80|smoothstep\(1\.0,\s*0\.24/,
    'organic pool masks must never rely on undefined reversed-edge smoothstep behavior');
  assert.match(fieldSource, /kubelkaMunk/i, 'the composite uses Kubelka-Munk pigment reflectance');
  assert.match(compositeShader, /opticalDepth\s*\*\s*4\.8/,
    'optical coverage reaches rich body color before the paint becomes an oversized sheet');
  assert.match(fieldSource, /thicknessNormal/i, 'the wet material derives normals from thickness');
  assert.match(fieldSource, /wetRoughness/i, 'the wet material shapes specular response with roughness');
  assert.match(fieldSource, /meniscus/i, 'the wet material resolves a capillary meniscus');
  assert.match(compositeShader, /wetSpecular\s*\*\s*0\.16/,
    'wet body highlights stay restrained instead of becoming repeated white pills');
  assert.ok(velocityMaterial.uniforms.uGravity.value >= 20 && velocityMaterial.uniforms.uGravity.value <= 30,
    'velocity gravity stays inside the controlled sticky-paint range');
  assert.ok(pigmentMaterial.uniforms.uGravity.value >= 18 && pigmentMaterial.uniforms.uGravity.value <= 28,
    'pigment gravity only draws short edge drips instead of a page-height cascade');
  assert.match(velocityMaterial.fragmentShader, /mix\(0\.7[5-9],\s*0\.9[0-4][0-9],\s*yielded\)/,
    'even yielded paint loses momentum quickly like a heavy viscoplastic medium');
  assert.match(velocityMaterial.fragmentShader,
    /velocity\s*-?=\s*thicknessGradient\s*\*\s*45\.0\s*\*\s*uDelta/,
    'surface-tension acceleration is time-step scaled instead of exploding once per frame');
  assert.match(velocityMaterial.fragmentShader, /clamp\(velocity,\s*vec2\(-140\.0\),\s*vec2\(140\.0\)\)/,
    'the heavy paint solver rejects runaway momentum before it can expand into a page wall');
  assert.match(advectPigmentShader, /texture2D\(uVelocity,\s*vUv\)[\s\S]*\.z|flowState\.z/,
    'gravity mobility is coupled to the solver yield state');
  assert.match(advectPigmentShader, /clamp\(pigmentDiffusion,\s*0\.0,\s*0\.00065\)/,
    'subtractive pigments mix gently at touching seams without becoming a muddy wash');
  assert.match(sourcePigmentShader, /thicknessScale[\s\S]*pigment\s*\*=\s*thicknessScale/,
    'the source caps accumulated mass proportionally so absorption-to-thickness color stays stable');
  assert.match(sourcePigmentShader,
    /ribbonSource[\s\S]*targetThickness\s*=\s*poolEdge[\s\S]*nextThickness\s*=\s*max\(pigment\.a,\s*targetThickness\)/,
    'ribbon sources union target thickness instead of accumulating every overlapping sample');
  assert.match(sourcePigmentShader, /existingAbsorption[\s\S]*mixedAbsorption[\s\S]*nextThickness/,
    'ribbon union preserves and locally blends absorption without manufacturing extra mass');
  assert.match(material('paint-source-velocity').fragmentShader,
    /ribbonSource[\s\S]*mix\(field\.xy,\s*bottomUpVelocity/,
    'ribbon momentum blends toward its authored velocity instead of accumulating at overlaps');
  assert.match(sourcePigmentShader, /pigmentRatio\s*=\s*\(vec3\(1\.0\)\s*-\s*reflectance\)[\s\S]*2\.0\s*\*\s*reflectance/,
    'display reflectance is converted to Kubelka-Munk K/S without a double-transform color cast');
  assert.match(fieldSource, /readingLane/i, 'the composite protects the reading lane');
  assert.match(fieldSource, /projectionMatrix\s*\*\s*modelViewMatrix/,
    'the visible vertex shader uses the actor camera projection');
  assert.match(fieldSource, /#include <tonemapping_fragment>/,
    'the composite participates in Three tone mapping');
  assert.match(fieldSource, /#include <colorspace_fragment>/,
    'the composite converts its final display color');
  assert.doesNotMatch(fieldSource, /renderer\.setViewport\s*\(/,
    'the solver must let render targets manage viewport state automatically');
  assert.doesNotMatch(fieldSource, /travellingGlint|timedGlint/,
    'wet highlights must derive from thickness, never a timed glint');
}

testAllocationAndCompositeContracts();
testFullDocumentSizingAndStableScroll();
testSolverPassesCausalRevealAndReset();
testImpactBatchFixedStepAndMobileBudget();
testRevealSamplingIsRefreshRateIndependent();
testEmitterFlowAndProjectedMomentum();
testAmbientFreezeFeatureGateAndDisposal();
testQuietSettlementAndWakeup();
testShaderAndSourceContracts();

console.log('PASS: paint journey viscoplastic liquid field behavior');
