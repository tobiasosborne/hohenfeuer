#!/usr/bin/env bash
# Owns 30-second original-game window recordings and their catalogue entries.
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
[[ $# -ge 1 && $# -le 4 ]] || original_die 'Usage: record.sh NAME [SCREEN [VISIBLE_CONTENT [NAVIGATION]]]'
original_name "$1"
for tool in ffmpeg python3; do
    command -v "$tool" >/dev/null || original_die "Missing required tool: $tool"
done
original_window
mkdir -p -- "$ORIGINAL_OUTPUT"
destination="$ORIGINAL_OUTPUT/$1.mp4"
[[ ! -e $destination ]] || original_die "Refusing to overwrite $destination"
ffmpeg -hide_banner -nostdin -n -f x11grab -draw_mouse 0 \
    -framerate 30 -video_size "${ORIGINAL_WIDTH}x${ORIGINAL_HEIGHT}" -window_id "$ORIGINAL_WINDOW" \
    -i "$DISPLAY" -t 30 -an -c:v libx264 -preset veryfast -crf 18 \
    -pix_fmt yuv420p -movflags +faststart "$destination"
original_catalogue_row "$1.mp4" "${2:-Unannotated sequence}" \
    "${3:-Not recorded; annotate after viewing}" "${4:-Not recorded; annotate after capture}" "${ORIGINAL_WIDTH}x${ORIGINAL_HEIGHT} MP4; 30 s; 30 fps; no audio"
printf '%s\n' "$destination"
