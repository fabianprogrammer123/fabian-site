#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const homepage = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const fallback = fs.readFileSync(path.join(root, 'assets/paint-finale.js'), 'utf8');
const style = homepage.match(/<style>([\s\S]*?)<\/style>/)?.[1] || '';

assert.match(style,
  /\.paint-finale__canvas\s*,\s*\.finale-walker\s*\{[^}]*opacity:\s*0\s*;[^}]*visibility:\s*hidden\s*;/,
  'the fallback character and paint must be visually dormant before exact-bottom activation');
assert.match(style,
  /\.paint-finale\.is-enhanced\s+\.paint-finale__canvas\s*,\s*\.paint-finale\.is-enhanced\s+\.finale-walker\s*\{[^}]*opacity:\s*1\s*;[^}]*visibility:\s*visible\s*;/,
  'the fallback character and paint must become visible only after startFallback activates the stage');
assert.match(fallback,
  /function\s+startFallback[\s\S]{0,360}stage\.classList\.add\('is-enhanced'\)/,
  'fallback activation must own the class that reveals its previously dormant artwork');
assert.match(fallback,
  /paintOwnedByTrail[\s\S]{0,220}canvas\.style\.visibility\s*=\s*['"]hidden['"]/,
  'a full-page contour fallback must suppress the legacy finale paint canvas');
assert.match(fallback,
  /if\s*\(paintOwnedByTrail\)[\s\S]{0,120}setWalkerState\(timeline\.settleEnd\)/,
  'the legacy fallback may retain only its simple settled character when the trail owns paint');

console.log('PASS: paint finale activation contract');
