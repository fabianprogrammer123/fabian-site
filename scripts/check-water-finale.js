#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const homepagePath = path.join(root, 'index.html');
const waterPagePath = path.join(root, 'water', 'index.html');
const controllerPath = path.join(root, 'assets', 'water-finale.js');
const homepage = fs.readFileSync(homepagePath, 'utf8');

assert.doesNotMatch(homepage, /water-finale\.js|water-screen|water-finale__actor/,
  'the root homepage must remain independent from the water version');
assert.ok(fs.existsSync(waterPagePath),
  'the separate /water/ homepage must exist');
assert.ok(fs.existsSync(controllerPath),
  'the water finale controller must exist');

const waterPage = fs.readFileSync(waterPagePath, 'utf8');
const source = fs.readFileSync(controllerPath, 'utf8');
const style = waterPage.match(/<style>([\s\S]*?)<\/style>/)?.[1] || '';

assert.match(waterPage,
  /<canvas[^>]+id="water-screen"[^>]+class="water-screen"[^>]+aria-hidden="true"/,
  'the water version needs one decorative screen-sized canvas');
assert.match(waterPage, /id="water-nozzle"/,
  'the character SVG needs a visible nozzle that owns the jet origin');
assert.match(waterPage, /id="water-finale"[^>]+data-water-state="idle"/,
  'the finale must expose its choreography state');
assert.match(waterPage, /src="\.\.\/assets\/homepage-navigation\.js"/,
  'the water route must load navigation from the parent asset directory');
assert.match(waterPage, /src="\.\.\/assets\/water-finale\.js"/,
  'the water route must load its focused controller');
assert.match(waterPage, /href="\.\.\/fine-tuned-open-source-models\/"/,
  'the first article link must remain valid from /water/');
assert.match(waterPage, /href="\.\.\/ai-adoption\/"/,
  'the second article link must remain valid from /water/');
assert.doesNotMatch(waterPage, /paint-journey|assets\/paint-finale\.js|id="paint-finale"/,
  'the separate water version must not initialize the paint journey');
assert.match(style,
  /\.water-screen\s*\{[^}]*position:\s*fixed;[^}]*pointer-events:\s*none;[^}]*z-index:\s*50;/,
  'the water canvas must fill the viewport without intercepting input');
assert.match(style,
  /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*transition:\s*none\s*!important/,
  'the page must disable choreography transitions for reduced motion');

assert.match(source, /function\s+createSurface\s*\(/,
  'the controller must expose a pure surface model');
assert.match(source, /clamp\([^,]+,\s*72,\s*220\)/,
  'surface columns must stay within the agreed fixed bounds');
assert.match(source, /MAX_PARTICLES_DESKTOP\s*=\s*520/,
  'desktop particles must use the bounded pool budget');
assert.match(source, /MAX_PARTICLES_MOBILE\s*=\s*240/,
  'mobile particles must use the reduced pool budget');
assert.match(source, /maximumScroll\s*-\s*scrollY\(\)\s*<=\s*2/,
  'activation must wait for the exact document bottom');
assert.match(source, /viewportHeight\s*\*\s*0\.62/,
  'the filled water body must occupy about sixty percent of the viewport');
assert.match(source, /nozzle\.getBoundingClientRect\(\)/,
  'the jet origin must be measured from the visible SVG nozzle');
assert.match(source, /surface\.inject\(/,
  'jet impacts must drive the connected height field');
assert.match(source, /event\.key\s*===\s*['"]Escape['"]/,
  'Escape must cancel and drain the finale');
assert.match(source,
  /event\.key\s*===\s*['"]Escape['"][\s\S]{0,180}clearParticles\(\)[\s\S]{0,120}beginDrain\(\)/,
  'Escape must discard residual spray before draining the overlay');
assert.match(source, /document\.addEventListener\(['"]visibilitychange['"]/,
  'hidden tabs must pause the simulation lifecycle');
assert.match(source, /window\.addEventListener\(['"]resize['"]/,
  'viewport changes must rebuild responsive simulation measurements');
assert.match(source, /prefers-reduced-motion:\s*reduce/,
  'reduced-motion visitors must receive a static fill path');

const context = {
  window: {},
  document: { getElementById() { return null; } },
  console,
  Float32Array,
  Math
};
vm.runInNewContext(source, context, { filename: controllerPath });

assert.equal(typeof context.window.WaterFinaleModel?.createSurface, 'function',
  'the testable surface factory must be published before DOM binding');

const minimumSurface = context.window.WaterFinaleModel.createSurface(12);
const maximumSurface = context.window.WaterFinaleModel.createSurface(999);
assert.equal(minimumSurface.count, 72,
  'small requested grids must clamp to the minimum stable width');
assert.equal(maximumSurface.count, 220,
  'large requested grids must clamp to the maximum performance width');

const surface = context.window.WaterFinaleModel.createSurface(96);
const center = Math.floor(surface.count * 0.5);
surface.inject(0.5, -12, -5);
const injectedEnergy = surface.energy();
assert.ok(injectedEnergy > 0,
  'an impact must add energy to the water surface');

for (let step = 0; step < 40; step += 1) surface.step(1 / 60);
assert.notEqual(surface.sample(center + 7), 0,
  'a localized impact must propagate into neighboring columns');

for (let index = 0; index < surface.count; index += 1) {
  assert.ok(Number.isFinite(surface.sample(index)),
    'surface integration must remain finite');
}

const sustainedSurface = context.window.WaterFinaleModel.createSurface(128);
for (let step = 0; step < 600; step += 1) {
  sustainedSurface.inject(0.72, -3.4, -1.8);
  sustainedSurface.step(1 / 60);
}
let maximumDisplacement = 0;
for (let index = 0; index < sustainedSurface.count; index += 1) {
  maximumDisplacement = Math.max(maximumDisplacement, Math.abs(sustainedSurface.sample(index)));
}
assert.ok(maximumDisplacement <= 54,
  'a sustained jet must create waves without tearing the surface into an unbounded spike');

for (let step = 0; step < 1600; step += 1) surface.step(1 / 60);
assert.ok(surface.energy() < injectedEnergy * 0.12,
  'surface energy must decay after the jet stops');

surface.clear();
assert.equal(surface.energy(), 0,
  'clearing the surface must remove every residual wave');

console.log('PASS: water finale route and simulation contracts');
