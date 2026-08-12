# WebGL Paint Climber Design

## Goal

Replace the homepage's short bottom-stage animation with a distinctive, reliable 3D journey. A small monochrome version of Fabian walks through the page, pours and splashes a continuously changing color spectrum directly from a bucket, throws a rope to higher sections, climbs upward, and eventually rejoins the dotted portrait at the top.

The effect should feel crafted, playful, and slightly illicit: a tiny street artist treating the white page as architecture. It must never make the writing difficult to read or trap the visitor in an automated experience.

## Chosen Approach

Use a hybrid true-WebGL system:

- A fixed transparent WebGL overlay renders the articulated 3D character, bucket, rope, lighting, and active paint particles.
- A document-sized 2D paint canvas preserves settled paint marks as the character travels, avoiding the cost of retaining thousands of 3D particles.
- Section headings and page edges provide responsive waypoints for the journey.
- The existing bottom-finale canvas becomes the non-WebGL and reduced-motion fallback.

This approach delivers genuine depth and animation while remaining controllable, testable, and performant. It is more reliable than a prerecorded animation, more dimensional than SVG, and lighter than keeping the entire painted history in WebGL.

## Experience Sequence

The journey begins only when the visitor reaches the bottom of the homepage. It runs once per page load.

### Act 1: The spill begins

1. The 3D figure enters from the lower-right carrying a bucket.
2. It walks left across the bottom stage with visible weight shifts, foot planting, arm swing, and bucket inertia.
3. It tips the bucket; paint emerges from the bucket lip as a thick, luminous stream.
4. The stream hits the page floor, spreads into full-spectrum ribbons, and throws droplets outward.

### Act 2: Climbing the page

The figure travels upward through these levels:

1. Bottom stage to `thoughts`
2. `thoughts` to `background`
3. `background` to `now`
4. `now` to `why this site`
5. `why this site` to the portrait

For each climb:

1. The figure walks within the clear margin toward a launch position.
2. It places the bucket down, looks upward, and coils the rope.
3. It throws the rope toward an anchor beside the next section heading.
4. The rope arcs, catches, and briefly tightens under tension.
5. The figure lifts the bucket onto a shoulder hook and climbs hand-over-hand.
6. Its feet brace against an implied page wall; the body rotates slightly in depth and the rope reacts to each pull.
7. On reaching the next level, it pulls the bucket up, resumes walking, and releases another burst of paint.

The character alternates sides as it ascends so the path feels like a journey rather than a straight progress bar. On desktop it uses the generous left and right margins around the 660px reading column. On mobile it stays in narrow edge lanes and becomes smaller, keeping the text column untouched.

### Act 3: Return to the portrait

Near the top, the character throws a final short rope beside the portrait, climbs into position, and pauses. Its dotted face visually echoes the homepage portrait. It then gives the bucket a final controlled swing that releases a small halo of spectrum droplets behind the portrait, not over the social links or speech bubble.

The character remains at rest beside the portrait while the painted path stays visible.

## Camera and Visitor Control

The WebGL layer stays fixed to the viewport. World coordinates are derived from live document positions, allowing the character to appear attached to headings and margins while the page scrolls.

Once the bottom act finishes, the page scrolls upward gently to follow the character. The scroll is cinematic but restrained: each climb advances only far enough to keep the character and destination heading visible.

Visitor control always wins:

- Wheel, touch, pointer, or keyboard scrolling immediately cancels guided scrolling.
- Cancellation does not remove paint or reset the figure.
- After cancellation, the character completes its current physical action, then continues its journey only when its next waypoint is visible.
- Pressing Escape stops all remaining active animation and settles the character at the nearest safe edge position.
- Anchor navigation and the existing voice portrait remain fully functional.

## 3D Character

### Construction

The character is procedural geometry rather than a downloaded human model. This keeps it visually coherent, lightweight, and easy to articulate:

- Rounded box/capsule torso and limbs with subtly irregular proportions.
- Separate pelvis, spine, shoulders, elbows, wrists, knees, ankles, and neck pivots.
- Small faceted head with a dotted front-face texture derived from the portrait's visual language.
- Matte charcoal clothing, off-white skin/face details, black shoes, and no color until paint appears.
- A cylindrical metal bucket with handle, dark interior, colored paint surface, and a precise lip emitter.
- A shoulder hook used to carry the bucket during rope climbs.

