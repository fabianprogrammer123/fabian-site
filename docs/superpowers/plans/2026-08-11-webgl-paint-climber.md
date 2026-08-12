# WebGL Paint Climber Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a procedural 3D character that starts at the homepage bottom, emits full-spectrum paint from its bucket, throws and climbs ropes between page sections, and ends beside the portrait without compromising reading or visitor control.

**Architecture:** Keep the homepage compatible with direct `file://` viewing by loading local journey modules as deferred classic scripts that register focused factories under `window.PaintJourney`. The orchestrator lazy-loads a pinned Three.js ES module near the bottom trigger, renders live 3D in a fixed transparent canvas, and stamps settled paint into a separate document-sized 2D canvas; the existing finale remains the reduced-motion and WebGL/import-failure fallback.

**Tech Stack:** HTML5, CSS, vanilla JavaScript, Three.js `0.180.0` from jsDelivr, Canvas 2D, WebGL, POSIX shell contract tests, Node syntax checks, browser visual verification.

---

## File Map and Interfaces

- Modify `index.html`: add the document paint canvas, fixed WebGL host, layer/z-index styles, local scripts, and journey-safe content stacking.
- Create `assets/paint-journey-trail.js`: expose `PaintJourney.createTrail({ canvas, contentSelectors })` returning `{ resize, clear, stamp, ribbon, spray, drawStaticSpectrum, destroy }`.
- Create `assets/paint-journey-character.js`: expose `PaintJourney.createCharacter({ THREE, scene })` returning `{ root, bucketLip, throwingHand, setPose, setScreenPose, update, dispose }`.
- Create `assets/paint-journey-rope.js`: expose `PaintJourney.createRope({ THREE, scene })` returning `{ throwBetween, update, setEndpoints, hide, dispose, caught }`.
- Create `assets/paint-journey-particles.js`: expose `PaintJourney.createParticles({ THREE, scene, trail, capacity })` returning `{ emit, burst, update, setHue, dispose, activeCount }`.
- Create `assets/paint-journey.js`: own lazy loading, waypoints, the state machine, scroll guidance/cancellation, scene lifecycle, bucket-lip emission, fallback, and context-loss handling.
- Modify `assets/paint-finale.js`: expose `window.PaintFinale.startFallback()` and avoid starting the old finale until requested by the journey controller.
- Modify `scripts/check-homepage-experience.sh`: enforce layers, module interfaces, state names, continuous hue, bucket emitter, cancellation, fallback, reduced motion, and pinned Three.js URL.

## Task 1: Homepage Layers and Contract

**Files:**
- Modify: `scripts/check-homepage-experience.sh`
- Modify: `index.html`

- [ ] **Step 1: Add failing page-layer checks**

Add exact requirements for `id="journey-paint-layer"`, `id="journey-webgl-layer"`, `class="journey-content"`, `pointer-events: none`, all five local script paths, and `data-journey-level` values `thoughts`, `background`, `now`, `why-this-site`, and `portrait`.

- [ ] **Step 2: Run the contract and verify RED**

Run `./scripts/check-homepage-experience.sh` and expect failure for the missing `journey-paint-layer`.

- [ ] **Step 3: Add minimal layer markup and CSS**

Place both decorative canvases immediately after the homepage navigation. Wrap existing readable content in `.journey-content`, add `data-journey-level` attributes to target headings and the portrait, and keep the finale as the last child. Use these stacking guarantees:

```css
.journey-paint-layer { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
.journey-webgl-layer { position: fixed; inset: 0; pointer-events: none; z-index: 30; }
.journey-content { position: relative; z-index: 2; }
.section-nav { z-index: 40; }
```

Make each canvas `aria-hidden="true"`. Add the four focused journey scripts, then the controller, before `paint-finale.js`.

- [ ] **Step 4: Run the contract and HTML regression checks**

Run `./scripts/check-homepage-experience.sh && ./scripts/check-homepage-quotes.sh`. Expect both to print `PASS`.

## Task 2: Persistent Content-Safe Paint Trail

**Files:**
- Create: `assets/paint-journey-trail.js`
- Modify: `scripts/check-homepage-experience.sh`

- [ ] **Step 1: Add failing trail-interface checks**

