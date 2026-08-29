# Particle Ocean Design System

## Scope

This system applies only to the experimental `/water/` homepage variant. The production homepage retains its incumbent appearance.

## Thesis

The page begins as Fabian's familiar white editorial document and gradually reveals a black, luminous particle ocean beneath it. The visual is not a footer event or an illustration: it is a persistent atmospheric field whose exposure, depth, and energy are authored by scroll.

## Palette

- Paper: `#ffffff`
- Ink: `#222222`
- Deep field: `#020304`
- Particle white: `#f3f7f5`
- Cold glint: `#a9c5cb`
- Muted navigation: `#8b8b8b`

Color stays monochrome with a restrained cold cast. No rainbow gradients, neon accent colors, or decorative glass panels.

## Typography and Layout

The existing monospace typography, 660px reading measure, section rhythm, and fixed/sticky navigation remain. The page content is never rearranged to make room for the ocean. Text and portrait treatment switch together once the background becomes dark.

## Motion

- The ocean evolves continuously through broad lateral and diagonal cross-swells whose phase speeds oppose one another.
- Scroll progress controls exposure, particle prominence, wave amplitude, and horizon height.
- Pointer movement produces a localized world-space wake with eased position and decaying energy.
- Motion pauses with the document and renders a calm static frame for reduced-motion visitors.

## Rendering

The primary renderer is a bounded WebGL2 particle grid projected through a low, pitched virtual camera. Points begin on a world-space sea, receive three-axis displacement, and are then divided by camera depth, creating natural horizon compression, foreground scale, and parallax without a large WebGPU dependency. A Canvas2D fallback shares the analytical surface sampler and camera projection so it preserves the same spatial character at lower density.

## Wave Geometry

The primary swell crosses the viewport at an oblique, mostly lateral angle. A slower opposing cross-swell intersects it to create rolling volume rather than parallel bands, while restrained harmonics make selected ridges asymmetric and choppy. Slow phase warping creates irregular wave groups without making the whole surface translate as one sheet. Gerstner-style displacement leans every crest across horizontal, vertical, and depth axes.

Particle spacing and size are perspective-aware: distant points compress into a continuous horizon while nearby points spread and reveal curvature. Brightness is derived from analytical surface slope and a restrained camera-facing crest response, leaving faces and foreground troughs subdued. The effect must not become isolated hills, uniform sine bands, a top-to-bottom conveyor, or a visual layer outside the dots.

## Accessibility and Performance

The canvas is decorative, fixed, excluded from the accessibility tree, and cannot receive pointer events. Navigation, links, focus states, and portrait interaction remain available above it. Particle density and pixel ratio reduce on narrow screens.
