# Water Sprayer Finale Design

## Intent

Create a separate `/water/` version of Fabian's homepage. The existing homepage remains unchanged. In the separate version, reaching the exact bottom starts a compact cinematic finale in which the existing handmade little character visibly sprays a continuous jet of water. The jet strikes the bottom of the viewport, spreads across the full screen, and raises a glossy, responsive water surface to roughly 60% of the viewport height.

The visual reference is [Particles4All](https://github.com/matsuoka-601/Particles4All), an MIT-licensed WebGPU position-based fluid demonstration. Its useful design language is the coherent hose-like pour, impact splash, rolling waves, translucent blue body, bright surface highlights, and gradual settling. This site version will be an original bounded implementation rather than a copy of the reference's 30,000-particle unified solver.

## Selected Approach

Use a hybrid Canvas2D simulation with two coupled systems:

1. A fixed-size horizontal height field models the connected water surface. Neighboring surface columns exchange velocity, receive impulses from the jet, and converge toward a rising target level.
2. A pooled ballistic particle system models only the visible jet, impact droplets, spray, and foam.

The water body is rendered as one layered shape with a translucent depth gradient, moving caustic bands, a bright surface rim, bubbles, and small foam marks. This creates the perceptual cues of the reference without requiring WebGPU, tens of thousands of particles, screen-space reconstruction, or a separate 3D environment.

Alternative approaches were rejected:

- Importing the full WebGPU solver would be visually faithful but disproportionately heavy for a portfolio finale and would exclude browsers without WebGPU.
- A CSS wave mask would be robust and cheap but would not let the character's jet visibly drive splashes or surface motion.
- The selected height-field hybrid preserves causal pouring and fluid-looking motion while remaining bounded and widely compatible.

## Separate Version

Add `water/index.html` as a separate homepage variant. It preserves the homepage's content, navigation, voice portrait, typography, links, and layout. It does not load the existing paint-journey modules.

The root `index.html` and all article pages remain unchanged. The water version loads only a focused `assets/water-finale.js` controller and uses water-specific finale styles and markup.

## Finale Choreography

The finale starts only when the visitor reaches the exact document bottom, within a two-pixel tolerance.

1. **Arrival:** the character slides in from the right onto a small dry ledge and braces its stance.
2. **Aim:** the character raises a short hose/nozzle with both hands. The nozzle is visually distinct from the old paint bucket.
3. **Spray:** a continuous, coherent stream leaves the nozzle along a curved ballistic path. Closely spaced core droplets make it read as one pour, while a few edge droplets break away.
4. **Impact:** the jet strikes near the lower-right/center area. Each impact injects height and velocity into nearby surface columns and emits a bounded crown splash.
5. **Fill:** the mean water line rises from below the viewport to about 60% height. Waves propagate across the entire screen, reflect softly at the edges, and remain strongest near the impact.
6. **Settle:** the nozzle pressure tapers, the character lowers its arms, foam disperses, and the water continues a subtle low-cost ambient motion.

The footer floats above the water near the lower-left in a translucent white label. The character remains visible on the ledge after the fill completes.

## Scroll Lifecycle

- Exact bottom starts the sequence once per page visit.
- Scrolling upward reverses the water level quickly enough to restore readability and pauses active spraying.
- Returning to the bottom refills from the current receded state without replaying the full entrance delay.
- Escape immediately stops spraying and drains the overlay.
- Hidden tabs pause elapsed time so the simulation does not jump on return.
- Resize and orientation changes preserve normalized fill progress and rebuild the bounded surface grid.

## Rendering Architecture

### DOM layers

- `.water-finale`: the existing full-width bottom stage and character home.
- `.water-screen`: a fixed, viewport-sized, pointer-transparent canvas used only while the finale is active or draining.
- `.water-finale__character`: the SVG character and nozzle, rendered above the water surface.
- `.water-finale__footer`: footer label above the canvas.

The canvas is decorative, `aria-hidden`, and never intercepts clicks or scrolling.

### Simulation modules

`assets/water-finale.js` owns:

- exact-bottom activation and scroll lifecycle;
- character state and nozzle world position;
- height-field state in fixed typed arrays;
- pooled jet/splash/foam particles;
- rendering and adaptive quality;
- resize, visibility, reduced-motion, Escape, and teardown behavior.

The simulation uses no per-frame DOM layout reads after its measurements are cached and performs no unbounded allocations.

## Visual Treatment

The page remains quiet and monochrome until the finale. Water uses a restrained blue/cyan palette with:

- deep transparent blue toward the bottom;
- pale cyan near the surface;
- white-blue specular edges;
- broad, slow caustic bands inside the body;
- a small amount of white foam at impact and wave crests.

The character retains its dotted handmade portrait language and charcoal body. Its nozzle and short hose are monochrome so the water is the only saturated element.

## Performance Budget

- Cap device pixel ratio at 1.6 desktop and 1.25 mobile.
- Use roughly one surface column per 8–12 CSS pixels, bounded between 72 and 220 columns.
- Pool at most 520 active particles on desktop and 240 on mobile.
- Stop the continuous loop once water has drained and the finale is inactive.
- Reduce splash creation if recent frame time exceeds 24 ms.
- Avoid external runtime dependencies and network-loaded graphics.

## Accessibility and Fallbacks

- The water is decorative and hidden from assistive technology.
- `prefers-reduced-motion: reduce` replaces the animated fill with a still, gently curved water composition at the bottom after the exact-bottom trigger; it uses no character entrance or particle motion.
- Canvas failure leaves the ordinary footer and static character visible.
- The effect does not trap scroll, alter focus order, block selection, or change link behavior.
- Text becomes unobstructed as soon as the visitor scrolls away from the bottom.

## Verification

Automated checks must prove:

- `/water/` exists and the root homepage is unchanged.
- The water version does not load paint-journey modules.
- The exact-bottom threshold, upward drain, Escape, visibility pause, reduced-motion fallback, and bounded pools exist.
- The jet origin is derived from the visible nozzle and its impact injects the height field.
- The water target height is approximately 60% of the viewport.
- The canvas and animation layers are decorative and pointer-transparent.

Runtime review must verify desktop and mobile layouts, successful activation at the bottom, coherent nozzle-to-impact spraying, full-width wave propagation, legible footer/character, drainage on upward scroll, no horizontal overflow, and no console errors.
