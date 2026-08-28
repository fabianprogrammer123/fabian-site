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

- The ocean evolves continuously through layered directional waves.
- Scroll progress controls exposure, particle prominence, wave amplitude, and horizon height.
- Pointer movement produces a localized wake with eased position and decaying energy.
- Motion pauses with the document and renders a calm static frame for reduced-motion visitors.

## Rendering

The primary renderer is a bounded WebGL2 perspective particle grid. Vertex displacement approximates an FFT ocean with layered spectral waves while avoiding a large WebGPU dependency. A Canvas2D fallback preserves the scroll reveal and cursor wake at lower fidelity.

## Wave Geometry

The particle field uses a dominant depth-facing swell so crests read as long connected ocean ridges. Restrained harmonics make each ridge asymmetric and choppy; slow phase warping creates irregular wave groups; weaker oblique waves prevent mechanical parallel bands. Particle brightness concentrates on narrow crests while faces and foreground troughs remain subdued. The effect must not become isolated hills, uniform sine bands, or a new visual layer outside the dots.

## Accessibility and Performance

The canvas is decorative, fixed, excluded from the accessibility tree, and cannot receive pointer events. Navigation, links, focus states, and portrait interaction remain available above it. Particle density and pixel ratio reduce on narrow screens.
