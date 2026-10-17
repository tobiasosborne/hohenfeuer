# Owns castle layouts, terrain planes, strings and read-only executable data-table extraction.
import argparse
import csv
import hashlib
import json
from pathlib import Path
import struct
from PIL import Image, ImageDraw

EXE_SHA256 = '1856b61fb8654aaefcc3f8e2b16918999e9f3fc325b08ad761dd0079dac01c9a'


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, allow_nan=False)+'\n')


def decode(root, output, executable):
    output.mkdir(parents=True, exist_ok=True)
    strings = {}
    for name in ['ml_phrasen', 'ml_tooltips']:
        raw = (root/'Data'/(name+'.dat')).read_bytes()
        values = []
        offset = 0
        for segment in raw.split(b'\0'):
            if offset >= len(raw):
                break
            values.append(dict(offset=offset, text=segment.decode('cp1252')))
            offset += len(segment)+1
        strings[name] = values
        write_json(output/(name+'.json'), values)
        (output/(name+'.txt')).write_text(raw.decode('cp1252').replace('\0','\n'))
        pointer_name = 'ml_phrasenpointer' if name == 'ml_phrasen' else 'ml_tooltipspointer'
        pointers = (root/'Data'/(pointer_name+'.dat')).read_bytes()
        assert len(pointers) % 4 == 0
        values_by_offset = {v['offset']:v['text'] for v in values}
        offsets = list(struct.unpack('<'+'I'*(len(pointers)//4), pointers))
        assert all(p in values_by_offset for p in offsets)
        write_json(output/(pointer_name+'.json'),
                   [dict(id=i, offset=p, text=values_by_offset[p]) for i,p in enumerate(offsets)])
    labels = [v['text'] for v in strings['ml_phrasen'][8:72]]
    sine_raw=(root/'Data/sinelist.dat').read_bytes()
    assert len(sine_raw)==8192
    write_json(output/'sinelist.json',dict(format='int16 little endian, 4096 samples, amplitude 4096',
                                         values=list(struct.unpack('<4096h',sine_raw))))
    shading=[]
    for source in sorted((root/'Data').glob('Shading*.dat')):
        rows=[[int(n) for n in line.split()] for line in source.read_text().splitlines() if line.strip()]
        assert len(rows)==9 and all(len(row)==32 for row in rows)
        shading.append(dict(source=str(source),rows=rows))
    write_json(output/'shading.json',shading)
    for source in sorted((root/'Particles').rglob('*.pda')):
        lines=source.read_text().splitlines()
        assert lines[0]=='ATTRIBUTES' and lines[2]=='TYPES' and lines[5]=='BEGIN DATA'
        attrs=lines[1].split();types=lines[3].split();count=int(lines[4].split(':')[1])
        records=[[float(v) for v in line.split()] for line in lines[6:] if line.strip()]
        assert len(records)==count and all(len(row)==len(attrs)+2 for row in records)
        write_json(output/'particles'/source.relative_to(root/'Particles').with_suffix('.json'),
                   dict(source=str(source),attributes=attrs,types=types,particles=records))
    raw=(root/'Images/Special/Plateauerhellung.raw').read_bytes()
    assert len(raw)==144
    Image.frombytes('L',(12,12),raw).save(output/'plateau-illumination-12x12.png')
    layouts = []
    for source in sorted((root/'Data/Plateaus').glob('plateau.*'), key=lambda p:int(p.suffix[1:])):
        raw = source.read_bytes()
        assert len(raw) % 4 == 0
        words = list(struct.unpack('<'+'I'*(len(raw)//4), raw))
        assert words[-1] == 0xffffffff
        records = []
        for i, word in enumerate(words[:-1]):
            if word == 0xfffffffe:
                records.append(dict(index=i, raw_hex=f'{word:08x}', deleted=True))
                continue
            kind = (word >> 16)&63
            records.append(dict(index=i, raw_hex=f'{word:08x}', type_id=kind,
                                label=labels[kind], grid_x=(word>>10)&31,
                                grid_z=(word>>4)&31, orientation=word&3,
                                unused_bits=word & ~0x3f7df3))
        meta = dict(source=str(source), id=int(source.suffix[1:]), placements=records)
        write_json(output/'layouts'/(source.name+'.json'), meta)
        image = Image.new('RGB',(512,544),'#f0ebe2')
        draw = ImageDraw.Draw(image)
        draw.text((8,8),source.name+' | packed grid coordinates',fill='black')
        for r in records:
            if r.get('deleted'):
                continue
            x,z=r['grid_x']*16,r['grid_z']*16+32
            color='#785a3d' if r['type_id']<16 else '#437e70' if r['type_id']<34 else '#a34a39'
            draw.rectangle((x,z,x+13,z+13),fill=color)
        (output/'layouts').mkdir(parents=True,exist_ok=True)
        image.save(output/'layouts'/(source.name+'.png'))
        layouts.append(dict(id=meta['id'], placements=len(records)))
    scenarios = []
    for source in sorted((root/'Data/Kampagne').glob('*.odn')):
        raw=source.read_bytes()
        assert len(raw) in (292,324)
        meta=dict(source=str(source), size=len(raw), level_id=raw[0], theme_id=raw[1],
                  slot_bytes_2_17=[list(raw[i:i+4]) for i in (2,6,10,14)],
                  starting_gold=list(struct.unpack_from('<4I',raw,20)),
                  plateau_ids=list(raw[172:176]), raw_hex=raw.hex(),
                  unknown='Slot byte-array semantics and remaining fields are not fully assigned.')
        write_json(output/'scenarios'/(source.stem+'.json'),meta)
        scenarios.append(meta)
    levels=[]
    for source in sorted((root/'Level').glob('*.pln')):
        raw=source.read_bytes()
        assert len(raw)==65540 and struct.unpack_from('<I',raw)[0]==16384
        heights=list(struct.unpack_from('<16384h',raw,4))
        tile_words=list(struct.unpack_from('<16384H',raw,32772))
        target=output/'levels'/source.stem
        target.mkdir(parents=True,exist_ok=True)
        meta=dict(source=str(source),width=128,height=128,height_int16=heights,
                  tile_words=tile_words, tile_index=[v&255 for v in tile_words],
                  uv_transform_index=[v>>8 for v in tile_words],
                  note='Game negates stored heights; final row/column of tile plane may contain 0xCDCD debug padding.')
        write_json(target/'terrain.json',meta)
        Image.frombytes('I;16',(128,128),raw[4:32772]).save(target/'height-raw.png')
        low,high=min(heights),max(heights)
        Image.frombytes('L',(128,128),bytes(round((v-low)*255/(high-low or 1)) for v in heights)).save(target/'height-preview.png')
        for ext,size,mode in [('alp',(128,128),'L'),('hmm',(64,64),'L'),('him',(8,256),'RGB')]:
            payload=source.with_suffix('.'+ext).read_bytes()
            Image.frombytes(mode,size,payload).save(target/(ext+'-preview.png'))
        tree_data=source.with_suffix('.tre').read_bytes()
        assert len(tree_data)==12288
        tree_layers=[list(tree_data[i*4096:(i+1)*4096]) for i in range(3)]
        write_json(target/'tree-density.json',dict(width=64,height=64,layers=tree_layers,
                   note='Three planar uint8 probability weights; tree positions are sampled at runtime, not serialized meshes.'))
        for i,layer in enumerate(tree_layers):
            Image.frombytes('L',(64,64),bytes(layer)).save(target/f'tree-density-{i+1}.png')
        levels.append(dict(level=source.stem,height_min=low,height_max=high))
    exe=executable.read_bytes()
    digest=hashlib.sha256(exe).hexdigest()
    if digest!=EXE_SHA256:
        raise ValueError('Executable tables are only verified for the supplied 2002 English build; SHA256 differs')
    def table(address,fmt,count):
        return list(struct.unpack_from('<'+fmt*count,exe,address-0x400000))
    costs=table(0x5347e0,'h',54)
    build_times=table(0x5348e8,'h',34)
    defence=table(0x5349c4,'B',34)
    footprint=table(0x535cd8,'b',54)
    reloads=table(0x534a0c,'B',20)
    shot_costs=table(0x534860,'h',20)
    powder=table(0x534a54,'B',20)
    entities=[]
    for i in range(54):
        row=dict(type_id=i,name=labels[i],build_cost=costs[i],footprint=footprint[i])
        if i<34:
            row.update(build_time_seconds=build_times[i],defence_points=defence[i])
        else:
            row.update(reload_seconds=reloads[i-34],base_shot_cost=shot_costs[i-34],
                       shot_cost_without_workshop=shot_costs[i-34]*15//10,
                       powder_coefficient=powder[i-34])
        entities.append(row)
    texture_paths={}
    for i,pointer in enumerate(table(0x51ce30,'I',60)):
        pos=pointer-0x400000
        if 0<=pos<len(exe):
            end=exe.find(b'\0',pos)
            name=exe[pos:end].decode('cp1252')
            if name.lower().startswith('images/'):
                texture_paths[str(100+i)]=name
    texture_paths['1599']='Images/Special/Beleuchtung.bmp'
    tables=dict(source=str(executable),sha256=digest,entities=entities,texture_paths=texture_paths,
                addresses=dict(build_cost='0x5347e0: int16[54]',build_time='0x5348e8: int16[34]',
                defence='0x5349c4: uint8[34]',footprint='0x535cd8: int8[54]',
                reload='0x534a0c: uint8[20]',base_shot_cost='0x534860: int16[20]',
                powder_coefficient='0x534a54: uint8[20]'),
                notes=['Rows with a dash name are unused/reserved, not confirmed usable weapons.',
                       'Base shot costs match the ammo-workshop price; HUD applies integer *15/10 when absent.',
                       'Powder-dependent additions, upgrades and mode modifiers can change displayed costs.',
                       'Reload table is shifted left by four by the game; nominal seconds agree with the manual.'])
    write_json(output/'gameplay.json',tables)
    write_json(output/'inventory.json',dict(layouts=layouts,scenarios=scenarios,levels=levels))
    print(f'Decoded {len(layouts)} layouts, {len(scenarios)} scenarios, {len(levels)} terrain sets and 54 entity rows')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input',type=Path)
    parser.add_argument('output',type=Path)
    parser.add_argument('--exe',type=Path,default=Path('downloads/en-iso/iso/Ballerburg.exe'))
    args=parser.parse_args()
    decode(args.input,args.output,args.exe)
