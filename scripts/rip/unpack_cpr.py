# Owns safe extraction of ASCARON_ARCHIVE V0.9 and its chunked LZ payloads.
"""Independent format implementation; never loads or executes original game code."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path, PurePosixPath
import struct

LIMIT = 512 * 1024 * 1024


def require(ok, message):
    if not ok:
        raise ValueError(message)


def safe_path(root, name):
    name = name.replace('\\', '/')
    path = PurePosixPath(name)
    require(not path.is_absolute() and ':' not in name and
            '..' not in path.parts and bool(path.parts), f'Unsafe archive path: {name!r}')
    root = root.resolve()
    dest = root.joinpath(*path.parts)
    require(dest.resolve().is_relative_to(root), f'Escaping symlink: {dest}')
    return dest


def decode_packet(data):
    require(len(data) >= 12, 'Truncated compressed packet header')
    size, flags, table = struct.unpack_from('<3I', data)
    require(0 < size <= LIMIT, 'Invalid packet output length')
    if flags & 0x80000000:
        require(len(data) >= 12 + size, 'Truncated stored packet')
        return bytes(x ^ (0x35 if flags & 0x40000000 else 0) for x in data[12:12+size])
    require(flags == 1, f'Unsupported LZ method: {flags:#x}')
    widths, bases, width, base = [], [], 0, 0
    for i in range(8):
        width += (table >> (4*i)) & 15
        require(0 < width <= 24, 'Invalid LZ distance widths')
        widths.append(width)
        bases.append(base)
        base += 1 << width
    bits, count, pos = 0, 0, 12

    def read(n):
        nonlocal bits, count, pos
        while count < n:
            require(pos < len(data), 'Truncated LZ bitstream')
            bits |= data[pos] << count
            count += 8
            pos += 1
        value = bits & ((1 << n)-1)
        bits >>= n
        count -= n
        return value

    out = bytearray()
    while len(out) < size:
        if read(1) == 0:
            out.append(read(8))
            continue
        group = read(3)
        distance = 1 + bases[group] + read(widths[group])
        length, width = 2, 2
        while True:
            require(width <= 24, 'Unbounded LZ match length')
            extra = read(width)
            length += extra
            if extra != (1 << width)-1:
                break
            width += 1
        require(distance <= len(out), 'LZ match before start of packet')
        require(len(out) + length <= size, 'LZ match exceeds packet output')
        # Repetition handles overlapping matches without a byte-at-a-time loop.
        pattern = out[-distance:]
        out.extend((pattern * ((length + distance - 1)//distance))[:length])
    return bytes(out)


def decode_member(data):
    require(len(data) >= 4, 'Truncated compressed member')
    total = struct.unpack_from('<I', data)[0]
    require(total <= LIMIT, 'Member exceeds output limit')
    out, pos = bytearray(), 4
    while pos < len(data):
        require(pos + 4 <= len(data), 'Truncated packet size')
        size = struct.unpack_from('<I', data, pos)[0]
        pos += 4
        require(size >= 12 and pos + size <= len(data), 'Invalid packet span')
        out.extend(decode_packet(data[pos:pos+size]))
        require(len(out) <= total, 'Member output exceeds declared size')
        pos += size
    require(len(out) == total, 'Member decoded length mismatch')
    return bytes(out)


def read_index(data):
    require(data[:32] == b'ASCARON_ARCHIVE V0.9'.ljust(32, b'\0'), 'Not CPR V0.9')
    pos, entries, directories = 32, [], []
    names = set()
    while pos < len(data):
        require(pos + 16 <= len(data), 'Truncated CPR directory')
        allocated, used, count, skip = struct.unpack_from('<4I', data, pos)
        require(16 <= used <= allocated and pos + allocated + skip <= len(data),
                'Invalid CPR directory extent')
        require(count <= (used-16)//13, 'Invalid CPR directory count')
        directories.append(dict(offset=pos, allocated=allocated, used=used, count=count, skip=skip))
        cursor = pos+16
        for _ in range(count):
            require(cursor+13 <= pos+used, 'Truncated CPR entry')
            offset, size, flag = struct.unpack_from('<3I', data, cursor)
            end = data.find(b'\0', cursor+12, pos+used)
            require(end >= 0, 'Missing CPR filename terminator')
            name = data[cursor+12:end].decode('cp1252').replace('\\', '/')
            require(name not in names, f'Duplicate CPR name: {name}')
            require(flag in (1, 2) and offset+size <= len(data), 'Invalid CPR payload')
            names.add(name)
            entries.append(dict(name=name, offset=offset, stored_size=size, flag=flag))
            cursor = end+1
        require(cursor == pos+used, 'CPR directory has unexplained bytes')
        pos += allocated+skip
    return entries, directories


def extract(source, output):
    data = source.read_bytes()
    entries, directories = read_index(data)
    output.mkdir(parents=True, exist_ok=True)
    for i, entry in enumerate(entries):
        target = safe_path(output, entry['name'])
        raw = data[entry['offset']:entry['offset']+entry['stored_size']]
        decoded = decode_member(raw) if entry['flag'] == 2 else raw
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists() or target.read_bytes() != decoded:
            target.write_bytes(decoded)
        entry.update(size=len(decoded), sha256=hashlib.sha256(decoded).hexdigest())
        if (i+1) % 200 == 0:
            print(f'{i+1}/{len(entries)} members', flush=True)
    manifest = dict(source=str(source), sha256=hashlib.sha256(data).hexdigest(),
                    directories=directories, entries=entries)
    (output/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    print(f'Extracted {len(entries)} members ({sum(e["size"] for e in entries):,} bytes) to {output}')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    extract(args.input, args.output)
