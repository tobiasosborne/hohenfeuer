#!/usr/bin/env bash
# Owns shared paths and native-window validation for original-game capture.

ORIGINAL_ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
ORIGINAL_OUTPUT="$ORIGINAL_ROOT/assets-ripped/goldens-original"
export DISPLAY="${DISPLAY:-:0}"
export WINEPREFIX="${WINEPREFIX:-$HOME/.wine-castle}"
WINE_BIN="${WINE_BIN:-$HOME/Apps/wine-11.19-wow64/bin/wine}"

original_die() { printf '%s\n' "$*" >&2; exit 1; }

original_name() {
    [[ ${1:-} =~ ^[a-zA-Z0-9][a-zA-Z0-9_-]*$ ]] ||
        original_die 'NAME must contain only letters, digits, hyphens or underscores.'
}

original_window() {
    command -v xdotool >/dev/null || original_die 'xdotool is required.'
    local candidates geometry
    if [[ -n ${GAME_WINDOW_ID:-} ]]; then
        ORIGINAL_WINDOW=$GAME_WINDOW_ID
    else
        candidates=$(xdotool search --onlyvisible --name \
            "${GAME_WINDOW_NAME:-^Ballerburg$}") ||
            original_die 'No visible Ballerburg desktop found, or X11 access is blocked. Set GAME_WINDOW_ID if its title differs.'
        [[ $candidates != *$'\n'* ]] ||
            original_die 'Multiple matching windows: choose one with GAME_WINDOW_ID.'
        ORIGINAL_WINDOW=$candidates
    fi
    # Wine exposes the real DirectDraw surface as an unnamed child. Menus are
    # fixed at 800x600 even with 1024x768 battles; capture that surface unscaled.
    if [[ -z ${GAME_WINDOW_ID:-} ]]; then
        local surface
        surface=$(xwininfo -id "$ORIGINAL_WINDOW" -tree | python3 -c '
import re, sys
for line in sys.stdin:
    m = re.search(r"(0x[0-9a-f]+) \(has no name\).*? (800x600|1024x768)\+0\+0", line)
    if m:
        print(m.group(1))
        break
')
        [[ -z $surface ]] || ORIGINAL_WINDOW=$surface
    fi
    [[ $ORIGINAL_WINDOW =~ ^([0-9]+|0x[0-9a-fA-F]+)$ ]] ||
        original_die 'Invalid X11 window ID.'
    geometry=$(xdotool getwindowgeometry --shell "$ORIGINAL_WINDOW") ||
        original_die 'Cannot read the capture window geometry.'
    ORIGINAL_WIDTH=$(awk -F= '$1 == "WIDTH" {print $2}' <<< "$geometry")
    ORIGINAL_HEIGHT=$(awk -F= '$1 == "HEIGHT" {print $2}' <<< "$geometry")
    [[ ${ORIGINAL_WIDTH}x${ORIGINAL_HEIGHT} == 1024x768 || ${ORIGINAL_WIDTH}x${ORIGINAL_HEIGHT} == 800x600 ]] ||
        original_die "Expected a native 800x600 menu or 1024x768 battle surface; found ${ORIGINAL_WIDTH}x${ORIGINAL_HEIGHT}. No scaling will be performed."
}

original_catalogue_row() {
    python3 - "$ORIGINAL_OUTPUT/catalogue.md" "$@" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
if not path.exists():
    path.write_text('<!-- Owns the catalogue of observed original-game captures. -->\n'
                    '# Original Ballerburg captures\n\n'
                    '| File | Screen | Visible content | Navigation | Resolution |\n'
                    '|---|---|---|---|---|\n')
fields = [s.replace('|', '&#124;').replace('\r', ' ').replace('\n', ' ')
          for s in sys.argv[2:]]
with path.open('a') as output:
    output.write('| ' + ' | '.join(fields) + ' |\n')
PY
}
