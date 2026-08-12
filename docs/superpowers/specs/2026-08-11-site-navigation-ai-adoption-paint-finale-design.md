# Site Navigation, AI Adoption Curation, and Paint Finale Design

## Goal

Refine Fabian Hildesheim's personal site without losing its spare, monochrome, monospace character. Remove the public CV, make the homepage easier to navigate, give the AI adoption article a more deliberate editorial rhythm, and end the homepage with one high-quality street-art-inspired animation.

The page should remain fast, legible, and personal. The paint finale is the single expressive visual moment; the navigation and article presentation remain quiet.

## Scope

### Included

- Remove the homepage CV link and delete the public `CV.pdf` asset.
- Add homepage section anchors and a left-side navigation menu.
- Resize and recompose the three figures on the AI adoption article.
- Add a bottom-of-homepage animation in which a small monochrome version of Fabian walks on the lower-right, tips a paint bucket, and leaves a colorful swirling field behind the footer.
- Add responsive, keyboard, reduced-motion, and performance safeguards.
- Extend the existing shell-based page contract tests.

### Excluded

- Rewriting the homepage or article copy.
- Adding navigation to article pages.
- Adding the paint animation to article pages.
- Copying any existing Banksy artwork, composition, or character.
- Adding a framework, build step, analytics, or third-party animation dependency.

## Visual Direction

The existing white paper, dark ink, and monospace typography stay intact. The left menu looks like a restrained document index. The AI adoption figures read as individually sized editorial plates rather than oversized full-width inserts.

The finale borrows the energy of stencil and street art through rough ink edges, a compact black-and-white figure, dry-brush texture, and a bold paint gesture. It does not reproduce any particular artist's work.

### Palette

- Paper: `#ffffff`
- Ink: `#222222`
- Muted ink: `#666666`
- Rule: `#cccccc`
- Cobalt: `#315ee8`
- Magenta: `#e43d78`
- Teal: `#12a88a`
- Yellow: `#f0c52e`
- Violet: `#7548cf`

Color is reserved for the spill. Before the bucket tips, the homepage remains monochrome.

## Homepage Navigation

The homepage gains stable section IDs:

- `why-this-site`
- `now`
- `background`
- `thoughts`

On viewports at least 980px wide, a fixed vertical menu sits in the left rail without reducing the existing 660px reading column. Its labels are `why this site`, `now`, `background`, and `thoughts`. A small black marker and darker label indicate the section currently nearest the upper reading line. Clicking a label uses native anchor navigation with smooth scrolling when motion is allowed.

On narrower viewports, the vertical rail becomes a compact sticky horizontal menu above the main content. It can scroll horizontally if necessary and must not cover headings when anchors are activated. Links have visible keyboard focus states. JavaScript progressively enhances the active marker with `IntersectionObserver`; the anchors remain fully usable if JavaScript is unavailable.

## CV Removal

Remove the `cv` link from the homepage social-link row and delete `CV.pdf` from the published repository. No replacement CV or resume link is added elsewhere.

## AI Adoption Article Curation

Keep the existing copy, order, typography, and three observation structure. Change only figure presentation and surrounding rhythm.

Each image gets an explicit figure variant based on its aspect ratio and information density:

- Adoption gap radar chart: maximum width 540px.
- Capability overhang bar chart: maximum width 500px.
- Humanity dot grid: maximum width 460px.

Figures align with the reading column rather than expanding to the current 860px container. Captions share the image width, sit close to their image, and use the current muted utility styling. Figure margins alternate between tighter image-to-caption spacing and generous separation from the next observation so each observation reads as a complete editorial unit.

On mobile, images use the available content width and never bleed beyond the viewport. The original image files remain uncropped so labels and source information stay legible. Images use lazy loading and intrinsic dimensions to reduce layout shift.

## Paint Finale

### Placement

The finale exists only on the homepage, after the current content and at the absolute bottom of the document. It is a dedicated stage approximately 230px high on desktop and 180px high on mobile. The current footer is placed inside this stage and remains readable above the final painted field.

