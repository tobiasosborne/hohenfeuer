#!/usr/bin/env bash
# Owns the original game's CD mapping and per-application Wine compatibility settings.
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"

version=${1:-winxp}
renderer=${2:-opengl}
[[ $# -le 2 ]] || original_die 'Usage: configure.sh [win10|winxp|win98] [opengl|gdi]'
case "$version" in win10|winxp|win98) ;; *) original_die 'Unsupported Windows version.' ;; esac
case "$renderer" in opengl|gdi) ;; *) original_die 'Unsupported DirectDraw renderer.' ;; esac
[[ -x $WINE_BIN ]] || original_die "Wine executable missing: $WINE_BIN"

# A labelled view of the extracted CD keeps all new files inside the prefix.
# Existing CD files are links, not copies. No raw CD device is claimed.
python3 - "$ORIGINAL_ROOT/downloads/en-iso/iso" "$WINEPREFIX" <<'PY'
from pathlib import Path
import sys

source, prefix = map(Path, sys.argv[1:])
source, prefix = source.resolve(), prefix.resolve()
if not (source / 'MaxInst.exe').is_file():
    raise SystemExit('Missing extracted English CD: ' + str(source))
if not (prefix / 'user.reg').is_file():
    raise SystemExit('Expected an existing initialized Wine prefix: ' + str(prefix))
mirror = prefix / 'cdrom-ballerburg'
drive = prefix / 'dosdevices/d:'
if drive.exists() or drive.is_symlink():
    if not drive.is_symlink() or drive.resolve() != mirror:
        raise SystemExit('Refusing to replace an existing D: mapping: ' + str(drive))
mirror.mkdir(exist_ok=True)
for item in source.iterdir():
    target = mirror / item.name
    if target.exists() or target.is_symlink():
        if not target.is_symlink() or target.resolve() != item:
            raise SystemExit('Unexpected existing CD entry: ' + str(target))
    else:
        target.symlink_to(item, target_is_directory=item.is_dir())
(mirror / '.windows-label').write_text('BALLERBURG\n')
if not drive.is_symlink():
    drive.symlink_to(mirror, target_is_directory=True)
PY

export WINEDEBUG="${WINEDEBUG:--all}"
"$WINE_BIN" reg add 'HKLM\Software\Wine\Drives' /v 'd:' /t REG_SZ /d cdrom /f
for app in Ballerburg.exe MaxInst.exe; do
    "$WINE_BIN" reg add 'HKCU\Software\Wine\AppDefaults\'"$app" \
        /v Version /t REG_SZ /d "$version" /f
done
"$WINE_BIN" reg add 'HKCU\Software\Wine\AppDefaults\Ballerburg.exe\Direct3D' \
    /v DirectDrawRenderer /t REG_SZ /d "$renderer" /f
"$WINE_BIN" reg add 'HKCU\Software\Wine\Explorer\Desktops' \
    /v Ballerburg /t REG_SZ /d 1024x768 /f
printf 'Configured D: as CD-ROM, Ballerburg.exe as %s/%s, desktop 1024x768.\n' "$version" "$renderer"
