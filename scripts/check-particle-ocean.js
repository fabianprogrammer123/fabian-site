#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const homepagePath = path.join(root, 'index.html');
const oceanPagePath = path.join(root, 'water', 'index.html');
const controllerPath = path.join(root, 'assets', 'particle-ocean.js');
const discardedControllerPath = path.join(root, 'assets', 'water-finale.js');
const homepage = fs.readFileSync(homepagePath, 'utf8');

assert.doesNotMatch(homepage, /particle-ocean|particle-ocean\.js/,
  'the production homepage must remain independent from the experimental ocean');
assert.ok(fs.existsSync(oceanPagePath),
  'the separate experimental homepage must continue to exist');
assert.ok(fs.existsSync(controllerPath),
  'the particle ocean controller must exist');
assert.ok(!fs.existsSync(discardedControllerPath),
  'the discarded rising-water controller must not remain in the site bundle');

const oceanPage = fs.readFileSync(oceanPagePath, 'utf8');
const source = fs.readFileSync(controllerPath, 'utf8');
const style = oceanPage.match(/<style>([\s\S]*?)<\/style>/)?.[1] || '';

assert.match(oceanPage,
  /<canvas[^>]+id="particle-ocean"[^>]+class="particle-ocean"[^>]+aria-hidden="true"/,
  'the experimental route needs one decorative particle-ocean canvas');
assert.match(oceanPage, /src="\.\.\/assets\/particle-ocean\.js(?:\?v=\d+)?"/,
  'the route must load the focused particle-ocean controller');
assert.match(oceanPage, /src="\.\.\/assets\/particle-ocean\.js\?v=5"/,
  'the route must cache-bust the corrected perspective wake revision');
assert.doesNotMatch(oceanPage,
  /water-finale|water-screen|water-spray|water-nozzle|water-sprayer|spraying|draining/,
  'the discarded character and rising-water finale must be completely removed');
assert.match(oceanPage, /<footer[^>]*>&copy; 2026 Fabian Hildesheim<\/footer>/,
  'the original footer must remain part of the reading flow');
assert.match(style,
  /\.particle-ocean\s*\{[^}]*position:\s*fixed;[^}]*pointer-events:\s*none;[^}]*z-index:\s*0;/,
  'the ocean must fill the viewport behind the page without intercepting input');
assert.match(style, /body\.is-ocean-dark/,
  'the route needs a coordinated high-contrast dark reading state');
assert.match(style,
  /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*transition:\s*none\s*!important/,
  'reduced-motion visitors must not receive theme choreography transitions');
assert.match(style,
  /\.particle-ocean\s*\{[^}]*background:\s*rgba\(0,\s*0,\s*0,\s*var\(--ocean-exposure\)\)/,
  'the water field must fade toward neutral black rather than blue-washing the page');

assert.match(source, /GRID_DESKTOP_X\s*=\s*320/,
  'desktop particle columns must use the approved bounded grid');
assert.match(source, /GRID_DESKTOP_Y\s*=\s*220/,
  'desktop particle rows must stay below the 76,800-point budget');
assert.match(source, /GRID_MOBILE_X\s*=\s*200/,
  'mobile particle columns must use the reduced grid');
assert.match(source, /GRID_MOBILE_Y\s*=\s*140/,
  'mobile particle rows must stay below the 32,000-point budget');