The figure stays in the lower-right area. It enters from just beyond the right edge, travels roughly 120px toward the left, and never crosses into the central reading column far enough to compete with the footer.

### Figure

The figure is a small, black-and-white, stencil-like canvas/SVG construction. Its head reuses the recognizable dotted language of the existing interactive portrait, while its body is a simplified ink silhouette carrying a bucket. Imperfect edges, sparse white cutouts, and a slight dry-brush texture keep it from feeling like a generic icon.

The walk uses a short four-pose procedural cycle with coordinated leg, arm, torso, bucket, and vertical body motion. The bucket has its own handle and paint rim so the later tipping action reads clearly at the small scale.

### Timeline

The sequence starts once when at least half of the finale stage enters the viewport:

1. A short pause establishes the monochrome figure at the lower-right edge.
2. The figure walks left by about 120px for approximately 1.4 seconds.
3. It settles, braces, and tips the bucket over approximately 0.7 seconds.
4. A small paint impact appears at ground level.
5. Cobalt, magenta, teal, yellow, and violet ribbons unfurl mainly leftward, with smaller curls upward and around the footer, for approximately 2.2 seconds.
6. The motion settles into a gently drifting painted field. The final state stays visible and does not loop.

The paint should feel poured and hand-directed rather than like a generic gradient. A lightweight canvas layer draws tapered strokes, looping particles, grain, and semi-transparent overlaps. The background remains white outside the painted paths, preserving a sprayed/painted edge.

### Rendering and Performance

- Use inline SVG or canvas for the figure and a high-DPI canvas for the paint.
- Use `requestAnimationFrame` and stop continuous updates after the brief settling phase.
- Size the canvas with `devicePixelRatio`, capped at 2, for crisp output without excessive work.
- Recalculate stage dimensions on resize without restarting a completed animation.
- Do not load third-party animation libraries or large sprite/video assets.
- Keep the canvas decorative and hidden from assistive technology.

### Reduced Motion and Fallbacks

When `prefers-reduced-motion: reduce` is active, skip the walk and pour timeline. Render the figure at rest beside the tipped bucket and show the final static painted field immediately. If canvas is unavailable, show the monochrome figure and a static CSS/SVG paint shape. The footer remains readable in every state.

## Implementation Structure

The project remains framework-free and page-local:

- Homepage HTML/CSS receives the section anchors, responsive navigation, finale stage, and minimal scripts for active navigation and animation.
- AI adoption HTML/CSS receives figure variants, dimensions, and lazy-loading attributes.
- Existing shell scripts receive contract checks for CV removal, navigation anchors, article figure variants, animation stage, and reduced-motion support.
- The large existing portrait dot data remains unchanged; the finale references its visual language without duplicating the full dataset.

The navigation and finale scripts are independent closures. Failure in the optional animation must not break anchor navigation or the existing voice-agent portrait.

## Verification

Automated checks must demonstrate that:

- No homepage link points to `CV.pdf`, and the PDF file is absent.
- All four menu links and matching section IDs exist.
- The AI adoption page declares three distinct figure variants, bounded widths, lazy loading, and intrinsic image dimensions.
- The finale exists only in the homepage, includes a dedicated canvas/SVG surface, and initializes from an intersection trigger.
- Reduced-motion styling and behavior exist.
- All pre-existing homepage, article, and AI adoption page checks still pass.

Browser verification covers desktop and mobile widths, link focus states, anchor offsets, active-section changes, image legibility, no horizontal overflow, footer contrast throughout the paint reveal, one-shot triggering, resize behavior, and reduced motion.

## Acceptance Criteria

- The CV is no longer publicly linked or shipped.
- A visitor can navigate the four homepage sections from a simple left rail on desktop and compact sticky menu on mobile.
- The three AI adoption graphics feel intentionally scaled and remain legible without overflowing.
- Reaching the homepage bottom triggers one smooth, high-quality right-side walk-and-pour sequence.
- The monochrome figure reads as part of the same personal visual system as the dotted portrait.
- The paint creates an organic multicolor swirl behind the footer without compromising readability.
- The experience remains functional with JavaScript disabled and respectful of reduced-motion preferences.
