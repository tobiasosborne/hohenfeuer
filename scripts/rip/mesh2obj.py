# Owns validated 7DO/6DO geometry decoding and textured OBJ/MTL plus JSON export.
import argparse
from collections import Counter
from functools import lru_cache
import json
import math
import os
from pathlib import Path
import struct


def check(ok, message):
    if not ok:
        raise ValueError(message)


def floats(data, width):
    check(len(data) % (4*width) == 0, 'Misaligned float array')
    values = list(struct.iter_unpack('<'+'f'*width, data))
    check(all(math.isfinite(x) for row in values for x in row), 'Non-finite geometry')
    return values


def parse7(data):
    check(len(data) >= 12, 'Truncated 7DO')
    count = struct.unpack_from('<I', data)[0]
    pos, parts, textures, chunks, part = 4, [], [], [], {}
    while pos < len(data):
        check(pos+8 <= len(data), 'Truncated 7DO chunk')
        tag, size = struct.unpack_from('<2I', data, pos)
        check(pos+8+size <= len(data), 'Invalid 7DO chunk extent')
        raw = data[pos+8:pos+8+size]
        chunks.append(dict(offset=pos, tag=tag, size=size))
        pos += 8+((size+3)&~3)
        if tag == 8:
            check(size % 4 == 0 and not textures, 'Invalid material table')
            textures = list(struct.unpack('<'+'I'*(size//4), raw))
        elif tag == 9:
            part['bounds_min_extent'] = floats(raw, 3)
        elif tag == 2:
            part['vertices'] = floats(raw, 3)
        elif tag == 4:
            part['normals'] = floats(raw, 3)
        elif tag == 3:
            part['uv'] = floats(raw, 2)
        elif tag == 22:
            part['environment_vectors'] = floats(raw, 3)
        elif tag == 16:
            check(size == 0, 'Unexpected untextured chunk payload')
            part['untextured'] = True
        elif tag == 15:
            check(size == 4, 'Invalid color chunk')
            part['color_bgra'] = struct.unpack('<I', raw)[0]
        elif tag == 23:
            part['unknown_23_hex'] = raw.hex()
        elif tag == 6:
            check(size % 3 == 0, 'Invalid triangle list')
            part['faces'] = list(struct.iter_unpack('<3B', raw))
        elif tag == 7:
            check(size % 2 == 0, 'Invalid material runs')
            part['material_runs'] = list(struct.iter_unpack('<2B', raw))
        elif tag == 10:
            check(size == 0, 'Invalid part terminator')
            vertices, normals, faces = part['vertices'], part['normals'], part['faces']
            check(len(vertices) == len(normals) and len(vertices) <= 256, 'Vertex/normal count mismatch')
            check(all(max(face) < len(vertices) for face in faces), 'Triangle index outside vertex array')
            if 'uv' in part:
                check(len(part['uv']) == len(vertices), 'UV count mismatch')
            face_materials = []
            for material, number in part['material_runs']:
                check(material < len(textures), 'Material index outside texture table')
                face_materials.extend([textures[material]]*number)
            check(len(face_materials) == len(faces), 'Material runs do not cover triangles')
            part['face_materials'] = face_materials
            part['index'] = len(parts)
            parts.append(part)
            part = {}
        elif tag == 0xffffffff:
            check(size == 0 and pos == len(data), 'Invalid 7DO end marker')
        else:
            raise ValueError(f'Unknown 7DO chunk: {tag}')
    check(not part and len(parts) == count, '7DO part count mismatch')
    return dict(format='7DO', parts=parts, texture_ids=textures, chunks=chunks,
                hierarchy=None, animation=None, native_axes='X horizontal, Y down, Z horizontal')


def triangulate_strip(count, start=0):
    return [(start+i, start+i+1, start+i+2) if i % 2 == 0 else
            (start+i+1, start+i, start+i+2) for i in range(count-2)]


def parse6(data):
    pos, chunks, payloads = 0, [], {}
    while pos < len(data)-4:
        check(pos+8 <= len(data), 'Truncated 6DO chunk')
        tag, size = struct.unpack_from('<2I', data, pos)
        check(size >= 4 and pos+4+size <= len(data), 'Invalid 6DO extent')
        check(tag not in payloads, 'Duplicate 6DO chunk')
        payloads[tag] = data[pos+8:pos+4+size]
        chunks.append(dict(offset=pos, tag=tag, size_including_size_word=size))
        pos += 4+size
    check(data[pos:] == b'\x11\x11\x11\x81', 'Invalid 6DO end marker')
    check(payloads[0x80000001][:3] == b'6do', 'Missing 6DO magic')

    def soa(raw):
        check(len(raw) % 48 == 0, 'Invalid 6DO SIMD vertex array')
        out = []
        for row in floats(raw, 12):
            out.extend(zip(row[0:4], row[4:8], row[8:12]))
        return out

    vertices = soa(payloads[0x80000002])
    normals = soa(payloads[0x80000003])
    raw_ids = payloads[0x80000009]
    check(len(raw_ids) % 4 == 0, 'Invalid 6DO texture IDs')
    textures = list(struct.unpack('<'+'i'*(len(raw_ids)//4), raw_ids))
    check(textures[-1] == -1, 'Missing 6DO texture sentinel')
    textures.pop()
    polygons, controls, bsp_nodes = [], [], []

    def polygon(raw, base, index_width, storage):
        flags, pointer = struct.unpack_from('<II', raw)
        count = (flags >> 24) & 7
        check(flags & 255 == 4 and 3 <= count <= 7, 'Invalid 6DO polygon command')
        indices = list(struct.unpack_from('<'+('H' if index_width == 2 else 'I')*count, raw, 8))
        indices = [i+base for i in indices]
        check(max(indices) < len(vertices), '6DO polygon index out of range')
        uv_start = 8+((count*index_width+3)&~3)
        textured = bool((flags >> 8) & 2)
        uvs = floats(raw[uv_start:uv_start+count*8], 2) if textured else []
        check(not textured or len(uvs) == count, 'Truncated 6DO polygon UVs')
        tid = (flags >> 16) & 255
        check(not textured or tid < len(textures), '6DO texture index out of range')
        used = uv_start+(count*8 if textured else 0)
        polygons.append(dict(indices=indices, uv=uvs, texture_id=textures[tid] if textured else 0,
                             flags=flags, saved_pointer=pointer, storage=storage,
                             trailing_hex=raw[used:].hex()))
        return pointer

    stream = payloads[0x80000005]
    cursor, base, previous_max = 0, 0, None
    while cursor < len(stream):
        size = stream[cursor]
        raw = stream[cursor+1:cursor+1+size]
        check(len(raw) == size, 'Truncated 6DO command')
        cursor += size+1
        if size == 8:
            opcode, maximum, pointer = struct.unpack('<HHI', raw)
            check(opcode == 120, 'Unknown 6DO control command')
            if previous_max is not None:
                base += (previous_max+4)&~3
            previous_max = maximum & 255
            controls.append(dict(base=base, maximum_index=maximum & 255,
                                 control_flags=maximum >> 8, saved_pointer=pointer))
        else:
            polygon(raw, base, 2, 'command_stream')

    stream = payloads[0x80000006]
    cursor = 0

    def node(depth=0):
        nonlocal cursor
        check(depth < 256 and cursor+44 <= len(stream), 'Invalid 6DO BSP tree')
        raw = stream[cursor:cursor+44]
        left, right = struct.unpack_from('<II', raw)
        head = struct.unpack_from('<I', raw, 40)[0]
        index = len(bsp_nodes)
        info = dict(index=index, offset=cursor, saved_left=left, saved_right=right,
                    plane_and_bounds=floats(raw[8:40], 4), saved_polygon_head=head,
                    left=None, right=None, polygon_indices=[])
        bsp_nodes.append(info)
        cursor += 44
        if head:
            while True:
                check(cursor < len(stream), 'Truncated BSP polygon list')
                size = stream[cursor]
                raw = stream[cursor+1:cursor+1+size]
                check(len(raw) == size, 'Truncated BSP polygon')
                cursor += size+1
                info['polygon_indices'].append(len(polygons))
                if polygon(raw, 0, 4, 'bsp') == 0:
                    break
        if left:
            info['left'] = node(depth+1)
        if right:
            info['right'] = node(depth+1)
        return index

    if stream:
        node()
        check(cursor == len(stream), 'Unexplained BSP trailing bytes')
    part = dict(index=0, vertices=[], normals=[], uv=[], faces=[], face_materials=[])
    for poly in polygons:
        points = [vertices[i] for i in poly['indices']]
        u = [points[1][i]-points[0][i] for i in range(3)]
        v = [points[2][i]-points[0][i] for i in range(3)]
        normal = [v[1]*u[2]-v[2]*u[1], v[2]*u[0]-v[0]*u[2], v[0]*u[1]-v[1]*u[0]]
        length = math.sqrt(sum(x*x for x in normal)) or 1
        normal = [x/length for x in normal]
        start = len(part['vertices'])
        part['vertices'].extend(points)
        part['uv'].extend(poly['uv'] or [(0,0)]*len(points))
        part['normals'].extend([normals[i] if normals else normal for i in poly['indices']])
        for face in triangulate_strip(len(points),start):
            part['faces'].append(face)
            part['face_materials'].append(poly['texture_id'])
    return dict(format='6DO', parts=[part], texture_ids=textures, chunks=chunks,
                polygons=polygons, native_vertices=vertices, native_normals=normals,
                vertex_groups=controls, bsp_nodes=bsp_nodes, hierarchy=None, animation=None,
                header_hex=payloads[0x80000001].hex(),
                auxiliary_chunks_hex={str(t):r.hex() for t,r in payloads.items()
                                      if t & 0xffff in (4,7,8,10)},
                native_axes='X horizontal, Y down, Z horizontal',
                undecoded=['Serialized header fields and pointer values',
                           'Extra BSP polygon fields'] if bsp_nodes else ['Serialized header fields and pointer values'])


@lru_cache(maxsize=8)
def extra_images(texture_root):
    root = texture_root.parent/'images'
    return {str(p.relative_to(root)).casefold():p for p in root.rglob('*.png')}


def texture_path(tid, source, texture_root, theme):
    # IDs verified in the executable's static texture table and loader.
    extra = {102:'Images/Special/Eiszapfen.png', 105:'Images/Special/blitz_tex.png',
             107:'Images/Special/SchildTreffer2.png',108:'Images/Special/SchildTreffer1.png',
             121:'Images/PartikelTextures/ExploStreak.png',123:'Images/PartikelTextures/StreakExplo.png',
             1599:'Images/Special/Beleuchtung.png'}
    if tid in extra:
        return extra_images(texture_root).get(extra[tid].casefold())
    if 500 <= tid <= 550:
        pack = 'Waffen'
    elif 1500 <= tid <= 1558:
        pack = 'GebaeudeSet_'+theme
    elif 1980 <= tid <= 1989:
        pack = 'BodenSet_'+theme
    elif 1950 <= tid <= 1952:
        pack = 'Wolken'
    elif 1960 <= tid <= 1963:
        pack = source.stem
    elif tid == 1970:
        pack = 'Schatten'
    else:
        return None
    candidate = texture_root/pack/f'{tid}.png'
    return candidate if candidate.exists() else None


def export(source, output, texture_root, theme='Grass', include_effects=False):
    data = source.read_bytes()
    mesh = parse7(data) if source.suffix.lower() == '.7do' else parse6(data)
    mesh['source'] = str(source)
    mesh['obj_transform'] = 'position/normal (x,y,z) -> (x,-y,z); UV (u,v) -> (u,1-v); source triangle winding retained'
    mesh['theme'] = theme
    texture_ids = sorted(set(t for p in mesh['parts'] for t in p['face_materials']))
    mesh['textures'] = {str(t): str(texture_path(t, source, texture_root, theme) or '') for t in texture_ids}
    output.mkdir(parents=True, exist_ok=True)
    stem = source.stem
    obj, mtl = [f'# Reference rip of {source.name}', f'mtllib {stem}.mtl'], ['# Reference materials']
    for tid in texture_ids:
        mtl.extend([f'newmtl texture_{tid}', 'Ka 0 0 0', 'Kd 1 1 1', 'Ks 0 0 0', 'illum 1'])
        texture = mesh['textures'][str(tid)]
        if texture:
            mtl.append('map_Kd '+os.path.relpath(Path(texture).resolve(), output.resolve()))
    def triangle_key(part, face):
        return tuple(sorted(tuple(round(x,5) for x in part['vertices'][i]) for i in face))
    base_triangles = {triangle_key(p,f) for p in mesh['parts']
                      if 'environment_vectors' not in p for f in p['faces']}
    vi, ui, ni, exported_triangles = 1, 1, 1, 0
    for p in mesh['parts']:
        selected = list(range(len(p['faces'])))
        # Most type-22 faces repeat the diffuse surface. A few crystals have only
        # this pass: retain their geometry and original direction vectors in JSON.
        if 'environment_vectors' in p and not include_effects:
            selected = [i for i,f in enumerate(p['faces']) if triangle_key(p,f) not in base_triangles]
            p['obj_face_indices'] = selected
            p['obj_note'] = 'Only duplicate reflection triangles omitted; unique surfaces retained without fabricated UVs'
            if not selected:
                continue
        obj.append(f'o part_{p["index"]}')
        for x,y,z in p['vertices']:
            obj.append(f'v {x:.9g} {-y:.9g} {z:.9g}')
        for u,v in p.get('uv', []):
            obj.append(f'vt {u:.9g} {1-v:.9g}')
        for x,y,z in p.get('normals', []):
            obj.append(f'vn {x:.9g} {-y:.9g} {z:.9g}')
        previous = None
        for face_index in selected:
            face,tid = p['faces'][face_index],p['face_materials'][face_index]
            if tid != previous:
                obj.append(f'usemtl texture_{tid}')
                previous = tid
            refs = []
            for index in face:
                if p.get('uv') and p.get('normals'):
                    refs.append(f'{vi+index}/{ui+index}/{ni+index}')
                elif p.get('uv'):
                    refs.append(f'{vi+index}/{ui+index}')
                elif p.get('normals'):
                    refs.append(f'{vi+index}//{ni+index}')
                else:
                    refs.append(str(vi+index))
            obj.append('f '+' '.join(refs))
        exported_triangles += len(selected)
        vi += len(p['vertices'])
        ui += len(p.get('uv', []))
        ni += len(p.get('normals', []))
    mesh['source_triangles'] = sum(len(p['faces']) for p in mesh['parts'])
    mesh['exported_triangles'] = exported_triangles
    (output/(stem+'.obj')).write_text('\n'.join(obj)+'\n')
    (output/(stem+'.mtl')).write_text('\n'.join(mtl)+'\n')
    (output/(stem+'.json')).write_text(json.dumps(mesh, separators=(',', ':'), allow_nan=False)+'\n')
    return dict(source=str(source), obj=str(output/(stem+'.obj')), format=mesh['format'],
                vertices=sum(len(p['vertices']) for p in mesh['parts']),
                parts=len(mesh['parts']), source_triangles=mesh['source_triangles'],
                triangles=exported_triangles, textures=mesh['textures'],
                undecoded=mesh.get('undecoded', []))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Export decoded Ballerburg meshes to OBJ/MTL and lossless geometry JSON.')
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--textures', type=Path, default=Path('assets-ripped/textures'))
    parser.add_argument('--theme', choices=['Grass','Wueste','Schnee','Vulkan','Alien'], default='Grass')
    parser.add_argument('--include-effects', action='store_true')
    parser.add_argument('--only', choices=['7do','6do'])
    args = parser.parse_args()
    files = sorted(p for p in args.input.rglob('*') if p.suffix.lower() in ('.7do','.6do')) if args.input.is_dir() else [args.input]
    if args.only:
        files = [p for p in files if p.suffix.lower() == '.'+args.only]
    inventory = []
    for source in files:
        destination = args.output/source.relative_to(args.input).parent if args.input.is_dir() else args.output
        try:
            inventory.append(export(source, destination, args.textures, args.theme, args.include_effects))
        except (ValueError, KeyError, struct.error) as exc:
            raise ValueError(f'{source}: {exc}') from exc
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output/'inventory.json').write_text(json.dumps(inventory, indent=2)+'\n')
    print(f'Exported {len(inventory)} meshes; {sum(p["triangles"] for p in inventory):,} triangles')
