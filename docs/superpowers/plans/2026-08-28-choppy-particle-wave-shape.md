# Choppy Particle Wave Shape Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the existing dotted background into large, choppy, three-dimensional ocean waves that visually match the Vercel particle-ocean reference without changing the surrounding page treatment.

**Architecture:** Keep the existing single-canvas WebGL2 point grid and replace only its surface function and projection response. A dominant near-forward wave family creates long connected ridges, higher harmonics sharpen the crests, low-frequency phase warping forms irregular wave groups, and restrained horizontal displacement supplies volume; the Canvas2D fallback mirrors the same profile at lower density.

**Tech Stack:** Static HTML/CSS, browser JavaScript, WebGL2 GLSL ES 3.0, Canvas2D fallback, Node contract tests, live in-app-browser visual checks.

---

## File Map

- `assets/particle-ocean.js`: owns the WebGL2 surface shader, point lighting, perspective projection, Canvas2D fallback, and existing interaction lifecycle.
- `scripts/check-particle-ocean.js`: owns structural regression contracts for the experimental route and the wave-shape implementation.
- `water/DESIGN.md`: records the durable large-wave geometry and reference-specific visual constraints.

### Task 1: Add wave-shape regression contracts

**Files:**
- Modify: `scripts/check-particle-ocean.js:42-73`
- Test: `scripts/check-particle-ocean.js`

- [ ] **Step 1: Write the failing source contracts**

Add assertions that require an asymmetric crest profile, a dominant wave direction, phase warping, lateral displacement, and the matching fallback helper:

```js
assert.match(source, /function\s+choppyWave\s*\(/,
  'the shader must shape each swell with an asymmetric choppy profile');
assert.match(source, /DOMINANT_WAVE_DIRECTION/,
  'the surface must establish a dominant direction for connected ocean ridges');
assert.match(source, /phaseWarp/,
  'large wave groups must vary instead of repeating at a fixed interval');
assert.match(source, /horizontalDisplacement/,
  'the point field must lean with its waves to preserve three-dimensional volume');
assert.match(source, /function\s+sampleChoppySurface\s*\(/,
  'the Canvas2D fallback must preserve the approved wave profile');
assert.doesNotMatch(source, /foam|mist|sprayTexture/,
  'the refinement must not add visual layers outside the dotted surface');
```

- [ ] **Step 2: Run the focused contract and verify red**

Run: `node scripts/check-particle-ocean.js`

Expected: FAIL with `the shader must shape each swell with an asymmetric choppy profile`.

- [ ] **Step 3: Commit the failing contract**

```bash
git add scripts/check-particle-ocean.js
git commit -m "Test choppy particle wave geometry"
```

### Task 2: Reshape the WebGL2 ocean

**Files:**
- Modify: `assets/particle-ocean.js:67-148`
- Test: `scripts/check-particle-ocean.js`

- [ ] **Step 1: Replace the rounded directional-wave helper**

Define a dominant direction and use an asymmetric harmonic profile. The primary direction points mostly through depth so its crests remain long and connected across the viewport:

```glsl
const vec2 DOMINANT_WAVE_DIRECTION = vec2(0.14, 0.99015);

vec4 choppyWave(
  vec2 point,
  vec2 direction,
  float frequency,
  float speed,
  float phaseOffset,
  float amplitude,
  float steepness,
  float phaseWarp
) {
  float phase = dot(point, direction) * frequency + uTime * speed + phaseOffset + phaseWarp;
  float fundamental = sin(phase);
  float profile = fundamental
    + sin(phase * 2.0 - 0.52) * 0.31
    + sin(phase * 3.0 - 1.08) * 0.095;
  float crest = pow(max(0.0, fundamental * 0.5 + 0.5), 9.0);
  float group = mix(0.72, 1.22, smoothstep(-1.0, 1.0,
    sin(point.x * 0.19 - point.y * 0.11 + uTime * 0.075 + phaseOffset)));
  float height = (profile + crest * 0.22) * amplitude * group;
  vec2 horizontalDisplacement = direction * cos(phase) * amplitude * steepness * group;
  return vec4(horizontalDisplacement.x, height, horizontalDisplacement.y, crest * amplitude * group);
}
```