The character should feel like a miniature handmade maquette, not a polished game avatar. Beveled forms, directional lighting, soft contact shadow, slight roughness variation, and small posture asymmetries create depth without adding visual noise.

### Animation

Use a lightweight procedural rig and state machine rather than imported motion capture:

- `enter`
- `walk`
- `set-bucket`
- `coil-rope`
- `throw-rope`
- `brace`
- `climb`
- `pull-bucket`
- `paint-swing`
- `rest`
- `cancelled`

Walk motion uses planted-foot phases, pelvis translation, torso counter-rotation, head stabilization, opposing arm motion, and delayed bucket sway. Climbing uses alternating hand targets, bent-knee wall contact, upward center-of-mass shifts, rope tension, and brief settling at each pull. Transitions use eased blending rather than snapping between poses.

## Rope System

The rope is a segmented curve rendered as a shaded tube or thick line with visible depth. During a throw, its endpoint follows a ballistic arc from the character's hand to a responsive section anchor. After it catches, a short spring simulation controls sag and tension.

The anchor is always placed in a content-safe margin near the next heading. If the available margin is too narrow, the anchor moves to the viewport edge and the character scales down rather than crossing the text.

The rope is decorative and hidden from assistive technology.

## Paint System

### Source and color

Every active stream starts at the bucket lip computed from the bucket's current world transform. The paint must visibly remain connected to the bucket while pouring or swinging.

Hue advances continuously through the full HSL spectrum. Saturation remains high and luminance varies enough to create overlapping depth. The palette is not a fixed five-color loop; visitors see intermediate oranges, greens, cyans, blues, violets, pinks, and reds.

### Active paint

WebGL renders short-lived active paint:

- A viscous stream made from connected metaball-like particles or a tapered ribbon.
- Larger impact blobs at collision points.
- Small ballistic droplets affected by gravity.
- Fine mist around strong bucket swings.
- Additive highlights and multiply-style darker overlap simulated through transparent materials.

Paint emission rate follows bucket angular velocity and pour angle. Walking produces occasional drips; tipping produces a stream; swinging produces an arc of droplets.

### Settled paint

When active particles reach the page plane, they are stamped into a transparent document-sized 2D canvas positioned behind readable content. Stamps include:

- Soft-edged blobs
- Bristle streaks
- Tapered ribbons
- Small spray dots
- Dry gaps and grain

The path is concentrated in margins and section gutters. Broad ribbons may pass behind section bands, but an exclusion map prevents marks from reducing contrast underneath headings, paragraphs, links, the voice bubble, and navigation.

The final page should contain a connected full-spectrum trail rather than isolated rainbow confetti.

## Layout Integration

The current 660px reading column and left section navigation remain unchanged.

Add three independent visual layers:

1. `.journey-paint-layer`: an absolute, document-sized canvas beneath content but above the white body background.
2. `.journey-webgl-layer`: a fixed viewport canvas above the paint layer for the live 3D character, rope, and airborne paint.
3. `.journey-vignette`: optional subtle edge shading/contact shadow under the character only.

Content receives a higher stacking context and stays selectable and clickable. Both animation canvases use `pointer-events: none`.

The old static finale stage remains at the bottom as the starting floor and fallback, but its current SVG walker is hidden when the WebGL journey initializes successfully.

## Responsive Waypoints

Waypoints are recomputed from live heading and portrait rectangles on load, resize, orientation change, and font/layout shifts.

Desktop behavior:

- Character height: approximately 120–150 CSS pixels.
- Travel lanes: outside the reading column, alternating left/right.
- Rope anchors: 24–64px outside heading rules.

Mobile behavior:

- Character height: approximately 72–92 CSS pixels.
- Travel lanes: 6–18px inside viewport edges.
- Paint trail width and particle count reduced.
- Guided scroll speed shortened to keep the sequence from feeling slow on a tall narrow layout.
- The character may overlap blank whitespace, rules, and margins, but not readable text.

## Technical Architecture

### Modules

- `assets/paint-journey.js`: orchestration, lifecycle, waypoint computation, guided scroll, cancellation, and fallbacks.
- `assets/paint-journey-character.js`: procedural scene graph, materials, rig, animation states, bucket emitter, and character poses.
- `assets/paint-journey-rope.js`: rope arc, catch, sag/tension simulation, and rendering data.
- `assets/paint-journey-particles.js`: active stream/droplet pool, collision, hue progression, and settled-paint stamp events.
- `assets/paint-journey-trail.js`: document canvas sizing, content exclusion zones, ribbon/blob/spray stamping, and resize restoration.
- `assets/paint-finale.js`: retained fallback renderer for WebGL failure and reduced-motion mode.

