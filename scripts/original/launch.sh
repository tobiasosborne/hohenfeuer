#!/usr/bin/env bash
# Owns launching the English installer or installed original game in a 1024x768 Wine desktop.
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
[[ -x $WINE_BIN ]] || original_die "Wine executable missing: $WINE_BIN"
export WINEDEBUG="${WINEDEBUG:--all}"

case "${1:-}" in
    --install)
        [[ $# == 1 ]] || original_die 'Usage: launch.sh [--install]'
        [[ -f $WINEPREFIX/dosdevices/d:/MaxInst.exe ]] ||
            original_die 'Run scripts/original/configure.sh first to map the CD.'
        cd -- "$WINEPREFIX/dosdevices/d:"
        exec "$WINE_BIN" explorer /desktop=Ballerburg,1024x768 'D:\MaxInst.exe'
        ;;
    '') ;;
    *) original_die 'Usage: launch.sh [--install]; GAME_EXE can select an installed executable.' ;;
esac

if [[ -n ${GAME_EXE:-} ]]; then
    game=$GAME_EXE
else
    game=$(python3 - "$WINEPREFIX/drive_c" <<'PY'
from pathlib import Path
import sys

matches = [p for p in Path(sys.argv[1]).rglob('*')
           if p.is_file() and p.name.lower() == 'ballerburg.exe']
if len(matches) != 1:
    raise SystemExit('Expected one installed Ballerburg.exe; found '
                     + str(len(matches)) + '. Install first or set GAME_EXE.')
print(matches[0].resolve())
PY
    )
fi
[[ -f $game && $game == /* ]] || original_die 'GAME_EXE must be an existing absolute Linux path.'
winepath="$(dirname -- "$WINE_BIN")/winepath"
[[ -x $winepath ]] || original_die "Missing Wine path converter: $winepath"
windows_game=$("$winepath" -w "$game")
cd -- "$(dirname -- "$game")"
exec "$WINE_BIN" explorer /desktop=Ballerburg,1024x768 "$windows_game"
