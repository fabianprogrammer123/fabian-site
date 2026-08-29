# Persistent Particle Wake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development while implementing each task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a subtle first-viewport ocean and a persistent cursor-driven particle displacement wake to the existing `/water/` experience.

**Architecture:** Extend the existing plain JavaScript ocean renderer with a bounded, reusable wake-field model. Feed fixed wake arrays to the WebGL2 vertex shader and reuse the same wake sampler in Canvas2D, while retaining all existing camera and surface behavior.

**Tech Stack:** Plain HTML, CSS, JavaScript, WebGL2 GLSL, Canvas2D, Node contract tests.

---

### Task 1: Specify the wake model in tests

**Files:**
- Modify: `scripts/check-particle-ocean.js`

- [ ] Add assertions for exported wake helpers, bounded impulse count, emission distance, decay and expiry, directional drift, physical vertex displacement, fallback parity, a nonzero top reveal, and `particle-ocean.js?v=4`.
- [ ] Run `node scripts/check-particle-ocean.js` and confirm the new assertions fail against the current implementation.

### Task 2: Implement bounded persistent wake state

**Files:**
- Modify: `assets/particle-ocean.js`

- [ ] Add fixed-size wake constants and pure helpers for creating, emitting, advancing, and sampling wake impulses.
- [ ] Export the pure model on `window.ParticleOceanModel` for contract testing.
- [ ] Emit impulses from meaningful pointer travel, preserve velocity direction, advance drift, decay energy, and expire old nodes without unbounded allocations.
- [ ] Expose renderer, scroll progress, pointer energy, wake count, and aggregate wake energy through `window.ParticleOceanDebug`.

### Task 3: Displace particles in both renderers

**Files:**
- Modify: `assets/particle-ocean.js`

- [ ] Add fixed uniform arrays for up to eight wake nodes, ages, energies, and velocities.
- [ ] In the vertex shader, convert each node to ocean world space and apply directional horizontal drag, radial separation, and a phase-advancing vertical ripple before camera projection.
- [ ] Add equivalent displacement to the Canvas2D surface sample before projection.
- [ ] Keep wake lighting subordinate to positional movement so the effect reads as rearranged particles rather than a glow.

### Task 4: Tune first-viewport visibility and integration

**Files:**
- Modify: `assets/particle-ocean.js`
- Modify: `water/index.html`
- Modify: `water/DESIGN.md`

- [ ] Raise the minimum particle reveal to a subtle but visible level and give the canvas a faint initial cool-gray field without compromising text contrast.
- [ ] Preserve the existing scroll-controlled dark transition and full-strength bottom state.
- [ ] Update the script cache version to `v=4` and document the persistent displacement behavior.

### Task 5: Verify

**Files:**
- Test: `scripts/check-particle-ocean.js`
- Test: `scripts/check-homepage-experience.sh`

- [ ] Run `node --check assets/particle-ocean.js`.
- [ ] Run `node scripts/check-particle-ocean.js`.
- [ ] Run `bash scripts/check-homepage-experience.sh`.
- [ ] Run `git diff --check`.
- [ ] Test `/water/?ocean=4` in a live browser at the top and bottom, move the pointer rapidly then stop, confirm the wake continues and decays, inspect desktop and mobile, and confirm no console errors.
