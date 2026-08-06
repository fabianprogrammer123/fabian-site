#!/bin/sh

set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
home="$root/index.html"

require_text() {
  text=$1
  rg -Fq "$text" "$home" || {
    printf "FAIL: missing '%s' in index.html\n" "$text" >&2
    exit 1
  }
}

require_section_quote() {
  section=$1
  quote=$2
  awk -v section="$section" -v quote="$quote" '
    $0 == "<h2>" section "</h2>" { in_section = 1; next }
    in_section && /^<h2>/ { exit }
    in_section && index($0, quote) { found = 1; exit }
    END { exit found ? 0 : 1 }
  ' "$home" || {
    printf "FAIL: section '%s' is missing quote '%s'\n" "$section" "$quote" >&2
    exit 1
  }
}

require_text "Don't be afraid to give up the good to go for the great."
require_text "John D. Rockefeller"
require_text "color: #173b63;"
require_text '<a href="https://frontier-fellows.com/">Frontier Fellows</a>'
require_section_quote "now" "John D. Rockefeller"
require_section_quote "thoughts" "Wayne Gretzky"

printf 'PASS: homepage quote contract\n'
