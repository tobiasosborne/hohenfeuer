# tools/blender/kit_v1_weapons.py - owns clean-room weapon modelling, atlases and isolated reference inspection.
"""Blender 4.5.14: generate by default; --study/--compare only write inspection art.

Production generation never opens reference files. Reference modes reset the scene,
tag imported data ReferenceOnly, and never call an exporter. Measurements inform
hand-authored metric dimensions only; no source vertex, UV, or pixel data is reused.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import random
import subprocess
import sys
import time

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "assets/kit-v1"
INSPECTION = ROOT / "assets-ripped/compare-v1/weapons"
IDS = ["catapult", "trebuchet", "ballista", "hellfire", "double-cannon",
       "fire-catapult", "rocket", "arcaballista", "fat-freda", "zeppelin"]
# Only study()/compare() access these names. Imported parts retain independent
# origins; any preview assembly is documented as an inference, never recovered rigging.
REFERENCES = {
    "catapult": ["Katapult_Gestell", "Katapult_Drehkranz", "Katapult_Drehachse", "Katapult_Balken"],
    "trebuchet": ["Trebuchet_Gestell", "Trebuchet_Drehkranz", "Trebuchet_Balken", "Trebuchet_Kiste"],
    "ballista": ["Ballista_Gestell", "Ballista_Drehkreuz", "Ballista_schlitten", "Ballista_haken"],
    "hellfire": ["Hoellenorgel_Gestell", "Hoellenorgel_Raeder", "Hoellenorgel_Kanone"],
    "double-cannon": ["Doppelkanone_Gestell", "Doppelkanone_Rohr"],
    "fire-catapult": ["Feuerkatapult_Gestell", "Feuerkatapult_Drehkranz", "Feuerkatapult_Drehachse", "Feuerkatapult_Balken", "FlammenTopf"],
    "rocket": ["Raketenwerfer_Gestell", "Raketenwerfer_Drehkranz", "Raketenwerfer_Gefaess"],
    "arcaballista": ["AtlantischeBallista_Grundkoerper", "AtlantischeBallista_Drehkranz", "AtlantischeBallista_Schiene", "AtlantischeBallista_Schlitten", *[f"AtlantischeBallista_Rad{i}" for i in range(1,5)]],
    "fat-freda": ["DickeLuise_Gestell", "DickeLuise_Drehrad", "DickeLuise_Rohr"],
    "zeppelin": ["Zeppelin_Ballon", "Zeppelin_Gondel", "Zeppelin_HoehenruderL", "Zeppelin_HoehenruderR", "Zeppelin_SeitenruderO", "Zeppelin_SeitenruderU", "Zeppelin_Propeller", "Zeppelin_PropellerL", "Zeppelin_PropellerR"],
}


def canonical_png(path):
    """Discard Cycles timing text; keep image bytes and fixed colour/DPI metadata."""
    import struct
    path=Path(path)
    raw=path.read_bytes()
    assert raw[:8]==b"\x89PNG\r\n\x1a\n"
    output,offset=[raw[:8]],8
    while offset<len(raw):
        size=struct.unpack_from(">I",raw,offset)[0]
        end=offset+12+size
        if raw[offset+4:offset+8] not in (b"tEXt",b"zTXt",b"iTXt"):
            output.append(raw[offset:end])
        offset=end
    path.write_bytes(b"".join(output))


def layout(study_mode=False, compare_mode=False):
    """Host Python/Pillow only: label images, without resampling production textures."""
    from PIL import Image, ImageDraw, ImageFont
    fontpath = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    font = lambda n: ImageFont.truetype(fontpath, n)
    if study_mode:
        records = json.loads((INSPECTION / "study.json").read_text())
        for key, parts in records.items():
            sheet = Image.new("RGB", (1024, math.ceil(len(parts)/4)*230), (27,33,39))
            draw = ImageDraw.Draw(sheet)
            for i, part in enumerate(parts):
                x, y = i%4*256, i//4*230
                panel = Image.open(INSPECTION/"study"/(part["name"]+".png")).convert("RGB")
                sheet.paste(panel, (x,y))
                draw.text((x+5,y+193), part["name"].replace("AtlantischeBallista", "Arcaballista"), font=font(11), fill=(235,225,200))
                draw.text((x+5,y+210), " x ".join(f"{n:.2f}" for n in part["dimensions_m"])+" m (X,Y,Z)", font=font(11), fill=(183,195,200))
            sheet.save(INSPECTION/f"study-{key}.png")
        return
    if not compare_mode:
        manifest = json.loads((OUTPUT/"manifest.json").read_text())
        entries = {w["key"]:w for w in manifest["weapons"]}
        sheet = Image.new("RGB", (1600, 750), (25,31,36))
        draw = ImageDraw.Draw(sheet)
        draw.text((25,15), "HOHENFEUER / KIT V1 WEAPONS", font=font(25), fill=(234,222,194))
        draw.text((25,51), "Independent metric geometry + 512 px procedural atlases / Blender 4.5.14 / forward -Z", font=font(15), fill=(165,185,193))
        for i,key in enumerate(IDS):
            x,y = i%5*320, 86+i//5*330
            entry = entries[key]
            panel = Image.open(OUTPUT/entry["thumbnail"]).convert("RGB")
            sheet.paste(panel, (x+32,y))
            draw.text((x+18,y+263), key.upper(), font=font(17), fill=(235,225,203))
            draw.text((x+18,y+289), f"{entry['triangles']} tris / "+" x ".join(f"{v:.1f}" for v in entry["dimensions_m"])+" m", font=font(12), fill=(166,186,192))
        sheet.save(OUTPUT/"thumbs/weapons-contact-sheet.png")
        return
    if not (INSPECTION/"renders.json").is_file():
        return
    records = json.loads((INSPECTION/"renders.json").read_text())
    contact = Image.new("RGB", (1536, math.ceil(len(records)/2)*344), (25,31,36))
    for i,record in enumerate(records):
        key=record["key"]
        strip = Image.new("RGB", (1536,684), (25,31,36))
        d=ImageDraw.Draw(strip)
        for side, label in enumerate(["ORIGINAL / REFERENCE ONLY", "KIT V1 / INDEPENDENT GEOMETRY"]):
            panel=Image.open(INSPECTION/".frames"/f"{key}-{'original' if side==0 else 'authored'}.png").convert("RGB")
            strip.paste(panel,(side*768,58))
            d.text((side*768+18,15), f"{key.upper()} / {label}", font=font(18), fill=(235,225,203))
        d.text((18,641), record["note"], font=font(13), fill=(168,188,196))
        d.text((18,662), f"Both panels: {record['ortho_height_m']:.2f} m vertical orthographic span / yellow cube = 1 m", font=font(12), fill=(168,188,196))
        strip.save(INSPECTION/f"{key}.png")
        contact.paste(strip.resize((768,342)), (i%2*768,i//2*344))
    contact.save(INSPECTION/"contact-sheet.png")


def validate_outputs():
    """Host validation uses the existing byte-level validator and real r186 loader."""
    import importlib.util
    import struct
    spec=importlib.util.spec_from_file_location("weapon_validator",Path(__file__).with_name("validate_glb.py"))
    checker=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(checker)
    entries={e["key"]:e for e in json.loads((OUTPUT/"manifest.json").read_text())["weapons"]}
    results=[]
    for key in IDS:
        e=entries[key]
        result=checker.validate(OUTPUT/e["mesh"],[v-.0001 for v in e["bounds_min_m"]],[v+.0001 for v in e["bounds_max_m"]],1499)
        assert result["triangles"]==e["triangles"],(key,"manifest count mismatch")
        for actual,expected in zip(result["dimensions_m"],e["dimensions_m"]):
            assert abs(actual-expected)<.0001,(key,"dimension mismatch")
        doc,payload=checker.parse_glb(OUTPUT/e["mesh"])
        nodes={n["name"]:n for n in doc["nodes"]}
        assert set(e["nodes"]+e["parts"])<=nodes.keys(),(key,"missing rig parts")
        pitch=nodes["Pitch"]
        assert pitch["extras"]["pivot"]==[0,0,0]
        first=doc["nodes"][pitch["children"][0]]
        assert first["name"]==e["parts"][-1] and first.get("translation",[0,0,0])==[0,0,0]
        assert all(not isinstance(n.get("extras",{}).get("pivot"),str) for n in doc["nodes"])
        assert len(doc["images"])==1 and "uri" not in doc["images"][0]
        view=doc["bufferViews"][doc["images"][0]["bufferView"]]
        start=view.get("byteOffset",0)
        assert struct.unpack_from(">II",payload,start+16)==(512,512)
        assert struct.unpack_from(">II",(OUTPUT/e["atlas"]).read_bytes(),16)==(512,512)
        assert struct.unpack_from(">II",(OUTPUT/e["thumbnail"]).read_bytes(),16)==(256,256)
        # Avoid absolute workstation paths in shippable evidence.
        result["file"]=e["mesh"]
        results.append(result)
        print(f"WEAPON_VALIDATED {key}: {e['triangles']} tris",flush=True)
    # Decode embedded PNGs with pngjs, then exercise the project's real loader,
    # material conversion, createWeaponView(), setAim(), muzzleWorld() and Sight.
    js=r'''
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { lambertize, repairStringPivots } from './src/render/assets.js';
import { createWeaponView } from './src/render/weapon-view.js';
globalThis.self=globalThis;
globalThis.createImageBitmap=async(blob)=>{const p=PNG.sync.read(Buffer.from(await blob.arrayBuffer()));return {width:p.width,height:p.height,close(){}};};
const ids=JSON.parse(process.argv[2]);
const entries=JSON.parse(fs.readFileSync('assets/kit-v1/manifest.json')).weapons;
const evidence=[];
for(const id of ids){
  const e=entries.find(e=>e.key===id);
  const bytes=fs.readFileSync(`assets/kit-v1/${e.mesh}`);
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  // Check BEFORE repairStringPivots: exported arrays must load correctly themselves.
  const root=gltf.scene;root.updateMatrixWorld(true);
  const pre=root.getObjectByName('Muzzle').getWorldPosition(new THREE.Vector3());
  assert(pre.distanceTo(new THREE.Vector3(...e.muzzle_m))<.0001,`${id}: raw r186 muzzle`);
  root.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite),`${id}: raw finite transforms`));
  const frame=root.getObjectByName('frame');
  const baseline=frame.matrixWorld.clone();
  const view=createWeaponView({model:lambertize(repairStringPivots(gltf).scene)});
  const localMuzzle=view.nodes.muzzle.position.clone();
  const localJoint=view.nodes.pitch.position.clone();
  const yawPosition=view.nodes.yaw.position.clone();
  for(const [az,el] of [[0,0],[37,25],[211,65],[-40,-5]]){
    view.setAim(az,el);
    const expected=localMuzzle.clone().applyAxisAngle(new THREE.Vector3(1,0,0),el*Math.PI/180).add(localJoint).applyAxisAngle(new THREE.Vector3(0,1,0),-az*Math.PI/180).add(yawPosition);
    assert(view.muzzleWorld().distanceTo(expected)<.0001,`${id}: articulated muzzle`);
    root.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite),`${id}: finite posed transforms`));
    assert.deepEqual(frame.matrixWorld.elements,baseline.elements,`${id}: static frame`);
    const cam=new THREE.PerspectiveCamera();view.applySight(cam);assert(cam.position.toArray().every(Number.isFinite));
  }
  view.setAim(0,0);
  const dims=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).toArray();
  dims.forEach((d,i)=>assert(Math.abs(d-e.dimensions_m[i])<.0001,`${id}: loader dimensions`));
  root.traverse(o=>{if(o.isMesh){assert(o.material.map.image.width===512);assert(o.geometry.getAttribute('uv'));}});
  evidence.push({key:id,poses:4,finite:true,rawPivot:true,muzzle:true,staticFrame:true,sight:true});
  view.dispose();
}
console.log(JSON.stringify(evidence));
'''
    run=subprocess.run(["node","--input-type=module","-",json.dumps(IDS)],input=js,text=True,capture_output=True,cwd=ROOT)
    if run.returncode:
        raise RuntimeError(run.stdout+run.stderr)
    integration=json.loads(run.stdout)
    (OUTPUT/"weapons-validation.json").write_text(json.dumps(dict(blender="4.5.14",triangles_max_exclusive=1500,geometry=results,three_r186=integration),indent=2)+"\n")
    print("PASS: 10 GLBs, exact manifest counts/bounds, embedded 512px atlases, numeric pivots, 40 three r186 poses",flush=True)


if "--validate" in sys.argv:
    validate_outputs()
    sys.exit(0)

if any(flag in sys.argv for flag in ("--layout","--layout-study","--layout-compare")):
    layout("--layout-study" in sys.argv,"--layout-compare" in sys.argv)
    sys.exit(0)

import bpy
from mathutils import Vector
sys.path.insert(0, str(Path(__file__).resolve().parent))
import common
import render_v1
import validate_glb

common.assert_blender_version()


def bounds(objects):
    bpy.context.view_layer.update()
    points=[o.matrix_world @ Vector(c) for o in objects if o.type=="MESH" for c in o.bound_box]
    return Vector([min(p[i] for p in points) for i in range(3)]), Vector([max(p[i] for p in points) for i in range(3)])


def setup():
    common.reset_scene()
    render_v1.setup_scene()
    bpy.context.scene.cycles.samples=4
    return common.camera("WeaponInspectionCamera")


def render(objects,path,size=(256,256),scale=None,ruler=False,direction=(2.8,4.0,2.5)):
    low,high=bounds(objects)
    center=(low+high)/2
    cam=bpy.context.scene.camera
    cam.data.type,cam.data.sensor_fit="ORTHO","VERTICAL"
    cam.location=center+Vector(direction)*max(high-low)
    common.aim(cam,center)
    q=cam.rotation_euler.to_quaternion()
    right,up=q @ Vector((1,0,0)),q @ Vector((0,1,0))
    points=[o.matrix_world @ Vector(c) for o in objects if o.type=="MESH" for c in o.bound_box]
    width=max(p.dot(right) for p in points)-min(p.dot(right) for p in points)
    height=max(p.dot(up) for p in points)-min(p.dot(up) for p in points)
    cam.data.ortho_scale=scale or max(height,width/(size[0]/size[1]))*1.25
    if ruler:
        mat=common.base_material("RulerPaint")
        rgb=next(n for n in mat.node_tree.nodes if n.type=="RGB")
        rgb.outputs[0].default_value=(.7,.57,.13,1)
        cube=common.mesh_object("InspectionOnlyOneMetre",*common.box_geometry((-.5,-.5,0),(.5,.5,1)),mat)
        cube.location=center-right*(cam.data.ortho_scale*.5)+Vector((0,0,low.z-center.z))
    common.render_png(path,size)
    canonical_png(path)
    return cam.data.ortho_scale


def reference_import(stem):
    path=ROOT/"assets-ripped/meshes/Objects"/f"{stem}.obj"
    before=set(bpy.data.objects)
    bpy.ops.wm.obj_import(filepath=str(path),forward_axis="NEGATIVE_Z",up_axis="Y",validate_meshes=True)
    fresh=list(set(bpy.data.objects)-before)
    collection=bpy.data.collections.get("ReferenceOnly")
    if not collection:
        collection=bpy.data.collections.new("ReferenceOnly")
        bpy.context.scene.collection.children.link(collection)
    for obj in fresh:
        for old in list(obj.users_collection):
            old.objects.unlink(obj)
        collection.objects.link(obj)
        obj["reference_only"]=True
        obj["inspection_part"]=stem
    common.reference_materials(fresh)
    return fresh,path


def study():
    """Measure/render individual reference parts; never export geometry."""
    INSPECTION.mkdir(parents=True,exist_ok=True)
    records={}
    for key in IDS:
        records[key]=[]
        for stem in REFERENCES[key]:
            setup()
            objects,path=reference_import(stem)
            lo,hi=bounds(objects)
            # Convert Blender bounds to game metres, not source geometry arrays.
            record=dict(name=stem,source_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                        min_m=[lo.x,lo.z,-hi.y],max_m=[hi.x,hi.z,-lo.y],
                        dimensions_m=[hi.x-lo.x,hi.z-lo.z,hi.y-lo.y])
            records[key].append(record)
            render(objects,INSPECTION/"study"/f"{stem}.png",(256,192))
            print("WEAPON_STUDY",stem,record["dimensions_m"],flush=True)
    (INSPECTION/"study.json").write_text(json.dumps(records,indent=2)+"\n")
    subprocess.run(["python3","-I",str(Path(__file__)),"--layout-study"],check=True)


class Mesh:
    """Original metric primitives; all points here are authored Blender Z-up metres."""
    def __init__(self):
        self.vertices, self.faces, self.regions = [], [], []

    def add(self, vertices, faces, region=0):
        start=len(self.vertices)
        self.vertices.extend(tuple(p) for p in vertices)
        self.faces.extend(tuple(start+i for i in f) for f in faces)
        self.regions.extend([region]*len(faces))

    def box(self, lo, hi, region=0):
        self.add(*common.box_geometry(lo,hi),region)

    def beam(self, a, b, width, depth=None, region=0):
        a,b=Vector(a),Vector(b)
        axis=(b-a).normalized()
        helper=Vector((1,0,0)) if abs(axis.x)<.9 else Vector((0,1,0))
        u=axis.cross(helper).normalized()*width/2
        v=axis.cross(u).normalized()*(depth or width)/2
        pts=[p+su*u+sv*v for p in (a,b) for su,sv in [(-1,-1),(1,-1),(1,1),(-1,1)]]
        self.add(pts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],region)

    def lathe(self, profile, segments=10, axis=1, center=(0,0,0), region=1):
        axes=[i for i in range(3) if i!=axis]
        verts,rows,faces=[],[],[]
        for p,r in profile:
            row=[]
            for j in range(1 if r==0 else segments):
                point=list(center)
                point[axis]+=p
                point[axes[0]]+=r*math.cos(j*2*math.pi/segments)
                point[axes[1]]+=r*math.sin(j*2*math.pi/segments)
                row.append(len(verts))
                verts.append(point)
            rows.append(row)
        for a,b in zip(rows,rows[1:]):
            for j in range(segments):
                k=(j+1)%segments
                if len(a)==1 and len(b)==1:
                    continue
                face=(a[0],b[k],b[j]) if len(a)==1 else ((a[j],a[k],b[0]) if len(b)==1 else (a[j],a[k],b[k],b[j]))
                faces.append(tuple(reversed(face)) if axis==1 else face)
        self.add(verts,faces,region)

    def rope(self, a, b, radius=.035, region=2, sides=5):
        a,b=Vector(a),Vector(b)
        d=(b-a).normalized()
        helper=Vector((1,0,0)) if abs(d.x)<.9 else Vector((0,1,0))
        u=d.cross(helper).normalized()*radius
        v=d.cross(u).normalized()*radius
        pts=[p+u*math.cos(j*math.tau/sides)+v*math.sin(j*math.tau/sides) for p in (a,b) for j in range(sides)]
        faces=[tuple(reversed(range(sides))),tuple(range(sides,sides*2))]
        faces.extend((j,(j+1)%sides,(j+1)%sides+sides,j+sides) for j in range(sides))
        self.add(pts,faces,region)

    def move(self, offset):
        self.vertices=[tuple(v[i]+offset[i] for i in range(3)) for v in self.vertices]
        return self

    def ring(self, center, radius, width, axis=0, region=1, sides=12):
        self.lathe([(-width/2,radius*.80),(-width/2,radius),(width/2,radius),(width/2,radius*.80),(-width/2,radius*.80)],sides,axis,center,region)


def atlas(key):
    """Four guttered 256px tiles: sawn oak, hammered iron, twisted rope, woven canvas.

    Tiny soot/coal insets are generated details inside the iron/canvas tiles.
    Each weapon has its own deterministic seed and palette; no art inputs.
    """
    from array import array
    rng=random.Random(1701+IDS.index(key)*131)
    colors={
        "catapult":((99,63,33),(64,69,65),(149,142,101),(142,136,103)),
        "trebuchet":((88,55,31),(63,64,58),(147,139,97),(133,122,86)),
        "ballista":((106,70,35),(57,63,62),(145,131,105),(137,134,99)),
        "hellfire":((91,55,29),(57,60,57),(145,131,101),(121,119,89)),
        "double-cannon":((107,66,32),(58,61,57),(141,119,73),(128,123,92)),
        "fire-catapult":((79,45,25),(45,49,45),(139,129,93),(139,125,88)),
        "rocket":((102,63,31),(61,66,60),(153,130,91),(134,127,88)),
        "arcaballista":((94,60,32),(53,60,58),(139,130,93),(134,128,90)),
        "fat-freda":((100,61,31),(57,62,59),(149,128,83),(129,121,83)),
        "zeppelin":((87,55,30),(57,63,61),(128,123,82),(129,137,99)),
    }[key]
    pixels=array("f")
    # Blender image pixels use a bottom-left origin; UV rectangles use the same convention.
    for y in range(512):
        for x in range(512):
            tile=x//256+(y//256)*2
            u,v=min(247,max(8,x%256))-8,min(247,max(8,y%256))-8
            noise=rng.uniform(-3.0,3.0)
            if tile==0:
                grain=math.sin(u*.26+math.sin(v*.028)*1.4)+.4*math.sin(u*.83+v*.016)
                knot=math.sin(math.sqrt((u-151)**2+((v-83)*.45)**2)*.6)*math.exp(-((u-151)**2/1000+(v-83)**2/4500))
                shade=grain*8+knot*12+noise-(12 if u%60<2 else 0)
            elif tile==1:
                shade=noise+math.sin(u*.035)*3+math.sin((u+v)*.19)*1.5
                if u%57==0 and v%39<9:
                    shade+=11
            elif tile==2:
                shade=9*math.sin((u+v*.8)*.43)+noise-(15 if u%22<2 else 0)
            else:
                shade=noise*.5+((u%4<2)-(v%4<2))*3
                shade-=10 if u%60<2 or v%48<2 else 0
                if key=="zeppelin":
                    shade+=5*math.sin(u*.026)
            rgb=[max(0,min(255,c+shade)) for c in colors[tile]]
            if 452<=x<504 and 8<=y<60:
                rgb=[12+noise,15+noise,14+noise]
            if 452<=x<504 and 452<=y<504:
                rgb=[210+noise,76+noise*2,14+noise]
            pixels.extend([*(c/255 for c in rgb),1])
    img=bpy.data.images.new(f"{key}-atlas",width=512,height=512,alpha=True)
    img.colorspace_settings.name="sRGB"
    img.pixels.foreach_set(pixels)
    img.filepath_raw=str(OUTPUT/f"{key}-atlas.png")
    img.file_format="PNG"
    img.save()
    img.pack()
    return img


def mesh_object(name,builder,material,parent):
    obj=common.mesh_object(name,builder.vertices,builder.faces,material,colors=(1,1,1))
    obj.parent=parent
    # Every component receives its own metric projection. Face UVs are never imported.
    # Elongated planks therefore show grain along their length rather than a flat colour.
    uv=[0.0]*(len(obj.data.loops)*2)
    rectangles=[(8,8,240,240),(264,8,240,240),(8,264,240,240),(264,264,240,240),(454,10,48,48),(454,454,48,48)]
    for poly,region in zip(obj.data.polygons,builder.regions):
        axes=sorted(range(3),key=lambda i:abs(poly.normal[i]))[:2]
        points=[obj.data.vertices[obj.data.loops[l].vertex_index].co for l in poly.loop_indices]
        lo=[min(p[a] for p in points) for a in axes]
        hi=[max(p[a] for p in points) for a in axes]
        x,y,w,h=rectangles[region]
        for loop,p in zip(poly.loop_indices,points):
            u,v=[(p[a]-lo[i])/max(hi[i]-lo[i],1e-6) for i,a in enumerate(axes)]
            # Reserve the material insets so a normal iron/canvas face never samples coal.
            if region in (1,3):
                u*=.76
            uv[loop*2:loop*2+2]=((x+u*w)/512,(y+v*h)/512)
    obj.data.uv_layers[0].data.foreach_set("uv",uv)
    obj.data.update()
    return obj


def empty(name,parent=None,position=(0,0,0)):
    ob=bpy.data.objects.new(name,None)
    bpy.context.scene.collection.objects.link(ob)
    ob.parent,ob.location=parent,position
    return ob


def rig(material,pivot,muzzle,frame,table,moving,arm=False,yaw_height=.12):
    """Origin = feet. Incoming pivots/muzzle are authored world Blender metres.

    three r186 treats extras.pivot as a GLTFExporter numeric array, not prose.
    Use [0,0,0] at the existing joint origin. Its FIRST child must be the zero-
    offset moving mesh: r186 resets that child's translation. Muzzle follows it.
    Store descriptive text in joint_description, and metric metadata in pivot_m.
    """
    base=empty("Base")
    base["forward"]="-Z"
    yaw=empty("Yaw",base,(0,0,yaw_height))
    pitch=empty("Pitch",yaw,(pivot[0],pivot[1],pivot[2]-yaw_height))
    pitch["pivot"]=[0.0,0.0,0.0]
    pitch["pivot_m"]=[pivot[0],pivot[2],-pivot[1]]
    pitch["joint_description"]="Local +X elevates/throws; geometry origin is the joint centre."
    f=mesh_object("frame",frame,material,base)
    t=mesh_object("turntable",table.move((0,0,-yaw_height)),material,yaw)
    b=mesh_object("arm" if arm else "barrel",moving,material,pitch)
    m=empty("Muzzle",pitch,tuple(muzzle[i]-pivot[i] for i in range(3)))
    sight=empty("Sight",yaw,(0,-2,1.25))
    return [base,yaw,pitch,f,t,b,m,sight]


def foot_frame(width,length,beam=.24):
    b=Mesh()
    for x in (-width/2+beam/2,width/2-beam/2):
        b.box((x-beam/2,-length/2,0),(x+beam/2,length/2,beam))
    for y in (-length/2+beam/2,0,length/2-beam/2):
        b.box((-width/2,y-beam/2,.05),(width/2,y+beam/2,beam+.05))
    return b


def wheel(builder,x,y,z,radius,spokes=6):
    builder.ring((x,y,z),radius,.16,axis=0,region=1,sides=12)
    builder.lathe([(-.11,0),(-.11,radius*.16),(.11,radius*.16),(.11,0)],8,axis=0,center=(x,y,z),region=1)
    for j in range(spokes):
        angle=j*math.tau/spokes
        builder.beam((x,y,z),(x,y+math.cos(angle)*radius*.86,z+math.sin(angle)*radius*.86),radius*.10,region=0)


def gun(builder,x,length,radius,segments=10):
    """Short stepped gun with a real recessed bore, positive Y = firing direction."""
    end=length*.64
    builder.lathe([(-length*.36,0),(-length*.36,radius*.72),(-length*.28,radius),
                   (-length*.12,radius*.95),(end-.17,radius*.73),(end-.14,radius*.91),
                   (end,radius*.91),(end,radius*.57),(end-.32,radius*.57)],segments,axis=1,center=(x,0,0),region=1)
    builder.lathe([(end-.32,radius*.57),(end-.32,0)],segments,axis=1,center=(x,0,0),region=4)


def catapult(material,fire=False):
    frame=foot_frame(2.6,4.6,.27)
    table,arm=Mesh(),Mesh()
    for x in (-1.03,1.03):
        table.beam((x,.55,.27),(x,.55,2.36),.26)
        table.beam((x,-1.5,.27),(x,.55,1.45),.22)
        table.beam((x,1.8,.27),(x,.55,1.45),.22)
        for z in (.28,2.25):
            table.box((x-.18,.35,z),(x+.18,.75,z+.15),1)
    table.beam((-1.2,.55,2.23),(1.2,.55,2.23),.24,region=1)
    table.lathe([(-1.30,0),(-1.30,.09),(1.30,.09),(1.30,0)],8,axis=0,center=(0,-.2,.82),region=1)
    table.lathe([(-.66,0),(-.66,.25),(.66,.25),(.66,0)],10,axis=0,center=(0,-.2,.82),region=2)
    for x in (-.5,-.25,0,.25,.5):
        table.ring((x,-.2,.82),.27,.045,axis=0,region=2,sides=8)
    table.beam((1.25,-.2,.82),(1.25,-.2,1.28),.055,region=1)
    pivot=(0,-.2,.82)
    # Ready pose: the charged spoon stands above the crossbar. Joint remains at the torsion axle.
    arm.beam((0,-.12,-.05),(0,2.63,2.08),.22,.27)
    for f in (.15,.36):
        arm.beam((-.17,2.63*f,2.08*f),(.17,2.63*f,2.08*f),.11,region=1)
    arm.lathe([(-.08,0),(-.08,.20),(.08,.20),(.08,0)],8,axis=0,region=1)
    arm.lathe([(-.20,0),(-.15,.24),(.02,.37),(.16,.37),(.16,.27),(.04,.25),(.00,0)],12,axis=2,center=(0,2.63,2.08),region=1)
    if fire:
        # Basket and coals are geometry on the throwing arm; the fire payload is independent art.
        for x in (-.23,.23):
            arm.beam((x,2.63,2.07),(x,2.63,2.31),.035,region=1)
        arm.lathe([(0,0),(0,.23),(.06,.21),(.06,0)],8,axis=2,center=(0,2.63,2.14),region=5)
        for x,h in [(-.11,.27),(.08,.36)]:
            arm.lathe([(0,.10),(h,0)],5,axis=2,center=(x,2.63,2.18),region=5)
    muzzle=(0,pivot[1]+2.63,pivot[2]+2.15)
    return rig(material,pivot,muzzle,frame,table,arm,True)


def trebuchet(material):
    frame=foot_frame(6.0,9.8,.33)
    # Lateral outriggers preserve the broad stance of the original 9.6 m frame.
    for y in (-2.3,2.3):
        frame.beam((-4.8,y,.18),(4.8,y,.18),.34)
    table,arm=Mesh(),Mesh()
    for x in (-1.15,1.15):
        for y in (-2.8,2.8):
            table.beam((x*1.55,y,.32),(x,0,5.95),.34)
        for z in (1.6,2.8,4.0):
            extent=2.8*(1-z/6)
            table.beam((x,-extent,z),(x,extent,z),.22)
        table.box((x-.28,-.3,5.7),(x+.28,.3,6.05),1)
    table.beam((-1.5,0,5.78),(1.5,0,5.78),.20,region=1)
    table.beam((-1.7,-2,.4),(1.15,0,4),.19)
    table.beam((1.7,-2,.4),(-1.15,0,4),.19)
    pivot=(0,0,5.78)
    # Long throw arm, short counterweight arm, hanging box and double sling.
    arm.beam((0,-2.3,1.15),(0,6.5,-3.8),.30,.37)
    arm.lathe([(-1.45,0),(-1.45,.18),(1.45,.18),(1.45,0)],8,axis=0,region=1)
    for x in (-.58,.58):
        arm.rope((0,-2.3,1.15),(x,-2.3,-.6),.055,region=1)
    arm.box((-.73,-3.08,-2.15),(.73,-1.5,-.65),0)
    for z in (-2.03,-.85):
        arm.box((-.77,-3.12,z),(.77,-1.46,z+.16),1)
    for x in (-.35,.35):
        arm.rope((0,6.5,-3.8),(x,6.95,-5.1),.042)
    arm.lathe([(-.16,0),(-.16,.37),(.12,.46),(.24,.25),(.24,0)],8,axis=2,center=(0,6.95,-5.1),region=3)
    return rig(material,pivot,(0,6.95,.73),frame,table,arm,True)


def bow(builder,width,y,z,depth=.17):
    for side in (-1,1):
        pts=[(0,y,z),(side*width*.22,y-.08,z+.04),(side*width*.41,y-.32,z),(side*width*.5,y-.63,z-.08)]
        for a,b in zip(pts,pts[1:]):
            builder.beam(a,b,depth,.20)
        builder.rope(pts[-1],(0,y-1.55,z),.025)


def bolt(builder,x,y,z,length):
    builder.rope((x,y,z),(x,y+length,z),.035,region=0,sides=5)
    builder.lathe([(0,.085),(.3,0)],5,axis=1,center=(x,y+length,z),region=1)
    for side in (-1,1):
        builder.add([(x,y+.1,z),(x+side*.11,y+.10,z),(x,y+.43,z)],[(0,1,2),(2,1,0)],3)


def ballista(material):
    frame,table,barrel=Mesh(),Mesh(),Mesh()
    frame.lathe([(0,0),(0,1.0),(.18,1.0),(.18,0)],12,axis=2,region=1)
    frame.lathe([(.18,0),(.18,.88),(.27,.88),(.27,0)],12,axis=2,region=0)
    for x in (-.3,.3):
        table.beam((x,0,.27),(x,0,1.65),.28)
        table.box((x-.18,-.19,1.35),(x+.18,.19,1.5),1)
    pivot=(0,0,1.54)
    barrel.box((-.14,-1.35,-.13),(.14,1.25,.10),0)
    for x in (-.18,.18):
        barrel.box((x-.035,-1.1,.1),(x+.035,1.3,.19),1)
    bow(barrel,2.9,.77,.08)
    bolt(barrel,0,-.72,.23,2.0)
    barrel.lathe([(-.45,0),(-.45,.09),(.45,.09),(.45,0)],8,axis=0,region=1)
    return rig(material,pivot,(0,1.58,1.77),frame,table,barrel)


def double_cannon(material):
    frame=foot_frame(2.04,2.24,.20)
    table,barrel=Mesh(),Mesh()
    for x in (-.83,0,.83):
        table.beam((x,-.8,.22),(x,.55,.85),.18,.28)
        table.box((x-.12,.25,.75),(x+.12,.65,1.0),1)
    table.beam((-1,.50,.85),(1,.50,.85),.16,region=1)
    for x in (-.5,.5):
        gun(barrel,x,2.36,.28,12)
        for y in (-.32,.05):
            barrel.ring((x,y,0),.285,.045,axis=1,region=2,sides=12)
    barrel.lathe([(-1.0,0),(-1.0,.075),(1.0,.075),(1.0,0)],8,axis=0,region=1)
    pivot=(0,.05,.94)
    return rig(material,pivot,(0,.05+2.36*.64,.94),frame,table,barrel)


def hellfire(material):
    frame=foot_frame(3.0,5.9,.30)
    # Feet stay static; cart, wheels, organ and pitch supports yaw together.
    frame.move((0,0,.80))
    table,barrel=Mesh(),Mesh()
    for x in (-1.88,1.88):
        wheel(table,x,.1,1.2,1.2)
    table.lathe([(-1.98,0),(-1.98,.10),(1.98,.10),(1.98,0)],8,axis=0,center=(0,.1,1.2),region=1)
    for x in (-1.3,1.3):
        table.beam((x,-1.1,1.1),(x,.3,2.3),.20,region=1)
        table.beam((x,1.4,1.1),(x,.3,2.3),.20,region=1)
    table.box((-1.18,-1.2,1.1),(1.18,-.8,2.7),0)
    table.box((-1.24,-1.22,1.2),(1.24,-.78,1.4),1)
    # Iron breech shield and loading hook give the cart its tall organ silhouette.
    table.box((-.92,-1.26,1.55),(.92,-.75,3.10),1)
    table.beam((-1.10,-1.65,1.2),(-1.10,-1.65,3.15),.13,region=1)
    table.beam((-1.10,-1.65,3.15),(.90,-1.65,3.25),.13,region=1)
    table.beam((.90,-1.65,3.25),(.90,-1.65,2.8),.10,region=1)
    table.rope((-.10,-1.65,3.20),(-.10,-1.65,2.82),.026,region=1)
    table.ring((-.10,-1.65,2.70),.14,.045,axis=1,region=1,sides=8)
    for x in (-1.12,-.56,0,.56,1.12):
        gun(barrel,x,3.1,.255,8)
    barrel.beam((-1.48,-.35,-.22),(1.48,-.35,-.22),.18,region=0)
    barrel.lathe([(-1.52,0),(-1.52,.09),(1.52,.09),(1.52,0)],8,axis=0,region=1)
    pivot=(0,.42,2.52)
    return rig(material,pivot,(0,.42+3.1*.64,2.52),frame,table,barrel)


def rocket(material):
    frame,table,barrel=Mesh(),Mesh(),Mesh()
    frame.lathe([(0,0),(0,1.04),(.17,1.04),(.17,0)],12,axis=2,region=1)
    frame.lathe([(.17,0),(.17,.91),(.25,.91),(.25,0)],12,axis=2,region=0)
    for x in (-.67,.67):
        table.beam((x,-.62,.25),(x,0,1.45),.18,region=1)
        table.beam((x,.62,.25),(x,0,1.45),.18,region=1)
    for x in (-.47,0,.47):
        barrel.lathe([(-1.0,.14),(-1.0,.21),(.98,.21),(.98,.14),(.70,.14)],10,axis=1,center=(x,0,0),region=0)
        barrel.lathe([(.70,.14),(.70,0)],10,axis=1,center=(x,0,0),region=4)
        for y in (-.70,.35):
            barrel.ring((x,y,0),.225,.10,axis=1,region=1,sides=10)
    for y in (-.63,.28):
        barrel.beam((-.74,y,-.23),(.74,y,-.23),.12,region=1)
    pivot=(0,0,1.48)
    return rig(material,pivot,(0,.98,1.48),frame,table,barrel)


def arcaballista(material):
    frame=foot_frame(1.8,9.7,.26)
    table,barrel=Mesh(),Mesh()
    for x in (-1.05,1.05):
        for y in (-3.2,3.2):
            wheel(table,x,y,.69,.68,spokes=5)
    for y in (-3.2,3.2):
        table.beam((-1.2,y,.7),(1.2,y,.7),.14,region=1)
    for x in (-.7,.7):
        table.beam((x,-2.6,.5),(x,-.1,1.45),.22)
        table.beam((x,1.8,.5),(x,-.1,1.45),.22)
    pivot=(0,0,1.35)
    barrel.box((-.64,-4.7,-.25),(.64,4.8,.02),0)
    bow(barrel,8.15,3.8,.12,.27)
    for x in (-.43,-.14,.14,.43):
        barrel.box((x-.055,-3.9,.02),(x+.055,4.75,.17),1)
        bolt(barrel,x,-1.4,.24,5.8)
    barrel.beam((-.7,-2,.05),(.7,-2,.05),.22,region=1)
    return rig(material,pivot,(0,4.70,1.59),frame,table,barrel)


def fat_freda(material):
    frame=foot_frame(3.4,4.25,.30)
    table,barrel=Mesh(),Mesh()
    for x in (-1.18,1.18):
        table.beam((x,-1.5,.3),(x,.25,1.85),.36,.50)
        table.beam((x,1.2,.3),(x,.25,1.85),.36,.50)
        table.box((x-.26,-.15,1.6),(x+.26,.58,2.1),1)
    gun(barrel,0,3.6,.99,16)
    barrel.lathe([(-1.52,0),(-1.52,.17),(1.52,.17),(1.52,0)],10,axis=0,region=1)
    for y in (-.7,-.2):
        barrel.ring((0,y,0),1.005,.08,axis=1,region=1,sides=16)
    table.ring((1.65,.3,1.3),.40,.10,axis=0,region=1,sides=10)
    for i in range(3):
        a=i*math.tau/3
        table.beam((1.65,.3,1.3),(1.65,.3+math.cos(a)*.37,1.3+math.sin(a)*.37),.045,region=1)
    pivot=(0,.10,1.90)
    return rig(material,pivot,(0,.10+3.6*.64,1.90),frame,table,barrel)


def zeppelin(material):
    frame,table,barrel=Mesh(),Mesh(),Mesh()
    # A bottom-centred airframe: tiny landing skids are static, all visible flight
    # structure yaws; the underslung launch chute is the renderer's pitch part.
    for x in (-.72,.72):
        frame.beam((x,-1.3,.06),(x,1.3,.06),.12,region=1)
    table.lathe([(-6,0),(-5.6,.85),(-4.5,1.6),(-2.7,2.04),(0,2.18),(2.7,1.96),(4.4,1.48),(5.5,.75),(6,0)],16,axis=1,center=(0,0,4.8),region=3)
    table.box((-.88,-1.35,.25),(.88,1.35,1.35),0)
    table.box((-.96,-1.43,1.25),(.96,1.43,1.43),1)
    table.box((-.83,-1.25,1.43),(.83,1.25,1.85),3)
    table.box((-.92,-1.4,1.84),(.92,1.4,1.96),1)
    for x in (-.8,.8):
        for y in (-1.15,1.15):
            table.rope((x,y,1.9),(x*1.8,y*2,3.25),.037)
    # Longitudinal rigging and sewn envelope bands, built independently.
    for y,r in [(-3.8,1.78),(0,2.20),(3.8,1.68)]:
        table.ring((0,y,4.8),r,.052,axis=1,region=2,sides=16)
    for side in (-1,1):
        table.add([(side*.1,-4.5,4.8),(side*2.3,-5.4,4.8),(side*2.3,-3.7,4.8),(side*.1,-3.2,4.8)],[(0,1,2,3),(3,2,1,0)],0)
    table.add([(-.06,-4.1,4.8),(-.06,-5.6,6.9),(-.06,-3.6,6.8),(-.06,-3.1,4.8)],[(0,1,2,3),(3,2,1,0)],0)
    for side in (-1,1):
        x=side*1.25
        table.beam((side*.85,-.65,.9),(x,-.65,.9),.13,region=1)
        table.lathe([(-.22,0),(-.22,.17),(.22,.17),(.22,0)],8,axis=1,center=(x,-.65,.9),region=1)
        for j in range(3):
            a=j*math.tau/3
            table.beam((x,-.90,.9),(x+math.cos(a)*.45,-.90,.9+math.sin(a)*.45),.085,region=0)
    barrel.box((-.28,-.32,-.13),(.28,.32,.13),1)
    barrel.lathe([(0,.18),(.65,.18),(.65,.12),(.42,.12),(.42,0)],8,axis=1,region=1)
    pivot=(0,.9,.42)
    return rig(material,pivot,(0,1.55,.42),frame,table,barrel)


FACTORIES={"catapult":catapult,"trebuchet":trebuchet,"ballista":ballista,"hellfire":hellfire,
           "double-cannon":double_cannon,"fire-catapult":lambda m:catapult(m,True),"rocket":rocket,
           "arcaballista":arcaballista,"fat-freda":fat_freda,"zeppelin":zeppelin}


def generate(previews=True,only=None):
    OUTPUT.mkdir(parents=True,exist_ok=True)
    (OUTPUT/"thumbs").mkdir(exist_ok=True)
    entries=[]
    for key in only or IDS:
        started=time.perf_counter()
        setup()
        material=common.base_material(key+"Paint",atlas(key),vertex_colors=True)
        objects=FACTORIES[key](material)
        count=0
        for obj in objects:
            if obj.type=="MESH":
                obj.data.calc_loop_triangles()
                count+=len(obj.data.loop_triangles)
        assert count<1500,(key,count)
        low,high=bounds(objects)
        pitch=next(o for o in objects if o.name=="Pitch")
        muzzle=next(o for o in objects if o.name=="Muzzle")
        p,m=pitch.matrix_world.translation,muzzle.matrix_world.translation
        common.export_glb(OUTPUT/f"{key}.glb",objects)
        # glTF can remove coincident triangles; manifest budgets count shipped bytes.
        verified=validate_glb.validate(OUTPUT/f"{key}.glb",(-10,-.01,-15),(10,15,15),1499)
        count=verified["triangles"]
        if previews:
            render(objects,OUTPUT/"thumbs"/f"{key}.png")
        entry=dict(key=key,mesh=f"{key}.glb",triangles=count,atlas=f"{key}-atlas.png",thumbnail=f"thumbs/{key}.png",
                   dimensions_m=[round(high.x-low.x,5),round(high.z-low.z,5),round(high.y-low.y,5)],
                   parts=["frame","turntable","arm" if key in ("catapult","fire-catapult","trebuchet") else "barrel"],
                   nodes=["Base","Yaw","Pitch","Muzzle","Sight"],
                   trunnion_m=[round(p.x,5),round(p.z,5),round(-p.y,5)],muzzle_m=[round(m.x,5),round(m.z,5),round(-m.y,5)],
                   bounds_min_m=[round(low.x,5),round(low.z,5),round(-high.y,5)],bounds_max_m=[round(high.x,5),round(high.z,5),round(-low.y,5)],
                   atlas_size_px=512,pivot_encoding="Pitch extras.pivot is numeric [0,0,0]; joint is carried by node translation.")
        entries.append(entry)
        print(f"WEAPON_GENERATED {key}: {count} tris; {entry['dimensions_m']} m; {time.perf_counter()-started:.2f}s",flush=True)
    # Read at the last possible moment. Retain every cannon/block/person/atlas field
    # and every unrelated weapon entry, including edits made by another session.
    path=OUTPUT/"manifest.json"
    manifest=json.loads(path.read_text())
    changes={e["key"]:e for e in entries}
    manifest["weapons"]=[changes.pop(e["key"],e) for e in manifest.get("weapons",[])]+list(changes.values())
    temp=path.with_name(".weapons-manifest.json.tmp")
    temp.write_text(json.dumps(manifest,indent=2)+"\n")
    temp.replace(path)
    if previews and all((OUTPUT/"thumbs"/f"{key}.png").is_file() for key in IDS):
        subprocess.run(["python3","-I",str(Path(__file__)),"--layout"],check=True)


def assembled_reference(key):
    """Preview-only hand-inferred joints; source OBJs contain no surviving rig.

    These transforms operate on imported objects solely for camera comparisons.
    No measurement or imported data returns to any production geometry builder.
    """
    objects,sources=[],[]
    for stem in REFERENCES[key]:
        if stem in ("Zeppelin_PropellerL","Zeppelin_PropellerR"):
            continue  # Flat sprite cards with opaque backgrounds; use the 3D propeller.
        fresh,path=reference_import(stem)
        sources.append(dict(file=str(path.relative_to(ROOT)),sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
        if key in ("catapult","fire-catapult"):
            if "Drehkranz" in stem or "Drehachse" in stem:
                for o in fresh:
                    o.location=(0,-.2,.82)
            elif "Balken" in stem:
                for o in fresh:
                    # Preserve the OBJ importer's Y-up to Z-up basis rotation.
                    o.rotation_euler.x+=math.radians(58)
                    o.location=(0,-.2,.82)
            elif stem=="FlammenTopf":
                for o in fresh:
                    o.location=(0,1.82,2.9)
        elif key=="trebuchet":
            if "Drehkranz" in stem or "Balken" in stem:
                for o in fresh:
                    o.location.z=5.78
            elif "Kiste" in stem:
                for o in fresh:
                    o.location=(0,-2.7,7.6)
        elif key=="ballista":
            if "Gestell" not in stem:
                for o in fresh:
                    o.location.z=1.54
        elif key=="hellfire":
            if "Raeder" in stem:
                for o in fresh:
                    o.location.z=1.2
            if "Kanone" in stem:
                originals=fresh[:]
                for o in originals:
                    o.location=(-1.12,.15,1.95)
                for x in (-.56,0,.56,1.12):
                    for src in originals:
                        dupe=src.copy()
                        dupe.data=src.data
                        bpy.data.collections["ReferenceOnly"].objects.link(dupe)
                        dupe.location.x=x
                        fresh.append(dupe)
        elif key in ("double-cannon","fat-freda"):
            for o in fresh:
                o.rotation_euler.z=math.pi
                if "Rohr" in stem:
                    o.location.z=.94 if key=="double-cannon" else 1.90
                elif "Drehrad" in stem:
                    o.location=(1.65,.3,1.3)
        elif key=="rocket":
            if "Drehkranz" in stem or "Gefaess" in stem:
                for o in fresh:
                    o.location.z=1.48
        elif key=="arcaballista":
            for o in fresh:
                o.rotation_euler.z=math.pi
                if "Rad" in stem:
                    number=int(stem[-1])-1
                    o.location=((-1.05,1.05)[number%2],(-3.2,3.2)[number//2],.69)
                elif "Grundkoerper" not in stem:
                    o.location.z=1.35
                    o.location.y=3.8
        elif key=="zeppelin":
            for o in fresh:
                if "Ballon" in stem:
                    o.location.z=5.0
                elif "ruder" in stem:
                    o.location.y=-5.5
                    o.location.z=5.0
                    if "Hoehenruder" in stem:
                        o.location.x=-1.2 if stem.endswith("L") else 1.2
                    else:
                        o.location.z=6.2 if stem.endswith("O") else 3.8
                elif "Propeller" in stem:
                    o.location=(0,-1.5,1)
        objects.extend(fresh)
    return objects,sources


def compare(only=None):
    """Separate inspection process: import, render, label; NO calls to export."""
    INSPECTION.mkdir(parents=True,exist_ok=True)
    records=[]
    for key in only or IDS:
        setup()
        original,sources=assembled_reference(key)
        lo,hi=bounds(original)
        # Fit both panels with exactly the same camera direction and metre scale.
        reference_span=render(original,INSPECTION/".frames"/f"{key}-fit.png",(768,576))
        refbounds=[list(lo),list(hi)]
        setup()
        before=set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(OUTPUT/f"{key}.glb"))
        authored=list(set(bpy.data.objects)-before)
        authored_span=render(authored,INSPECTION/".frames"/f"{key}-fit-authored.png",(768,576))
        span=max(reference_span,authored_span)*1.12
        render(authored,INSPECTION/".frames"/f"{key}-authored.png",(768,576),span,True)
        setup()
        original,_=assembled_reference(key)
        render(original,INSPECTION/".frames"/f"{key}-original.png",(768,576),span,True)
        note="Preview joints inferred from separate part origins; reference and kit shown at the same metre scale."
        if key in ("catapult","fire-catapult"):
            note="Reference arm preview raised 58 deg; independently authored ready pose and inferred joints. Same metre scale."
        elif key=="rocket":
            note="Original single housing / requested three-tube rack. Inferred joints, same metre scale."
        elif key=="zeppelin":
            note="Original envelope about 14 m / requested kit 12 m. Inferred gondola joints, same metre scale."
        records.append(dict(key=key,ortho_height_m=span,reference_bounds_blender=refbounds,sources=sources,note=note))
        print(f"WEAPON_COMPARE {key}: shared ortho {span:.2f} m",flush=True)
    path=INSPECTION/"renders.json"
    if only and path.is_file():
        changes={e["key"]:e for e in records}
        records=[changes.pop(e["key"],e) for e in json.loads(path.read_text())]+list(changes.values())
    path.write_text(json.dumps(records,indent=2)+"\n")
    subprocess.run(["python3","-I",str(Path(__file__)),"--layout-compare"],check=True)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--study",action="store_true")
    parser.add_argument("--compare",action="store_true")
    parser.add_argument("--no-render",action="store_true")
    parser.add_argument("--only",nargs="+",choices=IDS)
    args=parser.parse_args(common.argv())
    if args.study:
        study()
    elif args.compare:
        compare(args.only)
    else:
        generate(not args.no_render,args.only)


if __name__=="__main__":
    common.run(main)
