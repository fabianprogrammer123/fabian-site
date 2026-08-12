#!/bin/sh

set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
home="$root/index.html"
nav="$root/assets/homepage-navigation.js"
finale="$root/assets/paint-finale.js"
trail="$root/assets/paint-journey-trail.js"

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
  'pointer-events: none'; do
  require_text "$home" "$text"
done

for script in \
  'assets/paint-journey-trail.js' \
  'assets/paint-journey-character.js' \
  'assets/paint-journey-rope.js' \
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
  'hsl(' \
  'drawStaticSpectrum' \
  'devicePixelRatio' \
  'stamp' \
  'ribbon' \
  'spray' \
  'resize' \
  'destroy'; do
  require_text "$trail" "$text"
done

printf 'PASS: homepage CV and navigation contract\n'
