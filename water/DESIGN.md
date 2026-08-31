# Particle Ocean Design System

## Scope

This system applies only to the experimental `/water/` homepage variant. The production homepage retains its incumbent appearance.

## Thesis

The homepage begins as Fabian's familiar white editorial document with a subtle, already-visible field of waves, then gradually reveals a neutral-black, luminous particle ocean beneath it. The visual is not a footer event or an illustration: it is a persistent atmospheric field whose exposure, depth, and energy are authored by scroll. `/water/` remains a stable alias of this production experience.

## Palette

- Paper: `#ffffff`
- Ink: `#222222`
- Deep field: `#000000`
- Particle white: `#f3f7f5`
- Cold glint: `#a9c5cb`
- Muted navigation: `#8b8b8b`

The surface stays neutral monochrome. A very dark cold navy is reserved for the compressed horizon and its farthest glints; it never washes across the nearby water, reading surface, or page. No rainbow gradients, neon accent colors, or decorative glass panels.

## Typography and Layout

The existing monospace typography, 660px reading measure, section rhythm, and fixed/sticky navigation remain. The page content is never rearranged to make room for the ocean. Text and portrait treatment switch together once the background becomes dark.

## Motion

- The ocean evolves continuously through broad lateral and diagonal cross-swells whose phase speeds oppose one another.
- Scroll progress controls exposure, particle prominence, wave amplitude, and horizon height.
- The first viewport retains a near-white field while exposing faint silver particles and a broken distant crest trace.
- Meaningful fine-pointer travel emits up to eight world-space wake nodes. Each node carries direction and energy, drifts with damping, and decays over 1.72 seconds.
- Wake nodes push particles laterally, separate them radially, and lift them in a phase-advancing ripple. Both WebGL2 and Canvas2D apply this displacement before projection, so the surface keeps moving after the pointer stops instead of behaving like a glow.
- Coarse pointers do not emit a wake. Motion pauses with the document and renders a calm static top ocean for reduced-motion visitors, with all pointer disturbance disabled.

## Rendering

The primary renderer is a bounded WebGL2 particle grid projected through a low, pitched virtual camera. The camera is pulled back to 3.4 world units with a 0.4-radian pitch and a wider 0.9 tangent half-FOV; the sea reaches 48 world units and uses a 1.34 depth curve to concentrate more, smaller points near the horizon. Points begin on a world-space sea, receive three-axis displacement, and are then divided by camera depth, creating strong horizon compression, a broad receding surface, restrained foreground scale, and parallax without a large WebGPU dependency. A Canvas2D fallback shares the analytical surface sampler and camera projection so it preserves the same spatial character at lower density.

Wake state uses a fixed eight-slot allocation. Screen coordinates are inverted through the pitched camera onto the ocean plane before each frame; WebGL2 and Canvas2D then consume the same precomputed world positions, directions, phase, and energy. Both combine surface and wake before applying the scroll scale exactly once. The fallback performs this node derivation once per frame rather than inside every particle pair. The debug surface reports renderer, scroll progress, pointer energy, active wake count, and aggregate wake energy for browser QA.

Pointer exits and window blur reset only the emission anchor, so existing wake motion can decay while re-entry cannot connect a synthetic trail across the viewport. BFCache navigation preserves GPU resources and restarts animation on restoration; normal page exit still releases renderer resources.

## Wave Geometry

The primary swell crosses the viewport at an oblique, mostly lateral angle. A slower opposing cross-swell intersects it to create rolling volume rather than parallel bands, while restrained harmonics make selected ridges asymmetric and choppy. Slow phase warping creates irregular wave groups without making the whole surface translate as one sheet. Gerstner-style displacement leans every crest across horizontal, vertical, and depth axes.

Particle spacing and size are perspective-aware: distant points compress into a continuous horizon while nearby points spread and reveal curvature. Brightness is derived from analytical surface slope and a restrained camera-facing crest response, leaving faces and foreground troughs subdued. The effect must not become isolated hills, uniform sine bands, a top-to-bottom conveyor, or a visual layer outside the dots.

## Accessibility and Performance

The canvas is decorative, fixed, excluded from the accessibility tree, and cannot receive pointer events. Navigation, links, focus states, and portrait interaction remain available above it. Particle density and pixel ratio reduce on narrow screens.
