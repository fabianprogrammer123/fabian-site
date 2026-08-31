#!/bin/sh

set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
home="$root/index.html"
water="$root/water/index.html"
nav="$root/assets/homepage-navigation.js"

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
test -f "$water" || fail "missing water/index.html"
test ! -e "$root/CV.pdf" || fail "CV.pdf is still publicly shipped"
forbid_text "$home" 'CV.pdf'
forbid_text "$home" '>cv<'

for section in why-this-site now background thoughts; do
  require_text "$home" "href=\"#$section\""
  require_text "$home" "id=\"$section\""
done

for text in \
  'class="section-nav"' \
  'aria-label="On this page"' \
  'assets/homepage-navigation.js' \
  'assets/particle-ocean.js?v=6' \
  'id="particle-ocean"' \
  'class="ocean-content"' \
  'pointer-events: none' \
  '@media (prefers-reduced-motion: reduce)'; do
  require_text "$home" "$text"
done

for text in \
  '../assets/homepage-navigation.js' \
  '../assets/particle-ocean.js?v=6' \
  'id="particle-ocean"'; do
  require_text "$water" "$text"
done

require_text "$nav" 'IntersectionObserver'
require_text "$nav" 'aria-current'
require_text "$nav" 'prefers-reduced-motion: reduce'
require_text "$nav" 'updateFromScroll'

printf 'PASS: homepage navigation and particle ocean contract\n'

node "$root/scripts/check-particle-ocean.js"
