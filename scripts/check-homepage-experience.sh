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
