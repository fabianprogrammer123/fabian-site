# Viscoplastic Paint Design

## Intent

Replace the current analytic contour ribbons with wet paint that has memory and material behavior. The only trigger remains the exact document bottom. A small monochrome painter pours from a real bucket spout, while the deposited paint develops broad pools, marbled seams, narrow run-off, and glossy raised edges across the document. The portfolio around it remains spare, monochrome, and readable.

## Root cause

The current normal-path liquid is rebuilt from quadratic signed-distance curves every frame. Twelve cross-surface color bands, sinusoidal domain warping, and travelling glints are decorative descriptions of a ribbon. They do not store or transport mass, thickness, momentum, wetness, or pigment, so the result cannot pool, mix, decelerate, or drip like paint.

The replacement must satisfy one architectural rule: the final silhouette comes from transported paint state. Authored curves may inject paint and momentum, but the display shader must never draw those curves directly.

## Selected direction

Use a low-resolution, full-document, GPU viscoplastic solver inside the existing Three.js layer.

- A velocity field stores two-dimensional momentum and local mobility.
- A pigment field stores mass-weighted absorption plus paint thickness.
- Pressure projection keeps the flow coherent rather than smoke-like.
- Yield stress pins thin paint to the page, while fresh or thick paint shear-thins and moves.
- Downward gravity and substrate variation form delayed narrow drips.
- Neighboring artist pigments mix subtractively through transported absorption, not RGB hue interpolation.
- The viewport composite derives normals, meniscus, roughness, and specular response from simulated thickness.

The existing Canvas trail remains the reduced-motion, import-failure, and WebGL-context-loss fallback. The character, ladder, exact-bottom loader, cancellation, hidden-tab timing, and page lifecycle stay structurally unchanged.

## Simulation state

Use full-document render targets with document aspect ratio and bounded pixel counts.

- Velocity ping-pong: RG velocity in UV units per second, B wet mobility, A reserved.
- Pressure ping-pong: pressure in R.
- Divergence: divergence in R.
- Pigment ping-pong: RGB mass-weighted Kubelka-Munk absorption and A thickness.

Desktop budgets:

- simulation scale 0.18, 300,000 pixels maximum;
- pigment scale 0.30, 720,000 pixels maximum;
- 30 Hz fixed simulation, no more than two catch-up steps;
- eight pressure iterations.

Mobile budgets:

- simulation scale 0.14, 160,000 pixels maximum;
- pigment scale 0.22, 320,000 pixels maximum;
- 20 Hz fixed simulation, one step maximum;
- four pressure iterations.

All targets use half-float when renderable, with RGBA8 as a progressive fallback. They have no depth, stencil, mipmaps, or multisampling. Target dimensions also respect the renderer's maximum texture size.

## Pass graph

For each fixed step:

1. Inject any newly revealed gesture intervals and the live bucket source into velocity and pigment ping-pong targets.
2. Semi-Lagrangian-advect velocity.
3. Apply viscous drag, shear-dependent mobility, downward gravity, thickness-gradient surface relaxation, and deterministic substrate resistance.
4. Calculate divergence.
5. Solve pressure with bounded Jacobi iterations.
6. Subtract the pressure gradient.
7. Semi-Lagrangian-advect pigment mass and thickness with restrained seam sharpening.

The solver has no global boiling or strong vorticity. Curved source momentum and collisions generate the folds. Paint mobility decays after injection, so pools spread quickly, slow down, then retain only occasional gravity runoff.

## Causal injection

The gesture model exposes a revisioned full simulation packet. The field remembers the last injected reveal for every stable gesture ID. When reveal advances from 0.31 to 0.36, only that interval is sampled and deposited. Repeated values inject nothing.

The live emitter is a local spout source only. Its direction may use the gesture front as an aim vector, but no line from the spout to the front is ever rendered. Bucket motion contributes source velocity. Each pour deposits a dominant artist pigment, an adjacent pigment, thickness variation, and a small bounded number of satellite beads.

## Pigment behavior

The palette is grounded in artist pigments: cadmium coral, diarylide gold, warm yellow, viridian, phthalo cyan, ultramarine, dioxazine violet, and quinacridone magenta. A gesture uses one dominant pigment and one adjacent pigment. Across the six landings the spectrum unfolds, but no individual pool becomes a rainbow stripe.

The pigment texture stores mass-weighted absorption. The material shader divides by thickness and uses a compact Kubelka-Munk conversion:

```glsl
vec3 ratio = absorptionMass / max(thickness, 0.001);
vec3 reflectance = 1.0 + ratio - sqrt(max(ratio * ratio + 2.0 * ratio, 0.0));
```

Mixing therefore behaves subtractively: yellow and blue move toward green, red and yellow toward orange, and blue and magenta toward violet. Interfaces stay marbled because diffusion is deliberately low.

## Wet surface

The composite samples the document-space pigment atlas using the viewport scroll offset. It derives a surface normal from neighboring thickness samples. Fresh deep paint uses a narrow dielectric highlight and low roughness; thin or settled paint is rougher. A light-facing 1 to 4 pixel meniscus and an interior capillary shadow define raised wet edges. Thick regions deepen and saturate; thin regions reveal paper. Static, subtle canvas tooth perturbs the normal without time-driven shimmer.

There are no procedural travelling glints. When the height field stops moving, its highlights stop moving.

## Reflow and lifecycle

Scroll changes only the document sampling offset. It never clears or resizes simulation state.

Responsive geometry or document-height changes increment a layout revision. The field reallocates only when bounded target dimensions change, clears its state, deposits all revealed gestures at their new semantic locations, and runs a few relaxation steps. Stable IDs, pigment phases, reveal values, and the exact-bottom activation contract remain unchanged.

After the painter disappears, actor resources are disposed while the liquid continues at the existing 24 fps desktop or 15 fps mobile ambient budget. Once mobility has decayed for roughly 12 seconds without injection, solver passes stop; scrolling still composites the stationary atlas. Hidden documents run no passes. Context loss and pagehide retain their current safe fallback and disposal behavior.

## Acceptance criteria

- Nothing related to the journey is created before maximum-scroll minus scroll-Y is at most two pixels.
- First visible paint begins at the projected bucket spout and no broad pool appears without injected mass.
- The normal path contains no contour-band, spectrum-stripe, SDF-curve, or travelling-glint renderer.
- Broad pools, narrow connectors, marbled seams, and gravity drips occur at distinct scales.
- Adjacent pigments retain recognizable filaments and mix subtractively instead of becoming additive white.
- The pool front visibly decelerates; motion is calm and viscous rather than smoky or boiling.
- Paint stays anchored to document content while scrolling and reseeds semantically after responsive reflow.
- The central reading lane remains legible and the page never gains horizontal overflow.
- Desktop and mobile runs complete without runtime errors, dispose the painter at the top, retain the paint, and respect the frame and texture budgets.

