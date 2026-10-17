#!/usr/bin/env bash
# Owns lossless, unscaled original-game screenshots and their catalogue entries.
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
[[ $# -ge 1 && $# -le 4 ]] || original_die 'Usage: shot.sh NAME [SCREEN [VISIBLE_CONTENT [NAVIGATION]]]'
original_name "$1"
for tool in import identify python3; do
    command -v "$tool" >/dev/null || original_die "Missing required tool: $tool"
done
original_window
mkdir -p -- "$ORIGINAL_OUTPUT"
destination="$ORIGINAL_OUTPUT/$1.png"
[[ ! -e $destination ]] || original_die "Refusing to overwrite $destination"
temporary=$(mktemp "$ORIGINAL_OUTPUT/.shot-XXXXXXXX.png")
trap 'rm -f -- "$temporary"' EXIT
import -silent -window "$ORIGINAL_WINDOW" +repage "png:$temporary"
dimensions=$(identify -format '%wx%h' "$temporary")
[[ $dimensions == "${ORIGINAL_WIDTH}x${ORIGINAL_HEIGHT}" ]] || original_die "Capture dimensions changed to $dimensions; discarded."
# Hard-link creation fails atomically if another capture already used this name.
ln -- "$temporary" "$destination"
original_catalogue_row "$1.png" "${2:-Unannotated screen}" \
    "${3:-Not recorded; annotate after viewing}" "${4:-Not recorded; annotate after capture}" "$dimensions PNG"
printf '%s\n' "$destination"
