# Choppy Particle Wave Shape Design

## Scope

Refine only the geometry and light response of the dotted ocean on the experimental `/water/` route. Preserve the current monochrome particles, scroll reveal, dark transition, cursor wake, central reading quiet zone, content styling, navigation, accessibility behavior, and particle budgets.

## Visual Goal

The particle field should read as a three-dimensional ocean rather than a collection of rounded hills. It should form large, connected wave ridges with choppy asymmetric profiles: a longer rising back, a narrow crest, a steeper falling face, and a broad trough before the next wave group. The result remains abstract and dotted, but its silhouette and motion should immediately suggest open water.

## Surface Geometry

- Establish one dominant swell direction so neighboring points participate in long connected ridges.
- Build each major swell from a fundamental wave and restrained higher harmonics. The harmonics sharpen the crest and steepen one face without turning the profile into a sawtooth.
- Modulate amplitude and spacing slowly across the field so wave groups arrive irregularly instead of repeating at a fixed interval.
- Add a weaker oblique cross-swell to break perfect parallelism while preserving a legible primary direction.
- Add small, low-amplitude chop near the crests. Keep troughs comparatively calm so the surface has scale and negative space.
- Apply restrained lateral displacement from the local wave slope. This makes crests lean and gives the point grid a more volumetric, three-dimensional silhouette.

## Particle Light Response

Keep the existing round particle sprites and cold monochrome palette. Derive brightness and point size from crest height, local slope, and curvature rather than height alone. Narrow crest edges become luminous while broad faces remain quieter. Do not add foam sprites, mist, texture layers, color effects, or new canvas elements.

## Interaction and Motion

The large swell moves with slow weight; the smaller chop travels slightly faster. Motion must remain continuous but not frantic. The cursor wake continues to deform the same surface and should inherit the sharper crest response instead of appearing as a separate effect.

## Fallback and Performance

Retain the existing desktop and mobile point budgets and one-draw-call WebGL2 architecture. Implement the same asymmetric major-wave profile in the Canvas2D fallback at lower density. Do not add simulation buffers, textures, external dependencies, or CPU-side per-particle state.

## Acceptance Criteria

- The bottom state still uses the same dotted monochrome visual language.
- Major ridges are longer, larger, and visibly asymmetric.
- The surface has flatter troughs and fewer isolated rounded mounds.
- Crest lighting reinforces depth without obscuring the central reading column.
- The cursor wake, scroll reveal, reduced-motion state, mobile layout, and Canvas2D fallback remain functional.
- The root homepage remains untouched.
