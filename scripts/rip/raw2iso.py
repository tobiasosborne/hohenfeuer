#!/usr/bin/env python3
# owns: converting a raw 2352-byte-sector CD image (Mode 1 or Mode 2 form 1/2) to a plain 2048-byte ISO 9660 image.
# Usage: python3 -I scripts/rip/raw2iso.py <raw.iso> <out-2048.iso>   (then: 7z x out-2048.iso -oiso)
import sys
from pathlib import Path


def convert(src: Path, dst: Path) -> int:
    n = 0
    with src.open('rb') as f, dst.open('wb') as out:
        while True:
            s = f.read(2352)
            if len(s) < 2352:
                break
            if s[15] == 2:  # Mode 2: subheader at 16..24; form 2 (bit 5 of submode) carries 2324 bytes
                out.write(s[24:24 + 2048] if not (s[18] & 0x20) else s[24:24 + 2324][:2048])
            else:  # Mode 1: 16-byte sync+header, 2048 data bytes
                out.write(s[16:16 + 2048])
            n += 1
    return n


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit('usage: raw2iso.py <raw-2352.iso> <out-2048.iso>')
    print(f'{convert(Path(sys.argv[1]), Path(sys.argv[2]))} sectors')