Require `PaintJourney.createTrail`, `getExclusionZones`, `hsl(`, `drawStaticSpectrum`, `devicePixelRatio`, and methods `stamp`, `ribbon`, `spray`, `resize`, and `destroy`.

- [ ] **Step 2: Verify RED**

Run the homepage contract and expect failure for missing `PaintJourney.createTrail`.

- [ ] **Step 3: Implement the trail factory**

Implement a document-sized high-DPI canvas capped at DPR 1.5. Cache exclusion rectangles expanded by 14px for headings, paragraphs, lists, links, navigation, portrait, bubble, and footer. `stamp({ x, y, hue, radius, alpha })` clips around exclusions, draws an HSL radial blob, and adds deterministic dry-brush gaps. `ribbon({ from, to, hue, width })` stamps along a cubic midpoint curve. `spray` emits deterministic dots. `drawStaticSpectrum(waypoints)` connects the safe edge lanes for reduced motion. Resize snapshots the existing canvas to an offscreen canvas, resizes, redraws, and rebuilds exclusions.

- [ ] **Step 4: Verify GREEN and JavaScript syntax**

Run `./scripts/check-homepage-experience.sh && node --check assets/paint-journey-trail.js`.

## Task 3: Procedural 3D Character and Bucket Emitter

**Files:**
- Create: `assets/paint-journey-character.js`
- Modify: `scripts/check-homepage-experience.sh`

- [ ] **Step 1: Add failing character-interface checks**

Require `PaintJourney.createCharacter`, `bucketLip`, `throwingHand`, pose names `walk`, `coil-rope`, `throw-rope`, `brace`, `climb`, `pull-bucket`, `paint-swing`, `rest`, and `dispose`.

- [ ] **Step 2: Verify RED**

Run the homepage contract and expect failure for missing `PaintJourney.createCharacter`.

- [ ] **Step 3: Build a reusable procedural rig**

Build `THREE.Group` joints for root, pelvis, torso, neck, head, shoulders, elbows, wrists, hips, knees, ankles, bucket arm, and bucket. Reuse low-poly capsule, rounded-box, sphere, cylinder, and shoe geometries with matte charcoal/off-white physical materials. Generate a 64×64 dotted face texture on a canvas. Add a hemispheric key light, rim light, and contact-shadow disk within the character group. Parent `bucketLip` to the bucket rim and `throwingHand` to the free wrist.

`setPose(name, progress, phase)` procedurally blends planted walking, throw anticipation/release, braced rope catch, alternating climbing pulls, bucket hauling, paint swing, and rest. `update(delta)` applies secondary bucket sway and breathing; `setScreenPose({ x, y, scale, facing, depth })` positions the orthographic-world root.

- [ ] **Step 4: Verify GREEN and syntax**

Run `./scripts/check-homepage-experience.sh && node --check assets/paint-journey-character.js`.

## Task 4: Responsive Rope and Spectrum Particles

**Files:**
- Create: `assets/paint-journey-rope.js`
- Create: `assets/paint-journey-particles.js`
- Modify: `scripts/check-homepage-experience.sh`

- [ ] **Step 1: Add failing rope/particle checks**

Require both factories plus `throwBetween`, `setEndpoints`, `caught`, `capacity`, `bucketVelocity`, `hue = (hue +`, `emit`, `burst`, `activeCount`, and `trail.stamp`.

- [ ] **Step 2: Verify RED**

Run the homepage contract and expect the rope factory requirement to fail.

- [ ] **Step 3: Implement rope physics**

Render a 20-segment `THREE.CatmullRomCurve3` tube. During `throwBetween`, advance the head along a ballistic arc. After catch, simulate vertical sag with a critically damped spring and small hand-driven waves. Update the tube geometry only while visible. `setEndpoints` maps the character hand and responsive anchor into orthographic scene coordinates.

- [ ] **Step 4: Implement pooled paint particles**

Preallocate typed arrays and one `THREE.Points` geometry. `emit({ origin, velocity, bucketVelocity, count, hue })` fills dead slots; particles apply gravity and drag. When a particle crosses the page plane, call `trail.stamp` using document coordinates, then retire the slot. `burst` emits a wider cone. Hue advances continuously with `hue = (hue + delta * 52) % 360`. Cap active particles at 600 desktop/260 mobile and reduce emission when rolling frame time exceeds 22ms.

