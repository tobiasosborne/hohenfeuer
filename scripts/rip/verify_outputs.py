# Owns corpus verification, output inventory and visual-review contact sheets.
import argparse
from collections import Counter
import hashlib
import json
import os
from pathlib import Path
from PIL import Image,ImageDraw


def verify(root):
    main=json.loads((root/'Main/manifest.json').read_text())
    for entry in main['entries']:
        raw=(root/'Main'/entry['name']).read_bytes()
        assert len(raw)==entry['size'] and hashlib.sha256(raw).hexdigest()==entry['sha256'],entry['name']
    inventory=json.loads((root/'meshes/inventory.json').read_text())
    missing=Counter()
    zero=[]
    for entry in inventory:
        path=Path(entry['obj'])
        obj=path.read_text().splitlines()
        faces=[line for line in obj if line.startswith('f ')]
        assert len(faces)==entry['triangles'],str(path)
        v=sum(line.startswith('v ') for line in obj)
        vt=sum(line.startswith('vt ') for line in obj)
        vn=sum(line.startswith('vn ') for line in obj)
        for face in faces:
            for ref in face.split()[1:]:
                values=ref.split('/')
                assert 1<=int(values[0])<=v
                if len(values)>1 and values[1]:assert 1<=int(values[1])<=vt
                if len(values)>2 and values[2]:assert 1<=int(values[2])<=vn
        if not faces:zero.append(str(path))
        missing.update(k for k,value in entry['textures'].items() if not value)
    assert len(inventory)==615 and not zero,(len(inventory),zero)
    source_types=Counter(Path(e['name']).suffix.lower() if '/Plateaus/' not in e['name'] else '.plateau' for e in main['entries'])
    meshes_by_category=Counter(Path(e['source']).parent.name for e in inventory)
    texture_manifests=[json.loads(p.read_text()) for p in (root/'tex').glob('*/manifest.json')]
    sks_manifests=[json.loads(p.read_text()) for p in (root/'sks').rglob('manifest.json')]
    summary=dict(cpr_members=len(main['entries']),cpr_bytes=sum(e['size'] for e in main['entries']),
                 cpr_types=dict(sorted(source_types.items())),mesh_files=len(inventory),
                 mesh_categories=dict(sorted(meshes_by_category.items())),
                 obj_triangles=sum(e['triangles'] for e in inventory),
                 source_triangles=sum(e['source_triangles'] for e in inventory),
                 texture_packs=len(texture_manifests),texture_images=sum(len(m['entries']) for m in texture_manifests),
                 cpr_png_images=len(json.loads((root/'images/images.json').read_text())),
                 sks_containers=len(sks_manifests),sks_jpeg_frames=sum(m['frames'] for m in sks_manifests),
                 unresolved_materials=dict(missing),zero_triangle_meshes=zero)
    (root/'verification.json').write_text(json.dumps(summary,indent=2)+'\n')
    print(json.dumps(summary,indent=2))


def tree_reference(root):
    # This quad is a preview aid, NOT a mesh recovered from the game.
    image=next((root/'images/Images/Trees').glob('Level00_1_1.png'))
    with Image.open(image) as im:width,height=im.size
    target=root/'reference'
    target.mkdir(parents=True,exist_ok=True)
    stem='Tree_Level00_1_1'
    ratio=width/height
    (target/(stem+'.obj')).write_text(f'# Reconstructed reference billboard; no source tree mesh\nmtllib {stem}.mtl\n'
        f'v {-ratio} 0 0\nv {ratio} 0 0\nv {ratio} 2 0\nv {-ratio} 2 0\n'
        'vt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\nusemtl tree\nf 1/1 2/2 3/3\nf 1/1 3/3 4/4\n')
    rel=os.path.relpath(image.resolve(),target.resolve())
    (target/(stem+'.mtl')).write_text(f'# Reconstructed billboard material\nnewmtl tree\nKd 1 1 1\nd 1\nmap_Kd {rel}\n')
    (target/(stem+'.json')).write_text(json.dumps(dict(source_image=str(image),source_mesh=None,
                  note='Two-triangle preview quad authored for visual verification; not original game geometry.'),indent=2)+'\n')


def contacts(root):
    folder=root/'thumbs'
    files=sorted(p for p in folder.glob('*.png') if p.name!='contact-sheet.png')
    if files:
        sheet=Image.new('RGB',(1280,340*((len(files)+3)//4)),(240,240,240))
        draw=ImageDraw.Draw(sheet)
        for i,p in enumerate(files):
            with Image.open(p) as im:
                im=im.convert('RGB');im.thumbnail((320,310));x=i%4*320;y=i//4*340
                sheet.paste(im,(x,y));draw.text((x+8,y+314),p.stem,fill='black')
        sheet.save(folder/'contact-sheet.png')
    folder=root/'video-frames'
    for stem in ['Intro','Hoellenorgel']:
        files=sorted(folder.glob(stem+'-*.png'))
        if len(files)!=5:continue
        sheet=Image.new('RGB',(1280,240),(20,20,20));draw=ImageDraw.Draw(sheet)
        for i,p in enumerate(files):
            with Image.open(p) as im:
                im=im.convert('RGB');im.thumbnail((256,210));sheet.paste(im,(256*i,0))
                draw.text((256*i+8,215),p.name,fill='white')
        sheet.save(folder/(stem+'-contact.png'))


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('output',type=Path)
    args=parser.parse_args()
    verify(args.output)
    tree_reference(args.output)
    contacts(args.output)
