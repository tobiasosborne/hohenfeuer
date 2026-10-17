#!/usr/bin/env bash
# Owns a reproducible five-frame capture of a selected weapon and one adjusted shot.
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
[[ $# == 3 ]] || original_die 'Usage: weapon-series.sh SLOT FIRST_NUMBER WEAPON_SLUG'
[[ $1 =~ ^[1-8]$ && $2 =~ ^[0-9]+$ ]] || original_die 'Invalid slot or number.'
original_name "$3"
helper="$ORIGINAL_ROOT/scripts/original"
slot=$1
number=$((10#$2))
weapon=$3
capture() {
    local name
    printf -v name '%03d-%s-%s' "$number" "$weapon" "$1"
    "$helper/shot.sh" "$name" "$weapon: $2" "$3" "$4"
    number=$((number + 1))
}
"$helper/input.sh" key "$slot"
sleep 1
capture aim-one 'first aiming view' 'Weapon model, direction/range and shot cost' "Quick game; select weapon slot $slot"
"$helper/input.sh" key Right Up
sleep 3
capture aim-two 'second aiming view' 'Direction increased by half a degree and range by one unit' 'Tap Right and Up; allow weapon to finish positioning'
"$helper/input.sh" key space
sleep .12
capture firing 'firing moment' 'Launch animation and reload bar; verify against image before using' 'Press Space after positioning'
sleep .5
capture flight 'projectile flight' 'Aiming view shortly after launch; visibility varies by projectile' 'Remain in weapon view after firing'
game=$(xdotool search --onlyvisible --name '^Ballerburg$')
xdotool windowfocus "$game" keydown End
trap 'xdotool keyup End' EXIT
sleep 6
capture impact 'impact view' 'Landing scene after shot; this may be a miss' 'Hold End for six seconds after firing'
xdotool keyup End
trap - EXIT
