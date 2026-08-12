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
requirePattern(/function\s+scheduleRestLayout\s*\([\s\S]{0,500}state\s*!==\s*'portrait-rest'[\s\S]{0,500}scheduleLayout\(\)/,
  'the finished character must stay anchored beside the portrait while the visitor scrolls');
requirePattern(/addEventListener\('scroll',\s*scheduleRestLayout/,
  'portrait rest must subscribe to scroll-driven viewport alignment');
requirePattern(/state === 'throw-rope'[\s\S]{0,1400}updateRopeEndpoints\(target\)/,
  'the rope origin must follow the moving throw hand every frame');
requirePattern(/trail\.whorl\(/,
  'landing paint must create a connected spectrum whorl');
requirePattern(/PAINT_RATES\s*=\s*\{[\s\S]{0,160}pour:\s*(?:[89]\d|\d{3,})[\s\S]{0,120}swing:\s*(?:[89]\d|\d{3,})/,
  'bucket pours and swings must emit a visibly connected stream');

console.log('PASS: paint journey orchestrator contract');