assert.match(source, /function\s+normalizeScroll\s*\(/,
  'scroll normalization must be isolated as a pure model');
assert.match(source, /getContext\(['"]webgl2['"]/,
  'the primary renderer must use WebGL2');
assert.match(source, /gl_VertexID/,
  'the GPU must derive the particle grid without allocating per-particle objects');
assert.match(source, /drawArrays\([^\n]*POINTS/,
  'the ocean surface must render as a point field');
assert.match(source, /vec4\s+choppyWave\s*\(/,
  'the shader must shape each swell with an asymmetric choppy profile');
assert.doesNotMatch(source, /DOMINANT_WAVE_DIRECTION/,
  'the former depth-facing dominant direction must not survive the 3D refinement');
assert.match(source, /PRIMARY_SWELL_DIRECTION\s*=\s*normalize\(vec2\(0\.91,\s*0\.414\)\)/,
  'the primary swell must travel mostly laterally across the virtual sea');
assert.match(source, /uniform\s+float\s+uAspect/,
  'the perspective camera must account for viewport aspect ratio');
assert.match(source, /DEPTH_DISTRIBUTION\s*=\s*1\.[2-9]/,
  'the grid must devote more rows to the compressed far horizon');
assert.match(source, /struct\s+OceanSample[\s\S]*vec3\s+displacement[\s\S]*vec2\s+slope/,
  'the shader surface must expose three-axis displacement and analytical slope');
assert.match(source, /worldPosition[\s\S]*viewZ[\s\S]*projected/,
  'the particle grid must be projected from world space through camera depth');
assert.match(source, /surfaceSample\.slope/,
  'particle light must respond to surface slope');
assert.match(source, /readingQuiet\s*=\s*mix\(0\.34,\s*1\.0/,
  'the WebGL field must stay subdued behind the central reading column');
assert.match(source, /const\s+readingQuiet\s*=\s*0\.34[\s\S]*\*\s*0\.66/,
  'the Canvas2D fallback must preserve the central reading quiet zone');
assert.match(source, /phaseWarp/,
  'large wave groups must vary instead of repeating at a fixed interval');
assert.match(source, /horizontalDisplacement/,
  'the point field must lean with its waves to preserve three-dimensional volume');
assert.match(source, /function\s+sampleObliqueSurface\s*\(/,
  'the shared fallback model must sample the oblique wave family');
assert.match(source, /function\s+projectOceanPoint\s*\(/,
  'the fallback must share the world-space camera projection');
assert.doesNotMatch(source, /foam|mist|sprayTexture/,
  'the refinement must not add visual layers outside the dotted surface');
assert.match(source, /uPointerEnergy/,
  'the shader must receive cursor energy for a localized wake');
assert.match(source, /MAX_WAKE_NODES\s*=\s*8/,
  'the persistent wake must have a hard eight-node limit');
assert.match(source, /uniform\s+vec4\s+uWakeNodes\s*\[\s*MAX_WAKE_NODES\s*\]/,
  'WebGL must receive wake world position, phase, and energy in a fixed uniform array');
assert.match(source, /uniform\s+vec2\s+uWakeVelocity\s*\[\s*MAX_WAKE_NODES\s*\]/,
  'WebGL must receive fixed wake direction uniforms');
assert.match(source,
  /worldPosition\s*\+=\s*\(surfaceSample\.displacement\s*\+\s*wakeDisplacement\)\s*\*\s*waveScale/,
  'WebGL must sample at the base grid point and scale surface plus wake exactly once');
assert.match(source,
  /prepareWakeFrame\([^;]+\);[\s\S]{0,500}for\s*\(let\s+row[\s\S]*samplePreparedWakeDisplacement/,
  'Canvas2D must precompute wake node world data once before its particle loops');
assert.doesNotMatch(source,
  /for\s*\(let\s+row[\s\S]*for\s*\(let\s+column[\s\S]*mapWakePointToWorld/,
  'Canvas2D must not repeat screen-to-world node mapping per particle');
assert.match(source, /TOP_OCEAN_REVEAL\s*=\s*0\.\d*[1-9]/,
  'particles must have a subtle nonzero reveal at scroll zero');
assert.match(source, /TOP_OCEAN_EXPOSURE\s*=\s*0\.0[0-9]*[1-9]/,
  'the white page must expose enough contrast for a faint top ocean');
assert.match(source,
  /scroll\s*<\s*TOP_BLEND_PROGRESS[\s\S]{0,180}blendFunc\(gl\.SRC_ALPHA,\s*gl\.ONE_MINUS_SRC_ALPHA\)/,
  'WebGL must use neutral alpha near the top so silver particles remain visible on white');
assert.match(source,
  /globalCompositeOperation\s*=\s*scroll\s*<\s*TOP_BLEND_PROGRESS\s*\?\s*['"]source-over['"]\s*:\s*['"]lighter['"]/,
  'Canvas2D must match the subtle top-page compositing before returning to additive light');
assert.match(source, /addEventListener\(['"]pointermove['"]/,
  'pointer movement must drive the ocean interaction');
assert.match(source,
  /document\.documentElement\.addEventListener\(['"]pointerleave['"],\s*handlePointerLeave/,
  'pointer exit must be observed on the document boundary');
assert.match(source, /window\.addEventListener\(['"]blur['"],\s*handlePointerLeave/,
  'window blur must also clear a stale wake emission anchor');
assert.doesNotMatch(source,
  /window\.addEventListener\(['"]pointerleave['"],\s*handlePointerLeave/,
  'the unreliable window pointerleave binding must not survive');
assert.match(source, /requestAnimationFrame/,
  'the ocean must evolve continuously');
assert.match(source, /document\.addEventListener\(['"]visibilitychange['"]/,
  'hidden tabs must pause the animation lifecycle');
assert.match(source,
  /function\s+handlePageHide\s*\(event\)[\s\S]*shouldPreservePageResources\(event\)[\s\S]*renderer\?\.destroy\(\)/,
  'pagehide must preserve renderer resources for BFCache and destroy them otherwise');
assert.match(source, /window\.addEventListener\(['"]pageshow['"],\s*handlePageShow/,
  'BFCache restoration must restart the ocean lifecycle');
assert.match(source, /prefers-reduced-motion:\s*reduce/,
  'the controller must provide a static reduced-motion path');
assert.match(source, /getContext\(['"]2d['"]\)/,
  'a Canvas2D fallback must preserve the experience without WebGL2');
assert.match(source, /dataset\.oceanRenderer\s*=\s*['"]webgl2['"]/,
  'the live canvas must expose the active WebGL2 path for visual verification');
assert.match(source, /dataset\.oceanRenderer\s*=\s*['"]canvas2d['"]/,
  'the live canvas must expose fallback activation for visual verification');

const context = {
  window: {},
  document: { getElementById() { return null; } },
  console,
  Math
};
vm.runInNewContext(source, context, { filename: controllerPath });

const normalizeScroll = context.window.ParticleOceanModel?.normalizeScroll;
assert.equal(typeof normalizeScroll, 'function',
  'the pure scroll model must be published before DOM binding');
assert.equal(normalizeScroll(0, 2000, 1000), 0,
  'the document top must produce zero progress');
assert.equal(normalizeScroll(500, 2000, 1000), 0.5,
  'scroll progress must represent the traveled fraction');
assert.equal(normalizeScroll(1000, 2000, 1000), 1,
  'the document bottom must produce full progress');
assert.equal(normalizeScroll(-20, 2000, 1000), 0,
  'negative overscroll must clamp to zero');
assert.equal(normalizeScroll(100, 800, 1000), 0,
  'short documents must not divide by an invalid scroll range');

const sampleObliqueSurface = context.window.ParticleOceanModel?.sampleObliqueSurface;
const projectOceanPoint = context.window.ParticleOceanModel?.projectOceanPoint;
assert.equal(typeof sampleObliqueSurface, 'function',
  'the oblique surface sampler must be published as a pure model');
assert.equal(typeof projectOceanPoint, 'function',
  'the perspective projector must be published as a pure model');

const sample = sampleObliqueSurface(2.4, 7.1, 1.25);
for (const key of ['x', 'height', 'z', 'slopeX', 'slopeZ', 'crest']) {
  assert.ok(Number.isFinite(sample[key]), `${key} must be finite`);
}
assert.notEqual(sample.x, 0,
  'the world-space surface must include horizontal x displacement');
assert.notEqual(sample.z, 0,
  'the world-space surface must include horizontal depth displacement');

const farProjection = projectOceanPoint(0.5, 0.05, sample, 1, 16 / 9);
const nearProjection = projectOceanPoint(0.5, 0.95, sample, 1, 16 / 9);
for (const projection of [farProjection, nearProjection]) {
  assert.ok(Number.isFinite(projection.x), 'projected x must be finite');
  assert.ok(Number.isFinite(projection.y), 'projected y must be finite');
  assert.ok(Number.isFinite(projection.perspectiveScale),
    'perspective scale must be finite');
}
assert.ok(farProjection.y < nearProjection.y,
  'perspective must place distant water above nearby water');
assert.ok(farProjection.perspectiveScale < nearProjection.perspectiveScale,
  'nearby particles must receive stronger perspective scale');

const flatSurface = { x: 0, height: 0, z: 0, slopeX: 0, slopeZ: 0, crest: 0 };
const narrowLeft = projectOceanPoint(0, 0.55, flatSurface, 1, 390 / 844);
const narrowRight = projectOceanPoint(1, 0.55, flatSurface, 1, 390 / 844);
assert.ok(narrowLeft.x < 0 && narrowRight.x > 1,
  'camera overscan must cover both edges of a narrow viewport');

const {
  MAX_WAKE_NODES,
  WAKE_EMIT_DISTANCE,
  WAKE_LIFETIME,
  TOP_OCEAN_REVEAL,
  CAMERA_HEIGHT,
  CAMERA_PITCH,
  TAN_HALF_FOV,
  OCEAN_FAR,
  DEPTH_DISTRIBUTION,
  createWakeField,
  emitWakeImpulse,
  advanceWakeField,
  resetWakeAnchor,
  screenToOceanWorld,
  projectWorldToScreen,
  getOceanBasePoint,
  getWaveScale,
  mapWakePointToWorld,
  createPreparedWakeFrame,
  prepareWakeFrame,
  createWakeUniformData,
  packWakeUniformData,
  sampleWakeDisplacement,
  samplePreparedWakeDisplacement,
  samplePackedWakeDisplacement,
  sampleParticleColor,
  shouldPreservePageResources
} = context.window.ParticleOceanModel || {};
assert.equal(MAX_WAKE_NODES, 8,
  'the pure wake model must publish its bounded capacity');
assert.ok(WAKE_EMIT_DISTANCE > 0 && WAKE_EMIT_DISTANCE < 0.05,
  'the wake model must publish a meaningful normalized emission threshold');
assert.ok(WAKE_LIFETIME >= 1.4 && WAKE_LIFETIME <= 2,
  'wake nodes must have a deterministic 1.4 to 2 second lifetime');
assert.ok(TOP_OCEAN_REVEAL >= 0.06 && TOP_OCEAN_REVEAL <= 0.12,
  'top-page particles must be discoverable without overpowering the white page');
assert.ok(CAMERA_HEIGHT >= 3.2 && CAMERA_HEIGHT <= 4,
  'the camera must pull back above the water for a wider composition');
assert.ok(CAMERA_PITCH >= 0.34 && CAMERA_PITCH <= 0.44,
  'the camera pitch must retain a low, readable horizon');
assert.ok(TAN_HALF_FOV >= 0.85 && TAN_HALF_FOV <= 1,
  'the wider field of view must zoom out the ocean composition');
assert.ok(OCEAN_FAR >= 40,
  'the ocean must extend far enough to compress points into the horizon');
assert.ok(DEPTH_DISTRIBUTION >= 1.2,
  'the depth curve must allocate more particles to distant water');
for (const [name, helper] of Object.entries({
  createWakeField,
  emitWakeImpulse,
  advanceWakeField,
  resetWakeAnchor,
  screenToOceanWorld,
  projectWorldToScreen,
  getOceanBasePoint,
  getWaveScale,
  mapWakePointToWorld,
  createPreparedWakeFrame,
  prepareWakeFrame,
  createWakeUniformData,
  packWakeUniformData,
  sampleWakeDisplacement,
  samplePreparedWakeDisplacement,
  samplePackedWakeDisplacement,
  sampleParticleColor,
  shouldPreservePageResources
})) {
  assert.equal(typeof helper, 'function', `${name} must be exported as a pure wake helper`);
}

for (const [screenX, screenY, aspect] of [
  [0.08, 0.36, 16 / 9],
  [0.5, 0.52, 16 / 9],
  [0.82, 0.8, 16 / 9],
  [0.94, 0.91, 390 / 844]
]) {
  const worldPoint = screenToOceanWorld(screenX, screenY, aspect);
  assert.equal(worldPoint.valid, true,
    `screen point ${screenX},${screenY} must intersect the ocean plane`);
  const roundTrip = projectWorldToScreen(worldPoint.x, 0, worldPoint.z, aspect);
  assert.ok(Math.abs(roundTrip.x - screenX) < 0.000001,
    `screen x=${screenX} must round-trip through the pitched camera`);
  assert.ok(Math.abs(roundTrip.y - screenY) < 0.000001,
    `screen y=${screenY} must round-trip through the pitched camera`);
}
assert.equal(screenToOceanWorld(0.5, 0.05, 16 / 9).valid, false,
  'screen rays above the camera horizon must not create ocean wake points');

const paritySurface = { x: 0.3, height: -0.12, z: 0.18, slopeX: 0, slopeZ: 0, crest: 0 };
const parityWake = { x: -0.08, y: 0.16, z: 0.05, highlight: 0.4 };
const parityScroll = 0.55;
const parityAspect = 16 / 9;
const parityBase = getOceanBasePoint(0.43, 0.61, parityAspect);
const parityScale = getWaveScale(parityScroll);
const expectedParityProjection = projectWorldToScreen(
  parityBase.x + (paritySurface.x + parityWake.x) * parityScale,
  (paritySurface.height + parityWake.y) * parityScale,
  parityBase.z + (paritySurface.z + parityWake.z) * parityScale,
  parityAspect
);
const actualParityProjection = projectOceanPoint(
  0.43,
  0.61,
  paritySurface,
  parityScroll,
  parityAspect,
  parityWake
);
assert.ok(Math.abs(actualParityProjection.x - expectedParityProjection.x) < 1e-12
    && Math.abs(actualParityProjection.y - expectedParityProjection.y) < 1e-12,
  'shared projection must combine WebGL and Canvas2D surface plus wake before one scale');

const thresholdField = createWakeField();
assert.equal(emitWakeImpulse(thresholdField, 0.2, 0.3, 0.4, 0.1, 0.8), false,
  'the first pointer sample must establish an emission anchor without stamping a node');
assert.equal(emitWakeImpulse(
  thresholdField,
  0.2 + WAKE_EMIT_DISTANCE * 0.5,
  0.3,
  0.4,
  0.1,
  0.8
), false, 'sub-threshold pointer travel must not emit a wake node');
assert.equal(emitWakeImpulse(
  thresholdField,
  0.2 + WAKE_EMIT_DISTANCE * 1.2,
  0.3,
  0.4,
  0.1,
  0.8
), true, 'meaningful pointer travel must emit a wake node');
assert.equal(thresholdField.count, 1,
  'one meaningful pointer movement must create one wake node');

const reentryField = createWakeField();
emitWakeImpulse(reentryField, 0.18, 0.62, 1, 0, 1);
emitWakeImpulse(reentryField, 0.24, 0.62, 1, 0, 1);
const preExitCount = reentryField.count;
resetWakeAnchor(reentryField);
assert.equal(reentryField.hasAnchor, false,
  'pointer exit must clear the emission anchor while preserving existing wake nodes');
assert.equal(emitWakeImpulse(reentryField, 0.88, 0.7, 1, 0, 1), false,
  'the first pointer sample after re-entry must establish a fresh anchor');
assert.equal(reentryField.count, preExitCount,
  'exit-to-reentry must not draw a synthetic trail across the viewport');

const boundedField = createWakeField();
emitWakeImpulse(boundedField, 0.1, 0.45, 0.5, 0, 0.9);
for (let index = 1; index <= 20; index += 1) {
  emitWakeImpulse(boundedField, 0.1 + index * 0.03, 0.45, 0.5, 0, 0.9);
}
assert.equal(boundedField.count, MAX_WAKE_NODES,
  'wake history must remain bounded after repeated movement');
assert.equal(boundedField.nodes.length, MAX_WAKE_NODES,
  'wake storage must remain a fixed allocation');

const driftingField = createWakeField();
emitWakeImpulse(driftingField, 0.3, 0.42, 0.5, 0.2, 0.9);
emitWakeImpulse(driftingField, 0.36, 0.45, 0.5, 0.2, 0.9);
const driftingNode = driftingField.nodes[0];
const startX = driftingNode.x;
const startY = driftingNode.y;
const startEnergy = driftingNode.energy;
advanceWakeField(driftingField, 0.25);
assert.equal(driftingNode.age, 0.25,
  'wake advancement must track node age in seconds');
assert.ok(driftingNode.x > startX && driftingNode.y > startY,
  'wake nodes must drift in their stored velocity direction');
assert.ok(driftingNode.energy > 0 && driftingNode.energy < startEnergy,
  'wake energy must decay smoothly while motion lingers');
advanceWakeField(driftingField, WAKE_LIFETIME);
assert.equal(driftingField.count, 0,
  'wake nodes must expire deterministically at the published lifetime');

const displacementField = createWakeField();
emitWakeImpulse(displacementField, 0.42, 0.58, 0.7, -0.25, 1);
emitWakeImpulse(displacementField, 0.48, 0.56, 0.7, -0.25, 1);
advanceWakeField(displacementField, 0.18);
const wakeWorldPoint = mapWakePointToWorld(
  displacementField.nodes[0].x,
  displacementField.nodes[0].y,
  16 / 9
);
const wakeDisplacement = sampleWakeDisplacement(
  wakeWorldPoint.x,
  wakeWorldPoint.z,
  displacementField,
  16 / 9,
  1.1
);
assert.ok(Math.abs(wakeDisplacement.x) + Math.abs(wakeDisplacement.z) > 0.001,
  'a wake node must produce lateral world-space displacement');
assert.ok(Math.abs(wakeDisplacement.y) > 0.001,
  'a wake node must produce vertical world-space ripple displacement');
const reusableDisplacement = { x: 99, y: 99, z: 99, highlight: 99 };
assert.equal(sampleWakeDisplacement(
  wakeWorldPoint.x,
  wakeWorldPoint.z,
  displacementField,
  16 / 9,
  1.1,
  reusableDisplacement
), reusableDisplacement, 'the fallback must be able to reuse one displacement result per frame');

const preparedWake = createPreparedWakeFrame();
assert.equal(prepareWakeFrame(
  displacementField,
  16 / 9,
  1.1,
  preparedWake
), preparedWake, 'wake precomputation must reuse its fixed frame allocation');
assert.equal(preparedWake.nodes.length, MAX_WAKE_NODES,
  'prepared fallback wake storage must remain capped at eight nodes');
const packedWake = createWakeUniformData();
assert.equal(packWakeUniformData(preparedWake, packedWake), packedWake,
  'WebGL uniform packing must reuse its fixed typed-array allocation');
for (const [worldX, worldZ] of [
  [wakeWorldPoint.x, wakeWorldPoint.z],
  [wakeWorldPoint.x + 0.4, wakeWorldPoint.z - 0.3],
  [wakeWorldPoint.x - 0.65, wakeWorldPoint.z + 0.5]
]) {
  const direct = sampleWakeDisplacement(
    worldX,
    worldZ,
    displacementField,
    16 / 9,
    1.1
  );
  const fallback = samplePreparedWakeDisplacement(worldX, worldZ, preparedWake);
  const webglModel = samplePackedWakeDisplacement(worldX, worldZ, packedWake);
  for (const key of ['x', 'y', 'z', 'highlight']) {
    assert.ok(Math.abs(direct[key] - fallback[key]) < 1e-12,
      `direct and prepared wake ${key} displacement must be numerically identical`);
    assert.ok(Math.abs(webglModel[key] - fallback[key]) < 0.000001,
      `packed WebGL and Canvas2D ${key} displacement must be numerically equivalent`);
  }
}

const farColor = sampleParticleColor(0.01, 0.8);
assert.ok(farColor.b > farColor.g && farColor.g > farColor.r && farColor.b < 0.25,
  'only distant glints must resolve to a very dark cold navy');
const nearColor = sampleParticleColor(0.75, 0.8);
assert.ok(Math.max(nearColor.r, nearColor.g, nearColor.b)
    - Math.min(nearColor.r, nearColor.g, nearColor.b) < 0.015,
  'near water particles must remain neutral rather than blue-washed');

assert.equal(shouldPreservePageResources({ persisted: true }), true,
  'BFCache pagehide must preserve live rendering resources');
assert.equal(shouldPreservePageResources({ persisted: false }), false,
  'normal pagehide must permit final rendering cleanup');

const horizonField = createWakeField();
emitWakeImpulse(horizonField, 0.4, 0.18, 1, 0, 1);
emitWakeImpulse(horizonField, 0.46, 0.18, 1, 0, 1);
const horizonNodeWorld = mapWakePointToWorld(0.46, 0.18, 16 / 9);
const horizonDisplacement = sampleWakeDisplacement(
  horizonNodeWorld.x,
  horizonNodeWorld.z,
  horizonField,
  16 / 9,
  0
);
assert.ok(
  Math.abs(horizonDisplacement.x) + Math.abs(horizonDisplacement.y)
    + Math.abs(horizonDisplacement.z) < 0.000001,
  'the shared wake sampler must match the shader horizon depth envelope'
);

assert.match(source,
  /ParticleOceanDebug\s*=\s*\{[\s\S]*getState:[\s\S]*renderer:[\s\S]*scroll:[\s\S]*pointerEnergy:[\s\S]*wakeCount:[\s\S]*wakeEnergy:/,
  'the debug API must expose renderer, scroll, pointer energy, wake count, and wake energy together');

console.log('PASS: particle ocean route and interaction contracts');
