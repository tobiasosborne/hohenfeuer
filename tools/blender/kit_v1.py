# tools/blender/kit_v1.py - owns independently modelled kit-v1 blocks, articulated cannon, humanoid and previews.
import argparse
import json
import math
from pathlib import Path
import subprocess
import sys
import time

import bpy
from mathutils import Vector

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import common
import render_v1

common.assert_blender_version()
assert bpy.app.version == (4, 5, 14)
OUTPUT = common.ROOT / "assets/kit-v1"
KEYS = "air stone tower gate wood floor stairs ladder door roof magazine palace mount foundation".split()


class Mesh:
    def __init__(self):
        self.vertices, self.faces, self.regions, self.uvs = [], [], [], []

    def add(self, vertices, faces, region=0, uvs=None):
        start = len(self.vertices)
        self.vertices.extend(vertices)
        self.faces.extend(tuple(i+start for i in face) for face in faces)
        self.regions.extend([region]*len(faces) if isinstance(region,int) else region)
        self.uvs.extend(uvs if uvs else [None]*len(faces))

    def box(self, low, high, region=0):
        self.add(*common.box_geometry(low,high),region)

    def lathe(self, profile, segments=12, axis=1, center=(0,0,0), region=0):
        """Original surface of revolution; profile is (axial metres, radius)."""
        axes = [i for i in range(3) if i != axis]
        vertices, faces, uv = [], [], []
        for p,r in profile:
            for j in range(segments):
                point = list(center)
                point[axis] += p
                point[axes[0]] += r*math.cos(j*2*math.pi/segments)
                point[axes[1]] += r*math.sin(j*2*math.pi/segments)
                vertices.append(tuple(point))
        # Axis-dependent winding. Radius-zero rows use a single triangle per segment.
        for row in range(len(profile)-1):
            for j in range(segments):
                a,b = row*segments+j, row*segments+(j+1)%segments
                c,d = a+segments,b+segments
                face = (a,b,d,c)
                coords = [(j/segments,row/(len(profile)-1)),((j+1)/segments,row/(len(profile)-1)),
                          ((j+1)/segments,(row+1)/(len(profile)-1)),(j/segments,(row+1)/(len(profile)-1))]
                if profile[row][1] == 0:
                    face, coords = (a,d,c), [coords[0],coords[2],coords[3]]
                elif profile[row+1][1] == 0:
                    face, coords = (a,b,d), coords[:3]
                if axis == 1:
                    face, coords = tuple(reversed(face)), list(reversed(coords))
                faces.append(face)
                uv.append(coords)
        self.add(vertices,faces,region,uv)


def image(path):
    result = bpy.data.images.load(str(path),check_existing=True)
    result.colorspace_settings.name = "sRGB"
    result.pack()
    return result


def projected_uv(mesh, polygon, normalize=False):
    normal = polygon.normal
    dropped = max(range(3),key=lambda i: abs(normal[i]))
    axes = [i for i in range(3) if i != dropped]
    points = [mesh.vertices[mesh.loops[i].vertex_index].co for i in polygon.loop_indices]
    if normalize:
        low = [min(p[i] for p in points) for i in axes]
        high = [max(p[i] for p in points) for i in axes]
        return [tuple((p[axis]-low[k])/max(0.001,high[k]-low[k]) for k,axis in enumerate(axes)) for p in points]
    return [tuple(p[i]+(0.5 if i<2 else 0) for i in axes) for p in points]


