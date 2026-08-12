# Site Navigation, AI Adoption Curation, and Paint Finale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the public CV, add responsive homepage navigation, curate the AI adoption figures, and build a one-shot bottom-right walk-and-paint finale on the homepage.

**Architecture:** Preserve the framework-free HTML site. Keep structural styles and markup in the two affected HTML pages, isolate homepage navigation and finale behavior in two small vanilla JavaScript files under `assets/`, and enforce the agreed page contracts with shell scripts before browser-level visual verification.

**Tech Stack:** HTML5, CSS, inline SVG, Canvas 2D, vanilla JavaScript, POSIX shell, `rg`, local HTTP server, browser screenshots.

---

## File Map

- Modify `index.html`: remove the CV link, add section anchors/menu, add finale layout/styles/markup, and load the two focused scripts.
- Delete `CV.pdf`: remove the publicly shipped CV.
- Create `assets/homepage-navigation.js`: progressively enhance the section menu with active-section tracking.
- Create `assets/paint-finale.js`: render and animate the walker and canvas paint field.
- Modify `ai-adoption/index.html`: add size-specific figure variants, intrinsic dimensions, and lazy loading.
- Create `scripts/check-homepage-experience.sh`: test CV removal, navigation, finale markup, animation hooks, and reduced-motion behavior.
- Modify `scripts/check-ai-adoption-page.sh`: test the curated figure variants and image loading metadata.

### Task 1: Homepage CV Removal and Section Navigation

**Files:**
- Create: `scripts/check-homepage-experience.sh`
- Create: `assets/homepage-navigation.js`
- Modify: `index.html:9-26, 93-178, 304-305`
- Delete: `CV.pdf`

- [ ] **Step 1: Write the failing homepage experience contract**

Create `scripts/check-homepage-experience.sh` with executable mode and this contract:

```sh
#!/bin/sh

set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
home="$root/index.html"
nav="$root/assets/homepage-navigation.js"
finale="$root/assets/paint-finale.js"

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

require_text() {
  file=$1
  text=$2
  rg -Fq "$text" "$file" || fail "missing '$text' in ${file#$root/}"
}

forbid_text() {
  file=$1
  text=$2
  if rg -Fiq "$text" "$file"; then
    fail "found removed text '$text' in ${file#$root/}"
  fi
}

test -f "$home" || fail "missing index.html"
test ! -e "$root/CV.pdf" || fail "CV.pdf is still publicly shipped"
forbid_text "$home" 'CV.pdf'
forbid_text "$home" '>cv<'

for section in why-this-site now background thoughts; do
  require_text "$home" "href=\"#$section\""
  require_text "$home" "id=\"$section\""
done

require_text "$home" 'class="section-nav"'
require_text "$home" 'aria-label="On this page"'
require_text "$home" 'assets/homepage-navigation.js'
require_text "$nav" 'IntersectionObserver'
require_text "$nav" 'aria-current'
require_text "$nav" "prefers-reduced-motion: reduce"

printf 'PASS: homepage CV and navigation contract\n'
```

- [ ] **Step 2: Run the contract and confirm it fails for the missing feature**

Run:

```sh
chmod +x scripts/check-homepage-experience.sh
./scripts/check-homepage-experience.sh
```

Expected: `FAIL: CV.pdf is still publicly shipped`.

- [ ] **Step 3: Remove the CV and add navigation markup/styles**

Delete only the resolved repository file `CV.pdf`. In `index.html`, remove the trailing CV separator/link so the social row ends with GitHub. Add this navigation immediately after `<body>`:

```html
<nav class="section-nav" aria-label="On this page">
  <a href="#why-this-site" data-section="why-this-site" aria-current="true">why this site</a>
  <a href="#now" data-section="now">now</a>
  <a href="#background" data-section="background">background</a>
  <a href="#thoughts" data-section="thoughts">thoughts</a>
</nav>
```

Give the four existing `<h2>` elements matching IDs and `scroll-margin-top: 72px`. Add CSS that keeps the existing 660px body column, fixes `.section-nav` in a left rail on screens at least 980px wide, marks the active link through `aria-current="true"`, shows visible focus, and changes the menu to a horizontally scrollable sticky strip at `max-width: 979px`.