- [ ] **Step 5: Verify GREEN and syntax**

Run the homepage contract and `node --check` for both new files.

## Task 5: Journey Orchestrator, Control, and Fallback

**Files:**
- Create: `assets/paint-journey.js`
- Modify: `assets/paint-finale.js`
- Modify: `scripts/check-homepage-experience.sh`

- [ ] **Step 1: Add failing orchestration checks**

Require the pinned URL `https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.min.js`, state names `idle`, `loading`, `entering`, `bottom-paint`, `walk`, `coil-rope`, `throw-rope`, `brace`, `climb`, `pull-bucket`, `paint-swing`, `portrait-rest`, `cancelled-rest`, `getWorldPosition`, `wheel`, `touchstart`, `pointerdown`, `keydown`, `Escape`, `webglcontextlost`, and `startFallback`.

- [ ] **Step 2: Verify RED**

Run the contract and expect failure for the pinned Three.js URL.

- [ ] **Step 3: Refactor the old finale into an explicit fallback**

Wrap its startup logic in `startFallback({ staticOnly = false })`, make it idempotent, register it as `window.PaintFinale.startFallback`, and auto-start only after a short delay when no journey controller has claimed the stage. Reduced-motion mode draws the complete static finale without animation.

- [ ] **Step 4: Implement the state machine and waypoints**

Observe the bottom stage with a generous root margin, then dynamic-import pinned Three.js. Compute content-safe alternating waypoints from the five target rectangles. Use an orthographic camera whose CSS-pixel coordinates match the viewport. Advance through bottom painting and each walk/rope/climb cycle with eased state durations. Read `character.bucketLip.getWorldPosition()` for every emission origin and `throwingHand.getWorldPosition()` for rope origin.

- [ ] **Step 5: Implement guided scroll and visitor cancellation**

Scroll only while climbing toward the next section, using small `window.scrollTo` updates. Mark guided updates so they do not self-cancel. Wheel, touchstart, pointerdown, navigation keys, Space, PageUp/PageDown, Home/End disable guidance immediately. Escape moves to `cancelled-rest`, stops particles, hides rope, and settles at the nearest edge. Without guidance, pause between waypoints until the next target is visible.

- [ ] **Step 6: Implement failure/reduced-motion/context-loss paths**

Reduced motion calls `trail.drawStaticSpectrum`, starts the static fallback, and never imports Three.js. Import/WebGL failure removes the live canvas and calls `startFallback`. On `webglcontextlost`, prevent default, dispose the live scene, preserve the settled trail, and start the fallback.

- [ ] **Step 7: Verify GREEN and syntax**

Run the homepage contract, syntax-check every journey script, and run all existing site checks.

## Task 6: Visual Motion Tuning and Completion

**Files:**
- Correct evidence-backed issues in: `index.html`, `assets/paint-journey*.js`, `assets/paint-finale.js`

- [ ] **Step 1: Serve the site and inspect desktop**

At 1440×1000, trigger the journey and capture bottom pour, first rope throw, mid-climb, later waypoint, and portrait-rest. Verify dimensional lighting, planted feet, bucket inertia, rope connection, full-spectrum emission from the lip, text-safe settled paint, and guided scroll.

- [ ] **Step 2: Verify control and fallback behavior**

Interrupt guided motion with wheel and keyboard input, press Escape, emulate reduced motion, and simulate a WebGL/import failure. Confirm control returns immediately and each fallback is intentional.

- [ ] **Step 3: Inspect mobile**

At 390×844, confirm edge-lane travel, 72–92px character scale, no text obstruction, no horizontal overflow, reduced particle density, and successful progression between all levels.

- [ ] **Step 4: Run fresh completion verification**

Run:

```sh
./scripts/check-homepage-quotes.sh
./scripts/check-homepage-experience.sh
./scripts/check-ai-adoption-page.sh
./scripts/check-article-page.sh
for file in assets/paint-journey*.js assets/paint-finale.js assets/homepage-navigation.js; do node --check "$file"; done
git diff --check
```

Expect four `PASS` messages, zero syntax failures, no diff whitespace errors, no browser console errors, and zero desktop/mobile horizontal overflow.