### WebGL runtime

Use Three.js as an ES module from a pinned CDN URL. The page attempts to load it only after the bottom-stage observer is close to triggering, preventing the 3D runtime from delaying initial reading. If the import fails, the current canvas finale runs automatically.

No external 3D model, texture pack, animation library, or physics engine is required. Geometry, portrait-dot texture, paint textures, and motion are generated locally.

### State flow

`idle → loading → entering → bottom-paint → waypoint travel/climb loop → portrait-rest`

Fallback transitions:

- WebGL unavailable or import failure: `loading → canvas-fallback`
- Reduced motion: `idle → static-painted-path`
- Escape: active state → `cancelled-rest`
- Manual scroll during guided movement: disable camera guidance; physical animation continues when visible.

## Performance Budget

- Lazy-load the WebGL runtime near the bottom only.
- Cap device pixel ratio at 1.75 on desktop and 1.35 on mobile.
- Use pooled particles with no per-frame object allocation.
- Target no more than 600 active particles on desktop and 260 on mobile.
- Stamp settled paint into 2D and retire corresponding 3D particles.
- Pause rendering when the character is offscreen and no guided scroll is active.
- Reuse geometries and materials; keep draw calls below roughly 35.
- Respect battery-saving constraints by reducing particles when frame time exceeds budget.
- Stop the animation loop in the final resting state, leaving only static canvases.

## Accessibility and Safety

- Both animation layers are `aria-hidden="true"` and noninteractive.
- `prefers-reduced-motion: reduce` disables WebGL, automatic scrolling, climbing, and particles. It shows the current monochrome figure and a static spectrum trail in the margins.
- Guided scrolling never begins until the visitor explicitly reaches the bottom.
- Any visitor scroll input cancels automation immediately.
- Escape provides a complete stop.
- Text contrast, selection, focus rings, anchor navigation, and voice-agent controls remain unaffected.
- If WebGL context is lost, remove the live layer and render the final fallback paint state without reloading the page.

## Testing and Verification

### Automated contracts

Tests must verify:

- WebGL and trail layers exist only on the homepage.
- The WebGL runtime is lazy-loaded and pinned.
- Waypoints include every homepage section and the portrait.
- The animation state machine contains walking, throwing, climbing, painting, resting, and cancellation states.
- Paint emission reads the bucket lip world position.
- Hue is continuous across 0–360 degrees rather than a fixed palette.
- The rope uses responsive anchors and tension/sag state.
- Manual wheel/touch/pointer/keyboard input cancels guided scrolling.
- Escape stops the journey.
- Reduced motion and WebGL failure use the fallback.
- Existing CV removal, homepage navigation, quotes, and article contracts continue to pass.

### Browser verification

Verify at 1440×1000, 1024×768, and 390×844:

- The 3D character has visible depth, lighting, foot planting, jointed limbs, and bucket inertia.
- Paint visibly exits the bucket lip through the entire emission phase.
- The initial stream includes the full spectrum over time.
- Each rope throw visibly connects hand to anchor before climbing begins.
- The character reaches all five levels without covering readable text.
- Guided scrolling follows smoothly and stops immediately on visitor input.
- The final portrait-rest state is composed cleanly.
- No horizontal overflow, console errors, layout shift, or broken links occur.
- Performance remains smooth enough to preserve the intended motion; particle counts degrade gracefully on slower devices.

## Acceptance Criteria

- Reaching the bottom initiates a genuine 3D character journey rather than a flat replacement animation.
- The figure walks, throws, braces, climbs, carries/pulls the bucket, and rests with convincing articulated motion.
- Paint comes directly from the animated bucket lip and traverses the complete color spectrum.
- The paint trail accumulates across the homepage while avoiding the writing.
- The rope enables visible ascent from section to section until the character reaches the portrait.
- The page can guide the camera upward, but the visitor can interrupt or stop it instantly.
- Desktop and mobile layouts remain readable, usable, performant, and free of overflow.
- Reduced-motion and WebGL failure cases retain an intentional static/canvas experience.
