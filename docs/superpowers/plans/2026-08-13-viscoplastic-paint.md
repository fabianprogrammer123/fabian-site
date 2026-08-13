# Viscoplastic Paint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fake analytic liquid ribbons with a causal, document-space, viscoplastic paint simulation that pools, mixes, drips, and renders as glossy wet pigment.

**Architecture:** Keep the current exact-bottom loader, painter, ladder, state machine, and Canvas fallback. Extend the pure gesture model with revisioned simulation packets, rewrite the Three.js liquid field as bounded full-document ping-pong velocity/pressure/pigment targets, and let the existing controller feed local bucket sources plus newly revealed curve intervals.

**Tech Stack:** Vanilla JavaScript, Three.js r180, GLSL, WebGL2 render targets, Node `assert`/`vm` contract tests, local browser visual verification.

---

## File map

- Modify `assets/paint-journey-liquid-model.js`: expose full revisioned simulation packets and distinguish reveal changes from layout reflow.
- Modify `scripts/check-paint-journey-liquid-model.js`: test monotonic revisions, immutable packets, and layout revisions.
- Replace `assets/paint-journey-liquid.js`: own viscoplastic state, pass graph, source injection, full-document atlas, wet material, frame budgets, and disposal.
- Replace `scripts/check-paint-journey-liquid.js`: test target allocation, pass order, source causality, physics/material shader contracts, reflow, responsiveness, throttling, and cleanup.
- Modify `assets/paint-journey.js`: pass bucket document velocity, flow, and bounded particle impacts to the local fluid source while preserving every existing lifecycle contract.
- Modify `assets/paint-journey-particles.js`: expose particle collision batches to the controller instead of permanently stamping the live Canvas trail.
- Modify `scripts/check-paint-journey-particles.js`: test collision callback batching and ensure the Canvas trail remains untouched in the live path.
- Modify `scripts/check-paint-journey-orchestrator.js`: test local spout source semantics and reject a permanent emitter-to-front ribbon.
- Modify `scripts/check-homepage-experience.sh`: include the new liquid-model/field checks without changing route or content contracts.

### Task 1: Revisioned gesture source model

**Files:**
- Modify: `scripts/check-paint-journey-liquid-model.js`
- Modify: `assets/paint-journey-liquid-model.js`

- [ ] **Step 1: Write failing model behavior checks**

Add assertions for this public packet:

```js
const packet = model.getSimulationPacket();
assert.deepEqual(Object.keys(packet), ['revision', 'layoutRevision', 'gestures']);
assert.equal(packet.revision, 1);
assert.equal(packet.layoutRevision, 0);
assert.equal(packet.gestures[0].id, 'landing:bottom');
```

Assert that a larger reveal increments `revision` exactly once, an identical or smaller reveal changes neither revision nor value, geometry reflow increments both `revision` and `layoutRevision`, and modifying a returned packet cannot mutate the model.

- [ ] **Step 2: Run the check and verify RED**

Run: `node scripts/check-paint-journey-liquid-model.js`

Expected: FAIL because `getSimulationPacket` is undefined.

- [ ] **Step 3: Implement the minimum revision API**

Track `revision` and `layoutRevision` inside `createLiquidModel`. Increment `revision` only for a new gesture, a real reveal advance, or an actual geometry/style change. Increment `layoutRevision` only for a real `reflow`. Return deep copies:

```js
function getSimulationPacket() {
  return {
    revision: revision,
    layoutRevision: layoutRevision,
    gestures: gestures.map(copyGesture)
  };
}
```

- [ ] **Step 4: Verify GREEN and commit**

Run: `node scripts/check-paint-journey-liquid-model.js && node --check assets/paint-journey-liquid-model.js`

Expected: both commands pass.

Commit: `git add assets/paint-journey-liquid-model.js scripts/check-paint-journey-liquid-model.js && git commit -m "Track liquid source revisions"`

### Task 2: Full-document viscoplastic GPU field

**Files:**
- Replace: `scripts/check-paint-journey-liquid.js`
- Replace: `assets/paint-journey-liquid.js`

- [ ] **Step 1: Write the failing allocation and pass-graph checks**

Strengthen the Three harness to record render-target reads/writes and material names. Require two velocity targets, two pressure targets, one divergence target, two pigment targets, and one viewport composite. Assert full-document target aspect ratio, desktop/mobile pixel caps, half-float preference, no depth/stencil, and no target sampling itself.

Require a fixed step to record this order:

