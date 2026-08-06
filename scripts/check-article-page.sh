#!/bin/sh

set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
article="$root/fine-tuned-open-source-models/index.html"
home="$root/index.html"

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
    fail "found forbidden '$text' in ${file#$root/}"
  fi
}

test -f "$article" || fail "missing fine-tuned-open-source-models/index.html"
test -f "$home" || fail "missing index.html"

for figure in hero divide grpo bankruptcy episode twin plateau training quadrant; do
  asset="$root/fine-tuned-open-source-models/assets/fig-$figure.png"
  test -s "$asset" || fail "missing or empty assets/fig-$figure.png"
  require_text "$article" "assets/fig-$figure.png"
done

for text in \
  "The Rise of Intelligence Ownership" \
  "Justinas Zaliaduonis" \
  "Joris Zilinskis" \
  "Fabian Hildesheim" \
  "Joel Hainzl" \
  "Gediminas Pazera" \
  "Part I" \
  "Part II" \
  "Part III" \
  "Part IV" \
  "Part V" \
  "Part VI" \
  "TL;DR" \
  "Appendix" \
  "Sources &amp; notes" \
  "back to home"; do
  require_text "$article" "$text"
done

require_text "$home" "fine-tuned-open-source-models/"
require_text "$home" "The Rise of Intelligence Ownership"

for file in "$article" "$home"; do
  forbid_text "$file" "Originally published"
  forbid_text "$file" "Book a free expert call"
  forbid_text "$file" "Book a 30-minute audit"
  forbidden_dash=$(printf '\342\200\224')
  if rg -q "$forbidden_dash" "$file"; then
    fail "found an em dash in ${file#$root/}"
  fi
done

printf 'PASS: article page contract\n'
