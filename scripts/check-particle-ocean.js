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
assert.match(oceanPage, /src="\.\.\/assets\/particle-ocean\.js\?v=3"/,
  'the route must cache-bust the oblique 3D ocean revision');
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
assert.match(source, /struct\s+OceanSample[\s\S]*vec3\s+displacement[\s\S]*vec2\s+slope/,
  'the shader surface must expose three-axis displacement and analytical slope');
assert.match(source, /worldPosition[\s\S]*viewZ[\s\S]*projected/,
  'the particle grid must be projected from world space through camera depth');
assert.match(source, /surfaceSample\.slope/,
  'particle light must respond to surface slope');
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
assert.match(source, /addEventListener\(['"]pointermove['"]/,
  'pointer movement must drive the ocean interaction');
assert.match(source, /addEventListener\(['"]pointerleave['"]/,
  'the cursor wake must decay after the pointer leaves');
assert.match(source, /requestAnimationFrame/,
  'the ocean must evolve continuously');
assert.match(source, /document\.addEventListener\(['"]visibilitychange['"]/,
  'hidden tabs must pause the animation lifecycle');
assert.match(source, /prefers-reduced-motion:\s*reduce/,
  'the controller must provide a static reduced-motion path');
assert.match(source, /getContext\(['"]2d['"]\)/,
  'a Canvas2D fallback must preserve the experience without WebGL2');

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

console.log('PASS: particle ocean route and interaction contracts');
