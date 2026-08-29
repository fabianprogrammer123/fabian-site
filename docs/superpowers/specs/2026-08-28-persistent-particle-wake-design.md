# Persistent Particle Wake Design

## Goal

Make the particle ocean perceptible from the first viewport and make cursor movement physically rearrange the surface with motion that continues after the cursor stops.

## Visual contract

- Preserve the existing oblique 3D monochrome ocean, camera, typography, content, scroll narrative, and fixed decorative canvas.
- At scroll position zero, show a restrained silver trace of the distant horizon and a few crest fragments. The page must still read as white paper first. Particle presence should be discoverable without competing with the heading or body copy.
- Scrolling continues to increase darkness, amplitude, particle density, and contrast until the ocean dominates the final viewport.
- Cursor motion displaces particle positions, not only their brightness or size. Nearby particles receive lateral push, a small vertical lift, and a propagating ring response.
- Recent cursor positions remain as a short wake. Wake nodes carry direction and energy, drift briefly through the surface, and decay smoothly for roughly 1.4 to 2.0 seconds. Stopping the cursor must leave visible continuation rather than freezing the disturbance in place.
- The interaction stays local and fluid. It must not look like a spotlight, rigid dent, or chain of circular stamps.

## Interaction model

Maintain a bounded wake field of recent pointer impulses. Each impulse stores normalized position, screen-space velocity, age, and energy. A new impulse is emitted only after meaningful pointer travel so the field remains sparse. Every frame advances age, applies damped drift, and removes expired impulses.

The WebGL vertex shader maps each active impulse into ocean world space and combines directional drag, radial displacement, and a phase-advancing vertical ripple. The Canvas2D fallback uses the same wake state and analytical displacement. A small direct cursor impulse keeps immediate response while the older nodes create continuity.

## Accessibility and performance

- Keep the canvas non-interactive and excluded from the accessibility tree.
- Cap the wake field at eight impulses and reuse fixed arrays to avoid frame allocations.
- Disable pointer disturbances for coarse pointers and reduced-motion visitors.
- Reduced motion receives one static frame with the faint top-of-page ocean intact.
- Preserve bounded mobile particle counts and the Canvas2D fallback.

## Verification

- Pure model tests cover wake emission thresholds, bounded history, decay, drift, and expiry.
- Route tests require the new script version and top-of-page exposure contract.
- Browser checks confirm WebGL2, nonzero subtle exposure at the top, positional movement after pointer motion, continuing wake energy after the pointer stops, dark transition at the bottom, and no console errors.