The desktop rules must use this geometry:

```css
.section-nav {
  position: fixed;
  top: 48px;
  left: max(24px, calc(50vw - 520px));
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 0.76em;
  line-height: 1.35;
  z-index: 20;
}

.section-nav a { color: #888; text-decoration: none; }
.section-nav a::before { content: "·"; display: inline-block; width: 14px; color: transparent; }
.section-nav a[aria-current="true"] { color: #222; }
.section-nav a[aria-current="true"]::before { color: #222; content: "•"; }
.section-nav a:focus-visible { outline: 1px solid #222; outline-offset: 4px; }
h2[id] { scroll-margin-top: 72px; }

@media (max-width: 979px) {
  .section-nav {
    position: sticky;
    top: 0;
    margin: -40px -20px 28px;
    padding: 10px 20px;
    overflow-x: auto;
    flex-direction: row;
    gap: 18px;
    white-space: nowrap;
    background: rgba(255, 255, 255, 0.96);
    border-bottom: 1px solid #e3e3e3;
  }
  .section-nav a::before { width: 9px; }
}
```

Load `assets/homepage-navigation.js` with `defer` before the existing portrait script.

- [ ] **Step 4: Implement active-section tracking**

Create `assets/homepage-navigation.js` as a self-contained closure. It must collect menu links and their target headings, set exactly one `aria-current` value, use an `IntersectionObserver` with `rootMargin: '-18% 0px -68% 0px'`, update immediately on anchor clicks, and choose native instant scrolling for reduced-motion visitors.

```js
(() => {
  const links = [...document.querySelectorAll('.section-nav a[data-section]')];
  const sections = links
    .map((link) => document.getElementById(link.dataset.section))
    .filter(Boolean);
  if (!links.length || !sections.length) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function selectSection(id) {
    links.forEach((link) => {
      if (link.dataset.section === id) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }

  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      const target = document.getElementById(link.dataset.section);
      if (!target) return;
      event.preventDefault();
      selectSection(link.dataset.section);
      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', `#${link.dataset.section}`);
    });
  });

  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible) selectSection(visible.target.id);
  }, { rootMargin: '-18% 0px -68% 0px', threshold: [0, 0.25, 0.75] });

  sections.forEach((section) => observer.observe(section));
  if (location.hash && document.getElementById(location.hash.slice(1))) {
    selectSection(location.hash.slice(1));
  }
})();
```

- [ ] **Step 5: Run homepage contracts and confirm they pass**

Run:

```sh
./scripts/check-homepage-experience.sh
./scripts/check-homepage-quotes.sh
```

Expected: both scripts print `PASS`.

- [ ] **Step 6: Commit the navigation slice**

```sh
git add index.html assets/homepage-navigation.js scripts/check-homepage-experience.sh
git add -u CV.pdf
git commit -m "Add homepage section navigation"
```

### Task 2: Curated AI Adoption Figures

**Files:**
- Modify: `scripts/check-ai-adoption-page.sh:20-59`
- Modify: `ai-adoption/index.html:129-174, 205-237`

- [ ] **Step 1: Extend the AI adoption contract first**

Before changing the article, add these checks to `scripts/check-ai-adoption-page.sh`:

```sh
for text in \
  'article-figure figure-gap' \
  'article-figure figure-overhang' \
  'article-figure figure-access' \
  'max-width: 540px' \
  'max-width: 500px' \
  'max-width: 460px' \
  'width="925" height="1024" loading="lazy"' \
  'width="1600" height="1600" loading="lazy"' \
  'width="1048" height="1224" loading="lazy"'; do
  require_text "$article" "$text"
done
```

- [ ] **Step 2: Run the article contract and confirm the new checks fail**

Run `./scripts/check-ai-adoption-page.sh`.

Expected: failure for missing `article-figure figure-gap`.

- [ ] **Step 3: Implement the editorial figure sizing**

Replace the 860px figure container and mobile bleed rules with:

```css
.article-figure {
  width: 100%;
  margin: 26px auto 68px;
}