```js
assert.deepEqual(passNames, [
  'paint-source-velocity',
  'paint-source-pigment',
  'paint-advect-velocity',
  'paint-divergence',
  'paint-pressure',
  'paint-pressure',
  'paint-pressure',
  'paint-pressure',
  'paint-pressure',
  'paint-pressure',
  'paint-pressure',
  'paint-pressure',
  'paint-gradient-subtract',
  'paint-advect-pigment'
]);
```

Mobile expects four pressure passes and one fixed step maximum.

- [ ] **Step 2: Write failing source, physics, and material checks**

Assert reveal `0.2` then `0.3` deposits only `[0, 0.2]` then `[0.2, 0.3]`; repeating `0.3` adds no source; reflow clears and reseeds all revealed gestures once. Require shader source for semi-Lagrangian backtrace, divergence, pressure Jacobi, pressure-gradient subtraction, negative texture-Y gravity, yield threshold, shear-dependent drag, thickness-gradient surface relaxation, low-diffusion pigment advection, Kubelka-Munk reflectance, thickness-derived normal, wet roughness, meniscus, and reading-lane attenuation. Require a custom composite shader that maps `(scroll + screenPoint) / documentSize` with one Y flip. Explicitly reject `CONTOUR_BANDS`, `SPECTRUM_STRIPE_SPAN`, quadratic SDF display, `travellingGlint`, `MeshBasicMaterial`, and an emitter line segment.

- [ ] **Step 3: Run the field check and verify RED**

Run: `node scripts/check-paint-journey-liquid.js`

Expected: FAIL because the current field allocates one viewport RGBA8 target and still contains analytic contour bands.

- [ ] **Step 4: Implement bounded render-target helpers and materials**

Create focused helpers inside `paint-journey-liquid.js`:

```js
function createTarget(width, height, label) { /* half-float, no depth/stencil */ }
function createPingPong(width, height, label) { /* read/write/swap/dispose */ }
function runPass(material, destination) { /* restore renderer target */ }
function boundedDimensions(documentWidth, documentHeight, scale, cap, maximum) { /* preserve aspect */ }
```

Create named materials for clear, source velocity, source pigment, velocity advection/forces, divergence, pressure, gradient subtraction, pigment advection, and the viewport wet composite. Use one shared full-screen simulation mesh and swap its material per pass. Feature-gate renderable half-float targets and throw into the existing controller fallback when unavailable; do not use unsigned-byte signed velocity. Preserve and restore the renderer target, `autoClear`, viewport, scissor, and scissor-test state around solver passes.

- [ ] **Step 5: Implement causal interval injection**

Read `model.getSimulationPacket()` during updates. Track `lastRevealById`. Sample only newly revealed curve intervals into a fixed `MAX_SPLATS` uniform packet. Add a local emitter splat at the exact bucket origin, using `front` only as an aim direction. Deposit mass-weighted adjacent pigments and thickness; inject momentum separately. Never draw authored curves in the composite.

- [ ] **Step 6: Implement the fixed-step viscoplastic solver**

Use desktop `1/30` with at most two catch-up steps and eight pressure iterations; mobile `1/20`, one step, four pressure iterations. Apply downward gravity only where thickness and wet mobility exceed the yield threshold, strong resting drag, reduced drag under fresh shear, restrained surface-gradient relaxation, and deterministic substrate resistance. Advect pigment with low diffusion and bounded sharpening. Use mobile pigment scale 0.38, subject to the 420,000-pixel and maximum-texture-size caps.

- [ ] **Step 7: Implement subtractive wet rendering**

Composite the full-document pigment atlas using scroll/document uniforms. Convert absorption-to-reflectance with Kubelka-Munk, calculate normals from neighboring thickness samples, derive roughness from local mobility, add a directional dielectric highlight and light-facing meniscus, deepen thick pools, reveal paper through thin edges, and attenuate alpha in the reading lane. Do not use time-driven highlights.

- [ ] **Step 8: Implement resize, ambient, freeze, and disposal behavior**

Pure scroll changes only composite uniforms. Document-size or layout-revision changes clear and reseed revealed gesture sources, then run four relaxation steps. Ambient uses 24/15 fps and stops solver steps after 12 seconds without injection. `setMobile` reallocates only when dimensions change. `freeze` stops state evolution but permits dirty compositing. `dispose` releases each target, geometry, and material exactly once.

- [ ] **Step 9: Verify GREEN and commit**

