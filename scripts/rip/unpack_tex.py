# Owns extraction of numbered BMP/TGA textures from Ballerburg TEX packs.
import argparse
import hashlib
import json
from pathlib import Path
import struct


def parse(data):
    if len(data) < 4:
        raise ValueError('Truncated TEX header')
    header = struct.unpack_from('<I', data)[0]
    if header >> 24 != 1:
        raise ValueError(f'Unknown TEX version: {header:#x}')
    count, pos, entries = header & 0xffffff, 4, []
    ids = set()
    for index in range(count):
        if pos+20 > len(data):
            raise ValueError('Truncated TEX record')
        kind, size, flags, color_key, tid = struct.unpack_from('<5I', data, pos)
        if kind not in (1, 2) or size == 0 or pos+20+size > len(data) or tid in ids:
            raise ValueError(f'Invalid TEX record at {pos:#x}')
        raw = data[pos+20:pos+20+size]
        if kind == 1 and raw[:2] != b'BM':
            raise ValueError('Type 1 TEX member is not BMP')
        entries.append(dict(index=index, id=tid, offset=pos, size=size, kind=kind,
                            flags=flags, color_key=color_key,
                            file=f'{tid}.{ "bmp" if kind == 1 else "tga"}',
                            sha256=hashlib.sha256(raw).hexdigest()))
        ids.add(tid)
        pos += 20+size
    if pos != len(data):
        raise ValueError('Unexplained TEX trailing bytes')
    return entries


def extract(source, output):
    data = source.read_bytes()
    entries = parse(data)
    output.mkdir(parents=True, exist_ok=True)
    for entry in entries:
        start = entry['offset']+20
        (output/entry['file']).write_bytes(data[start:start+entry['size']])
    manifest = dict(source=str(source), version=1, sha256=hashlib.sha256(data).hexdigest(), entries=entries)
    (output/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    print(f'{source.name}: {len(entries)} textures')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Unpack a TEX file, or all TEX files in a directory.')
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    if args.input.is_dir():
        for source in sorted(args.input.glob('*.tex')):
            extract(source, args.output/source.stem)
    else:
        extract(args.input, args.output)
