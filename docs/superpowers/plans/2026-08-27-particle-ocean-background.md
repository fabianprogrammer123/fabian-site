# Particle Ocean Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the experimental water finale with a continuously moving, scroll-revealed, cursor-reactive monochrome particle ocean.

**Architecture:** A fixed decorative canvas runs a bounded WebGL2 perspective point grid whose vertex shader computes layered wave displacement and a cursor wake. The route controller smooths scroll and pointer state, switches the page contrast theme, pauses while hidden, and falls back to a lower-density Canvas2D renderer.

**Tech Stack:** Static HTML/CSS, browser JavaScript, WebGL2 GLSL ES 3.0, Canvas2D fallback, Node contract tests.

---

### Task 1: Replace the finale contract

**Files:**
- Create: `scripts/check-particle-ocean.js`
- Delete: `scripts/check-water-finale.js`

- [ ] **Step 1: Write the failing route and behavior assertions**

Assert that `/water/` contains `#particle-ocean`, loads `particle-ocean.js`, contains no sprayer/finale markup, keeps the root homepage isolated, and that the controller contains bounded point budgets, scroll progress, pointer input, continuous animation, visibility handling, reduced-motion behavior, and Canvas2D fallback.

- [ ] **Step 2: Run the test to verify red**

Run: `node scripts/check-particle-ocean.js`

Expected: FAIL because the particle-ocean files and markup do not exist.

### Task 2: Replace the route surface

**Files:**
- Modify: `water/index.html`

- [ ] **Step 1: Remove the water finale**

Delete `.water-finale`, `.water-screen`, `.water-spray`, sprayer animation styles, the finale SVG markup, and the `water-finale.js` script reference.

- [ ] **Step 2: Add the ocean surface**

Add a fixed `#particle-ocean` canvas immediately inside `body`, scroll-driven light/dark theme tokens, inherited link colors, portrait inversion, and reduced-motion CSS. Keep the canvas at `z-index: 0`, content at `z-index: 2`, and navigation at `z-index: 40` with `pointer-events: none` on the canvas.

### Task 3: Build the ocean controller

**Files:**
- Create: `assets/particle-ocean.js`
- Delete: `assets/water-finale.js`

- [ ] **Step 1: Publish the pure scroll model**

Expose `ParticleOceanModel.normalizeScroll(scrollY, documentHeight, viewportHeight)` before DOM binding and clamp invalid or short-page inputs to `[0, 1]`.

- [ ] **Step 2: Build the WebGL2 renderer**

Compile a vertex shader that derives a perspective grid from `gl_VertexID`, combines four directional spectral waves, adds a radial cursor wake, and scales point brightness near crests. Draw no more than `320 * 240` desktop points or `200 * 160` mobile points with round point sprites and additive alpha blending.

- [ ] **Step 3: Connect scroll and pointer state**

Smooth target scroll progress and pointer coordinates each frame. Feed `uScroll`, `uPointer`, `uPointerEnergy`, `uTime`, `uGrid`, and `uPixelRatio` uniforms. Toggle the dark content theme only after the field supplies sufficient contrast.

- [ ] **Step 4: Add lifecycle and fallback behavior**

Pause animation while hidden, rebuild measurements on resize, render one static frame for reduced motion, and provide a Canvas2D perspective row fallback when WebGL2 is unavailable.

- [ ] **Step 5: Run the focused test to verify green**

Run: `node scripts/check-particle-ocean.js`

Expected: `PASS: particle ocean route and interaction contracts`.

### Task 4: Visual tuning and completion

**Files:**
- Modify: `water/index.html`
- Modify: `assets/particle-ocean.js`
- Modify: `water/DESIGN.md`

- [ ] **Step 1: Inspect three scroll states**

Verify the top is quiet and white, the middle visibly transitions, and the bottom is a deep black particle ocean with readable white copy.

- [ ] **Step 2: Inspect interaction states**

Verify pointer movement forms a localized wake, pointer leave decays naturally, links remain clickable, section navigation remains readable, and the portrait interaction remains available.

- [ ] **Step 3: Verify the project**

Run: `git diff --check -- water/index.html water/DESIGN.md assets/particle-ocean.js scripts/check-particle-ocean.js PRODUCT.md docs/superpowers/specs/2026-08-27-particle-ocean-background-design.md docs/superpowers/plans/2026-08-27-particle-ocean-background.md`

Run: `node --check assets/particle-ocean.js && node scripts/check-particle-ocean.js && bash scripts/check-homepage-experience.sh`

Expected: all commands exit zero with no warnings.
