# Contour Liquid Paint Design

## Intent

Replace the current segmented translucent paint strokes with one continuous, dimensional liquid environment inspired by the movement language of Adobe Stock asset 690654132, “Abstract striped line wave liquid background animation.” The reference is used only as visual direction: nested organic contour bands, slow morphological flow, deep tonal separation, and smooth connections. The implementation must be original and generated in real time.

The liquid remains the extraordinary moment. The surrounding portfolio stays quiet, monochrome, readable, and structurally unchanged. A small black-and-white painter introduces the color from a physical bucket, climbs the existing right-side ladder, paints each semantic page level, then disappears at the top.

## Root cause of the current result

The existing controller divides each horizontal pour into 18 short segments. Each segment independently draws five wide, round-capped Canvas2D strokes with transparency and compositing. Adjacent segments therefore reveal their individual end caps and repeatedly darken their overlaps. The result is a row of translucent capsules with concentric “caterpillar” rings rather than one liquid body. Particle sprays, veils, whorls, and impacts add unrelated marks on top, so the material has no single surface model.

This cannot be corrected by changing opacity, stroke width, or adding more droplets. The broad paint needs one continuous field whose shape and shading are evaluated as a whole.

## Selected direction

Use a bounded Three.js shader surface based on signed-distance capsules and smooth metaball unions. This is the middle of three possible approaches:

- More Canvas2D strokes are inexpensive but retain the visible overlap and flatness problem.
- A full Navier–Stokes fluid simulation would be physically expressive but introduces unstable art direction, ping-pong buffers, higher mobile cost, and difficult persistence.
- A signed-distance/metaball shader produces the reference’s smooth merging contours, supports precise bucket-driven choreography, and stays bounded enough for a portfolio page.

The shader is the selected approach.

## Liquid surface architecture

Create `assets/paint-journey-liquid-model.js` and `assets/paint-journey-liquid.js` with focused APIs. The pure model owns document-space gesture data, while the Three.js adapter renders it:

```js
PaintJourney.createLiquidModel({ maxGestures: 12 })
model.upsertGesture({ id, from, control, to, width, palettePhase, seed, reveal, spread, kind })
model.setReveal(id, progress)
model.reflow(id, geometry)
model.getVisiblePacket(viewport)

PaintJourney.createLiquidField({ THREE, renderer, scene, model, mobile })
field.setViewport({ width, height, scrollX, scrollY, documentWidth, documentHeight })
field.setEmitter({ active, origin, front, pressure, palettePhase })
field.update(delta, time)
field.setAmbient(value)
field.freeze()
field.dispose()
```

The model stores at most 12 quadratic document-space gestures. Six broad horizontal pours and five narrow climb connectors fit inside this budget. The field owns a private fullscreen liquid scene rendered into a low-resolution linear-filtered `WebGLRenderTarget`, then composites that texture onto one transparent quad behind the crisp actor scene. Smooth-min unioning merges every quadratic gesture into one body, so boundaries never expose repeated round caps.

The fragment shader uses:

1. low-frequency domain warping to keep borders organic;
2. a smooth signed-distance field for connected mass and surface tension;
3. six nested contour strata derived from distance to the liquid edge;
4. neighboring pigment tones around each stroke’s base hue;
5. a dark capillary edge, soft self-shadow, pearlescent inner highlight, and restrained specular glint;
6. slow pre-settle drift that stops after the painter disappears.

The private target renders at a bounded internal resolution: about 0.72 CSS pixels on desktop and 0.55 on mobile, capped at roughly 900,000 pixels. The browser upscales it smoothly while the shared renderer can keep the character crisp. The loop uses constant uniform limits and no unbounded allocations.

## Paint choreography

The bucket remains the only visual source.

- A landing creates one broad stroke, not 18 permanent sub-strokes. Its `reveal` value grows from the bucket toward the opposite side during the pour.
- The growing endpoint eases and slightly overshoots, while the shader’s smooth union makes the paint bloom laterally behind it.
- Ladder climbs update one narrow connector from the last landing to the current bucket spout. This joins page bands vertically without producing a dotted path.
- Each page level uses a restrained local pigment family. Across all levels the families cover the full spectrum, but no individual pool becomes rainbow confetti.
- Existing Canvas2D impact, veil, ribbon, whorl, and broad `flow()` calls are removed from the live choreography. The bounded particle system remains only for a small number of dimensional droplets at the bucket lip and at pour commitment.

## Character direction

The painter should be visibly simple beside the sophisticated liquid:

- increase the rendered scale slightly while keeping the right-edge lane;
- enlarge the head and hands modestly, shorten the torso, and keep limbs rounded;
- replace the stiff paint swing with anticipation, two-handed bucket commitment, a small weight shift, and damped recovery;
- make the face look toward the advancing liquid front during the pour;
- keep walking planted and the ladder climb one-handed with the bucket tucked;
- keep black, charcoal, and warm white materials so the character never competes with the liquid palette.

The paint origin continues to use `character.paintSpout.getWorldPosition(...)`.

## Lifecycle and persistence

- No liquid geometry, material, shader, trail field, Three.js import, or fallback artwork is initialized before `maximumScroll - scrollY <= 2`.
- During the journey the existing renderer draws liquid, ladder, particles, and character in one scene.
- After the top disappearance, actor, ladder, and particle resources are disposed. The liquid continues a deliberately slow ambient morph at 24fps desktop and 15fps mobile, pauses while hidden, and redraws immediately on scroll, resize, orientation, or semantic content reflow.
- Escape before or during initialization removes all live resources and requests the static fallback.
- Hidden tabs pause time. Returning must not advance the liquid phase or animation state.
- WebGL context loss falls back to a static Canvas2D contour composition.

## Static and reduced-motion fallback

The persistent trail module gains a static `contourField()` primitive that draws each full path as nested, continuous bezier strokes from widest to narrowest. The strokes use opaque neighboring pigment tones, an outer shadow, inner highlight, and no segmented caps. Reduced-motion visitors receive this completed original composition only after the exact-bottom trigger; they never load Three.js.

The static fallback is deliberately still. It preserves the visual hierarchy and liquid contour language without simulating motion.

## Readability and accessibility

- Liquid remains behind `.journey-content` and the fixed navigation.
- Key voice/footer exclusion zones remain protected in the static layer.
- Text retains its white optical halo; liquid alpha and darkest tones are clamped so body copy remains legible.
- Reduced motion receives no morphing, particle animation, auto-guided scrolling, or animated fallback.
- The effect is decorative and remains `aria-hidden`.

## Verification

Automated checks must prove:

- the new module has a fixed stroke budget, connected smooth-union shader, contour strata, tonal lighting, resize handling, settle mode, and idempotent disposal;
- controller landings create one progressively revealed liquid stroke and climbs update one connector from the bucket spout;
- no live broad-paint call uses the old segmented `trail.flow()`, `trail.veil()`, or whorl/spray composition;
- pre-trigger, three pixels above bottom, reduced-motion, exact-bottom, Escape, loading race, context loss, hidden tab, resize, details expansion, and final actor disposal all remain correct;
- the liquid plane survives actor cleanup and redraws on scroll without an indefinite animation loop;
- mobile and desktop have no horizontal overflow or runtime errors.

Browser review must capture the exact bottom, a mid-pour, a mid-climb connection, the completed top state, and a 390px run. The paint must read as one smooth marbled liquid surface with no repeated capsules, translucent overlap rings, or unrelated confetti.
