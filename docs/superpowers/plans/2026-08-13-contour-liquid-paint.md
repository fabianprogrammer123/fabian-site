# Contour Liquid Paint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace repeated translucent paint capsules with one bucket-driven, marbled contour-liquid surface and make the simple painter visibly cute and physically causal.

**Architecture:** Add a focused Three.js liquid-surface module that evaluates a bounded set of document-space stroke capsules as one smooth signed-distance field. The journey controller owns stroke choreography and lifecycle, the character exposes physically meaningful pour amount, and the existing Canvas2D trail provides a still nested-contour fallback for reduced motion and WebGL failure.

**Tech Stack:** Vanilla JavaScript, Three.js r180, GLSL fragment shader, Canvas 2D, Node `assert`/`vm` behavior checks, in-app browser runtime.

---

## File map

- Create `assets/paint-journey-liquid-model.js`: pure bounded quadratic gesture state, reveal, reflow and viewport packet culling.
- Create `assets/paint-journey-liquid.js`: low-resolution SDF/metaball render target, GLSL contour material, compositing, ambient mode and disposal.
- Create `scripts/check-paint-journey-liquid-model.js`: deterministic gesture-model behavior harness.
- Create `scripts/check-paint-journey-liquid.js`: shader adapter and lifecycle behavior harness.
- Modify `assets/paint-journey.js`: create and drive liquid strokes from the bucket, preserve settled liquid after actor cleanup, update exact-bottom and fallback lifecycle.
- Modify `assets/paint-journey-character.js`: rounded clay silhouette, stronger readable motion, causal four-beat pour and `getPourAmount()`.
- Modify `assets/paint-journey-trail.js`: original still nested-contour composition for reduced motion and failure.
- Modify `index.html`: load the liquid module before the controller and preserve layer ordering.
- Modify existing paint checks and `scripts/check-homepage-experience.sh`: integration, lifecycle, responsive and regression contracts.

### Task 1: Lock the continuous liquid model and renderer contracts

**Files:**
- Create: `scripts/check-paint-journey-liquid-model.js`
- Create: `scripts/check-paint-journey-liquid.js`
- Create: `assets/paint-journey-liquid-model.js`
- Create: `assets/paint-journey-liquid.js`

- [ ] **Step 1: Write a failing liquid-module behavior check**

Build minimal Three.js stubs and assert the wished-for API:

```js
const model = PaintJourney.createLiquidModel({ maxGestures: 12 });
model.upsertGesture({
  id: 'landing:thoughts',
  from: { x: 980, y: 1600 }, control: { x: 560, y: 1480 },
  to: { x: 100, y: 1540 }, width: 260,
  palettePhase: 0.62, seed: 4, reveal: 0, spread: 1, kind: 0
});
model.setReveal('landing:thoughts', 0.65);
const field = PaintJourney.createLiquidField({ THREE, renderer, scene, model, mobile: false });
field.setViewport({
  width: 1280, height: 720, scrollX: 0, scrollY: 1000,
  documentWidth: 1280, documentHeight: 1800
});
field.update(1 / 60, 1.2);
```

Assert gesture count is bounded at 12, stable IDs do not duplicate, reveal is monotonic/clamped, reflow preserves reveal/seed/palette, and viewport packets are deterministic. Assert one composite plane and one low-resolution render target are created, target pixels/DPR are capped, ambient throttles to 24/15fps, and double disposal releases target/geometry/material exactly once. Assert shader source includes quadratic distance, polynomial smooth-min, domain warp, six contour strata, edge shadow and glint; forbid per-gesture mesh creation.

- [ ] **Step 2: Run the liquid check and verify RED**

Run `node scripts/check-paint-journey-liquid-model.js && node scripts/check-paint-journey-liquid.js`. Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement the minimal bounded liquid surface**

Implement `PaintJourney.createLiquidModel()` with at most 12 stable quadratic gestures, and `PaintJourney.createLiquidField()` with fixed typed uniform arrays, a private liquid scene/low-resolution target, one transparent composite plane at depth 4, document-to-viewport uniforms, and these methods:

```js
return { setViewport, setEmitter, update, setAmbient, freeze, dispose };
```

Use quadratic distance sampling, a polynomial `smin`, two low-cost sine/noise domain warps, six distance thresholds for contour bands, neighboring grounded pigment RGB values, a dark edge, inner shadow and specular glint. Keep loops compile-time bounded.

- [ ] **Step 4: Run the liquid check and verify GREEN**

Run `node scripts/check-paint-journey-liquid-model.js && node scripts/check-paint-journey-liquid.js`. Expected: both PASS.

### Task 2: Replace segmented paint choreography

