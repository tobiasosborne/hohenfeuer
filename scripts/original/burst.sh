#!/usr/bin/env bash
# Owns a short lossless PNG frame burst for identifying projectile launch and flight frames.
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
[[ $# == 2 && $1 =~ ^[1-8]$ ]] || original_die 'Usage: burst.sh SLOT NAME'
original_name "$2"
"$ORIGINAL_ROOT/scripts/original/input.sh" key "$1"
sleep 1
original_window
mkdir -p "$ORIGINAL_OUTPUT/logs/burst-$2"
[[ ! -e $ORIGINAL_OUTPUT/logs/burst-$2/frame-001.png ]] || original_die 'Burst already exists.'
ffmpeg -hide_banner -loglevel error -nostdin -n -f x11grab -draw_mouse 0 \
    -framerate 10 -video_size "${ORIGINAL_WIDTH}x${ORIGINAL_HEIGHT}" \
    -window_id "$ORIGINAL_WINDOW" -i "$DISPLAY" -t 4 -threads 1 \
    "$ORIGINAL_OUTPUT/logs/burst-$2/frame-%03d.png" &
capture_pid=$!
sleep .5
"$ORIGINAL_ROOT/scripts/original/input.sh" key space
wait "$capture_pid"
python3 - "$ORIGINAL_OUTPUT/logs/burst-$2" <<'PY'
from pathlib import Path
from PIL import Image, ImageDraw
import sys
p=Path(sys.argv[1]); frames=sorted(p.glob('frame-*.png'))
out=Image.new('RGB',(5*256,((len(frames)+4)//5)*212),'white')
draw=ImageDraw.Draw(out)
for i,f in enumerate(frames):
 im=Image.open(f); im.thumbnail((256,192))
 x=(i%5)*256; y=(i//5)*212
 out.paste(im,(x,y+20)); draw.text((x+4,y+3),f.stem,fill='black')
out.save(p/'contact.png')
print(p/'contact.png')
PY
