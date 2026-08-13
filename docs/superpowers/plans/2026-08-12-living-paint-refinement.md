# Living Paint Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the bottom-triggered 3D painter cute and naturally grounded while turning its output into a rich, continuous full-page pigment flow.

**Architecture:** Preserve the current split between the Three.js character rig, the 2D persistent trail canvas, and the journey controller. Add expressive but constrained poses inside the rig, add one `flow()` primitive to the trail, and let the controller progressively reveal that primitive from the bucket at each semantic page band and along climbs.

**Tech Stack:** Vanilla JavaScript, Three.js r180, Canvas 2D, Node `assert`/`vm` behavior checks, local browser runtime.

---

### Task 1: Lock the compact character contract

**Files:**
- Modify: `scripts/check-paint-journey-character.js`
- Modify: `assets/paint-journey-character.js`

- [ ] **Step 1: Write failing silhouette tests**

Add assertions that the head is at least as wide as the shoulder-to-torso gap suggests, shoulders sit at `<= 14` units, upper/lower arms are `<= 21` units, thighs/shins are `<= 26` units, and limb radii keep the silhouette rounded.

- [ ] **Step 2: Run the character test and verify RED**

Run `node scripts/check-paint-journey-character.js`. Expected: the current shoulder spacing and limb lengths fail the new compact-rig assertions.

- [ ] **Step 3: Implement the compact atelier-sprite rig**

Shorten and thicken limbs, lower the pelvis to preserve ground contact, enlarge the face slightly, move shoulders inward, keep the bucket closer to the wrist, and draw a small asymmetric smile in the face texture.

- [ ] **Step 4: Run the character test and verify GREEN**

Run `node scripts/check-paint-journey-character.js`. Expected: all silhouette and existing resource-lifecycle assertions pass.

### Task 2: Lock natural movement and contact

**Files:**
- Modify: `scripts/check-paint-journey-character.js`
- Modify: `assets/paint-journey-character.js`

- [ ] **Step 1: Write failing motion tests**

Test that walking keeps hip swing under `0.28`, shoulder swing under `0.2`, bucket elbow visibly bent, and head follow-through under `0.08`. Test that ladder shoulders stay under `2.5` radians and knees remain bent. Retain exact pose-transition continuity assertions.

- [ ] **Step 2: Run the character test and verify RED**

Run `node scripts/check-paint-journey-character.js`. Expected: current ladder reach and bucket-carry angles fail.

- [ ] **Step 3: Implement grounded pose arcs**

Use restrained hip/torso counter-motion, alternating support-foot planting, bent-elbow bucket carry, head follow-through, an anticipatory deployment crouch, a four-contact climb rhythm, and prepare/sweep/recover timing for the pour.

- [ ] **Step 4: Run the character test and verify GREEN**

Run `node scripts/check-paint-journey-character.js`. Expected: all motion and transition tests pass.

### Task 3: Build the rich fluid-current primitive

**Files:**
- Modify: `scripts/check-paint-journey-trail.js`
- Modify: `assets/paint-journey-trail.js`

- [ ] **Step 1: Write a failing `flow()` behavior test**

Call `trail.flow({ from, to, hue, width, progress, seed })` and assert a clipped drawing pass contains multiple cubic paths, a broad underwash, saturated body, narrower wet edge and glint widths, neighboring RGB pigment colors, and bounded eddies/droplets. Assert no HSL colors or unbounded loops.

- [ ] **Step 2: Run the trail test and verify RED**

Run `node scripts/check-paint-journey-trail.js`. Expected: `trail.flow` is undefined.

- [ ] **Step 3: Implement `flow()`**

Build one deterministic cubic centerline, reveal it up to `progress`, and draw layered round-cap strokes using source-over, multiply, and screen blending. Add a capped set of elliptical eddies and gravity tails, all clipped once through `withContentProtection`.

- [ ] **Step 4: Enrich the reduced-motion static spectrum**

Change `drawStaticSpectrum()` to compose broad fluid currents across each semantic band instead of narrow edge ribbons, while retaining local exclusion handling and full-spectrum progression.

- [ ] **Step 5: Run the trail test and verify GREEN**

Run `node scripts/check-paint-journey-trail.js`. Expected: all flow, resize, semantic reflow, and protection tests pass.

### Task 4: Reveal one continuous river from the bucket

**Files:**
- Modify: `scripts/check-paint-journey-orchestrator.js`
- Modify: `assets/paint-journey.js`

- [ ] **Step 1: Write failing controller contract tests**

Assert that landing paint calls `trail.flow()` progressively with broad responsive widths, that climb motion feeds a narrower connective flow from consecutive bucket positions, that local hue changes remain bounded, and that the exact-bottom activation check remains `<= 2` pixels.

- [ ] **Step 2: Run the controller test and verify RED**

Run `node scripts/check-paint-journey-orchestrator.js`. Expected: the current controller lacks fluid-current calls.

- [ ] **Step 3: Implement progressive horizontal and vertical currents**

Replace each segmented veil-only sweep with progressive `flow()` calls from the bucket across most of the viewport. During ladder climbs, draw a thinner connective current between sampled bucket document positions. Use one pigment family per landing and advance the family around the spectrum between levels.

- [ ] **Step 4: Run the controller test and verify GREEN**

Run `node scripts/check-paint-journey-orchestrator.js`. Expected: current integration, bottom-only activation, cancellation, and resize contracts pass.

### Task 5: Verify the authored moment end to end

**Files:**
- Modify if needed: `index.html`
- Modify if needed: `scripts/check-homepage-experience.sh`

- [ ] **Step 1: Run all automated checks**

Run `./scripts/check-homepage-experience.sh`, `./scripts/check-homepage-quotes.sh`, `./scripts/check-ai-adoption-page.sh`, `./scripts/check-article-page.sh`, and `git diff --check`. Expected: all PASS and no whitespace errors.

- [ ] **Step 2: Verify exact-bottom activation in the browser**

Reload at the top and at one pixel before the bottom; confirm no trail/WebGL canvas or loading state. Reach exact bottom and confirm the journey starts once.

- [ ] **Step 3: Verify the complete desktop and mobile sequence**

Observe the walk, pour, ladder deployments, climbs, paint coverage across all semantic bands, top disappearance, and WebGL removal at desktop and 390px. Confirm `scrollWidth === clientWidth`, no runtime errors, and acceptable frame pacing.

- [ ] **Step 4: Verify accessibility and lifecycle paths**

Verify reduced motion draws the richer static composition only at bottom, Escape cancellation cleans up, hidden-tab timing does not jump, resizing keeps the character in the right lane, and expanding details after completion reflows the painted bands.

- [ ] **Step 5: Run the final design detector once**

Run `node /Users/fabian/.agents/skills/impeccable/scripts/detect.mjs --json index.html assets/paint-journey-character.js assets/paint-journey-trail.js assets/paint-journey.js`. Expected: no blocking findings.

- [ ] **Step 6: Commit the verified refinement**

Stage only the design, implementation, and behavior-check files. Commit with `Refine the living paint character` and leave the local demo open at the top.