.article-figure.figure-gap { max-width: 540px; }
.article-figure.figure-overhang { max-width: 500px; }
.article-figure.figure-access { max-width: 460px; }

.article-figure img {
  display: block;
  width: 100%;
  height: auto;
  border: 1px solid var(--soft-rule);
  background: #fff;
}

.article-figure figcaption {
  width: 100%;
  margin-top: 10px;
  color: var(--muted);
  font-size: 0.78rem;
  line-height: 1.6;
}
```

At the mobile breakpoint, use only `.article-figure { margin: 22px auto 54px; }`; remove the negative margin and wider-than-viewport image rule.

Assign the three variant classes in order. Add the exact intrinsic `width`, `height`, `loading="lazy"`, and `decoding="async"` attributes to each image without changing sources, alt text, or captions.

- [ ] **Step 4: Run the article contracts**

Run:

```sh
./scripts/check-ai-adoption-page.sh
./scripts/check-article-page.sh
```

Expected: both scripts print `PASS`.

- [ ] **Step 5: Commit the article slice**

```sh
git add ai-adoption/index.html scripts/check-ai-adoption-page.sh
git commit -m "Curate AI adoption article figures"
```

### Task 3: Finale Stage, Walker, and Static Fallback

**Files:**
- Modify: `scripts/check-homepage-experience.sh`
- Modify: `index.html:9-91, 174-180, 304-305`
- Create: `assets/paint-finale.js`

- [ ] **Step 1: Add failing finale markup and accessibility checks**

Append these requirements before the final `PASS` in `scripts/check-homepage-experience.sh`:

```sh
for text in \
  'id="paint-finale"' \
  'id="paint-finale-canvas"' \
  'class="finale-walker"' \
  'class="paint-bucket"' \
  'aria-hidden="true"' \
  'assets/paint-finale.js' \
  '@media (prefers-reduced-motion: reduce)'; do
  require_text "$home" "$text"
done

test -f "$finale" || fail "missing assets/paint-finale.js"
```

- [ ] **Step 2: Run the homepage experience contract and confirm failure**

Run `./scripts/check-homepage-experience.sh`.

Expected: failure for missing `id="paint-finale"`.

- [ ] **Step 3: Add the full-width bottom stage**

Change the body bottom margin to zero and replace the existing `<footer>` with a `.paint-finale` section after the final `<hr>`. The section must contain, in stacking order, the decorative canvas, an inline SVG walker, and the footer:

```html
<section class="paint-finale" id="paint-finale" aria-label="Painted page finale">
  <canvas id="paint-finale-canvas" class="paint-finale__canvas" aria-hidden="true"></canvas>
  <svg class="finale-walker" viewBox="0 0 150 170" aria-hidden="true">
    <defs>
      <filter id="ink-roughness" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="11" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5" />
      </filter>
      <pattern id="portrait-dots" width="5" height="5" patternUnits="userSpaceOnUse">
        <circle cx="1.5" cy="1.5" r="1.1" fill="#222" />
      </pattern>
    </defs>
    <g class="walker" filter="url(#ink-roughness)">
      <g class="walker-head">
        <path d="M92 30c10 0 17 8 17 18 0 7-3 12-8 16l-2 10H82l2-12c-5-4-8-9-8-15 0-10 6-17 16-17Z" fill="url(#portrait-dots)" />
        <path d="M77 43c4-15 23-19 34-6l-5 3c-8-7-20-5-26 6Z" fill="#222" />
      </g>
      <path class="walker-torso" d="M80 72c8-5 20-5 27 1l5 46H73l4-28Z" fill="#222" />
      <path class="walker-arm walker-arm--rear" d="M82 78 65 107 59 103 75 74Z" fill="#222" />
      <path class="walker-arm walker-arm--bucket" d="m104 78 19 28-6 4-20-27Z" fill="#222" />
      <path class="walker-leg walker-leg--rear" d="m82 115 12 2-7 43H77Z" fill="#222" />
      <path class="walker-leg walker-leg--front" d="m101 115 10 4 11 39-10 3-17-39Z" fill="#222" />
      <g class="paint-bucket">
        <path d="M113 105h27l-4 30h-19Z" fill="#fff" stroke="#222" stroke-width="3" />
        <path d="M117 106c0-13 19-13 20 0" fill="none" stroke="#222" stroke-width="2" />
        <path d="M114 109h25" stroke="#222" stroke-width="4" />
      </g>
    </g>
  </svg>
  <footer class="finale-footer">&copy; 2026 Fabian Hildesheim</footer>
