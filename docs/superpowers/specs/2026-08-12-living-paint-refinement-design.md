# Living Paint Refinement Design

## Intent

Refine the existing bottom-triggered paint journey into one authored portfolio moment. The black-and-white painter should feel like a compact, charming studio character with believable weight and purposeful gestures. The paint should read as wet, saturated pigment flowing continuously through the background of the full page rather than as isolated splashes.

The visitor must reach the exact document bottom before any journey canvas, Three.js import, animation, or static reduced-motion artwork is created.

## Character direction

The character becomes a rounded “atelier sprite,” not a stick rig or cartoon child:

- A slightly larger dotted face, a tiny asymmetric smile, a low cap, broad torso, and compact pelvis create the cute silhouette.
- Shoulders move closer to the torso; upper/lower arms and thighs/shins become shorter and thicker.
- The bucket arm stays bent and carries the bucket close to the center of mass except during the pour.
- Walking uses alternating planted feet, small hip translation, low vertical bounce, restrained counter-rotation, bent elbows, and delayed head/bucket follow-through.
- Ladder deployment starts with a small anticipatory crouch. Climbing uses a four-contact rhythm with bent elbows and knees rather than straight radial limbs. Retrieval settles into the pour without snapping.
- Paint pouring has a readable preparation, committed sweep, and soft recovery. The head looks toward the bucket during the gesture.
- The figure remains in the right-edge lane, stays smaller than the page content, climbs by ladder, and fades completely above the top level.

## Pigment direction

The signature material is a continuous chromatic river made from a grounded artist-pigment spectrum: cadmium red, vermilion, ochre, sap green, viridian, cobalt, ultramarine, violet, and quinacridone. Each local pour stays within one neighboring color family; the full spectrum unfolds cumulatively as the character ascends.

Each horizontal page band receives a broad flowing current from the bucket toward the open page. A current is built from four coordinated layers:

1. a translucent underwash that establishes broad color coverage;
2. an irregular saturated body following a cubic path;
3. darker capillary edges and small gravity tails that make the paint feel wet;
4. a restrained pale glint and a few droplets/eddies that establish depth without confetti.

The narrow stream emitted while climbing connects the horizontal pools vertically, so the result reads as one continuous path from the bottom through the entire site. Drawing is progressively revealed during each real bucket gesture, not painted upfront. Content remains above the canvas with the existing white optical halo, and key interactive/footer regions remain protected.

## Motion and lifecycle

- Bottom activation remains a strict `maximumScroll - scrollY <= 2` check.
- The journey continues to guide the viewport upward unless the visitor takes control.
- Pigment is drawn only while the bucket is pouring or dripping; no unrelated ambient loop starts before activation.
- Once the character disappears, the finished pigment remains as a rich static composition. This avoids a permanent full-document animation cost while preserving the sense of flow in the authored ascent.
- Reduced-motion visitors get the same richer composition as a static spectrum, still only after reaching the bottom.
- Escape cancellation, hidden-tab timing, responsive anchor reflow, details expansion, and WebGL disposal remain intact.

## Performance budget

- Keep one full-document 2D trail canvas with its existing adaptive pixel budget.
- Keep the bounded Three.js particle pool and one instanced ladder.
- Draw each fluid-current reveal in a fixed number of segments and cap droplets/eddies per segment.
- Batch content clipping per current call and do not add filters, DOM layers, dependencies, or an indefinite animation loop.

## Acceptance criteria

- The pre-trigger page has no journey canvases and no animation state change until exact bottom.
- The figure reads visibly shorter, rounder, and more compact than the current rig.
- Walk, ladder, retrieve, pour, and vanish transitions are continuous; arms remain bent and body rotation stays controlled.
- Every page level receives a broad flowing paint band, and climb paths create visible vertical continuity.
- Paint uses rich RGB pigment colors, neighboring hues within a local flow, wet edges, highlights, and eddies.
- Desktop and mobile runs complete without horizontal overflow or console errors; the character disappears and the WebGL canvas is disposed.
- Reduced motion, Escape cancellation, resizing, and post-completion content expansion remain correct.
