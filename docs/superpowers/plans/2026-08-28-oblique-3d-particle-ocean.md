# Oblique 3D Particle Ocean Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/water/` ocean's top-to-bottom wave conveyor with a low-camera, perspective-projected particle sea whose broad swells travel laterally and diagonally through three-dimensional space.

**Architecture:** Keep the single fixed canvas and existing lifecycle, but replace direct screen-row interpolation with a shared analytical world-space ocean model. WebGL2 will project displaced world points through a pitched virtual camera and derive lighting from surface slope; Canvas2D will call matching pure JavaScript sampling and projection helpers.

**Tech Stack:** Vanilla JavaScript, WebGL2 GLSL ES 3.00, Canvas2D fallback, Node.js assertion tests, local static server, in-app browser verification.

---

### Task 1: Lock the oblique 3D geometry contract

**Files:**
- Modify: `scripts/check-particle-ocean.js`
- Test: `scripts/check-particle-ocean.js`

- [ ] **Step 1: Replace the former dominant-direction assertion with failing 3D contracts**

Add source assertions that reject `DOMINANT_WAVE_DIRECTION`, require `PRIMARY_SWELL_DIRECTION`, `uAspect`, `projectOceanPoint`, three-axis displacement, and slope-based lighting. After loading the controller in the VM, require the following public pure helpers:

```js
const model = context.window.ParticleOceanModel;
assert.equal(typeof model.sampleObliqueSurface, 'function');
assert.equal(typeof model.projectOceanPoint, 'function');

const sample = model.sampleObliqueSurface(2.4, 7.1, 1.25);
for (const key of ['x', 'height', 'z', 'slopeX', 'slopeZ', 'crest']) {
  assert.ok(Number.isFinite(sample[key]), `${key} must be finite`);
}

const far = model.projectOceanPoint(0.5, 0.05, sample, 1, 16 / 9);
const near = model.projectOceanPoint(0.5, 0.95, sample, 1, 16 / 9);
assert.ok(far.y < near.y, 'perspective must place distant water above nearby water');
assert.ok(far.perspectiveScale < near.perspectiveScale,
  'nearby particles must receive stronger perspective scale');
```

- [ ] **Step 2: Run the contract test and verify the expected failure**

Run: `node scripts/check-particle-ocean.js`

Expected: FAIL because `sampleObliqueSurface` and `projectOceanPoint` do not yet exist and the old depth-facing direction is still present.

- [ ] **Step 3: Commit the failing test**

```bash
git add scripts/check-particle-ocean.js
git commit -m "Test oblique 3D particle ocean geometry"
```

### Task 2: Build the shared world-space ocean model

**Files:**
- Modify: `assets/particle-ocean.js`
- Test: `scripts/check-particle-ocean.js`

- [ ] **Step 1: Add pure oblique surface sampling**

Replace `sampleChoppySurface` with `sampleObliqueSurface(worldX, worldZ, time)`. Use wave definitions whose primary direction is mostly lateral and whose crossing direction opposes it:

```js
const OBLIQUE_WAVES = [
  [0.91, 0.414, 0.52, 0.31, 0.74, 0.72, 0.62],
  [-0.76, 0.65, 0.76, -0.24, 0.38, 0.46, 2.1],
  [0.58, -0.815, 1.22, 0.44, 0.24, 0.31, 4.0],
  [-0.93, -0.368, 2.15, -0.67, 0.12, 0.16, 1.2],
  [0.33, 0.944, 3.7, 0.93, 0.055, 0.08, 5.0]
];
```

For each wave, return vertical profile, horizontal Gerstner displacement, analytical slope, and crest energy. Export the new helper through `window.ParticleOceanModel`.

- [ ] **Step 2: Add the pure camera projection helper**

Implement `projectOceanPoint(u, rawDepth, sample, scroll, aspect)` with the same constants used by the shader:

```js
const CAMERA_HEIGHT = 2.8;
const CAMERA_PITCH = 0.36;
const TAN_HALF_FOV = 0.68;
const OCEAN_NEAR = 1.55;
const OCEAN_FAR = 24;
```

Map depth into world distance, expand the plane by the view frustum, apply x/y/z displacement, rotate by camera pitch, divide by view depth, and return normalized `x`, `y`, and `perspectiveScale`.

- [ ] **Step 3: Replace the shader's direct row projection**

Add a viewport-aspect uniform and use a pitched virtual camera:

```glsl
const vec2 PRIMARY_SWELL_DIRECTION = normalize(vec2(0.91, 0.414));
float worldDepth = mix(24.0, 1.55, pow(uv.y, 0.78));
float halfWidth = worldDepth * 0.68 * uAspect * 1.08;
vec3 worldPosition = vec3((uv.x - 0.5) * 2.0 * halfWidth, 0.0, worldDepth);
OceanSample surfaceSample = oceanSurface(worldPosition.xz);
worldPosition += surfaceSample.displacement * waveScale;

float cameraPitch = 0.36;
vec3 relative = worldPosition - vec3(0.0, 2.8, 0.0);
float viewY = cos(cameraPitch) * relative.y + sin(cameraPitch) * relative.z;
float viewZ = -sin(cameraPitch) * relative.y + cos(cameraPitch) * relative.z;
vec2 projected = vec2(
  relative.x / (viewZ * 0.68 * uAspect),
  viewY / (viewZ * 0.68)
);
```

Use the analytical slope to create a normal and concentrate brightness on curved crests. Map the cursor into world space at the pointer's estimated view depth before measuring wake distance.

- [ ] **Step 4: Run syntax and contract tests**

Run: `node --check assets/particle-ocean.js && node scripts/check-particle-ocean.js`

Expected: PASS with finite pure-model values and all oblique 3D source contracts satisfied.

- [ ] **Step 5: Commit the renderer**

```bash
git add assets/particle-ocean.js scripts/check-particle-ocean.js
git commit -m "Project particle ocean through a 3D camera"
```

### Task 3: Match the fallback and update the surface contract

**Files:**
- Modify: `assets/particle-ocean.js`
- Modify: `water/DESIGN.md`
- Modify: `water/index.html`
- Test: `scripts/check-particle-ocean.js`

- [ ] **Step 1: Move Canvas2D onto the shared sampler and projector**

For each fallback grid point, call both pure helpers and use projection output directly:

```js
const surface = sampleObliqueSurface(worldX, worldDepth, time);
const projected = projectOceanPoint(u, rawDepth, surface, scroll, width / height);
const x = projected.x * width;
const y = projected.y * height;
const radius = Math.min(1.75, 0.22 + projected.perspectiveScale * 0.72 + crest * 0.48);
```

Derive crest light from `surface.crest`, `surface.slopeX`, and `surface.slopeZ`. Preserve the bounded fallback grid, dark reveal, and additive dots.

- [ ] **Step 2: Update the durable design description**

Revise `water/DESIGN.md` to describe a low pitched world-space camera, predominantly lateral/diagonal cross-swells, three-axis displacement, perspective particle scale, and slope-facing crest light. Remove the statement that the dominant swell faces into depth.

- [ ] **Step 3: Bump the experimental asset revision**

Change the script URL to:

```html
<script src="../assets/particle-ocean.js?v=3" defer></script>
```

- [ ] **Step 4: Run the focused and homepage regression suites**

Run: `node scripts/check-particle-ocean.js && bash scripts/check-homepage-experience.sh && git diff --check`

Expected: all checks pass; the production homepage remains independent from the ocean.

- [ ] **Step 5: Commit the fallback and documentation**

```bash
git add assets/particle-ocean.js water/DESIGN.md water/index.html
git commit -m "Align particle ocean fallback and design"
```

### Task 4: Tune and verify the live experience

**Files:**
- Modify if tuning is required: `assets/particle-ocean.js`
- Test: `scripts/check-particle-ocean.js`

- [ ] **Step 1: Open the cache-busted route in the live local site**

Open: `http://127.0.0.1:8765/water/?ocean=3`

Expected: one fixed particle canvas, the familiar white opening state, and no console errors.

- [ ] **Step 2: Inspect top, middle, and bottom scroll states**

At the bottom, confirm a broad horizon, strong foreground depth, varied oblique crests, and lateral/diagonal motion without a repeated top-to-bottom conveyor. At the top, confirm content remains quiet and legible.

- [ ] **Step 3: Inspect interaction and responsive behavior**

Move the pointer through foreground and middle distance, verify its wake follows the plane, then test a narrow mobile viewport. Confirm no side gaps, clipped horizon, blocked links, or unreadable text.

- [ ] **Step 4: Run the final verification set after any tuning**

Run: `node --check assets/particle-ocean.js && node scripts/check-particle-ocean.js && bash scripts/check-homepage-experience.sh && git diff --check HEAD`

Expected: every command exits successfully.

- [ ] **Step 5: Commit final visual tuning if needed**

```bash
git add assets/particle-ocean.js scripts/check-particle-ocean.js water/DESIGN.md water/index.html
git commit -m "Tune oblique particle ocean depth"
```
