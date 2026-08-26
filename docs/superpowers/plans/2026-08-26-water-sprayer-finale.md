# Water Sprayer Finale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a separate `/water/` homepage where the existing handmade character sprays a causal water jet that fills the lower 60% of the viewport with responsive waves and drains when the visitor scrolls away.

**Architecture:** Preserve the root homepage and clone its current document into `water/index.html`, changing only relative paths and the finale-specific styles, scripts, canvases, and SVG. A dependency-free `assets/water-finale.js` exposes a testable height-field model, then binds it to a fixed Canvas2D renderer, a pooled jet/splash system, exact-bottom lifecycle controls, and character state classes.

**Tech Stack:** Static HTML, SVG, CSS, Canvas2D, browser `requestAnimationFrame`, Node.js contract/model tests, Python static server for runtime verification.

---

## File Map

- Create `water/index.html`: standalone homepage variant, water finale layout, character SVG, accessibility and responsive styles.
- Create `assets/water-finale.js`: pure height-field model, exact-bottom controller, jet/splash particles, water rendering, scroll lifecycle, and fallbacks.
- Create `scripts/check-water-finale.js`: structural and behavioral contracts for the separate route and simulation.
- Preserve `index.html`: the original homepage must not reference or load the water finale.

### Task 1: Define the water-version contracts

**Files:**
- Create: `scripts/check-water-finale.js`
- Test: `scripts/check-water-finale.js`

- [ ] **Step 1: Write the failing route and controller contract test**

Create assertions that read `index.html`, `water/index.html`, and `assets/water-finale.js`. The route assertions require a decorative fixed canvas, a visible SVG nozzle, the new controller, corrected parent-relative homepage assets, no paint-journey scripts, and no water script in the root page:

```js
assert.match(water, /<canvas[^>]+id="water-screen"[^>]+aria-hidden="true"/);
assert.match(water, /id="water-nozzle"/);
assert.match(water, /src="\.\.\/assets\/water-finale\.js"/);
assert.doesNotMatch(water, /paint-journey|paint-finale\.js/);
assert.doesNotMatch(homepage, /water-finale\.js|water-screen/);
```

Evaluate the controller in a `vm` context whose `document.getElementById()` returns `null`, then exercise `window.WaterFinaleModel.createSurface(96)`. Require bounded counts, a localized injection, neighbor propagation after 20 fixed steps, finite samples, and energy decay after 300 steps.

- [ ] **Step 2: Run the contract test and verify the missing implementation fails**

Run: `node scripts/check-water-finale.js`

Expected: FAIL with `ENOENT` for `water/index.html` or `assets/water-finale.js`.

- [ ] **Step 3: Commit the failing test**

```bash
git add scripts/check-water-finale.js
git commit -m "Test water finale contracts"
```

### Task 2: Create the isolated homepage variant

**Files:**
- Create: `water/index.html`
- Reference: `index.html`
- Test: `scripts/check-water-finale.js`

- [ ] **Step 1: Clone the current homepage document mechanically**

Create `water/index.html` from the exact current `index.html` so all copy, links, voice portrait behavior, and inline portrait data remain identical at the start of the task.

- [ ] **Step 2: Change only route-relative references**

Use `../assets/homepage-navigation.js`, `../assets/water-finale.js`, `../fine-tuned-open-source-models/`, and `../ai-adoption/`. Fragment-only navigation links remain unchanged.

- [ ] **Step 3: Replace paint layers and scripts with the water finale surface**

Remove both journey canvases and every paint-journey/paint-finale script. Change the main wrapper to `.water-content`. Replace the bottom section with this component contract:

```html
<section class="water-finale" id="water-finale" aria-label="Water page finale" data-water-state="idle">
  <canvas id="water-screen" class="water-screen" aria-hidden="true"></canvas>
  <div class="water-finale__actor" id="water-actor" aria-hidden="true">
    <div class="water-finale__ledge"></div>
    <svg class="water-finale__character" viewBox="0 0 220 190">
      <g class="water-character">
        <circle cx="112" cy="45" r="18" fill="url(#water-portrait-dots)" />
        <path d="M94 68h34l8 58H86Z" fill="#222" />
        <path d="m98 122-9 54H76l6-58Zm24 0 23 49-12 5-27-50Z" fill="#222" />
      </g>
      <g class="water-hose">
        <path d="M118 79q22 11 43 3" fill="none" stroke="#222" stroke-width="7" />
        <path d="M157 76h28v12h-28Z" fill="#fff" stroke="#222" stroke-width="3" />
        <circle id="water-nozzle" cx="186" cy="82" r="3" fill="#7bd6ff" />
      </g>
    </svg>
  </div>
  <footer class="water-finale__footer">&copy; 2026 Fabian Hildesheim</footer>
</section>
```

- [ ] **Step 4: Add water-specific responsive and reduced-motion styles**

The canvas is `position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 50`. The actor and footer sit above it at z-indices 52 and 53. The actor uses state-driven transforms for `idle`, `entering`, `aiming`, `spraying`, `settling`, and `draining`; its final ledge aligns with `bottom: calc(60vh - 8px)`. Mobile reduces the actor from 190px to 132px and moves it inward. Reduced motion disables every CSS transition and keyframe.

- [ ] **Step 5: Run the route half of the contract test**

Run: `node scripts/check-water-finale.js`

Expected: FAIL only because the controller file is still missing.

- [ ] **Step 6: Commit the isolated route**

```bash
git add water/index.html
git commit -m "Add isolated water homepage"
```

### Task 3: Implement the causal water simulation

**Files:**
- Create: `assets/water-finale.js`
- Test: `scripts/check-water-finale.js`

- [ ] **Step 1: Expose the pure bounded height-field model**

