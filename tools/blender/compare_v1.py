# tools/blender/compare_v1.py - owns isolated reference-only renders and labelled kit-v1 comparison evidence.
import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys
import textwrap
import time

import bpy
from mathutils import Vector

sys.dont_write_bytecode = True
sys.path.insert(0,str(Path(__file__).resolve().parent))
import common
import render_v1

common.assert_blender_version()
assert bpy.app.version == (4,5,14)
ROOT=common.ROOT
OUTPUT=ROOT/"assets-ripped/compare-v1"
BUILDINGS=ROOT/"assets-ripped/meshes/Buildings"
OBJECTS=ROOT/"assets-ripped/meshes/Objects"
SOURCES={"stone":"MauerKlein_0", "tower":"TurmKlein", "gate":"Burgtor", "wood":"bauernhaus",
         "floor":"MauerKlein_0", "stairs":"MauerKlein_0", "ladder":"bauernhaus", "door":"Burgtor",
         "roof":"palast", "magazine":"pulverfabrik", "palace":"palast", "mount":"MauerGross_0", "foundation":"MauerKlein_0"}


def bounds(objects):
    bpy.context.view_layer.update()
    points=[obj.matrix_world @ Vector(p) for obj in objects if obj.type=="MESH" for p in obj.bound_box]
    return Vector([min(p[i] for p in points) for i in range(3)]),Vector([max(p[i] for p in points) for i in range(3)])


def imported(paths,reference=False):
    result=[]
    for path in paths:
        before=set(bpy.data.objects)
        if reference:
            bpy.ops.wm.obj_import(filepath=str(path),forward_axis="NEGATIVE_Z",up_axis="Y",validate_meshes=True)
        else:
            bpy.ops.import_scene.gltf(filepath=str(path))
        fresh=list(set(bpy.data.objects)-before)
        for obj in fresh:
            obj["inspection_source_stem"]=path.stem
        result.extend(fresh)
    if reference:
        collection=bpy.data.collections.new("ReferenceOnly")
        bpy.context.scene.collection.children.link(collection)
        for obj in result:
            for old in list(obj.users_collection):
                old.objects.unlink(obj)
            collection.objects.link(obj)
            obj["reference_only"]=True
        common.reference_materials([obj for obj in result if obj.type=="MESH"])
    return result


def render_panel(paths,path,reference=False,cannon=False,missing=None):
    common.reset_scene()
    render_v1.setup_scene()
    cam=common.camera("CompareCamera")
    cam.data.type,cam.data.sensor_fit="ORTHO","VERTICAL"
    if missing:
        label=bpy.data.curves.new("NoReference","FONT")
        label.body="\n".join(textwrap.fill(line,width=28) for line in missing.splitlines())
        label.align_x,label.size="CENTER",.11
        label.materials.append(common.base_material("Label"))
        obj=bpy.data.objects.new("NoReference",label)
        bpy.context.scene.collection.objects.link(obj)
        cam.location=(0,-4,0)
        common.aim(cam,(0,0,0))
        obj.rotation_euler=cam.rotation_euler
        cam.data.ortho_scale=1.5
        common.render_png(path,(768,576))
        return dict(missing=missing)
    objects=imported(paths,reference)
    if reference and cannon:
        # OBJ parts have independent origins and no surviving animation hierarchy.
        # This preview assembly is inferred by eye; it is never an export input.
        for obj in objects:
            obj.rotation_euler.z=math.pi
            if "Rohr" in obj["inspection_source_stem"]:
                obj.location.z+=1.12
            if "Drehkranz" in obj["inspection_source_stem"]:
                obj.location.z+=.14
    low,high=bounds(objects)
    center=(low+high)/2
    dimensions=high-low
    # View from north makes doors, windows and muzzle visible.
    cam.location=center+Vector((2.8,4.0,2.4))*max(dimensions)
    common.aim(cam,center)
    rotation=cam.rotation_euler.to_quaternion()
    right,up=rotation @ Vector((1,0,0)),rotation @ Vector((0,1,0))
    corners=[obj.matrix_world @ Vector(p) for obj in objects if obj.type=="MESH" for p in obj.bound_box]
    width=max(p.dot(right) for p in corners)-min(p.dot(right) for p in corners)
    height=max(p.dot(up) for p in corners)-min(p.dot(up) for p in corners)
    cam.data.ortho_scale=4.1 if cannon else max(height,width/(768/576))*1.12
    common.render_png(path,(768,576))
    return dict(bounds_blender=[list(low),list(high)],ortho_height_m=cam.data.ortho_scale)