</section>
```

Add stage CSS using a `100vw` width and `margin-left: calc(50% - 50vw)` so it escapes the body's 660px measure. Make it 230px tall on desktop and 180px on mobile, clip overflow, place the canvas absolutely across the stage, position the 145px SVG in the lower-right, and keep the footer above the canvas with a small white translucent backing. Add a static multicolor `linear-gradient` canvas background as the no-script fallback; remove it only after JavaScript adds `.is-enhanced`. Under reduced motion, disable transitions and present `.is-complete` transforms immediately.

- [ ] **Step 4: Load the finale module and create a syntax-valid starting module**

Load `<script src="assets/paint-finale.js" defer></script>` before the voice portrait script. Create `assets/paint-finale.js` with a guarded closure, DOM references, and no animation yet:

```js
(() => {
  const stage = document.getElementById('paint-finale');
  const canvas = document.getElementById('paint-finale-canvas');
  const walker = stage && stage.querySelector('.finale-walker');
  if (!stage || !canvas || !walker || !canvas.getContext) return;
  stage.classList.add('is-enhanced');
})();
```

- [ ] **Step 5: Run markup contract and JavaScript syntax check**

Run:

```sh
./scripts/check-homepage-experience.sh
node --check assets/paint-finale.js
```

Expected: contract passes and Node reports no syntax error.

- [ ] **Step 6: Commit the static finale slice**

```sh
git add index.html assets/paint-finale.js scripts/check-homepage-experience.sh
git commit -m "Add homepage paint finale stage"
```

### Task 4: One-Shot Walk and Paint Animation

**Files:**
- Modify: `scripts/check-homepage-experience.sh`
- Modify: `assets/paint-finale.js`

- [ ] **Step 1: Add failing animation contract checks**

Require these implementation hooks in `scripts/check-homepage-experience.sh`:

```sh
for text in \
  'IntersectionObserver' \
  'requestAnimationFrame' \
  'devicePixelRatio' \
  'prefers-reduced-motion: reduce' \
  'drawRibbons' \
  'drawSplatters' \
  'animationComplete'; do
  require_text "$finale" "$text"
done
```

- [ ] **Step 2: Run the contract and confirm it fails for the animation hooks**

Run `./scripts/check-homepage-experience.sh`.

Expected: failure for missing `IntersectionObserver` in `assets/paint-finale.js`.

- [ ] **Step 3: Implement deterministic high-DPI rendering**

In `assets/paint-finale.js`, define palette and ribbon data, cap pixel ratio at 2, and redraw on resize. Each ribbon definition contains `color`, `width`, `delay`, and four normalized cubic Bézier points originating at the bucket spill point and flowing primarily left. Implement these concrete helpers:

```js
const palette = ['#315ee8', '#e43d78', '#12a88a', '#f0c52e', '#7548cf'];
let width = 0;
let height = 0;
let pixelRatio = 1;
let animationComplete = false;