- [ ] **Step 2: Build irregular large wave groups**

Replace `oceanSurface()` with one dominant swell, two supporting near-forward waves, one weak cross-swell, and fine crest chop. Use low-frequency phase warping so the ridges meander without breaking into isolated mounds:

```glsl
vec4 oceanSurface(vec2 point) {
  float phaseWarp = sin(point.x * 0.31 + uTime * 0.09) * 0.72
    + sin(point.x * 0.13 - point.y * 0.17 - uTime * 0.055) * 0.46;
  vec4 surface = choppyWave(point, DOMINANT_WAVE_DIRECTION, 0.78, 0.31, 0.2, 0.62, 0.48, phaseWarp);
  surface += choppyWave(point, normalize(vec2(-0.10, 0.995)), 1.17, 0.39, 2.3, 0.27, 0.34, phaseWarp * 0.52);
  surface += choppyWave(point, normalize(vec2(0.31, 0.951)), 1.69, 0.51, 4.1, 0.15, 0.24, phaseWarp * 0.28);
  surface += choppyWave(point, normalize(vec2(-0.48, 0.877)), 2.75, 0.76, 1.4, 0.065, 0.12, phaseWarp * 0.13);
  surface += choppyWave(point, normalize(vec2(0.58, 0.815)), 4.35, 1.03, 5.2, 0.026, 0.07, 0.0);
  return surface;
}
```

- [ ] **Step 3: Project the full displacement field**

Use the returned `x/z` displacement to lean the ridges and shift their depth. Retain the existing scroll reveal and center quiet zone:

```glsl
vec4 surfaceSample = oceanSurface(field);
float displacedDepth = clamp(depth + surfaceSample.z * mix(0.004, 0.038, depth), 0.0, 1.08);
float waveScale = mix(0.74, 1.12, uScroll);
float height = surfaceSample.y * waveScale + wake * 0.54;
float projectedY = mix(horizon, -1.12, displacedDepth);
projectedY += height * mix(0.022, 0.205, displacedDepth);
float horizontalDisplacement = surfaceSample.x * mix(0.004, 0.052, displacedDepth);
float projectedX = (uv.x - 0.5) * 2.0 * spread + horizontalDisplacement;
float slopeLight = smoothstep(0.035, 0.30, length(surfaceSample.xz));
float crest = clamp(smoothstep(0.035, 0.23, surfaceSample.w) + slopeLight * 0.28, 0.0, 1.0);
```

- [ ] **Step 4: Keep the particles subdued on wave faces**

Tune `vAlpha` and `gl_PointSize` so the reference-like crest lines are luminous while the foreground faces remain sparse:

```glsl
float faceLight = mix(0.14, 0.48, depth);
vAlpha = reveal * horizonFade * readingQuiet * (0.022 + faceLight * 0.30 + crest * 0.78);
vCrest = crest;
vDepth = depth;
gl_PointSize = min(6.4, (mix(0.50, 1.58, depth) + crest * 2.05 + wakeEnvelope * uPointerEnergy * 0.82) * uPixelRatio);
```

- [ ] **Step 5: Run syntax and focused contracts**

Run: `node --check assets/particle-ocean.js && node scripts/check-particle-ocean.js`

Expected: syntax check exits zero and the focused contract prints `PASS: particle ocean route and interaction contracts`.

- [ ] **Step 6: Commit the WebGL surface refinement**

```bash
git add assets/particle-ocean.js
git commit -m "Reshape particle field into choppy ocean waves"
```

### Task 3: Match the Canvas2D fallback

**Files:**
- Modify: `assets/particle-ocean.js:271-329`
- Test: `scripts/check-particle-ocean.js`

- [ ] **Step 1: Replace the fallback sine sum**

Implement the same asymmetric profile and dominant depth direction without allocating per-particle objects:

