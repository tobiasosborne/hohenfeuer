# Owns data-only parsing of this CD's Inno Setup 2.0.18 installers; never executes them.
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import struct
import zlib


def extract(source,output):
    # Load only our sibling parser, so python -I works without a working-directory import.
    spec=importlib.util.spec_from_file_location('unpack_cpr',Path(__file__).with_name('unpack_cpr.py'))
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    data=source.read_bytes()
    marker=b'Inno Setup Setup Data (2.0.18)'
    start=data.rfind(marker)
    if start<0:
        raise ValueError('Only observed Inno 2.0.18 is supported')
    header=start+64
    crc,stored_size,raw_size=struct.unpack_from('<3I',data,header)
    if zlib.crc32(data[header+4:header+12])!=crc:
        raise ValueError('Inno metadata header checksum mismatch')
    pos,remaining=header+12,stored_size
    compressed=bytearray()
    while remaining:
        expected=struct.unpack_from('<I',data,pos)[0]
        pos+=4
        block=data[pos:pos+min(4096,remaining)]
        if zlib.crc32(block)!=expected:
            raise ValueError('Inno metadata block checksum mismatch')
        compressed.extend(block)
        pos+=len(block)
        remaining-=len(block)
    metadata=zlib.decompress(compressed)
    if len(metadata)!=raw_size:
        raise ValueError('Inno metadata decoded length mismatch')
    names={}
    for match in re.finditer(rb'\{app\}[^\x00-\x1f]{1,200}',metadata):
        length=struct.unpack_from('<I',metadata,match.start()-4)[0]
        tail=metadata[match.end():match.end()+48]
        if length!=len(match.group()) or len(tail)!=48:
            continue
        if tail[:15]==bytes(15) and tail[15:23]==struct.pack('<II',4,5) and tail[44]==2:
            index=struct.unpack_from('<I',tail,32)[0]
            if index!=0xffffffff:
                names[index]=match.group().decode('cp1252')[6:].replace('\\','/')
    members=list(re.finditer(b'zlb\x1a',data[:start]))
    if set(names)!=set(range(1,len(members))):
        raise ValueError('Inno filename ordinal mapping incomplete; refusing guesses')
    entries=[]
    output.mkdir(parents=True,exist_ok=True)
    for i,match in enumerate(members):
        end=members[i+1].start() if i+1<len(members) else start
        dec=zlib.decompressobj()
        raw=dec.decompress(data[match.end():end],512*1024*1024)
        if not dec.eof:
            raise ValueError('Truncated/oversized Inno file stream')
        name=names.get(i,'_unnamed/member_0000.bin')
        target=module.safe_path(output,name)
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_bytes(raw)
        entries.append(dict(name=name,offset=match.start(),size=len(raw),sha256=hashlib.sha256(raw).hexdigest(),
                            executable_data_only=raw[:2]==b'MZ'))
    (output/'manifest.json').write_text(json.dumps(dict(source=str(source),entries=entries),indent=2)+'\n')
    print(f'Parsed {len(entries)} installer members as data; preserved 242 internal names')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input',type=Path)
    parser.add_argument('output',type=Path)
    args=parser.parse_args()
    extract(args.input,args.output)
