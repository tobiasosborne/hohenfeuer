# Owns lossless PNG conversion of unpacked BMP, TGA and JPEG reference images.
import argparse
import json
from pathlib import Path
from PIL import Image


def convert(source, target):
    with Image.open(source) as image:
        image.load()
        info = dict(source=str(source), output=str(target), format=image.format,
                    size=list(image.size), mode=image.mode)
        target.parent.mkdir(parents=True, exist_ok=True)
        image.save(target, 'PNG')
        return info


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Convert a file or unpacked image tree to PNG; preserves relative paths.')
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    if args.input.is_file():
        print(json.dumps(convert(args.input, args.output)))
    else:
        files = sorted(p for p in args.input.rglob('*') if p.suffix.lower() in ('.bmp', '.tga', '.jpg', '.jpeg'))
        manifest = [convert(p, args.output/p.relative_to(args.input).with_suffix('.png')) for p in files]
        args.output.mkdir(parents=True, exist_ok=True)
        (args.output/'images.json').write_text(json.dumps(manifest, indent=2)+'\n')
        print(f'Converted {len(manifest)} images to {args.output}')
