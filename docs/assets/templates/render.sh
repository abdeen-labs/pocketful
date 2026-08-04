#!/bin/bash
# Renders the template SVG sources to the bundled PNG assets in app/assets/templates.
# Requires Inkscape (brew install --cask inkscape). Text uses macOS system fonts
# (Futura, Avenir Next), so render on a Mac.
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
OUT="${1:-$SRC/../../../app/assets/templates}"

# slot name → 1x size in points
sizes() {
  case "$1" in
    artwork) echo "358 448" ;;
    icon) echo "29 29" ;;
    primary-logo) echo "126 30" ;;
    secondary-logo) echo "135 12" ;;
  esac
}

for template in midnight-live harbor-fc; do
  mkdir -p "$OUT/$template"
  for slot in artwork icon primary-logo secondary-logo; do
    read -r w h <<< "$(sizes "$slot")"
    for scale in 1 2 3; do
      inkscape "$SRC/$template/$slot.svg" \
        -w $((w * scale)) -h $((h * scale)) \
        -o "$OUT/$template/$slot-${scale}x.png" 2>/dev/null
      echo "$template/$slot-${scale}x.png"
    done
  done
done
