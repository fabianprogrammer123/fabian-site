# Oblique 3D Particle Ocean Design

## Purpose

Refine the experimental `/water/` background so it reads as a deep, three-dimensional particle ocean rather than rows of waves moving from the top of the screen to the bottom. The result should retain the restrained monochrome dot aesthetic and scroll reveal already approved, while matching the spatial depth and lateral wave behavior of the referenced particle-ocean demonstration more closely.

## Scope

This refinement changes only the particle ocean geometry, projection, lighting, pointer response, and matching fallback renderer on `/water/`. It does not change the production homepage, page content, typography, navigation, palette, portrait treatment, or the way scrolling progressively exposes the dark background.

## Spatial Model

The particle grid will represent points on a virtual world-space sea rather than rows interpolated directly through screen space. A low, pitched perspective camera will project that sea into the viewport. Nearby points will have wider spacing, larger displacement, and stronger parallax; distant points will compress naturally toward a broad horizon.

The projected plane must fill the viewport at every supported aspect ratio without exposing empty wedges along the sides. Horizontal coverage therefore expands with depth before perspective projection, with a small overscan allowance for wave displacement and pointer interaction.

## Wave Motion

The former dominant wave direction, which is nearly aligned with screen depth, will be removed. The new surface will combine:

- A broad primary swell traveling diagonally across the scene, approximately 25–35 degrees from screen horizontal.
- A slower opposing cross-swell that breaks uniform ridges and creates rolling three-dimensional intersections.
- Shorter choppy harmonics that sharpen selected crests without turning the field into noisy static.
- Low-frequency phase warping that varies wave groups across space and prevents synchronized bands.

Wave displacement will affect all three world axes. Horizontal Gerstner-style displacement will make crests lean and fold, while vertical displacement defines their height. Different directions and phase speeds will prevent the entire surface from translating as one sheet. Apparent movement should be predominantly lateral and diagonal, never a repeated horizon-to-foreground conveyor.

## Depth and Lighting

The renderer will estimate surface slope around each particle and derive a simple view-facing normal. Particle intensity will combine:

- restrained base illumination on wave faces;
- narrow highlights on upward-facing or camera-facing crests;
- distance attenuation toward the horizon;
- subtle depth fog and lower foreground brightness so the brightest marks describe wave shape rather than filling the screen evenly.

Point size will be perspective-aware, with enough foreground presence to show curvature and enough distant density to keep the horizon continuous. The palette remains black, white, and a faint cold glint.

## Scroll and Pointer Behavior

Scroll progress will continue to control background exposure, ocean energy, particle prominence, and text contrast. It will not drive the direction of wave travel.

Pointer position will be mapped into the same virtual sea coordinates used by the shader. Its wake will deform nearby surface points in world space, so the interaction follows perspective and feels embedded in the ocean instead of painted over the screen. Pointer energy will ease in and decay smoothly when movement stops.

## Rendering and Fallback

WebGL2 remains the primary renderer. The existing bounded particle budget, adaptive pixel ratio, decorative accessibility treatment, and reduced-motion behavior remain in place. The Canvas2D fallback will mirror the oblique directional spectrum and perspective spacing closely enough to preserve the design rather than reverting to vertical bands.

If WebGL2 initialization fails, the fallback must render without page errors. Reduced-motion visitors receive a stable ocean frame with pointer animation disabled.

## Verification

Automated checks will confirm that:

- the dominant depth-aligned wave vector is gone;
- the geometry includes multiple oblique directions and three-axis displacement;
- projection uses camera depth rather than direct row interpolation alone;
- lighting responds to surface slope or normals;
- the fallback uses the same oblique wave family;
- scroll normalization and existing homepage checks continue to pass.

Live browser verification will cover the top, middle, and bottom of `/water/`, wide and narrow viewports, cursor reaction, visual continuity at the horizon, absence of top-to-bottom conveyor motion, console errors, and isolation from the production homepage.

## Success Criteria

The background should read immediately as a low camera looking across a large, rolling sea made of particles. Crests should cross the viewport at varied oblique angles, overlap in depth, and reveal curved volume as they move. The animation should feel continuous, restrained, and stormy without becoming frantic, glossy, colorful, or visually separate from the existing site.
