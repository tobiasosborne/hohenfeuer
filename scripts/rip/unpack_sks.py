# Owns extraction and validation of SK10 JPEG animation frame containers.
import argparse
import io
import json
from pathlib import Path
import struct
from PIL import Image


def extract(source, output):
    data = source.read_bytes()
    if len(data) < 40 or data[:4] != b'SK10':
        raise ValueError('Not an SK10 container')
    width, height, count, rate, a, b, c = struct.unpack_from('<7I', data, 4)
    if not 0 < count <= (len(data)-40)//8:
        raise ValueError('Invalid frame count')
    records = [struct.unpack_from('<2I', data, 32+i*8) for i in range(count)]
    trailer = struct.unpack_from('<2I', data, 32+count*8)
    if records[0][0] != 40+count*8 or trailer[0] != len(data):
        raise ValueError('Invalid SK10 table bounds')
    output.mkdir(parents=True, exist_ok=True)
    for i, (offset, length) in enumerate(records):
        end = records[i+1][0] if i+1<count else trailer[0]
        if offset+length != end:
            raise ValueError('Non-contiguous SK10 frame')
        raw = data[offset:end]
        with Image.open(io.BytesIO(raw)) as image:
            image.load()
            if image.format != 'JPEG' or image.size != (width,height):
                raise ValueError('SK10 image disagrees with header')
        (output/f'{i:04d}.jpg').write_bytes(raw)
    meta = dict(source=str(source), width=width, height=height, frames=count,
                rate_unconfirmed=rate, reserved=[a,b,c], trailing_word=trailer[1], records=records)
    (output/'manifest.json').write_text(json.dumps(meta, indent=2)+'\n')
    return meta


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Unpack one SKS or a tree of SKS files.')
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    files = sorted(args.input.rglob('*.sks')) if args.input.is_dir() else [args.input]
    for source in files:
        dest = args.output/source.relative_to(args.input).with_suffix('') if args.input.is_dir() else args.output
        extract(source, dest)
    print(f'Extracted {len(files)} SK10 containers')
