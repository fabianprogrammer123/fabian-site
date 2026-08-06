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

require_text "Don't be afraid to give up the good to go for the great."
require_text "John D. Rockefeller"
require_text "color: #173b63;"

printf 'PASS: homepage quote contract\n'