Run: `node scripts/check-paint-journey-liquid.js && node --check assets/paint-journey-liquid.js && git diff --check`

Expected: all pass.

Commit: `git add assets/paint-journey-liquid.js scripts/check-paint-journey-liquid.js && git commit -m "Simulate viscoplastic document paint"`

### Task 3: Bucket and particle source integration

**Files:**
- Modify: `scripts/check-paint-journey-orchestrator.js`
- Modify: `assets/paint-journey.js`
- Modify: `scripts/check-paint-journey-particles.js`
- Modify: `assets/paint-journey-particles.js`
- Modify: `scripts/check-homepage-experience.sh`

- [ ] **Step 1: Write failing controller checks**

Assert the emitter payload includes document-space bucket velocity and flow:

```js
liquid.setEmitter({
  active: pourAmount > 0.015,
  origin: documentPoint,
  front: landingFront,
  velocity: documentVelocity,
  pressure: pourAmount,
  flow: 0.55 + pourAmount * 0.45,
  palettePhase: landingPalettePhase
});
```

Retain all exact-bottom, no-pretrigger-allocation, reduced-motion, loading cancellation, pagehide, context-loss, completion, ambient retention, semantic reflow, and mobile tests.

Add a particle behavior check that one update delivers all collisions through `onImpactBatch(items, count)` and does not call `trail.stampBatch` or `trail.stamp` when that callback is provided. Preserve legacy trail stamping only when the callback is absent, so isolated fallback behavior remains compatible.

- [ ] **Step 2: Run orchestrator and homepage checks and verify RED**

Run: `node scripts/check-paint-journey-orchestrator.js && ./scripts/check-homepage-experience.sh`

Expected: FAIL because the current controller does not send `velocity` or `flow`, and particles do not expose a live impact callback.

- [ ] **Step 3: Implement document-space source motion**

Track the previous projected spout point and compute bounded document pixels per second from frame `delta`. Reset it at state boundaries and after hidden-tab resumes. Pass the velocity and pressure-derived flow to `setEmitter`; keep all dry-state calls inactive with zero flow. Give particles an `onImpactBatch` callback that forwards bounded document-space local sources to `liquid.addImpactBatch`, and never writes normal-path impacts to the Canvas trail. Do not change gesture timing, character movement, ladder behavior, or lazy loading.

- [ ] **Step 4: Verify GREEN and commit**

Run: `./scripts/check-homepage-experience.sh && node --check assets/paint-journey.js && git diff --check`

Expected: the complete homepage suite passes.

Commit: `git add assets/paint-journey.js assets/paint-journey-particles.js scripts/check-paint-journey-orchestrator.js scripts/check-paint-journey-particles.js scripts/check-homepage-experience.sh && git commit -m "Drive paint from physical sources"`

### Task 4: Browser visual and runtime refinement

**Files:**
- Modify as evidence requires: `assets/paint-journey-liquid.js`, its focused check, and controller source/check together.

- [ ] **Step 1: Run the isolated site and capture baseline views**

Serve the worktree with `python3 -m http.server 8767 --bind 127.0.0.1`. In the in-app browser, test desktop and 390 pixel mobile. Capture the bottom before trigger, first causal pour, mid-pour, a connector/drip view, completed full-page state, and a state at least ten seconds after completion.

- [ ] **Step 2: Verify visual acceptance**

Confirm no pretrigger paint; one connected spout stream; broad pools with non-repeating lobes; narrow vertical drips with bulb ends; marbled 8 to 24 pixel pigment filaments; green/orange/violet subtractive overlaps; stable directional wet highlights; readable content; no horizontal overflow; and document anchoring after a 500 pixel scroll.

- [ ] **Step 3: Iterate through test-first refinements**

For every observed defect, add a focused failing contract or deterministic runtime assertion before changing production code. Tune only source radius/momentum, yield stress, gravity, drag, sharpening, pigment calibration, thickness response, meniscus, or frame budgets. Do not reintroduce analytic bands or time-driven decoration.

- [ ] **Step 4: Run final verification**

Run:

```sh
./scripts/check-homepage-experience.sh
node --check assets/paint-journey-liquid-model.js
node --check assets/paint-journey-liquid.js
node --check assets/paint-journey.js
git diff --check
git status --short
```

Expected: all checks pass and only intentional branch commits are present.

- [ ] **Step 5: Commit visual refinements**

Commit the focused files with: `git commit -m "Refine wet paint flow and optics"`.
