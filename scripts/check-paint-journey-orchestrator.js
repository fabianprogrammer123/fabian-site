#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/paint-journey.js'), 'utf8');

function requirePattern(pattern, message) {
  assert.match(source, pattern, message);
}

requirePattern(/function\s+portraitPoint\s*\(/,
  'portrait must use a dedicated element-derived waypoint');
requirePattern(/previousBucketOrigin\.set\(0,\s*0,\s*0\)/,
  'each new paint phase must reset bucket velocity history');
requirePattern(/cancelledBeforeInitialization/,
  'Escape must cancel a journey while Three.js is still loading');
requirePattern(/function\s+atDocumentBottom\s*\([^)]*\)[\s\S]{0,500}maximumScroll[\s\S]{0,300}<=\s*2/,
  'the live journey must wait until the visitor is truly at the document bottom');
requirePattern(/addEventListener\('scroll',\s*watchForBottom/,
  'the bottom trigger must keep watching after the finale first enters the viewport');
requirePattern(/rootMargin:\s*'0px'/,
  'the finale observer must not expand its viewport trigger area');
assert.doesNotMatch(source, /rootMargin:\s*'0px 0px 40% 0px'/,
  'a positive bottom observer margin starts the finale before the visitor reaches the bottom');
requirePattern(/function\s+pauseUntilTargetVisible\s*\(/,
  'manual guidance cancellation must pause an offscreen journey');
requirePattern(/function\s+pauseUntilTargetVisible\s*\([^)]*\)\s*\{[\s\S]{0,500}activeCount/,
  'offscreen pausing must let airborne paint drain before stopping the renderer');
requirePattern(/function\s+resumeIfTargetVisible\s*\(/,
  'a paused journey must resume when its next waypoint becomes visible');
requirePattern(/function\s+laneX\s*\([^)]*\)[\s\S]{0,220}return\s+documentWidth\(\)\s*-\s*inset/,
  'every waypoint must stay on one right-side lane');
requirePattern(/currentPoint\.x\s*\+=\s*laneDeltaX[\s\S]{0,220}stateFrom\.x\s*\+=\s*laneDeltaX[\s\S]{0,220}stateTo\.x\s*\+=\s*laneDeltaX/,
  'a responsive resize must keep the active character and ladder on the right-side lane');
requirePattern(/sourceDeltaY[\s\S]{0,900}targetDeltaY/,
  'responsive layout changes must track source and target heights independently');
requirePattern(/createLadder/,
  'the live journey must construct a 3D ladder');
requirePattern(/ladderReach\s*=\s*\(window\.innerWidth\s*<=\s*520\s*\?\s*48\s*:\s*66\)/,
  'the ladder must extend above the character root so the hands remain on the rails');
requirePattern(/deploy-ladder[\s\S]{0,1200}climb-ladder[\s\S]{0,1200}retrieve-ladder/,
  'the state machine must deploy, climb, and retrieve the ladder');
requirePattern(/climbCycles\s*=\s*clamp\([\s\S]{0,180}rungSpacing/,
  'climb cadence must derive from the climb distance and ladder rung spacing');
requirePattern(/state === 'vanish'[\s\S]{0,1200}setOpacity\(1\s*-\s*eased\)/,
  'the figure must fade out after reaching the top');
requirePattern(/setState\('complete'/,
  'the top disappearance must end in a complete state');
requirePattern(/trail\.impact\(/,
  'each landing must create a pooled paint impact');
requirePattern(/trail\.veil\(/,
  'each landing must cast a broad translucent paint veil across the site');
requirePattern(/landingSequence\s*\*\s*83/,
  'successive landings must rotate through materially different pigment families');
requirePattern(/landingMode\s*=\s*landingSequence\s*%\s*3/,
  'landing compositions must vary instead of repeating one stamped motif');
requirePattern(/landingMode\s*===\s*1[\s\S]{0,500}trail\.spray\(/,
  'one landing composition must favor a loose artist-style sprinkle field');
requirePattern(/PAINT_RATES\s*=\s*\{[\s\S]{0,160}pour:\s*(?:[89]\d|\d{3,})[\s\S]{0,120}swing:\s*(?:[89]\d|\d{3,})/,
  'bucket pours and swings must emit a visibly connected stream');
assert.doesNotMatch(source, /\brope\b|throw-rope|coil-rope|portrait-rest/,
  'the revised live journey must not retain rope or lingering portrait-rest behavior');

console.log('PASS: paint journey orchestrator contract');