Inside an IIFE, define `createSurface(requestedCount)` and expose it before querying the DOM:

```js
function createSurface(requestedCount) {
  var count = clamp(Math.round(requestedCount), 72, 220);
  var height = new Float32Array(count);
  var velocity = new Float32Array(count);
  var nextVelocity = new Float32Array(count);
  return {
    count: count,
    inject: function (normalizedX, displacement, force) {
      var center = clamp(Math.round(normalizedX * (count - 1)), 0, count - 1);
      for (var offset = -3; offset <= 3; offset += 1) {
        var index = clamp(center + offset, 0, count - 1);
        var weight = 1 - Math.abs(offset) / 4;
        height[index] += displacement * weight;
        velocity[index] += force * weight;
      }
    },
    step: function (delta) {
      var dt = Math.min(Math.max(delta, 0), 1 / 30) * 60;
      for (var index = 0; index < count; index += 1) {
        var left = height[index > 0 ? index - 1 : 1];
        var right = height[index < count - 1 ? index + 1 : count - 2];
        nextVelocity[index] = (velocity[index] + ((left + right) * 0.5 - height[index]) * 0.12 * dt - height[index] * 0.018 * dt) * Math.pow(0.985, dt);
      }
      for (var cursor = 0; cursor < count; cursor += 1) {
        velocity[cursor] = nextVelocity[cursor];
        height[cursor] += velocity[cursor] * dt;
      }
    },
    sample: function (index) { return height[clamp(Math.round(index), 0, count - 1)]; },
    energy: function () {
      var total = 0;
      for (var index = 0; index < count; index += 1) total += Math.abs(height[index]) + Math.abs(velocity[index]);
      return total;
    },
    clear: function () { height.fill(0); velocity.fill(0); }
  };
}
window.WaterFinaleModel = { createSurface: createSurface };
```

Use fixed substeps capped at 1/30 second, neighbor coupling, a restorative spring, and damping so an injected crest propagates and decays without instability.

- [ ] **Step 2: Bind exact-bottom and cancellation lifecycle**

Implement `atDocumentBottom()` using `maximumScroll - scrollY <= 2`. A passive scroll handler starts/refills at the bottom and sets target fill to zero above it. Escape permanently cancels the visit and drains. Visibility change cancels the frame while hidden and resets the prior timestamp before resuming. Resize preserves fill and recreates a bounded surface count.

- [ ] **Step 3: Implement character choreography and nozzle measurement**

Write `setState(next)` to update `data-water-state`. Sequence entering for 700 ms, aiming for 650 ms, spraying until fill reaches 1, then settling. Cache the visible `#water-nozzle` center after aiming and after resize; use that point as the jet origin.

- [ ] **Step 4: Implement the pooled jet and splash system**

Preallocate 520 particle records, or 240 on mobile. `emitJet()` places coherent core droplets along the nozzle-to-impact direction. `updateParticles()` applies gravity, converts water-line collisions into height-field impulses, and reuses particles for bounded crown splashes and foam. Never allocate particle objects inside the frame loop.

- [ ] **Step 5: Render the connected water body and continuous pour**

Compute the mean surface as `viewportHeight + 18 - fill * viewportHeight * 0.62`. Draw one smoothed full-width path from the sampled height field to the bottom, fill it with a deep-to-pale blue gradient, clip caustic bands and bubbles inside it, stroke two translucent surface rims, then render a quadratic nozzle-to-impact stream and particle highlights.

- [ ] **Step 6: Implement adaptive settling and reduced motion**

Fill toward one at approximately 0.14 per second and drain toward zero at 0.9 per second. Reduce emission when frame time exceeds 24 ms. Stop requesting frames once drained; keep low-amplitude ambient steps after settling. For reduced motion, set fill to one at exact bottom, draw once with a still curve, reveal the settled actor, and schedule no animation.

- [ ] **Step 7: Run the focused test**

Run: `node scripts/check-water-finale.js`

Expected: `PASS: water finale route and simulation contracts`.

- [ ] **Step 8: Commit the simulation**

```bash
git add assets/water-finale.js scripts/check-water-finale.js
git commit -m "Build water sprayer finale"
```

### Task 4: Validate the complete separate version

**Files:**
- Verify: `water/index.html`
- Verify: `assets/water-finale.js`
- Verify: existing scripts under `scripts/`

- [ ] **Step 1: Run the focused and existing automated checks**

Run:

```bash
node scripts/check-water-finale.js
for test in scripts/check-*.js; do node "$test"; done
for test in scripts/check-*.sh; do sh "$test"; done
```

Expected: every script prints `PASS` and exits zero. If an unrelated pre-existing dirty-file test fails, record it separately and do not alter those files.

- [ ] **Step 2: Run syntax and whitespace checks**

Run:

```bash
node --check assets/water-finale.js
node --check scripts/check-water-finale.js
git diff --check
```

Expected: all commands exit zero with no diagnostics.

- [ ] **Step 3: Serve and verify runtime behavior**

Start `python3 -m http.server 8080`, open `/water/`, confirm the route returns HTTP 200, scroll to the exact bottom, and inspect the rendered state after the entering, spraying, and filled phases. Then scroll upward and confirm drainage. Repeat at a mobile viewport. Require no console errors, no horizontal overflow, and the root `/` still rendering its original experience.

- [ ] **Step 4: Review the final diff scope**

Run `git status --short` and `git diff --stat HEAD~3..HEAD`. Confirm only the design, plan, new water route, controller, and focused test belong to this feature. Preserve all unrelated user modifications and untracked files.

- [ ] **Step 5: Commit any verification-only fixes**

```bash
git add water/index.html assets/water-finale.js scripts/check-water-finale.js
git commit -m "Polish water finale behavior"
```

Only create this commit when verification required an actual product-source correction.
