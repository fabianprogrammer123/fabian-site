#!/usr/bin/env bash
set -euo pipefail

task_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
build_dir="$task_root/dist"
stage_dir="$(mktemp -d "$task_root/.sites-build.XXXXXX")"

cleanup() {
  if test -d "$stage_dir"; then
    rm -rf "$stage_dir"
  fi
}
trap cleanup EXIT

mkdir -p "$stage_dir/client" "$stage_dir/server"

for site_path in \
  index.html \
  2_openai_capability_overhang.png \
  anthropic_graph.jpg \
  humanity_graoh.png \
  ai-adoption \
  assets \
  fine-tuned-open-source-models \
  water
do
  cp -R "$task_root/$site_path" "$stage_dir/client/"
done

cp "$task_root/sites/server/index.js" "$stage_dir/server/index.js"

if test -d "$build_dir"; then
  rm -rf "$build_dir"
fi
mv "$stage_dir" "$build_dir"
trap - EXIT

printf 'Built static site in %s\n' "$build_dir"