```js
function waveProfile(phase) {
  const fundamental = Math.sin(phase);
  return fundamental
    + Math.sin(phase * 2 - 0.52) * 0.31
    + Math.sin(phase * 3 - 1.08) * 0.095
    + Math.pow(Math.max(0, fundamental * 0.5 + 0.5), 9) * 0.22;
}

sampleChoppySurface(fieldX, fieldY, time) {
  const phaseWarp = Math.sin(fieldX * 0.31 + time * 0.09) * 0.72
    + Math.sin(fieldX * 0.13 - fieldY * 0.17 - time * 0.055) * 0.46;
  const primary = waveProfile(fieldX * 0.14 + fieldY * 0.99015 + time * 0.31 + phaseWarp) * 0.62;
  const supporting = waveProfile(fieldX * -0.117 + fieldY * 1.164 + time * 0.39 + 2.3 + phaseWarp * 0.52) * 0.27;
  const crossing = waveProfile(fieldX * 0.524 + fieldY * 1.607 + time * 0.51 + 4.1 + phaseWarp * 0.28) * 0.15;
  return primary + supporting + crossing;
}
```

- [ ] **Step 2: Feed field depth to the fallback**

Replace the fallback sample call with:

```js
const fieldY = 10.4 + (-2.7 - 10.4) * depth;
const surface = this.sampleChoppySurface(fieldX * 7.2, fieldY, time);
```

Keep the existing wake, exposure, center quieting, and point drawing logic.

- [ ] **Step 3: Run the full static suite**

Run: `node --check assets/particle-ocean.js && bash scripts/check-homepage-experience.sh && git diff --check`

Expected: all commands exit zero and both homepage and particle-ocean contracts print `PASS`.

- [ ] **Step 4: Commit the fallback refinement**

```bash
git add assets/particle-ocean.js scripts/check-particle-ocean.js
git commit -m "Align fallback with choppy ocean profile"
```

### Task 4: Tune against the visual reference

**Files:**
- Modify: `assets/particle-ocean.js`
- Modify: `water/DESIGN.md`
- Test: `scripts/check-particle-ocean.js`

- [ ] **Step 1: Inspect the bottom desktop state**

Open `http://127.0.0.1:8765/water/?ocean=2`, scroll to the bottom, and compare against the supplied reference. Confirm: the horizon is wide and low, at least three overlapping connected ridges are visible, bright regions form narrow crest lines rather than filled mounds, the foreground is darker than the middle distance, and the central reading column remains legible.

- [ ] **Step 2: Inspect motion and cursor response**

Watch for at least five seconds, then move the pointer laterally across a crest. Confirm: large ridges travel slowly with weight, small chop moves faster, no repeating synchronized pulse is obvious, and the cursor wake remains local.

- [ ] **Step 3: Inspect the mobile bottom state**

Use a `390 × 844` viewport and confirm: there is no horizontal overflow, the ocean still reads as connected waves, the large wave scale survives the reduced point budget, and the text remains readable.

- [ ] **Step 4: Record the durable geometry rules**

Add this section to `water/DESIGN.md`:

```markdown
## Wave Geometry

The particle field uses a dominant depth-facing swell so crests read as long connected ocean ridges. Restrained harmonics make each ridge asymmetric and choppy; slow phase warping creates irregular wave groups; weaker oblique waves prevent mechanical parallel bands. Particle brightness concentrates on narrow crests while faces and foreground troughs remain subdued. The effect must not become isolated hills, uniform sine bands, or a new visual layer outside the dots.
```

- [ ] **Step 5: Run final verification**

Run: `node --check assets/particle-ocean.js && node scripts/check-particle-ocean.js && bash scripts/check-homepage-experience.sh && git diff --check HEAD`

Expected: every command exits zero; the focused ocean test and the full homepage suite print only `PASS` lines.

- [ ] **Step 6: Commit tuned values and documentation**

```bash
git add assets/particle-ocean.js water/DESIGN.md
git commit -m "Tune particle ocean to reference wave forms"
```