function sizeCanvas() {
  const rect = stage.getBoundingClientRect();
  width = Math.max(1, Math.round(rect.width));
  height = Math.max(1, Math.round(rect.height));
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function cubicPoint(points, t) {
  const inverse = 1 - t;
  return {
    x: inverse ** 3 * points[0].x + 3 * inverse ** 2 * t * points[1].x + 3 * inverse * t ** 2 * points[2].x + t ** 3 * points[3].x,
    y: inverse ** 3 * points[0].y + 3 * inverse ** 2 * t * points[1].y + 3 * inverse * t ** 2 * points[2].y + t ** 3 * points[3].y
  };
}
```

`drawRibbons(progress)` samples each visible curve into a tapered, round-capped stroke and overlays a thinner translucent highlight. `drawSplatters(progress)` draws deterministic dots around the spill and along completed curves using a seeded sine-based value rather than `Math.random`, so resize redraws do not jump.

- [ ] **Step 4: Implement the walker timeline and one-shot trigger**

Use a 4.8-second timeline with these phases: 250ms establish, 1,400ms walk, 700ms brace/tip, 2,200ms paint unfurl, and 250ms settle. On every frame:

- ease the SVG from `translateX(145px)` to `translateX(0)` during the walk;
- use sine-driven alternating rotations on the two legs and arms while walking;
- settle the limbs and rotate the bucket arm/bucket forward during the pour;
- draw paint from 0 to 1 during the unfurl;
- set `.is-complete`, mark `animationComplete = true`, and stop requesting frames after settlement.

Start the timeline once through an `IntersectionObserver` with `{ threshold: 0.45 }`, then disconnect it. For `prefers-reduced-motion: reduce`, call `sizeCanvas()`, draw the final ribbons/splatters, apply the final walker/bucket transforms, add `.is-complete`, and do not request an animation frame. On resize, redraw only the current or completed paint state without replaying the timeline.

- [ ] **Step 5: Run contract and syntax checks**

Run:

```sh
./scripts/check-homepage-experience.sh
node --check assets/homepage-navigation.js
node --check assets/paint-finale.js
```

Expected: the contract prints `PASS`, and both syntax checks exit zero.

- [ ] **Step 6: Commit the animation slice**

```sh
git add assets/paint-finale.js scripts/check-homepage-experience.sh
git commit -m "Animate the homepage paint finale"
```

### Task 5: Integrated Visual Verification and Refinement

**Files:**
- Verify and correct layout geometry in: `index.html`
- Verify and correct active-section behavior in: `assets/homepage-navigation.js`
- Verify and correct paint timing/rendering in: `assets/paint-finale.js`
- Verify and correct figure sizing in: `ai-adoption/index.html`

- [ ] **Step 1: Run the complete automated suite**

Run:

```sh
./scripts/check-homepage-quotes.sh
./scripts/check-homepage-experience.sh
./scripts/check-ai-adoption-page.sh
./scripts/check-article-page.sh
node --check assets/homepage-navigation.js
node --check assets/paint-finale.js
git diff --check
```

Expected: all four scripts print `PASS`, both JavaScript files pass syntax checking, and `git diff --check` returns no output.

- [ ] **Step 2: Serve and inspect desktop layouts**

Serve the repository over a local HTTP server. Inspect the homepage at 1440x1000 and the AI adoption article at 1280x900. Confirm the menu stays outside the 660px reading measure, active markers change, the CV is absent, the three figures are visually distinct sizes and legible, and no horizontal scrollbar appears.

- [ ] **Step 3: Inspect mobile and reduced-motion layouts**

Inspect both pages at 390x844. Confirm the menu becomes a compact sticky strip, anchor targets are not covered, all article graphics fit the viewport, the footer remains readable, and the finale remains on the lower-right. Emulate reduced motion and confirm the completed static paint state appears with no walk/pour sequence.

- [ ] **Step 4: Inspect the animation timeline**

Reload the homepage, scroll to the very bottom, and capture the start, walk, pour, and settled states. Confirm the figure starts near the right edge, travels approximately 120px, visibly tips the bucket, color originates at the rim/ground contact, ribbons unfurl mostly leftward, the final paint remains, and the sequence never restarts on scroll.

- [ ] **Step 5: Apply only evidence-driven visual corrections**

If screenshots show collision, weak contrast, overflow, or illegible chart labels, adjust only the relevant stage geometry, footer backing, menu offset, or figure maximum width. Re-run the full automated suite after every correction.

- [ ] **Step 6: Commit final visual refinements**

```sh
git add index.html assets/homepage-navigation.js assets/paint-finale.js ai-adoption/index.html scripts
git commit -m "Refine responsive site presentation"
```

Skip this commit if visual verification requires no corrections.