**Files:**
- Modify: `scripts/check-paint-journey-orchestrator.js`
- Modify: `assets/paint-journey.js`
- Modify: `index.html`
- Modify: `scripts/check-homepage-experience.sh`

- [ ] **Step 1: Write failing controller contracts**

Assert the controller:

```js
liquidModel = PaintJourney.createLiquidModel({ maxGestures: 12 });
liquid = PaintJourney.createLiquidField({ THREE, renderer, scene, model: liquidModel, mobile });
liquidModel.upsertGesture({ id, from, control, to, width, palettePhase, seed, reveal: 0 });
liquidModel.setReveal(id, pourAmount);
```

Require exactly one new broad stroke per landing, one updated connector per climb, all origins derived from `character.paintSpout`, no `LANDING_SEGMENTS`, and no live broad composition through `trail.flow`, `trail.veil`, `trail.whorl`, or `trail.spray`. Require `assets/paint-journey-liquid.js` to load before the controller.

- [ ] **Step 2: Run the orchestrator check and verify RED**

Run `node scripts/check-paint-journey-orchestrator.js`. Expected: FAIL on the old 18-segment `trail.flow()` choreography.

- [ ] **Step 3: Integrate one liquid surface**

Create the surface after renderer/scene initialization. At each pour, create one horizontal stroke from the current projected spout to the authored landing destination; update its reveal from `character.getPourAmount()` and gesture progress. During a climb, create/update one narrow connector from the last landing endpoint to the current spout. Reduce particles to a single commitment splash and a small lip stream.

Update liquid viewport uniforms on every live frame and on responsive layout changes. Preserve exact-bottom lazy creation: `createLiquidSurface` must never be called before `beginLoading()` and Three.js resolution.

- [ ] **Step 4: Run orchestrator/homepage checks and verify GREEN**

Run:

```sh
node scripts/check-paint-journey-orchestrator.js
./scripts/check-homepage-experience.sh
```

Expected: both PASS.

### Task 3: Make the painter simple, cute and causal

**Files:**
- Modify: `scripts/check-paint-journey-character.js`
- Modify: `assets/paint-journey-character.js`
- Modify: `assets/paint-journey.js`

- [ ] **Step 1: Write failing silhouette and pour tests**

Assert head width is at least 25% of projected figure height, shoulders are at most ±12.5 units, arm segments at most 17/15, legs at most 22/20, joint caps do not contrast with adjacent limbs, and materials are matte/smooth rather than `flatShading: true`.

Sample `paint-swing` at 60Hz and assert:

```js
assert.equal(character.getPourAmount(), 0);       // before 16%
assert.ok(midPour > 0.75);                        // committed 40–82%
assert.equal(character.getPourAmount(), 0);       // after recovery
assert.ok(maxJointDelta < 0.10);                  // no snapping
```

Assert the first emitted liquid sample is within three projected pixels of `paintSpout` and that climb/vanish emit nothing when pour amount is zero.

- [ ] **Step 2: Run the character check and verify RED**

Run `node scripts/check-paint-journey-character.js`. Expected: FAIL on current dimensions and missing `getPourAmount()`.

- [ ] **Step 3: Implement the clay atelier sprite**

Use overlapping capsule limbs, matched/hidden joint caps, shoulder x ±12.5, arms 17/15, legs 22/20, head about 15×16, larger hands, a warm-white apron, charcoal overalls/cap and warm-white face/bucket. Use smooth matte materials; keep clearcoat only on bucket paint.

Change rendering scale to approximately `0.82` desktop and `0.60` mobile, with lane insets near 82/34 pixels. Implement a four-beat pour: anticipation 0–16%, lift 16–40%, committed two-hand tip 40–82%, damped recovery 82–100%. Derive and expose pour amount from bucket tip. Remove climb and vanish emissions unless actual bucket tilt creates a positive pour amount.

- [ ] **Step 4: Run character and controller checks and verify GREEN**

Run:

```sh
node scripts/check-paint-journey-character.js
node scripts/check-paint-journey-orchestrator.js
```

Expected: both PASS.

### Task 4: Build the still contour fallback

**Files:**
- Modify: `scripts/check-paint-journey-trail.js`
- Modify: `assets/paint-journey-trail.js`
- Modify: `assets/paint-journey.js`

- [ ] **Step 1: Write a failing `contourField()` check**

Call:

```js
trail.contourField({
  from: { x: 980, y: 400 }, to: { x: 80, y: 460 },
  width: 280, hue: 228, seed: 3, layers: 6
});
```

Require a single shared cubic centerline, six nested opaque round strokes from broad to narrow, one outer shadow, one restrained highlight, neighboring RGB pigments, one protection clip, and no translucent per-segment capsule accumulation.