def generate(only=None):
    started=time.perf_counter()
    OUTPUT.mkdir(parents=True,exist_ok=True)
    (OUTPUT/".frames").mkdir(exist_ok=True)
    manifest=json.loads((ROOT/"assets/kit-v1/manifest.json").read_text())
    jobs=[]
    for block in manifest["blocks"]:
        for state in range(4):
            key=block["key"]+(f"_z{state}" if state else "")
            source=SOURCES.get(block["key"])
            refs=[BUILDINGS/f"{source}_z{state}.obj"] if source else []
            if refs and not refs[0].is_file():
                candidates=[p for p in BUILDINGS.glob("*.obj") if p.name.casefold()==refs[0].name.casefold()]
                if not candidates:
                    raise FileNotFoundError(refs[0])
                refs=candidates
            jobs.append((key,refs,False))
    jobs.extend([("cannon",[OBJECTS/f"Kanone_{part}.obj" for part in ("Gestell","Drehkranz","Rohr")],True),("person",[],False)])
    records=[]
    for key,refs,is_cannon in jobs:
        if only and key not in only:
            continue
        step=time.perf_counter()
        refmeta=render_panel(refs,OUTPUT/".frames"/f"{key}-original.png",True,is_cannon,
            missing=("AIR\nempty cell / no source mesh" if key.startswith("air") else "No humanoid OBJ supplied\nplaceholder has no source likeness target") if not refs else None)
        newmeta=render_panel([ROOT/"assets/kit-v1"/f"{key}.glb"],OUTPUT/".frames"/f"{key}-authored.png",False,is_cannon)
        note=("Same 4.1 m orthographic height. Reference barrel/turntable placement inferred; raw multipart origins are not assembled."
              if is_cannon else "Reference structure and 1 m cell skin fitted separately; compare stone scale, motifs and colour, not overall silhouette.")
        if not refs:
            note="No corresponding original mesh supplied; left panel explicitly records the absence of a likeness reference."
        record=dict(key=key,reference_label=(refs[0].stem if refs else "No original mesh")+" / REFERENCE ONLY",
                    authored_label=f"KIT V1 / {key}"+(" / 1 m cell" if key not in ("cannon","person") else ""),
                    note=note,reference=refmeta,authored=newmeta,
                    sources=[dict(file=str(p.relative_to(ROOT)),sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in refs],
                    seconds=round(time.perf_counter()-step,3))
        records.append(record)
        print(f"COMPARE_V1 {key}: {record['seconds']}s",flush=True)
    elapsed=round(time.perf_counter()-started,3)
    if only and (OUTPUT/"renders.json").is_file():
        previous=json.loads((OUTPUT/"renders.json").read_text())
        replacements={record["key"]:record for record in records}
        records=[replacements.pop(old["key"],old) for old in previous["assets"]]+list(replacements.values())
    result=dict(blender="4.5.14",lighting="DESIGN 7.2: one warm sun and hemisphere; no realtime shadows; common.py defaults",
                assets=records,seconds=round(sum(record["seconds"] for record in records),3),last_run_seconds=elapsed)
    (OUTPUT/"renders.json").write_text(json.dumps(result,indent=2)+"\n")
    subprocess.run(["python3","-I",str(Path(__file__).with_name("kit_v1_preview.py")),"--compare"],check=True)
    print(f"COMPARE_V1_TOTAL {len(records)} strips, {result['seconds']}s",flush=True)


if __name__=="__main__":
    parser=argparse.ArgumentParser(description="Render reference-only comparisons, never export or write shippable art")
    parser.add_argument("--only",nargs="+")
    args=parser.parse_args(common.argv())
    common.run(lambda:generate(args.only))