def object_from(name, builder, material, mode="block", block_id=0, state=0):
    obj = common.mesh_object(name,builder.vertices,builder.faces,material,colors=(1,1,1))
    mesh = obj.data
    if mode == "block":
        mesh.uv_layers[0].name = "AtlasUV"
        mesh.uv_layers.new(name="LocalUV")
    primary, secondary = [0.0]*(len(mesh.loops)*2),[0.0]*(len(mesh.loops)*2)
    for polygon in mesh.polygons:
        region = builder.regions[polygon.index]
        if mode == "block":
            region = 2 if polygon.normal.z > .6 else (3 if polygon.normal.z < -.6 else (1 if polygon.normal.y > .6 else 0))
        coords = builder.uvs[polygon.index] or projected_uv(mesh,polygon,normalize=mode!="block")
        for loop,(u,v) in zip(polygon.loop_indices,coords):
            u,v = min(1,max(0,u)),min(1,max(0,v))
            if mode == "block":
                tile = (block_id*4+state)*4+region
                primary[loop*2:loop*2+2] = ((tile%16*256+8+u*240)/4096,(tile//16*256+8+v*240)/4096)
                secondary[loop*2:loop*2+2] = ((region*256+8+u*240)/1024,(8+v*240)/256)
            elif mode == "cannon":
                primary[loop*2:loop*2+2] = ((region%2*256+8+u*240)/512,(region//2*256+8+v*240)/512)
            else:
                primary[loop*2:loop*2+2] = ((region%4*64+3+u*58)/256,(region//4*128+3+v*122)/256)
    mesh.uv_layers[0].data.foreach_set("uv",primary)
    if mode == "block":
        mesh.uv_layers[1].data.foreach_set("uv",secondary)
        mesh.uv_layers.active_index = 0
        mesh.uv_layers[0].active_render = True
        # DESIGN 7.3 hp-quartile tint is carried by vertex colour as well as cracks.
        for color in mesh.color_attributes["Color"].data:
            color.color=tuple(v*(1-.1*state) for v in color.color[:3])+(1,)
    mesh.update()
    return obj


def clip(builder, limit):
    """Chip the +X/north/top corner with an authored plane, without external mesh inputs."""
    n = Vector((1,1,1))
    result, cap = Mesh(),[]
    for face in builder.faces:
        points = [Vector(builder.vertices[i]) for i in face]
        polygon = []
        for a,b in zip(points,points[1:]+points[:1]):
            da,db = a.dot(n)-limit,b.dot(n)-limit
            if da <= 1e-7:
                polygon.append(a)
            if (da < 0 < db) or (db < 0 < da):
                p = a+(b-a)*(da/(da-db))
                polygon.append(p)
                if not any((p-q).length < 1e-6 for q in cap):
                    cap.append(p)
        if len(polygon)>=3:
            result.add(polygon,[tuple(range(len(polygon)))])
    if len(cap)>=3:
        center = sum(cap,Vector())/len(cap)
        u = (cap[0]-center).normalized()
        v = n.normalized().cross(u)
        cap.sort(key=lambda p:math.atan2((p-center).dot(v),(p-center).dot(u)))
        result.add(cap,[tuple(range(len(cap)))])
    return result


def voxel_damage(state):
    builder = Mesh()
    removed = {(1,1,1)} if state==2 else {(1,1,1),(0,1,1),(1,0,1)}
    cells = {(x,y,z) for x in range(2) for y in range(2) for z in range(2)}-removed
    directions = [(0,0,-1),(0,-1,0),(1,0,0),(0,1,0),(-1,0,0),(0,0,1)]
    for x,y,z in sorted(cells):
        vertices,faces = common.box_geometry((x*.5-.5,y*.5-.5,z*.5),((x+1)*.5-.5,(y+1)*.5-.5,(z+1)*.5))
        visible = [face for face,d in zip(faces,directions) if (x+d[0],y+d[1],z+d[2]) not in cells]
        builder.add(vertices,visible)
    return builder


def block_geometry(key,state):
    b = Mesh()
    if key == "stairs":
        profile = [(-.5,0),(.5,0),(.5,1),(0,1),(0,.5),(-.5,.5)]
        vertices = [(x,y,z) for x in (-.5,.5) for y,z in profile]
        faces = [tuple(reversed(range(6))),tuple(range(6,12))]
        faces += [(i,(i+1)%6,(i+1)%6+6,i+6) for i in range(6)]
        b.add(vertices,faces)
    elif key == "ladder":
        b.box((-.40,.4,0),(-.30,.5,1))
        b.box((.30,.4,0),(.40,.5,.84 if state==3 else 1))
        for z in [.08,.27,.46,.65,.84][:5-state]:
            b.box((-.30,.4,z),(.30,.5,z+.06))
        return b
    elif key == "floor":
        b.box((-.5,-.5,.82),(.5,.5,1))
    elif key == "door":
        b.box((-.45,.4,0),(.45,.5,1))
    elif key == "roof":
        b.add([(-.5,-.5,0),(.5,-.5,0),(.5,.5,0),(-.5,.5,0),(-.5,.5,1),(.5,.5,1)],
              [(0,3,2,1),(0,1,5,4),(3,4,5,2),(0,4,3),(1,2,5)])
    elif state>=2 and key!="air":
        return voxel_damage(state)
    else:
        b.box((-.5,-.5,0),(.5,.5,1))
    return clip(b,2-state*.18) if state and key!="air" else b


def empty(name,parent=None,position=(0,0,0)):
    obj = bpy.data.objects.new(name,None)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent, obj.location = parent,position
    return obj


def cannon(material):
    base = empty("Base")
    base["forward"] = "-Z"
    yaw = empty("Yaw",base,(0,0,.16))
    pitch = empty("Pitch",yaw,(0,.15,.91))
    pitch["pivot"] = "trunnion centre; local X is elevation axis"
    muzzle = empty("Muzzle",pitch,(0,1.45,0))
    sight = empty("Sight",yaw,(0,-2,1.25))
    frame = Mesh()
    # Two shaped oak cheeks; all dimensions are authored metres, not imported coordinates.
    profile = [(-1,.18),(.78,.18),(.78,.52),(.42,.72),(.25,1.11),(-.11,1.12),(-.40,.66),(-1,.36)]
    for center in (-.40,.40):
        vertices = [(x,y,z-.16) for x in (center-.085,center+.085) for y,z in profile]
        faces = [tuple(reversed(range(8))),tuple(range(8,16))]
        faces += [(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)]
        frame.add(vertices,faces,0)
    for y in (-.82,-.28,.55):
        frame.box((-.49,y-.07,.21-.16),(.49,y+.07,.34-.16),0)
    frame.lathe([(-.75,0),(-.75,.075),(.75,.075),(.75,0)],10,axis=0,center=(0,.28,.36-.16),region=1)
    for side in (-1,1):
        center = side*.635
        # Solid wooden truck wheels with separate dark iron tyre and capped axle hub.
        frame.lathe([(center-.09,0),(center-.09,.29),(center+.09,.29),(center+.09,0)],12,axis=0,center=(0,.28,.36-.16),region=2)
        frame.lathe([(center-.10,.29),(center-.10,.35),(center+.10,.35),(center+.10,.29),(center-.10,.29)],12,axis=0,center=(0,.28,.36-.16),region=1)
        hub = side*.7525
        frame.lathe([(hub-.0225,0),(hub-.0225,.10),(hub+.0225,.10),(hub+.0225,0)],8,axis=0,center=(0,.28,.36-.16),region=1)
    frame_obj = object_from("frame",frame,material,"cannon")
    frame_obj.parent = yaw
    frame_obj["part"] = "two-cheek oak carriage, two truck wheels and iron axle"
    table = Mesh()
    table.lathe([(0,0),(0,.43),(.12,.43),(.12,0)],12,axis=2,region=0)
    table_obj = object_from("turntable",table,material,"cannon")
    table_obj.parent = base
    barrel = Mesh()
    barrel.lathe([(-.9,0),(-.88,.10),(-.79,.12),(-.71,.075),(-.64,.27),(-.52,.33),(-.46,.33),
                  (-.38,.29),(.1,.265),(.65,.22),(1.20,.19),(1.31,.245),(1.40,.26),(1.45,.23),
                  (1.45,.145),(1.12,.145),(1.12,0)],12,axis=1,region=1)
    # Blind bore interior is a separate texture region, never a painted muzzle disc.
    barrel.regions[-24:] = [3]*24
    barrel.lathe([(-.53,0),(-.53,.085),(.53,.085),(.53,0)],10,axis=0,region=1)
    barrel_obj = object_from("barrel",barrel,material,"cannon")
    barrel_obj.parent = pitch
    return [base,yaw,pitch,muzzle,sight,frame_obj,table_obj,barrel_obj]


def tapered_box(builder,low,high,top_scale,region):
    vertices,faces = common.box_geometry(low,high)
    midx,midy = (low[0]+high[0])/2,(low[1]+high[1])/2
    vertices = [(midx+(x-midx)*top_scale,midy+(y-midy)*top_scale,z) if z==high[2] else (x,y,z) for x,y,z in vertices]
    builder.add(vertices,faces,region)


def person(material):
    b = Mesh()
    tapered_box(b,(-.21,-.11,.88),(.21,.11,1.34),1.12,0)
    tapered_box(b,(-.245,-.145,.72),(.245,.145,.97),.80,0)
    b.box((-.219,-.12,.91),(.219,.12,.955),3)
    # Sleeves, forearms, hands; relaxed A-pose with visible gaps for later rigging.
    for side in (-1,1):
        x = side*.28
        tapered_box(b,(x-.075,-.09,1.04),(x+.075,.09,1.32),1.15,0)
        x = side*.33
        tapered_box(b,(x-.06,-.075,.81),(x+.06,.075,1.07),1.05,1)
        b.box((x-.055,-.07,.70),(x+.055,.07,.83),1)
        x = side*.105
        tapered_box(b,(x-.075,-.085,.39),(x+.075,.085,.78),1.12,2)
        tapered_box(b,(x-.065,-.075,.10),(x+.065,.075,.42),1.12,2)
        b.box((x-.078,-.095,0),(x+.078,.18,.15),3)
    b.lathe([(1.31,0),(1.31,.07),(1.43,.07),(1.43,0)],6,axis=2,region=1)
    b.lathe([(1.40,0),(1.43,.105),(1.57,.13),(1.66,.095),(1.67,0)],8,axis=2,center=(0,.015,0),region=1)
    b.lathe([(1.64,0),(1.64,.14),(1.71,.14),(1.75,0)],8,axis=2,region=0)
    # Original cap band, gold belt buckle and facial paint use the same shared palette.
    b.add([(-.045,.129,1.48),(.045,.129,1.48),(.045,.129,1.505),(-.045,.129,1.505)],[(0,3,2,1)],2)
    b.box((-.035,-.13,.915),(.035,-.122,.96),4)
    obj = object_from("person",b,material,"person")
    obj["height_m"],obj["rig_status"] = 1.75,"unrigged placeholder; role colour is red crew tunic"
    return [obj]


def tris(objects):
    count=0
    for obj in objects:
        if obj.type=="MESH":
            obj.data.calc_loop_triangles()
            count += len(obj.data.loop_triangles)
    return count


def remove(objects):
    for obj in reversed(objects):
        bpy.data.objects.remove(obj,do_unlink=True)


def thumbnail(path,objects,scale=None):
    bpy.context.view_layer.update()
    points = [obj.matrix_world @ Vector(p) for obj in objects if obj.type=="MESH" for p in obj.bound_box]
    low = Vector([min(p[i] for p in points) for i in range(3)])
    high = Vector([max(p[i] for p in points) for i in range(3)])
    center = (low+high)/2
    cam = bpy.context.scene.camera
    cam.data.type,cam.data.sensor_fit = "ORTHO","VERTICAL"
    cam.data.ortho_scale = scale or max(high-low)*1.45
    direction=(2.7,-3.8,2.6) if objects[0].name.startswith(("roof","stairs")) else (2.7,3.8,2.6)
    cam.location = center+Vector(direction)*max(high-low)
    common.aim(cam,center)
    common.render_png(path,(256,256))


def generate(render=True):
    started=time.perf_counter()
    OUTPUT.mkdir(parents=True,exist_ok=True)
    (OUTPUT / "thumbs").mkdir(exist_ok=True)
    subprocess.run(["python3","-I",str(Path(__file__).with_name("kit_v1_textures.py")),str(OUTPUT)],check=True)
    texture_seconds=time.perf_counter()-started
    common.reset_scene()
    render_v1.setup_scene()
    common.camera("KitThumbnailCamera")
    manifest=dict(blender="4.5.14",units="metres",up="+Y",north="-Z",seed=1,
                  bounds_min_m=[-.5,0,-.5],bounds_max_m=[.5,1,.5],
                  atlas=dict(file="atlas.png",size_px=4096,tile_px=256,gutter_px=8),
                  provenance="Independent hand-authored metric primitives and deterministic painted procedural texels; seed 1.",
                  uv_contract="TEXCOORD_0 addresses shared atlas; TEXCOORD_1 addresses compact embedded side/front/top/bottom face strip.",blocks=[])
    timings,counts={},{}
    for block_id,key in enumerate(KEYS):
        step=time.perf_counter()
        variant_counts=[]
        for state in range(4):
            name=key+(f"_z{state}" if state else "")
            texture=image(OUTPUT / "textures" / f"{name}.png")
            material=common.base_material(name+"Paint",texture,vertex_colors=True,alpha=0 if key=="air" else 1)
            uv=material.node_tree.nodes.new("ShaderNodeUVMap")
            uv.uv_map="LocalUV"
            node=next(n for n in material.node_tree.nodes if n.type=="TEX_IMAGE")
            material.node_tree.links.new(uv.outputs["UV"],node.inputs["Vector"])
            obj=object_from(name,block_geometry(key,state),material,block_id=block_id,state=state)
            obj["block_id"],obj["block_key"],obj["damage_state"]=block_id,key,state
            if key=="air":
                obj["preview_only"]=True
            count=tris([obj])
            assert count<=96,(name,count)
            common.export_glb(OUTPUT / f"{name}.glb",[obj])
            if render:
                thumbnail(OUTPUT / "thumbs" / f"{name}.png",[obj],1.8)
            variant_counts.append(count)
            remove([obj])
            bpy.data.materials.remove(material)
            bpy.data.images.remove(texture)
        manifest["blocks"].append(dict(id=block_id,key=key,mesh=f"{key}.glb",thumbnail=f"thumbs/{key}.png",
            triangles=variant_counts[0],note="Transparent empty-cell preview proxy." if key=="air" else "One metric cell; north-facing details; variants derive from hp quartiles.",
            damage_variants=[f"{key}_z{s}.glb" for s in range(1,4)],damage_triangles=variant_counts[1:],
            face_textures=f"textures/{key}.png",atlas_tiles=[block_id*16+i for i in range(4)],
            damage_atlas_tiles=[[block_id*16+s*4+i for i in range(4)] for s in range(1,4)]))
        timings[key]=round(time.perf_counter()-step,3)
        counts[key]=variant_counts
        print(f"KIT_V1 {key}: {variant_counts} tris, {timings[key]}s",flush=True)
    for key,factory,texture_file,budget in [("cannon",cannon,"cannon-atlas.png",1199),("person",person,"person-atlas.png",300)]:
        step=time.perf_counter()
        material=common.base_material(key+"Paint",image(OUTPUT/texture_file),vertex_colors=True)
        objects=factory(material)
        count=tris(objects)
        assert count<=budget,(key,count,budget)
        common.export_glb(OUTPUT/f"{key}.glb",objects)
        if render:
            thumbnail(OUTPUT/"thumbs"/f"{key}.png",objects)
        counts[key]=count
        timings[key]=round(time.perf_counter()-step,3)
        remove(objects)
        print(f"KIT_V1 {key}: {count} tris, {timings[key]}s",flush=True)
    manifest["weapons"]=[dict(key="cannon",mesh="cannon.glb",triangles=counts["cannon"],atlas="cannon-atlas.png",thumbnail="thumbs/cannon.png",
        dimensions_m=[1.55,1.4,2.6],parts=["frame","turntable","barrel"],nodes=["Base","Yaw","Pitch","Muzzle","Sight"],
        trunnion_m=[0,1.07,-.15],muzzle_m=[0,1.07,-1.6])]
    manifest["people"]=[dict(key="person",mesh="person.glb",triangles=counts["person"],height_m=1.75,atlas="person-atlas.png",thumbnail="thumbs/person.png",rigged=False)]
    (OUTPUT/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
    timings["textures"]=round(texture_seconds,3)
    timings["total"]=round(time.perf_counter()-started,3)
    (OUTPUT/"generation.json").write_text(json.dumps(dict(blender="4.5.14",triangles=counts,seconds=timings),indent=2)+"\n")
    if render:
        subprocess.run(["python3","-I",str(Path(__file__).with_name("kit_v1_preview.py")),"--contact"],check=True)
    print(f"KIT_V1_TOTAL {timings['total']}s",flush=True)


def main():
    parser=argparse.ArgumentParser(description="Generate the independent kit-v1 assets; no external art inputs")
    parser.add_argument("--no-render",action="store_true")
    args=parser.parse_args(common.argv())
    generate(not args.no_render)


if __name__=="__main__":
    common.run(main)