- [ ] **Step 2: Run the trail check and verify RED**

Run `node scripts/check-paint-journey-trail.js`. Expected: FAIL because `contourField` is undefined.

- [ ] **Step 3: Implement and use the still composition**

Add `contourField()` and change `drawStaticSpectrum()` to draw one broad contour field per semantic band plus one connector between adjacent bands. Use this path only for reduced motion and WebGL failure, still inside the exact-bottom gate.

- [ ] **Step 4: Run trail/orchestrator checks and verify GREEN**

Run:

```sh
node scripts/check-paint-journey-trail.js
node scripts/check-paint-journey-orchestrator.js
```

Expected: both PASS.

### Task 5: Separate actor cleanup from settled liquid lifetime

**Files:**
- Modify: `scripts/check-paint-journey-orchestrator.js`
- Modify: `assets/paint-journey.js`
- Modify: `scripts/check-homepage-experience.sh`

- [ ] **Step 1: Write failing lifecycle tests**

Require that completion disposes character, ladder, and particles, calls `liquid.setAmbient(true)`, retains renderer/canvas/liquid, throttles ambient frames to 24fps desktop/15fps mobile, and installs passive scroll/resize redraw handlers. Require hidden tabs to stop ambient frames and final teardown/context loss to dispose liquid and renderer. Test hidden-tab phase preservation, resize redraw, Escape, loading race, reduced motion, exact-bottom and post-completion details reflow.

- [ ] **Step 2: Run orchestrator check and verify RED**

Run `node scripts/check-paint-journey-orchestrator.js`. Expected: FAIL because current `cleanupLiveLayer()` removes the WebGL canvas at completion.

- [ ] **Step 3: Split cleanup and render-on-demand**

Implement `cleanupActorLayer()`, `renderAmbientLiquid()`, `attachSettledListeners()`, and `disposeLiveLayer()`. Completion switches the liquid to very slow bounded ambient motion, disposes actor resources, and throttles the loop to 24/15fps. Hidden tabs stop the loop. Scroll/resize/toggle schedule an immediate redraw. Context loss or navigation teardown disposes all live resources.

- [ ] **Step 4: Run lifecycle checks and verify GREEN**

Run `node scripts/check-paint-journey-orchestrator.js` and `./scripts/check-homepage-experience.sh`. Expected: both PASS.

### Task 6: Visual iteration and full verification

**Files:**
- Modify if required: liquid, controller, character, trail and their checks.

- [ ] **Step 1: Run all automated checks**

Run:

```sh
./scripts/check-homepage-experience.sh
./scripts/check-homepage-quotes.sh
./scripts/check-ai-adoption-page.sh
./scripts/check-article-page.sh
node --check assets/paint-journey-liquid.js
node --check assets/paint-journey-character.js
node --check assets/paint-journey-trail.js
node --check assets/paint-journey.js
git diff --check
```

Expected: all PASS with zero syntax/whitespace errors.

- [ ] **Step 2: Perform desktop browser review**

Reload at 1280px. Verify no artwork three pixels before the bottom, trigger at the exact bottom, and capture exact-bottom, mid-pour, mid-climb, and completed screenshots. Reject any repeated capsule ends, overlap rings, muddy translucency, detached paint source, unreadable copy, runtime error, or continuing animation after settle.

- [ ] **Step 3: Perform mobile browser review**

Repeat at 390px. Verify the figure is 68–78px tall, stays fully inside the right lane, the liquid is broad but text remains readable, `scrollWidth === clientWidth`, and the full sequence completes.

- [ ] **Step 4: Iterate until the material passes the reference test**

Compare against the reference’s qualities: one connected surface, nested irregular bands, slow morphological flow, deep tonal separation, smooth edges and dimensional light. Adjust only bounded shader palette, domain warp, contour thresholds, width and timing; rerun targeted checks after each change.

- [ ] **Step 5: Run the Impeccable detector exactly once**

Run:

```sh
node /Users/fabian/.agents/skills/impeccable/scripts/detect.mjs --json \
  index.html assets/paint-journey-liquid.js assets/paint-journey-character.js \
  assets/paint-journey-trail.js assets/paint-journey.js
```

Expected: no blocking findings.

- [ ] **Step 6: Request final spec and code-quality reviews**

Provide reviewers the design spec, current diff, automated outputs and browser captures. Resolve every Critical/Important finding and rerun complete verification.

- [ ] **Step 7: Commit and integrate**

Stage only this feature’s files, commit `Rebuild the paint as contour liquid`, then integrate the isolated branch without touching unrelated Stanford image files.
