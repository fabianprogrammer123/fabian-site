#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/paint-journey-liquid-model.js'), 'utf8');
const window = {};

vm.runInNewContext(source, { window, Math, Number, Object, Array, Map, Error });

assert.equal(typeof window.PaintJourney.createLiquidModel, 'function',
  'the liquid model factory must be available before the renderer and controller load');

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function gesture(id, offset = 0) {
  return {
    id,
    from: { x: 980 + offset, y: 1600 + offset },
    control: { x: 560 + offset, y: 1480 + offset },
    to: { x: 100 + offset, y: 1540 + offset },
    width: 260,
    palettePhase: 0.62,
    seed: 4,
    reveal: 0,
    spread: 1,
    kind: 0
  };
}

function testStableIdsAndBoundedGestureBudget() {
  const model = window.PaintJourney.createLiquidModel({ maxGestures: 99 });
  assert.equal(model.maxGestures, 12, 'the shader-facing model must never exceed twelve gestures');

  model.upsertGesture(gesture('landing:thoughts'));
  model.upsertGesture({ ...gesture('landing:thoughts'), width: 310 });
  assert.equal(model.count, 1, 'upserting a stable id must update instead of duplicating');
  assert.equal(model.getGesture('landing:thoughts').width, 310,
    'stable-id updates must replace mutable geometry');

  for (let index = 0; index < 20; index += 1) {
    model.upsertGesture(gesture(`landing:${index}`, index * 8));
  }
  assert.equal(model.count, 12, 'the gesture collection must stay inside its fixed uniform budget');
}

function testRevealIsMonotonicAndClamped() {
  const model = window.PaintJourney.createLiquidModel({ maxGestures: 12 });
  model.upsertGesture(gesture('landing:thoughts'));

  assert.equal(model.setReveal('landing:thoughts', 0.65), 0.65,
    'reveal must advance to the requested progress');
  assert.equal(model.setReveal('landing:thoughts', 0.2), 0.65,
    'reveal must never move backward during a pour');
  assert.equal(model.setReveal('landing:thoughts', 4), 1,
    'reveal must clamp above the completed endpoint');
  assert.equal(model.setReveal('landing:thoughts', -4), 1,
    'a later negative sample must not erase settled liquid');
}

function testReflowPreservesPaintIdentityAndProgress() {
  const model = window.PaintJourney.createLiquidModel({ maxGestures: 12 });
  model.upsertGesture({ ...gesture('landing:thoughts'), reveal: 0.38 });
  model.setReveal('landing:thoughts', 0.71);

  model.reflow('landing:thoughts', {
    from: { x: 740, y: 1330 },
    control: { x: 420, y: 1250 },
    to: { x: 60, y: 1290 },
    width: 210,
    spread: 0.88,
    kind: 1,
    reveal: 0,
    seed: 999,
    palettePhase: 0.01
  });

  const reflowed = plain(model.getGesture('landing:thoughts'));
  assert.deepEqual(reflowed.from, { x: 740, y: 1330 }, 'reflow must accept new document geometry');
  assert.deepEqual(reflowed.control, { x: 420, y: 1250 }, 'reflow must preserve a quadratic control point');
  assert.deepEqual(reflowed.to, { x: 60, y: 1290 }, 'reflow must accept the new endpoint');
  assert.equal(reflowed.width, 210, 'reflow must update responsive width');
  assert.equal(reflowed.reveal, 0.71, 'reflow must preserve the settled reveal amount');
  assert.equal(reflowed.seed, 4, 'reflow must preserve the authored morphology seed');
  assert.equal(reflowed.palettePhase, 0.62, 'reflow must preserve the authored pigment family');
}

function testVisiblePacketsCullDeterministically() {
  const model = window.PaintJourney.createLiquidModel({ maxGestures: 12 });
  model.upsertGesture(gesture('visible'));
  model.upsertGesture({
    ...gesture('above'),
    from: { x: 80, y: 120 }, control: { x: 400, y: 90 }, to: { x: 720, y: 130 }, width: 90
  });
  model.upsertGesture({
    ...gesture('below'),
    from: { x: 80, y: 2800 }, control: { x: 400, y: 2750 }, to: { x: 720, y: 2820 }, width: 90
  });

  const viewport = {
    width: 1280,
    height: 720,
    scrollX: 0,
    scrollY: 1000,
    documentWidth: 1280,
    documentHeight: 3200
  };
  const first = plain(model.getVisiblePacket(viewport));
  const second = plain(model.getVisiblePacket({ ...viewport }));

  assert.deepEqual(first, second, 'equal viewport inputs must produce byte-stable packet ordering and values');
  assert.equal(first.count, 1, 'only gestures intersecting the viewport must reach the shader');
  assert.deepEqual(first.ids, ['visible'], 'visible packets must retain stable ids for debugging and reflow');
  assert.equal(first.gestures[0].control.x, 560, 'visible packets must retain the quadratic control point');
}

testStableIdsAndBoundedGestureBudget();
testRevealIsMonotonicAndClamped();
testReflowPreservesPaintIdentityAndProgress();
testVisiblePacketsCullDeterministically();

console.log('PASS: paint journey liquid model behavior');
