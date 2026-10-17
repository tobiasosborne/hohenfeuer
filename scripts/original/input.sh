#!/usr/bin/env bash
# Owns reliable input focus and paced mouse gestures for original-game capture.
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
game=$(xdotool search --onlyvisible --name '^Ballerburg$')
[[ -n $game && $game != *$'\n'* ]] || original_die 'Expected one visible game window.'
desktop=$(xdotool search --onlyvisible --name '^Ballerburg - Wine [Dd]esktop$')
[[ $(xdotool getactivewindow) == "$desktop" ]] || xdotool windowactivate --sync "$desktop"
case "${1:-}" in
 key) shift; xdotool windowfocus --sync "$game"; sleep .5
      if [[ $# == 1 && $1 == space ]]; then
          xdotool keydown space; sleep .5; xdotool keyup space
      else
          xdotool key --delay 300 "$@"
      fi ;;
 click) [[ $# == 3 ]] || original_die 'Usage: input.sh click X Y'; xdotool mousemove --window "$desktop" "$2" "$3"; sleep .15; xdotool mousedown 1; sleep .2; xdotool mouseup 1 ;;
 drag) [[ $# == 6 ]] || original_die 'Usage: input.sh drag BUTTON X Y DX DY'; xdotool mousemove --window "$desktop" "$3" "$4"; sleep .15; xdotool mousedown "$2"; sleep .15; xdotool mousemove_relative -- "$5" "$6"; sleep .15; xdotool mouseup "$2" ;;
 *) original_die 'Usage: input.sh key KEY... | click X Y | drag BUTTON X Y DX DY' ;;
esac
