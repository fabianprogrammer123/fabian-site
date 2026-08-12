#!/bin/sh

set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
home="$root/index.html"
nav="$root/assets/homepage-navigation.js"
finale="$root/assets/paint-finale.js"
trail="$root/assets/paint-journey-trail.js"
character="$root/assets/paint-journey-character.js"
ladder="$root/assets/paint-journey-ladder.js"
particles="$root/assets/paint-journey-particles.js"
journey="$root/assets/paint-journey.js"

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
require_text "$nav" 'updateFromScroll'

for text in \
  'id="journey-paint-layer"' \
  'id="journey-webgl-layer"' \
  'class="journey-content"' \
  'text-shadow: 0 0 3px #fff' \
  'radial-gradient(circle, rgba(255, 255, 255, 0.94)' \
  '.paint-finale.is-live' \
  'pointer-events: none'; do
  require_text "$home" "$text"
done

for script in \
  'assets/paint-journey-trail.js' \
  'assets/paint-journey-character.js' \
  'assets/paint-journey-ladder.js' \
  'assets/paint-journey-particles.js' \
  'assets/paint-journey.js'; do
  require_text "$home" "<script src=\"$script\" defer>"
done

for level in thoughts background now why-this-site portrait; do
  require_text "$home" "data-journey-level=\"$level\""
done

awk '
  /^[[:space:]]*body[[:space:]]*\{/ { in_body = 1; next }
  in_body && /^[[:space:]]*\}/ { in_body = 0 }
  in_body && /position:[[:space:]]*relative;/ { found = 1 }
  END { exit !found }
' "$home" || fail "missing position: relative in body rule"

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

for text in \
  'IntersectionObserver' \
  'requestAnimationFrame' \
  'devicePixelRatio' \
  'prefers-reduced-motion: reduce' \
  'drawRibbons' \
  'drawWhorls' \
  'drawSplatters' \
  'animationComplete'; do
  require_text "$finale" "$text"
done

test -f "$trail" || fail "missing assets/paint-journey-trail.js"

for text in \
  'PaintJourney.createTrail' \
  'getExclusionZones' \
  'pigmentRgb' \
  'drawStaticSpectrum' \
  'devicePixelRatio' \
  'stamp' \
  'ribbon' \
  'spray' \
  'resize' \
  'scheduleExclusionRefresh' \
  'ResizeObserver' \
  "querySelector('.journey-content')" \
  "addEventListener('scroll'" \
  "addEventListener('toggle'" \
  'destroy'; do
  require_text "$trail" "$text"
done

node "$root/scripts/check-paint-journey-trail.js"

test -f "$character" || fail "missing assets/paint-journey-character.js"

for text in \
  'PaintJourney.createCharacter' \
  'bucketLip' \
  'throwingHand' \
  'walk' \
  'deploy-ladder' \
  'climb-ladder' \
  'retrieve-ladder' \
  'paint-swing' \
  'rest' \
  'setOpacity' \
  'setPaintHue' \
  'paint-surface' \
  'HemisphereLight' \
  'DirectionalLight' \
  'rig-lighting' \
  'dispose'; do
  require_text "$character" "$text"
done

node "$root/scripts/check-paint-journey-character.js"

test -f "$ladder" || fail "missing assets/paint-journey-ladder.js"

for text in \
  'PaintJourney.createLadder' \
  'setSpan' \
  'ladder-rail' \
  'ladder-rung' \
  'dispose'; do
  require_text "$ladder" "$text"
done

node "$root/scripts/check-paint-journey-ladder.js"

test -f "$particles" || fail "missing assets/paint-journey-particles.js"

for text in \
  'PaintJourney.createParticles' \
  'capacity' \
  'bucketVelocity' \
  'hue = (hue +' \
  'emit' \
  'burst' \
  'clear' \
  'activeCount' \
  'trail.stamp'; do
  require_text "$particles" "$text"
done

node "$root/scripts/check-paint-journey-particles.js"

test -f "$journey" || fail "missing assets/paint-journey.js"

node "$root/scripts/check-paint-journey-orchestrator.js"

for text in \
  'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.min.js' \
  'idle' \
  'loading' \
  'entering' \
  'bottom-paint' \
  'walk' \
  'deploy-ladder' \
  'climb-ladder' \
  'retrieve-ladder' \
  'paint-swing' \
  'vanish' \
  'complete' \
  'cancelled-rest' \
  'getWorldPosition' \
  'wheel' \
  'touchstart' \
  'pointerdown' \
  'keydown' \
  'Escape' \
  'particles.clear()' \
  'cancelledBeforeInitialization' \
  'pauseUntilTargetVisible' \
  'resumeIfTargetVisible' \
  'previousBucketOrigin.set(0, 0, 0)' \
  'portraitPoint' \
  'trail.impact' \
  'trail.veil' \
  'PAINT_RATES' \
  "classList.toggle('is-live'" \
  'webglcontextlost'; do
  require_text "$journey" "$text"
done

for text in \
  'PaintFinale.startFallback' \
  'staticOnly' \
  'PaintJourneyControllerClaimed'; do
  require_text "$finale" "$text"
done

printf 'PASS: homepage CV and navigation contract\n'
