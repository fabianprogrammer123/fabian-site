#!/bin/sh

set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
article="$root/ai-adoption/index.html"
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
    fail "found removed text '$text' in ${file#$root/}"
  fi
}

test -f "$article" || fail "missing ai-adoption/index.html"

for text in \
  "On AI Adoption" \
  "Fabian Hildesheim" \
  "March 2026" \
  "Since starting my research at Stanford Institute for Human-Centered Artificial Intelligence" \
  "The delta of AI Adoption" \
  "Capability Overhang" \
  "compute, data, AI talent, and funding" \
  "../anthropic_graph.jpg" \
  "../2_openai_capability_overhang.png" \
  "../humanity_graoh.png" \
  "back to home"; do
  require_text "$article" "$text"
done

require_text "$home" "ai-adoption/"
require_text "$home" "On AI Adoption"

for text in "on Limitless Mind" "on altruism" "on Africa" "<summary>on AI adoption"; do
  forbid_text "$home" "$text"
done

for file in "$article" "$home"; do
  forbidden_dash=$(printf '\342\200\224')
  if rg -q "$forbidden_dash" "$file"; then
    fail "found an em dash in ${file#$root/}"
  fi
done

printf 'PASS: AI adoption page contract\n'
