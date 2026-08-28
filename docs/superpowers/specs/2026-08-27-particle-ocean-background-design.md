# Scroll-Reactive Particle Ocean Design

## Objective

Replace the experimental route's character, spray, and rising-water finale with a full-page dynamic background inspired by the vGPU "Particles ocean" example. The background should increasingly appear as the visitor scrolls, move continuously, and respond visibly but tastefully to pointer movement.

## Chosen Direction

The approved direction is a monochrome perspective particle ocean. At the top, the page remains almost indistinguishable from the original white homepage. Scrolling progressively exposes a black field and a luminous three-dimensional particle surface. By the final sections the visitor is reading over a deep black ocean with cold-white crests.

This is an achievable interpretation rather than a direct port of the reference's inverse-FFT WebGPU pipeline. It recreates the decisive visual cues—perspective point field, spectral wave interference, bright crests, black depth, and continuous motion—with bounded WebGL2 vertex displacement.

## Experience

1. At page load the field is present but nearly transparent.
2. Scroll progress smoothly increases background darkness, particle alpha, wave amplitude, and camera drama.
3. Once the background is sufficiently dark, text, rules, navigation, and the portrait invert together for stable contrast.
4. Pointer movement creates an eased radial wake in the particle surface; leaving the viewport lets the wake decay.
5. The ocean continues moving at rest. It pauses in hidden tabs and becomes a static low-energy frame under reduced-motion preferences.

## Visual Contract

- Preserve all homepage content, links, hierarchy, and reading width.
- Remove every character, nozzle, spray, water-fill, and bottom-trigger artifact.
- Keep the palette black, white, and subtly cold gray-blue.
- Avoid generic aurora gradients, large blurry blobs, starfield motion, or horizontal sine-band decoration.
- Make the particle horizon and moving crest structure legible without overwhelming the copy.

## Architecture

- `water/index.html` owns the fixed decorative canvas, theme tokens, and route markup.
- `assets/particle-ocean.js` owns scroll normalization, pointer smoothing, lifecycle, WebGL2 rendering, and Canvas2D fallback.
- `scripts/check-particle-ocean.js` owns route isolation and renderer contracts.
- The production `index.html` remains untouched.

## Rendering Budget

- Desktop: no more than 76,800 GPU points and a maximum 1.35 device-pixel ratio.
- Mobile: no more than 32,000 GPU points and a maximum 1.0 device-pixel ratio.
- No per-frame particle allocation.
- Settled scroll still animates, but hidden documents stop scheduling frames.

## Verification

- Automated contracts cover route isolation, removed finale artifacts, bounded point counts, scroll progress, pointer input, continuous animation, reduced motion, and fallback behavior.
- Visual verification covers top, middle, and bottom scroll states plus pointer response.
- Interaction verification confirms links, navigation, portrait activation, and scrolling remain unobstructed.

